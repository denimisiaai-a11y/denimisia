import { MessageService } from './message.service';
import { PrismaService } from '../prisma/prisma.service';
import { MessageSender } from '@prisma/client';

describe('MessageService', () => {
  const prismaMock = {
    inboxMessage: { create: jest.fn(), findMany: jest.fn() },
    inboxThread: { update: jest.fn() },
  } as unknown as PrismaService;
  const svc = new MessageService(prismaMock);

  beforeEach(() => {
    (prismaMock.inboxMessage.create as jest.Mock).mockReset();
    (prismaMock.inboxThread.update as jest.Mock).mockReset();
    (prismaMock.inboxMessage.findMany as jest.Mock).mockReset();
  });

  it('appends a customer message and resets consecutiveAdminMessages', async () => {
    (prismaMock.inboxMessage.create as jest.Mock).mockResolvedValue({
      id: 'm1',
      sender: MessageSender.CUSTOMER,
    });
    await svc.append({ threadId: 't1', sender: MessageSender.CUSTOMER, body: 'hi' });
    expect(prismaMock.inboxThread.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: expect.objectContaining({
        lastMessageAt: expect.any(Date),
        consecutiveAdminMessages: 0,
        customerLastSeenAt: expect.any(Date),
      }),
    });
  });

  it('appends an admin message and increments consecutiveAdminMessages', async () => {
    (prismaMock.inboxMessage.create as jest.Mock).mockResolvedValue({ id: 'm1' });
    await svc.append({ threadId: 't1', sender: MessageSender.ADMIN, body: 'reply' });
    const args = (prismaMock.inboxThread.update as jest.Mock).mock.calls[0][0];
    expect(args.data.consecutiveAdminMessages).toEqual({ increment: 1 });
  });

  it('stores image array on the message row', async () => {
    (prismaMock.inboxMessage.create as jest.Mock).mockResolvedValue({ id: 'm1' });
    const images = [{ url: 'https://x', width: 100, height: 100, bytes: 1000 }];
    await svc.append({
      threadId: 't1',
      sender: MessageSender.CUSTOMER,
      body: 'pic',
      images,
    });
    expect(prismaMock.inboxMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ images }),
    });
  });

  it('lists messages for a thread in chronological order', async () => {
    (prismaMock.inboxMessage.findMany as jest.Mock).mockResolvedValue([]);
    await svc.list('t1');
    expect(prismaMock.inboxMessage.findMany).toHaveBeenCalledWith({
      where: { threadId: 't1' },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('replays messages after a given lastMessageId', async () => {
    (prismaMock.inboxMessage.findMany as jest.Mock).mockResolvedValue([]);
    await svc.replayAfter('t1', 'm5');
    expect(prismaMock.inboxMessage.findMany).toHaveBeenCalledWith({
      where: { threadId: 't1', id: { gt: 'm5' } },
      orderBy: { createdAt: 'asc' },
    });
  });
});
