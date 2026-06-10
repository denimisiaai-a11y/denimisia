import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

const TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ResponseCache {
  constructor(private readonly prisma: PrismaService) {}

  key(query: string): string {
    const normalized = query.toLowerCase().replace(/\s+/g, ' ').trim();
    return createHash('sha256').update(normalized).digest('hex');
  }

  async get(query: string): Promise<string | null> {
    const queryHash = this.key(query);
    const row = await this.prisma.botLlmCache.findUnique({ where: { queryHash } });
    if (!row) return null;
    if (Date.now() - row.createdAt.getTime() > TTL_MS) return null;
    return row.reply;
  }

  async set(query: string, reply: string, retrievedSources: unknown): Promise<void> {
    const queryHash = this.key(query);
    await this.prisma.botLlmCache.upsert({
      where: { queryHash },
      create: { queryHash, reply, retrievedSources: retrievedSources as object },
      update: { reply, retrievedSources: retrievedSources as object, createdAt: new Date() },
    });
  }
}
