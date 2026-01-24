# Failure Debugging

Guide for analyzing E2E test failures and determining root causes.

## Failure Classification

Every test failure falls into one of three categories:

| Category | Meaning | Who Fixes |
|----------|---------|-----------|
| **CODE BUG** | Feature doesn't work | Developer (fix application code) |
| **TEST BUG** | Test is outdated | Developer/QA (update test) |
| **ENVIRONMENT** | External issue | Ops (fix infrastructure) |

Getting the classification right determines the correct fix approach.

## CODE BUG

**The feature doesn't work as expected. The application code is broken.**

### Indicators

- Expected behavior doesn't happen (redirect doesn't occur, data isn't saved)
- JavaScript errors in browser console
- API calls returning error responses (4xx, 5xx)
- Application crashes or shows error pages
- Form submission has no effect
- Data not persisting

### Diagnostic Questions

1. Does the feature work when tested manually in a browser?
2. Are there related recent code changes?
3. Is the backend API responding correctly?
4. Are there JavaScript errors in the console? (`qa-use browser logs console`)
5. Are API requests failing? (`qa-use browser logs network`)

### Investigation Steps

```bash
# 1. Get console logs
qa-use browser logs console -s <session-id>

# 2. Get network logs
qa-use browser logs network -s <session-id>

# 3. Check for errors
# Look for: console.error, failed requests, 4xx/5xx responses
```

### Suggested Actions

- **Locate relevant code:**
  - URL `/login` → look for `pages/login`, `routes/login`, `auth/`
  - Component "dashboard" → look for `Dashboard.tsx`, `components/dashboard`
  - Form submission → look for `handleSubmit`, form handlers, API calls

- **Check recent changes:**
  ```bash
  git log --oneline -20 -- src/
  git diff HEAD~5 -- src/auth/
  ```

- **Debug manually** - reproduce the issue in a browser with DevTools open

## TEST BUG

**The test definition is outdated or incorrect. The feature works, but the test doesn't match it.**

### Indicators

- Element selector/target no longer matches
- Timing issues (element appears with different delay)
- Expected value changed (button text "Submit" → "Sign In")
- Test assumes old workflow that was redesigned
- Assertion expects outdated content

### Diagnostic Questions

1. Has the UI changed recently (button text, layout, element attributes)?
2. Is this a timing/race condition issue?
3. Does the test pass with `--autofix`?
4. Did someone refactor the component without updating tests?

### Investigation Steps

```bash
# 1. Run with autofix to see if AI can fix it
qa-use test run my-test --autofix

# 2. If autofix works, persist the fix
qa-use test run my-test --autofix --update-local

# 3. Check what changed
git diff qa-tests/my-test.yaml
```

### Suggested Actions

- **Update target description** to match current UI
- **Add wait steps** for timing issues
- **Run with `--autofix --update-local`** to let AI fix and persist
- **Review the diff** to understand what changed

### Common Test Bug Patterns

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| "Element not found: submit button" | Button text changed | Update target to new text |
| "Timeout waiting for dashboard" | Slower load time | Add `wait` or increase timeout |
| "Expected 'Welcome' but got 'Hello'" | Copy changed | Update assertion value |
| "Element not interactable" | Overlay blocking | Add wait for overlay to close |

## ENVIRONMENT

**External factors are causing the failure. The code and test are correct.**

### Indicators

- Network timeouts or connection errors
- Authentication failures (session expired, invalid credentials)
- Missing test data (database not seeded, user doesn't exist)
- Service unavailable (third-party API down)
- Rate limiting errors
- SSL/TLS certificate errors

### Diagnostic Questions

1. Does the app work when accessed manually?
2. Are API credentials valid and not expired?
3. Is test data in the expected state?
4. Are external services (APIs, databases) accessible?
5. Is this a transient network issue?

### Investigation Steps

```bash
# 1. Check if app is accessible
curl https://your-app.com/health

# 2. Check network logs for failed requests
qa-use browser logs network -s <session-id>

# 3. Verify credentials haven't expired
# Check .qa-use-tests.json or environment variables
```

### Suggested Actions

- **Retry the test** - transient issues often resolve themselves
- **Refresh credentials** - update expired API keys or tokens
- **Reset test data** - re-seed database, recreate test user
- **Check service status** - verify third-party services are up
- **Wait and retry** - for rate limiting, wait before retrying

## Debugging Workflow

```
Test Failed
    │
    ▼
┌──────────────────────────────────────┐
│ 1. Get session logs                  │
│    qa-use browser logs console -s ID │
│    qa-use browser logs network -s ID │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ 2. Check for JS errors or API fails  │
│    - Console errors = CODE BUG       │
│    - 4xx/5xx responses = CODE BUG    │
│    - Network timeout = ENVIRONMENT   │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ 3. Try --autofix                     │
│    qa-use test run name --autofix    │
│    - Works = TEST BUG, use           │
│      --update-local to persist       │
│    - Still fails = probably CODE BUG │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ 4. Manual verification               │
│    - Open app in browser             │
│    - Try the same flow manually      │
│    - Works manually = TEST BUG       │
│    - Fails manually = CODE BUG       │
└──────────────────────────────────────┘
```

## Error Message Reference

| Error Message | Category | Likely Fix |
|---------------|----------|------------|
| "Element not found: ..." | TEST BUG | Update target description |
| "Timeout waiting for ..." | TEST BUG/ENV | Add wait or check service |
| "Expected ... but got ..." | TEST BUG/CODE | Verify expected value |
| "Navigation to ... failed" | TEST BUG/CODE | Check URL and redirects |
| "Element not interactable" | TEST BUG | Wait for overlays |
| "Network request failed" | ENVIRONMENT | Check service health |
| "Unauthorized" / "401" | ENVIRONMENT | Refresh credentials |
| "Internal Server Error" / "500" | CODE BUG | Check server logs |
| "Not Found" / "404" | CODE BUG | Check routing |
| "TypeError: Cannot read ..." | CODE BUG | Fix JavaScript error |

## Using AI Self-Healing

The `--autofix` flag enables AI-powered test repair:

```bash
# Try autofix
qa-use test run my-test --autofix

# If it works, persist the changes
qa-use test run my-test --autofix --update-local

# Review what changed
git diff qa-tests/my-test.yaml
```

**What autofix can fix:**
- Selector/target changes
- Timing issues (adds waits)
- Minor assertion value changes

**What autofix cannot fix:**
- Broken application code
- Major workflow changes
- Missing features
- Authentication issues
