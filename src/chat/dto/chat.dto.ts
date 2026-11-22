import { A2uiSurfaceDto } from './a2ui.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsObject,
  IsInt,
  Min,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateConversationDto {
  @ApiPropertyOptional({ maxLength: 100, default: 'New conversation' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title?: string;
}
export class ChatPartDto {
  @ApiProperty({ enum: ['text', 'tool', 'a2ui'] }) kind:
    | 'text'
    | 'tool'
    | 'a2ui';
  @ApiPropertyOptional() text?: string;
  @ApiPropertyOptional({ type: A2uiSurfaceDto }) ui?: A2uiSurfaceDto;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  payload?: Record<string, unknown>;
}
export class ChatMessageDto {
  @ApiProperty() id: string;
  @ApiPropertyOptional() clientMessageId?: string;
  @ApiPropertyOptional() runId?: string;
  @ApiProperty({ enum: ['user', 'assistant'] }) role: 'user' | 'assistant';
  @ApiProperty({
    enum: ['accepted', 'streaming', 'completed', 'failed', 'canceled'],
  })
  status: 'accepted' | 'streaming' | 'completed' | 'failed' | 'canceled';
  @ApiProperty({ type: [ChatPartDto] }) parts: ChatPartDto[];
  @ApiProperty() createdAt: string;
  @ApiPropertyOptional() error?: string;
}
export class ConversationDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty() updatedAt: string;
  @ApiProperty() revision: number;
  @ApiPropertyOptional() activeRunId?: string;
  @ApiProperty({ type: [ChatMessageDto] }) messages: ChatMessageDto[];
}
export class SocketTicketDto {
  @ApiProperty() ticket: string;
  @ApiProperty() expiresAt: string;
}
export class ChatCommandDto {
  @ApiProperty({
    enum: ['subscribe', 'send_message', 'cancel_run', 'ui_action'],
  })
  @IsIn(['subscribe', 'send_message', 'cancel_run', 'ui_action'])
  type: 'subscribe' | 'send_message' | 'cancel_run' | 'ui_action';
  @ApiProperty() @IsUUID() requestId: string;
  @ApiProperty() @IsUUID() conversationId: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() clientMessageId?: string;
  @ApiPropertyOptional({ maxLength: 8000 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  text?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() runId?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) uiRevision?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() messageId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() surfaceId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  actionId?: string;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  values?: Record<string, unknown>;
}
export class ChatEventDto {
  @ApiProperty({ enum: ['ready', 'snapshot', 'error'] }) type:
    | 'ready'
    | 'snapshot'
    | 'error';
  @ApiPropertyOptional() requestId?: string;
  @ApiPropertyOptional({
    description:
      'Authenticated principal on ready events; permits clearing cached state after account changes.',
  })
  userId?: string;
  @ApiPropertyOptional({ type: ConversationDto })
  conversation?: ConversationDto;
  @ApiPropertyOptional() code?: string;
  @ApiPropertyOptional() message?: string;
}

export class SocketAuthenticateDto {
  @ApiProperty({ enum: ['authenticate'] }) type: 'authenticate';
  @ApiProperty({
    description:
      'One-use ticket from POST /ai-chat/socket-ticket. Expires after 30 seconds.',
  })
  ticket: string;
}
