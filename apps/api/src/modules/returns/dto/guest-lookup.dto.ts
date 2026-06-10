import { z } from 'zod';

export const guestLookupSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(6),
});
export type GuestLookupDto = z.infer<typeof guestLookupSchema>;
