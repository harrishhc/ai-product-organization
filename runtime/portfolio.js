// Portfolio: how PDM decides which product to work on next when it is
// responsible for several at once.
//
// The rule that makes this layer safe: portfolio state is DERIVED, never
// stored. A product's status is recomputed from that product's own Work State
// and its own pending checkpoints every time the loop refreshes. Nothing here
// is a source of truth — storing "READY" anywhere would create exactly the
// duplicated, drift-prone state the Work State boundary exists to prevent.
// Only two portfolio facts are stored, and they live in the registry because
// no single product can know them: `priority` and `status` (productRegistry.js).
//
// Refresh is deliberately cheap (Dean's "index before you search"): per
// product it reads one small work-state file and ONE bounded context section.
// It must never load a full Product Context or any knowledge/ material — a
// five-product refresh that pulled full context would defeat the entire
// Active Brief design.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { listActiveProductIds, resolveProductRepository } from './productRegistry.js';
import { loadWorkState } from './workState.js';
import { listPendingCheckpoints } from './decisionRecord.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');
const PORTFOLIO_INDEX_PATH = path.join(REPO_ROOT, 'portfolio-index.md');

/**
 * Ordered by who has to act next, which is why precedence matters:
 * WAITING_FOR_FOUNDER outranks BLOCKED because naming the person who can
 * unblock it is more useful than naming the obstacle.
 */
export const WORK_STATUSES = Object.freeze([
  'WAITING_FOR_FOUNDER', // HH can act — a pending checkpoint exists
  'BLOCKED', // someone/something else must act first
  'READY', // PDM can act now — there is a next action
  'IDLE', // nothing queued; needs framing before it can be worked
  'UNINITIALIZED', // not resolvable/synced yet, or has no Work State
]);

export function deriveWorkStatus({ workState, pendingCheckpoints }) {
  if (pendingCheckpoints?.length > 0) return 'WAITING_FOR_FOUNDER';
  if (workState?.blocked?.length > 0) return 'BLOCKED';
  if (workState?.next_actions?.length > 0) return 'READY';
  return 'IDLE';
}

/**
 * Builds one portfolio entry. Never throws for an individual product: a
 * product that cannot be resolved (e.g. a git_remote clone that has not been
 * synced yet) becomes UNINITIALIZED with a note, so one unsynced product
 * cannot take down the whole loop.
 */
function refreshProduct(productId, session) {
  const base = { productId, priority: null, status: 'UNINITIALIZED', note: null };
  let priority = null;
  try {
    priority = resolveProductRepository(productId).priority;
  } catch (error) {
    return { ...base, note: error.message };
  }

  let workState = null;
  let pendingCheckpoints = [];
  try {
    workState = loadWorkState(productId);
  } catch (error) {
    return { ...base, priority, note: `no Work State: ${error.message}` };
  }
  try {
    pendingCheckpoints = listPendingCheckpoints(productId);
    session?.recordContextLoad?.(productId, ['decisions']);
  } catch (error) {
    return { ...base, priority, note: `could not read decisions: ${error.message}` };
  }

  return {
    productId,
    priority,
    status: deriveWorkStatus({ workState, pendingCheckpoints }),
    currentFocus: workState.current_focus ?? null,
    dominantUncertainty: workState.dominant_uncertainty ?? null,
    uncertaintyType: workState.uncertainty_type ?? null,
    routingIntents: workState.routing_intents ?? [],
    nextAction: workState.next_actions?.[0] ?? null,
    nextActionCount: workState.next_actions?.length ?? 0,
    blocked: workState.blocked ?? [],
    pendingCheckpointIds: pendingCheckpoints.map((c) => c.id),
    lastActivity: workState.last_session?.date ?? null,
    note: null,
  };
}

/**
 * @param {{ productIds?: string[], session?: object }} [options] - defaults to
 *   the registry's active membership list; pass explicit ids to refresh a
 *   subset (or, in tests, fixtures that are not portfolio members).
 */
export function refreshPortfolio({ productIds, session } = {}) {
  const ids = productIds ?? listActiveProductIds();
  return ids.map((id) => refreshProduct(id, session));
}

/** Unranked products sort after ranked ones rather than ahead of them. */
function priorityRank(entry) {
  return entry.priority ?? Number.MAX_SAFE_INTEGER;
}

/**
 * Lexicographic, not weighted. Three keys, each one either already-known fact
 * or a deterministic tie-break — no scoring model, because expected-value and
 * effort estimates are model guesses and a weighted score cannot explain, a
 * week later, why a given product was chosen on a given day.
 *
 *   1. portfolio priority (the only cross-product truth that exists)
 *   2. least recently worked, so equal-priority products cannot starve
 *   3. product id, purely so the result is deterministic
 *
 * Critical-path ordering ("do the work that unblocks other products first")
 * is deliberately NOT implemented: nothing in the model records dependencies
 * between products, and inventing a dependency graph before a real dependency
 * exists would be the expensive kind of guess. Revisit when two products
 * actually block each other.
 */
export function rankRunnableWork(portfolio) {
  return portfolio
    .filter((entry) => entry.status === 'READY')
    .sort(
      (a, b) =>
        priorityRank(a) - priorityRank(b) ||
        String(a.lastActivity ?? '').localeCompare(String(b.lastActivity ?? '')) ||
        a.productId.localeCompare(b.productId)
    );
}

/**
 * The loop's one selection call. Returns null when nothing is runnable, which
 * is a normal, expected outcome ("quiet tier, nothing material" in Dean's
 * routine discipline) — not an error.
 */
export function selectNextWork(portfolio) {
  return rankRunnableWork(portfolio)[0] ?? null;
}

function countBy(portfolio, status) {
  return portfolio.filter((entry) => entry.status === status).length;
}

/**
 * Derived output, same contract as Active Brief: regenerate it, never hand-edit
 * it. It exists so a resuming session can see the whole portfolio in one short
 * read instead of opening every product.
 */
export function renderPortfolioIndex(portfolio, { selected = null, generatedAt = new Date().toISOString() } = {}) {
  const lines = [
    '# Portfolio Index',
    '',
    '<!-- DERIVED FILE — regenerated by runtime/portfolio.js#renderPortfolioIndex.',
    '     Do not hand-edit: change the product\'s own Work State / Product Context',
    '     and re-render. Status here is recomputed, never stored. -->',
    '',
    `Generated: ${generatedAt}`,
    '',
    `Products: ${portfolio.length} · READY ${countBy(portfolio, 'READY')}` +
      ` · WAITING_FOR_FOUNDER ${countBy(portfolio, 'WAITING_FOR_FOUNDER')}` +
      ` · BLOCKED ${countBy(portfolio, 'BLOCKED')}` +
      ` · IDLE ${countBy(portfolio, 'IDLE')}` +
      ` · UNINITIALIZED ${countBy(portfolio, 'UNINITIALIZED')}`,
    '',
    '| Product | Priority | Status | Next action / why not | Last activity |',
    '|---|---|---|---|---|',
  ];
  for (const entry of portfolio) {
    const detail =
      entry.status === 'READY'
        ? entry.nextAction ?? ''
        : entry.status === 'WAITING_FOR_FOUNDER'
          ? `awaiting HH: ${entry.pendingCheckpointIds.join(', ')}`
          : entry.status === 'BLOCKED'
            ? entry.blocked.join('; ')
            : entry.note ?? '';
    lines.push(
      `| ${entry.productId} | ${entry.priority ?? '—'} | ${entry.status} | ${detail || '—'} | ${entry.lastActivity ?? '—'} |`
    );
  }
  lines.push('', '## Next selected work', selected ? `**${selected.productId}** — ${selected.nextAction}` : '_(nothing runnable)_', '');

  const waiting = portfolio.filter((e) => e.status === 'WAITING_FOR_FOUNDER');
  if (waiting.length > 0) {
    lines.push(
      '## Waiting on HH',
      ...waiting.map((e) => `- ${e.productId}: ${e.pendingCheckpointIds.join(', ')}`),
      '',
      'These block only their own product. They never stop the loop.',
      ''
    );
  }
  return lines.join('\n');
}

export function writePortfolioIndex(renderedMarkdown) {
  writeFileSync(PORTFOLIO_INDEX_PATH, renderedMarkdown, 'utf8');
  return { portfolioIndexPath: PORTFOLIO_INDEX_PATH };
}

export function readPortfolioIndex() {
  return readFileSync(PORTFOLIO_INDEX_PATH, 'utf8');
}

export { PORTFOLIO_INDEX_PATH };
