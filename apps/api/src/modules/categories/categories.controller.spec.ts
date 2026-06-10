import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

describe('CategoriesController', () => {
  let controller: CategoriesController;
  let categoriesService: Record<string, jest.Mock>;

  beforeEach(async () => {
    categoriesService = {
      findAll: jest.fn(),
      findBySlug: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [{ provide: CategoriesService, useValue: categoriesService }],
    }).compile();

    controller = module.get(CategoriesController);
  });

  it('should find all', async () => {
    categoriesService.findAll.mockResolvedValue([]);
    const result = await controller.findAll();
    expect(categoriesService.findAll).toHaveBeenCalled();
  });

  it('should find by slug', async () => {
    categoriesService.findBySlug.mockResolvedValue({ id: 'cat-1' });
    const result = await controller.findBySlug('jeans');
    expect(categoriesService.findBySlug).toHaveBeenCalledWith('jeans');
  });

  it('should create', async () => {
    categoriesService.create.mockResolvedValue({ id: 'cat-1' });
    const result = await controller.create({ name: 'Jeans' } as any);
    expect(categoriesService.create).toHaveBeenCalledWith({ name: 'Jeans' });
  });

  it('should update', async () => {
    categoriesService.update.mockResolvedValue({ id: 'cat-1' });
    const result = await controller.update('cat-1', { name: 'Updated' } as any);
    expect(categoriesService.update).toHaveBeenCalledWith('cat-1', {
      name: 'Updated',
    });
  });

  it('should delete', async () => {
    categoriesService.delete.mockResolvedValue(undefined);
    await controller.delete('cat-1');
    expect(categoriesService.delete).toHaveBeenCalledWith('cat-1');
  });
});
