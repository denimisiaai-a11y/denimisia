import { Test } from '@nestjs/testing';
import { BotController } from './bot.controller';
import { BotParserService } from './bot.parser.service';
import { BotSearchService } from './bot.search.service';
import { BotSizingService } from './bot.sizing.service';
import { BotSynonymsService } from './bot.synonyms.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BotController', () => {
  let controller: BotController;
  const parser = {
    detectIntent: jest.fn(),
    extractSlots: jest.fn(),
    detectContradictions: jest.fn().mockReturnValue([]),
  };
  const search = { searchBySlots: jest.fn(), findWhatsNew: jest.fn() };
  const sizing = { recommend: jest.fn() };
  const synonyms = {
    resolveToken: jest.fn(),
    allForDimension: jest.fn(),
    invalidate: jest.fn(),
  };
  const prisma = { botUnrecognizedQuery: { create: jest.fn() } };

  beforeEach(async () => {
    Object.values({ parser, search, sizing, synonyms, prisma }).forEach((m) =>
      Object.values(m).forEach((fn: any) => fn.mockClear?.()),
    );
    parser.detectContradictions.mockReturnValue([]);
    const mod = await Test.createTestingModule({
      controllers: [BotController],
      providers: [
        { provide: BotParserService, useValue: parser },
        { provide: BotSearchService, useValue: search },
        { provide: BotSizingService, useValue: sizing },
        { provide: BotSynonymsService, useValue: synonyms },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    controller = mod.get(BotController);
  });

  it('returns a find reply with product cards', async () => {
    parser.detectIntent.mockReturnValue('find');
    parser.extractSlots.mockResolvedValue({
      type: 'PANTS',
      color: 'black',
      size: '30',
      tags: [{ dimension: 'silhouette', value: 'baggy' }],
    });
    search.searchBySlots.mockResolvedValue([{ id: 'p1' }]);
    const r = await controller.message({
      text: 'black baggy pants 30',
      context: { sessionId: 's1' },
    } as any);
    expect(r.message).toMatch(/Got it:/i);
    expect(r.products).toHaveLength(1);
  });

  it('returns whats-new reply', async () => {
    parser.detectIntent.mockReturnValue('whats_new');
    search.findWhatsNew.mockResolvedValue([{ id: 'p2' }]);
    const r = await controller.message({
      text: "what's new",
      context: { sessionId: 's1' },
    } as any);
    expect(r.products).toHaveLength(1);
  });

  it('starts the sizing flow when intent=sizing', async () => {
    parser.detectIntent.mockReturnValue('sizing');
    const r = await controller.message({
      text: 'help me find my size',
      context: { sessionId: 's1' },
    } as any);
    expect(r.message).toMatch(/shopping for/i);
    expect(r.chips).toEqual(
      expect.arrayContaining(['Pants', 'Shirts', 'Jackets']),
    );
    expect(r.nextContext.flow?.step).toBe('type');
  });

  it('advances sizing flow when context.flow.step is type', async () => {
    parser.detectIntent.mockReturnValue('find');
    const r = await controller.message({
      text: 'Pants',
      context: {
        sessionId: 's1',
        flow: { name: 'sizing', step: 'type', type: 'PANTS', collected: {} },
      },
    } as any);
    expect(r.message).toMatch(/waist/i);
    expect(r.nextContext.flow?.step).toBe('waist');
  });

  it('logs unrecognized query when nothing parses', async () => {
    parser.detectIntent.mockReturnValue('find');
    parser.extractSlots.mockResolvedValue({ tags: [] });
    const r = await controller.message({
      text: 'lorem ipsum',
      context: { sessionId: 's1' },
    } as any);
    expect(r.message).toMatch(/didn't catch/i);
    expect(prisma.botUnrecognizedQuery.create).toHaveBeenCalled();
  });
});
