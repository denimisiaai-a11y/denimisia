import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.decorator';
import { AuditLogService } from '../audit-log/audit-log.service';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

jest.mock('bcrypt');

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  let prisma: Record<string, Record<string, jest.Mock>>;
  let jwt: { signAsync: jest.Mock };
  let config: { get: jest.Mock };
  let redis: { get: jest.Mock; del: jest.Mock; setex: jest.Mock };
  let email: { send: jest.Mock };

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: '$2b$12$hashedpassword',
    firstName: 'John',
    lastName: 'Doe',
    role: 'CUSTOMER',
    isVerified: false,
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      order: {
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    jwt = {
      signAsync: jest.fn(),
    };

    config = {
      get: jest.fn((key: string, defaultVal?: string) => {
        const values: Record<string, string> = {
          JWT_ACCESS_SECRET: 'access-secret',
          JWT_REFRESH_SECRET: 'refresh-secret',
          JWT_ACCESS_EXPIRY: '15m',
          JWT_REFRESH_EXPIRY: '7d',
        };
        return values[key] ?? defaultVal;
      }),
    };

    redis = {
      get: jest.fn(),
      del: jest.fn(),
      setex: jest.fn(),
    };

    email = {
      send: jest.fn().mockResolvedValue({ id: 'mock-email-id' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
        { provide: REDIS_CLIENT, useValue: redis },
        {
          provide: AuditLogService,
          useValue: { log: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: EmailService, useValue: email },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── register() ────────────────────────────────────────────────────────────

  describe('register', () => {
    const registerDto = {
      email: 'new@example.com',
      password: 'password123',
      firstName: 'Jane',
      lastName: 'Doe',
    };

    it('should create user with hashed password and return tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (mockedBcrypt.hash as jest.Mock)
        .mockResolvedValueOnce('$hashed-password$') // password hash
        .mockResolvedValueOnce('$hashed-refresh$'); // refresh token hash for storage
      prisma.user.create.mockResolvedValue({
        id: 'user-new',
        email: registerDto.email,
        role: 'CUSTOMER',
        firstName: 'Jane',
        lastName: 'Doe',
      });
      jwt.signAsync
        .mockResolvedValueOnce('access-token-123')
        .mockResolvedValueOnce('refresh-token-456');
      redis.setex.mockResolvedValue('OK');

      const result = await service.register(registerDto);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(registerDto.password, 12);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: registerDto.email,
          passwordHash: '$hashed-password$',
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
          phones: [],
          // Hotfix ca2a579: fresh register must mark the account claimed
          // at creation, otherwise a subsequent register with the same
          // email re-claims and overwrites the user (account-takeover).
          claimedAt: expect.any(Date),
        },
      });
      expect(result.accessToken).toBe('access-token-123');
      expect(result.refreshToken).toBe('refresh-token-456');
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(registerDto.email);
    });

    it('should throw ConflictException when email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        deletedAt: null,
        claimedAt: new Date(),
        phones: [],
      });

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('should store hashed refresh token in Redis', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (mockedBcrypt.hash as jest.Mock)
        .mockResolvedValueOnce('$hashed-password$')
        .mockResolvedValueOnce('$hashed-refresh-token$');
      prisma.user.create.mockResolvedValue({
        id: 'user-new',
        email: registerDto.email,
        role: 'CUSTOMER',
      });
      jwt.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      redis.setex.mockResolvedValue('OK');

      await service.register(registerDto);

      expect(redis.setex).toHaveBeenCalledWith(
        'refresh:user-new',
        7 * 24 * 60 * 60,
        '$hashed-refresh-token$',
      );
    });

    it('should generate both access and refresh tokens with correct secrets', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (mockedBcrypt.hash as jest.Mock).mockResolvedValue('$hashed$');
      prisma.user.create.mockResolvedValue({
        id: 'user-new',
        email: registerDto.email,
        role: 'CUSTOMER',
      });
      jwt.signAsync
        .mockResolvedValueOnce('access')
        .mockResolvedValueOnce('refresh');
      redis.setex.mockResolvedValue('OK');

      await service.register(registerDto);

      // The service reads expiry windows + secrets from the `env` helper, so we
      // assert the structural shape (algorithm + issuer + audience + presence of
      // each option) rather than specific values that swing with env. We also
      // assert the two calls used DIFFERENT secrets — same-secret-for-access-
      // and-refresh would be a security regression (refresh tokens have a much
      // longer life and must not validate as access tokens).
      expect(jwt.signAsync).toHaveBeenCalledTimes(2);

      const expectedPayload = expect.objectContaining({
        sub: 'user-new',
        email: registerDto.email,
        role: 'CUSTOMER',
      });
      const expectedOptionsShape = expect.objectContaining({
        algorithm: 'HS256',
        issuer: 'denimisia-api',
        audience: 'denimisia-clients',
        expiresIn: expect.anything(),
        secret: expect.any(String),
      });

      expect(jwt.signAsync).toHaveBeenNthCalledWith(
        1,
        expectedPayload,
        expectedOptionsShape,
      );
      expect(jwt.signAsync).toHaveBeenNthCalledWith(
        2,
        expectedPayload,
        expectedOptionsShape,
      );

      const firstCallSecret = jwt.signAsync.mock.calls[0][1].secret;
      const secondCallSecret = jwt.signAsync.mock.calls[1][1].secret;
      expect(firstCallSecret).toBeTruthy();
      expect(secondCallSecret).toBeTruthy();
      expect(firstCallSecret).not.toBe(secondCallSecret);
    });

    it('auto-claims an existing shadow account on register with matching email', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'shadow-1',
        email: 'shadow@example.com',
        passwordHash: null,
        claimedAt: null,
        firstName: 'Imported',
        lastName: '',
        phones: ['01700000000'],
        deletedAt: null,
        tokenVersion: 0,
        isActive: true,
        isVerified: false,
        role: 'CUSTOMER',
      });
      prisma.user.update.mockResolvedValue({
        id: 'shadow-1',
        email: 'shadow@example.com',
        firstName: 'Real',
        lastName: 'User',
        phones: ['01776902711', '01700000000'],
        claimedAt: new Date(),
        tokenVersion: 1,
        role: 'CUSTOMER',
        isVerified: false,
      });

      const result = await service.register({
        email: 'shadow@example.com',
        password: 'Secret123!',
        firstName: 'Real',
        lastName: 'User',
        phone: '01776902711',
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'shadow-1' },
          data: expect.objectContaining({
            passwordHash: expect.any(String),
            claimedAt: expect.any(Date),
            firstName: 'Real',
            lastName: 'User',
            phones: ['01776902711', '01700000000'],
            tokenVersion: { increment: 1 },
          }),
        }),
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('returns 409 when register email matches a CLAIMED user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'claimed-1',
        email: 'claimed@example.com',
        passwordHash: 'existing-hash',
        claimedAt: new Date(),
        deletedAt: null,
        phones: [],
      });

      await expect(
        service.register({
          email: 'claimed@example.com',
          password: 'X',
          firstName: 'Y',
          lastName: 'Z',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── login() ───────────────────────────────────────────────────────────────

  describe('login', () => {
    const loginDto = { email: 'test@example.com', password: 'password123' };

    it('should validate credentials and return tokens', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);
      (mockedBcrypt.hash as jest.Mock).mockResolvedValue('$hashed-refresh$');
      jwt.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      redis.setex.mockResolvedValue('OK');

      const result = await service.login(loginDto);

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: loginDto.email, deletedAt: null },
      });
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.passwordHash,
      );
      expect(result).toEqual(
        expect.objectContaining({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          user: expect.objectContaining({
            id: mockUser.id,
            email: mockUser.email,
          }),
        }),
      );
    });

    it('should throw UnauthorizedException when user not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when password does not match', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should store refresh token in Redis after successful login', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);
      (mockedBcrypt.hash as jest.Mock).mockResolvedValue('$hashed-refresh$');
      jwt.signAsync
        .mockResolvedValueOnce('access')
        .mockResolvedValueOnce('refresh');
      redis.setex.mockResolvedValue('OK');

      await service.login(loginDto);

      expect(redis.setex).toHaveBeenCalledWith(
        `refresh:${mockUser.id}`,
        7 * 24 * 60 * 60,
        '$hashed-refresh$',
      );
    });

    it('returns a shadow-specific message when user.passwordHash is null', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'shadow-1',
        email: 'shadow@example.com',
        passwordHash: null,
        isActive: true,
        deletedAt: null,
        isVerified: true,
        firstName: 'Shadow',
        lastName: 'User',
        role: 'CUSTOMER',
        tokenVersion: 0,
      });

      await expect(
        service.login({ email: 'shadow@example.com', password: 'anything' }),
      ).rejects.toThrow(
        /not been set up yet|please sign up/i,
      );
    });
  });

  // ─── logout() ──────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('should delete refresh token from Redis', async () => {
      redis.del.mockResolvedValue(1);

      await service.logout('user-1');

      expect(redis.del).toHaveBeenCalledWith('refresh:user-1');
    });
  });

  // ─── refreshTokens() ──────────────────────────────────────────────────────

  describe('refreshTokens', () => {
    it('should validate refresh token and issue new pair', async () => {
      redis.get.mockResolvedValue('$stored-hash$');
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        role: 'CUSTOMER',
      });
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);
      (mockedBcrypt.hash as jest.Mock).mockResolvedValue('$new-hash$');
      jwt.signAsync
        .mockResolvedValueOnce('new-access')
        .mockResolvedValueOnce('new-refresh');
      redis.setex.mockResolvedValue('OK');

      const result = await service.refreshTokens(
        'user-1',
        'test@example.com',
        'CUSTOMER',
        'old-refresh-token',
      );

      expect(redis.get).toHaveBeenCalledWith('refresh:user-1');
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        'old-refresh-token',
        '$stored-hash$',
      );
      expect(result).toEqual({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      });
    });

    it('should throw UnauthorizedException when no stored token (session expired)', async () => {
      redis.get.mockResolvedValue(null);

      await expect(
        service.refreshTokens('user-1', 'email', 'CUSTOMER', 'token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when token does not match', async () => {
      redis.get.mockResolvedValue('$stored-hash$');
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.refreshTokens('user-1', 'email', 'CUSTOMER', 'bad-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should store the new refresh token hash in Redis', async () => {
      redis.get.mockResolvedValue('$stored-hash$');
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'email',
        role: 'CUSTOMER',
      });
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);
      (mockedBcrypt.hash as jest.Mock).mockResolvedValue('$rotated-hash$');
      jwt.signAsync.mockResolvedValueOnce('a').mockResolvedValueOnce('r');
      redis.setex.mockResolvedValue('OK');

      await service.refreshTokens('user-1', 'email', 'CUSTOMER', 'token');

      expect(redis.setex).toHaveBeenCalledWith(
        'refresh:user-1',
        7 * 24 * 60 * 60,
        '$rotated-hash$',
      );
    });
  });

  // ─── forgotPassword() ─────────────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('should generate reset token and store in Redis for existing user', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      redis.setex.mockResolvedValue('OK');
      const result = await service.forgotPassword('test@example.com');

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: 'test@example.com', deletedAt: null },
      });
      expect(redis.setex).toHaveBeenCalled();
      expect(result).toEqual({
        message: 'If an account exists, a reset link has been sent',
      });
    });

    it('should return same message for non-existent user to prevent enumeration', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      const result = await service.forgotPassword('unknown@example.com');

      expect(result).toEqual({
        message: 'If an account exists, a reset link has been sent',
      });
      expect(redis.setex).not.toHaveBeenCalled();
      expect(email.send).not.toHaveBeenCalled();
    });

    it('should send a reset-password message to the user with a token link', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      redis.setex.mockResolvedValue('OK');

      await service.forgotPassword('test@example.com');

      expect(email.send).toHaveBeenCalledTimes(1);
      const arg = email.send.mock.calls[0][0];
      expect(arg.to).toBe('test@example.com');
      expect(arg.subject).toMatch(/Reset/i);
      expect(arg.text).toContain('/reset-password?token=');
      expect(arg.html).toContain('/reset-password?token=');
    });

    it('should still return success when the email provider fails (no enumeration leak)', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      redis.setex.mockResolvedValue('OK');
      email.send.mockRejectedValueOnce(new Error('Resend down'));

      const result = await service.forgotPassword('test@example.com');

      expect(result).toEqual({
        message: 'If an account exists, a reset link has been sent',
      });
    });

    it('returns shadow-specific message and does NOT send email for unclaimed user', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'shadow-1',
        email: 'shadow@example.com',
        passwordHash: null,
        firstName: 'Shadow',
        deletedAt: null,
      });
      email.send.mockClear();

      const result = await service.forgotPassword('shadow@example.com');

      expect(result.message).toMatch(/sign up|not fully registered/i);
      expect(email.send).not.toHaveBeenCalled();
    });
  });

  // ─── resetPassword() ──────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('should validate token, update password, and clean up Redis keys', async () => {
      redis.get.mockResolvedValue('user-1');
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      (mockedBcrypt.hash as jest.Mock).mockResolvedValue('$new-hash$');
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        passwordHash: '$new-hash$',
      });
      redis.del.mockResolvedValue(1);

      const result = await service.resetPassword(
        'valid-token',
        'newpassword123',
      );

      expect(redis.get).toHaveBeenCalledWith('reset:valid-token');
      expect(mockedBcrypt.hash).toHaveBeenCalledWith('newpassword123', 12);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { passwordHash: '$new-hash$' },
      });
      // Should delete both the reset token and the refresh token (force re-login)
      expect(redis.del).toHaveBeenCalledWith('reset:valid-token');
      expect(redis.del).toHaveBeenCalledWith('refresh:user-1');
      expect(result).toEqual({
        message: 'Password has been reset successfully',
      });
    });

    it('should throw UnauthorizedException for invalid/expired reset token', async () => {
      redis.get.mockResolvedValue(null);

      await expect(
        service.resetPassword('bad-token', 'newpassword'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── requestEmailVerification() ───────────────────────────────────────────

  describe('requestEmailVerification', () => {
    it('should generate verification token and store in Redis', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      redis.setex.mockResolvedValue('OK');

      const result = await service.requestEmailVerification('user-1');

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'user-1', deletedAt: null },
      });
      expect(redis.setex).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Verification email sent' });
    });

    it('should throw NotFoundException when user not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.requestEmailVerification('non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should send a verify-email message to the user with a token link', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      redis.setex.mockResolvedValue('OK');

      await service.requestEmailVerification('user-1');

      expect(email.send).toHaveBeenCalledTimes(1);
      const arg = email.send.mock.calls[0][0];
      expect(arg.to).toBe('test@example.com');
      expect(arg.subject).toMatch(/Verify/i);
      expect(arg.text).toContain('/verify-email?token=');
      expect(arg.html).toContain('/verify-email?token=');
    });

    it('should still return success when the email provider fails', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      redis.setex.mockResolvedValue('OK');
      email.send.mockRejectedValueOnce(new Error('Resend down'));

      const result = await service.requestEmailVerification('user-1');

      expect(result).toEqual({ message: 'Verification email sent' });
    });
  });

  // ─── verifyEmail() ────────────────────────────────────────────────────────

  describe('verifyEmail', () => {
    // Helper mirrors the inline transaction shape used in service.verifyEmail.
    // The tx object exposes the same user/order surface the production path
    // touches; the $transaction mock invokes the callback synchronously and
    // returns whatever the callback resolves with (the attached-orders count).
    const mockVerifyTx = (orderUpdateResult: { count: number }) => {
      const tx = {
        user: { update: jest.fn().mockResolvedValue({}) },
        order: { updateMany: jest.fn().mockResolvedValue(orderUpdateResult) },
      };
      (prisma as any).$transaction.mockImplementation(async (cb: Function) =>
        cb(tx),
      );
      return tx;
    };

    it('verifies the email and reports zero attached orders for a clean signup', async () => {
      redis.get.mockResolvedValue('user-1');
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'fresh@example.com',
      });
      const tx = mockVerifyTx({ count: 0 });
      redis.del.mockResolvedValue(1);

      const result = await service.verifyEmail('verify-token');

      expect(redis.get).toHaveBeenCalledWith('verify:verify-token');
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { isVerified: true },
      });
      expect(tx.order.updateMany).toHaveBeenCalledWith({
        where: {
          guestEmail: 'fresh@example.com',
          userId: null,
          deletedAt: null,
        },
        data: {
          userId: 'user-1',
          guestEmail: null,
          guestName: null,
          guestPhone: null,
        },
      });
      expect(redis.del).toHaveBeenCalledWith('verify:verify-token');
      expect(result).toEqual({
        message: 'Email verified successfully',
        attachedOrders: 0,
      });
    });

    it('attaches prior guest-checkout orders to the verified account (LR-001 C2)', async () => {
      redis.get.mockResolvedValue('user-1');
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'returning@example.com',
      });
      const tx = mockVerifyTx({ count: 3 });
      redis.del.mockResolvedValue(1);

      const result = await service.verifyEmail('verify-token');

      // 3 prior guest orders for returning@example.com were attached.
      expect(tx.order.updateMany).toHaveBeenCalledWith({
        where: {
          guestEmail: 'returning@example.com',
          userId: null,
          deletedAt: null,
        },
        data: expect.objectContaining({
          userId: 'user-1',
          guestEmail: null,
          guestName: null,
          guestPhone: null,
        }),
      });
      expect(result.attachedOrders).toBe(3);
    });

    it('user.update + order.updateMany run in the same transaction', async () => {
      // Security-critical: if the update succeeded but the attach failed
      // (or vice-versa) the system would either grant orders without proof
      // of email or leave verified users without their pre-signup history.
      redis.get.mockResolvedValue('user-1');
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'tx@example.com',
      });
      mockVerifyTx({ count: 1 });
      redis.del.mockResolvedValue(1);

      await service.verifyEmail('verify-token');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      // user.update must NOT have been called outside the transaction.
      expect(prisma.user.update).not.toHaveBeenCalled();
      // order.updateMany must NOT have been called outside the transaction.
      expect(prisma.order.updateMany).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for invalid verification token', async () => {
      redis.get.mockResolvedValue(null);

      await expect(service.verifyEmail('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
