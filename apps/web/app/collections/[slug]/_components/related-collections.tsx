import Image from 'next/image';
import Link from 'next/link';
import { getActiveCollections } from '@/lib/collections';

interface Props {
  readonly currentSlug: string;
}

export async function RelatedCollections({ currentSlug }: Props) {
  const all = await getActiveCollections();
  const others = all.filter((c) => c.slug !== currentSlug).slice(0, 3);
  if (others.length === 0) return null;

  return (
    <section className="border-t border-ink/10 pt-16">
      <p className="mb-8 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-muted">
        You might also like
      </p>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {others.map((c) => {
          const thumb = c.image ?? c.heroImageDesktop;
          return (
            <Link
              key={c.id}
              href={`/collections/${c.slug}`}
              className="group block"
            >
              <div className="relative aspect-[4/5] overflow-hidden bg-ink">
                {thumb ? (
                  <Image
                    src={thumb}
                    alt={c.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-paper/40">
                    <span className="text-xs uppercase tracking-[0.2em]">{c.type}</span>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-paper/80">
                    {c.type === 'DROP' ? 'Drop' : c.type === 'AUTO' ? 'Always on' : 'Edit'}
                  </p>
                  <p className="mt-1 font-serif text-xl text-paper">{c.name}</p>
                  {c.subtitle && (
                    <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-paper/70 line-clamp-1">
                      {c.subtitle}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
