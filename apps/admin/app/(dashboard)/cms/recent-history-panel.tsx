'use client';

import type { AuditLogEntry } from './section-types';

interface RecentHistoryPanelProps {
  readonly entries: readonly AuditLogEntry[];
}

const ACTION_LABELS: Record<string, string> = {
  'cms.section.create':   'Section added',
  'cms.section.update':   'Section updated',
  'cms.section.delete':   'Section removed',
  'cms.section.reorder':  'Sections reordered',
  'cms.styles.update':    'Global styles changed',
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (Number.isNaN(diffSec)) return iso;
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function RecentHistoryPanel({ entries }: RecentHistoryPanelProps) {
  return (
    <div className="bg-surface-container-low p-8 border border-outline-variant/10">
      <div className="flex items-center gap-3 mb-6">
        <span className="material-symbols-outlined text-primary">history</span>
        <h5 className="font-headline text-sm font-bold tracking-widest uppercase">
          Recent History
        </h5>
      </div>
      <div className="space-y-3">
        {entries.length === 0 ? (
          <div className="flex gap-3 items-start">
            <div className="w-1.5 h-1.5 rounded-full bg-secondary/30 mt-1.5" />
            <div>
              <p className="text-xs font-semibold text-secondary">No recent activity</p>
              <p className="text-[10px] text-secondary">—</p>
            </div>
          </div>
        ) : (
          entries.map((entry) => {
            const label = ACTION_LABELS[entry.action] ?? entry.action;
            const who =
              [entry.user?.firstName, entry.user?.lastName]
                .filter(Boolean)
                .join(' ') ||
              entry.user?.email ||
              'unknown';
            return (
              <div key={entry.id} className="flex gap-3 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{label}</p>
                  <p className="text-[10px] text-secondary truncate">
                    {who} · {relativeTime(entry.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
