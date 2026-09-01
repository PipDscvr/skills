import { readdir, readFile } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import YAML from 'yaml';

const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SKILL_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1024;
const MAX_SKILL_LINES = 500;

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
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  const issues = [];
  for (const entry of entries.filter((candidate) => candidate.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const absoluteFile = join(skillRoot, entry.name, 'SKILL.md');
    const displayFile = relative(rootDir, absoluteFile);
    let content;
    try {
      content = await readFile(absoluteFile, 'utf8');
    } catch (error) {
      issues.push(issue('skill-file', displayFile, 'Missing SKILL.md.'));
      continue;
    }

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
  return issues;
}

export async function validateRepository(rootDir) {
  const issues = await validateSkills(resolve(rootDir));
  issues.sort((left, right) => `${left.file}:${left.code}`.localeCompare(`${right.file}:${right.code}`));
  return { valid: issues.length === 0, issues };
}

export function formatIssues(issues) {
  return issues.map(({ code, file, message }) => `${file} [${code}] ${message}`).join('\n');
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = await validateRepository(process.cwd());
  if (!result.valid) {
    console.error(formatIssues(result.issues));
    process.exitCode = 1;
  }
}
