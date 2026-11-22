import type { ConversationDto } from './ConversationDto';
export type ChatEventDto = {
    type: 'ready' | 'snapshot' | 'error';
    requestId?: string;
    /**
     * Authenticated principal on ready events; permits clearing cached state after account changes.
     */
    userId?: string;
    conversation?: ConversationDto;
    code?: string;
    message?: string;
};
