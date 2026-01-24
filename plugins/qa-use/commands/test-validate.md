---
description: Validate test definition syntax without running
argument-hint: [test-name]
---

# /qa-use:test-validate

Validate a test definition's syntax and configuration.

**Invokes skill:** qa-use

## Arguments

| Argument | Description |
|----------|-------------|
| `test-name` | Test to validate (omit to list available tests) |

## What Happens

1. Runs syntax validation on test YAML
2. Reports resolved configuration (app_config, variables, steps)
3. On errors, offers fixes for common issues

## Examples

```
/qa-use:test-validate example
/qa-use:test-validate login
```
