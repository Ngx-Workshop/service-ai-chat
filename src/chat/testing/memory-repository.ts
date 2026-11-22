/* eslint-disable @typescript-eslint/require-await -- In-memory doubles implement asynchronous persistence boundaries. */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ConversationDto } from '../dto/chat.dto';
/** Test double only. Production uses MongoDB revision checks. */
export class MemoryRepository {
  readonly rows = new Map<
    string,
    { ownerId: string; value: ConversationDto }
  >();
  async create(ownerId: string, title: string): Promise<ConversationDto> {
    const value = {
      id: randomUUID(),
      title,
      revision: 0,
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    this.rows.set(value.id, { ownerId, value });
    return structuredClone(value);
  }
  async list(ownerId: string) {
    return [...this.rows.values()]
      .filter((row) => row.ownerId === ownerId)
      .map((row) => ({ ...structuredClone(row.value), messages: [] }));
  }
  async get(ownerId: string, id: string) {
    const row = this.rows.get(id);
    if (!row || row.ownerId !== ownerId) throw new NotFoundException();
    return structuredClone(row.value);
  }
  async save(ownerId: string, value: ConversationDto) {
    const current = await this.get(ownerId, value.id);
    if (current.revision !== value.revision) throw new ConflictException();
    const saved = {
      ...structuredClone(value),
      revision: value.revision + 1,
      updatedAt: new Date().toISOString(),
    };
    this.rows.set(value.id, { ownerId, value: saved });
    return structuredClone(saved);
  }
  async recoverInterruptedRuns() {}
}
