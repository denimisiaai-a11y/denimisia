'use client';

import { useState, useRef } from 'react';

interface ImportOrdersResult {
  readonly totalOrdersInFile: number;
  readonly imported: number;
  readonly skipped_duplicate: number;
  readonly skipped_invalid: number;
  readonly placeholdersCreated: number;
  readonly newShadowsCreated: number;
  readonly ordersAttachedToExisting: number;
  readonly errors: ReadonlyArray<{ row: number; order_ref?: string; reason: string }>;
  readonly placeholdersReport: ReadonlyArray<{ sku: string; occurrences: number; productId: string }>;
}

interface ImportOrdersModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  apiBase: string;
  token: string | undefined;
}

export function ImportOrdersModal({
  open,
  onClose,
  onImported,
  apiBase,
  token,
}: ImportOrdersModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportOrdersResult | null>(null);
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
      const res = await fetch(`${apiBase}/orders/admin/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message ?? `Upload failed (${res.status})`);
      }
      const data = (body.data ?? body) as ImportOrdersResult;
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

  const downloadCsv = (filename: string, rows: string[][]) => {
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadErrorReport = () => {
    if (!result || result.errors.length === 0) return;
    const rows: string[][] = [['row', 'order_ref', 'reason']];
    for (const e of result.errors) rows.push([String(e.row), e.order_ref ?? '', e.reason]);
    downloadCsv(`order-import-errors-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const downloadPlaceholderReport = () => {
    if (!result || result.placeholdersReport.length === 0) return;
    const rows: string[][] = [['sku', 'occurrences', 'productId']];
    for (const p of result.placeholdersReport) {
      rows.push([p.sku, String(p.occurrences), p.productId]);
    }
    downloadCsv(`order-import-placeholders-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded bg-surface-container-lowest p-6">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="font-headline text-xl font-semibold">Import Order History</h2>
          <button onClick={handleClose} className="text-secondary hover:text-on-surface" aria-label="Close">
            ✕
          </button>
        </div>

        {result ? (
          <div className="space-y-3 text-sm">
            <p>✓ Imported <strong>{result.imported}</strong> of {result.totalOrdersInFile} orders</p>
            <p>ℹ {result.ordersAttachedToExisting} attached to existing customers, {result.newShadowsCreated} new shadow customers created</p>
            {result.skipped_duplicate > 0 && <p>⚠ Skipped {result.skipped_duplicate} already-imported orders</p>}
            {result.skipped_invalid > 0 && <p>⚠ Skipped {result.skipped_invalid} orders with invalid rows</p>}
            {result.placeholdersCreated > 0 && (
              <div>
                <p>ℹ {result.placeholdersCreated} placeholder products created for unknown SKUs</p>
                <button onClick={downloadPlaceholderReport} className="mt-1 text-xs text-primary underline">
                  Download placeholder report
                </button>
              </div>
            )}
            {result.errors.length > 0 && (
              <div>
                <p>✗ <strong>{result.errors.length}</strong> row errors:</p>
                <ul className="mt-2 max-h-32 overflow-y-auto rounded border border-outline-variant/20 bg-surface-container p-2 text-xs">
                  {result.errors.slice(0, 10).map((e, i) => (
                    <li key={i}>Row {e.row}{e.order_ref ? ` (${e.order_ref})` : ''}: {e.reason}</li>
                  ))}
                  {result.errors.length > 10 && (
                    <li className="text-secondary">…and {result.errors.length - 10} more</li>
                  )}
                </ul>
                <button onClick={downloadErrorReport} className="mt-2 text-xs text-primary underline">
                  Download error report
                </button>
              </div>
            )}
            <div className="flex justify-end pt-4">
              <button onClick={handleClose} className="rounded bg-primary px-4 py-2 text-sm font-semibold text-on-primary">
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 rounded bg-surface-container p-3 text-xs text-secondary">
              <p className="mb-1 font-semibold">⚠ One-time migration tool</p>
              <p className="mb-2">Required columns:</p>
              <pre className="font-mono text-[10px]">order_ref, order_date, customer_email, sku, quantity, unit_price</pre>
              <p className="mt-2 mb-1">Optional columns:</p>
              <pre className="font-mono text-[10px]">customer_name, customer_phone, shipping_cost, discount_amount, ship_line1..ship_country, notes</pre>
              <ul className="mt-2 list-disc pl-4">
                <li>Multiple rows with same order_ref = one order</li>
                <li>Already-imported order_refs are skipped</li>
                <li>All orders set to DELIVERED status</li>
                <li>Current stock counts NOT affected</li>
                <li>Unknown SKUs → hidden placeholder products</li>
                <li>Max file size: 20 MB</li>
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
              <p className="mt-3 rounded bg-red-500/10 p-2 text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={handleClose} disabled={uploading} className="rounded px-4 py-2 text-sm text-secondary">
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
