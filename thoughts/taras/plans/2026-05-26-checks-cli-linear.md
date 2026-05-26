---
status: completed
last_updated: 2026-05-26
last_updated_by: codex
---

# qa-use — first-class checks and check schedules CLI

## Overview

Add first-class remote-only CLI commands for API checks and check schedules, grounded in DES-467 / DES-468 and the live external API v1 contract.

- **Motivation**: Crabi is migrating Postman-style API flows into desplega checks. Users need `qa-use` commands for listing, inspecting, creating, updating, deleting, and running remote check schedules without falling back to the generic `qa-use api` escape hatch.
- **Related**: DES-467, DES-468, `src/cli/commands/api/`, `src/cli/commands/suite/`, `src/cli/commands/test/runs/`, `plugins/qa-use/skills/qa-use/`

## Current State Analysis

The CLI already has the right resource-command shape. Top-level commands are registered centrally in `src/cli/index.ts:47`, and grouped help is maintained manually in `src/cli/index.ts:93`. Resource modules use a small `index.ts` that registers subcommands, as in `src/cli/commands/suite/index.ts:13`.

Existing external-API-backed commands use `loadConfig()`, `requireApiKey()`, and `apiCall()` rather than adding one-off client methods. The shared helper handles auth, endpoint base URL, headers, error formatting, and JSON bodies in `src/cli/lib/api-helpers.ts:36`. `parseResourceInput()` already supports `--input` plus repeatable `-F key=value` JSON-aware fields in `src/cli/lib/api-helpers.ts:119`.

Output conventions are consistent: tabular `--json` list output goes through `printTable()` in `src/cli/lib/table.ts:78`; detail views use field printing like `src/cli/commands/suite/info.ts:22`; destructive commands use `--force` plus `confirmAction()` like `src/cli/commands/suite/delete.ts:10`. Run commands print a short success line and a progress hint, as in `src/cli/commands/suite/run.ts:10`.

The generic OpenAPI command already reaches the live v1 contract. It confirmed these current check endpoints on May 26, 2026:

| Method | Path | Purpose |
|---|---|---|
| `GET` / `POST` | `/api/v1/checks` | list/create checks |
| `GET` / `PATCH` / `DELETE` | `/api/v1/checks/{check_id}` | inspect/update/delete a check |
| `GET` / `POST` | `/api/v1/check-schedules` | list/create schedules |
| `GET` / `PATCH` / `DELETE` | `/api/v1/check-schedules/{schedule_id}` | inspect/update/delete a schedule |
| `POST` | `/api/v1/check-schedules-actions/run` | run a schedule as a DES-467 variable-passing check chain |

The current API does **not** document a standalone `POST /api/v1/checks-actions/run`, `/api/v1/check-runs`, or `/api/v1/check-schedule-runs` endpoint. A real `qa-use check run <check-id>` or run-history UI cannot be implemented cleanly from this repo alone until the backend exposes those contracts.

DES-467 is represented in the API through `check_dependency_ids`, `alias`, `output_captures`, schedule dependency graph fields, and `RunCheckScheduleRequest.variables`. DES-468 is not represented in the local generated test-definition types today: `src/types/test-definition.ts:41` still omits `check` from test variable context, and the action union around `src/types/test-definition.ts:76` has no obvious API-check step action. The implementation must verify the live test-definition schema before claiming DES-468 CLI support.

Docs are generated from the plugin skill markdown, not handwritten into `src/cli/generated/docs-content.ts`. `scripts/generate-docs.ts:47` reads `plugins/qa-use/skills/qa-use/SKILL.md`, reference markdown, and templates, then writes the generated module.

## Desired End State

Users can run:

```bash
qa-use check list --app-config <id> --q login
qa-use check info <check-id>
qa-use check create --name "Login" --app-config <id> --config check.json --capture token=$.token
qa-use check update <check-id> --depends-on <auth-check-id> --alias claim
qa-use check delete <check-id> --force

qa-use check-schedule list --app-config <id>
qa-use check-schedule create --name "Claims chain" --app-config <id> --cron "*/15 * * * *" --check <id> --check <id>
qa-use check-schedule run <schedule-id> --var env=staging --var claim_id=123
```

All commands call deployed `/api/v1/*` endpoints through `apiCall()`. They do not run checks locally and do not create hidden browser sessions. JSON output returns the raw API shape; human output highlights IDs, status, dependency/capture fields, and next commands.

DES-467 support is first-class through friendly flags for check dependencies, aliases, output captures, schedule failure strategy, and run-time variable seeding. DES-468 support is limited to schema/docs/validation integration unless the live test-definition schema exposes the API-check step shape.

## What We're NOT Doing

- No local check runner.
- No hidden temporary schedule to fake `check run <check-id>`.
- No invented check-run history commands until the external API exposes run resources.
- No backend/UI changes for DES-467 or DES-468.
- No MCP server tool additions; this plan is CLI-only.
- No hand-authored DES-468 YAML/action shape if the backend schema does not expose it.
- No duplicate nested `qa-use check schedule` alias in the first pass; keep one canonical schedule command unless product asks for both.

## Implementation Approach

- Add top-level `qa-use check` and `qa-use check-schedule` commands, matching the existing hyphenated resource-command style.
- Share parsing/output helpers between checks and schedules without making one command a hidden child of the other.
- Use `apiCall()` and existing resource-command conventions rather than adding `ApiClient` methods.
- Keep `--input` / `-F key=value` as the escape hatch for full API shape, then layer friendly flags over DES-467 fields.
- Treat the live OpenAPI contract as the source of truth and add tests that lock the local command-to-endpoint mapping.

## Quick Verification Reference

Common commands to verify the implementation locally:

- `bun run check:fix`
- `bun run typecheck`
- `bun test src/cli/commands/check src/cli/commands/check-schedule`
- `bun run cli check --help`
- `bun run cli check list --json --limit 1`
- `bun run cli check-schedule run --help`
- `bun run scripts/e2e.ts`

---

## Phase 1: Read-Only Check Commands

### Overview

Deliver the standard read-only resource pair, `qa-use check list` and `qa-use check info`, registered in top-level help and backed by `/api/v1/checks`. This intentionally matches existing resource groups where `list` / `info` land before mutation commands, with `create` / `update` / `delete` following in the next phase.

### Changes Required:

#### 1. Command Registration
**File**: `src/cli/index.ts`
**Changes**: Import and register `checkCommand`. Add a Checks row to command-group help and one common workflow example.

#### 2. Check Command Group
**File**: `src/cli/commands/check/index.ts`
**Changes**: Create `new Command('check')`, describe it as remote check management, and register `list` / `info`.

#### 3. Check List
**File**: `src/cli/commands/check/list.ts`
**Changes**: Call `GET /api/v1/checks` with `--app-config`, `--q`, `--limit`, `--offset`, and `--json`. Table columns: ID, NAME, TYPE, APP_CONFIG, STATUS, UPDATED.

#### 4. Check Info
**File**: `src/cli/commands/check/info.ts`
**Changes**: Call `GET /api/v1/checks/{check_id}`. Human output should include config/validation summaries plus DES-467 fields: alias, dependencies, output captures, variables, retry, timeout.

#### 5. Tests
**File**: `src/cli/commands/check/index.test.ts`, `src/cli/commands/check/list.test.ts`, `src/cli/commands/check/info.test.ts`
**Changes**: Add structural command tests and helper-level tests for table/detail formatters.

### Success Criteria:

#### Automated Verification:
- [x] `bun test src/cli/commands/check/index.test.ts src/cli/commands/check/list.test.ts src/cli/commands/check/info.test.ts`
- [x] `bun run typecheck`
- [x] `bun run check:fix`

#### Automated QA:
- [x] `bun run cli check --help` shows `list` and `info`.
- [x] `bun run cli check list --json --limit 1` returns valid JSON array against the configured API, including `[]` as a valid empty result.
- [x] `bun run cli api info /api/v1/checks` and `bun run cli check list --help` expose matching filter names.

#### Manual Verification:
- [x] Inspect the human `check info` output for a real or fixture check and confirm dependency/capture fields are understandable without needing raw JSON.

**Implementation Note**: After this phase, run `bun run check:fix` before proceeding.

---

## Phase 2: Check Create, Update, And Delete

### Overview

Deliver mutation support for individual remote checks, including friendly DES-467 flags for dependencies, captured outputs, aliases, variables, retry behavior, and timeout.

### Changes Required:

#### 1. Shared Check Input Helpers
**File**: `src/cli/commands/check/lib.ts`
**Changes**: Add pure helpers for:
- reading JSON from `--config <file>` and `--validation <file>`
- parsing repeatable `--var key=value` into API variables
- parsing repeatable `--capture name=json_path` into `output_captures`
- merging friendly flags over `--input` / `-F`
- validating enum-like CLI inputs before sending them

#### 2. Pipeable Resource Input
**File**: `src/cli/lib/api-helpers.ts`
**Changes**: Extend `parseResourceInput()` to support `--input -`, reading one JSON object from stdin. Keep ordinary implicit stdin disabled so interactive commands do not hang unexpectedly; pipeability is explicit via `--input -`.

#### 3. Check Create
**File**: `src/cli/commands/check/create.ts`
**Changes**: Call `POST /api/v1/checks`. Required fields: `--name`, `--app-config`, and config via `--config`, `--input <file|->`, or `-F config=...`. Add `--json`.

#### 4. Check Update
**File**: `src/cli/commands/check/update.ts`
**Changes**: Call `PATCH /api/v1/checks/{check_id}`. Reject empty updates. Support the same friendly flags as create, including `--input -`, where applicable. Add `--json`.

#### 5. Check Delete
**File**: `src/cli/commands/check/delete.ts`
**Changes**: Call `DELETE /api/v1/checks/{check_id}` with `--force` confirmation behavior matching suite deletion.

#### 6. Tests
**File**: `src/cli/commands/check/lib.test.ts`, plus command structure tests
**Changes**: Unit-test body construction, variable parsing, output-capture parsing, `--input -` parsing, empty update rejection, and enum validation.

### Success Criteria:

#### Automated Verification:
- [x] `bun test src/cli/commands/check/lib.test.ts src/cli/commands/check`
- [x] `bun run typecheck`
- [x] `bun run check:fix`

#### Automated QA:
- [x] `bun run cli check create --help` documents `--depends-on`, `--alias`, `--capture`, `--var`, retry, and timeout flags.
- [x] A dry helper/unit fixture maps `--capture token=$.access_token --depends-on dep1 --alias auth` to the exact API body keys `output_captures`, `check_dependency_ids`, and `alias`.
- [x] A unit or smoke fixture proves `printf '{"name":"Login"}' | ... --input -` reaches `parseResourceInput()` as a JSON object without hanging.
- [ ] With `E2E_ALLOW_CHECK_MUTATION=1`, create/list/info/update/delete succeeds against a real app config and leaves no remote check behind.
  - Skipped on 2026-05-26: `E2E_ALLOW_CHECK_MUTATION` and a real check app-config id were not set, so destructive remote mutation QA was not run.

#### Manual Verification:
- [x] Confirm create/update examples do not imply a schema for `config` or `validation` beyond what the external API documents.
  - Verified on 2026-05-26: README, skill docs, and `qa-use docs checks` direct users to the live `qa-use api info /api/v1/checks -X POST` contract and describe `config` / `validation` as backend-defined.

**Implementation Note**: After this phase, run `bun run check:fix` before proceeding.

---

## Phase 3: Check Schedule CRUD And Run

### Overview

Deliver `qa-use check-schedule ...` commands, including `run` for the DES-467 ordered variable-passing chain endpoint.

### Changes Required:

#### 1. Schedule Command Group
**File**: `src/cli/commands/check-schedule/index.ts`
**Changes**: Create `new Command('check-schedule')`, register `list`, `info`, `create`, `update`, `delete`, and `run`, then register it in `src/cli/index.ts`.

#### 2. Schedule CRUD
**File**: `src/cli/commands/check-schedule/list.ts`, `info.ts`, `create.ts`, `update.ts`, `delete.ts`
**Changes**: Call the `/api/v1/check-schedules` endpoints. Friendly flags:
- `--app-config <id>`
- `--check <id>` repeatable for `check_ids`
- `--cron <expr>`
- `--timezone <tz>` default display as UTC
- `--enabled` / `--disabled`
- `--failure-strategy stop_on_failure|continue_on_failure`
- `--dependency-condition <json>` or `-F check_dependency_graph_conditions=...` for the currently generic condition map

#### 3. Schedule Run
**File**: `src/cli/commands/check-schedule/run.ts`
**Changes**: Call `POST /api/v1/check-schedules-actions/run` with `{ schedule_id, variables }`. Support repeatable `--var key=value` and `--json`. Human output should best-effort extract known ID keys, but always mention that `--json` shows the raw response because the OpenAPI success response is currently untyped.

#### 4. Shared Run Response Formatting
**File**: `src/cli/commands/check/lib.ts`
**Changes**: Add a small formatter that handles possible `id`, `run_id`, `schedule_run_id`, `check_schedule_run_id`, `status`, and `run_status` keys without assuming a fixed response shape.

#### 5. Tests
**File**: `src/cli/commands/check-schedule/*.test.ts`
**Changes**: Structural tests for subcommands and helper tests for schedule body construction and run response formatting.

### Success Criteria:

#### Automated Verification:
- [x] `bun test src/cli/commands/check src/cli/commands/check-schedule`
- [x] `bun run typecheck`
- [x] `bun run check:fix`

#### Automated QA:
- [x] `bun run cli check-schedule --help` shows all schedule subcommands.
- [x] `bun run cli check-schedule list --json --limit 1` returns a valid JSON array against the configured API.
- [x] `bun run cli check-schedule run --help` documents `--var key=value` and explains that it runs the remote schedule chain.
- [ ] With `E2E_ALLOW_CHECK_MUTATION=1`, create a disposable schedule for a disposable check, run it with `--var env=staging`, verify the command exits 0, then delete both resources.
  - Skipped on 2026-05-26: `E2E_ALLOW_CHECK_MUTATION` and real check/app-config IDs were not set, so destructive remote mutation QA was not run.

#### Manual Verification:
- [x] Confirm the CLI does not expose `check run <check-id>` unless the backend has added a documented endpoint by implementation time.
  - Verified on 2026-05-26 with `bun run cli check --help`: only list/info/create/update/delete are exposed; no standalone `run` subcommand exists.

**Implementation Note**: After this phase, run `bun run check:fix` before proceeding.

---

## Phase 4: DES-468 Schema, Validation, And Docs Integration

### Overview

Make the CLI aware of API-check steps inside UI tests only if the live test-definition schema exposes the DES-468 shape. If the schema is absent, produce a clear backend/API follow-up instead of guessing.

### Implementation Notes

- 2026-05-26 schema audit: `bun run cli test schema --raw` confirmed `api_check` is present in `$defs.ActionInstruction.properties.action`, `$defs.AnyDict.properties.check_id` exists, and both `VariableEntry.context` and `MatrixVariableEntry.context` include `check`.
- No separate dedicated API-check output-variable declaration exists in the schema. The docs therefore describe check inputs via `context: check` variables and leave output declarations on the remote check's configured output captures.
- The API-check fixture validates successfully with `bun run cli test validate qa-tests/_examples/api-check-step.yaml`. That exact command required honoring existing cwd-relative file paths before falling back to `test_directory`.

### Changes Required:

#### 1. Live Schema Audit
**File**: no source change initially
**Changes**: Run `bun run cli test schema --raw` and inspect for an API-check step/action field, check variable context, and check-step output-variable shape.

#### 2. Generated Types
**File**: `src/types/test-definition.ts`
**Changes**: If the schema includes DES-468, regenerate with `bun run generate:types` and update any compile-time guards that mirror generated unions. Pay special attention to variable context drift similar to the existing guard pattern in `src/cli/lib/test-vars.ts`.

#### 3. Test Validation Fixture
**File**: `qa-tests/_examples/api-check-step.yaml` or a focused test fixture
**Changes**: Add the smallest valid UI test containing an API-check step, only if schema-supported. Use it to exercise `qa-use test validate`.

#### 4. User-Facing Docs
**File**: `plugins/qa-use/skills/qa-use/references/test-format.md`
**Changes**: Document the DES-468 embedded API-check step with variable-in and variable-out behavior. Regenerate docs with `bun run generate:docs`.

### Success Criteria:

#### Automated Verification:
- [x] `bun run cli test schema --raw` has been checked for DES-468 fields and the result is recorded in the implementation notes.
- [x] If DES-468 schema exists: `bun run generate:types`
- [x] If DES-468 schema exists: `bun run cli test validate qa-tests/_examples/api-check-step.yaml`
- [x] `bun run generate:docs`
- [x] `bun run check:docs`
- [x] `bun run typecheck`
- [x] `bun run check:fix`

#### Automated QA:
- [x] `bun run cli docs test-format` includes the API-check step example when schema-supported.
- [x] `bun run cli test schema --summary` or a targeted schema path shows the API-check step fields when schema-supported.
- [x] If schema is absent, the phase produces a short backend follow-up note and leaves no fake docs/examples behind.
  - Not applicable on 2026-05-26 because the live schema exposes DES-468 fields and the fixture validates.

#### Manual Verification:
- [x] Confirm the docs do not promise DES-468 behavior unless `test validate` accepts the example.
  - Verified on 2026-05-26: `bun run cli test validate qa-tests/_examples/api-check-step.yaml` passes, and the docs only describe the validated `api_check` shape plus the absence of a dedicated output-variable declaration.

**Implementation Note**: After this phase, run `bun run check:fix` before proceeding.

---

## Phase 5: Docs, E2E, And Release Polish

### Overview

Make the new CLI surface discoverable and add regression coverage that verifies read-only commands by default and remote mutations behind an explicit gate.

### Changes Required:

#### 1. Skill Docs
**File**: `plugins/qa-use/skills/qa-use/SKILL.md`, `plugins/qa-use/skills/qa-use/references/checks.md`
**Changes**: Add a Checks section to the main skill and a dedicated checks reference page. The reference should include concrete examples for creating API checks, declaring dependencies with `--depends-on`, capturing outputs with `--capture`, creating schedules with ordered checks, running schedules with `--var`, and the current standalone-check-run API limitation.

#### 2. Generated Docs
**File**: `src/cli/generated/docs-content.ts`
**Changes**: Regenerate with `bun run generate:docs`; do not hand-edit this file.

#### 3. README
**File**: `README.md`
**Changes**: Add concise checks/check-schedules examples near CLI reference material.

#### 4. E2E Script
**File**: `scripts/e2e.ts`
**Changes**: Add a section after existing API/resource smoke tests:
- default path: `check --help`, `check list --json --limit 1`, `check-schedule list --json --limit 1`
- gated path with `E2E_ALLOW_CHECK_MUTATION=1`: create check, create schedule, run schedule with variables, delete schedule, delete check

#### 5. Optional Version Bump
**File**: `package.json`
**Changes**: Decide during implementation whether this is a minor release bump. It is user-visible CLI surface area, so a minor bump is reasonable if this repo is publishing directly.

### Success Criteria:

#### Automated Verification:
- [x] `bun run generate:docs`
- [x] `bun run check:docs`
- [x] `bun test src/cli/commands/check src/cli/commands/check-schedule`
- [x] `bun run typecheck`
- [x] `bun run check:fix`
- [x] `bun run scripts/e2e.ts`

#### Automated QA:
- [x] `bun run cli --help` shows the Checks command group.
- [x] `bun run cli docs --list` still works and includes updated docs.
- [x] `bun run cli check list --json --limit 1` and `bun run cli check-schedule list --json --limit 1` work against the repo `.qa-use.json`.
- [ ] Gated mutation E2E leaves no check or schedule resources behind when enabled.
  - Skipped on 2026-05-26: `E2E_ALLOW_CHECK_MUTATION=1` and `E2E_CHECK_APP_CONFIG_ID` were not set, so destructive remote mutation QA was not run.

#### Manual Verification:
- [x] Read the README and skill-doc examples as a new user and confirm it is clear that schedule runs are fully remote and standalone check runs need backend API support.
  - Verified on 2026-05-26: README, skill docs, and `qa-use docs checks` state schedule runs are remote and that standalone `qa-use check run <check-id>` is not exposed because the public API currently documents schedule-run actions only.

**Implementation Note**: After this phase, run `bun run check:fix` before final handoff.

---

## Appendix

- **External API v1 contract snapshot**: observed via `bun run cli api openapi --raw` on May 26, 2026; OpenAPI `3.1.0`, API version `1.79.1`.
- **Linear DES-467**: API checks need forward variable scope across ordered chains, outputs such as auth tokens and IDs available downstream, dependency failure short-circuits later checks, and UI declares ordering/dependencies.
- **Linear DES-468**: UI/browser tests need an API Check step; parent test variables flow into the check, check outputs flow back to later UI steps, and embedded check failure fails the parent test.
- **Backend/API follow-ups if needed**:
  - Add `POST /api/v1/checks-actions/run` if product wants `qa-use check run <check-id>`.
  - Add check-run / schedule-run list and detail endpoints if product wants first-class run history.
  - Type the `POST /api/v1/check-schedules-actions/run` success response so the CLI can print stable run IDs and progress hints.
  - Expose the DES-468 API-check step shape through the test-definition schema if it is not already present in the live backend.
