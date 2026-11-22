import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongoSchema } from 'mongoose';
import { ChatMessageDto } from '../dto/chat.dto';

@Schema({ collection: 'ai_chat_conversations', versionKey: false })
export class ChatConversation {
  @Prop({ type: String }) _id: string;
  @Prop({ required: true, index: true }) ownerId: string;
  @Prop({ required: true }) title: string;
  @Prop({ required: true }) updatedAt: string;
  @Prop({ default: 0 }) revision: number;
  @Prop({ type: String }) activeRunId?: string;
  @Prop({ type: [MongoSchema.Types.Mixed], default: [] })
  messages: ChatMessageDto[];
}
export const ChatConversationSchema =
  SchemaFactory.createForClass(ChatConversation);
ChatConversationSchema.index({ ownerId: 1, updatedAt: -1 });
