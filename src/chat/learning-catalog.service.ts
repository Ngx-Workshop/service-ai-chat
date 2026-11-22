import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { label } from './a2ui-builder';
export type WorkshopResource = {
  id: string;
  title: string;
  summary: string;
  outline: { kind: string; resourceId: string; title: string }[];
};
@Injectable()
export class LearningCatalogService {
  constructor(private readonly config: ConfigService) {}
  async workshops(
    sectionId: string,
    signal: AbortSignal
  ): Promise<WorkshopResource[]> {
    if (!/^[a-zA-Z0-9_-]{1,120}$/.test(sectionId))
      throw new Error('Invalid section');
    const url = this.url('DOCUMENT_BASE_URL', '/navigation/workshops');
    url.searchParams.set('section', sectionId);
    const data = await this.read(url, signal);
    if (!Array.isArray(data) || data.length > 500)
      throw new Error('Invalid workshop catalog');
    return data.map((value: unknown) => {
      const item = this.object(value);
      const id = this.id(item['_id']);
      if (item['sectionId'] !== sectionId)
        throw new Error('Invalid section result');
      const outline = Array.isArray(item['workshopDocuments'])
        ? item['workshopDocuments']
        : [];
      if (outline.length > 500) throw new Error('Outline too large');
      return {
        id,
        title: label(item['name'], 300),
        summary:
          typeof item['summary'] === 'string'
            ? item['summary'].slice(0, 3000)
            : '',
        outline: outline.map((entry: unknown) => {
          const row = this.object(entry);
          return {
            kind: String(row['kind']),
            resourceId: String(row['resourceId'] || row['_id']),
            title:
              typeof row['name'] === 'string'
                ? row['name'].slice(0, 300)
                : 'Resource',
          };
        }),
      };
    });
  }
  async lab(labId: string, signal: AbortSignal) {
    const data = this.object(
      await this.read(
        this.url('CODING_LABS_BASE_URL', `/published-labs/${this.id(labId)}`),
        signal
      )
    );
    if (this.id(data['labId']).toLowerCase() !== labId.toLowerCase())
      throw new Error('Invalid lab');
    return {
      id: labId,
      title: label(data['title'], 300),
      prompt: label(data['promptMarkdown'], 100000),
      hints: Array.isArray(data['hints'])
        ? data['hints'].slice(0, 5).map((value) => label(value, 3000))
        : [],
      language: label(data['language'], 30),
      version: Number(data['versionNumber']),
    };
  }
  private url(setting: string, path: string) {
    const base = this.config.get<string>(setting);
    if (!base) throw new Error('Catalog is not configured');
    const parsed = new URL(base);
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    )
      throw new Error('Invalid trusted catalog URL');
    return new URL(base.replace(/\/$/, '') + path);
  }
  private async read(url: URL, signal: AbortSignal): Promise<unknown> {
    const response = await fetch(url, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
      redirect: 'error',
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('Catalog unavailable');
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Missing catalog response');
    let text = '';
    let bytes = 0;
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > 2 * 1024 * 1024)
          throw new Error('Catalog response too large');
        text += decoder.decode(value, { stream: true });
      }
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
    return JSON.parse(text + decoder.decode()) as unknown;
  }
  private object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('Invalid catalog response');
    return value as Record<string, unknown>;
  }
  private id(value: unknown) {
    if (typeof value !== 'string' || !/^[a-f0-9]{24}$/i.test(value))
      throw new Error('Invalid resource ID');
    return value;
  }
}
