'use client';

import type { CollectionDetail } from '../editor-shell';

interface Props {
  readonly collection: CollectionDetail;
  readonly onSaved: (c: CollectionDetail) => void;
}

export function LayoutTab(_props: Props) {
  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="font-display text-xl">Layout</h2>
      <p className="text-sm text-secondary">
        Hero style, grid columns, sort, filters, countdown, social proof.
      </p>
      <div className="border border-dashed border-outline-variant/30 p-8 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">
          Coming next — Phase 3
        </p>
      </div>
    </div>
  );
}
