import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: Record<string, jest.Mock>;

  const mockRes = () => {
    const res: any = {};
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res;
  };

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
      refreshTokens: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      requestEmailVerification: jest.fn(),
      verifyEmail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get(AuthController);
  });

  it('should register and set refresh cookie', async () => {
    authService.register.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' });
    const res = mockRes();

    const result = await controller.register({ email: 'a@b.com', password: '123', firstName: 'A', lastName: 'B' } as any, res);

    expect(authService.register).toHaveBeenCalled();
    expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'rt', expect.any(Object));
    expect(result).toEqual({ accessToken: 'at' });
  });

  it('should login and set refresh cookie', async () => {
    authService.login.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' });
    const res = mockRes();

    const result = await controller.login({ email: 'a@b.com', password: '123' } as any, res);

    expect(authService.login).toHaveBeenCalled();
    expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'rt', expect.any(Object));
    expect(result).toEqual({ accessToken: 'at' });
  });

  it('should logout and clear cookie', async () => {
    authService.logout.mockResolvedValue(undefined);
    const res = mockRes();

    const result = await controller.logout({ id: 'user-1' }, res);

    expect(authService.logout).toHaveBeenCalledWith('user-1');
    expect(res.clearCookie).toHaveBeenCalledWith('refresh_token');
    expect(result).toEqual({ message: 'Logged out successfully' });
  });

  it('should refresh tokens', async () => {
    authService.refreshTokens.mockResolvedValue({ accessToken: 'at2', refreshToken: 'rt2' });
    const res = mockRes();

    const result = await controller.refresh({ id: 'user-1', email: 'a@b.com', role: 'CUSTOMER', refreshToken: 'rt' }, res);

    expect(authService.refreshTokens).toHaveBeenCalledWith('user-1', 'a@b.com', 'CUSTOMER', 'rt');
    expect(result).toEqual({ accessToken: 'at2' });
  });

  it('should forgotPassword', async () => {
    authService.forgotPassword.mockResolvedValue({ message: 'Check email' });
    const result = await controller.forgotPassword({ email: 'a@b.com' } as any);
    expect(authService.forgotPassword).toHaveBeenCalledWith('a@b.com');
    expect(result).toEqual({ message: 'Check email' });
  });

  it('should resetPassword', async () => {
    authService.resetPassword.mockResolvedValue({ message: 'Password reset' });
    const result = await controller.resetPassword({ token: 't', newPassword: 'p' } as any);
    expect(authService.resetPassword).toHaveBeenCalledWith('t', 'p');
  });

  it('should requestVerification', async () => {
    authService.requestEmailVerification.mockResolvedValue({ message: 'Sent' });
    const result = await controller.requestVerification({ id: 'user-1' });
    expect(authService.requestEmailVerification).toHaveBeenCalledWith('user-1');
  });

  it('should verifyEmail', async () => {
    authService.verifyEmail.mockResolvedValue({ message: 'Verified' });
    const result = await controller.verifyEmail({ token: 't' } as any);
    expect(authService.verifyEmail).toHaveBeenCalledWith('t');
  });
});
