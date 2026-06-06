// Email template builders. Pure functions — no I/O, no DI. Each returns
// { subject, text, html } that EmailService.send() consumes directly.
//
// HTML is intentionally inline-styled and dependency-free: no external
// stylesheets, no remote images, no JavaScript. Renders the same in
// Gmail, Outlook, Apple Mail, and BD-popular clients without breakage.

interface BaseLayoutInput {
  preheader: string;
  bodyHtml: string;
}

const BRAND_NAME = 'Denimisia';
const BRAND_INK = '#1a1a1a';
const BRAND_MUTED = '#666666';
const BRAND_RULE = '#e6e6e6';

function wrapInLayout({ preheader, bodyHtml }: BaseLayoutInput): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${BRAND_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#f6f6f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND_INK};">
<div style="display:none;font-size:1px;color:#f6f6f6;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f6f6;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid ${BRAND_RULE};border-radius:6px;">
<tr><td style="padding:32px 32px 16px 32px;">
<div style="font-size:22px;font-weight:600;letter-spacing:0.04em;">${BRAND_NAME}</div>
</td></tr>
<tr><td style="padding:0 32px 32px 32px;font-size:15px;line-height:1.55;color:${BRAND_INK};">
${bodyHtml}
</td></tr>
<tr><td style="border-top:1px solid ${BRAND_RULE};padding:20px 32px;font-size:12px;color:${BRAND_MUTED};text-align:center;">
You're receiving this because you have an account or placed an order at ${BRAND_NAME}.
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatBdt(amount: number): string {
  return `BDT ${amount.toLocaleString('en-BD', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

// ─── Verify email ───────────────────────────────────────────────────────────

export interface VerifyEmailInput {
  firstName: string;
  verifyUrl: string;
}

export function buildVerifyEmail(input: VerifyEmailInput): RenderedEmail {
  const name = escapeHtml(input.firstName || 'there');
  const href = escapeHtml(input.verifyUrl);
  const subject = `Verify your ${BRAND_NAME} account`;
  const text = `Hi ${input.firstName || 'there'},

Welcome to ${BRAND_NAME}. Verify your email to finish setting up your account:

${input.verifyUrl}

This link is valid for 24 hours. If you did not create this account, you can ignore this email.

${BRAND_NAME}`;
  const html = wrapInLayout({
    preheader: `Verify your ${BRAND_NAME} email to finish signing up.`,
    bodyHtml: `<p style="margin:0 0 16px 0;">Hi ${name},</p>
<p style="margin:0 0 20px 0;">Welcome to ${BRAND_NAME}. Verify your email to finish setting up your account.</p>
<p style="margin:0 0 24px 0;">
<a href="${href}" style="display:inline-block;background:${BRAND_INK};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:4px;font-weight:500;">Verify email</a>
</p>
<p style="margin:0 0 8px 0;font-size:13px;color:${BRAND_MUTED};">Or paste this URL into your browser:</p>
<p style="margin:0 0 24px 0;font-size:13px;word-break:break-all;color:${BRAND_MUTED};">${href}</p>
<p style="margin:0;font-size:13px;color:${BRAND_MUTED};">This link is valid for 24 hours. If you did not create this account you can ignore this email.</p>`,
  });
  return { subject, text, html };
}

// ─── Password reset ─────────────────────────────────────────────────────────

export interface PasswordResetEmailInput {
  firstName: string;
  resetUrl: string;
  expiresInHours: number;
}

export function buildPasswordResetEmail(
  input: PasswordResetEmailInput,
): RenderedEmail {
  const name = escapeHtml(input.firstName || 'there');
  const href = escapeHtml(input.resetUrl);
  const hours = input.expiresInHours;
  const subject = `Reset your ${BRAND_NAME} password`;
  const text = `Hi ${input.firstName || 'there'},

We received a request to reset your ${BRAND_NAME} password. Set a new one here:

${input.resetUrl}

This link is valid for ${hours} hour${hours === 1 ? '' : 's'}. If you did not request a reset you can ignore this email; your password will not change.

${BRAND_NAME}`;
  const html = wrapInLayout({
    preheader: `Reset your ${BRAND_NAME} password (valid ${hours} hour${hours === 1 ? '' : 's'}).`,
    bodyHtml: `<p style="margin:0 0 16px 0;">Hi ${name},</p>
<p style="margin:0 0 20px 0;">We received a request to reset your ${BRAND_NAME} password. Set a new one here:</p>
<p style="margin:0 0 24px 0;">
<a href="${href}" style="display:inline-block;background:${BRAND_INK};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:4px;font-weight:500;">Reset password</a>
</p>
<p style="margin:0 0 8px 0;font-size:13px;color:${BRAND_MUTED};">Or paste this URL into your browser:</p>
<p style="margin:0 0 24px 0;font-size:13px;word-break:break-all;color:${BRAND_MUTED};">${href}</p>
<p style="margin:0;font-size:13px;color:${BRAND_MUTED};">This link is valid for ${hours} hour${hours === 1 ? '' : 's'}. If you did not request a reset you can ignore this email; your password will not change.</p>`,
  });
  return { subject, text, html };
}

// ─── Order confirmation (COD) ───────────────────────────────────────────────

export interface OrderConfirmationItem {
  label: string;
  quantity: number;
  lineTotal: number;
}

export interface OrderConfirmationAddress {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  phone?: string | null;
}

export interface OrderConfirmationEmailInput {
  firstName: string;
  // Customer-facing identifier (`DEN-NNNNNN`). Used in subject + body.
  // The internal CUID is no longer surfaced in emails — see commit
  // adding Order.orderNumber.
  orderNumber: string;
  items: OrderConfirmationItem[];
  subtotal: number;
  discount: number;
  shippingCost: number;
  total: number;
  shippingAddress: OrderConfirmationAddress;
  trackOrderUrl: string;
}

function formatAddressText(addr: OrderConfirmationAddress): string {
  const parts = [
    addr.line1,
    addr.line2,
    [addr.city, addr.state].filter(Boolean).join(', ') || null,
    addr.zip,
    addr.phone ? `Phone: ${addr.phone}` : null,
  ].filter((line): line is string => Boolean(line && line.trim()));
  return parts.length ? parts.join('\n') : 'Address on file';
}

function formatAddressHtml(addr: OrderConfirmationAddress): string {
  const lines = [
    addr.line1,
    addr.line2,
    [addr.city, addr.state].filter(Boolean).join(', ') || null,
    addr.zip,
    addr.phone ? `Phone: ${addr.phone}` : null,
  ]
    .filter((line): line is string => Boolean(line && line.trim()))
    .map((line) => escapeHtml(line));
  return lines.length
    ? lines.join('<br>')
    : '<span style="color:#999;">Address on file</span>';
}

export function buildOrderConfirmationEmail(
  input: OrderConfirmationEmailInput,
): RenderedEmail {
  const name = escapeHtml(input.firstName || 'there');
  const ref = escapeHtml(input.orderNumber);
  const subject = `Order ${input.orderNumber} confirmed — ${BRAND_NAME}`;

  const itemsText = input.items
    .map(
      (item) =>
        `  • ${item.label} × ${item.quantity}  —  ${formatBdt(item.lineTotal)}`,
    )
    .join('\n');

  const text = `Hi ${input.firstName || 'there'},

Thanks for your order. Your order reference is ${input.orderNumber}.

This order is cash on delivery. Please keep the exact total ready when our courier arrives.

Items:
${itemsText}

Subtotal:   ${formatBdt(input.subtotal)}
${input.discount > 0 ? `Discount:   -${formatBdt(input.discount)}\n` : ''}Shipping:   ${formatBdt(input.shippingCost)}
Total due:  ${formatBdt(input.total)}

Delivery address:
${formatAddressText(input.shippingAddress)}

Track your order:
${input.trackOrderUrl}

We'll reach out about delivery timing. If anything looks wrong, reply to this email.

${BRAND_NAME}`;

  const itemsHtml = input.items
    .map(
      (item) => `<tr>
<td style="padding:8px 0;border-bottom:1px solid ${BRAND_RULE};font-size:14px;">${escapeHtml(item.label)} <span style="color:${BRAND_MUTED};">× ${item.quantity}</span></td>
<td style="padding:8px 0;border-bottom:1px solid ${BRAND_RULE};font-size:14px;text-align:right;white-space:nowrap;">${formatBdt(item.lineTotal)}</td>
</tr>`,
    )
    .join('');

  const discountRow =
    input.discount > 0
      ? `<tr><td style="padding:4px 0;font-size:14px;color:${BRAND_MUTED};">Discount</td><td style="padding:4px 0;font-size:14px;text-align:right;color:${BRAND_MUTED};">-${formatBdt(input.discount)}</td></tr>`
      : '';

  const html = wrapInLayout({
    preheader: `Cash on delivery — total due ${formatBdt(input.total)}.`,
    bodyHtml: `<p style="margin:0 0 16px 0;">Hi ${name},</p>
<p style="margin:0 0 8px 0;">Thanks for your order. Your reference is <strong>${ref}</strong>.</p>
<p style="margin:0 0 24px 0;padding:12px 16px;background:#f9f9f7;border-radius:4px;font-size:14px;">
<strong>Cash on delivery.</strong> Please keep the exact total ready when our courier arrives.
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;">
${itemsHtml}
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
<tr><td style="padding:4px 0;font-size:14px;color:${BRAND_MUTED};">Subtotal</td><td style="padding:4px 0;font-size:14px;text-align:right;color:${BRAND_MUTED};">${formatBdt(input.subtotal)}</td></tr>
${discountRow}
<tr><td style="padding:4px 0;font-size:14px;color:${BRAND_MUTED};">Shipping</td><td style="padding:4px 0;font-size:14px;text-align:right;color:${BRAND_MUTED};">${formatBdt(input.shippingCost)}</td></tr>
<tr><td style="padding:8px 0 4px 0;font-size:15px;font-weight:600;border-top:1px solid ${BRAND_RULE};">Total due</td><td style="padding:8px 0 4px 0;font-size:15px;font-weight:600;text-align:right;border-top:1px solid ${BRAND_RULE};">${formatBdt(input.total)}</td></tr>
</table>
<div style="margin:0 0 24px 0;font-size:13px;line-height:1.6;">
<strong style="display:block;margin-bottom:4px;">Delivery address</strong>
${formatAddressHtml(input.shippingAddress)}
</div>
<p style="margin:0 0 24px 0;">
<a href="${escapeHtml(input.trackOrderUrl)}" style="display:inline-block;background:${BRAND_INK};color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:4px;font-weight:500;font-size:14px;">Track order</a>
</p>
<p style="margin:0;font-size:13px;color:${BRAND_MUTED};">We'll reach out about delivery timing. If anything looks wrong, just reply to this email.</p>`,
  });

  return { subject, text, html };
}

// ─── Returns: submitted ─────────────────────────────────────────────────────

export interface ReturnSubmittedEmailInput {
  rtnNumber: string;
  customerName: string;
  slaHours: number;
  trackingUrl: string;
}

export function returnSubmitted(
  input: ReturnSubmittedEmailInput,
): RenderedEmail {
  const name = escapeHtml(input.customerName || 'there');
  const rtn = escapeHtml(input.rtnNumber);
  const href = escapeHtml(input.trackingUrl);
  const hours = input.slaHours;
  const subject = `Return request received — ${input.rtnNumber}`;

  const text = `Hi ${input.customerName || 'there'},

Thanks for submitting a return request. Your reference is ${input.rtnNumber}.

We'll review your request within ${hours} hours and email you the decision. You can track the status here:

${input.trackingUrl}

If you didn't request this, reply to this email immediately so we can investigate.

${BRAND_NAME}`;

  const html = wrapInLayout({
    preheader: `We received your return request ${input.rtnNumber}. Decision within ${hours} hours.`,
    bodyHtml: `<p style="margin:0 0 16px 0;">Hi ${name},</p>
<p style="margin:0 0 16px 0;">Thanks for submitting a return request. Your reference is <strong>${rtn}</strong>.</p>
<p style="margin:0 0 24px 0;">We'll review your request within <strong>${hours} hours</strong> and email you the decision.</p>
<p style="margin:0 0 24px 0;">
<a href="${href}" style="display:inline-block;background:${BRAND_INK};color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:4px;font-weight:500;font-size:14px;">Track return</a>
</p>
<p style="margin:0 0 8px 0;font-size:13px;color:${BRAND_MUTED};">Or paste this URL into your browser:</p>
<p style="margin:0 0 24px 0;font-size:13px;word-break:break-all;color:${BRAND_MUTED};">${href}</p>
<p style="margin:0;font-size:13px;color:${BRAND_MUTED};">If you didn't request this, reply to this email immediately so we can investigate.</p>`,
  });

  return { subject, text, html };
}

// ─── Returns: approved ──────────────────────────────────────────────────────

export interface ReturnApprovedEmailInput {
  rtnNumber: string;
  customerName: string;
  customerShipsBack: boolean;
  pickupInstructions?: string;
  trackingUrl: string;
}

const SHIP_BACK_ADDRESS_LINES = [
  'Denimisia Returns',
  'House 42, Road 11, Banani',
  'Dhaka 1213, Bangladesh',
  'Phone: +880 1700 000000',
];

export function returnApproved(input: ReturnApprovedEmailInput): RenderedEmail {
  const name = escapeHtml(input.customerName || 'there');
  const rtn = escapeHtml(input.rtnNumber);
  const href = escapeHtml(input.trackingUrl);
  const subject = `Return approved — ${input.rtnNumber}`;

  const customerShipsBackText = `Please ship the item(s) back to us within 14 days at the address below. Use a tracked courier and keep the receipt.

${SHIP_BACK_ADDRESS_LINES.join('\n')}

Once we receive the package we'll inspect it and process your refund.`;

  const pickupText = input.pickupInstructions
    ? input.pickupInstructions
    : 'We will arrange a pickup using the contact details on file. Our courier will reach out within 1-2 business days to schedule a convenient time.';

  const instructionsText = input.customerShipsBack
    ? customerShipsBackText
    : pickupText;

  const text = `Hi ${input.customerName || 'there'},

Good news — your return request ${input.rtnNumber} has been approved.

${instructionsText}

Track the return:
${input.trackingUrl}

${BRAND_NAME}`;

  const customerShipsBackHtml = `<p style="margin:0 0 12px 0;">Please ship the item(s) back to us within <strong>14 days</strong> at the address below. Use a tracked courier and keep the receipt.</p>
<div style="margin:0 0 16px 0;padding:12px 16px;background:#f9f9f7;border-radius:4px;font-size:14px;line-height:1.5;">
${SHIP_BACK_ADDRESS_LINES.map(escapeHtml).join('<br>')}
</div>
<p style="margin:0 0 24px 0;font-size:14px;">Once we receive the package we'll inspect it and process your refund.</p>`;

  const pickupHtml = `<p style="margin:0 0 24px 0;">${escapeHtml(
    input.pickupInstructions ??
      'We will arrange a pickup using the contact details on file. Our courier will reach out within 1-2 business days to schedule a convenient time.',
  )}</p>`;

  const instructionsHtml = input.customerShipsBack
    ? customerShipsBackHtml
    : pickupHtml;

  const html = wrapInLayout({
    preheader: `Return ${input.rtnNumber} approved.`,
    bodyHtml: `<p style="margin:0 0 16px 0;">Hi ${name},</p>
<p style="margin:0 0 20px 0;">Good news — your return request <strong>${rtn}</strong> has been approved.</p>
${instructionsHtml}
<p style="margin:0 0 24px 0;">
<a href="${href}" style="display:inline-block;background:${BRAND_INK};color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:4px;font-weight:500;font-size:14px;">Track return</a>
</p>
<p style="margin:0 0 8px 0;font-size:13px;color:${BRAND_MUTED};">Or paste this URL into your browser:</p>
<p style="margin:0;font-size:13px;word-break:break-all;color:${BRAND_MUTED};">${href}</p>`,
  });

  return { subject, text, html };
}

// ─── Returns: rejected ──────────────────────────────────────────────────────

export interface ReturnRejectedEmailInput {
  rtnNumber: string;
  customerName: string;
  rejectionReason: string;
  trackingUrl: string;
}

export function returnRejected(input: ReturnRejectedEmailInput): RenderedEmail {
  const name = escapeHtml(input.customerName || 'there');
  const rtn = escapeHtml(input.rtnNumber);
  const href = escapeHtml(input.trackingUrl);
  const reason = escapeHtml(input.rejectionReason || 'Not specified');
  const subject = `Return request not approved — ${input.rtnNumber}`;

  const text = `Hi ${input.customerName || 'there'},

We're sorry — after reviewing your return request ${input.rtnNumber}, we're unable to approve it.

Reason: ${input.rejectionReason || 'Not specified'}

If you'd like to discuss this decision or share more details, reply to this email and our team will look at it again.

You can view the full status here:
${input.trackingUrl}

${BRAND_NAME}`;

  const html = wrapInLayout({
    preheader: `Return ${input.rtnNumber} was not approved.`,
    bodyHtml: `<p style="margin:0 0 16px 0;">Hi ${name},</p>
<p style="margin:0 0 16px 0;">We're sorry — after reviewing your return request <strong>${rtn}</strong>, we're unable to approve it.</p>
<div style="margin:0 0 24px 0;padding:12px 16px;background:#f9f9f7;border-radius:4px;font-size:14px;">
<strong style="display:block;margin-bottom:4px;">Reason</strong>
${reason}
</div>
<p style="margin:0 0 24px 0;">If you'd like to discuss this decision or share more details, reply to this email and our team will look at it again.</p>
<p style="margin:0 0 24px 0;">
<a href="${href}" style="display:inline-block;background:${BRAND_INK};color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:4px;font-weight:500;font-size:14px;">View status</a>
</p>
<p style="margin:0 0 8px 0;font-size:13px;color:${BRAND_MUTED};">Or paste this URL into your browser:</p>
<p style="margin:0;font-size:13px;word-break:break-all;color:${BRAND_MUTED};">${href}</p>`,
  });

  return { subject, text, html };
}

// ─── Returns: received ──────────────────────────────────────────────────────

export interface ReturnReceivedEmailInput {
  rtnNumber: string;
  customerName: string;
  trackingUrl: string;
}

export function returnReceived(input: ReturnReceivedEmailInput): RenderedEmail {
  const name = escapeHtml(input.customerName || 'there');
  const rtn = escapeHtml(input.rtnNumber);
  const href = escapeHtml(input.trackingUrl);
  const subject = `We received your return — ${input.rtnNumber}`;

  const text = `Hi ${input.customerName || 'there'},

Your return package for ${input.rtnNumber} arrived at our warehouse. Thank you.

Next: our team will inspect the item(s) and confirm refund eligibility. We'll email you again once the inspection is complete.

Track the return:
${input.trackingUrl}

${BRAND_NAME}`;

  const html = wrapInLayout({
    preheader: `Your return package for ${input.rtnNumber} arrived.`,
    bodyHtml: `<p style="margin:0 0 16px 0;">Hi ${name},</p>
<p style="margin:0 0 16px 0;">Your return package for <strong>${rtn}</strong> arrived at our warehouse. Thank you.</p>
<p style="margin:0 0 24px 0;">Next: our team will inspect the item(s) and confirm refund eligibility. We'll email you again once the inspection is complete.</p>
<p style="margin:0 0 24px 0;">
<a href="${href}" style="display:inline-block;background:${BRAND_INK};color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:4px;font-weight:500;font-size:14px;">Track return</a>
</p>
<p style="margin:0 0 8px 0;font-size:13px;color:${BRAND_MUTED};">Or paste this URL into your browser:</p>
<p style="margin:0;font-size:13px;word-break:break-all;color:${BRAND_MUTED};">${href}</p>`,
  });

  return { subject, text, html };
}

// ─── Returns: refunded ──────────────────────────────────────────────────────

export interface ReturnRefundedEmailInput {
  rtnNumber: string;
  customerName: string;
  amount: number;
  method: 'CASH' | 'BANK_TRANSFER';
  reference: string;
  trackingUrl: string;
}

function formatRefundAmount(amount: number): string {
  // "BDT" prefix to match the order-confirmation email (formatBdt) and because
  // email clients render the ৳ glyph (U+09F3) unreliably. Keeps decimals for
  // partial refunds.
  const isWhole = Number.isInteger(amount);
  return `BDT ${amount.toLocaleString('en-BD', {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: isWhole ? 0 : 2,
  })}`;
}

function formatRefundMethod(method: 'CASH' | 'BANK_TRANSFER'): string {
  return method === 'BANK_TRANSFER' ? 'Bank Transfer' : 'Cash';
}

export function returnRefunded(input: ReturnRefundedEmailInput): RenderedEmail {
  const name = escapeHtml(input.customerName || 'there');
  const rtn = escapeHtml(input.rtnNumber);
  const href = escapeHtml(input.trackingUrl);
  const amountStr = formatRefundAmount(input.amount);
  const methodStr = formatRefundMethod(input.method);
  const reference = input.reference?.trim() ? input.reference.trim() : '—';
  const subject = `Refund issued — ${input.rtnNumber}`;

  const text = `Hi ${input.customerName || 'there'},

Your refund for return ${input.rtnNumber} has been issued.

Amount:    ${amountStr}
Method:    ${methodStr}
Reference: ${reference}

Refund details may take 2-3 business days to reflect in your bank account.

Track the return:
${input.trackingUrl}

${BRAND_NAME}`;

  const html = wrapInLayout({
    preheader: `Refund of ${amountStr} issued for ${input.rtnNumber}.`,
    bodyHtml: `<p style="margin:0 0 16px 0;">Hi ${name},</p>
<p style="margin:0 0 20px 0;">Your refund for return <strong>${rtn}</strong> has been issued.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
<tr><td style="padding:6px 0;font-size:14px;color:${BRAND_MUTED};width:120px;">Amount</td><td style="padding:6px 0;font-size:14px;font-weight:600;">${escapeHtml(amountStr)}</td></tr>
<tr><td style="padding:6px 0;font-size:14px;color:${BRAND_MUTED};">Method</td><td style="padding:6px 0;font-size:14px;">${escapeHtml(methodStr)}</td></tr>
<tr><td style="padding:6px 0;font-size:14px;color:${BRAND_MUTED};">Reference</td><td style="padding:6px 0;font-size:14px;word-break:break-all;">${escapeHtml(reference)}</td></tr>
</table>
<p style="margin:0 0 24px 0;font-size:13px;color:${BRAND_MUTED};">Refund details may take 2-3 business days to reflect in your bank account.</p>
<p style="margin:0 0 24px 0;">
<a href="${href}" style="display:inline-block;background:${BRAND_INK};color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:4px;font-weight:500;font-size:14px;">View details</a>
</p>
<p style="margin:0 0 8px 0;font-size:13px;color:${BRAND_MUTED};">Or paste this URL into your browser:</p>
<p style="margin:0;font-size:13px;word-break:break-all;color:${BRAND_MUTED};">${href}</p>`,
  });

  return { subject, text, html };
}

// ─── Inbox handoff emails ───────────────────────────────────────────────────

export interface InboxNewMessageAdminInput {
  threadId: string;
  customerName: string;
  preview: string;
}

export function inboxNewMessageAdmin(input: InboxNewMessageAdminInput): RenderedEmail {
  const adminUrl = `https://admin.denimisiabd.com/inbox/${input.threadId}`;
  const name = escapeHtml(input.customerName);
  const preview = escapeHtml(input.preview);
  const subject = `[Denimisia inbox] New message from ${input.customerName}`;
  const text = `${input.customerName} sent a new message:\n\n"${input.preview}"\n\nOpen the thread: ${adminUrl}`;
  const html = `<p>${name} sent a new message:</p><blockquote style="border-left:3px solid #ddd;padding-left:12px;margin:12px 0;">${preview}</blockquote><p><a href="${adminUrl}">Open the thread</a></p>`;
  return { subject, text, html };
}

export interface InboxFirstReplyCustomerInput {
  customerName: string;
  body: string;
  magicLinkUrl: string;
}

export function inboxFirstReplyToCustomer(input: InboxFirstReplyCustomerInput): RenderedEmail {
  const name = escapeHtml(input.customerName);
  const body = escapeHtml(input.body);
  const subject = `Denimisia support replied to your message`;
  const text = `Hi ${input.customerName},\n\nWe replied to your message:\n\n"${input.body}"\n\nView the conversation: ${input.magicLinkUrl}\n\n— Denimisia`;
  const html = `<p>Hi ${name},</p><p>We replied to your message:</p><blockquote style="border-left:3px solid #ddd;padding-left:12px;margin:12px 0;">${body}</blockquote><p><a href="${input.magicLinkUrl}">View the conversation</a></p><p>— Denimisia</p>`;
  return { subject, text, html };
}

export interface InboxNudgeCustomerInput {
  customerName: string;
  pendingCount: number;
  magicLinkUrl: string;
}

export function inboxNudgeToCustomer(input: InboxNudgeCustomerInput): RenderedEmail {
  const name = escapeHtml(input.customerName);
  const subject = `You have ${input.pendingCount} new messages from Denimisia`;
  const text = `Hi ${input.customerName},\n\nDenimisia support has sent ${input.pendingCount} new messages while you were away. Tap to view: ${input.magicLinkUrl}\n\n— Denimisia`;
  const html = `<p>Hi ${name},</p><p>Denimisia support has sent <strong>${input.pendingCount}</strong> new messages while you were away.</p><p><a href="${input.magicLinkUrl}">View the conversation</a></p><p>— Denimisia</p>`;
  return { subject, text, html };
}

export interface InboxAdminDigestInput {
  openCount: number;
  oldestOpenSince: string;
  threads: Array<{ id: string; customerName: string; lastMessageAt: string }>;
}

export function inboxAdminDigest(input: InboxAdminDigestInput): RenderedEmail {
  const subject = `[Denimisia inbox] ${input.openCount} open conversations`;
  const lines = input.threads
    .map(
      (t) =>
        `- ${t.customerName} (${t.lastMessageAt}) https://admin.denimisiabd.com/inbox/${t.id}`,
    )
    .join('\n');
  const text = `Daily inbox summary:\n\nOpen threads: ${input.openCount}\nOldest open: ${input.oldestOpenSince}\n\n${lines}`;
  const htmlLines = input.threads
    .map(
      (t) =>
        `<li><a href="https://admin.denimisiabd.com/inbox/${t.id}">${escapeHtml(t.customerName)}</a> · ${t.lastMessageAt}</li>`,
    )
    .join('');
  const html = `<p>Daily inbox summary:</p><p>Open threads: <strong>${input.openCount}</strong><br/>Oldest open: ${input.oldestOpenSince}</p><ul>${htmlLines}</ul>`;
  return { subject, text, html };
}
