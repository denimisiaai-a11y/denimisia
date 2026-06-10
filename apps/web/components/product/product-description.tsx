'use client';

import { useMemo } from 'react';
import DOMPurify from 'dompurify';

interface ProductDescriptionProps {
  readonly html: string | null | undefined;
}

// Tags TipTap emits + anything else we'd reasonably accept from an admin
// who pastes formatted text. Anything outside this list (script, iframe,
// style, on*, etc.) is stripped by DOMPurify.
const ALLOWED_TAGS = [
  'p', 'br', 'hr',
  'h2', 'h3',
  'strong', 'b', 'em', 'i', 's', 'u',
  'ul', 'ol', 'li',
  'blockquote',
  'a',
  'span',
];

const ALLOWED_ATTR = ['href', 'rel', 'target', 'class'];

// TipTap output starts with an HTML tag. Legacy descriptions are plain
// text (possibly with newlines and bullet characters). Detect the
// difference so each renders correctly.
function looksLikeHtml(s: string): boolean {
  const trimmed = s.trimStart();
  return trimmed.startsWith('<') && /<\/[a-z]/i.test(trimmed);
}

export function ProductDescription({ html }: ProductDescriptionProps) {
  // Sanitize at render time. DOMPurify strips every tag outside ALLOWED_TAGS
  // (script, iframe, style, event handlers like onclick, javascript: URLs).
  // The result is XSS-safe HTML.
  const rendered = useMemo(() => {
    if (!html || !html.trim()) return null;
    if (!looksLikeHtml(html)) {
      return { kind: 'text' as const, text: html };
    }
    const clean = DOMPurify.sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ADD_ATTR: ['rel'],
    });
    return { kind: 'html' as const, html: clean };
  }, [html]);

  if (!rendered) return null;

  if (rendered.kind === 'text') {
    // Legacy plain-text descriptions — preserve newlines + spaces so bullets
    // and line breaks the admin typed don't collapse into one essay paragraph.
    return <p className="whitespace-pre-wrap">{rendered.text}</p>;
  }

  // Mirror the editor's preview styling so what the admin sees in TipTap
  // matches the storefront 1:1. `rendered.html` is post-DOMPurify so this
  // is safe to inject.
  const sanitizedHtml = rendered.html;
  return (
    <div
      className={
        '[&>h2]:mt-4 [&>h2]:mb-2 [&>h2]:font-semibold [&>h2]:text-base [&>h2]:text-ink ' +
        '[&>h3]:mt-3 [&>h3]:mb-1 [&>h3]:font-semibold [&>h3]:text-sm [&>h3]:text-ink ' +
        '[&>p]:mb-2 ' +
        '[&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-2 [&_li]:mb-1 ' +
        '[&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:mb-2 ' +
        '[&>blockquote]:border-l-2 [&>blockquote]:border-ink/20 [&>blockquote]:pl-3 [&>blockquote]:italic ' +
        '[&_a]:underline [&_a]:text-ink hover:[&_a]:opacity-80 ' +
        '[&_strong]:font-semibold [&_strong]:text-ink ' +
        '[&_em]:italic'
      }
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}
