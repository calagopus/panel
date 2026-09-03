import { load } from 'js-yaml';

/**
 * Parses a text document that is either JSON (detected by a leading `{`) or YAML, returning the raw
 * parsed value untouched — no key remapping. Throws on malformed input.
 */
export function parseStructuredDocument(text: string): unknown {
  const trimmed = text.trim();
  return trimmed.startsWith('{') ? JSON.parse(trimmed) : load(trimmed);
}
