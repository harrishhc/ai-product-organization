#!/usr/bin/env node
// The PDM Worker loop, as a command.
//
// COLLABORATION_PROTOCOL.md describes the loop in prose:
//
//   load portfolio -> select next runnable work -> read that product's Active
//   Brief -> do one coherent work unit -> persist -> refresh -> repeat
//
// Until this file existed, that loop had no executable form. Nothing called
// instrumentation.js#shouldContinue (the Runtime Governor) and nothing called
// recordWorkItem, so the governor was wired to nothing and "keep going" was
// left entirely to whichever model happened to be driving. This command is the
// loop's mechanical half: it answers "what is next, and may I continue?".
//
// It deliberately does NOT do the work. Selecting a methodology, reasoning
// about a product, and writing durable state remain PDM judgment
// (orchestrator.js's "mechanism, not judgment" rule applies here too).
//
// Usage:
//   node bin/pdm-run.mjs status
//   node bin/pdm-run.mjs next [--done N] [--max-work-items N]
//                             [--max-tool-calls N] [--max-estimated-tokens N]
//   node bin/pdm-run.mjs route [--uncertainty "..."] [--type <token>]
//                              [--intents a,b] [--stage <stage>] [--spans-stages]
//
// `route` runs selectCapability for you and prints the one entrypoint to read,
// its anti-cues and composition. With no flags it routes the next READY
// product's recorded uncertainty; --uncertainty routes an ad-hoc question
// instead, so the shortlist `next` prints never has to be mistaken for it.
//
// --done N reports how many work items this run has already completed. The
// runtime holds no cross-invocation state by design (ARCHITECTURE.md §6.2:
// derived, never stored), so the caller supplies progress the same way
// productSync.js has git injected and shouldContinue has usage injected.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { refreshPortfolio, selectNextWork, renderPortfolioIndex, writePortfolioIndex } from '../runtime/portfolio.js';
import { resolveProductRepository } from '../runtime/productRegistry.js';
import { renderRoutingShortlist, renderSelection } from '../runtime/registry.js';
import { selectCapability } from '../runtime/orchestrator.js';
import { describeDelegation } from '../runtime/pdmCore.js';
import { createSession } from '../runtime/instrumentation.js';

function parseArgs(argv) {
  const out = { done: 0, budget: {}, route: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const eq = argv[i].indexOf('=');
    const flag = eq === -1 ? argv[i] : argv[i].slice(0, eq);
    const inline = eq === -1 ? undefined : argv[i].slice(eq + 1);
    const text = () => inline ?? argv[++i];
    const value = () => Number(text());
    if (flag === '--uncertainty') out.route.dominantUncertainty = text();
    else if (flag === '--type') out.route.uncertaintyType = text();
    else if (flag === '--intents') out.route.intents = text().split(',').map((x) => x.trim()).filter(Boolean);
    else if (flag === '--stage') out.route.decisionStage = text();
    else if (flag === '--spans-stages') out.route.spansMultipleStages = true;
    else if (flag === '--done') out.done = value();
    else if (flag === '--max-work-items') out.budget.maxWorkItems = value();
    else if (flag === '--max-tool-calls') out.budget.maxToolCalls = value();
    else if (flag === '--max-estimated-tokens') out.budget.maxEstimatedTokens = value();
    else if (flag.startsWith('--')) {
      console.error(`Unknown flag: ${flag}`);
      process.exit(2);
    }
  }
  return out;
}

/** Refresh is the one cheap read the protocol's loop opens with. */
function refresh(session) {
  const portfolio = refreshPortfolio({ session });
  const selected = selectNextWork(portfolio);
  writePortfolioIndex(renderPortfolioIndex(portfolio, { selected }));
  return { portfolio, selected };
}

function activeBriefFor(productId) {
  try {
    const { repositoryPath, workStateEntry } = resolveProductRepository(productId);
    if (!workStateEntry) return null;
    const briefPath = path.join(path.resolve(repositoryPath), path.dirname(workStateEntry), 'active-brief.md');
    return existsSync(briefPath) ? { briefPath, content: readFileSync(briefPath, 'utf8') } : { briefPath, content: null };
  } catch {
    return null;
  }
}

function printPortfolio(portfolio) {
  for (const e of portfolio) {
    const detail =
      e.status === 'WAITING_FOR_FOUNDER' ? `awaiting HH: ${e.pendingCheckpointIds.join(', ')}`
      : e.status === 'BLOCKED' ? e.blocked.join('; ')
      : e.status === 'READY' ? (e.nextAction ?? '')
      : (e.note ?? '');
    console.log(`  [${String(e.status).padEnd(19)}] p${e.priority ?? '-'} ${e.productId} — ${detail || '—'}`);
  }
}

const [command, ...rest] = process.argv.slice(2);
const { done, budget, route } = parseArgs(rest);
const session = createSession({ budget: Object.keys(budget).length > 0 ? budget : undefined });

for (let i = 0; i < done; i += 1) session.recordWorkItem(`prior-${i + 1}`);

if (command === 'status') {
  const { portfolio, selected } = refresh(session);
  console.log(`Portfolio (${portfolio.length} products)`);
  printPortfolio(portfolio);
  console.log(`\nNext selected work: ${selected ? selected.productId : '(nothing runnable)'}`);
} else if (command === 'next') {
  const governor = session.shouldContinue();
  if (!governor.canContinue) {
    console.log(JSON.stringify({ action: 'stop', reason: governor.reason, workItemsDone: done }, null, 2));
    process.exit(0);
  }

  const { portfolio, selected } = refresh(session);
  if (!selected) {
    const waiting = portfolio.filter((e) => e.status === 'WAITING_FOR_FOUNDER').map((e) => e.productId);
    console.log(
      JSON.stringify(
        { action: 'stop', reason: 'no_runnable_work', waitingForFounder: waiting, workItemsDone: done },
        null,
        2
      )
    );
    process.exit(0);
  }

  const brief = activeBriefFor(selected.productId);
  console.log(
    JSON.stringify(
      {
        action: 'work',
        productId: selected.productId,
        priority: selected.priority,
        nextAction: selected.nextAction,
        remainingNextActions: selected.nextActionCount,
        dominantUncertainty: selected.dominantUncertainty,
        activeBriefPath: brief?.briefPath ?? null,
        workItemsDone: done,
      },
      null,
      2
    )
  );
  if (brief?.content) {
    console.log('\n--- Active Brief ---');
    console.log(brief.content);
  }
  console.log(`\nDelegation: ${describeDelegation(selected.uncertaintyType)}`);
  console.log(renderRoutingShortlist(selected.dominantUncertainty, selected.routingIntents, selected.uncertaintyType).join('\n'));
  console.log(
    '\nNext: run `node bin/pdm-run.mjs route` to select from the shortlist above (add --intents/--stage to refine, ' +
      '--uncertainty "..." if the question at hand differs from the one on file), read what it names, ' +
      'do ONE coherent work unit, persist durable state, ' +
      `then re-run: node bin/pdm-run.mjs next --done ${done + 1}`
  );
} else if (command === 'route') {
  const { selected } = refresh(session);
  const dominantUncertainty = route.dominantUncertainty ?? selected?.dominantUncertainty;
  if (!dominantUncertainty) {
    console.error('route needs an uncertainty: pass --uncertainty "..." (no READY product has one on file).');
    process.exit(2);
  }
  const usingFile = route.dominantUncertainty === undefined;
  let result;
  try {
    result = selectCapability(
      {
        dominantUncertainty,
        uncertaintyType: route.uncertaintyType ?? (usingFile ? selected?.uncertaintyType : undefined),
        intents: route.intents ?? (usingFile ? selected?.routingIntents : undefined) ?? [],
        decisionStage: route.decisionStage,
        spansMultipleStages: route.spansMultipleStages ?? false,
      },
      session
    );
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
  console.log(`Routing: "${dominantUncertainty}"${usingFile ? ` (on file for ${selected.productId})` : ' (ad hoc)'}`);
  if (!result.selected) {
    console.log('No entrypoint matched. That is no signal, not a weak one: supply --intents in the corpus\'s own terms.');
    process.exit(0);
  }
  console.log(renderSelection(result.selected).join('\n'));
  console.log(`\n${result.candidates.length - 1} other candidate(s) considered; run \`next\` for the ranked shortlist.`);
} else {
  console.error('Usage:\n  node bin/pdm-run.mjs status\n  node bin/pdm-run.mjs next [--done N] [--max-work-items N] [--max-tool-calls N] [--max-estimated-tokens N]\n  node bin/pdm-run.mjs route [--uncertainty "..."] [--type <token>] [--intents a,b] [--stage <stage>] [--spans-stages]');
  process.exit(2);
}
