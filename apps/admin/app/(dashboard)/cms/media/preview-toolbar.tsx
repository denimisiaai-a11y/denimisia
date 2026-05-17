'use client';

/**
 * Top toolbar above the iframe — device preview, reload, zoom, view-live.
 */

export type DevicePreset = 'mobile' | 'tablet' | 'desktop';

export const DEVICE_WIDTHS: Record<DevicePreset, number | null> = {
  mobile:  390,
  tablet:  820,
  desktop: null, // full width
};

interface PreviewToolbarProps {
  readonly url: string;
  readonly device: DevicePreset;
  readonly onDeviceChange: (d: DevicePreset) => void;
  readonly onReload: () => void;
  readonly onOpenLive: () => void;
}

export function PreviewToolbar({ url, device, onDeviceChange, onReload, onOpenLive }: PreviewToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-outline-variant/10 px-4 py-2">
      <div className="flex items-center gap-1">
        {(['mobile', 'tablet', 'desktop'] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onDeviceChange(d)}
            className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
              device === d ? 'bg-primary/10 text-primary' : 'text-secondary hover:bg-surface-container-low'
            }`}
            aria-label={d}
            title={d}
          >
            <span className="material-symbols-outlined text-[18px]">
              {d === 'mobile' ? 'smartphone' : d === 'tablet' ? 'tablet_mac' : 'desktop_windows'}
            </span>
          </button>
        ))}
      </div>

      <p className="flex-1 truncate px-4 font-mono text-[10px] uppercase tracking-[0.18em] text-secondary">
        {url}
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onReload}
          className="flex h-8 items-center gap-1 rounded-md px-2 text-secondary hover:bg-surface-container-low"
          title="Reload iframe (R)"
        >
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.15em]">R</span>
        </button>
        <button
          type="button"
          onClick={onOpenLive}
          className="flex h-8 items-center gap-1 rounded-md px-3 text-secondary hover:bg-surface-container-low"
          title="Open live site (no edit mode)"
        >
          <span className="material-symbols-outlined text-[18px]">open_in_new</span>
          <span className="hidden font-body text-xs sm:inline">View live</span>
        </button>
      </div>
    </div>
  );
}
