import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RtnIdService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(year: number = new Date().getUTCFullYear()): Promise<string> {
    const prefix = `RTN-${year}-`;
    const latest = await this.prisma.return.findFirst({
      where: { rtnNumber: { startsWith: prefix } },
      orderBy: { rtnNumber: 'desc' },
      select: { rtnNumber: true },
    });
    const next = latest
      ? parseInt(latest.rtnNumber.slice(prefix.length), 10) + 1
      : 1;
    return `${prefix}${String(next).padStart(6, '0')}`;
  }
}
