---
name: fix-review-findings
description: Use when blocking review findings must be verified and remediated.
---

# Fix Review Findings

Never merge, deploy, publish, or modify production infrastructure.

1. Read repository-local instructions, the review findings, current code, tests, and applicable requirements.
2. Verify each finding against the current code and requirements before editing. Do not assume that a finding still applies.
3. Fix every valid P0, P1, or P2 finding with the smallest scoped change. Do not make unrelated changes.
4. For an invalid finding, reject it with a technical explanation grounded in current behavior or requirements.
5. If remediation cannot proceed, describe the concrete dependency or decision that blocks it.
6. Add or update coverage when a valid remediation changes behavior, then rerun the repository checks discovered for the affected area.
7. Report one entry per finding:

```text
FINDING: reviewer identifier or concise finding title
DISPOSITION: FIXED | REJECTED | BLOCKED
RATIONALE: Evidence supporting the disposition
VALIDATION: Commands and observed results
```

Summarize any remaining blocked work and the next action after the per-finding entries.
