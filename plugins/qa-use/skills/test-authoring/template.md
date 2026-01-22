# Test Definition Template

```yaml
name: <Test Name>
app_config: <app-config-id or use default from .qa-use-tests.json>
variables:
  <variable_name>: <default_value>
depends_on: <optional-dependency-test-name>
steps:
  # Navigation
  - action: goto
    url: <starting-path>

  # Interactions (fill, click, hover, etc.)
  - action: fill
    target: <human-readable element description>
    value: $<variable>

  - action: click
    target: <human-readable element description>

  # Assertions
  - action: to_be_visible
    target: <expected element>

  # AI-powered actions (when human-readable selectors are insufficient)
  - action: ai_action
    value: <natural language instruction>

  - action: ai_assertion
    value: <natural language verification>
```

## Variable Syntax

Use `$variable_name` to reference variables:
- `value: $email` → Uses the `email` variable
- `url: /users/$user_id` → Interpolates `user_id` in URL

## Dependencies

Use `depends_on` to run prerequisite tests first:
- `depends_on: setup-user` → Runs `setup-user.yaml` before this test
- Dependencies are resolved recursively
