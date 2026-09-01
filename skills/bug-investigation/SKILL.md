---
name: bug-investigation
description: Use when diagnosing and fixing a reproducible defect or regression.
---

# Bug Investigation

Never merge, deploy, publish, or modify production infrastructure.

1. Read repository-local instructions and reproduce the reported defect or regression.
2. Minimize the reproduction while preserving the observed failure.
3. Gather evidence from the failing behavior, relevant code paths, state, data, logs, and tests.
4. Form an evidence-based root-cause hypothesis and test it. Do not make speculative source changes before this hypothesis exists.
5. Implement the minimal fix that addresses the confirmed cause without unrelated refactoring.
6. Add regression coverage that fails without the fix and passes with it.
7. Discover and run the relevant repository checks, widening validation according to the change's risk.
8. Report separate sections named Root cause, Evidence, Change, Regression coverage, and Verification.
