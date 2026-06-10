import { Test, TestingModule } from '@nestjs/testing';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

describe('CartController', () => {
  let controller: CartController;
  let cartService: Record<string, jest.Mock>;

  const mockReq = (sessionId?: string) =>
    ({
      cookies: { session_id: sessionId },
    }) as any;

  beforeEach(async () => {
    cartService = {
      getCart: jest.fn(),
      addItem: jest.fn(),
      addBundleItem: jest.fn(),
      updateItem: jest.fn(),
      removeItem: jest.fn(),
      clearCart: jest.fn(),
      mergeGuestCart: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartController],
      providers: [{ provide: CartService, useValue: cartService }],
    }).compile();

    controller = module.get(CartController);
  });

  it('should get cart for authenticated user', async () => {
    cartService.getCart.mockResolvedValue({ items: [] });
    const result = await controller.getCart(mockReq('sid-1'), { id: 'user-1' });
    expect(cartService.getCart).toHaveBeenCalledWith('user-1', 'sid-1');
    expect(result).toEqual({ items: [] });
  });

  it('should get cart for guest', async () => {
    cartService.getCart.mockResolvedValue({ items: [] });
    const result = await controller.getCart(mockReq('sid-1'), undefined);
    expect(cartService.getCart).toHaveBeenCalledWith(undefined, 'sid-1');
  });

  it('should add item', async () => {
    cartService.addItem.mockResolvedValue({ items: [] });
    const dto = { variantId: 'var-1', quantity: 1 } as any;
    const result = await controller.addItem(dto, mockReq('sid-1'), {
      id: 'user-1',
    });
    expect(cartService.addItem).toHaveBeenCalledWith(dto, 'user-1', 'sid-1');
  });

  it('POST /bundles dispatches to addBundleItem', async () => {
    cartService.addBundleItem.mockResolvedValue({ items: [] });
    const dto = {
      bundleSlug: 'heritage-bundle',
      size: 'L',
      quantity: 1,
    } as any;
    await controller.addBundle(dto, mockReq('sid-1'), { id: 'user-1' });
    expect(cartService.addBundleItem).toHaveBeenCalledWith(
      dto,
      'user-1',
      'sid-1',
    );
  });

  it('should update item', async () => {
    cartService.updateItem.mockResolvedValue({ items: [] });
    const result = await controller.updateItem(
      'item-1',
      { quantity: 2 } as any,
      { id: 'user-1' },
    );
    expect(cartService.updateItem).toHaveBeenCalledWith(
      'item-1',
      { quantity: 2 },
      'user-1',
    );
  });

  it('should remove item', async () => {
    cartService.removeItem.mockResolvedValue(undefined);
    await controller.removeItem('item-1', { id: 'user-1' });
    expect(cartService.removeItem).toHaveBeenCalledWith('item-1', 'user-1');
  });

  it('should clear cart', async () => {
    cartService.clearCart.mockResolvedValue(undefined);
    await controller.clearCart(mockReq('sid-1'), { id: 'user-1' });
    expect(cartService.clearCart).toHaveBeenCalledWith('user-1', 'sid-1');
  });

  it('should merge cart using session_id from cookies', async () => {
    cartService.mergeGuestCart.mockResolvedValue({ items: [] });
    const result = await controller.mergeCart(
      { id: 'user-1' },
      mockReq('sid-1'),
    );
    expect(cartService.mergeGuestCart).toHaveBeenCalledWith('user-1', 'sid-1');
    expect(result).toEqual({ merged: true });
  });

  it('should return merged:false when no session cookie present', async () => {
    const result = await controller.mergeCart(
      { id: 'user-1' },
      mockReq(undefined),
    );
    expect(cartService.mergeGuestCart).not.toHaveBeenCalled();
    expect(result).toEqual({ merged: false });
  });
});
