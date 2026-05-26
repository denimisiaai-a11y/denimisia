'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, ChevronDown, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { NAV_ITEMS, type NavMenuItem } from '@/lib/constants';
import { useMobileChrome } from '@/stores/mobile-chrome';
import { cn } from '@/lib/utils';

interface MobileMenuProps {
  readonly navItems?: readonly NavMenuItem[];
  open: boolean;
  onClose: () => void;
}

const SPRING = { type: 'spring' as const, stiffness: 320, damping: 36 };

export function MobileMenu({ open, onClose, navItems = NAV_ITEMS }: MobileMenuProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const openSearch = useMobileChrome((s) => s.openSearch);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const toggle = (label: string) =>
    setExpanded((prev) => (prev === label ? null : label));

  const onSearchTap = () => {
    onClose();
    setTimeout(openSearch, 150);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-ink/45 backdrop-blur-sm lg:hidden"
            onClick={onClose}
          />

          <motion.div
            key="drawer"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={SPRING}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0.4, right: 0 }}
            onDragEnd={(_, info) => {
              if (info.offset.x < -80 || info.velocity.x < -400) onClose();
            }}
            className={cn(
              'fixed left-0 top-0 z-50 flex h-full w-[88vw] max-w-[420px] flex-col',
              'bg-paper shadow-[0_0_60px_rgba(0,0,0,0.18)] lg:hidden',
              'pt-[var(--safe-top)]',
            )}
          >
            <div className="flex h-14 items-center justify-between border-b border-[var(--color-outline-variant)] px-5">
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-ink">
                Menu
              </span>
              <button
                onClick={onClose}
                aria-label="Close menu"
                className="flex h-12 w-12 -mr-3 items-center justify-center rounded-full text-ink/80 transition-colors hover:bg-[var(--color-surface-low)] hover:text-ink"
              >
                <X size={22} strokeWidth={1.5} />
              </button>
            </div>

            <button
              type="button"
              onClick={onSearchTap}
              className={cn(
                'mx-5 mt-4 flex h-12 items-center gap-3 rounded-full',
                'bg-[var(--color-surface-low)] px-4 text-left text-sm text-[var(--color-secondary)]',
                'transition-colors hover:bg-[var(--color-surface-mid)]',
              )}
            >
              <Search size={16} strokeWidth={1.5} />
              <span>Search products, bundles…</span>
            </button>

            <nav
              className="flex-1 overflow-y-auto px-5 pt-2 pb-6"
              style={{ paddingBottom: 'calc(1.5rem + var(--safe-bottom))' }}
            >
              {navItems.map((item) =>
                item.href && !item.sections ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={onClose}
                    className="flex min-h-12 items-center border-b border-[var(--color-outline-variant)] py-3 text-[15px] font-medium uppercase tracking-[0.12em] text-ink"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <div key={item.label} className="border-b border-[var(--color-outline-variant)]">
                    <button
                      onClick={() => toggle(item.label)}
                      aria-expanded={expanded === item.label}
                      className="flex min-h-12 w-full items-center justify-between py-3 text-[15px] font-medium uppercase tracking-[0.12em] text-ink"
                    >
                      {item.label}
                      <ChevronDown
                        size={18}
                        strokeWidth={1.5}
                        className={cn(
                          'transition-transform duration-200',
                          expanded === item.label && 'rotate-180',
                        )}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {expanded === item.label && item.sections && (
                        <motion.div
                          key="panel"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="pb-4 pl-1">
                            {item.sections.map((section) => (
                              <div key={section.title} className="mb-4">
                                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-secondary)]">
                                  {section.title}
                                </h4>
                                <ul className="space-y-1">
                                  {section.items.map((sub) => (
                                    <li key={sub.href}>
                                      <Link
                                        href={sub.href}
                                        onClick={onClose}
                                        className="flex min-h-11 items-center gap-2 py-1.5 text-sm text-ink/85 transition-colors hover:text-ink"
                                      >
                                        {sub.label}
                                        {sub.count !== undefined && (
                                          <span className="text-[11px] text-[var(--color-secondary)]">
                                            {sub.count}
                                          </span>
                                        )}
                                      </Link>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ),
              )}
            </nav>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
