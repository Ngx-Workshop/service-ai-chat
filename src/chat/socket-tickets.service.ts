import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';

@Injectable()
export class SocketTicketsService {
  private readonly tickets = new Map<
    string,
    { ownerId: string; expires: number }
  >();
  issue(ownerId: string) {
    const now = Date.now();
    for (const [key, value] of this.tickets)
      if (value.expires <= now) this.tickets.delete(key);
    if (this.tickets.size >= 10000)
      throw new ServiceUnavailableException('Try connecting again shortly');
    const ticket = randomBytes(32).toString('hex');
    const expires = now + 30000;
    this.tickets.set(this.hash(ticket), { ownerId, expires });
    return { ticket, expiresAt: new Date(expires).toISOString() };
  }
  consume(ticket: string): string {
    const key = this.hash(ticket);
    const value = this.tickets.get(key);
    this.tickets.delete(key);
    if (!value || value.expires <= Date.now())
      throw new UnauthorizedException('Socket ticket expired');
    return value.ownerId;
  }
  private hash(ticket: string) {
    return createHash('sha256').update(ticket).digest('hex');
  }
}
