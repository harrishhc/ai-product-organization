// Organization Context boundary: facts that stay true when the product
// changes because the same organization governs both, but are not universal
// PDM methodology (docs/proposals/organization-context-layer.md, approved by
// HH 2026-09-16). Organization-specific facts live in the organization's OWN
// repository, never centrally copied into the PDM repo, and never baked
// into PDM Core, methodology, or governance — the same rule context.js
// applies to Product Context, one scope up.
//
// This module resolves an organization's repository via the Product
// Registry (productRegistry.js#resolveOrganizationRepository) and retrieves
// only the bounded sections a task actually needs. It can write an update
// back, but only via an explicit call (writeOrganizationContext) — never
// automatically.
//
// Organization Context is resolved AFTER product selection, for the
// sections the current work unit needs — never during portfolio refresh.
// runtime/portfolio.js must never import this module (enforced by an
// invariant test, mirroring the same rule for Product Context).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { resolveOrganizationRepository } from './productRegistry.js';

const VALID_SECTIONS = Object.freeze([
  'delivery_process',
  'roles',
  'artifact_conventions',
  'reporting_obligations',
  'systems_of_record',
  'stakeholders',
]);

/**
 * Joins a resolved repository root with its registered context_entry and
 * verifies the result cannot escape that root. Identical protection to
 * context.js#resolveContextPath, one scope up.
 */
function resolveOrgContextPath(organizationId) {
  const { repositoryPath, contextEntry } = resolveOrganizationRepository(organizationId);
  const root = path.resolve(repositoryPath);
  const contextPath = path.join(root, contextEntry);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (contextPath !== root && !contextPath.startsWith(rootWithSep)) {
    throw new Error(
      `Organization "${organizationId}"'s registered context_entry ("${contextEntry}") resolves outside its repository root (${root}); refusing to read/write.`
    );
  }
  return contextPath;
}

/**
 * Loads an organization's full context. Callers should almost always use
 * getBoundedOrganizationContext() instead of holding onto the full object.
 */
export function loadOrganizationContext(organizationId) {
  const contextPath = resolveOrgContextPath(organizationId);
  if (!existsSync(contextPath)) {
    throw new Error(`No Organization Context found for "${organizationId}" at ${contextPath} (resolved via Product Registry).`);
  }
  return JSON.parse(readFileSync(contextPath, 'utf8'));
}

/**
 * Bounded retrieval: returns only the requested sections, not the full
 * object. Same default-narrow rule as Product Context.
 *
 * `confidence_notes` is the one exception, and is not a selectable section:
 * it qualifies how far the other sections can be trusted, so it travels with
 * every bounded read rather than being requested on its own. The aetherAI
 * context records there that its statements came from an unverified memory
 * dump and must be cross-checked before being relied on. Dropping that from a
 * bounded read hands PDM organizational claims labelled EVIDENCE with nothing
 * saying they are unverified — turning an assumption into a fact by omission,
 * which `governance/EVIDENCE_DISCIPLINE.md` exists to prevent.
 *
 * @param {string} organizationId
 * @param {string[]} sections - subset of VALID_SECTIONS
 */
export function getBoundedOrganizationContext(organizationId, sections) {
  if (!Array.isArray(sections) || sections.length === 0) {
    throw new Error('getBoundedOrganizationContext requires a non-empty list of sections; full-context loading is not the default.');
  }
  const invalid = sections.filter((s) => !VALID_SECTIONS.includes(s));
  if (invalid.length > 0) {
    throw new Error(`Unknown Organization Context section(s): ${invalid.join(', ')}. Valid: ${VALID_SECTIONS.join(', ')}`);
  }
  const full = loadOrganizationContext(organizationId);
  const bounded = { organization_id: full.organization_id };
  for (const s of sections) bounded[s] = full[s];
  if (Array.isArray(full.confidence_notes) && full.confidence_notes.length > 0) {
    bounded.confidence_notes = full.confidence_notes;
  }
  return bounded;
}

/**
 * Writes an updated context back to the organization's OWN repository.
 * Never called automatically; a caller invokes it explicitly. Full-object
 * overwrite only, matching writeProductContext's simplicity rule.
 *
 * @param {string} organizationId
 * @param {object} updatedContext
 */
export function writeOrganizationContext(organizationId, updatedContext) {
  const contextPath = resolveOrgContextPath(organizationId);
  writeFileSync(contextPath, `${JSON.stringify(updatedContext, null, 2)}\n`, 'utf8');
  return { organizationId, contextPath };
}

export { VALID_SECTIONS };
