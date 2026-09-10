import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'methodology');
const registryPath = path.join(root, 'registry', 'ecosystem.json');

const TYPE_BY_DIR = {
  skills: 'skill',
  prompts: 'prompt',
  workshops: 'workshop',
  flows: 'flow',
  loops: 'loop',
  commands: 'workflow',
  skeletons: 'skeleton',
  vibes: 'pattern',
  storytelling: 'pattern',
  'prompt-generators': 'generator',
  patterns: 'pattern',
  'market-intelligence': 'market-intelligence',
};

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'registry' || entry.name === 'provenance') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function firstHeading(text) {
  const match = text.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() ?? null;
}

function frontmatter(text, key) {
  const block = text.match(/^---\n([\s\S]*?)\n---/m)?.[1];
  if (!block) return null;
  const match = block.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  return match?.[1]?.trim().replace(/^['"]|['"]$/g, '') ?? null;
}

function inferType(rel) {
  const [dir] = rel.split('/');
  return TYPE_BY_DIR[dir] ?? 'reference';
}

function extractRelatedSkills(text) {
  const ids = new Set();
  for (const m of text.matchAll(/(?:skills\/|Related Skills:?|related skills:?)[^\n]*([a-z0-9][a-z0-9-]{2,})/gi)) {
    const candidate = m[1]?.toLowerCase();
    if (candidate && candidate.includes('-')) ids.add(candidate);
  }
  return [...ids];
}

const assets = [];
for (const file of walk(root)) {
  const rel = path.relative(root, file).split(path.sep).join('/');
  const text = readFileSync(file, 'utf8');
  const type = inferType(rel);
  const id = rel.replace(/\/(SKILL|README)\.md$/i, '').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9/_-]/g, '-').replace(/\//g, ':').toLowerCase();
  assets.push({
    id,
    name: frontmatter(text, 'name') || firstHeading(text) || path.basename(file),
    type,
    source_reference: `methodology/${rel}`,
    relative_path: rel,
    summary: frontmatter(text, 'description') || null,
    related_skills: type === 'skill' ? extractRelatedSkills(text) : [],
    size_bytes: statSync(file).size,
  });
}

assets.sort((a, b) => a.id.localeCompare(b.id));
const skills = assets.filter((a) => a.type === 'skill');
const registry = {
  schema_version: '1.0.0',
  generated_at: new Date().toISOString(),
  source: 'HH-owned methodology genesis baseline',
  assets,
  capabilities: skills.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    primary_intents: [],
    decision_stage: null,
    source_reference: s.source_reference,
  })),
};

import { mkdirSync } from 'node:fs';
mkdirSync(path.dirname(registryPath), { recursive: true });
writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
console.log(`Indexed ${assets.length} methodology assets (${skills.length} skills).`);
