import { KbRetriever } from './kb.retriever';
import { KbFaqLoader } from './kb.faq.loader';
import { PrismaService } from '../../prisma/prisma.service';

describe('KbRetriever', () => {
  const faqLoader = {
    search: jest.fn(() => [{ heading: 'What we sell', body: 'We sell jeans.' }]),
  } as unknown as KbFaqLoader;

  const prismaMock = {
    product: { findMany: jest.fn() },
    order: { findMany: jest.fn() },
  } as unknown as PrismaService;

  beforeEach(() => {
    (prismaMock.product.findMany as jest.Mock).mockReset();
    (prismaMock.order.findMany as jest.Mock).mockReset();
  });

  it('returns FAQ chunks for a question', async () => {
    (prismaMock.product.findMany as jest.Mock).mockResolvedValue([]);
    const r = new KbRetriever(faqLoader, prismaMock);
    const ctx = await r.retrieve('do you sell hoodies', { userId: undefined });
    expect(ctx.faqChunks.length).toBeGreaterThan(0);
  });

  it('skips order lookup when userId is undefined (guest)', async () => {
    const r = new KbRetriever(faqLoader, prismaMock);
    const ctx = await r.retrieve('where is my order', { userId: undefined });
    expect(ctx.userOrders).toEqual([]);
    expect(prismaMock.order.findMany).not.toHaveBeenCalled();
  });

  it('queries orders scoped to userId when present', async () => {
    (prismaMock.order.findMany as jest.Mock).mockResolvedValue([
      { id: 'o1', orderNumber: 'DEN-1042', status: 'CONFIRMED', createdAt: new Date('2026-05-23') },
    ]);
    (prismaMock.product.findMany as jest.Mock).mockResolvedValue([]);
    const r = new KbRetriever(faqLoader, prismaMock);
    const ctx = await r.retrieve('where is my order', { userId: 'u_abc' });
    expect(prismaMock.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u_abc' } }),
    );
    expect(ctx.userOrders.length).toBe(1);
    expect(ctx.userOrders[0].orderNumber).toBe('DEN-1042');
  });

  it('extracts a search term from the query and searches active products', async () => {
    (prismaMock.product.findMany as jest.Mock).mockResolvedValue([
      { id: 'p1', name: 'Slim Jean', slug: 'slim-jean' },
    ]);
    const r = new KbRetriever(faqLoader, prismaMock);
    const ctx = await r.retrieve('any slim jean in stock', { userId: undefined });
    expect(prismaMock.product.findMany).toHaveBeenCalled();
    const callArgs = (prismaMock.product.findMany as jest.Mock).mock.calls[0][0];
    expect(callArgs.where.isActive).toBe(true);
    expect(callArgs.where.deletedAt).toBeNull();
    expect(ctx.products.length).toBe(1);
  });
});
