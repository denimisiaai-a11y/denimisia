import { NextResponse } from 'next/server';

interface ContactPayload {
  name?: unknown;
  email?: unknown;
  subject?: unknown;
  message?: unknown;
  website?: unknown;
}

const ALLOWED_SUBJECTS = new Set([
  'order',
  'product',
  'return',
  'wholesale',
  'other',
]);

function isNonEmptyString(value: unknown, min = 1, max = Infinity): value is string {
  return typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;
}

function isValidEmail(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length > 180) return false;
  // Simple RFC 5322 lite — good enough for form input.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export async function POST(request: Request) {
  let body: ContactPayload;
  try {
    body = (await request.json()) as ContactPayload;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  // Honeypot — bots fill every field. Accept silently so they don't retry.
  if (typeof body.website === 'string' && body.website.length > 0) {
    return NextResponse.json({ success: true });
  }

  if (!isNonEmptyString(body.name, 1, 120)) {
    return NextResponse.json(
      { success: false, error: 'Please enter your name.' },
      { status: 400 },
    );
  }
  if (!isValidEmail(body.email)) {
    return NextResponse.json(
      { success: false, error: 'Please enter a valid email address.' },
      { status: 400 },
    );
  }
  if (typeof body.subject !== 'string' || !ALLOWED_SUBJECTS.has(body.subject)) {
    return NextResponse.json(
      { success: false, error: 'Please choose a subject.' },
      { status: 400 },
    );
  }
  if (!isNonEmptyString(body.message, 10, 4000)) {
    return NextResponse.json(
      { success: false, error: 'Message must be between 10 and 4000 characters.' },
      { status: 400 },
    );
  }

  console.info('[contact:submission]', {
    name: (body.name as string).trim(),
    email: (body.email as string).trim(),
    subject: body.subject,
    length: (body.message as string).trim().length,
  });

  // TODO: forward to an email service (Resend / SendGrid / Mailchimp) once
  // credentials land. For now we accept, log, and return success so the UI
  // can confirm receipt to the user.
  return NextResponse.json({ success: true });
}
