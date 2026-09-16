// Product/Organization Sync: the ONLY place a "git_remote" product's OR
// organization's local clone may be created, updated, or published back to
// its own remote. Mirrors methodologyEvolution.js's governance pattern —
// explicit HH initiation required, the actual git/network operation is
// injected by the caller (this module performs no process or network I/O on
// its own), and orchestrator.js/context.js/workState.js/organizationContext.js
// must never import this module. Ordinary PDM work reads/writes an
// ALREADY-SYNCED local clone (see productRegistry.js#resolveProductRepository,
// #resolveOrganizationRepository, context.js#writeProductContext,
// workState.js#writeWorkState, organizationContext.js#writeOrganizationContext);
// none of that ever triggers a sync or a publish as a side effect.

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadProductRegistry } from './productRegistry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');

/** @param {'products'|'organizations'} registrySection */
function resolveGitRemoteEntry(id, registrySection, label) {
  const registry = loadProductRegistry();
  const entry = (registry[registrySection] ?? {})[id];
  if (!entry) {
    throw new Error(`${label} "${id}" is not in the Product Registry (products/registry.json, "${registrySection}").`);
  }
  if (entry.repository.type !== 'git_remote') {
    throw new Error(`${label} "${id}" is not registered with repository.type "git_remote" (found "${entry.repository.type}").`);
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

async function syncGitRemote(id, registrySection, label, { initiatedByHH, runGitCommand, session }) {
  const { entry, clonePath } = resolveGitRemoteEntry(id, registrySection, label);
  session?.recordNetworkCall?.('sync');

  if (!existsSync(clonePath)) {
    const cloneArgs = ['clone', entry.repository.remote_url, clonePath];
    if (entry.repository.branch) cloneArgs.push('--branch', entry.repository.branch);
    await runGitCommand(cloneArgs);
    return { id, action: 'cloned', clonePath };
  }

  await runGitCommand(['-C', clonePath, 'pull', '--ff-only']);
  return { id, action: 'pulled', clonePath };
}

async function publishGitRemoteChanges(id, registrySection, label, { initiatedByHH, runGitCommand, branchName, commitMessage, session }) {
  if (!branchName || !commitMessage) {
    throw new Error(`publish requires both branchName and commitMessage.`);
  }
  const { clonePath } = resolveGitRemoteEntry(id, registrySection, label);
  if (!existsSync(clonePath)) {
    throw new Error(`${label} "${id}"'s local clone does not exist at ${clonePath}. Run sync first — there is nothing to publish.`);
  }

  session?.recordNetworkCall?.('publish');
  try {
    await runGitCommand(['-C', clonePath, 'checkout', branchName]);
  } catch {
    // Branch doesn't exist locally yet — create it. A caller that wants to
    // distinguish "switched to an existing branch" from "created a new one"
    // should check git state itself; this function only guarantees it ends
    // up on `branchName` either way.
    await runGitCommand(['-C', clonePath, 'checkout', '-b', branchName]);
  }
  await runGitCommand(['-C', clonePath, 'add', '-A']);
  await runGitCommand(['-C', clonePath, 'commit', '-m', commitMessage]);
  await runGitCommand(['-C', clonePath, 'push', '-u', 'origin', branchName]);
  return { id, branchName, clonePath };
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
  const result = await syncGitRemote(productId, 'products', 'Product', { initiatedByHH, runGitCommand, session });
  return { productId, action: result.action, clonePath: result.clonePath };
}

/**
 * Commits and pushes whatever changes exist in a git_remote product's local
 * clone (e.g. from writeProductContext / writeWorkState / writeActiveBrief)
 * to a branch on that product's own remote — never to main/its default
 * branch directly. This is the only way a change reaches the product's real
 * repository history. Deliberately does not open a pull request itself —
 * that is a separate, caller-level step (e.g. `gh pr create`), not a
 * runtime primitive.
 *
 * Reuses `branchName` if it already exists locally (falls back to creating
 * it otherwise), so a caller can call this repeatedly across one PDM
 * session — e.g. once per recordFounderDecision — and accumulate commits on
 * a single branch instead of spawning one branch/PR per decision. See
 * governance/WORK_STATE_BOUNDARY.md for the intended trigger: publish on
 * every recorded Founder decision, not on every Work State or evidence-only
 * Product Context write.
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
  const result = await publishGitRemoteChanges(productId, 'products', 'Product', {
    initiatedByHH,
    runGitCommand,
    branchName,
    commitMessage,
    session,
  });
  return { productId, branchName: result.branchName, clonePath: result.clonePath };
}

/**
 * Same contract as syncGitRemoteProduct, for an organization's context
 * repository (docs/proposals/organization-context-layer.md, approved
 * 2026-09-16).
 *
 * @param {string} organizationId
 * @param {{ initiatedByHH: boolean, runGitCommand: (args: string[]) => Promise<unknown>, session?: object }} params
 */
export async function syncOrganizationContext(organizationId, { initiatedByHH, runGitCommand, session } = {}) {
  assertGovernedInvocation('syncOrganizationContext', { initiatedByHH, runGitCommand });
  const result = await syncGitRemote(organizationId, 'organizations', 'Organization', { initiatedByHH, runGitCommand, session });
  return { organizationId, action: result.action, clonePath: result.clonePath };
}

/**
 * Same contract as publishProductRepositoryChanges, for an organization's
 * context repository.
 *
 * @param {string} organizationId
 * @param {{
 *   initiatedByHH: boolean,
 *   runGitCommand: (args: string[]) => Promise<unknown>,
 *   branchName: string,
 *   commitMessage: string,
 *   session?: object
 * }} params
 */
export async function publishOrganizationContextChanges(
  organizationId,
  { initiatedByHH, runGitCommand, branchName, commitMessage, session } = {}
) {
  assertGovernedInvocation('publishOrganizationContextChanges', { initiatedByHH, runGitCommand });
  const result = await publishGitRemoteChanges(organizationId, 'organizations', 'Organization', {
    initiatedByHH,
    runGitCommand,
    branchName,
    commitMessage,
    session,
  });
  return { organizationId, branchName: result.branchName, clonePath: result.clonePath };
}
