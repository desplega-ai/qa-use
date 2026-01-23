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

## Failure Type Classification

When analyzing a test failure, classify it into one of these three categories:

### CODE BUG
The feature doesn't work as expected. The application code is broken.

**Indicators:**
- Expected behavior doesn't happen (e.g., redirect doesn't occur, data isn't saved)
- JavaScript errors in console
- API calls returning errors
- Application crashes or shows error pages

**Diagnostic Questions:**
- Does the feature work when tested manually?
- Are there related recent code changes?
- Is the backend API responding correctly?

**Suggested Actions:**
- Point to relevant source files based on the failing functionality
- Suggest code review of recent changes
- Recommend manual debugging of the feature

### TEST BUG
The test definition is outdated or incorrect. The feature works, but the test doesn't match it.

**Indicators:**
- Element selector/target no longer matches
- Timing issues (element appears with different delay)
- Expected value changed (button text, URL path)
- Test assumes old workflow that changed

**Diagnostic Questions:**
- Has the UI changed recently (button text, layout, element attributes)?
- Is this a timing/race condition issue?
- Does the test pass with `--autofix`?

**Suggested Actions:**
- Update the target description to match current UI
- Add or adjust wait steps
- Run with `--autofix --update-local` to let AI fix and persist

### ENVIRONMENT
External factors are causing the failure. The code and test are correct.

**Indicators:**
- Network timeouts or connection errors
- Authentication failures (session expired, invalid credentials)
- Missing test data (database not seeded, user doesn't exist)
- Service unavailable (third-party API down)

**Diagnostic Questions:**
- Does the app work when accessed manually?
- Are API credentials valid and not expired?
- Is test data in the expected state?
- Are external services (APIs, databases) accessible?

**Suggested Actions:**
- Check network connectivity and service health
- Refresh authentication credentials
- Reset or re-seed test data
- Retry after resolving external issues

## Code Investigation

When a **CODE BUG** is suspected, help identify relevant source files:

1. **Based on URL path**: `/login` → look for `pages/login`, `routes/login`, `auth/` directories
2. **Based on component**: "dashboard" → look for `components/dashboard`, `Dashboard.tsx`
3. **Based on action**: form submission → look for `handleSubmit`, form handlers, API calls
4. **Based on error**: JavaScript errors often include file/line references

Provide specific file suggestions:
```
Relevant code to check:
- src/auth/login.ts:45 (handleSubmit function)
- src/routes/index.ts:23 (redirect logic)
- src/api/auth.ts (authentication API calls)
```

## Common Failure Patterns

| Error Message | Likely Cause | Category | Suggested Fix |
|--------------|--------------|----------|---------------|
| "Element not found: ..." | Selector changed | TEST BUG | Update target description |
| "Timeout waiting for ..." | Slow load / element not appearing | TEST BUG / ENVIRONMENT | Add wait step or increase timeout |
| "Expected ... but got ..." | Assertion mismatch | TEST BUG / CODE BUG | Verify expected value, check application logic |
| "Navigation to ... failed" | URL changed | TEST BUG / CODE BUG | Update goto URL, check redirect logic |
| "Element not interactable" | Covered by overlay | TEST BUG | Add wait for overlay to close |
| "Network request failed" | API/service down | ENVIRONMENT | Check service health, retry |
| "Unauthorized" | Auth expired | ENVIRONMENT | Refresh credentials |
| "Application error" | Backend crash | CODE BUG | Check server logs, debug backend |
