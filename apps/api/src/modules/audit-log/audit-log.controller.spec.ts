import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';

describe('AuditLogController', () => {
  let controller: AuditLogController;
  let auditLogService: Record<string, jest.Mock>;

  beforeEach(async () => {
    auditLogService = {
      findAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditLogController],
      providers: [{ provide: AuditLogService, useValue: auditLogService }],
    }).compile();

    controller = module.get(AuditLogController);
  });

  it('should find all with defaults', async () => {
    auditLogService.findAll.mockResolvedValue({ logs: [], total: 0 });
    const result = await controller.findAll();
    expect(auditLogService.findAll).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      entity: undefined,
      entityId: undefined,
      userId: undefined,
    });
  });

  it('should parse query params and cap limit at 100', async () => {
    auditLogService.findAll.mockResolvedValue({ logs: [], total: 0 });
    const result = await controller.findAll(
      '3',
      '150',
      'Product',
      'p1',
      'user-1',
    );
    expect(auditLogService.findAll).toHaveBeenCalledWith({
      page: 3,
      limit: 100,
      entity: 'Product',
      entityId: 'p1',
      userId: 'user-1',
    });
  });
});
