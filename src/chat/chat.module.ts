import { Module } from '@nestjs/common';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { NgxAuthClientModule } from '@tmdjr/ngx-auth-client';
import {
  ChatConversation,
  ChatConversationSchema,
} from './schemas/conversation.schema';
import { ConversationRepository } from './conversation.repository';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatSocketService } from './chat-socket.service';
import { SocketTicketsService } from './socket-tickets.service';
import { ChatResponder } from './chat-responder';
const generating = process.env.GENERATE_OPENAPI === 'true';
@Module({
  imports: [
    NgxAuthClientModule,
    ...(generating
      ? []
      : [
          MongooseModule.forFeature([
            { name: ChatConversation.name, schema: ChatConversationSchema },
          ]),
        ]),
  ],
  controllers: [ChatController],
  providers: [
    ConversationRepository,
    ChatService,
    ChatSocketService,
    SocketTicketsService,
    ChatResponder,
    ...(generating
      ? [{ provide: getModelToken(ChatConversation.name), useValue: {} }]
      : []),
  ],
})
export class ChatModule {}
