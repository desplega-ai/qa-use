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

1. Spawns a **single `pr-verifier` agent** in the background
2. Agent analyzes the PR, identifies changed routes
3. Agent creates ONE browser session and verifies all features sequentially
4. Agent generates a concise visual report with inline screenshots
5. Report saved to `/tmp/pr-verify-report-<pr>.md`

You can continue working while verification runs in the background.

## Examples

```
/qa-use:verify-pr #123
/qa-use:verify-pr https://github.com/owner/repo/pull/123
/qa-use:verify-pr                              # infer from current branch
/qa-use:verify-pr #123 --base-url https://preview-123.example.com
```

## Workflow

### Step 1: Parse Arguments

Extract from arguments:
- `pr`: PR number/URL or empty (agent will infer from branch)
- `base_url`: Optional URL override from `--base-url` flag

### Step 2: Spawn PR-Verifier Agent

Spawn a single `pr-verifier` agent in background:

```
Task(
  subagent_type: "qa-use:pr-verifier",
  run_in_background: true,
  prompt: "Verify PR <pr> with base_url=<base_url>"
)
```

### Step 3: Return Immediately

Tell the user:
```
🚀 PR verification started in background.
   Progress: Check with TaskOutput
   Report will be at: /tmp/pr-verify-report-<pr>.md
   To post: gh pr comment <pr> --body-file /tmp/pr-verify-report-<pr>.md
```

## Report Format

The agent generates a concise visual report:

```markdown
## PR #123 Verification

**Branch**: `feature-branch` | **Verified**: 2024-01-25 14:30

### Summary
✅ 2 features verified | ⚠️ 1 issue found

---

### /autocomplete ✅
[Session](app_url) | [Recording](recording_url)

![Search results showing engineers](screenshot_url)

- Search returns results with debounce
- Multi-select chips work

---

### /home ⚠️
[Session](app_url) | [Recording](recording_url)

![Slow load visible](screenshot_url)

- Navigation link visible
- ⚠️ Slow load time (3s)
```

## Prerequisites

1. **qa-use CLI configured**: API key set via `QA_USE_API_KEY` or `~/.qa-use.json`
2. **GitHub CLI (`gh`) available**: For PR context
3. **App accessible**: Running locally or via preview URL

## CI Integration

See [references/ci.md](../skills/qa-use/references/ci.md) for GitHub Actions setup.
