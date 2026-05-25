import { Injectable } from '@nestjs/common';

export type RateLimitKind = 'thread_message' | 'guest_email_daily' | 'new_thread_ip';

export interface RateLimitInput {
  kind: RateLimitKind;
  key: string;
}

export interface RateLimitDecision {
  allowed: boolean;
  key: string;
}

interface Rule {
  windowMs: number;
  max: number;
}

const RULES: Record<RateLimitKind, Rule> = {
  thread_message: { windowMs: 60_000, max: 5 },
  guest_email_daily: { windowMs: 24 * 60 * 60 * 1000, max: 20 },
  new_thread_ip: { windowMs: 60 * 60 * 1000, max: 5 },
};

@Injectable()
export class RateLimit {
  private hits = new Map<string, number[]>();

  checkAndRecord(input: RateLimitInput): RateLimitDecision {
    const rule = RULES[input.kind];
    const composite = `${input.kind}:${input.key}`;
    const now = Date.now();
    const cutoff = now - rule.windowMs;
    const past = (this.hits.get(composite) ?? []).filter((t) => t > cutoff);

    if (past.length >= rule.max) {
      this.hits.set(composite, past);
      return { allowed: false, key: composite };
    }

    past.push(now);
    this.hits.set(composite, past);
    return { allowed: true, key: composite };
  }
}
