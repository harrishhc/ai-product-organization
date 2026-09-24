import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');

/**
 * A repo-wide dead-link checker, added after a review pattern this repo kept
 * repeating: a dangling reference gets found and fixed in one file, then a
 * later "re-review from scratch" finds a sibling instance of the *same*
 * target in a different file, because the original fix only checked the
 * specific claim in front of it, not every place the same fact was stated.
 * Concretely: methodology/START_HERE.md (27 dead links, #30),
 * methodology/provenance/dean-product-manager-skills.md (#32), and
 * README.md's directory listing (#32) all pointed at the same deleted
 * vendor/ path or its content, found and fixed one at a time across three
 * separate reviews. This test is the mechanism so the next one is not a
 * fourth manual review — it is a fifth reviewer that never gets tired or
 * forgets to grep the whole repo.
 *
 * Scope is deliberately narrow. Only the actively-maintained surface is
 * checked: root docs, docs/, governance/, agents/, products/,
 * organizations/, and methodology's own entrypoint corpus (capabilities/,
 * commands/, provenance/, skills/*\/SKILL.md, and each directory's own
 * README.md). The bulk vendored reference trees
 * under methodology/ (prompts/, storytelling/, skeletons/, vibes/,
 * workshops/, market-intelligence/, prompt-generators/) are excluded: a
 * scan at authoring time found roughly 90 pre-existing broken links there,
 * almost all URL-encoded upstream filenames in material nothing in this
 * repository routes to or reads programmatically (see
 * methodology/provenance/ for what is actually indexed). Enforcing that
 * tree here would either fail CI on unrelated genesis-import content
 * indefinitely, or force fixing ~90 links in reference material as a side
 * effect of an unrelated change — neither is this test's job. If that
 * tree becomes actively maintained, widen SCOPE_DIRS accordingly.
 */
const SCOPE_DIRS = [
  '.', // root: README.md, AGENTS.md, CLAUDE.md — not recursed, see walk()
  'docs',
  'governance',
  'agents', // recursed; each functional agent's own README.md
  'products', // recursed; root README.md, _template/README.md, and any future fixture docs
  'organizations', // recursed; root README.md and each organization's own README.md
  'methodology', // not recursed either — see walk()
  'methodology/capabilities',
  'methodology/commands',
  'methodology/provenance',
  'methodology/skills', // recursed; every skill's own SKILL.md
];

const EXCLUDED = new Set(['.git', 'node_modules', '.product-clones', '.organization-clones', '.claude']);

function walk(dir, { recurse }, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDED.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (recurse) walk(full, { recurse }, out);
    } else if (entry.name.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

function scopedMarkdownFiles() {
  const files = [];
  // root: only files directly in it, not the whole repo
  walk(REPO_ROOT, { recurse: false }, files);
  walk(path.join(REPO_ROOT, 'docs'), { recurse: true }, files);
  walk(path.join(REPO_ROOT, 'governance'), { recurse: true }, files);
  walk(path.join(REPO_ROOT, 'agents'), { recurse: true }, files);
  walk(path.join(REPO_ROOT, 'products'), { recurse: true }, files);
  walk(path.join(REPO_ROOT, 'organizations'), { recurse: true }, files);
  // methodology/ itself: only its own README.md and START_HERE-equivalent,
  // not the whole tree (that would pull in the excluded vendored trees).
  walk(path.join(REPO_ROOT, 'methodology'), { recurse: false }, files);
  walk(path.join(REPO_ROOT, 'methodology/capabilities'), { recurse: true }, files);
  walk(path.join(REPO_ROOT, 'methodology/commands'), { recurse: true }, files);
  walk(path.join(REPO_ROOT, 'methodology/provenance'), { recurse: true }, files);
  walk(path.join(REPO_ROOT, 'methodology/skills'), { recurse: true }, files);
  return files;
}

/** Markdown links only — `[text](path)`. Bare backtick/prose paths are not
 * checked: a prior attempt at that produced false positives (prose like
 * "vendor/buyer disagreement" is not a path), making the check unreliable
 * without constant hand-tuned exceptions. */
function extractLinks(text) {
  return [...text.matchAll(/\]\(([^)]+)\)/g)]
    .map((m) => m[1])
    .filter((link) => !/^https?:|^mailto:/.test(link))
    .filter((link) => link.trim() !== '');
}

test('every markdown link on the actively-maintained surface resolves to a real file or directory', () => {
  const broken = [];
  for (const file of scopedMarkdownFiles()) {
    const text = readFileSync(file, 'utf8');
    for (const link of extractLinks(text)) {
      const withoutFragment = link.split('#')[0];
      if (!withoutFragment) continue; // pure #anchor, nothing to resolve
      const resolved = path.resolve(path.dirname(file), withoutFragment);
      if (!existsSync(resolved)) {
        broken.push(`${path.relative(REPO_ROOT, file)} -> ${link}`);
      }
    }
  }
  assert.deepEqual(broken, [], `dead markdown link(s):\n${broken.join('\n')}`);
});

test('the scoped surface is non-trivial, so this test cannot silently pass on nothing', () => {
  const files = scopedMarkdownFiles();
  assert.ok(files.length > 50, `expected the scoped surface to cover many files; found ${files.length}`);
});

test('every skill directory scanned actually contains a SKILL.md (sanity check on walk() itself)', () => {
  const skillsDir = path.join(REPO_ROOT, 'methodology/skills');
  const dirs = readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory());
  assert.ok(dirs.length > 50, 'expected many skill directories');
  for (const d of dirs) {
    assert.ok(
      statSync(path.join(skillsDir, d.name, 'SKILL.md')).isFile(),
      `${d.name} has no SKILL.md`,
    );
  }
});
