import { z } from 'zod';

export const approveReturnSchema = z.object({
  carrier: z.string().max(120).optional(),
  pickupAddress: z
    .object({
      line1: z.string().min(1),
      line2: z.string().optional(),
      city: z.string().min(1),
      area: z.string().optional(),
      postalCode: z.string().optional(),
      contactName: z.string().min(1),
      contactPhone: z.string().min(6),
    })
    .nullable()
    .optional(),
  approvalNotes: z.string().max(2000).optional(),
});
export type ApproveReturnDto = z.infer<typeof approveReturnSchema>;
