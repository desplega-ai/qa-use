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
| `--force` | Overwrite existing files/tests without prompting |

## Version Tracking & Conflict Handling

When pushing tests (`--push`), the command tracks versions using `version_hash`:

1. **Created/Updated tests** - Local files are updated with the new `version_hash` from the cloud
2. **Conflicts detected** - If the cloud version was modified since your last sync, you'll see a `CONFLICT` warning
3. **Resolving conflicts** - Use `qa-use test diff <file>` to compare versions, then:
   - `--force` to overwrite the cloud version with your local changes
   - `--pull` to get the latest cloud version (overwrites local)

When pulling tests (`--pull`):
- Existing local files are skipped by default
- Use `--force` to overwrite existing local files

## Examples

```
/qa-use:test-sync --pull
/qa-use:test-sync --push
/qa-use:test-sync --pull --dry-run
/qa-use:test-sync --push --force
```
