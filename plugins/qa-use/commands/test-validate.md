---
description: Validate test definition syntax without running
argument-hint: [test-name]
---

# /qa-use:test-validate

Validate a test definition's syntax and configuration without executing it.

## Arguments

| Argument | Description |
|----------|-------------|
| `test-name` | Name of the test to validate (without extension). Omit to list available tests. |

## Workflow

1. **Parse Arguments**
   - Extract test name from command arguments
   - If no test name, list available tests and prompt for selection

2. **Run Validation**
   - Execute: `npx @desplega.ai/qa-use test validate <name>`

3. **Report Results**
   - On success: Show resolved configuration (app_config, variables, step count)
   - On failure: Show errors and offer to fix

4. **Offer Fixes** (if invalid)
   - If YAML syntax error: Show the error location and offer to fix
   - If missing app_config: Offer to add from `.qa-use-tests.json` default
   - If invalid action: Show valid actions list

## Example Usage

```
/qa-use:test-validate example
/qa-use:test-validate login
```
