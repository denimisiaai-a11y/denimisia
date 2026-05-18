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
  orderId: string;
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

function shortOrderRef(orderId: string): string {
  return orderId.slice(-8).toUpperCase();
}

export function buildOrderConfirmationEmail(
  input: OrderConfirmationEmailInput,
): RenderedEmail {
  const name = escapeHtml(input.firstName || 'there');
  const ref = shortOrderRef(input.orderId);
  const subject = `Order ${ref} confirmed — ${BRAND_NAME}`;

  const itemsText = input.items
    .map(
      (item) =>
        `  • ${item.label} × ${item.quantity}  —  ${formatBdt(item.lineTotal)}`,
    )
    .join('\n');

  const text = `Hi ${input.firstName || 'there'},

Thanks for your order. Your order reference is ${ref}.

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
