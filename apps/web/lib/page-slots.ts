/**
 * Page-slot data layer.
 *
 * Reads slot definitions + assets from the API. When a slot has no asset
 * yet (DB row exists but no upload done), the callsite provides a fallback
 * image/video URL from the existing hardcoded constants so the storefront
 * stays visually intact during the migration.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export type MediaKind = 'IMAGE' | 'VIDEO';

export interface MediaAsset {
  readonly id: string;
  readonly kind: MediaKind;
  readonly mime: string;
  readonly bytes: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly durationMs: number | null;
  readonly publicUrl: string;
  readonly posterUrl: string | null;
}

export interface PageSlotRecord {
  readonly id: string;
  readonly pageKey: string;
  readonly slotKey: string;
  readonly label: string;
  readonly mediaKind: MediaKind;
  readonly acceptsVideo: boolean;
  readonly assetId: string | null;
  readonly asset: MediaAsset | null;
  readonly heading: string | null;
  readonly subheading: string | null;
  readonly body: string | null;
  readonly ctaLabel: string | null;
  readonly ctaHref: string | null;
  readonly altText: string | null;
  readonly position: number;
  readonly groupKey: string | null;
  readonly isActive: boolean;
  readonly specWidth: number;
  readonly specHeight: number;
  readonly specAspect: string;
  readonly maxBytes: number;
}

interface SlotsPayload {
  readonly slots: PageSlotRecord[];
}

/**
 * Server-side fetcher for Server Components.
 * Tolerates API downtime — returns empty slots so components can fall back.
 */
export async function fetchPageSlots(pageKey: string): Promise<PageSlotRecord[]> {
  try {
    const res = await fetch(`${API}/media/slots?page=${encodeURIComponent(pageKey)}`, {
      next: { revalidate: 30, tags: [`slots:${pageKey}`] },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: SlotsPayload };
    return json.data?.slots ?? [];
  } catch {
    return [];
  }
}

/** Pick one slot by key from a fetched list. */
export function pickSlot(slots: readonly PageSlotRecord[], slotKey: string): PageSlotRecord | undefined {
  return slots.find((s) => s.slotKey === slotKey);
}

/** Pick a group (carousel/grid) and return sorted by position. */
export function pickSlotGroup(slots: readonly PageSlotRecord[], groupKey: string): PageSlotRecord[] {
  return slots
    .filter((s) => s.groupKey === groupKey)
    .slice()
    .sort((a, b) => a.position - b.position);
}

/** Resolve the display URL for a slot, or a provided fallback. */
export function resolveSlotUrl(
  slot: PageSlotRecord | undefined,
  fallback: string,
): { src: string; kind: MediaKind; poster: string | null } {
  if (slot?.asset?.publicUrl) {
    return {
      src: slot.asset.publicUrl,
      kind: slot.asset.kind,
      poster: slot.asset.posterUrl,
    };
  }
  return { src: fallback, kind: 'IMAGE', poster: null };
}

/** Resolve text with a provided fallback. */
export function resolveSlotText(
  slot: PageSlotRecord | undefined,
  fallback: string,
  field: 'heading' | 'subheading' | 'body' | 'ctaLabel' | 'ctaHref' = 'heading',
): string {
  const v = slot?.[field];
  return v && v.length > 0 ? v : fallback;
}
