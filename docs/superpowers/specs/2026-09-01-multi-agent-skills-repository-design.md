# Multi-Agent Skills Repository Design

**Status:** Approved in conversation on 2026-09-01

**Repository:** `PipDscvr/skills`

**Scope:** Initial portable skills, declarative workflow contracts, example project profiles, validation, and documentation

## Summary

This repository will be a small, provider-neutral foundation for reusable software-engineering skills. It separates three concerns:

1. Skills define **what engineering work should be done**.
2. Workflow roles define **which responsibility is needed**.
3. Project profiles define **which agent fills each role**.

The same `implement-review-fix` workflow can therefore use Claude for every role in one project and Claude plus Codex in another without changing or duplicating any skill.

The repository will use the existing Agent Skills ecosystem and the existing `skills` CLI for installation. It will not build a custom installer or a custom orchestration engine. Orca-specific execution guidance will live in an adapter document outside the generic skills.

## Goals

- Publish seven focused, reusable engineering skills that follow the Agent Skills directory and `SKILL.md` conventions.
- Keep generic skill instructions independent of providers, programming languages, frameworks, package managers, and test runners.
- Compose skills through semantic workflow roles rather than provider names.
- Let each project map those roles to Claude, Codex, or another compatible agent.
- Bound all automated review/fix loops and require an explicit human decision when their configured limit is reached.
- Use the existing `skills` CLI to list, selectively install, update, and remove skills.
- Provide machine validation for skill metadata, workflow/profile contracts, references, and portability rules.
- Document what Orca can coordinate today without implying that the repository contains an orchestration engine.

## Non-Goals

The first version will not:

- Build a custom installation or synchronization CLI.
- Build a workflow runtime or scheduler.
- Duplicate generic skills for Claude, Codex, or Orca.
- Create provider plugin manifests.
- Create framework-specific skill packs.
- Automatically merge, deploy, publish, or modify production infrastructure.
- Automatically substitute a different agent when a configured agent is unavailable.
- Make an acceptance decision on behalf of a human after a review loop reaches its limit.

## Research Conclusions

- The portable Agent Skills unit is a directory containing a required `SKILL.md`. Optional supporting resources may be added later when a skill needs them.
- Claude Code and Codex can both discover Agent Skills, but their project and user discovery locations differ. The `skills` CLI handles selecting target agents and installing the chosen skills into the appropriate locations.
- The `skills` CLI can list skills in a repository, install one or several selected skills, target `claude-code` and/or `codex`, install globally or per project, and later update or remove them.
- Orca provides orchestration primitives and a decision-gate mechanism, but it does not currently execute the proposed workflow YAML as a native declarative workflow file. The Orca adapter will document the mapping instead of presenting the YAML as executable by itself.

## Considered Approaches

### 1. Existing skills CLI plus declarative workflow contracts — selected

Keep every installable skill in the standard directory format, use the existing CLI for installation, and store provider-neutral workflow/profile YAML for composition. Add schemas and a small repository validator. Document how Orca maps those contracts to its orchestration primitives.

This is the smallest approach that preserves portability, selective installation, explicit agent assignment, and future extensibility.

### 2. Repository-specific installation CLI — rejected

A custom CLI could install workflows and profiles as well as skills, but it would duplicate capabilities already available in the `skills` CLI and create a second package to maintain. It would also risk coupling repository conventions to a home-grown distribution mechanism.

### 3. Provider-specific skill trees — rejected

Separate Claude and Codex copies would make installation obvious but would duplicate behavior and invite drift. Provider choice belongs in project profiles, not in generic skill content.

## Repository Structure

```text
.
├── .github/
│   └── workflows/
│       └── validate.yml
├── adapters/
│   └── orca/
│       └── README.md
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-09-01-multi-agent-skills-repository-design.md
├── profiles/
│   └── examples/
│       ├── claude-codex-review.yaml
│       ├── claude-codex-security.yaml
│       └── gst-ui-admin-portal.yaml
├── schemas/
│   ├── profile.schema.json
│   └── workflow.schema.json
├── scripts/
│   └── validate.mjs
├── skills/
│   ├── architecture-review/
│   │   └── SKILL.md
│   ├── bug-investigation/
│   │   └── SKILL.md
│   ├── code-review/
│   │   └── SKILL.md
│   ├── final-verification/
│   │   └── SKILL.md
│   ├── fix-review-findings/
│   │   └── SKILL.md
│   ├── implement-feature/
│   │   └── SKILL.md
│   └── security-review/
│       └── SKILL.md
├── test/
│   └── validate.test.mjs
├── workflows/
│   ├── implement-review-fix.yaml
│   └── implement-review-security.yaml
├── README.md
├── package-lock.json
└── package.json
```

The Node package is repository-maintenance tooling only. Installing or using a skill will not require the consuming project to use Node or npm.

## Component Boundaries

### Skills

Each directory under `skills/` is independently installable. Its `SKILL.md` describes activation criteria, responsibilities, method, safety constraints, and output contract. Generic skills must not mention a particular agent as the required executor.

Skills inspect and follow the consuming repository's own instructions and tooling. Relevant files may include `AGENTS.md`, `CLAUDE.md`, `README` files, manifests, lockfiles, build configuration, lint configuration, and test configuration. Repository-specific instructions take precedence over generic defaults.

### Workflows

Files under `workflows/` compose skills through semantic roles and define review-loop behavior. They do not name Claude, Codex, or Orca and are not executable programs.

### Profiles

Files under `profiles/examples/` show how a consuming project selects a workflow and maps every required role to an agent identifier. A consuming repository may keep an adapted profile at `.agents/workflow-profile.yaml`; that location is a documented convention for this repository, not a claim of native discovery by every agent tool.

### Schemas and validator

JSON Schemas define the supported workflow and profile data contracts. `scripts/validate.mjs` performs schema validation plus repository-wide checks that JSON Schema alone cannot express.

### Orca adapter

`adapters/orca/README.md` translates the provider-neutral concepts into current Orca commands and human-gate behavior. It contains no generic skill logic and no executable orchestration engine.

## Skill Contract

Every `SKILL.md` will:

- Use valid frontmatter with a lowercase hyphenated `name` matching its parent directory and a non-empty `description` that explains when to use it.
- Read repository instructions and determine the relevant tooling before acting.
- Stay provider-, framework-, language-, package-manager-, and test-runner-neutral.
- Limit changes to the requested work and avoid unrelated refactoring.
- Report evidence, validation performed, remaining risks, and the recommended next action.
- Never merge, deploy, publish, or change production infrastructure.

The initial skills have these boundaries:

### `implement-feature`

A mutating skill that inspects the existing design, plans to the degree warranted, implements the smallest correct change, adds or updates tests where appropriate, runs relevant checks, and reports changed files and validation evidence. Writing code alone is never sufficient evidence of success.

### `code-review`

A read-only, adversarial but practical review of correctness, regressions, edge cases, concurrency, state and data flow, API contracts, security, authorization, validation, error handling, type safety, performance, accessibility, maintainability risks, and test coverage. It ignores formatting preferences, lint-managed style, speculative problems, and preference-driven rewrites.

It ends with exactly one of:

```text
VERDICT: PASS
VERDICT: CHANGES_REQUIRED
```

### `fix-review-findings`

A mutating remediation skill that verifies findings rather than accepting them blindly, fixes valid P0/P1/P2 findings, explains technically invalid or inapplicable findings, avoids unrelated changes, and reruns appropriate verification.

### `final-verification`

A normally read-only verification skill. It discovers the consuming repository's deterministic checks and runs the relevant tests, targeted tests, lint, type checks, builds, and formatting checks. Normal generated test/build artifacts are permitted; source changes are not. It ends with exactly one of:

```text
VERIFICATION: PASS
VERIFICATION: FAIL
VERIFICATION: BLOCKED
```

### `bug-investigation`

A mutating debugging skill that reproduces the problem, gathers evidence, identifies the root cause rather than a symptom, implements the smallest justified fix, adds regression coverage, and verifies the result. It does not begin speculative code changes before forming an evidence-based diagnosis.

### `architecture-review`

A read-only review of boundaries, coupling, layering, duplicated domain logic, state ownership, abstractions, dependencies, scalability, and API/domain contracts. It proposes substantial redesign only when a concrete architectural risk justifies it.

### `security-review`

A read-only, evidence-based review of authentication, authorization, trust boundaries, injection, unsafe input, sensitive data, secrets, XSS, CSRF, SSRF, access control, insecure defaults, and relevant dependency risks.

All three review skills use the shared finding and verdict contract so they can participate in the same workflow.

## Review Finding Contract

Every finding uses:

```text
SEVERITY: P0 | P1 | P2 | P3
LOCATION: <file and the narrowest practical line or symbol>
PROBLEM: <what is wrong>
IMPACT: <realistic consequence>
EVIDENCE: <why the conclusion is justified>
SUGGESTED_DIRECTION: <a correction direction, not an unsolicited rewrite>
```

Severity semantics are:

- **P0:** catastrophic behavior, serious security vulnerability, corruption, or data loss.
- **P1:** definite significant bug or major regression.
- **P2:** real bug, meaningful edge case, or meaningful engineering risk.
- **P3:** non-blocking improvement.

P0, P1, and P2 findings require `VERDICT: CHANGES_REQUIRED`. A review with no P0/P1/P2 findings must return `VERDICT: PASS`; P3 findings do not block completion. Reviewers report findings but never modify the implementation under review.

## Workflow Contract

A workflow declares its required roles, initial steps, review steps, remediation steps, limits, and completion state. Version 1 uses a deliberately narrow schema:

```yaml
version: 1
name: implement-review-fix
description: Implement, verify, review, and remediate blocking findings.

required_roles:
  - implementer
  - reviewer
  - fixer

initial_steps:
  - id: implement
    skill: implement-feature
    role: implementer
  - id: verify
    skill: final-verification
    role: implementer

review_loop:
  review_steps:
    - id: code-review
      skill: code-review
      role: reviewer
  remediation_steps:
    - id: fix
      skill: fix-review-findings
      role: fixer
    - id: verify-after-fix
      skill: final-verification
      role: fixer
  max_cycles: 3
  hard_max_cycles: 5
  blocking_severities: [P0, P1, P2]
  non_blocking_severities: [P3]
  on_limit:
    state: HUMAN_INTERVENTION_REQUIRED
    action: request_human_decision

completion:
  success_state: READY_FOR_HUMAN_REVIEW
```

A review cycle means one complete execution of every `review_step`. If any review step reports blocking findings, the remediation steps run in order and the next review cycle begins. Verification must pass before the next review cycle. The workflow succeeds only when verification passes and every review step reports no blocking findings.

`implement-review-security.yaml` adds the `security_reviewer` role and a `security-review` review step. It otherwise uses the same loop contract. Multiple review steps produce one aggregated set of findings for remediation.

The schemas only permit the semantic roles used by the initial workflows: `implementer`, `reviewer`, `fixer`, `security_reviewer`, and `architecture_reviewer`. Adding another role is an intentional schema change. Skill and step identifiers remain provider-neutral.

## Project Profile Contract

A profile selects a workflow, maps every required role, and may lower or raise the soft review limit within the workflow's hard ceiling:

```yaml
version: 1
project: another-project
workflow: implement-review-fix

agents:
  implementer: claude
  reviewer: codex
  fixer: claude

review_loop:
  max_cycles: 3
```

Rules:

- Every role required by the selected workflow must have one non-empty agent identifier.
- The same agent may intentionally fill multiple roles, including self-review configurations.
- Extra mappings are allowed only for recognized semantic roles so a profile can prepare for a compatible extended workflow without accepting arbitrary misspellings.
- `review_loop.max_cycles` is optional and defaults to the workflow value.
- The effective soft limit must be between 1 and 5 and cannot exceed `hard_max_cycles`.
- A missing role, workflow, skill, or agent mapping is an error. Runtimes must not silently substitute an agent.

The examples demonstrate:

- `gst-ui-admin-portal.yaml`: Claude as implementer, reviewer, and fixer.
- `claude-codex-review.yaml`: Claude as implementer/fixer and Codex as reviewer.
- `claude-codex-security.yaml`: Claude as implementer/fixer and Codex in the review and security-review roles.

Agent identifiers are profile data only. Their exact runtime meaning is determined by the environment executing the workflow.

## Execution Semantics

An orchestration environment interpreting a workflow and profile performs these steps:

1. Load and validate the selected workflow and project profile.
2. Resolve every semantic role to the configured agent.
3. Confirm that every referenced skill is available to the assigned agent.
4. Run the initial implementation and deterministic verification steps.
5. Stop with a verification failure or block if verification cannot pass.
6. Run every review step and aggregate its findings.
7. If no P0/P1/P2 findings remain, return `READY_FOR_HUMAN_REVIEW` with P3 suggestions preserved.
8. If blocking findings remain below the soft cycle limit, run remediation, verify again, and begin the next review cycle.
9. If blocking findings remain at the soft limit, stop dispatching agents and enter the human-intervention flow.

No successful path merges, deploys, publishes, or otherwise ships the work.

## Review Limits and Human Intervention

The default soft limit is three review cycles. Profiles may configure an effective soft limit from one to five. Five is the immutable hard ceiling for a single workflow run.

When unresolved blocking findings reach the soft limit, the runtime enters:

```text
HUMAN_INTERVENTION_REQUIRED
```

It must stop agent dispatch and present:

- Completed and remaining cycle counts.
- Every unresolved finding and severity.
- Reviewer evidence and the fixer's response to disputed findings.
- The latest deterministic verification result.
- Files changed during remediation.
- Recurring disagreements or findings that survived multiple cycles.

The human can then explicitly choose one of these actions:

1. Authorize exactly one additional cycle, only when fewer than five cycles have run.
2. Change the reviewer, fixer, or requirements before continuing.
3. Accept the documented risk and move the work to human review.
4. Stop or abandon the workflow.

Each additional cycle requires a new explicit authorization. A timeout or missing response never resumes the workflow. Once five cycles have run, the additional-cycle option is unavailable; the human must accept the risk, change the task and begin a new run, or stop.

Every human decision is recorded with its rationale. Changing a reviewer or fixer within the same run does not reset the completed-cycle count. A material requirements change starts a new workflow run with a fresh counter rather than disguising new work as another review cycle.

In Orca, the adapter maps this state to a decision gate. In environments without a gate primitive, the orchestrator asks in the current human conversation and waits for an explicit response.

## Installation and Synchronization

The repository will document the existing CLI instead of adding installer scripts:

```bash
# Inspect the available skills
npx skills add PipDscvr/skills --list

# Choose skills and target agents interactively
npx skills add PipDscvr/skills

# Install selected skills globally for Claude Code and Codex
npx skills add PipDscvr/skills \
  --skill implement-feature code-review \
  --agent claude-code codex \
  --global --yes

# Inspect, update, and remove globally installed skills
npx skills list --global
npx skills update --global
npx skills remove code-review --global
```

Users can install one skill, several skills, or all skills. `--all` is opt-in; it is not required for ordinary installation. Omitting `--global` installs into the current project according to the CLI's supported locations.

Orca is the host and coordinator; it does not eliminate the need for the assigned Claude or Codex agent to discover the selected skills. A user targeting both agents installs the skills for both. The GitHub repository remains the source of truth, and `npx skills update` is the supported update path.

Workflow and profile YAML are composition contracts, not installable Agent Skills. Projects create a small profile selecting their workflow and agent mappings. The README and Orca adapter will explain how to translate that selection into the current orchestration environment.

## Orca Mapping

The Orca adapter documentation will map:

- A profile's agent mapping to the selected Orca terminals or agent workers.
- Initial and remediation steps to dispatched work with the named skill in the prompt/context.
- Review results to structured messages containing the shared finding/verdict contract.
- Loop progress to explicit cycle metadata maintained by the coordinator.
- `HUMAN_INTERVENTION_REQUIRED` to an Orca decision gate.
- Human authorization to gate resolution followed by at most one additional cycle.
- Successful completion to `READY_FOR_HUMAN_REVIEW`, never automatic shipping.

Because Orca does not natively execute these YAML files today, the adapter must label this as a mapping guide. No script will pretend to provide capabilities Orca does not expose.

## Validation

`package.json` will expose one primary command:

```bash
npm test
```

It runs the repository validator and its Node test suite. The validator will use a YAML parser and JSON Schema validator and will check:

- Every `skills/*/SKILL.md` has parseable frontmatter.
- The skill name is lowercase/hyphenated, matches the directory, and has a non-empty description.
- Skill files stay within the Agent Skills size guidance.
- Workflow and profile YAML conform to their schemas.
- Referenced workflows and skills exist.
- Every example profile maps every role required by its workflow.
- Soft and hard cycle limits satisfy the 1–5 rules.
- The required human-intervention state and action are present.
- Blocking and non-blocking severity lists exactly preserve P0–P2 and P3 semantics.
- Generic skill content does not hardcode Claude, Codex, or Orca. Provider-specific terms remain permitted in profiles, adapter documentation, and user-facing installation documentation.
- Relative Markdown links and referenced local files resolve.

The Node test suite will exercise successful validation and focused failure cases for malformed frontmatter, missing roles, unknown skills, invalid cycle limits, absent human gates, and provider leakage. Tests may construct temporary fixture repositories rather than maintaining a large fixture tree.

The existing CLI discovery command is a documented manual smoke test:

```bash
npx skills add . --list
```

It is not part of `npm test` or CI because repository validation should not depend on network availability or the behavior of a separately released CLI.

`.github/workflows/validate.yml` will run `npm ci` followed by `npm test` on pushes and pull requests.

## Failure Behavior

- Invalid workflow or profile configuration stops before agent work begins and identifies the invalid file and field.
- Missing workflows, roles, skills, mappings, or assigned-agent availability stop with an actionable error.
- Failed or blocked deterministic verification can never produce `READY_FOR_HUMAN_REVIEW`.
- Reviewer output whose verdict conflicts with its blocking findings is invalid and must be corrected or escalated; it must not be treated as a pass.
- Reaching the soft review limit always invokes the human-intervention flow.
- No timeout, missing response, or unavailable agent triggers silent substitution or automatic continuation.

## README Content

The README will include:

- The philosophy: skills define behavior, roles define responsibility, workflows define composition, and profiles select agents.
- A concise repository tree and explanation of each layer.
- Selective terminal installation for Claude Code, Codex, or both.
- The difference between global and project installation.
- Listing, updating, and removing skills.
- The fact that Orca coordinates agents but each target agent still needs the skill installed or discoverable.
- Claude/Claude, Claude/Codex, and Claude/Codex/security profile examples.
- Review severity, bounded-loop, human-intervention, and final-state behavior.
- Instructions for adding a skill, workflow, or profile.
- Repository validation and the manual CLI discovery smoke test.
- Source-of-truth and update guidance.
- Current Orca limitations and a link to the adapter guide.

## Extensibility

Future skill packs may introduce paths such as `skills/typescript/` or `skills/vue/` if the CLI and Agent Skills discovery behavior support nested packaging cleanly at that time. The initial flat set avoids premature hierarchy. A specialized skill remains atomic and composable and must not require editing a generic skill.

New workflows may compose architecture or security review roles. Adding a role requires a schema update, validator tests, adapter documentation, and at least one valid profile example. This makes role vocabulary intentional without tying it to any provider.

## Acceptance Criteria

The implementation is complete when:

- All seven required skills exist and pass repository validation.
- No generic skill hardcodes Claude, Codex, Orca, a framework, or a package manager.
- Both workflows validate and reference only existing skills and semantic roles.
- All three example profiles validate and demonstrate changeable agent assignments.
- Review skills consistently use the severity, finding, and verdict contracts.
- Review loops default to three cycles, cannot exceed five, and always require human intervention at the configured limit.
- P3 findings do not block `READY_FOR_HUMAN_REVIEW`; P0/P1/P2 findings do.
- The Orca adapter honestly documents the current manual/declarative mapping and decision gate.
- README terminal commands cover listing, selective installation, both agents, updating, and removal.
- `npm test` passes and CI runs the same command.
- The original repository prompt and unrelated history remain untouched.

## Key Decisions

- Standard Agent Skills directories are the unit of distribution.
- The existing `skills` CLI is the installer and updater.
- Workflows reference semantic roles, never providers.
- Profiles are the only place where agent assignment occurs.
- Workflow YAML is a validated contract, not a newly invented runtime.
- Three review cycles is the default soft limit; five is the hard ceiling.
- Every soft-limit breach pauses for a recorded human decision.
- `READY_FOR_HUMAN_REVIEW` is the normal successful terminal state.
- Provider-specific guidance is isolated under adapters and documentation.
