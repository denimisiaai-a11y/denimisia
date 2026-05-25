import { AuditLog, AuditEntry } from './audit.log';
import { PrismaService } from '../../prisma/prisma.service';

describe('AuditLog', () => {
  const prismaMock = {
    botLlmAudit: { create: jest.fn() },
  } as unknown as PrismaService;
  const log = new AuditLog(prismaMock);

  beforeEach(() => {
    (prismaMock.botLlmAudit.create as jest.Mock).mockReset();
  });

  it('hashes prompt and reply, never stores raw text in hash columns', async () => {
    const entry: AuditEntry = {
      sessionId: 's1',
      userId: 'u1',
      queryPreview: 'do you sell hoodies',
      promptRaw: 'long system prompt + user message',
      replyRaw: 'we sell jeans only',
      retrievedSources: { faq: 1, products: 0, orders: 0 },
      success: true,
      outputFiltered: false,
      injectionFlagged: false,
    };
    await log.write(entry);
    const args = (prismaMock.botLlmAudit.create as jest.Mock).mock.calls[0][0];
    expect(args.data.promptHash).toMatch(/^[a-f0-9]{64}$/);
    expect(args.data.replyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(args.data.promptHash).not.toContain('user');
    expect(args.data.replyHash).not.toContain('jeans');
  });

  it('truncates queryPreview to 200 chars', async () => {
    const long = 'x'.repeat(300);
    await log.write({
      sessionId: 's',
      queryPreview: long,
      promptRaw: '',
      replyRaw: '',
      retrievedSources: {},
      success: false,
      errorCode: 'quota_exhausted',
      outputFiltered: false,
      injectionFlagged: false,
    });
    const args = (prismaMock.botLlmAudit.create as jest.Mock).mock.calls.at(-1)?.[0];
    expect(args.data.queryPreview.length).toBe(200);
  });
});
