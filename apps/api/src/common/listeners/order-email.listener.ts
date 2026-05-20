import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { EmailService } from '../../modules/email/email.service';
import {
  buildOrderConfirmationEmail,
  type OrderConfirmationAddress,
  type OrderConfirmationItem,
} from '../../modules/email/email-templates';
import { OrderCreatedEvent } from '../events/order.events';
import { env } from '../env';

interface VariantSnapshot {
  name: string;
  size: string;
  color: string;
  image: string | null;
}

interface BundleSnapshot {
  bundleSlug: string;
  bundleName: string;
  bundleImage: string | null;
  bundleSize: string;
  bundlePrice: number;
  items: Array<{
    productId: string;
    variantId: string;
    productName: string;
    color: string;
    size: string;
    image: string | null;
  }>;
}

type OrderItemSnapshot = VariantSnapshot | BundleSnapshot;

function isBundleSnapshot(value: OrderItemSnapshot): value is BundleSnapshot {
  return (
    typeof (value as BundleSnapshot).bundleSlug === 'string' &&
    typeof (value as BundleSnapshot).bundleName === 'string'
  );
}

function snapshotLabel(snapshot: OrderItemSnapshot): string {
  if (isBundleSnapshot(snapshot)) {
    return `${snapshot.bundleName} (size ${snapshot.bundleSize})`;
  }
  return `${snapshot.name} (${snapshot.color}/${snapshot.size})`;
}

function parseAddress(raw: unknown): OrderConfirmationAddress {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;
  const pick = (k: string): string | null => {
    const v = obj[k];
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  };
  return {
    line1: pick('line1') ?? pick('street'),
    line2: pick('line2'),
    city: pick('city'),
    state: pick('state'),
    zip: pick('zip') ?? pick('postalCode'),
    phone: pick('phone'),
  };
}

/**
 * Sends the order confirmation email after a successful checkout. Listens
 * to `order.created`, fetches the order with items + user, renders the
 * COD-specific template, and dispatches via Resend.
 *
 * Decoupled from OrderListener (which writes audit rows). Email failures
 * MUST NOT brick order placement — the listener catches and logs.
 */
@Injectable()
export class OrderEmailListener {
  private readonly logger = new Logger(OrderEmailListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  @OnEvent('order.created')
  async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    try {
      await this.send(event);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `order confirmation email failed (orderId=${event.orderId}): ${message}`,
      );
    }
  }

  private async send(event: OrderCreatedEvent): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: event.orderId },
      include: {
        items: true,
        user: { select: { email: true, firstName: true } },
      },
    });
    if (!order) {
      this.logger.warn(
        `order confirmation skipped: order ${event.orderId} not found`,
      );
      return;
    }

    const recipientEmail = order.user?.email ?? order.guestEmail;
    const recipientName =
      order.user?.firstName ?? order.guestName?.split(' ')[0] ?? 'there';
    if (!recipientEmail) {
      this.logger.warn(
        `order confirmation skipped: no recipient email on order ${event.orderId}`,
      );
      return;
    }

    const items: OrderConfirmationItem[] = order.items.map((item) => ({
      label: snapshotLabel(item.snapshot as unknown as OrderItemSnapshot),
      quantity: item.quantity,
      lineTotal: Number(item.total),
    }));

    // Guests are sent to the public track-order form prefilled with the
    // human-friendly orderNumber. Logged-in users go to their account
    // detail page which is still keyed by the CUID in the URL.
    const trackOrderUrl = order.userId
      ? `${env.STOREFRONT_URL}/account/orders/${order.id}`
      : `${env.STOREFRONT_URL}/track-order?order=${encodeURIComponent(order.orderNumber)}`;

    const rendered = buildOrderConfirmationEmail({
      firstName: recipientName,
      orderNumber: order.orderNumber,
      items,
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      shippingCost: Number(order.shippingCost),
      total: Number(order.total),
      shippingAddress: parseAddress(order.shippingAddress),
      trackOrderUrl,
    });

    await this.email.send({
      to: recipientEmail,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });
  }
}
