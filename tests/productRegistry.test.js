import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { resolveProductRepository, listRegisteredProductIds, listActiveProductIds, PRODUCT_STATUSES, resolveOrganizationRepository, resolveProductOrganization } from '../runtime/productRegistry.js';

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('resolveProductRepository resolves a registered product by explicit id', () => {
  const resolved = resolveProductRepository('_template');
  assert.equal(resolved.productId, '_template');
  assert.equal(resolved.repositoryType, 'local_path');
  assert.equal(resolved.contextEntry, 'context.json');
});

test('resolveProductRepository refuses an unregistered product rather than guessing a path', () => {
  assert.throws(() => resolveProductRepository('not-registered'));
});

// The "not the filesystem" half of this guarantee is enforced structurally in
// invariants.test.js (productRegistry.js never calls readdirSync). Here we
// only assert the list is exactly what the registry declares, without
// restating the id list — otherwise every new fixture churns this test.
test('listRegisteredProductIds reflects the registry, not the filesystem', () => {
  const { products } = JSON.parse(readFileSync(path.join(REPO_ROOT, 'products', 'registry.json'), 'utf8'));
  assert.deepEqual(listRegisteredProductIds(), Object.keys(products));
  assert.ok(!listRegisteredProductIds().includes('never-registered-product'));
});

test('resolveProductRepository resolves a "git_remote" product whose local clone already exists', () => {
  const resolved = resolveProductRepository('_git-remote-fixture');
  assert.equal(resolved.repositoryType, 'git_remote');
  assert.match(resolved.repositoryPath, /products[\\/]_template$/);
  assert.equal(resolved.contextEntry, 'context.json');
  assert.equal(resolved.workStateEntry, 'work-state.json');
});

test('resolveProductRepository refuses a "git_remote" product whose local clone has not been synced yet', () => {
  assert.throws(
    () => resolveProductRepository('_git-remote-not-cloned-yet'),
    /local clone does not exist yet/
  );
});

test('colon-biopsy-ai-app is registered as a git_remote product with both context and work-state entries', () => {
  const { products } = JSON.parse(readFileSync(path.join(REPO_ROOT, 'products', 'registry.json'), 'utf8'));
  const entry = products['colon-biopsy-ai-app'];
  assert.equal(entry.repository.type, 'git_remote');
  assert.match(entry.repository.remote_url, /colon-biopsy-ai-app/);
  assert.equal(entry.context_entry, 'product-context/context.json');
  assert.equal(entry.work_state_entry, 'product-context/work-state.json');
});

test('resolveProductRepository returns portfolio policy: status and priority', () => {
  const resolved = resolveProductRepository('_portfolio-paused-fixture');
  assert.equal(resolved.status, 'paused');
  assert.equal(resolved.priority, 2);
});

test('status defaults to active and priority defaults to unranked when absent', () => {
  const { products } = JSON.parse(readFileSync(path.join(REPO_ROOT, 'products', 'registry.json'), 'utf8'));
  assert.ok(!('priority' in products._template), 'fixture precondition: _template declares no priority');
  assert.equal(resolveProductRepository('_template').priority, null);
});

test('an unknown status is refused rather than silently treated as active', () => {
  assert.throws(() => resolveProductRepository('_invalid-status-fixture'), /which is not one of/);
});

test('listActiveProductIds excludes fixtures and paused products, and is the portfolio membership list', () => {
  const active = listActiveProductIds();
  assert.ok(active.includes('colon-biopsy-ai-app'));
  assert.ok(!active.some((id) => id.startsWith('_')), 'test fixtures are not portfolio members');
  assert.ok(!active.includes('_portfolio-paused-fixture'), 'paused products are not selectable');
  assert.ok(active.length < listRegisteredProductIds().length);
});

test('colon-biopsy-ai-app declares its portfolio policy in the registry', () => {
  const { products } = JSON.parse(readFileSync(path.join(REPO_ROOT, 'products', 'registry.json'), 'utf8'));
  assert.equal(products['colon-biopsy-ai-app'].status, 'active');
  assert.equal(products['colon-biopsy-ai-app'].priority, 1);
});

test('resolveOrganizationRepository resolves a registered organization by explicit id', () => {
  const resolved = resolveOrganizationRepository('_org-fixture');
  assert.equal(resolved.organizationId, '_org-fixture');
  assert.equal(resolved.repositoryType, 'local_path');
  assert.equal(resolved.contextEntry, 'org-context.json');
});

test('resolveOrganizationRepository refuses an unregistered organization rather than guessing a path', () => {
  assert.throws(() => resolveOrganizationRepository('not-registered'), /is not in the Product Registry/);
});

test('resolveOrganizationRepository refuses a "git_remote" organization whose local clone has not been synced yet', () => {
  assert.throws(
    () => resolveOrganizationRepository('_org-git-remote-not-cloned-yet'),
    /local clone does not exist yet/
  );
});

test('aetherai is registered as a git_remote organization', () => {
  const { organizations } = JSON.parse(readFileSync(path.join(REPO_ROOT, 'products', 'registry.json'), 'utf8'));
  const entry = organizations.aetherai;
  assert.equal(entry.repository.type, 'git_remote');
  assert.match(entry.repository.remote_url, /aetherai-organization-context/);
  assert.equal(entry.context_entry, 'org-context.json');
});

test('resolveProductOrganization returns the declared organization for the four active aetherAI products', () => {
  for (const id of ['colon-biopsy-ai-app', 'ocr-slide-label-reader', 'prostate-biopsy', 'slide-quality-control']) {
    assert.equal(resolveProductOrganization(id), 'aetherai');
  }
});

test('resolveProductOrganization returns null for a product with no declared organization — the escape hatch requires no opt-out flag', () => {
  assert.equal(resolveProductOrganization('_template'), null);
});

test('resolveProductOrganization refuses an unregistered product rather than guessing', () => {
  assert.throws(() => resolveProductOrganization('not-registered'), /is not in the Product Registry/);
});
