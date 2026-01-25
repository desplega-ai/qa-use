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

## What Happens

1. Parses PR context (number, title, branch)
2. Gets PR diff and identifies changed frontend files
3. Maps changed files to routes/features
4. Auto-discovers login test from cloud tests
5. Creates authenticated browser session
6. Spawns browser-navigator agent(s) to explore changed areas
7. Captures screenshots and action blocks as evidence
8. Generates markdown report to stdout AND temp file

## Examples

```
/qa-use:verify-pr #123
/qa-use:verify-pr https://github.com/owner/repo/pull/123
/qa-use:verify-pr                              # infer from current branch
/qa-use:verify-pr #123 --base-url https://preview-123.example.com
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

### Step 5: Create Browser Session

```bash
# Without ephemeral URL override:
qa-use browser create --after-test-id <login-test-uuid> --viewport desktop

# With ephemeral URL override (--base-url flag provided):
qa-use browser create --after-test-id <login-test-uuid> --viewport desktop \
  --var base_url=<ephemeral-url> \
  --var login_url=<ephemeral-url>/auth/login
```

Common `--var` overrides for app config:
| Variable | Description |
|----------|-------------|
| `base_url` | Base URL for the app (e.g., preview deployment) |
| `login_url` | Login page URL |
| `login_username` | Username/email for authentication |
| `login_password` | Password for authentication |

- Store session ID for cleanup
- Get initial `app_url` from `qa-use browser status --json`
- The `--var` flag ensures the login test runs against the ephemeral URL

### Step 6: Navigate and Validate Changed Areas

For each identified route/feature:

```
# Use --base-url override if provided, otherwise use app config base_url
base = <--base-url flag> || <app config base_url>

Spawn browser-navigator agent with:
{
  "goal": "Navigate to <route> and verify <feature description> is working. Take screenshots of key states.",
  "start_url": "<base><route>",
  "max_steps": 10
}
```

- Capture screenshots at each significant state
- Record findings from agent output

### Step 7: Capture Evidence

```bash
qa-use browser get-blocks > /tmp/pr-verify-<pr>-blocks.json
qa-use browser screenshot /tmp/pr-verify-<pr>-final.png
qa-use browser status --json > /tmp/pr-verify-<pr>-status.json
```

### Step 8: Close Session and Get Artifacts

```bash
qa-use browser close
# Session ID is still accessible for status
qa-use browser status -s <session-id> --json  # Get recording_url, har_url
```

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

### Session Info
- **Live View**: [App URL](<app_url>)
- **Recording**: [Video](<recording_url>) *(available after close)*
- **HAR Logs**: [Network Logs](<har_url>)

### Changes Analyzed
| File | Type | Route/Feature |
|------|------|---------------|
| <file> | <page/component> | <route> |

### Verification Results

#### <Route/Feature 1>
**Status**: ✅ Verified / ⚠️ Issues Found / ❌ Failed

**Screenshots**:
- Initial state: `/tmp/pr-verify-<pr>-<feature>-1.png`
- After interaction: `/tmp/pr-verify-<pr>-<feature>-2.png`

**Navigation Log**:
<browser-navigator output>

**Findings**:
- <finding 1>
- <finding 2>

### Actions Performed
<formatted get-blocks output>

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
