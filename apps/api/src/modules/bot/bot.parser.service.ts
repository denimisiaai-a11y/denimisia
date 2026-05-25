import { Injectable } from '@nestjs/common';
import { ProductType } from '@prisma/client';
import { BotSynonymsService } from './bot.synonyms.service';
import { BotIntent, ParsedSlots } from './bot.types';

const WHATS_NEW_TRIGGERS = [
  'new arrivals',
  'latest',
  'recent',
  "what's new",
  'whats new',
];
const SIZING_TRIGGERS = [
  'my size',
  'find my size',
  'fit me',
  'measurements',
  'help me find my size',
  'what size am i',
];
const TALK_TO_SUPPORT_PATTERNS: RegExp[] = [
  /\btalk\s+to\s+(support|a\s+human|a\s+person|someone|customer\s+service)\b/i,
  /\bspeak\s+to\s+(support|a\s+person|someone|customer\s+service)\b/i,
  /\bi\s+want\s+to\s+(talk|speak|chat)\s+(to|with)\b/i,
  /\bleave\s+a\s+message\b/i,
  /\bcontact\s+(support|the\s+team)\b/i,
];
const SINGLE_SILHOUETTE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['slim', 'baggy'],
  ['slim', 'relaxed'],
  ['skinny', 'baggy'],
  ['fitted', 'oversized'],
  ['cropped', 'long'],
];

@Injectable()
export class BotParserService {
  constructor(private readonly synonyms: BotSynonymsService) {}

  detectIntent(text: string): BotIntent {
    const lower = text.toLowerCase();
    if (TALK_TO_SUPPORT_PATTERNS.some((re) => re.test(lower))) return 'talk_to_support';
    if (SIZING_TRIGGERS.some((t) => lower.includes(t))) return 'sizing';
    if (WHATS_NEW_TRIGGERS.some((t) => lower.includes(t))) return 'whats_new';
    if (lower.trim() === '') return 'unknown';
    return 'find';
  }

  async extractSlots(text: string): Promise<ParsedSlots> {
    const tokens = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    const slots: ParsedSlots = { tags: [] };

    for (const tok of tokens) {
      // Size: numeric or single-letter S/M/L/XL/XXL
      if (/^\d{2,3}$/.test(tok) || /^(xs|s|m|l|xl|xxl|xxxl)$/i.test(tok)) {
        slots.size = tok.toUpperCase();
        continue;
      }

      // Category
      const cat = await this.matchWithFuzzy('category', tok);
      if (cat) {
        const map: Record<string, ProductType> = {
          pants: 'PANTS',
          shirts: 'SHIRTS',
          jackets: 'JACKETS',
        };
        if (map[cat.canonical]) slots.type = map[cat.canonical];
        continue;
      }

      // Color
      const color = await this.matchWithFuzzy('color', tok);
      if (color) {
        slots.color = color.canonical;
        continue;
      }

      // Other tag dimensions
      for (const dim of [
        'silhouette',
        'sleeve',
        'neckline',
        'closure',
        'warmth',
        'rise',
        'wash',
        'season',
        'occasion',
        'material',
        'pattern',
        'length',
      ]) {
        const m = await this.matchWithFuzzy(dim, tok);
        if (m) {
          slots.tags.push({ dimension: dim, value: m.canonical });
          break;
        }
      }
    }

    return slots;
  }

  detectContradictions(slots: {
    tags: Array<{ dimension: string; value: string }>;
  }): Array<{ dimension: string; values: string[] }> {
    const conflicts: Array<{ dimension: string; values: string[] }> = [];
    const sil = slots.tags
      .filter((t) => t.dimension === 'silhouette')
      .map((t) => t.value);
    for (const [a, b] of SINGLE_SILHOUETTE_PAIRS) {
      if (sil.includes(a) && sil.includes(b)) {
        conflicts.push({ dimension: 'silhouette', values: [a, b] });
      }
    }
    return conflicts;
  }

  private async matchWithFuzzy(
    dimension: string,
    token: string,
  ): Promise<{ dimension: string; canonical: string } | null> {
    const direct = await this.synonyms.resolveToken(dimension, token);
    if (direct) return direct;
    const candidates = (await this.synonyms.allForDimension(dimension)) ?? [];
    for (const row of candidates) {
      const pool = [row.canonical, ...row.aliases];
      for (const candidate of pool) {
        if (
          levenshtein(candidate.toLowerCase(), token) <= 1 &&
          candidate.length >= 4
        ) {
          return { dimension: row.dimension, canonical: row.canonical };
        }
      }
    }
    return null;
  }
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  // Damerau-Levenshtein: treats adjacent transpositions as a single edit
  // so common typos like "blakc" -> "black" count as distance 1.
  const d: number[][] = [];
  for (let i = 0; i <= m; i++) {
    d[i] = new Array<number>(n + 1);
    d[i][0] = i;
  }
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}
