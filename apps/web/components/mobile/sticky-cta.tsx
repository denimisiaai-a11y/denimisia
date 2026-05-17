'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StickyCTAProps {
  children: ReactNode;
  className?: string;
}

export function StickyCTA({ children, className }: StickyCTAProps) {
  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 px-4 pt-3 pb-3',
        'bg-paper/85 backdrop-blur-xl',
        'border-t border-[var(--color-outline-variant)]',
        className,
      )}
      style={{ paddingBottom: 'calc(0.75rem + var(--safe-bottom))' }}
    >
      {children}
    </div>
  );
}
