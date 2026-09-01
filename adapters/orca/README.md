# Orca workflow mapping guide

Orca does not natively execute this repository's workflow YAML files. This document is a mapping guide for a coordinator translating the validated workflow and project-profile contracts into Orca's current primitives; it is not a native YAML executor.

Before using an Orca command, inspect the installed runtime and command help rather than assuming flags from another version:

```bash
orca status --json
orca orchestration --help
orca orchestration gate-create --help
```

The status payload exposes the running app version. At the time this guide was verified, the installed runtime reported version 1.4.193. Command-specific help is the authority for the available syntax.

## Concept mapping

| Workflow concept | Orca primitive and coordinator responsibility |
| --- | --- |
| Roles and profile agent mappings | Selected terminals or supervised workers for the configured agents |
| Initial, review, and remediation steps | Dispatched tasks whose prompt/context names the assigned skill and step |
| Review and verification results | Structured orchestration messages using the finding, verdict, and verification contracts |
| Cycle metadata | Explicit coordinator state recording completed cycles, effective limit, findings, and validation outcome |
| `HUMAN_INTERVENTION_REQUIRED` | A decision gate created for the blocked task |
| Success | Reported `READY_FOR_HUMAN_REVIEW` state after required verification and reviews pass |

## Coordinator sequence

The coordinator follows the workflow's nine execution steps:

1. Load and validate the selected workflow and project profile.
2. Resolve every semantic role to the configured agent.
3. Confirm each referenced skill is available to the assigned agent.
4. Dispatch the initial implementation and deterministic verification steps.
5. Stop with a failure or blocked state when verification cannot pass.
6. Dispatch every review step and aggregate its findings in structured messages.
7. If no P0/P1/P2 findings remain, report `READY_FOR_HUMAN_REVIEW` and preserve P3 suggestions.
8. If blocking findings remain below the effective soft limit, dispatch remediation, verify again, and start the next review cycle.
9. If blocking findings remain at the soft limit, stop dispatching agents and create the human-intervention decision gate.

The coordinator maintains the cycle state; Orca does not infer it from the YAML. It should retain the selected workflow/profile, role-to-worker mapping, task/dispatch identifiers, every reviewer result, fixer response, and deterministic validation evidence in the orchestration record.

## Human decision gate

At the soft limit, create a decision gate for the blocked task. Its question/payload must include:

- Completed and remaining cycle counts, including the immutable five-cycle hard ceiling.
- Every unresolved finding and severity.
- Reviewer evidence.
- Fixer responses, including explanations for disputed or rejected findings.
- Latest deterministic validation results.
- Files changed during remediation.
- Recurring disagreements or findings that survived multiple cycles.

Offer exactly these four decisions:

1. Authorize exactly one additional cycle, only when fewer than five cycles have run.
2. Change the reviewer, fixer, or requirements before continuing.
3. Accept the documented risk and move the work to human review.
4. Stop or abandon the workflow.

One additional cycle requires one gate resolution; after that cycle, a new gate resolution is required for any further cycle. The counter never resets when an agent mapping changes. A timeout or absent human response never resumes execution. Cycle five cannot be extended; after it, the human must accept the risk, start a new run for materially changed requirements, or stop.

Changing requirements materially starts a new workflow run with a fresh counter. Changing only the reviewer or fixer stays in the current run and preserves the completed-cycle count.

## Safety boundary

This adapter maps work to existing Orca coordination primitives only. It does not merge, deploy, publish, or modify production infrastructure. It also does not silently substitute an unavailable agent, treat a timeout as approval, or claim that a YAML file itself schedules work.
