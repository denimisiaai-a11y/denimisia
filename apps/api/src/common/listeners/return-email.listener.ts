import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { PrismaService } from '../../modules/prisma/prisma.service';
import { EmailService } from '../../modules/email/email.service';
import {
  returnApproved,
  returnRefunded,
  returnReceived,
  returnRejected,
  returnSubmitted,
} from '../../modules/email/email-templates';
import { env } from '../env';

interface ReturnEventPayload {
  returnId: string;
  rtnNumber: string;
  adminId?: string;
  amount?: number;
  method?: 'CASH' | 'BANK_TRANSFER';
  isManual?: boolean;
}

interface ReturnContext {
  ret: {
    id: string;
    rtnNumber: string;
    customerShipsBack: boolean;
    rejectionReason: string | null;
    refundAmount: unknown;
    refundMethod: 'CASH' | 'BANK_TRANSFER' | null;
    refundReference: string | null;
    guestEmail: string | null;
    guestName: string | null;
    user: {
      email: string;
      firstName: string | null;
      lastName: string | null;
    } | null;
  };
  email: string;
  customerName: string;
  trackingUrl: string;
}

/**
 * Sends customer emails as a Return moves through its lifecycle. Listens to
 * `return.requested`, `return.approved`, `return.rejected`, `return.received`,
 * and `return.refunded`. Each handler catches all errors so a flaky mailer
 * never bricks the state transition that triggered it.
 */
@Injectable()
export class ReturnEmailListener {
  private readonly logger = new Logger(ReturnEmailListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  private async getContext(returnId: string): Promise<ReturnContext | null> {
    const ret = await this.prisma.return.findUnique({
      where: { id: returnId },
      include: {
        user: { select: { email: true, firstName: true, lastName: true } },
      },
    });
    if (!ret) return null;

    const recipient = ret.user?.email ?? ret.guestEmail;
    if (!recipient) return null;

    const customerName = ret.user
      ? `${ret.user.firstName ?? ''} ${ret.user.lastName ?? ''}`.trim() ||
        'Customer'
      : ret.guestName?.trim() || 'Customer';

    const trackingUrl = `${env.STOREFRONT_URL}/returns/${ret.rtnNumber}`;

    return {
      ret: ret as ReturnContext['ret'],
      email: recipient,
      customerName,
      trackingUrl,
    };
  }

  private logFailure(
    event: string,
    payload: ReturnEventPayload,
    err: unknown,
  ): void {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.warn(
      `Failed to send ${event} email for ${payload.rtnNumber}: ${message}`,
    );
  }

  @OnEvent('return.requested', { async: true })
  async handleRequested(payload: ReturnEventPayload): Promise<void> {
    try {
      const ctx = await this.getContext(payload.returnId);
      if (!ctx) return;

      const tpl = returnSubmitted({
        rtnNumber: ctx.ret.rtnNumber,
        customerName: ctx.customerName,
        slaHours: 48,
        trackingUrl: ctx.trackingUrl,
      });

      await this.email.send({
        to: ctx.email,
        subject: tpl.subject,
        text: tpl.text,
        html: tpl.html,
      });
    } catch (err) {
      this.logFailure('return.requested', payload, err);
    }
  }

  @OnEvent('return.approved', { async: true })
  async handleApproved(payload: ReturnEventPayload): Promise<void> {
    try {
      const ctx = await this.getContext(payload.returnId);
      if (!ctx) return;

      const tpl = returnApproved({
        rtnNumber: ctx.ret.rtnNumber,
        customerName: ctx.customerName,
        customerShipsBack: ctx.ret.customerShipsBack,
        pickupInstructions: ctx.ret.customerShipsBack
          ? undefined
          : 'Our courier will contact you within 1-2 business days to schedule pickup.',
        trackingUrl: ctx.trackingUrl,
      });

      await this.email.send({
        to: ctx.email,
        subject: tpl.subject,
        text: tpl.text,
        html: tpl.html,
      });
    } catch (err) {
      this.logFailure('return.approved', payload, err);
    }
  }

  @OnEvent('return.rejected', { async: true })
  async handleRejected(payload: ReturnEventPayload): Promise<void> {
    try {
      const ctx = await this.getContext(payload.returnId);
      if (!ctx) return;

      const tpl = returnRejected({
        rtnNumber: ctx.ret.rtnNumber,
        customerName: ctx.customerName,
        rejectionReason: ctx.ret.rejectionReason ?? 'Not specified',
        trackingUrl: ctx.trackingUrl,
      });

      await this.email.send({
        to: ctx.email,
        subject: tpl.subject,
        text: tpl.text,
        html: tpl.html,
      });
    } catch (err) {
      this.logFailure('return.rejected', payload, err);
    }
  }

  @OnEvent('return.received', { async: true })
  async handleReceived(payload: ReturnEventPayload): Promise<void> {
    try {
      const ctx = await this.getContext(payload.returnId);
      if (!ctx) return;

      const tpl = returnReceived({
        rtnNumber: ctx.ret.rtnNumber,
        customerName: ctx.customerName,
        trackingUrl: ctx.trackingUrl,
      });

      await this.email.send({
        to: ctx.email,
        subject: tpl.subject,
        text: tpl.text,
        html: tpl.html,
      });
    } catch (err) {
      this.logFailure('return.received', payload, err);
    }
  }

  @OnEvent('return.refunded', { async: true })
  async handleRefunded(payload: ReturnEventPayload): Promise<void> {
    try {
      const ctx = await this.getContext(payload.returnId);
      if (!ctx) return;

      const amount = Number(ctx.ret.refundAmount ?? payload.amount ?? 0);
      const method = ctx.ret.refundMethod ?? payload.method ?? 'CASH';

      const tpl = returnRefunded({
        rtnNumber: ctx.ret.rtnNumber,
        customerName: ctx.customerName,
        amount,
        method,
        reference: ctx.ret.refundReference ?? '',
        trackingUrl: ctx.trackingUrl,
      });

      await this.email.send({
        to: ctx.email,
        subject: tpl.subject,
        text: tpl.text,
        html: tpl.html,
      });
    } catch (err) {
      this.logFailure('return.refunded', payload, err);
    }
  }
}
