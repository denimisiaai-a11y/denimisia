import { z } from 'zod';

export const rejectReturnSchema = z.object({
  rejectionReason: z.string().min(1).max(2000),
});
export type RejectReturnDto = z.infer<typeof rejectReturnSchema>;
