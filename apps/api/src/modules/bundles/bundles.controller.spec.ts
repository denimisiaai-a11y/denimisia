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

  it('GET / dispatches to findAllActive', async () => {
    bundlesService.findAllActive.mockResolvedValue([]);
    await controller.findAll();
    expect(bundlesService.findAllActive).toHaveBeenCalled();
  });

  it('GET /:slug dispatches to findBySlug', async () => {
    bundlesService.findBySlug.mockResolvedValue({ id: 'bun-1' });
    await controller.findBySlug('heritage-bundle');
    expect(bundlesService.findBySlug).toHaveBeenCalledWith('heritage-bundle');
  });

  it('POST / dispatches to create with the full DTO', async () => {
    bundlesService.create.mockResolvedValue({ id: 'bun-1' });
    const dto = {
      name: 'Heritage Bundle',
      slug: 'heritage-bundle',
      badgeText: 'BEST DEAL',
      bundlePrice: 250000,
      availableSizes: ['S', 'M', 'L'],
      items: [
        { productId: 'prod-1', color: 'Black' },
        { productId: 'prod-2', color: 'Indigo' },
      ],
    };
    await controller.create(dto as any);
    expect(bundlesService.create).toHaveBeenCalledWith(dto);
  });

  it('PATCH /:id dispatches to update', async () => {
    bundlesService.update.mockResolvedValue({ id: 'bun-1' });
    await controller.update('bun-1', { name: 'Renamed' } as any);
    expect(bundlesService.update).toHaveBeenCalledWith('bun-1', {
      name: 'Renamed',
    });
  });

  it('DELETE /:id dispatches to delete', async () => {
    bundlesService.delete.mockResolvedValue(undefined);
    await controller.delete('bun-1');
    expect(bundlesService.delete).toHaveBeenCalledWith('bun-1');
  });

  it('POST /:id/items dispatches to addItems with the items array', async () => {
    bundlesService.addItems.mockResolvedValue({ id: 'bun-1' });
    const dto = {
      items: [{ productId: 'prod-3', color: 'Olive' }],
    };
    await controller.addItems('bun-1', dto as any);
    expect(bundlesService.addItems).toHaveBeenCalledWith('bun-1', dto.items);
  });

  it('DELETE /:id/items/:productId/:color dispatches to removeItem', async () => {
    bundlesService.removeItem.mockResolvedValue(undefined);
    await controller.removeItem('bun-1', 'prod-1', 'Black');
    expect(bundlesService.removeItem).toHaveBeenCalledWith(
      'bun-1',
      'prod-1',
      'Black',
    );
  });
});
