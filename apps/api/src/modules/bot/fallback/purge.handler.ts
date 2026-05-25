import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PurgeAuditQueryPreviewHandler {
  static readonly NAME = 'BOT_LLM_AUDIT_PURGE_QUERY_PREVIEW';

  constructor(private readonly prisma: PrismaService) {}

  async run(_payload: Record<string, never>): Promise<{ purged: number }> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await this.prisma.botLlmAudit.updateMany({
      where: { createdAt: { lt: cutoff }, queryPreview: { not: null } },
      data: { queryPreview: null },
    });
    return { purged: result.count };
  }
}
