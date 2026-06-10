'use client';

interface PlacementToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}

/**
 * Editorial-style toggle row used in the product form's Placement section.
 * Label + description on the left, switch on the right. Click the whole
 * row to flip — the inner sliding circle is visual feedback only.
 */
export function PlacementToggle({
  label,
  description,
  checked,
  onChange,
}: PlacementToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="w-full flex items-start justify-between gap-4 text-left"
    >
      <div>
        <p className="text-sm font-semibold text-on-surface">{label}</p>
        <p className="mt-1 text-[11px] tracking-wide text-secondary">
          {description}
        </p>
      </div>
      <span
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center transition-colors duration-300 ease-editorial ${
          checked ? 'bg-primary' : 'bg-surface-container-high'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform bg-on-primary transition-transform duration-300 ease-editorial ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </span>
    </button>
  );
}
