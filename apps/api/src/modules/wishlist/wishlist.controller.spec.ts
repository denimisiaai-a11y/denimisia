import { Test, TestingModule } from '@nestjs/testing';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';

describe('WishlistController', () => {
  let controller: WishlistController;
  let wishlistService: Record<string, jest.Mock>;

  beforeEach(async () => {
    wishlistService = {
      getWishlist: jest.fn(),
      addItem: jest.fn(),
      removeItem: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WishlistController],
      providers: [{ provide: WishlistService, useValue: wishlistService }],
    }).compile();

    controller = module.get(WishlistController);
  });

  it('should get wishlist', async () => {
    wishlistService.getWishlist.mockResolvedValue({ items: [] });
    const result = await controller.getWishlist({ id: 'user-1' });
    expect(wishlistService.getWishlist).toHaveBeenCalledWith('user-1');
  });

  it('should add item', async () => {
    wishlistService.addItem.mockResolvedValue({ id: 'wi-1' });
    const result = await controller.addItem({ id: 'user-1' }, {
      productId: 'prod-1',
    } as any);
    expect(wishlistService.addItem).toHaveBeenCalledWith('user-1', 'prod-1');
  });

  it('should remove item', async () => {
    wishlistService.removeItem.mockResolvedValue(undefined);
    await controller.removeItem({ id: 'user-1' }, 'prod-1');
    expect(wishlistService.removeItem).toHaveBeenCalledWith('user-1', 'prod-1');
  });
});
