import { PurgeAuditQueryPreviewHandler } from './purge.handler';
import { PrismaService } from '../../prisma/prisma.service';

describe('PurgeAuditQueryPreviewHandler', () => {
  const prismaMock = {
    botLlmAudit: { updateMany: jest.fn() },
  } as unknown as PrismaService;
  const h = new PurgeAuditQueryPreviewHandler(prismaMock);

  beforeEach(() => {
    (prismaMock.botLlmAudit.updateMany as jest.Mock).mockReset();
  });

  it('nulls queryPreview for rows older than 30 days', async () => {
    (prismaMock.botLlmAudit.updateMany as jest.Mock).mockResolvedValue({ count: 5 });
    const result = await h.run({});
    const args = (prismaMock.botLlmAudit.updateMany as jest.Mock).mock.calls[0][0];
    expect(args.where.createdAt.lt).toBeInstanceOf(Date);
    const cutoff = args.where.createdAt.lt as Date;
    const diff = Date.now() - cutoff.getTime();
    expect(diff).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
    expect(diff).toBeLessThan(31 * 24 * 60 * 60 * 1000);
    expect(args.data).toEqual({ queryPreview: null });
    expect(result.purged).toBe(5);
  });

  it('only targets rows that still have a non-null queryPreview', async () => {
    (prismaMock.botLlmAudit.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    await h.run({});
    const args = (prismaMock.botLlmAudit.updateMany as jest.Mock).mock.calls[0][0];
    expect(args.where.queryPreview).toEqual({ not: null });
  });
});
