---
name: final-verification
description: Use when independently verifying an engineering change before it is presented as ready.
---

# Final Verification

Never merge, deploy, publish, or modify production infrastructure.

1. Read repository-local instructions and inspect the changed files, relevant tests, manifests, lockfiles, and configuration.
2. Discover the repository commands applicable to the change. Run the narrowest relevant checks first, then broader checks warranted by impact and risk.
3. For every command, record the command, exit status, and material output. Distinguish observed failures from warnings or unrelated environment noise.
4. Do not repair source code. Report failures as evidence for the implementer or reviewer to address.
5. Use blocked status only for a missing dependency, unavailable service, absent credential, or environment limitation. State the specific condition and attempted check.
6. End with exactly one status line, selecting one of the following outcomes:

```text
VERIFICATION: PASS
VERIFICATION: FAIL
VERIFICATION: BLOCKED
```
