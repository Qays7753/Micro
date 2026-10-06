# micromatch-braces-free

A local, braces-free replacement for `micromatch@4.0.8`, wired into the
repository dependency graph through the pnpm override
(`"micromatch": "workspace:micromatch-braces-free@"` in the root
`package.json`), eliminating GHSA-vfj7-8cjw-p6xm (CVE-2026-93687,
CWE-674: `braces@<=3.0.3` stack-exhaustion / unbounded-expansion DoS)
from the development toolchain.

## Why this exists

The only route to `braces` in this repository is
`stylelint@16.26.1 → {fast-glob@3.3.3, globby@11.1.0} → micromatch@4.0.8 →
braces@3.0.3` (verified by `pnpm why`; dev-only). No patched `braces`
release exists (registry live check 2026-10-06: latest 3.0.3, advisory
patched_versions `<0.0.0`), the current Stylelint line — including
17.16.0 — still resolves the same chain, and `pnpm patch` manifest edits
do not change the resolved graph (tested on pnpm 9 and pnpm 10).
Replacing `micromatch` itself is the only edge where the vulnerable
package can be removed without weakening the Stylelint gate.

## What it is (and is not)

- **Not a fork of micromatch**: `index.js` is a port of
  `micromatch@4.0.8`'s index.js (MIT, (c) 2014-present Jon Schlinkert) —
  itself a thin layer over picomatch — with `micromatch.braces` /
  `braceExpand` delegating to the local bounded engine instead of the
  vulnerable package. Matching is delegated to `picomatch@2.3.2`
  (pinned exactly): the SAME engine version the original micromatch
  resolves, so every matching API behaves identically.
- **Not a fork of braces**: `lib/braces-free.js` (~340 lines, heavily
  commented) implements only the expand-mode grammar fast-glob uses,
  with two hard security bounds. Every semantic it encodes is pinned by
  the golden fixtures captured from `braces@3.0.3` before the change
  (95 cases; see `scripts/security/braces-elimination/`).

## Supported API (the full micromatch@4.0.8 public surface)

| API | Implementation |
| --- | --- |
| `micromatch(list, patterns, options)` | verbatim port (ordered last-match-wins) |
| `.match` | alias of the list form |
| `.matcher`, `.isMatch`, `.any` | picomatch delegation (as upstream) |
| `.not`, `.contains`, `.matchKeys` | verbatim ports |
| `.some`, `.every`, `.all`, `.capture` | verbatim ports |
| `.makeRe`, `.scan` | pure picomatch pass-through (as upstream) |
| `.braces`, `.braceExpand`, `.hasBraces` | bounded local engine (the remediation) |
| `.parse` | **unsupported — throws** (upstream pre-expands through braces in regex-alternation mode; no package in this repository's graph calls it) |

The installed consumers' exact call sites (`fast-glob` → `braces`,
`scan`, `makeRe`; `stylelint` → list form, `isMatch`) are pinned by the
consumer-surface test in the parity harness; any future dependency that
uses a new micromatch API fails that test and forces a deliberate shim
review.

## Security bounds (the behavioral delta)

1. **No recursion anywhere**: parsing and expansion are iterative with
   explicit worklists — nesting depth cannot exhaust the stack.
2. **`MAX_PATTERN_LENGTH = 10,000`**: mirrors braces' own protective
   limit with the same error type and message shape (`SyntaxError:
   Input length (N), exceeds max characters (10000)`).
3. **`MAX_TOTAL_OUTPUT = 65,536`**: hard ceiling on expanded pattern
   count. The original stack measured a **heap-OOM process kill** on 200
   sequential `{a,b}` groups (2^200 expansions); the shim refuses with a
   descriptive `Error` immediately. Fail-closed: fast-glob → stylelint
   crash loudly with a non-zero exit; nothing is silently dropped or
   matched. Legitimate patterns (repo globs expand to at most ~30) are
   unaffected; depth-50 nesting keeps working.

Both bounds and the measured original-stack behavior are enforced by the
parity harness (`braces-elimination enforcement` tests).

## Reproduction / verification

```bash
corepack pnpm install --frozen-lockfile --ignore-scripts
corepack pnpm vitest run scripts/security/braces-elimination/braces-elimination.parity.test.mjs
corepack pnpm why -r braces        # must print nothing
grep -c 'braces@' pnpm-lock.yaml   # must be 0
```

The parity harness runs in CI as part of `pnpm test`
(`scripts/**/*.test.mjs` is in the vitest include set).

## Maintenance

- Bumping `picomatch` here is a deliberate act: the pin must track what
  the original micromatch line resolves, or the parity fixtures must be
  re-proven against a re-captured baseline.
- If a future Stylelint upgrade calls `micromatch.parse` or the
  regex-alternation braces mode, the consumer-surface test fails: extend
  this shim deliberately in the same PR that upgrades the consumer, with
  new fixtures captured from the then-original stack.
- Removal: revert the override line in the root `package.json` (and the
  `tools/*` workspace entry) — the graph falls back to the registry
  micromatch immediately.
