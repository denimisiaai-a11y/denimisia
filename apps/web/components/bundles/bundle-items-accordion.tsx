'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, ChevronDown } from 'lucide-react';
import type { PlaceholderBundleItem } from '@/lib/placeholder-bundles';

interface BundleItemsAccordionProps {
  items: PlaceholderBundleItem[];
}

const EASE = [0.22, 1, 0.36, 1] as const;

function formatPrice(value: number): string {
  return `BDT ${value.toLocaleString('en-BD', { maximumFractionDigits: 0 })}`;
}

export function BundleItemsAccordion({ items }: BundleItemsAccordionProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <ul className="divide-y divide-[var(--color-outline-variant)] border-y border-[var(--color-outline-variant)]">
      {items.map((item, idx) => {
        const isOpen = openIdx === idx;
        const lineTotal = item.price * item.quantity;
        return (
          <li key={`${item.name}-${idx}`}>
            <button
              type="button"
              onClick={() => setOpenIdx(isOpen ? null : idx)}
              aria-expanded={isOpen}
              aria-controls={`bundle-item-${idx}`}
              className="flex w-full items-center gap-4 py-5 text-left transition-colors hover:bg-[var(--color-surface-low)]"
            >
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[8px] bg-[var(--color-surface-highest)]">
                <Image
                  src={item.image}
                  alt={item.name}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold uppercase tracking-wide text-ink">
                  {item.name}
                </p>
                <p className="mt-1 text-xs text-[var(--color-secondary)]">
                  {item.quantity > 1 ? `Qty ${item.quantity} · ` : ''}
                  {formatPrice(item.price)}
                  {item.quantity > 1 && (
                    <span className="text-ink/40"> · {formatPrice(lineTotal)}</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Check size={16} strokeWidth={1.5} className="text-ink/40" />
                <ChevronDown
                  size={18}
                  strokeWidth={1.5}
                  className={`text-ink/50 transition-transform duration-300 ${
                    isOpen ? 'rotate-180 text-ink' : ''
                  }`}
                />
              </div>
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="content"
                  id={`bundle-item-${idx}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.45, ease: EASE }}
                  className="overflow-hidden"
                >
                  <div className="pb-8 pt-3">
                    <div className="grid gap-6 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                      <div className="relative aspect-square overflow-hidden rounded-[14px] bg-[var(--color-surface-highest)]">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, 40vw"
                        />
                      </div>
                      <div className="flex flex-col">
                        <p className="text-sm leading-relaxed text-ink/80">
                          {item.description}
                        </p>

                        {item.material && (
                          <p className="mt-5 text-[10px] uppercase tracking-[0.25em] text-[var(--color-secondary)]">
                            <span className="font-bold text-ink">Material · </span>
                            {item.material}
                          </p>
                        )}

                        {item.features.length > 0 && (
                          <ul className="mt-5 space-y-2.5">
                            {item.features.map((f) => (
                              <li
                                key={f}
                                className="flex items-start gap-2.5 text-xs text-ink/75"
                              >
                                <Check
                                  size={13}
                                  strokeWidth={2.25}
                                  className="mt-[3px] shrink-0 text-ink"
                                />
                                <span>{f}</span>
                              </li>
                            ))}
                          </ul>
                        )}

                        <div className="mt-auto flex items-center justify-between gap-4 pt-8">
                          <div>
                            <p className="text-lg font-bold text-ink">
                              {formatPrice(item.price)}
                            </p>
                            {item.quantity > 1 && (
                              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-secondary)]">
                                × {item.quantity} in this bundle
                              </p>
                            )}
                          </div>
                          <Link
                            href={item.productHref ?? '/shop'}
                            className="group inline-flex items-center gap-2 border-b border-ink pb-1 text-[10px] font-bold uppercase tracking-[0.3em] text-ink transition-opacity hover:opacity-70"
                          >
                            Shop This Item
                            <ArrowRight
                              size={14}
                              strokeWidth={2}
                              className="transition-transform group-hover:translate-x-1"
                            />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}
