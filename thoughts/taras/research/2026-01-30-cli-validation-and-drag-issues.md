---
date: 2026-01-30T12:00:00-08:00
researcher: Claude
git_commit: 6752265
branch: main
repository: qa-use
topic: "CLI Validation Error Formatting and drag_and_drop Action Format Issues"
tags: [research, codebase, cli, validation, drag-and-drop, test-format]
status: complete
autonomy: critical
last_updated: 2026-01-30
last_updated_by: Claude
---

# Research: CLI Validation Error Formatting and drag_and_drop Action Format Issues

**Date**: 2026-01-30
**Researcher**: Claude
**Git Commit**: 6752265
**Branch**: main

## Research Question

Investigate four CLI issues:
1. Validation error messages show `[object Object]` instead of readable messages
2. The YAML format for `drag_and_drop` actions is unclear
3. Mismatch between simple and extended step formats for drag operations
4. Browser CLI vs Test YAML format inconsistency for drag operations

## Summary

The `[object Object]` error output is caused by a widespread pattern in the CLI codebase where caught exceptions are interpolated directly into template strings. When the backend returns error objects (not Error instances), JavaScript's implicit string conversion produces `[object Object]`. The fix requires wrapping error interpolation with proper serialization.

The `drag_and_drop` action format confusion stems from three different interfaces: (1) the simple YAML format using `action: drag` with `target`/`to` fields, (2) the extended YAML format using `action: drag_and_drop` with `locator`/`target_locator`, and (3) the browser API format using `ref`/`target_ref`. The documentation covers simple format but lacks extended format examples. The CLI uses the browser API format internally, which doesn't map directly to either YAML format.

## Detailed Findings

### Issue 1: Validation Error Messages Show [object Object]

The root cause is in the error handling pattern used across all CLI commands. At `src/cli/commands/test/validate.ts:75-77`:

```typescript
} catch (err) {
  console.log(error(`Validation failed: ${err}`));
  process.exit(1);
}
```

When `err` is a plain JavaScript object (not an `Error` instance), template string interpolation calls `toString()` which returns `[object Object]`.

**Files affected by this pattern:**

| File | Line(s) | Error Message Pattern |
|------|---------|----------------------|
| `src/cli/commands/test/validate.ts` | 76 | `Validation failed: ${err}` |
| `src/cli/commands/test/run.ts` | 220 | `Test execution failed: ${err}` |
| `src/cli/commands/test/sync.ts` | 45, 140, 191, 265 | Various sync errors |
| `src/cli/commands/test/export.ts` | 113 | `Export failed: ${err}` |
| `src/cli/commands/test/runs.ts` | 165 | `Failed to list test runs: ${err}` |
| `src/cli/commands/test/init.ts` | 63 | `Initialization failed: ${err}` |
| `src/cli/commands/test/list.ts` | 67, 74 | `Failed to load/list: ${err}` |
| `src/cli/commands/test/diff.ts` | 209 | `Failed to diff: ${err}` |
| `src/cli/commands/test/info.ts` | 175 | `Failed to get test info: ${err}` |

The proper error formatting function exists at `src/cli/lib/output.ts:433-445`:

```typescript
export function printValidationErrors(
  errors: Array<{ path: string; message: string; severity: string }>
): void {
  for (const err of errors) {
    const icon = err.severity === 'error' ? `${colors.red}✗` : ...;
    console.log(`  ${icon}${colors.reset} ${err.path}: ${err.message}`);
  }
}
```

This function is used correctly for `ValidationResult.errors` but catch blocks bypass it entirely.

### Issue 2: drag_and_drop Action Format

Three distinct formats exist:

**1. Simple Step Format (YAML test files)** - **INCORRECT DOCUMENTATION**

Documented in `plugins/qa-use/skills/qa-use/references/test-format.md:147-149`, but **this format is NOT valid per the API schema**:

```yaml
# DOCUMENTED BUT INVALID - drag not in SimpleStep.action enum
- action: drag
  target: draggable item    # Source element (semantic description)
  to: drop zone             # Target element (semantic description)
```

This explains why validation fails with unhelpful errors - the schema doesn't allow `drag` in simple steps.

**2. Extended Step Format (YAML test files)**

Defined in `src/types/test-definition.ts`. Uses `drag_and_drop` action with `locator` for source and `target_locator` **string** in `action.value`:

```yaml
- type: extended
  action:
    action: drag_and_drop
    value:
      target_locator: "#drop-zone"  # Playwright locator string for page.locator()
  locator:                          # Source element (locator chain)
    chain:
      - method: get_by_text
        args: ["draggable item"]
```

**Important**: `target_locator` is a **Playwright locator string** used directly as `page.locator(target_locator)`. Valid examples:
- `"#drop-zone"` (CSS selector)
- `"text=Drop here"` (text selector)
- `"[data-testid='drop-area']"` (attribute selector)
- `".drop-zone"` (class selector)

**3. Browser API Format (CLI internal)**

Defined in `lib/api/browser-types.ts:192-198`:

```typescript
export interface DragAndDropAction {
  type: 'drag_and_drop';
  ref?: string;              // Source element ref (e.g., "e5")
  text?: string;             // Source semantic description (AI-based)
  target_ref?: string;       // Target element ref (e.g., "e10")
  target_selector?: string;  // Target CSS selector
}
```

### Issue 3: Simple vs Extended Format Mismatch

**Critical Finding**: The API schema confirms `SimpleStep` does NOT support `drag` action at all. The documentation is incorrect.

**Simple format** (per API schema `SimpleStep`):
- Allowed actions: `goto`, `fill`, `click`, `hover`, `scroll`, `select_option`, `wait`, `wait_for_timeout`, `to_contain_text`, `to_have_text`, `to_be_visible`, `to_have_url`
- **No `drag` action** - this is a documentation bug in `test-format.md`

**Extended format** (per API schema `ActionInstruction`):
- Includes 70+ actions including `drag_and_drop` and `relative_drag_and_drop`
- Uses `locator` chain for source element
- Uses `target_locator` string in `action.value` for destination

**Conclusion**: The documented simple format `action: drag` with `target`/`to` fields doesn't exist in the schema. Users must use `ExtendedStep` with `action: drag_and_drop` for drag operations.

### Issue 4: CLI vs YAML Inconsistency

**CLI Implementation** (`src/cli/commands/browser/drag.ts:61-79`):

```typescript
const action: DragAndDropAction = { type: 'drag_and_drop' };

if (ref) {
  action.ref = normalizeRef(ref);       // positional arg -> ref
} else if (options.text) {
  action.text = options.text;           // -t/--text -> text
}

if (options.target) {
  action.target_ref = normalizeRef(options.target);     // --target -> target_ref
} else if (options.targetSelector) {
  action.target_selector = options.targetSelector;       // --target-selector -> target_selector
}
```

**CLI usage:**
```bash
qa-use browser drag e42 --target e67
qa-use browser drag -t "drag handle" --target e67
qa-use browser drag e42 --target-selector ".drop-zone"
```

**YAML simple format:**
```yaml
- action: drag
  target: drag handle      # Maps to text (semantic) or requires locator resolution
  to: drop zone            # Maps to target (semantic)
```

The CLI uses element refs (`e42`, `e67`) from snapshots, while YAML uses semantic descriptions that require AI-based resolution. They serve different use cases but the field naming is inconsistent.

## Code References

| File | Line | Description |
|------|------|-------------|
| `src/cli/commands/test/validate.ts` | 75-77 | Catch block producing `[object Object]` |
| `src/cli/lib/output.ts` | 433-445 | `printValidationErrors()` - proper error formatter |
| `src/cli/lib/output.ts` | 86-88 | `error()` - expects string, gets object |
| `src/types/test-definition.ts` | 57-58 | `drag_and_drop` in Action1 type |
| `src/types/test-definition.ts` | 339-348 | SimpleStep interface |
| `src/types/test-definition.ts` | 428 | `target_locator` in AnyDict |
| `lib/api/browser-types.ts` | 192-198 | DragAndDropAction interface |
| `src/cli/commands/browser/drag.ts` | 61-79 | CLI drag action construction |
| `src/cli/commands/browser/run.ts` | 573-621 | REPL drag command handler |
| `plugins/qa-use/skills/qa-use/references/test-format.md` | 147-149 | Simple drag format docs |
| `plugins/qa-use/skills/qa-use/references/browser-commands.md` | 244-266 | CLI drag docs |
| `lib/api/index.ts` | 274-279 | ValidationError/ValidationResult types |
| `lib/api/index.ts` | 904-926 | validateTestDefinition API method |

## Architecture Documentation

### Error Handling Pattern
The codebase uses a consistent but flawed pattern for error handling:
1. Async operations wrapped in try/catch
2. Catch blocks use template string interpolation: `` `Failed: ${err}` ``
3. The `error()` function from `output.ts` expects a string and adds red styling
4. No centralized error serialization utility exists

### Test Format Architecture
- **Simple format**: Human-readable YAML with semantic element descriptions
- **Extended format**: Machine-precise YAML with locator chains
- **Browser API format**: Internal format for real-time browser automation
- Backend converts simple → extended during test execution
- CLI drag bypasses YAML format entirely, using browser API directly

### Validation Flow
1. CLI loads YAML via `loadTestWithDeps()` in `src/cli/lib/loader.ts:99-141`
2. Sends to backend via `client.validateTestDefinition()` at `lib/api/index.ts:904`
3. Backend returns `ValidationResult` with structured errors
4. CLI calls `printValidationErrors()` for validation errors
5. Other errors caught in generic catch block and serialized poorly

## Historical Context (from thoughts/)

No directly related prior research found, but `thoughts/taras/plans/2026-01-28-new-browser-actions.md` documents the implementation plan for drag, mfa-totp, and upload commands, confirming the browser API format was intentionally designed with `ref`/`target_ref` fields.

## Related Research

- `thoughts/taras/research/2026-01-23-browser-subcommand.md` - Browser subcommand architecture

## Open Questions

None remaining - all questions resolved via API schema.

## Resolved Questions

1. ~~**Backend validation errors**: What format does the backend return when validation fails via HTTP error?~~
   - **Resolution**: Backend returns AI-readable format. The `[object Object]` issue is a CLI serialization problem, not a backend format issue.

2. ~~**Simple → Extended conversion**: Where does the conversion happen?~~
   - **Resolution**: Conversion from simple `drag` format to extended `drag_and_drop` happens in the backend during test processing.

3. ~~**Extended drag format verification**: Does `target_locator` go inside `action.value` or as sibling to `locator`?~~
   - **Resolution**: Per API schema (`/vibe-qa/cli/schema`), `target_locator` is defined in `AnyDict` as a **string**. It goes inside `action.value` and must be a valid Playwright locator string (used as `page.locator(target_locator)`):
   ```yaml
   - type: extended
     action:
       action: drag_and_drop
       value:
         target_locator: "#drop-zone"  # or "text=Drop here", ".drop-area", etc.
     locator:
       chain:
         - method: get_by_text
           args: ["source element"]
   ```

4. ~~**Why no `drag` in Action type?**~~
   - **Resolution**: Per API schema, `SimpleStep.action` enum does NOT include `drag`. The allowed simple actions are: `goto`, `fill`, `click`, `hover`, `scroll`, `select_option`, `wait`, `wait_for_timeout`, `to_contain_text`, `to_have_text`, `to_be_visible`, `to_have_url`. **The documentation showing `action: drag` in simple format is incorrect/outdated.** Drag operations require `ExtendedStep` with `action: drag_and_drop`.

## Schema Reference

API schema fetched from `http://localhost:5005/vibe-qa/cli/schema` and type generator at `scripts/generate-types.ts` (run via `bun run generate:types`).
