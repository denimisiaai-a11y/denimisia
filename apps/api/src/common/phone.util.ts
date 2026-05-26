/**
 * Phone utilities — BD-strict normalization and validation.
 *
 * normalizePhone: strips non-digit characters and optional leading "+880"
 *   country code. Returns the local-form digit string.
 *
 * isValidBdPhone: accepts 10-11 digit strings of pure digits. Caller is
 *   expected to have normalized first.
 *
 * normalizeAndValidate: convenience wrapper returning a discriminated
 *   union { ok: true, phone } | { ok: false, reason }.
 */

export function normalizePhone(input: string | null | undefined): string {
  if (!input) return '';
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('880') && digits.length > 11) {
    return '0' + digits.slice(3);
  }
  return digits;
}

export function isValidBdPhone(normalized: string): boolean {
  if (!/^\d+$/.test(normalized)) return false;
  const len = normalized.length;
  return len >= 10 && len <= 11;
}

export type NormalizeResult =
  | { ok: true; phone: string }
  | { ok: false; reason: 'invalid_length' | 'invalid_chars' };

export function normalizeAndValidate(input: string | null | undefined): NormalizeResult {
  const normalized = normalizePhone(input);
  if (!isValidBdPhone(normalized)) {
    return { ok: false, reason: 'invalid_length' };
  }
  return { ok: true, phone: normalized };
}

const PHONE_CAP = 20;

/**
 * Prepend `phone` to the front of `existing`, de-duplicating and capping
 * the array at PHONE_CAP entries. Returns a new array (immutable input).
 *
 * - If phone is empty/falsy, returns a shallow copy of existing unchanged.
 * - If phone is already at any position, moves it to position 0 (no growth).
 * - If new and array is full (length == PHONE_CAP), drops the oldest
 *   (last) entry.
 */
export function prependPhoneToArray(
  existing: readonly string[],
  phone: string,
): string[] {
  if (!phone) return [...existing];

  const dedupedTail = existing.filter((p) => p !== phone);
  const result = [phone, ...dedupedTail];
  if (result.length > PHONE_CAP) {
    return result.slice(0, PHONE_CAP);
  }
  return result;
}
