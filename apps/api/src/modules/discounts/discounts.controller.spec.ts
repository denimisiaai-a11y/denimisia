import { Test, TestingModule } from '@nestjs/testing';
import { DiscountsController } from './discounts.controller';
import { DiscountsService } from './discounts.service';

describe('DiscountsController', () => {
  let controller: DiscountsController;
  let discountsService: Record<string, jest.Mock>;

  beforeEach(async () => {
    discountsService = {
      validate: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DiscountsController],
      providers: [{ provide: DiscountsService, useValue: discountsService }],
    }).compile();

    controller = module.get(DiscountsController);
  });

  it('should validate discount', async () => {
    discountsService.validate.mockResolvedValue({ valid: true });
    const dto = { code: 'WELCOME10', orderTotal: 1000 } as any;
    const result = await controller.validate(dto);
    expect(discountsService.validate).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ valid: true });
  });

  it('should find all discounts', async () => {
    discountsService.findAll.mockResolvedValue({ discounts: [], total: 0 });
    const result = await controller.findAll('1', '20');
    expect(discountsService.findAll).toHaveBeenCalledWith(1, 20);
  });

  it('should find one discount', async () => {
    discountsService.findOne.mockResolvedValue({ id: 'd-1' });
    const result = await controller.findOne('d-1');
    expect(discountsService.findOne).toHaveBeenCalledWith('d-1');
  });

  it('should create discount', async () => {
    discountsService.create.mockResolvedValue({ id: 'd-1' });
    const dto = { code: 'NEW10', type: 'PERCENTAGE', value: 10 } as any;
    const result = await controller.create(dto);
    expect(discountsService.create).toHaveBeenCalledWith(dto);
  });

  it('should update discount', async () => {
    discountsService.update.mockResolvedValue({ id: 'd-1' });
    const dto = { value: 15 } as any;
    const result = await controller.update('d-1', dto);
    expect(discountsService.update).toHaveBeenCalledWith('d-1', dto);
  });

  it('should remove discount', async () => {
    discountsService.remove.mockResolvedValue(undefined);
    await controller.remove('d-1');
    expect(discountsService.remove).toHaveBeenCalledWith('d-1');
  });
});
