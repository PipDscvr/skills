import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import { validateRepository } from '../scripts/validate.mjs';

const temporaryRoots = [];

async function makeRepository(files) {
  const root = await mkdtemp(join(tmpdir(), 'skills-repository-'));
  temporaryRoots.push(root);

  for (const [relativePath, content] of Object.entries(files)) {
    const destination = join(root, relativePath);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, content, 'utf8');
  }

  return root;
}

test.after(async () => {
  await Promise.all(temporaryRoots.map((root) => rm(root, { recursive: true, force: true })));
});

test('accepts a portable skill with matching frontmatter', async () => {
  const root = await makeRepository({
    'skills/example-skill/SKILL.md': [
      '---',
      'name: example-skill',
      'description: Use when a concrete example skill is required.',
      '---',
      '',
      '# Example Skill',
      '',
      'Inspect repository instructions before acting.',
    ].join('\n'),
  });

  const result = await validateRepository(root);
  assert.deepEqual(result, { valid: true, issues: [] });
});

test('reports malformed and mismatched skill metadata', async () => {
  const root = await makeRepository({
    'skills/example-skill/SKILL.md': [
      '---',
      'name: Different_Name',
      'description: ""',
      '---',
      '',
      '# Example Skill',
    ].join('\n'),
  });

  const result = await validateRepository(root);
  assert.equal(result.valid, false);
  assert.deepEqual(
    result.issues.map(({ code }) => code),
    ['skill-description', 'skill-name'],
  );
});
