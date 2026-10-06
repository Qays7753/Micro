# Braces-elimination parity harness

GHSA-vfj7-8cjw-p6xm (CVE-2026-93687, CWE-674): `braces@<=3.0.3` is vulnerable to
stack-exhaustion / unbounded-expansion denial of service. In this repository the
package is reached only through the development Stylelint graph:

```
stylelint@16.26.1 → micromatch@4.0.8 → braces@3.0.3
stylelint@16.26.1 → fast-glob@3.3.3 → micromatch@4.0.8 → braces@3.0.3
stylelint@16.26.1 → globby@11.1.0 → fast-glob@3.3.3 → micromatch@4.0.8 → braces@3.0.3
```

The remediation replaces `micromatch` (via a pnpm override) with a local,
braces-free shim that provides the exact API surface the installed consumers
use, on the same `picomatch` engine version the original `micromatch@4.0.8`
already resolves (`picomatch@2.3.2`). This harness proves that replacement is
behaviorally invisible to Stylelint and to the repository guards, and that the
elimination is real (no `braces` anywhere in the resolved graph).

## Layout

- `harness-lib.mjs` — single definition of the semantic matrix: brace-expansion
  cases (fast-glob's exact options), micromatch API cases (list form with
  ordered last-match-wins negation, `isMatch` with `dot`/`basename`, `makeRe`
  sources and behavior, `scan().parts`, matcher/all/every/some/not/contains/
  capture), stylelint invocation cases (the exact `design-guards` invocation
  plus a semantic corpus), plus the runner and the output normalizer.
- `corpus/` — semantic corpus: brace patterns, dotfiles and dot-directories,
  Unicode/Arabic paths, a directory with spaces, extension groups
  (`.css`/`.CSS`), `ignoreFiles` (a `dist/` fixture containing violations that
  must be ignored), config-level `overrides`, deliberate rule violations, and
  `overrides-config.json` for the overrides battery.
- `capture-baseline.mjs` — freezes the ORIGINAL stack's behavior into
  `fixtures/*.json`. **Refuses to run unless the original
  `micromatch@4.0.8` + `braces` are installed**, so fixtures can never be
  silently "refreshed" from the shim. Every battery runs twice and must be
  byte-identical before fixtures are written.
- `fixtures/` — the frozen golden outputs (committed; regenerated only from a
  checkout of the original graph).
- `cjs-api-probe.cjs` — exercises Stylelint's CommonJS API entry (the `.cjs`
  twins: `augmentConfig.cjs` / `isPathIgnored.cjs`), i.e. the CJS side of the
  replacement, including glob patterns with braces through `require()`.
- `braces-elimination.parity.test.mjs` — the vitest suite (runs in CI):
  brace-expansion parity, micromatch API parity, stylelint behavioral parity
  (run twice, determinism asserted), CJS parity, a consumer-surface pin, and
  mutation-sensitivity tests.
- `hostile-input-evidence-original-stack.txt` — measured behavior of the
  ORIGINAL `braces@3.0.3` on hostile inputs (calibration for the fail-closed
  requirement; captured before the change).

## What is compared

Exit codes, JSON findings (rule, severity, text, line/column), the exact
linted file set, report ordering, `--print-config` output, error texts for
missing files / malformed patterns / empty matches, stdin behavior, and every
API matrix result including thrown-error types and messages. The only
normalizations are content-free environment differences: the repository root
path, `node_modules/.pnpm` install paths, postcss's random anonymous-input id,
and node PIDs in deprecation warnings.

## Modes

The test detects the installed graph and never assumes it:

- **BASELINE** (original `micromatch@4.0.8` + `braces`): verifies the committed
  fixtures still reproduce (fixture integrity). Elimination and hostile-input
  assertions are inactive — the elimination has not happened yet.
- **SHIM** (replacement active): full parity enforcement PLUS elimination
  invariants (no `braces` in `pnpm-lock.yaml`, the shim serves both real
  consumers, no production-graph leak) PLUS hostile-input enforcement
  (exponential-width expansion refused by an explicit bound, ultra-deep
  nesting refused by the length guard, hostile globs crash Stylelint
  fail-closed instead of hanging or OOM-killing the process, and legitimate
  deep nesting keeps working).

## Mutation sensitivity

The suite proves it fails when it should:

- flipping a single `isMatch` boolean is reported as a mismatch;
- adding one spurious expansion to a brace result is reported as a mismatch;
- a violating stdin payload is detected as a report/exit-code difference from
  the clean fixture (rule coverage is live through the real binary, not
  vacuous).

## Not used by this repository (documented, not covered)

`stylelint --fix` / cache / changed-file modes are not part of any repository
script; the exact production invocation is pinned by the consumer-surface
test. `stylelint-declaration-strict-value` is installed but not referenced by
`.stylelintrc.json` (no `plugins` key); it only contributes the peer-stylelint
edge to the dependency graph, which the same override covers.

## Reproducing the baseline capture

```bash
git checkout <original-graph-commit>   # e.g. the parent of the shim commit
corepack pnpm install --frozen-lockfile --ignore-scripts
node scripts/security/braces-elimination/capture-baseline.mjs
git diff scripts/security/braces-elimination/fixtures/   # must be empty
```
