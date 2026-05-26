# API Checks And Check Schedules

`qa-use check` and `qa-use check-schedule` manage remote desplega.ai API
checks. These commands call `/api/v1/*` endpoints directly. They do not start a
browser session and they do not run checks locally.

Use the live API contract when you need exact payload fields:

```bash
qa-use api info /api/v1/checks -X POST
qa-use api info /api/v1/check-schedules -X POST
qa-use api info /api/v1/check-schedules-actions/run -X POST
```

## Inspect Checks

```bash
qa-use check list --app-config <app-config-id> --q login
qa-use check list --json --limit 10
qa-use check info <check-id>
qa-use check info <check-id> --json
```

Human `info` output highlights dependency-chain fields such as `alias`,
`check_dependency_ids`, `output_captures`, variables, retry settings, and
timeouts. Use `--json` when you need the raw API shape.

## Create Checks

The `config` and `validation` objects are backend-defined. Keep the JSON in a
file for repeatable CLI usage, and confirm the current schema with
`qa-use api info /api/v1/checks -X POST`.

Example `auth-check.json`:

```json
{
  "method": "POST",
  "url": "{{base_url}}/api/login",
  "headers": {
    "content-type": "application/json"
  },
  "body": {
    "email": "{{email}}",
    "password": "{{password}}"
  }
}
```

Create the check and expose captured outputs to downstream checks:

```bash
qa-use check create \
  --name "Auth token" \
  --app-config <app-config-id> \
  --config auth-check.json \
  --alias auth \
  --capture token=$.access_token \
  --capture user_id=$.user.id \
  --var env=staging \
  --timeout-ms 15000
```

For full control, pass raw API fields through `--input` or repeatable `-F`:

```bash
qa-use check create --input check-create-body.json
printf '{"name":"Login","app_config_id":"<id>","config":{}}' |
  qa-use check create --input -
qa-use check create \
  -F name="Auth token" \
  -F app_config_id=<app-config-id> \
  -F config='{"method":"GET","url":"{{base_url}}/health"}'
```

## Dependencies And Captures

Use `--depends-on` to declare upstream checks. Use `--alias` to name the check
inside the chain, and `--capture name=json_path` to publish response values to
later checks.

```bash
qa-use check update <claim-check-id> \
  --depends-on <auth-check-id> \
  --alias claim \
  --capture claim_id=$.claim.id
```

You can repeat `--depends-on` and `--capture`:

```bash
qa-use check update <report-check-id> \
  --depends-on <auth-check-id> \
  --depends-on <claim-check-id> \
  --capture report_id=$.id \
  --capture status=$.status
```

## Create And Run Schedules

Schedules run checks remotely in dependency-graph order. The order of
repeatable `--check` flags is preserved in the request body as `check_ids`.

```bash
qa-use check-schedule create \
  --name "Claims chain" \
  --app-config <app-config-id> \
  --cron "*/15 * * * *" \
  --timezone UTC \
  --check <auth-check-id> \
  --check <claim-check-id> \
  --failure-strategy stop_on_failure
```

Run the remote schedule chain with seed variables:

```bash
qa-use check-schedule run <schedule-id> \
  --var env=staging \
  --var claim_id=123
```

The schedule-run response is currently untyped in the public OpenAPI contract.
Human output prints any recognized run id or status fields, and `--json` prints
the raw response.

## Delete Resources

Deletion is remote and permanent. Use `--force` for non-interactive cleanup:

```bash
qa-use check-schedule delete <schedule-id> --force
qa-use check delete <check-id> --force
```

When scripting cleanup, delete schedules before deleting checks that they
reference.

## Current Run Limitation

The public API currently documents `POST /api/v1/check-schedules-actions/run`.
It does not document a standalone `POST /api/v1/checks-actions/run` endpoint or
check-run history endpoints. For that reason, qa-use exposes
`qa-use check-schedule run <schedule-id>` but does not expose
`qa-use check run <check-id>`.

Do not create temporary schedules to fake a standalone check run in user
workflows unless product explicitly asks for that behavior.

> Runtime access: `qa-use docs checks` | All topics: `qa-use docs --list`
