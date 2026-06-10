interface IconButtonProps {
  readonly icon: string;
  readonly label: string;
  readonly onClick?: () => void;
  readonly tone?: 'default' | 'danger';
}

export function IconButton({ icon, label, onClick, tone = 'default' }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={
        'flex h-8 w-8 items-center justify-center transition-colors duration-300 ease-editorial ' +
        (tone === 'danger'
          ? 'text-secondary hover:text-primary'
          : 'text-secondary hover:text-on-surface')
      }
    >
      <span className="material-symbols-outlined text-base" aria-hidden>
        {icon}
      </span>
    </button>
  );
}

interface BannerProps {
  readonly tone: 'error' | 'info' | 'success';
  readonly message: string;
}

const BANNER_STYLES: Record<BannerProps['tone'], { border: string; icon: string }> = {
  error: { border: 'border-primary/30', icon: 'error' },
  info: { border: 'border-outline-variant/30', icon: 'info' },
  success: { border: 'border-[#059669]/30', icon: 'check_circle' },
};

export function Banner({ tone, message }: BannerProps) {
  const s = BANNER_STYLES[tone];
  return (
    <div className={'mb-6 border bg-surface-container-low px-5 py-4 ' + s.border}>
      <div className="flex items-start gap-3">
        <span
          className={
            'material-symbols-outlined ' +
            (tone === 'error'
              ? 'text-primary'
              : tone === 'success'
                ? 'text-[#059669]'
                : 'text-secondary')
          }
          aria-hidden
        >
          {s.icon}
        </span>
        <p className="mt-0.5 font-body text-sm text-on-surface">{message}</p>
      </div>
    </div>
  );
}

interface SkeletonListProps {
  readonly rows?: number;
  readonly rowHeight?: number;
}

export function SkeletonList({ rows = 5, rowHeight = 64 }: SkeletonListProps) {
  return (
    <div className="divide-y divide-outline-variant/10">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse bg-surface-container-low/50"
          style={{ height: rowHeight }}
        />
      ))}
    </div>
  );
}

interface EmptyStateProps {
  readonly icon: string;
  readonly label: string;
  readonly description?: string;
  readonly action?: React.ReactNode;
}

export function EmptyState({ icon, label, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
      <span className="material-symbols-outlined text-5xl text-secondary/40" aria-hidden>
        {icon}
      </span>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
        {label}
      </p>
      {description && (
        <p className="max-w-md font-body text-sm text-secondary">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

interface SurfaceCardProps {
  readonly children: React.ReactNode;
  readonly className?: string;
}

export function SurfaceCard({ children, className }: SurfaceCardProps) {
  return (
    <div
      className={
        'atelier-shadow bg-surface-container-lowest ' + (className ?? '')
      }
    >
      {children}
    </div>
  );
}

interface SurfaceHeaderProps {
  readonly children: React.ReactNode;
  readonly action?: React.ReactNode;
}

export function SurfaceHeader({ children, action }: SurfaceHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-outline-variant/15 px-6 py-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-secondary">
        {children}
      </div>
      {action && <div>{action}</div>}
    </header>
  );
}

interface StatusChipProps {
  readonly label: string;
  readonly tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

const CHIP_STYLES: Record<NonNullable<StatusChipProps['tone']>, string> = {
  success: 'bg-[#e8f5e9] text-[#2e7d32] dark:bg-[#1a2e1c] dark:text-[#a5d6a7]',
  warning: 'bg-[#fff4e6] text-[#8a5a00] dark:bg-[#3a2a00] dark:text-[#ffd68c]',
  danger: 'bg-[#ffebee] text-[#c62828] dark:bg-[#2e1212] dark:text-[#ff8a80]',
  info: 'bg-[#e3f2fd] text-[#1565c0] dark:bg-[#0d253d] dark:text-[#7fc0ff]',
  neutral: 'bg-surface-container text-secondary',
};

export function StatusChip({ label, tone = 'neutral' }: StatusChipProps) {
  return (
    <span
      className={
        'inline-block px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ' +
        CHIP_STYLES[tone]
      }
    >
      {label}
    </span>
  );
}

export function PrimaryButton({
  children,
  icon,
  onClick,
  disabled,
  type = 'button',
}: {
  readonly children: React.ReactNode;
  readonly icon?: string;
  readonly onClick?: () => void;
  readonly disabled?: boolean;
  readonly type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="atelier-shadow-sm inline-flex items-center gap-2 bg-inverse-surface px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-inverse-on-surface transition-transform duration-300 ease-editorial hover:scale-[1.02] disabled:opacity-50"
    >
      {icon && (
        <span className="material-symbols-outlined text-sm" aria-hidden>
          {icon}
        </span>
      )}
      {children}
    </button>
  );
}
