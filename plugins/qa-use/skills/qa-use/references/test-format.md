# Test Format Reference

Complete specification for qa-use test YAML files.

## Basic Structure

```yaml
name: Test Name
description: Optional description of what this test verifies
app_config: <app-config-id>
variables:
  key: value
depends_on: optional-prerequisite-test
steps:
  - action: goto
    url: /path
```

## Required Fields

| Field | Description |
|-------|-------------|
| `name` | Human-readable test name |
| `app_config` | App configuration ID from desplega.ai (or use default from `.qa-use-tests.json`) |
| `steps` | Array of test steps |

## Optional Fields

| Field | Description |
|-------|-------------|
| `description` | What this test verifies |
| `variables` | Key-value pairs for parameterization |
| `depends_on` | Name of test that must run first |

## Variables

Define variables at the top level:

```yaml
variables:
  email: test@example.com
  password: secret123
  base_path: /app
```

Reference with `$` prefix:

```yaml
steps:
  - action: fill
    target: email input
    value: $email
  - action: goto
    url: $base_path/dashboard
```

Variables can be overridden at runtime:

```bash
qa-use test run my-test --var email=other@example.com
```

## Dependencies

Run prerequisite tests first:

```yaml
name: Checkout Test
depends_on: login-test
steps:
  - action: goto
    url: /checkout
```

Dependencies are resolved recursively. If `checkout-test` depends on `login-test`, and `login-test` depends on `setup-test`, all three run in order.

## Step Format

Each step has an `action` and action-specific fields:

```yaml
- action: <action-type>
  target: <element description>  # For interactions
  value: <value>                 # For fill, type, assertions
  url: <path>                    # For navigation
```

## Available Actions

### Navigation

| Action | Fields | Description |
|--------|--------|-------------|
| `goto` | `url` | Navigate to URL (absolute or relative) |
| `back` | - | Browser back |
| `forward` | - | Browser forward |
| `reload` | - | Reload page |

```yaml
- action: goto
  url: /login

- action: goto
  url: https://example.com/page
```

### Interactions

| Action | Fields | Description |
|--------|--------|-------------|
| `click` | `target` | Click element |
| `fill` | `target`, `value` | Fill input (clears first) |
| `type` | `target`, `value` | Type with delays |
| `press` | `value` | Press keyboard key |
| `check` | `target` | Check checkbox |
| `uncheck` | `target` | Uncheck checkbox |
| `select` | `target`, `value` | Select dropdown option |
| `hover` | `target` | Hover over element |
| `scroll` | `target` or direction | Scroll page or element |

```yaml
- action: click
  target: submit button

- action: fill
  target: email input
  value: $email

- action: type
  target: search box
  value: search query

- action: press
  value: Enter

- action: select
  target: country dropdown
  value: United States
```

### Assertions

| Action | Fields | Description |
|--------|--------|-------------|
| `to_be_visible` | `target` | Assert element is visible |
| `to_be_hidden` | `target` | Assert element is hidden |
| `to_have_text` | `target`, `value` | Assert element has text |
| `to_have_value` | `target`, `value` | Assert input has value |
| `to_be_checked` | `target` | Assert checkbox is checked |
| `to_be_unchecked` | `target` | Assert checkbox is unchecked |

```yaml
- action: to_be_visible
  target: success message

- action: to_have_text
  target: page heading
  value: Welcome

- action: to_be_checked
  target: remember me checkbox
```

### Waiting

| Action | Fields | Description |
|--------|--------|-------------|
| `wait` | `value` | Wait fixed time (ms) |
| `wait_for_url` | `url` | Wait for URL to match |
| `wait_for_selector` | `target`, `state` | Wait for element state |

```yaml
- action: wait
  value: 2000

- action: wait_for_url
  url: /dashboard

- action: wait_for_selector
  target: .modal
  state: hidden
```

### AI-Powered Actions

Use when human-readable selectors are insufficient:

| Action | Fields | Description |
|--------|--------|-------------|
| `ai_action` | `value` | AI performs action from description |
| `ai_assertion` | `value` | AI verifies condition from description |

```yaml
- action: ai_action
  value: scroll to the pricing section

- action: ai_action
  value: dismiss the cookie banner if present

- action: ai_assertion
  value: verify the cart shows exactly 3 items

- action: ai_assertion
  value: confirm the total price is greater than $50
```

AI actions are more flexible but slower and less deterministic. Prefer explicit actions when possible.

## Target Descriptions

The `target` field uses natural language descriptions:

```yaml
# Good - specific and unambiguous
target: submit button in the login form
target: email input field
target: first product card
target: navigation menu item labeled "Settings"

# Avoid - too generic
target: button
target: input
target: link
```

The AI matches your description against the page's ARIA accessibility tree. Be specific enough to uniquely identify the element.

## Complete Example

```yaml
name: User Registration
description: Tests the full user registration flow
app_config: my-app-config-id
variables:
  email: newuser@example.com
  password: SecurePass123!
  name: Test User
depends_on: clear-test-data

steps:
  # Navigate to registration
  - action: goto
    url: /register

  # Fill registration form
  - action: fill
    target: name input
    value: $name

  - action: fill
    target: email input
    value: $email

  - action: fill
    target: password input
    value: $password

  - action: fill
    target: confirm password input
    value: $password

  # Accept terms
  - action: check
    target: terms and conditions checkbox

  # Submit
  - action: click
    target: create account button

  # Wait for redirect
  - action: wait_for_url
    url: /welcome

  # Verify success
  - action: to_be_visible
    target: welcome message

  - action: to_have_text
    target: user greeting
    value: Hello, Test User
```

## File Location

Tests should be placed in the test directory (default: `qa-tests/`):

```
qa-tests/
├── login.yaml
├── registration.yaml
├── checkout.yaml
└── setup/
    └── seed-data.yaml
```

Configure the test directory in `.qa-use-tests.json`:

```json
{
  "test_directory": "./qa-tests"
}
```
