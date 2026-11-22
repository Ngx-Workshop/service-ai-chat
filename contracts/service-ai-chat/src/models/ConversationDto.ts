/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ChatMessageDto } from './ChatMessageDto';
export type ConversationDto = {
    id: string;
    title: string;
    updatedAt: string;
    revision: number;
    activeRunId?: string;
    messages: Array<ChatMessageDto>;
};

