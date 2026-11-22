import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { ConversationDto } from './dto/chat.dto';
import { ChatConversation } from './schemas/conversation.schema';

@Injectable()
export class ConversationRepository {
  constructor(
    @InjectModel(ChatConversation.name)
    private readonly model: Model<ChatConversation>
  ) {}
  async create(ownerId: string, title: string): Promise<ConversationDto> {
    const row = await this.model.create({
      _id: randomUUID(),
      ownerId,
      title,
      updatedAt: new Date().toISOString(),
      revision: 0,
      messages: [],
    });
    return this.toDto(row);
  }
  async list(ownerId: string): Promise<ConversationDto[]> {
    const rows = await this.model
      .find({ ownerId })
      .select({ messages: 0 })
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean()
      .exec();
    // List responses omit message history; get() supplies the canonical snapshot.
    return rows.map((row) => ({ ...this.toDto(row), messages: [] }));
  }
  async get(ownerId: string, id: string): Promise<ConversationDto> {
    const row = await this.model.findOne({ _id: id, ownerId }).lean().exec();
    if (!row) throw new NotFoundException('Conversation not found');
    return this.toDto(row);
  }
  async save(
    ownerId: string,
    value: ConversationDto
  ): Promise<ConversationDto> {
    const row = await this.model
      .findOneAndUpdate(
        { _id: value.id, ownerId, revision: value.revision },
        {
          $set: {
            title: value.title,
            updatedAt: new Date().toISOString(),
            messages: value.messages,
            ...(value.activeRunId ? { activeRunId: value.activeRunId } : {}),
          },
          ...(!value.activeRunId ? { $unset: { activeRunId: 1 } } : {}),
          $inc: { revision: 1 },
        },
        { new: true, runValidators: true }
      )
      .lean()
      .exec();
    if (!row)
      throw new ConflictException('Conversation changed; reload and retry');
    return this.toDto(row);
  }
  async recoverInterruptedRuns(): Promise<void> {
    await this.model
      .updateMany(
        { activeRunId: { $exists: true } },
        {
          $set: {
            'messages.$[message].status': 'failed',
            'messages.$[message].error':
              'Response interrupted by a service restart.',
            updatedAt: new Date().toISOString(),
          },
          $unset: { activeRunId: 1 },
          $inc: { revision: 1 },
        },
        { arrayFilters: [{ 'message.status': 'streaming' }] }
      )
      .exec();
  }
  private toDto(row: ChatConversation): ConversationDto {
    return {
      id: row._id,
      title: row.title,
      updatedAt: row.updatedAt,
      revision: row.revision,
      activeRunId: row.activeRunId,
      messages: row.messages,
    };
  }
}
