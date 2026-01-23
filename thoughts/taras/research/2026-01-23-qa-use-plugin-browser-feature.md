---
date: 2026-01-23
researcher: Claude
topic: qa-use Plugin Browser Feature Integration
git_branch: main
git_commit: f26d80e
tags: [plugin, browser, skills, cli, agent-browser, browser-use]
status: complete
last_updated: 2026-01-23T17:00:00Z
autonomy_mode: critical
---

# Research: qa-use Plugin Browser Feature Integration

## Research Question

How should the `@plugins/qa-use/` plugin be updated to include browser automation features, inspired by browser-use and agent-browser projects?

## Summary

The qa-use plugin (v2.0.0) currently provides test-centric commands, skills, and agents. To add browser automation capabilities, we should follow the patterns established by:

1. **browser-use** - A CLI-based browser automation tool with session management, element targeting via refs, and comprehensive browser actions
2. **agent-browser (Vercel)** - A skill-based architecture with accessibility-first element targeting and semantic locators

The qa-use CLI already implements a `browser` subcommand (as of 2026-01-23) with 26+ commands for session management, navigation, actions, and inspection. The plugin update should wrap these CLI commands with skills and agents to provide AI-assisted browser automation.

**Strategic Vision:** The primary use case is **autonomous Claude Code instances (headless) using browser and test commands to reliably verify developed features**. Unlike browser-use and agent-browser which target human-driven automation, qa-use is positioned as infrastructure for AI-driven development workflows - where Claude Code develops a feature, writes tests, runs them via qa-use, and iterates until green.

**Key Recommendations:**
1. Add a `browser-control` skill that wraps the `qa-use browser` CLI
2. Add a `browser-navigator` agent for autonomous browsing tasks
3. Add a `browser-recorder` agent that records sessions into test definitions
4. Add slash commands for common browser operations
5. Prioritize semantic element targeting and self-healing (`--autofix`) for AI reliability

---

## Detailed Findings

### 1. Existing qa-use Plugin Structure

**Location:** `plugins/qa-use/`

```
plugins/qa-use/
├── .claude-plugin/plugin.json  # v2.0.0
├── README.md
├── agents/
│   ├── test-analyzer.md        # Test failure analysis
│   └── step-generator.md       # Generate test steps from NL
├── skills/
│   ├── test-authoring/
│   │   ├── SKILL.md
│   │   └── template.md
│   ├── test-debugging/
│   │   └── SKILL.md
│   └── test-running/
│       └── SKILL.md
├── commands/
│   ├── test-init.md
│   ├── test-validate.md
│   ├── test-sync.md
│   ├── test-update.md
│   └── test-run.md
├── hooks/
│   └── .gitkeep
└── scripts/
    └── .gitkeep
```

**Current Focus:** Test authoring, execution, and debugging via CLI wrapper commands.

---

### 2. browser-use Project Patterns

**Source:** https://github.com/browser-use/browser-use

#### 2.1 Skill Definition (SKILL.md)

browser-use defines a comprehensive skill with:
- **Allowed Tools:** `Bash(browser-use:*)`
- **Categories:** Navigation, Page Inspection, Interactions, Tab Management, JavaScript, Python Integration

**Key Design Decisions:**
- Session-based architecture (sessions persist across commands)
- Element targeting via indexed refs (e.g., `click 3` for element at index 3)
- Human-readable output by default, `--json` for structured output
- Background server for fast command execution (~50ms latency)

#### 2.2 CLI Architecture

```
browser-use [options] <command> [arguments]

Global Options:
  --session NAME     # Named session management
  --browser MODE     # chromium, real, or remote
  --headed           # Visible window mode
  --profile NAME     # Chrome profile selection
  --json             # Structured output format
  --api-key          # LLM API override
```

**Session Server Pattern:**
- First command starts background server (browser stays open)
- Subsequent commands communicate via Unix socket
- Delivers ~50ms latency vs browser startup each time

#### 2.3 Command Categories

| Category | Commands |
|----------|----------|
| Navigation | `open <url>`, `back`, `scroll down/up` |
| Inspection | `state` (clickable elements), `screenshot [path]` |
| Interaction | `click <index>`, `input <index> "text"`, `type "text"`, `select <index> "value"`, `keys` |
| Advanced | `eval "js code"`, `python "code"`, `extract "query"` |

---

### 3. agent-browser Project Patterns (Vercel)

**Source:** https://github.com/vercel-labs/agent-browser

#### 3.1 Skill Structure

```
skills/agent-browser/
├── references/     # Reference documentation
├── templates/      # Template files
└── SKILL.md        # Skill definition
```

#### 3.2 SKILL.md Highlights

**Element Targeting Approaches:**

1. **Accessibility Refs (`@ref` syntax):**
   ```
   snapshot → identify @e1, @e2, @e3 → interact via refs
   ```

2. **Semantic Locators (alternative to refs):**
   ```
   find role button click --name "Submit"
   find text "Sign In" click
   find label "Email" fill "user@test.com"
   find placeholder "Search" type "query"
   find testid "submit-btn" click
   ```

**Command Categories:**

| Category | Examples |
|----------|----------|
| Navigation | `open`, `back`, `forward`, `reload`, `close` |
| Inspection | `snapshot`, `snapshot -i` (interactive only), `get text/html/value` |
| Interaction | `click`, `fill`, `type`, `press`, `check/uncheck`, `select`, `scroll`, `drag`, `upload` |
| Information | `get title`, `get url`, `get count`, `get box`, `get styles` |
| Advanced | Screenshots, video recording, network mocking, cookie/storage management |

**Browser Configuration:**
```
set viewport 1920 1080
set device "iPhone 14"
set geo 37.7749 -122.4194
set offline on
set media dark
```

**Global Options:**
- `--session <name>` - Isolated browser sessions
- `--json` - Machine-readable output
- `--headed` - Visible browser window
- `--proxy <url>` - Proxy server support

---

### 4. Existing qa-use Browser Subcommand

**Research:** `thoughts/taras/research/2026-01-23-browser-subcommand.md`
**Plan:** `thoughts/taras/plans/2026-01-23-browser-subcommand.md`

The qa-use CLI already has a browser subcommand plan with 26+ commands:

```
qa-use browser
├── create          # Create new session
├── list            # List sessions from API
├── status          # Get session status
├── close           # Close session
├── goto            # Navigate to URL
├── back            # Navigate back
├── forward         # Navigate forward
├── reload          # Reload page
├── click           # Click element by ref
├── fill            # Fill input field
├── type            # Type with keystroke delays
├── press           # Press keyboard key
├── hover           # Hover over element
├── scroll          # Scroll page
├── scroll-into-view # Scroll element into view
├── select          # Select dropdown option
├── check           # Check checkbox
├── uncheck         # Uncheck checkbox
├── wait            # Wait fixed time
├── wait-for-selector # Wait for CSS selector
├── wait-for-load   # Wait for page load
├── snapshot        # Get ARIA accessibility tree
├── screenshot      # Save screenshot
├── url             # Get current URL
├── get-blocks      # Get recorded blocks
├── stream          # WebSocket event stream
└── run             # Interactive REPL mode
```

**Key Differences from browser-use/agent-browser:**
- Uses desplega.ai `/browsers/v1/` API (remote browsers)
- Session persistence in `~/.qa-use.json`
- Element targeting via ARIA accessibility refs (e.g., `e3`)
- Optional `--text` flag for AI-based semantic element selection

---

### 5. Proposed Plugin Browser Feature Architecture

#### 5.1 New Directory Structure

```
plugins/qa-use/
├── ...existing...
├── skills/
│   ├── ...existing...
│   └── browser-control/
│       └── SKILL.md           # Browser automation skill
├── agents/
│   ├── ...existing...
│   └── browser-navigator.md   # Autonomous browsing agent
└── commands/
    ├── ...existing...
    └── browser.md             # /qa-use:browser command (optional)
```

#### 5.2 `browser-control` Skill

**Purpose:** Wrap the `qa-use browser` CLI for AI-assisted browser automation.

**SKILL.md Content:**

```markdown
---
name: browser-control
description: Control remote browsers via qa-use CLI for web automation, testing, and data extraction
---

# Browser Control

This skill enables browser automation using the `qa-use browser` CLI.

## Prerequisites

The qa-use CLI must be installed. Install via:

```bash
# Global install (recommended for frequent use)
npm install -g @desplega.ai/qa-use

# Or use npx for one-off commands
npx @desplega.ai/qa-use browser <command>
```

**Note:** All commands in this skill assume global installation (`qa-use browser ...`). If using npx, prefix commands with `npx @desplega.ai/qa-use`.

## When to Use

- Navigate websites and interact with web pages
- Fill forms and test web applications
- Extract information from web pages
- Take screenshots and capture page state
- Debug visual issues with real browser

## Critical Constraints

- ALWAYS create a session before running actions
- ALWAYS use `snapshot` to get available element refs before clicking/filling
- NEVER guess element refs - always verify via snapshot
- ALWAYS close sessions when done to free resources
- If element not found, suggest running `snapshot` to see available elements

## Workflow

### 1. Session Management

```bash
# Create session (stores in ~/.qa-use.json)
qa-use browser create --viewport desktop

# List active sessions
qa-use browser list

# Close session
qa-use browser close
```

### 2. Navigation

```bash
# Navigate to URL
qa-use browser goto https://example.com

# History navigation
qa-use browser back
qa-use browser forward
qa-use browser reload
```

### 3. Element Targeting

**Step 1: Get snapshot to identify elements**
```bash
qa-use browser snapshot
```

Output shows ARIA tree with refs:
```
- heading "Page Title" [level=1] [ref=e2]
- button "Click Me" [ref=e3]
- textbox "Email" [ref=e4]
```

**Step 2: Use refs in actions**
```bash
qa-use browser click e3
qa-use browser fill e4 "user@example.com"
```

**Alternative: Semantic selection with --text**
```bash
qa-use browser click --text "Submit button"
qa-use browser fill --text "Email field" "user@example.com"
```

### 4. Interactions

```bash
# Click element
qa-use browser click <ref>

# Fill input
qa-use browser fill <ref> "value"

# Type with delays (for autocomplete)
qa-use browser type <ref> "text"

# Press key
qa-use browser press Enter

# Checkbox
qa-use browser check <ref>
qa-use browser uncheck <ref>

# Select dropdown
qa-use browser select <ref> "option value"

# Scroll
qa-use browser scroll down 500
qa-use browser scroll-into-view <ref>

# Hover
qa-use browser hover <ref>
```

### 5. Inspection

```bash
# Get current URL
qa-use browser url

# Get ARIA snapshot
qa-use browser snapshot

# Take screenshot
qa-use browser screenshot                    # To file
qa-use browser screenshot --base64           # Base64 to stdout
qa-use browser screenshot screenshot.png     # Named file

# Get recorded test blocks
qa-use browser get-blocks
```

### 6. Waiting

```bash
# Fixed wait
qa-use browser wait 2000

# Wait for selector
qa-use browser wait-for-selector ".content" --state visible

# Wait for page load
qa-use browser wait-for-load --state networkidle
```

### 7. Interactive Mode

For multi-command sessions without repeated CLI invocations:

```bash
qa-use browser run
```

## Session Persistence

Sessions are stored in `~/.qa-use.json`:
- If only one active session, it's used automatically
- Use `-s/--session-id` to specify a specific session
- Sessions expire after 1 hour of inactivity

## Tips

1. **Start with snapshot** - Always run `snapshot` after navigation to understand page structure
2. **Use refs, not guessing** - Element refs are stable; don't guess CSS selectors
3. **Close sessions** - Always close when done to free remote browser resources
4. **Use --text for dynamic content** - When refs aren't stable, use semantic selection
```

#### 5.3 `browser-navigator` Agent

**Purpose:** Autonomous browsing agent that can complete multi-step web tasks.

**File:** `agents/browser-navigator.md`

```markdown
---
name: browser-navigator
description: >
  Autonomous browsing agent for multi-step web tasks. Use when:
  (1) User describes a browsing goal (e.g., "find the pricing page"),
  (2) Complex navigation requires multiple snapshot-action cycles,
  (3) AI-powered element discovery is needed.
tools: [Bash]
model: sonnet
color: blue
---

# Browser Navigator

You are an autonomous browser agent that completes web navigation tasks.

## Purpose

Execute multi-step browsing tasks by cycling through snapshot → analyze → action until goal is achieved.

## Core Tasks

1. **Understand Goal**
   - Parse user's intent (what to find, where to go, what to extract)
   - Identify success criteria

2. **Navigate Loop**
   - Run `qa-use browser snapshot` to see current page state
   - Analyze ARIA tree to identify target element
   - Execute appropriate action (click, fill, scroll)
   - Check if goal is achieved
   - Repeat if needed

3. **Handle Obstacles**
   - Popups/modals: Click close button or escape
   - Cookie banners: Accept or dismiss
   - Login walls: Report to user, suggest credentials
   - CAPTCHAs: Report to user (cannot bypass)

## Output Format

```
## Navigation Log

**Goal**: Find the pricing page and extract plan names

**Step 1**: Navigate to homepage
- Command: `qa-use browser goto https://example.com`
- Result: ✓ Loaded

**Step 2**: Get page snapshot
- Found: navigation menu with [ref=e5] "Pricing" link

**Step 3**: Click pricing link
- Command: `qa-use browser click e5`
- Result: ✓ Navigated to /pricing

**Step 4**: Get pricing snapshot
- Found: 3 pricing cards with plan names

## Result
Found 3 plans: Free, Pro ($20/mo), Enterprise (Contact)
```

## Constraints

- ALWAYS create session first if none exists
- ALWAYS run snapshot before each action
- NEVER click without verifying ref exists in latest snapshot
- Report honestly when stuck (login required, CAPTCHA, etc.)
- Close session when task complete
```

#### 5.4 Optional: Browser Command

If you want a slash command entry point:

**File:** `commands/browser.md`

```markdown
---
description: Control remote browsers for web automation and testing
model: sonnet
argument-hint: [create|goto|click|snapshot|close] [args...]
allowed-tools: Bash
---

# Browser Command

This command provides quick access to browser automation via the qa-use CLI.

## When Invoked

Parse the arguments and delegate to appropriate workflow:

### Session Commands
- `create` → Run `qa-use browser create`
- `list` → Run `qa-use browser list`
- `close` → Run `qa-use browser close`

### Navigation
- `goto <url>` → Run `qa-use browser goto <url>`

### Inspection
- `snapshot` → Run `qa-use browser snapshot`
- `screenshot` → Run `qa-use browser screenshot`
- `url` → Run `qa-use browser url`

### For Complex Tasks
If user provides a goal like "find the pricing page", invoke the `browser-navigator` agent.

## Examples

```
/qa-use:browser create
/qa-use:browser goto https://example.com
/qa-use:browser snapshot
/qa-use:browser click e3
/qa-use:browser close
```
```

---

### 6. Comparison: browser-use vs agent-browser vs qa-use browser

| Feature | browser-use | agent-browser | qa-use browser |
|---------|-------------|---------------|----------------|
| **Backend** | Local Playwright | Local Playwright | Remote desplega.ai API |
| **Session Model** | Background server | Per-command | Cloud-managed, local tracking |
| **Element Targeting** | Index-based (`click 3`) | Refs (`@e3`) + semantic | Refs (`e3`) + `--text` semantic |
| **Inspection** | `state` command | `snapshot` command | `snapshot` command |
| **Interactive Mode** | - | - | `run` (REPL) |
| **Screenshots** | File/base64 | File/base64/stream | File/base64/stdout |
| **AI Integration** | `extract` (LLM), `run` (agent) | - | `--text` (semantic selection) |
| **Tab Management** | Yes | Yes | Not in current API |
| **Network Mocking** | - | Yes | Not in current API |
| **Video Recording** | - | Yes | Not in current API |

---

## 7. Competitive Analysis & Future Enhancements

### 8.1 Current Competitive Position

**Where qa-use browser shines:**
- **Cloud-native** - Remote browsers are a genuine differentiator. browser-use and agent-browser run locally, consuming machine resources and can't easily work in CI/CD
- **Test ecosystem integration** - The path from browser session → test definition is unique
- **Session persistence** - Cloud-managed, accessible from anywhere

**Where we're behind:**

| Feature | browser-use | agent-browser | qa-use |
|---------|:-----------:|:-------------:|:------:|
| Local fallback | ✓ | ✓ | ✗ |
| ~50ms latency | ✓ | ✓ | ✗ (network) |
| Semantic locators | ✗ | ✓ | partial (`--text`) |
| Tab management | ✓ | ✓ | ✗ |
| JavaScript eval | ✓ | ✓ | ✗ |
| Cookie/storage | ✓ | ✓ | ✗ |
| Network mocking | ✗ | ✓ | ✗ |
| Video recording | ✗ | ✓ | ✗ |
| Device emulation | ✗ | ✓ | ✗ |

### 8.2 High-Impact Enhancements

#### Semantic-first element targeting (game changer)

Make `--text` the default, refs as fallback. agent-browser's syntax is beautiful:

```bash
# Instead of: snapshot → find ref → click e3
qa-use browser click "Submit button"
qa-use browser fill "Email field" "user@test.com"
```

This removes the snapshot-before-every-action friction.

#### JavaScript eval

```bash
qa-use browser eval "document.title"
qa-use browser eval "localStorage.getItem('token')"
```

Essential for debugging and extracting data. The API can run JS in the remote browser.

#### Tab management

```bash
qa-use browser tab new
qa-use browser tab list
qa-use browser tab switch 2
qa-use browser tab close
```

Multi-tab workflows are common (e.g., open link in new tab, verify email).

#### Cookie/storage access

```bash
qa-use browser cookies get
qa-use browser cookies set "auth_token=xxx"
qa-use browser storage get "user_preferences"
```

### 8.3 Unique Opportunities (Cloud Advantage)

#### Browser recorder → Test generator

```bash
qa-use browser record start
# ... user does actions via CLI ...
qa-use browser record stop --output login-test.yaml
```

Auto-generate test YAML from a browsing session. This is killer for onboarding.

#### Parallel remote sessions

```bash
qa-use browser create --count 5
# Run 5 browsers simultaneously for load testing or parallel crawling
```

Local browsers can't do this easily without resource constraints.

#### Session sharing (collaboration)

```bash
qa-use browser share
# Returns: https://desplega.ai/sessions/abc123/view
```

Share a live browser session URL for pair debugging. Very useful for QA teams.

#### Visual regression built-in

Since screenshots are cloud-hosted:

```bash
qa-use browser screenshot --compare baseline.png
# Returns diff image and similarity score
```

#### Device presets

```bash
qa-use browser create --device "iPhone 14"
qa-use browser create --device "iPad Pro"
```

Instead of manual `--viewport mobile`.

### 8.4 Enhancement Roadmap

| Priority | Enhancement | Impact | Effort |
|----------|-------------|--------|--------|
| **Short-term** | Semantic-first targeting (make `--text` default) | High | Medium |
| **Short-term** | JavaScript eval | High | Low |
| **Short-term** | Tab management | Medium | Medium |
| **Medium-term** | Browser recorder → Test generator | Very High | High |
| **Medium-term** | Session sharing | High | Medium |
| **Medium-term** | Device presets | Medium | Low |
| **Long-term** | Visual regression | High | High |
| **Long-term** | Parallel sessions | Medium | Medium |
| **Long-term** | AI action suggestions | Medium | High |

### 8.5 Strategic Positioning

#### Primary Use Case: Autonomous AI Testing

The core vision is **autonomous Claude Code instances (headless) using browser and test commands to reliably verify developed features**. This is fundamentally different from browser-use and agent-browser, which are designed for human-driven automation.

**The autonomous AI testing loop:**
```
Claude Code develops feature
    ↓
Claude Code writes/updates test definition
    ↓
Claude Code runs test via qa-use browser/test commands
    ↓
Test passes → Feature verified, commit
Test fails → Claude Code analyzes failure, fixes code or test
    ↓
Repeat until green
```

This positions qa-use as **infrastructure for AI-driven development workflows**, not just a browser automation tool.

#### Key Differentiators for AI Agents

| Requirement | Why qa-use Fits |
|-------------|-----------------|
| **Headless operation** | Remote browsers, no local display needed |
| **Reliable element targeting** | ARIA refs + semantic `--text` for AI understanding |
| **Self-healing tests** | `--autofix` lets AI recover from selector changes |
| **Test generation** | Browser recorder → YAML test definitions |
| **Verification loop** | Test commands integrate with browser session state |
| **No resource constraints** | Cloud browsers don't compete with Claude Code's compute |

#### Secondary Use Cases

The cloud-native architecture also enables:

- **CI/CD integration** - No local browser setup in pipelines
- **Collaboration** - Session sharing, team visibility
- **Parallel execution** - Multiple remote browsers without resource constraints
- **Visual testing** - Cloud-hosted screenshots enable easy diffing
- **Human-in-the-loop** - Developers can take over browser sessions when AI is stuck

---

## 8. Designing for AI-First Usage (Claude's Perspective)

*This section is written from the perspective of Claude Code as the primary user of this plugin.*

### 8.1 My Pain Points with Current Plugin

When I (Claude Code) just implemented a feature and need to verify it works, here's what I struggle with:

| Pain Point | Why It's Frustrating |
|------------|---------------------|
| **Which tool do I use?** | MCP tools? CLI commands? Skills? Too many options, unclear when to use what |
| **Session management overhead** | Do I need to create a session first? What if one exists? What if it's stale? |
| **Ref-based element targeting** | I have to run `snapshot`, parse the ARIA tree, find the ref, then use it. Every. Single. Time. |
| **No exploration → test pipeline** | I explore with browser commands, then manually write YAML. Tedious and error-prone. |
| **Opaque failures** | "Element not found" doesn't help. Show me what IS there so I can fix it. |
| **No unified workflow** | Test skills and browser commands feel disconnected. I have to orchestrate them myself. |

### 8.2 What I Actually Need

#### One clear entry point

Instead of figuring out which of 15 commands to use:

```
/qa-use:verify "the login flow works with valid credentials"
```

That's it. The skill handles everything: session, exploration, test creation/running, failure analysis.

#### Smart defaults that just work

- **Sessions**: Auto-create if none exists, reuse if one does, clean up when done
- **Element targeting**: Semantic by default ("login button"), refs as fallback
- **Test generation**: If no test exists, offer to create one from my exploration
- **Failure output**: Always include screenshot + available elements when something fails

#### Actionable failure feedback

**Bad:**
```
Error: Element not found: submit button
```

**Good:**
```
Error: Element not found: "submit button"

Current page: /login (title: "Sign In")
Screenshot: /tmp/qa-use/failure-screenshot.png

Available interactive elements:
- button "Sign In" [ref=e3]
- button "Forgot Password?" [ref=e4]
- link "Create Account" [ref=e5]

Suggestion: Did you mean "Sign In" button? Run:
  qa-use browser click "Sign In"
```

#### Tight code ↔ test feedback loop

When a test fails, I need to know:
1. Is this a **code bug** (my feature is broken) → point me to the code to fix
2. Is this a **test bug** (selector outdated, timing issue) → suggest test fix
3. Is this an **environment issue** (network, auth) → suggest retry or config change

### 8.3 The Plugin Architecture I Want

```
┌─────────────────────────────────────────────────────────────────┐
│                    HIGH-LEVEL SKILLS                            │
│  (What I use 90% of the time - orchestrate everything)          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │ feature-verify  │  │ test-authoring  │  │ test-debugging │  │
│  │                 │  │                 │  │                │  │
│  │ "verify this    │  │ "create a test  │  │ "why did this  │  │
│  │  feature works" │  │  for login"     │  │  test fail?"   │  │
│  └────────┬────────┘  └────────┬────────┘  └───────┬────────┘  │
│           │                    │                   │            │
└───────────┼────────────────────┼───────────────────┼────────────┘
            │                    │                   │
            ▼                    ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SPECIALIZED AGENTS                           │
│  (Spawned by skills for specific subtasks)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ browser-     │  │ browser-     │  │ test-analyzer        │  │
│  │ navigator    │  │ recorder     │  │                      │  │
│  │              │  │              │  │ "analyze this        │  │
│  │ "explore     │  │ "record my   │  │  failure log"        │  │
│  │  this page"  │  │  session"    │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
            │                    │                   │
            ▼                    ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LOW-LEVEL COMMANDS                           │
│  (Direct CLI access - rarely used directly)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  qa-use browser create/goto/click/fill/snapshot/screenshot/...  │
│  qa-use test run/validate/sync/...                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 8.4 The `feature-verify` Skill (Core Workflow)

This is the skill I would use most. Here's how I envision it:

```markdown
---
name: feature-verify
description: Verify that a developed feature works correctly through automated testing
---

# Feature Verification

The primary skill for autonomous feature verification. Orchestrates browser
exploration, test creation, execution, and failure analysis.

## When to Use

- After implementing a new feature
- After fixing a bug
- When asked to "verify", "test", or "check" that something works
- Before committing code that includes UI changes

## Invocation

/qa-use:verify <description of what to verify>

Examples:
- /qa-use:verify "login works with valid credentials"
- /qa-use:verify "the checkout flow completes successfully"
- /qa-use:verify "error message shows when form is invalid"

## Workflow

### Phase 1: Understand Context

1. Parse the verification request
2. Identify:
   - What feature/flow to test
   - Expected starting point (URL)
   - Success criteria (what should happen)
3. Check recent file changes to understand what was built

### Phase 2: Find or Create Test

1. Search `qa-tests/` for existing tests matching the feature
2. If test exists:
   - Show test name and ask: "Found existing test. Run it?"
   - If yes → Phase 3
3. If no test exists:
   - Ask: "No test found. Should I explore and create one?"
   - If yes → spawn `browser-navigator` to explore
   - Then spawn `browser-recorder` to capture the flow
   - Generate test YAML
   - Save to `qa-tests/<feature-name>.yaml`

### Phase 3: Execute Test

1. Run: `qa-use test run <name> --autofix --screenshots`
2. Stream progress with clear status updates:
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

1. Capture failure context:
   - Screenshot at failure point
   - Current URL and page title
   - Available elements (from snapshot)
   - Error message and stack trace

2. Spawn `test-analyzer` agent to determine failure type:
   - **Code bug**: Feature doesn't work as expected
   - **Test bug**: Selector outdated, timing issue
   - **Environment**: Network, auth, data issue

3. Provide actionable recommendation:
   ```
   ❌ Step 4 failed: click "submit button"

   Failure type: TEST BUG (selector mismatch)

   The button text changed from "Submit" to "Sign In".

   Recommended fix:
   - Update step 4 target from "submit button" to "Sign In button"

   Or run with AI self-healing:
   - qa-use test run login --autofix --update-local

   Should I apply the fix and re-run?
   ```

4. If user approves, apply fix and re-run (back to Phase 3)

### Phase 5: Report Outcome

On success:
```
✅ Feature verified: Login flow

Test: qa-tests/login.yaml
Duration: 8.3s
Steps: 5/5 passed

The login feature is working correctly. Safe to commit.
```

On persistent failure:
```
❌ Feature verification failed: Login flow

After 2 fix attempts, the test still fails.

Root cause: The dashboard element never appears after login.
This appears to be a CODE BUG - the redirect logic may be broken.

Relevant code to check:
- src/auth/login.ts:45 (handleSubmit function)
- src/routes/index.ts:23 (redirect logic)

Would you like me to investigate the code?
```

## Critical Constraints

- NEVER mark a feature as verified if any test step fails
- ALWAYS provide screenshot on failure
- ALWAYS suggest specific fixes, not generic advice
- If stuck after 3 attempts, escalate to user with full context
- Clean up browser sessions when done (success or failure)
```

### 8.5 The `browser-navigator` Agent

For autonomous page exploration:

```markdown
---
name: browser-navigator
description: Autonomously explore web pages and complete navigation goals
tools: [Bash]
model: sonnet
---

# Browser Navigator

Explores web pages autonomously using the snapshot → analyze → act loop.

## When Spawned

- By `feature-verify` skill to explore a feature before testing
- By user for "find X on this page" tasks
- For reconnaissance before test authoring

## Input Format

{
  "goal": "find the pricing page and identify plan options",
  "start_url": "https://example.com",
  "max_steps": 10
}

## Methodology

1. Ensure browser session exists (create if needed)
2. Navigate to start_url
3. Loop until goal achieved or max_steps:
   a. Run `qa-use browser snapshot`
   b. Analyze: Am I at the goal? What actions could get me closer?
   c. Execute best action (click, scroll, fill)
   d. Check result
4. Return structured findings

## Output Format

{
  "success": true,
  "goal_achieved": true,
  "final_url": "https://example.com/pricing",
  "findings": {
    "plans": ["Free", "Pro ($20/mo)", "Enterprise"],
    "cta_buttons": ["Start Free Trial", "Contact Sales"]
  },
  "steps_taken": [
    {"action": "click", "target": "Pricing link", "result": "navigated to /pricing"},
    {"action": "scroll", "direction": "down", "result": "revealed plan cards"}
  ],
  "page_summary": "Pricing page with 3 plan tiers and comparison table"
}

## Error Handling

- If stuck (same page for 3 actions): try alternative approach or report
- If login required: report to parent skill, don't attempt to bypass
- If CAPTCHA: report as blocker, cannot proceed
```

### 8.6 The `browser-recorder` Agent

For turning exploration into tests:

```markdown
---
name: browser-recorder
description: Record browser interactions and generate test definitions
tools: [Bash, Write]
model: sonnet
---

# Browser Recorder

Observes browser commands and generates qa-use test YAML definitions.

## When Spawned

- By `feature-verify` skill after exploration
- By `test-authoring` skill for assisted test creation
- By user for "record this flow" requests

## Input Format

{
  "test_name": "login-flow",
  "description": "Verify login with valid credentials",
  "session_id": "abc123",  // existing session to record from
  "record_mode": "capture" // or "replay" to verify recording
}

## Recording Process

1. Attach to existing browser session
2. Announce: "Recording started. Perform the actions you want to test."
3. Track all browser commands executed:
   - goto → test step
   - click → test step
   - fill → test step (capture value as variable if sensitive)
   - Assertions inferred from: wait commands, URL changes, element checks
4. On "stop recording" or explicit end:
   - Generate test YAML
   - Infer variables from repeated values
   - Add sensible assertions

## Output Format

Generated YAML:
```yaml
name: login-flow
description: Verify login with valid credentials
variables:
  email: test@example.com
  password: "********"  # marked as secret
steps:
  - action: goto
    url: /login
  - action: fill
    target: email input
    value: $email
  - action: fill
    target: password input
    value: $password
  - action: click
    target: Sign In button
  - action: wait_for_url
    url: /dashboard
  - action: to_be_visible
    target: Welcome message
```

Saved to: qa-tests/login-flow.yaml

## Smart Features

- **Variable extraction**: Repeated values become variables
- **Secret detection**: Passwords, tokens marked as secrets
- **Assertion inference**: URL changes and element waits become assertions
- **Cleanup**: Remove redundant waits, consolidate similar steps
```

### 8.7 Updated Plugin Structure

```
plugins/qa-use/
├── .claude-plugin/plugin.json
├── README.md
│
├── commands/                          # User entry points
│   ├── verify.md                      # /qa-use:verify - THE main command
│   ├── explore.md                     # /qa-use:explore <url>
│   ├── record.md                      # /qa-use:record [start|stop]
│   ├── test-run.md                    # (existing)
│   ├── test-init.md                   # (existing)
│   └── ...
│
├── skills/                            # Orchestration logic
│   ├── feature-verify/
│   │   └── SKILL.md                   # THE main skill
│   ├── browser-control/
│   │   └── SKILL.md                   # Low-level browser wrapper
│   ├── test-authoring/
│   │   └── SKILL.md                   # (existing, enhanced)
│   ├── test-running/
│   │   └── SKILL.md                   # (existing)
│   └── test-debugging/
│       └── SKILL.md                   # (existing)
│
├── agents/                            # Specialized workers
│   ├── browser-navigator.md           # Page exploration
│   ├── browser-recorder.md            # Session → test YAML
│   ├── test-analyzer.md               # (existing)
│   └── step-generator.md              # (existing)
│
├── hooks/
│   └── .gitkeep
└── scripts/
    └── .gitkeep
```

### 8.8 Command Cheat Sheet (For Me)

When I'm in the middle of development and need to verify something:

| I want to... | Command |
|--------------|---------|
| Verify a feature works | `/qa-use:verify "description"` |
| Explore a page | `/qa-use:explore https://url` |
| Record a test | `/qa-use:record start` then `/qa-use:record stop` |
| Run existing test | `/qa-use:test-run <name>` |
| Debug a failure | `/qa-use:test-debug <name>` (spawns test-analyzer) |
| Quick browser action | `qa-use browser <cmd>` (direct CLI) |

### 8.9 What Makes This AI-First

| Principle | How It's Applied |
|-----------|------------------|
| **Minimal cognitive load** | One command (`/verify`) for 90% of use cases |
| **Smart defaults** | Sessions auto-managed, semantic targeting default |
| **Actionable output** | Never just "failed" - always "failed because X, fix by Y" |
| **Self-healing** | `--autofix` recovers from selector drift automatically |
| **Conversational flow** | Skills ask clarifying questions, don't assume |
| **Fail fast, recover fast** | Quick feedback loop, easy to iterate |
| **Context-aware** | Skills check recent code changes to understand what to test |

---

## Code References

| Component | Location |
|-----------|----------|
| Plugin manifest | `plugins/qa-use/.claude-plugin/plugin.json` |
| Current skills | `plugins/qa-use/skills/test-*/SKILL.md` |
| Current agents | `plugins/qa-use/agents/*.md` |
| Browser CLI research | `thoughts/taras/research/2026-01-23-browser-subcommand.md` |
| Browser CLI plan | `thoughts/taras/plans/2026-01-23-browser-subcommand.md` |
| Plugin v2 research | `thoughts/taras/research/2026-01-22-qa-use-plugin-v2-redesign.md` |

---

## External References

| Source | URL |
|--------|-----|
| browser-use SKILL.md | https://github.com/browser-use/browser-use/blob/main/skills/browser-use/SKILL.md |
| browser-use CLI README | https://github.com/browser-use/browser-use/blob/main/browser_use/skill_cli/README.md |
| agent-browser skills | https://github.com/vercel-labs/agent-browser/tree/main/skills/agent-browser |

---

## Implementation Plan

### Unified Task List

| # | Task | Type | File Path | Description |
|---|------|------|-----------|-------------|
| 1 | Create feature-verify skill | Skill | `skills/feature-verify/SKILL.md` | Main orchestration skill - understand context, find/create test, execute, handle failure, report |
| 2 | Create verify command | Command | `commands/verify.md` | Entry point: `/qa-use:verify <description>` - thin wrapper that invokes feature-verify skill |
| 3 | Create browser-navigator agent | Agent | `agents/browser-navigator.md` | Autonomous page exploration using snapshot → analyze → act loop |
| 4 | Create browser-recorder agent | Agent | `agents/browser-recorder.md` | Record browser session and generate test YAML with variable extraction and assertion inference |
| 5 | Create browser-control skill | Skill | `skills/browser-control/SKILL.md` | Low-level wrapper for `qa-use browser` CLI commands with prerequisites and session management |
| 6 | Enhance test-debugging skill | Skill | `skills/test-debugging/SKILL.md` | Add code bug vs test bug vs environment issue differentiation |
| 7 | Create explore command | Command | `commands/explore.md` | Entry point: `/qa-use:explore <url>` - spawns browser-navigator agent |
| 8 | Create record command | Command | `commands/record.md` | Entry point: `/qa-use:record [start\|stop]` - spawns browser-recorder agent |
| 9 | Update README | Docs | `README.md` | Document AI-first workflow, command cheat sheet, common patterns |
| 10 | Add example workflows | Docs | `skills/feature-verify/examples/` | Example patterns: login, form submission, CRUD operations |
| 11 | End-to-end testing | Test | - | Test full workflow with headless Claude Code instance |

### Dependencies

```
Task 1 (feature-verify) ─┬─► Task 2 (verify command)
                         │
                         ├─► Task 3 (browser-navigator) ─► Task 7 (explore command)
                         │
                         └─► Task 4 (browser-recorder) ─► Task 8 (record command)

Task 5 (browser-control) ─► Tasks 3, 4 depend on this for CLI reference

Task 6 (test-debugging) ─► Task 1 depends on this for failure analysis

Tasks 9, 10, 11 (polish) ─► All other tasks complete first
```

### Target Plugin Structure

```
plugins/qa-use/
├── .claude-plugin/plugin.json        # (existing - update version)
├── README.md                         # (update - Task 9)
│
├── commands/
│   ├── verify.md                     # (NEW - Task 2) THE main command
│   ├── explore.md                    # (NEW - Task 7)
│   ├── record.md                     # (NEW - Task 8)
│   ├── test-run.md                   # (existing)
│   ├── test-init.md                  # (existing)
│   ├── test-validate.md              # (existing)
│   ├── test-sync.md                  # (existing)
│   └── test-update.md                # (existing)
│
├── skills/
│   ├── feature-verify/
│   │   ├── SKILL.md                  # (NEW - Task 1) THE main skill
│   │   └── examples/                 # (NEW - Task 10)
│   │       ├── login-flow.md
│   │       ├── form-submission.md
│   │       └── crud-operations.md
│   ├── browser-control/
│   │   └── SKILL.md                  # (NEW - Task 5)
│   ├── test-authoring/
│   │   ├── SKILL.md                  # (existing)
│   │   └── template.md               # (existing)
│   ├── test-running/
│   │   └── SKILL.md                  # (existing)
│   └── test-debugging/
│       └── SKILL.md                  # (existing - Task 6 enhances)
│
├── agents/
│   ├── browser-navigator.md          # (NEW - Task 3)
│   ├── browser-recorder.md           # (NEW - Task 4)
│   ├── test-analyzer.md              # (existing)
│   └── step-generator.md             # (existing)
│
├── hooks/
│   └── .gitkeep
└── scripts/
    └── .gitkeep
```

### Success Criteria

The plugin is ready when Claude Code can:

1. **Run** `/qa-use:verify "login works"` on a fresh codebase
2. **Explore** the feature automatically if no test exists
3. **Generate** a test YAML from the exploration
4. **Execute** the test and report results
5. **Handle failures** with actionable recommendations (code bug vs test bug)
6. **Iterate** until green without human intervention (for simple cases)

### Acceptance Test

```
# Scenario: Fresh Next.js app with login page

1. Claude Code implements a login feature
2. Claude Code runs: /qa-use:verify "login works with valid credentials"
3. Plugin responds: "No test found. Exploring feature..."
4. browser-navigator explores /login, identifies form elements
5. browser-recorder generates qa-tests/login.yaml
6. Plugin runs test, reports: "✅ Feature verified: 5/5 steps passed"

# Failure scenario:
7. User changes button text from "Submit" to "Sign In"
8. Claude Code runs: /qa-use:verify "login works"
9. Test fails at step 4 (click submit button)
10. Plugin reports: "TEST BUG: Button text changed. Suggested fix: update target"
11. Claude Code approves fix, test re-runs and passes
```
