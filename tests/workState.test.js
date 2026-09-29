import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadWorkState, writeWorkState, renderActiveBrief, writeActiveBrief } from '../runtime/workState.js';

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('loadWorkState reads the template product work state', () => {
  const ws = loadWorkState('_template');
  assert.ok('current_focus' in ws);
  assert.ok('next_actions' in ws);
  assert.ok('last_session' in ws);
});

test('loadWorkState throws for a product that does not exist', () => {
  assert.throws(() => loadWorkState('nonexistent-product'));
});

test('loadWorkState throws for a product with no work_state_entry registered', () => {
  // "_path-traversal-test" is registered in products/registry.json but has
  // no work_state_entry — Work State is opt-in per product.
  assert.throws(() => loadWorkState('_path-traversal-test'), /has no work_state_entry registered/);
});

test('writeWorkState rejects a payload missing required fields', () => {
  assert.throws(() => writeWorkState('_template', { current_focus: 'x' }), /missing required field/);
});

test('writeWorkState writes to the resolved product repository and round-trips', () => {
  const original = loadWorkState('_template');
  try {
    const updated = { ...original, current_focus: 'test-write-roundtrip', next_actions: ['do the thing'] };
    const { productId, workStatePath } = writeWorkState('_template', updated);
    assert.equal(productId, '_template');
    assert.match(workStatePath, /_template[\\/]work-state\.json$/);

    const reread = loadWorkState('_template');
    assert.equal(reread.current_focus, 'test-write-roundtrip');
    assert.deepEqual(reread.next_actions, ['do the thing']);
  } finally {
    writeWorkState('_template', original);
  }
});

test('renderActiveBrief refuses a Work State missing required fields', () => {
  assert.throws(() => renderActiveBrief({ current_focus: 'x' }), /missing required field/);
});

test('renderActiveBrief renders current focus, uncertainty, and next actions', () => {
  const ws = {
    current_focus: 'Ship the pilot',
    dominant_uncertainty: 'Who is the real buyer',
    in_progress: ['drafting PRD'],
    next_actions: ['interview a pathologist', 'review validation protocol'],
    blocked: [],
    recently_completed: ['bounded context adopted'],
    open_questions: ['what is the pricing model'],
    last_session: { date: '2026-09-11', summary: 'set up bounded context', decision_refs: [] },
  };
  const brief = renderActiveBrief(ws, { currentState: 'Early discovery', roadmapItems: [{ status: 'now', item: 'Define wedge' }] });
  assert.match(brief, /## Current Goal\nShip the pilot/);
  assert.match(brief, /## Dominant Uncertainty\nWho is the real buyer/);
  assert.match(brief, /1\. interview a pathologist/);
  assert.match(brief, /2\. review validation protocol/);
  assert.match(brief, /## Blocked\n_\(none\)_/);
  assert.match(brief, /## Roadmap \(from Product Context\)\n- \[now\] Define wedge/);
});

test('renderActiveBrief references decisions by id, never restates decision content', () => {
  const ws = {
    current_focus: 'x',
    dominant_uncertainty: 'y',
    in_progress: [],
    next_actions: [],
    blocked: [],
    recently_completed: [],
    open_questions: [],
    last_session: { date: '2026-09-11', summary: 'reviewed evidence', decision_refs: ['dec_123'] },
  };
  const brief = renderActiveBrief(ws);
  assert.match(brief, /Decisions referenced this session/);
  assert.match(brief, /- dec_123/);
  // The rendered brief must not fabricate decision content beyond the id —
  // there is no field on Work State that could supply it.
  assert.doesNotMatch(brief, /decision_refs/);
});

test('writeActiveBrief writes beside the resolved work-state file', () => {
  const briefPath = path.join(REPO_ROOT, 'products', '_template', 'active-brief.md');
  try {
    const { productId, briefPath: written } = writeActiveBrief('_template', '# test brief\n');
    assert.equal(productId, '_template');
    assert.equal(written, briefPath);
    assert.equal(existsSync(briefPath), true);
  } finally {
    rmSync(briefPath, { force: true });
  }
});

// Security regression, same shape as context.test.js's path-traversal test:
// products/registry.json registers "_work-state-path-traversal-test" with
// work_state_entry "../escaped-workstate.json", which — if resolved naively
// via path.join(repositoryPath, workStateEntry) — would land one directory
// above the product's repository root. Both read and write must refuse this.
test('loadWorkState refuses a work_state_entry that escapes the repository root', () => {
  assert.throws(
    () => loadWorkState('_work-state-path-traversal-test'),
    /resolves outside its repository root/
  );
});

test('writeWorkState refuses a work_state_entry that escapes the repository root, and creates nothing', () => {
  const escapedPath = path.join(REPO_ROOT, 'products', 'escaped-workstate.json');
  const valid = loadWorkState('_template');
  assert.throws(
    () => writeWorkState('_work-state-path-traversal-test', valid),
    /resolves outside its repository root/
  );
  assert.equal(existsSync(escapedPath), false, 'the escape target must never actually be created');
});

test('routing_intents is optional but validated when present', () => {
  const base = loadWorkState('_template');
  assert.doesNotThrow(() => writeWorkState('_template', { ...base }), 'absent is valid');

  for (const bad of ['competitive', [''], ['ok', 42], [null]]) {
    assert.throws(
      () => writeWorkState('_template', { ...base, routing_intents: bad }),
      /routing_intents must be an array of non-empty strings/,
      `should reject ${JSON.stringify(bad)}`,
    );
  }

  writeWorkState('_template', { ...base, routing_intents: ['competitive', 'market_sizing'] });
  assert.deepEqual(loadWorkState('_template').routing_intents, ['competitive', 'market_sizing']);
  writeWorkState('_template', base);
  assert.ok(!('routing_intents' in loadWorkState('_template')));
});

test('uncertainty_type is optional, null-able, and must come from the closed vocabulary', () => {
  const base = loadWorkState('_template');
  for (const bad of ['workflow ', 'Workflow', 42, '', 'the buyer is unknown']) {
    assert.throws(
      () => writeWorkState('_template', { ...base, uncertainty_type: bad }),
      /uncertainty_type must be null or one of/,
      `should reject ${JSON.stringify(bad)}`,
    );
  }
  writeWorkState('_template', { ...base, uncertainty_type: null });
  writeWorkState('_template', { ...base, uncertainty_type: 'market' });
  assert.equal(loadWorkState('_template').uncertainty_type, 'market');
  writeWorkState('_template', base);
  assert.ok(!('uncertainty_type' in loadWorkState('_template')));
});
