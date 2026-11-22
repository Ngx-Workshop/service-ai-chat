import type { A2uiActionDto } from './A2uiActionDto';
export type A2uiSurfaceDto = {
    version: '1.0';
    surfaceId: string;
    revision: number;
    messages: Array<Record<string, any>>;
    actions: Array<A2uiActionDto>;
    fallback: string;
};
