import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ActiveUser, RemoteAuthGuard } from '@tmdjr/ngx-auth-client';
import { ChatService } from './chat.service';
import { SocketTicketsService } from './socket-tickets.service';
import {
  ChatCommandDto,
  ChatEventDto,
  ConversationDto,
  CreateConversationDto,
  SocketTicketDto,
  SocketAuthenticateDto,
} from './dto/chat.dto';

@ApiTags('chat')
@ApiExtraModels(ChatCommandDto, ChatEventDto, SocketAuthenticateDto)
@ApiUnauthorizedResponse({ description: 'Sign in required' })
@UseGuards(RemoteAuthGuard)
@Controller('ai-chat')
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly tickets: SocketTicketsService
  ) {}
  @Get('conversations')
  @ApiOkResponse({ type: [ConversationDto] })
  list(@ActiveUser('sub') ownerId: string) {
    return this.chat.list(ownerId);
  }
  @Post('conversations')
  @ApiCreatedResponse({ type: ConversationDto })
  create(
    @ActiveUser('sub') ownerId: string,
    @Body() dto: CreateConversationDto
  ) {
    return this.chat.create(ownerId, dto.title);
  }
  @Get('conversations/:id')
  @ApiOkResponse({ type: ConversationDto })
  get(
    @ActiveUser('sub') ownerId: string,
    @Param('id', new ParseUUIDPipe()) id: string
  ) {
    return this.chat.get(ownerId, id);
  }
  @Post('socket-ticket')
  @ApiCreatedResponse({ type: SocketTicketDto })
  ticket(@ActiveUser('sub') ownerId: string) {
    return this.tickets.issue(ownerId);
  }
}
