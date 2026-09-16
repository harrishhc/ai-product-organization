#!/usr/bin/env node
// Real git adapter — the one committed implementation of the `runGitCommand`
// dependency that runtime/productSync.js requires but deliberately does not
// contain. runtime/ stays free of process/network code; this file is where
// that boundary is crossed, once, on purpose.
//
// Running this command IS the explicit HH initiation that
// syncGitRemoteProduct / publishProductRepositoryChanges require: a human or
// an agent acting for HH deliberately invoked it. Nothing in runtime/ can
// reach this file, so no ordinary PDM read/write can trigger git as a side
// effect.
//
// Usage:
//   node bin/pdm-git.mjs sync <productId>
//   node bin/pdm-git.mjs publish <productId> <branchName> <commitMessage>
//   node bin/pdm-git.mjs status <productId>
//   node bin/pdm-git.mjs org-sync <organizationId>
//   node bin/pdm-git.mjs org-publish <organizationId> <branchName> <commitMessage>
//   node bin/pdm-git.mjs org-status <organizationId>

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  syncGitRemoteProduct,
  publishProductRepositoryChanges,
  syncOrganizationContext,
  publishOrganizationContextChanges,
} from '../runtime/productSync.js';
import { resolveProductRepository, resolveOrganizationRepository } from '../runtime/productRegistry.js';

const execFileAsync = promisify(execFile);

/** The injected dependency runtime/productSync.js asks for. */
async function runGitCommand(args) {
  return execFileAsync('git', args, { maxBuffer: 32 * 1024 * 1024 });
}

async function git(clonePath, ...args) {
  const { stdout } = await runGitCommand(['-C', clonePath, ...args]);
  return stdout.trim();
}

function usage(message) {
  const lines = [
    message,
    '',
    'Usage:',
    '  node bin/pdm-git.mjs sync <productId>',
    '  node bin/pdm-git.mjs publish <productId> <branchName> <commitMessage>',
    '  node bin/pdm-git.mjs status <productId>',
    '  node bin/pdm-git.mjs org-sync <organizationId>',
    '  node bin/pdm-git.mjs org-publish <organizationId> <branchName> <commitMessage>',
    '  node bin/pdm-git.mjs org-status <organizationId>',
  ];
  console.error(lines.join('\n'));
  process.exit(2);
}

async function cmdSync(productId) {
  const result = await syncGitRemoteProduct(productId, { initiatedByHH: true, runGitCommand });
  console.log(JSON.stringify(result, null, 2));
}

async function cmdOrgSync(organizationId) {
  const result = await syncOrganizationContext(organizationId, { initiatedByHH: true, runGitCommand });
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Publish is retry-safe: git state decides what still needs doing, so a retry
 * after an ambiguous failure cannot produce a confusing "nothing to commit"
 * error or a duplicate commit.
 *
 *   working tree dirty        -> full publish (checkout + add + commit + push)
 *   clean but commits unpushed -> push only (the previous run committed but
 *                                 failed at the push)
 *   clean and nothing ahead    -> nothing to publish, exit 0
 *
 * Shared between products and organizations — same git-state machine either
 * way, only which resolver/publish function is injected differs.
 */
async function publishRetrySafe(id, branchName, commitMessage, { resolveRepository, publish, idKey }) {
  const { repositoryPath: clonePath } = resolveRepository(id);

  const dirty = (await git(clonePath, 'status', '--porcelain')) !== '';
  if (dirty) {
    const result = await publish(id, { initiatedByHH: true, runGitCommand, branchName, commitMessage });
    console.log(JSON.stringify({ ...result, action: 'published' }, null, 2));
    return;
  }

  const currentBranch = await git(clonePath, 'rev-parse', '--abbrev-ref', 'HEAD');
  if (currentBranch !== branchName) {
    console.log(
      JSON.stringify(
        {
          [idKey]: id,
          action: 'nothing_to_publish',
          note: `working tree is clean and currently on "${currentBranch}", not "${branchName}" — nothing was committed or pushed`,
        },
        null,
        2
      )
    );
    return;
  }

  const unpushed = await git(clonePath, 'log', '--oneline', `origin/${branchName}..${branchName}`).catch(
    () => 'remote-branch-missing'
  );
  if (unpushed === '') {
    console.log(JSON.stringify({ [idKey]: id, branchName, action: 'nothing_to_publish' }, null, 2));
    return;
  }

  await runGitCommand(['-C', clonePath, 'push', '-u', 'origin', branchName]);
  console.log(JSON.stringify({ [idKey]: id, branchName, clonePath, action: 'pushed_existing_commits' }, null, 2));
}

async function cmdPublish(productId, branchName, commitMessage) {
  await publishRetrySafe(productId, branchName, commitMessage, {
    resolveRepository: resolveProductRepository,
    publish: publishProductRepositoryChanges,
    idKey: 'productId',
  });
}

async function cmdOrgPublish(organizationId, branchName, commitMessage) {
  await publishRetrySafe(organizationId, branchName, commitMessage, {
    resolveRepository: resolveOrganizationRepository,
    publish: publishOrganizationContextChanges,
    idKey: 'organizationId',
  });
}

async function cmdStatus(productId) {
  const { repositoryPath: clonePath, repositoryType } = resolveProductRepository(productId);
  const [branch, porcelain] = await Promise.all([
    git(clonePath, 'rev-parse', '--abbrev-ref', 'HEAD'),
    git(clonePath, 'status', '--porcelain'),
  ]);
  console.log(
    JSON.stringify(
      { productId, repositoryType, clonePath, branch, dirty: porcelain !== '', changedFiles: porcelain ? porcelain.split('\n').length : 0 },
      null,
      2
    )
  );
}

async function cmdOrgStatus(organizationId) {
  const { repositoryPath: clonePath, repositoryType } = resolveOrganizationRepository(organizationId);
  const [branch, porcelain] = await Promise.all([
    git(clonePath, 'rev-parse', '--abbrev-ref', 'HEAD'),
    git(clonePath, 'status', '--porcelain'),
  ]);
  console.log(
    JSON.stringify(
      { organizationId, repositoryType, clonePath, branch, dirty: porcelain !== '', changedFiles: porcelain ? porcelain.split('\n').length : 0 },
      null,
      2
    )
  );
}

const [command, ...args] = process.argv.slice(2);

try {
  if (command === 'sync') {
    if (args.length !== 1) usage('sync requires exactly <productId>.');
    await cmdSync(args[0]);
  } else if (command === 'publish') {
    if (args.length !== 3) usage('publish requires <productId> <branchName> <commitMessage>.');
    await cmdPublish(args[0], args[1], args[2]);
  } else if (command === 'status') {
    if (args.length !== 1) usage('status requires exactly <productId>.');
    await cmdStatus(args[0]);
  } else if (command === 'org-sync') {
    if (args.length !== 1) usage('org-sync requires exactly <organizationId>.');
    await cmdOrgSync(args[0]);
  } else if (command === 'org-publish') {
    if (args.length !== 3) usage('org-publish requires <organizationId> <branchName> <commitMessage>.');
    await cmdOrgPublish(args[0], args[1], args[2]);
  } else if (command === 'org-status') {
    if (args.length !== 1) usage('org-status requires exactly <organizationId>.');
    await cmdOrgStatus(args[0]);
  } else {
    usage(command ? `Unknown command: ${command}` : 'No command given.');
  }
} catch (error) {
  console.error(`pdm-git ${command} failed: ${error.message}`);
  process.exit(1);
}

