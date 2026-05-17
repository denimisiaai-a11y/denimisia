import type { JsonLdNode } from './types';

interface FaqItem {
  question: string;
  answer: string;
}

/**
 * FAQPage schema. Per Google's 2023+ restrictions, FAQ rich results are
 * limited — we only emit this node when the FAQ is visibly rendered on the
 * page. Callers are responsible for that contract.
 */
export function faqJsonLd(items: FaqItem[]): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}
