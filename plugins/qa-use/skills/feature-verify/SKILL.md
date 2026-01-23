---
name: feature-verify
description: Verify that a developed feature works correctly through automated testing
---

# Feature Verification

The primary skill for autonomous feature verification. Orchestrates browser exploration, test creation, execution, and failure analysis.

## When to Use

- After implementing a new feature
- After fixing a bug
- When asked to "verify", "test", or "check" that something works
- Before committing code that includes UI changes

## Invocation

```
/qa-use:verify <description of what to verify>
```

**Examples:**
- `/qa-use:verify "login works with valid credentials"`
- `/qa-use:verify "the checkout flow completes successfully"`
- `/qa-use:verify "error message shows when form is invalid"`

## Workflow

### Phase 1: Understand Context

1. **Parse the verification request**
   - Extract: what feature/flow to test
   - Identify: expected starting point (URL)
   - Determine: success criteria (what should happen)

2. **Identify the application**
   - Check for `.qa-use-tests.json` for app configuration
   - Look for `base_url` or infer from recent file changes
   - If unclear, ask the user for the target URL

3. **Check recent changes**
   - Review recent file modifications to understand what was built
   - Identify relevant components, routes, or features

### Phase 2: Find or Create Test

1. **Search for existing tests**
   - Look in `qa-tests/` for tests matching the feature
   - Search by name, description, or URL pattern

2. **If test exists:**
   - Show test name and summary
   - Ask: "Found existing test `<name>`. Run it?"
   - If yes → proceed to Phase 3

3. **If no test exists:**
   - Ask: "No test found for this feature. Should I explore and create one?"
   - If yes:
     - Spawn `browser-navigator` agent to explore the feature
     - Once exploration complete, spawn `browser-recorder` agent to generate test YAML
     - Save test to `qa-tests/<feature-name>.yaml`
     - Proceed to Phase 3

### Phase 3: Execute Test

1. **Run the test**
   ```bash
   qa-use test run <name> --autofix --screenshots
   ```

2. **Stream progress with clear status updates**
   ```
   ▶ Step 1/5: goto /login ✓
   ▶ Step 2/5: fill email input ✓
   ▶ Step 3/5: fill password input ✓
   ▶ Step 4/5: click submit button ✓
   ▶ Step 5/5: assert dashboard visible ✓

   ✅ All steps passed. Feature verified.
   ```

### Phase 4: Handle Failure

If test fails:

1. **Capture failure context**
   - Take screenshot at failure point: `qa-use browser screenshot`
   - Get current URL: `qa-use browser url`
   - Get available elements: `qa-use browser snapshot`
   - Note error message and failed step

2. **Spawn test-analyzer agent**
   - Pass: failure logs, screenshot, page state
   - Get: root cause analysis and failure classification

3. **Classify failure type** (using test-debugging skill categories)
   - **CODE BUG**: Feature doesn't work as expected
   - **TEST BUG**: Selector outdated, timing issue, assertion value changed
   - **ENVIRONMENT**: Network, auth, data issues

4. **Provide actionable recommendation**
   ```
   ❌ Step 4 failed: click "submit button"

   Failure type: TEST BUG (selector mismatch)

   The button text changed from "Submit" to "Sign In".

   Current page elements include:
   - button "Sign In" [ref=e5]
   - link "Forgot Password?" [ref=e6]

   Recommended fix:
   - Update step 4 target from "submit button" to "Sign In button"

   Options:
   1. Run with `--autofix --update-local` to fix and persist automatically
   2. I can update the test file for you (show diff first)
   3. Investigate further if this might be a code bug

   What would you like to do?
   ```

5. **If user approves fix**
   - Apply the fix (update test file or re-run with `--autofix --update-local`)
   - Return to Phase 3 to re-run

### Phase 5: Report Outcome

**On success:**
```
✅ Feature verified: Login flow

Test: qa-tests/login.yaml
Duration: 8.3s
Steps: 5/5 passed

The login feature is working correctly. Safe to commit.
```

**On persistent failure (after fix attempts):**
```
❌ Feature verification failed: Login flow

After 2 fix attempts, the test still fails.

Root cause: The dashboard element never appears after login.
This appears to be a CODE BUG - the redirect logic may be broken.

Relevant code to check:
- src/auth/login.ts:45 (handleSubmit function)
- src/routes/index.ts:23 (redirect logic)

Screenshot: /tmp/qa-use/failure-screenshot.png

Would you like me to investigate the code?
```

## Critical Constraints

- NEVER mark a feature as verified if any test step fails
- ALWAYS provide screenshot on failure
- ALWAYS suggest specific fixes, not generic advice
- If stuck after 3 attempts, escalate to user with full context
- Clean up browser sessions when done (success or failure)
- Respect user's decision on automatic fixes vs manual review

## Agent Spawning

This skill spawns the following agents:

| Agent | When Spawned | Purpose |
|-------|--------------|---------|
| `browser-navigator` | No existing test, user wants exploration | Explore feature, identify elements |
| `browser-recorder` | After exploration | Generate test YAML from exploration |
| `test-analyzer` | Test fails | Analyze failure, classify root cause |

## Integration with Other Skills

- Uses `browser-control` skill patterns for CLI commands
- Uses `test-debugging` skill for failure classification
- Uses `test-running` skill for test execution
- Uses `test-authoring` patterns for generated test format
