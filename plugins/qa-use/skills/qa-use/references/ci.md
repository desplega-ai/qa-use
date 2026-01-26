# CI Integration Guide

Run qa-use verification in GitHub Actions and other CI environments.

## GitHub Actions Setup

### Basic Workflow

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
          claude --print "/qa-use:verify-pr #${{ github.event.pull_request.number }}"

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
# .github/workflows/pr-verify.yml
name: PR Verification

on:
  pull_request:
    branches:
      - main
    types: [opened, synchronize, reopened, ready_for_review]
  workflow_dispatch:
    inputs:
      pr_number:
        description: "PR number to verify"
        required: true
        type: number

concurrency:
  group: pr-verify-${{ github.event.pull_request.number || inputs.pr_number }}
  cancel-in-progress: true

jobs:
  verify-pr:
    if: github.event_name == 'workflow_dispatch' || github.event.pull_request.draft == false
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: read
      pull-requests: write
      statuses: read

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Full history for diff analysis

      - name: Check PR approval status
        id: approval
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          # REVIEW_DECISION=$(gh pr view ${{ github.event.pull_request.number || inputs.pr_number }} --json reviewDecision -q '.reviewDecision')
          # echo "Review decision: $REVIEW_DECISION"
          # if [ "$REVIEW_DECISION" != "APPROVED" ]; then
          #   echo "PR is not approved yet. Skipping verification."
          #   echo "approved=false" >> $GITHUB_OUTPUT
          # else
          #   echo "approved=true" >> $GITHUB_OUTPUT
          # fi
          # For demonstration purposes, we will assume all PRs are approved.
          echo "approved=true" >> $GITHUB_OUTPUT

      - name: Setup Node.js
        if: steps.approval.outputs.approved == 'true'
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install Claude Code CLI
        if: steps.approval.outputs.approved == 'true'
        run: |
          curl -fsSL https://claude.ai/install.sh | bash
          echo "$HOME/.local/bin" >> $GITHUB_PATH

      - name: Verify Claude CLI Installation
        if: steps.approval.outputs.approved == 'true'
        run: |
          claude --version || (echo "Claude CLI installation failed" && exit 1)

      - name: Install qa-use plugin and CLI
        if: steps.approval.outputs.approved == 'true'
        run: |
          claude plugin marketplace add desplega-ai/qa-use
          claude plugin install qa-use@desplega.ai
          npm install -g @desplega.ai/qa-use

      - name: Wait for Vercel Preview
        if: steps.approval.outputs.approved == 'true'
        uses: patrickedqvist/wait-for-vercel-preview@v1.3.1
        id: vercel
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          max_timeout: 300

      - name: Run PR Verification
        if: steps.approval.outputs.approved == 'true'
        env:
          CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          QA_USE_API_KEY: ${{ secrets.QA_USE_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          CI: true
        run: |
          # Run Claude Code with the verify-pr command using Vercel preview URL
          claude --print --verbose --dangerously-skip-permissions --output-format stream-json --model haiku "/qa-use:verify-pr #${{ github.event.pull_request.number || inputs.pr_number }} --base-url ${{ steps.vercel.outputs.url }}" 2>&1 | jq -c 'select(.type == "assistant" or .type == "tool_use" or .type == "result")'

      - name: Post Report to PR
        if: always() && steps.approval.outputs.approved == 'true'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          if [ -f /tmp/pr-verify-report-${{ github.event.pull_request.number || inputs.pr_number }}.md ]; then
            gh pr comment ${{ github.event.pull_request.number || inputs.pr_number }} \
              --body-file /tmp/pr-verify-report-${{ github.event.pull_request.number || inputs.pr_number }}.md
          fi

      - name: Upload Verification Artifacts
        if: always() && steps.approval.outputs.approved == 'true'
        uses: actions/upload-artifact@v4
        with:
          name: pr-verification-${{ github.event.pull_request.number || inputs.pr_number }}
          path: |
            /tmp/pr-verify-*.png
            /tmp/pr-verify-*.json
            /tmp/pr-verify-*.jsonl
            /tmp/pr-verify-*.log
            /tmp/pr-verify-report-*.md
```

### Netlify Preview Deployment

```yaml
      # Wait for Netlify preview deployment
      - name: Wait for Netlify Preview
        uses: jlevy-io/wait-for-netlify-deploy-with-headers@v1.0.1
        id: netlify
        with:
          site_name: 'your-netlify-site-name'
          max_timeout: 300

      - name: Run PR Verification
        env:
          CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          QA_USE_API_KEY: ${{ secrets.QA_USE_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          CI: true
        run: |
          claude --print "/qa-use:verify-pr #${{ github.event.pull_request.number }} --base-url ${{ steps.netlify.outputs.url }}"
```

## Variable Overrides

When running tests against preview deployments, you can override app config variables using `--var`:

```bash
qa-use browser create --after-test-id <login-test-uuid> \
  --var base_url=https://preview-123.example.com \
  --var login_url=https://preview-123.example.com/auth/login
```

Common app config variables:

| Variable | Description |
|----------|-------------|
| `base_url` | Base URL for the app (e.g., preview deployment) |
| `login_url` | Login page URL |
| `login_username` | Username/email for authentication |
| `login_password` | Password for authentication |

The `/qa-use:verify-pr` command handles this automatically when you pass `--base-url`.

## Pre-installed Tools on GitHub Runners

GitHub-hosted runners include:

| Tool | Status | Notes |
|------|--------|-------|
| `gh` CLI | Pre-installed | Auto-authenticated via `GITHUB_TOKEN` |
| Node.js | Available | Pin version for consistency |
| git | Pre-installed | Full functionality |
| curl | Pre-installed | For fallback API calls |

## Required Secrets

| Secret | Description | How to Get |
|--------|-------------|------------|
| `CLAUDE_CODE_OAUTH_TOKEN` | OAuth token for Claude Code authentication | Run `claude setup-token` locally (see below) |
| `QA_USE_API_KEY` | qa-use/desplega.ai API key | From [desplega.ai dashboard](https://desplega.ai) |
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

## Headless/Autonomous Mode

When `CI=true` or `GITHUB_ACTIONS=true` is set, the verify-pr command operates in fully autonomous mode:

| Behavior | Description |
|----------|-------------|
| No user prompts | Makes autonomous decisions with sensible defaults |
| Auto-select first match | When multiple options exist (e.g., login tests) |
| Continue on soft failures | Reports issues but doesn't block execution |
| Fail fast on hard failures | Missing API key, no PR context, etc. |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Verification completed (even with warnings/partial results) |
| 1 | Hard failure (no PR context, API key missing, session creation failed) |

The report is always generated regardless of exit code, allowing PR comments to be posted even on partial failures.

## Filtering by Label

To only run verification on PRs with specific labels:

```yaml
jobs:
  verify-pr:
    runs-on: ubuntu-latest
    if: contains(github.event.pull_request.labels.*.name, 'needs-verification')
```

Or to only run on frontend changes:

```yaml
on:
  pull_request:
    paths:
      - 'src/**/*.tsx'
      - 'src/**/*.jsx'
      - 'src/**/*.ts'
      - 'src/**/*.js'
      - 'src/**/*.vue'
      - 'src/**/*.svelte'
```

## Debugging

### View Raw Output

The command outputs a markdown report to stdout. To see raw output:

```yaml
- name: Run PR Verification
  run: |
    claude --print "/qa-use:verify-pr #${{ github.event.pull_request.number }}" 2>&1 | tee /tmp/verification-output.txt
```

### Check Session Artifacts

After verification, session artifacts are available:

```yaml
- name: Upload Verification Artifacts
  uses: actions/upload-artifact@v4
  if: always()
  with:
    name: pr-verification-${{ github.event.pull_request.number }}
    path: |
      /tmp/pr-verify-*.png
      /tmp/pr-verify-*.json
      /tmp/pr-verify-report-*.md
```

### Common Issues

| Issue | Solution |
|-------|----------|
| "API key not configured" | Ensure `QA_USE_API_KEY` secret is set |
| "No login test found" | Either upload a login test or the command will proceed without auth |
| "Session creation failed" | Check if `QA_USE_API_KEY` is valid and not expired |
| "gh: command not found" | `gh` should be pre-installed; ensure checkout step runs first |
