interface MetricCardProps {
  readonly label: string;
  readonly value: string;
  readonly icon: string;
  readonly valuePrefix?: string;
  readonly trend?: string;
  readonly trendPositive?: boolean;
}

export function MetricCard({
  label,
  value,
  icon,
  valuePrefix,
  trend,
  trendPositive,
}: MetricCardProps) {
  return (
    <div className="atelier-shadow group relative overflow-hidden bg-surface-container-lowest p-6 transition-colors duration-300 ease-editorial hover:bg-surface-container">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
            {label}
          </p>
          <p className="mt-3 truncate font-headline text-3xl font-semibold text-on-surface">
            {valuePrefix ? (
              <>
                <span className="text-secondary">{valuePrefix}</span>
                {value}
              </>
            ) : (
              value
            )}
          </p>
          {trend && (
            <p
              className={
                trendPositive
                  ? 'mt-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#059669]'
                  : 'mt-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-primary'
              }
            >
              {trend}
            </p>
          )}
        </div>
        <span
          className="material-symbols-outlined text-secondary transition-colors duration-300 ease-editorial group-hover:text-on-surface"
          aria-hidden
        >
          {icon}
        </span>
      </div>
    </div>
  );
}
