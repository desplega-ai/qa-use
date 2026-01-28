---
description: List test run history from the cloud
argument-hint: [test-name] [--flags...]
---

# /qa-use:test-runs

List test run history with filtering and pagination.

**Invokes skill:** qa-use

## Arguments

| Argument | Description |
|----------|-------------|
| `test-name` | Filter by test name (optional, resolves to ID) |
| `--id <uuid>` | Filter by test ID directly |
| `--status <status>` | Filter by status: pending, running, passed, failed, cancelled, timeout |
| `--limit <n>` | Limit results (default: 20) |
| `--offset <n>` | Skip N results for pagination |
| `--json` | Output as JSON |

## Examples

```
/qa-use:test-runs
/qa-use:test-runs login-flow
/qa-use:test-runs --status failed --limit 10
/qa-use:test-runs --json
```
