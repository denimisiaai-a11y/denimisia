import { z } from 'zod';

export const markReceivedSchema = z.object({
  trackingNumber: z.string().max(120).optional(),
  receivedNotes: z.string().max(2000).optional(),
});
export type MarkReceivedDto = z.infer<typeof markReceivedSchema>;
