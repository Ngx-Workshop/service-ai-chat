import { randomUUID } from 'node:crypto';
import { firstValueFrom, filter, timeout } from 'rxjs';
import { ChatService } from './chat.service';
import { ChatResponder } from './chat-responder';
import { ConversationRepository } from './conversation.repository';
import { SocketTicketsService } from './socket-tickets.service';
import { MemoryRepository } from './testing/memory-repository';

describe('Chat foundation', () => {
  let repository: MemoryRepository;
  let service: ChatService;
  beforeEach(() => {
    repository = new MemoryRepository();
  });
  afterEach(async () => {
    if (service) await service.onModuleDestroy();
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
});
