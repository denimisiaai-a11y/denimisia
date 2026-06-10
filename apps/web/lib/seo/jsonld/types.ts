/**
 * Minimal schema.org typings. We intentionally do NOT pull in `schema-dts` —
 * its types explode the bundle and every node is already emitted as a JSON
 * string via `JSON.stringify`, so runtime type-safety is what matters.
 *
 * Add fields here as new schemas are built.
 */

export interface SchemaBase {
  '@context': 'https://schema.org';
  '@type': string;
}

export type JsonLdNode = SchemaBase & Record<string, unknown>;
