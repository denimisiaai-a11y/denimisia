import { PageShell } from './page-shell';
import { StatusChip, SurfaceCard } from './admin-ui';

interface ComingSoonProps {
  readonly title: string;
  readonly description: string;
  readonly breadcrumbs: readonly { readonly label: string; readonly href?: string }[];
  readonly icon: string;
  readonly featureList: readonly string[];
  readonly status?: 'Planned' | 'In Build' | 'Backend Required';
}

export function ComingSoon({
  title,
  description,
  breadcrumbs,
  icon,
  featureList,
  status = 'Planned',
}: ComingSoonProps) {
  const tone =
    status === 'In Build' ? 'warning' : status === 'Backend Required' ? 'info' : 'neutral';

  return (
    <PageShell
      title={title}
      description={description}
      breadcrumbs={breadcrumbs}
      actions={<StatusChip label={status} tone={tone} />}
    >
      <SurfaceCard className="p-10">
        <div className="flex flex-col items-center gap-6 text-center md:flex-row md:items-start md:text-left">
          <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center bg-surface-container">
            <span className="material-symbols-outlined text-4xl text-on-surface" aria-hidden>
              {icon}
            </span>
          </div>
          <div className="flex-1">
            <h3 className="font-headline text-2xl font-semibold uppercase tracking-[0.15em] text-on-surface">
              Coming Soon
            </h3>
            <p className="mt-3 font-body text-sm leading-relaxed text-secondary">
              {description}
            </p>

            <div className="mt-6">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.25em] text-secondary">
                Planned capabilities
              </p>
              <ul className="space-y-2">
                {featureList.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3 font-body text-sm text-on-surface"
                  >
                    <span
                      className="material-symbols-outlined mt-0.5 text-base text-secondary"
                      aria-hidden
                    >
                      arrow_forward
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </SurfaceCard>
    </PageShell>
  );
}
