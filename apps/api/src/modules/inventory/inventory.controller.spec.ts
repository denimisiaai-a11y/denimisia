import { Test, TestingModule } from '@nestjs/testing';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

describe('InventoryController', () => {
  let controller: InventoryController;
  let inventoryService: Record<string, jest.Mock>;

  beforeEach(async () => {
    inventoryService = {
      getInventorySummary: jest.fn(),
      getLowStockVariants: jest.fn(),
      getVariantLogs: jest.fn(),
      adjustStock: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [{ provide: InventoryService, useValue: inventoryService }],
    }).compile();

    controller = module.get(InventoryController);
  });

  it('should get summary', async () => {
    inventoryService.getInventorySummary.mockResolvedValue({
      totalVariants: 10,
    });
    const result = await controller.getSummary();
    expect(inventoryService.getInventorySummary).toHaveBeenCalled();
  });

  it('should get low stock with default threshold', async () => {
    inventoryService.getLowStockVariants.mockResolvedValue([]);
    const result = await controller.getLowStock();
    expect(inventoryService.getLowStockVariants).toHaveBeenCalledWith(5);
  });

  it('should get low stock with custom threshold', async () => {
    inventoryService.getLowStockVariants.mockResolvedValue([]);
    const result = await controller.getLowStock('10');
    expect(inventoryService.getLowStockVariants).toHaveBeenCalledWith(10);
  });

  it('should get variant logs', async () => {
    inventoryService.getVariantLogs.mockResolvedValue({ logs: [] });
    const result = await controller.getVariantLogs('var-1', '2', '10');
    expect(inventoryService.getVariantLogs).toHaveBeenCalledWith(
      'var-1',
      2,
      10,
    );
  });

  it('should adjust stock', async () => {
    inventoryService.adjustStock.mockResolvedValue({ id: 'var-1', stock: 15 });
    const dto = { variantId: 'var-1', quantity: 5, type: 'ADJUSTMENT' } as any;
    const result = await controller.adjustStock(dto);
    expect(inventoryService.adjustStock).toHaveBeenCalledWith(dto);
  });
});
