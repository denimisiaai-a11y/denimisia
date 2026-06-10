import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await ctx.params;

  try {
    const verify = await fetch(`${API_BASE}/inbox/handoff/magic/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!verify.ok) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    const json = (await verify.json()) as { data?: { threadId: string } } & { threadId?: string };
    const threadId = json.data?.threadId ?? json.threadId;
    if (!threadId) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    const dest = new URL('/', req.url);
    dest.searchParams.set('chat', threadId);
    dest.searchParams.set('chatToken', token);
    return NextResponse.redirect(dest);
  } catch {
    return NextResponse.redirect(new URL('/', req.url));
  }
}
