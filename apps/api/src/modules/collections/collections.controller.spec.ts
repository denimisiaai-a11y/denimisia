import { Test, TestingModule } from '@nestjs/testing';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';

describe('CollectionsController', () => {
  let controller: CollectionsController;
  let collectionsService: Record<string, jest.Mock>;

  beforeEach(async () => {
    collectionsService = {
      findAll: jest.fn(),
      findAllAdmin: jest.fn(),
      findBySlug: jest.fn(),
      findBySlugResolved: jest.fn(),
      findByIdAdmin: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      addProducts: jest.fn(),
      removeProduct: jest.fn(),
      reorderProducts: jest.fn(),
      upsertLookbookItem: jest.fn(),
      removeLookbookItem: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CollectionsController],
      providers: [{ provide: CollectionsService, useValue: collectionsService }],
    }).compile();

    controller = module.get(CollectionsController);
  });

  it('GET /collections delegates to findAll', async () => {
    collectionsService.findAll.mockResolvedValue([]);
    await controller.findAll();
    expect(collectionsService.findAll).toHaveBeenCalled();
  });

  it('GET /collections/:slug delegates to findBySlug', async () => {
    collectionsService.findBySlug.mockResolvedValue({ id: 'col-1' });
    await controller.findBySlug('summer');
    expect(collectionsService.findBySlug).toHaveBeenCalledWith('summer');
  });

  it('GET /collections/:slug/resolved delegates to findBySlugResolved', async () => {
    collectionsService.findBySlugResolved.mockResolvedValue({ id: 'c1' });
    await controller.findResolved('bestsellers');
    expect(collectionsService.findBySlugResolved).toHaveBeenCalledWith('bestsellers');
  });

  it('GET /collections/admin/all delegates to findAllAdmin', async () => {
    collectionsService.findAllAdmin.mockResolvedValue([]);
    await controller.findAllAdmin();
    expect(collectionsService.findAllAdmin).toHaveBeenCalled();
  });

  it('GET /collections/admin/:id delegates to findByIdAdmin', async () => {
    collectionsService.findByIdAdmin.mockResolvedValue({ id: 'c1' });
    await controller.findByIdAdmin('c1');
    expect(collectionsService.findByIdAdmin).toHaveBeenCalledWith('c1');
  });

  it('POST /collections delegates to create', async () => {
    collectionsService.create.mockResolvedValue({ id: 'col-1' });
    await controller.create({ name: 'Summer', slug: 'summer' } as never);
    expect(collectionsService.create).toHaveBeenCalledWith({ name: 'Summer', slug: 'summer' });
  });

  it('PATCH /collections/:id delegates to update', async () => {
    collectionsService.update.mockResolvedValue({ id: 'col-1' });
    await controller.update('col-1', { name: 'Updated' } as never);
    expect(collectionsService.update).toHaveBeenCalledWith('col-1', { name: 'Updated' });
  });

  it('DELETE /collections/:id delegates to delete', async () => {
    collectionsService.delete.mockResolvedValue(undefined);
    await controller.delete('col-1');
    expect(collectionsService.delete).toHaveBeenCalledWith('col-1');
  });

  it('POST /collections/:id/products delegates to addProducts', async () => {
    collectionsService.addProducts.mockResolvedValue({ id: 'col-1' });
    await controller.addProducts('col-1', { productIds: ['p1'] } as never);
    expect(collectionsService.addProducts).toHaveBeenCalledWith('col-1', { productIds: ['p1'] });
  });

  it('DELETE /collections/:id/products/:productId delegates to removeProduct', async () => {
    collectionsService.removeProduct.mockResolvedValue(undefined);
    await controller.removeProduct('col-1', 'p1');
    expect(collectionsService.removeProduct).toHaveBeenCalledWith('col-1', 'p1');
  });

  it('PATCH /collections/:id/products/reorder delegates to reorderProducts', async () => {
    collectionsService.reorderProducts.mockResolvedValue({ id: 'col-1' });
    await controller.reorderProducts('col-1', { productIds: ['a', 'b'] } as never);
    expect(collectionsService.reorderProducts).toHaveBeenCalledWith('col-1', ['a', 'b']);
  });

  it('POST /collections/:id/lookbook delegates to upsertLookbookItem', async () => {
    collectionsService.upsertLookbookItem.mockResolvedValue({ id: 'lb1' });
    await controller.addLookbookItem('col-1', { imageUrl: 'x.jpg' } as never);
    expect(collectionsService.upsertLookbookItem).toHaveBeenCalledWith('col-1', {
      imageUrl: 'x.jpg',
    });
  });

  it('DELETE /collections/lookbook/:id delegates to removeLookbookItem', async () => {
    collectionsService.removeLookbookItem.mockResolvedValue(undefined);
    await controller.removeLookbookItem('lb1');
    expect(collectionsService.removeLookbookItem).toHaveBeenCalledWith('lb1');
  });
});
