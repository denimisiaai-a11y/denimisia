import type { ReactNode } from 'react';

interface SectionHeadingProps {
  children: ReactNode;
  eyebrow?: string;
  rightSlot?: ReactNode;
  align?: 'left' | 'center';
  className?: string;
}

export function SectionHeading({
  children,
  eyebrow,
  rightSlot,
  align = 'left',
  className = '',
}: SectionHeadingProps) {
  if (align === 'center' && !eyebrow && !rightSlot) {
    return (
      <h2
        className={`text-center text-xl font-medium uppercase tracking-[0.1em] text-ink md:text-2xl ${className}`}
      >
        {children}
      </h2>
    );
  }

  return (
    <div
      className={`flex items-end justify-between gap-6 ${
        align === 'center' ? 'text-center' : ''
      } ${className}`}
    >
      <div>
        {eyebrow && (
          <span className="mb-3 block text-[0.7rem] font-medium uppercase tracking-[0.3em] text-[var(--color-secondary)]">
            {eyebrow}
          </span>
        )}
        <h2 className="text-3xl font-black uppercase leading-[0.95] tracking-tighter text-ink md:text-4xl lg:text-5xl">
          {children}
        </h2>
      </div>
      {rightSlot && <div className="shrink-0 pb-2">{rightSlot}</div>}
    </div>
  );
}
