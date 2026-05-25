import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const NAME_RE = /^.{1,80}$/;
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const BD_PHONE_RE = /^(\+?880|0)[\s-]?1[3-9]\d{8}$/;

export interface CaptureInput {
  name: string;
  email: string;
  phone: string;
  sessionId: string;
}

export interface CaptureResult {
  ok: boolean;
  reason?: string;
  normalized?: { name: string; email: string; phone: string };
  userId?: string;
}

@Injectable()
export class IdentityCaptureService {
  constructor(private readonly prisma: PrismaService) {}

  async capture(input: CaptureInput): Promise<CaptureResult> {
    const name = input.name.trim();
    if (!NAME_RE.test(name)) return { ok: false, reason: 'invalid_name' };

    const email = input.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return { ok: false, reason: 'invalid_email' };

    const phoneStripped = input.phone.replace(/[\s-]/g, '');
    if (!BD_PHONE_RE.test(phoneStripped)) return { ok: false, reason: 'invalid_phone' };

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    return {
      ok: true,
      normalized: { name, email, phone: phoneStripped },
      userId: user?.id,
    };
  }
}
