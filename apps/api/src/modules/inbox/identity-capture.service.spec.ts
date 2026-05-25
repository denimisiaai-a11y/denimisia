import { IdentityCaptureService } from './identity-capture.service';
import { PrismaService } from '../prisma/prisma.service';

describe('IdentityCaptureService', () => {
  const prismaMock = {
    user: { findUnique: jest.fn() },
  } as unknown as PrismaService;
  const svc = new IdentityCaptureService(prismaMock);

  beforeEach(() => (prismaMock.user.findUnique as jest.Mock).mockReset());

  it.each([
    ['Ali', 'ali@example.com', '01712345678', true],
    ['Ali', 'ali@example.com', '+8801712345678', true],
    ['Ali', 'ali@example.com', '+880 1712345678', true],
    ['', 'ali@example.com', '01712345678', false],
    ['Ali', 'not-email', '01712345678', false],
    ['Ali', 'ali@example.com', '1234567890', false],
    ['Ali', 'ali@example.com', '+1-555-0100', false],
  ])('validates %s / %s / %s -> %s', async (name, email, phone, valid) => {
    (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(null);
    const result = await svc.capture({ name, email, phone, sessionId: 's' });
    expect(result.ok).toBe(valid);
  });

  it('matches an existing user by email and returns userId', async () => {
    (prismaMock.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u_abc' });
    const result = await svc.capture({
      name: 'Ali',
      email: 'AliBu@example.com',
      phone: '01712345678',
      sessionId: 's',
    });
    expect(result.ok).toBe(true);
    expect(result.userId).toBe('u_abc');
  });

  it('normalizes email to lowercase before user lookup', async () => {
    (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(null);
    await svc.capture({
      name: 'Ali',
      email: 'ALI@EXAMPLE.COM',
      phone: '01712345678',
      sessionId: 's',
    });
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'ali@example.com' },
      select: { id: true },
    });
  });
});
