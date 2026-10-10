# Z AI — Micro R8 Bundle, File-Growth, Guard Charters, and CI Hardening

## Mission

Execute **R8 only** for the Micro successor structural-remediation program `WS-216 / ARCH-007`.

R0–R7 are already completed and verified on `main`. R8 is the next controlled implementation wave. Its purpose is to make the bundle-surface measurements, file-growth ratchet, module-boundary regression protection, guard metadata, fixture policy, and CI execution model truthful and durable.

This is a **guard, measurement, and CI-hardening wave**. It is not a visual redesign, product expansion, financial rewrite, schema migration, export/import rewrite, historical-data rewrite, or general cleanup wave.

The governing principle is **root-cause remediation**, not the smallest patch. Micro has no production users yet, so fix current defects properly now whenever the fix is within the approved R8 scope. Do not use “easy”, “minimal”, “defer”, “preserve”, or “tolerance” as a substitute for a correct long-term solution. At the same time, do not invent a financial, semantic, historical, schema, export/import, rejection, security, deployment, or visual behavior change under the label of guard work.

You must continue through all approved R8 slices until the complete R8 result is either:

1. closed with evidence and the final PR is ready for owner review; or
2. genuinely blocked by one consolidated, exact owner-decision package.

Do not stop after preflight, after one guard, after a recommendation, or after an intermediate green slice.

---

## 1. Live baseline — verify it; do not trust this prompt blindly

Repository:

```text
https://github.com/Qays7753/Micro
```

Target base branch:

```text
main
```

The live baseline verified while preparing this prompt is:

```text
main = 1e2678645d3c41beb448da2a0d8d2b5d817a18fe
```

R7 implementation merge:

```text
PR #342
merge commit = 74908e1334098a51bb516aa3bbdcc898a4bedb1f
base parent = e01d560539476c1c7f712891f2355200d2d74aa6
source parent = db78225d877ecddb9067caaafceb2d85256f73bc
```

R7 post-merge Operations Control reconciliation:

```text
PR #343
merge commit = 1e2678645d3c41beb448da2a0d8d2b5d817a18fe
base parent = 74908e1334098a51bb516aa3bbdcc898a4bedb1f
source parent = 86f8bec923c78bf0825c5ae671a030f3d240b34c
post-merge CI = 38038461385 — success
```

At prompt preparation time:

```text
open PRs = none
R8 = not started
R7 = VERIFIED_ON_MAIN
R8 gate = open
```

You MUST verify the live state before creating or modifying any R8 branch:

```bash
git fetch origin --prune
git status --short --branch
git rev-parse origin/main
gh pr list --repo Qays7753/Micro --state open --limit 50
gh pr view 342 --repo Qays7753/Micro --json state,mergeCommit,headRefOid,baseRefOid,url
gh pr view 343 --repo Qays7753/Micro --json state,mergeCommit,headRefOid,baseRefOid,url
gh run view 38038461385 --repo Qays7753/Micro --json status,conclusion,headSha,url
```

If `origin/main` is not the expected descendant, if any open PR or active work conflicts with this baseline, if the worktree contains unknown work, or if live Operations Control disagrees with the baseline, STOP with:

```text
STATE_DRIFT — R8_NOT_STARTED
```

Report the exact difference. Do not reset, force-reset, reclone over work, overwrite local work, or pretend that the prompt baseline is current.

The prompt baseline is a checkpoint, not a license to skip verification.

---

## 2. Mandatory reading order

Read these files from the verified checkout before creating or modifying code:

1. `AGENTS.md`
2. `README.md`
3. `docs/operations/current-state.md`
4. `docs/operations/micro-thinking-charter-v1.md`
5. `docs/00-document-index.md`
6. `docs/operations/control/README.md`
7. `docs/operations/control/generated/AGENT-BRIEF.md`
8. `docs/operations/control/generated/ACTIVE-WORK.md`
9. `docs/architecture/refactoring/README.md`
10. `docs/architecture/refactoring/REFACTORING-CONTROL.md`
11. `docs/architecture/refactoring/STRUCTURAL-REMEDIATION-PLAN-20261007.md`
12. `docs/architecture/refactoring/ZAI-STRUCTURAL-REMEDIATION-R0-R10-EXECUTION-CONTRACT-20261007.md`
13. `docs/architecture/refactoring/REFACTORING-PLAN-A-TO-Z.md`
14. `docs/architecture/refactoring/OWNERSHIP-AND-TRUTH-REGISTRY.md`
15. `docs/architecture/refactoring/FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md`
16. `docs/architecture/refactoring/TEST-AND-DOCUMENTATION-MAP.md`
17. `docs/contracts/40-technical-ownership-map-contract.md`
18. `docs/contracts/39-atomic-backup-envelope-contract.md`
19. `docs/architecture/SOURCE_OF_TRUTH.md`
20. `docs/operations/control/evidence/structural-remediation-r6-20261009/R6-PREFLIGHT-STRUCTURE-ARCHITECTURE-CODE-ORGANIZATION-SCAN-2026-10-09.md`
21. `docs/operations/control/evidence/structural-remediation-r6-20261009/R6-OWNER-REVIEW-AND-DECISION-PACKAGE-2026-10-09.md`
22. `docs/operations/control/evidence/structural-remediation-r6-20261009/R6-COMPLETE-PR-READINESS-REPORT-2026-10-09.md`
23. `docs/operations/control/evidence/structural-remediation-r7-20261010/R7-COMPLETE-PR-READINESS-REPORT-2026-10-10.md`
24. `docs/operations/control/evidence/structural-remediation-r7-20261010/R7-CLOUDFLARE-PAGES-REPAIR-2026-10-10.md`
25. The R8 section of `STRUCTURAL-REMEDIATION-PLAN-20261007.md`.
26. The R8 section of `ZAI-STRUCTURAL-REMEDIATION-R0-R10-EXECUTION-CONTRACT-20261007.md`.
27. The complete current `§4.3.1` guard-metadata table in `REFACTORING-PLAN-A-TO-Z.md`.
28. The current R6 finding matrix in `FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md`, especially `R6-SCAN-F-005`, `R6-SCAN-F-006`, `R6-SCAN-F-019`, `R6-SCAN-F-020`, and the R8 enforcement package.
29. The active guard implementations and tests listed in Section 6 below.
30. `package.json`, `apps/prototype-web/package.json`, and `.github/workflows/ci.yml`.

Do not treat old completed programs `WS-212`, `WS-214`, or `WS-215` as open work. Do not reopen R0–R7. Do not create a second structural-remediation program.

The mandatory post-Group-6 read-only Structure/Architecture/Code Organization Scan and owner decision have already been completed and accepted before R6/R7. R8 is not permission to bypass that gate or to begin a new unapproved structural-refactoring program.

---

## 3. Credentials and write boundary

Use only secure credential fields supplied by the owner. Never paste, echo, store, quote, or report a real token, cookie, password, private URL, or authorization header.

Use names only:

```text
GITHUB_ACCESS_TOKEN=<SECURE_SECRET_FIELD_ONLY>
CLOUDFLARE_API_TOKEN=<SECURE_SECRET_FIELD_ONLY_IF_ALREADY_AVAILABLE_AND_NEEDED>
```

The GitHub access token is available through the secure credential field. Use that secure field when you need to push the R8 branch, create or update the R8 PR, and upload committed R8 reports/evidence to this repository. Do not ask the owner to paste a token into chat and do not wait for a token in the visible conversation.

If the secure credential field is unavailable, invalid, expired, or lacks the required repository permission, report the exact permission failure and stop. Never request, print, save, or expose the token.

The authorized write boundary is:

```text
BRANCH_AND_PR_ONLY
```

You may:

- create a dedicated R8 branch from the verified live `origin/main`;
- create commits;
- push the branch;
- create or update the R8 PR;
- upload the committed R8 reports and evidence to the same repository through the secure credential field;
- update canonical Operations Control JSON and regenerate its derived views;
- update the canonical guard metadata and structural records where R8 actually changes them;
- run focused local checks and allow normal PR CI and Cloudflare checks to run.

You MUST NOT:

- write directly to `main`;
- merge any PR;
- delete branches, PRs, fixtures, historical evidence, generated evidence, or compatibility records;
- force-push;
- change branch protection, repository settings, deployment settings, secrets, billing, or permissions;
- create or deploy a Cloudflare deployment;
- raise the `650,000 raw` or `155,300 gzip` entry ceilings;
- weaken a guard or change a baseline merely to make a failing check pass;
- perform unrelated cleanup;
- touch the preserved UI branch `docs/ux-ui-zed-handoff-20260921`.

The owner will review the exact Merge Manifest and merge the final R8 PR separately.

---

## 4. Non-negotiable invariants

The following MUST remain unchanged unless a separate versioned manifest and explicit owner decision is obtained. Do not hide any such change inside R8:

- `localSchemaVersion=38`.
- `localExportVersion=30`.
- IndexedDB/Memory parity, transaction behavior, CAS, idempotency, `storage_stale`, migration behavior, backup-before-replace, error identity, and recovery behavior.
- Financial meaning, formulas, rounding, classifications, accounting terms, snapshots, persisted money text, historical interpretation, rejection behavior, and acceptance of legacy data.
- `collection != profit`, `debt != cash`, `purchase != COGS`, `owner money != sale/expense`, and `missing != zero`.
- No silent restatement, deletion, recalculation of historical values, or current-value substitution for historical snapshots.
- No visual UI change: no CSS, tokens, DOM/layout, spacing, colors, typography, copy, navigation, route behavior, UX behavior, or visual design change.
- No new Auth, Sync, Cloud, SaaS, backend, API, roles, permissions, billing, or product capability.
- The entry ceilings remain exactly `650,000 raw` and `155,300 gzip`.
- The UI branch `docs/ux-ui-zed-handoff-20260921` remains untouched.
- No generic `features/`, `common/`, `shared/`, or `utils/` dumping-ground module.
- No file-per-function decomposition, mass barrels, blind mass moves, or blind mass import rewrites.
- No new dependency unless it is strictly necessary, already approved by repository policy, and separately documented with its exact impact. Prefer the existing toolchain.

If any implementation may alter one of these invariants, STOP the affected slice and produce one consolidated `OWNER_DECISION_REQUIRED` package containing:

- exact files and lines;
- current behavior;
- proposed behavior;
- why R8 cannot safely proceed without it;
- alternatives;
- schema/export/financial/historical/UI/security impact;
- tests;
- versioned-manifest requirement, if any;
- rollback boundary.

Do not silently route such a change to `DEFER`.

---

## 5. R8 problem statement and required root fixes

R8 must close the following approved findings and control gaps. These are not optional suggestions:

### R8-F-020 — Bundle-surface classifier is filename-based

The current `apps/prototype-web/scripts/check-bundle-surfaces.mjs` classifies lazy JavaScript by excluding files whose names start with `index-`. This is a heuristic. It can misclassify an entry, dynamic entry, shared chunk, or future output whose filename does not follow today’s naming convention.

The repository already enables Vite `build.manifest` and the existing entry-budget guard reads `dist/public/.vite/manifest.json` using `isEntry`. R8 must make the bundle-surface guard use truthful build metadata and dependency relationships, not filename prefixes.

### R8-F-005 / R8-F-006 — File-size ratchet protects only band crossings

The current `scripts/check-file-size-ratchet.mjs` protects against crossing `NORMAL`, `WATCH`, `SPLIT_CANDIDATE`, and `SPLIT_NOW`, but it does not protect the exact file size inside a band. A file can grow materially while remaining in the same band and pass silently.

R8 must add a durable, reviewable policy that detects unjustified within-band growth while preserving legitimate documented historical measurements. Do not hide growth by silently rewriting the baseline in the same change.

### R8-F-019 — Finance cycle was removed in R7 but lacks a direct regression class

R7 removed the mixed `FinancePeriodResultSection.tsx ↔ pages/Finance.tsx` dependency at its root by moving `FinanceState` ownership into the approved application boundary. R8 must add a durable regression guard for the forbidden direction/class of dependency so the cycle cannot return through a value import, type import, dynamic import, relative path, or equivalent resolved edge.

A test that merely observes today’s graph is not enough. The guard must have a synthetic negative case that recreates the forbidden dependency and fails, plus a positive case for the legal direction.

### R8-F-021 — Guard metadata and scope must remain truthful

The canonical guard metadata in `REFACTORING-PLAN-A-TO-Z.md §4.3.1` must accurately state what each relevant guard proves, what it does not prove, its source of truth, its baseline policy, and how changes are classified.

Do not create a second guard-metadata table. Reconcile the existing canonical table and its live count from the actual repository. Build-only guards such as bundle guards must not be silently omitted merely because they are not in `pnpm guards`; their execution surface and metadata must be explicit.

### R7-CF-REPAIR — The `+512` bundle-surface bridge is interim

R7 repaired a Cloudflare Pages failure by adding documented `+512` cross-environment headroom to each bundle-surface baseline. The repair was explicitly recorded as an interim bridge, not the terminal R8 design. R8 must replace the blunt tolerance with a truthful environment-aware anchoring/measurement strategy.

Do **not** simply replace `512` with another arbitrary cushion. Do **not** raise the entry ceilings. Do **not** treat toolchain variance as permission for product-code growth.

The R7 evidence also recorded a `+167` run-to-run gzip swing on near-identical code with changed content-hash filenames while raw totals stayed constant. R8 must account for this observed variance with a reproducible, bounded, evidence-based method rather than pretending gzip measurements are identical across every environment and run.

---

## 6. Files in the primary R8 scope

You MUST inspect and address the following files or prove, with an exact reason recorded in the R8 matrix, why a file is unchanged:

### Bundle and build surfaces

- `apps/prototype-web/scripts/check-bundle-budget.mjs`
- `apps/prototype-web/scripts/check-bundle-budget.test.mjs`
- `apps/prototype-web/scripts/check-bundle-surfaces.mjs`
- `apps/prototype-web/scripts/check-bundle-surfaces.test.mjs`
- `apps/prototype-web/scripts/bundle-surfaces-baseline.json`
- `apps/prototype-web/vite.config.ts`
- `apps/prototype-web/package.json`
- `package.json`

### File-growth ratchet

- `scripts/check-file-size-ratchet.mjs`
- `scripts/check-file-size-ratchet.test.mjs`
- `scripts/file-size-ratchet-baseline.json`
- `docs/architecture/refactoring/FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md`

### Module boundaries and cycle regression

- `scripts/check-module-boundaries.mjs`
- `scripts/check-module-boundaries.test.mjs`
- `scripts/check-runtime-cycles.mjs`
- `scripts/check-runtime-cycles.test.mjs`
- `scripts/check-type-cycles.mjs`
- `scripts/check-type-cycles.test.mjs`
- the live Finance boundary files involved in the R7 repair, especially:
  - `apps/prototype-web/client/src/pages/Finance.tsx`
  - `apps/prototype-web/client/src/components/finance/FinancePeriodResultSection.tsx`
  - `apps/prototype-web/client/src/application/finance/financeState.ts`

### Guard metadata, CI, and records

- `docs/architecture/refactoring/REFACTORING-PLAN-A-TO-Z.md`
- `docs/architecture/refactoring/REFACTORING-CONTROL.md`
- `docs/architecture/refactoring/OWNERSHIP-AND-TRUTH-REGISTRY.md`
- `docs/architecture/refactoring/TEST-AND-DOCUMENTATION-MAP.md`
- `.github/workflows/ci.yml`
- `AGENTS.md` only if a live R8 rule or command must be corrected there; do not rewrite historical instructions casually.
- `docs/operations/control/workstreams/WS-216.json`
- `docs/operations/control/items/ARCH-007.json`
- `docs/operations/current-state.md`
- `docs/operations/current-state-log.md`
- `docs/architecture/refactoring/AGENT-SEQUENTIAL-WORKLOG.md`
- the generated Operations Control views, only by regeneration from JSON.

Do not edit unrelated application features, domain policies, storage adapters, data migrations, Transfer semantics, or visual UI.

---

## 7. Five read-only quality reviewers

At R8-0 and before each implementation slice, run five read-only reviewers or equivalent roles. They must not mutate the branch, create competing reports, or make code changes.

1. **Bundle and measurement reviewer** — manifest semantics, entry/dynamic-entry graph, shared-chunk accounting, PWA precache, gzip/raw reproducibility, environment identity, baseline policy, and blind spots.
2. **Guard and boundary reviewer** — file-growth semantics, AST/resolution-based module boundaries, cycle regression, negative tests, fixtures, and false-positive behavior.
3. **CI and operations reviewer** — package scripts, `.github/workflows/ci.yml`, Cloudflare build compatibility, duplicate execution, generated artifacts, environment labels, and retry policy.
4. **Architecture and invariants reviewer** — sources of truth, R8 scope, financial/schema/export/history/UI invariants, protected R7 outcomes, and whether the proposed changes are truly guard-only.
5. **Hostile reviewer** — challenge every baseline update, tolerance, exception, allowlist, metadata claim, and “preserve” statement; look specifically for a guard weakened to make the branch green.

The primary executor must reconcile all reviewer comments into one R8 worklog. A reviewer recommendation is not an executed fix until the diff and evidence prove it.

---

## 8. R8 execution phases

Use one writer at a time. Use a dedicated branch created from the verified `origin/main`, for example:

```text
refactoring/r8-bundle-file-growth-guards-20261010
```

Use coherent commits for each phase. Use separate stacked PRs only if the diff is materially easier to review; do not create trivial PR fragmentation. In either case, every phase must be independently testable and revertible, and the final result must be PR-ready for owner review.

### R8-0 — Preflight, repair cards, and baseline capture — no production writes

Before implementation:

1. verify live `main`, open PRs, branch state, worktree state, and Operations Control;
2. record exact versions of Node, pnpm, Vite, Rollup, zlib, and the CI Node runtime where available;
3. read the R7 Cloudflare repair evidence and capture the exact interim `+512` baseline rationale and observed `+167` gzip swing;
4. create or update one Repair Card for each R8 finding;
5. create a complete consumer/execution inventory for every changed guard, baseline, package script, CI step, and generated record;
6. capture current bundle measurements from the live build output and from `.vite/manifest.json`;
7. capture current file-size metrics for every production/script file covered by the ratchet;
8. capture the current boundary graph and verify the R7 Finance cycle is absent;
9. have all five reviewers inspect the cards and proposed implementation order;
10. update the canonical Operations Control JSON to claim R8 only before code changes, then regenerate views and validate.

Do not modify implementation code in R8-0.

R8-0 exit criteria:

- all five reviewer outputs are reconciled;
- every R8 finding has a stable ID and a complete Repair Card;
- every changed guard has a consumer/execution inventory;
- current baselines and exact environment facts are recorded;
- no unknown worktree or branch drift exists;
- no current R8 finding is hidden in generic `DEFER`.

### R8-1 — Bundle-surface semantics and environment-aware anchoring

Implement the root fix for `R8-F-020` and the interim `+512` bridge.

#### Required semantic behavior

1. Read the existing Vite/Rollup manifest from the build output. Use `isEntry`, `isDynamicEntry`, `imports`, `dynamicImports`, and the actual emitted file paths as the semantic source where those fields are available.
2. Do not classify lazy chunks by `index-` filename prefix, by “all non-index files”, by hash naming, or by today’s chunk names.
3. Define and document the exact surfaces:
   - the initial entry surface;
   - the lazy/dynamic JavaScript surface;
   - the PWA precache surface;
   - the counts that are reported but not guarded, if any.
4. For lazy JavaScript, use a deterministic graph/closure method that:
   - starts from manifest dynamic entries or the equivalent manifest-declared dynamic roots;
   - follows declared static and dynamic relationships as appropriate;
   - counts each emitted file at most once;
   - distinguishes files already required by the initial entry from files loaded only through lazy paths;
   - does not double-count shared chunks;
   - fails closed when the manifest is malformed, ambiguous, incomplete, or inconsistent with emitted files.
5. Preserve the entry-budget guard’s truthful single-entry behavior. Do not create a second source of truth for entry selection or the raw/gzip ceiling.
6. For PWA precache, resolve every Workbox URL safely within the dist root, reject path escapes and missing files, define duplicate URL behavior, and report the exact count and byte semantics.
7. Keep the `650,000 raw / 155,300 gzip` entry ceilings exactly unchanged.

#### Required environment-aware anchoring

Replace the blunt single baseline plus arbitrary `+512` bridge with a durable method that distinguishes real code growth from known build-environment and run-to-run measurement variance.

The chosen design MUST:

- identify the build environment explicitly and reproducibly, at minimum distinguishing local, GitHub Actions CI, and Cloudflare Pages when the provider exposes a reliable identity;
- fail closed or produce an explicit `UNVERIFIED_ENVIRONMENT`/blocker when the environment cannot be identified safely; do not silently apply the most generous baseline;
- preserve comparable measurements and a clear baseline schema/version;
- record the exact Node/Vite/Rollup/zlib/toolchain facts used to establish each environment record;
- account for the observed hash-name-related gzip variance without turning variance into code-growth permission;
- use bounded, evidence-based variance derived from actual repeated measurements or a deterministic normalization strategy;
- keep real raw/gzip growth beyond the approved environment-specific bound failing;
- retain an auditable provenance note for every baseline or variance change;
- reject a stale, malformed, duplicated, or environment-mismatched baseline;
- keep the entry ceiling independent from the lazy/precache surface baseline;
- avoid deployment-setting changes and avoid modifying Cloudflare configuration merely to make the guard pass.

Do not simply add another fixed cushion. Do not silently update the baseline because a build is red. If the provider does not expose a reliable environment identity or if the proposed measurement cannot distinguish code growth from variance, stop with one exact blocker package rather than weakening the guard.

#### Required bundle tests

Extend or replace `check-bundle-surfaces.test.mjs` with deterministic tests that cover at minimum:

- a manifest entry whose filename does not start with `index-` and is still classified correctly;
- a non-entry chunk whose filename starts with `index-` and is not incorrectly treated as the entry;
- static entry imports versus dynamic-entry closure;
- shared chunks counted once and assigned according to the documented surface rule;
- dynamic imports and nested dynamic imports;
- zero, one, and ambiguous entry records;
- missing or invalid manifest;
- manifest file missing from output;
- manifest path escape or output path escape;
- missing emitted file referenced by the manifest;
- missing service worker;
- malformed precache content;
- missing precache file;
- duplicate precache URLs with the documented behavior;
- raw and gzip measurement semantics;
- environment mismatch and unknown environment behavior;
- variance/normalization behavior;
- silent growth failure;
- parity and documented reduction behavior;
- current live baseline schema validation.

Keep the tests deterministic, offline, and independent of the network. Do not use a filename heuristic merely inside a test fixture while claiming the implementation is manifest-based.

#### R8-1 exit criteria

- `R8-F-020` is closed with direct code and negative-test evidence;
- the `+512` interim bridge is replaced or its exact remaining status is proven in a consolidated owner blocker;
- no entry ceiling changed;
- no real bundle growth is hidden;
- local and CI/Pages environment semantics are explicit;
- bundle-surface output is reproducible and reports the environment and measurement mode;
- focused bundle tests pass;
- the exact diff is reviewed for no product-code or visual change;
- commit and phase evidence are recorded.

### R8-2 — Within-band file-growth ratchet

Implement the root fix for `R8-F-005/R8-F-006` in `scripts/check-file-size-ratchet.mjs` and its tests.

The current baseline stores bands, but the current defect is that a file can grow inside a band without detection. Design and implement a durable policy that makes unjustified within-band growth visible and failing.

The implementation MUST:

1. preserve the existing band definitions exactly:
   - `NORMAL <400`;
   - `WATCH 400–799`;
   - `SPLIT_CANDIDATE 800–1199`;
   - `SPLIT_NOW >=1200`.
2. preserve the existing production/script scope and the documented exclusions;
3. measure the exact metric used by the policy consistently with the register (`nbLOC` unless a stronger, explicitly documented metric is proven necessary);
4. store enough baseline data to detect within-band growth, not only band identity;
5. reject any new unjustified growth within the same band with a precise file, old metric, new metric, band, and reason;
6. continue rejecting upward band crossings and new files entering `WATCH` or above;
7. allow shrinkage;
8. preserve the documented deleted-file behavior, with any stale baseline cleanup handled explicitly and safely;
9. never permit a same-PR baseline edit to conceal newly introduced growth;
10. provide an explicit, auditable path for a genuinely intentional historical/documented baseline re-anchor, with owner, reason, evidence, and review trigger;
11. not turn a `PRESERVE_BY_DESIGN` card into an unrestricted growth exemption;
12. not require a generic “trust the author” comment as an exemption mechanism;
13. fail closed on malformed baseline schema, duplicate paths, invalid bands, invalid metrics, or unknown baseline version;
14. keep baseline updates separate from the code-growth claim they are meant to measure, unless the exact protocol proves that no same-PR concealment is possible and records the proof.

Because R6 recorded legitimate historical growth in files such as `transferFamilyValidators.ts`, `transferSnapshotValidation.ts`, `src/domain/craft-order/policies.ts`, `src/domain/owner-entitlement/policies.ts`, and other files, do not retroactively call that documented historical growth a new R8 defect. Re-anchor the baseline only with the exact historical evidence and a dated Operations Control record, not by silently copying current measurements.

Do not split or move those files in R8 merely to satisfy the new guard. Structural splitting belongs to the already-governed R6/R7/R10 scope and must not be smuggled into a guard PR.

#### Required file-size tests

Extend or replace `check-file-size-ratchet.test.mjs` with deterministic tests that cover at minimum:

- exact band thresholds `399/400/799/800/1199/1200`;
- unchanged metric within a band passes;
- shrinkage passes;
- within-band increase fails with old/new values;
- upward band crossing fails;
- new `NORMAL` file passes;
- new file entering `WATCH+` fails;
- deleted file behavior remains explicit;
- tests, fixtures, generated files, configuration, and other excluded categories remain outside the production/script ratchet according to the canonical scope;
- malformed baseline fails closed;
- duplicate path fails closed;
- invalid band or invalid metric fails closed;
- a baseline edit cannot silently make a same-PR growth pass;
- an explicitly documented, separately authorized historical re-anchor is distinguishable from a silent update;
- the live baseline has the expected schema, path uniqueness, and valid measurements.

Update `FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md` only for actual measured changes or protocol changes. Preserve historical rows and add dated corrections instead of rewriting them.

#### R8-2 exit criteria

- the ratchet rejects unjustified within-band growth;
- current documented historical growth is represented accurately, not falsely reopened;
- no baseline update can hide same-PR code growth;
- focused file-size tests pass;
- the register, baseline provenance, and guard metadata agree;
- `R8-F-005/R8-F-006` are closed with evidence.

### R8-3 — Module-boundary regression class and guard metadata

Implement the root fix for `R8-F-019` and reconcile `R8-F-021`.

#### Boundary regression guard

Use the repository’s existing AST/resolution approach. Do not use a brittle text-only search.

Add a clear, canonical rule for the forbidden dependency class that caused the Finance cycle:

- UI component modules must not import page modules in the forbidden direction;
- the rule must cover value imports, type imports, dynamic imports, re-exports where applicable, relative paths, aliases, and resolved file paths;
- the legal page-to-component direction must remain allowed;
- the guard must fail on a newly introduced forbidden edge even if it is type-only or dynamic;
- any existing allowed exception must be explicit and owner-reviewed, not an unbounded baseline.

Determine whether this rule belongs in `check-module-boundaries.mjs`, a focused companion guard, or a carefully justified extension of an existing cycle guard. Do not create overlapping guards with contradictory sources of truth. The final architecture must have one canonical owner for this rule.

Add deterministic negative and positive tests:

- component → page value import fails;
- component → page type import fails;
- component → page dynamic import fails;
- component → page relative import fails after resolution;
- page → component import passes;
- the exact former Finance dependency pattern is rejected;
- unrelated legal UI imports remain unaffected;
- the live repository has zero current violations.

Do not “solve” the regression by adding the forbidden edge to a baseline.

#### Guard metadata

Update the canonical `REFACTORING-PLAN-A-TO-Z.md §4.3.1` table and any directly dependent live documentation so that every relevant guard states:

- what it proves;
- what it does not prove;
- its source of truth;
- its execution command and CI/build surface;
- its baseline/allowlist policy;
- its fixture scope and false-positive boundary;
- its owner and review trigger;
- its change classification.

Reconcile the actual live guard count. Do not preserve a stale “17 guards” statement if R8 intentionally adds or explicitly documents build-only guards. Do not duplicate the metadata table in another file. Historical statements remain historical; correct live pointers with dated notes.

At minimum, reconcile metadata for:

- `check-bundle-budget`;
- `check-bundle-surfaces`;
- `check-file-size-ratchet` after its within-band change;
- `check-module-boundaries` after its new rule;
- the existing guards whose execution or fixture scope is affected by R8.

#### R8-3 exit criteria

- the former Finance cycle has a durable regression guard and direct negative tests;
- no current violation exists;
- guard metadata is canonical, complete, and consistent with actual commands;
- no duplicate source of truth or contradictory baseline exists;
- `R8-F-019` and `R8-F-021` are closed with evidence.

### R8-4 — CI, fixture scope, and final R8 reconciliation

Review `.github/workflows/ci.yml`, package scripts, and the build path end-to-end.

The CI/build model MUST:

- run every required R8 guard on the exact code being reviewed;
- run bundle budget and bundle surfaces through the canonical build path;
- expose environment/toolchain identity in the measurement output;
- avoid duplicate lint/test/guard work without deleting coverage;
- preserve the bounded dependency-audit retry policy;
- preserve full-history checkout where required for merge-base checks;
- preserve concurrency and timeout protections;
- avoid rerunning a green workflow for repetition alone;
- not require a manual provider setting change or a deployment write;
- fail closed when a required measurement or manifest is missing.

Unify fixture behavior according to the existing canonical rule:

- only the exact documented self-fixture paths may be excluded;
- no broad `fixtures` directory exemption;
- positive and negative tests prove the boundary;
- generated outputs, `dist`, `node_modules`, and coverage are handled by their existing documented tool scope, not ad hoc exceptions.

Run the relevant local checks after each implementation slice, then the full required chain after the final slice. Use the exact command names below and record exit codes and environments.

Update the canonical Operations Control JSON first, then regenerate derived views. Never hand-edit generated Markdown, CSV, or XLSX metadata.

Append, do not rewrite, the following records:

- the R8 execution report in the canonical R8 evidence directory;
- `docs/operations/current-state-log.md`;
- `docs/architecture/refactoring/AGENT-SEQUENTIAL-WORKLOG.md`;
- any dated corrections to `REFACTORING-CONTROL.md`, the register, ownership registry, or test map.

#### R8-4 exit criteria

- CI executes the guards exactly once where appropriate and retains coverage;
- local and PR-head measurements are separated by SHA and environment;
- Operations Control JSON, generated views, register, ownership, test map, and report agree;
- all R8 findings have a final disposition;
- final PR is ready for owner review;
- no R8 merge is performed by Z AI.

---

## 9. Required Repair Card and execution-inventory contract

Before changing each guard, baseline, CI step, or metadata row, create or update a card containing exactly:

```text
ID
Category
Classification: FIX_NOW | PRESERVE | DEFER | OUT_OF_SCOPE
Evidence
Affected files/modules
Current responsibility and execution surface
Canonical source of truth
Complete consumer/execution inventory
Input/output and environment inventory
Root cause
User/data/financial/security/UI impact
Dependencies
Allowed files
Forbidden files
Minimum safe remediation
Short-term safety measure
Tests and commands
Acceptance criteria
Rollback boundary
Final state
```

The inventory must include, where applicable:

- all direct imports and re-exports;
- all scripts and package commands invoking the guard;
- all CI workflow references;
- build hooks and provider/build-environment entry points;
- baseline and manifest files;
- test and fixture references;
- generated documentation references;
- environment variables and their provenance;
- all exception/allowlist entries;
- all `isEntry`, `isDynamicEntry`, `imports`, `dynamicImports`, and precache relationships used by bundle measurement;
- all live file paths and exact current metrics for file-size measurement;
- all value/type/dynamic boundary edges for the Finance regression rule.

Every new finding discovered during R8 receives a stable unused ID immediately. Determine the next ID from the live tracker; never guess or reuse an ID. Classify it as `FIX_NOW`, `PRESERVE`, `DEFER`, or `OUT_OF_SCOPE`, and finish it as one of:

```text
CLOSED_WITH_EVIDENCE
PRESERVED_WITH_OWNER_ACCEPTED_LONG_TERM_EXCEPTION
SEPARATE_TRACK_OPENED_WITH_EXACT_TRIGGER
OUT_OF_SCOPE_BY_PROJECT_RULE
BLOCKED_WITH_ONE_CONSOLIDATED_DECISION_PACKAGE
```

A generic `DEFER`, `WATCH`, or `FUTURE_WAVE` is not closure for a current defect.

---

## 10. Required verification commands

Run focused tests first for each slice. Then run the full required checks after the final slice.

At every implementation slice, run the relevant focused tests plus, at minimum, the applicable commands below:

```bash
pnpm operations-control:test
pnpm operations-control:check
pnpm typecheck
pnpm lint
pnpm format:check
pnpm text-density
pnpm design-guards
pnpm guards
pnpm test
pnpm prototype:check
pnpm prototype:test
pnpm prototype:build
```

The canonical aggregate is:

```bash
pnpm check
```

Bundle checks must remain directly verifiable:

```bash
node apps/prototype-web/scripts/check-bundle-budget.mjs apps/prototype-web/dist/public
node apps/prototype-web/scripts/check-bundle-surfaces.mjs apps/prototype-web/dist/public
```

Use the actual live repository path and invocation if the script exposes a more specific canonical command. Record the exact command used.

Focused commands should include the live equivalent of:

```bash
pnpm --filter @micro/prototype-web exec vitest run scripts/check-bundle-budget.test.mjs scripts/check-bundle-surfaces.test.mjs
pnpm exec vitest run scripts/check-file-size-ratchet.test.mjs
pnpm exec vitest run scripts/check-module-boundaries.test.mjs scripts/check-runtime-cycles.test.mjs scripts/check-type-cycles.test.mjs
node scripts/check-file-size-ratchet.mjs
node scripts/check-module-boundaries.mjs
node scripts/check-runtime-cycles.mjs
node scripts/check-type-cycles.mjs
node scripts/check-doc-index-coverage.mjs
node scripts/check-current-state-size.mjs
```

If a command path differs in the live repository, use the verified live command and record the difference; do not claim an unrun command passed.

Every new commit/PR must pass the repository’s normal CI and Cloudflare checks before being called PR-ready. Do not rerun an already-green workflow on the same SHA merely for repetition. A new commit requires the normal checks for that new SHA.

Separate evidence into:

- local focused checks;
- local full checks;
- exact PR-head CI checks;
- exact PR-head Cloudflare checks;
- post-merge checks, which are not executed or claimed in this prompt because merge is owner-only.

---

## 11. Operations Control and documentation protocol

Operations Control JSON is the source of truth.

Before modifying generated views:

1. update `docs/operations/control/workstreams/WS-216.json` and/or `docs/operations/control/items/ARCH-007.json` first;
2. run:

```bash
python3 scripts/operations-control/generate_tracker.py
python3 scripts/operations-control/generate_tracker.py --refresh-excel-meta
python3 scripts/operations-control/generate_tracker.py --check
python3 scripts/operations-control/validate.py
```

3. never hand-edit generated Markdown, CSV, or XLSX metadata;
4. keep all previous evidence entries and ordering;
5. append new evidence only;
6. preserve historical entries even when their status is no longer live;
7. update only live fields in `current-state.md`;
8. append the dated R8 record to `current-state-log.md`;
9. append the R8 executor entry to `AGENT-SEQUENTIAL-WORKLOG.md`;
10. update the register, ownership map, and test/documentation map only where R8 actually changes the guard, execution surface, or ownership;
11. do not create a second tracker or a duplicate R6/R7 finding matrix;
12. run `node scripts/check-doc-index-coverage.mjs` and every relevant current-state/Operations Control size guard.

When a generated file changes, prove that the change derives from the JSON source. Do not use generated views as the source of truth.

Any historical correction must be dated and directional (`old → new`). Do not rewrite or delete old reports, old SHAs, old entries, or old findings.

---

## 12. Stop conditions

STOP the affected slice and report one consolidated blocker/decision package if:

- the verified base/main/branch/PR state changes unexpectedly;
- unknown local work could be overwritten;
- a semantic, financial, historical, schema, export/import, rejection, or security behavior may change;
- IndexedDB/Memory parity or data/recovery behavior may change;
- a manifest or build environment cannot be identified reliably;
- the proposed bundle variance method cannot distinguish real code growth from measurement variance;
- a baseline or allowlist would be weakened to make a failing check pass;
- canonical ownership or execution inventory is unknown;
- an existing exception would need to become broader or unbounded;
- the diff expands outside the active R8 guard/measurement/CI scope;
- visual UI, navigation, copy, CSS, tokens, or DOM behavior would change;
- a required check or CI fails outside the active R8 repair scope;
- a new dependency, provider setting, deployment, permission, billing, or external-service decision is needed;
- deletion or cleanup is requested;
- a report contradicts the live tree;
- a required historical baseline cannot be re-anchored without deleting evidence.

The blocker package must state:

- the exact decision required;
- affected files and full SHAs;
- evidence and commands;
- alternatives;
- financial/semantic/schema/export/history/UI/security impact;
- exact tests not run or failing;
- rollback boundary;
- safe stopping point;
- which independent approved R8 slices, if any, can continue without bypassing the blocker.

Do not use a broad “owner decision needed” statement. Do not stop routine implementation merely to ask a question that the contract already answers.

---

## 13. PR policy

Create a PR or a clearly stacked set of PRs only after the relevant R8 slice is complete and independently verified.

Each PR description MUST include:

- repository, workstream, and item;
- wave/slice ID;
- base branch and full base SHA;
- source branch and full source SHA;
- exact files changed;
- Repair Card IDs;
- complete execution/consumer inventory location;
- root cause and canonical source of truth;
- tests and exit codes;
- local environment/toolchain identity;
- exact CI URL for the final PR head;
- exact Cloudflare check URL for the final PR head;
- bundle-surface semantics and baseline/variance changes, if any;
- file-size baseline/schema changes, if any;
- guard metadata changes, if any;
- financial/semantic impact: explicitly `none` unless a protected decision package says otherwise;
- schema/export/import/history/rejection impact: explicitly `none` unless protected and approved;
- visual UI impact: explicitly `none`;
- rollback boundary;
- remaining R8 items and their status;
- exact Merge Manifest fields;
- explicit statement that Z AI did not merge and did not perform cleanup.

Do not merge. Do not claim `VERIFIED_ON_MAIN` for R8. The final state of this prompt is `PR_READY`, not merged.

---

## 14. Final report contract

Write the canonical report at:

```text
docs/operations/control/evidence/structural-remediation-r8-20261010/R8-COMPLETE-PR-READINESS-REPORT-2026-10-10.md
```

If the directory or naming convention differs on the verified live branch, follow the existing R6/R7 evidence convention and document the exact verified path. Do not create a competing evidence root.

The report MUST contain:

1. executive status;
2. exact live baseline and branch/PR lineage;
3. authorization and credential mode, without secrets;
4. R8-0 preflight results;
5. five reviewer outputs and reconciliation;
6. Repair Card matrix for every R8 finding;
7. complete execution/consumer inventory for every changed guard, baseline, CI step, and metadata row;
8. exact bundle-surface definitions and before/after measurements;
9. environment/toolchain identity and variance/normalization evidence;
10. exact file-size metric and baseline schema/policy;
11. exact module-boundary/cycle rule and negative/positive test evidence;
12. guard metadata before/after and canonical-source proof;
13. CI/package-script execution map and duplicate-coverage analysis;
14. fixture-scope proof and false-positive boundaries;
15. every new finding with stable ID, classification, root fix, or exact protected disposition;
16. files changed and files explicitly not changed;
17. all focused and full test commands, exit codes, repetitions, and environments;
18. exact PR-head CI and Cloudflare URLs;
19. schema/export/financial/history/rejection/security/visual-UI impact;
20. risks and rollback per commit/slice/PR;
21. Operations Control JSON and generated-view proof;
22. exact Merge Manifest;
23. remaining work, only as an exact protected package or separately triggered track;
24. owner action required: review and merge, not a hidden approval assumption.

Every material statement must distinguish:

```text
VERIFIED
INFERRED
UNVERIFIED
NOT_EXECUTED
DEFERRED_BY_OWNER
PRESERVE_BY_DESIGN
OWNER_DECISION_REQUIRED
BLOCKER
```

The report must answer explicitly:

- Did the bundle guard stop relying on filename prefixes?
- What exact graph/manifest semantics define entry, lazy, shared, and precache surfaces?
- Are every counted file and every precache URL resolved, deduplicated, and bounded safely?
- Was the interim `+512` bridge replaced by a truthful environment-aware method, or what exact blocker prevents that?
- Does the method distinguish real code growth from observed gzip/hash variance without weakening the guard?
- Does the file-size ratchet reject unjustified growth inside a band?
- Can a same-PR baseline update conceal growth? Prove the answer.
- Did the Finance component→page dependency receive a direct regression class covering value, type, dynamic, and relative imports?
- Does the live repository have zero violations of the new boundary rule?
- Is guard metadata canonical and consistent with actual commands and CI/build surfaces?
- Are fixture scopes exact and false positives covered by positive/negative tests?
- Did any financial, historical, schema, export/import, rejection, security, or visual behavior change?
- Were any ceilings raised or baselines weakened? The required answer is `NO` unless a protected owner decision package exists.
- Which findings were fixed, which were preserved with complete evidence, which exact triggered tracks remain, and which are truly out of scope?
- What was not executed because merge is owner-only?

End with exactly one of these final-status blocks.

Success:

```text
R8_COMPLETE — PR_READY
NO_MERGE_PERFORMED
NO_CLEANUP_PERFORMED
NO_UNAPPROVED_FINANCIAL_OR_SEMANTIC_CHANGE
NO_UNAPPROVED_SCHEMA_OR_EXPORT_IMPORT_CHANGE
NO_UNAPPROVED_HISTORICAL_DATA_CHANGE
NO_UNAPPROVED_VISUAL_UI_CHANGE
NO_BUNDLE_CEILING_RAISED
NO_GUARD_WEAKENED
NO_SECRETS_EXPOSED
```

Only if genuinely blocked:

```text
R8_BLOCKED — OWNER_DECISION_REQUIRED
EXACT_REMAINING_ITEMS_REPORTED
NO_UNAPPROVED_GUARD_WEAKENING
NO_UNAPPROVED_FINANCIAL_OR_SEMANTIC_CHANGE
NO_UNAPPROVED_SCHEMA_OR_EXPORT_IMPORT_CHANGE
NO_UNAPPROVED_HISTORICAL_DATA_CHANGE
NO_UNAPPROVED_VISUAL_UI_CHANGE
NO_MERGE_PERFORMED
NO_CLEANUP_PERFORMED
```

Do not report R8 complete for a pilot, one guard, a green intermediate commit, a recommendation, a baseline rewrite, or a partial implementation.

---

## 15. Continuation and interruption rule

If execution is interrupted, do not restart and do not discard work.

First inspect:

- current branch and worktree;
- uncommitted files;
- existing commits;
- all R8 PRs and exact heads;
- Operations Control JSON and generated views;
- the latest R8 report and worklog entry;
- the last completed R8 slice;
- current baseline files and their provenance;
- the last successful local/CI/Cloudflare checks.

Resume only from the first incomplete slice. Preserve existing work. Do not reset, force-push, reclone over work, repeat completed slices, or create duplicate finding IDs. If live state differs from the report checkpoint, stop with `STATE_DRIFT` and report the difference.

Begin by announcing:

```text
R8_PREFLIGHT_STARTED — verifying main, guard baselines, build surfaces, and workstream state
```

Then continue sequentially until all approved R8 slices are closed with evidence and the final PR is ready for owner review, or until one exact protected blocker is reported after all safe independent work is complete.
