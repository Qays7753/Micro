# micromatch-braces-free

A local, braces-free replacement for `micromatch@4.0.8`, wired into the
repository dependency graph through the pnpm override
(`"micromatch": "workspace:micromatch-braces-free@"` in the root
`package.json`), eliminating GHSA-vfj7-8cjw-p6xm (CVE-2026-93687,
CWE-674: `braces@<=3.0.3` stack-exhaustion / unbounded-expansion DoS)
from the development toolchain.

## Why this exists

The only route to `braces` **in the pnpm-resolvable dependency graph** of
this repository is `stylelint@16.26.1 → {fast-glob@3.3.3, globby@11.1.0} →
micromatch@4.0.8 → braces@3.0.3` (verified by `pnpm why`; dev-only). No
patched `braces` release exists (registry live check 2026-10-06: latest
3.0.3, advisory patched_versions `<0.0.0`), the current Stylelint line —
including 17.16.0 — still resolves the same chain, and `pnpm patch`
manifest edits do not change the resolved graph (tested on pnpm 9 and
pnpm 10). Replacing `micromatch` itself is the only edge where the
vulnerable package can be removed without weakening the Stylelint gate.

**Scope boundary (hostile-review disclosure, 2026-10-06)**: this
removal covers the *resolvable graph* — what `pnpm why`, `pnpm audit`,
and the lockfile can see. Separately, the `braces@3.0.3` *implementation
code* is also vendored (bundled/inlined) inside four dev-toolchain
packages on disk — `vite@7.3.6` (its bundled `chokidar@3.6.0`),
`rollup@4.62.4`, `tsx@4.23.12`, and `prettier@3.9.6` — where it is
invisible to pnpm overrides and to `pnpm audit`. Those copies are
pre-existing at the base commit (identical package integrity hashes
before and after this change), are dev-only, and are fed
repository-config/CLI-sourced patterns rather than untrusted input.
Removing them requires toolchain version upgrades (e.g. a
chokidar-4-based watcher line / future vite/rollup/tsx/prettier
releases), which is a separate owner decision tracked outside this
security PR — this shim neither introduces nor can remove those vendored
copies.

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

## Known divergences (second hostile review, 2026-10-06 — disclosed, not fixed)

A fresh independent adversarial review of the final head probed the bounded
engine with a 75-case battery beyond the pinned corpus and found these
divergences from `braces@3.0.3`. All are unreachable from this repository's
globs (dev-controlled config/CLI input only) and all fail toward
*passthrough / no expansion* rather than a wrong match; they are documented
here rather than silently widened, because widening `parseRange` lenience
would re-open exactly the `Number()`-parsing surface the original advisory
attacked:

1. **Exotic numeric endpoints are not expanded** (real `fill-range` accepts
   any `Number()`-parseable endpoint; the shim accepts only `/^-?\d+$/`):
   `{+1..3}` → real `["1","2","3"]`, shim passes through `["{+1..3}"]`;
   `{0x10..0x12}`, `{1e2..1e3}` → same passthrough direction;
   `{ 01..3 }` (space-padded) → real `["1","2","3"]`, shim `["01","02","03"]`.
2. **Literal `]` escaping in intermediate strings**: `{a,b}]` → real
   `["a\\]","b\\]"]`, shim `["a]","b]"]` (keepEscaping difference).
   End-to-end matching through picomatch is identical for the tested cases
   (picomatch treats a bare `]` outside a bracket expression as a literal).
3. **`braceExpand(x, { nobrace: true })`** bypasses the `nobrace`/`hasBraces`
   fast-path that `micromatch.braces` has; no consumer in the graph calls it.

Extending the engine to cover any of these is a deliberate future act:
new fixture cases must be captured from the then-original stack first (the
capture harness refuses to run unless the original stack is installed).

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
