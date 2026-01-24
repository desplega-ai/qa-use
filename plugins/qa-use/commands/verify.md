---
description: Verify a feature works through automated testing
argument-hint: <description>
---

# /qa-use:verify

Verify a feature works through automated browser testing.

**Invokes skill:** qa-use

## Arguments

| Argument | Description |
|----------|-------------|
| `description` | What to verify (e.g., "login works with valid credentials") |

## What Happens

1. Searches for existing tests matching your description
2. If no test exists, offers to explore and create one
3. Runs the test with AI self-healing
4. Reports results with specific fix recommendations

## Examples

```
/qa-use:verify "login works with valid credentials"
/qa-use:verify "checkout flow completes successfully"
/qa-use:verify "form shows validation errors"
```
