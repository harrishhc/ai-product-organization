// Work State: the PDM's own operational memory for a product — current
// focus, dominant uncertainty, next actions, and session continuity. This is
// NOT a second source of truth for product facts or decisions; those live
// only in Product Context (context.js). Work State records what PDM is
// doing, never what is true about the product. See
// governance/WORK_STATE_BOUNDARY.md for the full boundary rules.
//
// Mirrors context.js's safety pattern: resolves through the Product
// Registry, verifies the resolved path cannot escape the product's own
// repository root, and never writes automatically.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { resolveProductRepository } from './productRegistry.js';

const REQUIRED_FIELDS = Object.freeze([
  'current_focus',
  'dominant_uncertainty',
  'in_progress',
  'next_actions',
  'blocked',
  'recently_completed',
  'open_questions',
  'last_session',
]);

function assertRequiredFields(workState, verb) {
  const missing = REQUIRED_FIELDS.filter((f) => !(f in workState));
  if (missing.length > 0) {
    throw new Error(`Cannot ${verb} Work State: missing required field(s): ${missing.join(', ')}`);
  }
}

function resolveWorkStatePath(productId) {
  const { repositoryPath, workStateEntry } = resolveProductRepository(productId);
  if (!workStateEntry) {
    throw new Error(
      `Product "${productId}" has no work_state_entry registered in the Product Registry; Work State is opt-in per product.`
    );
  }
  const root = path.resolve(repositoryPath);
  const workStatePath = path.join(root, workStateEntry);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (workStatePath !== root && !workStatePath.startsWith(rootWithSep)) {
    throw new Error(
      `Product "${productId}"'s registered work_state_entry ("${workStateEntry}") resolves outside its repository root (${root}); refusing to read/write.`
    );
  }
  return workStatePath;
}

/**
 * Active Brief always lives beside the resolved Work State file, fixed
 * filename. It is derived output (see renderActiveBrief) — never resolved
 * as an independent registry entry, so there is only ever one place its
 * path can come from.
 */
function resolveActiveBriefPath(productId) {
  return path.join(path.dirname(resolveWorkStatePath(productId)), 'active-brief.md');
}

export function loadWorkState(productId) {
  const workStatePath = resolveWorkStatePath(productId);
  if (!existsSync(workStatePath)) {
    throw new Error(`No Work State found for "${productId}" at ${workStatePath} (resolved via Product Registry).`);
  }
  const parsed = JSON.parse(readFileSync(workStatePath, 'utf8'));
  assertRequiredFields(parsed, 'read');
  return parsed;
}

/**
 * Full-object overwrite only, same simplicity rule as writeProductContext —
 * never called automatically; a caller (the PDM session-close step) invokes
 * this explicitly.
 */
export function writeWorkState(productId, updatedWorkState) {
  assertRequiredFields(updatedWorkState, 'write');
  const workStatePath = resolveWorkStatePath(productId);
  writeFileSync(workStatePath, `${JSON.stringify(updatedWorkState, null, 2)}\n`, 'utf8');
  return { productId, workStatePath };
}

function renderList(items, formatter) {
  return items && items.length > 0 ? items.map(formatter) : ['_(none)_'];
}

/**
 * Regenerates Active Brief markdown from Work State plus whatever bounded
 * Product Context sections the caller already retrieved (via
 * context.js#getBoundedContext — this function never loads context itself,
 * so it cannot silently pull in more than the caller already has).
 *
 * This is the ONLY supported way Active Brief content is produced. It is
 * derived output, never hand-edited — same treatment as the methodology
 * registry (ARCHITECTURE.md §14): the underlying Work State and Product
 * Context are authoritative, the brief is a disposable rendering of them.
 *
 * `workState.last_session.decision_refs` must be Product Context decision
 * ids/indexes, not restated decision content — Work State does not get to
 * assert what was decided (governance/WORK_STATE_BOUNDARY.md).
 */
export function renderActiveBrief(workState, { currentState, roadmapItems } = {}) {
  assertRequiredFields(workState, 'render Active Brief from');
  const lines = [
    '# Current Product Brief',
    '',
    '## Current State',
    currentState ?? '_(not set)_',
    '',
    '## Current Goal',
    workState.current_focus || '_(not set)_',
    '',
    '## Dominant Uncertainty',
    workState.dominant_uncertainty || '_(not set)_',
    '',
    '## In Progress',
    ...renderList(workState.in_progress, (i) => `- ${i}`),
    '',
    '## Next Actions',
    ...renderList(workState.next_actions, (a, i) => `${i + 1}. ${a}`),
    '',
    '## Blocked',
    ...renderList(workState.blocked, (b) => `- ${b}`),
    '',
    '## Recently Completed',
    ...renderList(workState.recently_completed, (c) => `- ${c}`),
    '',
    '## Open Questions',
    ...renderList(workState.open_questions, (q) => `- ${q}`),
  ];
  if (roadmapItems && roadmapItems.length > 0) {
    lines.push('', '## Roadmap (from Product Context)', ...roadmapItems.map((r) => `- [${r.status}] ${r.item}`));
  }
  lines.push('', '## Last Session');
  if (workState.last_session?.date) {
    lines.push(`${workState.last_session.date} — ${workState.last_session.summary ?? ''}`);
    if (workState.last_session.decision_refs?.length) {
      lines.push(
        '',
        'Decisions referenced this session (authoritative record is Product Context `decisions`, not this list):',
        ...workState.last_session.decision_refs.map((id) => `- ${id}`)
      );
    }
  } else {
    lines.push('_(no prior session recorded)_');
  }
  lines.push(
    '',
    '## Read Only If Needed',
    'Consult `product-context/context.json` and `knowledge/` only for the sections/sources the current next action actually requires.',
    ''
  );
  return lines.join('\n');
}

/** Writes the rendered brief. Never called automatically — same explicit-invocation rule as writeWorkState. */
export function writeActiveBrief(productId, renderedMarkdown) {
  const briefPath = resolveActiveBriefPath(productId);
  writeFileSync(briefPath, renderedMarkdown, 'utf8');
  return { productId, briefPath };
}

export { REQUIRED_FIELDS };
