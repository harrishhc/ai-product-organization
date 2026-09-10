import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProductContext, getBoundedContext } from '../runtime/context.js';

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
