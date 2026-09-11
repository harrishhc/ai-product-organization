import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncGitRemoteProduct, publishProductRepositoryChanges } from '../runtime/productSync.js';

test('syncGitRemoteProduct requires explicit HH initiation', async () => {
  await assert.rejects(
    () => syncGitRemoteProduct('colon-biopsy-ai-app', { initiatedByHH: false, runGitCommand: async () => {} }),
    /explicit, deliberate HH-initiated task/
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

test('publishProductRepositoryChanges requires explicit HH initiation', async () => {
  await assert.rejects(
    () =>
      publishProductRepositoryChanges('_git-remote-fixture', {
        initiatedByHH: false,
        runGitCommand: async () => {},
        branchName: 'x',
        commitMessage: 'x',
      }),
    /explicit, deliberate HH-initiated task/
  );
});

test('publishProductRepositoryChanges requires an injected runGitCommand', async () => {
  await assert.rejects(
    () => publishProductRepositoryChanges('_git-remote-fixture', { initiatedByHH: true, branchName: 'x', commitMessage: 'x' }),
    /requires an explicit runGitCommand function/
  );
});

test('publishProductRepositoryChanges requires both branchName and commitMessage', async () => {
  await assert.rejects(
    () => publishProductRepositoryChanges('_git-remote-fixture', { initiatedByHH: true, runGitCommand: async () => {} }),
    /requires both branchName and commitMessage/
  );
});

test('publishProductRepositoryChanges refuses a product that is not registered as git_remote', async () => {
  await assert.rejects(
    () =>
      publishProductRepositoryChanges('_template', {
        initiatedByHH: true,
        runGitCommand: async () => {},
        branchName: 'x',
        commitMessage: 'x',
      }),
    /not registered with repository.type "git_remote"/
  );
});

test('publishProductRepositoryChanges refuses when the local clone does not exist yet', async () => {
  await assert.rejects(
    () =>
      publishProductRepositoryChanges('_git-remote-not-cloned-yet', {
        initiatedByHH: true,
        runGitCommand: async () => {},
        branchName: 'x',
        commitMessage: 'x',
      }),
    /local clone does not exist/
  );
});

test('publishProductRepositoryChanges runs checkout, add, commit, push in order on the resolved clone', async () => {
  const calls = [];
  const result = await publishProductRepositoryChanges('_git-remote-fixture', {
    initiatedByHH: true,
    runGitCommand: async (args) => {
      calls.push(args);
    },
    branchName: 'pdm/test-branch',
    commitMessage: 'test commit',
  });
  assert.equal(calls.length, 4);
  assert.deepEqual(calls[0], ['-C', calls[0][1], 'checkout', '-b', 'pdm/test-branch']);
  assert.deepEqual(calls[1], ['-C', calls[1][1], 'add', '-A']);
  assert.deepEqual(calls[2], ['-C', calls[2][1], 'commit', '-m', 'test commit']);
  assert.deepEqual(calls[3], ['-C', calls[3][1], 'push', '-u', 'origin', 'pdm/test-branch']);
  assert.match(result.clonePath, /products[\\/]_template$/);
  assert.equal(result.branchName, 'pdm/test-branch');
});
