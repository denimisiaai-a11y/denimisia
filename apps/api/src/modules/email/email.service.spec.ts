import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

const mockSend = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

interface MockConfig {
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
  RESEND_FROM_NAME: string;
}

const buildConfigService = (
  overrides: Partial<MockConfig> = {},
): ConfigService => {
  const values: MockConfig = {
    RESEND_API_KEY: 'test-key',
    RESEND_FROM_EMAIL: 'noreply@test.example',
    RESEND_FROM_NAME: 'Denimisia Test',
    ...overrides,
  };
  return {
    getOrThrow: (key: keyof MockConfig): string => {
      if (!(key in values)) {
        throw new Error(`Missing config: ${String(key)}`);
      }
      return values[key];
    },
  } as unknown as ConfigService;
};

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    mockSend.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true })],
      providers: [
        EmailService,
        { provide: ConfigService, useValue: buildConfigService() },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('sends a plain-text email through the Resend SDK', async () => {
    mockSend.mockResolvedValueOnce({ data: { id: 'msg_123' }, error: null });

    const result = await service.send({
      to: 'customer@example.com',
      subject: 'Test',
      text: 'Hello',
    });

    expect(mockSend).toHaveBeenCalledWith({
      from: 'Denimisia Test <noreply@test.example>',
      to: 'customer@example.com',
      subject: 'Test',
      text: 'Hello',
    });
    expect(result.id).toBe('msg_123');
  });

  it('includes html when provided', async () => {
    mockSend.mockResolvedValueOnce({ data: { id: 'msg_html' }, error: null });

    await service.send({
      to: 'a@b.example',
      subject: 's',
      text: 't',
      html: '<p>hi</p>',
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ html: '<p>hi</p>', text: 't' }),
    );
  });

  it('throws when Resend returns an error envelope', async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { name: 'rate_limited', message: 'rate_limited' },
    });

    await expect(
      service.send({ to: 'x@example.com', subject: 's', text: 't' }),
    ).rejects.toThrow(/rate_limited/);
  });

  it('throws when Resend resolves without data or error', async () => {
    mockSend.mockResolvedValueOnce({ data: null, error: null });

    await expect(
      service.send({ to: 'x@example.com', subject: 's', text: 't' }),
    ).rejects.toThrow(/Resend send failed/);
  });
});
