import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const methodology = path.join(root, 'methodology');

function readRegistry() {
  return JSON.parse(readFileSync(path.join(methodology, 'registry', 'ecosystem.json'), 'utf8'));
}

test('genesis boundary: upstream source is not a runtime dependency', () => {
  assert.equal(existsSync(path.join(root, 'vendor')), false);
  const runtimeFiles = ['runtime/registry.js', 'runtime/orchestrator.js', 'runtime/context.js'];
  for (const file of runtimeFiles) {
    const source = readFileSync(path.join(root, file), 'utf8');
    assert.doesNotMatch(source, /deanpeters|github\.com\/deanpeters/i);
  }
});

test('genesis baseline preserves both source ecosystems locally', () => {
  assert.ok(existsSync(path.join(methodology, 'skills')));
  assert.ok(existsSync(path.join(methodology, 'commands')));
  assert.ok(existsSync(path.join(methodology, 'prompts')));
  assert.ok(existsSync(path.join(methodology, 'prompts', 'skills')));
  assert.ok(existsSync(path.join(methodology, 'provenance', 'GENESIS.md')));
});

test('registry source references stay inside the HH methodology tree', () => {
  const registry = readRegistry();
  assert.ok(registry.assets.length > 100);
  for (const asset of registry.assets) {
    assert.match(asset.source_reference, /^methodology\//);
    assert.ok(existsSync(path.join(root, asset.source_reference)));
  }
});

test('registry relationships contain only resolvable skill ids', () => {
  const registry = readRegistry();
  const ids = new Set(registry.assets.filter((a) => a.type === 'skill').map((a) => a.id));
  for (const asset of registry.assets) {
    for (const related of asset.related_skills ?? []) assert.ok(ids.has(related), `${asset.id} -> ${related}`);
  }
});
