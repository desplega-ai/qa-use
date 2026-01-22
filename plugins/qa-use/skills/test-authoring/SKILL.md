---
name: test-authoring
description: Create and edit E2E test definitions in YAML format for qa-use
---

# Test Authoring

This skill helps users create and edit E2E test definitions in YAML format compatible with the qa-use CLI.

## Critical Constraints

- ALWAYS validate YAML syntax before saving
- ALWAYS preserve user's existing variable definitions when editing
- NEVER overwrite test files without explicit confirmation
- Use simple step format by default (action/target/value), not extended format
- Keep test definitions human-readable with descriptive step names

## Workflow

### Creating a New Test

1. **Understand Intent**
   - Ask what the user wants to test (login flow, form submission, etc.)
   - Identify the starting URL and target elements
   - Clarify expected outcomes/assertions

2. **Load Template**
   - Start from the basic test structure:
   ```yaml
   name: Test Name
   app_config: <app-config-id>
   variables:
     key: value
   steps:
     - action: goto
       url: /path
   ```

3. **Generate Steps**
   - Use simple step format (action/target/value)
   - For complex element identification, spawn `step-generator` agent
   - Add assertions after key interactions

4. **Add Variables**
   - Extract repeated values (emails, passwords, URLs) to variables
   - Use `$variable_name` syntax in step values

5. **Write File**
   - Save to `qa-tests/<name>.yaml`
   - Offer to validate via `npx @desplega.ai/qa-use test validate <name>`

### Editing an Existing Test

1. **Read Current Test**
   - Load the test definition from file
   - Understand existing steps and variables

2. **Understand Changes**
   - What steps to add/modify/remove?
   - Any new variables needed?
   - Any dependency changes?

3. **Apply Changes**
   - Modify the test definition
   - Preserve user's existing variable values
   - Confirm changes before writing

4. **Validate**
   - Run `npx @desplega.ai/qa-use test validate <name>`
   - Fix any validation errors

## Test Definition Format

```yaml
name: Login Test
app_config: your-app-config-id
variables:
  email: test@example.com
  password: secret123
depends_on: setup-test  # Optional dependency
steps:
  - action: goto
    url: /login
  - action: fill
    target: email input
    value: $email
  - action: click
    target: login button
  - action: to_be_visible
    target: dashboard
```

## Common Actions

| Action | Description | Example |
|--------|-------------|---------|
| `goto` | Navigate to URL | `action: goto, url: /login` |
| `fill` | Fill input field | `action: fill, target: email input, value: $email` |
| `click` | Click element | `action: click, target: submit button` |
| `to_be_visible` | Assert visible | `action: to_be_visible, target: success message` |
| `wait_for_url` | Wait for URL | `action: wait_for_url, url: /dashboard` |
| `ai_action` | AI-powered action | `action: ai_action, value: scroll to the pricing section` |
| `ai_assertion` | AI-powered assertion | `action: ai_assertion, value: verify cart shows 3 items` |
