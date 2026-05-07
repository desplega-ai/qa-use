---
status: completed
---

# qa-use — name-collision-safe `test sync pull` / `test sync push`

## Context

**Why this change is being made.** Test names are not unique within an org by design — `Test.matrix` is JSONB on a single row, so multiple rows can legitimately share a `name`. The CLI was written under the wrong assumption that `name` is a usable handle:

1. **Pull collision (silent data loss).** `pullFromCloud` writes `${toSafeFilename(test.name)}.yaml`. With same-named cloud rows, the first written wins (skip-on-exist) or the last written wins (`--force`). A user with N same-named cloud tests ended up with a single local YAML representing one row, and no warning. Reported in prod (`org_33kGskJBHht2crEN6QXhYfXSU16`, "Verify EASM Assets Monitoring Dashboard Functionality" × 6 rows). Diagnosis: `cope/thoughts/shared/learnings/2026-05-07-taras-verify-data-model-before-bug-framing.md`.
2. **Push ambiguity (silent wrong-target).** `push --id <x>` matches `d.def.id === x || d.def.name === x`. When multiple local defs share `name === x`, both got pushed — potentially overwriting a different cloud row than the user intended.
3. **Post-import lookup ambiguity (silent wrong file).** After `push`, the CLI maps each imported result back to its local file by `id || name` to print conflict paths and update `version_hash`. Same collision risk: wrong local file gets its `version_hash` updated.

**Outcome.** Pull writes one file per cloud row, suffixed with the first 8 hex chars of the test UUID. Push by name fails loudly when the local directory has a name collision. Post-import lookup prefers id-match and refuses to silently mis-target on name-only ambiguity. Legacy un-suffixed files are flagged on next pull but never auto-deleted.

## Working draft audit (before this plan)

The repo has a staged working draft (4 files, ~169 ins / 17 del) that addresses items (1) and (2) above. The plan **adopts the staged draft as-is** and adds the missing third fix plus tests, e2e coverage, and release plumbing.

| Site | Sub-agent finding | Decision |
|---|---|---|
| `src/utils/strings.ts` `toUniqueTestFilename` / `isUuid` | New helpers | **Adopt** |
| `src/utils/strings.test.ts` 12-case suite | Unit coverage of helpers | **Adopt** |
| `src/cli/commands/test/sync.ts` pull (3 write sites) | Switched to `toUniqueTestFilename` | **Adopt** |
| `src/cli/commands/test/sync.ts` `warnLegacyOrphan` | Warn-only on legacy un-suffixed files | **Adopt** (warn-only is the right call — see "Filename migration" below) |
| `src/cli/commands/test/sync.ts` push `--id` resolution | UUID-gated; multi-match name → exit 1 | **Adopt** |
| `src/cli/commands/test/sync.ts` `renderImportResult` lines 508 + 527 | **Still buggy** — name fallback after `id` match | **Fix in Phase 1** |
| `src/cli/commands/test/export.ts` | Switched to `toUniqueTestFilename` | **Adopt** |

### Other name-vs-id resolution sites — coherence audit

Sub-agents searched `src/cli/commands/`, `src/cli/lib/`, `src/server.ts`, `src/http-server.ts`, `lib/api/`. Findings:

- **Safe (no change needed):**
  - `info.ts:238–319` — uses `UUID_RE.test(lookupKey)` to gate; name path resolves by file basename, not data field.
  - `diff.ts` — takes a file path argument, not a handle.
  - `run.ts` / `validate.ts` — resolve via `loadTestWithDeps` → `resolveTestPath(name, dir)`, file-path-based, not data-field-based. First-extension-wins is acceptable.
  - `vars/set.ts` — already enforces full UUID via `isFullUuid(id)`.
  - `runs/list.ts:44` — exact-name filter on cloud results, already errors explicitly on multi-match.
  - **MCP server tools** (`server.ts:709/824/861/885`) and HTTP transport (`http-server.ts`) — all delegate to backend API as-is, no client-side name filtering. Backend owns disambiguation. Out of scope for this PR.
- **Newly identified (Phase 1):** `sync.ts:508` and `sync.ts:527` — post-import map-back. The name fallback is load-bearing for first-push (local def has no id), so we can't just remove it; we tighten it instead. See Phase 1 design.

### Decisions on the open questions

| Question | Decision | Rationale |
|---|---|---|
| 8-char id-prefix collision (~1/4B per pair, same name) | Accept; document; existing skip-on-exist semantics still apply | Cost of a longer prefix is uglier filenames forever; the org-scale collision math is generous |
| BC for `--id <unique-name>` | **Keep.** Single-match by name still works | Removes a genuine convenience with no safety win — if exactly one local file has that name, the operation is unambiguous |
| Filename migration on pull (rename in place when legacy id matches new id) | **Reject.** Warn-only stays | Auto-rename is one extra side-effect on a sync command; the user might have unsaved local changes; warn is one-shot and the user `mv`s themselves. No `migrate-filenames` subcommand either — YAGNI until users ask |
| Version bump | **2.17.0** | User-visible filename change in every existing `qa-tests/`. No code consumers break (paths still resolve, YAML content unchanged), so minor — not patch, not major |
| Out of scope | Matrix/typed-variables CLI (already in 2.16.0); backend export endpoint (correct as-is); UI grouping by name; argus template version pin in `cope/be/argus-template/build-template.py` (separate downstream task) | All flagged in the original prompt; not in this PR |

---

## Phase 1: Tighten post-import lookup + finalize working draft

**Deliverable.** A single committable bundle: the staged working draft plus a fix to `renderImportResult` so it prefers id-match and refuses to silently mis-target on name collisions.

**Critical files.**
- `src/cli/commands/test/sync.ts` — lines 505–540 (`renderImportResult`)

**Design.** Replace the two `find` calls at `sync.ts:508` and `sync.ts:527` with a shared helper:

```ts
function findLocalForImported(
  imported: { id: string; name: string },
  toImport: ReadonlyArray<{ def: TestDefinition; file: string }>,
): { def: TestDefinition; file: string } | null {
  // Prefer id-match — unambiguous when the local def already has an id.
  const byId = toImport.find((d) => d.def.id === imported.id);
  if (byId) return byId;
  // Fallback: local def is brand-new (no id) — match by name, but only
  // if exactly one local def with that name has no id. Otherwise refuse.
  const candidates = toImport.filter((d) => !d.def.id && d.def.name === imported.name);
  if (candidates.length === 1) return candidates[0];
  return null;
}
```

Call sites:
- Conflict path printing (existing line 510 if-block) — when `null`, skip the conflict-path push (still print the `CONFLICT` banner).
- `version_hash` writeback (existing line 529 if-block) — when `null`, log `warning(...)` ("Could not unambiguously map imported '${name}' back to a local file — version_hash not updated. Pull or push by --id <uuid> to resolve.") and continue.

Never silently pick the wrong file.

### Success Criteria

#### Automated Verification
- [x] `bun run typecheck` passes
- [x] `bun run check:fix` produces no diff
- [x] `bun test src/utils/strings.test.ts` passes (44/44 from working draft, unchanged)

#### Automated QA
- [x] `bun run cli test sync push --help` lists `--id <id-or-name>` (BC preserved)
- [x] In a temp `qa-tests/` with two YAML files sharing `name: "Dup"` and no `id` field: `bun run cli test sync push --id Dup --dry-run` exits 1 and prints `Ambiguous: 'Dup' matches 2 local tests by name` followed by the two file paths and `Use --id <uuid> to disambiguate.` (covered by working draft)
- [x] In the same dir with one YAML having `name: "Solo"` and `id: <uuid>`: `bun run cli test sync push --id Solo --dry-run` resolves to that one test (BC for unique-name `--id`)

#### Manual Verification
- [x] Eyeball the diff for `findLocalForImported` to confirm the no-id-fallback branch matches the design exactly (the trap is matching a brand-new local def against an existing-id imported entry — the helper must not do that)

---

## Phase 2: Behavioral tests for push ambiguity

**Deliverable.** New `bun:test` cases in `src/cli/commands/test/sync.test.ts` (currently structural-only, 293 lines) that assert the push-by-name disambiguation behavior end-to-end at the function level.

**Critical files.**
- `src/cli/commands/test/sync.test.ts`
- Reuse `spyOn` pattern from `src/cli/lib/api-helpers.test.ts:14–27` (mocks `process.exit` and `console.log` via `bun:test` `spyOn`)
- Reuse dependency-injection pattern from `src/cli/lib/cli-entry.test.ts:14–27` where viable

**Approach.** The push action handler in `sync.ts` is a closure over `Command`, so it isn't directly callable. Two options:

1. **Refactor minimal seam.** Extract the "filter `definitions` by `--id`" block into an exported pure function `filterDefinitionsByHandle(definitions, testId): { matched, ambiguous }`. Test the pure function directly. **Recommended** — surgical, no fixture juggling, exact intent.
2. **Spawn the CLI under test.** Use `Bun.spawn` against `bun run cli test sync push --id Dup --dry-run` with a temp `qa-tests/` dir. Heavier, slower, but exercises the whole path. Already covered in Phase 3 e2e.

Phase 2 implements option 1. Cases:

- `unique uuid match` → 1 result, no ambiguity flag
- `unique name match` → 1 result, no ambiguity flag (BC)
- `colliding name match (n=2)` → ambiguity flag set, both files in result for caller to render
- `name match with no result` → 0 results, no ambiguity flag
- `uuid that happens to look like a name` → routes through UUID branch; no name fallback (regression-guards the `isUuid` gate)

Also add tests for `findLocalForImported` from Phase 1 — same file, separate `describe` block.

### Success Criteria

#### Automated Verification
- [x] `bun test src/cli/commands/test/sync.test.ts` passes including the new cases
- [x] `bun test` (full suite) passes
- [x] `bun run typecheck` passes
- [x] `bun run check:fix` produces no diff

#### Automated QA
- [x] New tests assert exit-code-equivalent behavior via the pure function's return shape (no `process.exit` reliance in unit tests — that lives in the action handler)

#### Manual Verification
- [x] Confirm the extracted `filterDefinitionsByHandle` is internally consistent with the action-handler usage in `sync.ts` (no behavior drift between unit-tested function and CLI runtime)

---

## Phase 3: E2E regression coverage

**Deliverable.** A new section in `scripts/e2e.ts` (after Section 15) that exercises duplicate-name pull and push against a real backend. Gated to skip safely if backend isn't reachable.

**Critical files.**
- `scripts/e2e.ts` — add section, follow existing banner style (`// ============== Section N: ... ==============`)

**Approach.** The e2e script already has fixtures for `qa-tests/e2e.yaml`. Add:

1. **Setup**: in a temp dir, write two YAML files with the same `name` ("e2e dup") and different `id` UUIDs. Push both.
2. **Pull-collision regression**:
   - `qa-use test sync pull --all --dir <tmp>` — assert two files exist, both suffixed with `-${shortId}`, both contain the right `id`.
   - With a legacy un-suffixed `e2e-dup.yaml` planted in `<tmp>` first, pull again and assert the warning text appears in stdout (`Legacy file: e2e-dup.yaml (...)`).
3. **Push-ambiguity regression**:
   - From a `<tmp>` containing both YAMLs, run `qa-use test sync push --id "e2e dup" --dry-run` — assert exit code 1 and stderr/stdout contains `Ambiguous` plus both file relative paths plus `Use --id <uuid>`.
   - `qa-use test sync push --id <uuid-1> --dry-run` — assert exits 0 and references exactly one test.
4. **Cleanup**: delete both cloud test rows.

Use the same `qa-use api` action calls already used elsewhere in `e2e.ts` for the cloud setup/teardown to avoid coupling to internals.

### Success Criteria

#### Automated Verification
- [x] `bun run scripts/e2e.ts` runs the new section to completion against a configured backend
- [ ] `bun run scripts/e2e.ts --cmd qa-use` runs the same against an installed binary

#### Automated QA
- [x] Section banner follows existing convention
- [x] Gated remote-tunnel sections still skip safely when backend unreachable (regression for existing skip behavior)

#### Manual Verification
- [ ] Run the full e2e once against `localhost:5005` and confirm the new section's output matches the design (no `undefined: undefined`, exit codes correct)

---

## Phase 4: Version bump + README migration note

**Deliverable.** `package.json` bumped to `2.17.0`; README has a short migration callout under the test-sync section.

**Critical files.**
- `package.json` — line 3, `"version": "2.16.0"` → `"version": "2.17.0"`
- `README.md` — under `## CLI Reference > ### Test Commands` (line 57), append a short paragraph after the `test sync pull` description

**README copy** (drop-in, ~6 lines):

> **Filename suffix (≥ 2.17).** `pull` writes one file per cloud test as `${safe-name}-${short-id}.yaml`, where `${short-id}` is the first 8 hex chars of the test UUID. Test names can collide within an org by design, so the suffix guarantees one local file per cloud row. If you upgrade from an earlier version, the next `pull` will write new suffixed files alongside any legacy un-suffixed file you had — qa-use prints a one-line `Legacy file: …` notice per orphan and never auto-deletes. Inspect the legacy file's `id:` field; remove it manually once you've confirmed it's not load-bearing.

No CHANGELOG.md exists in this repo today — the version bump speaks for itself; README + commit message carry the human-facing change description.

### Success Criteria

#### Automated Verification
- [x] `bun run typecheck` passes
- [x] `bun run check:fix` produces no diff
- [x] `node -e "console.log(require('./package.json').version)"` prints `2.17.0`

#### Automated QA
- [x] `bun run cli --version` (or equivalent) prints `2.17.0` after `bun run build`

#### Manual Verification
- [x] Read the README diff; confirm the migration note reads cleanly to a user who has never seen the old behavior
- [ ] Note in the PR description that **bumping argus templates** (`cope/be/argus-template/build-template.py`) is a follow-up downstream task, not in this PR

---

## Deviations encountered during implementation

Captured here so the PR description and any follow-up planning have one source of truth.

### Phase 3 — `scripts/e2e.ts` Section 17

| # | Plan said | Reality | Resolution |
|---|---|---|---|
| 1 | `qa-use test sync pull --all --dir <tmp>` | `pull` has no `--dir` and no `--all` flag — pull pulls all by default; `test_directory` is sourced from `.qa-use.json` | Section 17 plants a per-tmp `.qa-use.json` (api_key/api_url copied from repo config; `test_directory: ./qa-tests`) and spawns the CLI with `cwd: <tmp>`. `bun run cli` had to be expanded to an absolute `bun <repoRoot>/src/cli/index.ts` because `bun run <script>` requires `package.json` in cwd |
| 2 | `qa-use api -X DELETE /api/v1/tests/<uuid>` for cleanup | Public API exposes no DELETE on `/api/v1/tests/{id}` — backend returns `405 Method Not Allowed`, `Allow: GET` | Section 17 cleanup is best-effort: still attempts DELETE for forward-compat (logs a single-line WARN on 405) and namespaces the colliding test name with a per-run nonce (`e2e dup ${ms-base36}-${random4}`) so leaked rows are recognizable in the cloud and can be reaped manually. **Backend follow-up:** add `DELETE /api/v1/tests/{id}` (or admin-namespaced equivalent). Each run leaks 2 rows under that distinctive prefix |
| 3 | Step shape `{ type: "go_to", url: ... }` in the YAML fixture | Schema's SimpleStep uses `{ action: "goto", target: "..." }` (no `type:` enum besides `'simple'`/`'extended'`) | Fixed inline in Section 17's fixture |

### Phase 3 — `--cmd qa-use` success criterion

The `bun run scripts/e2e.ts --cmd qa-use` criterion will fail until `2.17.0` is published and the user re-installs the binary (currently `2.16.0` on PATH). **Will be satisfied post-merge / publish.**

### Plan's Manual E2E section (this file)

The recipe at the bottom of this plan still references `qa-use api -X DELETE /api/v1/tests/<uuid>` for cleanup — same 405 issue as Section 17. If you run the Manual E2E recipe, expect step 7 to log a 405 warning. Reap leaked rows manually until the backend grows a DELETE endpoint.

### CLAUDE.md drift (separate from this plan)

The repo `CLAUDE.md` claims `.qa-use.json` is "pre-configured with `localhost:5005`". The actual file at the time of implementation pointed at `https://api.desplega.ai`. Section 17 ran successfully against the configured backend. **Not in scope** for this PR — flagging so the next person editing `CLAUDE.md` can either update the comment or re-point `.qa-use.json` to localhost.

### Phase 1 — minor cosmetic

Plan criterion says `bun run cli test sync push --help` should list `--id <id-or-name>`. Working draft has `--id <uuid>` as the metavar. Functional BC for unique-name `--id` is preserved (covered by Phase 1 QA + Phase 2 unit tests). The metavar wasn't updated this PR — cosmetic, can be fixed in a follow-up if the team wants the help text to advertise the name-fallback.

---

## Manual E2E

After all phases land, run end-to-end against a real backend (`localhost:5005` from the repo's `.qa-use.json`). Substitute real UUIDs for `<uuid-1>` / `<uuid-2>`.

```bash
# 0. Build + lint hygiene
bun install
bun run check:fix
bun run typecheck
bun test

# 1. Create two cloud tests with the same name (use existing prod data,
#    or create via API).
bun run cli api -X POST /api/v1/tests --input - <<'JSON'
{ "name": "PR-collision-test", "steps": [{ "type": "go_to", "url": "https://example.com" }] }
JSON
# Repeat for a second test row with the same name; record both UUIDs.

# 2. Pull into a clean dir; expect two suffixed files, no clobber.
mkdir /tmp/qa-collision && cd /tmp/qa-collision
qa-use test sync pull --all
ls qa-tests/   # expect: pr-collision-test-<8hex>.yaml × 2

# 3. Plant a legacy file; re-pull; expect "Legacy file:" warning.
cp qa-tests/pr-collision-test-*.yaml qa-tests/pr-collision-test.yaml
qa-use test sync pull --all 2>&1 | grep "Legacy file"

# 4. Push by colliding name → exit 1 with disambiguation.
qa-use test sync push --id "PR-collision-test" --dry-run; echo "exit=$?"
# expect exit=1 and stdout listing both UUIDs

# 5. Push by UUID → unambiguous.
qa-use test sync push --id <uuid-1> --dry-run; echo "exit=$?"
# expect exit=0, references one test

# 6. Push by unique name → BC preserved.
qa-use test sync push --id <some-other-unique-name> --dry-run; echo "exit=$?"
# expect exit=0

# 7. Cleanup
qa-use api -X DELETE /api/v1/tests/<uuid-1>
qa-use api -X DELETE /api/v1/tests/<uuid-2>
rm -rf /tmp/qa-collision
```

If any step diverges from the expected output, do not merge — re-open the relevant phase.
