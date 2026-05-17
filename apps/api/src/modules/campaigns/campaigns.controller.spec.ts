import { Test, TestingModule } from '@nestjs/testing';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';

describe('CampaignsController', () => {
  let controller: CampaignsController;
  let campaignsService: Record<string, jest.Mock>;

  beforeEach(async () => {
    campaignsService = {
      findActive: jest.fn(),
      findOnePublic: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      addProduct: jest.fn(),
      removeProduct: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CampaignsController],
      providers: [{ provide: CampaignsService, useValue: campaignsService }],
    }).compile();

    controller = module.get(CampaignsController);
  });

  it('should find active', async () => {
    campaignsService.findActive.mockResolvedValue({ data: { campaigns: [] } });
    const result = await controller.findActive('1', '20');
    expect(campaignsService.findActive).toHaveBeenCalledWith(1, 20);
  });

  it('should find one', async () => {
    campaignsService.findOnePublic.mockResolvedValue({
      data: { id: 'camp-1' },
    });
    const result = await controller.findOne('camp-1');
    expect(campaignsService.findOnePublic).toHaveBeenCalledWith('camp-1');
  });

  it('should create', async () => {
    campaignsService.create.mockResolvedValue({ data: { id: 'camp-1' } });
    const result = await controller.create({ name: 'Sale' } as any);
    expect(campaignsService.create).toHaveBeenCalledWith({ name: 'Sale' });
  });

  it('should update', async () => {
    campaignsService.update.mockResolvedValue({ data: { id: 'camp-1' } });
    const result = await controller.update('camp-1', {
      name: 'Updated',
    } as any);
    expect(campaignsService.update).toHaveBeenCalledWith('camp-1', {
      name: 'Updated',
    });
  });

  it('should remove', async () => {
    campaignsService.remove.mockResolvedValue(undefined);
    await controller.remove('camp-1');
    expect(campaignsService.remove).toHaveBeenCalledWith('camp-1');
  });

  it('should add product', async () => {
    campaignsService.addProduct.mockResolvedValue({ data: { id: 'cp-1' } });
    const result = await controller.addProduct('camp-1', {
      productId: 'p-1',
    } as any);
    expect(campaignsService.addProduct).toHaveBeenCalledWith('camp-1', {
      productId: 'p-1',
    });
  });

  it('should remove product', async () => {
    campaignsService.removeProduct.mockResolvedValue(undefined);
    await controller.removeProduct('camp-1', 'p-1');
    expect(campaignsService.removeProduct).toHaveBeenCalledWith(
      'camp-1',
      'p-1',
    );
  });
});
