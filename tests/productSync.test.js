import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncGitRemoteProduct } from '../runtime/productSync.js';

test('syncGitRemoteProduct requires explicit HH initiation', async () => {
  await assert.rejects(
    () => syncGitRemoteProduct('colon-biopsy-ai-app', { initiatedByHH: false, runGitCommand: async () => {} }),
    /explicit, deliberate HH-initiated maintenance task/
  );
});

test('syncGitRemoteProduct requires an injected runGitCommand — it performs no process/network I/O on its own', async () => {
  await assert.rejects(
    () => syncGitRemoteProduct('colon-biopsy-ai-app', { initiatedByHH: true }),
    /requires an explicit runGitCommand function/
  );
});

test('syncGitRemoteProduct refuses a product that is not registered as git_remote', async () => {
  await assert.rejects(
    () => syncGitRemoteProduct('_template', { initiatedByHH: true, runGitCommand: async () => {} }),
    /not registered with repository.type "git_remote"/
  );
});

test('syncGitRemoteProduct clones when the local clone does not exist yet, using the injected runner', async () => {
  const calls = [];
  const result = await syncGitRemoteProduct('_git-remote-not-cloned-yet', {
    initiatedByHH: true,
    runGitCommand: async (args) => {
      calls.push(args);
    },
  });
  assert.equal(result.action, 'cloned');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'clone');
});

test('syncGitRemoteProduct pulls (never re-clones) when the local clone already exists', async () => {
  const calls = [];
  const result = await syncGitRemoteProduct('_git-remote-fixture', {
    initiatedByHH: true,
    runGitCommand: async (args) => {
      calls.push(args);
    },
  });
  assert.equal(result.action, 'pulled');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], '-C');
  assert.match(calls[0][1], /products[\\/]_template$/);
  assert.equal(calls[0][2], 'pull');
});
