import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CmsService } from './cms.service';
import { PrismaService } from '../prisma/prisma.service';

// Minimal Prisma stub: just the methods the service actually calls.
// Note: tests assert behaviour, not Prisma client internals.
type PrismaStub = {
  homepageSectionInstance: Record<string, jest.Mock>;
  globalStorefrontStyles: Record<string, jest.Mock>;
  banner: Record<string, jest.Mock>;
  auditLog: Record<string, jest.Mock>;
  $transaction: jest.Mock;
};

describe('CmsService', () => {
  let service: CmsService;
  let prisma: PrismaStub;

  beforeEach(async () => {
    prisma = {
      homepageSectionInstance: {
        findMany:   jest.fn(),
        findUnique: jest.fn(),
        create:     jest.fn(),
        update:     jest.fn(),
        delete:     jest.fn(),
        count:      jest.fn(),
      },
      globalStorefrontStyles: {
        upsert: jest.fn(),
      },
      banner: {
        findMany:   jest.fn(),
        findUnique: jest.fn(),
        create:     jest.fn(),
        update:     jest.fn(),
        delete:     jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CmsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(CmsService);
  });

  // ─── Homepage Section Composer ──────────────────────────────────────────

  describe('listActiveSections', () => {
    it('returns only active sections ordered by position', async () => {
      prisma.homepageSectionInstance.findMany.mockResolvedValue([
        { id: 's-1', position: 0 },
      ]);
      const result = await service.listActiveSections();
      expect(result).toHaveLength(1);
      expect(prisma.homepageSectionInstance.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { position: 'asc' },
      });
    });
  });

  describe('createSection', () => {
    it('appends to end when position is omitted', async () => {
      prisma.homepageSectionInstance.count.mockResolvedValue(3);
      prisma.homepageSectionInstance.create.mockResolvedValue({
        id: 'new',
        type: 'HERO',
        position: 3,
      });

      const created = await service.createSection(
        { type: 'HERO' as never },
        'admin-1',
      );

      expect(created.position).toBe(3);
      const callArgs = prisma.homepageSectionInstance.create.mock.calls[0][0] as {
        data: { position: number };
      };
      expect(callArgs.data.position).toBe(3);
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('respects an explicit position', async () => {
      prisma.homepageSectionInstance.create.mockResolvedValue({
        id: 'new',
        type: 'HERO',
        position: 1,
      });
      await service.createSection(
        { type: 'HERO' as never, position: 1 },
        'admin-1',
      );
      const callArgs = prisma.homepageSectionInstance.create.mock.calls[0][0] as {
        data: { position: number };
      };
      expect(callArgs.data.position).toBe(1);
    });
  });

  describe('updateSection', () => {
    it('throws NotFoundException when the section is missing', async () => {
      prisma.homepageSectionInstance.findUnique.mockResolvedValue(null);
      await expect(
        service.updateSection('missing', { isActive: false }, 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('writes only the fields present in the dto', async () => {
      prisma.homepageSectionInstance.findUnique.mockResolvedValue({
        id: 's-1',
        type: 'HERO',
      });
      prisma.homepageSectionInstance.update.mockResolvedValue({
        id: 's-1',
        type: 'HERO',
      });

      await service.updateSection('s-1', { isActive: false }, 'admin-1');

      const args = prisma.homepageSectionInstance.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(args.data).toEqual({ isActive: false });
    });
  });

  describe('deleteSection', () => {
    it('throws NotFoundException for missing rows', async () => {
      prisma.homepageSectionInstance.findUnique.mockResolvedValue(null);
      await expect(service.deleteSection('missing', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('reorderSections', () => {
    it('runs all position updates inside a transaction', async () => {
      prisma.homepageSectionInstance.update.mockResolvedValue({});
      await service.reorderSections(
        { orders: [{ id: 'a', position: 0 }, { id: 'b', position: 1 }] },
        'admin-1',
      );
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.homepageSectionInstance.update).toHaveBeenCalledTimes(2);
    });
  });

  // ─── Global Styles ──────────────────────────────────────────────────────

  describe('updateStyles', () => {
    it('upserts the singleton row', async () => {
      prisma.globalStorefrontStyles.upsert.mockResolvedValue({
        id: 'singleton',
        negativeSpace: 2,
        typographyFlow: 1,
      });

      const result = await service.updateStyles({ negativeSpace: 2 }, 'admin-1');

      expect(result.negativeSpace).toBe(2);
      const args = prisma.globalStorefrontStyles.upsert.mock.calls[0][0] as {
        where: { id: string };
      };
      expect(args.where.id).toBe('singleton');
    });
  });
});
