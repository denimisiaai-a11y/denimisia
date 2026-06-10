import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEntry {
  sessionId: string;
  userId?: string;
  queryPreview: string;
  promptRaw: string;
  replyRaw: string;
  retrievedSources: object;
  success: boolean;
  errorCode?: string;
  outputFiltered: boolean;
  injectionFlagged: boolean;
}

const sha = (s: string): string => createHash('sha256').update(s).digest('hex');

@Injectable()
export class AuditLog {
  constructor(private readonly prisma: PrismaService) {}

  async write(entry: AuditEntry): Promise<void> {
    await this.prisma.botLlmAudit.create({
      data: {
        sessionId: entry.sessionId,
        userId: entry.userId ?? null,
        promptHash: sha(entry.promptRaw),
        replyHash: sha(entry.replyRaw),
        retrievedSources: entry.retrievedSources,
        success: entry.success,
        errorCode: entry.errorCode ?? null,
        outputFiltered: entry.outputFiltered,
        injectionFlagged: entry.injectionFlagged,
        queryPreview: entry.queryPreview.slice(0, 200),
      },
    });
  }
}
