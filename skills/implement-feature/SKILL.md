---
name: implement-feature
description: Use when implementing a requested feature or behavior change in an existing repository.
---

# Implement Feature

Never merge, deploy, publish, or modify production infrastructure.

1. Read repository-local instructions and inspect the relevant architecture, tests, manifests, lockfiles, and configuration before changing files.
2. Restate the requested scope. Identify risks or ambiguity that would materially change the solution, and request direction when needed.
3. Form a short plan when the change spans more than one meaningful step.
4. Implement the smallest correct change, preserving established conventions and avoiding unrelated refactoring.
5. Add or update success, edge-case, and failure-path tests whenever behavior changes.
6. Discover and run the repository's deterministic checks, beginning with focused checks and expanding as the change warrants.
7. Report the outcome using these sections:

   - Summary
   - Files changed
   - Validation evidence
   - Remaining risks
   - Next action
