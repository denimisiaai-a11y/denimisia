import { ResponseCache } from './response.cache';
import { PrismaService } from '../../prisma/prisma.service';

describe('ResponseCache', () => {
  const prismaMock = {
    botLlmCache: { findUnique: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
  } as unknown as PrismaService;
  const cache = new ResponseCache(prismaMock);

  beforeEach(() => {
    (prismaMock.botLlmCache.findUnique as jest.Mock).mockReset();
    (prismaMock.botLlmCache.upsert as jest.Mock).mockReset();
  });

  it('normalizes whitespace and lowercases before hashing', () => {
    const h1 = cache.key(' Hello World ');
    const h2 = cache.key('hello world');
    expect(h1).toBe(h2);
  });

  it('returns null on miss', async () => {
    (prismaMock.botLlmCache.findUnique as jest.Mock).mockResolvedValue(null);
    expect(await cache.get('q')).toBeNull();
  });

  it('returns reply on hit if fresh', async () => {
    (prismaMock.botLlmCache.findUnique as jest.Mock).mockResolvedValue({
      reply: 'cached',
      createdAt: new Date(),
    });
    expect(await cache.get('q')).toBe('cached');
  });

  it('returns null on stale cache row (older than 24h)', async () => {
    (prismaMock.botLlmCache.findUnique as jest.Mock).mockResolvedValue({
      reply: 'cached',
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    });
    expect(await cache.get('q')).toBeNull();
  });
});
