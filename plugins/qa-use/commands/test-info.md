---
description: Show test definition details
argument-hint: <name> [--id <uuid>] [--format pretty|yaml|json]
---

# /qa-use:test-info

Show detailed information about a test definition.

**Invokes skill:** qa-use

## Arguments

| Argument | Description |
|----------|-------------|
| `name` | Local test name (relative to test directory) |
| `--id <uuid>` | Cloud test ID (fetches from cloud instead of local) |
| `--format <format>` | Output format: `pretty` (default), `yaml`, `json` |

## Output

Shows test metadata and step summary:
- Name, ID, description
- Tags (for categorization/filtering)
- App config, dependencies
- Variables
- Step-by-step summary

## Examples

```
/qa-use:test-info login
/qa-use:test-info --id 12345678-1234-1234-1234-123456789abc
/qa-use:test-info checkout --format yaml
```
