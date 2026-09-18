import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadOrganizationContext, getBoundedOrganizationContext, writeOrganizationContext } from '../runtime/organizationContext.js';

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('loadOrganizationContext reads the fixture organization context', () => {
  const ctx = loadOrganizationContext('_org-fixture');
  assert.equal(ctx.organization_id, '_org-fixture');
  assert.ok('delivery_process' in ctx);
});

test('loadOrganizationContext throws for an organization that does not exist', () => {
  assert.throws(() => loadOrganizationContext('nonexistent-organization'));
});

test('getBoundedOrganizationContext returns only the requested sections', () => {
  const bounded = getBoundedOrganizationContext('_org-fixture', ['roles']);
  assert.ok('roles' in bounded);
  assert.ok(!('stakeholders' in bounded));
  assert.ok(!('systems_of_record' in bounded));
});

test('getBoundedOrganizationContext refuses to default to full-context loading', () => {
  assert.throws(() => getBoundedOrganizationContext('_org-fixture', []));
  assert.throws(() => getBoundedOrganizationContext('_org-fixture'));
});

test('getBoundedOrganizationContext rejects unknown section names', () => {
  assert.throws(() => getBoundedOrganizationContext('_org-fixture', ['not_a_real_section']));
});

test('writeOrganizationContext writes to the resolved organization repository and round-trips', () => {
  const original = loadOrganizationContext('_org-fixture');
  try {
    const updated = { ...original, roles: ['test-write-roundtrip'] };
    const { organizationId, contextPath } = writeOrganizationContext('_org-fixture', updated);
    assert.equal(organizationId, '_org-fixture');
    assert.match(contextPath, /_org-fixture[\\/]org-context\.json$/);

    const reread = loadOrganizationContext('_org-fixture');
    assert.deepEqual(reread.roles, ['test-write-roundtrip']);
  } finally {
    writeOrganizationContext('_org-fixture', original);
  }
});

test('writeOrganizationContext refuses an unregistered organization, same as the read path', () => {
  assert.throws(() => writeOrganizationContext('nonexistent-organization', {}));
});

// Security regression, same shape as context.test.js's path-traversal test.
test('loadOrganizationContext refuses a context_entry that escapes the repository root', () => {
  assert.throws(
    () => loadOrganizationContext('_org-path-traversal-test'),
    /resolves outside its repository root/
  );
});

test('writeOrganizationContext refuses a context_entry that escapes the repository root, and creates nothing', () => {
  const escapedPath = path.join(REPO_ROOT, 'organizations', 'escaped-org-context.json');
  assert.throws(
    () => writeOrganizationContext('_org-path-traversal-test', { malicious: true }),
    /resolves outside its repository root/
  );
  assert.equal(existsSync(escapedPath), false, 'the escape target must never actually be created');
});

test('confidence_notes travels with every bounded read and is not selectable on its own', () => {
  // It qualifies the other sections rather than being one of them. A bounded
  // read that dropped it would present unverified organizational claims as
  // settled EVIDENCE.
  const bounded = getBoundedOrganizationContext('_org-qualified-fixture', ['roles']);
  assert.ok('roles' in bounded);
  assert.ok(!('systems_of_record' in bounded), 'still bounded to the requested sections');
  assert.deepEqual(bounded.confidence_notes, [
    { classification: 'ASSUMPTION', statement: 'Sections here are unverified until cross-checked.' },
  ]);

  assert.throws(
    () => getBoundedOrganizationContext('_org-qualified-fixture', ['confidence_notes']),
    /Unknown Organization Context section/,
  );
});

test('a context without confidence_notes does not grow an empty one', () => {
  const bounded = getBoundedOrganizationContext('_org-fixture', ['roles']);
  assert.ok(!('confidence_notes' in bounded));
});
