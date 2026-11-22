import { ConfigService } from '@nestjs/config';
import { ChatResponder } from './chat-responder';
import { ChatMessageDto } from './dto/chat.dto';

const message: ChatMessageDto = {
  id: 'user-message',
  role: 'user',
  status: 'accepted',
  createdAt: '',
  parts: [{ kind: 'text', text: 'Explain DI' }],
};
function response(events: unknown[], fragment = false) {
  const bytes = new TextEncoder().encode(
    events.map((event) => `data: ${JSON.stringify(event)}\r\n\r\n`).join('')
  );
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        if (fragment)
          for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
        else controller.enqueue(bytes);
        controller.close();
      },
    })
  );
}
async function collect(responder: ChatResponder) {
  const chunks: string[] = [];
  for await (const chunk of responder.stream(
    [message],
    new AbortController().signal
  ))
    chunks.push(chunk);
  return chunks;
}
describe('OpenAI chat streaming', () => {
  const config = new ConfigService({
    OPENAI_API_KEY: 'private-test-key',
    CHAT_MODEL: 'gpt-6.1-sol',
    CHAT_MAX_OUTPUT_TOKENS: '4096',
  });
  afterEach(() => jest.restoreAllMocks());
  it('decodes fragmented UTF-8 SSE, forwards conversation text and disables provider storage', async () => {
    const fetcher = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        response(
          [
            { type: 'response.output_text.delta', delta: 'Hello 🌎' },
            { type: 'response.output_text.delta', delta: ' learner' },
            { type: 'response.completed' },
          ],
          true
        )
      );
    expect(await collect(new ChatResponder(config))).toEqual([
      'Hello 🌎',
      ' learner',
    ]);
    const [url, request] = fetcher.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/responses');
    const body = JSON.parse(request!.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: 'gpt-6.1-sol',
      store: false,
      stream: true,
      max_output_tokens: 4096,
      input: [{ role: 'user', content: 'Explain DI' }],
    });
    expect(request!.redirect).toBe('error');
  });
  it('does not mark an abruptly ended stream successful', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        response([{ type: 'response.output_text.delta', delta: 'Partial' }])
      );
    await expect(collect(new ChatResponder(config))).rejects.toThrow(
      'before the response completed'
    );
  });
  it('sanitizes rate-limit errors without leaking the response body or API key', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response('sensitive-provider-detail', { status: 429 })
      );
    await expect(collect(new ChatResponder(config))).rejects.toThrow(
      'usage or rate limits'
    );
  });
  it('aborts a pending stream promptly and preserves already emitted chunks', async () => {
    const abort = new AbortController();
    jest.spyOn(globalThis, 'fetch').mockImplementation((_url, init) =>
      Promise.resolve(
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(
                new TextEncoder().encode(
                  'data: {"type":"response.output_text.delta","delta":"Partial"}\n\n'
                )
              );
              init!.signal!.addEventListener(
                'abort',
                () => controller.error(new Error('aborted')),
                { once: true }
              );
            },
          })
        )
      )
    );
    const iterator = new ChatResponder(config).stream([message], abort.signal);
    expect((await iterator.next()).value).toBe('Partial');
    abort.abort();
    await expect(iterator.next()).rejects.toThrow('aborted');
  });
  it('reports token-limited responses as incomplete', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        response([
          { type: 'response.incomplete', response: { status: 'incomplete' } },
        ])
      );
    await expect(collect(new ChatResponder(config))).rejects.toThrow(
      'interrupted or exceeded'
    );
  });
});
