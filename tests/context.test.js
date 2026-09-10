import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProductContext, getBoundedContext, writeProductContext } from '../runtime/context.js';

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
