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
//
// --done N reports how many work items this run has already completed. The
// runtime holds no cross-invocation state by design (ARCHITECTURE.md §6.2:
// derived, never stored), so the caller supplies progress the same way
// productSync.js has git injected and shouldContinue has usage injected.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { refreshPortfolio, selectNextWork, renderPortfolioIndex, writePortfolioIndex } from '../runtime/portfolio.js';
import { resolveProductRepository } from '../runtime/productRegistry.js';
import { filterCandidates, resolveComposition } from '../runtime/registry.js';
import { createSession } from '../runtime/instrumentation.js';

function parseArgs(argv) {
  const out = { done: 0, budget: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const [flag, inline] = argv[i].split('=');
    const value = () => Number(inline ?? argv[++i]);
    if (flag === '--done') out.done = value();
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
const { done, budget } = parseArgs(rest);
const session = createSession({ budget: Object.keys(budget).length > 0 ? budget : undefined });
/**
 * A first-pass routing shortlist for the selected work's dominant uncertainty.
 *
 * This is the one piece of routing the command can honestly do on its own: the
 * dominant uncertainty is already durable Work State, so no judgment is
 * invented by querying with it. `intents` and `decisionStage` are PDM inputs
 * and are deliberately not guessed, which is why this is labelled a shortlist
 * and not a selection.
 *
 * It exists because the decisive signals were previously only reachable by
 * remembering to call a function. A blind test on 2026-09-21 was saved by one
 * anti-cue ("discovery is not yet mature (run prd-readiness-gate first)") that
 * redirected the whole work unit; had the agent not thought to route, it would
 * have produced a confident PRD with an invented persona section. Printing the
 * shortlist and its anti-cues makes that visible at the start of every work
 * unit instead of depending on recall.
 *
 * Loads no detail file — metadata only, so it costs no context.
 */
function printRouting(dominantUncertainty) {
  if (!dominantUncertainty) {
    console.log('\n--- Methodology routing ---\nNo dominant uncertainty in this product\'s Work State; record one before routing.');
    return;
  }
  const candidates = filterCandidates({ dominantUncertainty });
  console.log('\n--- Methodology routing (shortlist from the dominant uncertainty alone) ---');

  // The shortlist matches terms found in the uncertainty against the
  // methodology's own English self-description. An uncertainty written in
  // another language therefore matches little or nothing — not weak evidence,
  // no evidence — and printing that as a ranking invites acting on noise. No
  // language detection is attempted: Latin-script proper nouns (Paige, DeepDx)
  // make that unreliable, and the instruction below is the same either way.
  // `intents` is a PDM input and is where the bridge belongs.
  const noStrongMatch = candidates.length === 0 || candidates[0].fit === 'weak_fit';

  if (candidates.length === 0) {
    console.log('  No entrypoint matched this uncertainty. This is no signal, not a weak one.');
    console.log('  Route explicitly: selectCapability({ dominantUncertainty, intents: [...], decisionStage })');
    console.log('  naming the work in the corpus\'s own terms (e.g. "competitive", "prd", "prioritization").');
    console.log('  An uncertainty not written in English will match little here; supplying intents is the bridge.');
    return;
  }
  for (const c of candidates.slice(0, 5)) {
    console.log(`  ${c.fit.padEnd(10)} ${c.matchBasis.padEnd(9)} ${(c.type ?? '').padEnd(11)} ${c.id}`);
  }
  if (candidates.length > 5) console.log(`  ... ${candidates.length - 5} more`);
  if (noStrongMatch) {
    console.log('\n  Nothing above weak_fit: a starting point, not a selection. Confirm with explicit');
    console.log('  intents/decisionStage — an uncertainty not written in English matches little here.');
  }

  const top = candidates[0];
  if (top.antiCues?.length) {
    console.log(`\n  Anti-cues on ${top.id} — if one of these holds, it is the wrong entrypoint:`);
    for (const cue of top.antiCues) console.log(`    - ${cue}`);
  }
  const { composes, composedBy } = resolveComposition(top.id);
  if (composes.length) {
    console.log(`\n  ${top.id} composes: ${composes.map((m) => m.id).join(', ')}`);
  }
  for (const parent of composedBy) {
    console.log(`\n  ${top.id} is a member of ${parent.id}, alongside: ${parent.siblings.join(', ')}`);
  }
}

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
  printRouting(selected.dominantUncertainty);
  console.log(
    '\nNext: confirm or refine the routing above with intents/decisionStage ' +
      '(runtime/orchestrator.js#selectCapability), do ONE coherent work unit, persist durable state, ' +
      `then re-run: node bin/pdm-run.mjs next --done ${done + 1}`
  );
} else {
  console.error('Usage:\n  node bin/pdm-run.mjs status\n  node bin/pdm-run.mjs next [--done N] [--max-work-items N] [--max-tool-calls N] [--max-estimated-tokens N]');
  process.exit(2);
}
