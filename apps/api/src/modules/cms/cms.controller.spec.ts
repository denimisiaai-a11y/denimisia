import { Test, TestingModule } from '@nestjs/testing';
import { CmsController } from './cms.controller';
import { CmsService } from './cms.service';

describe('CmsController', () => {
  let controller: CmsController;
  let cmsService: Record<string, jest.Mock>;

  beforeEach(async () => {
    cmsService = {
      listSections: jest.fn(),
      getSectionByKey: jest.fn(),
      listActiveBanners: jest.fn(),
      listPublishedPosts: jest.fn(),
      getPostBySlug: jest.fn(),
      createSection: jest.fn(),
      updateSection: jest.fn(),
      deleteSection: jest.fn(),
      createBanner: jest.fn(),
      updateBanner: jest.fn(),
      deleteBanner: jest.fn(),
      createPost: jest.fn(),
      updatePost: jest.fn(),
      deletePost: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CmsController],
      providers: [{ provide: CmsService, useValue: cmsService }],
    }).compile();

    controller = module.get(CmsController);
  });

  // Public routes
  it('should list sections', async () => {
    cmsService.listSections.mockResolvedValue([]);
    await controller.listSections();
    expect(cmsService.listSections).toHaveBeenCalled();
  });

  it('should get section by key', async () => {
    cmsService.getSectionByKey.mockResolvedValue({ id: 's-1' });
    await controller.getSectionByKey('hero');
    expect(cmsService.getSectionByKey).toHaveBeenCalledWith('hero');
  });

  it('should list banners', async () => {
    cmsService.listActiveBanners.mockResolvedValue([]);
    await controller.listBanners();
    expect(cmsService.listActiveBanners).toHaveBeenCalled();
  });

  it('should list blog posts', async () => {
    cmsService.listPublishedPosts.mockResolvedValue({ posts: [] });
    await controller.listBlogPosts('1', '10');
    expect(cmsService.listPublishedPosts).toHaveBeenCalledWith(1, 10);
  });

  it('should get blog post', async () => {
    cmsService.getPostBySlug.mockResolvedValue({ id: 'bp-1' });
    await controller.getBlogPost('hello');
    expect(cmsService.getPostBySlug).toHaveBeenCalledWith('hello');
  });

  // Admin sections
  it('should create section', async () => {
    cmsService.createSection.mockResolvedValue({ id: 's-1' });
    await controller.createSection({ key: 'hero' } as any);
    expect(cmsService.createSection).toHaveBeenCalledWith({ key: 'hero' });
  });

  it('should update section', async () => {
    cmsService.updateSection.mockResolvedValue({ id: 's-1' });
    await controller.updateSection('s-1', { title: 'Hero' } as any);
    expect(cmsService.updateSection).toHaveBeenCalledWith('s-1', {
      title: 'Hero',
    });
  });

  it('should delete section', async () => {
    cmsService.deleteSection.mockResolvedValue(undefined);
    await controller.deleteSection('s-1');
    expect(cmsService.deleteSection).toHaveBeenCalledWith('s-1');
  });

  // Admin banners
  it('should create banner', async () => {
    cmsService.createBanner.mockResolvedValue({ id: 'b-1' });
    await controller.createBanner({ title: 'Sale' } as any);
    expect(cmsService.createBanner).toHaveBeenCalledWith({ title: 'Sale' });
  });

  it('should update banner', async () => {
    cmsService.updateBanner.mockResolvedValue({ id: 'b-1' });
    await controller.updateBanner('b-1', { title: 'Updated' } as any);
    expect(cmsService.updateBanner).toHaveBeenCalledWith('b-1', {
      title: 'Updated',
    });
  });

  it('should delete banner', async () => {
    cmsService.deleteBanner.mockResolvedValue(undefined);
    await controller.deleteBanner('b-1');
    expect(cmsService.deleteBanner).toHaveBeenCalledWith('b-1');
  });

  // Admin blog posts
  it('should create blog post', async () => {
    cmsService.createPost.mockResolvedValue({ id: 'bp-1' });
    await controller.createBlogPost({ id: 'user-1' }, {
      title: 'Hello',
    } as any);
    expect(cmsService.createPost).toHaveBeenCalledWith('user-1', {
      title: 'Hello',
    });
  });

  it('should update blog post', async () => {
    cmsService.updatePost.mockResolvedValue({ id: 'bp-1' });
    await controller.updateBlogPost('bp-1', { title: 'Updated' } as any);
    expect(cmsService.updatePost).toHaveBeenCalledWith('bp-1', {
      title: 'Updated',
    });
  });

  it('should delete blog post', async () => {
    cmsService.deletePost.mockResolvedValue(undefined);
    await controller.deleteBlogPost('bp-1');
    expect(cmsService.deletePost).toHaveBeenCalledWith('bp-1');
  });
});
