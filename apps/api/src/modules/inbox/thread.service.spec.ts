import { ThreadService } from './thread.service';
import { PrismaService } from '../prisma/prisma.service';
import { ThreadStatus, ThreadCloseReason } from '@prisma/client';

describe('ThreadService', () => {
  const prismaMock = {
    inboxThread: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  } as unknown as PrismaService;
  const svc = new ThreadService(prismaMock);

  beforeEach(() => {
    Object.values(prismaMock.inboxThread).forEach((fn) => (fn as jest.Mock).mockReset());
  });

  it('creates a thread with normalized identity', async () => {
    (prismaMock.inboxThread.create as jest.Mock).mockResolvedValue({ id: 't1' });
    const t = await svc.create({
      guestName: 'Ali',
      guestEmail: 'ali@example.com',
      guestPhone: '01712345678',
      userId: 'u1',
    });
    expect(t.id).toBe('t1');
    expect(prismaMock.inboxThread.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: ThreadStatus.OPEN,
        guestName: 'Ali',
        guestEmail: 'ali@example.com',
        guestPhone: '01712345678',
        userId: 'u1',
      }),
    });
  });

  it('closes a thread with the given reason', async () => {
    await svc.close('t1', ThreadCloseReason.ADMIN_RESOLVED);
    expect(prismaMock.inboxThread.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: expect.objectContaining({
        status: ThreadStatus.CLOSED,
        closeReason: ThreadCloseReason.ADMIN_RESOLVED,
        closedAt: expect.any(Date),
      }),
    });
  });

  it('reopens a CLOSED thread on new message', async () => {
    (prismaMock.inboxThread.findUnique as jest.Mock).mockResolvedValue({
      id: 't1',
      status: ThreadStatus.CLOSED,
    });
    await svc.markActive('t1');
    expect(prismaMock.inboxThread.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: expect.objectContaining({
        status: ThreadStatus.OPEN,
        closeReason: null,
        closedAt: null,
      }),
    });
  });

  it('does not update when thread is already OPEN', async () => {
    (prismaMock.inboxThread.findUnique as jest.Mock).mockResolvedValue({
      id: 't1',
      status: ThreadStatus.OPEN,
    });
    await svc.markActive('t1');
    expect(prismaMock.inboxThread.update).not.toHaveBeenCalled();
  });

  it('lists OPEN threads sorted by lastMessageAt desc', async () => {
    (prismaMock.inboxThread.findMany as jest.Mock).mockResolvedValue([]);
    await svc.listForAdmin({ status: ThreadStatus.OPEN, limit: 50 });
    expect(prismaMock.inboxThread.findMany).toHaveBeenCalledWith({
      where: { status: ThreadStatus.OPEN },
      orderBy: { lastMessageAt: 'desc' },
      take: 50,
    });
  });
});
