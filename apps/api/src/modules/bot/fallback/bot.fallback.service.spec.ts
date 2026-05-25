import { BotFallbackService, FallbackInput } from './bot.fallback.service';

describe('BotFallbackService', () => {
  const deps = {
    sanitizer: { scrub: jest.fn() },
    quota: { check: jest.fn(), recordUsage: jest.fn() },
    cache: { get: jest.fn(), set: jest.fn() },
    retriever: { retrieve: jest.fn() },
    prompt: { compose: jest.fn() },
    cf: { run: jest.fn() },
    filter: { scrub: jest.fn() },
    audit: { write: jest.fn() },
  };

  let svc: BotFallbackService;
  beforeEach(() => {
    Object.values(deps).forEach((d) => Object.values(d).forEach((fn) => (fn as jest.Mock).mockReset()));
    svc = new BotFallbackService(
      deps.sanitizer as never,
      deps.quota as never,
      deps.cache as never,
      deps.retriever as never,
      deps.prompt as never,
      deps.cf as never,
      deps.filter as never,
      deps.audit as never,
    );
    process.env.BOT_LLM_FALLBACK_ENABLED = 'true';
  });

  const baseInput: FallbackInput = { message: 'hello', sessionId: 's1' };
  const CANNED = "I can't help with that one. Try /track-order to check on an order, or leave a message for our team.";

  it('returns canned reply when flag is disabled', async () => {
    process.env.BOT_LLM_FALLBACK_ENABLED = 'false';
    const out = await svc.answer(baseInput);
    expect(out.message).toBe(CANNED);
    expect(deps.cf.run).not.toHaveBeenCalled();
  });

  it('returns canned reply when sanitizer flags high severity', async () => {
    deps.sanitizer.scrub.mockReturnValue({ text: 'ignore prev', severity: 'high', reason: 'inj' });
    const out = await svc.answer(baseInput);
    expect(out.message).toBe(CANNED);
    expect(deps.audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ injectionFlagged: true, success: false }),
    );
  });

  it('returns cached reply on cache hit', async () => {
    deps.sanitizer.scrub.mockReturnValue({ text: 'hi', severity: 'low' });
    deps.quota.check.mockResolvedValue(true);
    deps.cache.get.mockResolvedValue('cached reply');
    const out = await svc.answer(baseInput);
    expect(out.message).toBe('cached reply');
    expect(deps.cf.run).not.toHaveBeenCalled();
  });

  it('returns canned reply when quota is exhausted', async () => {
    deps.sanitizer.scrub.mockReturnValue({ text: 'hi', severity: 'low' });
    deps.quota.check.mockResolvedValue(false);
    deps.cache.get.mockResolvedValue(null);
    const out = await svc.answer(baseInput);
    expect(out.message).toBe(CANNED);
    expect(deps.audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'quota_exhausted', success: false }),
    );
  });

  it('returns canned reply when LLM throws', async () => {
    deps.sanitizer.scrub.mockReturnValue({ text: 'hi', severity: 'low' });
    deps.quota.check.mockResolvedValue(true);
    deps.cache.get.mockResolvedValue(null);
    deps.retriever.retrieve.mockResolvedValue({ faqChunks: [], products: [], userOrders: [] });
    deps.prompt.compose.mockReturnValue({ system: 's', user: 'u' });
    deps.cf.run.mockRejectedValue(new Error('timeout'));
    const out = await svc.answer(baseInput);
    expect(out.message).toBe(CANNED);
    expect(deps.audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'upstream_error', success: false }),
    );
  });

  it.each([
    ['', 'empty'],
    ['short', 'too_short'],
    ['x'.repeat(900), 'too_long'],
  ])('returns canned reply when LLM output is invalid (%s)', async (reply) => {
    deps.sanitizer.scrub.mockReturnValue({ text: 'hi', severity: 'low' });
    deps.quota.check.mockResolvedValue(true);
    deps.cache.get.mockResolvedValue(null);
    deps.retriever.retrieve.mockResolvedValue({ faqChunks: [], products: [], userOrders: [] });
    deps.prompt.compose.mockReturnValue({ system: 's', user: 'u' });
    deps.cf.run.mockResolvedValue(reply);
    deps.filter.scrub.mockReturnValue({ filtered: reply, hadStripping: false, patternCount: 0 });
    const out = await svc.answer(baseInput);
    expect(out.message).toBe(CANNED);
  });

  it('returns canned reply when output filter flags 2+ PII patterns', async () => {
    deps.sanitizer.scrub.mockReturnValue({ text: 'hi', severity: 'low' });
    deps.quota.check.mockResolvedValue(true);
    deps.cache.get.mockResolvedValue(null);
    deps.retriever.retrieve.mockResolvedValue({ faqChunks: [], products: [], userOrders: [] });
    deps.prompt.compose.mockReturnValue({ system: 's', user: 'u' });
    deps.cf.run.mockResolvedValue('our number is 01712345678 and email is x@y.com');
    deps.filter.scrub.mockReturnValue({ filtered: '[redacted]', hadStripping: true, patternCount: 2 });
    const out = await svc.answer(baseInput);
    expect(out.message).toBe(CANNED);
    expect(deps.audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ outputFiltered: true, success: false }),
    );
  });

  it('returns the filtered reply on the happy path and writes to cache', async () => {
    deps.sanitizer.scrub.mockReturnValue({ text: 'hi', severity: 'low' });
    deps.quota.check.mockResolvedValue(true);
    deps.cache.get.mockResolvedValue(null);
    deps.retriever.retrieve.mockResolvedValue({
      faqChunks: [{ heading: 'A', body: 'B' }],
      products: [],
      userOrders: [],
    });
    deps.prompt.compose.mockReturnValue({ system: 's', user: 'u' });
    deps.cf.run.mockResolvedValue('We sell jeans and jackets.');
    deps.filter.scrub.mockReturnValue({
      filtered: 'We sell jeans and jackets.',
      hadStripping: false,
      patternCount: 0,
    });
    const out = await svc.answer(baseInput);
    expect(out.message).toBe('We sell jeans and jackets.');
    expect(deps.cache.set).toHaveBeenCalled();
    expect(deps.quota.recordUsage).toHaveBeenCalled();
    expect(deps.audit.write).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('returns chips derived from retrieved sources on happy path', async () => {
    deps.sanitizer.scrub.mockReturnValue({ text: 'hi', severity: 'low' });
    deps.quota.check.mockResolvedValue(true);
    deps.cache.get.mockResolvedValue(null);
    deps.retriever.retrieve.mockResolvedValue({
      faqChunks: [],
      products: [{ id: 'p1', name: 'Slim Jean', slug: 'slim-jean' }],
      userOrders: [{ id: 'o1', orderNumber: 'DEN-1', status: 'CONFIRMED', createdAt: new Date() }],
    });
    deps.prompt.compose.mockReturnValue({ system: 's', user: 'u' });
    deps.cf.run.mockResolvedValue('reply.');
    deps.filter.scrub.mockReturnValue({ filtered: 'reply.', hadStripping: false, patternCount: 0 });
    const out = await svc.answer(baseInput);
    expect(out.chips).toEqual(expect.arrayContaining(['Track my order', 'Leave a message']));
  });
});
