import { Test, TestingModule } from '@nestjs/testing';
import { BundlesController } from './bundles.controller';
import { BundlesService } from './bundles.service';

describe('BundlesController', () => {
  let controller: BundlesController;
  let bundlesService: Record<string, jest.Mock>;

  beforeEach(async () => {
    bundlesService = {
      findAllActive: jest.fn(),
      findBySlug: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      addItems: jest.fn(),
      removeItem: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BundlesController],
      providers: [{ provide: BundlesService, useValue: bundlesService }],
    }).compile();

    controller = module.get(BundlesController);
  });

  it('should find all', async () => {
    bundlesService.findAllActive.mockResolvedValue([]);
    const result = await controller.findAll();
    expect(bundlesService.findAllActive).toHaveBeenCalled();
  });

  it('should find by slug', async () => {
    bundlesService.findBySlug.mockResolvedValue({ id: 'bun-1' });
    const result = await controller.findBySlug('summer');
    expect(bundlesService.findBySlug).toHaveBeenCalledWith('summer');
  });

  it('should create', async () => {
    bundlesService.create.mockResolvedValue({ id: 'bun-1' });
    const result = await controller.create({ name: 'Summer' } as any);
    expect(bundlesService.create).toHaveBeenCalledWith({ name: 'Summer' });
  });

  it('should update', async () => {
    bundlesService.update.mockResolvedValue({ id: 'bun-1' });
    const result = await controller.update('bun-1', { name: 'Updated' } as any);
    expect(bundlesService.update).toHaveBeenCalledWith('bun-1', {
      name: 'Updated',
    });
  });

  it('should delete', async () => {
    bundlesService.delete.mockResolvedValue(undefined);
    await controller.delete('bun-1');
    expect(bundlesService.delete).toHaveBeenCalledWith('bun-1');
  });

  it('should add items', async () => {
    bundlesService.addItems.mockResolvedValue({ id: 'bun-1' });
    const result = await controller.addItems('bun-1', {
      productIds: ['p1'],
    } as any);
    expect(bundlesService.addItems).toHaveBeenCalledWith('bun-1', ['p1']);
  });

  it('should remove item', async () => {
    bundlesService.removeItem.mockResolvedValue(undefined);
    await controller.removeItem('bun-1', 'p1');
    expect(bundlesService.removeItem).toHaveBeenCalledWith('bun-1', 'p1');
  });
});
