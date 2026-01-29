---
description: Compare local test with cloud version
argument-hint: <file> [--full]
---

# /qa-use:test-diff

Compare a local test file with its cloud version to see differences.

**Invokes skill:** qa-use

## Arguments

| Argument | Description |
|----------|-------------|
| `<file>` | Local test file path (extension optional) |
| `--full` | Show full YAML diff instead of field comparison |

## Behavior

By default, shows a structured field comparison highlighting differences in:
- name, description, url, app_config
- tags, depends_on, variables
- step count
- version_hash

With `--full`, shows a line-by-line YAML diff of the entire test definition.

The local test must have an `id` field (assigned after first push to cloud).

## Examples

```
# Field comparison (default)
/qa-use:test-diff login

# Full YAML diff
/qa-use:test-diff login --full

# With explicit extension
/qa-use:test-diff qa-tests/login.yaml
```

## Related Commands

- `/qa-use:test-sync --push` - Push local tests to cloud
- `/qa-use:test-sync --pull` - Pull tests from cloud
