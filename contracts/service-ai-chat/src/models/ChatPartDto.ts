/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { A2uiSurfaceDto } from './A2uiSurfaceDto';
export type ChatPartDto = {
    kind: 'text' | 'tool' | 'a2ui';
    text?: string;
    ui?: A2uiSurfaceDto;
    payload?: Record<string, any>;
};

