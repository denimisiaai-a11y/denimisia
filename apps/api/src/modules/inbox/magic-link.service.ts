import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

const TTL_DAYS = 30;

@Injectable()
export class MagicLinkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private secret(): string {
    const s = process.env.INBOX_MAGIC_LINK_SECRET;
    if (!s || s.length < 32) {
      throw new Error('INBOX_MAGIC_LINK_SECRET must be at least 32 characters');
    }
    return s;
  }

  async mint(threadId: string): Promise<string> {
    const expiresAt = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);
    const token = await this.jwt.signAsync(
      {},
      {
        secret: this.secret(),
        subject: threadId,
        expiresIn: `${TTL_DAYS}d`,
      },
    );
    await this.prisma.inboxMagicLink.create({ data: { token, threadId, expiresAt } });
    return token;
  }

  async verify(token: string): Promise<{ threadId: string }> {
    let payload: { sub?: string };
    try {
      payload = await this.jwt.verifyAsync(token, { secret: this.secret() });
    } catch {
      throw new UnauthorizedException('invalid magic link token');
    }
    const threadId = payload.sub;
    if (!threadId) throw new UnauthorizedException('invalid token: no subject');
    const row = await this.prisma.inboxMagicLink.findUnique({ where: { token } });
    if (!row) throw new UnauthorizedException('token not found');
    if (row.expiresAt.getTime() < Date.now()) throw new UnauthorizedException('token expired');
    if (row.threadId !== threadId) throw new UnauthorizedException('token mismatch');
    return { threadId };
  }
}
