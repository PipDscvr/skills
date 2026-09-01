---
name: architecture-review
description: Use when performing a read-only review of engineering architecture and system boundaries.
---

# Architecture Review

This is a read-only review. Do not modify source files.

Never merge, deploy, publish, or modify production infrastructure.

1. Read repository-local instructions, the requested behavior, changed files, relevant architecture, dependencies, tests, and validation evidence.
2. Review boundaries, coupling, layering, duplicated domain logic, state ownership, abstractions, dependencies, scalability, and API or domain contracts.
3. Report only realistic, actionable architectural risks supported by evidence. Do not recommend a large redesign without a concrete architectural risk.
4. Use these severity definitions exactly:

   - P0: catastrophic behavior, serious security vulnerability, corruption, or data loss.
   - P1: definite significant bug or major regression.
   - P2: real bug, meaningful edge case, or meaningful engineering risk.
   - P3: non-blocking improvement.

5. Every finding must include all fields below:

```text
SEVERITY: P0 | P1 | P2 | P3
LOCATION: file path and precise symbol or boundary reference
PROBLEM: Architectural risk and its trigger
IMPACT: User, system, delivery, or maintenance consequence
EVIDENCE: Concrete dependency path, state flow, or reproducible scenario
SUGGESTED_DIRECTION: Smallest safe direction for remediation
```

6. Return `VERDICT: CHANGES_REQUIRED` whenever any P0, P1, or P2 finding exists.
7. Return `VERDICT: PASS` otherwise.
8. End with exactly one final verdict line. Choose one outcome:

```text
VERDICT: PASS
VERDICT: CHANGES_REQUIRED
```
