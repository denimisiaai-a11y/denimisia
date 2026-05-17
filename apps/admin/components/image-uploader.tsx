'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { adminFetch } from '@/lib/api';
import { maybeResizeImage } from './image-resize';

type Folder =
  | 'products'
  | 'reviews'
  | 'cms'
  | 'banners'
  | 'bundles'
  | 'sections';

const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

interface PresignResponse {
  uploadUrl: string;
  key: string;
  publicUrl: string;
}

interface ProcessResponse {
  variants: Record<string, string>;
}

interface Item {
  id: string;
  publicUrl: string;
  status:
    | 'queued'
    | 'compressing'
    | 'uploading'
    | 'processing'
    | 'done'
    | 'error';
  progress: number;
  error?: string;
  // Object URL kept for thumbnail preview during upload. Revoked once the
  // upload completes and the public URL is available.
  previewObjectUrl?: string;
}

interface ImageUploaderProps {
  /** Current list of public image URLs already saved to the form. */
  value: string[];
  /** Called whenever the saved list of public URLs changes. */
  onChange: (urls: string[]) => void;
  /** Admin access token for `/uploads/presign`. */
  token: string | undefined;
  /** R2 folder prefix this uploader writes into. */
  folder: Folder;
  /** Soft cap on total images. Submit-blocking is the form's job. */
  maxFiles?: number;
}

export function ImageUploader({
  value,
  onChange,
  token,
  folder,
  maxFiles = 12,
}: ImageUploaderProps) {
  const [items, setItems] = useState<Item[]>(() =>
    value.map((url) => ({
      id: crypto.randomUUID(),
      publicUrl: url,
      status: 'done' as const,
      progress: 100,
    })),
  );
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stable ref for the parent callback so the propagation effect below
  // depends only on items + value, not on an onChange identity that may
  // change on every parent render. Avoids the prior `eslint-disable
  // exhaustive-deps` shortcut.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Propagate completed URLs to the parent.
  useEffect(() => {
    const completed = items
      .filter((i) => i.status === 'done' && i.publicUrl)
      .map((i) => i.publicUrl);
    if (
      completed.length !== value.length ||
      completed.some((u, i) => u !== value[i])
    ) {
      onChangeRef.current(completed);
    }
  }, [items, value]);

  // Clean up object URLs on unmount.
  useEffect(() => {
    return () => {
      items.forEach((item) => {
        if (item.previewObjectUrl) URL.revokeObjectURL(item.previewObjectUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-resize validation: catches blatant mismatches (wrong type, empty file).
  // The 10MB cap is checked AFTER browser resize since most "too large"
  // failures pre-resize will pass post-resize.
  const validateFileBeforeResize = (file: File): string | null => {
    if (!ALLOWED_MIMES.has(file.type)) {
      return `Unsupported type ${file.type || 'unknown'}`;
    }
    if (file.size === 0) return 'File is empty';
    return null;
  };

  const uploadOne = useCallback(
    async (file: File, itemId: string) => {
      if (!token) {
        markError(itemId, 'Not authenticated');
        return;
      }

      try {
        // Browser-side resize+recompress. Phone photos (25MB+) drop to ~1.5MB.
        // Skip for already-small files and animated/lossless formats.
        setItems((prev) =>
          prev.map((it) =>
            it.id === itemId ? { ...it, status: 'compressing' } : it,
          ),
        );
        const { file: uploadFile, resized } = await maybeResizeImage(file);
        if (resized) {
          // Refresh the preview to reflect the rotated/recompressed bytes.
          setItems((prev) =>
            prev.map((it) => {
              if (it.id !== itemId) return it;
              if (it.previewObjectUrl) URL.revokeObjectURL(it.previewObjectUrl);
              return {
                ...it,
                previewObjectUrl: URL.createObjectURL(uploadFile),
              };
            }),
          );
        }

        if (uploadFile.size > MAX_SIZE_BYTES) {
          markError(
            itemId,
            `Even after compression, file is ${(uploadFile.size / 1024 / 1024).toFixed(1)}MB (max 10MB). Try a smaller image.`,
          );
          return;
        }

        setItems((prev) =>
          prev.map((it) =>
            it.id === itemId
              ? { ...it, status: 'uploading', progress: 0 }
              : it,
          ),
        );

        const presign = await adminFetch<PresignResponse>(
          '/uploads/presign',
          token,
          {
            method: 'POST',
            body: JSON.stringify({
              folder,
              contentType: uploadFile.type,
              expectedSize: uploadFile.size,
            }),
          },
        );

        await putWithProgress(presign.uploadUrl, uploadFile, (pct) =>
          updateProgress(itemId, pct),
        );

        // PUT succeeded. Kick off server-side variant generation. The form
        // saves the original URL; storefront derives variants from it via the
        // shared naming convention (see apps/web/lib/image.ts).
        setItems((prev) =>
          prev.map((it) =>
            it.id === itemId
              ? { ...it, status: 'processing', progress: 100 }
              : it,
          ),
        );

        await adminFetch<ProcessResponse>('/uploads/process', token, {
          method: 'POST',
          body: JSON.stringify({ key: presign.key }),
        });

        setItems((prev) =>
          prev.map((it) => {
            if (it.id !== itemId) return it;
            if (it.previewObjectUrl) URL.revokeObjectURL(it.previewObjectUrl);
            return {
              ...it,
              status: 'done',
              progress: 100,
              publicUrl: presign.publicUrl,
              previewObjectUrl: undefined,
            };
          }),
        );
      } catch (err: unknown) {
        markError(itemId, err instanceof Error ? err.message : 'Upload failed');
      }
    },
    [folder, token],
  );

  const updateProgress = (id: string, pct: number) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, progress: pct } : it)),
    );
  };

  const markError = (id: string, message: string) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, status: 'error', error: message } : it,
      ),
    );
  };

  const acceptFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files);
      if (arr.length === 0) return;

      const remaining = maxFiles - items.length;
      if (remaining <= 0) return;
      const accepted = arr.slice(0, remaining);

      const next: Item[] = accepted.map((file) => {
        const err = validateFileBeforeResize(file);
        const id = crypto.randomUUID();
        if (err) {
          return {
            id,
            publicUrl: '',
            status: 'error',
            progress: 0,
            error: err,
          };
        }
        return {
          id,
          publicUrl: '',
          // Items go through compressing → uploading → processing → done.
          // uploadOne() drives the transitions.
          status: 'compressing',
          progress: 0,
          previewObjectUrl: URL.createObjectURL(file),
        };
      });

      setItems((prev) => [...prev, ...next]);

      // Kick off uploads for valid items.
      next.forEach((item, idx) => {
        const file = accepted[idx];
        if (item.status !== 'error' && file) {
          void uploadOne(file, item.id);
        }
      });
    },
    [items.length, maxFiles, uploadOne],
  );

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) acceptFiles(e.dataTransfer.files);
  };

  const handleRemove = (id: string) => {
    setItems((prev) => {
      const target = prev.find((it) => it.id === id);
      if (target?.previewObjectUrl) URL.revokeObjectURL(target.previewObjectUrl);
      return prev.filter((it) => it.id !== id);
    });
  };

  const handleMove = (id: string, direction: -1 | 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.id === id);
      const target = idx + direction;
      if (idx === -1 || target < 0 || target >= prev.length) return prev;
      const a = prev[idx];
      const b = prev[target];
      if (!a || !b) return prev;
      const copy = [...prev];
      copy[idx] = b;
      copy[target] = a;
      return copy;
    });
  };

  const canAddMore = items.length < maxFiles;

  return (
    <div className="space-y-4">
      {canAddMore && (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={`flex flex-col items-center justify-center gap-2 cursor-pointer border border-dashed py-10 px-6 text-center transition-colors duration-200 ${
            dragOver
              ? 'border-primary bg-surface-container-low'
              : 'border-outline-variant/40 bg-surface-container-lowest hover:bg-surface-container-low'
          }`}
        >
          <span
            className="material-symbols-outlined text-3xl text-secondary"
            aria-hidden
          >
            cloud_upload
          </span>
          <p className="text-sm text-on-surface">
            <span className="font-semibold">Drop images here</span>
            <span className="text-secondary"> or click to select</span>
          </p>
          <p className="text-[10px] tracking-wide uppercase text-secondary">
            JPG · PNG · WebP · GIF · AVIF · large photos auto-resized
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={Array.from(ALLOWED_MIMES).join(',')}
            className="hidden"
            onChange={(e) => {
              if (e.target.files) acceptFiles(e.target.files);
              // Allow selecting the same files again after a failed upload.
              e.target.value = '';
            }}
          />
        </div>
      )}

      {items.length > 0 && (
        <ul className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {items.map((item, idx) => (
            <li
              key={item.id}
              className="relative group aspect-[3/4] bg-surface-container-high border border-outline-variant/15 overflow-hidden"
            >
              {(item.previewObjectUrl ?? item.publicUrl) && (
                // eslint-disable-next-line @next/next/no-img-element -- arbitrary external URLs and object URLs not suited to next/image
                <img
                  src={item.previewObjectUrl ?? item.publicUrl}
                  alt={`Image ${idx + 1}`}
                  className={`h-full w-full object-cover ${
                    item.status === 'done' ? '' : 'opacity-70'
                  }`}
                />
              )}

              {item.status === 'uploading' && (
                <div className="absolute inset-x-0 bottom-0 h-1 bg-surface-container-highest">
                  <div
                    className="h-full bg-primary transition-[width] duration-200"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}

              {item.status === 'compressing' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-surface/90">
                    <span
                      className="material-symbols-outlined animate-spin text-sm text-primary"
                      aria-hidden
                    >
                      progress_activity
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface">
                      Compressing
                    </span>
                  </div>
                </div>
              )}

              {item.status === 'processing' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-surface/90">
                    <span
                      className="material-symbols-outlined animate-spin text-sm text-primary"
                      aria-hidden
                    >
                      progress_activity
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface">
                      Optimizing
                    </span>
                  </div>
                </div>
              )}

              {item.status === 'error' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 text-center">
                  <div>
                    <span
                      className="material-symbols-outlined text-base text-error mb-1"
                      aria-hidden
                    >
                      error
                    </span>
                    <p className="text-[10px] font-medium tracking-wide text-white break-words leading-tight">
                      {item.error}
                    </p>
                  </div>
                </div>
              )}

              <div className="absolute inset-x-0 top-0 flex justify-between p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleMove(item.id, -1)}
                    disabled={idx === 0}
                    aria-label="Move left"
                    className="h-6 w-6 inline-flex items-center justify-center bg-surface/90 text-on-surface disabled:opacity-30 hover:bg-surface"
                  >
                    <span
                      className="material-symbols-outlined text-sm"
                      aria-hidden
                    >
                      chevron_left
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(item.id, 1)}
                    disabled={idx === items.length - 1}
                    aria-label="Move right"
                    className="h-6 w-6 inline-flex items-center justify-center bg-surface/90 text-on-surface disabled:opacity-30 hover:bg-surface"
                  >
                    <span
                      className="material-symbols-outlined text-sm"
                      aria-hidden
                    >
                      chevron_right
                    </span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(item.id)}
                  aria-label="Remove image"
                  className="h-6 w-6 inline-flex items-center justify-center bg-error text-on-error hover:bg-error/90"
                >
                  <span
                    className="material-symbols-outlined text-sm"
                    aria-hidden
                  >
                    close
                  </span>
                </button>
              </div>

              {idx === 0 && item.status === 'done' && (
                <span className="absolute bottom-1 left-1 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-primary text-on-primary">
                  Primary
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * PUT a File to a presigned URL with XHR so we get upload-progress events.
 * `fetch()` doesn't expose upload progress without ReadableStream tricks that
 * aren't widely supported, so XHR is the pragmatic choice here.
 */
function putWithProgress(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.min(100, Math.round((e.loaded / e.total) * 100));
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(
          new Error(`R2 upload failed (${xhr.status}): ${xhr.responseText.slice(0, 200)}`),
        );
      }
    };

    xhr.onerror = () => {
      // xhr.onerror fires for: CORS rejection, network unreachable, DNS fail,
      // and TLS error. The browser doesn't expose which. Status is typically
      // 0 in this state. The actual reason usually shows up in the browser's
      // Console (CORS errors are logged there but not exposed to JS).
      reject(
        new Error(
          `Upload failed: browser blocked the request (status=${xhr.status}). ` +
            'Check the browser Console tab for a CORS or network error message.',
        ),
      );
    };
    xhr.ontimeout = () => reject(new Error('Upload timed out'));
    xhr.onabort = () => reject(new Error('Upload aborted'));

    xhr.send(file);
  });
}
