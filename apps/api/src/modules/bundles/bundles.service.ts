import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBundleDto } from './dto/create-bundle.dto';
import { UpdateBundleDto } from './dto/update-bundle.dto';
import { BundleItemInputDto } from './dto/bundle-item-input.dto';

const BUNDLE_INCLUDE = {
  items: {
    include: {
      product: {
        include: { variants: true },
      },
    },
  },
} as const;

@Injectable()
export class BundlesService {
  constructor(private prisma: PrismaService) {}

  async findAllActive() {
    return this.prisma.productBundle.findMany({
      where: { isActive: true },
      include: BUNDLE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findBySlug(slug: string) {
    const bundle = await this.prisma.productBundle.findUnique({
      where: { slug },
      include: BUNDLE_INCLUDE,
    });
    if (!bundle) throw new NotFoundException('Bundle not found');
    return bundle;
  }

  async create(dto: CreateBundleDto) {
    // TOCTOU: assertBundleIntegrity + create are not wrapped in a single
    // transaction. A variant deleted between the check and the write would
    // leave the bundle pointing at a missing variant at checkout time. For
    // admin-only writes the window is narrow enough to defer; Slice 4 will
    // wrap the order-creation path in a SERIALIZABLE transaction that
    // re-validates per-line, which covers the same risk at the consumer end.
    await this.assertBundleIntegrity(dto.items, dto.availableSizes);
    const { items, ...bundleData } = dto;
    return this.prisma.productBundle.create({
      data: {
        ...bundleData,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            color: item.color,
          })),
        },
      },
      include: BUNDLE_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateBundleDto) {
    const bundle = await this.findById(id);
    // If availableSizes is being narrowed or widened, re-run the integrity
    // check so we never allow a state where the bundle promises a size
    // that no constituent variant can fulfill.
    if (dto.availableSizes) {
      const itemInputs = bundle.items.map((item) => ({
        productId: item.productId,
        color: item.color,
      }));
      await this.assertBundleIntegrity(itemInputs, dto.availableSizes);
    }
    return this.prisma.productBundle.update({
      where: { id },
      data: dto,
      include: BUNDLE_INCLUDE,
    });
  }

  async delete(id: string) {
    await this.findById(id);
    await this.prisma.bundleItem.deleteMany({ where: { bundleId: id } });
    await this.prisma.productBundle.delete({ where: { id } });
  }

  async addItems(bundleId: string, items: BundleItemInputDto[]) {
    const bundle = await this.findById(bundleId);
    const combined: BundleItemInputDto[] = [
      ...bundle.items.map((item) => ({
        productId: item.productId,
        color: item.color,
      })),
      ...items,
    ];
    await this.assertBundleIntegrity(combined, bundle.availableSizes);
    await this.prisma.bundleItem.createMany({
      data: items.map((item) => ({
        bundleId,
        productId: item.productId,
        color: item.color,
      })),
      skipDuplicates: true,
    });
    return this.findById(bundleId);
  }

  async removeItem(bundleId: string, productId: string, color: string) {
    await this.prisma.bundleItem.delete({
      where: {
        bundleId_productId_color: { bundleId, productId, color },
      },
    });
  }

  private async findById(id: string) {
    const bundle = await this.prisma.productBundle.findUnique({
      where: { id },
      include: BUNDLE_INCLUDE,
    });
    if (!bundle) throw new NotFoundException('Bundle not found');
    return bundle;
  }

  // Every (item.productId, item.color, size) tuple must resolve to a real
  // ProductVariant. Without this gate, a customer could pick "size L" on
  // a bundle whose Black Tee has no L variant and the checkout would fail
  // mid-transaction. Also rejects duplicate (productId, color) and
  // duplicate-size input at create time — the DB unique index catches
  // those too, but a clean 400 beats a Prisma error pass-through.
  private async assertBundleIntegrity(
    items: BundleItemInputDto[],
    availableSizes: string[],
  ): Promise<void> {
    // Defensive: DTO @ArrayMinSize(1) on availableSizes covers Create + Update,
    // but addItems passes bundle.availableSizes directly. A legacy bundle with
    // empty availableSizes (deactivated seed bundle reactivated without filling
    // sizes) would make the nested loop below vacuous and an item could be
    // added that no checkout could ever pick a size for.
    if (availableSizes.length === 0) {
      throw new BadRequestException(
        'Bundle has no availableSizes; set availableSizes before adding items',
      );
    }
    const uniqueSizes = new Set(availableSizes);
    if (uniqueSizes.size !== availableSizes.length) {
      throw new BadRequestException('availableSizes contains duplicates');
    }
    const pairs = new Set<string>();
    for (const item of items) {
      const key = `${item.productId}:${item.color}`;
      if (pairs.has(key)) {
        throw new BadRequestException(
          `Duplicate item: product ${item.productId} in color ${item.color} appears more than once`,
        );
      }
      pairs.add(key);
    }
    // OR of exact (productId, color, size) tuples — fetches only the
    // (item × size) variants we care about, not the cross-product of
    // (productIds × colors × sizes). Matches the cart-side pattern in
    // CartService.assertBundleStock and keeps the SQL aligned with the
    // semantic intent.
    const variantQueries = items.flatMap((item) =>
      availableSizes.map((size) => ({
        productId: item.productId,
        color: item.color,
        size,
      })),
    );
    const variants = await this.prisma.productVariant.findMany({
      where: {
        OR: variantQueries.map((q) => ({
          productId: q.productId,
          color: q.color,
          size: q.size,
          deletedAt: null,
        })),
      },
      select: { productId: true, color: true, size: true },
    });
    const variantKey = (p: string, c: string, s: string): string =>
      `${p}:${c}:${s}`;
    const variantSet = new Set(
      variants.map((v) => variantKey(v.productId, v.color, v.size)),
    );
    const missing: string[] = [];
    for (const item of items) {
      for (const size of availableSizes) {
        if (!variantSet.has(variantKey(item.productId, item.color, size))) {
          missing.push(`product ${item.productId} ${item.color}/${size}`);
        }
      }
    }
    if (missing.length > 0) {
      throw new ConflictException(
        `Bundle requires variants that do not exist: ${missing.join('; ')}`,
      );
    }
  }
}
