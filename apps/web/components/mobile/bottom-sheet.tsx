'use client';

import { type ReactNode } from 'react';
import { Drawer } from 'vaul';
import { cn } from '@/lib/utils';

type SnapPoint = string | number;

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  /**
   * Pinned footer content rendered inside the sheet (e.g. an Apply or Checkout button).
   * Stays fixed while the sheet body scrolls.
   */
  footer?: ReactNode;
  /**
   * Vaul snap points. Examples: ['50%', '90%'] or [0.5, 1].
   * Omit for a single auto-height snap.
   */
  snapPoints?: SnapPoint[];
  /**
   * Whether the sheet can be dismissed by drag-down or backdrop tap. Default: true.
   */
  dismissible?: boolean;
  /**
   * Show the drag handle pill at the top of the sheet. Default: true.
   */
  showHandle?: boolean;
  className?: string;
}

export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  snapPoints,
  dismissible = true,
  showHandle = true,
  className,
}: BottomSheetProps) {
  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={snapPoints}
      dismissible={dismissible}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm" />
        <Drawer.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex flex-col',
            // Without snap points, vaul sizes the drawer to its content. We
            // give it a definite height so the flex-1 body has bounded space
            // to fill. With snap points, vaul controls height — defer to it.
            snapPoints ? 'max-h-[96svh]' : 'h-[88svh]',
            'rounded-t-2xl bg-paper outline-none',
            'shadow-[0_-12px_40px_-8px_rgba(0,0,0,0.25)]',
            className,
          )}
          style={{ paddingBottom: 'var(--safe-bottom)' }}
        >
          {showHandle && (
            <div className="flex justify-center pt-2.5 pb-1.5">
              <div
                aria-hidden
                className="h-1 w-10 rounded-full bg-[var(--color-outline-variant)]"
              />
            </div>
          )}

          <div className="px-5 pb-2 pt-2">
            <Drawer.Title className="type-h2 font-semibold text-ink">
              {title}
            </Drawer.Title>
            {description ? (
              <Drawer.Description className="type-meta mt-1 text-[var(--color-secondary)]">
                {description}
              </Drawer.Description>
            ) : (
              <Drawer.Description className="sr-only">
                {title}
              </Drawer.Description>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-4">
            {children}
          </div>

          {footer && (
            <div
              className={cn(
                'border-t border-[var(--color-outline-variant)]',
                'bg-paper/95 backdrop-blur-md px-5 pb-3 pt-3',
              )}
            >
              {footer}
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
