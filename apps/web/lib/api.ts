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
  id: string;
  size: string;
  color: string;
  price: string;
  stock: number;
  images: string[];
  sku: string;
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
  product: { name: string; slug: string; images: string[] };
}

export interface Bundle {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  badgeText: string;
  isActive: boolean;
  items: BundleItem[];
}

export function getBundles(): Promise<Bundle[]> {
  return apiFetch<Bundle[]>('/bundles');
}

// ─── Authenticated API Helper ────────────────────────────────────────────────

async function authFetch<T>(
  path: string,
  accessToken: string,
  options?: RequestInit,
): Promise<{ success: boolean; data?: T; error?: string }> {
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
    return { success: false, error: json.message ?? `API error ${res.status}` };
  }
  return { success: true, data: json.data as T };
}

// ─── Users / Profile ─────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
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
    return res.success ? res.data ?? null : null;
  } catch {
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

// ─── Blog ────────────────────────────────────────────────────────────────────

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  coverImage: string | null;
  tags: string[];
  publishedAt: string | null;
  author: { firstName: string; lastName: string };
}

export interface BlogListResponse {
  posts: BlogPost[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function getBlogPosts(page = 1, limit = 9): Promise<BlogListResponse> {
  return apiFetch<BlogListResponse>(`/cms/blog?page=${page}&limit=${limit}`);
}

export function getBlogPostBySlug(slug: string): Promise<BlogPost> {
  return apiFetch<BlogPost>(`/cms/blog/${slug}`);
}
