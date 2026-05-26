import { normalizePhone, isValidBdPhone, normalizeAndValidate, prependPhoneToArray } from './phone.util';

describe('normalizePhone', () => {
  it('strips spaces and dashes', () => {
    expect(normalizePhone('01776-902-711')).toBe('01776902711');
    expect(normalizePhone('01776 902 711')).toBe('01776902711');
  });

  it('strips leading +880 country code when present', () => {
    expect(normalizePhone('+880 1776 902711')).toBe('01776902711');
    expect(normalizePhone('+8801776902711')).toBe('01776902711');
  });

  it('preserves a leading 0', () => {
    expect(normalizePhone('01776902711')).toBe('01776902711');
  });

  it('returns empty string for null / undefined / empty input', () => {
    expect(normalizePhone('')).toBe('');
    expect(normalizePhone(null as unknown as string)).toBe('');
    expect(normalizePhone(undefined as unknown as string)).toBe('');
  });

  it('strips all non-digit characters', () => {
    expect(normalizePhone('abc01776x902y711')).toBe('01776902711');
  });
});

describe('isValidBdPhone', () => {
  it('accepts 10-digit phone', () => {
    expect(isValidBdPhone('1776902711')).toBe(true);
  });

  it('accepts 11-digit phone (with leading 0)', () => {
    expect(isValidBdPhone('01776902711')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isValidBdPhone('')).toBe(false);
  });

  it('rejects 9-digit phone (too short)', () => {
    expect(isValidBdPhone('177690271')).toBe(false);
  });

  it('rejects 12-digit phone (too long)', () => {
    expect(isValidBdPhone('017769027110')).toBe(false);
  });

  it('rejects phone with non-digit characters', () => {
    expect(isValidBdPhone('0177abc')).toBe(false);
  });
});

describe('normalizeAndValidate', () => {
  it('returns normalized phone when valid', () => {
    expect(normalizeAndValidate('+880 1776-902-711')).toEqual({
      ok: true,
      phone: '01776902711',
    });
  });

  it('returns error when invalid after normalize', () => {
    expect(normalizeAndValidate('abc')).toEqual({
      ok: false,
      reason: 'invalid_length',
    });
  });

  it('returns error for too-short phone', () => {
    expect(normalizeAndValidate('123')).toEqual({
      ok: false,
      reason: 'invalid_length',
    });
  });
});

describe('prependPhoneToArray', () => {
  it('prepends a new phone to empty array', () => {
    expect(prependPhoneToArray([], '01776902711')).toEqual(['01776902711']);
  });

  it('prepends new phone to front, keeps existing', () => {
    expect(prependPhoneToArray(['01700000000'], '01776902711'))
      .toEqual(['01776902711', '01700000000']);
  });

  it('moves duplicate to front without growing array', () => {
    expect(prependPhoneToArray(['01700000000', '01776902711'], '01776902711'))
      .toEqual(['01776902711', '01700000000']);
  });

  it('caps array at 20 entries when prepending new phone', () => {
    const twenty = Array.from({ length: 20 }, (_, i) => String(i).padStart(11, '0'));
    const result = prependPhoneToArray(twenty, '01776902711');
    expect(result.length).toBe(20);
    expect(result[0]).toBe('01776902711');
    // The 20th original phone (index 19) should have been dropped
    expect(result).not.toContain(twenty[19]);
  });

  it('does not grow when prepending a duplicate even at cap', () => {
    const twenty = Array.from({ length: 20 }, (_, i) => String(i).padStart(11, '0'));
    const result = prependPhoneToArray(twenty, twenty[10]);
    expect(result.length).toBe(20);
    expect(result[0]).toBe(twenty[10]);
  });

  it('returns existing array unchanged when input phone is empty', () => {
    const existing = ['01776902711'];
    expect(prependPhoneToArray(existing, '')).toEqual(existing);
  });
});
