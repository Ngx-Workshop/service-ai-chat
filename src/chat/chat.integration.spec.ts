import {
  INestApplication,
  ExecutionContext,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RemoteAuthGuard } from '@tmdjr/ngx-auth-client';
import { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { Request } from 'express';
import { socketText } from './socket-data';
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Supertest is callable CommonJS in this build.
import request = require('supertest');
import { WebSocket } from 'ws';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatSocketService } from './chat-socket.service';
import { ChatResponder } from './chat-responder';
import { ConversationRepository } from './conversation.repository';
import { SocketTicketsService } from './socket-tickets.service';
import { ChatEventDto, ConversationDto, SocketTicketDto } from './dto/chat.dto';
import { MemoryRepository } from './testing/memory-repository';

describe('Chat HTTP and real WebSocket integration', () => {
  let app: INestApplication<Server>;
  let url: string;
  const sockets: WebSocket[] = [];
  let repository: ConversationRepository;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        ChatService,
        ChatSocketService,
        SocketTicketsService,
        ChatResponder,
        { provide: ConversationRepository, useClass: MemoryRepository },
      ],
    })
      .overrideGuard(RemoteAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context
            .switchToHttp()
            .getRequest<Request & { user?: { sub: string } }>();
          const owner = req.headers['x-test-user'];
          if (typeof owner !== 'string') throw new UnauthorizedException();
          req.user = { sub: owner };
          return true;
        },
      })
      .compile();
    repository = module.get(ConversationRepository);
    app = module.createNestApplication<INestApplication<Server>>({
      logger: false,
    });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })
    );
    await app.listen(0, '127.0.0.1');
    url = `ws://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/ai-chat/socket`;
  });
  afterAll(async () => {
    sockets.forEach((socket) => socket.terminate());
    await app?.close();
  });
  function client() {
    const socket = new WebSocket(url, {
      origin: 'https://beta.ngx-workshop.io',
    });
    sockets.push(socket);
    const queued: ChatEventDto[] = [];
    let notify: ((event: ChatEventDto) => void) | undefined;
    socket.on('message', (data) => {
      const event = JSON.parse(socketText(data)) as ChatEventDto;
      if (notify) {
        const cb = notify;
        notify = undefined;
        cb(event);
      } else queued.push(event);
    });
    return {
      socket,
      next: () =>
        new Promise<ChatEventDto>((resolve) => {
          const event = queued.shift();
          if (event) resolve(event);
          else notify = resolve;
        }),
      opened: new Promise<void>((resolve, reject) => {
        socket.once('open', resolve);
        socket.once('error', reject);
      }),
    };
  }
  async function ticket(owner: string) {
    const result = await request(app.getHttpServer())
      .post('/ai-chat/socket-ticket')
      .set('x-test-user', owner)
      .expect(201);
    return (result.body as SocketTicketDto).ticket;
  }
  it('denies anonymous requests, malformed DTOs and cross-user conversations', async () => {
    await request(app.getHttpServer())
      .get('/ai-chat/conversations')
      .expect(401);
    await request(app.getHttpServer())
      .post('/ai-chat/conversations')
      .set('x-test-user', 'alice')
      .send({ ownerId: 'bob' })
      .expect(400);
    const created = await request(app.getHttpServer())
      .post('/ai-chat/conversations')
      .set('x-test-user', 'alice')
      .send({})
      .expect(201);
    await request(app.getHttpServer())
      .get(`/ai-chat/conversations/${(created.body as ConversationDto).id}`)
      .set('x-test-user', 'bob')
      .expect(404);
    await request(app.getHttpServer())
      .get('/ai-chat/conversations/invalid')
      .set('x-test-user', 'alice')
      .expect(400);
  });
  it('normalizes titles, lists owner summaries and propagates storage failures', async () => {
    for (const [title, expected] of [
      ['  Focused topic  ', 'Focused topic'],
      ['   ', 'New conversation'],
    ]) {
      const created = await request(app.getHttpServer())
        .post('/ai-chat/conversations')
        .set('x-test-user', 'title-owner')
        .send({ title })
        .expect(201);
      const conversation = created.body as ConversationDto;
      expect(conversation.title).toBe(expected);
      const loaded = await request(app.getHttpServer())
        .get(`/ai-chat/conversations/${conversation.id}`)
        .set('x-test-user', 'title-owner')
        .expect(200);
      expect(loaded.body).toEqual(conversation);
    }
    const listed = await request(app.getHttpServer())
      .get('/ai-chat/conversations')
      .set('x-test-user', 'title-owner')
      .expect(200);
    expect(listed.body).toEqual([
      expect.objectContaining({ title: 'Focused topic', messages: [] }),
      expect.objectContaining({ title: 'New conversation', messages: [] }),
    ]);
    const other = await request(app.getHttpServer())
      .get('/ai-chat/conversations')
      .set('x-test-user', 'unrelated-owner')
      .expect(200);
    expect(other.body).toEqual([]);
    const failure = jest
      .spyOn(repository, 'create')
      .mockRejectedValueOnce(new Error('private-storage-detail'));
    try {
      const response = await request(app.getHttpServer())
        .post('/ai-chat/conversations')
        .set('x-test-user', 'title-owner')
        .send({})
        .expect(500);
      expect(JSON.stringify(response.body)).not.toContain(
        'private-storage-detail'
      );
    } finally {
      failure.mockRestore();
    }
  });
  it('authenticates once, acknowledges persisted sends and recovers the terminal snapshot after reconnect', async () => {
    const created = await request(app.getHttpServer())
      .post('/ai-chat/conversations')
      .set('x-test-user', 'alice')
      .send({})
      .expect(201);
    const c = client();
    await c.opened;
    const secret = await ticket('alice');
    c.socket.send(JSON.stringify({ type: 'authenticate', ticket: secret }));
    expect((await c.next()).type).toBe('ready');
    const requestId = randomUUID();
    const clientMessageId = randomUUID();
    c.socket.send(
      JSON.stringify({
        type: 'send_message',
        requestId,
        clientMessageId,
        conversationId: (created.body as ConversationDto).id,
        text: 'Hello',
      })
    );
    const ack = await c.next();
    expect(ack.requestId).toBe(requestId);
    expect(ack.conversation?.messages).toHaveLength(2);
    const terminal = await c.next();
    expect(terminal.conversation?.messages[1].status).toBe('failed');
    c.socket.close();
    const d = client();
    await d.opened;
    d.socket.send(
      JSON.stringify({ type: 'authenticate', ticket: await ticket('alice') })
    );
    await d.next();
    d.socket.send(
      JSON.stringify({
        type: 'subscribe',
        requestId: randomUUID(),
        conversationId: (created.body as ConversationDto).id,
      })
    );
    expect((await d.next()).conversation).toEqual(terminal.conversation);
    d.socket.send(
      JSON.stringify({
        type: 'send_message',
        requestId: randomUUID(),
        clientMessageId,
        conversationId: (created.body as ConversationDto).id,
        text: 'Hello',
      })
    );
    expect((await d.next()).conversation?.messages).toHaveLength(2);
    const reused = client();
    await reused.opened;
    const closed = new Promise<number>((resolve) =>
      reused.socket.once('close', (code) => resolve(code))
    );
    reused.socket.send(
      JSON.stringify({ type: 'authenticate', ticket: secret })
    );
    expect(await closed).toBe(4401);
  });
  it('rejects an unapproved origin before authentication', async () => {
    const socket = new WebSocket(url, { origin: 'https://untrusted.example' });
    sockets.push(socket);
    await expect(
      new Promise<string>((resolve) =>
        socket.once('error', (error) => resolve(error.message))
      )
    ).resolves.toContain('403');
  });
});
