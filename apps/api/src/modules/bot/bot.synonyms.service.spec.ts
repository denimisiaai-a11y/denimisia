import { Test } from '@nestjs/testing';
import { BotSynonymsService } from './bot.synonyms.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BotSynonymsService', () => {
  let service: BotSynonymsService;
  let prisma: { botSynonym: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { botSynonym: { findMany: jest.fn() } };
    const mod = await Test.createTestingModule({
      providers: [
        BotSynonymsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = mod.get(BotSynonymsService);
  });

  it('resolves a token to its canonical via direct match', async () => {
    prisma.botSynonym.findMany.mockResolvedValueOnce([
      { dimension: 'color', canonical: 'black', aliases: ['blk'] },
    ]);
    const hit = await service.resolveToken('color', 'black');
    expect(hit).toEqual({ dimension: 'color', canonical: 'black' });
  });

  it('resolves a token to its canonical via alias', async () => {
    prisma.botSynonym.findMany.mockResolvedValueOnce([
      { dimension: 'color', canonical: 'blue', aliases: ['navy', 'indigo'] },
    ]);
    const hit = await service.resolveToken('color', 'navy');
    expect(hit).toEqual({ dimension: 'color', canonical: 'blue' });
  });

  it('returns null when token is unknown', async () => {
    prisma.botSynonym.findMany.mockResolvedValueOnce([]);
    const hit = await service.resolveToken('color', 'puce');
    expect(hit).toBeNull();
  });

  it('caches DB calls within the TTL window', async () => {
    prisma.botSynonym.findMany.mockResolvedValue([
      { dimension: 'color', canonical: 'black', aliases: [] },
    ]);
    await service.resolveToken('color', 'black');
    await service.resolveToken('color', 'black');
    expect(prisma.botSynonym.findMany).toHaveBeenCalledTimes(1);
  });

  it('invalidate() forces a reload on next lookup', async () => {
    prisma.botSynonym.findMany.mockResolvedValue([
      { dimension: 'color', canonical: 'black', aliases: [] },
    ]);
    await service.resolveToken('color', 'black');
    service.invalidate();
    await service.resolveToken('color', 'black');
    expect(prisma.botSynonym.findMany).toHaveBeenCalledTimes(2);
  });
});
