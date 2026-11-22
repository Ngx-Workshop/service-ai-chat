import {
  BadRequestException,
  ConflictException,
  Injectable,
  Inject,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Subject } from 'rxjs';
import { ConversationRepository } from './conversation.repository';
import {
  ChatProviderNotConfiguredError,
  ChatProviderError,
  ChatResponder,
} from './chat-responder';
import { ConversationDto } from './dto/chat.dto';

@Injectable()
export class ChatService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ChatService.name);
  readonly updates = new Subject<{
    ownerId: string;
    conversation: ConversationDto;
  }>();
  private readonly runs = new Map<
    string,
    {
      ownerId: string;
      conversationId: string;
      abort: AbortController;
      done?: Promise<void>;
    }
  >();
  constructor(
    private readonly repository: ConversationRepository,
    @Inject(ChatResponder)
    private readonly responder: Pick<ChatResponder, 'stream'>
  ) {}
  async onApplicationBootstrap() {
    if (process.env.GENERATE_OPENAPI !== 'true')
      await this.repository.recoverInterruptedRuns();
  }
  async onModuleDestroy() {
    for (const run of this.runs.values()) run.abort.abort();
    await Promise.allSettled([...this.runs.values()].map((run) => run.done));
    this.updates.complete();
  }
  async send(
    ownerId: string,
    conversationId: string,
    clientMessageId: string,
    text: string
  ) {
    if (!text.trim() || text.length > 8000)
      throw new BadRequestException('Enter a message of 1–8000 characters');
    const conversation = await this.repository.get(ownerId, conversationId);
    if (
      conversation.messages.some(
        (message) => message.clientMessageId === clientMessageId
      )
    )
      return conversation;
    if (conversation.activeRunId)
      throw new ConflictException('A response is already running');
    if (
      conversation.messages.length >= 200 ||
      conversation.messages.reduce(
        (total, item) =>
          total +
          item.parts.reduce((sum, part) => sum + (part.text?.length || 0), 0),
        0
      ) +
        text.length >
        500000
    )
      throw new BadRequestException('Start a new conversation to continue');
    const runId = randomUUID();
    const createdAt = new Date().toISOString();
    conversation.messages.push(
      {
        id: randomUUID(),
        clientMessageId,
        role: 'user',
        status: 'accepted',
        createdAt,
        parts: [{ kind: 'text', text: text.trim() }],
      },
      {
        id: randomUUID(),
        runId,
        role: 'assistant',
        status: 'streaming',
        createdAt,
        parts: [{ kind: 'text', text: '' }],
      }
    );
    conversation.activeRunId = runId;
    if (conversation.title === 'New conversation')
      conversation.title = text.trim().slice(0, 60);
    const saved = await this.repository.save(ownerId, conversation);
    this.updates.next({ ownerId, conversation: saved });
    const run = {
      ownerId,
      conversationId,
      abort: new AbortController(),
      done: undefined as Promise<void> | undefined,
    };
    this.runs.set(runId, run);
    // Start after the command acknowledgement, independent of the connection lifetime.
    run.done = new Promise<void>((resolve) => setImmediate(resolve))
      .then(() => this.generate(ownerId, saved, runId, run.abort.signal))
      .catch(() => this.logger.error('Chat run persistence failed', { runId }))
      .finally(() => this.runs.delete(runId));
    return saved;
  }
  async cancel(ownerId: string, conversationId: string, runId: string) {
    const conversation = await this.repository.get(ownerId, conversationId);
    const run = this.runs.get(runId);
    if (conversation.activeRunId !== runId) return conversation;
    if (
      !run ||
      run.ownerId !== ownerId ||
      run.conversationId !== conversationId
    ) {
      throw new ConflictException(
        'Response unavailable; reload the conversation'
      );
    }
    run.abort.abort();
    await run.done;
    return this.repository.get(ownerId, conversationId);
  }
  private async generate(
    ownerId: string,
    conversation: ConversationDto,
    runId: string,
    signal: AbortSignal
  ) {
    let current = conversation;
    const message = current.messages.find((item) => item.runId === runId)!;
    try {
      for await (const delta of this.responder.stream(
        current.messages.filter((item) => item.runId !== runId),
        signal
      )) {
        if (signal.aborted) break;
        if (message.parts[0].text!.length + delta.length > 100000)
          throw new Error('Response limit exceeded');
        message.parts[0].text += delta;
        current.messages = current.messages.map((item) =>
          item.runId === runId ? message : item
        );
        current = await this.repository.save(ownerId, current);
        this.updates.next({ ownerId, conversation: current });
      }
      message.status = signal.aborted ? 'canceled' : 'completed';
    } catch (error) {
      message.status = signal.aborted ? 'canceled' : 'failed';
      // Provider internals must never be sent to clients.
      message.error = signal.aborted
        ? undefined
        : error instanceof ChatProviderNotConfiguredError ||
            error instanceof ChatProviderError
          ? error.message
          : 'The response failed. Please try another message.';
    }
    current.activeRunId = undefined;
    current.messages = current.messages.map((item) =>
      item.runId === runId ? message : item
    );
    const saved = await this.repository.save(ownerId, current);
    this.updates.next({ ownerId, conversation: saved });
  }
}
