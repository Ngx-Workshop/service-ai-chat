import type { ChatPartDto } from './ChatPartDto';
export type ChatMessageDto = {
    id: string;
    clientMessageId?: string;
    runId?: string;
    role: 'user' | 'assistant';
    status: 'accepted' | 'streaming' | 'completed' | 'failed' | 'canceled';
    parts: Array<ChatPartDto>;
    createdAt: string;
    error?: string;
};
