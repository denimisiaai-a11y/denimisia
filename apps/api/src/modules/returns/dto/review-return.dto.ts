import { z } from 'zod';

export const reviewReturnSchema = z.object({
  reviewerNotes: z.string().max(2000).optional(),
});
export type ReviewReturnDto = z.infer<typeof reviewReturnSchema>;
