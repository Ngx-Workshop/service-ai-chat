import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { firstValueFrom, filter, timeout } from 'rxjs';
import { ChatService } from './chat.service';
import { ChatResponder } from './chat-responder';
import { ConversationRepository } from './conversation.repository';
import { SocketTicketsService } from './socket-tickets.service';
import { MemoryRepository } from './testing/memory-repository';
import {
  createServiceLogger,
  withLogContext,
} from '../observability/observability';

describe('Chat foundation', () => {
  let repository: MemoryRepository;
  let service: ChatService;
  let log: jest.SpyInstance;
  let error: jest.SpyInstance;
  beforeEach(() => {
    repository = new MemoryRepository();
    log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });
  afterEach(async () => {
    if (service) await service.onModuleDestroy();
    jest.restoreAllMocks();
  });
  function create(
    responder: Pick<ChatResponder, 'stream'> = new ChatResponder()
  ) {
    service = new ChatService(
      repository as unknown as ConversationRepository,
      responder
    );
    return service;
  }
  it('persists accepted input, makes duplicate sends idempotent and reports missing provider honestly', async () => {
    create();
    const conversation = await repository.create('alice', 'New conversation');
    const id = randomUUID();
    const finished = firstValueFrom(
      service.updates.pipe(
        filter((event) => !event.conversation.activeRunId),
        timeout(1000)
      )
    );
    const accepted = await service.send(
      'alice',
      conversation.id,
      id,
      '  Explain DI  '
    );
    expect(accepted.messages).toHaveLength(2);
    expect(accepted.messages[0].parts[0].text).toBe('Explain DI');
    expect(accepted.title).toBe('Explain DI');
    expect(
      (await service.send('alice', conversation.id, id, 'Explain DI')).messages
    ).toHaveLength(2);
    const { conversation: completed } = await finished;
    expect(completed.messages[1].status).toBe('failed');
    expect(completed.messages[1].error).toContain('not configured');
    expect(completed.activeRunId).toBeUndefined();
    await expect(
      service.send('bob', conversation.id, randomUUID(), 'Read this')
    ).rejects.toThrow();
    await expect(
      service.send('alice', conversation.id, randomUUID(), '  ')
    ).rejects.toThrow();
  });
  it('streams increasing revisions and retains partial text on cancellation', async () => {
    let started!: () => void;
    const yielded = new Promise<void>((resolve) => {
      started = resolve;
    });
    create({
      async *stream(_messages, signal) {
        yield 'Partial answer';
        started();
        await new Promise<void>((resolve) => {
          if (signal.aborted) resolve();
          else
            signal.addEventListener('abort', () => resolve(), { once: true });
        });
        yield ' must never appear';
      },
    });
    const conversation = await repository.create('alice', 'New conversation');
    const revisions: number[] = [];
    service.updates.subscribe((event) =>
      revisions.push(event.conversation.revision)
    );
    const accepted = await service.send(
      'alice',
      conversation.id,
      randomUUID(),
      'Hello'
    );
    await yielded;
    await expect(
      service.send('alice', conversation.id, randomUUID(), 'Another')
    ).rejects.toThrow('already running');
    const canceled = await service.cancel(
      'alice',
      conversation.id,
      accepted.activeRunId!
    );
    expect(canceled.messages[1].status).toBe('canceled');
    expect(canceled.messages[1].parts[0].text).toBe('Partial answer');
    expect(canceled.activeRunId).toBeUndefined();
    expect(revisions).toEqual([1, 2, 3]);
  });
  it('does not disclose provider secrets when generation fails', async () => {
    create({
      async *stream() {
        yield await Promise.reject<string>(new Error('SECRET_API_KEY'));
      },
    });
    const c = await repository.create('alice', 'New conversation');
    const finished = firstValueFrom(
      service.updates.pipe(
        filter((event) => !event.conversation.activeRunId),
        timeout(1000)
      )
    );
    await service.send('alice', c.id, randomUUID(), 'Hello');
    expect(JSON.stringify((await finished).conversation)).not.toContain(
      'SECRET_API_KEY'
    );
  });
  it('tickets expire and are consumed once', () => {
    const tickets = new SocketTicketsService();
    const first = tickets.issue('alice');
    expect(tickets.consume(first.ticket)).toBe('alice');
    expect(() => tickets.consume(first.ticket)).toThrow();
    const second = tickets.issue('alice');
    const now = Date.now();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(now + 31000);
    expect(() => tickets.consume(second.ticket)).toThrow();
    clock.mockRestore();
  });
  it('emits one safe terminal JSON event per concurrent run with originating correlation', async () => {
    create({
      async *stream(messages) {
        await new Promise<void>((resolve) => setImmediate(resolve));
        if (messages[0].parts[0].text === 'private-failure-content')
          throw new Error('private-provider-key');
        yield 'private-generated-content';
      },
    });
    const output: string[] = [];
    const write = (value: string | Uint8Array) => {
      output.push(String(value));
      return true;
    };
    jest.spyOn(process.stdout, 'write').mockImplementation(write);
    jest.spyOn(process.stderr, 'write').mockImplementation(write);
    const jsonLogger = createServiceLogger();
    jest.spyOn(Logger.prototype, 'log').mockImplementation((entry: unknown) => {
      jsonLogger.log(entry, 'ChatService');
    });
    jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation((entry: unknown) => {
        jsonLogger.error(entry, 'ChatService');
      });
    const expected: { requestId: string; runId: string; outcome: string }[] =
      [];
    await Promise.all(
      ['private-success-content', 'private-failure-content'].map(
        async (text) => {
          const conversation = await repository.create(
            'alice',
            'Private title'
          );
          const requestId = randomUUID();
          const finished = firstValueFrom(
            service.updates.pipe(
              filter(
                (event) =>
                  event.conversation.id === conversation.id &&
                  !event.conversation.activeRunId
              ),
              timeout(1000)
            )
          );
          const saved = await withLogContext({ requestId }, () =>
            service.send('alice', conversation.id, randomUUID(), text)
          );
          expected.push({
            requestId,
            runId: saved.activeRunId!,
            outcome:
              text === 'private-success-content' ? 'completed' : 'failed',
          });
          await finished;
        }
      )
    );
    await service.onModuleDestroy();
    const entries: unknown[] = output.map(
      (line) => JSON.parse(line) as unknown
    );
    expect(entries).toHaveLength(2);
    for (const item of expected) {
      expect(entries).toContainEqual(
        expect.objectContaining({
          context: 'ChatService',
          level: item.outcome === 'failed' ? 'error' : 'log',
          message: {
            event: 'chat_run_finished',
            ...item,
            durationMs: expect.any(Number) as unknown,
          },
        })
      );
    }
    expect(output.join('')).not.toMatch(/private-|Private title|alice/);
  });
  it('logs terminal persistence failure once without hiding it behind a completed outcome', async () => {
    create({
      async *stream() {
        yield await Promise.resolve('private-output');
      },
    });
    const conversation = await repository.create('alice', 'New conversation');
    const accepted = await service.send(
      'alice',
      conversation.id,
      randomUUID(),
      'private-input'
    );
    const runId = accepted.activeRunId;
    jest
      .spyOn(repository, 'save')
      .mockRejectedValue(new Error('private-storage-key'));
    await service.onModuleDestroy();
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'chat_run_finished',
        outcome: 'persistence_failed',
        runId,
        durationMs: expect.any(Number) as unknown,
      })
    );
    expect(log).not.toHaveBeenCalled();
    expect(JSON.stringify(error.mock.calls)).not.toContain('private-');
  });
});
