---
date: 2026-02-07T12:00:00Z
topic: "Add focus, blur commands and scroll --ref option to browser CLI"
author: Claude
autonomy: autopilot
---

# Plan: Add `focus`, `blur` commands and `scroll --ref` option to browser CLI

## Summary

Add three pieces of CLI plumbing for backend actions that already work:
1. `scroll` — add `--ref` and `--text` options for element-scoped scrolling
2. `focus [ref]` — new command (pattern follows `hover`)
3. `blur [ref]` — new command (same shape as `focus`)

All three are verified working via direct API calls. This is purely CLI + type plumbing.

## Progress Tracking

| Phase | Description | Status | Notes |
|-------|-------------|--------|-------|
| 1 | Update type definitions | Done | |
| 2 | Update `scroll` command | Done | |
| 3 | Create `focus` command | Done | |
| 4 | Create `blur` command | Done | |
| 5 | Register new commands | Done | |
| 6 | Update REPL | Done | |
| 7 | Verify | Done | All checks + manual E2E pass |

---

## Phase 1: Update type definitions

**File:** `lib/api/browser-types.ts`

### 1.1 Add `focus` and `blur` to `BrowserActionType` union

Add `'focus' | 'blur'` to the existing union type (~line 46).

### 1.2 Add `FocusAction` and `BlurAction` interfaces

Following the `HoverAction` pattern:

```typescript
export interface FocusAction {
  type: 'focus';
  ref?: string;
  text?: string;
}

export interface BlurAction {
  type: 'blur';
  ref?: string;
  text?: string;
}
```

### 1.3 Update `ScrollAction` interface

Add optional `ref` and `text` fields to the existing `ScrollAction`:

```typescript
export interface ScrollAction {
  type: 'scroll';
  direction: ScrollDirection;
  amount?: number;
  ref?: string;   // element-scoped scroll
  text?: string;  // AI-resolved element
}
```

### 1.4 Add to `BrowserAction` union type

Add `| FocusAction | BlurAction` to the `BrowserAction` union.

### Verification

```bash
bun run typecheck
```

---

## Phase 2: Update `scroll` command

**File:** `src/cli/commands/browser/scroll.ts`

### 2.1 Add `--ref` and `--text` options

```typescript
.option('--ref <ref>', 'Element reference for scoped scrolling')
.option('-t, --text <description>', 'Element text description (AI-resolved)')
```

### 2.2 Update action payload construction

Add `ref`/`text` to the action object when provided:

```typescript
if (options.ref) {
  action.ref = normalizeRef(options.ref);
} else if (options.text) {
  action.text = options.text;
}
```

Import `normalizeRef` from `../../lib/browser-utils.js`.

### Verification

```bash
bun run typecheck
bun run cli browser scroll --help   # confirm --ref and --text show up
```

---

## Phase 3: Create `focus` command

**File:** `src/cli/commands/browser/focus.ts` (new file)

Follow the `hover.ts` pattern exactly:
- Positional arg: `[ref]` — element reference
- Option: `-t, --text <description>` — semantic text description
- Option: `-s, --session-id <id>` — session selection
- Option: `--no-diff` — disable snapshot diff
- Action: `{ type: 'focus', ref?, text?, include_snapshot_diff? }`
- Uses `normalizeRef`, `resolveSessionId`, `touchSession`, `formatSnapshotDiff`

### Verification

```bash
bun run typecheck
bun run cli browser focus --help   # confirm command is visible and options correct
```

---

## Phase 4: Create `blur` command

**File:** `src/cli/commands/browser/blur.ts` (new file)

Identical to `focus.ts` except `type: 'blur'` and appropriate description/names.

### Verification

```bash
bun run typecheck
bun run cli browser blur --help   # confirm command is visible and options correct
```

---

## Phase 5: Register new commands

**File:** `src/cli/commands/browser/index.ts`

- Import `focusCommand` from `./focus.js`
- Import `blurCommand` from `./blur.js`
- Add `browserCommand.addCommand(focusCommand)` and `browserCommand.addCommand(blurCommand)`

### Verification

```bash
bun run cli browser --help   # confirm focus and blur appear in command list
```

---

## Phase 6: Update REPL

**File:** `src/cli/commands/browser/run.ts`

### 6.1 Add `focus` command to REPL

Following the `hover` REPL pattern:
```typescript
focus: async (args, client, sessionId) => {
  const parsed = parseTextOption(args);
  const action: { type: 'focus'; ref?: string; text?: string } = { type: 'focus' };
  if (parsed.ref) action.ref = normalizeRef(parsed.ref);
  if (parsed.text) action.text = parsed.text;
  // execute and handle result
}
```

### 6.2 Add `blur` command to REPL

Same pattern, `type: 'blur'`.

### 6.3 Update `scroll` command in REPL

Add `--ref` / `-r` option parsing to the existing scroll REPL handler. When provided, include `ref` in the action payload.

### 6.4 Update help text

Add `focus`, `blur` to the help output, and update `scroll` help to mention `--ref`/`--text`.

### Verification

```bash
bun run typecheck
bun run check:fix
```

---

## Phase 7: Final verification — lint + manual E2E

### 7.1 Lint and type check

```bash
bun run check:fix
```

### 7.2 Manual E2E — scroll with `--ref`

```bash
bun run cli browser create --no-headless
bun run cli browser goto https://evals.desplega.ai/pagination
bun run cli browser snapshot                          # find scrollable container ref
bun run cli browser scroll down 500 --ref <container_ref>   # element-scoped scroll
bun run cli browser snapshot                          # confirm content changed (lazy load)
```

### 7.3 Manual E2E — focus and blur

```bash
bun run cli browser goto https://evals.desplega.ai/keyboard
bun run cli browser snapshot                          # find gridcell ref (e.g. e18)
bun run cli browser focus <gridcell_ref>              # set focus
bun run cli browser snapshot                          # confirm [active] attribute
bun run cli browser blur <gridcell_ref>               # remove focus
bun run cli browser snapshot                          # confirm [active] removed
bun run cli browser close
```

---

## Files changed

| File | Change |
|------|--------|
| `lib/api/browser-types.ts` | Add types for focus, blur; extend ScrollAction |
| `src/cli/commands/browser/scroll.ts` | Add `--ref`, `--text` options |
| `src/cli/commands/browser/focus.ts` | **New file** — focus command |
| `src/cli/commands/browser/blur.ts` | **New file** — blur command |
| `src/cli/commands/browser/index.ts` | Register focus, blur commands |
| `src/cli/commands/browser/run.ts` | Add focus, blur to REPL; update scroll |

## Risks

None significant. This is additive CLI plumbing for already-working backend actions. Existing commands are not modified in breaking ways (scroll just gains optional fields).
