---
date: 2026-04-21
reviewer: Claude (desplega:verifying, autopilot)
plan: thoughts/taras/plans/2026-04-21-tunnel-docs-polish.md
commits:
  - 6414936 (Phase 1)
  - 36bfaf5 (Phase 2)
  - 47cac34 (Phase 3)
branch: feat/qa-use-tunnel-imrpov
verdict: PASS
---

# Verify: Tunnel Docs Polish + --tunnel Backward-Compat + Version Bump

## Summary

**Verdict: PASS.** All three phases landed cleanly and match the plan's stated intent. No blockers. Automated success criteria all re-verify green: `bun run check:fix` clean, `bun run check:docs` clean, `bun test` = 510 pass / 0 fail / 941 expect() calls, `bun run build` (`tsc`) green. No `v2.15.0` tag exists locally — correct, plan defers tagging to a human step.

## Per-phase findings

### Phase 1 — restore bare `--tunnel` as sugar for `on`

Commit `6414936`. Matches intent.

- `src/cli/lib/tunnel-option.ts:69` — option declared as `new Option('--tunnel [mode]', ...)`. Brackets confirmed.
- Parser maps `undefined`, `true`, `'true'` → `'on'` (line 39). `false` → `'off'` (line 31). Invalid strings rejected with `InvalidArgumentError` (line 51). Case-insensitive via `.toLowerCase()`.
- Belt-and-braces `preAction` hook (lines 83–92) also normalises `true`/`'true'` to `'on'` in case Commander skips the argParser for the bare form across versions. Good defensive touch.
- Tests in `src/cli/lib/tunnel-option.test.ts` cover: `auto`/`on`/`off` explicit, bare `--tunnel` → `on`, `--no-tunnel` → `off`, invalid rejection, empty-string rejection, case-insensitive uppercase, bare form in command-with-positional-arg shape. 10 cases total.
- Live CLI check: `bun run cli browser create --help | grep -- '--tunnel'` shows `--tunnel [mode]` (brackets present).

### Phase 2 — refresh skill / reference / README / landing docs

Commit `36bfaf5`. Matches intent.

- `plugins/qa-use/skills/qa-use/SKILL.md` — 17 matches for `qa-use tunnel|qa-use doctor|--no-tunnel|auto-tunnel` (far exceeds the ≥3 bar). Includes the "Tunnel commands" block at lines 98–102 with `start/ls/status/close`, background-session discussion, `browser create --tunnel [auto|on|off]` table row at line 247, and `test run --tunnel [mode]` row at line 318.
- `plugins/qa-use/skills/qa-use/references/localhost-testing.md` — 11 matches for required keywords (≥2 bar clearly met). Opens with "When your base URL is localhost and your API is remote, qa-use auto-tunnels. No flag required." (line 3). `qa-use tunnel start --hold` at line 89. `qa-use doctor` cleanup at lines 148–149, 206.
- "Press Ctrl+C to stop" — zero matches. Old persistent-session pattern successfully removed.
- `plugins/qa-use/skills/qa-use/references/browser-commands.md:19` — `--tunnel [mode]` corrected, mentions bare `--tunnel` is sugar for `on`.
- `README.md:102-120` — new block distinguishes `qa-use tunnel *` (CLI registry) from `qa-use mcp tunnel` (MCP mode). Commands table rows added for `tunnel ls/status/close` and `doctor`. Explicit note at line 120 calls out the separation.
- `src/cli/generated/docs-content.ts` — `check:docs` passes clean (regeneration produces no diff). Confirms it was regenerated at commit time and matches current skill content.
- `landing/app/content.ts:75,172` and `landing/app/components/getting-started.tsx:160` — updated to "auto-tunnels when base_url is localhost" comments. Old `--tunnel` flag references dropped as the plan suggested.

### Phase 3 — version bump

Commit `47cac34`. Matches intent.

- `package.json` version is `2.15.0` (verified via `jq`).
- No `v2.15.0` tag in local git — correct per plan ("tag creation stays with the human — do not push tags without explicit confirmation").
- No `CHANGELOG.md` update in the commit. Plan allowed skipping if the repo doesn't use one; no CHANGELOG.md exists in the repo root, so this matches the "skip if not present" branch.
- `bun test` green (510 pass / 0 fail). `bun run build` (`tsc`) succeeds without output.

## Scope verification

"What We're NOT Doing" items checked against the diff:

- `QA_USE_DETACH=0` legacy path — not touched. Only referenced in plan prose (Phase 3 justification) as a reason the bump is minor not major.
- MCP global tunnel migration — not touched. README explicitly preserves the `qa-use mcp tunnel` line (README.md:306).
- `tunnel start` grace-window hang — not touched.
- Brainstorm / architecture docs — not touched.
- `CLAUDE.md` — not modified in any of the three commits.
- npm publish — not attempted. Version-only bump, no publish artifacts.

No scope creep detected.

## Issues found

None blocking.

**Informational notes:**

1. The parser's handling of `value === true` is speculative — Commander with `[mode]` optional-arg syntax typically passes `undefined` or the argParser is skipped entirely. The `preAction` hook catches any path that the argParser missed, so behaviour is correct either way. This is belt-and-braces defensive coding, which I view as a plus for a backward-compat restoration.

2. Plan's Manual verification checkboxes remain unchecked — expected, those are human-driven. Automated verification items were all checked during Phase 1/2/3 implementation commits.

## Recommendations

- **Tag when merging**: run `git tag -a v2.15.0 <merge-sha> -m "..."` and `git push origin v2.15.0` after the PR merges to main. Plan explicitly defers this to human confirmation.
- **Consider a CHANGELOG.md** for future releases — landing-site release notes + git log carry the burden today. Low priority.
- **Plan status already `completed`** in frontmatter (set in Phase 3 commit). No further action needed.

## Re-verification commands used

```
git show --stat 6414936 36bfaf5 47cac34
bun run cli browser create --help | grep -- --tunnel
jq -r .version package.json
git tag -l 'v2.15.0'
bun run check:fix
bun run check:docs
bun test
bun run build
grep -rn "option '--tunnel <mode>'" src plugins README.md landing
```

All pass. Plan is ready for merge and tagging.
