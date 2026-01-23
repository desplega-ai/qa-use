---
description: Explore a web page using browser automation
argument-hint: <url or goal>
---

# /qa-use:explore

Explore a web page or complete a navigation goal using browser automation.

## Arguments

| Argument | Description |
|----------|-------------|
| `url` | URL to explore (e.g., `https://example.com`) |
| `goal` | Or a navigation goal (e.g., "find the pricing page") |

## Workflow

1. **Parse Arguments**
   - If URL provided: use as start_url with goal "explore and document the page"
   - If goal provided: use current session or prompt for starting URL
   - If nothing provided, prompt: "What would you like me to explore?"

2. **Create Browser Session**
   - Check for existing session: `qa-use browser list`
   - Create new if needed: `qa-use browser create --viewport desktop`

3. **Spawn browser-navigator Agent**
   - Pass the URL and/or goal
   - Agent uses snapshot → analyze → act loop
   - Agent reports findings

4. **Return Exploration Results**
   - Page structure and key elements
   - Interactive elements found
   - Suggested next actions

## Example Usage

```
/qa-use:explore https://example.com
/qa-use:explore "find the pricing page"
/qa-use:explore https://myapp.com/dashboard "find user settings"
```

## What Happens

1. Creates a browser session (or uses existing one)
2. Navigates to the URL
3. Analyzes the page using accessibility snapshots
4. Reports what it found (elements, navigation options, content)
5. Can follow links or complete navigation goals

Useful for understanding a page before writing tests, or for AI-assisted navigation.
