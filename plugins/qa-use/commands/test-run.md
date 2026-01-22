---
description: Run E2E tests with qa-use CLI
argument-hint: [test-name] [--headful] [--autofix] [--update-local] [--screenshots] [--download] [--var key=value]
---

# /qa-use:test-run

Execute E2E tests using the qa-use CLI with real-time progress monitoring.

## Arguments

| Argument | Description |
|----------|-------------|
| `test-name` | Name of the test to run (without extension). Omit to list available tests. |
| `--headful` | Show browser window (default: headless) |
| `--autofix` | Enable AI self-healing for failed steps |
| `--update-local` | Update local test file after AI fixes |
| `--screenshots` | Capture screenshots at each step |
| `--download` | Download all assets (screenshots, recordings, HAR) to `/tmp/qa-use/downloads/` |
| `--all` | Run all tests in the test directory |
| `--var key=value` | Override a variable (can be used multiple times) |

## Workflow

1. **Parse Arguments**
   - Extract test name and flags from the command arguments
   - If no test name and no `--all`, list available tests and prompt for selection

2. **Invoke test-running Skill**
   - Pass test name and parsed flags to the skill
   - The skill handles prerequisites checking, execution, and result reporting

3. **Handle Results**
   - Display test results summary
   - On failure: suggest `--autofix` if not already used
   - On AI fix: suggest `--update-local` to persist

## Example Usage

```
/qa-use:test-run example
/qa-use:test-run login --headful
/qa-use:test-run checkout --autofix --update-local
/qa-use:test-run --all
/qa-use:test-run login --var email=admin@test.com --var password=admin123
/qa-use:test-run checkout --download
```

## Download Directory Structure

When using `--download`, assets are saved to `/tmp/qa-use/downloads/` with the following structure:

```
/tmp/qa-use/downloads/
└── <test-id or local-hash>/
    └── <run-id>/
        ├── screenshots/
        │   ├── step_0_pre.jpeg
        │   ├── step_0_post.jpeg
        │   └── ...
        ├── recordings/
        │   └── recording.webm
        └── hars/
            └── network.har
```

- **Cloud tests**: Use the test UUID as directory name
- **Local tests**: Use `local-<8-char-hash>` derived from the source file path (deterministic)
