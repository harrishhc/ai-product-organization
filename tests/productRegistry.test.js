import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { resolveProductRepository, listRegisteredProductIds } from '../runtime/productRegistry.js';

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
