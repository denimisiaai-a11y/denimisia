import { Injectable } from '@nestjs/common';

export interface FilterResult {
  filtered: string;
  hadStripping: boolean;
  patternCount: number;
}

const PATTERNS: RegExp[] = [
  /\+?880\d{10}/g,
  /\b01[3-9]\d{8}\b/g,
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
];

@Injectable()
export class OutputFilter {
  scrub(input: string): FilterResult {
    let count = 0;
    let out = input;
    for (const re of PATTERNS) {
      const matches = out.match(re);
      if (matches) count += matches.length;
      out = out.replace(re, '[redacted]');
    }
    return { filtered: out, hadStripping: count > 0, patternCount: count };
  }
}
