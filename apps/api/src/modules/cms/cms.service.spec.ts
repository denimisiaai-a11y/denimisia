import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CmsService } from './cms.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CmsService', () => {
  let service: CmsService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  beforeEach(async () => {
    prisma = {
      homepageSection: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      banner: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      blogPost: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CmsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(CmsService);
  });

  // ─── Homepage Sections ─────────────────────────────────────────────────

  describe('listSections', () => {
    it('returns active sections ordered by position', async () => {
      prisma.homepageSection.findMany.mockResolvedValue([
        { id: 's-1', key: 'hero', position: 0 },
      ]);

      const result = await service.listSections();

      expect(prisma.homepageSection.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { position: 'asc' },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('getSectionByKey', () => {
    it('returns the section when it exists', async () => {
      prisma.homepageSection.findUnique.mockResolvedValue({
        id: 's-1',
        key: 'hero',
      });

      const result = await service.getSectionByKey('hero');

      expect(result.key).toBe('hero');
    });

    it('throws NotFoundException when the section is missing', async () => {
      prisma.homepageSection.findUnique.mockResolvedValue(null);

      await expect(service.getSectionByKey('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateSection', () => {
    it('throws NotFoundException when the section does not exist', async () => {
      prisma.homepageSection.findUnique.mockResolvedValue(null);

      await expect(
        service.updateSection('missing', { title: 'New' } as never),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteSection', () => {
    it('throws NotFoundException when the section does not exist', async () => {
      prisma.homepageSection.findUnique.mockResolvedValue(null);

      await expect(service.deleteSection('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── Banners ───────────────────────────────────────────────────────────

  describe('listActiveBanners', () => {
    it('returns banners in active window ordered by createdAt desc', async () => {
      prisma.banner.findMany.mockResolvedValue([{ id: 'b-1' }]);

      const result = await service.listActiveBanners();

      expect(prisma.banner.findMany).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  describe('updateBanner / deleteBanner', () => {
    it('updateBanner throws NotFoundException when missing', async () => {
      prisma.banner.findUnique.mockResolvedValue(null);

      await expect(
        service.updateBanner('missing', { title: 'X' } as never),
      ).rejects.toThrow(NotFoundException);
    });

    it('deleteBanner throws NotFoundException when missing', async () => {
      prisma.banner.findUnique.mockResolvedValue(null);

      await expect(service.deleteBanner('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── Blog Posts ────────────────────────────────────────────────────────

  describe('listPublishedPosts', () => {
    it('paginates and filters drafts via isPublished:true', async () => {
      prisma.blogPost.findMany.mockResolvedValue([{ id: 'bp-1' }]);
      prisma.blogPost.count.mockResolvedValue(1);

      const result = await service.listPublishedPosts(1, 10);

      expect(result.posts).toHaveLength(1);
      expect(result.total).toBe(1);
      const findManyArgs = prisma.blogPost.findMany.mock.calls[0][0] as {
        where: { isPublished: boolean };
      };
      const countArgs = prisma.blogPost.count.mock.calls[0][0] as {
        where: { isPublished: boolean };
      };
      expect(findManyArgs.where.isPublished).toBe(true);
      expect(countArgs.where.isPublished).toBe(true);
    });
  });

  describe('getPostBySlug', () => {
    it('uses findFirst + isPublished:true (drafts hidden from public)', async () => {
      prisma.blogPost.findFirst.mockResolvedValue({
        id: 'bp-1',
        slug: 'hello',
        isPublished: true,
      });

      const result = await service.getPostBySlug('hello');

      expect(result.slug).toBe('hello');
      const args = prisma.blogPost.findFirst.mock.calls[0][0] as {
        where: { isPublished: boolean };
      };
      expect(args.where.isPublished).toBe(true);
    });

    it('throws NotFoundException when no matching published post', async () => {
      prisma.blogPost.findFirst.mockResolvedValue(null);

      await expect(service.getPostBySlug('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getPostBySlugAdmin', () => {
    it('returns draft posts (no isPublished filter)', async () => {
      prisma.blogPost.findUnique.mockResolvedValue({
        id: 'bp-1',
        slug: 'draft',
        isPublished: false,
      });

      const result = await service.getPostBySlugAdmin('draft');

      expect(result.isPublished).toBe(false);
    });
  });

  describe('createPost', () => {
    it('sets publishedAt when isPublished is true', async () => {
      prisma.blogPost.create.mockResolvedValue({ id: 'bp-new' });

      await service.createPost('author-1', {
        title: 't',
        slug: 's',
        body: 'b',
        isPublished: true,
      } as never);

      const args = prisma.blogPost.create.mock.calls[0][0] as {
        data: { publishedAt: Date | null };
      };
      expect(args.data.publishedAt).toBeInstanceOf(Date);
    });

    it('leaves publishedAt null when isPublished is false', async () => {
      prisma.blogPost.create.mockResolvedValue({ id: 'bp-new' });

      await service.createPost('author-1', {
        title: 't',
        slug: 's',
        body: 'b',
        isPublished: false,
      } as never);

      const args = prisma.blogPost.create.mock.calls[0][0] as {
        data: { publishedAt: Date | null };
      };
      expect(args.data.publishedAt).toBeNull();
    });
  });

  describe('updatePost', () => {
    it('sets publishedAt on first publish transition', async () => {
      prisma.blogPost.findUnique.mockResolvedValue({
        id: 'bp-1',
        publishedAt: null,
      });
      prisma.blogPost.update.mockResolvedValue({ id: 'bp-1' });

      await service.updatePost('bp-1', { isPublished: true } as never);

      const args = prisma.blogPost.update.mock.calls[0][0] as {
        data: { publishedAt?: Date };
      };
      expect(args.data.publishedAt).toBeInstanceOf(Date);
    });

    it('throws NotFoundException when post is missing', async () => {
      prisma.blogPost.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePost('missing', { title: 'X' } as never),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deletePost', () => {
    it('throws NotFoundException when post is missing', async () => {
      prisma.blogPost.findUnique.mockResolvedValue(null);

      await expect(service.deletePost('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
