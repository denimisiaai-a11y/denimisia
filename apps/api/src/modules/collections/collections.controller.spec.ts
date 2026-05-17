import { Test, TestingModule } from '@nestjs/testing';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';

describe('CollectionsController', () => {
  let controller: CollectionsController;
  let collectionsService: Record<string, jest.Mock>;

  beforeEach(async () => {
    collectionsService = {
      findAll: jest.fn(),
      findBySlug: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      addProducts: jest.fn(),
      removeProduct: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CollectionsController],
      providers: [
        { provide: CollectionsService, useValue: collectionsService },
      ],
    }).compile();

    controller = module.get(CollectionsController);
  });

  it('should find all', async () => {
    collectionsService.findAll.mockResolvedValue([]);
    const result = await controller.findAll();
    expect(collectionsService.findAll).toHaveBeenCalled();
  });

  it('should find by slug', async () => {
    collectionsService.findBySlug.mockResolvedValue({ id: 'col-1' });
    const result = await controller.findBySlug('summer');
    expect(collectionsService.findBySlug).toHaveBeenCalledWith('summer');
  });

  it('should create', async () => {
    collectionsService.create.mockResolvedValue({ id: 'col-1' });
    const result = await controller.create({ name: 'Summer' } as any);
    expect(collectionsService.create).toHaveBeenCalledWith({ name: 'Summer' });
  });

  it('should update', async () => {
    collectionsService.update.mockResolvedValue({ id: 'col-1' });
    const result = await controller.update('col-1', { name: 'Updated' } as any);
    expect(collectionsService.update).toHaveBeenCalledWith('col-1', {
      name: 'Updated',
    });
  });

  it('should delete', async () => {
    collectionsService.delete.mockResolvedValue(undefined);
    await controller.delete('col-1');
    expect(collectionsService.delete).toHaveBeenCalledWith('col-1');
  });

  it('should add products', async () => {
    collectionsService.addProducts.mockResolvedValue({ id: 'col-1' });
    const result = await controller.addProducts('col-1', {
      productIds: ['p1'],
    } as any);
    expect(collectionsService.addProducts).toHaveBeenCalledWith('col-1', {
      productIds: ['p1'],
    });
  });

  it('should remove product', async () => {
    collectionsService.removeProduct.mockResolvedValue(undefined);
    await controller.removeProduct('col-1', 'p1');
    expect(collectionsService.removeProduct).toHaveBeenCalledWith(
      'col-1',
      'p1',
    );
  });
});
