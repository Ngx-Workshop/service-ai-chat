/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type SocketAuthenticateDto = {
    type: 'authenticate';
    /**
     * One-use ticket from POST /ai-chat/socket-ticket. Expires after 30 seconds.
     */
    ticket: string;
};

