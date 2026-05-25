import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class QuotaGuard {
  constructor(private readonly prisma: PrismaService) {}

  private todayUtc(): Date {
    const d = new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  private cap(): number {
    return parseInt(process.env.BOT_LLM_DAILY_NEURON_CAP ?? '8000', 10);
  }

  async check(): Promise<boolean> {
    const row = await this.prisma.botLlmQuota.findUnique({ where: { date: this.todayUtc() } });
    const used = row?.neuronsUsed ?? 0;
    return used < this.cap();
  }

  async recordUsage(neurons: number): Promise<void> {
    await this.prisma.botLlmQuota.upsert({
      where: { date: this.todayUtc() },
      create: { date: this.todayUtc(), neuronsUsed: neurons, callCount: 1 },
      update: { neuronsUsed: { increment: neurons }, callCount: { increment: 1 } },
    });
  }
}
