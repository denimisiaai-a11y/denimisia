import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CampaignsService', () => {
  let service: CampaignsService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  const mockCampaign = {
    id: 'camp-1',
    name: 'Summer Sale',
    slug: 'summer-sale',
    type: 'SEASONAL',
    isActive: true,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
  };

  beforeEach(async () => {
    prisma = {
      campaign: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      product: {
        findUnique: jest.fn(),
      },
      campaignProduct: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      campaignUsage: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(CampaignsService);
  });

  describe('findActive', () => {
    it('paginates active, in-window campaigns', async () => {
      prisma.campaign.findMany.mockResolvedValue([mockCampaign]);
      prisma.campaign.count.mockResolvedValue(1);

      const result = await service.findActive(1, 20);

      expect(result.success).toBe(true);
      expect(result.data.campaigns).toEqual([mockCampaign]);
      expect(result.data.total).toBe(1);
    });
  });

  describe('findOnePublic', () => {
    it('uses findFirst with an active+in-window filter', async () => {
      prisma.campaign.findFirst.mockResolvedValue(mockCampaign);

      const result = await service.findOnePublic('camp-1');

      expect(result.data.id).toBe('camp-1');
      const callArgs = prisma.campaign.findFirst.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(callArgs.where.id).toBe('camp-1');
      expect(callArgs.where.isActive).toBe(true);
    });

    it('throws NotFoundException when no campaign matches', async () => {
      prisma.campaign.findFirst.mockResolvedValue(null);

      await expect(service.findOnePublic('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates when slug is unique', async () => {
      prisma.campaign.findUnique.mockResolvedValue(null);
      prisma.campaign.create.mockResolvedValue(mockCampaign);

      const result = await service.create({
        name: 'Summer Sale',
        slug: 'summer-sale',
        type: 'SEASONAL',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        isActive: true,
      } as never);

      expect(result.success).toBe(true);
      expect(prisma.campaign.create).toHaveBeenCalled();
    });

    it('rejects duplicate slugs with ConflictException', async () => {
      prisma.campaign.findUnique.mockResolvedValue(mockCampaign);

      await expect(
        service.create({
          name: 'X',
          slug: 'summer-sale',
          type: 'SEASONAL',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
        } as never),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('throws NotFoundException when campaign is missing', async () => {
      prisma.campaign.findUnique.mockResolvedValue(null);

      await expect(
        service.update('missing', { name: 'X' } as never),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates only supplied fields', async () => {
      prisma.campaign.findUnique.mockResolvedValueOnce(mockCampaign);
      prisma.campaign.update.mockResolvedValue({
        ...mockCampaign,
        name: 'Spring',
      });

      const result = await service.update('camp-1', {
        name: 'Spring',
      } as never);

      expect(result.data.name).toBe('Spring');
      const callArgs = prisma.campaign.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(callArgs.data).toEqual({ name: 'Spring' });
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when campaign is missing', async () => {
      prisma.campaign.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes when campaign exists', async () => {
      prisma.campaign.findUnique.mockResolvedValue(mockCampaign);
      prisma.campaign.delete.mockResolvedValue(mockCampaign);

      await service.remove('camp-1');

      expect(prisma.campaign.delete).toHaveBeenCalledWith({
        where: { id: 'camp-1' },
      });
    });
  });

  describe('addProduct', () => {
    it('rejects when campaign is missing', async () => {
      prisma.campaign.findUnique.mockResolvedValue(null);

      await expect(
        service.addProduct('camp-x', {
          productId: 'prod-1',
          discountType: 'PERCENTAGE',
          discountValue: 10,
        } as never),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when product is missing', async () => {
      prisma.campaign.findUnique.mockResolvedValue(mockCampaign);
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.addProduct('camp-1', {
          productId: 'p-missing',
          discountType: 'PERCENTAGE',
          discountValue: 10,
        } as never),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when the pair already exists', async () => {
      prisma.campaign.findUnique.mockResolvedValue(mockCampaign);
      prisma.product.findUnique.mockResolvedValue({
        id: 'p-1',
        isActive: true,
        deletedAt: null,
      });
      prisma.campaignProduct.findUnique.mockResolvedValue({ id: 'cp-1' });

      await expect(
        service.addProduct('camp-1', {
          productId: 'p-1',
          discountType: 'PERCENTAGE',
          discountValue: 10,
        } as never),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects when the product is soft-deleted', async () => {
      prisma.campaign.findUnique.mockResolvedValue(mockCampaign);
      prisma.product.findUnique.mockResolvedValue({
        id: 'p-1',
        isActive: true,
        deletedAt: new Date(),
      });

      await expect(
        service.addProduct('camp-1', {
          productId: 'p-1',
          discountType: 'PERCENTAGE',
          discountValue: 10,
        } as never),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCampaignPrice', () => {
    it('returns null when no campaign applies', async () => {
      prisma.campaignProduct.findFirst.mockResolvedValue(null);

      const result = await service.getCampaignPrice('p-1', 100);

      expect(result).toBeNull();
    });

    it('applies a PERCENTAGE discount', async () => {
      prisma.campaignProduct.findFirst.mockResolvedValue({
        discountType: 'PERCENTAGE',
        discountValue: 20,
      });

      const result = await service.getCampaignPrice('p-1', 100);

      expect(result).toBe(80);
    });

    it('applies a FIXED_AMOUNT discount, floored at zero', async () => {
      prisma.campaignProduct.findFirst.mockResolvedValue({
        discountType: 'FIXED_AMOUNT',
        discountValue: 150,
      });

      const result = await service.getCampaignPrice('p-1', 100);

      expect(result).toBe(0);
    });
  });
});
