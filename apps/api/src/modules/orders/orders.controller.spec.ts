import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

describe('OrdersController', () => {
  let controller: OrdersController;
  let ordersService: Record<string, jest.Mock>;

  beforeEach(async () => {
    ordersService = {
      createOrder: jest.fn(),
      getMyOrders: jest.fn(),
      getOrderById: jest.fn(),
      cancelOrder: jest.fn(),
      getAllOrders: jest.fn(),
      updateOrderStatus: jest.fn(),
      getStatusHistory: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: ordersService }],
    }).compile();

    controller = module.get(OrdersController);
  });

  it('should create order', async () => {
    ordersService.createOrder.mockResolvedValue({ id: 'order-1' });
    const dto = { items: [], shippingAddress: {} } as any;
    const result = await controller.createOrder({ id: 'user-1' }, dto);
    expect(ordersService.createOrder).toHaveBeenCalledWith('user-1', dto);
    expect(result).toEqual({ id: 'order-1' });
  });

  it('should get my orders', async () => {
    ordersService.getMyOrders.mockResolvedValue({ orders: [], total: 0 });
    const result = await controller.getMyOrders({ id: 'user-1' }, '2', '5');
    expect(ordersService.getMyOrders).toHaveBeenCalledWith('user-1', 2, 5);
  });

  it('should get order by id without admin bypass for regular customers', async () => {
    ordersService.getOrderById.mockResolvedValue({ id: 'order-1' });
    const result = await controller.getOrder(
      { id: 'user-1', role: 'CUSTOMER' },
      'order-1',
    );
    expect(ordersService.getOrderById).toHaveBeenCalledWith(
      'user-1',
      'order-1',
      false,
    );
  });

  it('should pass isAdmin=true so admins can open guest orders', async () => {
    ordersService.getOrderById.mockResolvedValue({ id: 'order-1' });
    await controller.getOrder(
      { id: 'admin-1', role: 'SUPER_ADMIN' },
      'order-1',
    );
    expect(ordersService.getOrderById).toHaveBeenCalledWith(
      'admin-1',
      'order-1',
      true,
    );
  });

  it('should cancel order', async () => {
    ordersService.cancelOrder.mockResolvedValue({
      id: 'order-1',
      status: 'CANCELLED',
    });
    const result = await controller.cancelOrder({ id: 'user-1' }, 'order-1');
    expect(ordersService.cancelOrder).toHaveBeenCalledWith('user-1', 'order-1');
  });

  it('should get all orders for admin', async () => {
    ordersService.getAllOrders.mockResolvedValue({ orders: [], total: 0 });
    const result = await controller.getAllOrders('1', '20', 'PENDING');
    expect(ordersService.getAllOrders).toHaveBeenCalledWith(1, 20, 'PENDING');
  });

  it('should update order status and forward authenticated actorId', async () => {
    ordersService.updateOrderStatus.mockResolvedValue({
      id: 'order-1',
      status: 'SHIPPED',
    });
    const dto = { status: 'SHIPPED', note: 'Shipped' } as any;
    const admin = { id: 'admin-1', role: 'ADMIN' };

    const result = await controller.updateOrderStatus(admin, 'order-1', dto);

    // actorId MUST come from the authenticated admin user — never from dto.
    expect(ordersService.updateOrderStatus).toHaveBeenCalledWith(
      'order-1',
      dto,
      'admin-1',
    );
  });

  it('should get status history with authenticated requester context', async () => {
    ordersService.getStatusHistory.mockResolvedValue([{ id: 'h-1' }]);
    const user = { id: 'user-1', role: 'CUSTOMER' };

    const result = await controller.getStatusHistory(user, 'order-1');

    expect(ordersService.getStatusHistory).toHaveBeenCalledWith('order-1', {
      id: 'user-1',
      role: 'CUSTOMER',
    });
    expect(result).toEqual({ success: true, data: [{ id: 'h-1' }] });
  });
});
