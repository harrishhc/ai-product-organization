import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'pdm-run.mjs');
const run = (...args) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });

test('a flag with a missing, empty or flag-like value is refused instead of swallowing the next argument', () => {
  for (const args of [
    ['route', '--uncertainty'],
    ['route', '--uncertainty', ''],
    ['route', '--intents'],
    ['route', '--type'],
    ['route', '--stage', '--spans-stages'],
    ['next', '--done'],
  ]) {
    const r = run(...args);
    assert.equal(r.status, 2, `${args.join(' ')} should exit 2`);
    assert.match(r.stderr, /needs a value/);
  }
});

test('numeric flags reject non-integers rather than turning into NaN', () => {
  for (const bad of ['abc', '-1', '1.5']) {
    const r = run('next', '--done', bad);
    assert.equal(r.status, 2, `--done ${bad} should exit 2`);
    assert.match(r.stderr, /non-negative integer/);
  }
});

test('route accepts an ad hoc uncertainty and an inline --flag=value form', () => {
  const r = run('route', '--uncertainty=which buyer signs off', '--intents=prd');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Routing: "which buyer signs off" \(ad hoc\)/);
});

test('route rejects a token outside the closed vocabulary with a clear error', () => {
  const r = run('route', '--uncertainty', 'q', '--type', 'the buyer is unknown');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Unknown uncertaintyType/);
});
