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
