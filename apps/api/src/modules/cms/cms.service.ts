import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSectionDto,
  UpdateSectionDto,
  CreateBannerDto,
  UpdateBannerDto,
  CreateBlogPostDto,
  UpdateBlogPostDto,
} from './cms.dto';

@Injectable()
export class CmsService {
  constructor(private prisma: PrismaService) {}

  // ─── Homepage Sections ──────────────────────────────────────────────────────

  async listSections() {
    return this.prisma.homepageSection.findMany({
      where: { isActive: true },
      orderBy: { position: 'asc' },
    });
  }

  async getSectionByKey(key: string) {
    const section = await this.prisma.homepageSection.findUnique({
      where: { key },
    });
    if (!section) throw new NotFoundException('Section not found');
    return section;
  }

  async createSection(dto: CreateSectionDto) {
    return this.prisma.homepageSection.create({
      data: {
        ...dto,
        content: dto.content as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async updateSection(id: string, dto: UpdateSectionDto) {
    const section = await this.prisma.homepageSection.findUnique({
      where: { id },
    });
    if (!section) throw new NotFoundException('Section not found');
    return this.prisma.homepageSection.update({
      where: { id },
      data: {
        ...dto,
        content: dto.content as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async deleteSection(id: string) {
    const section = await this.prisma.homepageSection.findUnique({
      where: { id },
    });
    if (!section) throw new NotFoundException('Section not found');
    await this.prisma.homepageSection.delete({ where: { id } });
  }

  // ─── Banners ────────────────────────────────────────────────────────────────

  async listActiveBanners() {
    const now = new Date();
    return this.prisma.banner.findMany({
      where: {
        isActive: true,
        OR: [
          { startDate: null, endDate: null },
          { startDate: { lte: now }, endDate: { gte: now } },
          { startDate: { lte: now }, endDate: null },
          { startDate: null, endDate: { gte: now } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createBanner(dto: CreateBannerDto) {
    return this.prisma.banner.create({ data: dto });
  }

  async updateBanner(id: string, dto: UpdateBannerDto) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner not found');
    return this.prisma.banner.update({ where: { id }, data: dto });
  }

  async deleteBanner(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner not found');
    await this.prisma.banner.delete({ where: { id } });
  }

  // ─── Blog Posts ─────────────────────────────────────────────────────────────

  async listPublishedPosts(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [posts, total] = await Promise.all([
      this.prisma.blogPost.findMany({
        where: { isPublished: true },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
        include: { author: { select: { firstName: true, lastName: true } } },
      }),
      this.prisma.blogPost.count({ where: { isPublished: true } }),
    ]);
    return { posts, total, page, limit };
  }

  /**
   * Public blog post fetch — MUST filter unpublished drafts.
   * For admin/editor access to drafts, use getPostBySlugAdmin.
   */
  async getPostBySlug(slug: string) {
    const post = await this.prisma.blogPost.findFirst({
      where: { slug, isPublished: true },
      include: { author: { select: { firstName: true, lastName: true } } },
    });
    if (!post) throw new NotFoundException('Blog post not found');
    return post;
  }

  /** Admin-only: returns posts regardless of isPublished state. */
  async getPostBySlugAdmin(slug: string) {
    const post = await this.prisma.blogPost.findUnique({
      where: { slug },
      include: { author: { select: { firstName: true, lastName: true } } },
    });
    if (!post) throw new NotFoundException('Blog post not found');
    return post;
  }

  async createPost(authorId: string, dto: CreateBlogPostDto) {
    return this.prisma.blogPost.create({
      data: {
        ...dto,
        authorId,
        publishedAt: dto.isPublished ? new Date() : null,
      },
    });
  }

  async updatePost(id: string, dto: UpdateBlogPostDto) {
    const post = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Blog post not found');

    const data: Record<string, unknown> = { ...dto };
    if (dto.isPublished && !post.publishedAt) {
      data.publishedAt = new Date();
    }

    return this.prisma.blogPost.update({ where: { id }, data });
  }

  async deletePost(id: string) {
    const post = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Blog post not found');
    await this.prisma.blogPost.delete({ where: { id } });
  }
}
