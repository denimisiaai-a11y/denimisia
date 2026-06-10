interface SectionCardProps {
  readonly icon: string;
  readonly title: string;
  readonly action?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly className?: string;
}

export function SectionCard({
  icon,
  title,
  action,
  children,
  className,
}: SectionCardProps) {
  return (
    <section
      className={
        'atelier-shadow bg-surface-container-lowest ' + (className ?? '')
      }
    >
      <header className="flex items-center justify-between border-b border-outline-variant/15 px-6 py-4">
        <h3 className="flex items-center gap-3 font-headline text-xs font-bold uppercase tracking-[0.25em] text-on-surface">
          <span className="material-symbols-outlined text-secondary" aria-hidden>
            {icon}
          </span>
          {title}
        </h3>
        {action && <div>{action}</div>}
      </header>
      <div className="p-6">{children}</div>
    </section>
  );
}
