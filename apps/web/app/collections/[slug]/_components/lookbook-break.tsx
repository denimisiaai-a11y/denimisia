import Image from 'next/image';
import type { LookbookItem } from '@/lib/collections';

interface Props {
  readonly item: LookbookItem;
}

export function LookbookBreak({ item }: Props) {
  return (
    <figure className="col-span-full my-8">
      <div className="relative aspect-[21/9] w-full overflow-hidden bg-ink">
        <Image
          src={item.imageUrl}
          alt={item.altText ?? item.caption ?? ''}
          fill
          sizes="100vw"
          className="object-cover"
        />
      </div>
      {item.caption && (
        <figcaption className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
          {item.caption}
        </figcaption>
      )}
    </figure>
  );
}
