// ─── Image variants (shared with apps/api + storefront) ─────────────────────
//
// SERVER (apps/api/.../uploads.service.ts) reads IMAGE_VARIANTS to know what
// sizes to generate from each upload, then builds R2 keys as
// `<original-basename>-<variantName>.webp`.
//
// CLIENT (apps/web/lib/image.ts) reads IMAGE_VARIANT_NAMES + the same naming
// convention to synthesize variant URLs at render time. Widths are
// server-only; clients just request by name.
//
// Adding a variant: append here, all consumers pick it up via TypeScript.
// Removing/renaming: pre-existing variant files in R2 keep their old URLs;
// storefronts will 404 them and fall back to the original via
// <ImageWithFallback>.

export const IMAGE_VARIANTS = {
  // Catalog thumbnails (mini lists, search results). 240px width covers
  // ~120px display at 2x DPR.
  thumb: { width: 240, quality: 70 },
  // Storefront product cards. ~360px on a 1440px desktop, 50vw on phones.
  // 480w hits both at >=1x.
  card: { width: 480, quality: 80 },
  // Product detail main image. ~720px desktop, 100vw phones. 1024w covers
  // desktop 1x and phone 2x without over-fetching.
  hero: { width: 1024, quality: 82 },
} as const;

export type ImageVariantName = keyof typeof IMAGE_VARIANTS;

export const IMAGE_VARIANT_NAMES: readonly ImageVariantName[] = Object.keys(
  IMAGE_VARIANTS,
) as ImageVariantName[];

// ─── Product Types ───────────────────────────────────────────────────────────

export interface ProductVariant {
  id: string;
  sku: string;
  size: string;
  color: string;
  material?: string | null;
  stock: number;
  price: string;
  images: string[];
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: string;
  compareAtPrice: string | null;
  images: string[];
  tags: string[];
  isFeatured?: boolean;
  isTrending?: boolean;
  isNewArrival?: boolean;
  showStarBadge?: boolean;
  category: { id?: string; name: string; slug: string };
  variants: ProductVariant[];
}

export interface ProductListResponse {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Category Types ──────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  children?: Category[];
}

// ─── Collection Types ────────────────────────────────────────────────────────

export interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
}

// ─── User Types ──────────────────────────────────────────────────────────────

export type UserRole = 'CUSTOMER' | 'MANAGER' | 'SUPPORT_STAFF' | 'ADMIN' | 'SUPER_ADMIN';

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: UserRole;
}

// ─── Address Types ───────────────────────────────────────────────────────────

export interface Address {
  id: string;
  userId: string;
  label: string;
  firstName: string;
  lastName: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string | null;
  isDefault: boolean;
}

// ─── Order Types ─────────────────────────────────────────────────────────────

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'RETURNED';

export interface OrderItem {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  unitPrice: string;
  product: { name: string; slug: string; images: string[] };
}

export interface Order {
  id: string;
  userId: string;
  status: OrderStatus;
  total: string;
  items: OrderItem[];
  createdAt: string;
}

// ─── Review Types ────────────────────────────────────────────────────────────

export interface Review {
  id: string;
  userId: string;
  productId: string;
  rating: number;
  title: string | null;
  body: string;
  images: string[];
  isVerified: boolean;
  helpfulCount: number;
  user: { firstName: string; lastName: string };
  createdAt: string;
}

// ─── API Response ────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total: number;
    page: number;
    limit: number;
  };
}
