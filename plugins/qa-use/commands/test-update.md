---
description: AI-assisted test editing
argument-hint: [test-name]
---

# /qa-use:test-update

Edit an existing test definition with AI assistance.

**Invokes skill:** qa-use

## Arguments

| Argument | Description |
|----------|-------------|
| `test-name` | Test to edit (omit to list available tests) |

## What Happens

1. Loads current test definition
2. Understands your desired changes
3. Applies modifications
4. Validates and saves with confirmation

## Examples

```
/qa-use:test-update login
/qa-use:test-update checkout
```
