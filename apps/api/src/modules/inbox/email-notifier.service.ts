import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../email/email.service';
import { MagicLinkService } from './magic-link.service';
import {
  inboxNewMessageAdmin,
  inboxFirstReplyToCustomer,
  inboxNudgeToCustomer,
} from '../email/email-templates';

const ADMIN_THROTTLE_MS = 10 * 60 * 1000;
const CUSTOMER_AWAY_MS = 5 * 60 * 1000;

export interface NotifyAdminInput {
  threadId: string;
  customerName: string;
  preview: string;
  isFirstFromCustomer: boolean;
  lastAdminEmailAt: Date | null;
}

export interface NotifyCustomerInput {
  threadId: string;
  customerEmail: string;
  customerName: string;
  body: string;
  isFirstAdminReply: boolean;
  consecutiveAdminMessages: number;
  customerLastSeenAt: Date | null;
}

@Injectable()
export class EmailNotifier {
  private readonly logger = new Logger(EmailNotifier.name);

  constructor(
    private readonly email: EmailService,
    private readonly magicLink: MagicLinkService,
  ) {}

  private adminEmail(): string {
    return process.env.INBOX_ADMIN_EMAIL ?? 'Denimisia.ai@gmail.com';
  }

  private nudgeThreshold(): number {
    return parseInt(process.env.INBOX_EMAIL_NUDGE_THRESHOLD ?? '4', 10);
  }

  async notifyAdminOfCustomerMessage(input: NotifyAdminInput): Promise<void> {
    if (!input.isFirstFromCustomer && input.lastAdminEmailAt) {
      const elapsed = Date.now() - input.lastAdminEmailAt.getTime();
      if (elapsed < ADMIN_THROTTLE_MS) return;
    }
    const rendered = inboxNewMessageAdmin({
      threadId: input.threadId,
      customerName: input.customerName,
      preview: input.preview.slice(0, 200),
    });
    try {
      await this.email.send({ to: this.adminEmail(), ...rendered });
    } catch (err) {
      this.logger.warn(`failed to notify admin of new message: ${err instanceof Error ? err.message : err}`);
    }
  }

  async notifyCustomerOfAdminReply(input: NotifyCustomerInput): Promise<void> {
    const isAway =
      input.customerLastSeenAt == null ||
      Date.now() - input.customerLastSeenAt.getTime() > CUSTOMER_AWAY_MS;

    if (input.isFirstAdminReply) {
      const token = await this.magicLink.mint(input.threadId);
      const rendered = inboxFirstReplyToCustomer({
        customerName: input.customerName,
        body: input.body,
        magicLinkUrl: `https://denimisiabd.com/chat/resume/${token}`,
      });
      try {
        await this.email.send({ to: input.customerEmail, ...rendered });
      } catch (err) {
        this.logger.warn(`failed first-reply email: ${err instanceof Error ? err.message : err}`);
      }
      return;
    }

    if (
      isAway &&
      input.consecutiveAdminMessages > 0 &&
      input.consecutiveAdminMessages % this.nudgeThreshold() === 0
    ) {
      const token = await this.magicLink.mint(input.threadId);
      const rendered = inboxNudgeToCustomer({
        customerName: input.customerName,
        pendingCount: input.consecutiveAdminMessages,
        magicLinkUrl: `https://denimisiabd.com/chat/resume/${token}`,
      });
      try {
        await this.email.send({ to: input.customerEmail, ...rendered });
      } catch (err) {
        this.logger.warn(`failed nudge email: ${err instanceof Error ? err.message : err}`);
      }
    }
  }
}
