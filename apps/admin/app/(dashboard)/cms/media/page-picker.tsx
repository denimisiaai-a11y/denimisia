'use client';

/**
 * Left rail — page picker with filled/total completion badges and storage panel.
 */

import { PAGE_ROUTES, formatBytes, type PageSlotRecord, type StorageStats } from './types';

interface PageGroup {
  readonly pageKey: string;
  readonly slots: readonly PageSlotRecord[];
}

interface PagePickerProps {
  readonly groups: readonly PageGroup[];
  readonly storage: StorageStats | null;
  readonly activePage: string;
  readonly onSelect: (pageKey: string) => void;
}

export function PagePicker({ groups, storage, activePage, onSelect }: PagePickerProps) {
  const storageCapBytes = 1024 * 1024 * 1024; // 1 GB reference cap for the progress bar
  const pct = storage ? Math.min(100, (storage.totalBytes / storageCapBytes) * 100) : 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {storage && (
        <div className="border-b border-outline-variant/10 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">Storage</p>
          <p className="mt-1 font-display text-lg text-on-surface">{formatBytes(storage.totalBytes)}</p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-container-low">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.15em] text-tertiary">
            {storage.totalAssets} assets · {formatBytes(storage.byKind.IMAGE)} img · {formatBytes(storage.byKind.VIDEO)} vid
          </p>
        </div>
      )}

      <ul className="flex-1 overflow-y-auto">
        {groups.map(({ pageKey, slots }) => {
          const filled = slots.filter((s) => s.asset).length;
          const total = slots.filter((s) => s.maxBytes > 0).length;
          const route = PAGE_ROUTES[pageKey];
          const active = pageKey === activePage;
          const status = total === 0 ? 'text' : filled === total ? 'done' : filled === 0 ? 'empty' : 'partial';

          return (
            <li key={pageKey}>
              <button
                type="button"
                onClick={() => onSelect(pageKey)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-on-surface hover:bg-surface-container-low'
                }`}
              >
                <span
                  className={`h-2 w-2 flex-shrink-0 rounded-full ${
                    status === 'done'
                      ? 'bg-emerald-500'
                      : status === 'partial'
                      ? 'bg-amber-500'
                      : status === 'empty'
                      ? 'bg-rose-500/60'
                      : 'bg-outline-variant/40'
                  }`}
                />
                <span className="flex-1 truncate font-body text-sm">{route?.label ?? pageKey}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-tertiary">
                  {total > 0 ? `${filled}/${total}` : slots.length}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
