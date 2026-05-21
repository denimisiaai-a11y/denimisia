'use client';

import { useCallback, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import Image from 'next/image';

/**
 * Customer-side photo uploader for return submissions.
 *
 * Posts to the PUBLIC `POST /uploads/returns/presign` endpoint (no auth),
 * then PUTs the file directly to R2 using the signed URL. Only the final
 * public file URL is held in component state — that's what the parent form
 * stores in the Return.photos column.
 *
 * Constraints (mirror server enforcement):
 *  - MIME allowlist: JPEG / PNG / WebP
 *  - Per-file cap: 10 MB
 *  - Per-submission cap: 5 photos (MAX_PHOTOS)
 *
 * Validation is repeated client-side purely for UX (instant feedback);
 * the server is the source of truth. A user manually crafting requests
 * cannot bypass MIME/size limits — the presign endpoint and R2's signed
 * Content-Type/Content-Length both reject mismatches.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
const MAX_PHOTOS = 5;
const ACCEPT = 'image/jpeg,image/png,image/webp';
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIMES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

interface PhotoUploaderProps {
  value: string[];
  onChange: (urls: string[]) => void;
  required?: boolean;
  disabled?: boolean;
}

interface PresignResponse {
  uploadUrl: string;
  fileUrl: string;
  key: string;
}

export function PhotoUploader({
  value,
  onChange,
  required = false,
  disabled = false,
}: PhotoUploaderProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (files: FileList | null): Promise<void> => {
      if (!files || files.length === 0) return;
      const remaining = MAX_PHOTOS - value.length;
      if (remaining <= 0) {
        setError(`Maximum ${MAX_PHOTOS} photos.`);
        return;
      }

      const toUpload = Array.from(files).slice(0, remaining);
      setError(null);
      setBusy(true);

      const newUrls: string[] = [];
      let lastError: string | null = null;

      for (const file of toUpload) {
        if (!ALLOWED_MIMES.has(file.type)) {
          lastError = `${file.name}: must be JPEG, PNG, or WebP.`;
          continue;
        }
        if (file.size > MAX_BYTES) {
          lastError = `${file.name}: must be under 10 MB.`;
          continue;
        }

        try {
          const presignRes = await fetch(`${API}/uploads/returns/presign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: file.name,
              contentType: file.type,
              contentLength: file.size,
            }),
          });
          if (!presignRes.ok) {
            const body: unknown = await presignRes.json().catch(() => ({}));
            const message =
              typeof body === 'object' &&
              body !== null &&
              'message' in body &&
              typeof (body as { message?: unknown }).message === 'string'
                ? (body as { message: string }).message
                : 'Presign failed';
            throw new Error(message);
          }
          const presignJson: unknown = await presignRes.json();
          // API responses use the global TransformInterceptor envelope
          // `{ success, data }`. Unwrap defensively in case a raw object
          // sneaks through (e.g. in tests).
          const payload: PresignResponse =
            typeof presignJson === 'object' &&
            presignJson !== null &&
            'data' in presignJson
              ? ((presignJson as { data: PresignResponse }).data)
              : (presignJson as PresignResponse);

          const putRes = await fetch(payload.uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file,
          });
          if (!putRes.ok) {
            throw new Error(`Upload failed (status ${putRes.status})`);
          }
          newUrls.push(payload.fileUrl);
        } catch (err: unknown) {
          lastError =
            err instanceof Error
              ? err.message
              : 'Upload failed. Please try again.';
        }
      }

      if (newUrls.length > 0) {
        onChange([...value, ...newUrls]);
      }
      if (lastError) {
        setError(lastError);
      }
      setBusy(false);
    },
    [value, onChange],
  );

  const removeAt = useCallback(
    (idx: number): void => {
      onChange(value.filter((_, i) => i !== idx));
    },
    [value, onChange],
  );

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {value.map((url, idx) => (
          <div
            key={url}
            className="relative aspect-square overflow-hidden rounded-sm border border-border"
          >
            <Image
              src={url}
              alt={`Photo ${idx + 1}`}
              fill
              sizes="120px"
              className="object-cover"
              unoptimized
            />
            <button
              type="button"
              onClick={() => removeAt(idx)}
              disabled={disabled}
              className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white hover:bg-black"
              aria-label="Remove photo"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {value.length < MAX_PHOTOS && (
          <label
            className={`flex aspect-square cursor-pointer items-center justify-center rounded-sm border border-dashed border-border text-xs text-muted hover:border-ink ${
              disabled || busy ? 'pointer-events-none opacity-50' : ''
            }`}
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <span>+ Add photo</span>
            )}
            <input
              type="file"
              accept={ACCEPT}
              multiple
              className="sr-only"
              disabled={disabled || busy}
              onChange={(e) => {
                void handleFiles(e.target.files);
                // Reset the input so selecting the same filename again
                // (e.g. after a failed upload) still fires onChange.
                e.target.value = '';
              }}
            />
          </label>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">
        {value.length} of {MAX_PHOTOS} photos. JPEG / PNG / WebP, max 10 MB each.
        {required && value.length === 0 && (
          <span className="block text-error">
            At least one photo is required for this reason.
          </span>
        )}
      </p>
      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  );
}
