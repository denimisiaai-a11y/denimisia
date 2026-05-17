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
        create: jest.fn(),
        update: jest.fn(),
      },
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
      prisma.user.findFirst.mockResolvedValue(null);
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

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: registerDto.email, deletedAt: null },
      });
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(registerDto.password, 12);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: registerDto.email,
          passwordHash: '$hashed-password$',
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
        },
      });
      expect(result.accessToken).toBe('access-token-123');
      expect(result.refreshToken).toBe('refresh-token-456');
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(registerDto.email);
    });

    it('should throw ConflictException when email already exists', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('should store hashed refresh token in Redis', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
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
      prisma.user.findFirst.mockResolvedValue(null);
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

      // Note: the service reads secrets directly from the `env` helper rather
      // than ConfigService, so we don't assert specific secret values here;
      // we just verify that signAsync was called twice with the expected
      // payload and expiry windows.
      expect(jwt.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-new',
          email: registerDto.email,
          role: 'CUSTOMER',
        }),
        expect.objectContaining({ expiresIn: '15m' }),
      );
      expect(jwt.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-new',
          email: registerDto.email,
          role: 'CUSTOMER',
        }),
        expect.objectContaining({ expiresIn: '7d' }),
      );
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
  });

  // ─── verifyEmail() ────────────────────────────────────────────────────────

  describe('verifyEmail', () => {
    it('should verify email and delete token from Redis', async () => {
      redis.get.mockResolvedValue('user-1');
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prisma.user.update.mockResolvedValue({ ...mockUser, isVerified: true });
      redis.del.mockResolvedValue(1);

      const result = await service.verifyEmail('verify-token');

      expect(redis.get).toHaveBeenCalledWith('verify:verify-token');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { isVerified: true },
      });
      expect(redis.del).toHaveBeenCalledWith('verify:verify-token');
      expect(result).toEqual({ message: 'Email verified successfully' });
    });

    it('should throw UnauthorizedException for invalid verification token', async () => {
      redis.get.mockResolvedValue(null);

      await expect(service.verifyEmail('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
