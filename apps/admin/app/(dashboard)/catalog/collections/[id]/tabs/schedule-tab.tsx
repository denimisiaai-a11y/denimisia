'use client';

import type { CollectionDetail } from '../editor-shell';

interface Props {
  readonly collection: CollectionDetail;
  readonly onSaved: (c: CollectionDetail) => void;
}

export function ScheduleTab(_props: Props) {
  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="font-display text-xl">Schedule & Visibility</h2>
      <p className="text-sm text-secondary">
        Active toggle, start/end dates, timezone, pre-launch teaser, post-end behavior, visibility.
      </p>
      <div className="border border-dashed border-outline-variant/30 p-8 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">
          Coming next — Phase 3
        </p>
      </div>
    </div>
  );
}
