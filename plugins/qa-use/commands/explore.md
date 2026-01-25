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

## Starting After Login

Many pages require authentication. Use `--after-test-id` when creating the browser session to start from a logged-in state:

```bash
# Create session that runs login test first
qa-use browser create --after-test-id <login-test-uuid>

# Then explore the authenticated area
/qa-use:explore https://myapp.com/dashboard
```

This is extremely useful for:
- **Exploring authenticated pages** - bypass login walls automatically
- **Testing user-specific features** - start as a logged-in user
- **Complex setup flows** - run a setup test, then explore manually

To get test UUIDs, use `qa-use test run --list` or check your tests in the desplega.ai dashboard.
