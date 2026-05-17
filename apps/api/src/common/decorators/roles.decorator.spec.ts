import { Role, ROLE_WEIGHTS, hasRole, roleWeight } from './roles.decorator';

describe('roles.decorator', () => {
  describe('ROLE_WEIGHTS', () => {
    it('defines the locked-in weight ladder', () => {
      expect(ROLE_WEIGHTS).toEqual({
        CUSTOMER: 0,
        SUPPORT_STAFF: 10,
        MANAGER: 20,
        ADMIN: 30,
        SUPER_ADMIN: 40,
      });
    });

    it('is frozen so callers cannot mutate the ladder at runtime', () => {
      expect(Object.isFrozen(ROLE_WEIGHTS)).toBe(true);
    });
  });

  describe('roleWeight', () => {
    it('returns the numeric weight for each enum role', () => {
      expect(roleWeight(Role.CUSTOMER)).toBe(0);
      expect(roleWeight(Role.SUPPORT_STAFF)).toBe(10);
      expect(roleWeight(Role.MANAGER)).toBe(20);
      expect(roleWeight(Role.ADMIN)).toBe(30);
      expect(roleWeight(Role.SUPER_ADMIN)).toBe(40);
    });

    it('returns -Infinity for unknown, undefined, null', () => {
      expect(roleWeight(undefined)).toBe(Number.NEGATIVE_INFINITY);
      expect(roleWeight(null)).toBe(Number.NEGATIVE_INFINITY);
      expect(roleWeight('GHOST')).toBe(Number.NEGATIVE_INFINITY);
      expect(roleWeight('')).toBe(Number.NEGATIVE_INFINITY);
    });
  });

  describe('hasRole', () => {
    it('passes when actor weight >= required weight', () => {
      expect(hasRole(Role.ADMIN, Role.MANAGER)).toBe(true);
      expect(hasRole(Role.SUPER_ADMIN, Role.SUPPORT_STAFF)).toBe(true);
      expect(hasRole(Role.MANAGER, Role.MANAGER)).toBe(true);
    });

    it('denies when actor weight < required weight', () => {
      expect(hasRole(Role.SUPPORT_STAFF, Role.MANAGER)).toBe(false);
      expect(hasRole(Role.CUSTOMER, Role.ADMIN)).toBe(false);
      expect(hasRole(Role.MANAGER, Role.SUPER_ADMIN)).toBe(false);
    });

    it('denies unknown, undefined, null actors', () => {
      expect(hasRole(undefined, Role.SUPPORT_STAFF)).toBe(false);
      expect(hasRole(null, Role.SUPPORT_STAFF)).toBe(false);
      expect(hasRole('GHOST', Role.SUPPORT_STAFF)).toBe(false);
    });

    it('accepts a raw string actor that matches a known role', () => {
      expect(hasRole('ADMIN', Role.MANAGER)).toBe(true);
      expect(hasRole('SUPPORT_STAFF', Role.MANAGER)).toBe(false);
    });
  });
});
