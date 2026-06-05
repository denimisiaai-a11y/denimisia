import type { BotContext } from '../components/chat/chat.types';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${path}`);
  }
  const json = await res.json();
  return json.data as T;
}

// ─── Products ────────────────────────────────────────────────────────────────

export interface ProductVariant {
  // Optional CSS hex (e.g. "#94a2b2"). When present, the PDP color
  // selector paints a solid swatch in this color. Falls back to the
  // variant's first image when null/absent.
  colorHex?: string | null;
  id: string;
  size: string;
  color: string;
  price: string;
  stock: number;
  images: string[];
  sku: string;
}

export interface ActiveCampaignSummary {
  campaignId: string;
  campaignSlug: string;
  campaignName: string;
  campaignType: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';
  discountValue: number;
  finalPrice: number;
  savingsPercent: number;
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
  isFeatured: boolean;
  isTrending?: boolean;
  isNewArrival?: boolean;
  showStarBadge?: boolean;
  category: { name: string; slug: string };
  variants: ProductVariant[];
  _count: { reviews: number };
  // Populated server-side when the product is in an active campaign.
  // priceWithCampaign() in lib/utils turns this into card-ready price
  // + originalPrice pair.
  activeCampaign?: ActiveCampaignSummary | null;
}

export interface ProductListResponse {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function getProducts(params: {
  category?: string;
  categories?: string[];
  collection?: string;
  featured?: boolean;
  trending?: boolean;
  newArrival?: boolean;
  sort?: string;
  page?: number;
  limit?: number;
  minPrice?: string;
  maxPrice?: string;
  size?: string;
  color?: string;
} = {}): Promise<ProductListResponse> {
  const q = new URLSearchParams();
  if (params.category)   q.set('category', params.category);
  if (params.categories?.length) q.set('categories', params.categories.join(','));
  if (params.collection) q.set('collection', params.collection);
  if (params.featured)   q.set('featured', 'true');
  if (params.trending)   q.set('trending', 'true');
  if (params.newArrival) q.set('newArrival', 'true');
  if (params.sort)       q.set('sort', params.sort);
  if (params.page)       q.set('page', String(params.page));
  if (params.limit)      q.set('limit', String(params.limit));
  if (params.minPrice)   q.set('minPrice', params.minPrice);
  if (params.maxPrice)   q.set('maxPrice', params.maxPrice);
  if (params.size)       q.set('size', params.size);
  if (params.color)      q.set('color', params.color);
  return apiFetch<ProductListResponse>(`/products?${q}`);
}

export interface FacetCategory { name: string; slug: string; count: number }
export interface FacetValue { value: string; count: number }
export interface FacetsResponse {
  categories: FacetCategory[];
  sizes: FacetValue[];
  colors: FacetValue[];
  price: { min: number; max: number };
}

export function getProductFacets(): Promise<FacetsResponse> {
  return apiFetch<FacetsResponse>('/products/facets');
}

export function getProductBySlug(slug: string): Promise<Product> {
  return apiFetch<Product>(`/products/${slug}`);
}

export function getFeaturedProducts(): Promise<Product[]> {
  return apiFetch<Product[]>('/products/featured');
}

// ─── Categories ──────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  children: Category[];
}

export function getCategories(): Promise<Category[]> {
  return apiFetch<Category[]>('/categories');
}

export function getCategoryBySlug(slug: string): Promise<Category & { products: Product[] }> {
  return apiFetch<Category & { products: Product[] }>(`/categories/${slug}`);
}

// ─── Collections ─────────────────────────────────────────────────────────────

export interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
}

export function getCollections(): Promise<Collection[]> {
  return apiFetch<Collection[]>('/collections');
}

// ─── Bundles ──────────────────────────────────────────────────────────────────

export interface BundleItem {
  id: string;
  color: string;
  product: {
    name: string;
    slug: string;
    images: string[];
    price: string;
    description?: string | null;
  };
}

export interface Bundle {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  badgeText: string;
  bundlePrice: string | number;
  availableSizes: string[];
  isActive: boolean;
  items: BundleItem[];
}

export function getBundles(): Promise<Bundle[]> {
  return apiFetch<Bundle[]>('/bundles');
}

export function getBundleBySlug(slug: string): Promise<Bundle> {
  return apiFetch<Bundle>(`/bundles/${slug}`);
}

// ─── Authenticated API Helper ────────────────────────────────────────────────

/**
 * Thrown by authenticated fetch helpers when the API rejects a request with
 * 401: the NextAuth session cookie is still cryptographically valid (so
 * middleware lets the user through) but the API JWT stored inside it has
 * expired. Callers should bounce the user to /api/auth/expire to clear the
 * stale session rather than rendering a misleading empty/error state.
 */
export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired');
    this.name = 'SessionExpiredError';
  }
}

async function authFetch<T>(
  path: string,
  accessToken: string,
  options?: RequestInit,
): Promise<{ success: boolean; data?: T; error?: string; status?: number }> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...options?.headers,
    },
    signal: AbortSignal.timeout(5000),
  });
  const json = await res.json();
  if (!res.ok) {
    return {
      success: false,
      error: json.message ?? `API error ${res.status}`,
      status: res.status,
    };
  }
  return { success: true, data: json.data as T };
}

// ─── Users / Profile ─────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  /** Legacy singular field — may be present on older responses. */
  phone?: string | null;
  /** Task 4 / Task 14 shape: ordered list, newest first. */
  phones?: string[];
  role: string;
}

export function getProfile(accessToken: string) {
  return authFetch<UserProfile>('/users/me', accessToken);
}

export function updateProfile(
  userId: string,
  accessToken: string,
  data: { firstName?: string; lastName?: string; phone?: string },
) {
  return authFetch<UserProfile>('/users/me', accessToken, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ─── Addresses ───────────────────────────────────────────────────────────────

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

export interface AddressInput {
  label: string;
  firstName: string;
  lastName: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  isDefault?: boolean;
}

export function getAddresses(userId: string, accessToken: string) {
  return authFetch<Address[]>('/users/me/addresses', accessToken);
}

export function createAddress(userId: string, accessToken: string, data: AddressInput) {
  return authFetch<Address>('/users/me/addresses', accessToken, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateAddress(userId: string, addressId: string, accessToken: string, data: Partial<AddressInput>) {
  return authFetch<Address>(`/users/me/addresses/${addressId}`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteAddress(userId: string, addressId: string, accessToken: string) {
  return authFetch<void>(`/users/me/addresses/${addressId}`, accessToken, {
    method: 'DELETE',
  });
}

// ─── Wishlist ────────────────────────────────────────────────────────────────

export interface WishlistItem {
  id: string;
  productId: string;
  wishlistId: string;
  savedAtPrice: string | null;
  savedAtStock: number | null;
  createdAt: string;
  product?: Product;
}

export interface Wishlist {
  id: string;
  userId: string;
  items: WishlistItem[];
}

export async function getWishlist(accessToken: string): Promise<Wishlist | null> {
  try {
    const res = await authFetch<Wishlist>('/wishlist', accessToken);
    // 401 = stale API JWT. Propagate so the store can force a re-login
    // instead of silently showing an empty wishlist.
    if (!res.success && res.status === 401) throw new SessionExpiredError();
    return res.success ? res.data ?? null : null;
  } catch (e) {
    if (e instanceof SessionExpiredError) throw e;
    return null;
  }
}

export async function addWishlistItem(
  accessToken: string,
  productId: string,
): Promise<WishlistItem> {
  const res = await authFetch<WishlistItem>('/wishlist/items', accessToken, {
    method: 'POST',
    body: JSON.stringify({ productId }),
  });
  if (!res.success || !res.data) throw new Error(res.error ?? 'Failed to add to wishlist');
  return res.data;
}

export async function removeWishlistItem(
  accessToken: string,
  productId: string,
): Promise<void> {
  const res = await authFetch<void>(`/wishlist/items/${productId}`, accessToken, {
    method: 'DELETE',
  });
  if (!res.success) throw new Error(res.error ?? 'Failed to remove from wishlist');
}

export async function bulkAddWishlistItems(
  accessToken: string,
  productIds: string[],
): Promise<{ added: number; skipped: number }> {
  const res = await authFetch<{ added: number; skipped: number }>(
    '/wishlist/items/bulk',
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({ productIds }),
    },
  );
  if (!res.success || !res.data) {
    throw new Error(res.error ?? 'Failed to merge wishlist');
  }
  return res.data;
}

export async function createWishlistShareToken(
  accessToken: string,
): Promise<{ shareToken: string }> {
  const res = await authFetch<{ shareToken: string }>('/wishlist/share', accessToken, {
    method: 'POST',
  });
  if (!res.success || !res.data) {
    throw new Error(res.error ?? 'Failed to create share token');
  }
  return res.data;
}

export async function revokeWishlistShareToken(accessToken: string): Promise<void> {
  const res = await authFetch<void>('/wishlist/share', accessToken, {
    method: 'DELETE',
  });
  if (!res.success) {
    throw new Error(res.error ?? 'Failed to revoke share link');
  }
}

// ─── Returns ─────────────────────────────────────────────────────────────────

export type ReturnStatus =
  | 'REQUESTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'INSPECTING'
  | 'INSPECTED_PASS'
  | 'INSPECTED_FAIL'
  | 'RETURNED_TO_CUSTOMER'
  | 'REFUNDED'
  | 'CLOSED'
  | 'CANCELLED';

export type ReturnReason =
  | 'DEFECTIVE'
  | 'DAMAGED_IN_TRANSIT'
  | 'NOT_AS_DESCRIBED'
  | 'WRONG_ITEM_SENT'
  | 'WRONG_SIZE'
  | 'CHANGED_MIND';

export interface ReturnLineItem {
  id: string;
  quantity: number;
  inspectionResult: 'PASS' | 'FAIL' | null;
  // Bundle-component fields are populated only when this row represents
  // a returned constituent of a bundle order line. For regular variant
  // lines all four are null. See packages/database schema, ReturnItem.
  bundleComponentVariantId: string | null;
  bundleComponentName: string | null;
  bundleComponentSize: string | null;
  bundleComponentColor: string | null;
  orderItem: {
    id: string;
    quantity: number;
    unitPrice: string;
    product: { id: string; name: string; slug: string; images: string[] } | null;
  } | null;
}

export interface ReturnRecord {
  id: string;
  rtnNumber: string;
  status: ReturnStatus;
  reason: ReturnReason;
  fault: 'US' | 'CUSTOMER';
  description: string | null;
  photos: string[];
  refundAmount: string | null;
  refundMethod: 'CASH' | 'BANK_TRANSFER' | null;
  refundReference: string | null;
  customerShipsBack: boolean;
  slaDeadline: string;
  requestedAt: string;
  reviewedAt: string | null;
  approvedAt: string | null;
  receivedAt: string | null;
  inspectedAt: string | null;
  refundedAt: string | null;
  closedAt: string | null;
  items: ReturnLineItem[];
  order: { id: string; total: string; status: string } | null;
}

export interface CreateReturnPayload {
  orderId: string;
  guestEmail?: string;
  guestPhone?: string;
  reason: ReturnReason;
  description?: string;
  photos: string[];
  items: {
    orderItemId: string;
    quantity: number;
    // For bundle order lines, the customer must identify which
    // constituent is being returned. Matches the variantId stored in
    // OrderItem.snapshot.items[] at order time.
    bundleComponentVariantId?: string;
  }[];
}

// Returns-specific fetch: surfaces server validation messages
// (`json.message`) on 4xx/5xx instead of the generic "API N: path" used
// by `apiFetch`. Bypasses Next.js cache (returns are mutable and
// user-scoped). Keeps the same `{ success, data }` envelope.
async function returnsFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    // 401 on an *authenticated* returns call = stale API JWT → surface a typed
    // error so the account page can force re-login. Guest calls (no Authorization
    // header) keep the plain Error so a guest with no session never sees a
    // misleading "Session expired".
    const isAuthed = Boolean(
      (options?.headers as Record<string, string> | undefined)?.Authorization,
    );
    if (res.status === 401 && isAuthed) throw new SessionExpiredError();
    const message =
      (json && typeof json.message === 'string' && json.message) ||
      (json && typeof json.error === 'string' && json.error) ||
      `Request failed (${res.status})`;
    throw new Error(message);
  }
  return (json.data ?? json) as T;
}

export function createReturn(
  payload: CreateReturnPayload,
  accessToken?: string,
): Promise<{ id: string; rtnNumber: string }> {
  return returnsFetch<{ id: string; rtnNumber: string }>('/returns', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
}

export function getMyReturns(accessToken: string): Promise<ReturnRecord[]> {
  return returnsFetch<ReturnRecord[]>('/returns/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function getReturnByRtn(
  rtnNumber: string,
  accessToken: string,
): Promise<ReturnRecord> {
  return returnsFetch<ReturnRecord>(`/returns/${rtnNumber}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function lookupReturnAsGuest(
  rtnNumber: string,
  email: string,
  phone: string,
): Promise<ReturnRecord> {
  return returnsFetch<ReturnRecord>(`/returns/${rtnNumber}/lookup`, {
    method: 'POST',
    body: JSON.stringify({ email, phone }),
  });
}

export function cancelReturn(
  rtnNumber: string,
  opts: { accessToken?: string; email?: string; phone?: string; reason?: string },
): Promise<{ success: boolean }> {
  return returnsFetch<{ success: boolean }>(`/returns/${rtnNumber}/cancel`, {
    method: 'POST',
    body: JSON.stringify({
      email: opts.email,
      phone: opts.phone,
      reason: opts.reason,
    }),
    headers: opts.accessToken
      ? { Authorization: `Bearer ${opts.accessToken}` }
      : undefined,
  });
}

// ─── Bot / Product Finder ────────────────────────────────────────────────────
//
// Server wraps responses in { success, data }. We unwrap here so the chat
// components see the BotMessageReply shape directly. The bot endpoints don't
// use the 60s revalidate cache (conversational state must be fresh per call).

export interface BotProductReply {
  id: string;
  name: string;
  slug: string;
  price: number | string;
  images: string[];
}

export interface BotMessageReplyShape {
  message: string;
  products?: BotProductReply[];
  chips?: string[];
  input?: 'text' | 'numeric';
  nextContext: BotContext;
}

export async function sendBotMessage(
  text: string,
  context: BotContext,
): Promise<BotMessageReplyShape> {
  const res = await fetch(`${API}/bot/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, context }),
  });
  if (!res.ok) {
    throw new Error(`Bot request failed: ${res.status}`);
  }
  const json = await res.json();
  // Server uses TransformInterceptor → { success: true, data: BotMessageReply }
  return (json.data ?? json) as BotMessageReplyShape;
}

export interface SizeChartRow {
  sizeKey: string;
  dimension: string;
  bodyValueIn: number;
  garmentValueIn: number;
}

export async function getProductSizeChart(
  productId: string,
): Promise<{ rows: SizeChartRow[] }> {
  const res = await fetch(`${API}/products/${productId}/size-chart`);
  if (!res.ok) {
    throw new Error(`Size chart fetch failed: ${res.status}`);
  }
  const json = await res.json();
  return (json.data ?? json) as { rows: SizeChartRow[] };
}

export async function getSilhouettes(): Promise<
  import('@repo/fit-engine').SilhouetteData[]
> {
  const res = await fetch(`${API}/silhouettes`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    throw new Error(`Silhouettes fetch failed: ${res.status}`);
  }
  const json = await res.json();
  return (json.data ?? json) as import('@repo/fit-engine').SilhouetteData[];
}

// ─── Promo Banners ────────────────────────────────────────────────────────────

export type PromoBannerPosition = 'popup' | 'top' | 'middle' | 'bottom';
export type PromoPopupSize = 'compact' | 'medium' | 'large' | 'fullscreen';

export interface PromoBannerRecord {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string | null;
  readonly image: string;
  readonly link: string | null;
  readonly position: PromoBannerPosition;
  readonly isActive: boolean;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly popupSize: PromoPopupSize;
  readonly popupSizeMobile: PromoPopupSize;
  readonly textOverlay: boolean;
  readonly popupWidthPct: number;
  readonly popupHeightPct: number;        // 0 = auto
  readonly popupWidthPctMobile: number;
  readonly popupHeightPctMobile: number;  // 0 = auto
  readonly imageFit: 'cover' | 'contain';
  readonly createdAt: string;
}

/**
 * Fetches active banners from the CMS. The API already filters by date
 * window + isActive=true, so the storefront just trusts the response.
 * Failure-tolerant: returns [] when the API is down so the storefront
 * still renders.
 */
export async function fetchPromoBanners(): Promise<PromoBannerRecord[]> {
  try {
    const res = await fetch(`${API}/cms/banners`, {
      next: { revalidate: 60, tags: ['promo-banners'] },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const data = json.data ?? json;
    return Array.isArray(data) ? (data as PromoBannerRecord[]) : [];
  } catch {
    return [];
  }
}
