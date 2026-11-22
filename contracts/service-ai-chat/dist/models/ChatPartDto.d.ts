export type ChatPartDto = {
    kind: 'text' | 'tool' | 'a2ui';
    text?: string;
    payload?: Record<string, any>;
};
