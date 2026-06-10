import { Test } from '@nestjs/testing';
import { BotParserService } from './bot.parser.service';
import { BotSynonymsService } from './bot.synonyms.service';

describe('BotParserService', () => {
  let service: BotParserService;
  const fakeSyn: { resolveToken: jest.Mock; allForDimension: jest.Mock } = {
    resolveToken: jest.fn(),
    allForDimension: jest.fn(),
  };

  beforeEach(async () => {
    fakeSyn.resolveToken.mockReset();
    fakeSyn.allForDimension.mockReset();
    const mod = await Test.createTestingModule({
      providers: [
        BotParserService,
        { provide: BotSynonymsService, useValue: fakeSyn },
      ],
    }).compile();
    service = mod.get(BotParserService);
  });

  it('classifies intent="whats_new" on new arrivals trigger', () => {
    const res = service.detectIntent('show me whats new');
    expect(res).toBe('whats_new');
  });

  it('classifies intent="sizing" on size trigger', () => {
    const res = service.detectIntent('help me find my size');
    expect(res).toBe('sizing');
  });

  it('classifies intent="find" by default', () => {
    const res = service.detectIntent('black pants 30');
    expect(res).toBe('find');
  });

  it('extracts slots from "black baggy pants in 30"', async () => {
    fakeSyn.resolveToken.mockImplementation(async (dim, tok) => {
      const map: Record<string, Record<string, string>> = {
        category: { pants: 'pants' },
        color: { black: 'black' },
        silhouette: { baggy: 'baggy' },
      };
      return map[dim]?.[tok]
        ? { dimension: dim, canonical: map[dim][tok] }
        : null;
    });
    const slots = await service.extractSlots('black baggy pants in 30');
    expect(slots.type).toBe('PANTS');
    expect(slots.color).toBe('black');
    expect(slots.size).toBe('30');
    expect(slots.tags).toEqual(
      expect.arrayContaining([{ dimension: 'silhouette', value: 'baggy' }]),
    );
  });

  it('fuzzy-matches one-edit typos via Levenshtein', async () => {
    fakeSyn.resolveToken.mockImplementation(async (dim, tok) => {
      if (dim === 'color' && tok === 'black')
        return { dimension: 'color', canonical: 'black' };
      return null;
    });
    fakeSyn.allForDimension.mockImplementation(async (dim) => {
      if (dim === 'color')
        return [{ dimension: 'color', canonical: 'black', aliases: [] }];
      return [];
    });
    const slots = await service.extractSlots('blakc pants');
    expect(slots.color).toBe('black');
  });

  it('detects a contradiction (slim + baggy)', () => {
    fakeSyn.resolveToken.mockImplementation(async (dim, tok) => {
      if (dim === 'silhouette' && (tok === 'slim' || tok === 'baggy')) {
        return { dimension: 'silhouette', canonical: tok };
      }
      return null;
    });
    const c = service.detectContradictions({
      tags: [
        { dimension: 'silhouette', value: 'slim' },
        { dimension: 'silhouette', value: 'baggy' },
      ],
    });
    expect(c).toEqual([{ dimension: 'silhouette', values: ['slim', 'baggy'] }]);
  });
});
