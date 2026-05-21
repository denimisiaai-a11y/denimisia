import { ReturnStatus } from '@prisma/client';
import {
  canTransition,
  defaultFault,
  requiresPhotos,
  ALLOWED_TRANSITIONS,
} from './returns.state-machine';

describe('returns state machine', () => {
  describe('canTransition', () => {
    it('allows REQUESTED -> UNDER_REVIEW', () => {
      expect(canTransition('REQUESTED', 'UNDER_REVIEW')).toBe(true);
    });

    it('allows REQUESTED -> CANCELLED', () => {
      expect(canTransition('REQUESTED', 'CANCELLED')).toBe(true);
    });

    it('rejects REQUESTED -> REFUNDED (cannot skip review)', () => {
      expect(canTransition('REQUESTED', 'REFUNDED')).toBe(false);
    });

    it('allows UNDER_REVIEW -> APPROVED', () => {
      expect(canTransition('UNDER_REVIEW', 'APPROVED')).toBe(true);
    });

    it('allows UNDER_REVIEW -> REJECTED', () => {
      expect(canTransition('UNDER_REVIEW', 'REJECTED')).toBe(true);
    });

    it('allows APPROVED -> RECEIVED (direct, skipping IN_TRANSIT)', () => {
      expect(canTransition('APPROVED', 'RECEIVED')).toBe(true);
    });

    it('allows APPROVED -> IN_TRANSIT', () => {
      expect(canTransition('APPROVED', 'IN_TRANSIT')).toBe(true);
    });

    it('rejects APPROVED -> REJECTED (already approved)', () => {
      expect(canTransition('APPROVED', 'REJECTED')).toBe(false);
    });

    it('allows INSPECTING -> INSPECTED_PASS', () => {
      expect(canTransition('INSPECTING', 'INSPECTED_PASS')).toBe(true);
    });

    it('allows INSPECTING -> INSPECTED_FAIL', () => {
      expect(canTransition('INSPECTING', 'INSPECTED_FAIL')).toBe(true);
    });

    it('allows INSPECTED_FAIL -> REFUNDED (admin override)', () => {
      expect(canTransition('INSPECTED_FAIL', 'REFUNDED')).toBe(true);
    });

    it('allows INSPECTED_FAIL -> RETURNED_TO_CUSTOMER', () => {
      expect(canTransition('INSPECTED_FAIL', 'RETURNED_TO_CUSTOMER')).toBe(
        true,
      );
    });

    it('allows REFUNDED -> CLOSED', () => {
      expect(canTransition('REFUNDED', 'CLOSED')).toBe(true);
    });

    it('treats CLOSED as terminal', () => {
      expect(canTransition('CLOSED', 'REFUNDED')).toBe(false);
      expect(canTransition('CLOSED', 'REQUESTED')).toBe(false);
    });

    it('treats REJECTED as moving to CLOSED only', () => {
      expect(canTransition('REJECTED', 'CLOSED')).toBe(true);
      expect(canTransition('REJECTED', 'APPROVED')).toBe(false);
    });

    it('returns false for any undefined source status', () => {
      expect(
        canTransition('INVALID_STATUS' as unknown as ReturnStatus, 'REFUNDED'),
      ).toBe(false);
    });
  });

  describe('defaultFault', () => {
    it.each([
      ['DEFECTIVE', 'US'],
      ['DAMAGED_IN_TRANSIT', 'US'],
      ['NOT_AS_DESCRIBED', 'US'],
      ['WRONG_ITEM_SENT', 'US'],
      ['WRONG_SIZE', 'CUSTOMER'],
      ['CHANGED_MIND', 'CUSTOMER'],
    ] as const)('maps %s to %s fault', (reason, fault) => {
      expect(defaultFault(reason)).toBe(fault);
    });
  });

  describe('requiresPhotos', () => {
    it.each([
      ['DEFECTIVE', true],
      ['DAMAGED_IN_TRANSIT', true],
      ['WRONG_ITEM_SENT', true],
      ['NOT_AS_DESCRIBED', true],
      ['WRONG_SIZE', false],
      ['CHANGED_MIND', false],
    ] as const)('returns %s for %s', (reason, expected) => {
      expect(requiresPhotos(reason)).toBe(expected);
    });
  });

  describe('ALLOWED_TRANSITIONS coverage', () => {
    it('covers all ReturnStatus enum values as keys', () => {
      const keys = Object.keys(ALLOWED_TRANSITIONS);
      expect(keys).toContain('REQUESTED');
      expect(keys).toContain('UNDER_REVIEW');
      expect(keys).toContain('APPROVED');
      expect(keys).toContain('REJECTED');
      expect(keys).toContain('IN_TRANSIT');
      expect(keys).toContain('RECEIVED');
      expect(keys).toContain('INSPECTING');
      expect(keys).toContain('INSPECTED_PASS');
      expect(keys).toContain('INSPECTED_FAIL');
      expect(keys).toContain('RETURNED_TO_CUSTOMER');
      expect(keys).toContain('REFUNDED');
      expect(keys).toContain('CLOSED');
      expect(keys).toContain('CANCELLED');
      expect(keys.length).toBe(13);
    });
  });
});
