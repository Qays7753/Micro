# R9 Preflight — Reviewer 5: Hostile Evidence Review (R9-PF-R5)

**Date:** 2026-10-10 · **Reviewer:** general-purpose (Reviewer 5 — Hostile Evidence)
**Tree reviewed:** `/home/z/my-project/work/micro/repo` detached at `8b3c9aeb09ca33ed66f0a929c157b668839d0463` == origin/main (R8 post-merge reconciliation merge; parents `87274cf9` = R8 merge of PR #345, `5e40a610` = docs reconciliation). Read-only; no repo file touched.
**Method:** Read/Grep/Glob + read-only git (`show`, `log`, `merge-base --is-ancestor`). No builds, no test runs, no installs. Evidence discipline: every claim labeled **VERIFIED** (file:line), **INFERRED** (basis), or **UNVERIFIED** (why).

---

## 1. R8-N1 closure chain — hostile verification

Canonical report: `docs/operations/control/evidence/structural-remediation-r8-20261010/R8-N1-PWA-PRECACHE-ROOT-FIX-EXECUTION-REPORT-2026-10-10.md` (read in full).

### (a) One canonical precache selection path — VERIFIED
- `apps/prototype-web/vite.config.ts:247-300`: `includeManifestIcons: false` (:266); **no `includeAssets` anywhere in the file**; single selector `workbox.globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"]` (:295) + `globIgnores` (:296); dated W2+R8-N1 design comment (:250-265).
- Historical proof of the pre-fix state: `git show 7341f911 -- apps/prototype-web/vite.config.ts` shows the removed 6-pattern `includeAssets` block (pre-image `c25cd180`). Merge ancestry verified: `7341f911` and closure head `facee8bd` are both ancestors of merge `87274cf9` (`git merge-base --is-ancestor` → true for both).

### (b) Guard fails closed on duplicates/malformed — VERIFIED
- `apps/prototype-web/scripts/check-bundle-surfaces.mjs`: failure code `DUPLICATE_PRECACHE_URLS` (:87-88); URL extraction regex `\{url:"([^"]+)",revision` (:318); zero entries → `MALFORMED_PRECACHE` (:319); duplicates collected and returned as a hard error with full list and count (:320-344); `main()` exits 1 on any `measured.error` (:425-427). Path-escape and missing-file fail-closed preserved (:329-334).
- Execution surface: `apps/prototype-web/package.json:9` — `"build": "vite build && node scripts/check-bundle-budget.mjs && node scripts/check-bundle-surfaces.mjs"` → the guard runs in every real build (local, CI `pnpm check` → `prototype:build`, Pages build). VERIFIED.
- Hostile nuance (theoretical blind spot, undisclosed): duplicate detection only sees `{url:"...",revision`-shaped entries. If a future toolchain emitted revisionless plain-string manifest entries, they would be invisible to both the count and the duplicate check (total shape change still fails `MALFORMED_PRECACHE` at :319, so the fail-closed property holds for format disappearance, not for partial format mixing). The live emitted shape matches the regex (see (d)). **INFERRED residual risk — low; deserves a one-line disclosure in R9.**

### (c) Deterministic tests — VERIFIED
- `apps/prototype-web/scripts/check-bundle-surfaces.test.mjs`: exactly **22 `it()` cases** (counted with `rg -c '^\s*it\('`), all fixture-based in temp dirs, no network. The four R8-N1 cases match the report's claims: single duplicate with exact count + URL list + "R8-N1" marker (:259-277); multi-duplicate lists all (:279-290); clean manifest measures unique count (:292-298); CLI exits 1 end-to-end (:440-448). Companion budget suite = 18 cases (matches "40/40 = 18 budget + 22 surfaces").

### (d) Reported numbers (31→0; +76,466 B) and artifacts — PARTIALLY VERIFIED / UNVERIFIABLE IN-REPO
- The numbers are consistently recorded: R8-N1 report §2/§4 (187/156/31, −76,466 B overcount, category table of 156 URLs); R8-COMPLETE §6/§8/§15; R8-1 report :35 (+76,466 B quantified correction); register §7 notes :1495/:1501; state-log §163; `bundle-surfaces-baseline.json` seed_note (:8) and `precacheEntryCount: 156` in all three environment records (:44, :72, :104). VERIFIED (as records).
- **No machine-readable before/after precache inventory artifact exists in the repo.** The report says the set comparison (lost=[]/gained=[]) and verbatim guard outputs are "recorded in the PR evidence" — i.e., the PR body on GitHub, external to the tree. UNVERIFIED from the live tree (by design, but a hostile reviewer must state it).
- Corroboration (INFERRED): the untracked working-tree build output `apps/prototype-web/dist/public/sw.js` (mtime Oct 10 13:55, post-fix era) contains **exactly 156 `{url:"...",revision:"..."}` entries, 0 duplicates** (verified by extraction + `sort | uniq -d`), including `manifest.webmanifest`, and its emission shape matches the guard regex exactly. Untracked artifact → cannot prove it was built from HEAD, but it matches the post-fix state precisely.

### (e) Baseline re-anchor through the ledger — VERIFIED
- `apps/prototype-web/scripts/bundle-surfaces-baseline.json`: `swRuntimeRawTotal: 26170` in **all three** environment records; `local` anchored at head `7341f911...` with method = actual local production build (:18-21); `cloudflare-pages` and `github-actions` = same-tree re-anchors with the sw.js environment-invariance argument and **superseded anchors preserved inside dated method strings** (Pages production fetch of `1e267864`; CI dispatch run `38046254527` on `a69f1e14`) (:49-52, :77-80). Dated `seed_note` correction explicitly closes the old "separate track" language (:8). VERIFIED.
- Ratchet ledger: `scripts/file-size-ratchet-reanchors.json` entry **`R8-N1-ROOT-FIX`** (:43-59): path `apps/prototype-web/scripts/check-bundle-surfaces.mjs`, from 457 → to 467 nbLOC (WATCH), reason/authorization/trigger chained — the R8-3 precedent followed. Ratchet baseline carries the live value: `scripts/file-size-ratchet-baseline.json:1491-1494` = 467 WATCH. VERIFIED.
- Hostile note (medium-low): the two cloud records were **not independently measured in those environments at the code head** — they are re-anchors from the local build plus an invariance argument, "verified by the CI and Cloudflare Pages runs on the final PR head (URLs pinned in the PR body)". In-repo, a skeptic cannot confirm those runs; the argument is sound (fixed-length hex revisions; all three environments measured 28,885 pre-fix) but the verification is externalized.

### R8-N1 chain verdict
**HOLDS on the live tree.** All five sub-claims verify at the code/config/test/ledger level; the reduction (28,885→26,170) is locked, not tolerated; the regression class is real, deterministic, and in the build chain. The only unverifiable-from-tree pieces (build experiment outputs A/B/C, set comparison, final-head CI/Pages run URLs) are externally pinned in the PR body — disclosed, but the repo alone cannot reproduce them.

---

## 2. R8 finding dispositions — verification against the live tree

Finding list extracted from `R8-0-PREFLIGHT-AND-REPAIR-CARDS-2026-10-10.md` §5 (cards 5.1-5.6) and `R8-COMPLETE-PR-READINESS-REPORT-2026-10-10.md` §6: **R8-F-005, R8-F-006, R8-F-019, R8-F-020, R8-F-021, R7-CF-REPAIR, R8-N1** — all marked FIX_NOW → CLOSED_WITH_EVIDENCE.

| ID | What closed it (live) | Verdict |
|---|---|---|
| R8-F-005 (TFV pin unenforced) | Ratchet v2 exact-value baseline: `file-size-ratchet-baseline.json:635-637` (`transferFamilyValidators.ts` 1730 nbLOC SPLIT_NOW) + binding `historical_growth_evidence` provenance (:10) + TFV register row dated note (register:39) | **VERIFIED** |
| R8-F-006 (silent within-band growth) | v2 census (488 files, exact nbLOC), within-band rejection, merge-base drift audit, chain-validated ledger; 20 deterministic tests counted in `scripts/check-file-size-ratchet.test.mjs`; register :1497 dated note | **VERIFIED** |
| R8-F-019 (Finance cycle regression) | Rule R7 in `scripts/check-module-boundaries.mjs:396-406` (component→page, resolution-based); `COMPONENT_TO_PAGE_BASELINE = []` explicitly empty at founding (:277-281); 25 tests counted | **VERIFIED** |
| R8-F-020 (filename classifier) | Manifest-closure classification in `check-bundle-surfaces.mjs:213-368` (isEntry/isDynamicEntry/imports/dynamicImports; no filename heuristics) | **VERIFIED** |
| R8-F-021 (guard metadata) | `REFACTORING-PLAN-A-TO-Z.md` §4.3.1 title = "الحراس الـ19 الدائمة الموثقة" (:185) with dated R8/F-021 correction naming both build-only guards; 3 mentions of the bundle guards in the plan | **VERIFIED** |
| R7-CF-REPAIR (+512 bridge) | No +512 fields anywhere in the baseline; tolerances raw 8 / gzip 16 with hard caps 16/256 enforced by `validateBaseline` (:160-165); three environment records with provenance; normalized gzip identical (363,974 / 70,716) across all three records | **VERIFIED** |
| R8-N1 | See §1 | **VERIFIED** (chain level) |

- No `deferred` language for a current defect found anywhere in R8 evidence. The only "separate track" occurrences are dated-historical and explicitly superseded (see §7).
- No baseline/ceiling change hidden as maintenance: ceilings 650,000/155,300 verified in `check-bundle-budget.mjs:32-33` and untouched; the swRuntime change is a **reduction** locked same-PR; guard growth 457→467 went through the ledger; the R8-4-CI-ANCHOR baseline-data growth (76→108) also went through the ledger.
- Count: **7/7 dispositions verifiable in-repo** at code/test/baseline/doc level. What is NOT verifiable in-repo: the environment-level run evidence (CI dispatch runs, Pages check-runs, final-head runs) — external URLs by protocol.

---

## 3. R6 scan findings — spot verification (13 of 27)

List extracted from `R6-PREFLIGHT-STRUCTURE-ARCHITECTURE-CODE-ORGANIZATION-SCAN-2026-10-09.md` §9 (F-001..F-027) and `R6-OWNER-REVIEW-AND-DECISION-PACKAGE-2026-10-09.md` (wave dispositions W1/W2/W3 + protected PRESERVE/OUT_OF_SCOPE set).

| Finding | Live verification | Verdict |
|---|---|---|
| F-001 (racy StateRecovery test) | `StateRecovery.w44.dom.test.tsx:100-129`: releaseRead deferred-promise gate implemented per the Home.dom.test.tsx:157 precedent; loading-state assertion kept (:127) | **VERIFIED** |
| F-002/F-003 (register §1==§2==live; 4 sibling rows) | Register §1 re-issued (681/47/13/9/3/4 = 757) with dated from→to correction (:27) and §12 tracked-count correction; Wave-F sibling rows present; **but the equality is now stale at the R8 head — see Hostile Finding 1** | **VERIFIED then; equality now stale** |
| F-004 (craft-order card) | Register :44 — nine-element card completed, dangling pointer fixed, dated +14 note; §7 disposition row :1474 | **VERIFIED** |
| F-005 (TFV pin) | Dated growth note on the row (register:39) + R8-2 enforcement (see §2) | **VERIFIED** |
| F-006 (within-band community) | §7 dispositions table (register:1474 area) + v2 ratchet with provenance binding (`file-size-ratchet-baseline.json:10`) | **VERIFIED** |
| F-009 (text-density split) | Live: `scripts/text-density-count.py` (19,577 B engine) + `scripts/text_density_policy.py` (69,032 B policy/ledger) + `scripts/text-density-count.characterization.test.mjs` + `docs/fixtures/text-density/w3-characterization.golden.txt`. Deviation from the card's prediction ("file drops to NORMAL"): engine landed **WATCH 458** — honestly recorded in R6-W3 report and register :1493 | **VERIFIED** (with disclosed prediction miss) |
| F-011 (types.ts PRESERVE card) | Register :55 — complete nine-element PRESERVE card dated R6-W1, Wave O exit | **VERIFIED** |
| F-017 (UI structural packages → R7) | All R6-F17-P01..P11 view models live with tests: `application/finance/financeState.ts`+test, `financialEventEditorModel.ts`+test, `agreements/orderDetailViewModel.ts`+test, `direct-sales/directSaleEditorModel.ts`+test, `finance/statementViewModel.ts`+test | **VERIFIED** |
| F-019 (mixed SCC) | `components/finance/FinancePeriodResultSection.tsx:11` imports `FinanceState` from `@/application/finance` — no pages/Finance edge; R8-3 rule guards the class | **VERIFIED** |
| F-020 (lazy filter) | Manifest-based classifier live (see §2) | **VERIFIED** |
| F-024 (acceptance anchors) | `scripts/check-acceptance-value-anchors.mjs:373` — all six families (inventoryMovementType, catalogItemKind, scheduleStatus, yieldReadiness, shortCashDeclaration, expenseContext) double-pinned; register :1491 dated note (221→363 nbLOC) | **VERIFIED** |
| F-026 (plan §23.8 addendum) | Dated addendum exists after the §23.8 table (plan :1701+). **But it still says "R7 (لم يبدأ)" / "R8 (لم يبدأ)" — stale after both waves merged (Hostile Finding 5)** | **VERIFIED with new staleness** |
| F-022/F-023/F-025/F-027, F-010/F-013..F-016/F-018 | PRESERVE/OUT_OF_SCOPE dispositions recorded in the owner package; no reopening triggers observed in R7/R8 evidence | **VERIFIED (disposition level)** |

**Reopenings: none found. Deepenings: none found. Closures whose evidence no longer fully holds: one partial — F-002's "§1 == live tree" equality (see below).**

---

## 4. R7 evidence — load-bearing closures verified live

R7 finding/repair-card list = R6-F17-P01..P11 (11 UI packages, R7-0 §3/§4 census) + the 9-shim compatibility closure (R7-5) + R7-CF-REPAIR (Cloudflare). Five load-bearing closures verified:

1. **Component→page rule enforcement (R8-3, closing F-019's guard gap):** VERIFIED — rule R7 in `check-module-boundaries.mjs:396-406`, empty owner-reviewed exception baseline (:277-281), 25 tests.
2. **Shim removals with zero-consumer proof (R7-5):** VERIFIED — live `application/` tree contains no shim units (directory listing + rg for shim/COMPAT markers = 0 hits); R7-5 report §3 documents the post-removal 0-import census across src/client/scripts/tests, with the only residuals being synthetic test fixtures and baseline notes.
3. **Journey tests:** VERIFIED — `FinanceJourneys.dom.test.tsx`, `OrdJourneys.dom.test.tsx` (+ `OwnerJourneysExe009`, `PurchasingBridgeExe011`, `InventoryAdjustExe012` per R7-0 census) exist live.
4. **Cloudflare gzip-variance repair → R8 normalized-gzip anchoring:** VERIFIED at the measurement level — `bundle-surfaces-baseline.json` records **three environment identities**: `local` (node v24.21.0, zlib 1.3.2.1-motley, linux/x64, identityMode null-fallback), `github-actions` (node v22.23.3, zlib 1.3.1-e00f703, linux/x64, env), `cloudflare-pages` (provider-opaque, platform "cloudflare-pages", env); `lazyGzipNormTotal` **363,974** and `initialGzipNormTotal` **70,716 identical in all three** — the R7-era variance class (+207 Pages un-normalized lazy gzip; +167 CI run-to-run swing) is eliminated by deterministic normalization (hash-name + build-identity canonicalization, `normalizeForGzip` :129-148), with evidence-derived tolerances (raw 8 = 2×±4 identifier shift; gzip 16) under hard caps.
5. **R7-COMPLETE report truthfulness:** VERIFIED — DATED CORRECTION block prepended (post-push, pre-merge) recording the Cloudflare failure at `47490e52`, the REPOSITORY_BUILD_FAILURE diagnosis, and the +512 interim repair, with historical values explicitly superseded.

---

## 5. Operations Control truth

- `WS-216.json`: status `IN_PROGRESS`; `next_action` = "R8 VERIFIED_ON_MAIN at merge commit 87274cf9... (PR #345; post-merge CI 38060781329...) R8-N1 is FIX_NOW — CLOSED_WITH_EVIDENCE... next authorized operation is R9 preflight... R9 is NOT started. BRANCH_AND_PR_ONLY; no cleanup." — **VERIFIED consistent** (file :34, notes :69).
- `ARCH-007.json`: same live fields (:167 next_action; evidence list ends with the R8-N1 report, merge commit, post-merge CI run/job). **VERIFIED consistent.**
- `current-state.md:104`: R8 verified @ 87274cf9; R8-N1 FIX_NOW — CLOSED_WITH_EVIDENCE; R9 preflight next. **VERIFIED.**
- Generated views (`ACTIVE-WORK.md:7`, `AGENT-BRIEF.md:37`, `MASTER-TRACKER.csv`) carry the identical next_action — generator-linked, no hand-edit divergence. **VERIFIED.**
- **INCONSISTENCY (Hostile Finding 4):** `WS-216.json:72` `verified_on_main_sha` = `74908e13...` (the **R7** merge) — one wave stale against `merge_sha` = `87274cf9` (:71) and the next_action text. The R8 post-merge reconciliation updated merge_sha/base_sha/next_action but missed this field.
- State log (`docs/operations/current-state-log.md`, 2,202 lines): last three entries = **§163** (R8-N1 root-fix closure on PR #345), **§164** (append-only correction of a §163 typo: entry gzip 154,300 → 154,683 — good discipline), **§165** (R8 post-merge verification + R9 gate opened, R9 not started). Content **VERIFIED**. **Numbering continuity DEFECT (Hostile Finding 3):** there are **two sections numbered §161** — :2161 ("مصالحة R7 قبل الدمج وفتح بوابة R8") and :2175 ("R8: موجات الحراس... PR-ready") — the second appearing *after* §162 (:2169), i.e., duplicate number AND out-of-chronological-order append.
- `AGENT-SEQUENTIAL-WORKLOG.md` (1,112 lines): last entries = Entry 78 (R8-N1 closure), **Entry 79** (R8 post-merge verification and R9 gate). Content **VERIFIED**. Same class of defect: **two Entry 76s** — :1067 (R7 pre-merge reconciliation) and :1083 (R8 execution), the second after Entry 77 (:1076).
- Repo-wide `R8-N1` grep: 40 mentions across 12 files; every "defer/separate track" occurrence is dated-historical and superseded (see §7). **No live deferred language for R8-N1.**

---

## 6. Duplicate sources of truth — challenge results

- `TEST-AND-DOCUMENTATION-MAP.md` ↔ `generated/test-map.json`: **linked, not duplicated** — the .md declares the JSON as its generated evidence source, generator `scripts/generate-test-map.mjs`, drift pin `generate-test-map.test.mjs` (header, lines 1-9).
- Operations Control JSON ↔ generated views: generator-linked (`generate_tracker.py`); no hand-edited view found.
- Bundle ceilings: single owner `check-bundle-budget.mjs:32-33` (650,000/155,300); the surfaces guard explicitly reports-only for the entry and prints "check-bundle-budget owns the 650,000/155,300 ceilings" (:437). **No second ceiling source.**
- Surfaces baseline: single v2 file; the R7-era single baseline and +512 fields are gone; no leftovers.
- **Real divergence found (Hostile Finding 1):** register §1/§2 (documentation, 757 rows, head `fd92d7e8`/R6-W1) vs ratchet v2 baseline (enforcement, 488 files exact census, R8-2 commit). The register's own verification note ("التطابق الحي: WATCH 47 صفًا = 47 مفتاح WATCH في file-size-ratchet-baseline.json") was true against the v1 baseline and is **no longer true** against v2 (51 WATCH keys / 488 files). Different scopes (register counts tests/fixtures too), but the equality claim is stale and no dated supersession note exists at the R8 head.

---

## 7. Stale-language sweep (docs/ tree)

- **'R8-N1' + defer / separate track:** residual hits, ALL properly dated/superseded: (1) register :1495 (R8-1 dated note, Arabic "مسار منفصل بمحفز صريح") — superseded by the R8-N1 note at :1501; (2) `bundle-surfaces-baseline.json:8` seed_note — historical portion + same-string dated correction; (3) R8-1 report :7 — dated correction header; (4) R8-COMPLETE :55 and :101 — strikethrough `~~SEPARATE_TRACK~~` + dated correction; (5) state-log §163:2189 — describes the corrections themselves. **0 unsuppressed live hits.**
- **'131 method'/'129 method':** '129' = 0 hits. '131' hits: register :36, :811, :817, :822 — each carries an inline dated correction to 130 (R1/TG-01); `ZAI-POST-SCAN-STRUCTURAL-EXECUTION-CONTRACT-20261005.md:445` — dated 2026-10-05 contract (historical); AGENT-SEQUENTIAL-WORKLOG :16, :20, :140 — historical append-only log entries. **All properly historical.**
- **'155,000' (old ceiling):** ~15 hits, ALL in dated `status_history`/review records of closed workstreams (`workstreams/review/WS-177/178/179/182/183`, `WS-173`, `WS-200`, `WS-203`, `WS-215` [status VERIFIED], items FIN-001/006/008, MASTER-TRACKER FIN-002 dated D-038 row, reconciliation-2026-09-26 TSV). `AGENTS.md:143` carries 155,300 with the full dated raise history. **0 live-context hits.**
- **'37/29' / '36/28':** hits confined to closed workstream records, the dated FIN-002 D-038 decision (2026-09-22), and the dated reconciliation TSV; `AGENTS.md:143` documents the full 35/27→36/28→37/29→38/30 chain with dated corrections. **0 live-context hits.**
- **NEW stale find (Hostile Finding 5):** the migration plan §23.8 R6-W1 dated addendum (plan :1701+) still asserts, as current-status reconciliation, "R7 (لم يبدأ)" and "R8 (لم يبدأ)" — both waves have since executed and merged; no post-R8 addendum was appended. Low severity (state log + control JSON are the live truth), but it is exactly the class of "status text lagging reality" this sweep exists to catch.

---

## 8. Green-test overclaims

1. **R8-N1 report §7:** "runtime-precaching behavior is unchanged — Workbox deduplicated identical entries at runtime anyway" — **INFERRED presented as fact**: no runtime test covers this; it rests on Workbox precache-put semantics. Plausible, but should be labeled inference.
2. **Test #20 ("the committed live baseline is schema-valid with anchored environment records")** proves schema/provenance-shape validity only — not that baseline values correspond to any real build. Value-truth is proven by actual runs whose evidence (CI/Pages URLs) is external to the repo. The suite's name could be read as proving more than it does.
3. **"The duplicate condition cannot return silently anywhere"** is conditional on (i) the build chain running the guard (VERIFIED via package.json:9) and (ii) the sw.js emission shape continuing to match `\{url:"...",revision` (true today — verified against the live dist artifact; a partial format change to revisionless plain-string entries would evade the duplicate check while still counting as non-zero entries). Theoretical, undisclosed.
4. **R8-COMPLETE §17** "Surfaces guard CLI: `CF_PAGES=1` … against the production mirror — PASS (pages record verified)" is a *local* verification of the pages record against a fetched mirror — honestly labeled "local verification of the Pages record", but a careless reader could take it as a provider-side run.
5. **F-009 card vs execution:** the card predicted "file drops to NORMAL"; the executed engine landed WATCH (458 nbLOC). Not an overclaim — the deviation is disclosed in R6-W3 and the register — recorded here for completeness.
6. Positive counter-examples (claims properly scoped): the surfaces guard header explicitly lists what it does **not** prove (entry ceilings, per-chunk fairness — :28-33); the R8-4 CI bootstrap failure was documented as a deliberate red-to-anchor sequence, not hidden.

---

## Top 5 hostile findings (by severity)

1. **[MEDIUM] Register §1 "live equality" is stale at the R8 head.** The FILE-SIZE-AND-RESPONSIBILITY-REGISTER §1 summary (757 rows; WATCH 47; head `fd92d7e8`, R6-W1) was never re-issued at the R7/R8 heads, although the register's own §6 protocol promises comprehensive re-measurement at every structure-changing wave head and R7/R8 both changed structure. The enforced truth is now the ratchet v2 exact census (488 files, 51 WATCH); the register's "WATCH 47 = baseline keys" verification note (register:27) no longer holds, and no dated supersession note says so. R9's mandated map work is the natural place to reconcile or supersede.
2. **[MEDIUM-LOW] R8-N1/cloud-baseline evidence externalization.** Before/after precache inventories, verbatim guard outputs, and the final-head CI/Cloudflare run URLs live only in the PR body; the `github-actions` and `cloudflare-pages` swRuntime records are same-tree re-anchors from the local build justified by an invariance argument and verified by runs a repo-only reader cannot see. Disclosed, protocol-compliant, but in-repo verifiability has a hole exactly where the R7 failure story made environments matter.
3. **[LOW-MEDIUM] Append-only numbering defects in the two logs.** `current-state-log.md` has two §161 sections (the second appended after §162 — duplicate + out of order); `AGENT-SEQUENTIAL-WORKLOG.md` has two Entry 76s (the second after Entry 77). Content is correct and R8/R9-gate records exist, but the continuity invariant the logs exist to guarantee is broken in both.
4. **[LOW-MEDIUM] `WS-216.json` `verified_on_main_sha` is one wave stale** (`74908e13` = R7 merge) vs `merge_sha`/`next_action` (`87274cf9` = R8 merge) — an internal inconsistency inside the canonical control JSON that the R8 post-merge reconciliation missed.
5. **[LOW] Migration-plan §23.8 R6-W1 addendum still says R7/R8 "not started"** as current-status reconciliation, plus the undisclosed (theoretical) guard blind spot for revisionless plain-string precache entries (§8.3). Both are one-line fixes for the R9 package.

---

## Verdict summary

- **R8-N1 chain: HOLDS** — 5/5 sub-claims verified on the live tree (config, guard, 22 tests, baseline re-anchor ×3, ratchet ledger); artifact-level proof (inventories, run URLs) is externalized to the PR body by design and cannot be reproduced from the tree alone.
- **R8 dispositions: 7/7 verifiable in-repo** at code/test/baseline/doc level; 0 closed with weaker evidence than claimed; 0 hidden ceiling/baseline raises (one reduction, two ledgered guard-data growths, ceilings untouched).
- **R6-SCAN-F spot-checks: 13/27 verified live; 0 reopenings; 1 partial staleness (F-002's live-equality note).**
- **Stale-language sweep: 0 live-context violations**; all residual hits properly dated/superseded; 1 new low-severity staleness found (plan §23.8 addendum).
- **No blocking defect found.** The five findings above are reconciliation/hygiene items, none of which invalidates a VERIFIED_ON_MAIN claim; all are suitable inputs to the R9 preflight package.

*No repository file was read-modified-written, created, or deleted by this review. Output written only to `/home/z/my-project/work/r9-preflight/reviewers/reviewer-5-hostile-evidence.md` and the append-only worklog.*
