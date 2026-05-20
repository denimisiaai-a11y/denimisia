import { z } from 'zod';

export const createReturnSchema = z.object({
  orderId: z.string().cuid(),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().min(6).optional(),
  reason: z.enum([
    'DEFECTIVE',
    'DAMAGED_IN_TRANSIT',
    'NOT_AS_DESCRIBED',
    'WRONG_ITEM_SENT',
    'WRONG_SIZE',
    'CHANGED_MIND',
  ]),
  description: z.string().max(2000).optional(),
  photos: z.array(z.string().url()).max(5).default([]),
  items: z
    .array(
      z.object({
        orderItemId: z.string().cuid(),
        quantity: z.number().int().positive(),
        // Bundle order items carry multiple constituents inside their
        // snapshot.items[] array; per-component returns must name WHICH
        // constituent is being returned. This is the constituent's
        // ProductVariant.id (the canonical key stored at order time —
        // see BundleSnapshotItem.variantId in orders.service.ts).
        // Required on bundle-line items, forbidden on regular variant
        // lines — enforced in returns.service.ts.
        bundleComponentVariantId: z.string().cuid().optional(),
      }),
    )
    .min(1),
});

export type CreateReturnDto = z.infer<typeof createReturnSchema>;
