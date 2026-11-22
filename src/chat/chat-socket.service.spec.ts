import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { HttpAdapterHost } from '@nestjs/core';
import { WebSocket } from 'ws';
import { ChatSocketService } from './chat-socket.service';
import { ChatService } from './chat.service';
import { ChatResponder } from './chat-responder';
import { ConversationRepository } from './conversation.repository';
import { SocketTicketsService } from './socket-tickets.service';
import { ChatEventDto } from './dto/chat.dto';
import { MemoryRepository } from './testing/memory-repository';

class TestSocket extends EventEmitter {
  readyState = WebSocket.OPEN;
  bufferedAmount = 0;
  sent: ChatEventDto[] = [];
  code?: number;
  send(raw: string) {
    this.sent.push(JSON.parse(raw) as ChatEventDto);
  }
  close(code: number) {
    this.code = code;
    this.emit('close');
  }
  terminate() {
    this.close(1006);
  }
  message(value: unknown) {
    this.emit('message', Buffer.from(JSON.stringify(value)), false);
  }
}
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('Chat socket command boundary without listening ports', () => {
  let gateway: ChatSocketService;
  let chat: ChatService;
  let repository: MemoryRepository;
  let tickets: SocketTicketsService;
  let socket: TestSocket;
  beforeEach(() => {
    repository = new MemoryRepository();
    tickets = new SocketTicketsService();
    chat = new ChatService(
      repository as unknown as ConversationRepository,
      new ChatResponder()
    );
    gateway = new ChatSocketService(
      {} as HttpAdapterHost,
      chat,
      repository as unknown as ConversationRepository,
      tickets
    );
    socket = new TestSocket();
    gateway['connect'](socket as unknown as WebSocket);
  });
  afterEach(async () => {
    socket.terminate();
    gateway.onModuleDestroy();
    await chat.onModuleDestroy();
  });
  it('rejects commands before authentication and never exposes another account conversation', async () => {
    socket.message({
      type: 'subscribe',
      conversationId: randomUUID(),
      requestId: randomUUID(),
    });
    await flush();
    expect(socket.code).toBe(4401);
    const next = new TestSocket();
    gateway['connect'](next as unknown as WebSocket);
    next.message({ type: 'authenticate', ticket: tickets.issue('bob').ticket });
    await flush();
    const conversation = await repository.create('alice', 'Private');
    const requestId = randomUUID();
    next.message({
      type: 'subscribe',
      conversationId: conversation.id,
      requestId,
    });
    await flush();
    expect(next.sent.at(-1)).toMatchObject({
      type: 'error',
      code: '404',
      requestId,
    });
    expect(JSON.stringify(next.sent)).not.toContain('Private');
    next.terminate();
  });
  it('validates frames, correlates invalid commands and serializes immediate subscribe/send commands', async () => {
    const conversation = await repository.create('alice', 'New conversation');
    socket.message({
      type: 'authenticate',
      ticket: tickets.issue('alice').ticket,
    });
    await flush();
    expect(socket.sent[0].type).toBe('ready');
    const invalidId = randomUUID();
    socket.message({
      type: 'send_message',
      conversationId: conversation.id,
      requestId: invalidId,
      text: 'Hello',
      extra: true,
    });
    await flush();
    expect(socket.sent.at(-1)).toMatchObject({
      type: 'error',
      requestId: invalidId,
    });
    const subscribeId = randomUUID();
    const sendId = randomUUID();
    socket.message({
      type: 'subscribe',
      conversationId: conversation.id,
      requestId: subscribeId,
    });
    socket.message({
      type: 'send_message',
      conversationId: conversation.id,
      requestId: sendId,
      clientMessageId: randomUUID(),
      text: 'Hello',
    });
    await flush();
    await flush();
    expect(
      socket.sent.some(
        (event) => event.requestId === subscribeId && event.type === 'snapshot'
      )
    ).toBe(true);
    expect(
      socket.sent.some(
        (event) =>
          event.requestId === sendId &&
          event.conversation?.messages.length === 2
      )
    ).toBe(true);
  });
});
