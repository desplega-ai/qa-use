---
description: Explore a web page using browser automation
argument-hint: <url or goal>
---

# /qa-use:explore

Explore a web page or complete a navigation goal.

**Invokes skill:** qa-use

## Arguments

| Argument | Description |
|----------|-------------|
| `url` | URL to explore (e.g., `https://example.com`) |
| `goal` | Navigation goal (e.g., "find the pricing page") |

## What Happens

1. Creates browser session (or uses existing one)
2. Navigates to the URL
3. Analyzes page using accessibility snapshots
4. Reports elements, navigation options, content found

## Examples

```
/qa-use:explore https://example.com
/qa-use:explore "find the pricing page"
/qa-use:explore https://myapp.com/dashboard "find user settings"
```
