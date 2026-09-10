import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'methodology');
const registryDir = path.join(root, 'registry');
const registryPath = path.join(registryDir, 'ecosystem.json');
const legacyPath = path.join(registryDir, 'registry.json');

const TYPE_BY_DIR = {
  skills: 'skill', prompts: 'prompt', workshops: 'workshop', flows: 'flow', loops: 'loop',
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
function frontmatter(text, key) {
  const block = text.match(/^---\n([\s\S]*?)\n---/m)?.[1];
  if (!block) return null;
  return block.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim().replace(/^['"]|['"]$/g, '') ?? null;
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
  return {
    id: assetId(rel),
    name: frontmatter(text, 'name') || firstHeading(text) || path.basename(file),
    type: TYPE_BY_DIR[rel.split('/')[0]] ?? 'reference',
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
  return [asset.id.replace(/^skills:/, ''), asset.id.split(':').at(-1), asset.name]
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
const skills = assets.filter((a) => a.type === 'skill');
const registry = {
  schema_version: '1.1.0',
  source: 'HH-owned methodology genesis baseline',
  assets,
  capabilities: skills.map((s) => ({
    id: s.id, name: s.name, type: s.type,
    primary_intents: s.routing?.primary_intents ?? [],
    decision_stage: s.routing?.decision_stage ?? null,
    source_reference: s.source_reference,
  })),
};

writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
console.log(`Indexed ${assets.length} methodology assets (${skills.length} skills).`);
