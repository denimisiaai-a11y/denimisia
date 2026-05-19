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
      }),
    )
    .min(1),
});

export type CreateReturnDto = z.infer<typeof createReturnSchema>;
