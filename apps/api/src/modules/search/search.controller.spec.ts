import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

describe('SearchController', () => {
  let controller: SearchController;
  let searchService: Record<string, jest.Mock>;

  beforeEach(async () => {
    searchService = {
      searchProducts: jest.fn(),
      getSuggestions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [{ provide: SearchService, useValue: searchService }],
    }).compile();

    controller = module.get(SearchController);
  });

  it('should search products', async () => {
    searchService.searchProducts.mockResolvedValue({ products: [], total: 0 });
    const result = await controller.search('denim', '2', '10');
    expect(searchService.searchProducts).toHaveBeenCalledWith('denim', 2, 10);
  });

  it('should get suggestions', async () => {
    searchService.getSuggestions.mockResolvedValue([
      { id: 'prod-1', name: 'Jeans' },
    ]);
    const result = await controller.suggestions('jean');
    expect(searchService.getSuggestions).toHaveBeenCalledWith('jean');
  });
});
