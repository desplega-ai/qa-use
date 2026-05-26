---
date: 2026-05-26
author: Taras / Codex
topic: "qa-use checks CLI live endpoint QA"
tags: [qa, checks, check-schedules, cli, live-api]
status: fail
source_plan: thoughts/taras/plans/2026-05-26-checks-cli-linear.md
related_pr: https://github.com/desplega-ai/qa-use/pull/25
environment: production API via repo .qa-use.json
last_updated: 2026-05-26
last_updated_by: codex
---

# qa-use Checks CLI Live Endpoints — QA Report

## Context
Validate the new `qa-use check` and `qa-use check-schedule` CLI surfaces against the configured deployed API after the implementation was published to PR #25.

## Scope
### In Scope
- Create multiple disposable remote checks.
- Exercise list, info, update, and delete endpoints for checks.
- Create a disposable check schedule with a near-term cron expression.
- Exercise list, info, update, run, and delete endpoints for schedules.
- Confirm cleanup removes the disposable resources.

### Out of Scope
- Browser UI validation.
- Long-running scheduler internals beyond API-visible schedule creation and explicit schedule-run action.
- Run-history validation, because the public API does not currently expose check-run or schedule-run history endpoints.

## Test Cases

### TC-1: Discover app config and baseline list endpoints
**Steps:**
1. List app configs and select a live app config.
2. Run `qa-use check list --json --limit 5`.
3. Run `qa-use check-schedule list --json --limit 5`.

**Expected Result:** All list commands return valid JSON arrays.
**Actual Result:** Passed. Selected app config `bac0bd5c-0d24-410c-bfd3-260f85e0233f` (`Taras (qa-use)`, base URL `https://evals.desplega.ai`). Baseline `check list` and `check-schedule list` returned valid JSON arrays.
**Status:** pass

### TC-2: Create and inspect disposable checks
**Steps:**
1. Create three checks with unique names against the selected app config.
2. Inspect each check with `qa-use check info <id> --json`.
3. Verify `qa-use check list --json --q <nonce>` includes both checks.

**Expected Result:** Create responses return IDs; info/list reflect the new checks.
**Actual Result:** Passed for resource creation and retrieval. Created three disposable checks:
- `efabfb4f-2d58-4d16-a098-3e151a515979`
- `ae34aac2-ae95-440c-b1e6-9fa1255f704d`
- `1ec1de1b-ff29-405b-9c2d-1701fd3c9924`

`check info` returned each check, and `check list --q codex-20260526173024-32764` returned all three.
**Status:** pass

### TC-3: Update check dependency/capture metadata
**Steps:**
1. Update the second check with `--depends-on <first-check-id>`, `--alias`, `--capture`, and timeout fields.
2. Inspect the second check.

**Expected Result:** Info output shows dependency, alias, capture, and timeout updates.
**Actual Result:** Failed for DES-467 metadata persistence. `timeout_ms` updated from `30000` to `25000`, but `alias`, `check_dependency_ids`, and `output_captures` stayed `null` / empty in the API response. A raw `qa-use api -X POST /api/v1/checks` probe with the same metadata also returned `alias: null`, `output_captures: []`, and `check_dependency_ids: []`, so this appears to be backend/API persistence behavior rather than the new CLI wrapper dropping fields.
**Status:** fail

### TC-4: Create, inspect, update, and run a schedule
**Steps:**
1. Create a schedule using all disposable checks and a near-term cron expression.
2. Inspect the schedule and verify all check IDs are present.
3. Update the schedule description and enabled state.
4. Run the schedule explicitly with `qa-use check-schedule run <id> --json --var env=staging`.

**Expected Result:** Schedule CRUD succeeds and the run endpoint returns JSON without CLI errors.
**Actual Result:** Mixed. Schedule creation, info, list, and explicit run passed:
- Schedule ID: `54a5dfad-233f-402e-a39b-723bae779e4a`
- Cron: `* * * * *`
- Explicit run response: `{"status":"success","message":"Check schedule run started","data":{"check_schedule_run_id":"52600dad-65b6-455d-8d29-49a003c98679"}}`
- After a 75s wait through the every-minute window, the schedule remained enabled and check `efabfb4f-2d58-4d16-a098-3e151a515979` reported `run_status: "passed"`.

However, `check-schedule update --failure-strategy continue_on_failure` returned success but the response still showed `failure_strategy: "stop_on_failure"`.
**Status:** fail

### TC-5: Cleanup disposable resources
**Steps:**
1. Delete the disposable schedule.
2. Delete all disposable checks.
3. Re-query each deleted resource.

**Expected Result:** Delete commands succeed and deleted resources are no longer fetchable.
**Actual Result:** Mixed. Delete commands succeeded and subsequent filtered list calls returned no disposable checks or schedules, so the resources were removed from list surfaces. Immediate detail calls by ID still returned the deleted check/schedule records, with no `deleted_at` field in the response.
**Status:** fail

## Edge Cases & Exploratory Testing
- Confirmed that `bun --silent run cli` is needed for shell-captured JSON in ad hoc scripts; plain `bun run cli` prints the script banner into captured stdout.
- Confirmed the public API still does not expose check-run or schedule-run history endpoints. Automatic schedule execution can only be inferred from enabled schedule state and check `run_status`, not from a first-class run-history read.
- Updated `scripts/e2e.ts` after this QA to verify cleanup through list absence instead of assuming detail endpoints stop returning deleted resources.

## Evidence

### Screenshots
- Not applicable; this QA is CLI/API only.

### Videos
- Not applicable.

### Logs & Output
```
PR created before live mutation QA:
https://github.com/desplega-ai/qa-use/pull/25

Live QA nonce:
codex-20260526173024-32764

Created checks:
efabfb4f-2d58-4d16-a098-3e151a515979
ae34aac2-ae95-440c-b1e6-9fa1255f704d
1ec1de1b-ff29-405b-9c2d-1701fd3c9924

Created schedule:
54a5dfad-233f-402e-a39b-723bae779e4a

Schedule run response:
{"status":"success","message":"Check schedule run started","data":{"check_schedule_run_id":"52600dad-65b6-455d-8d29-49a003c98679"}}

Post-wait status:
Schedule enabled after wait: true
Check1 run_status after wait: passed

Cleanup:
check-schedule delete 54a5dfad-233f-402e-a39b-723bae779e4a --force returned success
check delete 1ec1de1b-ff29-405b-9c2d-1701fd3c9924 --force returned success
check delete ae34aac2-ae95-440c-b1e6-9fa1255f704d --force returned success
check delete efabfb4f-2d58-4d16-a098-3e151a515979 --force returned success
Filtered list checks after cleanup returned []
Filtered list schedules after cleanup returned []
```

### External Links
- PR: https://github.com/desplega-ai/qa-use/pull/25

## Issues Found
- [ ] DES-467 metadata is not persisted by the live API — severity: major. `alias`, `check_dependency_ids`, and `output_captures` are accepted on create/update but responses show `null` / empty arrays. Reproduced through both `qa-use check` and raw `qa-use api` calls.
- [ ] Schedule `failure_strategy` update is not persisted by the live API — severity: major. Updating to `continue_on_failure` returned success, but the response still showed `stop_on_failure`.
- [ ] Delete detail semantics are surprising — severity: minor. Delete removes resources from list results, but direct detail fetches by ID still return the deleted resources without a `deleted_at` marker.

## Verdict
**Status**: FAIL
**Summary**: The core CLI endpoint wiring works for create/list/info/delete surfaces, schedule creation, and explicit schedule runs, and the disposable resources were removed from list results. QA failed overall because the live API did not persist advertised DES-467 metadata fields or schedule `failure_strategy` updates, and detail endpoints still return deleted resources by ID.

## Appendix

- **Plan**: `thoughts/taras/plans/2026-05-26-checks-cli-linear.md`
- **Related PR**: https://github.com/desplega-ai/qa-use/pull/25
