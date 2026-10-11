# R10-B Reviewer 4 (RV4) — Tests / Guards / CI / Security-adjacent Operability

- **Role:** R10-B canonical prompt §6 role 4 — guard truthfulness, negative tests, ratchets, bundle/environment contracts, action pinning, secrets coverage, lint/typecheck/build boundaries, Replit hook.
- **SHA verified:** `git -C /home/z/my-project/r10b/clone rev-parse HEAD` → `ffc54eb1150932c9bba88b48a7c38275f2a3effa` (matches expected HEAD; branch `main`; working tree clean of tracked modifications — `git status --short` empty).
- **Date:** 2026-10-11 (review session).
- **Read-only statement:** No file inside the repository clone was created, modified, deleted, staged, installed, built, or tested. No network access, no `git` write commands. All conclusions derive from live inspection of the clone at the SHA above. The only writes performed were to this report file under `/home/z/my-project/r10b/scratch/reviewers/`. The prior R10-A package under `scratch/r10a-package/` was **not** used as evidence; in-repo historical documents (R8/R9 evidence, worklogs) were read as *repository content* and re-verified against live source wherever cited.

---

## 1. Commands actually executed (all read-only)

```
git -C /home/z/my-project/r10b/clone rev-parse HEAD
git -C /home/z/my-project/r10b/clone status --short ; git branch --show-current
ls -la /home/z/my-project/r10b/clone/.git/hooks/            (samples only — no installed hooks)
ls -la <clone root>                                          (.replit exists, 731 bytes)
git ls-files scripts                                         (guard/test inventory)
git log --oneline -- scripts/post-merge.sh | apps/prototype-web/scripts/check-bundle-{budget,surfaces}.mjs | .replit
rg / Grep: post-merge, core.hooksPath, replit, nanoid, 3.3.7, process.env, max-warnings,
          tsconfig.node, exclude.*test, warning families
python3 (read-only one-liners): JSON structure dumps of baseline files; file-extension census
                                (prototype client/src *.test.ts=226 vs *.test.tsx=115);
                                eslint-scope census (src/**/*.ts=61, tests/**/*.ts=37)
Read tool: all files listed in §2.
```

No `pnpm`, `node <guard>`, `eslint`, `tsc`, `python3 <guard>`, or test execution was performed (read-only mandate; also the substance of several "cannot verify live" limits in §8).

## 2. Files / symbols / line-ranges inspected (primary evidence)

| File | Key ranges |
|---|---|
| `scripts/post-merge.sh` | 1–8 (whole file: `export CI=1` at :4; `prototype:build` at :8) |
| `.replit` | 1–44 (`[postMerge]` :17–19 with `timeoutMs = 180000`; workflows :21–43) |
| `apps/prototype-web/package.json` | :9 (`build` = vite build + budget + surfaces guards) |
| `package.json` (root) | :8–26 (scripts incl. `guards` chain :12, `lint` :21, `check` :22), :27–47 (devDeps, `pnpm.overrides`) |
| `apps/prototype-web/scripts/check-bundle-surfaces.mjs` | :77–94 (FAILURE_CODES), **:97–106 (`detectEnvironment`)**, :109–117 (buildIdentityFromEnv), :151–203 (validateBaseline, known-env set :168), :374–405 (compareSurfaces), :416–423 (main: UNVERIFIED_ENVIRONMENT) |
| `apps/prototype-web/scripts/check-bundle-surfaces.test.mjs` | :136–154 (env detection incl. `CI:"true"`→null :143), :430–448 (CLI negatives) |
| `apps/prototype-web/scripts/bundle-surfaces-baseline.json` | whole (3 env records; toolchains node v24.21.0 local / v22.23.3 CI; `anchored.method` prose) |
| `apps/prototype-web/scripts/check-bundle-budget.mjs` | whole (no env reads; fixed ceilings :36–37) |
| `scripts/check-file-size-ratchet.mjs` | :45–52 (TEST_PAT/GUARD_DATA), :197–208 (**ledgerCovers**), :214–259 (growth check), :261–273 (**resolveMergeBase**), :287–304 (**inCI + drift-unavailable**), :339–363 (drift rules) |
| `scripts/file-size-ratchet-reanchors.json` | :1–100+ (entries; `authorization.ownerReview` prose strings) |
| `scripts/check-secrets.mjs` | :31–47 (SECRET_PATTERNS), :50 (file names), :96–105 (**scanContent — single `regex.exec` per pattern**), :113–132 (scanTree) |
| `scripts/check-secrets.test.mjs` | whole (9-family negatives; live-repo smoke :168–172) |
| `scripts/check-test-focus.mjs` | :33–44 (TEST_ROOTS + exclusions), :55 (FOCUS_REGEX), :58–61 (isTestFileName) |
| `scripts/ci-audit-step.sh` | whole (bounded retry; else-branch exit capture; defensive fall-through) |
| `scripts/ci-audit-check.mjs` | whole (register model, PROPOSED blocks, stale detection, exit 0/1/2) |
| `docs/quality/security-exception-register.json` | whole (single REMEDIATED_BY_ELIMINATION braces entry) |
| `.github/workflows/ci.yml` | whole (permissions :13–14, concurrency :23–25, timeout :30, actions :33/40/45/79, node-version :47, install :51, audit :53–61, whitespace :72–76, artifact :78–84) |
| `scripts/ci-workflow-policy.test.mjs` | whole (pins triggers/wiring/fetch-depth; does **not** pin action refs) |
| `scripts/security/ci-audit-gate.test.mjs` | :1–40+ (behavioral fail-closed pin of the merged audit architecture) |
| `eslint.config.js` | whole (first block :7–24 = only warning rules, scope `src/**/*.ts`+`tests/**/*.ts`; all other blocks error-level; W4-D block :459–474) |
| `tsconfig.json` (root) | :14 (`include: ["src","tests"]`) |
| `apps/prototype-web/tsconfig.json` | :2–3 (**`exclude: […, "**/*.test.ts"]`**) |
| `apps/prototype-web/tsconfig.node.json` | whole (includes only vite.config.ts; **not referenced by any script**) |
| `pnpm-workspace.yaml` | :5–6 (`overrides: tailwindcss>nanoid: 3.3.7`) |
| `pnpm-lock.yaml` | :2605–2613 (nanoid 3.3.18 / 5.1.16), :3063–3064 (tailwindcss@4.3.3 — **no dependencies**), :6141–6144 (postcss→nanoid 3.3.18), :6745–6753 (vite-plugin-manus-runtime→nanoid 5.1.16) |
| `scripts/design-token-guards.py` | whole (295 lines; no co-located test) |
| `scripts/theme-contrast-guard.py` | whole (220 lines; no co-located test; module-level file reads :93–97) |
| `scripts/text-density-count.characterization.test.mjs` | :1–60+ (golden + negatives incl. modified/corrupt policy) |
| `scripts/text_density_policy.py` | :1–50 (data-only; cap ledger as comments) |
| `scripts/operations-control/test_operations_control.py` | test names (incl. rejecting negatives) |
| `scripts/check-application-door-surfaces.mjs` | :1–60 (widening/shrink/new-door fail rules) |
| `scripts/check-acceptance-value-anchors.mjs` | :1–60 (anchor sites + R4-REC-5 negatives note) |
| `scripts/check-module-boundaries.mjs` | :33–99, :212–293 (six ratchet baselines incl. in-code allowlists; R6-baseline-stale rule :420–422) |
| Guard headers (inventory): `check-current-state-size`, `check-image-policy`, `check-entity-touchpoints`, `check-storage-listener-guards`, `check-application-readwrite`, `check-vendored-braces`, `check-skill-references`, `check-doc-index-coverage`, `check-runtime-cycles`, `check-type-cycles`, `check-registry-coverage`, `check-date-arithmetic-ownership` | :1–14 each |
| `scripts/check-layer-boundaries.test.mjs` | :1–50 (tests the real ESLint config engine — no standalone guard script exists) |
| `AGENTS.md` | :119–150 (§10 rules 5–9 guard wiring; :143 numeric ceilings) |
| `CONTRIBUTING.md` | whole (no hook/Replit/CI mention) |
| `SECURITY.md` | whole |
| Baselines JSON: `application-door-surfaces-baseline.json`, `ui-application-import-baseline.json`, `vendored-braces-baseline.json` | structure dumps |
| `apps/prototype-web/vite.config.ts` | :330–384 (allowedHosts incl. `.replit.dev` :371), :87/:181–182/:305/:314–318 (env reads) |
| `vitest.config.ts` (root + app) | whole |
| `.stylelintrc.json`, `.npmrc` | whole |
| Docs (context): `docs/operations/archive/agent-handoff-2026-08-29.md` :42–53; `docs/architecture/refactoring/FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md` :745/:760/:792; `docs/architecture/refactoring/R1/R2/R3` execution reports (lint counts); `AGENT-SEQUENTIAL-WORKLOG.md` (lint counts :115–:786); `REFACTORING-ARCHITECTURE-AND-MIGRATION-PLAN.md` :72/:225/:266/:741; in-repo R9 preflight `docs/operations/control/evidence/structural-remediation-r9-20261010/preflight-review-package/reviewer-4-tests-guards-ci.md` (read as repo content; every load-bearing claim re-verified here independently) |

---

## 3. Part A — R10-A findings re-verification

### F-024 (S2, CRITICAL) — Replit post-merge hook structurally broken → **CONFIRMED** (chain verified end-to-end from live source)

**The exact chain (file:line evidence):**

1. `.replit:17–19` — `[postMerge] path = "scripts/post-merge.sh"`, `timeoutMs = 180000`. **The Replit Agent platform is the machine consumer** of the hook (this is the only executable wiring; no `core.hooksPath`, no `.git/hooks` content beyond samples in the clone, no setup script installs it).
2. `scripts/post-merge.sh:2` — `set -euo pipefail`; **:4** — `export CI=1`; :6–8 — `corepack pnpm install --frozen-lockfile --prefer-offline` → `corepack pnpm run typecheck` → `corepack pnpm run prototype:build`.
3. Root `package.json:18` — `prototype:build` = `pnpm --filter @micro/prototype-web build`; app `package.json:9` — `build` = `vite build && node scripts/check-bundle-budget.mjs && node scripts/check-bundle-surfaces.mjs`. The exported `CI=1` propagates through corepack/pnpm/node to the surfaces guard.
4. `check-bundle-surfaces.mjs:97–106` — `detectEnvironment`: `CF_PAGES`/`CF_PAGES_COMMIT_SHA` unset; `GITHUB_ACTIONS !== "true"`; then `ciMarkers = [env.CI, env.GITLAB_CI, env.JENKINS_URL, env.TEAMCITY_VERSION]` — `CI="1"` is non-empty and ≠ "false" → **returns `null`** ("مؤشرات CI أخرى بلا هوية موثوقة = بيئة غير موثقة" — deliberate fail-closed for CI markers without a trusted identity, comment :101–103).
5. `check-bundle-surfaces.mjs:418–423` — `main()`: `environment === null` → `FAIL UNVERIFIED_ENVIRONMENT` → exit 1 → `pnpm run prototype:build` fails → `set -e` aborts the hook.

**Intended environment contract (verified):** the surfaces guard is fail-closed for *any* CI-ish marker that does not identify a *known, anchored* environment (local / github-actions / cloudflare-pages). This is tested behavior, not accident: `check-bundle-surfaces.test.mjs:143–145` asserts `detectEnvironment({CI:"true"})` → `null` and `{CI:"false"}` → `"local"`. The hook's `CI=1` therefore cannot ever satisfy the guard — the two artifacts are mutually incompatible by construction.

**Timeline (git history):** hook + `.replit` created 2026-08-29 (`f93f9900`, `7945d088`); bundle-budget guard added 2026-09-10 (env-blind — hook still worked); surfaces guard v1 2026-10-05 (`16a3b9a1`); fail-closed environment identity (R8-1) 2026-10-10 (`c70d3eed`). **The hook has been structurally failing since 2026-10-10** — its last documented successful run (archived handoff 2026-08-29:51 "تم تشغيل التهيئة بعد الدمج بنجاح") predates both bundle guards.

**Consumers / references inventory (who would be affected by any change):**
- `.replit:17–19` — the only machine consumer (platform hook).
- `scripts/file-size-ratchet-baseline.json:1599` — ratchet measurement row for the script (size category "script").
- `docs/architecture/refactoring/FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md:792` — register row (INFRA, change-via-own-slice).
- `docs/operations/archive/agent-handoff-2026-08-29.md:47–51` — archived historical description.
- In-repo R9 preflight evidence doc (`…/reviewer-4-tests-guards-ci.md:18`) — historical review record.
- **Not** referenced in README.md, CONTRIBUTING.md, AGENTS.md, `docs/00-document-index.md`, or `docs/operations/current-state.md` (verified by grep — no current authority doc documents the hook).
- No other script sources/shells `post-merge.sh` (grep across repo: only the references above).

**W0-E decision package — Option comparison**

| Dimension | **A: drop `export CI=1`** | **B: add documented Replit alias in `detectEnvironment` + baseline record** | **C: retire the hook + `[postMerge]`** |
|---|---|---|---|
| Consumers affected | `.replit` unchanged; hook behavior changes only | `.replit` unchanged; guard + baseline + its tests change | `.replit` (remove `[postMerge]` :17–19); delete `scripts/post-merge.sh`; update register row (FILE-SIZE…:792); ratchet baseline row :1599 becomes "removed" (per protocol, clean-up in same PR) |
| What breaks / dependencies on CI=1 | **Nothing else in the hook reads CI**: install already passes `--frozen-lockfile` explicitly; `tsc` and `vite build` are CI-agnostic; `check-bundle-budget.mjs` reads no env; no other script sources the hook. The only CI-sensitive step is `check-bundle-surfaces.mjs` | Guard's known-env set (`validateBaseline` :168) and schema comments; tests must add Replit cases; baseline needs a new anchored `replit` record (bootstrap path exists: `ANCHOR_RECORD` printed on `UNANCHORED_ENVIRONMENT`) | None functionally — the hook is already failing since 2026-10-10; CI validates every push/PR/tag independently |
| Fail-closed preservation | **Preserved for the guard** (unknown CI still fails). The *hook* stops emulating CI — the local baseline is then applied to the Replit build, i.e. environment identity is "local" | Preserved (Replit becomes a first-class anchored environment). But the marker is spoofable exactly like `GITHUB_ACTIONS`/`CF_PAGES` — same trust class as existing markers; the guard's stated philosophy (:101–103 "no trusted identity") would need a dated amendment | Neutral for the guard; removes one (broken) verification path |
| False-positive / false-negative risk | **FP risk:** Replit runs Node 20 (`modules = ["nodejs-20"]`, `.replit:1`) vs the anchored "local" toolchain Node v24.21.0 (baseline :24). Raw surfaces should be identical (no env identity; lockfile-pinned rollup), but gzipNorm on a different zlib is unproven for Node 20 (convergence proven only across Node 22/24, baseline `environment_convergence` :10) → possible spurious `SURFACE_GROWTH` beyond +16 gzip tolerance. **FN risk: none** (guard still measures everything) | Low FP (spoofing gets the replit baseline — near-converged values). **Unknown-unknown:** whether Replit's postMerge runner actually sets any stable marker (`REPL_ID`/`REPLIT_DEV_DOMAIN` are publicly documented Replit variables, but **this is not statically provable from the repo** — no reference exists in-tree). Choosing the wrong marker = hook still fails (marker absent) or someone's local env misclassified | None (removal); risk is *opportunity cost*: no automated post-merge reinstall/typecheck/build on the Replit workspace — but that safety net has been non-functional for ~1 day before HEAD and nothing in current docs relies on it |
| Test strategy | Re-run hook on Replit (live); assert guard reports `ENV=local` PASS or capture the honest failure; add a characterization note | Add `detectEnvironment({REPL_ID:…})` unit tests; anchor `replit` baseline record from a real Replit run via `ANCHOR_RECORD`; pin the marker choice in `ci-workflow-policy`-style test | Delete hook + row; ratchet treats removed file as shrink (allowed); grep-verify no dangling references |
| Rollback | One-line revert (`export CI=1` restored) | Revert guard + baseline record (multi-file, still small) | Revert commit (hook is 8 lines; `.replit` 3 lines) |
| Long-term ownership | Hook keeps its "simulate CI locally" fiction while actually running as "local" — mild conceptual drift; **timeout `180000` (3 min) for install+typecheck+build remains suspect** (CI's full `pnpm check` is far longer; even the reduced chain may exceed 3 min cold) | Guard owns an environment it cannot verify from source (Replit platform behavior) — permanent external coupling; every Replit platform change becomes a guard incident | Simplest honest state: CI (GitHub Actions) + Cloudflare Pages are the two real verification environments (both anchored); Replit is a dev workspace served by the `Project`/`Start application` workflows (`.replit:21–43`) |
| Reviewer disposition | Viable **only** if the Replit toolchain is proven byte-stable against the local baseline (needs a live run) | Strongest *if* the hook is considered load-bearing and a stable marker is confirmed on the platform | **Recommended default** given: broken ≥1 day, zero current documentation, zero in-repo consumers besides `.replit`, and CI/Pages already anchor all real verification. If the owner wants a post-merge safety net on Replit, do A+B together with a raised `timeoutMs` |

**Additional verified fact for the package:** `.replit:1` (`nodejs-20`) vs CI `node-version: 22` (ci.yml:47) vs local anchor `v24.21.0` — three different Node majors across the three environments; only two are anchored. This strengthens either B (anchor Replit properly) or C (stop pretending Replit is a verification environment).

### F-025 (S3) — Floating action tags + unpinned Node minor → **CONFIRMED**

`.github/workflows/ci.yml` (the only workflow — asserted single-file by `ci-workflow-policy.test.mjs:58–61`):
- `actions/checkout@v4` (:33), `pnpm/action-setup@v4` (:40), `actions/setup-node@v4` (:45), `actions/upload-artifact@v4` (:79) — **none SHA-pinned**; all floating major tags.
- `node-version: 22` (:47) — major only, not `22.x.y`. (Contrast: pnpm **is** exactly pinned — `version: 9.15.9` :42 and `packageManager: pnpm@9.15.9`.)
- Supply-chain exposure assessment: a moved/compromised action tag executes attacker code in CI with `permissions: contents: read` (:13–14 — least privilege, verified). Blast radius for this private repo: source read/exfilration, lockfile-informed tampering in non-`-frozen` paths (install **is** `--frozen-lockfile --ignore-scripts` :51 — verified, a real mitigant), artifact poisoning (`micro-pwa-<sha>` upload :78–84). Node minor drift silently changes the `github-actions` anchor toolchain (record `v22.23.3`, baseline :83) — the guard *prints* `node=` (surfaces :431) but never *compares* it to the anchor, so a runner-side zlib change could surface as spurious `SURFACE_GROWTH` or pass unnoticed in the toolchain record. No Dependabot/config for actions exists in-repo. `ci-workflow-policy.test.mjs` pins triggers/wiring but **not** refs/node-version/permissions (new finding RV4-N9).

### F-026 (S3) — Lint warning ceiling "35/37 saturated" → **REFINED**

Verified facts:
- Ceiling: `package.json:21` — `eslint src tests apps/prototype-web/client/src --max-warnings 37`. **Governance is real:** `group6Docs.test.ts:105` asserts the script contains `--max-warnings 37`; D-032 (`docs/02-decision-log.md:40`) records the ratchet decision ("count never rises; only descent allowed; zero-warning goal deferred"); AGENTS.md:143 pins the number to the doc.
- Current count: **cannot be executed read-only.** Best in-repo evidence trail: 37/37 exactly on 2026-09-29 (W4D-SLICE-REPORT:15) → **35 warnings** consistently from 2026-10-05 through R8 close (worklog :115, :147, :164, :180, :411, :437, :786; R1/R2/R3 execution reports; R9 preflight :128 "0 errors / 35 warnings at R8 close"). No R10-continuation evidence contradicts 35 at HEAD, but this is evidence-citation, not live verification.
- **Refinement:** "saturated at 35/37" is imprecise — the ceiling has **2 slots of headroom** (35 ≤ 37); true saturation (37/37) was the state during 2026-09-22→10-05. The honestly-documented limit stands (`current-state-log.md:523`): a 1:1 warning swap at constant count is invisible to the count; minimum detection is diff review.
- Warning families (verified from `eslint.config.js:7–24`): the **only** warning-severity rules are `complexity: ["warn", 12]` and `max-lines-per-function: ["warn", 60]`, and they apply **only** to `files: ["src/**/*.ts", "tests/**/*.ts"]` (61 + 37 files respectively, counted statically). All other configured rules are `error`. The 35 individual warnings cannot be enumerated without running eslint (§8).

### F-027 (S3) — Secrets guard first-match-only + missing families → **REFINED** (core confirmed, mechanism corrected)

- **First-match-only: CONFIRMED as written** — `check-secrets.mjs:96–105` `scanContent` calls `regex.exec(content)` **once per pattern per file** (no `g` flag, no match loop). Consequence: a file with N occurrences of the same family reports **1** hit (first line only). 
- **But the "masks later violations / allowed pattern" framing is DISPROVED**: there is **no allowlist or masking mechanism** in this guard; `scanTree` fails closed on **any** finding (`main` :146–152, exit 1). First-match-only therefore **cannot mask pass/fail** — it only underreports the *inventory* (counts and locations of additional leaks), which matters for remediation/audit completeness, not for gating. (Severity of this sub-claim drops accordingly.)
- Missing pattern families (covered = 9 content families :31–47: ghp_/github_pat_/gh[ousr]_/AIza/npm_/AKIA/xox*/sk-…/PRIVATE KEY block, + filename denylist :50 `.env*`, `*.pem`, `*.key`, `id_rsa*`, `*.p12`, `*.pfx`): **not covered** — AWS *secret* access keys (no high-precision prefix), Stripe (`sk_live_`/`pk_live_`/`rk_live_`), Anthropic (`sk-ant-…` — the `sk-[A-Za-z0-9]{32,}` regex breaks on the first hyphen, so it does **not** catch it), GitLab PATs (`glpat-`), SendGrid/Twilio, Azure keys/connection strings, JWTs (`eyJ…`), URL-embedded credentials, private-key *bodies* without a BEGIN header, `.netrc`/credentials filenames. **Generic high-entropy scanning is a documented deliberate exclusion** (:8–10 "a falsely-screaming scan gets bypassed") — a design decision, not an oversight. Note `sk-ant-` non-coverage is likely *unintended* (the rule's evident intent was "openai-style", and the family comment claims sk- coverage) — worth a one-line owner decision either way.
- Tests verified: all 9 families have negative fixtures (`check-secrets.test.mjs:53–94`), line-number correctness (:80–85), filename negatives (:87–94), binary-as-latin1 (:126–135), CLI exit codes (:139–172) incl. live-repo smoke PASS (:168–172).

### F-028 (S3) — Ratchet authorization prose + merge-base degeneration → **CONFIRMED** (both sub-claims)

`scripts/check-file-size-ratchet.mjs`:
1. **Authorization not machine-verifiable:** `ledgerCovers` (:197–208) checks `entry.path`, `entry.from?.nbLoc === <old value>`, `entry.to?.nbLoc >= <new value>` (machine-checked chain ✔) — but the authorization itself is only `typeof entry.authorization?.ownerReview === "string" && length > 0` (:205–207). Live ledger entries (`file-size-ratchet-reanchors.json`, e.g. :19–23, :54–58, :73–76) carry prose like "R8 PR review (WS-216/ARCH-007) — this entry is part of the R8 PR #345 diff" — **nothing checks the PR/review exists or approved**. A growth authorization is therefore forgeable by any string; the honest control is PR review of the diff itself.
2. **Merge-base degeneration on direct-main pushes:** `resolveMergeBase` (:261–273) computes `merge-base HEAD origin/main|main`. On a push event to main, `origin/main` == HEAD → old baseline is read **at HEAD itself** (`baselineAtCommit` :275–280) → `auditBaselineDrift`'s old-vs-new comparison (:339–363) is **vacuous** (identical objects). Rule 1 (live-vs-baseline, :221–246) still requires a ledger entry for *file growth*, so a direct-main push cannot silently grow files — but it **can** raise baseline values for files whose live measurement sits at/below the raised value without any ledger entry, defeating exactly the anti-same-PR-hiding rule the drift audit exists for (:16–19 "منع إخفاء نمو نفس-الـPR"). CI *does* run on `push: branches: [main]` (ci.yml:4–6), so this is a live path, not hypothetical. (Related new inconsistency: `inCI` :288 treats only `CI === "true"` as CI — the post-merge hook's `CI=1` would be classified *local* → warn-only; see RV4-N2.)

### F-029 (S3) — Inert nanoid override → **CONFIRMED** (mechanism refined, doubly inert)

- Existence: `pnpm-workspace.yaml:5–6` — `overrides: tailwindcss>nanoid: 3.3.7`. No other reference to this override anywhere in the repo (grep `nanoid`/`3.3.7` outside the lockfile: only this line). Undocumented — no dated reason, no register row.
- **Inertness mechanism 1 (tool version):** the pinned package manager is pnpm 9.15.9 (`package.json:5`, ci.yml:42). pnpm 9 reads `overrides` from root `package.json` `pnpm.overrides` (where the *active* overrides live, :37–47) — the `overrides` key in `pnpm-workspace.yaml` is a pnpm v10 feature. Under 9.15.9 the block is not read at all.
- **Inertness mechanism 2 (dead selector):** even if read, `tailwindcss>nanoid` targets a direct-dependency edge that **does not exist**: `tailwindcss@4.3.3` has zero dependencies in the lockfile (:3063–3064). The nanoid copies in the graph come from `postcss@8.5.26 → nanoid 3.3.18` (:6141–6144) and `vite-plugin-manus-runtime@0.0.58 → nanoid 5.1.16` (:6745–6753). The override's target version (3.3.7) is also **older** than the resolved 3.3.18 — activation on a future pnpm-10 migration would be a downgrade-looking no-op at best, a confusing diff at worst.
- Provenance (inferred, labeled as such): the `tailwindcss>nanoid: 3.3.7` line is a known Replit-template boilerplate entry; the repo's Replit origin (`.replit`, handoff docs) makes template residue the likely source. Disposition: delete the two lines in a docs/infra slice, or document why they stay; zero functional risk either way (verified against lockfile).

### F-030 (S3) — Python design guards have no negative tests → **CONFIRMED** (asymmetry verified, with one nuance)

- `scripts/design-token-guards.py` (295 lines) and `scripts/theme-contrast-guard.py` (220 lines): **no co-located test files exist** (full scripts inventory via `git ls-files`). Their violation branches (raw hex outside zones, retired palette, off-scale values, contrast below 4.5:1/3:1, missing color-scheme) have **no negative evidence anywhere** — neither fixtures nor golden outputs. Contrast-guard note: token files are read at **module import time** (:93–97), which also makes clean unit-testing slightly awkward (needs temp-file indirection through `parse_zone(path,…)`).
- The JS guards, by contrast, universally carry sibling `.test.mjs` with explicit violation fixtures (verified per-file; see Part B matrix).
- **Nuance/refinement:** the Python *family* is not uniformly untested — `text-density-count.py` has a strong characterization test with negatives (modified policy cap → exit failure; corrupt policy → explicit error; `text-density-count.characterization.test.mjs` header layer 5), and `operations-control/validate.py` has unittest negatives (`test_schema_rejects_unknown_property_and_bad_nested_history`, `test_parent_child_claim_overlap_is_detected`, …). The gap is **specifically the two §9/D5 design guards** (and `text_density_policy.py` data raises are prose-comment ledger only).

### F-031 (S3) — Guard scripts and tools/ outside lint/typecheck scope → **CONFIRMED** (with a sharper new sub-finding)

Verified boundaries:
- **ESLint** (`package.json:21` + `eslint.config.js`): CLI targets `src tests apps/prototype-web/client/src` only. **Not linted:** `scripts/**` (all 20+ guard `.mjs`, `ci-audit-step.sh`, 5 Python guards), `apps/prototype-web/scripts/**` (the two bundle guards), `tools/micromatch-shim/**` (609 lines of security-replacement JS), `apps/prototype-web/vite.config.ts`, root configs (`eslint.config.js` itself, `vitest.config.ts`), `ai-skills/**`. Additionally the config's rule blocks match only `.ts/.tsx` patterns — plain `.js/.mjs` would need a new block even if added to the CLI.
- **Typecheck:** root `tsc --noEmit` includes `["src","tests"]` (tsconfig.json:14); app `check` includes `client/src/**/*` **but excludes `**/*.test.ts`** (apps tsconfig :2–3) → **226 `*.test.ts` files under prototype client/src (incl. `*.dom.test.ts`) are typechecked nowhere** (the 115 `*.test.tsx` *are* covered — the exclusion pattern doesn't match `.tsx`; the asymmetry indicates drift, not design; no documented rationale found). `tsconfig.node.json` includes only `vite.config.ts` and **is referenced by nothing** (no `references`, no script) → `vite.config.ts` — the file that owns `manualChunks`, PWA precache globs, and dev-server secrets middleware — is **outside every static check** (RV4-N3).
- **Prettier:** `format`/`format:check` cover `src tests apps/prototype-web/client/src` only — same exclusion set as eslint.
- Risk assessment: the guards themselves are the enforcement layer, and their own tests execute them — but nothing statically checks the guard *code quality* (an `any`-typed or syntactically drifted guard still runs). The ratchet does measure script sizes (`category()` counts `scripts/**` and `tools/**` `.js` as production — verified :82, :96–97, :107), so growth is bounded; correctness of guards rests entirely on their `.test.mjs` suites.

---

## 4. Part B — Mandatory analogous-pattern searches

### B.1 Complete guard inventory & trust matrix

Wiring facts (verified from `package.json:12` `guards` chain, `:11` `design-guards`, `:22` `check`, `:25` operations-control, ci.yml:70 `pnpm check`): every guard below runs in CI via `pnpm check` unless noted. "Neg." = negative test (a fixture/case that must fail/be rejected).

| # | Guard | Positive test | Negative test | Wired into `pnpm check`/CI | Central documentation |
|---|---|---|---|---|---|
| 1 | `scripts/check-secrets.mjs` | ✔ (12 its) | ✔ per family + filenames + CLI | ✔ guards#1 | AGENTS.md §10:136; R10-B §3 |
| 2 | `scripts/check-test-focus.mjs` | ✔ (15 its) | ✔ `.only/.skip/.skipIf/.runIf/.fixme/.todo` fixtures | ✔ guards#2 | AGENTS.md §10:136 |
| 3 | `scripts/check-entity-touchpoints.mjs` | ✔ (17 its) | partial (orphan/missing-entry cases; 1 neg marker) | ✔ guards#3 | AGENTS.md §10:135 |
| 4 | `scripts/check-runtime-cycles.mjs` | ✔ (9 its) | partial (cycle fixtures; 1 marker) | ✔ guards#4 | REFACTORING-ARCH…PLAN :225 |
| 5 | `scripts/check-doc-index-coverage.mjs` | ✔ (3 its) | weak (0 neg markers found) | ✔ guards#5 | WS-204 program docs |
| 6 | `scripts/check-current-state-size.mjs` | ✔ (4 its) | none found (0 markers) | ✔ guards#6 | WS-204; current-state contract |
| 7 | `scripts/check-skill-references.mjs` | ✔ (6 its) | none found (0 markers; C1–C4 mostly positive-path) | ✔ guards#7 | WS-204 |
| 8 | `scripts/check-image-policy.mjs` | ✔ (7 its) | none found (0 markers) | ✔ guards#8 | WS-204 (owner decision) |
| 9 | `scripts/check-module-boundaries.mjs` | ✔ (25 its) | ✔ strong (33 markers; R1–R6 fixtures) | ✔ guards#9 | OWNERSHIP-AND-TRUTH-REGISTRY §5; PLAN :741 |
| 10 | `scripts/check-type-cycles.mjs` | ✔ (4 its) | ✔ (4 markers; new-SCC rejection) | ✔ guards#10 | PLAN (STR-617) |
| 11 | `scripts/check-registry-coverage.mjs` | ✔ (4 its) | ✔ (6 markers) | ✔ guards#11 | OWNERSHIP-AND-TRUTH-REGISTRY |
| 12 | `scripts/check-acceptance-value-anchors.mjs` | ✔ (23 its) | ✔ strong (43 markers; R4-REC-5 added negatives) | ✔ guards#12 | header :19–22 |
| 13 | `scripts/check-file-size-ratchet.mjs` | ✔ (20 its) | ✔ strong (16 markers; drift negatives :277–:358 per test header) | ✔ guards#13 | ADR/PLAN :266; F-028 caveats |
| 14 | `scripts/check-vendored-braces.mjs` | ✔ (11 its) | partial (1 marker) | ✔ guards#14 | security-exception-register.json |
| 15 | `scripts/check-date-arithmetic-ownership.mjs` | ✔ (7 its) | ✔ strong (34 markers; R1–R6) | ✔ guards#15 | header; R2 program |
| 16 | `scripts/check-application-door-surfaces.mjs` | ✔ (14 its) | ✔ (12 markers; widen/shrink/new-door) | ✔ guards#16 | R5 ledger |
| 17 | `scripts/check-application-readwrite.mjs` | ✔ (9 its) | ✔ (8 markers; AST both forms) | ✔ guards#17 | R5/S3 wave acceptance |
| 18 | `scripts/check-storage-listener-guards.mjs` | ✔ (6 its) | partial (2 markers) | ✔ guards#18 | R9-GA-F7.1 |
| 19 | `apps/prototype-web/scripts/check-bundle-budget.mjs` | ✔ (18 its) | partial (1 marker; over-limit/ambiguity cases present in suite) | ✔ via `prototype:build` inside `pnpm check` | ADR-012/017; AGENTS :143 |
| 20 | `apps/prototype-web/scripts/check-bundle-surfaces.mjs` | ✔ (22 its) | ✔ strong (env/manifest/precache/duplicate negatives) | ✔ via `prototype:build` | R8-1 header; this review |
| 21 | `scripts/design-token-guards.py` | **none** | **none** | ✔ `design-guards` (also stylelint) | SOURCE_OF_TRUTH.md:21 |
| 22 | `scripts/theme-contrast-guard.py` | **none** | **none** | ✔ `design-guards` | SOURCE_OF_TRUTH (D5) |
| 23 | `scripts/text-density-count.py` (+`text_density_policy.py`) | ✔ characterization (7 its) | ✔ (modified/corrupt policy; 5 markers) | ✔ `text-density` | §10.1 + policy ledger |
| 24 | `scripts/operations-control/validate.py` (+generate_tracker) | ✔ unittest (10 tests) | ✔ (schema rejects, overlap detection) | ✔ `operations-control:check`/`:test` | control/README; AGENTS §14 |
| 25 | ESLint config itself (layer rules) | — | ✔ via `scripts/check-layer-boundaries.test.mjs` (21 its over the real engine; **no standalone guard script — the "guard" is eslint.config.js**) | ✔ runs in root vitest (`scripts/**/*.test.mjs` include) | PLAN :225 |
| 26 | CI policy (`ci.yml` triggers/wiring) | ✔ `ci-workflow-policy.test.mjs` (6 its) | partial (retired-branch-absence, old-bug-pattern-absence) | ✔ root vitest | ci.yml comments; PR #316 program |
| 27 | CI audit gate | ✔ `ci-audit-check.test.mjs` (11 its) + `ci-audit-gate.test.mjs` (6 its, behavioral) + `ci-audit-step.test.mjs` (5 its, stubbed retry) | ✔ strong (PROPOSED blocks, malformed register, exit propagation) | ✔ the gate itself runs in CI; its tests in root vitest | security-exception-register.json |

**Not wired anywhere (verified):** `scripts/generate-test-map.mjs` (+test — runs ad hoc; test-map drift checked inside its test), `scripts/generate-ui-application-import-baseline.mjs` (regeneration tool, no test), `scripts/security/braces-elimination/*` (historical harness + parity test), `scripts/operations-control/generate_tracker.py` (invoked by validate.py `--check`). `scripts/post-merge.sh` — **wired only to `.replit`** (see F-024).

**Weakest negative coverage (ranked):** design-token-guards.py & theme-contrast-guard.py (none) > check-current-state-size / check-image-policy / check-skill-references / check-doc-index-coverage (positive-path only) > check-entity-touchpoints / check-runtime-cycles / check-vendored-braces / check-storage-listener-guards (partial).

### B.2 Environment-detection callers (complete inventory)

| Caller | Markers read | Behavior | Closed/open |
|---|---|---|---|
| `check-bundle-surfaces.mjs:97–106` | `CF_PAGES`, `CF_PAGES_COMMIT_SHA`, `GITHUB_ACTIONS`, `CI`, `GITLAB_CI`, `JENKINS_URL`, `TEAMCITY_VERSION` | known env → named baseline; **any other non-empty CI-ish marker → `null` → FAIL UNVERIFIED_ENVIRONMENT** | **Fail-closed** (tested) |
| `check-bundle-surfaces.mjs:109–117` | `VITE_APP_VERSION`, `GITHUB_SHA`, `CF_PAGES_COMMIT_SHA` | build-identity string for gzip normalization; `null` fallback | informational (affects gzipNorm only, by design) |
| `check-file-size-ratchet.mjs:288` | `GITHUB_ACTIONS === "true" \|\| CI === "true"` | only gates the *severity* of unresolvable merge-base: CI → violation; local → warning | **Fail-open nuance:** `CI="1"` (post-merge hook convention) is treated as *not CI* → warn-only (RV4-N2); in GitHub Actions (`GITHUB_ACTIONS=true`) it fails correctly |
| `apps/prototype-web/vite.config.ts:314–318` | same identity triple | mirrors guard's identity priority | informational |
| `vite.config.ts:87` `NODE_ENV`; `:181–182` `BUILT_IN_FORGE_API_URL/KEY`; `:305` `MICRO_DEV_TOOLS` | dev-server middleware / plugin toggles | dev-only; key read for local forge proxy | out of gating scope (R9 preflight verified dev-only) |
| `scripts/ci-audit-step.sh:26–27` | `CI_AUDIT_MAX_ATTEMPTS`, `CI_AUDIT_RETRY_SLEEP` | retry knobs (defaults 3 / 60s) | config, not detection |
| `scripts/post-merge.sh:4` | — | **writer**: `export CI=1` | the F-024 incompatibility source |
| `scripts/security/braces-elimination/harness-lib.mjs:353` | passthrough `{...process.env}` | parity harness | not gating |

No other script reads environment markers (repo-wide `rg process.env` over scripts/tools/app-scripts, tests excluded). Cloudflare Pages is an *external* CI environment whose config is provider-side (not in-repo) — its contract is anchored via `CF_PAGES*` markers and evidenced by check-run IDs in baseline provenance (citation, not verifiable in-repo).

### B.3 Ratchets / baselines inventory — authorization machine-verifiability

| Baseline / threshold | Location | Change authorization | Machine-verifiable? |
|---|---|---|---|
| File-size ratchet | `scripts/file-size-ratchet-baseline.json` | `file-size-ratchet-reanchors.json` ledger (from==old value, to≥new enforced) | **Chain yes; ownerReview prose no** (F-028) |
| Bundle surfaces (3 envs) | `apps/prototype-web/scripts/bundle-surfaces-baseline.json` | `anchored.{head,date,method}` + same-PR protocol | **Format yes (validateBaseline), content no** — method is prose; no link to PR/review; tolerance caps hard-enforced (raw≤16/gzip≤256) |
| Bundle budget ceilings 650,000/155,300 | `check-bundle-budget.mjs:36–37` (code constants; no CLI override) | ADR-017 + AGENTS :143 "double-diff" | **Partially** — constants in code; governance test pins doc↔code numbers (group6Docs), so raise = visible diff; not ledgered |
| Lint warning cap 37 | `package.json:21` | D-032; `group6Docs.test.ts:105` pins the string | **Yes** (silent raise breaks the test) — but the *count* (35) is not machine-asserted |
| Door surfaces ratchet | `scripts/application-door-surfaces-baseline.json` | widen/shrink/new-door all fail; update in same PR | **Yes as allowlist** (no growth path at all; no prose ledger needed) |
| UI→application deep imports (R6) | `scripts/ui-application-import-baseline.json` + 5 in-code allowlists (`check-module-boundaries.mjs:224–280`) | monotonic shrink; stale rows fail (:420–422); new = violation | **Yes as allowlist**; additions require code/baseline diff (review-visible, no ledger) |
| Vendored braces inventory | `scripts/vendored-braces-baseline.json` | signature + copy list; changes via PR | **Inventory yes** (signature match), authorization by review only |
| Text-density caps | `scripts/text_density_policy.py` CAPS | dated comment ledger per raise | **No** — prose comments; golden must be updated same-PR (diff-visible only) |
| Entity touchpoints registry | `docs/quality/persistent-entity-touchpoints.json` | registration completeness enforced | **Yes as registry** (missing/orphan fail); semantic adequacy explicitly disclaimed in guard header |
| Schema/export versions 38/30 | `storage/local/types.ts` | D-037/D-038/WS-178 decisions | **Yes** — documentation tests pin numbers to docs (AGENTS :143) |
| Type-cycle SCC baseline | measured live at run (1 documented SCC) | new SCC = fail | **Yes** (baseline = live measure; growth rejected) |
| Image policy baseline | inline in `check-image-policy.mjs` | owner decision, dated reason in-file | **Diff-visible only** (in-code list) |

**Pattern finding:** every ratchet is machine-enforced against *growth*; the *authorization artifacts* split into (i) allowlist-style baselines needing no authorization (doors, R6 imports, type-cycles — strongest model), and (ii) value-raising ratchets whose authorization is ledger/prose (file-size, surfaces, text-density, lint count) — of these only file-size has a machine-checked chain (from/to), and none machine-verify the human decision itself. This is the systemic generalization of F-028.

### B.4 Workflows — full read

Single workflow `.github/workflows/ci.yml` (single-file invariant tested). Verified properties: `permissions: contents: read` (least privilege ✔); triggers `push: [main]` + `tags: v*` + unfiltered `pull_request` + `workflow_dispatch` (all pinned by `ci-workflow-policy.test.mjs`); `concurrency: ci-${{ github.ref }}` with `cancel-in-progress: true`; job `timeout-minutes: 45`; checkout `fetch-depth: 0` (required by ratchet drift audit + whitespace check); pnpm pinned 9.15.9; Node 22 (unpinned minor — F-025); install `--frozen-lockfile --ignore-scripts` (supply-chain positive); audit step via `scripts/ci-audit-step.sh` (bounded retry, register-aware, exit-code discipline with regression tests); `pnpm check` full chain; PR-only whitespace `git diff --check` against base; artifact upload `micro-pwa-<sha>`, `if-no-files-found: error`, 30-day retention.

**Weaknesses beyond F-025:** (1) no SHA pinning (F-025) and no policy test pinning refs (RV4-N9); (2) `actions/checkout` default `persist-credentials: true` — benign here (all subsequent steps run repo-authored scripts; token is read-only) but hardening would set `persist-credentials: false` (RV4-N10); (3) drift-audit vacuity on direct-main pushes is *reachable* through this workflow's push trigger (F-028b); (4) artifact contains the production bundle on every run including PRs from forks? — repo is private/no fork context evidenced; retention 30d acceptable; (5) no separate scheduled/nightly audit (audit only rides CI runs — acceptable for a private prototype). No other workflow files exist (verified + tested).

### B.5 Test-focus guard scope (verified)

`check-test-focus.mjs` `TEST_ROOTS` = `src`, `tests`, `scripts`, `apps/prototype-web/client/src`, `apps/prototype-web/scripts` (:33–39) — matches both vitest configs' discovery (root: `tests/**`, `src/**`, `scripts/**/*.test.mjs`; app: default include over the package). File-name matcher `.test.`/`.spec.` (:58–61). Exclusions: `node_modules/dist/coverage` + exactly `scripts/fixtures` (F-05b narrowing). **Covers:** all JS/TS guard tests, root domain tests, prototype dom/contract tests (both packages). **Does not cover:** (a) **Python tests** — `test_operations_control.py` matches neither the name pattern nor the `.only/.skip` vitest vocabulary; Python-side skips (`@unittest.skip`, `@skipIf`) are entirely unguarded (RV4-N7); (b) `tools/` (no test files today — latent only); (c) `ai-skills/` (none). FOCUS_REGEX (:55) includes `.only/.skip/.skipIf/.runIf/.fixme/.todo(` — misses vitest's `.fails(` (expected-failure marker, a focus-like hazard) — minor.

### B.6 Lint/format boundary — files NOT covered

| Not covered by eslint+prettier (+tsc) | Size/role | Risk |
|---|---|---|
| `scripts/**` (20+ guard .mjs, 5 .py, 2 .sh) | the enforcement layer itself | Medium — guard code quality rests solely on their tests; a broken guard fails loudly (good), a subtly wrong guard passes if its tests share the wrong assumption |
| `apps/prototype-web/scripts/**` (bundle guards) | build gate code | Medium — same class; well-tested though |
| `tools/micromatch-shim/**` (index.js 266 ln, braces-free.js 343 ln) | security replacement for micromatch, shipped as workspace pkg | **Medium-High for its role** — no lint/typecheck/prettier; mitigations: parity test vs micromatch fixtures, hostile-input evidence file, size-ratcheted as production, README disclosure |
| `apps/prototype-web/vite.config.ts` | build-critical (chunks, PWA precache, secrets middleware) | Medium (RV4-N3) — outside lint, typecheck (tsconfig.node.json dead), ratchet (CONFIG_FILES) |
| 226 prototype `*.test.ts` files | typecheck only (lint DOES cover them; prettier covers them) | Medium (RV4-N1) — type errors in 2/3 of prototype tests invisible statically |
| root configs (`eslint.config.js`, `vitest.config.ts`), `.github/**`, `ai-skills/**`, all `.md/.json` docs | config/docs | Low — changes are diff-visible; prettier coverage of docs intentionally absent |

---

## 5. Part C — E-UNV research input

### E-UNV-003 (security posture / threat modeling) — what exists statically

**Static checks present (all verified live):**
1. **Secrets guard** (`check-secrets.mjs`) — 9 high-precision content families + filename denylist + strict single documented fixture exclusion (`scripts/fixtures/secrets`); fail-closed; never prints matched values; runs in CI via `pnpm guards`. Limits: first-match-per-pattern (F-027), family gaps (Stripe/Anthropic/GitLab/JWT/AWS-secret/etc.), **working-tree only — git *history* is not scanned** (a secret committed then removed still lives in history; RV4-N8).
2. **Dependency audit** — `pnpm audit --audit-level high` in CI through `ci-audit-step.sh` (bounded retry 3×60s for documented registry outages; exit-code discipline regression-tested three ways: `ci-audit-step.test.mjs`, `ci-audit-gate.test.mjs`, `ci-workflow-policy.test.mjs`) + `ci-audit-check.mjs` applying `docs/quality/security-exception-register.json` (fail-closed register parsing; PROPOSED/unknown/REJECTED block; OWNER_ACCEPTED prints every run; stale detection; exit 2 = retryable tool failure). Register currently: one entry, braces GHSA-vfj7-8cjw-p6xm, terminal `REMEDIATED_BY_ELIMINATION` (micromatch replaced by `tools/micromatch-shim` over picomatch 2.3.2, PR #317) — with auto-re-blocking if braces re-enters the graph.
3. **ReDoS hardening** — pnpm overrides (`package.json:37–46`) eliminating brace-expansion/micromatch/source-map-js/postcss-selector-parser/fast-uri ranges; vendored-braces inventory guard keeping the 4 inlined dev-toolchain copies visible; parity + hostile-input evidence under `scripts/security/braces-elimination/`.
4. **CI hygiene** — `permissions: contents: read`; `--frozen-lockfile --ignore-scripts` install; single workflow; pinned pnpm; timeout; concurrency.
5. **Layered secrets-adjacent** — `validate.py` secret-pattern scan over the operations-control tree (gh[pousr]_, github_pat_, PRIVATE KEY — subset family); env-only secrets in vite dev middleware (no hardcoded keys — verified reads at vite.config.ts:181–182); SECURITY.md policy (no real user data before auth/isolation complete).

**What a static review can prove:** presence and wiring of the above; fail-closed logic of gates; register/ledger consistency; absence of secrets in the *current* tree (given the guard passes — itself only citable, not rerun here); lockfile-level elimination claims (verified against `pnpm-lock.yaml` structure).
**What it cannot prove:** absence of secrets in git *history*; runtime exploitability; immutability of GitHub action tags or the Cloudflare Pages provider config (out-of-repo); whether Replit sets any given env marker; integrity of the installed `node_modules` on any particular machine; that the audit exception's exploitability assessment is correct (it is an argument, not a proof); that no contributor bypassed gates via direct pushes before CI existed. No SAST (CodeQL/Snyk code) exists — first-party code security rests on review + tests only.

### E-UNV-008 (live negative controls for build-dependent guards)

**Build-dependent guards:** `check-bundle-budget.mjs` and `check-bundle-surfaces.mjs` (both require a real `vite build` output + manifest; surfaces additionally requires environment identity + anchored per-env baseline). `ci-audit-check.mjs` is network/tool-dependent (pnpm audit) — same class of "depends on external producer".
**Negative evidence that exists (co-located, synthetic):** budget suite (18 its: over-limit, ambiguous entry, stale html↔manifest mismatch, usage rejection) and surfaces suite (22 its: seeded temp dist trees — AMBIGUOUS_ENTRY, UNRESOLVABLE_REFERENCE, MISSING_EMITTED_FILE, UNACCOUNTED_ASSET, PATH_ESCAPE, MISSING/MALFORMED/DUPLICATE precache, UNVERIFIED/UNANCHORED environment, SURFACE_GROWTH with exact values, tolerance edges ±8/±16, baseline-schema weakening rejection, CLI exit codes with env scrubbing). These are strong *logic* negatives but run on **synthetic fixtures**, not live builds.
**Live negative controls:** none found — no evidence of a deliberate post-build mutation (e.g., appending bytes to a dist chunk and re-running the guard) or of a live `UNVERIFIED_ENVIRONMENT` CI incident *for the guards' own sake* (the F-024 hook breakage is an accidental live negative for `UNVERIFIED_ENVIRONMENT`, but it was never captured as deliberate evidence, and it is a *local/Replit* environment, not CI). The R8/R9 records do contain genuine live CI failures of `SURFACE_GROWTH` (run 38118248772, check-run 114407518003 — baseline provenance :9–10) — i.e., the growth leg has *accidental* live positives-to-negative evidence; the environment-failure leg has only the accidental hook breakage. **Recommendation input:** one controlled live drill (CI job or local script) that (a) runs build+guards on a clean head, (b) mutates one lazy chunk +1KB and re-runs expecting `SURFACE_GROWTH`, (c) runs with `CI=1` expecting `UNVERIFIED_ENVIRONMENT` — would convert the accidental evidence into a dated, repeatable negative control and simultaneously serve as the F-024 regression test for whichever option is chosen.

### E-UNV-009 (Python guard negatives — gap confirmation + strongest safe static verification)

**Gap confirmed (F-030):** `design-token-guards.py` and `theme-contrast-guard.py` have zero tests of any kind; their sibling JS guards all carry negatives. Both are wired into the merge-blocking `pnpm design-guards` chain (package.json:11) — a silent regression in either (e.g., a broken regex, a zone parser that returns empty zones and thus "no violations") would pass CI forever.
**Strongest safe static verification available read-only (this review):** line-by-line logic audit — performed: zone parsing `token_definition_zones` (design :96–111) uses regex-initiated brace matching (handles `:root.dark`/`:root`/`.dark`/`@theme`); retired-values ban applies zones-included with comments stripped (:114–126, :122–127); dark-owner single-source rule (:128–149); scale rules per-part with depth-aware splitting (:165–204); TSX scan skips `.test.` files and href/import contexts (:207–222); color-scheme presence (:225–236); brand-asset retired scan with documented PNG/ICO limitation (:254–270). Contrast guard: WCAG relative-luminance math verified correct (sRGB linearization :30–48); token resolution var()-chains with cycle guard (:74–84); pair matrix is explicit and complete for both themes with unresolved-token fail (:187–208). No dead rule, no inverted comparison, no silently-swallowed exception found in either file.
**Recommended next verification (write-path, for the owner):** import the pure functions (`luminance`, `contrast`, `parse_zone`, `resolve`, `hex_or_none`; `token_definition_zones`, `scan_css_colors`, `scan_css_values`, `scan_tsx_colors`) from a vitest or unittest file with temp CSS/TSX fixtures containing one violation per rule (raw hex outside zones, retired value inside a zone, off-scale spacing, contrast pair at 4.4:1, missing color-scheme) — the engines are already import-safe except theme-contrast's module-level live-file reads (:93–97), which should be refactored behind `main()` or parameterized (small, guard-strengthening-only change; the R8-N1 reanchor precedent shows the ledger path for the size delta).

---

## 6. New findings (not in the R10-A set)

| ID | Finding | Evidence | Severity | Disposition recommendation |
|---|---|---|---|---|
| **RV4-N1** | **226 `*.test.ts` files under `apps/prototype-web/client/src` are excluded from all typechecking** — app tsconfig `exclude: ["**/*.test.ts"]` (matches `*.dom.test.ts` too) while 115 `*.test.tsx` ARE checked; root tsc covers only root `src`/`tests`. No documented rationale; the `.ts`-vs-`.tsx` asymmetry indicates drift, not design (cf. the analogous lint gap fixed by W4-D/F-044 for root client tests, eslint.config.js:455–458). | `apps/prototype-web/tsconfig.json:2–3`; census 226/115; root `tsconfig.json:14` | **Medium** | Short: change exclude to `**/*.test.{ts,tsx}` is wrong direction — instead *remove* the test exclusion (or add a parallel `tsconfig.test.json`) and fix whatever type errors surface. Long: make "every test file is typechecked" an invariant with a small coverage guard (count test files vs tsconfig include). Expect a fixing PR to be non-trivial (226 files may hide real type drift) — schedule as own slice. |
| **RV4-N2** | `check-file-size-ratchet.mjs:288` treats `CI="1"` as *not CI* (string-strict `"true"`), unlike `check-bundle-surfaces` which treats any non-empty `CI` as an unknown-CI marker. Two different CI-semantics in sibling guards; the ratchet's drift audit would degrade to warn-only under a `CI=1` environment. | `check-file-size-ratchet.mjs:288` vs `check-bundle-surfaces.mjs:103–104` | Low | Unify: accept `CI` non-empty ≠ "false" as CI-ish in the ratchet too (mirroring surfaces), with a dated comment; add a unit test for `CI="1"`. |
| **RV4-N3** | `apps/prototype-web/vite.config.ts` is outside every static gate: no eslint (CLI scope), no typecheck (`tsconfig.node.json` includes it but **nothing references that config** — verified), size-ratchet exempts it (`CONFIG_FILES`, ratchet :70). It owns `manualChunks`, PWA precache `globPatterns` (the R8-N1 root), and the dev secrets middleware. | `tsconfig.node.json:21` (unreferenced — grep); `package.json:21`; ratchet `CONFIG_FILES:70` | Medium (Low effort) | Short: wire `tsc -p apps/prototype-web/tsconfig.node.json` into `prototype:check` (or add `references`). Long: consider a config-file lint/coverage note in the guard table. |
| **RV4-N4** | `.replit` postMerge `timeoutMs = 180000` (3 min) is likely insufficient for install+typecheck+production-build even warm-cached; if F-024 Option A/B revives the hook, it will probably die on timeout next. | `.replit:19`; CI's far-larger budget (`timeout-minutes: 45` for the whole chain) as scale reference | Low (conditional) | Fold into the F-024 decision: any revival must re-derive the timeout from a measured run. |
| **RV4-N5** | `tools/micromatch-shim` (609 lines, the security-critical micromatch replacement shipped as a workspace package) is outside lint/typecheck/prettier; covered only by parity tests, hostile-input evidence, and the size ratchet. | B.6; `pnpm-workspace.yaml:3` (`tools/*`) | Medium | Short: add `tools` to eslint CLI with a minimal rules block (`.js` files need a config block anyway). Long: migrate shim to TS or accept documented exemption with a dated reason. |
| **RV4-N6** | `check-secrets` underreports multi-occurrence findings (first match per pattern per file) — audit/remediation completeness gap (not a gating gap). Fold into F-027 remediation. | `check-secrets.mjs:96–105` | Low | Iterate all matches (`/…/g` + `matchAll`) while keeping values unprinted; update the count in the FAIL line. |
| **RV4-N7** | Python test skips unguarded: `check-test-focus` covers only vitest vocab; `@unittest.skip/@skipIf` in `scripts/operations-control/test_operations_control.py` (and any future Python tests) can silently disable tests. | `check-test-focus.mjs:55,58–61`; `test_operations_control.py` | Low | Extend check-test-focus with a Python rule (regex `@unittest\.skip|\.skipIf\(` over `scripts/**/*.py`), or document the exclusion honestly in the guard header. |
| **RV4-N8** | Secrets guard scans the working tree only — git history is not scanned; a removed-but-once-committed secret persists in packfiles undetected. | `check-secrets.mjs:60–93` (fs walk) | Low/Info | Document as a known limit in the guard header + SECURITY.md; optionally add a one-off (or scheduled) `git log -p` scan tool with the same pattern families. |
| **RV4-N9** | `ci-workflow-policy.test.mjs` pins triggers/wiring/fetch-depth but not action refs, node-version, or permissions — the F-025 exposure has no machine tripwire. | whole file read; absence verified | Low | Add assertions: every `uses:` matches `@<40-hex-sha>` (after pinning), `node-version` matches a pinned literal, `permissions: contents: read` present. |
| **RV4-N10** | `actions/checkout` runs with default `persist-credentials: true`; benign today (read-only token, trusted steps) but unnecessary credential lifetime in the runner. | ci.yml:33–37 (no override) | Info | Set `persist-credentials: false` in the same PR as SHA pinning. |
| **RV4-N11** | FOCUS_REGEX misses vitest `.fails(` (expected-failure focus modifier). | `check-test-focus.mjs:55` | Info | Add `fails` to the alternation with a dated comment (guard strengthening only). |

---

## 7. Unverified limits (honest bounds of this review)

1. **No execution:** lint warning count at HEAD (F-026), guard pass/fail at HEAD, test suites, builds — none executed (read-only mandate). All "PASS/35 warnings" figures are citations of in-repo evidence, re-checked for internal consistency only.
2. **Replit runtime behavior:** whether the Replit postMerge runner sets any env markers (`REPL_ID`, `REPLIT_DEV_DOMAIN`, …), whether the hook currently surfaces its failure to the owner, and actual Node version inside the `nodejs-20` module — statically unknowable from the repo. Option B's marker choice and Option A's toolchain-stability both require one live Replit run.
3. **Provider-side config:** Cloudflare Pages project settings (build command, environment) are out-of-repo; the `cloudflare-pages` baseline record is provenance prose citing check-run IDs — trusted as repo content, not independently verified.
4. **Git history secrets scan:** not performed (would require `git log -p` over full history — feasible but out of read-only spirit for this pass; flagged as RV4-N8 gap instead).
5. **The 35 lint warnings' individual identities** cannot be enumerated without running eslint (families and scope verified; counts are evidence-cited).
6. **pnpm 9 vs workspace-yaml overrides semantics** asserted from the pinned packageManager version and the lockfile's resolved versions (3.3.18 ≠ 3.3.7) — the version-behavior mapping (workspace overrides = pnpm v10 feature) is tool knowledge, corroborated but not executable here.
7. **In-repo R8/R9 evidence documents** (worklogs, preflight package) were read as repository content and their load-bearing claims re-verified against live source; their historical claims about past runs (CI run IDs, byte counts) are citations, not re-run.

---

**No writes were performed to the repository.** The only file created is this report at `/home/z/my-project/r10b/scratch/reviewers/reviewer-4-tests-guards-ci-operability.md` (outside the clone).
