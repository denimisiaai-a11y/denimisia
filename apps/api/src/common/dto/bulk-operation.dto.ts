import { z } from 'zod';

// Base shape every bulk endpoint extends with its own per-action fields.
// `versionMap` is the optimistic-concurrency watermark (id → updatedAt ISO).
// `idempotencyKey` is REQUIRED — re-using a key replays the cached result
// instead of re-executing.
export const BulkBaseSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  versionMap: z.record(z.string(), z.string()).optional().default({}),
  idempotencyKey: z.string().min(8).max(128),
  reason: z.string().max(500).optional(),
});

export type BulkBaseInput = z.infer<typeof BulkBaseSchema>;

export interface BulkOperationFailure {
  id: string;
  code: string;
  message: string;
}

// Envelope returned by every bulk endpoint. Shape is locked so clients always
// know where to look for partial-success breakdowns, undo tokens, and the
// versionMap watermarks for refreshing optimistic state without a re-fetch.
export interface BulkOperationResult<TExtra = Record<string, unknown>> {
  succeeded: string[];
  failed: BulkOperationFailure[];
  skipped: string[];
  undoToken?: string;
  expiresAt?: string;
  versionMap: Record<string, string>;
  extra?: TExtra;
}
