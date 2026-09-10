// Product Registry: a small, HH/PDM-owned pointer index — NOT a copy of any
// product's content. Each product owns its own repository; this file only
// maps a product id to where that repository lives, so PDM can resolve and
// read one product's bounded context on demand without scanning or
// centrally storing every product's data inside the PDM repo.
//
// PDM -> Product Registry -> identify selected product -> resolve product
// repository -> retrieve only relevant/bounded Product Context.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');
const PRODUCT_REGISTRY_PATH = path.join(REPO_ROOT, 'products', 'registry.json');

let cachedRegistry = null;

/** Cached for the process lifetime — this is small, stable metadata, not product content. */
export function loadProductRegistry() {
  if (cachedRegistry) return cachedRegistry;
  const raw = readFileSync(PRODUCT_REGISTRY_PATH, 'utf8');
  cachedRegistry = JSON.parse(raw);
  return cachedRegistry;
}

/** Test/dev helper to force a fresh read on the next call. */
export function _resetProductRegistryCache() {
  cachedRegistry = null;
}

/**
 * Resolves a single product's repository location by explicit id lookup —
 * never by scanning all registered products or the filesystem. A product
 * that has not been deliberately registered here cannot be resolved; PDM
 * must not invent or guess a location for it.
 *
 * @param {string} productId
 * @returns {{ productId: string, repositoryType: string, repositoryPath: string, contextEntry: string, metadata: object }}
 */
export function resolveProductRepository(productId) {
  const { products } = loadProductRegistry();
  const entry = products[productId];
  if (!entry) {
    throw new Error(
      `Product "${productId}" is not in the Product Registry (products/registry.json). ` +
        'Products are not auto-discovered; register the repository location explicitly before use.'
    );
  }
  if (entry.repository.type !== 'local_path') {
    // Real product repositories (a separate git checkout, a remote service, etc.)
    // are a future extension point. Only local_path is wired up in this bootstrap
    // to avoid overbuilding a resolver for repository kinds nothing uses yet.
    throw new Error(
      `Product "${productId}" uses repository.type "${entry.repository.type}", which this bootstrap does not yet resolve. Only "local_path" is supported.`
    );
  }
  const repositoryPath = path.resolve(REPO_ROOT, entry.repository.location);
  return {
    productId,
    repositoryType: entry.repository.type,
    repositoryPath,
    contextEntry: entry.context_entry,
    // Optional per-product metadata (e.g. owner, tags) — not product context
    // content, just registry-level bookkeeping. Defaults to {} when absent.
    metadata: entry.metadata ?? {},
  };
}

export function listRegisteredProductIds() {
  return Object.keys(loadProductRegistry().products);
}
