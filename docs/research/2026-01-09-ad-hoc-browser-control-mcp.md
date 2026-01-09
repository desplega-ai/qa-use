# Research: Ad-hoc Browser Control via MCP Client

**Date**: 2026-01-09T12:46:58Z
**Git Commit**: cf95bf6
**Branch**: main
**Repository**: desplega-ai/qa-use

---

## Research Question

Can the qa-use MCP server be used to control a browser in an ad-hoc/interactive way (like a background browser for screenshots, manual actions, etc.) rather than just running automated QA tasks? What capabilities exist and what are the limitations/missing pieces?

---

## Executive Summary

**Ad-hoc browser control via natural language is ALREADY SUPPORTED** - just use `respond` with dev sessions.

The correct architecture for ad-hoc browser control is:
1. Start a **dev session** with `start_dev_session` (autopilot=false)
2. Send natural language commands via `interact_with_session(action="respond", message="click the submit button")`
3. The TestAgentV2 executes ONE iteration per command (single-step mode when autopilot=false)
4. Monitor results via `monitor_session`

**Critical Gap Found:** Screenshots ARE captured by the backend but NOT returned to MCP clients. This requires implementation work.

---

## What Already Works

| Capability | Status | How to Use |
|------------|--------|-----------|
| Natural language actions | **WORKS** | `respond` with "click X", "fill form with Y", "navigate to Z" |
| Current page URL | **AVAILABLE** | `session.data.page_url` in backend response |
| Screenshot paths | **AVAILABLE** | `session.data.blocks[].pre/post_screenshot_path` |
| Liveview URL | **AVAILABLE** | `session.data.liveview_url` for real-time view |
| Session history | **AVAILABLE** | `session.data.history` with all tasks/intents |

---

## Critical Gap: Screenshots Not Exposed

**Screenshots ARE captured by the backend but NOT returned to MCP clients.**

| Component | Status |
|-----------|--------|
| Backend captures screenshots | **YES** - stored in `block.pre/post_screenshot_path` |
| Backend can presign URLs | **YES** - `block.ensure_urls()` method exists |
| Backend presigns in session API | **NO** - only presigns `recording_path`, not blocks |
| MCP `monitor_session` returns screenshots | **NO** - only returns formatted text |

---

## Detailed Findings

### 1. Natural Language Control Architecture

**NOT `/liveview-interact`** - That WebSocket is for frontend user interaction (mouse clicks from UI).

**The correct approach is `respond`/`next_task` events via REST API:**

```
MCP Client
  → interact_with_session(action="respond", message="click the submit button")
  → POST /vibe-qa/new-event {type: "response", message: "..."}
  → TestAgentV2 receives event (autopilot=false mode)
  → Adds task to history
  → Runs ONE iteration
  → LLM interprets natural language → ActionIntent
  → Playwright executes action
  → Returns to "pending" status (waits for next command)
  → MCP can monitor_session to get results
```

**Backend Event Processing** (`be/experiments/test_agent_2.py:1343-1355`):
```python
case "response":
    if not ev.message:
        return
    await self.add_task(f"User response: {ev.message}")
    self._tasks.append(asyncio.create_task(self.run()))

case "next_task":
    if not ev.message:
        return
    await self.add_task(ev.message)
    self._tasks.append(asyncio.create_task(self.run()))
```

**Single-Step Execution** (when autopilot=false, lines 5997-6057):
- After processing one iteration, the loop breaks
- Sets status to `"pending"`
- Waits for next event to continue
- This enables step-by-step ad-hoc control

### 2. Available Actions via Natural Language

The LLM can interpret natural language and output these ActionIntent types:

| Action | Example Command |
|--------|----------------|
| `click` | "click the submit button" |
| `fill` | "fill the email field with test@example.com" |
| `type` | "type 'hello world' in the search box" |
| `press` | "press Enter" |
| `goto` | "navigate to https://example.com" |
| `scroll` | "scroll down the page" |
| `hover` | "hover over the menu item" |
| `select` | "select 'Option 2' from the dropdown" |
| `check`/`uncheck` | "check the terms checkbox" |
| `wait` | "wait for the page to load" |
| `extract_from_page` | "take a screenshot" or "extract text from the page" |

### 3. Session Data Available from Backend

**TestAgentV2Data** structure:

```python
class TestAgentV2Data:
    agent_id: str
    liveview_url: str              # Live view for watching
    recording_path: Optional[str]   # S3 recording path
    page_url: Optional[str]         # CURRENT PAGE URL
    autopilot: bool
    model_name: str
    blocks: List[Block]             # With pre/post_screenshot_path
    history: List[HistoryItem]      # Task/intent history
    last_done: Optional[DoneT]      # Last completed intent
    pending_user_input: Optional[UserInputIntent]
    status: TestAgentV2Status       # running/pending/closed/idle
```

**Block structure** (includes screenshots):
```python
class Block:
    pre_screenshot_path: Optional[str]   # Screenshot before action
    post_screenshot_path: Optional[str]  # Screenshot after action
    # ... other fields
```

### 4. Screenshot Gap Analysis

**Why screenshots aren't exposed:**

1. `TestAgentV2Session.ensure()` only presigns `recording_path`:
```python
if self.data.recording_path and ensure_urls:
    from storage.s3_store import get_presigned_url
    self.data.recording_path = get_presigned_url(self.data.recording_path)
# Block screenshots NOT presigned here!
```

2. `Block.ensure_urls()` exists but isn't called in session API

3. MCP `formatSessionProgress()` doesn't extract screenshot URLs

---

## Implementation Plan: Expose Screenshots

### Required Changes

**1. Backend (desplega.ai be/db/models_2.py) - REQUIRED FIRST**

Add block screenshot URL presigning in `TestAgentV2Session.ensure()`:

```python
# ADD: Presign block screenshot URLs
if ensure_urls and hasattr(self.data, 'blocks') and self.data.blocks:
    from storage.s3_store import get_presigned_url
    for block in self.data.blocks:
        if isinstance(block, dict):
            if block.get('pre_screenshot_path'):
                block['pre_screenshot_path'] = get_presigned_url(block['pre_screenshot_path'])
            if block.get('post_screenshot_path'):
                block['post_screenshot_path'] = get_presigned_url(block['post_screenshot_path'])
        elif hasattr(block, 'pre_screenshot_path'):
            if block.pre_screenshot_path:
                block.pre_screenshot_path = get_presigned_url(block.pre_screenshot_path)
            if block.post_screenshot_path:
                block.post_screenshot_path = get_presigned_url(block.post_screenshot_path)
```

**2. MCP Server (qa-use/src/server.ts)**

- Add `extractScreenshotsFromBlocks()` helper
- Modify `formatSessionProgress()` to include screenshot URLs
- Add `get_session_screenshots` tool

### Files to Modify

| Repo | File | Changes |
|------|------|---------|
| **desplega.ai** | `be/db/models_2.py` | Add block screenshot URL presigning in `ensure()` |
| qa-use | `src/server.ts` | Add helper, modify `formatSessionProgress()`, add new tool |
| qa-use | `src/types.ts` | Add `GetSessionScreenshotsParams` type |

---

## How to Use for Ad-hoc Browser Control

### Example Workflow

```typescript
// 1. Start dev session (opens browser, navigates to URL)
start_dev_session({
  task: "Interactive browser session",
  url: "https://example.com"  // optional
})

// 2. Send ad-hoc commands
interact_with_session({
  sessionId: "xxx",
  action: "respond",
  message: "click the Login button"
})

// 3. Check result
monitor_session({ sessionId: "xxx", wait: true })

// 4. Send more commands
interact_with_session({
  sessionId: "xxx",
  action: "respond",
  message: "fill the username field with 'testuser'"
})

// 5. Take screenshot
interact_with_session({
  sessionId: "xxx",
  action: "respond",
  message: "take a screenshot of the current page"
})

// 6. Close when done
interact_with_session({
  sessionId: "xxx",
  action: "close"
})
```

---

## Code References

### MCP Server (qa-use)
- `src/server.ts:1452-1527` - `handleStartDevSession`
- `src/server.ts:1777-1871` - `handleInteractWithSession`
- `src/server.ts:319-436` - `formatSessionProgress`

### Backend (desplega.ai)
- `be/experiments/test_agent_2.py:1343-1355` - Event processing (response/next_task)
- `be/experiments/test_agent_2.py:5997-6057` - Single-step execution (autopilot=false)
- `be/experiments/test_agent_2_models.py:701-760` - `TestAgentV2Data` model
- `be/db/models_2.py:34-58` - `TestAgentV2Session.ensure()` method
- `be/db/models.py:973-997` - `Block.ensure_urls()` method

---

## Constraints

| Constraint | Value |
|------------|-------|
| Max concurrent sessions | 10 |
| Session TTL | 30 minutes |
| MCP call timeout | 25 seconds |
| Browser instances | 1 (shared singleton) |

---

## Estimated Effort

~3-4 hours total:
- Backend change: ~30-45 min
- MCP changes: ~2-2.5 hrs
- Testing: ~45-60 min
