import { Injectable, Logger } from '@nestjs/common';

interface CfRunResponse {
  result?: { response?: string };
  success?: boolean;
  errors?: Array<{ code: number; message: string }>;
}

export interface RunOptions {
  timeoutMs?: number;
  maxTokens?: number;
}

@Injectable()
export class CloudflareAiClient {
  private readonly logger = new Logger(CloudflareAiClient.name);

  // Public so tests can swap it. NestJS DI cannot resolve a `typeof fetch`
  // constructor parameter (no matching provider), so the indirection is a
  // property bound to the global fetch.
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis);

  async run(model: string, systemPrompt: string, userMessage: string, opts: RunOptions = {}): Promise<string> {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const token = process.env.CLOUDFLARE_AI_TOKEN;
    if (!accountId || !token) {
      throw new Error('Cloudflare AI credentials missing');
    }
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
    const body = JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: opts.maxTokens ?? 256,
    });
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const timeoutMs = opts.timeoutMs ?? 3000;

    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await this.fetchImpl(url, { method: 'POST', headers, body, signal: controller.signal });
        clearTimeout(timer);
        if (res.status >= 500 && attempt === 0) continue;
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`upstream ${res.status}: ${text.slice(0, 200)}`);
        }
        const json = (await res.json()) as CfRunResponse;
        const reply = json.result?.response;
        if (!reply) throw new Error('upstream returned no response field');
        return reply;
      } catch (err) {
        clearTimeout(timer);
        if (err instanceof Error && err.name === 'AbortError') {
          throw new Error('upstream timeout');
        }
        if (attempt === 1) throw err;
      }
    }
    throw new Error('unreachable');
  }
}
