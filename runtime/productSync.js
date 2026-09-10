// Product Sync: the ONLY place a "git_remote" product's local clone may be
// created or updated. Mirrors methodologyEvolution.js's governance pattern —
// explicit HH initiation required, the actual git/network operation is
// injected by the caller (this module performs no process or network I/O on
// its own), and orchestrator.js must never import this module. Ordinary PDM
// work reads a product's ALREADY-SYNCED local clone (see
// productRegistry.js#resolveProductRepository); it never triggers a sync as
// a side effect of reading or writing Product Context / Work State.

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadProductRegistry } from './productRegistry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');

/**
 * @param {string} productId
 * @param {{
 *   initiatedByHH: boolean,
 *   runGitCommand: (args: string[]) => Promise<unknown>,
 *   session?: { recordNetworkCall: (reason: string) => void }
 * }} params
 */
export async function syncGitRemoteProduct(productId, { initiatedByHH, runGitCommand, session } = {}) {
  if (!initiatedByHH) {
    throw new Error('syncGitRemoteProduct may only run for an explicit, deliberate HH-initiated maintenance task.');
  }
  if (typeof runGitCommand !== 'function') {
    throw new Error(
      'syncGitRemoteProduct requires an explicit runGitCommand function; this module performs no process/network I/O on its own.'
    );
  }
  const { products } = loadProductRegistry();
  const entry = products[productId];
  if (!entry) {
    throw new Error(`Product "${productId}" is not in the Product Registry (products/registry.json).`);
  }
  if (entry.repository.type !== 'git_remote') {
    throw new Error(`Product "${productId}" is not registered with repository.type "git_remote" (found "${entry.repository.type}").`);
  }

  const clonePath = path.resolve(REPO_ROOT, entry.repository.local_clone_path);
  session?.recordNetworkCall?.('product_sync');

  if (!existsSync(clonePath)) {
    const cloneArgs = ['clone', entry.repository.remote_url, clonePath];
    if (entry.repository.branch) cloneArgs.push('--branch', entry.repository.branch);
    await runGitCommand(cloneArgs);
    return { productId, action: 'cloned', clonePath };
  }

  const pullArgs = ['-C', clonePath, 'pull', '--ff-only'];
  await runGitCommand(pullArgs);
  return { productId, action: 'pulled', clonePath };
}
