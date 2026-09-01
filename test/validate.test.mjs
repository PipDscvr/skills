import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { validateRepository } from '../scripts/validate.mjs';

const temporaryRoots = [];

const REQUIRED_SKILLS = [
  'architecture-review',
  'bug-investigation',
  'code-review',
  'final-verification',
  'fix-review-findings',
  'implement-feature',
  'security-review',
];

const PRODUCTION_SAFETY_BOUNDARY = 'Never merge, deploy, publish, or modify production infrastructure.';
const REVIEW_SKILLS = new Set(['architecture-review', 'code-review', 'security-review']);
const REVIEW_SEVERITY_DEFINITIONS = [
  '- P0: catastrophic behavior, serious security vulnerability, corruption, or data loss.',
  '- P1: definite significant bug or major regression.',
  '- P2: real bug, meaningful edge case, or meaningful engineering risk.',
  '- P3: non-blocking improvement.',
];
const REVIEW_VERDICT_RULES = [
  'Return `VERDICT: CHANGES_REQUIRED` whenever any P0, P1, or P2 finding exists.',
  'Return `VERDICT: PASS` otherwise.',
];

function validSkill(name) {
  return ['---', `name: ${name}`, `description: Use when ${name} behavior is required.`, '---', '', `# ${name}`].join('\n');
}

function baselineSkill(name) {
  const lines = [validSkill(name), '', PRODUCTION_SAFETY_BOUNDARY];
  if (REVIEW_SKILLS.has(name)) {
    lines.push(
      '',
      ...REVIEW_SEVERITY_DEFINITIONS,
      '',
      'SEVERITY: P0 | P1 | P2 | P3',
      'LOCATION: file and location',
      'PROBLEM: problem',
      'IMPACT: impact',
      'EVIDENCE: evidence',
      'SUGGESTED_DIRECTION: direction',
      '',
      ...REVIEW_VERDICT_RULES,
    );
  }
  if (name === 'final-verification') {
    lines.push('', 'VERIFICATION: PASS', 'VERIFICATION: FAIL', 'VERIFICATION: BLOCKED');
  }
  if (name === 'fix-review-findings') lines.push('', 'FIXED', 'REJECTED', 'BLOCKED');
  return lines.join('\n');
}

function baselineSkillFiles() {
  return Object.fromEntries(REQUIRED_SKILLS.map((name) => [`skills/${name}/SKILL.md`, baselineSkill(name)]));
}

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

async function makeCompleteWorkflowFixture() {
  return makeRepository({
    'schemas/workflow.schema.json': await readFile(new URL('../schemas/workflow.schema.json', import.meta.url), 'utf8'),
    'schemas/profile.schema.json': await readFile(new URL('../schemas/profile.schema.json', import.meta.url), 'utf8'),
    'workflows/implement-review-fix.yaml': await readFile(new URL('../workflows/implement-review-fix.yaml', import.meta.url), 'utf8'),
    'skills/implement-feature/SKILL.md': validSkill('implement-feature'),
    'skills/final-verification/SKILL.md': validSkill('final-verification'),
    'skills/code-review/SKILL.md': validSkill('code-review'),
    'skills/fix-review-findings/SKILL.md': validSkill('fix-review-findings'),
  });
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

test('reports missing baseline skills', async () => {
  const root = await makeRepository({
    'skills/implement-feature/SKILL.md': validSkill('implement-feature'),
  });

  const result = await validateRepository(root, { requireBaseline: true });
  assert.equal(result.valid, false);
  assert.ok(result.issues.some(({ code, message }) => code === 'missing-skill' && message.includes('code-review')));
  assert.deepEqual(
    result.issues.filter(({ code }) => code === 'missing-skill').map(({ message }) => message.replace('Missing baseline skill: ', '')),
    REQUIRED_SKILLS.filter((name) => name !== 'implement-feature'),
  );
});

test('rejects provider-specific instructions in generic skills', async () => {
  const root = await makeRepository({
    'skills/example-skill/SKILL.md': [
      '---',
      'name: example-skill',
      'description: Use when an example is required.',
      '---',
      '',
      'Ask Codex to perform this step.',
    ].join('\n'),
  });

  const result = await validateRepository(root);
  assert.ok(result.issues.some(({ code }) => code === 'provider-leakage'));
});

test('rejects unknown workflow skills and an invalid human gate', async () => {
  const root = await makeRepository({
    'skills/implement-feature/SKILL.md': validSkill('implement-feature'),
    'schemas/workflow.schema.json': await readFile(
      new URL('../schemas/workflow.schema.json', import.meta.url),
      'utf8',
    ),
    'workflows/broken.yaml': [
      'version: 1',
      'name: broken',
      'description: Broken workflow fixture.',
      'required_roles: [implementer, reviewer, fixer]',
      'initial_steps:',
      '  - { id: implement, skill: missing-skill, role: implementer }',
      'review_loop:',
      '  review_steps:',
      '    - { id: review, skill: missing-review, role: reviewer }',
      '  remediation_steps:',
      '    - { id: fix, skill: missing-fix, role: fixer }',
      '  max_cycles: 3',
      '  hard_max_cycles: 5',
      '  blocking_severities: [P0, P1, P2]',
      '  non_blocking_severities: [P3]',
      '  on_limit: { state: STOPPED, action: continue_automatically }',
      'completion: { success_state: READY_FOR_HUMAN_REVIEW }',
    ].join('\n'),
  });

  const result = await validateRepository(root);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some(({ code }) => code === 'workflow-schema'));
  assert.ok(result.issues.some(({ code }) => code === 'unknown-skill'));
});

test('accepts a provider-neutral workflow with declared roles and known skills', async () => {
  const workflowSchema = await readFile(new URL('../schemas/workflow.schema.json', import.meta.url), 'utf8');
  const workflow = await readFile(new URL('../workflows/implement-review-fix.yaml', import.meta.url), 'utf8');
  const root = await makeRepository({
    'schemas/workflow.schema.json': workflowSchema,
    'workflows/implement-review-fix.yaml': workflow,
    'skills/implement-feature/SKILL.md': validSkill('implement-feature'),
    'skills/final-verification/SKILL.md': validSkill('final-verification'),
    'skills/code-review/SKILL.md': validSkill('code-review'),
    'skills/fix-review-findings/SKILL.md': validSkill('fix-review-findings'),
  });

  const result = await validateRepository(root);
  assert.equal(result.valid, true, result.issues.map(({ message }) => message).join('\n'));
});

test('reports a schema issue when workflow step collections are malformed', async () => {
  const root = await makeRepository({
    'schemas/workflow.schema.json': await readFile(new URL('../schemas/workflow.schema.json', import.meta.url), 'utf8'),
    'workflows/malformed.yaml': [
      'version: 1',
      'name: malformed',
      'description: Malformed workflow fixture.',
      'required_roles: [implementer]',
      'initial_steps: {}',
      'review_loop:',
      '  review_steps: []',
      '  remediation_steps: []',
      '  max_cycles: 3',
      '  hard_max_cycles: 5',
      '  blocking_severities: [P0, P1, P2]',
      '  non_blocking_severities: [P3]',
      '  on_limit: { state: HUMAN_INTERVENTION_REQUIRED, action: request_human_decision }',
      'completion: { success_state: READY_FOR_HUMAN_REVIEW }',
    ].join('\n'),
  });

  const result = await validateRepository(root);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some(({ code }) => code === 'workflow-schema'));
});

test('does not publish schema-invalid workflows for profile resolution', async () => {
  const root = await makeRepository({
    'schemas/workflow.schema.json': await readFile(new URL('../schemas/workflow.schema.json', import.meta.url), 'utf8'),
    'schemas/profile.schema.json': await readFile(new URL('../schemas/profile.schema.json', import.meta.url), 'utf8'),
    'workflows/structurally-invalid.yaml': [
      'version: 1',
      'name: structurally-invalid',
      'description: Missing required roles and review loop.',
      'initial_steps:',
      '  - { id: implement, skill: implement-feature, role: implementer }',
      'completion: { success_state: READY_FOR_HUMAN_REVIEW }',
    ].join('\n'),
    'profiles/examples/references-invalid.yaml': [
      'version: 1',
      'project: invalid-workflow-reference',
      'workflow: structurally-invalid',
      'agents:',
      '  implementer: one-agent',
    ].join('\n'),
    'skills/implement-feature/SKILL.md': validSkill('implement-feature'),
  });

  let result;
  await assert.doesNotReject(async () => {
    result = await validateRepository(root);
  });
  assert.ok(result.issues.some(({ code }) => code === 'workflow-schema'));
  assert.ok(result.issues.some(({ code, file }) => code === 'unknown-workflow' && file.endsWith('references-invalid.yaml')));
});

test('allows one agent to fill implementation review and remediation roles', async () => {
  const root = await makeCompleteWorkflowFixture();
  await mkdir(join(root, 'profiles/examples'), { recursive: true });
  await writeFile(
    join(root, 'profiles/examples/self-review.yaml'),
    [
      'version: 1',
      'project: self-review-project',
      'workflow: implement-review-fix',
      'agents:',
      '  implementer: one-agent',
      '  reviewer: one-agent',
      '  fixer: one-agent',
    ].join('\n'),
    'utf8',
  );

  const result = await validateRepository(root);
  assert.equal(result.valid, true, result.issues.map(({ message }) => message).join('\n'));
});

test('rejects profiles with missing roles and excessive cycles', async () => {
  const root = await makeCompleteWorkflowFixture();
  await mkdir(join(root, 'profiles/examples'), { recursive: true });
  await writeFile(
    join(root, 'profiles/examples/broken.yaml'),
    [
      'version: 1',
      'project: broken-project',
      'workflow: implement-review-fix',
      'agents:',
      '  implementer: claude',
      '  reviewer: codex',
      'review_loop:',
      '  max_cycles: 6',
    ].join('\n'),
    'utf8',
  );

  const result = await validateRepository(root);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some(({ code }) => code === 'profile-schema'));
  assert.ok(result.issues.some(({ code, message }) => code === 'missing-role' && message.includes('fixer')));
});

test('rejects whitespace-only agent mappings as schema-invalid and missing', async () => {
  const root = await makeCompleteWorkflowFixture();
  await mkdir(join(root, 'profiles/examples'), { recursive: true });
  await writeFile(
    join(root, 'profiles/examples/whitespace-agent.yaml'),
    [
      'version: 1',
      'project: whitespace-agent-project',
      'workflow: implement-review-fix',
      'agents:',
      '  implementer: one-agent',
      '  reviewer: one-agent',
      "  fixer: '   '",
    ].join('\n'),
    'utf8',
  );

  const result = await validateRepository(root);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some(({ code }) => code === 'profile-schema'));
  assert.ok(result.issues.some(({ code, message }) => code === 'missing-role' && message.includes('fixer')));
});

test('reports skill-contract when a baseline skill omits the production safety boundary', async () => {
  const files = baselineSkillFiles();
  files['skills/implement-feature/SKILL.md'] = files['skills/implement-feature/SKILL.md'].replace(
    PRODUCTION_SAFETY_BOUNDARY,
    '',
  );
  const root = await makeRepository(files);

  const result = await validateRepository(root, { requireBaseline: true });
  assert.ok(result.issues.some(({ code, file, message }) => (
    code === 'skill-contract'
      && file === 'skills/implement-feature/SKILL.md'
      && message.includes(PRODUCTION_SAFETY_BOUNDARY)
  )));
});

test('reports skill-contract when a review severity meaning is changed', async () => {
  const files = baselineSkillFiles();
  files['skills/code-review/SKILL.md'] = files['skills/code-review/SKILL.md'].replace(
    REVIEW_SEVERITY_DEFINITIONS[2],
    '- P2: optional maintainability suggestion.',
  );
  const root = await makeRepository(files);

  const result = await validateRepository(root, { requireBaseline: true });
  assert.ok(result.issues.some(({ code, file, message }) => (
    code === 'skill-contract'
      && file === 'skills/code-review/SKILL.md'
      && message.includes(REVIEW_SEVERITY_DEFINITIONS[2])
  )));
});

test('reports skill-contract when a review verdict contradicts blocking findings', async () => {
  const files = baselineSkillFiles();
  files['skills/security-review/SKILL.md'] = files['skills/security-review/SKILL.md'].replace(
    REVIEW_VERDICT_RULES[0],
    'Return `VERDICT: PASS` whenever any P0, P1, or P2 finding exists.',
  );
  const root = await makeRepository(files);

  const result = await validateRepository(root, { requireBaseline: true });
  assert.ok(result.issues.some(({ code, file, message }) => (
    code === 'skill-contract'
      && file === 'skills/security-review/SKILL.md'
      && message.includes(REVIEW_VERDICT_RULES[0])
  )));
});

test('baseline skills expose the required workflow contracts', async () => {
  const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
  const result = await validateRepository(repositoryRoot, { requireBaseline: true });
  assert.equal(result.valid, true, result.issues.map(({ message }) => message).join('\n'));
});

test('reports broken relative Markdown links', async () => {
  const root = await makeRepository({
    'README.md': '# Links\n\n[Missing](docs/missing.md)\n',
  });

  const result = await validateRepository(root);
  assert.deepEqual(result.issues.map(({ code }) => code), ['broken-link']);
});

test('accepts existing local links anchors and web links', async () => {
  const root = await makeRepository({
    'README.md': [
      '# Links',
      '',
      '[Guide](docs/guide.md)',
      '[Section](#links)',
      '[Web](https://agentskills.io)',
    ].join('\n'),
    'docs/guide.md': '# Guide\n',
  });

  const result = await validateRepository(root);
  assert.equal(result.valid, true, result.issues.map(({ message }) => message).join('\n'));
});

test('ignores Markdown links inside tilde-fenced code blocks', async () => {
  const root = await makeRepository({
    'README.md': [
      '# Links',
      '',
      '~~~text',
      '[Missing](docs/missing.md)',
      '~~~',
    ].join('\n'),
  });

  const result = await validateRepository(root);
  assert.equal(result.valid, true, result.issues.map(({ message }) => message).join('\n'));
});

test('ignores Markdown links inside multi-backtick inline code spans', async () => {
  const root = await makeRepository({
    'README.md': '# Links\n\n``[Missing](docs/missing.md)``\n',
  });

  const result = await validateRepository(root);
  assert.equal(result.valid, true, result.issues.map(({ message }) => message).join('\n'));
});
