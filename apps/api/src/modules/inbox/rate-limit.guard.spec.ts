import { RateLimit, RateLimitDecision } from './rate-limit.guard';

describe('RateLimit', () => {
  let now: number;
  beforeEach(() => {
    now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });
  afterAll(() => jest.restoreAllMocks());

  it('allows the first 5 messages in a thread in 60s, then blocks', () => {
    const limiter = new RateLimit();
    let decision: RateLimitDecision = { allowed: true, key: '' };
    for (let i = 0; i < 5; i++) {
      decision = limiter.checkAndRecord({ kind: 'thread_message', key: 't1' });
      expect(decision.allowed).toBe(true);
    }
    decision = limiter.checkAndRecord({ kind: 'thread_message', key: 't1' });
    expect(decision.allowed).toBe(false);
  });

  it('window slides correctly', () => {
    const limiter = new RateLimit();
    for (let i = 0; i < 5; i++) limiter.checkAndRecord({ kind: 'thread_message', key: 't1' });
    expect(limiter.checkAndRecord({ kind: 'thread_message', key: 't1' }).allowed).toBe(false);
    now += 61_000;
    expect(limiter.checkAndRecord({ kind: 'thread_message', key: 't1' }).allowed).toBe(true);
  });

  it('limits daily guest emails to 20', () => {
    const limiter = new RateLimit();
    for (let i = 0; i < 20; i++)
      expect(limiter.checkAndRecord({ kind: 'guest_email_daily', key: 'ali@x.com' }).allowed).toBe(true);
    expect(limiter.checkAndRecord({ kind: 'guest_email_daily', key: 'ali@x.com' }).allowed).toBe(false);
  });

  it('limits new threads per IP to 5/hour', () => {
    const limiter = new RateLimit();
    for (let i = 0; i < 5; i++)
      expect(limiter.checkAndRecord({ kind: 'new_thread_ip', key: '1.2.3.4' }).allowed).toBe(true);
    expect(limiter.checkAndRecord({ kind: 'new_thread_ip', key: '1.2.3.4' }).allowed).toBe(false);
  });
});
