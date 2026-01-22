---
name: test-debugging
description: Analyze E2E test failures and suggest fixes for qa-use tests
---

# Test Debugging

This skill analyzes E2E test failures from qa-use and suggests actionable fixes.

## Critical Constraints

- Focus on ACTIONABLE fixes, not generic advice
- Distinguish between selector issues vs application changes vs timing issues
- NEVER modify tests without explicit user approval
- Always explain WHY a test failed before suggesting fixes
- Prefer `--autofix --update-local` when appropriate

## Workflow

1. **Collect Failure Information**
   - Parse the SSE log output for failure details
   - Identify which step failed and the error type
   - Check for screenshots if available

2. **Classify Failure Type**
   - **Selector not found**: Element changed or locator is too brittle
   - **Assertion failed**: Expected state differs from actual
   - **Timeout**: Element took too long to appear/become interactive
   - **Navigation error**: URL changed or redirect occurred
   - **JavaScript error**: Application threw an error

3. **Analyze Root Cause**
   - For selector issues: Check if element exists with different attributes
   - For assertions: Compare expected vs actual values
   - For timeouts: Check if element appears with different timing
   - Spawn `test-analyzer` agent for complex analysis

4. **Suggest Fixes**
   Based on failure type:

   **Selector Issues:**
   - Update the target description to be more specific
   - Add contextual information (e.g., "login button in the header")
   - Consider using `ai_action` for dynamic elements

   **Timing Issues:**
   - Add explicit wait steps before interactions
   - Increase step timeout
   - Add `wait_for_url` or `wait_for_selector` steps

   **Assertion Failures:**
   - Verify the expected outcome is still correct
   - Update assertion target or value
   - Check if application behavior changed

5. **Offer Resolution Options**
   - "Run with `--autofix` to let AI attempt automatic fixes"
   - "I can update the test file with these changes (show diff)"
   - "Run with `--autofix --update-local` to fix and persist changes"

## Common Failure Patterns

| Error Message | Likely Cause | Suggested Fix |
|--------------|--------------|---------------|
| "Element not found: ..." | Selector changed | Update target description |
| "Timeout waiting for ..." | Slow load / element not appearing | Add wait step or increase timeout |
| "Expected ... but got ..." | Assertion mismatch | Update expected value or assertion |
| "Navigation to ... failed" | URL changed | Update goto URL |
| "Element not interactable" | Covered by overlay | Add wait for overlay to close |
