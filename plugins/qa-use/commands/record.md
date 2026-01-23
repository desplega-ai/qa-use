---
description: Record browser actions into a test definition
argument-hint: [start|stop] [test-name]
---

# /qa-use:record

Record browser interactions and generate a test YAML definition.

## Arguments

| Argument | Description |
|----------|-------------|
| `start [name]` | Start recording a new test with optional name |
| `stop` | Stop recording and generate test YAML |

## Workflow

### On `start`:

1. **Parse test name**
   - If name provided, use it
   - If not, prompt: "What should I call this test?"

2. **Ensure browser session**
   - Check for active session: `qa-use browser list`
   - Create new if needed: `qa-use browser create --viewport desktop`

3. **Announce recording mode**
   ```
   📹 Recording started for test: <name>

   Perform browser actions using qa-use browser commands:
   - qa-use browser goto <url>
   - qa-use browser snapshot  (to see available elements)
   - qa-use browser click <ref>
   - qa-use browser fill <ref> "value"

   When done, run: /qa-use:record stop
   ```

4. **Track subsequent commands**
   - Monitor browser commands
   - Build step list for test

### On `stop`:

1. **Spawn browser-recorder Agent**
   - Pass tracked commands
   - Agent generates test YAML

2. **Show generated YAML**
   - Display preview with variables and steps
   - Highlight any detected secrets

3. **Confirm and save**
   - Ask: "Save to qa-tests/<name>.yaml?"
   - Write file on confirmation

## Example Usage

```
# Start recording
/qa-use:record start login-test

# Perform actions
qa-use browser goto http://localhost:3000/login
qa-use browser snapshot
qa-use browser fill e3 "user@example.com"
qa-use browser fill e4 "password123"
qa-use browser click e5

# Stop and generate test
/qa-use:record stop
```

## What Happens

1. **Start**: Creates browser session, enters recording mode
2. **Actions**: You perform browser actions, they're tracked
3. **Stop**: Generates test YAML with:
   - Variables for repeated/sensitive values
   - Semantic element descriptions
   - Inferred assertions (URL changes, element visibility)
4. **Save**: Writes to `qa-tests/<name>.yaml`

This is the fastest way to create a test from manual exploration.
