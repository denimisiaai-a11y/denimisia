import { MagicLinkService } from './magic-link.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

describe('MagicLinkService', () => {
  const prismaMock = {
    inboxMagicLink: { create: jest.fn(), findUnique: jest.fn() },
  } as unknown as PrismaService;
  const jwt = new JwtService({ secret: 'a'.repeat(32) });

  beforeEach(() => {
    (prismaMock.inboxMagicLink.create as jest.Mock).mockReset();
    (prismaMock.inboxMagicLink.findUnique as jest.Mock).mockReset();
    process.env.INBOX_MAGIC_LINK_SECRET = 'a'.repeat(32);
  });

  it('mints a token scoped to the threadId', async () => {
    (prismaMock.inboxMagicLink.create as jest.Mock).mockImplementation(({ data }) =>
      Promise.resolve(data),
    );
    const svc = new MagicLinkService(prismaMock, jwt);
    const token = await svc.mint('t1');
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);
  });

  it('verifies a fresh token and returns threadId', async () => {
    (prismaMock.inboxMagicLink.create as jest.Mock).mockImplementation(({ data }) =>
      Promise.resolve(data),
    );
    const svc = new MagicLinkService(prismaMock, jwt);
    const token = await svc.mint('t1');
    (prismaMock.inboxMagicLink.findUnique as jest.Mock).mockResolvedValue({
      token,
      threadId: 't1',
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    const result = await svc.verify(token);
    expect(result).toEqual({ threadId: 't1' });
  });

  it('rejects an expired DB row', async () => {
    (prismaMock.inboxMagicLink.create as jest.Mock).mockImplementation(({ data }) =>
      Promise.resolve(data),
    );
    const svc = new MagicLinkService(prismaMock, jwt);
    const token = await svc.mint('t1');
    (prismaMock.inboxMagicLink.findUnique as jest.Mock).mockResolvedValue({
      token,
      threadId: 't1',
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(svc.verify(token)).rejects.toThrow(/expired/);
  });

  it('rejects a tampered token', async () => {
    const svc = new MagicLinkService(prismaMock, jwt);
    await expect(svc.verify('not.a.real.jwt')).rejects.toThrow();
  });

  it('rejects when DB row is not found', async () => {
    (prismaMock.inboxMagicLink.create as jest.Mock).mockImplementation(({ data }) =>
      Promise.resolve(data),
    );
    const svc = new MagicLinkService(prismaMock, jwt);
    const token = await svc.mint('t1');
    (prismaMock.inboxMagicLink.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(svc.verify(token)).rejects.toThrow(/not found/);
  });
});
