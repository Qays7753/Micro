# AUDIT-CORRIGENDUM — 2026-09-25
## Corrections and supplements to the previous audit evidence (branch `audit/micro-comprehensive-uiux-architecture-20260924`, head `159e3d57`)

This investigation (`reports/micro-full-financial-logic-uiux-investigation-2026-09-25/`) examined the same commit (`c02fb458`) as the previous audit. During reconciliation, the following prior-recorded values proved imprecise. Each correction below is evidence-backed and was re-verified by at least two independent counting methods. No prior artifact was modified; corrections live only in this new package.

### C-01 — AUD-002 unsmoked route count detail (recurring ×4, not ×3)
The previous audit recorded the renderSmoke gap as "9 unsmoked (recurring x3, finance/more, finance/upcoming, loans/received x2, redirect)". Exact enumeration at `c02fb458` shows the recurring family contributes **4** unsmoked patterns (`/finance/recurring` list + 3 dynamic sub-routes), keeping the total at 9 but correcting the family split. Evidence: `R2.renderSmoke.test.tsx` array vs `MicroRouter.tsx` route registry, counted independently by FI-1 and FI-5. The previous total (9) and the AUD-002 finding itself stand unchanged.

### C-02 — STRUCTURE-SCAN "1205 micro-* selectors" is not reproducible as stated
Actual metrics at the same commit: `index.css` = **6,837 lines** (prior AUD-016 said 6,838 — off by one), **1,160** rule blocks containing `.micro-*`, **1,311** selector occurrences, **465** unique `.micro-*` selector names. The prior "1,205 selectors" figure appears to have used a different counting method (likely block-level). The monolith finding (AUD-016) and the dual `.micro-field-error` definitions at lines 1052 and 4219 are re-confirmed exactly.

### C-03 — AUD-012 reverse-import count reconciled
Prior records variously said "12-14 reverse imports" and "14 files". Exact count at `c02fb458`: **12 files / 14 import statements** in `application/` importing from `presentation/`, of which **5 statements in 5 production files** (remainder are test files). FI-1 additionally identified the root cause: the pure leaf helper `englishNumeric` housed in `application/` (see FI-024/FI-019 in FINDINGS.tsv).

### C-04 — AUD-011 (font preload / FOUT) reclassified FIX_NOW → DEFER
Runtime frame-by-frame evidence this investigation (S4, FOUT frames + `document.fonts` timing) shows the Alexandria variable font loads at ~281ms — **before any user-visible text renders** — and **no FOUT was observed** in cold-load captures. All 11 font faces are locally hosted with `font-display: swap`. The prior "first-paint flash" risk is therefore much weaker than recorded. Optional hardening (`rel=preload`) remains sensible for slow networks. See FI-034.

### C-05 — VIS-015 (populated states NOT_EXECUTED) is now closed
The previous visual pass could not review populated states because producing records was prohibited in that mission's environment. This investigation ran on the live deployment (`https://micro-prototype.pages.dev`, proven build of `c02fb458`) inside a fresh disposable browser profile, with network-silence proof (2,953 requests, 100% GET, 0 data-bearing) and synthetic data only (prefix `UXFLASH-INVESTIGATION-20260925`). Populated captures now exist for all four surfaces at 320/360/390/412/430 plus dark mode, with a reconciling final census (12 records / 11 stores; cash math: +12.75 sale, −2.50 expense, declared net cash movement 10.25). Classification: DISPOSABLE_LOCAL_ONLY — no real data, no server writes, profile deleted after census backup.

### C-06 — VIS-014 (route-loading unreachable) closed with measured evidence
Route-change latency is measurable on cold profiles: ~440ms click→h1 for `/finance` with the honest `role=status` loading text visible (routeLoading true ~300ms). On warm loads the service worker serves chunks with `transferSize 0`, making route loading effectively instant. The prior NOT_EXECUTED gap is replaced by a measured, honest result. See FI-033.

### C-07 — Measurement-artifact lessons (audit-integrity, extends AUD-000 / VIS-018)
Two artifact classes recurred this investigation and are documented to prevent future false positives:
1. **Pre-navigation census pageerrors**: 8/8 `pageerror` events in the browser log were `"undefined"` unhandled rejections raised by the audit harness's own storage census against `about:blank` (SecurityError) *before* the first navigation of each run. Fourteen navigate-first runs produced zero pageerrors and zero console messages of any kind. No app-origin uncaught exception exists in any run.
2. **content-visibility text extraction**: reading `innerText` of headings inside `content-visibility:auto` containers before they enter the viewport returns empty strings (re-confirmed; same class as the retracted VIS-018). Future probes must scroll elements into view before reading text or use `scrollIntoView` + bounding-box checks.
3. **Bracket-m display artifacts** (AUD-000, RETRACTED-R1/R2): the prior session's lesson remains standing; this session verified all headline code citations first-hand via `sed -n` reads (no tool-display-mediated quotation) and additionally re-verified F1/F2 defect citations byte-level before publication.

### C-08 — Prior STRUCTURE-SCAN row 18 ("95 error") precision
Root-level non-test files at `client/src` root = 90 production + 5 test-adjacent; the prior "95 error" count conflated the two. Boundary conclusion unchanged (composition root is exempt by design; test files remain unguarded — AUD-012 stands).

### C-09 — Token-inventory alias counts
Two of eight spot-verified TOKEN-CONSUMER-INVENTORY rows carry alias-mediated consumer counts off by 1-2 (direct vs `var(--color-border)` alias mediation). Directional conclusions (dead tokens 48/130 exact; `--vf-tint` triple duty) all hold. A NEW latent finding (circular alias pair `--color-border` ↔ `--border`, index.css:38 vs :69) is recorded as FI-022.

### C-10 — What was NOT corrected
All other prior findings re-verified at `c02fb458` hold as recorded: AUD-001, AUD-004 (selected==hover exact), AUD-005 (now runtime-proven with typed money), AUD-006, AUD-007, AUD-008/VIS-002, AUD-009/VIS-001 (three-mechanism duplication re-verified on Home), AUD-010, AUD-013 (48/130 dead exact), AUD-015 (Field 0-consumer; inline usages now counted 495 production), AUD-016 (dual definition exact), AUD-019, AUD-020, AUD-021, AUD-022, AUD-023, AUD-024, AUD-025, AUD-026; VIS-001..VIS-013, VIS-016; the RETRACTED-R1/R2 retractions remain correct and are upheld with independent `od -c` proof this session (FI-5).
