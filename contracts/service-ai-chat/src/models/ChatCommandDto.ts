/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ChatCommandDto = {
    type: 'subscribe' | 'send_message' | 'cancel_run' | 'ui_action';
    requestId: string;
    conversationId: string;
    clientMessageId?: string;
    text?: string;
    runId?: string;
    uiRevision?: number;
    messageId?: string;
    surfaceId?: string;
    actionId?: string;
    values?: Record<string, any>;
};

