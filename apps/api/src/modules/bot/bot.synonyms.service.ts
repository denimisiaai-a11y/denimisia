import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SYNONYM_CACHE_TTL_MS } from './bot.constants';

interface SynonymRow {
  dimension: string;
  canonical: string;
  aliases: string[];
}

@Injectable()
export class BotSynonymsService {
  private cache: SynonymRow[] | null = null;
  private cacheLoadedAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  invalidate(): void {
    this.cache = null;
    this.cacheLoadedAt = 0;
  }

  async resolveToken(
    dimension: string,
    token: string,
  ): Promise<{ dimension: string; canonical: string } | null> {
    const rows = await this.loadCache();
    const lower = token.toLowerCase();
    for (const row of rows) {
      if (row.dimension !== dimension) continue;
      if (row.canonical.toLowerCase() === lower) {
        return { dimension: row.dimension, canonical: row.canonical };
      }
      if (row.aliases.some((a) => a.toLowerCase() === lower)) {
        return { dimension: row.dimension, canonical: row.canonical };
      }
    }
    return null;
  }

  async allForDimension(dimension: string): Promise<SynonymRow[]> {
    const rows = await this.loadCache();
    return rows.filter((r) => r.dimension === dimension);
  }

  private async loadCache(): Promise<SynonymRow[]> {
    const now = Date.now();
    if (this.cache !== null && now - this.cacheLoadedAt < SYNONYM_CACHE_TTL_MS) {
      return this.cache;
    }
    this.cache = await this.prisma.botSynonym.findMany({
      select: { dimension: true, canonical: true, aliases: true },
    });
    this.cacheLoadedAt = now;
    return this.cache;
  }
}
