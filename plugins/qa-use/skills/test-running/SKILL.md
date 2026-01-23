---
name: test-running
description: Execute E2E tests using the qa-use CLI with real-time progress monitoring
---

# Test Running

This skill orchestrates the execution of E2E tests using the `qa-use` CLI (`npx @desplega.ai/qa-use test run`).

## Critical Constraints

- ALWAYS check for `.qa-use-tests.json` config before running tests
- ALWAYS validate test syntax before execution (unless user explicitly skips)
- NEVER assume tests exist - verify via `npx @desplega.ai/qa-use test list`
- If test fails and `--autofix` was not used, explain the failure and suggest `--autofix`
- If AI auto-fix succeeds, suggest `--update-local` to persist changes
- **ALWAYS use `--tunnel` when testing localhost URLs** (e.g., `http://localhost:3000`) - the cloud cannot access your local machine without a tunnel!

## Workflow

1. **Prerequisites Check**
   - Verify `.qa-use-tests.json` exists (offer to create via `/qa-use:test-init` if missing)
   - Verify test directory exists
   - Verify the specified test exists

2. **Construct CLI Command**
   - Base: `npx @desplega.ai/qa-use test run <name>`
   - Add user-specified flags: `--headful`, `--autofix`, `--screenshots`, `--download`, etc.
   - Add variable overrides via `--var key=value`

3. **Execute Test**
   - Run via Bash tool
   - Monitor output for SSE progress events
   - Parse results (passed/failed/skipped)

4. **Report Results**
   - Summarize step results with pass/fail counts
   - If screenshots captured, provide asset URLs
   - If test failed, invoke `test-debugging` skill for analysis

5. **Suggest Next Actions**
   - On success: suggest `--persist` to save to cloud
   - On failure with autofix: suggest `--update-local`
   - On failure without autofix: suggest `--autofix --update-local`

## CLI Reference

```bash
# Basic run (uses cloud browser)
npx @desplega.ai/qa-use test run <name>

# With local browser tunnel (required for localhost URLs!)
npx @desplega.ai/qa-use test run <name> --tunnel

# With visible local browser (for debugging)
npx @desplega.ai/qa-use test run <name> --tunnel --headful

# With self-healing and auto-update
npx @desplega.ai/qa-use test run <name> --tunnel --autofix --update-local

# Run all tests
npx @desplega.ai/qa-use test run --all

# With variable overrides
npx @desplega.ai/qa-use test run <name> --var email=test@example.com --var password=secret

# Download assets locally
npx @desplega.ai/qa-use test run <name> --download

# Use existing tunneled browser (from `qa-use browser create --tunnel`)
npx @desplega.ai/qa-use test run <name> --ws-url <websocket-url>
```

### Using a Local Tunneled Browser

**Simple way** - use `--tunnel` directly:

```bash
# Headless local browser with tunnel
qa-use test run <name> --tunnel

# Visible local browser for debugging
qa-use test run <name> --tunnel --headful
```

**Reusable session** - for running multiple tests against the same browser:

```bash
# Terminal 1: Start tunnel (keeps browser open between runs)
qa-use browser create --tunnel

# Terminal 2: Run tests against that browser
qa-use test run <name> --ws-url <websocket-url-from-tunnel-output>
```

This is useful for:
- Watching tests execute in real-time
- Running multiple tests against the same browser session
- Debugging test failures visually

### Download Directory Structure

When using `--download`, assets are saved to `/tmp/qa-use/downloads/`:

```
/tmp/qa-use/downloads/
└── <test-id or local-hash>/    # UUID for cloud tests, local-<hash> for local tests
    └── <run-id>/
        ├── screenshots/
        │   ├── step_0_pre.jpeg
        │   ├── step_0_post.jpeg
        │   └── ...
        ├── recordings/
        │   └── recording.webm
        └── hars/
            └── network.har
```

Local tests without cloud IDs use a deterministic hash of the source file path (e.g., `local-a1b2c3d4`).
