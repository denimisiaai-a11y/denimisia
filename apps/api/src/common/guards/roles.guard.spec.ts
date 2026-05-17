import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Role } from '../decorators/roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  const mockExecutionContext = (user?: { role: string }): ExecutionContext =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('should allow access when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = mockExecutionContext({ role: 'CUSTOMER' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when user has the required role', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    const context = mockExecutionContext({ role: Role.ADMIN });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny access when user does not have the required role', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    const context = mockExecutionContext({ role: Role.CUSTOMER });

    expect(guard.canActivate(context)).toBe(false);
  });

  it('should deny access when user is undefined', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    const context = mockExecutionContext(undefined);

    expect(guard.canActivate(context)).toBe(false);
  });

  it('should allow access when user has one of multiple required roles', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN, Role.MANAGER]);
    const context = mockExecutionContext({ role: Role.MANAGER });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny access when user role does not match any required role', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN, Role.SUPER_ADMIN]);
    const context = mockExecutionContext({ role: Role.CUSTOMER });

    expect(guard.canActivate(context)).toBe(false);
  });
});
