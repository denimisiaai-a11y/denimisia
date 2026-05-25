import { Injectable } from '@nestjs/common';

export type Severity = 'low' | 'high';
export interface SanitizeResult {
  text: string;
  severity: Severity;
  reason?: string;
}

const ZERO_WIDTH = /[​-‍﻿⁠]/g;
const TAG_RANGE = /[\u{E0000}-\u{E007F}]/gu;
const MAX_LEN = 500;

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(previous|all|above)\s+instructions/i,
  /you\s+are\s+now\b/i,
  /^\s*system\s*:/im,
  /<\|im_start\|>/i,
  /<\|begin_of_text\|>/i,
  /<\|end_of_text\|>/i,
  /\bjailbreak\b/i,
];

@Injectable()
export class InputSanitizer {
  scrub(input: string): SanitizeResult {
    if (!input || input.trim().length === 0) {
      return { text: '', severity: 'high', reason: 'empty' };
    }

    let text = input.replace(ZERO_WIDTH, '').replace(TAG_RANGE, '');
    text = text.replace(/\s+/g, ' ').trim();
    if (text.length > MAX_LEN) text = text.slice(0, MAX_LEN);

    for (const re of INJECTION_PATTERNS) {
      if (re.test(text)) {
        return { text, severity: 'high', reason: `injection:${re.source}` };
      }
    }
    return { text, severity: 'low' };
  }
}
