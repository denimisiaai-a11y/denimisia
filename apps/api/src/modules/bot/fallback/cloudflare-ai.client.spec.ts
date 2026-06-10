import { CloudflareAiClient } from './cloudflare-ai.client';

describe('CloudflareAiClient', () => {
  const fetchMock = jest.fn();
  let client: CloudflareAiClient;

  beforeEach(() => {
    fetchMock.mockReset();
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acc_test';
    process.env.CLOUDFLARE_AI_TOKEN = 'tok_test';
    client = new CloudflareAiClient();
    client.fetchImpl = fetchMock as unknown as typeof fetch;
  });

  it('posts to the Workers AI endpoint with the bearer token', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ result: { response: 'hello' }, success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const out = await client.run('@cf/meta/llama-3.1-8b-instruct', 'system', 'user msg');

    expect(out).toBe('hello');
    const call = fetchMock.mock.calls[0];
    const url = call[0] as string;
    const init = call[1] as RequestInit;
    expect(url).toContain('acc_test/ai/run/@cf/meta/llama-3.1-8b-instruct');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok_test');
  });

  it('retries once on 5xx and then succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ result: { response: 'ok' }, success: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    const out = await client.run('@cf/meta/llama-3.1-8b-instruct', 'system', 'user');
    expect(out).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws after a single retry still fails', async () => {
    fetchMock.mockResolvedValue(new Response('down', { status: 503 }));
    await expect(
      client.run('@cf/meta/llama-3.1-8b-instruct', 'sys', 'user'),
    ).rejects.toThrow(/upstream/);
  });

  it('throws on timeout', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((resolve, reject) => {
          const signal = init?.signal as AbortSignal | undefined;
          const id = setTimeout(
            () => resolve(new Response(JSON.stringify({ result: { response: 'late' } }), { status: 200 })),
            5_000,
          );
          signal?.addEventListener('abort', () => {
            clearTimeout(id);
            const err = new Error('aborted') as Error & { name: string };
            err.name = 'AbortError';
            reject(err);
          });
        }),
    );
    await expect(
      client.run('@cf/meta/llama-3.1-8b-instruct', 'sys', 'user', { timeoutMs: 50 }),
    ).rejects.toThrow(/timeout/);
  }, 10_000);
});
