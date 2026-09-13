// Product Registry: a small, HH/PDM-owned pointer index — NOT a copy of any
// product's content. Each product owns its own repository; this file only
// maps a product id to where that repository lives, so PDM can resolve and
// read one product's bounded context on demand without scanning or
// centrally storing every product's data inside the PDM repo.
//
// PDM -> Product Registry -> identify selected product -> resolve product
// repository -> retrieve only relevant/bounded Product Context.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');
const PRODUCT_REGISTRY_PATH = path.join(REPO_ROOT, 'products', 'registry.json');

/**
 * Portfolio policy, and the only portfolio-level truth that exists: a product
 * cannot know its own priority relative to other products, so `priority` and
 * `status` live here, in the index HH owns — never copied down into any
 * product's own context, and never duplicating anything a product already
 * knows about itself.
 *
 * - `active`   — a portfolio member PDM may select work from
 * - `paused`   — deliberately not worked right now; skipped by selection
 * - `archived` — kept resolvable for history, never selected
 * - `fixture`  — exists for this repository's tests, not a real product
 *
 * `priority` is a rank where lower runs first. Absent means unranked, which
 * sorts last.
 */
export const PRODUCT_STATUSES = Object.freeze(['active', 'paused', 'archived', 'fixture']);
const DEFAULT_STATUS = 'active';

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
 * Resolves a repository descriptor to a local directory that can be read
 * from disk right now — never performs network I/O itself. For "git_remote",
 * the local clone is expected to already exist (created/updated by the
 * separate, explicitly-invoked runtime/productSync.js#syncGitRemoteProduct);
 * this function only checks that it's there, matching the "an ordinary pass
 * needs no network call" invariant (tests/invariants.test.js).
 */
function resolveRepositoryPath(productId, repository) {
  if (repository.type === 'local_path') {
    return path.resolve(REPO_ROOT, repository.location);
  }
  if (repository.type === 'git_remote') {
    const clonePath = path.resolve(REPO_ROOT, repository.local_clone_path);
    if (!existsSync(clonePath)) {
      throw new Error(
        `Product "${productId}" uses repository.type "git_remote" but its local clone does not exist yet at ${clonePath}. ` +
          'Run the deliberate sync step first: runtime/productSync.js#syncGitRemoteProduct (never performed automatically).'
      );
    }
    return clonePath;
  }
  // Other repository kinds (a remote service, etc.) are a future extension
  // point. Only local_path and git_remote are wired up in this bootstrap, to
  // avoid overbuilding a resolver for kinds nothing uses yet.
  throw new Error(
    `Product "${productId}" uses repository.type "${repository.type}", which this bootstrap does not yet resolve. Supported: "local_path", "git_remote".`
  );
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
  const repositoryPath = resolveRepositoryPath(productId, entry.repository);
  const status = entry.status ?? DEFAULT_STATUS;
  if (!PRODUCT_STATUSES.includes(status)) {
    throw new Error(
      `Product "${productId}" has status "${status}", which is not one of: ${PRODUCT_STATUSES.join(', ')}.`
    );
  }
  return {
    productId,
    repositoryType: entry.repository.type,
    repositoryPath,
    contextEntry: entry.context_entry,
    // Portfolio policy (see PRODUCT_STATUSES). Not product truth.
    status,
    priority: entry.priority ?? null,
    // Optional: Work State (runtime/workState.js) is opt-in per product.
    // Absent means the product has not adopted Work State yet.
    workStateEntry: entry.work_state_entry ?? null,
    // Optional per-product metadata (e.g. owner, tags) — not product context
    // content, just registry-level bookkeeping. Defaults to {} when absent.
    metadata: entry.metadata ?? {},
  };
}

export function listRegisteredProductIds() {
  return Object.keys(loadProductRegistry().products);
}

/**
 * The portfolio's membership list: registered products PDM may currently
 * select work from. Paused, archived, and test-fixture entries are excluded
 * here rather than filtered out by every caller.
 */
export function listActiveProductIds() {
  const { products } = loadProductRegistry();
  return Object.keys(products).filter((id) => (products[id].status ?? DEFAULT_STATUS) === 'active');
}
