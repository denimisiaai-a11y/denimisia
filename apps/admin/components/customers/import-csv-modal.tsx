'use client';

import { useState, useRef } from 'react';

interface ImportResult {
  readonly created: number;
  readonly skipped_existing: number;
  readonly skipped_duplicate_within_upload: number;
  readonly errors: ReadonlyArray<{ row: number; reason: string }>;
}

interface ImportCsvModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  apiBase: string;
  token: string | undefined;
}

export function ImportCsvModal({
  open,
  onClose,
  onImported,
  apiBase,
  token,
}: ImportCsvModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleUpload = async () => {
    if (!file || !token) return;
    setUploading(true);
    setError('');
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${apiBase}/users/bulk`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message ?? `Upload failed (${res.status})`);
      }
      const data = (body.data ?? body) as ImportResult;
      setResult(data);
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    setError('');
    onClose();
  };

  const downloadErrorReport = () => {
    if (!result || result.errors.length === 0) return;
    const csv =
      'row,reason\n' +
      result.errors
        .map((e) => `${e.row},"${e.reason.replace(/"/g, '""')}"`)
        .join('\n');
    const blob = new Blob(['﻿' + csv], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `import-errors-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded bg-surface-container-lowest p-6">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="font-headline text-xl font-semibold">
            Import Customers from CSV
          </h2>
          <button
            onClick={handleClose}
            className="text-secondary hover:text-on-surface"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {result ? (
          <div className="space-y-3 text-sm">
            <p>
              ✓ Imported <strong>{result.created}</strong> new customers
            </p>
            {result.skipped_existing > 0 && (
              <p>
                ⚠ Skipped <strong>{result.skipped_existing}</strong> (already
                in your system)
              </p>
            )}
            {result.skipped_duplicate_within_upload > 0 && (
              <p>
                ⚠ Skipped{' '}
                <strong>{result.skipped_duplicate_within_upload}</strong>{' '}
                duplicate rows within this file
              </p>
            )}
            {result.errors.length > 0 && (
              <div>
                <p>
                  ✗ <strong>{result.errors.length}</strong> rows had errors:
                </p>
                <ul className="mt-2 max-h-32 overflow-y-auto rounded border border-outline-variant/20 bg-surface-container p-2 text-xs">
                  {result.errors.slice(0, 10).map((e) => (
                    <li key={e.row}>
                      Row {e.row}: {e.reason}
                    </li>
                  ))}
                  {result.errors.length > 10 && (
                    <li className="text-secondary">
                      …and {result.errors.length - 10} more
                    </li>
                  )}
                </ul>
                <button
                  onClick={downloadErrorReport}
                  className="mt-2 text-xs text-primary underline"
                >
                  Download error report
                </button>
              </div>
            )}
            <div className="flex justify-end pt-4">
              <button
                onClick={handleClose}
                className="rounded bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 rounded bg-surface-container p-3 text-xs text-secondary">
              <p className="mb-1">Upload a CSV with these columns:</p>
              <pre className="font-mono text-[10px]">
                email,firstName,lastName,phone
              </pre>
              <ul className="mt-2 list-disc pl-4">
                <li>email and firstName are required</li>
                <li>lastName and phone are optional</li>
                <li>Existing emails will be skipped (no overwrite)</li>
                <li>Maximum file size: 20 MB</li>
              </ul>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm"
              disabled={uploading}
            />

            {error && (
              <p className="mt-3 rounded bg-red-500/10 p-2 text-xs text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={handleClose}
                disabled={uploading}
                className="rounded px-4 py-2 text-sm text-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="rounded bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50"
              >
                {uploading ? 'Importing…' : 'Import'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
