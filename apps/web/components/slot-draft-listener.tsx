'use client';

/**
 * Listens for draft-preview postMessage events from the admin iframe.
 *
 * When admin is editing a slot, draft values are posted to the storefront
 * before they are saved. This component applies those drafts to any DOM
 * node tagged with `data-slot="<pageKey>.<slotKey>"` so the user sees live
 * changes as they type/upload — like Figma, but on the real production layout.
 *
 * Only active when URL has ?edit=1 AND parent frame origin is allow-listed.
 * Body HTML is sanitized via DOMPurify (defense-in-depth alongside origin check).
 */

import { useEffect } from 'react';
import DOMPurify from 'dompurify';

interface DraftPatch {
  readonly heading?: string;
  readonly subheading?: string;
  readonly body?: string;
  readonly ctaLabel?: string;
  readonly ctaHref?: string;
  readonly mediaUrl?: string;
  readonly mediaKind?: 'IMAGE' | 'VIDEO';
  readonly poster?: string | null;
}

interface DraftMessage {
  readonly type: 'denimisia:slot-draft';
  readonly slotRef: string;
  readonly patch: DraftPatch;
}

const ALLOWED_PARENT_ORIGINS = (
  process.env.NEXT_PUBLIC_ADMIN_ORIGINS ?? 'http://localhost:3002'
).split(',').map((s) => s.trim()).filter(Boolean);

function isDraftMessage(value: unknown): value is DraftMessage {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v['type'] === 'denimisia:slot-draft'
    && typeof v['slotRef'] === 'string'
    && typeof v['patch'] === 'object' && v['patch'] !== null;
}

function applyPatch(slotRef: string, patch: DraftPatch): void {
  const root = document.querySelector<HTMLElement>(`[data-slot="${CSS.escape(slotRef)}"]`);
  if (!root) return;

  if (patch.heading !== undefined) {
    const el = root.querySelector<HTMLElement>('[data-slot-field="heading"]');
    if (el) el.textContent = patch.heading;
  }
  if (patch.subheading !== undefined) {
    const el = root.querySelector<HTMLElement>('[data-slot-field="subheading"]');
    if (el) el.textContent = patch.subheading;
  }
  if (patch.body !== undefined) {
    const el = root.querySelector<HTMLElement>('[data-slot-field="body"]');
    if (el) {
      const clean = DOMPurify.sanitize(patch.body, {
        ALLOWED_TAGS: ['p','strong','em','b','i','u','a','ul','ol','li','br','h1','h2','h3','h4','blockquote','code','pre'],
        ALLOWED_ATTR: ['href','target','rel'],
      });
      el.replaceChildren();
      el.insertAdjacentHTML('afterbegin', clean);
    }
  }
  if (patch.ctaLabel !== undefined) {
    const el = root.querySelector<HTMLElement>('[data-slot-field="ctaLabel"]');
    if (el) el.textContent = patch.ctaLabel;
  }
  if (patch.ctaHref !== undefined) {
    const el = root.querySelector<HTMLAnchorElement>('[data-slot-field="ctaHref"]');
    if (el) el.href = patch.ctaHref;
  }
  // Only act on non-empty media URLs. An empty string would blank the image
  // (browsers fall back to the document URL) and wipe Next's responsive
  // srcset, making the storefront render broken placeholders.
  if (typeof patch.mediaUrl === 'string' && patch.mediaUrl.length > 0) {
    const img = root.querySelector<HTMLImageElement>('img[data-slot-field="media"]');
    const video = root.querySelector<HTMLVideoElement>('video[data-slot-field="media"]');
    if (patch.mediaKind === 'VIDEO' && video) {
      video.src = patch.mediaUrl;
      if (patch.poster) video.poster = patch.poster;
      void video.load();
    } else if (img) {
      img.src = patch.mediaUrl;
      // Clearing srcset is intentional — the preview URL is a single resolution,
      // not a responsive set. Next's optimizer variants no longer match.
      img.srcset = '';
    }
  }
}

function reportSlotPositions(): void {
  const nodes = document.querySelectorAll<HTMLElement>('[data-slot]');
  const slots = Array.from(nodes).map((el) => {
    const rect = el.getBoundingClientRect();
    return {
      slotRef: el.getAttribute('data-slot') ?? '',
      kind:    el.getAttribute('data-slot-kind') ?? 'media',
      // Viewport-relative so admin overlay aligns with what's visible in the
      // iframe — resends on scroll so badges follow the content.
      rect: {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      },
    };
  });
  const target = resolveAdminTarget();
  // If the parent frame isn't an allow-listed admin origin, silently drop.
  // Better to break the overlay than leak slot data to an attacker embedder.
  if (!target) return;
  window.parent.postMessage({ type: 'denimisia:slots-ready', slots }, target);
}

function resolveAdminTarget(): string | null {
  // Match the parent frame origin against the allow-list. Using '*' as the
  // targetOrigin would leak slot layout to any page that embeds us.
  let referrerOrigin: string | null = null;
  try {
    referrerOrigin = document.referrer ? new URL(document.referrer).origin : null;
  } catch {
    referrerOrigin = null;
  }
  const match = ALLOWED_PARENT_ORIGINS.find((o) => o === referrerOrigin);
  return match ?? null;
}

export function SlotDraftListener(): null {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const isEditUrl = params.get('edit') === '1';

    // Flag <html> whenever URL signals edit mode (direct or iframe). CSS uses
    // this to hide the splash prerender overlay + contrast tints so admins
    // can actually see the slot content they are editing.
    if (isEditUrl) {
      document.documentElement.dataset.editMode = '1';
    }

    const inIframe = window.self !== window.top;
    if (!inIframe) return;
    if (!isEditUrl) return;

    function onMessage(e: MessageEvent): void {
      if (!ALLOWED_PARENT_ORIGINS.includes(e.origin)) return;
      if (isDraftMessage(e.data)) {
        applyPatch(e.data.slotRef, e.data.patch);
      } else if ((e.data as { type?: string } | null)?.type === 'denimisia:request-slots') {
        reportSlotPositions();
      }
    }
    window.addEventListener('message', onMessage);

    reportSlotPositions();
    const onResize = (): void => reportSlotPositions();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, { passive: true });

    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize);
    };
  }, []);

  return null;
}
