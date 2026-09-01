# Reusable Multi-Agent Engineering Skills

This repository is a portable foundation for repeatable engineering work. It publishes seven independently installable Agent Skills, provider-neutral workflow contracts, and project profiles that assign people or agents to workflow roles.

## Philosophy

Skills define **what work to perform**. Roles define **who is responsible**. Workflows define **how those responsibilities compose**. Profiles select the agents that fill each role for a particular project. This keeps implementation and review guidance reusable while allowing one project to use a single agent and another to split work between Claude Code and Codex.

Workflow YAML is a validated composition contract, not a scheduler or executable orchestration engine. The GitHub repository is the source of truth for skills; use the existing `skills` CLI to install and update them.

## Repository layout

```text
skills/                 Seven independently installable Agent Skills
workflows/              Provider-neutral workflow contracts
profiles/examples/      Agent-role assignments for example projects
schemas/                JSON Schemas for workflows and profiles
adapters/orca/          Manual mapping guidance for Orca coordination
docs/superpowers/specs/ Approved design record
scripts/validate.mjs    Repository validator
test/                   Validator tests
```

Generic skills never require a particular provider. Agent assignments appear only in profiles, while the [Orca adapter](adapters/orca/README.md) explains how to map the contracts to Orca today.

## Install skills from the terminal

List the available skills before installing:

```bash
npx skills add PipDscvr/skills --list
```

For an interactive installation, which can select one or several skills and target agents:

```bash
npx skills add PipDscvr/skills
```

For a non-interactive install of selected skills into both Claude Code and Codex:

```bash
npx skills add PipDscvr/skills --skill implement-feature code-review --agent claude-code codex --global --yes
```

`--all` is opt-in. You may install one skill, several skills, or all skills; ordinary installation does not imply every skill. `--global` installs for the selected agent(s) globally. Omitting `--global` targets the current project according to the CLI's supported locations.

Inspect, update, or remove globally installed skills with:

```bash
npx skills list --global
npx skills update --global
npx skills remove code-review --global
```

## How installation works with Orca, Claude Code, and Codex

Orca coordinates terminals and workers; it does not automatically install a selected skill into both Claude Code and Codex. When a workflow assigns work to both, select both agents when installing, as in the terminal example above, and confirm the assigned agents can discover the selected skills. Orca itself is not an alternate skills installer or a native executor of the YAML files.

Use project-local installation when skills belong only to the current repository; use global installation when they should be available across projects for that target agent. The project-local `.agents/workflow-profile.yaml` file is this repository's convention for an adapted profile, not a location universally auto-discovered by every agent tool.

## Compose a workflow

Choose a provider-neutral workflow, then create a profile that selects it and maps every required role to an available agent. The two supplied workflows are [implement-review-fix](workflows/implement-review-fix.yaml) and [implement-review-security](workflows/implement-review-security.yaml).

The initial steps implement and verify the requested work. Every review cycle runs all review steps, aggregates P0/P1/P2 blocking findings, runs remediation and verification when needed, and then begins the next cycle. Successful workflows finish at `READY_FOR_HUMAN_REVIEW`; they never merge, deploy, publish, or change production infrastructure.

## Project profile examples

- [Claude-only admin portal](profiles/examples/gst-ui-admin-portal.yaml) maps Claude to implementer, reviewer, and fixer.
- [Claude implementation with Codex review](profiles/examples/claude-codex-review.yaml) maps Claude to implementation/remediation and Codex to review.
- [Claude implementation with Codex code and security review](profiles/examples/claude-codex-security.yaml) adds the security-reviewer mapping.

Copy the closest example into `.agents/workflow-profile.yaml`, change `project`, and update its agent mappings. A profile is data for the orchestrating environment; it does not silently substitute an unavailable agent.

## Review cycles and human intervention

P0, P1, and P2 findings block completion; P3 findings are preserved as suggestions but do not block `READY_FOR_HUMAN_REVIEW`. Workflows default to three review cycles, may use a project-specific soft limit from one through five, and have an immutable maximum of five cycles.

At the configured soft limit, execution stops at `HUMAN_INTERVENTION_REQUIRED`. A human must explicitly authorize exactly one additional cycle (only below five), change the reviewer, fixer, or requirements, accept the documented risk for human review, or stop/abandon the workflow. Each added cycle requires a new decision. Timeout or missing response never continues the workflow, and changing an agent mapping does not reset the cycle count.

## Add a skill

Create `skills/<lowercase-hyphenated-name>/SKILL.md` with valid YAML frontmatter whose `name` matches the directory and whose `description` explains when to use it. Keep the skill provider-, framework-, language-, package-manager-, and test-runner-neutral. Read the consuming repository's own instructions, keep changes scoped, report evidence and risks, and never merge, deploy, publish, or modify production infrastructure.

Run the repository checks after adding the skill. If a workflow should use it, update that workflow and ensure every referenced role is declared.

## Add a workflow or project profile

Add workflow contracts under `workflows/` using semantic roles and the supported schema. Workflows must reference existing skills, declare every role used by their steps, preserve the P0–P2/P3 severity policy, and configure the required human-intervention state and action.

Add profile examples under `profiles/examples/`, select an existing workflow, and map each required role to a non-empty agent identifier. Adding a new role is an intentional contract change: update schemas, validator tests, adapter documentation, and a valid profile example.

## Validate the repository

Run the complete deterministic validation suite:

```bash
npm test
```

It validates skill metadata, workflow/profile contracts, provider-neutral skills, and relative Markdown links. For a manual discovery smoke test of the separately released CLI, run:

```bash
npx skills add . --list
```

The smoke test is intentionally outside `npm test` and CI because it depends on the released CLI and may require network access.

## Update or remove installed skills

Use `npx skills update --global` to update global installs from the source repository. Use `npx skills remove <skill-name> --global` to remove one global skill. Omit `--global` to operate on the current project's installation when the CLI supports that target. Re-run the list command after changes to confirm the desired installed set.

## Current orchestration boundary

This repository provides portable skills and validated contracts, not a custom installer, workflow runtime, scheduler, or synchronization service. Orca's current role is to coordinate the selected terminals/workers and human gates through the [mapping guide](adapters/orca/README.md); it does not natively execute workflow YAML. Read the [approved design spec](docs/superpowers/specs/2026-09-01-multi-agent-skills-repository-design.md) for the full boundaries, acceptance criteria, and execution semantics.
