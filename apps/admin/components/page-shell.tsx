import Link from 'next/link';

interface Breadcrumb {
  readonly label: string;
  readonly href?: string;
}

interface PageShellProps {
  readonly title: string;
  readonly description?: string;
  readonly breadcrumbs?: readonly Breadcrumb[];
  readonly actions?: React.ReactNode;
  readonly children: React.ReactNode;
}

export function PageShell({
  title,
  description,
  breadcrumbs,
  actions,
  children,
}: PageShellProps) {
  return (
    <div>
      <div className="mb-10 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav
              aria-label="Breadcrumb"
              className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary"
            >
              {breadcrumbs.map((crumb, i) => (
                <span key={`${crumb.label}-${i}`} className="flex items-center gap-1.5">
                  {crumb.href ? (
                    <Link
                      href={crumb.href}
                      className="transition-colors duration-300 ease-editorial hover:text-on-surface"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span>{crumb.label}</span>
                  )}
                  {i < breadcrumbs.length - 1 && (
                    <span className="text-secondary/40">/</span>
                  )}
                </span>
              ))}
            </nav>
          )}
          <h2 className="font-headline text-4xl font-semibold uppercase tracking-[0.15em] text-on-surface">
            {title}
          </h2>
          {description && (
            <p className="mt-2 font-body text-sm tracking-wide text-secondary">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
