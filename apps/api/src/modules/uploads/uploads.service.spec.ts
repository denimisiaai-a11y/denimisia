import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadsService } from './uploads.service';

const mockSend = jest.fn();
const mockGetSignedUrl = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  PutObjectCommand: jest.fn().mockImplementation((input) => input),
  DeleteObjectCommand: jest.fn().mockImplementation((input) => input),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: any[]) => mockGetSignedUrl(...args),
}));

describe('UploadsService', () => {
  let service: UploadsService;

  const createModule = async (env: Record<string, string>) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadsService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => env[key] ?? null,
          },
        },
      ],
    }).compile();
    return module.get(UploadsService);
  };

  beforeEach(() => {
    mockSend.mockReset();
    mockGetSignedUrl.mockReset();
  });

  describe('with valid R2 credentials', () => {
    beforeEach(async () => {
      service = await createModule({
        R2_ACCOUNT_ID: 'account-id',
        R2_ACCESS_KEY_ID: 'access-key',
        R2_SECRET_ACCESS_KEY: 'secret-key',
        R2_BUCKET_NAME: 'my-bucket',
        R2_PUBLIC_URL: 'https://cdn.example.com',
      });
    });

    describe('getPresignedUrl', () => {
      it('should return upload url and public url for valid image', async () => {
        mockGetSignedUrl.mockResolvedValue('https://signed-url.example.com');

        const result = await service.getPresignedUrl(
          'products',
          'image/jpeg',
          1024,
        );

        expect(result).toHaveProperty(
          'uploadUrl',
          'https://signed-url.example.com',
        );
        expect(result).toHaveProperty('key');
        expect(result).toHaveProperty('publicUrl');
        expect(result.key).toMatch(/^products\/[\w-]+\.jpg$/);
        expect(result.publicUrl).toMatch(
          /^https:\/\/cdn\.example\.com\/products\/[\w-]+\.jpg$/,
        );
      });

      it('should throw BadRequestException for disallowed file type', async () => {
        await expect(
          service.getPresignedUrl('products', 'application/pdf', 1024),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException for oversized file', async () => {
        await expect(
          service.getPresignedUrl('products', 'image/png', 11 * 1024 * 1024),
        ).rejects.toThrow(BadRequestException);
      });

      it('should allow webp and gif types', async () => {
        mockGetSignedUrl.mockResolvedValue('https://signed-url.example.com');

        const webp = await service.getPresignedUrl(
          'products',
          'image/webp',
          1024,
        );
        expect(webp.key).toMatch(/\.webp$/);

        const gif = await service.getPresignedUrl(
          'products',
          'image/gif',
          1024,
        );
        expect(gif.key).toMatch(/\.gif$/);
      });
    });

    describe('deleteFile', () => {
      it('should delete file without error', async () => {
        mockSend.mockResolvedValue({});

        await expect(
          service.deleteFile('products/image.jpg'),
        ).resolves.toBeUndefined();
        expect(mockSend).toHaveBeenCalled();
      });
    });
  });

  // Note: the service requires R2_BUCKET_NAME at construction. Without it,
  // the constructor throws — by design, to fail fast at boot rather than
  // silently writing to a phantom bucket. The previous "without R2
  // credentials" describe block tested service-method failure modes that
  // no longer exist; replaced with a single test that asserts the boot-time
  // contract.
  describe('without R2_BUCKET_NAME', () => {
    it('refuses to construct', async () => {
      await expect(createModule({})).rejects.toThrow(
        'R2_BUCKET_NAME is required',
      );
    });
  });

  describe('with partial R2 credentials (bucket but no account/keys)', () => {
    beforeEach(async () => {
      service = await createModule({
        R2_BUCKET_NAME: 'my-bucket',
        R2_ACCOUNT_ID: 'account-id',
        R2_ACCESS_KEY_ID: 'access-key',
      });
    });

    it('should treat as unconfigured when secret is missing', async () => {
      await expect(
        service.getPresignedUrl('products', 'image/jpeg', 1024),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
