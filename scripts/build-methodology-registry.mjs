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
function frontmatter(text, key) {
  const block = frontmatterBlock(text);
  if (!block) return null;
  return block.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim().replace(/^['"]|['"]$/g, '') ?? null;
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
    theme: frontmatter(text, 'theme'),
    intent: frontmatter(text, 'intent'),
    best_for: frontmatterList(text, 'best_for'),
    scenarios: frontmatterList(text, 'scenarios'),
    source_reference: `methodology/${rel}`,
    relative_path: rel,
    summary: frontmatter(text, 'description') || null,
    related_skills: [],
    size_bytes: statSync(file).size,
  };
});

const skillIds = new Set(preliminary.filter((a) => a.type === 'skill').map((a) => a.id));
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

const assets = preliminary.map((asset) => ({
  ...asset,
  related_skills: extractSkillRefs(readFileSync(path.join(root, asset.relative_path), 'utf8')),
}));

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
const capabilityAssets = assets.filter((a) => a.type === 'skill' || a.type === 'capability');
const registry = {
  schema_version: '1.3.0',
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
    source_reference: s.source_reference,
  })),
};

writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
console.log(`Indexed ${assets.length} methodology assets (${capabilityAssets.length} routable capabilities).`);
