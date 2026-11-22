import type { ChatMessageDto } from './ChatMessageDto';
export type ConversationDto = {
    id: string;
    title: string;
    updatedAt: string;
    revision: number;
    activeRunId?: string;
    messages: Array<ChatMessageDto>;
};
