/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ChatCommandDto = {
    type: 'subscribe' | 'send_message' | 'cancel_run';
    requestId: string;
    conversationId: string;
    clientMessageId?: string;
    text?: string;
    runId?: string;
};

