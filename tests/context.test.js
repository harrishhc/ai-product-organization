import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProductContext, getBoundedContext, writeProductContext } from '../runtime/context.js';

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('loadProductContext reads the template product context', () => {
  const ctx = loadProductContext('_template');
  assert.equal(ctx.product_id, '_template');
  assert.ok('strategy' in ctx);
});

test('loadProductContext throws for a product that does not exist', () => {
  assert.throws(() => loadProductContext('nonexistent-product'));
});

test('getBoundedContext returns only the requested sections', () => {
  const bounded = getBoundedContext('_template', ['strategy']);
  assert.ok('strategy' in bounded);
  assert.ok(!('evidence' in bounded));
  assert.ok(!('decisions' in bounded));
  assert.ok(!('roadmap' in bounded));
});

test('getBoundedContext refuses to default to full-context loading', () => {
  assert.throws(() => getBoundedContext('_template', []));
  assert.throws(() => getBoundedContext('_template'));
});

test('getBoundedContext rejects unknown section names', () => {
  assert.throws(() => getBoundedContext('_template', ['not_a_real_section']));
});

test('writeProductContext writes to the resolved product repository and round-trips', () => {
  const original = loadProductContext('_template');
  try {
    const updated = { ...original, roadmap: { ...original.roadmap, current_state: 'test-write-roundtrip' } };
    const { productId, contextPath } = writeProductContext('_template', updated);
    assert.equal(productId, '_template');
    assert.match(contextPath, /_template[\\/]context\.json$/);

    const reread = loadProductContext('_template');
    assert.equal(reread.roadmap.current_state, 'test-write-roundtrip');
  } finally {
    // Restore the checked-in fixture so this test has no lasting side effect.
    writeProductContext('_template', original);
  }
});

test('writeProductContext refuses an unregistered product, same as the read path', () => {
  assert.throws(() => writeProductContext('nonexistent-product', {}));
});

// Security regression: products/registry.json registers "_path-traversal-test"
// with context_entry "../escaped-context.json", which — if resolved naively
// via path.join(repositoryPath, contextEntry) — would land one directory
// above the product's repository root (products/escaped-context.json,
// outside products/_template/). Both read and write must refuse this.
test('loadProductContext refuses a context_entry that escapes the repository root', () => {
  assert.throws(
    () => loadProductContext('_path-traversal-test'),
    /resolves outside its repository root/
  );
});

test('writeProductContext refuses a context_entry that escapes the repository root, and creates nothing', () => {
  const escapedPath = path.join(REPO_ROOT, 'products', 'escaped-context.json');
  assert.throws(
    () => writeProductContext('_path-traversal-test', { malicious: true }),
    /resolves outside its repository root/
  );
  assert.equal(existsSync(escapedPath), false, 'the escape target must never actually be created');
});
