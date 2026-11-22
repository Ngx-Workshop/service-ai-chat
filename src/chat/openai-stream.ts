/** Incremental SSE decoding; handles UTF-8, CRLF and arbitrary network boundaries. */
export async function* openAiEvents(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<Record<string, unknown>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let data: string[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done
        ? decoder.decode()
        : decoder.decode(value, { stream: true });
      if (buffer.length > 262144) throw new Error('Provider frame too large');
      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/, '');
        buffer = buffer.slice(newline + 1);
        if (!line && data.length) {
          const payload = data.join('\n');
          data = [];
          if (payload !== '[DONE]') {
            const event: unknown = JSON.parse(payload);
            if (!event || typeof event !== 'object' || Array.isArray(event))
              throw new Error('Invalid provider event');
            yield event as Record<string, unknown>;
          }
        } else if (line.startsWith('data:')) {
          data.push(line.slice(5).replace(/^ /, ''));
          if (data.reduce((sum, item) => sum + item.length, 0) > 262144)
            throw new Error('Provider frame too large');
        }
      }
      if (done) return;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
