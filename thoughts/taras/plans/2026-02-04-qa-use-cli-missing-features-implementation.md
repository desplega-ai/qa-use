---
date: 2026-02-04T18:30:00Z
topic: "QA-Use CLI Missing Features Implementation Plan"
author: Claude
source: thoughts/taras/research/2026-02-04-qa-use-cli-missing-features.md
autonomy: autopilot
---

# QA-Use CLI Missing Features Implementation Plan

This plan implements the 4 prioritized features identified in the research document.

## Progress Tracking

| Phase | Feature | Status | Notes |
|-------|---------|--------|-------|
| 1 | `evaluate` command | ✅ COMPLETE | CLI + Backend working |
| 2 | Snapshot diff | ✅ COMPLETE | All 20 commands work; diff displays correctly |
| 3 | Relative drag | ✅ COMPLETE | CLI + Backend working |
| 4 | E2E Testing | ✅ COMPLETE | All tests pass against localhost:5005 |

### ✅ PLAN COMPLETE: 2026-02-04

**Verification:**
- `bun run check:fix` - ✅ passes
- `bun test` - ✅ 169 tests pass
- E2E tests against localhost:5005 - ✅ all pass

### E2E Test Results (2026-02-04)

| Test | Command | Result |
|------|---------|--------|
| 1.1 | `evaluate "1 + 1"` | ✅ PASS - returns `2` |
| 1.2 | `evaluate "window.location.href"` | ✅ PASS - returns URL |
| 1.3 | `evaluate "({title: document.title, url: location.href})" --json` | ✅ PASS - returns JSON object |
| 1.4 | `evaluate "el => el.tagName" -r e5` | ✅ PASS - returns `H1` |
| 2.1 | `goto <url>` | ✅ PASS - shows diff: "89 elements added" |
| 2.2 | `click e10` | ✅ PASS - shows diff: "2 elements modified" with attrs |
| 2.3 | `click e11 --no-diff` | ✅ PASS - no diff output |
| 2.4 | `fill e15 "eng"` | ✅ PASS - shows diff |
| 3.1 | `drag e12 --delta-x 50` | ✅ PASS - shows diff: "2 elements modified" |

### Files Modified
- `lib/api/browser-types.ts` - Added types for evaluate, relative_drag, snapshot diff
- `src/cli/commands/browser/evaluate.ts` - NEW: evaluate command
- `src/cli/commands/browser/index.ts` - Registered evaluate command
- `src/cli/commands/browser/run.ts` - REPL: evaluate, relative drag, --no-diff support
- `src/cli/lib/snapshot-diff.ts` - NEW: Diff formatting utility
- `src/cli/commands/browser/drag.ts` - Updated with relative drag support
- 20 action commands updated with `--no-diff` option:
  - click, fill, type, select, check, uncheck, hover
  - scroll, scroll-into-view, drag, goto, back, forward, reload
  - press, mfa-totp, upload, wait, wait-for-selector, wait-for-load

## Overview

| Phase | Feature | Effort | Files Changed |
|-------|---------|--------|---------------|
| 1 | `evaluate` command | Medium | 5 files + 1 test |
| 2 | Snapshot diff (default on actions, `--no-diff` to disable) | Medium-High | ~20 action commands + 1 utility + 1 test |
| 3 | Relative drag (`--delta-x`, `--delta-y`) | Low | 3 files + 1 test |

**Note:** `click --force` is already implemented in the codebase (`src/cli/commands/browser/click.ts:23-26` and REPL at `run.ts:238-265`). No phase needed.

---

## Phase 1: JavaScript Evaluation Command

### Goal
Add `qa-use browser evaluate <expression>` command that executes JavaScript in the browser context and returns the result.

### Implementation Steps

#### 1.1 Add action types to `lib/api/browser-types.ts`

Add to `BrowserActionType` union (after line 69):
```typescript
  | 'evaluate';
```

Add new interface (after `SetInputFilesAction`):
```typescript
export interface EvaluateAction {
  type: 'evaluate';
  expression: string;
  ref?: string;  // Optional element ref for element-scoped evaluation
  text?: string; // Optional semantic text for element-scoped evaluation
}
```

Add to `BrowserAction` union:
```typescript
  | EvaluateAction;
```

#### 1.2 Create `src/cli/commands/browser/evaluate.ts`

```typescript
/**
 * qa-use browser evaluate - Execute JavaScript in browser context
 */

import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import { resolveSessionId, touchSession } from '../../lib/browser-sessions.js';
import { normalizeRef } from '../../lib/browser-utils.js';
import { loadConfig } from '../../lib/config.js';
import { error, success } from '../../lib/output.js';

interface EvaluateOptions {
  sessionId?: string;
  ref?: string;
  text?: string;
  json?: boolean;
}

export const evaluateCommand = new Command('evaluate')
  .description('Execute JavaScript in browser context')
  .argument('<expression>', 'JavaScript expression to evaluate (e.g., "document.title")')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .option('-r, --ref <ref>', 'Element ref for element-scoped evaluation (el => ...)')
  .option('-t, --text <description>', 'Semantic element description for element-scoped evaluation')
  .option('--json', 'Output raw JSON result')
  .action(async (expression: string, options: EvaluateOptions) => {
    try {
      const config = await loadConfig();
      if (!config.api_key) {
        console.log(error('API key not configured. Run `qa-use setup` first.'));
        process.exit(1);
      }

      const client = new BrowserApiClient(config.api_url);
      client.setApiKey(config.api_key);

      const resolved = await resolveSessionId({
        explicitId: options.sessionId,
        client,
      });

      // Build action
      const action: {
        type: 'evaluate';
        expression: string;
        ref?: string;
        text?: string;
      } = {
        type: 'evaluate',
        expression,
      };

      if (options.ref) {
        action.ref = normalizeRef(options.ref);
      } else if (options.text) {
        action.text = options.text;
      }

      const result = await client.executeAction(resolved.id, action);

      if (result.success) {
        const data = result.data as { result?: unknown };
        if (options.json) {
          console.log(JSON.stringify(data.result, null, 2));
        } else {
          // Pretty print based on type
          const value = data.result;
          if (typeof value === 'string') {
            console.log(value);
          } else if (value === null || value === undefined) {
            console.log(String(value));
          } else {
            console.log(JSON.stringify(value, null, 2));
          }
        }
        await touchSession(resolved.id);
      } else {
        console.log(error(result.error || 'Evaluation failed'));
        process.exit(1);
      }
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to evaluate expression'));
      process.exit(1);
    }
  });
```

#### 1.3 Register in `src/cli/commands/browser/index.ts`

Add import:
```typescript
import { evaluateCommand } from './evaluate.js';
```

Add registration (after inspection commands section):
```typescript
browserCommand.addCommand(evaluateCommand);
```

#### 1.4 Add REPL handler in `src/cli/commands/browser/run.ts`

Add to `commands` object (after `url` handler):
```typescript
evaluate: async (args, client, sessionId) => {
  if (args.length === 0) {
    console.log(error('Usage: evaluate <expression> [-r <ref>] [-t "description"]'));
    return;
  }

  // Parse options
  const refIdx = args.findIndex((a) => a === '-r' || a === '--ref');
  const textIdx = args.findIndex((a) => a === '-t' || a === '--text');

  let ref: string | undefined;
  let text: string | undefined;
  let expressionParts: string[] = [...args];

  if (refIdx !== -1 && args[refIdx + 1]) {
    ref = normalizeRef(args[refIdx + 1]);
    expressionParts = [...args.slice(0, refIdx), ...args.slice(refIdx + 2)];
  }
  if (textIdx !== -1 && args[textIdx + 1]) {
    text = args[textIdx + 1];
    const adjustedTextIdx = expressionParts.findIndex((a) => a === '-t' || a === '--text');
    if (adjustedTextIdx !== -1) {
      expressionParts = [...expressionParts.slice(0, adjustedTextIdx), ...expressionParts.slice(adjustedTextIdx + 2)];
    }
  }

  const expression = expressionParts.join(' ');
  if (!expression) {
    console.log(error('Expression is required'));
    return;
  }

  const action: {
    type: 'evaluate';
    expression: string;
    ref?: string;
    text?: string;
  } = { type: 'evaluate', expression };

  if (ref) action.ref = ref;
  if (text) action.text = text;

  const result = await client.executeAction(sessionId, action);
  if (result.success) {
    const data = result.data as { result?: unknown };
    const value = data.result;
    if (typeof value === 'string') {
      console.log(value);
    } else if (value === null || value === undefined) {
      console.log(String(value));
    } else {
      console.log(JSON.stringify(value, null, 2));
    }
  } else {
    console.log(error(result.error || 'Evaluation failed'));
  }
},
```

Update `printHelp()` to add evaluate:
```typescript
  ${colors.cyan}Inspection:${colors.reset}
    ...
    evaluate <expr>         Execute JavaScript (use -r <ref> for element scope)
```

#### 1.5 Create test file `src/cli/commands/browser/evaluate.test.ts`

```typescript
import { describe, expect, it, mock, beforeEach, afterEach } from 'bun:test';

// Tests will mock the BrowserApiClient and verify:
// 1. Expression is passed correctly
// 2. Ref option is normalized and passed
// 3. Text option is passed
// 4. JSON output mode works
// 5. Error handling works

describe('evaluate command', () => {
  describe('argument parsing', () => {
    it('should require an expression', () => {
      // Test that command fails without expression
    });

    it('should pass expression to API', () => {
      // Test expression is correctly passed
    });

    it('should support -r/--ref for element-scoped evaluation', () => {
      // Test ref option
    });

    it('should support -t/--text for semantic element selection', () => {
      // Test text option
    });
  });

  describe('output formatting', () => {
    it('should output strings directly', () => {
      // Test string output
    });

    it('should JSON stringify objects', () => {
      // Test object output
    });

    it('should handle null and undefined', () => {
      // Test null/undefined output
    });

    it('should use --json for raw JSON output', () => {
      // Test JSON flag
    });
  });
});
```

### Verification

```bash
# Build and verify
bun run check:fix
bun test src/cli/commands/browser/evaluate.test.ts

# Manual testing (Phase 5)
```

---

## Phase 2: Snapshot Diff (Action-based)

### Goal
Add `include_snapshot_diff` parameter to **action** API calls that returns a semantic diff of page changes after mutating actions. Display diff in action output by default.

**Important:** Per the Browser API docs, snapshot diff is NOT on GET `/snapshot`. It's a parameter on POST `/action` that returns structured diff data after the action executes.

### API Response Structure

When `include_snapshot_diff: true` is passed to an action:
```json
{
  "success": true,
  "action_id": "uuid",
  "url_before": "https://example.com",
  "url_after": "https://example.com",
  "snapshot_diff": {
    "changes": [
      {
        "ref": "e18",
        "change_type": "modified",
        "role": "checkbox",
        "name": "I agree to the terms",
        "attribute_changes": {
          "added": ["checked", "active"],
          "removed": []
        }
      },
      {
        "ref": "e54",
        "change_type": "added",
        "role": "generic",
        "name": "Thanks for agreeing!",
        "parent_ref": "e15"
      }
    ],
    "summary": "1 element added, 1 element modified",
    "refs_added": ["e54"],
    "refs_removed": [],
    "refs_modified": ["e18"]
  }
}
```

### Implementation Steps

#### 2.1 Update `lib/api/browser-types.ts`

Add snapshot diff types:
```typescript
// Snapshot diff types (returned from actions with include_snapshot_diff)
export interface SnapshotDiffChange {
  ref: string;
  change_type: 'added' | 'removed' | 'modified';
  role: string;
  name: string;
  parent_ref?: string; // For added elements
  attribute_changes?: {
    added: string[];
    removed: string[];
  }; // For modified elements
}

export interface SnapshotDiff {
  changes: SnapshotDiffChange[];
  summary: string;
  refs_added: string[];
  refs_removed: string[];
  refs_modified: string[];
}
```

Update `ActionResult`:
```typescript
export interface ActionResult {
  success: boolean;
  error?: string;
  data?: unknown;
  action_id?: string;
  url_before?: string;
  url_after?: string;
  snapshot_diff?: SnapshotDiff; // Present when include_snapshot_diff was true
}
```

#### 2.2 Update action commands with diff enabled by default

For mutating commands (click, fill, select, check, etc.), **enable `include_snapshot_diff` by default** and add `--no-diff` option to disable it.

**Example for click.ts:**
```typescript
interface ClickOptions {
  sessionId?: string;
  text?: string;
  force?: boolean;
  diff?: boolean; // Default true, use --no-diff to disable
}

export const clickCommand = new Command('click')
  // ... existing options
  .option('--no-diff', 'Disable snapshot diff (faster, no page change tracking)')
```

Update action execution:
```typescript
const action: {
  type: 'click';
  ref?: string;
  text?: string;
  force?: boolean;
  include_snapshot_diff?: boolean;
} = { type: 'click' };

// ... existing ref/text/force handling

// Diff is enabled by default, disable with --no-diff
if (options.diff !== false) {
  action.include_snapshot_diff = true;
}

const result = await client.executeAction(resolved.id, action);

if (result.success) {
  const target = ref ? `element ${normalizeRef(ref)}` : `"${options.text}"`;
  console.log(success(`Clicked ${target}`));

  // Display snapshot diff if available (and not disabled)
  if (result.snapshot_diff) {
    console.log('');
    console.log(formatSnapshotDiff(result.snapshot_diff));
  }

  await touchSession(resolved.id);
}
```

#### 2.3 Create shared diff formatting utility

Create `src/cli/lib/snapshot-diff.ts`:
```typescript
/**
 * Snapshot diff formatting utilities
 */

import type { SnapshotDiff, SnapshotDiffChange } from '../../../lib/api/browser-types.js';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

export function formatSnapshotDiff(diff: SnapshotDiff): string {
  const lines: string[] = [];

  // Summary line
  lines.push(`${colors.cyan}Changes:${colors.reset} ${diff.summary}`);
  lines.push('');

  // Format each change
  for (const change of diff.changes) {
    lines.push(formatChange(change));
  }

  return lines.join('\n');
}

function formatChange(change: SnapshotDiffChange): string {
  const refStr = `${colors.yellow}[${change.ref}]${colors.reset}`;
  const roleStr = `${colors.gray}${change.role}${colors.reset}`;

  switch (change.change_type) {
    case 'added':
      return `${colors.green}+ ${refStr} ${roleStr} "${change.name}"${colors.reset}` +
        (change.parent_ref ? ` (in ${change.parent_ref})` : '');

    case 'removed':
      return `${colors.red}- ${refStr} ${roleStr} "${change.name}"${colors.reset}`;

    case 'modified': {
      let result = `${colors.yellow}~ ${refStr} ${roleStr} "${change.name}"${colors.reset}`;
      if (change.attribute_changes) {
        const { added, removed } = change.attribute_changes;
        if (added.length > 0) {
          result += `\n    ${colors.green}+attrs: ${added.join(', ')}${colors.reset}`;
        }
        if (removed.length > 0) {
          result += `\n    ${colors.red}-attrs: ${removed.join(', ')}${colors.reset}`;
        }
      }
      return result;
    }

    default:
      return `  ${refStr} ${roleStr} "${change.name}"`;
  }
}
```

#### 2.4 Add `--no-diff` to all mutating commands

Commands to update:
- `click.ts`
- `fill.ts`
- `type.ts`
- `select.ts`
- `check.ts`
- `uncheck.ts`
- `hover.ts`
- `scroll.ts`
- `scroll-into-view.ts`
- `drag.ts`
- `goto.ts`
- `back.ts`
- `forward.ts`
- `reload.ts`
- `press.ts`
- `mfa-totp.ts`
- `upload.ts`
- `wait.ts`
- `wait-for-selector.ts`
- `wait-for-load.ts`

Each command follows the same pattern:
1. Add `--no-diff` option (diff enabled by default)
2. Pass `include_snapshot_diff: true` unless `--no-diff` is set
3. Call `formatSnapshotDiff()` if `result.snapshot_diff` exists

#### 2.5 Update REPL handlers

Add `--diff` flag parsing to REPL commands and display diff when present.

Example for click in `run.ts`:
```typescript
click: async (args, client, sessionId) => {
  const forceIdx = args.findIndex((a) => a === '-f' || a === '--force');
  const noDiffIdx = args.findIndex((a) => a === '--no-diff');
  const force = forceIdx !== -1;
  const disableDiff = noDiffIdx !== -1;

  // Filter out flags
  let filteredArgs = [...args];
  if (forceIdx !== -1) filteredArgs.splice(forceIdx, 1);
  if (noDiffIdx !== -1) filteredArgs.splice(filteredArgs.indexOf('--no-diff'), 1);

  const parsed = parseTextOption(filteredArgs);
  // ... rest of validation

  const action: {
    type: 'click';
    ref?: string;
    text?: string;
    force?: boolean;
    include_snapshot_diff?: boolean;
  } = { type: 'click' };

  // ... set ref/text/force
  // Diff enabled by default, disable with --no-diff
  if (!disableDiff) action.include_snapshot_diff = true;

  const result = await client.executeAction(sessionId, action);
  if (result.success) {
    const target = parsed.ref ? normalizeRef(parsed.ref) : `"${parsed.text}"`;
    console.log(success(`Clicked ${target}`));

    if (result.snapshot_diff) {
      console.log('');
      console.log(formatSnapshotDiff(result.snapshot_diff));
    }
  } else {
    console.log(error(result.error || 'Click failed'));
  }
},
```

Update `printHelp()`:
```typescript
  ${colors.cyan}Actions:${colors.reset}
    click <ref> [--force] [--no-diff]   Click element
    fill <ref> <value> [--no-diff]      Fill input field
    // ... etc

  ${colors.gray}Note: Actions show snapshot diff by default (what changed on page).
  Use --no-diff for faster execution without diff tracking.${colors.reset}
```

#### 2.6 Create test file `src/cli/lib/snapshot-diff.test.ts`

```typescript
import { describe, expect, it } from 'bun:test';
import { formatSnapshotDiff } from './snapshot-diff.js';
import type { SnapshotDiff } from '../../../lib/api/browser-types.js';

describe('formatSnapshotDiff', () => {
  it('should format added elements in green', () => {
    const diff: SnapshotDiff = {
      changes: [{
        ref: 'e54',
        change_type: 'added',
        role: 'generic',
        name: 'New element',
        parent_ref: 'e15'
      }],
      summary: '1 element added',
      refs_added: ['e54'],
      refs_removed: [],
      refs_modified: []
    };
    const output = formatSnapshotDiff(diff);
    expect(output).toContain('+ [e54]');
    expect(output).toContain('New element');
  });

  it('should format removed elements in red', () => {
    const diff: SnapshotDiff = {
      changes: [{
        ref: 'e20',
        change_type: 'removed',
        role: 'button',
        name: 'Old button'
      }],
      summary: '1 element removed',
      refs_added: [],
      refs_removed: ['e20'],
      refs_modified: []
    };
    const output = formatSnapshotDiff(diff);
    expect(output).toContain('- [e20]');
  });

  it('should format modified elements with attribute changes', () => {
    const diff: SnapshotDiff = {
      changes: [{
        ref: 'e18',
        change_type: 'modified',
        role: 'checkbox',
        name: 'Terms checkbox',
        attribute_changes: {
          added: ['checked'],
          removed: []
        }
      }],
      summary: '1 element modified',
      refs_added: [],
      refs_removed: [],
      refs_modified: ['e18']
    };
    const output = formatSnapshotDiff(diff);
    expect(output).toContain('~ [e18]');
    expect(output).toContain('+attrs: checked');
  });

  it('should include summary line', () => {
    const diff: SnapshotDiff = {
      changes: [],
      summary: 'No changes',
      refs_added: [],
      refs_removed: [],
      refs_modified: []
    };
    const output = formatSnapshotDiff(diff);
    expect(output).toContain('Changes: No changes');
  });
});
```

### Verification

```bash
bun run check:fix
bun test src/cli/lib/snapshot-diff.test.ts
```

---

## Phase 3: Relative Drag

### Goal
Add `--delta-x` and `--delta-y` options to the drag command for pixel-based relative dragging.

### Implementation Steps

#### 3.1 Update `lib/api/browser-types.ts`

Add new action type to union:
```typescript
  | 'relative_drag_and_drop';
```

Add interface:
```typescript
export interface RelativeDragAndDropAction {
  type: 'relative_drag_and_drop';
  ref?: string;
  text?: string;
  delta_x: number;
  delta_y: number;
}
```

Add to `BrowserAction` union:
```typescript
  | RelativeDragAndDropAction;
```

#### 3.2 Update `src/cli/commands/browser/drag.ts`

Update options interface:
```typescript
interface DragOptions {
  sessionId?: string;
  text?: string;
  target?: string;
  targetSelector?: string;
  deltaX?: string; // Commander parses as string
  deltaY?: string;
}
```

Update command definition with clear usage examples:
```typescript
export const dragCommand = new Command('drag')
  .description(
    `Drag an element to a target or by pixel offset

Two modes:
  1. Target mode:   drag <ref> --target <target-ref>
                    drag <ref> --target-selector ".drop-zone"
  2. Relative mode: drag <ref> --delta-x 100 --delta-y 50

Examples:
  drag e5 --target e10              # Drag e5 to e10
  drag e5 --target-selector "#drop" # Drag e5 to CSS selector
  drag e5 --delta-x 100             # Drag e5 right by 100px
  drag e5 --delta-x -50 --delta-y 30 # Drag e5 left 50px, down 30px
  drag -t "card" --delta-x 200      # Drag by semantic text`
  )
  .argument('[ref]', 'Source element ref from snapshot (e.g., "e3" or "@e3")')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .option('-t, --text <description>', 'Semantic source element description (AI-based)')
  .option('--target <ref>', 'Target element ref (target mode)')
  .option('--target-selector <selector>', 'Target CSS selector (target mode)')
  .option('--delta-x <pixels>', 'Drag by X pixels (relative mode)')
  .option('--delta-y <pixels>', 'Drag by Y pixels (relative mode)')
```

Update action:
```typescript
.action(async (ref: string | undefined, options: DragOptions) => {
  try {
    // Validate source (ref or --text)
    if (!ref && !options.text) {
      console.log(error('Either <ref> argument or --text option is required for source element'));
      process.exit(1);
    }

    // Check if relative drag mode
    const isRelativeDrag = options.deltaX !== undefined || options.deltaY !== undefined;

    if (isRelativeDrag) {
      // Relative drag mode - delta_x/delta_y required
      if (options.target || options.targetSelector) {
        console.log(error('Cannot use --target/--target-selector with --delta-x/--delta-y'));
        process.exit(1);
      }
    } else {
      // Standard drag mode - target required
      if (!options.target && !options.targetSelector) {
        console.log(error('Either --target <ref>, --target-selector <selector>, or --delta-x/--delta-y is required'));
        process.exit(1);
      }
    }

    const config = await loadConfig();
    if (!config.api_key) {
      console.log(error('API key not configured. Run `qa-use setup` first.'));
      process.exit(1);
    }

    const client = new BrowserApiClient(config.api_url);
    client.setApiKey(config.api_key);

    const resolved = await resolveSessionId({
      explicitId: options.sessionId,
      client,
    });

    let result;

    if (isRelativeDrag) {
      // Relative drag action
      const action: {
        type: 'relative_drag_and_drop';
        ref?: string;
        text?: string;
        delta_x: number;
        delta_y: number;
      } = {
        type: 'relative_drag_and_drop',
        delta_x: parseInt(options.deltaX || '0', 10),
        delta_y: parseInt(options.deltaY || '0', 10),
      };

      if (ref) {
        action.ref = normalizeRef(ref);
      } else if (options.text) {
        action.text = options.text;
      }

      result = await client.executeAction(resolved.id, action);

      if (result.success) {
        const source = ref ? `element ${normalizeRef(ref)}` : `"${options.text}"`;
        console.log(success(`Dragged ${source} by (${action.delta_x}, ${action.delta_y}) pixels`));
        await touchSession(resolved.id);
      }
    } else {
      // Standard drag action (existing code)
      const action: {
        type: 'drag_and_drop';
        ref?: string;
        text?: string;
        target_ref?: string;
        target_selector?: string;
      } = { type: 'drag_and_drop' };

      if (ref) {
        action.ref = normalizeRef(ref);
      } else if (options.text) {
        action.text = options.text;
      }

      if (options.target) {
        action.target_ref = normalizeRef(options.target);
      } else if (options.targetSelector) {
        action.target_selector = options.targetSelector;
      }

      result = await client.executeAction(resolved.id, action);

      if (result.success) {
        const source = ref ? `element ${normalizeRef(ref)}` : `"${options.text}"`;
        const target = options.target
          ? `element ${normalizeRef(options.target)}`
          : `selector "${options.targetSelector}"`;
        console.log(success(`Dragged ${source} to ${target}`));
        await touchSession(resolved.id);
      }
    }

    if (!result.success) {
      const hint = result.error || 'Drag failed';
      console.log(error(`${hint}. Use 'qa-use browser snapshot' to see available elements.`));
      process.exit(1);
    }
  } catch (err) {
    console.log(error(err instanceof Error ? err.message : 'Failed to drag element'));
    process.exit(1);
  }
});
```

#### 3.3 Update REPL drag handler in `run.ts`

Update the `drag` command in the `commands` object:
```typescript
drag: async (args, client, sessionId) => {
  const parsed = parseTextOption(args);
  if (!parsed.ref && !parsed.text) {
    console.log(error('Usage: drag <ref> --target <ref> OR drag <ref> --delta-x <px> --delta-y <px>'));
    return;
  }

  // Check for relative drag options
  const deltaXIdx = parsed.remaining.findIndex((a) => a === '--delta-x');
  const deltaYIdx = parsed.remaining.findIndex((a) => a === '--delta-y');
  const isRelativeDrag = deltaXIdx !== -1 || deltaYIdx !== -1;

  if (isRelativeDrag) {
    const deltaX = deltaXIdx !== -1 ? parseInt(parsed.remaining[deltaXIdx + 1], 10) : 0;
    const deltaY = deltaYIdx !== -1 ? parseInt(parsed.remaining[deltaYIdx + 1], 10) : 0;

    const action: {
      type: 'relative_drag_and_drop';
      ref?: string;
      text?: string;
      delta_x: number;
      delta_y: number;
    } = {
      type: 'relative_drag_and_drop',
      delta_x: deltaX,
      delta_y: deltaY,
    };

    if (parsed.ref) action.ref = normalizeRef(parsed.ref);
    if (parsed.text) action.text = parsed.text;

    const result = await client.executeAction(sessionId, action);
    if (result.success) {
      const source = parsed.ref ? `element ${normalizeRef(parsed.ref)}` : `"${parsed.text}"`;
      console.log(success(`Dragged ${source} by (${deltaX}, ${deltaY}) pixels`));
    } else {
      console.log(error(result.error || 'Relative drag failed'));
    }
    return;
  }

  // Standard drag (existing code)
  const targetIdx = parsed.remaining.indexOf('--target');
  const selectorIdx = parsed.remaining.indexOf('--target-selector');

  if (targetIdx === -1 && selectorIdx === -1) {
    console.log(error('Either --target <ref>, --target-selector <selector>, or --delta-x/--delta-y is required'));
    return;
  }

  const action: {
    type: 'drag_and_drop';
    ref?: string;
    text?: string;
    target_ref?: string;
    target_selector?: string;
  } = { type: 'drag_and_drop' };

  if (parsed.ref) action.ref = normalizeRef(parsed.ref);
  if (parsed.text) action.text = parsed.text;

  if (targetIdx !== -1) {
    action.target_ref = normalizeRef(parsed.remaining[targetIdx + 1]);
  } else if (selectorIdx !== -1) {
    action.target_selector = parsed.remaining[selectorIdx + 1];
  }

  const result = await client.executeAction(sessionId, action);
  if (result.success) {
    const source = parsed.ref ? `element ${normalizeRef(parsed.ref)}` : `"${parsed.text}"`;
    const target = action.target_ref
      ? `element ${action.target_ref}`
      : `selector "${action.target_selector}"`;
    console.log(success(`Dragged ${source} to ${target}`));
  } else {
    console.log(error(result.error || 'Drag failed'));
  }
},
```

Update `printHelp()`:
```typescript
    drag <ref> --target <ref>  Drag to target element
    drag <ref> --delta-x/y <px>  Drag by pixel offset
```

#### 3.4 Create test file `src/cli/commands/browser/drag.test.ts`

```typescript
import { describe, expect, it } from 'bun:test';

describe('drag command', () => {
  describe('standard drag', () => {
    it('should require source ref or --text', () => {
      // Test source validation
    });

    it('should require --target or --target-selector', () => {
      // Test target validation
    });
  });

  describe('relative drag', () => {
    it('should support --delta-x option', () => {
      // Test delta-x parsing
    });

    it('should support --delta-y option', () => {
      // Test delta-y parsing
    });

    it('should default delta to 0 if not provided', () => {
      // Test default values
    });

    it('should reject --target with --delta-x/y', () => {
      // Test mutual exclusivity
    });
  });
});
```

### Verification

```bash
bun run check:fix
bun test src/cli/commands/browser/drag.test.ts
```

---

## Phase 4: E2E Testing

### Prerequisites
- All phases 1-3 must be complete
- Browser session available via `.qa-use-tests.json`

### E2E Test Plan

These tests will be executed manually using `bun run cli browser` commands against https://evals.desplega.ai/ or localhost.

#### Test 1: Evaluate Command

```bash
# Create session
bun run cli browser create --no-headless

# Navigate to test page
bun run cli browser goto https://evals.desplega.ai/

# Test page-level evaluation
bun run cli browser evaluate "document.title"
# Expected: Page title string

# Test element-scoped evaluation
bun run cli browser snapshot --interactive
bun run cli browser evaluate "el => el.tagName" -r e3
# Expected: Element tag name

# Test with --text option
bun run cli browser evaluate "el => el.innerText" -t "main heading"
# Expected: Text content

# Test JSON output
bun run cli browser evaluate "({url: location.href, title: document.title})" --json
# Expected: JSON object

# Cleanup
bun run cli browser close
```

#### Test 2: Snapshot Diff (Action-based, enabled by default)

```bash
# Create session
bun run cli browser create --no-headless

# Navigate
bun run cli browser goto https://evals.desplega.ai/

# Get snapshot to see available elements
bun run cli browser snapshot --interactive

# Click (diff enabled by default)
bun run cli browser click e5
# Expected: Shows success message + colored diff output:
#   Changes: 1 element added, 1 element modified
#   + [e54] generic "New content" (in e15)
#   ~ [e18] checkbox "Terms" +attrs: checked

# Fill (diff enabled by default)
bun run cli browser fill e4 "test@example.com"
# Expected: Shows what changed after filling

# Action with --no-diff to suppress diff output
bun run cli browser click e6 --no-diff
# Expected: Just success message, no diff

# Cleanup
bun run cli browser close
```

#### Test 3: Relative Drag

```bash
# Create session
bun run cli browser create --no-headless

# Navigate to a page with draggable elements
bun run cli browser goto https://evals.desplega.ai/drag

# Get snapshot
bun run cli browser snapshot

# Test relative drag with delta-x only
bun run cli browser drag e5 --delta-x 100
# Expected: Element moved 100px right

# Test relative drag with both deltas
bun run cli browser drag e5 --delta-x -50 --delta-y 30
# Expected: Element moved 50px left and 30px down

# Test with semantic text
bun run cli browser drag -t "draggable item" --delta-x 200 --delta-y 0
# Expected: Element moved by semantic text selection

# Verify standard drag still works
bun run cli browser drag e5 --target e10
# Expected: Standard drag to target

# Cleanup
bun run cli browser close
```

#### Test 4: REPL Mode

```bash
# Start REPL
bun run cli browser run --no-headless

# In REPL, test all new commands:
> goto https://evals.desplega.ai/
> evaluate document.title
> evaluate el => el.tagName -r e3
> snapshot
> click e5
> fill e4 "test"
> click e6 --no-diff
> drag e5 --delta-x 100 --delta-y 50
> exit
```

### Test Results Template

| Test | Command | Expected | Actual | Pass/Fail |
|------|---------|----------|--------|-----------|
| 1.1 | `evaluate "document.title"` | Page title | | |
| 1.2 | `evaluate "el => el.tagName" -r e3` | Tag name | | |
| 1.3 | `evaluate ... --json` | JSON output | | |
| 2.1 | `click e5` (diff default) | Colored diff output | | |
| 2.2 | `fill e4 "value"` (diff default) | Shows changes after fill | | |
| 2.3 | `click e6 --no-diff` | No diff section | | |
| 3.1 | `drag e5 --delta-x 100` | Success message | | |
| 3.2 | `drag e5 --delta-x -50 --delta-y 30` | Success message | | |
| REPL.1 | REPL evaluate | Works | | |
| REPL.2 | REPL snapshot diff | Works | | |
| REPL.3 | REPL relative drag | Works | | |

---

## Implementation Order

1. **Phase 1** - Evaluate command (most impactful)
2. **Phase 2** - Snapshot diff (enabled by default on actions)
3. **Phase 3** - Relative drag (lowest priority)
4. **Phase 4** - E2E testing (all at once)

## Verification After Each Phase

```bash
# Always run after each phase
bun run check:fix
bun test
```
