# R10-B W0 — Unverified-Area Research Report (E-UNV-001..012)

**Date:** 2026-10-11 · **R10B_BASE_SHA:** `ffc54eb1150932c9bba88b48a7c38275f2a3effa` ·
**Mandate:** canonical prompt §7 W0-B — re-check all 12 R10-A NOT VERIFIED limitations; classify each `VERIFIED` / `INFERRED` / `UNVERIFIED` / `NOT_EXECUTED` / `DEFERRED` / `BLOCKER`; never call an unexecuted check PASS.

**Method per item:** (1) what exactly was not proven; (2) can this environment prove it; (3) strongest safe verification executed (read-only: git evidence, source reading, committed artifact inspection — no builds, no browsers, no installs); (4) analogous-case search; (5) classification with sources.

---

## E-UNV-001 — Real-browser IndexedDB behavior

- **Not proven by R10-A:** engine-real transaction ordering/durability, multi-tab `versionchange` races, quota/private-mode, Safari/Firefox differences. CI uses jsdom + fake-indexeddb 6.2.5.
- **This environment:** cannot execute a browser (read-only W0; no playwright/puppeteer/cypress in any package.json or CI job — verified).
- **Strongest safe verification (executed):** RV2 verified the committed **R9-C real-Chromium evidence chain** (`docs/.../r9c-browser-evidence/`: README + content-addressed `f7-manifest.json` + SHA-pinned adapter bundle + `f7-verdict.json`/`f7-run.json`): a recorded HeadlessChrome/156.0.8078.4 run exercising the RB-3 legs (`commitFinancialEventCorrection`, `saveDirectSale` with poisoned payloads) against native IndexedDB — honest `storage_error` with original DataCloneError message, state intact, all verdict booleans true. Its own limits (not repeatable CI; read-failure surfaces and UI gates not browser-verified) remain stated in-repo.
- **Analogous search:** no other real-browser evidence exists in-repo (package.json/CI scan).
- **Classification:** **INFERRED** (real-engine floor exists for 2 operation legs on one engine from one recorded run; the standing R9-GA-F7 in-CI harness recommendation remains open). Not converted to PASS.

## E-UNV-002 — Visual parity, visual UX quality, screen-reader behavior

- **Not proven:** rendered visuals vs design intent, UX quality, actual AT announcements.
- **This environment:** static analysis only.
- **Strongest safe verification (executed):** RV3's complete static a11y inventory (125 alert sites, polite channels identified, 124 status, 54/54 loading = status, 17 focus-path entries, StateMarker the only role-prop non-forwarder) + the W0-C channel-consistency analysis (F-017 refined). What static analysis *can* prove (roles wired, channels unique, state machines consistent) is now proven; what it *cannot* (alert-insertion announcements, politeness queueing, virtual-cursor sync, Arabic TTS/bidi, `inert` support, drawer traps, all visuals) is enumerated precisely.
- **Classification:** **UNVERIFIED** (bounds sharpened; no visual or AT claim made).

## E-UNV-003 — Full security posture, penetration testing, threat modeling

- **Not proven:** adversarial testing, threat-model coverage.
- **Strongest safe verification (executed):** RV4's static security inventory — secrets guard families + first-match nuance (F-027 refined: cannot mask pass/fail), CI least-privilege (`permissions: contents: read`), frozen scripted install, bounded-retry fail-closed audit gate with regression tests, no telemetry/exfiltration paths (RV2), tools/micromatch-shim mitigations (parity tests + hostile-input evidence + README disclosure). New documented limits: working-tree-only secrets scan (NF-025), unlinted security-adjacent shim (NF-023), unpinned actions/Node (F-025).
- **Classification:** **UNVERIFIED** (static posture inventoried; no pentest/threat-model claim).

## E-UNV-004 — Other operating systems and browsers

- **Strongest safe verification (executed):** environment census — this W0 ran on Linux x86_64; CI evidence (R10-A E2) is Linux + Node 22; the R9-C browser run is one Chromium engine; `.replit` declares Node 20 (F-024 package). NVDA/JAWS/VoiceOver/TalkBack, Safari/Firefox live-region differences, iOS PWA flows, real keyboards: not testable here and not claimed.
- **Classification:** **UNVERIFIED** (three-Node-major divergence across environments now precisely documented — see F-024/OD-9).

## E-UNV-005 — Behavior after AUDIT_SHA_X / audit-window validity after main moves

- **Strongest safe verification (executed):** live re-derivation at W0 preflight — `origin/main` == `ffc54eb1…` == AUDIT_SHA_X (**no drift**; all R10-A evidence remains window-valid). RV5 enumerated the exact SHA-scoped claims that stale the moment main advances past `ffc54eb1` (current-state.md:4/:17/:105; contract:3/:19/:21; plan:13; CONTROL:188/:213; ARCH-007/WS-216 next_action + 3 generated views) and verified that **no validator will fail** on that staleness (human-detectable only — the #348/#349/#350 pattern). The R10-B/R10 closure PR must bundle the phase-fact reconciliation (F-033/NF-029 remediation) with view regeneration.
- **Classification:** **VERIFIED** (the staleness mechanics and the no-drift fact are now proven; post-merge staleness handling is scoped in the B1 wave).

## E-UNV-006 — Preserved UI-branch immutability since 2026-09-21

- **Strongest safe verification (executed):** RV5 verified from live refs — branch `docs/ux-ui-zed-handoff-20260921` head `f28b0fa6b933336fb1b847b906bf126de6f87e2d` (authored 2026-09-21 20:05:22Z, 2 commits), NOT an ancestor of main (merge-base `b0b4cea6`), excluded by name in `evidence/branch-cleanup-snapshot-2026-09-30.json` `excluded_branch_names`, prohibited by current-state.md:85/:106, with ≥5 dated per-wave attestation entries. Server-side branch protection is unverifiable from a clone.
- **Classification:** **INFERRED** (strong, consistent in-repo evidence chain; mechanical immutability-since-date not provable from the clone — unchanged from R10-A, now with the full evidence inventory).

## E-UNV-007 — GitHub API fields affected by rate limits or unavailable captures

- **Strongest safe verification (executed):** rate limit recurred this session (unauthenticated API blocked; reset window). Mitigated exactly as in R10-A: git-protocol verification (`ls-remote`, branch heads, `merge-base --is-ancestor`) — PR #351 head `e3be3897`, PR #352 head `a2a1af7e`, PR #344 head `3ec0bfdc` all present and NOT merged into main; open-PR count cross-referenced with the R10-A 11:39Z captures and the prompt's draft-time observation (2 open PRs at W0 preflight vs prompt's 3 — PR #344 state verified unmerged by ref; its open/closed GitHub-side state is the residual unverified field).
- **Classification:** **PARTIAL/INFERRED** (merge-state proven via refs; live GitHub-side metadata fields beyond refs unverified).

## E-UNV-008 — Live mutation negative controls for build-dependent guards

- **Not proven by R10-A:** live mutation of bundle budget/surfaces guards (covered only by replayed co-located suites).
- **This environment:** W0 is read-only — no live mutation performed.
- **Strongest safe verification (executed):** RV4 verified the co-located negative suites exist and are strong for surfaces (env/manifest/precache/duplicate negatives) and partial for budget (1 marker + over-limit/ambiguity cases), and produced a **concrete live-drill design** (mutate baseline ±1 byte in a disposable clone, run `prototype:build`, expect FAIL, restore) ready for the R10-B5 wave.
- **Classification:** **UNVERIFIED** (drill designed, not executed; scheduled input for B5).

## E-UNV-009 — Negative behavior of Python design guards

- **Strongest safe verification (executed):** RV4 confirmed the gap (design-token-guards.py and theme-contrast-guard.py have zero tests; nuance: text-density and operations-control Python DO have negatives) and performed the strongest safe static verification — a line-level logic audit of both guards finding no dead or inverted rules — plus a negative-test design (corrupt token file / out-of-cap contrast pair, subprocess-driven, text-density pattern).
- **Classification:** **UNVERIFIED** (static audit clean; negative tests designed and scheduled as F-030 FIX_NOW in B5).

## E-UNV-010 — Deep per-finding re-verification beyond the sampled S3 set

- **Strongest safe verification (executed):** **this W0**. All 37 R10-A findings were re-verified from live source by five domain-matched specialist reviewers, with the primary reconciler resolving every conflict (synthesis §3) and independently re-checking the disproof (F-023), the PILOT count, and the S2 sites. Result: 27 confirmed-as-stated, 6 confirmed-with-refinement, 3 refined-with-corrected-evidence, 1 disproved — full per-finding records in the canonical matrix.
- **Classification:** **VERIFIED** (for the R10-A set at `ffc54eb1`; the matrix is the evidence).

## E-UNV-011 — Production and real-user-data behavior

- **Strongest safe verification (executed):** RV2 re-confirmed from source — `private: true` package, client-only Vite build, no server component, zero telemetry/analytics/sentry, all state in device IndexedDB (+ transient drafts). No production users, dataset, or hosted backend exists; the only "real" data are owner test devices and MANIFEST-pinned synthetic goldens.
- **Classification:** **VERIFIED** (as a fact of absence; the exact limits this creates for evidence — no production behavior claims possible — stand).

## E-UNV-012 — Accounting correctness against external accounting standards

- **Strongest safe verification (executed):** RV2 located the complete claim surface: **no accounting-standards correctness claim exists anywhere**; the build charter explicitly forbids ERP drift (`prototype-build-charter-v1.md:32`); the deepest financial claim is the conceptual equations audit (171 EQ inventory, 149 direct tests, independent professional-rating layer) which **explicitly disclaims** completeness-as-correctness and gates every money-meaning change on the owner; preservation-only language lives in the audit's rule, OWNERSHIP-AND-TRUTH-REGISTRY (~:292/:315), and the R10-B protected invariants.
- **Classification:** **VERIFIED as posture** (there is no external-standard claim to verify; the preservation-only posture is proven). No GAAP/IFRS compliance is claimed or implied by R10-B.

---

## Summary table

| ID | Item | R10-A class | W0 class | Delta |
|---|---|---|---|---|
| E-UNV-001 | real-browser IndexedDB | NOT VERIFIED | INFERRED | R9-C real-Chromium chain verified as committed evidence; CI-harness rec open |
| E-UNV-002 | visual parity / screen readers | NOT VERIFIED | UNVERIFIED | static bounds sharpened (RV3 inventories) |
| E-UNV-003 | security posture | NOT VERIFIED | UNVERIFIED | static inventory complete; limits documented (NF-023/-025) |
| E-UNV-004 | other OS/browsers | NOT VERIFIED | UNVERIFIED | environment census incl. Node-major divergence |
| E-UNV-005 | audit window after main moves | NOT VERIFIED | VERIFIED | no drift at W0; staleness mechanics fully enumerated |
| E-UNV-006 | preserved UI branch | NOT VERIFIED | INFERRED | full in-repo evidence inventory; server-side unverifiable |
| E-UNV-007 | GitHub API fields | NOT VERIFIED | PARTIAL | git-ref verification; metadata fields residual |
| E-UNV-008 | live mutation of build guards | NOT VERIFIED | UNVERIFIED | drill designed for B5 |
| E-UNV-009 | Python guard negatives | NOT VERIFIED | UNVERIFIED | static audit clean; tests designed (F-030) |
| E-UNV-010 | deep per-finding re-verification | NOT VERIFIED | VERIFIED | all 37 re-verified (this W0) |
| E-UNV-011 | production data | NOT VERIFIED | VERIFIED | absence re-proven from source |
| E-UNV-012 | accounting standards | NOT VERIFIED | VERIFIED (posture) | no external claim exists; preservation-only proven |

No unexecuted check is reported as PASS anywhere in this document or the matrix.
