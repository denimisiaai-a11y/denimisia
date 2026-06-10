import { z } from 'zod';

export const issueRefundSchema = z.object({
  amount: z.number().positive().finite(),
  method: z.enum(['CASH', 'BANK_TRANSFER']),
  reference: z.string().min(1).max(255),
  notes: z.string().max(2000).optional(),
  overrideFromFail: z.boolean().default(false),
});
export type IssueRefundDto = z.infer<typeof issueRefundSchema>;
