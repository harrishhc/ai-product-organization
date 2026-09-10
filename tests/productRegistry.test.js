import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveProductRepository, listRegisteredProductIds } from '../runtime/productRegistry.js';

test('resolveProductRepository resolves a registered product by explicit id', () => {
  const resolved = resolveProductRepository('_template');
  assert.equal(resolved.productId, '_template');
  assert.equal(resolved.repositoryType, 'local_path');
  assert.equal(resolved.contextEntry, 'context.json');
});

test('resolveProductRepository refuses an unregistered product rather than guessing a path', () => {
  assert.throws(() => resolveProductRepository('not-registered'));
});

test('listRegisteredProductIds reflects the registry, not the filesystem', () => {
  assert.deepEqual(listRegisteredProductIds(), ['_template']);
});
