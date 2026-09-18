import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'methodology');
const registryDir = path.join(root, 'registry');
const registryPath = path.join(registryDir, 'ecosystem.json');
const legacyPath = path.join(registryDir, 'registry.json');

const TYPE_BY_DIR = {
  capabilities: 'capability', skills: 'skill', prompts: 'prompt', workshops: 'workshop', flows: 'flow', loops: 'loop',
  commands: 'workflow', skeletons: 'skeleton', vibes: 'pattern', storytelling: 'pattern',
  'prompt-generators': 'generator', patterns: 'pattern', 'market-intelligence': 'market-intelligence',
};

// Only these are methodology *entrypoints* — things PDM may select and enter.
// Everything else under them (template.md, examples/*.md, README.md) is
// supporting material that belongs to an entrypoint, not a routable choice of
// its own. Indexing those as capabilities let selection "choose" a worked
// example as if it were a method.
const ENTRYPOINT_DIRS = new Set(['skills', 'capabilities', 'commands']);
function isEntrypoint(rel) {
  if (/(^|\/)README\.md$/i.test(rel)) return false;
  const segments = rel.split('/');
  const top = segments[0];
  if (!ENTRYPOINT_DIRS.has(top)) return false;
  if (top === 'skills') return /\/SKILL\.md$/i.test(rel);
  return segments.length === 2 && rel.endsWith('.md');
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'registry' || entry.name === 'provenance') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out); else out.push(full);
  }
  return out;
}
function firstHeading(text) { return text.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? null; }
function frontmatterBlock(text) { return text.match(/^---\n([\s\S]*?)\n---/m)?.[1] ?? ''; }

/**
 * Reads a scalar frontmatter value, including YAML block scalars
 * (`>`, `>-`, `|`, `|-`). Matching only `^key:\s*(.+)$` captured the block
 * indicator itself, so every block-scalar field (notably `intent:`) resolved
 * to the literal ">-" instead of its text.
 */
function frontmatter(text, key) {
  const block = frontmatterBlock(text);
  if (!block) return null;
  const match = block.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'));
  if (!match) return null;
  const inline = match[1].trim();
  const indicator = inline.match(/^([|>])[+-]?$/);
  if (!indicator) return inline.replace(/^['"]|['"]$/g, '') || null;

  const continuation = [];
  for (const line of block.slice(match.index + match[0].length).split('\n').slice(1)) {
    if (line.trim() === '') { continuation.push(''); continue; }
    if (!/^\s/.test(line)) break; // dedented back to the next key
    continuation.push(line.trim());
  }
  while (continuation.length && continuation.at(-1) === '') continuation.pop();
  const folded = indicator[1] === '|' ? continuation.join('\n') : continuation.join(' ').trim();
  return folded || null;
}
function frontmatterList(text, key) {
  const block = frontmatterBlock(text);
  const match = block.match(new RegExp(`^${key}:\\s*\\n((?:\\s+-.*\\n?)+)`, 'm'));
  if (!match) return [];
  return [...match[1].matchAll(/^\s+-\s+["']?(.+?)["']?\s*$/gm)].map((m) => m[1]);
}
function slug(value) { return value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, ''); }
function assetId(rel) {
  return rel.replace(/\/(SKILL|README)\.md$/i, '').replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9/_-]/g, '-').replace(/\//g, ':').toLowerCase();
}

let legacy = { capabilities: [] };
if (existsSync(legacyPath)) {
  try { legacy = JSON.parse(readFileSync(legacyPath, 'utf8')); } catch { /* advisory only */ }
}

const preliminary = walk(root).map((file) => {
  const rel = path.relative(root, file).split(path.sep).join('/');
  const text = readFileSync(file, 'utf8');
  const sourceType = TYPE_BY_DIR[rel.split('/')[0]] ?? 'reference';
  const executionType = frontmatter(text, 'type');
  return {
    id: assetId(rel),
    name: frontmatter(text, 'name') || firstHeading(text) || path.basename(file),
    type: sourceType,
    execution_type: executionType || null,
    entrypoint: isEntrypoint(rel),
    theme: frontmatter(text, 'theme'),
    intent: frontmatter(text, 'intent'),
    best_for: frontmatterList(text, 'best_for'),
    scenarios: frontmatterList(text, 'scenarios'),
    source_reference: `methodology/${rel}`,
    relative_path: rel,
    summary: frontmatter(text, 'description') || null,
    // Dean's own routing-relevant frontmatter, uniform across all 77 skills.
    // estimated_time is the ecosystem's native cost signal; outputs/argument_hint
    // say what an entrypoint produces and what input it expects.
    estimated_time: frontmatter(text, 'estimated_time'),
    argument_hint: frontmatter(text, 'argument-hint'),
    outputs: frontmatterList(text, 'outputs'),
    declared_uses: frontmatterList(text, 'uses'),
    composes: [],
    composes_unresolved: [],
    related_skills: [],
    size_bytes: statSync(file).size,
  };
});

const skillIds = new Set(preliminary.filter((a) => a.type === 'skill').map((a) => a.id));
const entrypointIds = new Set(preliminary.filter((a) => a.entrypoint).map((a) => a.id));

/**
 * `related_skills` is a heuristic "see also" — it scans backticked names and
 * skills/ paths, so it picks up a skill's References section as readily as its
 * actual dependencies. `composes` below is the declared `uses:` contract and is
 * the only field safe to treat as a dependency.
 */
function extractSkillRefs(text) {
  const refs = new Set();
  const candidates = [
    ...[...text.matchAll(/skills\/([a-z0-9][a-z0-9-]+)/gi)].map((m) => m[1]),
    ...[...text.matchAll(/`([a-z0-9][a-z0-9-]+)`/gi)].map((m) => m[1]),
  ];
  for (const candidate of candidates) {
    const id = `skills:${candidate.toLowerCase()}`;
    if (skillIds.has(id)) refs.add(id);
  }
  return [...refs].sort();
}
function resolveUse(name) {
  const key = slug(String(name));
  return [`skills:${key}`, `capabilities:${key}`, `commands:${key}`].find((id) => entrypointIds.has(id)) ?? null;
}

const assets = preliminary.map((asset) => {
  const text = readFileSync(path.join(root, asset.relative_path), 'utf8');
  const resolved = asset.declared_uses.map((use) => ({ use, id: resolveUse(use) }));
  return {
    ...asset,
    composes: resolved.filter((r) => r.id).map((r) => r.id),
    composes_unresolved: resolved.filter((r) => !r.id).map((r) => r.use),
    related_skills: extractSkillRefs(text),
  };
});

const legacyByKey = new Map();
for (const cap of legacy.capabilities ?? []) {
  for (const key of [cap.id, cap.provenance?.upstream_skill, slug(cap.name ?? '')].filter(Boolean)) {
    legacyByKey.set(String(key).toLowerCase(), cap);
  }
}
function legacyFor(asset) {
  return [asset.id.replace(/^(skills|capabilities):/, ''), asset.id.split(':').at(-1), asset.name]
    .map((v) => String(v).toLowerCase()).map((k) => legacyByKey.get(k)).find(Boolean) ?? null;
}
for (const asset of assets) {
  const cap = legacyFor(asset);
  if (!cap) continue;
  asset.routing = {
    primary_intents: cap.primary_intents ?? [], decision_stage: cap.decision_stage ?? null,
    selection_cues: cap.selection_cues ?? [], anti_cues: cap.anti_cues ?? [], cost_profile: cap.cost_profile ?? null,
  };
  asset.provenance = cap.provenance ?? null;
}

assets.sort((a, b) => a.id.localeCompare(b.id));
const capabilityAssets = assets.filter((a) => a.entrypoint);
const registry = {
  schema_version: '1.4.0',
  source: 'HH-owned methodology genesis baseline',
  assets,
  capabilities: capabilityAssets.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.execution_type || s.type,
    source_type: s.type,
    primary_intents: s.routing?.primary_intents ?? [],
    decision_stage: s.routing?.decision_stage ?? null,
    selection_cues: s.routing?.selection_cues ?? [],
    anti_cues: s.routing?.anti_cues ?? [],
    cost_profile: s.routing?.cost_profile ?? null,
    theme: s.theme,
    // Cue fields carried from the asset's own frontmatter so routing can use
    // the methodology's self-description instead of requiring hand-authored
    // routing metadata for every entrypoint.
    intent: s.intent,
    summary: s.summary,
    best_for: s.best_for,
    scenarios: s.scenarios,
    estimated_time: s.estimated_time,
    argument_hint: s.argument_hint,
    outputs: s.outputs,
    composes: s.composes,
    source_reference: s.source_reference,
  })),
};

writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
const composing = capabilityAssets.filter((a) => a.composes.length).length;
// Only entrypoints are held to the composition contract. A README documenting
// the `uses:` syntax with placeholder names is not a broken declaration.
const broken = assets.filter((a) => a.entrypoint && a.composes_unresolved.length);
console.log(
  `Indexed ${assets.length} methodology assets (${capabilityAssets.length} routable entrypoints, ${composing} declaring a composition).`
);
if (broken.length) {
  console.warn(`Unresolved uses: declarations in ${broken.length} asset(s):`);
  for (const a of broken) console.warn(`  ${a.id} -> ${a.composes_unresolved.join(', ')}`);
}
