// Product Sync: the ONLY place a "git_remote" product's local clone may be
// created, updated, or published back to its own remote. Mirrors
// methodologyEvolution.js's governance pattern — explicit HH initiation
// required, the actual git/network operation is injected by the caller
// (this module performs no process or network I/O on its own), and
// orchestrator.js/context.js/workState.js must never import this module.
// Ordinary PDM work reads/writes a product's ALREADY-SYNCED local clone (see
// productRegistry.js#resolveProductRepository, context.js#writeProductContext,
// workState.js#writeWorkState); none of that ever triggers a sync or a
// publish as a side effect.

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadProductRegistry } from './productRegistry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');

function resolveGitRemoteEntry(productId) {
  const { products } = loadProductRegistry();
  const entry = products[productId];
  if (!entry) {
    throw new Error(`Product "${productId}" is not in the Product Registry (products/registry.json).`);
  }
  if (entry.repository.type !== 'git_remote') {
    throw new Error(`Product "${productId}" is not registered with repository.type "git_remote" (found "${entry.repository.type}").`);
  }
  return { entry, clonePath: path.resolve(REPO_ROOT, entry.repository.local_clone_path) };
}

function assertGovernedInvocation(fnName, { initiatedByHH, runGitCommand }) {
  if (!initiatedByHH) {
    throw new Error(`${fnName} may only run for an explicit, deliberate HH-initiated task.`);
  }
  if (typeof runGitCommand !== 'function') {
    throw new Error(`${fnName} requires an explicit runGitCommand function; this module performs no process/network I/O on its own.`);
  }
}

/**
 * @param {string} productId
 * @param {{
 *   initiatedByHH: boolean,
 *   runGitCommand: (args: string[]) => Promise<unknown>,
 *   session?: { recordNetworkCall: (reason: string) => void }
 * }} params
 */
export async function syncGitRemoteProduct(productId, { initiatedByHH, runGitCommand, session } = {}) {
  assertGovernedInvocation('syncGitRemoteProduct', { initiatedByHH, runGitCommand });
  const { entry, clonePath } = resolveGitRemoteEntry(productId);
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

/**
 * Commits and pushes whatever changes exist in a git_remote product's local
 * clone (e.g. from writeProductContext / writeWorkState / writeActiveBrief)
 * to a NEW branch on that product's own remote — never to main/its default
 * branch directly. This is the only way a change reaches the product's real
 * repository history. Deliberately does not open a pull request itself —
 * that is a separate, caller-level step (e.g. `gh pr create`), not a
 * runtime primitive.
 *
 * @param {string} productId
 * @param {{
 *   initiatedByHH: boolean,
 *   runGitCommand: (args: string[]) => Promise<unknown>,
 *   branchName: string,
 *   commitMessage: string,
 *   session?: { recordNetworkCall: (reason: string) => void }
 * }} params
 */
export async function publishProductRepositoryChanges(
  productId,
  { initiatedByHH, runGitCommand, branchName, commitMessage, session } = {}
) {
  assertGovernedInvocation('publishProductRepositoryChanges', { initiatedByHH, runGitCommand });
  if (!branchName || !commitMessage) {
    throw new Error('publishProductRepositoryChanges requires both branchName and commitMessage.');
  }
  const { clonePath } = resolveGitRemoteEntry(productId);
  if (!existsSync(clonePath)) {
    throw new Error(
      `Product "${productId}"'s local clone does not exist at ${clonePath}. Run syncGitRemoteProduct first — there is nothing to publish.`
    );
  }

  session?.recordNetworkCall?.('product_publish');
  await runGitCommand(['-C', clonePath, 'checkout', '-b', branchName]);
  await runGitCommand(['-C', clonePath, 'add', '-A']);
  await runGitCommand(['-C', clonePath, 'commit', '-m', commitMessage]);
  await runGitCommand(['-C', clonePath, 'push', '-u', 'origin', branchName]);
  return { productId, branchName, clonePath };
}
