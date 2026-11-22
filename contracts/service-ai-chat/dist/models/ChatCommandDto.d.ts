export type ChatCommandDto = {
    type: 'subscribe' | 'send_message' | 'cancel_run';
    requestId: string;
    conversationId: string;
    clientMessageId?: string;
    text?: string;
    runId?: string;
};
