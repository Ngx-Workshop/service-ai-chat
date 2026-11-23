import {
  HttpException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import type { Server } from 'node:http';
import { socketText } from './socket-data';
import { HttpAdapterHost } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { isUUID, validate } from 'class-validator';
import { Subscription } from 'rxjs';
import { WebSocket, WebSocketServer } from 'ws';
import { ChatCommandDto, ChatEventDto } from './dto/chat.dto';
import { ChatService } from './chat.service';
import { SocketTicketsService } from './socket-tickets.service';
import { withLogContext } from '../observability/observability';

type Session = {
  ownerId?: string;
  conversationId?: string;
  alive: boolean;
  queued: number;
};
@Injectable()
export class ChatSocketService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private server?: WebSocketServer;
  private heartbeat?: NodeJS.Timeout;
  private subscription?: Subscription;
  private readonly sessions = new Map<WebSocket, Session>();
  private readonly logger = new Logger(ChatSocketService.name);
  constructor(
    private readonly adapter: HttpAdapterHost,
    private readonly chat: ChatService,
    private readonly tickets: SocketTicketsService
  ) {}
  onApplicationBootstrap() {
    if (process.env.GENERATE_OPENAPI === 'true') return;
    const allowed = new Set(
      (
        process.env.CHAT_ALLOWED_ORIGINS ||
        'https://beta.ngx-workshop.io,https://admin.ngx-workshop.io,http://localhost:4201'
      )
        .split(',')
        .map((value) => value.trim())
    );
    this.server = new WebSocketServer({
      server: this.adapter.httpAdapter.getHttpServer() as Server,
      path: '/ai-chat/socket',
      maxPayload: 32768,
      verifyClient: (
        info: { origin: string },
        done: (allowed: boolean, status?: number, message?: string) => void
      ) => {
        if (allowed.has(info.origin)) done(true);
        else done(false, 403, 'Origin not allowed');
      },
    });
    this.server.on('connection', (socket) => this.connect(socket));
    this.subscription = this.chat.updates.subscribe(
      ({ ownerId, conversation }) => {
        for (const [socket, session] of this.sessions) {
          if (
            session.ownerId === ownerId &&
            session.conversationId === conversation.id
          ) {
            this.send(socket, { type: 'snapshot', conversation });
          }
        }
      }
    );
    this.heartbeat = setInterval(() => {
      for (const [socket, session] of this.sessions) {
        if (!session.alive) {
          socket.terminate();
          continue;
        }
        session.alive = false;
        socket.ping();
      }
    }, 25000);
    this.heartbeat.unref();
  }
  onModuleDestroy() {
    clearInterval(this.heartbeat);
    this.subscription?.unsubscribe();
    for (const socket of this.sessions.keys()) socket.terminate();
    this.server?.close();
  }
  private connect(socket: WebSocket) {
    const session: Session = { alive: true, queued: 0 };
    this.sessions.set(socket, session);
    const authTimeout = setTimeout(
      () => socket.close(4401, 'Authentication required'),
      5000
    );
    const sessionTimeout = setTimeout(
      () => socket.close(4401, 'Renew session'),
      15 * 60000
    );
    socket.on('pong', () => {
      session.alive = true;
    });
    socket.on('error', () => socket.terminate());
    socket.on('close', () => {
      clearTimeout(authTimeout);
      clearTimeout(sessionTimeout);
      this.sessions.delete(socket);
    });
    let queue = Promise.resolve();
    socket.on('message', (raw, binary) => {
      if (++session.queued > 16) {
        socket.close(1013, 'Too many commands');
        return;
      }
      queue = queue
        .then(() => this.handle(socket, session, socketText(raw), binary))
        .then(() => {
          if (session.ownerId) clearTimeout(authTimeout);
        })
        .catch(() => socket.close(1011, 'Chat unavailable'))
        .finally(() => {
          session.queued--;
        });
    });
  }
  private async handle(
    socket: WebSocket,
    session: Session,
    raw: string,
    binary: boolean
  ) {
    let requestId: string | undefined;
    let dispatched = false;
    const started = Date.now();
    try {
      if (binary) throw new Error('Binary commands unsupported');
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Invalid command');
      if (!session.ownerId) {
        const auth = value as Record<string, unknown>;
        if (
          auth['type'] !== 'authenticate' ||
          typeof auth['ticket'] !== 'string' ||
          auth['ticket'].length !== 64
        )
          throw new Error('Authentication required');
        session.ownerId = this.tickets.consume(auth['ticket']);
        this.send(socket, { type: 'ready', userId: session.ownerId });
        return;
      }
      const suppliedId = (value as Record<string, unknown>)['requestId'];
      if (typeof suppliedId === 'string' && isUUID(suppliedId))
        requestId = suppliedId;
      const dto = plainToInstance(ChatCommandDto, value);
      if (
        (await validate(dto, { whitelist: true, forbidNonWhitelisted: true }))
          .length
      )
        throw new Error('Invalid command');
      requestId = dto.requestId;
      const ownerId = session.ownerId;
      dispatched = true;
      const conversation = await withLogContext({ requestId }, () => {
        if (dto.type === 'subscribe')
          return this.chat.get(ownerId, dto.conversationId);
        else if (
          dto.type === 'send_message' &&
          dto.clientMessageId &&
          dto.text !== undefined
        ) {
          return this.chat.send(
            ownerId,
            dto.conversationId,
            dto.clientMessageId,
            dto.text
          );
        } else if (dto.type === 'ui_action') {
          return this.chat.uiAction(ownerId, dto);
        } else if (dto.type === 'cancel_run' && dto.runId) {
          return this.chat.cancel(ownerId, dto.conversationId, dto.runId);
        } else throw new Error('Missing command fields');
      });
      session.conversationId = conversation.id;
      this.send(socket, { type: 'snapshot', requestId, conversation });
    } catch (error) {
      if (!session.ownerId) {
        socket.close(4401, 'Authentication required');
        return;
      }
      const status = error instanceof HttpException ? error.getStatus() : 400;
      const entry = {
        event: 'chat_command_failed',
        outcome:
          !dispatched || (error instanceof HttpException && status < 500)
            ? 'rejected'
            : 'failed',
        ...(requestId ? { requestId } : {}),
        durationMs: Date.now() - started,
      };
      if (entry.outcome === 'rejected') this.logger.warn(entry);
      else this.logger.error(entry);
      this.send(socket, {
        type: 'error',
        requestId,
        code: String(status),
        message:
          error instanceof HttpException && status < 500
            ? error.message
            : 'Unable to process the chat command.',
      });
    }
  }
  private send(socket: WebSocket, event: ChatEventDto) {
    if (socket.readyState !== WebSocket.OPEN) return;
    if (socket.bufferedAmount > 1048576) {
      socket.close(1013, 'Reconnect to recover messages');
      return;
    }
    socket.send(JSON.stringify(event));
  }
}
