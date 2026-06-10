import {
  isWithinWindow,
  checkItemEligibility,
  RETURN_WINDOW_DAYS,
} from './returns.eligibility';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('returns eligibility', () => {
  describe('isWithinWindow', () => {
    it('accepts delivery from 3 days ago', () => {
      const delivered = new Date(Date.now() - 3 * DAY_MS);
      expect(isWithinWindow(delivered)).toBe(true);
    });

    it('accepts delivery exactly at the window edge', () => {
      const now = new Date('2026-05-20T12:00:00Z');
      const delivered = new Date(now.getTime() - RETURN_WINDOW_DAYS * DAY_MS);
      expect(isWithinWindow(delivered, now)).toBe(true);
    });

    it('rejects delivery 8 days ago', () => {
      const delivered = new Date(Date.now() - 8 * DAY_MS);
      expect(isWithinWindow(delivered)).toBe(false);
    });

    it('rejects null delivery timestamp', () => {
      expect(isWithinWindow(null)).toBe(false);
    });

    it('rejects undefined delivery timestamp', () => {
      expect(isWithinWindow(undefined)).toBe(false);
    });

    it('rejects future delivery timestamp (clock skew)', () => {
      const future = new Date(Date.now() + DAY_MS);
      expect(isWithinWindow(future)).toBe(false);
    });
  });

  describe('checkItemEligibility', () => {
    const baseItem = {
      quantity: 2,
      product: { returnable: true },
    };

    it('returns null for valid request', () => {
      expect(
        checkItemEligibility({
          orderItem: baseItem,
          requestedQty: 1,
          alreadyReturnedQty: 0,
        }),
      ).toBe(null);
    });

    it('blocks non-returnable products', () => {
      expect(
        checkItemEligibility({
          orderItem: { ...baseItem, product: { returnable: false } },
          requestedQty: 1,
          alreadyReturnedQty: 0,
        }),
      ).toBe('PRODUCT_NOT_RETURNABLE');
    });

    it('blocks already-returned items', () => {
      expect(
        checkItemEligibility({
          orderItem: baseItem,
          requestedQty: 1,
          alreadyReturnedQty: 2,
        }),
      ).toBe('ITEM_ALREADY_RETURNED');
    });

    it('blocks over-quantity requests', () => {
      expect(
        checkItemEligibility({
          orderItem: baseItem,
          requestedQty: 3,
          alreadyReturnedQty: 0,
        }),
      ).toBe('QUANTITY_EXCEEDS_ORDERED');
    });

    it('blocks over-quantity with partial prior return', () => {
      expect(
        checkItemEligibility({
          orderItem: baseItem,
          requestedQty: 2,
          alreadyReturnedQty: 1,
        }),
      ).toBe('QUANTITY_EXCEEDS_ORDERED');
    });

    it('blocks zero quantity', () => {
      expect(
        checkItemEligibility({
          orderItem: baseItem,
          requestedQty: 0,
          alreadyReturnedQty: 0,
        }),
      ).toBe('INVALID_QUANTITY');
    });

    it('blocks negative quantity with INVALID_QUANTITY', () => {
      expect(
        checkItemEligibility({
          orderItem: baseItem,
          requestedQty: -1,
          alreadyReturnedQty: 0,
        }),
      ).toBe('INVALID_QUANTITY');
    });

    it('allows null product (manual return) when quantity OK', () => {
      expect(
        checkItemEligibility({
          orderItem: { quantity: 1, product: null },
          requestedQty: 1,
          alreadyReturnedQty: 0,
        }),
      ).toBe(null);
    });
  });
});
