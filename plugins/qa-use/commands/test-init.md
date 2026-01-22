---
description: Initialize qa-use test directory with example test
argument-hint: (no arguments)
---

# /qa-use:test-init

Initialize the qa-use test directory with an example test file and optionally create a configuration file.

## Workflow

1. **Check Existing Setup**
   - Check if `qa-tests/` directory exists
   - Check if `.qa-use-tests.json` exists

2. **Initialize Test Directory**
   - Run: `npx @desplega.ai/qa-use test init`
   - This creates `qa-tests/` with `example.yaml`

3. **Offer Configuration Setup**
   - If `.qa-use-tests.json` doesn't exist, ask user:
     - "Would you like to create a configuration file?"
   - If yes, gather:
     - API key (or explain how to get one)
     - Default app config ID (optional)
     - Preferred defaults (headless, timeout, etc.)
   - Write `.qa-use-tests.json`

4. **Show Next Steps**
   ```
   Test directory initialized at qa-tests/

   Next steps:
   1. Edit qa-tests/example.yaml to customize the test
   2. Get your app_config_id from https://desplega.ai
   3. Run: /qa-use:test-run example
   ```

## Example Usage

```
/qa-use:test-init
```
