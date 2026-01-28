---
date: 2026-01-28T12:00:00Z
topic: "New Browser Actions CLI Support"
---

# New Browser Actions Implementation Plan

## Overview
Add CLI support for three new browser actions that are now available in the backend Browser Session API:
1. **drag_and_drop** - Drag an element to a target element
2. **mfa_totp** - Generate TOTP codes and optionally fill them into input fields
3. **set_input_files** - Upload files to input[type=file] elements

## Current State Analysis

### Existing CLI Command Structure
- Browser CLI commands are in `src/cli/commands/browser/*.ts` (30 files)
- Commands follow a consistent pattern with `commander.js`
- All element-targeting commands support both `ref` and `--text` options
- Commands are registered in `src/cli/commands/browser/index.ts:49-84`
- REPL implementation is in `src/cli/commands/browser/run.ts:166-573`

### API Client Structure
- `BrowserApiClient` in `lib/api/browser.ts:170-177` handles action execution
- Action types defined in `lib/api/browser-types.ts:45-209`
- Actions sent via POST to `/sessions/{sessionId}/action`

### Key Discoveries:
- Commands using ref/text pattern: `click.ts:51-56`, `fill.ts:70-78`, `select.ts:70-78`
- REPL uses `parseTextOption()` helper at `run.ts:643-656`
- `normalizeRef()` strips leading `@` from refs at `click.ts:19-21`
- Commands use `touchSession()` after successful execution

## Desired End State

### CLI Commands Available:
```bash
# Drag and drop
qa-use browser drag <source-ref> --target <target-ref>
qa-use browser drag <source-ref> --target-selector "#drop-zone"
qa-use browser drag --text "Draggable item" --target <target-ref>

# MFA TOTP
qa-use browser mfa-totp <ref> <secret>
qa-use browser mfa-totp --text "Enter code" <secret>
qa-use browser mfa-totp <secret>  # Generate only, don't fill

# File upload
qa-use browser upload <ref> <file-path>
qa-use browser upload <ref> <file1> <file2>  # Multiple files
qa-use browser upload --text "Choose file" <file-path>
```

### REPL Commands Available:
```
drag <ref> --target <target-ref>
drag <ref> --target-selector "#drop-zone"
mfa-totp <ref> <secret>
mfa-totp <secret>
upload <ref> <file>...
```

## Quick Verification Reference

Common commands to verify the implementation:
- `bun run build` - Build TypeScript
- `bun run lint:fix` - Fix linting issues
- `bun run typecheck` - Type check
- `bun test` - Run tests

Key files to check:
- `src/cli/commands/browser/drag.ts` (new)
- `src/cli/commands/browser/mfa-totp.ts` (new)
- `src/cli/commands/browser/upload.ts` (new)
- `src/cli/commands/browser/index.ts` (updated)
- `src/cli/commands/browser/run.ts` (updated)
- `lib/api/browser-types.ts` (updated)

Manual testing pages:
- Drag and drop: https://evals.desplega.ai/graph?seed=default
- OTP: https://evals.desplega.ai/otp?seed=1337
- Files: https://evals.desplega.ai/files

## What We're NOT Doing
- Adding tests (can be done in a follow-up)
- Modifying the API client (`BrowserApiClient.executeAction` already handles arbitrary actions)
- Adding new MCP tools (out of scope)

## Implementation Approach
1. Add type definitions for the three new actions
2. Implement each CLI command following existing patterns
3. Add REPL handlers for each command
4. Register commands in index.ts
5. Update help text in REPL

---

## Phase 1: Type Definitions

### Overview
Add TypeScript interfaces for the three new browser actions.

### Changes Required:

#### 1. Browser Action Types
**File**: `lib/api/browser-types.ts`
**Changes**: Add new action interfaces and update the union type

Add after `ScreenshotAction` (line ~187):
```typescript
export interface DragAndDropAction {
  type: 'drag_and_drop';
  ref?: string;
  text?: string;
  target_ref?: string;
  target_selector?: string;
}

export interface MfaTotpAction {
  type: 'mfa_totp';
  secret: string;
  ref?: string;
  text?: string;
}

export interface SetInputFilesAction {
  type: 'set_input_files';
  ref?: string;
  text?: string;
  files: string[];
}
```

Update `BrowserActionType` to include:
- `'drag_and_drop'`
- `'mfa_totp'`
- `'set_input_files'`

Update `BrowserAction` union to include:
- `DragAndDropAction`
- `MfaTotpAction`
- `SetInputFilesAction`

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `bun run typecheck`
- [ ] Build succeeds: `bun run build`

#### Manual Verification:
- [ ] Types are correctly exported from the module

**Implementation Note**: After completing this phase, pause for manual confirmation.

---

## Phase 2: Drag Command

### Overview
Implement the `drag` CLI command for drag-and-drop functionality.

### Changes Required:

#### 1. Drag Command
**File**: `src/cli/commands/browser/drag.ts` (new)
**Changes**: Create new command file

```typescript
/**
 * qa-use browser drag - Drag element to target
 */

import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import { resolveSessionId, touchSession } from '../../lib/browser-sessions.js';
import { loadConfig } from '../../lib/config.js';
import { success, error } from '../../lib/output.js';

interface DragOptions {
  sessionId?: string;
  text?: string;
  target?: string;
  targetSelector?: string;
}

function normalizeRef(ref: string): string {
  return ref.startsWith('@') ? ref.slice(1) : ref;
}

export const dragCommand = new Command('drag')
  .description('Drag an element to a target element')
  .argument('[ref]', 'Source element ref from snapshot (e.g., "e3")')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .option('-t, --text <description>', 'Semantic source element description (AI-based)')
  .option('--target <ref>', 'Target element ref')
  .option('--target-selector <selector>', 'Target CSS selector')
  .action(async (ref: string | undefined, options: DragOptions) => {
    // Validate source (ref or --text)
    // Validate target (--target or --target-selector)
    // Build action and execute
  });
```

#### 2. Register Command
**File**: `src/cli/commands/browser/index.ts`
**Changes**: Import and register `dragCommand`

### Success Criteria:

#### Automated Verification:
- [ ] Build succeeds: `bun run build`
- [ ] Lint passes: `bun run lint:fix`
- [ ] TypeScript compiles: `bun run typecheck`

#### Manual Verification:
- [ ] Create a browser session: `bun run cli browser create --no-headless`
- [ ] Navigate to test page: `bun run cli browser goto https://evals.desplega.ai/graph?seed=default`
- [ ] Get snapshot: `bun run cli browser snapshot`
- [ ] Drag a node to another: `bun run cli browser drag <source-ref> --target <target-ref>`
- [ ] Verify drag completed successfully

**Implementation Note**: After completing this phase, pause for manual confirmation.

---

## Phase 3: MFA TOTP Command

### Overview
Implement the `mfa-totp` CLI command for TOTP code generation and auto-fill.

### Changes Required:

#### 1. MFA TOTP Command
**File**: `src/cli/commands/browser/mfa-totp.ts` (new)
**Changes**: Create new command file

The command should support three modes:
1. `mfa-totp <ref> <secret>` - Fill OTP into element by ref
2. `mfa-totp --text "description" <secret>` - Fill OTP into element by text
3. `mfa-totp <secret>` - Generate OTP only (no fill)

Note: The secret might be present in app config. Consider checking if the secret looks like a valid TOTP secret (base32 encoded).

#### 2. Register Command
**File**: `src/cli/commands/browser/index.ts`
**Changes**: Import and register `mfaTotpCommand`

### Success Criteria:

#### Automated Verification:
- [ ] Build succeeds: `bun run build`
- [ ] Lint passes: `bun run lint:fix`
- [ ] TypeScript compiles: `bun run typecheck`

#### Manual Verification:
- [ ] Create a browser session: `bun run cli browser create --no-headless`
- [ ] Navigate to test page: `bun run cli browser goto https://evals.desplega.ai/otp?seed=1337`
- [ ] Get snapshot to find OTP input: `bun run cli browser snapshot`
- [ ] Test with secret only (generate): `bun run cli browser mfa-totp <secret>`
- [ ] Test with ref and secret (fill): `bun run cli browser mfa-totp <ref> <secret>`
- [ ] Verify OTP code was generated/filled correctly

**Implementation Note**: After completing this phase, pause for manual confirmation.

---

## Phase 4: Upload Command

### Overview
Implement the `upload` CLI command for file input handling.

### Changes Required:

#### 1. Upload Command
**File**: `src/cli/commands/browser/upload.ts` (new)
**Changes**: Create new command file

The command should support:
1. `upload <ref> <file>` - Single file upload
2. `upload <ref> <file1> <file2>` - Multiple files
3. `upload --text "description" <file>` - Upload to element by text

Note: Files should be validated to exist before sending to the API.

#### 2. Register Command
**File**: `src/cli/commands/browser/index.ts`
**Changes**: Import and register `uploadCommand`

### Success Criteria:

#### Automated Verification:
- [ ] Build succeeds: `bun run build`
- [ ] Lint passes: `bun run lint:fix`
- [ ] TypeScript compiles: `bun run typecheck`

#### Manual Verification:
- [ ] Create a browser session: `bun run cli browser create --no-headless`
- [ ] Navigate to test page: `bun run cli browser goto https://evals.desplega.ai/files`
- [ ] Get snapshot to find file input: `bun run cli browser snapshot`
- [ ] Create a test file: `echo "test" > /tmp/test-upload.txt`
- [ ] Test upload: `bun run cli browser upload <ref> /tmp/test-upload.txt`
- [ ] Verify file was uploaded successfully

**Implementation Note**: After completing this phase, pause for manual confirmation.

---

## Phase 5: REPL Integration

### Overview
Add handlers for all three new commands to the interactive REPL.

### Changes Required:

#### 1. REPL Command Handlers
**File**: `src/cli/commands/browser/run.ts`
**Changes**: Add handlers for `drag`, `mfa-totp`, and `upload` in the `commands` object (around line 166)

```typescript
// Add to commands object:

drag: async (args, client, sessionId) => {
  // Parse: drag <ref> --target <target-ref> or --target-selector <sel>
  // Also support: drag -t "text" --target <ref>
},

'mfa-totp': async (args, client, sessionId) => {
  // Parse: mfa-totp [ref] <secret> or mfa-totp -t "text" <secret>
  // Also support: mfa-totp <secret> (generate only)
},

upload: async (args, client, sessionId) => {
  // Parse: upload <ref> <file>... or upload -t "text" <file>...
},
```

#### 2. Update Help Text
**File**: `src/cli/commands/browser/run.ts`
**Changes**: Update `printHelp()` function (around line 694) to include new commands

Add to the `Actions:` section:
```
    drag <ref> --target <ref>
                            Drag element to target (--target-selector for CSS)
    mfa-totp [ref] <secret> Generate TOTP code (optionally fill into ref)
    upload <ref> <file>...  Upload file(s) to input
```

### Success Criteria:

#### Automated Verification:
- [ ] Build succeeds: `bun run build`
- [ ] Lint passes: `bun run lint:fix`
- [ ] TypeScript compiles: `bun run typecheck`

#### Manual Verification:
- [ ] Start REPL: `bun run cli browser run --no-headless`
- [ ] Type `help` and verify new commands are listed
- [ ] Test drag command in REPL
- [ ] Test mfa-totp command in REPL
- [ ] Test upload command in REPL

**Implementation Note**: After completing this phase, pause for manual confirmation.

---

## Phase 6: End-to-End Testing

### Overview
Perform comprehensive E2E testing of all three new commands using the test pages.

### Testing Steps:

#### 1. Test Environment Setup
Create a browser session and prepare test files:
```bash
bun run cli browser create --no-headless
echo "Test file content" > /tmp/test-upload.txt
echo "Second file" > /tmp/test-upload-2.txt
```

#### 2. Drag and Drop Testing
**Test Page**: https://evals.desplega.ai/graph?seed=default

Tests to perform:
- [ ] `bun run cli browser goto https://evals.desplega.ai/graph?seed=default`
- [ ] `bun run cli browser snapshot` - Identify draggable nodes
- [ ] `bun run cli browser drag <source-ref> --target <target-ref>` - Basic drag by ref
- [ ] `bun run cli browser drag --text "Node A" --target <target-ref>` - Drag by text
- [ ] `bun run cli browser drag <ref> --target-selector ".drop-zone"` - Drag to CSS selector

#### 3. MFA TOTP Testing
**Test Page**: https://evals.desplega.ai/otp?seed=1337

Tests to perform:
- [ ] `bun run cli browser goto https://evals.desplega.ai/otp?seed=1337`
- [ ] `bun run cli browser snapshot` - Find OTP input field
- [ ] `bun run cli browser mfa-totp <secret>` - Generate only (no fill)
- [ ] `bun run cli browser mfa-totp <ref> <secret>` - Fill by ref
- [ ] `bun run cli browser mfa-totp --text "OTP code" <secret>` - Fill by text
- [ ] Verify OTP validation succeeds

#### 4. File Upload Testing
**Test Page**: https://evals.desplega.ai/files

Tests to perform:
- [ ] `bun run cli browser goto https://evals.desplega.ai/files`
- [ ] `bun run cli browser snapshot` - Find file input element
- [ ] `bun run cli browser upload <ref> /tmp/test-upload.txt` - Single file
- [ ] `bun run cli browser upload <ref> /tmp/test-upload.txt /tmp/test-upload-2.txt` - Multiple files
- [ ] `bun run cli browser upload --text "Choose file" /tmp/test-upload.txt` - By text
- [ ] Verify files appear in the UI

#### 5. REPL Testing
Test all commands in interactive mode:
- [ ] Start REPL: `bun run cli browser run --no-headless`
- [ ] Type `help` - Verify new commands are documented
- [ ] Test `drag` command in REPL
- [ ] Test `mfa-totp` command in REPL
- [ ] Test `upload` command in REPL

### Success Criteria:

#### Automated Verification:
- [ ] All commands execute without TypeScript errors
- [ ] Build remains valid: `bun run build`

#### Manual Verification:
- [ ] All drag operations complete successfully
- [ ] TOTP codes are generated correctly
- [ ] TOTP codes fill into input fields when ref/text provided
- [ ] File uploads are processed by the test page
- [ ] REPL commands work identically to CLI commands
- [ ] Error messages are helpful when invalid arguments provided

**Implementation Note**: This is the final phase. After successful testing, the feature is complete.

---

## References
- Backend API documentation (provided in task)
- Existing CLI commands: `src/cli/commands/browser/click.ts`, `fill.ts`, `select.ts`
- REPL implementation: `src/cli/commands/browser/run.ts`
