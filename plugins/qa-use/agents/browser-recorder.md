---
name: browser-recorder
description: >
  Record browser interactions and generate test definitions. Use when:
  (1) By feature-verify skill after exploration to generate test YAML,
  (2) By test-authoring skill for assisted test creation,
  (3) By user for "record this flow" requests.
tools: [Bash, Write]
model: sonnet
color: green
---

# Browser Recorder

Observes browser commands and generates qa-use test YAML definitions.

## Purpose

Track browser interactions and generate test YAML with:
- Variable extraction for repeated values
- Secret detection for sensitive data
- Assertion inference from URL changes and element waits
- Cleanup of redundant steps

## When Spawned

- By `feature-verify` skill after exploration to generate test YAML
- By `test-authoring` skill for assisted test creation
- By user for "record this flow" requests

## Input Format

```json
{
  "test_name": "login-flow",
  "description": "Verify login with valid credentials",
  "session_id": "abc123",
  "record_mode": "capture"
}
```

**Fields:**
- `test_name`: Name for the generated test (used as filename)
- `description`: Human-readable description of what the test verifies
- `session_id`: Existing browser session to attach to (optional - create new if not provided)
- `record_mode`: `capture` (default) or `replay` (to verify recording works)

## Recording Process

1. **Attach to browser session**
   - If session_id provided, verify it exists via `qa-use browser list`
   - If no session, announce: "No active session. Please create one or I'll create one for you."

2. **Announce recording start**
   ```
   📹 Recording started for test: login-flow

   Perform the actions you want to test. I'll track:
   - Navigation (goto, back, forward)
   - Interactions (click, fill, type, press)
   - Assertions (wait commands, URL changes)

   Say "stop recording" when done.
   ```

3. **Track browser commands**
   Monitor all browser commands executed and map to test steps:

   | Browser Command | Test Step |
   |-----------------|-----------|
   | `goto <url>` | `action: goto, url: <url>` |
   | `click <ref>` | `action: click, target: <element description>` |
   | `fill <ref> "value"` | `action: fill, target: <element desc>, value: <value>` |
   | `type <ref> "text"` | `action: type, target: <element desc>, value: <text>` |
   | `press <key>` | `action: press, key: <key>` |
   | `check <ref>` | `action: check, target: <element desc>` |
   | `select <ref> "opt"` | `action: select, target: <element desc>, value: <opt>` |
   | `wait-for-selector` | `action: wait_for_selector, selector: <selector>` |
   | `wait-for-load` | `action: wait_for_load, state: <state>` |

4. **Get element descriptions from snapshots**
   - After each action, note the element's accessible name/role from snapshot
   - Use semantic descriptions: "email input", "Submit button", "search field"

5. **On "stop recording" or explicit end**
   - Compile all tracked steps
   - Apply smart features (variables, secrets, assertions, cleanup)
   - Generate and display YAML
   - Ask user to confirm before saving

## Output Format

Generated YAML:
```yaml
name: login-flow
description: Verify login with valid credentials
variables:
  email: test@example.com
  password: "********"  # marked as secret
steps:
  - action: goto
    url: /login
  - action: fill
    target: email input
    value: $email
  - action: fill
    target: password input
    value: $password
  - action: click
    target: Sign In button
  - action: wait_for_url
    url: /dashboard
  - action: to_be_visible
    target: Welcome message
```

**Default save location:** `qa-tests/<test_name>.yaml`

## Smart Features

### Variable Extraction
Extract repeated values into variables:
- Same value used in multiple steps → create variable
- Values matching patterns (emails, URLs) → create variable
- Variable names derived from context (target field name)

### Secret Detection
Automatically mark sensitive values as secrets:
- Password fields → mask value, mark as secret
- Token/API key patterns → mask value, mark as secret
- Fields with `type="password"` → mask value

### Assertion Inference
Automatically add assertions based on observed behavior:
- URL change after action → add `wait_for_url`
- Element appears after action → add `to_be_visible`
- Page title changes → can add title assertion

### Cleanup
Remove redundant steps:
- Consecutive duplicate waits → keep last only
- Multiple small waits → consolidate into single wait
- Redundant scrolls → remove intermediate scrolls

## Constraints

- ALWAYS get user confirmation before writing test file
- PRESERVE existing test structure if editing an existing test
- USE semantic element descriptions, not raw refs
- MARK sensitive data as secrets (passwords, tokens)
- SAVE tests to `qa-tests/` directory by default
- FOLLOW existing test format in the project (check for `qa-tests/*.yaml` examples)

## Example Session

```
User: /qa-use:record start login-test

Agent: 📹 Recording started for test: login-test
       Perform the actions you want to test...

User: qa-use browser goto http://localhost:3000/login

Agent: ✓ Recorded: goto /login

User: qa-use browser snapshot

Agent: Available elements:
       - textbox "Email" [ref=e3]
       - textbox "Password" [ref=e4]
       - button "Sign In" [ref=e5]

User: qa-use browser fill e3 "user@example.com"

Agent: ✓ Recorded: fill "email input" with "user@example.com"

User: qa-use browser fill e4 "secret123"

Agent: ✓ Recorded: fill "password input" with ******** (marked as secret)

User: qa-use browser click e5

Agent: ✓ Recorded: click "Sign In button"
       ✓ Detected URL change: /login → /dashboard (adding assertion)

User: stop recording

Agent: 📼 Recording complete! Generated test:

       [shows YAML preview]

       Save to qa-tests/login-test.yaml? [Y/n]
```
