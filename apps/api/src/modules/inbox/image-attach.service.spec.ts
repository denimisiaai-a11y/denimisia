import { ImageAttachService } from './image-attach.service';
import { R2StorageService } from '../media/r2-storage.service';

describe('ImageAttachService', () => {
  const r2Mock = {
    uploadPublic: jest.fn(),
  } as unknown as R2StorageService;

  beforeEach(() => {
    (r2Mock.uploadPublic as jest.Mock).mockReset();
  });

  it('rejects more than 4 images per message', async () => {
    const svc = new ImageAttachService(r2Mock);
    const five = Array.from({ length: 5 }, () => ({ buffer: Buffer.from('x'), mime: 'image/jpeg' }));
    await expect(svc.attachMany(five)).rejects.toThrow(/maximum 4/i);
  });

  it('rejects disallowed mime types', async () => {
    const svc = new ImageAttachService(r2Mock);
    await expect(
      svc.attachMany([{ buffer: Buffer.from('x'), mime: 'application/pdf' }]),
    ).rejects.toThrow(/mime/i);
  });

  it('rejects oversized inputs (over 5MB)', async () => {
    const svc = new ImageAttachService(r2Mock);
    const big = Buffer.alloc(6 * 1024 * 1024);
    await expect(svc.attachMany([{ buffer: big, mime: 'image/jpeg' }])).rejects.toThrow(/size/i);
  });
});
