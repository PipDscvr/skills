---
name: code-review
description: Use when performing a read-only review of an engineering change for actionable risks.
---

# Code Review

This is a read-only review. Do not modify source files.

Never merge, deploy, publish, or modify production infrastructure.

1. Read repository-local instructions, the requested behavior, changed files, related code, tests, and validation evidence.
2. Review correctness, regressions, edge cases, concurrency, state and data flow, API contracts, security, authorization, validation, errors, type safety, performance, accessibility, maintainability risks, and test gaps.
3. Report only realistic, actionable findings supported by evidence. Exclude formatting preferences, lint-managed style, speculative issues, and preference-only rewrites.
4. Use these severity definitions exactly:

   - P0: catastrophic behavior, serious security vulnerability, corruption, or data loss.
   - P1: definite significant bug or major regression.
   - P2: real bug, meaningful edge case, or meaningful engineering risk.
   - P3: non-blocking improvement.

5. Every finding must include all fields below:

```text
SEVERITY: P0 | P1 | P2 | P3
LOCATION: file path and precise symbol or line reference
PROBLEM: What is wrong and when it occurs
IMPACT: User, system, or maintenance consequence
EVIDENCE: Concrete code path, test result, or reproducible scenario
SUGGESTED_DIRECTION: Smallest safe direction for remediation
```

6. Return `VERDICT: CHANGES_REQUIRED` whenever any P0, P1, or P2 finding exists.
7. Return `VERDICT: PASS` otherwise.
8. End with exactly one final verdict line. Choose one outcome:

```text
VERDICT: PASS
VERDICT: CHANGES_REQUIRED
```
