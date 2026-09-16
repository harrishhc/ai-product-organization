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

test('publishProductRepositoryChanges switches to the branch, then adds/commits/pushes, when the branch already exists', async () => {
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
  assert.deepEqual(calls[0], ['-C', calls[0][1], 'checkout', 'pdm/test-branch']);
  assert.deepEqual(calls[1], ['-C', calls[1][1], 'add', '-A']);
  assert.deepEqual(calls[2], ['-C', calls[2][1], 'commit', '-m', 'test commit']);
  assert.deepEqual(calls[3], ['-C', calls[3][1], 'push', '-u', 'origin', 'pdm/test-branch']);
  assert.match(result.clonePath, /products[\\/]_template$/);
  assert.equal(result.branchName, 'pdm/test-branch');
});

test('publishProductRepositoryChanges falls back to creating the branch when checkout fails (branch does not exist yet)', async () => {
  const calls = [];
  const result = await publishProductRepositoryChanges('_git-remote-fixture', {
    initiatedByHH: true,
    runGitCommand: async (args) => {
      calls.push(args);
      if (args[2] === 'checkout' && args.length === 4) throw new Error('pathspec did not match any branch');
    },
    branchName: 'pdm/new-branch',
    commitMessage: 'first decision on this branch',
  });
  assert.equal(calls.length, 5);
  assert.deepEqual(calls[0], ['-C', calls[0][1], 'checkout', 'pdm/new-branch']);
  assert.deepEqual(calls[1], ['-C', calls[1][1], 'checkout', '-b', 'pdm/new-branch']);
  assert.deepEqual(calls[2], ['-C', calls[2][1], 'add', '-A']);
  assert.deepEqual(calls[3], ['-C', calls[3][1], 'commit', '-m', 'first decision on this branch']);
  assert.deepEqual(calls[4], ['-C', calls[4][1], 'push', '-u', 'origin', 'pdm/new-branch']);
  assert.equal(result.branchName, 'pdm/new-branch');
});

test('publishProductRepositoryChanges called twice with the same branchName accumulates two commits on one branch', async () => {
  const commitCalls = [];
  // This mock doesn't track real git state, so it always takes the
  // checkout-fails-then-create fallback path on both calls; what this test
  // actually asserts is the caller-visible contract — that two calls with
  // the same branchName produce two distinct commits, not one overwritten
  // by the other — regardless of which checkout branch the code took.
  const runGitCommand = async (args) => {
    if (args[2] === 'checkout' && args.length === 4) {
      throw new Error('pathspec did not match any branch');
    }
    if (args[2] === 'commit') commitCalls.push(args);
  };
  await publishProductRepositoryChanges('_git-remote-fixture', {
    initiatedByHH: true,
    runGitCommand,
    branchName: 'pdm/session-branch',
    commitMessage: 'decision one',
  });
  await publishProductRepositoryChanges('_git-remote-fixture', {
    initiatedByHH: true,
    runGitCommand,
    branchName: 'pdm/session-branch',
    commitMessage: 'decision two',
  });
  assert.equal(commitCalls.length, 2);
  assert.equal(commitCalls[0][4], 'decision one');
  assert.equal(commitCalls[1][4], 'decision two');
});

// Organization variants share the same internal implementation as the
// product functions above (see productSync.js); these tests confirm the
// organization-scoped entry points work end to end, not every edge case
// already covered for products.
import { syncOrganizationContext, publishOrganizationContextChanges } from '../runtime/productSync.js';

test('syncOrganizationContext requires explicit HH initiation and an injected runGitCommand', async () => {
  await assert.rejects(
    () => syncOrganizationContext('_org-fixture', { initiatedByHH: false, runGitCommand: async () => {} }),
    /explicit, deliberate HH-initiated task/
  );
  await assert.rejects(
    () => syncOrganizationContext('_org-fixture', { initiatedByHH: true }),
    /requires an explicit runGitCommand function/
  );
});

test('syncOrganizationContext clones when the local clone does not exist, pulls when it does', async () => {
  const cloneCalls = [];
  const cloned = await syncOrganizationContext('_org-git-remote-not-cloned-yet', {
    initiatedByHH: true,
    runGitCommand: async (args) => cloneCalls.push(args),
  });
  assert.equal(cloned.action, 'cloned');
  assert.equal(cloneCalls[0][0], 'clone');

  const pullCalls = [];
  const pulled = await syncOrganizationContext('_org-git-remote-fixture', {
    initiatedByHH: true,
    runGitCommand: async (args) => pullCalls.push(args),
  });
  assert.equal(pulled.action, 'pulled');
  assert.equal(pullCalls[0][2], 'pull');
});

test('publishOrganizationContextChanges commits and pushes the organization repository, not a product one', async () => {
  const calls = [];
  const result = await publishOrganizationContextChanges('_org-git-remote-fixture', {
    initiatedByHH: true,
    runGitCommand: async (args) => calls.push(args),
    branchName: 'pdm/org-test-branch',
    commitMessage: 'test org commit',
  });
  assert.equal(calls.length, 4);
  assert.match(result.clonePath, /_org-fixture$/);
  assert.equal(result.branchName, 'pdm/org-test-branch');
});

test('publishOrganizationContextChanges refuses an organization that is not registered as git_remote', async () => {
  await assert.rejects(
    () =>
      publishOrganizationContextChanges('_org-fixture', {
        initiatedByHH: true,
        runGitCommand: async () => {},
        branchName: 'x',
        commitMessage: 'x',
      }),
    /not registered with repository.type "git_remote"/
  );
});
