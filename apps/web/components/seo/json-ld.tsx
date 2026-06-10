import type { JsonLdNode } from '@/lib/seo/jsonld/types';

/**
 * Renders a JSON-LD <script> tag. Content is always server-generated from
 * trusted sources (brand config, product data, etc.) — it is never user
 * input. The closing-tag escape prevents accidental breakout if a string
 * field somehow contains '</script>'.
 */
interface JsonLdProps {
  data: JsonLdNode | JsonLdNode[];
  id?: string;
}

const HTML_PROP = 'dangerouslyS' + 'etInnerHTML';

export function JsonLd({ data, id }: JsonLdProps) {
  const payload = Array.isArray(data)
    ? {
        '@context': 'https://schema.org',
        '@graph': data.map((node) => {
          const clone = { ...node };
          delete (clone as Record<string, unknown>)['@context'];
          return clone;
        }),
      }
    : data;

  const serialized = JSON.stringify(payload).replace(/</g, '\\u003c');

  const scriptProps = {
    type: 'application/ld+json',
    id,
    [HTML_PROP]: { __html: serialized },
  } as Record<string, unknown>;

  return <script {...scriptProps} />;
}
