import { Test, TestingModule } from '@nestjs/testing';
import { CurationController } from './curation.controller';
import { CurationService } from './curation.service';

describe('CurationController', () => {
  let controller: CurationController;
  let curation: Record<string, jest.Mock>;

  beforeEach(async () => {
    curation = {
      resolve: jest.fn(),
      searchProducts: jest.fn(),
      listByPage: jest.fn(),
      getOrCreate: jest.fn(),
      upsert: jest.fn(),
      addProduct: jest.fn(),
      updateProduct: jest.fn(),
      removeProduct: jest.fn(),
      addProductsBulk: jest.fn(),
      fillFromCollection: jest.fn(),
      reorder: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CurationController],
      providers: [{ provide: CurationService, useValue: curation }],
    }).compile();
    controller = module.get(CurationController);
  });

  it('GET /:pageKey/:sectionKey resolves the section', async () => {
    curation.resolve.mockResolvedValue({ curation: null, items: [] });
    await controller.resolve('home', 'new-arrivals');
    expect(curation.resolve).toHaveBeenCalledWith('home', 'new-arrivals');
  });

  it('GET /admin/search dispatches with parsed limit', async () => {
    curation.searchProducts.mockResolvedValue([]);
    await controller.search('jean', '15');
    expect(curation.searchProducts).toHaveBeenCalledWith('jean', 15);
  });

  it('GET /admin/search defaults to limit 10 when not a number', async () => {
    curation.searchProducts.mockResolvedValue([]);
    await controller.search('', 'not-a-number');
    expect(curation.searchProducts).toHaveBeenCalledWith('', 10);
  });

  it('GET /admin/page/:pageKey lists sections', async () => {
    curation.listByPage.mockResolvedValue([]);
    await controller.listByPage('home');
    expect(curation.listByPage).toHaveBeenCalledWith('home');
  });

  it('GET /admin/:pageKey/:sectionKey passes label through', async () => {
    curation.getOrCreate.mockResolvedValue({});
    await controller.getAdmin('home', 'new-arrivals', 'Fresh');
    expect(curation.getOrCreate).toHaveBeenCalledWith(
      'home',
      'new-arrivals',
      'Fresh',
    );
  });

  it('PUT /admin/:pageKey/:sectionKey upserts curation', async () => {
    curation.upsert.mockResolvedValue({});
    const dto = { label: 'x', sourceMode: 'MANUAL' } as any;
    await controller.upsert('home', 'new-arrivals', dto);
    expect(curation.upsert).toHaveBeenCalledWith('home', 'new-arrivals', dto);
  });

  it('POST /admin/:pageKey/:sectionKey/products adds one', async () => {
    curation.addProduct.mockResolvedValue({});
    const dto = { productId: 'prod-1' } as any;
    await controller.addProduct('home', 'new-arrivals', dto);
    expect(curation.addProduct).toHaveBeenCalledWith(
      'home',
      'new-arrivals',
      dto,
    );
  });

  it('PATCH /admin/products/:sectionProductId updates one', async () => {
    curation.updateProduct.mockResolvedValue({});
    const dto = { position: 5 } as any;
    await controller.updateProduct('sp-1', dto);
    expect(curation.updateProduct).toHaveBeenCalledWith('sp-1', dto);
  });

  it('DELETE /admin/products/:sectionProductId removes one', async () => {
    curation.removeProduct.mockResolvedValue({});
    await controller.removeProduct('sp-1');
    expect(curation.removeProduct).toHaveBeenCalledWith('sp-1');
  });

  it('POST /admin/:pageKey/:sectionKey/products/bulk dispatches productIds array', async () => {
    curation.addProductsBulk.mockResolvedValue({ added: 2, skipped: 0 });
    const dto = { productIds: ['p1', 'p2'] } as any;
    await controller.bulkAdd('home', 'new-arrivals', dto);
    expect(curation.addProductsBulk).toHaveBeenCalledWith(
      'home',
      'new-arrivals',
      ['p1', 'p2'],
    );
  });

  it('POST /admin/:pageKey/:sectionKey/fill-from-collection dispatches', async () => {
    curation.fillFromCollection.mockResolvedValue({ added: 5, skipped: 0 });
    await controller.fillFromCollection('home', 'new-arrivals');
    expect(curation.fillFromCollection).toHaveBeenCalledWith(
      'home',
      'new-arrivals',
    );
  });

  it('PUT /admin/:pageKey/:sectionKey/reorder dispatches orderedProductIds', async () => {
    curation.reorder.mockResolvedValue({});
    const dto = { orderedProductIds: ['p1', 'p2'] } as any;
    await controller.reorder('home', 'new-arrivals', dto);
    expect(curation.reorder).toHaveBeenCalledWith('home', 'new-arrivals', [
      'p1',
      'p2',
    ]);
  });
});
