---
description: AI-assisted test editing
argument-hint: [test-name]
---

# /qa-use:test-update

Edit an existing test definition with AI assistance.

## Arguments

| Argument | Description |
|----------|-------------|
| `test-name` | Name of the test to edit (without extension). Omit to list available tests. |

## Workflow

1. **Parse Arguments**
   - Extract test name from command arguments
   - If no test name, list available tests and prompt for selection

2. **Invoke test-authoring Skill** (editing mode)
   - Load current test definition
   - Understand user's desired changes
   - Apply modifications

3. **Validate Changes**
   - Run validation on updated test
   - Fix any issues

4. **Confirm and Save**
   - Show diff of changes
   - Confirm before writing

## Example Usage

```
/qa-use:test-update login
/qa-use:test-update checkout
```
