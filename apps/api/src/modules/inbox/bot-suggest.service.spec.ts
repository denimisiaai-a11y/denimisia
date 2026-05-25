import { BotSuggestService } from './bot-suggest.service';

describe('BotSuggestService', () => {
  const parser = { detectIntent: jest.fn(), extractSlots: jest.fn() };
  const search = { searchBySlots: jest.fn(), findWhatsNew: jest.fn() };
  const svc = new BotSuggestService(parser as never, search as never);

  beforeEach(() => {
    parser.detectIntent.mockReset();
    parser.extractSlots.mockReset();
    search.searchBySlots.mockReset();
    search.findWhatsNew.mockReset();
  });

  it('returns a product-list draft when parser returns find intent with results', async () => {
    parser.detectIntent.mockReturnValue('find');
    parser.extractSlots.mockResolvedValue({ type: 'PANTS', tags: [] });
    search.searchBySlots.mockResolvedValue([
      { id: 'p1', name: 'Slim Jean', slug: 'slim-jean', price: 1500 },
    ]);
    const out = await svc.suggest('show me jeans');
    expect(out.body).toMatch(/Slim Jean/);
  });

  it('returns a whats_new draft when intent matches', async () => {
    parser.detectIntent.mockReturnValue('whats_new');
    search.findWhatsNew.mockResolvedValue([]);
    const out = await svc.suggest("what's new");
    expect(out.body.toLowerCase()).toMatch(/new|landed/);
  });

  it('returns an empty draft with a note for unknown intents', async () => {
    parser.detectIntent.mockReturnValue('unknown');
    const out = await svc.suggest('what is the universe');
    expect(out.body).toBe('');
    expect(out.note).toMatch(/no draft/i);
  });
});
