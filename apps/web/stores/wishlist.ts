'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  getWishlist,
  addWishlistItem,
  removeWishlistItem,
  bulkAddWishlistItems,
  SessionExpiredError,
  type WishlistItem,
} from '@/lib/api';

interface WishlistState {
  // Server-synced state (populated for authenticated users)
  items: WishlistItem[];
  productIds: Set<string>;
  hydrated: boolean;

  // Guest state (persisted to localStorage)
  guestProductIds: string[];

  // UI state
  pendingIds: Set<string>;

  // Actions
  hydrate: (accessToken: string | null) => Promise<void>;
  mergeGuestIntoServer: (accessToken: string) => Promise<void>;

  isIn: (productId: string, isAuthenticated: boolean) => boolean;
  isPending: (productId: string) => boolean;
  count: (isAuthenticated: boolean) => number;

  toggle: (
    accessToken: string | null,
    productId: string,
  ) => Promise<'added' | 'removed'>;
  reset: () => void;
  resetServer: () => void;
}

const emptySet = () => new Set<string>();

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      productIds: emptySet(),
      hydrated: false,
      guestProductIds: [],
      pendingIds: emptySet(),

      hydrate: async (accessToken) => {
        if (!accessToken) {
          set({ items: [], productIds: emptySet(), hydrated: true });
          return;
        }
        let wishlist;
        try {
          wishlist = await getWishlist(accessToken);
        } catch (e) {
          // Stale API JWT — force re-login instead of showing an empty wishlist.
          if (e instanceof SessionExpiredError && typeof window !== 'undefined') {
            window.location.href = '/api/auth/expire';
            return;
          }
          wishlist = null;
        }
        const items = wishlist?.items ?? [];
        set({
          items,
          productIds: new Set(items.map((i) => i.productId)),
          hydrated: true,
        });
      },

      mergeGuestIntoServer: async (accessToken) => {
        const guestIds = get().guestProductIds;
        if (guestIds.length === 0) return;
        try {
          await bulkAddWishlistItems(accessToken, guestIds);
        } catch {
          // If merge fails, keep guest IDs for a later retry
          return;
        }
        set({ guestProductIds: [] });
        let wishlist;
        try {
          wishlist = await getWishlist(accessToken);
        } catch {
          // Token went stale mid-merge; leave the page-load hydrate() to
          // handle the re-login redirect rather than bouncing right after login.
          return;
        }
        const items = wishlist?.items ?? [];
        set({
          items,
          productIds: new Set(items.map((i) => i.productId)),
          hydrated: true,
        });
      },

      isIn: (productId, isAuthenticated) => {
        if (isAuthenticated) return get().productIds.has(productId);
        return get().guestProductIds.includes(productId);
      },

      isPending: (productId) => get().pendingIds.has(productId),

      count: (isAuthenticated) =>
        isAuthenticated ? get().productIds.size : get().guestProductIds.length,

      toggle: async (accessToken, productId) => {
        // Guest toggle — local-only, persisted
        if (!accessToken) {
          const list = get().guestProductIds;
          if (list.includes(productId)) {
            set({ guestProductIds: list.filter((id) => id !== productId) });
            return 'removed';
          }
          set({ guestProductIds: [...list, productId] });
          return 'added';
        }

        // Authenticated toggle — optimistic server round-trip
        if (get().productIds.has(productId)) {
          const prevIds = get().productIds;
          const prevItems = get().items;
          const next = new Set(prevIds);
          next.delete(productId);
          const pending = new Set(get().pendingIds);
          pending.add(productId);
          set({
            productIds: next,
            items: prevItems.filter((i) => i.productId !== productId),
            pendingIds: pending,
          });
          try {
            await removeWishlistItem(accessToken, productId);
            set((state) => {
              const p = new Set(state.pendingIds);
              p.delete(productId);
              return { pendingIds: p };
            });
            return 'removed';
          } catch (err) {
            set((state) => {
              const p = new Set(state.pendingIds);
              p.delete(productId);
              return { productIds: prevIds, items: prevItems, pendingIds: p };
            });
            throw err;
          }
        }

        const prevIds = get().productIds;
        const optimistic = new Set(prevIds);
        optimistic.add(productId);
        const pending = new Set(get().pendingIds);
        pending.add(productId);
        set({ productIds: optimistic, pendingIds: pending });
        try {
          const created = await addWishlistItem(accessToken, productId);
          set((state) => {
            const p = new Set(state.pendingIds);
            p.delete(productId);
            return { items: [...state.items, created], pendingIds: p };
          });
          return 'added';
        } catch (err) {
          set((state) => {
            const next = new Set(state.productIds);
            next.delete(productId);
            const p = new Set(state.pendingIds);
            p.delete(productId);
            return { productIds: next, pendingIds: p };
          });
          throw err;
        }
      },

      reset: () =>
        set({
          items: [],
          productIds: emptySet(),
          hydrated: false,
          pendingIds: emptySet(),
        }),

      resetServer: () =>
        set({
          items: [],
          productIds: emptySet(),
          hydrated: false,
        }),
    }),
    {
      name: 'denimisia-wishlist',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ guestProductIds: state.guestProductIds }),
    },
  ),
);
