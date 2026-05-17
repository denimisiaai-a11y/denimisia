import { Test, TestingModule } from '@nestjs/testing';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

describe('UploadsController', () => {
  let controller: UploadsController;
  let uploadsService: Record<string, jest.Mock>;

  beforeEach(async () => {
    uploadsService = {
      getPresignedUrl: jest.fn(),
      deleteFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadsController],
      providers: [{ provide: UploadsService, useValue: uploadsService }],
    }).compile();

    controller = module.get(UploadsController);
  });

  it('should get presigned url', async () => {
    uploadsService.getPresignedUrl.mockResolvedValue({
      uploadUrl: 'url',
      key: 'k',
      publicUrl: 'pub',
    });
    const result = await controller.getPresignedUrl({
      folder: 'products',
      contentType: 'image/jpeg',
      expectedSize: 1024,
    } as any);
    expect(uploadsService.getPresignedUrl).toHaveBeenCalledWith(
      'products',
      'image/jpeg',
      1024,
    );
  });

  it('should delete file', async () => {
    uploadsService.deleteFile.mockResolvedValue(undefined);
    await controller.deleteFile({ key: 'products/img.jpg' } as any);
    expect(uploadsService.deleteFile).toHaveBeenCalledWith('products/img.jpg');
  });
});
