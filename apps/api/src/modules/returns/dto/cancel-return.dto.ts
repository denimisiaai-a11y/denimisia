import { z } from 'zod';

export const cancelReturnSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(6).optional(),
  reason: z.string().max(500).optional(),
});
export type CancelReturnDto = z.infer<typeof cancelReturnSchema>;
