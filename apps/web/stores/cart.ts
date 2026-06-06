'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  image: string;
  color: string;
  size: string;
  price: number;
  qty: number;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  _hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: CartItem) => void;
  removeItem: (variantId: string) => void;
  updateQty: (variantId: string, qty: number) => void;
  clearCart: () => void;
  total: () => number;
  count: () => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      _hasHydrated: false,

      setHasHydrated: (v) => set({ _hasHydrated: v }),

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),

      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.variantId === item.variantId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.variantId === item.variantId ? { ...i, qty: i.qty + item.qty } : i,
              ),
            };
          }
          return { items: [...state.items, item] };
        }),

      removeItem: (variantId) =>
        set((state) => ({
          items: state.items.filter((i) => i.variantId !== variantId),
        })),

      updateQty: (variantId, qty) =>
        set((state) => ({
          items:
            qty <= 0
              ? state.items.filter((i) => i.variantId !== variantId)
              : state.items.map((i) =>
                  i.variantId === variantId ? { ...i, qty } : i,
                ),
        })),

      clearCart: () => set({ items: [] }),
      total: () => get().items.reduce((sum, i) => sum + i.price * i.qty, 0),
      count: () => get().items.reduce((sum, i) => sum + i.qty, 0),
    }),
    {
      name: 'denimisia-cart',
      version: 1,
      // v1: drop any persisted items with a 0 price. A pre-fix bug stored
      // variant.price (commonly null → 0) instead of the resolved unit price,
      // so old carts rendered ৳0 at checkout. Clearing them forces a clean
      // re-add at the correct price.
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<CartState>;
        if (version < 1 && Array.isArray(state.items)) {
          return {
            ...state,
            items: state.items.filter((i) => i.price > 0),
          } as CartState;
        }
        return state as CartState;
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
