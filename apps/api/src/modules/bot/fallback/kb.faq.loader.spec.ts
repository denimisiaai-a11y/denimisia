import { Test } from '@nestjs/testing';
import { KbFaqLoader } from './kb.faq.loader';

describe('KbFaqLoader', () => {
  let loader: KbFaqLoader;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ providers: [KbFaqLoader] }).compile();
    loader = mod.get(KbFaqLoader);
    loader.onModuleInit();
  });

  it('loads at least 5 chunks from faq.md', () => {
    expect(loader.chunks.length).toBeGreaterThanOrEqual(5);
  });

  it('each chunk has a heading and body', () => {
    for (const c of loader.chunks) {
      expect(c.heading).toMatch(/^[A-Z]/);
      expect(c.body.length).toBeGreaterThan(20);
    }
  });

  it('ranks "what do you sell" against the "What we sell" chunk', () => {
    const top = loader.search('what do you sell', 1)[0];
    expect(top.heading).toContain('What we sell');
  });

  it('returns top-k results limited to k', () => {
    const results = loader.search('shipping payment returns', 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });
});
