interface StarBadgeProps {
  /** Top-left for grid cards, top-right when there's a rank/ribbon on the left. */
  position?: 'top-left' | 'top-right';
  /** Size variant — sm matches card density, md matches editorial sections. */
  size?: 'sm' | 'md';
}

const POSITION = {
  'top-left': 'top-3 left-3',
  'top-right': 'top-4 right-4',
} as const;

const SIZE = {
  sm: 'h-7 w-7 text-sm',
  md: 'h-8 w-8 text-base',
} as const;

export function StarBadge({
  position = 'top-left',
  size = 'sm',
}: StarBadgeProps) {
  return (
    <span
      aria-label="Featured pick"
      title="Featured pick"
      className={`pointer-events-none absolute ${POSITION[position]} ${SIZE[size]} flex items-center justify-center bg-ink text-paper leading-none`}
    >
      &#9733;
    </span>
  );
}
