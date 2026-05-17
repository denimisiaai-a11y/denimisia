/**
 * Word-boundary-safe truncation for SEO descriptions. Avoids mid-word cuts
 * that tank SERP click-through rate.
 */

const ELLIPSIS = '…';

export function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;

  const slice = clean.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(' ');
  const cutoff = lastSpace > max * 0.6 ? lastSpace : slice.length;
  return `${clean.slice(0, cutoff).trimEnd()}${ELLIPSIS}`;
}

/** Strip HTML and truncate. Safe for descriptions stored as markdown/HTML. */
export function plainText(text: string, max = 160): string {
  const stripped = text.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');
  return truncate(stripped, max);
}
