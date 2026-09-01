import { access, readdir, readFile } from 'node:fs/promises';
import { dirname, resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';
import YAML from 'yaml';

const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SKILL_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1024;
const MAX_SKILL_LINES = 500;
const PRODUCTION_SAFETY_BOUNDARY = 'Never merge, deploy, publish, or modify production infrastructure.';
const BASELINE_SKILLS = [
  'architecture-review',
  'bug-investigation',
  'code-review',
  'final-verification',
  'fix-review-findings',
  'implement-feature',
  'security-review',
];
const SKILL_CONTRACTS = new Map([
  ['architecture-review', ['SEVERITY:', 'LOCATION:', 'PROBLEM:', 'IMPACT:', 'EVIDENCE:', 'SUGGESTED_DIRECTION:', 'VERDICT: PASS', 'VERDICT: CHANGES_REQUIRED']],
  ['code-review', ['SEVERITY:', 'LOCATION:', 'PROBLEM:', 'IMPACT:', 'EVIDENCE:', 'SUGGESTED_DIRECTION:', 'VERDICT: PASS', 'VERDICT: CHANGES_REQUIRED']],
  ['security-review', ['SEVERITY:', 'LOCATION:', 'PROBLEM:', 'IMPACT:', 'EVIDENCE:', 'SUGGESTED_DIRECTION:', 'VERDICT: PASS', 'VERDICT: CHANGES_REQUIRED']],
  ['final-verification', ['VERIFICATION: PASS', 'VERIFICATION: FAIL', 'VERIFICATION: BLOCKED']],
  ['fix-review-findings', ['FIXED', 'REJECTED', 'BLOCKED']],
]);
const REVIEW_SKILLS = new Set(['architecture-review', 'code-review', 'security-review']);
const REVIEW_CONTRACT_STATEMENTS = [
  '- P0: catastrophic behavior, serious security vulnerability, corruption, or data loss.',
  '- P1: definite significant bug or major regression.',
  '- P2: real bug, meaningful edge case, or meaningful engineering risk.',
  '- P3: non-blocking improvement.',
  'Return `VERDICT: CHANGES_REQUIRED` whenever any P0, P1, or P2 finding exists.',
  'Return `VERDICT: PASS` otherwise.',
];

function issue(code, file, message) {
  return { code, file, message };
}

function parseFrontmatter(content, file) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    return { data: null, issues: [issue('frontmatter', file, 'Missing YAML frontmatter.')] };
  }

  try {
    const data = YAML.parse(match[1]);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { data: null, issues: [issue('frontmatter', file, 'Frontmatter must be a YAML mapping.')] };
    }
    return { data, issues: [] };
  } catch (error) {
    return { data: null, issues: [issue('frontmatter', file, error.message)] };
  }
}

async function validateSkills(rootDir) {
  const skillRoot = join(rootDir, 'skills');
  let entries;
  try {
    entries = await readdir(skillRoot, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return { issues: [], skillNames: new Set(), skillContents: new Map() };
    throw error;
  }

  const issues = [];
  const skillContents = new Map();
  const skillEntries = entries.filter((candidate) => candidate.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
  const skillNames = new Set(skillEntries.map((entry) => entry.name));
  for (const entry of skillEntries) {
    const absoluteFile = join(skillRoot, entry.name, 'SKILL.md');
    const displayFile = relative(rootDir, absoluteFile);
    let content;
    try {
      content = await readFile(absoluteFile, 'utf8');
    } catch (error) {
      issues.push(issue('skill-file', displayFile, 'Missing SKILL.md.'));
      continue;
    }
    skillContents.set(entry.name, content);

    const parsed = parseFrontmatter(content, displayFile);
    issues.push(...parsed.issues);
    if (!parsed.data) continue;

    const { name, description } = parsed.data;
    if (typeof description !== 'string' || description.trim().length === 0 || description.length > MAX_DESCRIPTION_LENGTH) {
      issues.push(issue('skill-description', displayFile, 'Description must contain 1-1024 characters.'));
    }
    if (typeof name !== 'string' || name !== entry.name || name.length > MAX_SKILL_NAME_LENGTH || !SKILL_NAME.test(name)) {
      issues.push(issue('skill-name', displayFile, 'Name must match the directory and use lowercase hyphenated form.'));
    }
    if (content.split(/\r?\n/).length > MAX_SKILL_LINES) {
      issues.push(issue('skill-size', displayFile, 'SKILL.md must not exceed 500 lines.'));
    }
  }
  return { issues, skillNames, skillContents };
}

async function loadJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function loadYamlFiles(rootDir, directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  return Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.yaml'))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(async (entry) => {
        const absoluteFile = join(directory, entry.name);
        const file = relative(rootDir, absoluteFile);
        try {
          return { absoluteFile, file, data: YAML.parse(await readFile(absoluteFile, 'utf8')), parseError: null };
        } catch (error) {
          return { absoluteFile, file, data: null, parseError: error.message };
        }
      }),
  );
}

function compileSchema(schema) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  return ajv.compile(schema);
}

async function validateWorkflows({ rootDir, skillNames }) {
  const workflowDir = join(rootDir, 'workflows');
  const files = await loadYamlFiles(rootDir, workflowDir);
  if (files.length === 0) return { issues: [], workflows: new Map() };

  const validate = compileSchema(await loadJson(join(rootDir, 'schemas/workflow.schema.json')));
  const issues = [];
  const workflows = new Map();

  for (const file of files) {
    if (file.parseError) {
      issues.push(issue('workflow-schema', file.file, file.parseError));
      continue;
    }
    const schemaValid = validate(file.data);
    if (!schemaValid) {
      for (const error of validate.errors ?? []) {
        issues.push(issue('workflow-schema', file.file, `${error.instancePath || '/'} ${error.message}`));
      }
    }
    if (!file.data || typeof file.data !== 'object' || Array.isArray(file.data)) continue;

    const reviewLoop = file.data.review_loop && typeof file.data.review_loop === 'object' && !Array.isArray(file.data.review_loop)
      ? file.data.review_loop
      : {};
    const requiredRoles = Array.isArray(file.data.required_roles) ? file.data.required_roles : [];
    const steps = [file.data.initial_steps, reviewLoop.review_steps, reviewLoop.remediation_steps]
      .flatMap((collection) => Array.isArray(collection) ? collection : [])
      .filter((step) => step && typeof step === 'object' && !Array.isArray(step));
    const seenStepIds = new Set();
    for (const step of steps) {
      if (seenStepIds.has(step.id)) issues.push(issue('duplicate-step', file.file, `Duplicate step id: ${step.id}`));
      seenStepIds.add(step.id);
      if (!skillNames.has(step.skill)) issues.push(issue('unknown-skill', file.file, `Unknown skill: ${step.skill}`));
      if (!requiredRoles.includes(step.role)) issues.push(issue('missing-role', file.file, `Step role is not declared: ${step.role}`));
    }
    for (const role of requiredRoles) {
      if (!steps.some((step) => step.role === role)) issues.push(issue('missing-role', file.file, `Required role is unused: ${role}`));
    }
    if (reviewLoop.max_cycles > reviewLoop.hard_max_cycles) {
      issues.push(issue('cycle-policy', file.file, 'max_cycles cannot exceed hard_max_cycles.'));
    }
    if (schemaValid) workflows.set(file.data.name, file.data);
  }

  return { issues, workflows };
}

async function validateProfiles({ rootDir, workflows }) {
  const files = await loadYamlFiles(rootDir, join(rootDir, 'profiles/examples'));
  if (files.length === 0) return [];

  const validate = compileSchema(await loadJson(join(rootDir, 'schemas/profile.schema.json')));
  const issues = [];
  for (const file of files) {
    if (file.parseError) {
      issues.push(issue('profile-schema', file.file, file.parseError));
      continue;
    }
    if (!validate(file.data)) {
      for (const error of validate.errors ?? []) {
        issues.push(issue('profile-schema', file.file, `${error.instancePath || '/'} ${error.message}`));
      }
    }
    if (!file.data || typeof file.data !== 'object' || Array.isArray(file.data)) continue;

    const workflow = workflows.get(file.data.workflow);
    const requiredRoles = Array.isArray(workflow?.required_roles) ? workflow.required_roles : null;
    const workflowReviewLoop = workflow?.review_loop && typeof workflow.review_loop === 'object' && !Array.isArray(workflow.review_loop)
      ? workflow.review_loop
      : null;
    if (!workflow || !requiredRoles || !workflowReviewLoop) {
      issues.push(issue('unknown-workflow', file.file, `Unknown workflow: ${file.data.workflow}`));
      continue;
    }
    for (const role of requiredRoles) {
      const agent = file.data.agents?.[role];
      if (typeof agent !== 'string' || agent.trim().length === 0) {
        issues.push(issue('missing-role', file.file, `Missing agent mapping: ${role}`));
      }
    }
    const effectiveLimit = file.data.review_loop?.max_cycles ?? workflowReviewLoop.max_cycles;
    if (effectiveLimit > workflowReviewLoop.hard_max_cycles) {
      issues.push(issue('cycle-policy', file.file, 'Profile max_cycles exceeds the workflow hard maximum.'));
    }
  }
  return issues;
}

async function walkMarkdown(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const destination = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walkMarkdown(destination));
    if (entry.isFile() && entry.name.endsWith('.md')) files.push(destination);
  }
  return files;
}

async function validateMarkdownLinks(rootDir) {
  const roots = [join(rootDir, 'README.md'), join(rootDir, 'skills'), join(rootDir, 'adapters'), join(rootDir, 'docs')];
  const markdownFiles = [];
  for (const candidate of roots) {
    if (candidate.endsWith('.md')) {
      try {
        await access(candidate);
        markdownFiles.push(candidate);
      } catch {}
    } else {
      markdownFiles.push(...await walkMarkdown(candidate));
    }
  }

  const issues = [];
  const linkPattern = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  for (const absoluteFile of markdownFiles) {
    const content = await readFile(absoluteFile, 'utf8');
    const prose = content
      .replace(/(^|\n)(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\2[ \t]*(?=\n|$)/g, '$1')
      .replace(/(`+)[^\n]*?\1/g, '');
    for (const match of prose.matchAll(linkPattern)) {
      const destination = match[1];
      if (/^(?:https?:|mailto:|#)/i.test(destination)) continue;
      const decoded = decodeURIComponent(destination.split('#', 1)[0]);
      const target = resolve(dirname(absoluteFile), decoded);
      try {
        await access(target);
      } catch {
        issues.push(issue('broken-link', relative(rootDir, absoluteFile), `Missing link target: ${destination}`));
      }
    }
  }
  return issues;
}

export async function validateRepository(rootDir, { requireBaseline = false } = {}) {
  const resolvedRoot = resolve(rootDir);
  const skillResult = await validateSkills(resolvedRoot);
  const workflowResult = await validateWorkflows({ rootDir: resolvedRoot, skillNames: skillResult.skillNames });
  const profileIssues = await validateProfiles({ rootDir: resolvedRoot, workflows: workflowResult.workflows });
  const markdownLinkIssues = await validateMarkdownLinks(resolvedRoot);
  const issues = [...skillResult.issues, ...workflowResult.issues, ...profileIssues, ...markdownLinkIssues];

  if (requireBaseline) {
    for (const name of BASELINE_SKILLS) {
      if (!skillResult.skillNames.has(name)) issues.push(issue('missing-skill', 'skills', `Missing baseline skill: ${name}`));
    }
  }
  for (const [name, content] of skillResult.skillContents) {
    if (/\b(?:claude|codex|orca)\b/i.test(content)) {
      issues.push(issue('provider-leakage', `skills/${name}/SKILL.md`, 'Generic skill contains a provider name.'));
    }
    if (requireBaseline) {
      const contractStatements = new Set(content.split(/\r?\n/).map((line) => line.trim().replace(/^\d+\.\s+/, '')));
      if (BASELINE_SKILLS.includes(name) && !contractStatements.has(PRODUCTION_SAFETY_BOUNDARY)) {
        issues.push(issue('skill-contract', `skills/${name}/SKILL.md`, `Missing contract statement: ${PRODUCTION_SAFETY_BOUNDARY}`));
      }
      for (const marker of SKILL_CONTRACTS.get(name) ?? []) {
        if (!content.includes(marker)) issues.push(issue('skill-contract', `skills/${name}/SKILL.md`, `Missing contract marker: ${marker}`));
      }
      if (REVIEW_SKILLS.has(name)) {
        for (const statement of REVIEW_CONTRACT_STATEMENTS) {
          if (!contractStatements.has(statement)) {
            issues.push(issue('skill-contract', `skills/${name}/SKILL.md`, `Missing contract statement: ${statement}`));
          }
        }
      }
    }
  }

  issues.sort((left, right) => `${left.file}:${left.code}:${left.message}`.localeCompare(`${right.file}:${right.code}:${right.message}`));
  return { valid: issues.length === 0, issues };
}

export function formatIssues(issues) {
  return issues.map(({ code, file, message }) => `${file} [${code}] ${message}`).join('\n');
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = await validateRepository(process.cwd(), { requireBaseline: true });
  if (!result.valid) {
    console.error(formatIssues(result.issues));
    process.exitCode = 1;
  }
}
