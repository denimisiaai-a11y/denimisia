import { z } from 'zod';

export const manualReturnSchema = z.object({
  orderId: z.string().cuid().nullable(),
  customerName: z.string().min(1).max(255),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().min(6).max(40),
  reason: z.enum([
    'DEFECTIVE',
    'DAMAGED_IN_TRANSIT',
    'NOT_AS_DESCRIBED',
    'WRONG_ITEM_SENT',
    'WRONG_SIZE',
    'CHANGED_MIND',
  ]),
  faultOverride: z.enum(['US', 'CUSTOMER']).optional(),
  description: z.string().max(2000).optional(),
  photos: z.array(z.string().url()).max(5).default([]),
  items: z
    .array(
      z
        .object({
          orderItemId: z.string().cuid().nullable(),
          manualProductName: z.string().max(255).optional(),
          manualSku: z.string().max(120).optional(),
          manualSize: z.string().max(40).optional(),
          manualColor: z.string().max(80).optional(),
          manualUnitPrice: z.number().nonnegative().optional(),
          quantity: z.number().int().positive(),
          // For bundle-line referenced order items, the admin must
          // identify which constituent is being returned. See the
          // matching field in CreateReturnDto for semantics.
          bundleComponentVariantId: z.string().cuid().optional(),
        })
        .refine(
          (i) =>
            i.orderItemId !== null ||
            (i.manualProductName && i.manualUnitPrice !== undefined),
          {
            message:
              'Each item must reference an orderItemId OR provide manualProductName + manualUnitPrice',
          },
        ),
    )
    .min(1),
});

export type ManualReturnDto = z.infer<typeof manualReturnSchema>;
