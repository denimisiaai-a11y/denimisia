import { Test, TestingModule } from '@nestjs/testing';
import { CmsController } from './cms.controller';
import { CmsService } from './cms.service';

describe('CmsController', () => {
  let controller: CmsController;
  let cmsService: Record<string, jest.Mock>;

  beforeEach(async () => {
    cmsService = {
      // banners
      listActiveBanners: jest.fn(),
      createBanner:      jest.fn(),
      updateBanner:      jest.fn(),
      deleteBanner:      jest.fn(),
      // homepage sections
      listAllSections:    jest.fn(),
      listActiveSections: jest.fn(),
      createSection:      jest.fn(),
      updateSection:      jest.fn(),
      deleteSection:      jest.fn(),
      reorderSections:    jest.fn(),
      // styles
      getStyles:    jest.fn(),
      updateStyles: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CmsController],
      providers: [{ provide: CmsService, useValue: cmsService }],
    }).compile();

    controller = module.get(CmsController);
  });

  // ─── Public ─────────────────────────────────────────────────────────────

  it('listBanners delegates to service', async () => {
    cmsService.listActiveBanners.mockResolvedValue([]);
    await controller.listBanners();
    expect(cmsService.listActiveBanners).toHaveBeenCalled();
  });

  it('listActiveHomepageSections delegates to service', async () => {
    cmsService.listActiveSections.mockResolvedValue([]);
    await controller.listActiveHomepageSections();
    expect(cmsService.listActiveSections).toHaveBeenCalled();
  });

  it('getStyles delegates to service', async () => {
    cmsService.getStyles.mockResolvedValue({ id: 'singleton' });
    await controller.getStyles();
    expect(cmsService.getStyles).toHaveBeenCalled();
  });

  // ─── Admin homepage composer ────────────────────────────────────────────

  it('listAllHomepageSections delegates to service', async () => {
    cmsService.listAllSections.mockResolvedValue([]);
    await controller.listAllHomepageSections();
    expect(cmsService.listAllSections).toHaveBeenCalled();
  });

  it('createHomepageSection passes the user id', async () => {
    cmsService.createSection.mockResolvedValue({ id: 's-1' });
    await controller.createHomepageSection(
      { type: 'HERO' } as never,
      { user: { id: 'admin-1' } } as never,
    );
    expect(cmsService.createSection).toHaveBeenCalledWith(
      { type: 'HERO' },
      'admin-1',
    );
  });

  it('updateHomepageSection passes id, dto, and user', async () => {
    cmsService.updateSection.mockResolvedValue({ id: 's-1' });
    await controller.updateHomepageSection(
      's-1',
      { isActive: false } as never,
      { user: { id: 'admin-1' } } as never,
    );
    expect(cmsService.updateSection).toHaveBeenCalledWith(
      's-1',
      { isActive: false },
      'admin-1',
    );
  });

  it('deleteHomepageSection passes id and user', async () => {
    cmsService.deleteSection.mockResolvedValue(undefined);
    await controller.deleteHomepageSection(
      's-1',
      { user: { id: 'admin-1' } } as never,
    );
    expect(cmsService.deleteSection).toHaveBeenCalledWith('s-1', 'admin-1');
  });

  it('reorderHomepageSections passes orders and user', async () => {
    cmsService.reorderSections.mockResolvedValue([]);
    await controller.reorderHomepageSections(
      { orders: [{ id: 'a', position: 0 }] } as never,
      { user: { id: 'admin-1' } } as never,
    );
    expect(cmsService.reorderSections).toHaveBeenCalledWith(
      { orders: [{ id: 'a', position: 0 }] },
      'admin-1',
    );
  });

  it('updateStyles passes dto and user', async () => {
    cmsService.updateStyles.mockResolvedValue({ id: 'singleton' });
    await controller.updateStyles(
      { negativeSpace: 2 } as never,
      { user: { id: 'admin-1' } } as never,
    );
    expect(cmsService.updateStyles).toHaveBeenCalledWith(
      { negativeSpace: 2 },
      'admin-1',
    );
  });

  // ─── Admin banners (passthrough) ────────────────────────────────────────

  it('createBanner delegates', async () => {
    cmsService.createBanner.mockResolvedValue({ id: 'b-1' });
    await controller.createBanner({ title: 'X' } as never);
    expect(cmsService.createBanner).toHaveBeenCalledWith({ title: 'X' });
  });

  it('updateBanner delegates', async () => {
    cmsService.updateBanner.mockResolvedValue({ id: 'b-1' });
    await controller.updateBanner('b-1', { title: 'Y' } as never);
    expect(cmsService.updateBanner).toHaveBeenCalledWith('b-1', { title: 'Y' });
  });

  it('deleteBanner delegates', async () => {
    cmsService.deleteBanner.mockResolvedValue(undefined);
    await controller.deleteBanner('b-1');
    expect(cmsService.deleteBanner).toHaveBeenCalledWith('b-1');
  });
});
