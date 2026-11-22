/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type A2uiActionDto = {
    id: string;
    type: 'prompt' | 'navigate' | 'quiz' | 'progress';
    label: string;
    prompt?: string;
    path?: string;
    answer?: string;
    explanation?: string;
    fields?: Array<string>;
};

