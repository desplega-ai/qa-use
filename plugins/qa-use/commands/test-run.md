---
description: Run E2E tests with qa-use CLI
argument-hint: [test-name] [--flags...]
---

# /qa-use:test-run

Execute E2E tests with real-time progress monitoring.

**Invokes skill:** qa-use

## Arguments

| Argument | Description |
|----------|-------------|
| `test-name` | Test to run (omit to list available tests) |
| `--tunnel` | Use local browser with tunnel (required for localhost) |
| `--headful` | Show browser window |
| `--autofix` | Enable AI self-healing |
| `--update-local` | Persist AI fixes to file |
| `--download` | Download assets to `/tmp/qa-use/downloads/` |
| `--var key=value` | Override variable |

## Examples

```
/qa-use:test-run login
/qa-use:test-run checkout --autofix --update-local
/qa-use:test-run --all
```
