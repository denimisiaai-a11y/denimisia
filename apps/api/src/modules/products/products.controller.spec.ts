import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

describe('ProductsController', () => {
  let controller: ProductsController;
  let productsService: Record<string, jest.Mock>;

  beforeEach(async () => {
    productsService = {
      findAll: jest.fn(),
      findFeatured: jest.fn(),
      findNewArrivals: jest.fn(),
      findBySlug: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      addVariant: jest.fn(),
      updateVariant: jest.fn(),
      deleteVariant: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: productsService }],
    }).compile();

    controller = module.get(ProductsController);
  });

  it('should find all', async () => {
    productsService.findAll.mockResolvedValue({ products: [] });
    const result = await controller.findAll({ category: 'jeans' } as any);
    expect(productsService.findAll).toHaveBeenCalledWith({ category: 'jeans' });
  });

  it('should find featured', async () => {
    productsService.findFeatured.mockResolvedValue([]);
    const result = await controller.findFeatured();
    expect(productsService.findFeatured).toHaveBeenCalled();
  });

  it('should find new arrivals', async () => {
    productsService.findNewArrivals.mockResolvedValue([]);
    const result = await controller.findNewArrivals();
    expect(productsService.findNewArrivals).toHaveBeenCalled();
  });

  it('should find by slug', async () => {
    productsService.findBySlug.mockResolvedValue({ id: 'prod-1' });
    const result = await controller.findBySlug('jeans');
    expect(productsService.findBySlug).toHaveBeenCalledWith('jeans');
  });

  it('should create', async () => {
    productsService.create.mockResolvedValue({ id: 'prod-1' });
    const result = await controller.create({ name: 'Jeans' } as any);
    expect(productsService.create).toHaveBeenCalledWith({ name: 'Jeans' });
  });

  it('should update', async () => {
    productsService.update.mockResolvedValue({ id: 'prod-1' });
    const result = await controller.update('prod-1', {
      name: 'Updated',
    } as any);
    expect(productsService.update).toHaveBeenCalledWith('prod-1', {
      name: 'Updated',
    });
  });

  it('should soft delete', async () => {
    productsService.softDelete.mockResolvedValue({ id: 'prod-1' });
    await controller.softDelete('prod-1');
    expect(productsService.softDelete).toHaveBeenCalledWith('prod-1');
  });

  it('should add variant', async () => {
    productsService.addVariant.mockResolvedValue({ id: 'var-1' });
    const result = await controller.addVariant('prod-1', { size: 'M' } as any);
    expect(productsService.addVariant).toHaveBeenCalledWith('prod-1', {
      size: 'M',
    });
  });

  it('should update variant', async () => {
    productsService.updateVariant.mockResolvedValue({ id: 'var-1' });
    const result = await controller.updateVariant('prod-1', 'var-1', {
      stock: 10,
    } as any);
    expect(productsService.updateVariant).toHaveBeenCalledWith(
      'prod-1',
      'var-1',
      { stock: 10 },
    );
  });

  it('should delete variant', async () => {
    productsService.deleteVariant.mockResolvedValue(undefined);
    await controller.deleteVariant('prod-1', 'var-1');
    expect(productsService.deleteVariant).toHaveBeenCalledWith(
      'prod-1',
      'var-1',
    );
  });
});
