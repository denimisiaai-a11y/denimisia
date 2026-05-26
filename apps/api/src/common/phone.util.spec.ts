import { normalizePhone, isValidBdPhone, normalizeAndValidate } from './phone.util';

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
