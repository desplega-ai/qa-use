---
date: 2026-02-04T18:15:00Z
topic: "QA-Use CLI Missing Features Gap Analysis"
author: Claude
source: "localhost:5005/vibe-qa/cli/docs.md"
---

# QA-Use CLI Missing Features Research

**Scope:** Gap analysis between documented API features and current CLI implementation

---

## Executive Summary

After comparing the API documentation against the current CLI implementation, I identified **4 actionable feature gaps** for the browser CLI:

1. **JavaScript Evaluation** (`evaluate`, `evaluate_handle`) - Completely missing, HIGH PRIORITY
2. **Snapshot Diff** - Not implemented, should be included on each action output
3. **Relative Drag and Drop** - Only standard drag implemented, LOW PRIORITY
4. **Force Click Option** - Click with `force: true` for covered elements, LOW PRIORITY

**Not needed for browser CLI** (test-definition only, document in schema):
- Assertions (to_contain_text, to_have_text, to_be_visible, to_have_url) - redundant, user can verify via snapshot
- AI Actions (ai_action, ai_assertion) - redundant, user can perform these manually

---

## Detailed Gap Analysis

### 1. JavaScript Evaluation Actions (HIGH PRIORITY)

**Documentation Reference:** "JavaScript Evaluation" section in API docs

**What's documented:**

```yaml
# evaluate - Execute JavaScript and return JSON result
- type: extended
  name: Get page title
  action:
    action: evaluate
    value: "document.title"

# Element-level evaluation
- type: extended
  name: Get input value
  action:
    action: evaluate
    value: "el => el.value"
  locator:
    text: "email input"

# evaluate_handle - Return JSHandle reference
- type: extended
  name: Get document handle
  action:
    action: evaluate_handle
    value: "document.querySelector('#app')"
```

**Current CLI status:**
- The types exist in `src/types/test-definition.ts:68-69`
- **No CLI command exists** - no `evaluate.ts` or `evaluate-handle.ts` in browser commands
- **No API client method** - `BrowserApiClient` has no evaluate methods
- **No action type in browser-types.ts** - `evaluate` and `evaluate_handle` missing from `BrowserActionType`

**Impact:** Users cannot:
- Extract dynamic data from pages (form values, computed styles)
- Check JavaScript state (window variables, localStorage)
- Trigger client-side functions
- Debug page state during interactive sessions

**Implementation needed:**
1. Add `evaluate` and `evaluate_handle` to `BrowserActionType` union
2. Add action interfaces to `browser-types.ts`
3. Create `src/cli/commands/browser/evaluate.ts` command
4. Create `src/cli/commands/browser/evaluate-handle.ts` command (or combine)
5. Add to REPL in `run.ts`

---

### 2. Snapshot Diff (MEDIUM PRIORITY)

**Documentation:** Mentioned in `plugins/qa-use/skills/qa-use/references/browser-commands.md` as a concept but not implemented

**What users expect:**
- Compare two snapshots to see what changed on the page
- Useful for verifying actions had expected effects
- Can help debug flaky tests

**Current CLI status:**
- **No implementation exists**
- `snapshot` command only returns current state
- No diff utility or comparison feature

**Implementation options:**
1. Add `snapshot --diff` flag that compares to last snapshot
2. Add `snapshot diff <snapshot1> <snapshot2>` subcommand
3. Add `include_previous_diff` option to snapshot call

---

### 3. Assertion Commands (NOT NEEDED FOR CLI)

**Decision:** Not implementing as browser CLI commands - redundant since users can verify state via `snapshot`.

These remain available in test definitions only. Ensure they are documented in test-definition schema.

---

### 4. AI Actions (NOT NEEDED FOR CLI)

**Decision:** Not implementing as browser CLI commands - redundant since the AI agent calling the CLI can perform these actions manually using existing commands.

These remain available in test definitions only. Ensure they are documented in test-definition schema.

---

### 5. Relative Drag and Drop (LOW PRIORITY)

**Documentation Reference:** ExtendedStep drag actions

**What's documented:**
```yaml
# relative_drag_and_drop - Drag by pixel offsets
- type: extended
  name: Drag element 100px right
  action:
    action: relative_drag_and_drop
    value:
      delta_x: 100
      delta_y: 0
  locator:
    text: "draggable element"
```

**Current CLI status:**
- `drag` command exists with `--target` and `--target-selector`
- **No support for pixel-based relative dragging**
- Missing `delta_x` and `delta_y` options

**Use cases:**
- Canvas interactions
- Slider controls
- Resize handles
- Precise positioning

---

### 6. Force Click Option (LOW PRIORITY)

**Documentation Reference:** ActionInstruction section

**What's documented:**
```json
{
  "action": "click",
  "value": {"force": true}  // Bypass overlay/actionability checks
}
```

**Current CLI status:**
- `click` command exists in `src/cli/commands/browser/click.ts`
- **No `--force` flag** to bypass actionability checks
- Covered elements cannot be clicked

**Use case:**
- Click elements behind overlays
- Click elements before animations complete
- Debug interactions with obstructed elements

---

## Feature Matrix

| Feature | In Docs | In Types | In API Client | CLI Command | REPL |
|---------|---------|----------|---------------|-------------|------|
| evaluate | Yes | Yes (partial) | No | No | No |
| evaluate_handle | Yes | Yes (partial) | No | No | No |
| snapshot diff | Yes (implied) | No | No | No | No |
| to_contain_text | Yes | Yes | Yes (tests) | No | No |
| to_have_text | Yes | Yes | Yes (tests) | No | No |
| to_be_visible | Yes | Yes | Yes (tests) | No | No |
| to_have_url | Yes | Yes | Yes (tests) | No | No |
| ai_action | Yes | Yes | Yes (tests) | No | No |
| ai_assertion | Yes | Yes | Yes (tests) | No | No |
| relative_drag_and_drop | Yes | No | No | No | No |
| click --force | Yes | No | No | No | No |

---

## Recommendations

### Priority 1: JavaScript Evaluation (evaluate, evaluate_handle)

This is the biggest gap. Users need to:
- Extract data from pages
- Debug page state
- Trigger JS functions

**Files to modify:**
- `lib/api/browser-types.ts` - Add action types
- `lib/api/browser.ts` - Add client methods (API confirmed to support this)
- `src/cli/commands/browser/evaluate.ts` - New command
- `src/cli/commands/browser/run.ts` - Add to REPL

### Priority 2: Snapshot Diff

Essential for debugging and verification.

**Decided approach:** Always send the `include_diff` param to the API (with opt-out via settings or query param), and show the diff formatted on each action output (both normal and JSON modes).

**Implementation:**
- Add `include_diff` parameter to snapshot API calls
- Display diff in action output by default
- Add `--no-diff` flag or config setting to opt out

### Priority 3: Force Click

Quick win - just add `--force` flag to existing click command.

### Priority 4: Relative Drag

Niche use case, lower priority unless users request it.

### Not Implementing for Browser CLI:

- **Assertions** - Users can verify via snapshot; keep in test definitions only
- **AI Actions** - AI agents can compose existing commands; keep in test definitions only

Both should be documented in the test-definition schema for test management.

---

## Resolved Questions

1. **Does the backend API support `evaluate` as a browser action?**
   → **Yes, confirmed.** Can proceed with implementation.

2. **Should assertions be CLI commands?**
   → **No.** Keep in test definitions only; users can verify via snapshot.

3. **Snapshot diff approach?**
   → **Always send `include_diff` param** (with opt-out via settings/query param), show formatted diff on each action output (normal and JSON).

4. **AI action availability?**
   → **Not needed for CLI.** AI agents can compose existing commands; keep in test definitions only.

---

## Appendix: Current CLI Commands

### Implemented (33 commands):
- **Session:** create, list, status, close
- **Navigation:** goto, back, forward, reload
- **Interactions:** click, fill, type, press, hover, scroll, scroll-into-view, select, check, uncheck, drag, upload, mfa-totp
- **Waiting:** wait, wait-for-selector, wait-for-load
- **Inspection:** snapshot, screenshot, url, get-blocks, logs (console, network)
- **Generation:** generate-test
- **Interactive:** run, stream

### Not Implemented (to be added):
- evaluate
- evaluate_handle
- snapshot diff
- relative-drag
- click --force

### Test-Definition Only (document in schema, not needed for browser CLI):
- assert (to_contain_text, to_have_text, to_be_visible, to_have_url)
- ai-action
- ai-assertion
