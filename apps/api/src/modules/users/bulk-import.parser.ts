import { parse } from 'csv-parse';
import { normalizeAndValidate } from '../../common/phone.util';

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB
const REQUIRED_COLUMNS = ['email', 'firstName'] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ParsedRow {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export interface ParseError {
  row: number;
  reason: string;
}

export interface ParseDuplicate {
  row: number;
  email: string;
}

export interface ParseResult {
  rows: Map<string, ParsedRow>;
  errors: ParseError[];
  duplicates: ParseDuplicate[];
}

/**
 * Two-pass CSV ingestion:
 *  - Pass 1: parse entire file in memory, apply first-row-wins fill-blanks
 *    merging within the file, accumulate per-row errors.
 *  - Caller is responsible for the per-row DB insert (Pass 2).
 *
 * File-size hard cap: 20 MB. Rejects unparseable / missing-header files.
 */
export async function parseAndDedupeCsv(buffer: Buffer): Promise<ParseResult> {
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error(`File too large (max 20 MB, got ${buffer.length} bytes)`);
  }

  return new Promise((resolve, reject) => {
    const rows = new Map<string, ParsedRow>();
    const errors: ParseError[] = [];
    const duplicates: ParseDuplicate[] = [];
    let lineNum = 1; // header is row 1; data starts at row 2

    const parser = parse({
      columns: (header: string[]) => {
        if (header[0]?.charCodeAt(0) === 0xfeff) {
          header[0] = header[0].slice(1);
        }
        for (const required of REQUIRED_COLUMNS) {
          if (!header.includes(required)) {
            parser.destroy(new Error(`Missing required column: ${required}`));
            return header;
          }
        }
        return header;
      },
      skip_empty_lines: true,
      trim: true,
    });

    parser.on('data', (record: Record<string, string>) => {
      lineNum += 1;
      const email = (record.email ?? '').trim().toLowerCase();
      const firstName = (record.firstName ?? '').trim();
      const lastName = (record.lastName ?? '').trim();
      const rawPhone = (record.phone ?? '').trim();

      if (!email || !EMAIL_RE.test(email)) {
        errors.push({ row: lineNum, reason: `Invalid email: "${email}"` });
        return;
      }
      if (!firstName) {
        errors.push({ row: lineNum, reason: 'Missing firstName' });
        return;
      }

      let phone = '';
      if (rawPhone) {
        const phoneResult = normalizeAndValidate(rawPhone);
        if (!phoneResult.ok) {
          errors.push({
            row: lineNum,
            reason: `Invalid phone: "${rawPhone}" (must be 10-11 digit BD number)`,
          });
          return;
        }
        phone = phoneResult.phone;
      }

      const existing = rows.get(email);
      if (existing) {
        duplicates.push({ row: lineNum, email });
        if (!existing.firstName && firstName) existing.firstName = firstName;
        if (!existing.lastName && lastName) existing.lastName = lastName;
        if (!existing.phone && phone) existing.phone = phone;
        return;
      }

      rows.set(email, { email, firstName, lastName, phone });
    });

    parser.on('error', (err) => reject(err));
    parser.on('end', () => resolve({ rows, errors, duplicates }));

    parser.write(buffer);
    parser.end();
  });
}
