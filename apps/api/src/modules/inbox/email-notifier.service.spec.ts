import { EmailNotifier } from './email-notifier.service';

describe('EmailNotifier', () => {
  const emailMock = { send: jest.fn() };
  const magicLinkMock = { mint: jest.fn() };
  let notifier: EmailNotifier;

  beforeEach(() => {
    emailMock.send.mockReset();
    magicLinkMock.mint.mockReset().mockResolvedValue('tok123');
    process.env.INBOX_ADMIN_EMAIL = 'admin@x.com';
    process.env.INBOX_EMAIL_NUDGE_THRESHOLD = '3';
    notifier = new EmailNotifier(emailMock as never, magicLinkMock as never);
  });

  it('sends admin email for the first customer message in a thread', async () => {
    await notifier.notifyAdminOfCustomerMessage({
      threadId: 't1',
      customerName: 'Ali',
      preview: 'hi there',
      isFirstFromCustomer: true,
      lastAdminEmailAt: null,
    });
    expect(emailMock.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'admin@x.com' }),
    );
  });

  it('throttles admin email to one per 10 minutes per thread', async () => {
    await notifier.notifyAdminOfCustomerMessage({
      threadId: 't1',
      customerName: 'Ali',
      preview: 'msg2',
      isFirstFromCustomer: false,
      lastAdminEmailAt: new Date(Date.now() - 5 * 60 * 1000),
    });
    expect(emailMock.send).not.toHaveBeenCalled();
  });

  it('sends customer first-reply email with magic link', async () => {
    await notifier.notifyCustomerOfAdminReply({
      threadId: 't1',
      customerEmail: 'ali@x.com',
      customerName: 'Ali',
      body: 'thanks',
      isFirstAdminReply: true,
      consecutiveAdminMessages: 1,
      customerLastSeenAt: new Date(),
    });
    expect(emailMock.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ali@x.com',
        subject: expect.stringMatching(/replied/),
      }),
    );
    expect(magicLinkMock.mint).toHaveBeenCalledWith('t1');
  });

  it('skips customer email when not first-reply and customer was recently seen', async () => {
    await notifier.notifyCustomerOfAdminReply({
      threadId: 't1',
      customerEmail: 'ali@x.com',
      customerName: 'Ali',
      body: 'reply 2',
      isFirstAdminReply: false,
      consecutiveAdminMessages: 2,
      customerLastSeenAt: new Date(Date.now() - 60_000),
    });
    expect(emailMock.send).not.toHaveBeenCalled();
  });

  it('sends nudge email when threshold reached and customer away', async () => {
    await notifier.notifyCustomerOfAdminReply({
      threadId: 't1',
      customerEmail: 'ali@x.com',
      customerName: 'Ali',
      body: 'r3',
      isFirstAdminReply: false,
      consecutiveAdminMessages: 3,
      customerLastSeenAt: new Date(Date.now() - 10 * 60 * 1000),
    });
    expect(emailMock.send).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringMatching(/new messages/i) }),
    );
  });
});
