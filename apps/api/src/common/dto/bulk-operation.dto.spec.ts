import { BulkBaseSchema } from './bulk-operation.dto';

describe('BulkBaseSchema', () => {
  it('accepts a minimal valid payload and defaults versionMap to {}', () => {
    const parsed = BulkBaseSchema.parse({
      ids: ['p_1'],
      idempotencyKey: 'idem-abc-12345',
    });
    expect(parsed.versionMap).toEqual({});
    expect(parsed.reason).toBeUndefined();
  });

  it('preserves a supplied versionMap', () => {
    const parsed = BulkBaseSchema.parse({
      ids: ['p_1', 'p_2'],
      idempotencyKey: 'idem-xyz-67890',
      versionMap: { p_1: '2026-05-16T10:00:00.000Z' },
    });
    expect(parsed.versionMap).toEqual({ p_1: '2026-05-16T10:00:00.000Z' });
  });

  it('rejects empty ids array', () => {
    expect(() =>
      BulkBaseSchema.parse({ ids: [], idempotencyKey: 'idem-abc-12345' }),
    ).toThrow();
  });

  it('rejects an empty id string', () => {
    expect(() =>
      BulkBaseSchema.parse({ ids: [''], idempotencyKey: 'idem-abc-12345' }),
    ).toThrow();
  });

  it('rejects a too-short idempotency key', () => {
    expect(() =>
      BulkBaseSchema.parse({ ids: ['p_1'], idempotencyKey: 'short' }),
    ).toThrow();
  });

  it('rejects an idempotency key longer than 128 chars', () => {
    expect(() =>
      BulkBaseSchema.parse({
        ids: ['p_1'],
        idempotencyKey: 'x'.repeat(129),
      }),
    ).toThrow();
  });

  it('rejects a reason longer than 500 chars', () => {
    expect(() =>
      BulkBaseSchema.parse({
        ids: ['p_1'],
        idempotencyKey: 'idem-abc-12345',
        reason: 'x'.repeat(501),
      }),
    ).toThrow();
  });

  it('supports extension for per-action payloads', () => {
    const Extended = BulkBaseSchema.extend({
      price: BulkBaseSchema.shape.idempotencyKey, // reuse a known shape
    });
    expect(() =>
      Extended.parse({
        ids: ['p_1'],
        idempotencyKey: 'idem-abc-12345',
        price: 'idem-abc-12345',
      }),
    ).not.toThrow();
  });
});
