---
date: 2026-01-30T14:00:00-08:00
topic: "CLI Validation and Drag Action Fixes"
status: draft
commit_per_phase: false
autonomy: critical
---

# CLI Validation and Drag Action Fixes Implementation Plan

## Overview

Fix CLI error serialization issues and documentation inaccuracies discovered during drag_and_drop testing. The `[object Object]` error output makes debugging impossible, and the documented simple `drag` format doesn't exist in the API schema.

## Current State Analysis

### Error Serialization Problem
- 10+ CLI command files use `${err}` template interpolation in catch blocks
- When `err` is a plain object (not Error instance), JavaScript produces `[object Object]`
- No centralized error serialization utility exists
- The `printValidationErrors()` function properly formats structured errors but catch blocks bypass it

### Documentation Problem
- `test-format.md` documents `action: drag` with `target`/`to` fields
- API schema (`/vibe-qa/cli/schema`) shows `SimpleStep.action` does NOT include `drag`
- Valid simple actions: `goto`, `fill`, `click`, `hover`, `scroll`, `select_option`, `wait`, `wait_for_timeout`, `to_contain_text`, `to_have_text`, `to_be_visible`, `to_have_url`
- `drag_and_drop` only available in `ExtendedStep` format

### Key Discoveries:
- Error handling pattern at `src/cli/commands/test/validate.ts:75-77`
- Proper formatter exists at `src/cli/lib/output.ts:433-445`
- API client has `getTestDefinitionSchema()` at `lib/api/index.ts:977-993` but no CLI command exposes it
- `target_locator` in extended format is a Playwright locator string (e.g., `"#drop-zone"`, `"text=Drop here"`)

## Desired End State

1. All CLI error messages show human-readable details instead of `[object Object]`
2. Users can run `qa-use test schema [path]` to inspect the API schema
3. Documentation accurately reflects the API schema - no `drag` in simple format
4. Plugin skill files updated with correct information

### Verification:
- Run `qa-use test validate` with invalid YAML → readable error message
- Run `qa-use test schema SimpleStep.action` → shows valid actions
- No references to simple `action: drag` in documentation

## Quick Verification Reference

Common commands to verify the implementation:
- `bun run check:fix` - Lint and format
- `bun run typecheck` - Type checking
- `bun test` - Run tests

Key files to check:
- `src/cli/lib/output.ts` - Error utility
- `src/cli/commands/test/schema.ts` - New schema command
- `plugins/qa-use/skills/qa-use/references/test-format.md` - Documentation

## What We're NOT Doing

- Adding simple `drag` format to the API schema (backend change)
- Changing the browser CLI drag command (working correctly)
- Adding new test coverage (out of scope for this fix)
- Refactoring the entire error handling architecture

## Implementation Approach

1. Create a centralized `formatError()` utility that handles all error types
2. Apply it consistently across all CLI command catch blocks
3. Add schema introspection command for discoverability
4. Update documentation to match reality

---

## Phase 1: Add Error Serialization Utility

### Overview
Create a centralized error formatting utility in `output.ts` that properly serializes any error type to a human-readable string.

### Changes Required:

#### 1. Error Formatting Utility
**File**: `src/cli/lib/output.ts`
**Changes**: Add `formatError()` function after the existing `error()` function (around line 88)

```typescript
/**
 * Format any error type to a human-readable string
 * Handles Error instances, plain objects, and primitives
 */
export function formatError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  if (err && typeof err === 'object') {
    // Handle axios error responses
    if ('message' in err && typeof err.message === 'string') {
      return err.message;
    }
    if ('detail' in err && typeof err.detail === 'string') {
      return err.detail;
    }
    // Handle arrays of errors (validation errors)
    if (Array.isArray(err)) {
      return err.map(e => formatError(e)).join('\n');
    }
    // Fallback to JSON for other objects
    try {
      return JSON.stringify(err, null, 2);
    } catch {
      return String(err);
    }
  }
  return String(err);
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Lint passes: `bun run check:fix`
- [ ] Type check passes: `bun run typecheck`
- [ ] Tests pass: `bun test`

#### Manual Verification:
- [ ] New function is exported from `output.ts`

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Fix CLI Command Catch Blocks

### Overview
Update all CLI command files to use `formatError()` instead of direct string interpolation.
### Changes Required:

#### 1. validate.ts
**File**: `src/cli/commands/test/validate.ts`
**Line**: 76
**Change**:
```typescript
// Before
console.log(error(`Validation failed: ${err}`));
// After
console.log(error(`Validation failed: ${formatError(err)}`));
```
**Import**: Add `formatError` to imports from `../../lib/output.js`

#### 2. run.ts
**File**: `src/cli/commands/test/run.ts`
**Line**: 220
**Change**: Same pattern - wrap `${err}` with `formatError(err)`

#### 3. sync.ts
**File**: `src/cli/commands/test/sync.ts`
**Lines**: 45, 140, 191, 265
**Change**: Same pattern at all 4 locations

#### 4. export.ts
**File**: `src/cli/commands/test/export.ts`
**Line**: 113
**Change**: Same pattern

#### 5. runs.ts
**File**: `src/cli/commands/test/runs.ts`
**Line**: 165
**Change**: Same pattern

#### 6. init.ts
**File**: `src/cli/commands/test/init.ts`
**Line**: 63
**Change**: Same pattern

#### 7. list.ts
**File**: `src/cli/commands/test/list.ts`
**Lines**: 67, 74
**Change**: Same pattern at both locations

#### 8. diff.ts
**File**: `src/cli/commands/test/diff.ts`
**Line**: 209
**Change**: Same pattern

#### 9. info.ts
**File**: `src/cli/commands/test/info.ts`
**Line**: 175
**Change**: Same pattern

### Success Criteria:

#### Automated Verification:
- [ ] Lint passes: `bun run check:fix`
- [ ] Type check passes: `bun run typecheck`
- [ ] Tests pass: `bun test`
- [ ] No `${err}` patterns remain: `grep -r '\${err}' src/cli/commands/test/`

#### Manual Verification:
- [ ] Run `qa-use test validate` with invalid YAML - error is readable
- [ ] Run `qa-use test run nonexistent` - error is readable

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Add Schema Command

### Overview
Create a `qa-use test schema` command to make the API schema discoverable.

### Changes Required:

#### 1. Create Schema Command
**File**: `src/cli/commands/test/schema.ts` (new file)
**Changes**: Create new command file

```typescript
/**
 * qa-use test schema - View test definition schema
 */

import { Command } from 'commander';
import { ApiClient } from '../../../../lib/api/index.js';
import { loadConfig } from '../../lib/config.js';
import { error, formatError, info } from '../../lib/output.js';

export const schemaCommand = new Command('schema')
  .description('View test definition schema')
  .argument('[path]', 'JSON path to specific schema part (e.g., "SimpleStep.action", "$defs.ActionInstruction")')
  .addHelpText('after', `
Examples:
  qa-use test schema                     # Full schema
  qa-use test schema SimpleStep          # SimpleStep definition
  qa-use test schema SimpleStep.action   # Valid simple actions
  qa-use test schema --raw | jq '.properties.steps'  # Use jq for advanced queries
`)
  .option('--raw', 'Output raw JSON without formatting')
  .action(async (schemaPath, options) => {
    try {
      const config = await loadConfig();

      // Initialize API client
      const client = new ApiClient(config.api_url);
      if (config.api_key) {
        client.setApiKey(config.api_key);
      }

      // Fetch schema
      const schema = await client.getTestDefinitionSchema();

      let output = schema;

      // Navigate to specific path if provided
      if (schemaPath) {
        const parts = schemaPath.split('.');
        for (const part of parts) {
          if (output && typeof output === 'object') {
            // Handle $defs references
            if (part === '$defs' || part in output) {
              output = output[part];
            } else if (output.$defs && part in output.$defs) {
              output = output.$defs[part];
            } else if (output.properties && part in output.properties) {
              output = output.properties[part];
            } else {
              console.log(error(`Path "${schemaPath}" not found in schema`));
              console.log(info('Available keys: ' + Object.keys(output).join(', ')));
              process.exit(1);
            }
          }
        }
      }

      // Output
      if (options.raw) {
        console.log(JSON.stringify(output));
      } else {
        console.log(JSON.stringify(output, null, 2));
      }
    } catch (err) {
      console.log(error(`Failed to fetch schema: ${formatError(err)}`));
      process.exit(1);
    }
  });
```

#### 2. Register Command
**File**: `src/cli/commands/test/index.ts`
**Changes**: Import and register the schema command

```typescript
import { schemaCommand } from './schema.js';
// ... in command registration
testCommand.addCommand(schemaCommand);
```

### Success Criteria:

#### Automated Verification:
- [ ] Lint passes: `bun run check:fix`
- [ ] Type check passes: `bun run typecheck`
- [ ] Tests pass: `bun test`
- [ ] File exists: `ls src/cli/commands/test/schema.ts`

#### Manual Verification:
- [ ] `qa-use test schema` - shows full schema
- [ ] `qa-use test schema SimpleStep` - shows SimpleStep definition
- [ ] `qa-use test schema SimpleStep.action` - shows action enum (no "drag")
- [ ] `qa-use test schema $defs.ActionInstruction` - shows extended actions (includes "drag_and_drop")

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding to Phase 4.

---

## Phase 4: Update test-format.md Documentation

### Overview
Fix the documentation to remove invalid `drag` simple format and document the correct extended format.

### Changes Required:

#### 1. Update test-format.md
**File**: `plugins/qa-use/skills/qa-use/references/test-format.md`
**Changes**:

1. **Remove `drag` from Interactions table** (around line 124):
   - Remove the row: `| `drag` | `target`, `to` | Drag element to target |`

2. **Remove invalid drag example** (around lines 147-149):
   - Remove the example:
   ```yaml
   - action: drag
     target: draggable item
     to: drop zone
   ```

3. **Add Extended Step Format section** (new section after "AI-Powered Actions"):

```markdown
### Extended Step Format

For actions not available in simple format (like drag operations), use the extended format:

| Action | Description |
|--------|-------------|
| `drag_and_drop` | Drag source element to target |
| `relative_drag_and_drop` | Drag with relative positioning |
| `mfa_totp` | Generate and enter TOTP code |
| `set_input_files` | Upload files |

#### Drag and Drop Example

```yaml
- type: extended
  name: Drag item to drop zone
  action:
    action: drag_and_drop
    value:
      target_locator: "#drop-zone"  # Playwright locator string
  locator:
    chain:
      - method: get_by_text
        args: ["draggable item"]
```

The `target_locator` must be a valid Playwright locator string:
- `"#drop-zone"` - CSS ID selector
- `".drop-area"` - CSS class selector
- `"text=Drop here"` - Text selector
- `"[data-testid='target']"` - Attribute selector

#### TOTP Example

```yaml
- type: extended
  name: Enter MFA code
  action:
    action: mfa_totp
    value:
      target_locator: "#otp-input"
  locator:
    chain:
      - method: get_by_label
        args: ["Enter your code"]
```

**Tip:** Use `qa-use test schema` to explore all available actions and their schemas.
```

### Success Criteria:

#### Automated Verification:
- [ ] Lint passes: `bun run check:fix`
- [ ] No simple `action: drag` in docs: `grep -r "action: drag$" plugins/`

#### Manual Verification:
- [ ] Documentation accurately reflects API schema
- [ ] Extended format examples are clear and correct
- [ ] Reference to `qa-use test schema` added

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding to Phase 5.

---

## Phase 5: Update Plugin Skill Files

### Overview
Update SKILL.md and browser-commands.md to reflect correct information and add schema command.

### Changes Required:

#### 1. Update SKILL.md
**File**: `plugins/qa-use/skills/qa-use/SKILL.md`
**Changes**:

1. **Add schema command to Test Operations table** (around line 151):
```markdown
| `qa-use test schema [path]` | View test definition schema |
```

2. **Update Test Format Overview note** (around line 192):
```markdown
**Note:** Simple format supports: `goto`, `fill`, `click`, `hover`, `scroll`, `select_option`, `wait`, `wait_for_timeout`, and assertions. For drag operations and other advanced actions, use the extended format documented in test-format.md.
```

#### 2. Update browser-commands.md (if needed)
**File**: `plugins/qa-use/skills/qa-use/references/browser-commands.md`
**Changes**: Verify browser CLI drag documentation is accurate (it uses different format than test YAML)

The browser CLI uses `qa-use browser drag <ref> --target <ref>` which is correct and different from YAML test format. Add a note clarifying this:

```markdown
**Note:** The browser CLI drag command uses element refs from snapshots. This is different from the test YAML format which uses locator chains. See test-format.md for YAML test syntax.
```

### Success Criteria:

#### Automated Verification:
- [ ] Lint passes: `bun run check:fix`
- [ ] Schema command documented: `grep "test schema" plugins/qa-use/skills/qa-use/SKILL.md`

#### Manual Verification:
- [ ] SKILL.md Test Operations table includes schema command
- [ ] browser-commands.md clarifies difference between CLI and YAML formats
- [ ] All documentation is internally consistent

**Implementation Note**: After completing this phase, the implementation is complete.

---

## Testing Strategy

### Unit Testing
- Existing tests should continue to pass
- `formatError()` handles: Error instances, strings, objects with message/detail, arrays, plain objects

### Integration Testing
- Run `qa-use test validate` with intentionally broken YAML
- Run `qa-use test schema` commands as documented

### Manual Testing
1. Create invalid YAML (e.g., `action: drag` in simple format)
2. Run `qa-use test validate invalid.yaml`
3. Verify error message is readable (not `[object Object]`)
4. Run `qa-use test schema SimpleStep.action` and verify `drag` is not listed

## References

- Research: `thoughts/taras/research/2026-01-30-cli-validation-and-drag-issues.md`
- API Schema: `http://localhost:5005/vibe-qa/cli/schema`
- Type generator: `scripts/generate-types.ts`

### Backend Validation Types (for reference)

The backend returns validation results in this format:

```python
class ValidationSeverity(str, Enum):
    ERROR = "error"
    WARNING = "warning"

class ValidationIssue(BaseModel):
    path: str  # e.g., "test_definitions[0].steps[1]"
    message: str
    severity: ValidationSeverity

class ResolvedInfo(BaseModel):
    app_config_id: Optional[str] = None
    app_config_name: Optional[str] = None
    total_steps: int = 0
    variables_used: List[str] = Field(default_factory=list)
    dependencies: List[str] = Field(default_factory=list)

class ValidationResult(BaseModel):
    valid: bool
    errors: List[ValidationIssue] = Field(default_factory=list)
    warnings: List[ValidationIssue] = Field(default_factory=list)
    resolved: Optional[ResolvedInfo] = None
```

The `formatError()` utility should handle `ValidationIssue` objects which have `path`, `message`, and `severity` fields.
