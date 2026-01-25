---
description: Record browser actions into a test definition
argument-hint: [start|stop] [test-name]
---

# /qa-use:record

Record browser interactions and generate test YAML.

**Invokes skill:** qa-use

## Arguments

| Argument | Description |
|----------|-------------|
| `start [name]` | Start recording with optional test name |
| `stop` | Stop recording and generate test YAML |

## What Happens

1. **start**: Creates browser session, enters recording mode
2. **actions**: You perform browser commands, they're tracked
3. **stop**: Generates test YAML with variables and semantic descriptions
4. **save**: Writes to `qa-tests/<name>.yaml`

## Examples

```
/qa-use:record start login-test
# ... perform browser actions ...
/qa-use:record stop
```

## Recording from Logged-In State

To record a test that assumes the user is already logged in, first create a session with `--after-test-id`:

```bash
# Create session that runs login test first
qa-use browser create --after-test-id <login-test-uuid>

# Then start recording from the authenticated state
/qa-use:record start dashboard-test
```

This is useful for recording tests that depend on authentication without including login steps in every test.
