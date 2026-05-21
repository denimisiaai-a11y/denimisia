import { z } from 'zod';

export const inspectReturnSchema = z.object({
  itemResults: z
    .array(
      z.object({
        returnItemId: z.string().cuid(),
        inspectionResult: z.enum(['PASS', 'FAIL']),
        restock: z.boolean().default(false),
      }),
    )
    .min(1),
  inspectionNotes: z.string().max(2000).optional(),
});
export type InspectReturnDto = z.infer<typeof inspectReturnSchema>;
