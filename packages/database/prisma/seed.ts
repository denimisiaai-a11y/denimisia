import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { seedSilhouettes } from './seeds/silhouettes';

const prisma = new PrismaClient();

// ─── Helper ───────────────────────────────────────────────────────────────────
const price = (s: string) => parseFloat(s.replace(/[৳,]/g, ''));

async function main() {
  console.log('🌱 Seeding Denimisia database...');

  // ─── Users ────────────────────────────────────────────────────────────────
  const hash = await bcrypt.hash('Password123!', 12);
  await prisma.user.upsert({
    where: { email: 'admin@denimisia.com' },
    update: {},
    create: { email: 'admin@denimisia.com', passwordHash: hash, firstName: 'Admin', lastName: 'Denimisia', role: 'ADMIN', isVerified: true },
  });
  await prisma.user.upsert({
    where: { email: 'customer@denimisia.com' },
    update: {},
    create: { email: 'customer@denimisia.com', passwordHash: hash, firstName: 'Test', lastName: 'Customer', role: 'CUSTOMER', isVerified: true },
  });
  console.log('✅ Users');

  // ─── Categories ───────────────────────────────────────────────────────────
  const womens = await prisma.category.upsert({
    where: { slug: 'womens' },
    update: {},
    create: { name: "Women's", slug: 'womens', description: "Women's clothing" },
  });
  const wideleg = await prisma.category.upsert({
    where: { slug: 'womens-wide-leg' },
    update: {},
    create: { name: 'Wide Leg', slug: 'womens-wide-leg', parentId: womens.id },
  });
  const baggy = await prisma.category.upsert({
    where: { slug: 'womens-baggy' },
    update: {},
    create: { name: 'Baggy', slug: 'womens-baggy', parentId: womens.id },
  });
  const flare = await prisma.category.upsert({
    where: { slug: 'womens-flare' },
    update: {},
    create: { name: 'Flare & Boot Cut', slug: 'womens-flare', parentId: womens.id },
  });
  const barrel = await prisma.category.upsert({
    where: { slug: 'womens-barrel' },
    update: {},
    create: { name: 'Barrel Fit', slug: 'womens-barrel', parentId: womens.id },
  });
  const cargo = await prisma.category.upsert({
    where: { slug: 'womens-cargo' },
    update: {},
    create: { name: 'Cargo', slug: 'womens-cargo', parentId: womens.id },
  });
  // Men's — placeholder, empty for now
  await prisma.category.upsert({
    where: { slug: 'mens' },
    update: {},
    create: { name: "Men's", slug: 'mens', description: 'Coming soon' },
  });
  console.log('✅ Categories');

  // ─── Collections ──────────────────────────────────────────────────────────
  const newArrivals = await prisma.collection.upsert({
    where: { slug: 'new-arrivals' },
    update: {},
    create: { name: 'New Arrivals', slug: 'new-arrivals', description: 'Just landed.' },
  });
  const bestsellers = await prisma.collection.upsert({
    where: { slug: 'bestsellers' },
    update: {},
    create: { name: 'Bestsellers', slug: 'bestsellers', description: 'Our most-loved styles.' },
  });
  const wideLegCol = await prisma.collection.upsert({
    where: { slug: 'wide-leg' },
    update: {},
    create: { name: 'Wide Leg', slug: 'wide-leg', description: 'Relaxed, sweeping wide-leg silhouettes.' },
  });
  const baggyCol = await prisma.collection.upsert({
    where: { slug: 'baggy' },
    update: {},
    create: { name: 'Baggy Fit', slug: 'baggy', description: 'Oversized and effortless.' },
  });
  console.log('✅ Collections');

  // ─── Products ─────────────────────────────────────────────────────────────
  // Local placeholder images — cycle through available product images
  const PRODUCT_IMAGES = [
    '/images/product-bella.jpg',
    '/images/product-cyra.jpg',
    '/images/product-dira.jpg',
    '/images/product-lana.jpg',
    '/images/product-zoey.jpg',
  ];
  const CDN = '/images';
  let imgIndex = 0;
  const SIZES = ['XS', 'S', 'M', 'L', 'XL'];

  const nextImage = () => PRODUCT_IMAGES[imgIndex++ % PRODUCT_IMAGES.length];

  const makeVariants = (colors: { color: string; sku: string; img: string; price: number; compareAt?: number }[]) =>
    colors.flatMap((c) =>
      SIZES.map((size, i) => ({
        size,
        color: c.color,
        sku: `${c.sku}-${size}`,
        price: c.price,
        stock: [12, 20, 24, 18, 10][i],
        images: [nextImage()],
      })),
    );

  const products = [
    // ── Wide Leg ──────────────────────────────────────────────────────────────
    {
      name: '6 Ganding High Waist Baggy Wide-Leg Denim',
      slug: '6-ganding-high-waist-baggy-wide-leg-denim',
      description: 'Designed for a modern oversized fashion statement. The high waist construction enhances body shape while the relaxed wide-leg opening creates a bold, flowing silhouette. Made from premium non-stretch denim.',
      price: 999, compareAtPrice: 1590,
      categoryId: wideleg.id, isFeatured: true,
      tags: ['wide-leg', 'baggy', 'high-waist', 'non-stretch', 'bestseller'],
      collections: [bestsellers.id, wideLegCol.id, baggyCol.id],
      variants: makeVariants([
        { color: 'Light Tint Blue', sku: '21003-LTN', img: `${CDN}/21003/LTN-600x800.jpg`, price: 999, compareAt: 1590 },
        { color: 'Ash Black',       sku: '21003-ASH', img: `${CDN}/ASH_BLK-4-600x800.jpg`, price: 999, compareAt: 1590 },
        { color: 'Mid Tint Blue',   sku: '21003-MTN', img: `${CDN}/21003/MTN-600x800.jpg`, price: 999, compareAt: 1590 },
      ]),
    },
    {
      name: 'Super Baggy Wide Leg Denim Jeans',
      slug: 'super-baggy-wide-leg-denim-jeans',
      description: 'Step into modern oversized fashion. The high waist design flatters every figure while the super baggy wide leg creates a dramatic statement. Crafted from premium denim with a comfortable fit.',
      price: 1099, compareAtPrice: 1680,
      categoryId: baggy.id, isFeatured: true,
      tags: ['super-baggy', 'wide-leg', 'high-waist', 'oversized'],
      collections: [newArrivals.id, baggyCol.id],
      variants: makeVariants([
        { color: 'Black',          sku: '21022-BLK', img: `${CDN}/21022/21022_BLK-1-600x800.jpg`, price: 1099, compareAt: 1680 },
        { color: 'Mid Tint Blue',  sku: '21022-MTN', img: `${CDN}/21022/MTN-2-600x800.jpg`,       price: 1099, compareAt: 1680 },
        { color: 'Light Tint Blue',sku: '21022-LTN', img: `${CDN}/21022/LTN-1-600x800.jpg`,       price: 1099, compareAt: 1680 },
      ]),
    },
    {
      name: 'Bow Embroidery High Waist Baggy Wide-Leg Jeans',
      slug: 'bow-embroidery-high-waist-baggy-wide-leg-jeans',
      description: 'A playful bow embroidery detail elevates this wide-leg silhouette. High waist construction with a relaxed baggy wide-leg fit — designed for those who love effortless bold style.',
      price: 1099, compareAtPrice: 1590,
      categoryId: baggy.id, isFeatured: true,
      tags: ['embroidery', 'baggy', 'wide-leg', 'high-waist', 'bow'],
      collections: [newArrivals.id, baggyCol.id],
      variants: makeVariants([
        { color: 'Dark Tint Blue', sku: '21021-DTN', img: `${CDN}/21021/DTN-1-600x800.jpg`, price: 1099, compareAt: 1590 },
        { color: 'Ash Black',      sku: '21021-ASH', img: `${CDN}/21021/ASH-600x800.jpg`,   price: 1099, compareAt: 1590 },
        { color: 'Mid Blue',       sku: '21021-MBA', img: `${CDN}/21021/MBA-1-600x800.jpg`, price: 1099, compareAt: 1590 },
        { color: 'Mid Tint Blue',  sku: '21021-MTN', img: `${CDN}/21021/MTN-1-600x800.jpg`, price: 1099, compareAt: 1590 },
      ]),
    },
    {
      name: 'Side Bow Embroidery Women Casual Jeans',
      slug: 'side-bow-embroidery-women-casual-jeans',
      description: 'A subtle side bow embroidery adds a feminine touch to this casual wide-leg style. Crafted for everyday comfort with a fashionable wide silhouette.',
      price: 1099, compareAtPrice: 1590,
      categoryId: baggy.id, isFeatured: false,
      tags: ['embroidery', 'wide-leg', 'casual', 'bow'],
      collections: [newArrivals.id],
      variants: makeVariants([
        { color: 'Ash Black', sku: '21026-ASH', img: `${CDN}/21026/ASH-1-600x800.jpg`, price: 1099, compareAt: 1590 },
        { color: 'Mid Blue',  sku: '21026-MBA', img: `${CDN}/21026/MBA-1-600x800.jpg`, price: 1099, compareAt: 1590 },
      ]),
    },
    {
      name: 'Comfy Wide-Leg Denim Pant',
      slug: 'comfy-wide-leg-denim-pant',
      description: 'All-day comfort meets effortless style. The relaxed wide-leg cut and soft denim fabric make these the go-to pants for everything from casual outings to weekend errands.',
      price: 899, compareAtPrice: 1490,
      categoryId: wideleg.id, isFeatured: true,
      tags: ['wide-leg', 'comfortable', 'everyday', 'soft'],
      collections: [bestsellers.id, wideLegCol.id],
      variants: makeVariants([
        { color: 'Light Blue',    sku: '41011-LBA', img: `${CDN}/41011/LBA-1-600x800.jpg`, price: 899, compareAt: 1490 },
        { color: 'Mid Tint Blue', sku: '41011-MTN', img: `${CDN}/41011/MTN-1-600x800.jpg`, price: 899, compareAt: 1490 },
        { color: 'Ash Black',     sku: '41011-ASH', img: `${CDN}/41011/ASH-1-600x800.jpg`, price: 899, compareAt: 1490 },
      ]),
    },
    {
      name: 'Blue Vibe Stretchable Wide-Leg Denim',
      slug: 'blue-vibe-stretchable-wide-leg-denim',
      description: 'Crafted with premium stretch fabric for all-day ease. A modern wide-leg silhouette with a comfortable mid-rise waist — the perfect blend of comfort and style.',
      price: 899, compareAtPrice: 1490,
      categoryId: wideleg.id, isFeatured: false,
      tags: ['wide-leg', 'stretch', 'comfortable', 'versatile'],
      collections: [wideLegCol.id, bestsellers.id],
      variants: makeVariants([
        { color: 'Light Tint Blue', sku: '3016-LTN', img: `${CDN}/3016/LTN-1-600x800.jpg`, price: 899, compareAt: 1490 },
        { color: 'Light Blue',      sku: '3016-LBA', img: `${CDN}/3016/LBA-2-600x800.jpg`, price: 899, compareAt: 1490 },
        { color: 'Mid Blue',        sku: '3016-MBA', img: `${CDN}/3016/MBA-2-600x800.jpg`, price: 899, compareAt: 1490 },
      ]),
    },
    {
      name: 'Aura Classic Wide-Leg Jeans',
      slug: 'aura-classic-wide-leg-jeans',
      description: 'Timeless wardrobe essential. Crafted for modern women who value comfort with refined style, the Aura Classic features a relaxed wide-leg silhouette perfect for any occasion.',
      price: 799, compareAtPrice: 1490,
      categoryId: wideleg.id, isFeatured: true,
      tags: ['classic', 'wide-leg', 'versatile', 'everyday'],
      collections: [bestsellers.id, wideLegCol.id],
      variants: makeVariants([
        { color: 'Ash',       sku: '3018-ASH', img: `${CDN}/3018/Re-size/ASH-600x800.png`,       price: 799, compareAt: 1490 },
        { color: 'Brown',     sku: '3018-BRN', img: `${CDN}/3018/Re-size/Brown-2-600x800.png`,    price: 799, compareAt: 1490 },
        { color: 'Chocolate', sku: '3018-CHC', img: `${CDN}/3018/Re-size/chocolate-2-600x800.png`,price: 799, compareAt: 1490 },
      ]),
    },
    {
      name: 'Urban Star Wide Leg Non-Stretchy Denim',
      slug: 'urban-star-wide-leg-non-stretchy-denim',
      description: 'A structured, non-stretch denim with a wide-leg opening for a clean, tailored look. The Urban Star offers that effortlessly cool everyday aesthetic.',
      price: 799, compareAtPrice: 1490,
      categoryId: wideleg.id, isFeatured: false,
      tags: ['wide-leg', 'non-stretch', 'urban', 'structured'],
      collections: [wideLegCol.id],
      variants: makeVariants([
        { color: 'Ash Black', sku: '3027-ASH', img: `${CDN}/3027/ASH-1-600x800.jpg`, price: 799, compareAt: 1490 },
        { color: 'Dark Blue', sku: '3027-DBL', img: `${CDN}/3027/DBL-1-600x800.jpg`, price: 799, compareAt: 1490 },
      ]),
    },
    {
      name: 'Relaxed Flowy Wide Leg Denim',
      slug: 'relaxed-flowy-wide-leg-denim',
      description: 'Effortless drape meets everyday ease. This wide-leg denim features a relaxed, flowy cut in a washed finish for a laid-back yet polished look.',
      price: 899, compareAtPrice: 1490,
      categoryId: wideleg.id, isFeatured: false,
      tags: ['wide-leg', 'flowy', 'washed', 'relaxed'],
      collections: [wideLegCol.id, newArrivals.id],
      variants: makeVariants([
        { color: 'Washed Ash Black', sku: '3025-ASH', img: `${CDN}/3025/ASH-1-600x800.jpg`, price: 899, compareAt: 1490 },
        { color: 'Denim Blue',       sku: '3025-DBL', img: `${CDN}/3025/DBL-1-600x800.jpg`, price: 899, compareAt: 1490 },
      ]),
    },
    {
      name: 'Snowline High-Waist Button Pants',
      slug: 'snowline-high-waist-button-pants',
      description: 'Experience the perfect blend of style, comfort, and flexibility. Crafted from premium stretchy fabric for all-day ease, the Snowline features a clean high-waist with button front detail.',
      price: 899, compareAtPrice: 1690,
      categoryId: wideleg.id, isFeatured: false,
      tags: ['high-waist', 'button-front', 'stretchy', 'clean'],
      collections: [newArrivals.id],
      variants: makeVariants([
        { color: 'White', sku: '3020-WHT', img: `${CDN}/3020/3020-1-600x800.jpg`, price: 899, compareAt: 1690 },
      ]),
    },
    // ── Flare & Boot Cut ─────────────────────────────────────────────────────
    {
      name: 'Skyline Low-Waist Stretch Flare Jeans',
      slug: 'skyline-low-waist-stretch-flare-jeans',
      description: 'A retro-inspired low-waist flare with modern stretch fabric. The Skyline flare hugs the hips and fans out from the knee for a classic, flattering silhouette.',
      price: 899, compareAtPrice: 1590,
      categoryId: flare.id, isFeatured: true,
      tags: ['flare', 'low-waist', 'stretch', 'retro'],
      collections: [newArrivals.id],
      variants: makeVariants([
        { color: 'Light Blue', sku: '1052-LBA', img: `${CDN}/1052/LBA-1-600x800.jpg`, price: 899, compareAt: 1590 },
        { color: 'Dark Blue',  sku: '1052-DBL', img: `${CDN}/1052/DBL-1-600x800.jpg`, price: 899, compareAt: 1590 },
      ]),
    },
    // ── Barrel Fit ────────────────────────────────────────────────────────────
    {
      name: 'Heritage Curve Barrel Fit Mid-Waist Jeans',
      slug: 'heritage-curve-barrel-fit-mid-waist-jeans',
      description: 'The barrel fit — roomy through the hip and thigh, tapering slightly at the ankle. Non-stretch denim with a structured feel for a fashion-forward look.',
      price: 899, compareAtPrice: 1490,
      categoryId: barrel.id, isFeatured: true,
      tags: ['barrel-fit', 'mid-waist', 'non-stretch', 'curved'],
      collections: [newArrivals.id],
      variants: makeVariants([
        { color: 'Light Blue', sku: '2116-LBA', img: `${CDN}/2116/LBA-1-600x800.jpg`, price: 899, compareAt: 1490 },
        { color: 'Mid Blue',   sku: '2116-MBA', img: `${CDN}/2116/MBA-1-600x800.jpg`, price: 899, compareAt: 1490 },
      ]),
    },
    // ── Cargo ─────────────────────────────────────────────────────────────────
    {
      name: 'Urban Camo Wide Leg Cargo Denim',
      slug: 'urban-camo-wide-leg-cargo-denim',
      description: 'Utilitarian style meets wide-leg fashion. Featuring multiple pockets and a relaxed wide-leg cut, the Urban Camo Cargo is built for those who want function and style in equal measure.',
      price: 899, compareAtPrice: 1490,
      categoryId: cargo.id, isFeatured: false,
      tags: ['cargo', 'wide-leg', 'utility', 'pockets'],
      collections: [newArrivals.id],
      variants: makeVariants([
        { color: 'Army Green', sku: '6007-GRN', img: `${CDN}/6007/GRN-1-600x800.jpg`, price: 899, compareAt: 1490 },
        { color: 'Dark Blue',  sku: '6007-DBL', img: `${CDN}/6007/DBL-1-600x800.jpg`, price: 899, compareAt: 1490 },
      ]),
    },
    {
      name: 'Street Utility 6-Pocket Mid-Waist Cargo Denim',
      slug: 'street-utility-6-pocket-cargo-denim',
      description: 'Six functional pockets with a mid-waist cut. Street-ready cargo denim that keeps you organised without compromising on style.',
      price: 1099, compareAtPrice: 1690,
      categoryId: cargo.id, isFeatured: false,
      tags: ['cargo', '6-pocket', 'utility', 'mid-waist'],
      collections: [newArrivals.id],
      variants: makeVariants([
        { color: 'Mid Blue', sku: '6009-MBA', img: `${CDN}/6009/MBA-1-600x800.jpg`, price: 1099, compareAt: 1690 },
      ]),
    },
    // ── More Wide Leg ─────────────────────────────────────────────────────────
    {
      name: 'Nova High-Waist Denim Pants',
      slug: 'nova-high-waist-denim-pants',
      description: 'High-waist cut with a sleek, refined silhouette. The Nova is designed for the modern woman who wants a put-together look with everyday comfort.',
      price: 899, compareAtPrice: 1490,
      categoryId: wideleg.id, isFeatured: false,
      tags: ['high-waist', 'sleek', 'everyday'],
      collections: [wideLegCol.id],
      variants: makeVariants([
        { color: 'Mid Blue',         sku: '2108-MBA', img: `${CDN}/2108/MBA-1-600x800.jpg`, price: 899, compareAt: 1490 },
        { color: 'Super Light Blue', sku: '2108-SLB', img: `${CDN}/2108/SLB-1-600x800.jpg`, price: 899, compareAt: 1490 },
      ]),
    },
    {
      name: 'Skyline Wide-Leg Baggy Jeans',
      slug: 'skyline-wide-leg-baggy-jeans',
      description: 'The Skyline wide-leg baggy combines a relaxed fit through the hip with a sweeping wide-leg opening. Easy, everyday denim at its best.',
      price: 899, compareAtPrice: 1490,
      categoryId: wideleg.id, isFeatured: false,
      tags: ['wide-leg', 'baggy', 'everyday'],
      collections: [wideLegCol.id, baggyCol.id],
      variants: makeVariants([
        { color: 'Dark Blue', sku: '2109-DBL', img: `${CDN}/2109/DBL-1-600x800.jpg`, price: 899, compareAt: 1490 },
        { color: 'Mid Blue',  sku: '2109-MBA', img: `${CDN}/2109/MBA-1-600x800.jpg`, price: 899, compareAt: 1490 },
      ]),
    },
    {
      name: "Women's High Waist Balloon Jeans",
      slug: 'womens-high-waist-balloon-jeans',
      description: 'A voluminous balloon silhouette with a high-waist cut. Playful and fashion-forward, these statement jeans pair effortlessly with fitted tops.',
      price: 799, compareAtPrice: 1490,
      categoryId: baggy.id, isFeatured: false,
      tags: ['balloon', 'wide-leg', 'high-waist', 'statement'],
      collections: [newArrivals.id, baggyCol.id],
      variants: makeVariants([
        { color: 'Light Blue', sku: '9101-LBA', img: `${CDN}/9101/LBA-1-600x800.jpg`, price: 799, compareAt: 1490 },
        { color: 'Dark Blue',  sku: '9101-DBL', img: `${CDN}/9101/DBL-1-600x800.jpg`, price: 799, compareAt: 1490 },
      ]),
    },
  ];

  for (const p of products) {
    const { collections, variants, ...data } = p;
    const images = [...new Set(variants.map((v) => (v as any).images[0]).filter(Boolean))];

    const product = await prisma.product.upsert({
      where: { slug: data.slug },
      update: {},
      create: {
        ...data,
        images,
        variants: {
          create: variants.map((v) => {
            const { images: vImgs, ...vData } = v as any;
            return { ...vData, images: vImgs };
          }),
        },
      },
    });

    for (const collectionId of collections) {
      await prisma.collectionProduct.upsert({
        where: { collectionId_productId: { collectionId, productId: product.id } },
        update: {},
        create: { collectionId, productId: product.id },
      });
    }
  }
  console.log(`✅ Products (${products.length} base styles + variants)`);

  // ─── Discounts ────────────────────────────────────────────────────────────
  await prisma.discount.upsert({
    where: { code: 'WELCOME10' },
    update: {},
    create: { code: 'WELCOME10', type: 'PERCENTAGE', value: 10, minOrderAmount: 500, isActive: true },
  });
  await prisma.discount.upsert({
    where: { code: 'DENIM100' },
    update: {},
    create: { code: 'DENIM100', type: 'FIXED_AMOUNT', value: 100, minOrderAmount: 800, isActive: true },
  });
  console.log('✅ Discounts');

  // ─── Shipping ─────────────────────────────────────────────────────────────
  await prisma.shippingZone.upsert({
    where: { id: 'zone-bd' },
    update: {},
    create: {
      id: 'zone-bd',
      name: 'Bangladesh',
      countries: ['BD'],
      rates: {
        create: [
          { name: 'Standard Delivery', price: 80 },
          { name: 'Free Delivery', price: 0, minOrderAmount: 1500 },
        ],
      },
    },
  });
  console.log('✅ Shipping');

  // ─── Banners ──────────────────────────────────────────────────────────────
  await prisma.banner.createMany({
    skipDuplicates: true,
    data: [
      {
        title: 'Summer Sale — Up to 30% Off',
        subtitle: 'Premium denim at unbeatable prices. Limited time only.',
        image: '/images/hero-1.jpg',
        link: '/shop/women',
        position: 'top',
        isActive: true,
      },
      {
        title: 'SS25 Collection Now Live',
        subtitle: 'Fresh cuts, lighter washes, and new silhouettes for the season.',
        image: '/images/category-denims.jpg',
        link: '/collections/ss25',
        position: 'middle',
        isActive: true,
      },
    ],
  });
  console.log('✅ Banners');

  // ─── Homepage Section ────────────────────────────────────────────────────
  // NOTE: The legacy HomepageSection model was removed by the CMS Section
  // Composer feature (commit 8ee25a0). Homepage sections are now managed via
  // HomepageSectionInstance + SectionCuration, seeded separately when needed.
  // Leaving this block disabled to avoid crashing the seed.
  console.log('⏭️  Homepage section (skipped — legacy model removed)');

  // ─── Product Bundles ─────────────────────────────────────────────────────
  const allProducts = await prisma.product.findMany({ select: { id: true, slug: true }, take: 20 });
  const bundleSeeds = [
    {
      slug: 'heritage-bundle',
      name: 'Heritage Bundle',
      badgeText: 'BUY 2 JEANS + 1 PANJABI \u2022 GET 15% OFF',
      image: '/images/stitch/bundle-heritage.jpg',
      productSlugs: [
        'super-baggy-wide-leg-denim-jeans',
        'bow-embroidery-high-waist-baggy-wide-leg-jeans',
        'side-bow-embroidery-women-casual-jeans',
      ],
    },
    {
      slug: 'outerwear-set',
      name: 'Outerwear Set',
      badgeText: 'DUO JACKET PACK \u2022 10% OFF',
      image: '/images/stitch/bundle-outerwear.jpg',
      productSlugs: [
        'urban-camo-wide-leg-cargo-denim',
        'street-utility-6-pocket-cargo-denim',
      ],
    },
    {
      slug: 'core-basics',
      name: 'Core Basics',
      badgeText: '3-TEE ESSENTIALS \u2022 \u09F31000 SAVINGS',
      image: '/images/stitch/bundle-core.jpg',
      productSlugs: [
        'relaxed-flowy-wide-leg-denim',
        'snowline-high-waist-button-pants',
        'skyline-low-waist-stretch-flare-jeans',
      ],
    },
    {
      slug: 'curator-pack',
      name: 'The Curator Pack',
      badgeText: 'FULL LOOK \u2022 20% OFF',
      image: '/images/stitch/bundle-curator.jpg',
      productSlugs: [
        'heritage-curve-barrel-fit-mid-waist-jeans',
        'womens-high-waist-balloon-jeans',
        'super-baggy-wide-leg-denim-jeans',
      ],
    },
  ];

  for (const b of bundleSeeds) {
    // isActive defaults to false on a fresh seed and is left untouched on
    // re-seed. The LR-001 buyable-bundles migration deactivated the
    // existing seed bundles because they hold placeholder values for
    // bundlePrice + availableSizes + per-item color. Admin re-enables
    // each one in the Phase 2C bundle UI after filling in real values.
    const bundle = await prisma.productBundle.upsert({
      where: { slug: b.slug },
      update: { name: b.name, badgeText: b.badgeText, image: b.image },
      create: {
        slug: b.slug,
        name: b.name,
        badgeText: b.badgeText,
        image: b.image,
        isActive: false,
      },
    });
    for (const slug of b.productSlugs) {
      const product = allProducts.find((p) => p.slug === slug);
      if (!product) continue;
      await prisma.bundleItem.upsert({
        where: {
          bundleId_productId_color: {
            bundleId: bundle.id,
            productId: product.id,
            color: '',
          },
        },
        update: {},
        create: { bundleId: bundle.id, productId: product.id },
      });
    }
  }
  console.log(`\u2705 Product bundles (${bundleSeeds.length})`);

  await seedSilhouettes(prisma);

  console.log('\n🎉 Done!');
  console.log('  Admin:    admin@denimisia.com / Password123!');
  console.log('  Customer: customer@denimisia.com / Password123!');
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
