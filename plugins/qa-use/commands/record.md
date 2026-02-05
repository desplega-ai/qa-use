---
description: Record browser actions into a test definition
argument-hint: [start|stop|edit] [test-name]
---

# /qa-use:record

Record browser interactions and generate test YAML, or edit existing tests with AI assistance.

**Invokes skill:** qa-use

## Arguments

| Argument | Description |
|----------|-------------|
| `start [name]` | Start recording with optional test name |
| `edit <test-name>` | AI-assisted editing of existing test |
| `stop` | Stop recording and generate test YAML |

## What Happens

### Recording Mode (start/stop)

1. **start**: Creates browser session, enters recording mode
2. **actions**: You perform browser commands, they're tracked
3. **stop**: Generates test YAML with variables and semantic descriptions
4. **save**: Writes to `qa-tests/<name>.yaml`

### Edit Mode (edit)

1. Loads existing test definition
2. Understands your desired changes
3. Applies modifications
4. Validates and saves with confirmation

## Examples

### Recording a new test

```
/qa-use:record start login-test
# ... perform browser actions ...
/qa-use:record stop
```

### Editing an existing test

```
/qa-use:record edit login-test
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
