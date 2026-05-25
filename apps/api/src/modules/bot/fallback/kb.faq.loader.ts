import { Injectable, OnModuleInit } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import BM25 from 'okapibm25';

export interface FaqChunk {
  heading: string;
  body: string;
}

const TOKENIZE = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9ঀ-৿\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

@Injectable()
export class KbFaqLoader implements OnModuleInit {
  chunks: FaqChunk[] = [];
  private tokenized: string[][] = [];

  onModuleInit(): void {
    const raw = readFileSync(join(__dirname, 'faq.md'), 'utf8');
    this.chunks = this.parse(raw);
    this.tokenized = this.chunks.map((c) => TOKENIZE(`${c.heading} ${c.body}`));
  }

  private parse(raw: string): FaqChunk[] {
    const out: FaqChunk[] = [];
    // Handle LF and CRLF — git auto-converts faq.md on Windows checkouts.
    const lines = raw.split(/\r?\n/);
    let heading: string | null = null;
    let buffer: string[] = [];
    const flush = (): void => {
      if (heading && buffer.length > 0) {
        out.push({ heading, body: buffer.join(' ').trim() });
      }
    };
    for (const line of lines) {
      const m = line.match(/^##\s+(.+)$/);
      if (m) {
        flush();
        heading = m[1].trim();
        buffer = [];
      } else if (heading) {
        const t = line.trim();
        if (t) buffer.push(t);
      }
    }
    flush();
    return out;
  }

  search(query: string, k = 3): FaqChunk[] {
    if (this.chunks.length === 0) return [];
    const docs = this.tokenized.map((tokens) => tokens.join(' '));
    const scores = BM25(docs, TOKENIZE(query)) as number[];
    const indexed = scores.map((score, i) => ({ score, i }));
    indexed.sort((a, b) => b.score - a.score);
    return indexed
      .slice(0, k)
      .filter((x) => x.score > 0)
      .map((x) => this.chunks[x.i]);
  }
}
