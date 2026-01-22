---
description: Sync tests between local files and cloud
argument-hint: [--pull|--push] [--dry-run]
---

# /qa-use:test-sync

Bidirectional sync between local test files and the desplega.ai cloud.

## Arguments

| Argument | Description |
|----------|-------------|
| `--pull` | Download tests from cloud to local (default) |
| `--push` | Upload local tests to cloud |
| `--dry-run` | Preview changes without applying |
| `--force` | Overwrite without prompting |

## Workflow

1. **Parse Arguments**
   - Determine direction: pull (default) or push
   - Check for dry-run mode

2. **Check Prerequisites**
   - Verify API key is configured
   - Verify test directory exists

3. **Execute Sync**
   - Pull: `npx @desplega.ai/qa-use test sync --pull`
   - Push: `npx @desplega.ai/qa-use test sync --push`
   - Add `--dry-run` if requested

4. **Report Results**
   - Show created/updated/skipped counts
   - For pull: Offer to review downloaded tests
   - For push: Show cloud URLs for uploaded tests

## Example Usage

```
/qa-use:test-sync --pull
/qa-use:test-sync --push
/qa-use:test-sync --pull --dry-run
```
