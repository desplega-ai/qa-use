---
date: 2026-04-21T00:00:00Z
author: Taras
topic: "Tunnel docs polish + --tunnel backward-compat + version bump"
tags: [plan, tunnel, cli, docs, release, qa-use]
status: in-progress
last_updated: 2026-04-21
last_updated_by: Claude
parent_plan: thoughts/taras/plans/2026-04-20-tunnel-automation-and-ux.md
parent_qa: thoughts/taras/qa/2026-04-21-tunnel-automation-and-ux.md
---

# Tunnel Docs Polish + Backward-Compat + Release Bump

## Context

The big plan (`2026-04-20-tunnel-automation-and-ux.md`) is merged-ready on `feat/qa-use-tunnel-imrpov`, but a QA pre-merge doc sweep surfaced three gaps that are cheap to fix now:

1. **Backward-compat break on bare `--tunnel`.** The plan turned `--tunnel` into a tri-state option (`auto|on|off`) but didn't preserve the old "boolean presence = on" UX. Running `qa-use browser create --tunnel` now errors with `option '--tunnel <mode>' argument missing`. Every example in the landing site, SKILL.md, localhost-testing.md, and README still uses the old pattern, and any existing user script does too.

2. **Stale skill/agent docs.** `plugins/qa-use/skills/qa-use/SKILL.md` (consumed by `qa-use docs` and by the `qa-use:qa-use` agent) and `plugins/qa-use/skills/qa-use/references/localhost-testing.md` describe the old blocking `--tunnel` loop with no mention of auto-tunnel, `qa-use tunnel *`, `qa-use doctor`, `--no-tunnel`, `browser status --list`, or detached lifecycle.

3. **No version bump for a meaningful feature release.** `package.json` is at `2.14.1`; no tag created for the tunnel work yet. Plan calls for a minor bump + tag as part of the PR close.

## Desired End State

- `qa-use browser create --tunnel` (no value) works and resolves to `mode === 'on'`. Same for `test run` and `browser run`.
- Public-facing docs (SKILL.md, localhost-testing.md, README, landing site) describe the new tunnel model accurately.
- `src/cli/generated/docs-content.ts` regenerated and in-sync.
- `package.json` bumped to `2.15.0` (minor — new feature, no breaking user-facing changes once bare `--tunnel` is restored). Tag `v2.15.0` created on merge commit.

## What We're NOT Doing

- Changing `tunnel start` grace-window hang (already tracked in parent plan's Follow-ups).
- Migrating MCP global tunnel onto registry (parent plan Follow-ups).
- Removing `QA_USE_DETACH=0` legacy path (parent plan Follow-ups).
- Revising the brainstorm / architecture decisions.
- Rewriting CLAUDE.md — already covered by the parent plan's Phase 6.
- Publishing the npm package (release workflow is out of scope here; just the version + tag).

## Implementation

Three phases, all small. Each runs under `bun run check:fix` + `bun test` before commit.

---

### Phase 1: Restore bare `--tunnel` as sugar for `--tunnel on`

**Overview**
Make Commander accept `--tunnel` without a value, defaulting to `'on'`. Preserves the old UX while keeping the tri-state explicit path.

**Changes Required:**

1. **`src/cli/lib/tunnel-option.ts`** — change the option declaration:
   - From `new Option('--tunnel <mode>', '...')` to `new Option('--tunnel [mode]', '...')` (brackets make the arg optional).
   - Update the parse fn: if the raw value is `undefined` OR the literal string `true` (Commander's "flag-present" placeholder when the brackets form is used), return `'on'`.
   - Keep invalid-value rejection for any other non-canonical string.
   - `--no-tunnel` should still resolve to `'off'` (existing behaviour).

2. **Unit tests** — extend `src/cli/lib/tunnel-option.test.ts`:
   - `--tunnel` (no value) → `'on'`
   - `--tunnel on` / `--tunnel off` / `--tunnel auto` still work
   - `--no-tunnel` → `'off'`
   - `--tunnel bogus` still rejected

**Success Criteria:**

Automated:
- [ ] `bun run check:fix` clean
- [ ] `bun test src/cli/lib/tunnel-option.test.ts` — new cases pass
- [ ] `bun test` — full suite green (should stay at 508+)
- [ ] `bun run cli browser create --tunnel 2>&1 | grep -i "argument missing"` returns no match
- [ ] `bun run cli browser create --help 2>&1 | grep -- '--tunnel'` shows `--tunnel [mode]` (brackets)

Manual:
- [ ] `qa-use browser create --tunnel --no-headless` (landing-site example) parses without error (session creation failure against local backend is fine — we only care about the flag parse)
- [ ] `qa-use test run mytest --tunnel` parses without error
- [ ] `qa-use browser create --tunnel on` still works (explicit form unchanged)

Commit: `[docs] restore bare --tunnel as sugar for --tunnel on (backward-compat)`

---

### Phase 2: Refresh skill / reference / README docs

**Overview**
Update the skill content that feeds `qa-use docs` and the `qa-use:qa-use` agent. Regenerate `src/cli/generated/docs-content.ts`. Minimal README bump. Landing site fixes are included because they're trivially in the same commit.

**Changes Required:**

1. **`plugins/qa-use/skills/qa-use/SKILL.md`**
   - Update the "Localhost Testing" / browser-create examples to reflect auto-tunnel (no `--tunnel` flag needed for the common case).
   - Add a short **"Tunnel commands"** section: `qa-use tunnel {start,ls,status,close}` with 1-2 line each.
   - Add **"Background session management"** mention: `qa-use browser create` now returns immediately; `qa-use browser status --list` shows active; `qa-use browser close <id>`; `qa-use doctor` reaps stale.
   - Update the `browser create` command table row (current line ~216) to `--tunnel [auto|on|off]` and drop the "tunnel mode only" qualifier where the detach path makes it irrelevant.
   - Mention `--no-tunnel` as the explicit opt-out.

2. **`plugins/qa-use/skills/qa-use/references/localhost-testing.md`** — rewrite, keep the ASCII diagrams:
   - Lead with: "When your base URL is localhost and your API is remote, qa-use auto-tunnels. No flag required."
   - Swap the "Using `--tunnel` flag" section to describe auto-mode first, with `--tunnel on` as the explicit override and `--no-tunnel` as the opt-out.
   - Drop the "Terminal 1: Start Tunnel / Terminal 2: Run Tests" persistent-session pattern (now handled by detached `browser create` + `browser status`). Replace with the `qa-use tunnel start --hold` pattern for folks who just want a public URL.
   - Add a "Cleaning up stale state" one-paragraph section pointing at `qa-use doctor`.

3. **`plugins/qa-use/skills/qa-use/references/browser-commands.md`** (if it references `browser create --tunnel` in the old form) — same `--tunnel [mode]` correction. Check and update if needed.

4. **`README.md`**
   - Add one line to the commands table: `qa-use tunnel ls` / `qa-use doctor`.
   - Update the `qa-use mcp tunnel` line (line ~283) if the new `qa-use tunnel` family creates confusion — add a note that `mcp tunnel` is the MCP-mode persistent wrapper, distinct from the new CLI `qa-use tunnel *` registry commands. (Grep to confirm the MCP mode still exists; plan kept MCP out of scope.)

5. **`landing/app/content.ts`** and **`landing/app/components/getting-started.tsx`**
   - No changes required strictly (bare `--tunnel` works again after Phase 1), but optionally swap the two remaining `--tunnel` mentions to drop the flag entirely (`qa-use test run login` auto-tunnels when localhost is the base and API is remote).
   - Scope call: if it's a 2-line change do it; otherwise leave for a landing-site PR.

6. **Regenerate bundled docs**: `bun run generate:docs`. Commit the resulting `src/cli/generated/docs-content.ts` changes.

**Success Criteria:**

Automated:
- [ ] `bun run check:fix` clean
- [ ] `bun run check:docs` passes (diff exits 0 after regenerate)
- [ ] `grep -nE "qa-use tunnel|qa-use doctor|--no-tunnel|auto-tunnel" plugins/qa-use/skills/qa-use/SKILL.md` returns ≥3 matches
- [ ] `grep -nE "auto-tunnel|--no-tunnel|qa-use doctor" plugins/qa-use/skills/qa-use/references/localhost-testing.md` returns ≥2 matches
- [ ] Old pattern gone: `grep -n "Press Ctrl+C to stop" plugins/qa-use/skills/qa-use/references/localhost-testing.md` returns no match

Manual:
- [ ] `bun run cli docs` (if the command exists) renders the updated SKILL.md content without errors — spot-check the tunnel section
- [ ] Read localhost-testing.md top-to-bottom — accurate and concise
- [ ] Landing site preview (optional): `cd landing && bun run dev` — getting-started section still reads correctly

Commit: `[docs] refresh skill/reference/README for tunnel automation + background browsers`

---

### Phase 3: Version bump + CHANGELOG

**Overview**
Bump minor version, add changelog entry, tag on merge. No publish — tag-only, release flow handles the rest separately.

**Changes Required:**

1. **`package.json`** — bump `"version": "2.14.1"` → `"2.15.0"`. Minor bump because:
   - New feature surface (`qa-use tunnel`, `qa-use doctor`, detached `browser create`)
   - Tri-state `--tunnel` flag + `~/.qa-use.json` `tunnel` key
   - No breaking user-facing changes (bare `--tunnel` restored in Phase 1).
   - `QA_USE_DETACH=0` fallback preserves the legacy path.

2. **`CHANGELOG.md`** — add a `## 2.15.0 — 2026-04-21` entry (or follow whatever format the repo uses; confirm via `head -20 CHANGELOG.md` first). If no changelog file exists, skip this step and let the git-log-based release notes speak for themselves.

3. **Tag** — on PR merge, tag the merge commit with `v2.15.0`. Tag creation stays with the human — do not push tags without explicit confirmation.

**Success Criteria:**

Automated:
- [ ] `jq -r .version package.json` returns `2.15.0`
- [ ] `bun test` still green
- [ ] `bun run build` succeeds (if build is part of release verification)

Manual:
- [ ] CHANGELOG entry (if applicable) reads correctly and mentions: auto-tunnel decision, tunnel registry refcount, `qa-use tunnel` subcommands, `qa-use doctor`, detached `browser create`, tri-state `--tunnel` flag.
- [ ] Tagging decision confirmed with Taras before `git tag v2.15.0` is run.

Commit: `[release] bump to 2.15.0 — tunnel automation + background browser UX`

## Testing Strategy

- Phase 1: unit tests cover all `--tunnel` parse shapes; full suite regression.
- Phase 2: doc correctness verified via grep assertions + manual read. `check:docs` guards the generated-file drift.
- Phase 3: version string assertion + build smoke.
- **E2E regression**: `bun run scripts/e2e.ts` (local-only, no `E2E_ALLOW_REMOTE_TUNNEL`) after Phase 1 to confirm nothing broke. Full remote run deferred to pre-prod sign-off, unchanged from the parent plan.

## Manual E2E commands

```bash
# Phase 1 — bare --tunnel works again
bun run cli browser create --tunnel                      # parses, fails on backend (expected)
bun run cli browser create --tunnel on                   # still works
bun run cli test run some-test --tunnel                  # parses
bun run cli browser create --no-tunnel                   # still works

# Phase 2 — docs surface
bun run cli docs                                         # spot-check tunnel section
grep -c "qa-use tunnel" plugins/qa-use/skills/qa-use/SKILL.md  # > 0

# Phase 3 — version
bun run cli --version                                    # 2.15.0
jq -r .version package.json                              # 2.15.0
```

## References

- Parent plan: `thoughts/taras/plans/2026-04-20-tunnel-automation-and-ux.md`
- Parent QA: `thoughts/taras/qa/2026-04-21-tunnel-automation-and-ux.md`
- PR: https://github.com/desplega-ai/qa-use/pull/21
- Affected files: `src/cli/lib/tunnel-option.ts`, `plugins/qa-use/skills/qa-use/SKILL.md`, `plugins/qa-use/skills/qa-use/references/localhost-testing.md`, `README.md`, `landing/app/content.ts`, `landing/app/components/getting-started.tsx`, `src/cli/generated/docs-content.ts`, `package.json`, `CHANGELOG.md` (optional)
