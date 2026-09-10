// Product Context boundary: product-specific facts live in each product's
// OWN repository, never centrally copied into the PDM repo, and never baked
// into PDM Core, methodology, or governance. This module resolves a
// product's repository via the Product Registry (productRegistry.js) and
// then retrieves only the bounded sections a task actually needs — never the
// whole product, and never by scanning multiple products at once.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { resolveProductRepository } from './productRegistry.js';

const VALID_SECTIONS = Object.freeze(['strategy', 'users', 'evidence', 'decisions', 'experiments', 'roadmap']);

/**
 * Loads a product's full context by resolving its repository through the
 * Product Registry, then reading that repository's context entry file. This
 * is the only place in the runtime that touches product content. Callers
 * should almost always use getBoundedContext() instead of holding onto the
 * full object.
 */
export function loadProductContext(productId) {
  const { repositoryPath, contextEntry } = resolveProductRepository(productId);
  const contextPath = path.join(repositoryPath, contextEntry);
  if (!existsSync(contextPath)) {
    throw new Error(`No Product Context found for "${productId}" at ${contextPath} (resolved via Product Registry).`);
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

export { VALID_SECTIONS };
