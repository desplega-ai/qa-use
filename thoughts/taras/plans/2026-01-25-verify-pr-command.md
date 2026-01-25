---
date: 2026-01-25T03:00:00Z
topic: "verify-pr Command Implementation"
status: implemented
---

# `/qa-use:verify-pr` Command Implementation Plan

## Implementation Status

**Status: ✅ Implemented** (2026-01-25)

### Completed:
- [x] CLI `--var` flag on `browser create` and `browser run`
- [x] `--var` works independently (not tied to `--after-test-id`)
- [x] Common vars documented: `base_url`, `login_url`, `login_username`, `login_password`
- [x] Command file: `plugins/qa-use/commands/verify-pr.md`
- [x] CI reference: `plugins/qa-use/skills/qa-use/references/ci.md`
- [x] SKILL.md updated with Variable Overrides section

### Files Modified/Created:
- `lib/api/browser-types.ts` - Added `vars` to `CreateBrowserSessionOptions`
- `lib/api/browser.ts` - Pass `vars` in `createSession`
- `src/cli/commands/browser/create.ts` - Added `--var` flag
- `src/cli/commands/browser/run.ts` - Added `--var` flag
- `plugins/qa-use/commands/verify-pr.md` - New command
- `plugins/qa-use/skills/qa-use/references/ci.md` - New CI guide
- `plugins/qa-use/skills/qa-use/SKILL.md` - Added Variable Overrides section

### Pending Manual Testing:
- [ ] Command appears in Claude Code completions when typing `/qa-use:`
- [ ] Test with a real PR: `/qa-use:verify-pr #<test-pr>`
- [ ] Test with ephemeral URL: `/qa-use:verify-pr #<test-pr> --base-url <preview-url>`

---

## Overview

Implement a new slash command `/qa-use:verify-pr` that orchestrates PR verification using the qa-use CLI and plugin system. The command analyzes a PR's frontend changes, starts an authenticated browser session, validates changed areas using the browser-navigator agent, captures evidence (screenshots, action blocks), and generates a comprehensive report.

## Current State Analysis

### Existing Building Blocks:
- **CLI commands**: `qa-use browser create/goto/snapshot/screenshot/close`, `qa-use test list`, etc. (`src/cli/commands/`)
- **browser-navigator agent**: Autonomous browsing with snapshot-action loops (`plugins/qa-use/agents/browser-navigator.md`)
- **qa-use skill**: Provides `allowed-tools: Bash(qa-use *)` permission (`plugins/qa-use/skills/qa-use/SKILL.md`)
- **Existing commands**: `/qa-use:verify`, `/qa-use:explore` as reference patterns (`plugins/qa-use/commands/`)

### Key Discoveries:
- Commands link to skills via `**Invokes skill:** qa-use` directive (`plugins/qa-use/commands/verify.md:10`)
- `--after-test-id` flag enables authenticated sessions (`src/cli/commands/browser/create.ts`)
- Session status includes `app_url` (live), `recording_url` and `har_url` (post-close)
- Parallel sessions are supported but need unique identification to avoid collision

## Desired End State

A working `/qa-use:verify-pr` command that:
1. Accepts PR number/URL or infers from current branch
2. Analyzes changed frontend files and maps to features/routes
3. Auto-discovers login test from cloud tests
4. Creates authenticated browser session with collision-safe naming
5. Spawns browser-navigator agent(s) to explore changed areas
6. Captures screenshots and action blocks as evidence
7. Generates markdown report to stdout AND temp file
8. Provides app_url for live viewing and recording_url post-close

### Verification:
```bash
# Test the command
/qa-use:verify-pr #123
/qa-use:verify-pr https://github.com/owner/repo/pull/123
/qa-use:verify-pr  # (infers from current branch)
/qa-use:verify-pr #123 --base-url https://preview-123.example.com  # ephemeral URL
```

## Quick Verification Reference

Commands to verify implementation:
- Syntax check: Review markdown structure matches existing commands
- Plugin load: Check command appears in Claude Code's `/qa-use:` completions
- Manual test: Run command against a real PR

Key files to check:
- `plugins/qa-use/commands/verify-pr.md` (new command)
- `plugins/qa-use/skills/qa-use/references/ci.md` (new CI guide)
- `plugins/qa-use/agents/browser-navigator.md` (referenced agent)
- `plugins/qa-use/skills/qa-use/SKILL.md` (invoked skill)

## What We're NOT Doing

- **NO direct MCP tool usage** - CLI + plugin only
- **NO auto-generating tests** - Only propose them in the report
- **NO auto-posting PR comments** - User controls that via `gh pr comment`
- **NO new agents** - Use existing browser-navigator

## CLI Prerequisite: Variable Override on `browser create` ✅ IMPLEMENTED

The `--var` flag is now available on both `browser create` and `browser run`:

```bash
# Works independently (no --after-test-id required)
qa-use browser create --var base_url=https://preview-123.example.com

# With after-test-id for authenticated sessions
qa-use browser create --after-test-id <id> \
  --var base_url=https://preview-123.example.com \
  --var login_url=https://preview-123.example.com/auth/login
```

**Common variables** (documented in CLI help and SKILL.md):
| Variable | Description |
|----------|-------------|
| `base_url` | Base URL for the app (e.g., preview deployment) |
| `login_url` | Login page URL |
| `login_username` | Username/email for authentication |
| `login_password` | Password for authentication |

**API Contract**:
```typescript
POST /sessions
{
  after_test_id: "uuid",  // optional
  vars: {
    base_url: "https://preview-123.example.com",
    login_url: "https://preview-123.example.com/auth/login"
  }
}
```

## Prerequisites / Setup Required

Before using `/qa-use:verify-pr`, users need:

1. **qa-use CLI configured**: API key set via `QA_USE_API_KEY` env var or `~/.qa-use.json`
2. **GitHub CLI (`gh`) available**: Required for PR context (`gh pr view`, `gh pr diff`)
   - **GitHub Actions**: Pre-installed and auto-authenticated via `GITHUB_TOKEN`
   - **Local/other CI**: Install via `brew install gh` or see [cli.github.com](https://cli.github.com)
   - **Fallback**: If `gh` is unavailable, command can use GitHub REST API via `curl` with `GITHUB_TOKEN`
3. **Login test in cloud** (optional): If a test with "login" or "auth" in name exists, it will be used for authenticated sessions
   - **Fallback if none found**: Command will check app config via `qa-use info` and attempt manual login using configured credentials
4. **App accessible**: Either running locally or via accessible URL
   - **Ephemeral URLs**: Use `--base-url <url>` flag to override the app config's base_url for preview deployments

## Implementation Approach

Single command file that orchestrates the workflow using:
- `gh` CLI for PR context
- `qa-use` CLI for browser automation
- `browser-navigator` agent for exploration
- Structured markdown output

### Headless/CI Mode (GitHub Actions)

**Critical**: In CI environments (GitHub Actions), Claude runs non-interactively. The command MUST:
- **NO `AskUserQuestion` calls** - make autonomous decisions with sensible defaults
- **NO user prompts** - proceed with best-effort approach
- **Auto-select first match** when multiple options exist (e.g., multiple login tests)
- **Continue on soft failures** - report issues in output but don't block
- **Fail fast on hard failures** - missing API key, no PR context, etc.

Detection: Check for `CI=true` or `GITHUB_ACTIONS=true` environment variables to enable fully autonomous mode.

---

## Phase 1: Create verify-pr Command

### Overview

Create the `/qa-use:verify-pr` command file with full workflow implementation.

### Changes Required:

#### 1. New Command File
**File**: `plugins/qa-use/commands/verify-pr.md`

#### 2. New Reference Document
**File**: `plugins/qa-use/skills/qa-use/references/ci.md`
**Content**: GitHub Actions setup guide including:
- Basic workflow example
- Preview deployment integration (Vercel/Netlify)
- Pre-installed tools on GitHub runners
- Required secrets and how to obtain them
- Getting `CLAUDE_CODE_OAUTH_TOKEN` locally via `claude setup-token`
- Headless/autonomous mode behavior (`CI=true`)
- Exit codes for CI integration
**Content**: Complete command definition with:

##### Frontmatter
```yaml
---
description: Verify a PR's frontend changes through browser automation
argument-hint: [PR number or URL] [--base-url <url>]
---
```

##### Command Structure
- `**Invokes skill:** qa-use` to get CLI permissions
- Arguments table for PR input and options
- Full workflow documentation

##### Arguments

| Argument | Description |
|----------|-------------|
| `pr` | PR number (e.g., `#123`), URL, or omit to infer from current branch |
| `--base-url <url>` | Override base URL for ephemeral/preview deployments |

##### Workflow Steps

**Step 1: Parse PR Context**
```bash
# If argument provided, use it
# Otherwise, infer from current branch:
gh pr view --json number,headRefName,url,title

# Fallback if gh unavailable (requires GITHUB_TOKEN):
curl -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/repos/{owner}/{repo}/pulls/{number}"
```

**Step 1b: Parse Options**
- Check for `--base-url <url>` flag
- If provided, store for use in session creation and navigation

**Step 2: Get PR Diff**
```bash
gh pr diff <pr-number> --name-only  # Get list of changed files
gh pr diff <pr-number>              # Get full diff for analysis
```

**Step 3: Analyze Changes**
- Filter for frontend files (`.tsx`, `.jsx`, `.ts`, `.js`, `.vue`, `.svelte`, etc.)
- Map file paths to likely routes/features (e.g., `src/pages/checkout.tsx` → `/checkout`)
- Identify components that changed vs pages

**Step 4: Discover Login Test or Fallback**
```bash
# Try to find existing login test
qa-use test list --cloud --limit 1000 | grep -i -E "login|auth"
```
- Parse output to find test ID
- If multiple found, auto-select first match (note selection in report)
- **If none found**:
  1. Check app config: `qa-use info --json`
  2. Extract login credentials from config (if available)
  3. Create session without `--after-test-id` and perform manual login:
     ```bash
     qa-use browser create --viewport desktop
     qa-use browser goto <login_url from config>
     # Use snapshot + fill + click to complete login form
     ```

**Step 5: Create Browser Session**
```bash
# Without ephemeral URL override:
qa-use browser create --after-test-id <login-test-uuid> --viewport desktop

# With ephemeral URL override (--base-url flag provided):
qa-use browser create --after-test-id <login-test-uuid> --viewport desktop \
  --var base_url=<ephemeral-url>
```
- Store session ID for cleanup
- Get initial `app_url` from `qa-use browser status --json`
- The `--var` flag ensures the login test runs against the ephemeral URL

**Step 6: Navigate and Validate Changed Areas**
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

**Step 7: Capture Evidence**
```bash
qa-use browser get-blocks > /tmp/pr-verify-<pr>-blocks.json
qa-use browser screenshot /tmp/pr-verify-<pr>-final.png
qa-use browser status --json > /tmp/pr-verify-<pr>-status.json
```

**Step 8: Close Session and Get Artifacts**
```bash
qa-use browser close
# Session ID is still accessible for status
qa-use browser status -s <session-id> --json  # Get recording_url, har_url
```

**Step 9: Generate Report**
Output markdown report to:
- stdout (for immediate viewing)
- `/tmp/pr-verify-report-<pr>.md` (for `gh pr comment`)

##### Report Template
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

##### Error Handling (Autonomous/CI Mode)

All error handling assumes non-interactive execution. No user prompts.

- **No login test found**: Attempt manual login via app config credentials; if that fails, proceed without auth and note in report
- **Session creation fails**: Report error with troubleshooting steps, exit with non-zero code
- **Navigation blocked (login wall, CAPTCHA)**: Report partial findings, note blocker in report, continue to next area
- **Multiple login tests found**: Auto-select first match, note selection in report
- **Multiple PRs match branch**: Use most recent PR, note in report
- **No frontend changes detected**: Report "no frontend changes" and exit successfully (nothing to verify)

##### Parallel Session Safety
- Include PR number in all temp file paths: `/tmp/pr-verify-<pr>-*`
- Session is unique per invocation (browser create generates unique ID)
- No shared state between parallel runs

##### CI Exit Codes
- **Exit 0**: Verification completed (even with warnings/partial results)
- **Exit 1**: Hard failure (no PR context, API key missing, session creation failed)
- Report always generated regardless of exit code (for PR comment posting)

### Success Criteria:

#### Automated Verification:
- [ ] Command file exists: `ls plugins/qa-use/commands/verify-pr.md`
- [ ] CI reference doc exists: `ls plugins/qa-use/skills/qa-use/references/ci.md`
- [ ] Markdown syntax valid: No structural errors in the files
- [ ] Frontmatter present: `head -5 plugins/qa-use/commands/verify-pr.md | grep "description:"`
- [ ] CLI --var flag on create: `qa-use browser create --help | grep -q "\-\-var"`

#### Manual Verification:
- [ ] Command appears in Claude Code completions when typing `/qa-use:`
- [ ] Test with a real PR: `/qa-use:verify-pr #<test-pr>`
- [ ] Test with ephemeral URL: `/qa-use:verify-pr #<test-pr> --base-url <preview-url>`
- [ ] Report is generated to both stdout and temp file
- [ ] Screenshots are captured at expected paths
- [ ] browser-navigator agent is spawned for exploration
- [ ] Login test runs against ephemeral URL when `--base-url` provided

**Implementation Note**: After completing this phase, pause for manual confirmation. Test the command with a real PR to validate the full workflow.

---

## Testing Strategy

### Unit Testing
- N/A (this is a prompt/command file, not code)

### Integration Testing
1. **Parse PR context**: Test with PR number, URL, and branch inference
2. **Login test discovery**: Verify `qa-use test list --cloud --limit 1000` filtering works
3. **Session lifecycle**: Create → interact → close → get artifacts
4. **Report generation**: Verify markdown structure and file output

### Manual Testing (Interactive)
1. Create a test PR with frontend changes
2. Run `/qa-use:verify-pr <pr-number>`
3. Verify:
   - Correct files identified from diff
   - Login test auto-discovered
   - Browser session created with auth
   - Navigation agent explores changed routes
   - Screenshots captured
   - Report generated with all sections

### CI/Headless Testing
1. Set `CI=true` or `GITHUB_ACTIONS=true` environment variable
2. Run command and verify:
   - No interactive prompts occur
   - First login test auto-selected when multiple exist
   - Soft failures logged but don't block execution
   - Report generated and saved to file
   - Exit code 0 on success, 1 on hard failure

### Edge Cases
- PR with no frontend changes → clean exit, report says "nothing to verify"
- No login test available → fallback to manual login or proceed without auth
- Already on PR branch (no arg needed)
- Ephemeral URL provided via `--base-url`
- Multiple PRs for same branch → auto-select most recent

## GitHub Actions Setup

Example workflow to run PR verification automatically:

```yaml
# .github/workflows/pr-verify.yml
name: PR Verification

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  verify-pr:
    runs-on: ubuntu-latest
    # Optional: only run on PRs with frontend changes
    # if: contains(github.event.pull_request.labels.*.name, 'frontend')

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for diff analysis

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Claude Code CLI
        run: |
          curl -fsSL https://claude.ai/install.sh | bash
          echo "$HOME/.local/bin" >> $GITHUB_PATH

      - name: Install qa-use plugin and CLI
        run: |
          claude mcp add-from-marketplace qa-use
          npm install -g @desplega.ai/qa-use

      - name: Run PR Verification
        env:
          CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          QA_USE_API_KEY: ${{ secrets.QA_USE_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          CI: true
        run: |
          # Run Claude Code with the verify-pr command
          # For ephemeral preview URLs, add --base-url flag
          claude --print "/qa-use:verify-pr #${{ github.event.pull_request.number }}"

          # Alternative with preview URL from deployment:
          # claude --print "/qa-use:verify-pr #${{ github.event.pull_request.number }} --base-url ${{ steps.deploy.outputs.preview_url }}"

      - name: Post Report to PR
        if: always()  # Post even if verification had warnings
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          if [ -f /tmp/pr-verify-report-${{ github.event.pull_request.number }}.md ]; then
            gh pr comment ${{ github.event.pull_request.number }} \
              --body-file /tmp/pr-verify-report-${{ github.event.pull_request.number }}.md
          fi
```

### With Preview Deployment (Vercel/Netlify)

```yaml
jobs:
  verify-pr:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Claude Code CLI
        run: |
          curl -fsSL https://claude.ai/install.sh | bash
          echo "$HOME/.local/bin" >> $GITHUB_PATH

      - name: Install qa-use plugin and CLI
        run: |
          claude mcp add-from-marketplace qa-use
          npm install -g @desplega.ai/qa-use

      # Wait for Vercel preview deployment
      - name: Wait for Vercel Preview
        uses: patrickedqvist/wait-for-vercel-preview@v1.3.1
        id: vercel
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          max_timeout: 300

      - name: Run PR Verification
        env:
          CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          QA_USE_API_KEY: ${{ secrets.QA_USE_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          CI: true
        run: |
          claude --print "/qa-use:verify-pr #${{ github.event.pull_request.number }} --base-url ${{ steps.vercel.outputs.url }}"
```

### Pre-installed Tools

GitHub-hosted runners include:
- **`gh` CLI** - Pre-installed and auto-authenticated via `GITHUB_TOKEN` (no setup needed)
- **Node.js** - Available, but we pin version for consistency
- **git** - Pre-installed with full functionality

### Required Secrets

| Secret | Description | How to Get |
|--------|-------------|------------|
| `CLAUDE_CODE_OAUTH_TOKEN` | OAuth token for Claude Code authentication | Run `claude setup-token` locally (see below) |
| `QA_USE_API_KEY` | qa-use/desplega.ai API key | From desplega.ai dashboard |
| `GITHUB_TOKEN` | Auto-provided by GitHub Actions | No setup needed (automatic) |

### Getting CLAUDE_CODE_OAUTH_TOKEN

Run locally to generate and retrieve your OAuth token:

```bash
# This will authenticate and store the token locally
claude setup-token

# The token is stored in ~/.claude/.credentials.json
# Copy the token value and add it as a GitHub secret
```

Claude Code automatically picks up `CLAUDE_CODE_OAUTH_TOKEN` from the environment when running in CI.

## References

- Research document: `thoughts/taras/research/2026-01-25-pr-verification-workflow.md`
- Existing verify command: `plugins/qa-use/commands/verify.md`
- Browser navigator agent: `plugins/qa-use/agents/browser-navigator.md`
- qa-use skill: `plugins/qa-use/skills/qa-use/SKILL.md`
