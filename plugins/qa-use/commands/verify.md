---
description: Verify a feature works through automated testing
argument-hint: <description of what to verify>
---

# /qa-use:verify

Verify that a developed feature works correctly through automated browser testing.

## Arguments

| Argument | Description |
|----------|-------------|
| `description` | What to verify (e.g., "login works with valid credentials") |

## Workflow

1. **Parse Arguments**
   - Extract the verification description
   - If no description provided, prompt: "What feature would you like me to verify?"

2. **Invoke feature-verify Skill**
   - Pass the verification description to the skill
   - The skill handles:
     - Understanding context
     - Finding or creating tests
     - Executing tests
     - Analyzing failures
     - Reporting outcomes

3. **Return Results**
   - Display verification status (✅ passed or ❌ failed)
   - On failure: show actionable recommendations

## Example Usage

```
/qa-use:verify "login works with valid credentials"
/qa-use:verify "checkout flow completes successfully"
/qa-use:verify "form shows validation errors for invalid input"
/qa-use:verify "user can reset password via email"
```

## What Happens

1. Looks for existing tests matching your description
2. If no test exists, offers to explore and create one
3. Runs the test with AI self-healing enabled
4. Reports results with specific recommendations for any failures

This is the primary command for autonomous feature verification. Use it after implementing features to confirm they work.
