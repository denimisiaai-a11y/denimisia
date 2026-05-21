import { z } from 'zod';

const STATUS_VALUES = [
  'REQUESTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'IN_TRANSIT',
  'RECEIVED',
  'INSPECTING',
  'INSPECTED_PASS',
  'INSPECTED_FAIL',
  'RETURNED_TO_CUSTOMER',
  'REFUNDED',
  'CLOSED',
  'CANCELLED',
] as const;

export const listReturnsSchema = z.object({
  status: z
    .union([z.enum(STATUS_VALUES), z.array(z.enum(STATUS_VALUES))])
    .optional(),
  slaOverdue: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type ListReturnsDto = z.infer<typeof listReturnsSchema>;
