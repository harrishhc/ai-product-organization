// Product Context boundary: product-specific facts live under products/<id>/
// and are never baked into PDM Core, methodology, or governance. Retrieval is
// bounded by requested sections rather than dumping the full product context
// into every task (Runtime Architecture §8-9, Constitution §12).

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRODUCTS_DIR = path.join(__dirname, '..', 'products');

const VALID_SECTIONS = Object.freeze(['strategy', 'users', 'evidence', 'decisions', 'experiments', 'roadmap']);

/**
 * Loads a product's full context.json. This is the only place in the runtime
 * that touches products/. Callers should almost always use
 * getBoundedContext() instead of holding onto the full object.
 */
export function loadProductContext(productId) {
  const contextPath = path.join(PRODUCTS_DIR, productId, 'context.json');
  if (!existsSync(contextPath)) {
    throw new Error(`No Product Context found for "${productId}" at ${contextPath}`);
  }
  return JSON.parse(readFileSync(contextPath, 'utf8'));
}

/**
 * Bounded retrieval: returns only the requested sections of a product's
 * context, not the full object. This is the default rule ("load the
 * narrowest context sufficient to make a high-quality decision" —
 * Specification §10).
 *
 * @param {string} productId
 * @param {string[]} sections - subset of VALID_SECTIONS
 */
export function getBoundedContext(productId, sections) {
  if (!Array.isArray(sections) || sections.length === 0) {
    throw new Error('getBoundedContext requires a non-empty list of sections; full-context loading is not the default.');
  }
  const invalid = sections.filter((s) => !VALID_SECTIONS.includes(s));
  if (invalid.length > 0) {
    throw new Error(`Unknown Product Context section(s): ${invalid.join(', ')}. Valid: ${VALID_SECTIONS.join(', ')}`);
  }
  const full = loadProductContext(productId);
  const bounded = { product_id: full.product_id };
  for (const s of sections) bounded[s] = full[s];
  return bounded;
}

export { VALID_SECTIONS, PRODUCTS_DIR };
