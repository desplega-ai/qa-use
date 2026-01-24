---
description: Sync tests between local files and cloud
argument-hint: [--pull|--push] [--dry-run]
---

# /qa-use:test-sync

Bidirectional sync between local test files and desplega.ai cloud.

**Invokes skill:** qa-use

## Arguments

| Argument | Description |
|----------|-------------|
| `--pull` | Download tests from cloud (default) |
| `--push` | Upload local tests to cloud |
| `--dry-run` | Preview changes without applying |

## Examples

```
/qa-use:test-sync --pull
/qa-use:test-sync --push
/qa-use:test-sync --pull --dry-run
```
