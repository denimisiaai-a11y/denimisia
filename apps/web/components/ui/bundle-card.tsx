import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface BundleCardProps {
  name: string;
  slug: string;
  image: string;
  badgeText: string;
  eyebrow?: string;
  tagline?: string;
  originalPrice?: number;
  bundlePrice?: number;
  savingsPercent?: number;
  itemCount?: number;
}

const formatTaka = (value: number) =>
  new Intl.NumberFormat('en-BD', { maximumFractionDigits: 0 }).format(value);

export function BundleCard({
  name,
  slug,
  image,
  badgeText,
  eyebrow,
  tagline,
  originalPrice,
  bundlePrice,
  savingsPercent,
  itemCount,
}: BundleCardProps) {
  return (
    <Link
      href={`/bundles/${slug}`}
      className="group relative flex flex-col overflow-hidden bg-paper shadow-[0_1px_0_rgba(0,0,0,0.06)] ring-1 ring-ink/5 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_24px_48px_-18px_rgba(0,0,0,0.45)] hover:ring-ink/15"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-[var(--color-surface-highest)]">
        <Image
          src={image}
          alt={name}
          fill
          className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-110"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/10 to-transparent" />

        {savingsPercent ? (
          <div className="absolute right-4 top-4 flex flex-col items-center justify-center bg-paper px-3 py-2 text-ink shadow-lg">
            <span className="text-[8px] font-medium uppercase tracking-[0.25em] text-ink/60">
              Save
            </span>
            <span className="text-xl font-black leading-none tracking-tight">
              {savingsPercent}%
            </span>
          </div>
        ) : null}

        <div className="absolute left-4 top-4 bg-ink px-3 py-1.5 text-[9px] font-medium uppercase leading-tight tracking-[0.2em] text-paper">
          {badgeText}
        </div>

        <div className="absolute inset-x-4 bottom-4 flex flex-col gap-1 text-paper">
          {eyebrow ? (
            <span className="text-[9px] font-medium uppercase tracking-[0.3em] text-paper/75">
              {eyebrow}
            </span>
          ) : null}
          <h3 className="text-lg font-black uppercase leading-tight tracking-tight">
            {name}
          </h3>
          {tagline ? (
            <p className="line-clamp-2 max-h-0 overflow-hidden text-xs leading-relaxed text-paper/85 opacity-0 transition-all duration-500 group-hover:max-h-16 group-hover:opacity-100">
              {tagline}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-ink/5 bg-paper px-4 py-4">
        <div className="flex flex-col">
          {bundlePrice != null && originalPrice != null ? (
            <div className="flex items-baseline gap-2">
              <span className="text-base font-black tracking-tight text-ink">
                BDT {formatTaka(bundlePrice)}
              </span>
              <span className="text-xs font-medium text-ink/40 line-through">
                BDT {formatTaka(originalPrice)}
              </span>
            </div>
          ) : (
            <span className="text-xs font-bold uppercase tracking-widest text-ink">
              {name}
            </span>
          )}
          {itemCount ? (
            <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.2em] text-ink/50">
              {itemCount} pieces · Shop the look
            </span>
          ) : null}
        </div>
        <span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full bg-ink text-paper transition-all duration-300 group-hover:scale-110 group-hover:bg-ink">
          <ArrowRight
            size={16}
            strokeWidth={2}
            className="transition-transform duration-300 group-hover:translate-x-0.5"
          />
        </span>
      </div>
    </Link>
  );
}
