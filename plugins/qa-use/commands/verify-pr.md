---
description: Verify a PR's frontend changes through browser automation
argument-hint: [PR number or URL] [--base-url <url>]
---

# /qa-use:verify-pr

Verify a pull request's frontend changes through automated browser testing.

**Invokes skill:** qa-use

## Arguments

| Argument | Description |
|----------|-------------|
| `pr` | PR number (e.g., `#123`), URL, or omit to infer from current branch |
| `--base-url <url>` | Override base URL for ephemeral/preview deployments |
| `--concurrency <level>` | Control parallel execution: `sequential` (1 at a time), `low` (2), `medium` (3), `high` (all). Default: `medium` |

## What Happens

1. Parses PR context (number, title, branch)
2. Gets PR diff and identifies changed frontend files
3. Maps changed files to routes/features
4. Auto-discovers login test from cloud tests
5. **Spawns feature-verifier agents in parallel** (one per route/feature)
   - Each agent creates its own browser session
   - Each agent captures screenshots and evidence independently
   - Agents return structured results
6. Aggregates results from all agents
7. Generates unified markdown report with all evidence

## Examples

```
/qa-use:verify-pr #123
/qa-use:verify-pr https://github.com/owner/repo/pull/123
/qa-use:verify-pr                              # infer from current branch
/qa-use:verify-pr #123 --base-url https://preview-123.example.com
/qa-use:verify-pr #123 --concurrency high      # verify all features in parallel
/qa-use:verify-pr #123 --concurrency sequential    # one at a time (for debugging)
```

## Workflow

### Step 1: Parse PR Context

```bash
# If argument provided, use it
# Otherwise, infer from current branch:
gh pr view --json number,headRefName,url,title

# Fallback if gh unavailable (requires GITHUB_TOKEN):
curl -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/repos/{owner}/{repo}/pulls/{number}"
```

Parse for `--base-url <url>` flag - if provided, store for use in session creation and navigation.

### Step 2: Get PR Diff

```bash
gh pr diff <pr-number> --name-only  # Get list of changed files
gh pr diff <pr-number>              # Get full diff for analysis
```

### Step 3: Analyze Changes

- Filter for frontend files (`.tsx`, `.jsx`, `.ts`, `.js`, `.vue`, `.svelte`, `.css`, `.scss`)
- Map file paths to likely routes/features:
  - `src/pages/checkout.tsx` -> `/checkout`
  - `src/components/Button.tsx` -> component used across pages
  - `src/app/settings/page.tsx` -> `/settings` (Next.js app router)
- Identify components that changed vs pages

### Step 4: Discover Login Test or Fallback

```bash
# Try to find existing login test
qa-use test list --cloud --limit 1000 | grep -i -E "login|auth"
```

- Parse output to find test ID
- If multiple found, auto-select first match (note selection in report)
- **If none found**:
  1. Check app config: `qa-use info --json`
  2. Create session without `--after-test-id` and attempt manual login if credentials available
  3. Or proceed without auth and note in report

### Step 5: Prepare for Parallel Verification

From Step 3, you have a list of routes/features to verify. For each feature, prepare the agent input:

```json
{
  "features": [
    {
      "id": "autocomplete",
      "route": "/autocomplete",
      "description": "Autocomplete search with multi-select",
      "changed_files": ["src/app/autocomplete/page.tsx"]
    },
    {
      "id": "home",
      "route": "/",
      "description": "Home page navigation updated",
      "changed_files": ["src/app/page.tsx"]
    }
  ],
  "login_test_id": "<uuid from Step 4>",
  "base_url": "<--base-url flag or app config base_url>"
}
```

**Variables for session creation** (pass to each agent):
| Variable | Description |
|----------|-------------|
| `base_url` | Base URL for the app (e.g., preview deployment) |
| `login_url` | Login page URL |
| `login_test_id` | UUID of login test to run before verification |

### Step 6: Spawn Feature-Verifier Agents

Parse `--concurrency` flag (default: `medium`):
- `sequential`: 1 agent at a time
- `low`: 2 agents in parallel
- `medium`: 3 agents in parallel
- `high`: all agents in parallel

For EACH feature identified, spawn a **feature-verifier agent** respecting concurrency limit:

```
Spawn Task agents in parallel with subagent_type=qa-use:feature-verifier:
[
  {
    "feature_id": "autocomplete",
    "route": "/autocomplete",
    "description": "Autocomplete search with multi-select",
    "base_url": "<base_url>",
    "login_test_id": "<login_test_id>",
    "pr_number": "<pr>"
  },
  {
    "feature_id": "home",
    "route": "/",
    "description": "Home page navigation",
    "base_url": "<base_url>",
    "login_test_id": "<login_test_id>",
    "pr_number": "<pr>"
  }
]
```

**Each agent MUST return a structured result** (see Feature-Verifier Agent section below).

Wait for ALL agents to complete before proceeding to Step 7.

### Step 7: Aggregate Results (REDUCE)

Collect structured results from all feature-verifier agents:

```json
{
  "sessions": [
    {
      "feature_id": "autocomplete",
      "session_id": "<session-id-1>",
      "app_url": "<app_url>",
      "recording_url": "<recording_url>",
      "har_url": "<har_url>",
      "screenshots": {
        "initial": "https://presigned-url-to-initial.png",
        "final": "https://presigned-url-to-final.png"
      },
      "blocks_file": "/tmp/pr-verify-<pr>-autocomplete-blocks.json",
      "status": "verified|issues|failed",
      "findings": ["finding 1", "finding 2"]
    },
    {
      "feature_id": "home",
      "session_id": "<session-id-2>",
      ...
    }
  ]
}
```

**MANDATORY CHECKPOINT - All Results Collected**:
- [ ] All spawned agents have completed
- [ ] Each agent returned session_id, app_url, recording_url, har_url
- [ ] Each agent returned screenshot URLs (initial and final)
- [ ] Each agent returned blocks_file path

### Step 8: Verify Evidence Files

The feature-verifier agents close their own sessions. Screenshots are returned as pre-signed URLs (no local files). Verify blocks files exist:

```bash
# Verify blocks files exist (screenshots are URLs, not local files)
ls -la /tmp/pr-verify-<pr>-*-blocks.json

# Expected files per feature:
# /tmp/pr-verify-<pr>-<feature>-blocks.json
```

If any blocks files are missing, note which feature's agent failed to capture evidence. Screenshot URLs are returned in the agent's structured result.

## Feature-Verifier Agent

Each feature-verifier agent runs independently and MUST:

### Input

```json
{
  "feature_id": "string",      // Unique identifier for this feature
  "route": "string",           // Route to navigate to (e.g., "/autocomplete")
  "description": "string",     // What to verify
  "base_url": "string",        // Base URL for the app
  "login_test_id": "string",   // Login test UUID (optional)
  "pr_number": "string"        // PR number for file naming
}
```

### Agent Workflow

1. **Create session**:
   ```bash
   qa-use browser create --after-test-id <login_test_id> --viewport desktop \
     --var base_url=<base_url>
   ```
   Store: `SESSION_ID`

2. **Get session info**:
   ```bash
   qa-use browser status --json
   ```
   Store: `APP_URL`

3. **Capture initial screenshot**:
   ```bash
   INITIAL_SCREENSHOT_URL=$(qa-use browser screenshot --url)
   ```

4. **Navigate and verify**:
   ```bash
   qa-use browser goto <base_url><route>
   ```
   Perform verification interactions based on `description`.

5. **Capture final screenshot**:
   ```bash
   FINAL_SCREENSHOT_URL=$(qa-use browser screenshot --url)
   ```

6. **Capture action blocks**:
   ```bash
   qa-use browser get-blocks > /tmp/pr-verify-<pr>-<feature_id>-blocks.json
   ```

7. **Close session and get artifacts**:
   ```bash
   qa-use browser close
   qa-use browser status -s <SESSION_ID> --json
   ```
   Store: `RECORDING_URL`, `HAR_URL`

### Required Output

The agent MUST return this structured result:

```json
{
  "feature_id": "<feature_id>",
  "session_id": "<SESSION_ID>",
  "app_url": "<APP_URL>",
  "recording_url": "<RECORDING_URL>",
  "har_url": "<HAR_URL>",
  "screenshots": {
    "initial": "https://presigned-url-to-initial-screenshot.png",
    "final": "https://presigned-url-to-final-screenshot.png"
  },
  "blocks_file": "/tmp/pr-verify-<pr>-<feature_id>-blocks.json",
  "status": "verified|issues|failed",
  "findings": [
    "Finding 1",
    "Finding 2"
  ]
}
```

**CRITICAL**: All fields are REQUIRED. If any field cannot be captured, include it with an error message explaining why (e.g., `"recording_url": "ERROR: Session closed before recording available"`).

### Step 9: Generate Report

Output markdown report to:
- stdout (for immediate viewing)
- `/tmp/pr-verify-report-<pr>.md` (for `gh pr comment`)

## Report Template

```markdown
## PR Verification Report

**PR**: #<number> - <title>
**Branch**: <branch>
**Verified**: <timestamp>

### Sessions

| Feature | Session ID | Live View | Recording | HAR Logs |
|---------|------------|-----------|-----------|----------|
| <feature_id> | `<session_id>` | [View](<app_url>) | [Video](<recording_url>) | [Logs](<har_url>) |
| <feature_id> | `<session_id>` | [View](<app_url>) | [Video](<recording_url>) | [Logs](<har_url>) |

### Changes Analyzed
| File | Type | Route/Feature |
|------|------|---------------|
| <file> | <page/component> | <route> |

### Verification Results

#### <Feature ID 1>: <Route>
**Status**: ✅ Verified / ⚠️ Issues Found / ❌ Failed
**Session**: `<session_id>`

**Screenshots**:
| State | Preview |
|-------|---------|
| Initial | ![Initial](<initial_screenshot_url>) |
| Final | ![Final](<final_screenshot_url>) |

**Findings**:
- <finding from agent>
- <finding from agent>

**Actions Performed**:
```json
<contents of /tmp/pr-verify-<pr>-<feature>-blocks.json or summary>
```

---

#### <Feature ID 2>: <Route>
(repeat structure)

### Proposed Tests
If new tests are recommended based on verification:
- **Suggested test**: `<test-name>`
- **Covers**: <description of what it would test>
- **Depends on**: `login-test`

---
*Report saved to: `/tmp/pr-verify-report-<pr>.md`*
*To comment on PR: `gh pr comment <pr> --body-file /tmp/pr-verify-report-<pr>.md`*
```

## Error Handling (Autonomous/CI Mode)

All error handling assumes non-interactive execution in CI. Detection: Check for `CI=true` or `GITHUB_ACTIONS=true` environment variables.

| Scenario | Action |
|----------|--------|
| No login test found | Attempt manual login via app config credentials; if that fails, proceed without auth and note in report |
| Session creation fails | Report error with troubleshooting steps, exit with non-zero code |
| Navigation blocked (login wall, CAPTCHA) | Report partial findings, note blocker in report, continue to next area |
| Multiple login tests found | Auto-select first match, note selection in report |
| Multiple PRs match branch | Use most recent PR, note in report |
| No frontend changes detected | Report "no frontend changes" and exit successfully (nothing to verify) |

## Parallel Session Safety

- Include PR number in all temp file paths: `/tmp/pr-verify-<pr>-*`
- Session is unique per invocation (browser create generates unique ID)
- No shared state between parallel runs

## CI Exit Codes

- **Exit 0**: Verification completed (even with warnings/partial results)
- **Exit 1**: Hard failure (no PR context, API key missing, session creation failed)
- Report always generated regardless of exit code (for PR comment posting)

## Prerequisites

Before using this command, ensure:

1. **qa-use CLI configured**: API key set via `QA_USE_API_KEY` env var or `~/.qa-use.json`
2. **GitHub CLI (`gh`) available**: Required for PR context
   - GitHub Actions: Pre-installed and auto-authenticated via `GITHUB_TOKEN`
   - Local: Install via `brew install gh` or see [cli.github.com](https://cli.github.com)
3. **Login test in cloud** (optional): If a test with "login" or "auth" in name exists, it will be used
4. **App accessible**: Either running locally or via accessible URL

## CI Integration

See [references/ci.md](../skills/qa-use/references/ci.md) for GitHub Actions setup guide.
