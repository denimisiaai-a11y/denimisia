import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from './audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  beforeEach(async () => {
    prisma = {
      auditLog: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(AuditLogService);
  });

  it('should create log', async () => {
    prisma.auditLog.create.mockResolvedValue({ id: 'log-1' });
    const result = await service.log('user-1', 'CREATE', 'Product', 'prod-1', {
      name: 'Jeans',
    } as any);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        action: 'CREATE',
        entity: 'Product',
        entityId: 'prod-1',
        details: { name: 'Jeans' },
      },
    });
  });

  it('should create log with DbNull when details missing', async () => {
    prisma.auditLog.create.mockResolvedValue({ id: 'log-1' });
    await service.log('user-1', 'DELETE', 'Product', 'prod-1');
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ details: Prisma.DbNull }),
      }),
    );
  });

  it('should find all logs with pagination', async () => {
    prisma.auditLog.findMany.mockResolvedValue([{ id: 'log-1' }]);
    prisma.auditLog.count.mockResolvedValue(1);
    const result = await service.findAll({ page: 1, limit: 20 });
    expect(result).toEqual({
      logs: [{ id: 'log-1' }],
      total: 1,
      page: 1,
      limit: 20,
    });
  });

  it('should apply filters', async () => {
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.auditLog.count.mockResolvedValue(0);
    await service.findAll({
      page: 2,
      limit: 10,
      entity: 'Product',
      entityId: 'prod-1',
      userId: 'user-1',
    });
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { entity: 'Product', entityId: 'prod-1', userId: 'user-1' },
        skip: 10,
        take: 10,
      }),
    );
  });
});
