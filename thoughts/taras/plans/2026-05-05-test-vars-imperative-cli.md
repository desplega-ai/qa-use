---
title: "qa-use test vars imperative CLI (DES-163 follow-up)"
status: draft
issue: https://linear.app/desplega-labs/issue/DES-163/qa-use-support-variable-types
related_pr: https://github.com/desplega-ai/cope/pull/389
date: 2026-05-05
author: taras
autonomy: critical
commit_per_phase: true
---

# `qa-use test vars` Imperative CLI (DES-163 follow-up) Implementation Plan

## Overview

Ship `qa-use test vars list | set | unset` so users can mutate typed variables on a single test without round-tripping the entire YAML. The YAML/declarative path already shipped in cope#389; this plan adds the imperative twin. Default surface is **local YAML files**; an optional `--id <uuid>` flag falls back to read-modify-write against the backend.

- **Motivation**: cope#389 explicitly carved out the imperative CLI surface as a follow-up; users want one-key edits without a full round-trip.
- **Related**: [DES-163](https://linear.app/desplega-labs/issue/DES-163/qa-use-support-variable-types), [cope#389](https://github.com/desplega-ai/cope/pull/389), `src/cli/commands/test/`, schema source: `be/db/models.py:1127-1182`.

## Current State Analysis

Findings from sub-agent inspection of `qa-use` (every claim has a `file:line`):

- **Subcommand registration** is plain Commander.js with `addCommand`. `src/cli/commands/test/index.ts:18-31` aggregates leaves; `runs/` is the precedent for a nested subgroup (`src/cli/commands/test/runs/index.ts:12-18`). **`vars/` will follow the same pattern.**
- **No partial-UUID-prefix helper exists.** Closest precedent: name-substring resolution via `GET /api/v1/tests?query=…&limit=10` in `src/cli/commands/test/runs/list.ts:34-66`. The `UUID_RE` regex at `src/cli/commands/test/info.ts:15` is local-only.
- **Two API client layers coexist.** Lightweight `apiCall(config, method, path, opts)` in `src/cli/lib/api-helpers.ts:45-70` (auth + 25 s timeout via `src/cli/commands/api/lib/http.ts:39-75`) and the legacy `ApiClient` in `lib/api/index.ts` used for streaming and YAML import/export. **Import endpoint exists at `lib/api/index.ts:1104` (`POST /vibe-qa/cli/import`).**
- **Exit codes are 0/1 only.** No tiered scheme. Every failure path is `process.exit(1)`. The original prompt's `0/1/2/3` claim doesn't match the codebase. Decision: **stay with 0/1**.
- **Auto-generated types** at `src/types/test-definition.ts` (regen via `bun run generate:types` from `http://localhost:5005/vibe-qa/cli/schema`; the underlying script is `scripts/generate-types.ts`). `Variables` map at `:415-417`, `VariableEntry` at `:431-439`, the 20 `TestVariableType` literals duplicated as `Type` (`:18-38`) and `Type3` (`:365-385`). No Zod / runtime validation locally — backend Pydantic is source of truth.
- **Sensitive masking is inlined** at `src/cli/commands/test/info.ts:122-131,200-217` (top-level vars) and `:72` (matrix `var_options`). Not a shared helper. The new `vars list` will extract a small `maskValue(entry)` helper and reuse it from these call sites.
- **YAML lib** is `yaml` v2 (`package.json` → `"yaml": "^2.8.2"`), used everywhere via `import * as yaml from 'yaml'` (e.g. `src/cli/lib/loader.ts:8`, `src/cli/lib/id-injector.ts:10`). The Document API preserves comments/order — **mandatory** for in-place mutation; `parse`/`stringify` would lose comments.
- **Tabular output** uses a hand-rolled helper `printTable(columns, rows, opts)` at `src/cli/lib/table.ts:78-134`. `--json` short-circuits via `JSON.stringify(rows, null, 2)` at `:84-87`. The `output.ts` module supplies `success`/`error`/`info` color helpers.
- **MCP tools** all register inline in `src/server.ts` (single big array). Out of scope for this plan, but the hook-point is clear if v2 adds them.

## Desired End State

Eight invocations a user can run against a real backend at `localhost:5005` (and corresponding YAML round-trips):

```
qa-use test vars list  qa-tests/foo.yaml                  # tabular, sensitive masked
qa-use test vars list  qa-tests/foo.yaml --json           # JSON, sensitive value stripped
qa-use test vars list  --id <uuid>                        # remote: export, then list
qa-use test vars set   qa-tests/foo.yaml --key foo --value bar
qa-use test vars set   qa-tests/foo.yaml --key url --value "https://x" --type url --lifetime all
qa-use test vars set   qa-tests/foo.yaml --key password --value hunter2 --sensitive
qa-use test vars set   qa-tests/foo.yaml --key password --sensitive   # preserves DB/file value
qa-use test vars unset qa-tests/foo.yaml --key foo
qa-use test vars set   --id <uuid> --key foo --value bar              # remote RMW via export+import
qa-use test vars unset --id <uuid> --key foo
```

Verifiable end-state:

- `qa-use test diff <file>` is clean **after** a `vars set` if the YAML on disk is the local source of truth.
- For `--id`, `qa-use test export <id>` reflects the mutation post-`set`.
- Sensitive vars never leak their value through `list --json` (file or remote).
- File and `--id` are mutually exclusive; both → exit 1; neither → exit 1 with usage.
- Comments and key-ordering in the YAML file are preserved across mutations (Document API).
- `bun run check:fix` passes; `bun run scripts/e2e.ts` passes including a new `vars` section.

## What We're NOT Doing

- No new TUI / interactive editor.
- Not exposing `lifetime_index` (advanced; YAML-only for now).
- Not changing the YAML import/export semantics — that's cope's surface.
- No bulk operations (`vars set-many`, file import) — single-key only in v1.
- Not reconciling the lifetime-default mismatch in cope's model (just note it; cope's call).
- No new MCP tool surface in this plan (CLI-only).
- No tiered exit codes (introducing 0/1/2/3 just for `vars` would diverge from the rest of the CLI).
- No partial-UUID-prefix lookup for `--id` (full UUID required); separate plan if requested.
- No optimistic concurrency / etag check (best-effort, last writer wins).

## Implementation Approach

- **Local-first**: positional `<file>` is the primary surface. Mutations go through `yaml`'s **Document API** so comments/ordering/quoting style survive a round-trip.
- **API client choice**: Phase 3 reuses the **legacy `ApiClient`** (`lib/api/index.ts`) because that is where `exportTest`/`importTestDefinition` already live. Phases 1–2 are file-only and use no API client. We do **not** add a parallel `apiCall`-based path here — picking one client per phase keeps the code path obvious.
- **Remote `--id` fallback**: read-modify-write via existing `client.exportTest(testId, 'yaml', false)` + `client.importTestDefinition([def])`. No new endpoints; ships entirely on qa-use side. The remote round-trip parses YAML → mutates as `TestDefinition` → re-imports, so comment/key-ordering preservation only applies to the local-file path; remote normalizes formatting (acceptable: the sensitive-preserve contract is value-only). Slower per call; cope team can swap to dedicated endpoints later as a non-breaking server change.
- **Mutual exclusion**: `<file>` XOR `--id`. Both → exit 1; neither → exit 1 with usage.
- **Type validation**: hand-maintained `TEST_VARIABLE_TYPES` array, gated by a compile-time mutual-extends check against the auto-generated `Type` union. If anyone regenerates the types and the union changes, `bun run typecheck` fails the build.
- **Sensitive-preserve**: `set --sensitive` without `--value` keeps the existing value. Locally we read the file; remotely we rely on cope's import-merge rule from cope `3c98a77f`.
- **Exit codes 0/1** to match existing CLI; descriptive `error()` line on stderr (via `src/cli/lib/output.ts`).

## Quick Verification Reference

- Type-check + lint + format: `bun run check:fix`
- Type-check only: `bun run typecheck`
- Unit tests: `bun test`
- E2E regression (gated where remote): `bun run scripts/e2e.ts`
- Run CLI from source: `bun run cli test vars …`

---

## Phase 1: YAML helpers + parent `vars` command + local `list`

### Overview

Land the read-only path: YAML mutation helpers, the `vars` parent command nested under `test`, and a working `qa-use test vars list <file>` (with `--json`). Sets up plumbing the next two phases will reuse, with the smallest surface.

### Changes Required:

#### 1. YAML mutation helpers
**File**: `src/cli/lib/test-vars.ts` (new)
**Changes**:
- `readVarsFromYamlFile(path: string): { doc: yaml.Document; vars: Variables }` — parse Document, return both. `Variables` imported from `src/types/test-definition.ts:415-417`.
- `getNormalizedEntry(value: string | number | VariableEntry): VariableEntry` — coerce simple form to full form for display.
- `maskValue(value: string | number | VariableEntry): string` — accept the `Variables`-map union directly (matches the shape at `info.ts:122-131,200-217`); internally calls `getNormalizedEntry` then masks. **Does not truncate** — truncation stays at the call site (info.ts truncates to 50 chars; `vars list` uses `printTable` which has its own width handling).
- `TEST_VARIABLE_TYPES`, `TEST_VARIABLE_LIFETIMES`, `TEST_VARIABLE_CONTEXTS` runtime arrays (`as const`) plus a compile-time mutual-extends check against `Type`/`Lifetime`/`Context` from `src/types/test-definition.ts`.

#### 2. Parent `vars` command
**File**: `src/cli/commands/test/vars/index.ts` (new)
**Changes**: `export const varsCommand = new Command('vars').description('Manage typed variables on a test'); varsCommand.addCommand(varsListCommand);` etc. Wire under `test` in `src/cli/commands/test/index.ts:18-31`.

#### 3. `vars list` leaf
**File**: `src/cli/commands/test/vars/list.ts` (new)
**Changes**:
- Positional `<file>` arg required (Phase 3 will add `--id`).
- `--json` flag → emit `JSON.stringify` of normalized entries. For sensitive entries, the `value` key is **omitted entirely** (not set to `null`) so consumers can rely on `is_sensitive: true` as the redaction signal without ambiguity vs. genuinely null/empty values. Each entry includes `key`, `type`, `lifetime`, `context`, `is_sensitive`.
- Tabular output via `printTable` from `src/cli/lib/table.ts` with columns `key | type | lifetime | context | sensitive | value`. Apply `maskValue` for the `value` column.

#### 4. Refactor existing masking call sites
**File**: `src/cli/commands/test/info.ts:122-131,200-217,72`
**Changes**: replace inline masking with `maskValue` import. Behavior identical for masking; the surrounding 50-char truncation stays in `info.ts` (out of scope for `maskValue`). One source of truth for the mask logic.

#### 5. Fixture for QA walkthroughs
**File**: `qa-tests/_examples/matrix-example.yaml` (new)
**Changes**: add a small example test YAML containing a top-level `variables:` block with at least: a simple-form var (`foo: bar`), a full-form non-sensitive var (e.g. `url` with `type: url`), and a sensitive var (e.g. `password` with `is_sensitive: true`). Plus a tiny matrix block with `var_options` covering the matrix path. Used by Phase 1/2 QA and Manual E2E. Keep it minimal — the file is a fixture, not a real test.

### Success Criteria:

#### Automated Verification:
- [ ] Type-check passes: `bun run typecheck`
- [ ] Lint + format clean: `bun run check:fix`
- [ ] Unit tests pass: `bun test src/cli/lib/test-vars.test.ts` covering: simple-form coercion, full-form passthrough, `maskValue` for sensitive vs non-sensitive, runtime-vs-type drift detection compiles.
- [ ] CLI registers: `bun run cli test vars --help` lists `list` and prints the parent description.

#### Automated QA:
- [ ] Agent walkthrough on the new fixture `qa-tests/_examples/matrix-example.yaml` verifying:
  - `bun run cli test vars list qa-tests/_examples/matrix-example.yaml` prints a table with all variables; `password`-flagged row shows `****`.
  - `bun run cli test vars list qa-tests/_examples/matrix-example.yaml --json` returns valid JSON; sensitive entries have **no `value` key at all** (not `value: null`), and carry `is_sensitive: true`.
  - `bun run cli test vars list missing.yaml` exits 1 with a clear "file not found" message.

#### Manual Verification:
- [ ] Run against a real test YAML in the local checkout; confirm masking and the table layout look right (column widths, color).

**Implementation Note**: After this phase, pause for manual confirmation. Commit as `[phase 1] qa-use test vars list (local YAML)` once verified.

---

## Phase 2: Local `set` and `unset`

### Overview

Add mutating commands operating on the local YAML file via `yaml`'s Document API. Comments and ordering survive round-trips. Validation rejects unknown enum values with a stderr message naming the offending field.

### Changes Required:

#### 1. `vars set`
**File**: `src/cli/commands/test/vars/set.ts` (new)
**Changes**:
- Args: `<file>` positional; flags `--key <k>` (required), `--value <v>`, `--type <t>`, `--lifetime <l>`, `--context <c>`, `--sensitive` (bool).
- Validation:
  - `--key` required.
  - `--type/--lifetime/--context` validated against the `TEST_VARIABLE_*` arrays from `src/cli/lib/test-vars.ts`. On mismatch: `console.error('invalid value for --type: …; allowed: …')` + exit 1.
  - For new keys: if `--sensitive` is set without `--value`, exit 1 (no existing value to preserve).
  - For existing keys with `is_sensitive=true` and no `--value`: keep stored value, allow flag changes (matches cope's import-merge rule).
- Mutation rules:
  - If only `--key --value` (no other flags): write **simple form** (`key: value`).
  - Any of `--type/--lifetime/--context/--sensitive` → upgrade to **full form** (`key: { value: …, type: …, … }`).
  - Existing full form stays full form even if user only passes `--value`.
  - Defaults for new full-form entries: `type='custom', lifetime='test', context='test', is_sensitive=false` (YAML-form defaults from cope `be/cli/schema.py:173`, **not** the model default `lifetime='all'`).
- Use `yaml.Document` API (`doc.setIn(['variables', key, 'value'], val)` etc.); write back atomically via `fs.writeFile(path, doc.toString())`.

#### 2. `vars unset`
**File**: `src/cli/commands/test/vars/unset.ts` (new)
**Changes**:
- Args: `<file>` positional; `--key <k>` required.
- If key absent: exit 0 with informational note (`info(\`key '${k}' not present in ${file}\`)`); don't mutate file.
- If key present: `doc.deleteIn(['variables', key])`; if `variables:` becomes empty, delete the whole `variables` block.

#### 3. Wire into parent
**File**: `src/cli/commands/test/vars/index.ts`
**Changes**: `addCommand(varsSetCommand)`, `addCommand(varsUnsetCommand)`.

### Success Criteria:

#### Automated Verification:
- [ ] Type-check + lint clean: `bun run check:fix`
- [ ] Unit tests pass: `bun test src/cli/commands/test/vars/set.test.ts src/cli/commands/test/vars/unset.test.ts`. Cases:
  - Simple form: `--key foo --value bar` → YAML contains `foo: bar`.
  - Upgrade to full form when `--type url` passed.
  - Round-trip preserves comments on neighbor keys (parse output, assert original comment node still present).
  - `set --sensitive` without `--value` on existing sensitive var keeps the value.
  - `set --sensitive` without `--value` on new key exits 1.
  - `set --type bogus` exits 1, stderr names `type`.
  - `unset` on missing key exits 0; file byte-identical (`assertEqual(before, after)`).
  - `unset` on last key removes the `variables:` block entirely.

#### Automated QA:
- [ ] Agent walkthrough using a temp YAML:
  - `vars set tmp.yaml --key foo --value bar && grep -q '^  foo: bar$' tmp.yaml`
  - `vars set tmp.yaml --key url --value https://x --type url` → resulting YAML contains a `url:` block with `value:` and `type: url`.
  - `vars list tmp.yaml --json` post-mutation returns the expected entries.
  - `qa-use test diff tmp.yaml` is silent if you re-pull from a backend that already has these vars (skip on environments where the backend is unreachable).

#### Manual Verification:
- [ ] Open a hand-edited YAML with comments + custom key order; run `vars set` then `vars unset`; eyeball that comments and unrelated key order survive.

**Implementation Note**: After this phase, pause for manual confirmation. Commit as `[phase 2] qa-use test vars set/unset (local YAML)` once verified.

---

## Phase 3: Remote `--id` fallback (RMW via export + import)

### Overview

Add `--id <uuid>` to all three commands so users can mutate a remote test by id without checking the YAML out first. Implementation: export YAML → mutate via the Phase 2 helpers → POST to `/vibe-qa/cli/import`.

### Changes Required:

#### 1. Mutual-exclusion guard
**File**: `src/cli/lib/test-vars.ts`
**Changes**: `resolveVarsTarget(args): { kind: 'file'; path: string } | { kind: 'id'; uuid: string }` — accepts the optional `<file>` positional and `--id`; throws on both/neither.

#### 2. `vars list --id`
**File**: `src/cli/commands/test/vars/list.ts`
**Changes**: When `--id` present, use `client.exportTest(testId, 'yaml', false)` from `lib/api/index.ts`, parse Document in memory, run the same rendering path. No file I/O.

#### 3. `vars set --id` / `vars unset --id`
**File**: `src/cli/commands/test/vars/set.ts`, `unset.ts`
**Changes**: When `--id` present:
1. `const yamlText = await client.exportTest(testId, 'yaml', false);` (`lib/api/index.ts:1036-1044`).
2. Apply the mutation. Two viable shapes:
   - **(Recommended)** Parse `yamlText` with `yaml.parse(yamlText)` into a `TestDefinition`, apply the mutation directly on the parsed object, then call `client.importTestDefinition([def])` (existing method at `lib/api/index.ts:1099-1107` — note the actual name is `importTestDefinition`, not `importTest`, and it takes `TestDefinition[]`, **not** a raw YAML string).
   - The Document API path used locally **is not used remotely** because comment/key-order preservation isn't meaningful across an export → import (the server normalizes). Keeping the two paths separate avoids a fake-preserve illusion on the remote path.
3. Sensitive-preserve: cope's import-merge rule (cope `3c98a77f`) keeps existing DB value when `is_sensitive=true` and no `value` supplied. Document this as the contract; no special-casing on qa-use side.
4. After import, re-run `client.exportTest(testId, 'yaml', false)` once and assert the mutation took effect (no separate `--verify` flag — just an internal sanity check that fails the command with exit 1 if the import response indicates failure).

#### 4. Validate full-UUID-only behavior
**File**: `src/cli/lib/uuid.ts` (new — generic regex doesn't belong in `test-vars.ts`)
**Changes**: export `UUID_RE` (lifted from `src/cli/commands/test/info.ts:15`) and a small helper `isFullUuid(s: string): boolean`. Update `src/cli/commands/test/info.ts` to import from the new module. New `vars` commands import from the same place; reject prefixes with a message pointing at the existing test-by-name search via `qa-use test list --query` (no new prefix-resolver in this plan).

### Success Criteria:

#### Automated Verification:
- [ ] Type-check + lint clean: `bun run check:fix`
- [ ] Unit tests pass: `bun test src/cli/commands/test/vars/*.test.ts` covering both/neither target args, partial-UUID rejection, file+`--id` rejection.
- [ ] Mock-based test for the `--id` path (mock `apiCall` / `client.exportTest`) verifies the export → mutate → import sequence and the YAML payload sent to import.

#### Automated QA:
- [ ] Agent walkthrough against the local backend at `localhost:5005` (repo `.qa-use.json` is pre-configured):
  - Pick a test id (e.g. `bun run cli test list --json | jq -r '.[0].id'`).
  - `vars list --id <id> --json` returns server-side variables; sensitive masked.
  - `vars set --id <id> --key smoke --value ok && vars list --id <id>` shows the new var.
  - `vars unset --id <id> --key smoke && vars list --id <id>` shows it's gone.
  - `vars set --id <id> --key password --value hunter2 --sensitive && vars set --id <id> --key password --sensitive` (no `--value`) → still present, value preserved.
  - `vars set --id deadbeef --key x --value y` → exit 1 with "full UUID required".
  - `vars set foo.yaml --id <uuid> --key x --value y` → exit 1 with "use file OR --id, not both".

#### Manual Verification:
- [ ] Eyeball the import payload via a one-off `bun run cli api -X POST /vibe-qa/cli/import --input /tmp/payload.yaml` to confirm the YAML emitted by `vars set --id` is valid in cope's eyes.

**Implementation Note**: After this phase, pause for manual confirmation. Commit as `[phase 3] qa-use test vars --id remote fallback` once verified.

---

## Phase 4: E2E regression + docs + skills + version bump

### Overview

Lock the new surface into `scripts/e2e.ts`, surface it in the `qa-use docs` CLI output, the qa-use plugin skill/commands, and project notes — then bump both the npm package and the plugin manifest before release.

### Changes Required:

#### 1. E2E section
**File**: `scripts/e2e.ts`
**Changes**: New section `Section 16: Test Vars` (the script currently ends at Section 15, see `scripts/e2e.ts:787`) exercising:
- Local: create temp YAML → `vars set` simple form → `vars list --json` → `vars set` full form → `vars unset` → file diff sane.
- Remote (gated, like the existing remote-tunnel sections): pick a test id from `test list --json`, run the `--id` flow, restore state.
- Validation cases: `--type bogus`, both `<file>` and `--id`, neither, `--sensitive` without `--value` on a new key.

#### 2. `qa-use docs` CLI command
**File**: `src/cli/commands/docs.ts`
**Changes**: Add `test vars list/set/unset` to the embedded docs payload — both human-readable text and the example block — so `qa-use docs` (the harness/agent-facing reference) reflects the new surface.

#### 3. qa-use plugin skill
**File**: `plugins/qa-use/skills/qa-use/SKILL.md` (and `plugins/qa-use/skills/qa-use/references/test-format.md` if it documents the `variables:` block)
**Changes**: Document the imperative `test vars` subgroup alongside the existing declarative YAML form. Cover the local-file path, the `--id` fallback, the mutual-exclusion rule, and the sensitive-preserve behavior. Cross-link to `qa-use docs`.

#### 4. qa-use plugin commands (only if relevant)
**File**: `plugins/qa-use/commands/test-init.md`, `plugins/qa-use/commands/test-run.md`
**Changes**: Skim each. If they reference variable management workflows, add a one-line pointer to `test vars`. Otherwise leave untouched — don't bloat unrelated commands.

#### 5. Project CLAUDE.md
**File**: `CLAUDE.md`
**Changes**: Short paragraph (≤6 lines) under the existing `test`-related block describing the new `vars` subgroup, local vs `--id`, and the `TEST_VARIABLE_TYPES` drift-guard. Don't duplicate the SKILL.md content — link to it.

#### 6. Version bumps
**File**: `package.json`, `plugins/qa-use/.claude-plugin/plugin.json`
**Changes**:
- `package.json`: `2.15.4` → `2.16.0` (minor — additive CLI feature).
- `plugins/qa-use/.claude-plugin/plugin.json`: `3.6.0` → `3.7.0` (minor — additive surface in `qa-use docs` and SKILL).
- Update the plugin's `description` field if it lists capability bullets that should now mention variable management.

#### 7. Type-regen guard rail (lightweight doc note)
**File**: `CLAUDE.md` (single line)
**Changes**: Add an `<important if=…>` block reminding contributors that the runtime `TEST_VARIABLE_TYPES` array in `src/cli/lib/test-vars.ts` must stay in sync with `pnpm generate:types` output. The compile-time mutual-extends check enforces this; the note tells readers what to do when it fails.

### Success Criteria:

#### Automated Verification:
- [ ] Lint + format clean: `bun run check:fix`
- [ ] E2E passes: `bun run scripts/e2e.ts`
- [ ] CLI help reflects new commands: `bun run cli test vars --help`, `bun run cli test vars set --help`
- [ ] `qa-use docs` mentions vars: `bun run cli docs | grep -E "test vars (list|set|unset)"`
- [ ] npm version bumped to `2.16.0`: `node -p "require('./package.json').version"`
- [ ] Plugin manifest bumped to `3.7.0`: `node -p "require('./plugins/qa-use/.claude-plugin/plugin.json').version"`
- [ ] SKILL.md mentions `test vars`: `grep -E "test vars (list|set|unset)" plugins/qa-use/skills/qa-use/SKILL.md`

#### Automated QA:
- [ ] Agent walkthrough re-runs the full Phase 1–3 QA checklists end-to-end via the e2e script (no separate manual reproduction).
- [ ] Agent reads `qa-use docs` output and SKILL.md and confirms `test vars` is documented consistently in both, including the local-vs-`--id` mutual-exclusion rule and sensitive-preserve behavior.

#### Manual Verification:
- [ ] Skim CLAUDE.md, SKILL.md, and `qa-use docs` output for accuracy; confirm wording matches observed CLI behavior.
- [ ] Confirm semver bump magnitudes are appropriate (both minor) and that the plugin description still reads cleanly.

**Implementation Note**: After this phase, pause for manual confirmation. Commit as `[phase 4] qa-use test vars e2e + docs + skill + version bump` once verified.

---

## Manual E2E

After Phase 4, run end-to-end against the local backend (`.qa-use.json` at repo root):

```bash
# 1. Local YAML round-trip
cp qa-tests/_examples/matrix-example.yaml /tmp/vars-e2e.yaml   # fixture added in Phase 1
bun run cli test vars list /tmp/vars-e2e.yaml
bun run cli test vars list /tmp/vars-e2e.yaml --json | jq .
bun run cli test vars set /tmp/vars-e2e.yaml --key smoke --value ok
bun run cli test vars set /tmp/vars-e2e.yaml --key url --value https://x --type url --lifetime all
bun run cli test vars set /tmp/vars-e2e.yaml --key password --value hunter2 --sensitive
bun run cli test vars set /tmp/vars-e2e.yaml --key password --sensitive   # preserves value
bun run cli test vars list /tmp/vars-e2e.yaml --json | jq '.[] | select(.key=="password")'
bun run cli test vars unset /tmp/vars-e2e.yaml --key smoke

# 2. Remote --id (requires backend at localhost:5005)
TEST_ID=$(bun run cli test list --json | jq -r '.[0].id')
bun run cli test vars list --id "$TEST_ID"
bun run cli test vars set --id "$TEST_ID" --key smoke --value ok
bun run cli test vars list --id "$TEST_ID" --json
bun run cli test vars unset --id "$TEST_ID" --key smoke

# 3. Validation
bun run cli test vars set /tmp/vars-e2e.yaml --key x --type bogus     # exit 1, names 'type'
bun run cli test vars set /tmp/vars-e2e.yaml --id "$TEST_ID" --key x --value y  # exit 1, mutual-exclusion
bun run cli test vars set --key x --value y                          # exit 1, missing target
bun run cli test vars set --id deadbeef --key x --value y            # exit 1, full UUID required

# 4. Drift check
bun run cli test sync pull --id "$TEST_ID" --force                    # writes test YAML to qa-tests/ (project sync dir)
bun run cli test diff qa-tests/<written-file>.yaml                    # zero drift expected
# Alternative one-shot if you don't want to touch qa-tests/:
#   bun run cli test export "$TEST_ID" > /tmp/round-trip.yaml
#   bun run cli test diff /tmp/round-trip.yaml
```

## Appendix

- **Follow-up plans**:
  - Dedicated backend variable endpoints (cope) — when shipped, qa-use's `--id` path swaps `client.exportTest`+`client.importTest` for `GET/PUT/DELETE /vibe-qa/cli/tests/{id}/variables[/{key}]`. No CLI surface change.
  - MCP tool surface (`qa_use_test_var_list/set/unset`) once CLI UX has settled.
  - Partial-UUID-prefix resolver for `--id` (separate plan) — would generalize the name-search pattern at `src/cli/commands/test/runs/list.ts:34-66`.
- **Derail notes**:
  - Lifetime default mismatch in cope: model default `"all"` (`be/db/models.py:1171`) vs YAML schema default `"test"` (`be/cli/schema.py:173`). qa-use's `vars set` uses YAML default for convergence with declarative path. **File a cope issue.**
  - The 20-value `TestVariableType` enum lives in three places (cope model, cope YAML schema, qa-use auto-gen). Compile-time mutual-extends check on the qa-use side guards against drift if `pnpm generate:types` is run.
  - Concurrency: best-effort; last writer wins both locally and remote. Documented limitation, not a feature.
- **References**:
  - Cope PR: https://github.com/desplega-ai/cope/pull/389
  - Schema: `be/db/models.py:1127-1182`, `be/cli/schema.py:150,179,197`
  - Existing imperative endpoint pattern: `be/api/vibe_qa_cli.py`
  - qa-use API client: `lib/api/index.ts` (legacy) + `src/cli/lib/api-helpers.ts` (new)
  - qa-use sensitive masking call sites: `src/cli/commands/test/info.ts:72,122-131,200-217`
  - qa-use generated types: `src/types/test-definition.ts:18-38,415-417,431-439`
  - Linear: [DES-163](https://linear.app/desplega-labs/issue/DES-163/qa-use-support-variable-types)

## Review Errata

_Reviewed: 2026-05-05 by Claude (auto-apply mode)_

### Applied

**Critical**

- [x] **Phase 3 import API signature** — Plan referenced `client.importTest(yamlString)` at line ~228, but the actual method is `importTestDefinition(definitions: TestDefinition[], options?)` at `lib/api/index.ts:1099-1107`; it takes a parsed array, not a raw YAML string. Phase 3 §3 rewritten to: `yaml.parse` the exported text into a `TestDefinition`, mutate it directly, and call `client.importTestDefinition([def])`. Document API is **not** used on the remote path (no fake-preserve illusion). Added a post-import re-export sanity check.
- [x] **Missing fixture** — `qa-tests/_examples/matrix-example.yaml` did not exist (only `qa-tests/e2e.yaml` ships in `qa-tests/`). Added a new Phase 1 step (#5) creating the fixture with simple-form, full-form, sensitive, and matrix `var_options` coverage. Phase 1 QA + Manual E2E now reference the new fixture path.
- [x] **`test pull` does not exist** — Manual E2E used `bun run cli test pull "$TEST_ID" -o /tmp/round-trip.yaml`. The actual surface is `qa-use test sync pull --id <uuid>` (see `src/cli/commands/test/sync.ts`); `test export` is the one-shot alternative (deprecated but still works). Manual E2E updated.

**Important**

- [x] **`maskValue` signature** — Plan had `maskValue(entry: VariableEntry): string`, but the existing call sites at `src/cli/commands/test/info.ts:122-131,200-217` accept the `Variables`-map union (`string | number | VariableEntry`) — a narrow signature would have forced a normalizer at every call site. Widened to `maskValue(value: string | number | VariableEntry): string`. Also clarified that 50-char truncation stays at the call sites, not inside `maskValue`.
- [x] **`UUID_RE` location** — Phase 3 §4 originally relocated the regex into `src/cli/lib/test-vars.ts`, which is the wrong module for a generic UUID matcher. Moved to a new `src/cli/lib/uuid.ts` exposing `UUID_RE` and `isFullUuid(s)`; `info.ts` re-imports from there.
- [x] **API client choice** — Plan named both `apiCall` and the legacy `ApiClient` without committing. Implementation Approach now states explicitly: Phase 3 uses the legacy `ApiClient` because `exportTest`/`importTestDefinition` already live there; Phases 1–2 are file-only.
- [x] **Build script reference** — Current State Analysis said `pnpm generate:types`. Project policy is bun-only (CLAUDE.md). Changed to `bun run generate:types` (`package.json` exposes the script as `tsx scripts/generate-types.ts`).
- [x] **`vars list --json` sensitive shape** — Plan had "(or `value: null`)", an ambiguous fallback (null could be a real value). Pinned to: omit the `value` key entirely; rely on `is_sensitive: true` as the redaction marker.

**Minor**

- [x] **E2E section number** — `Section N` placeholder replaced with `Section 16` (current end is Section 15 at `scripts/e2e.ts:787`).

### Verified accurate (no change needed)

- All other file:line claims in Current State Analysis (Commander.js wiring at `src/cli/commands/test/index.ts:18-31`, `runs/` precedent at `:12-18`, `runs/list.ts:34-66`, `info.ts:15` UUID_RE, `info.ts:72,122-131,200-217` mask sites, `api-helpers.ts:45-70`, `api/lib/http.ts:39-75` 25s timeout, `lib/api/index.ts:1104` import endpoint, `table.ts:78-134,84-87`, `output.ts` helpers).
- 20-literal `Type` union count at `src/types/test-definition.ts:18-38`.
- `package.json` yaml v2.8.2 + `loader.ts:8` / `id-injector.ts:10` import patterns.
- Current versions: npm `2.15.4` → `2.16.0`; plugin `3.6.0` → `3.7.0` (both minor — additive).
- `client.exportTest(testId, 'yaml', false)` exists at `lib/api/index.ts:1036-1044` with the exact signature the plan needs.
- `plugins/qa-use/skills/qa-use/SKILL.md` exists (752 lines) — Phase 4 §3 doc updates land in a real file.

### Open questions left for the author

- None blocking. The plan is ready to implement against the corrected Phase 3 import shape.
