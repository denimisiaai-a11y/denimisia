import { z } from 'zod';

const landmarkPointSchema = z.object({
  y: z.number(),
  x: z.number().optional(),
});

export const updateSilhouetteSchema = z.object({
  svgPath: z.string().min(1).optional(),
  viewBox: z.string().min(1).optional(),
  landmarks: z.record(z.string(), landmarkPointSchema).optional(),
});

export type UpdateSilhouetteDto = z.infer<typeof updateSilhouetteSchema>;
