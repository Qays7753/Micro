# R10-B — Reviewer 5 (RV5): Documentation / Operations Control / SOP / Agent Handoff

**Role:** R10-B canonical prompt §6 role 5 — tracker persistence, generated views, evidence links, live-state drift, contract 40, handoff minimum set, SOP/AGENTS.md discoverability, PRESERVE/OUT_OF_SCOPE/BLOCKED/PILOT triggers.
**SHA verified:** `git -C /home/z/my-project/r10b/clone rev-parse HEAD` → **`ffc54eb1150932c9bba88b48a7c38275f2a3effa`** (= expected HEAD, branch `main`, clean working tree, single local branch).
**Date:** 2026-10-11 (review window).
**Read-only statement:** This review performed NO writes inside the clone — no file created/modified/deleted/staged, no git write commands, no installs, no builds, no test/guard executions, no network. All computation was done with read-only python3/rg one-liners over the working tree; scratch output went only to `/home/z/my-project/r10b/scratch/reviewers/`. The prior R10-A package under `scratch/r10a-package/` was read only to identify claims for re-verification; every conclusion below comes from live inspection of the clone at the SHA above.

---

## 1. Commands actually executed

- `git -C .../clone rev-parse HEAD`; `git status --short`; `git branch -a` (SHA + cleanliness + remote branch inventory)
- `git log --oneline -5 -- CONTRIBUTING.md`; `git show bcb5bc80:CONTRIBUTING.md`; `git show 6fb8e0cf -- CONTRIBUTING.md` (F-023 history check)
- Read/Grep over: CONTRIBUTING.md, README.md, AGENTS.md, todo.md, docs/operations/*.md (current-state, agent-handoff-protocol, micro-thinking-charter), docs/operations/control/** (items/*.json ×85, workstreams ×58, context.md, roadmap.md, migration-map.md, README.md, releases/pre-pilot.json, generated/* ×7, handoffs/README.md, evidence/ listing), docs/architecture/refactoring/** (REFACTORING-CONTROL, R0-LIVE-BASELINE, STRUCTURAL-REMEDIATION-PLAN, INDEPENDENT-TRACKS-RECORD, FILE-SIZE-AND-RESPONSIBILITY-REGISTER, OWNERSHIP-AND-TRUTH-REGISTRY, execution contract), docs/architecture/ADRs/ADR-017, docs/contracts/05, docs/product/problem-statement-v4, docs/decisions/*, scripts/operations-control/generate_tracker.py, scripts/operations-control/validate.py (read), scripts/file-size-ratchet-baseline.json, scripts/file-size-ratchet-reanchors.json
- Read-only python3 one-liners: item census (status/classification/gate counts), DEFERRED per-item dump, BLOCKED dependency cross-check, PILOT-001 vs pre-pilot.json diff, ratchet-baseline measurement lookup, reanchor-ledger lookup, generated-view freshness (reimplemented source_digest + sha256 + row/ID/summary comparisons — repo scripts NOT executed), SHA ancestor check (`git merge-base --is-ancestor` × 68 distinct SHAs), markdown dangling-link sweep (root + docs + ai-skills/.github/planning/apps/tools; 372+30 files, 732+1 relative links checked)
- `git rev-parse/log/merge-base` on `origin/docs/ux-ui-zed-handoff-20260921` and the three R10 remote branches (read-only refs of the clone)

## 2. Files / symbols / line-ranges inspected (key)

- `CONTRIBUTING.md` (all 32 lines + both historical versions)
- `docs/operations/agent-handoff-protocol-v1.md` :1–77 (esp. :17, :21, :31, :51)
- `AGENTS.md` :1–173 (§2 table :9–43, §9 :115–118, §10 :119–144 esp. :140, §14)
- `todo.md` :1–16 (OD-06 stub note :3)
- `docs/operations/current-state.md` :1–107 (header :4, §1 :17, §7 :68–70, §8.2 :78–90, §9 :91–106)
- `docs/operations/control/context.md` :1–103 (esp. :10–12, :75, :89–91)
- `docs/operations/control/items/{SCOPE-001,SCOPE-002,UX-002,BE-001..005,V-001..012,DEVICE-001,LEGAL-001,PILOT-001,REL-001,FIN-007,UX-001,UAT-001,AUDIT-001,GOV-001,HARD-009,ARCH-007}.json`
- `docs/operations/control/workstreams/WS-216.json` (:34 next_action, :54 history), `releases/pre-pilot.json` (43 required_items)
- `docs/architecture/refactoring/R0-LIVE-BASELINE-AND-FINDING-RECONCILIATION-2026-10-07.md` §6.4 :185–222
- `docs/architecture/refactoring/STRUCTURAL-REMEDIATION-PLAN-20261007.md` :13, A.6/A.7 :814–841, :902
- `docs/architecture/refactoring/REFACTORING-CONTROL.md` :167, :177–188, :207–220
- `docs/architecture/refactoring/INDEPENDENT-TRACKS-RECORD.md` :1–59
- `docs/architecture/refactoring/FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md` §3 cards :827–849 (adapters), :875–884 (transferFamilyValidators), :941–950 (craft-order/policies), :1145–1154 (types.ts)
- `docs/architecture/ADRs/ADR-017-...md` §3 :40–57
- `scripts/operations-control/generate_tracker.py` :33–35 (`md_cell`), :126–202 (`outputs`, esp. :143 branch f-string)
- `scripts/operations-control/validate.py` :138–198 (ancestor + snapshot-only-main rules :155–164)
- `docs/operations/control/generated/` all 7 files
- `scripts/file-size-ratchet-baseline.json` (v2, head `c70d3eed`, 488 measurements), `scripts/file-size-ratchet-reanchors.json` (27 entries)
- `docs/operations/control/evidence/branch-cleanup-snapshot-2026-09-30.json` (excluded_branch_names)
- R9/R6 preflight evidence: `.../structural-remediation-r9-20261010/preflight-review-package/reviewer-2-storage-data.md` :1–70; `.../structural-remediation-r6-20261009/R6-PREFLIGHT-...-SCAN-2026-10-09.md` :82

---

## 3. Part A — R10-A finding re-verification

### A.1 R10A-F-023 — "CONTRIBUTING.md audit-policy pointer is dangling" → **DISPROVED**

Live `CONTRIBUTING.md` at ffc54eb (32 lines) contains **no audit-policy pointer at all**. Its only file references are `AGENTS.md` §2, `docs/00-document-index.md`, `THIRD_PARTY_NOTICES.md` — all exist. Repo-wide search for `audit-policy|audit_policy|AUDIT-POLICY`: **0 hits**; no audit-policy document exists anywhere in the tree. Full file history (only 2 commits ever touched it: `bcb5bc80` creation, `6fb8e0cf` 2026-10-01 WS-204 rewrite) never contained such a pointer. The R10-A final report (Lens G / S3 list, lines 131/216) and its source RV4-F01 assert a pointer that does not exist at the audited SHA. The *family* of dangling pointers does exist elsewhere (see B.7 / new findings N5–N6), but the specific F-023 claim as stated is **false on live main**. Disposition: drop F-023; replace with the actual dangling pointers found in B.7.

### A.2 R10A-F-032 — handoff protocol routes closure via todo.md ×3 → **CONFIRMED**

`docs/operations/agent-handoff-protocol-v1.md` (status header: `CURRENT / REQUIRED FOR ALL FUTURE SLICES`):
- **:17** — authority ladder row "ما المسموح بدءه الآن؟ | طلب المالك الحالي + `current-state.md` + `todo.md`"
- **:31** — reception step 5: "يراجع `todo.md` و`git status --short`"
- **:51** — delivery step 2: "تحديث `todo.md` للبنود المكتملة فقط" — direct closure routing through todo.md

(:21 mentions todo.md only negatively — "لا يتغلب `todo.md`…" — and is not a routing instruction.)

OD-06 (2026-10-02) says the opposite:
- `todo.md:3` — "لا تُدار مهام جديدة من هنا **ولا يُحدَّث هذا الملف عند إغلاق الشرائح**؛ التزامات الإغلاق … محفوظة في `AGENTS.md` §9/§10" (frozen compat stub)
- `AGENTS.md:117` (§9): closure updates `current-state.md` **وسجلات Operations Control** *(تحديث مؤرخ 2026-10-02 — OD-06: كان الواجب على `todo.md` قبل أن يصير كعب توافق مجمدًا)*
- `AGENTS.md:140` (§10 rule 10): "تحديث `current-state.md` وسجلات Operations Control … *(… OD-06: `todo.md` كعب توافق مجمد لا يُحدَّث عند الإغلاق)*"
- `current-state.md:70` (§7): "*(تحديث مؤرخ 2026-10-02 — OD-06: … صار `todo.md` كعب توافق مجمدًا والتنسيق كله في Operations Control.)*"

Exactly 3 routing locations (17/31/51) as claimed; the protocol predates OD-06 and was never reconciled. CONFIRMED, S3, disposition: dated correction of the protocol (routing to Operations Control + `current-state.md`), or explicit retirement of the protocol file.

### A.3 R10A-F-033 — live-phase fact duplicated across ≥5 docs → **CONFIRMED (REFINED)**

The #348/#349/#350 drift chain was specifically about the **R9-verified / R10-not-started program phase + current-main-head** fact. Full live enumeration at ffc54eb:

| # | Location | Statement | Classification |
|---|---|---|---|
| 1 | `docs/operations/current-state.md:4` (header) | "R9 VERIFIED_ON_MAIN … R10 التالية ولم تبدأ" | **live-authoritative** (canonical live-state doc) |
| 2 | `current-state.md:17` (§1 `main` row) | "كود R9 متحقق عند `e80f7509` … R10 لم تبدأ" | live-authoritative |
| 3 | `current-state.md:105` (§9 R9 row) | "R10 هي التالية ولم تبدأ؛ ابدأها من origin/main بعد fetch" | live-authoritative |
| 4 | `docs/architecture/refactoring/ZAI-STRUCTURAL-REMEDIATION-R0-R10-EXECUTION-CONTRACT-20261007.md:3` (status), `:19`, `:21` | `R0–R9_VERIFIED_ON_MAIN; R10_…_NOT_STARTED` + "fetch and read origin/main" | **duplicated-live** (dated-updated status header, drift risk) |
| 5 | `docs/architecture/refactoring/STRUCTURAL-REMEDIATION-PLAN-20261007.md:13` | same status line (Arabic) | duplicated-live |
| 6 | `docs/architecture/refactoring/REFACTORING-CONTROL.md:188` (الخطوة الحية), `:213` (§15-2 self row "R10 التالية") | "R9 VERIFIED_ON_MAIN، وR10 هي التالية ولم تبدأ" | duplicated-live |
| 7 | `docs/operations/control/items/ARCH-007.json` `next_action` (:193) | "R10 hostile final audit and closure is next and has not started…" | duplicated-live (control source field) |
| 8 | `docs/operations/control/workstreams/WS-216.json:34` | same text | duplicated-live (control source field) |
| 9–11 | `generated/AGENT-BRIEF.md:37`, `generated/ACTIVE-WORK.md:7`, `generated/MASTER-TRACKER.csv:5` + `.md` | same WS-216 next_action text | duplicated-live (generated — auto-consistent only if regenerated in the same PR) |
| 12 | `docs/architecture/refactoring/AGENT-SEQUENTIAL-WORKLOG.md:814, :948, :967, :1180–1186` | dated entries ("R1–R10 لم تبدأ" / "R6–R10 not started" / Entry 88) | historical-dated (append-only) |
| 13 | `docs/operations/current-state-log.md:2077, :2251–2262` (§174/§175) | dated reconciliation entries | historical-dated |
| 14 | `WS-216.json:54` (history array, dated 2026-10-09) | "R5 قائمة IN_PROGRESS؛ R6–R10 لم تبدأ" | historical-dated |
| 15 | `docs/operations/control/context.md:11` (آخر موجة = UX-001 Phase 2), `:91` | "الخطوة التالية تُقرأ حصرًا من current-state §8.2: UX-001 Phase 2 مدموجة…" | **duplicated-live and STALE** (see new finding N3) |

The product-phase term "Prototype المرحلة 2" appears in ~20 files (AGENTS.md §5 :75, blueprint :12/:447, decision log D-018/D-023, pre-build-alignment :14/:20, build charter :9, glossary :8, contract 05 :5/:17, README skill tables, ai-skills…) — these are **definitional** (stable semantics of the phase name), not per-merge live state, and are governed by AGENTS §3 precedence; the drift-prone duplication is the program-phase fact in rows 4–11. Refinement of the R10-A phrasing: "'Prototype المرحلة 2' / phase status" conflates the definitional term with the mutable program phase; the #348/#349/#350 root cause is the latter (≥6 live docs + 3 generated views). PR #350's snapshot-semantics fix removed the *current-main-head* variant of the duplication but the *phase-status* variant remains multi-copy by design. CONFIRMED with that refinement.

### A.4 R10A-F-034 — 3 OUT_OF_SCOPE items lack observable trigger/detection → **CONFIRMED**

- `SCOPE-001.json`: `deferred_reason`="OUT_OF_SCOPE؛ لا يدخل PRE-PILOT ولا يتحول إلى Feature قبل نطاق وعقد وقرار مستقل."; `next_action`="لا تبدأ؛ أعد الفتح فقط بعد دليل، عقد، وقرار مالك مستقل…" — no observable trigger (what evidence? which signal?), no detection method. Only `owner_decision` present.
- `SCOPE-002.json`: identical copy-pasted reason/next_action; acceptance hints "قياس حاجة ميدانية متكررة" (unmeasured/undefined).
- `UX-002.json`: identical copy-pasted reason/next_action; trigger is pure owner decision, nothing observable.

All three share byte-identical generic strings — a template defer, not item-specific gates.

**Comparison pattern — REFINED.** The "L-C/L-E/L-G/V7/V10/V12 rows with recorded triggers" are **not** in `INDEPENDENT-TRACKS-RECORD.md`; they live in `R0-LIVE-BASELINE-AND-FINDING-RECONCILIATION-2026-10-07.md` §6.4 (:196 L-C, :198 L-E, :200 L-G, :207 V7, :210 V10, :212 V12) and `STRUCTURAL-REMEDIATION-PLAN-20261007.md` A.6/A.7 (:820/:822/:835/:838/:840). `INDEPENDENT-TRACKS-RECORD.md` holds the R/S/T/U/V/W/X tracks, which carry the repo's richest pattern (محفز الفتح + ما يحمي الحدود, :13/:20/:28/:34/:40/:50). Trigger observability of the 6 rows: L-C "first external user data / regulatory signal" — observable; L-E "distribution beyond owner-controlled devices" — observable; L-G — terse in R0 ("trigger recorded"), full text in plan :902 (client-unrunnable analytics need) + W-track; V7 "measured regression" — observable in principle but **no in-repo runtime-perf measurement harness exists** (bundle guards measure bytes, not runtime); V10 "حتى Trigger مصادق" (plan :838) — circular, no trigger defined; V12 "حتى أول Generator فعلي" (plan :840) — observable. So even the comparison pattern is 4/6 strongly observable, 2/6 weak — but all 6 are still far more specific than the 3 control items (which have neither trigger nor detection). Core claim CONFIRMED.

### A.5 R10A-F-035 — HARD-001..008 ID gap undocumented → **CONFIRMED**

`items/` contains exactly HARD-009/010/011 (python census: HARD min=009, max=011, count=3 — the only prefix with a leading gap; all 21 other prefixes are gap-free). The sole explanation anywhere is `migration-map.md:18` (row 122): "خطة المعالجة 8–11 على PR #159 | `HARD-009`, `HARD-010`, `HARD-011` | VERIFIED…" — i.e., the numbering was inherited from remediation groups 9–11, implying 001–008 were never created. No numbering-convention note exists in `control/README.md`, `authority-map.md`, or the items README; a reader meeting `HARD-009` cold cannot tell whether 001–008 were deleted, lost, or never existed. CONFIRMED, S3. Disposition: one-line dated note in `control/README.md` (or migration-map §قواعد التفسير) stating the HARD numbering is group-derived and 001–008 never existed.

### A.6 R10A-F-036 — escaped-backtick artifact in 2 generated views → **CONFIRMED (root cause pinned)**

- `generated/ACTIVE-WORK.md:7` and `generated/AGENT-BRIEF.md:37` both render the WS-216 branch cell as literal `` \`main\` `` ("| WS-216 | IN_PROGRESS | \`main\` | — | …").
- Generator cause: `scripts/operations-control/generate_tracker.py:143` — `md_cell(f"`{work['branch']}`")` pre-wraps the branch in Markdown backticks and then passes it to `md_cell`, whose escaping at **:35** does `.replace("`", "\\`")`. The double treatment emits `\`` which GFM renders as a literal backslash + broken code span. MASTER-TRACKER/NEXT-ACTIONS don't carry a branch column, so exactly 2 views are affected — matching R10-A.
- Fix options (for R10-B docs wave): drop the f-string backticks at :143, or stop escaping backticks in md_cell and escape only `|`/newlines. CONFIRMED, S3 cosmetic.

### A.7 R10A-F-037 — handoff minimum-set gaps (5) → **CONFIRMED (all five)**

The Operations-Control handoff minimum (handoffs/README.md:3–10) = Workstream JSON + Item JSONs + PR description + current-state update. Verified gaps beyond it:

- **(a) No single dev SOP.** `docs/operations/` holds README, current-state(+log), agent-handoff-protocol, micro-thinking-charter, remaining-work, slice-handoff-template + control/ — no developer SOP. CONTRIBUTING.md is 32 lines of contribution rules; the operational workflow is distributed across AGENTS.md §2/§9/§10 + handoff protocol + charter + control README. (Nuance: WS-204 deliberately replaced monolithic reading lists with context packs; the gap is real for a *human* developer cold-start but is a design tradeoff, not an omission.)
- **(b) No storage-parity view.** The only per-capability parity matrix is the **dated** R9 preflight evidence (`evidence/structural-remediation-r9-20261010/preflight-review-package/reviewer-2-storage-data.md` §2, SHA-scoped 8b3c9aeb) plus code-level conformance suites, contract 40 row, OWNERSHIP-AND-TRUTH-REGISTRY §2. No generated view, no doc-index row (0 hits for "parity" in 00-document-index.md).
- **(c) No transfer/legacy/golden view.** Same evidence-doc-only situation (reviewer-2-storage-data.md §3–5 "Transfer/Legacy/Golden Matrix"; contract 39/40; transferCompatibilityValues in code; 28 goldens + MANIFEST under docs/fixtures). Not routable by name from AGENTS.md (matches R10-A cold-start finding (c) — weakest link).
- **(d) No structure/boundary/guard proves/does-not-prove view.** Exists only as R6 preflight evidence (R6-PREFLIGHT-…-SCAN-2026-10-09.md:82 "17-guard inventory with proves/does-not-prove") and the canonical-but-static REFACTORING-PLAN-A-TO-Z §4.3.1 metadata table. No maintained/generated view.
- **(e) R10 evidence ledger absent on main.** `git ls-tree origin/main docs/operations/control/evidence/` → **no** `structural-remediation-r10-*` directory at ffc54eb, while all three R10 remote branches (`docs/r10-a-hostile-audit-prompt-20261011` @ e3be3897, `docs/r10-a-hostile-audit-report-20261011` @ a2a1af7e, `docs/r10b-systemic-root-fix-prompt-20261011` @ faa572eb) contain `evidence/structural-remediation-r10-20261011/`. Absence on main confirmed (expected — R10 in flight).

---

## 4. Part B — Control-package enumeration and completeness audit

### B.1 Census + PILOT_EVIDENCE_REQUIRED count resolution

python3 census over `items/*.json` (85 files; no duplicate IDs; filename↔ID match):

| status | count | | classification | count | | gate_classification | count |
|---|---|---|---|---|---|---|---|
| VERIFIED | 56 | | GOVERNANCE | 13 | | NOT_APPLICABLE | 45 |
| DEFERRED | 20 | | HARDENING | 6 | | MAIN_VERIFIED | 4 |
| BLOCKED | 3 | | RELEASE_GATE | 4 | | EVIDENCE_RECONCILIATION_REQUIRED | 2 |
| IN_PROGRESS | 2 | | HISTORICAL | 10 | | DUPLICATE_HISTORICAL | 3 |
| BACKLOG | 2 | | PILOT_VALIDATION | 14 | | **PILOT_EVIDENCE_REQUIRED** | **14** |
| SUPERSEDED | 1 | | FIX_BEFORE_PILOT | 35 | | DEPENDENCY_GATE_REQUIRED_BEFORE_PILOT | 13 |
| REVIEW_REQUIRED | 1 | | FUTURE_SCOPE | 3 | | RELEASE_GATE | 1 |
| | | | | | | OUT_OF_SCOPE | 3 |

Status counts match AGENT-BRIEF.md:15 exactly. Workstreams: 58 (33 top-level WS-184..216 + 25 review/); statuses VERIFIED 53 / SUPERSEDED 3 / IN_PROGRESS 1 (WS-216) / DEFERRED 1. All 20 DEFERRED carry `deferred_reason`+`next_action`; all 56 VERIFIED carry `merge_sha`+`verified_on_main_sha`; **68 distinct recorded SHAs — all exist and are ancestors of HEAD** (merge-base check, 0 failures). No TODO/FUTURE_WAVE/WATCH/PILOT_COMPLETE statuses anywhere.

**PILOT 17-vs-14 resolution.** Live truth: `gate_classification=PILOT_EVIDENCE_REQUIRED` = **exactly 14 items** — BE-004, BE-005, V-001..V-012 (identical set for `classification=PILOT_VALIDATION`). The R10-A "17 PILOT_EVIDENCE_REQUIRED" (final report :121/:197/:236; reviewer-5 worklog; denominator inventory INV-02 `unverified_items[0]`) is a **miscount**. Two arithmetic decompositions yield 17: (i) **BE-001..BE-005 (5) + V-001..V-012 (12) = 17** — counting by item family ("Build-After-Evidence + Validation"), which wrongly includes BE-001..003 (gate=`DUPLICATE_HISTORICAL`, classification=`HISTORICAL` — superseded trackers of OPS-003/FIN-002/FIN-006, not pilot-evidence items); or (ii) 14 PILOT_EVIDENCE_REQUIRED + 3 OUT_OF_SCOPE = 17. The R10-A package does not itemize the 17 IDs, so the exact slip cannot be proven, but (i) is the most likely (family-based hand count). **Canonical set = 14** (BE-004, BE-005, V-001..V-012); the substantive defect — "event defined (pilot-protocol question + owner decision) but no detection method" — applies to those 14, all sharing one byte-identical `next_action` ("أضف السؤال إلى بروتوكول Pilot، ثم سجّل النتيجة والقرار قبل فتح أي تنفيذ") and one identical reason. Additional nuance: the referenced "Pilot protocol / pilot-validation plan" exists **only in the external Documents repo** (evidence URLs → github.com/Qays7753/Documents …/pilot-validation-plan.md); no in-repo pilot protocol doc exists (repo-wide search: 0 hits beyond the item JSONs). The R10-B/R10 closure should correct the ledger's "17" to 14.

### B.2 All 20 DEFERRED items — per-item assessment

| Item | Reason real? | Next action real? | Trigger | Detection method | Exit condition | Verdict |
|---|---|---|---|---|---|---|
| BE-001 | YES — DUPLICATE_HISTORICAL, live owner OPS-003 | YES — follow OPS-003, no independent claim | n/a (superseded) | n/a | implicit (OPS-003 closes) | OK (cosmetic: tuple-literal phrasing "تابع ('DUPLICATE_HISTORICAL','OPS-003')") |
| BE-002 | YES — duplicate of FIN-002 | YES — follow FIN-002 | n/a | n/a | implicit | OK |
| BE-003 | YES — duplicate of FIN-006 | YES — follow FIN-006 | n/a | n/a | implicit | OK |
| BE-004 (إغلاق فترة رسمي) | GENERIC family text | GENERIC — "add question to Pilot protocol" | event = pilot question; when authored? undefined | **ABSENT** | "دليل Pilot يثبت الحاجة" (undefined metric) | generic defer |
| BE-005 (تقادم 30/60/90) | GENERIC | GENERIC (same string as BE-004) | same | **ABSENT** | same | generic defer |
| SCOPE-001 | GENERIC copy-paste | GENERIC copy-paste | **ABSENT** ("بعد دليل" — which evidence?) | **ABSENT** | owner_decision present only | vague |
| SCOPE-002 | GENERIC copy-paste | GENERIC copy-paste | hinted ("قياس حاجة ميدانية متكررة") but unmeasurable | **ABSENT** | acceptance semi-specific | vague |
| UX-002 | GENERIC copy-paste | GENERIC copy-paste | owner decision only — nothing observable | **ABSENT** | "قرار مالك مستقل" | vague |
| V-001..V-012 (12 items) | GENERIC (one shared string) | GENERIC (one shared string) | event = pilot-protocol question; **pilot protocol itself does not exist in-repo** (external Documents repo plan) | **ABSENT in-repo** — tests_required name "Pilot observation protocol / Evidence log with denominator and outcome" but no protocol doc | "يُقاس وفق خطة Pilot / معيار الخروج" — plan not in repo | template defer; measurement design deferred to a nonexistent (in-repo) instrument |

Per-item gap summary: BE-001..003 clean; the 14 PILOT_EVIDENCE_REQUIRED items lack detection methods and their measurement instrument is out-of-repo; the 3 OUT_OF_SCOPE items lack both trigger and detection (identical copy-paste). No DEFERRED item is missing `deferred_reason`/`next_action` (validator-enforced), but 17/20 are template-level rather than item-specific.

### B.3 The 3 BLOCKED items

| Item | Recorded blocker | Stands at ffc54eb? |
|---|---|---|
| **PILOT-001** (قرار بدء Pilot) | "المراحل 0–9 وبوابات المنتج والجهاز والقانون وUAT والتدقيق لم تثبت كلها VERIFIED على main" | **YES** — live cross-check of its 35 dependencies: UX-001 IN_PROGRESS, DEVICE-001 BLOCKED, LEGAL-001 BLOCKED, UAT-001 BACKLOG, AUDIT-001 BACKLOG (rest VERIFIED). External owner decision also required (owner_decision present). |
| **DEVICE-001** (QA على أجهزة فعلية) | "الاعتماديات أو البيئة المطلوبة لم تكتمل: UX-001, REL-001" | **PARTIALLY STALE** — REL-001 is VERIFIED since 2026-09-23 (027fc7b5); only UX-001 (IN_PROGRESS) + the external device/environment availability (owner_decision "توفير الأجهزة والبيئة الفعلية") still stand. updated_at frozen at 2026-09-19. |
| **LEGAL-001** (مراجعة أردنية) | "الاعتماديات أو البيئة المطلوبة لم تكتمل: FIN-007" | **STALE** — FIN-007 has been VERIFIED since 2026-09-22 (893e3c864, WS-173/PR #211). The true remaining blocker is purely external (owner_decision "اختيار مختص ونطاق المراجعة" — no specialist engaged). The recorded dependency-based blocker is false on live main. |

This partially refutes the R10-A Lens-B claim "3 BLOCKED carry exact blockers": PILOT-001 yes; DEVICE-001 half; LEGAL-001 no. (New findings N1/N2 below.)

### B.4 PRESERVE cards — 10-element matrix

Card locations: FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md §3 — IndexedDbLocalStore :827–836; MemoryLocalStore :838–849 (incl. R4-A2 nine-element review :848 and R6 F-010 decision :849); transferFamilyValidators :875–884 + **ADR-017 §3 :40–57** + REFACTORING-CONTROL:167 + OWNERSHIP-AND-TRUTH-REGISTRY:183; craft-order/policies :941–950; storage/local/types.ts :1145–1154. Machine enforcement: `scripts/file-size-ratchet-baseline.json` v2 (head c70d3eed, 488 measurements — all 5 files present: IndexedDb 4391/SPLIT_NOW, Memory 2087/SPLIT_NOW, TFV 1730/SPLIT_NOW, craft-policies 1413/SPLIT_NOW, types.ts 876/SPLIT_CANDIDATE) + `file-size-ratchet-reanchors.json` (27 entries; e.g. `R9-GA-F7-ROOT-FIX-ADAPTER`: IndexedDb 4133→4391 with reason + ownerReview + trigger).

| Element | IndexedDbLocalStore | MemoryLocalStore | craft-order/policies | storage/local/types.ts | transferFamilyValidators (+ADR-017) |
|---|---|---|---|---|---|
| 1 durable owner | PRESENT — "المالك: مالك Micro" (reg :836) | PRESENT — owner=storage per R4-A2 :848 | PRESENT — domain/craft-order (:950 ①) | PRESENT — storage (:1154 ①) | PRESENT — transfers subsystem (ADR-017:53; CONTROL:167 "المالك") |
| 2 bounded growth | PRESENT — ratchet 4,135/4,139 "لا عبور" + v2 within-band + reanchor R9-GA-F7 | PRESENT — ratchet 2,091/2,099 | PRESENT — band ratchet, live 1,413 @fd92d7e8 (+14 documented) | PRESENT — band ratchet, live 876 | PRESENT — pinned 1,718; dated correction F-005 (+12 → 1,730, benign, documented); within-band enforcement moved to R8-2 v2 (executed 2026-10-10) |
| 3 guard | PRESENT — ratchet + 6 conformance + 16 capability contracts + entity guard (:836) | PRESENT — ratchet + conformance suites (:847) | PRESENT — ratchet + settlementInvariant + moneyLayerGuard + W2 characterization (:950 ⑤) | PRESENT — ratchet + 4+ version-governance tests + 28 goldens + MANIFEST + pairs test (:1154 ⑤) | PRESENT — drift guard + compatibility registry + goldens + ratchet v2 (:884 ②; ADR-017:47) |
| 4 review trigger | PRESENT — new capability group / migration / band crossing / Wave O (:836) | PRESENT — by reference to main adapter + R6 F-010 triggers (:849) | PRESENT — band crossing / new settlement check / owner wave (:950 ⑥) | PRESENT — new capability / migration / band crossing (:1154 ⑥) | PRESENT — 4 explicit triggers (ADR-017:56) |
| 5 exit criteria | PRESENT — Wave O owner decision or port shrink (:836) | PRESENT — Wave O governs the pair (:847/:849) | **WEAK** — "قرار مالك" generic, no named wave (:950 ⑦) | PRESENT — Wave O owner decision (:1154 ⑦) | PRESENT — split-card reopening priced with Class-B estimator post-retrofit (ADR-017:57) |
| 6 tests | PRESENT — 19→35 direct (dated correction :835) + conformance | PRESENT — 178→198 direct (dated correction :846) | **PARTIAL** — 0 direct; ~171 indirect via barrel; honest registered gap "فجوة مسجلة" (:949–950 ⑧) | PRESENT — 69 direct + governance (:1154 ⑧) | PRESENT — 3 direct suites (:883) |
| 7 rollback | PRESENT — exception revocation = owner decision; impact HIGH (:836) | PRESENT — HIGH (:847) | PRESENT — HIGH (settlement invariant) (:950 ⑨) | PRESENT — HIGH data-compat (:1154) | PRESENT — HIGH, rejection behavior is data-compat (:884; ADR-017:49) |
| 8 coherent reason | PRESENT — single responsibility; size = port width (130 methods) | PRESENT — mirror adapter proving substitutability | PRESENT — frozen-semantics policies, contracts 02/10/12 | PRESENT — port + record types + version constants; composition documented | PRESENT — one validation pass; duplication is the risk, splitting scatters it (ADR-017:46–50) |
| 9 consumer inventory | PRESENT — 21 listed (:832) | PRESENT — 180 listed (:843) | PRESENT — 3 in-domain + barrel + 1 documented deep import (:950 ③) | PRESENT — 160 listed (:1150) | PRESENT — 8, all inside transfers (:880; ADR-017:42) |
| 10 documented exceptions | PRESENT — "موثق كاملًا أعلاه" (:836) | PRESENT (:847) | PRESENT — §2/§3 reconciled by R6-W1 (:950) | PRESENT — STR-307 type-only cycle (:1154) | PRESENT — excluded from finite bundle pool (ADR-017 §4; :884) |

Verdict: 5/5 cards pass 9–10 of 10 elements; the two honest soft spots are craft-order/policies **tests (element 6, indirect-only, registered)** and its **generic exit criterion (element 5)**. This refines the R10-A RV5 claim "cards element-complete": complete on card elements, but the craft-order card itself records the direct-test gap as an open item for a future owner-gated test wave. No enforcement gap remains: growth is machine-enforced for all 5 (baseline v2 + reanchor ledger, verified live).

### B.5 The 6 trigger rows vs the 3 OUT_OF_SCOPE items

See A.4. Net: the 6 rows carry recorded, mostly-observable triggers (L-C external-user-data/regulatory, L-E distribution-beyond-owner-devices, V12 first-real-generator, L-G client-unrunnable-analytics-need, V7 measured-regression) with two weak spots (V10 circular "حتى Trigger مصادق"; V7 has no in-repo runtime measurement harness). The 3 control items carry nothing item-specific. The repo's own best pattern is INDEPENDENT-TRACKS-RECORD.md (R/S/T/U/V/W/X: trigger + boundary protection per track, with a live dated trigger-firing precedent — T-track shim removal trigger recorded fired in R1/TG-02 :26). R10-A's attribution of L-C/L-E/L-G/V7/V10/V12 to INDEPENDENT-TRACKS-RECORD.md is a citation slip (they are R0 §6.4 / plan A.6–A.7 rows); the comparison itself stands.

### B.6 Generated-view freshness — **PASS (would pass `--check`)**

Verified without executing repo scripts (independent reimplementation of the generator's digest logic):
- `source_digest` recomputed over the same 145 source files (items 85 + workstreams 58 + reports/index.json + pre-pilot.json) = `1c4c0428a66b3c2f…` — **matches** `MASTER-TRACKER.xlsx.meta.json` `source_digest`; `source_files` list identical (145/145).
- `MASTER-TRACKER.xlsx` SHA-256 recomputed — **matches** meta `workbook_sha256`; provenance flags true; generated_at 2026-10-11.
- CSV: 86 lines (85 items + header); CSV ID set == items/*.json ID set exactly.
- MASTER-TRACKER.md: all 85 IDs present.
- AGENT-BRIEF summary "BLOCKED: 3 · IN_PROGRESS: 2 · BACKLOG: 2 · REVIEW_REQUIRED: 1 · DEFERRED: 20 · VERIFIED: 56 · SUPERSEDED: 1" == live census.
- NEXT-ACTIONS.md: 24 item rows (3 BLOCKED + 20 DEFERRED + 1 REVIEW_REQUIRED) — complete.
- All 7 files mtime 2026-10-11T14:06:52 (post-PR #350 regeneration). The only defect in the views is the F-036 backslash-backtick rendering (A.6) — a generator bug, not staleness.

### B.7 Stale-pointer sweep (family of F-023)

372 markdown files scanned (root + docs/), 732 relative links checked; plus 30 files (ai-skills/.github/planning/apps/tools), 1 link. **CONTRIBUTING.md, README.md, docs/00-document-index.md, AGENTS.md (§2/§3 references), and ADR cross-references: zero dangling targets.**

Live docs with dangling targets (2):
1. `docs/decisions/review-finance-c2-decision-v1.md:67` — ref [1]: `[`../../apps/prototype-web/client/src/pages/Review.tsx`](…)` — **`pages/Review.tsx` does not exist** (only DeliveryReview.tsx / SharePreview.tsx). S3/S4: a decision record cites a nonexistent code path.
2. `docs/decisions/remaining-capabilities-review-v1.md:155` — "الخريطة المرفقة للقدرات" links `../../../upload/pasted_content.txt` — **no `upload/` directory in the repo**; the attachment the decision relies on is absent. S3/S4.

Formatting artifact (not dangling): `docs/product/problem-statement-v4.md:104` — reference [3] wraps paths in backticks (`` `docs/quality/g15-device-production-acceptance.md` ``); the target **exists** (docs/quality/g15-device-production-acceptance.md) — cosmetic rendering only.

Historical (append-only archives, expected-not-to-chase; enumerated for completeness): `docs/operations/archive/problem-statement-v3.md` (9 dangling relative links — product docs were later reorganized), `archive/quality-history/final-qa-pilot-acceptance-protocol-v1.md` (6), `archive/quality-history/g5-qa-evidence-v1.md` (2), `archive/quality-history/system-review-remediation-plan-v1.md` (2 regex false-positives: package-name strings, not links).

---

## 5. Part C — E-UNV research input

### E-UNV-005 — audit-window SHA scoping (what stales when PR #351/#352 merge)

Per the clone's refs and the R10-A inventory: PR #351 = R10-A prompt docs (branch head `e3be3897`, docs-only +894/−0, owner-gated "DO NOT MERGE" at audit time); PR #352 = R10-A report/evidence (branch `docs/r10-a-hostile-audit-report-20261011` @ `a2a1af7e`, contains `evidence/structural-remediation-r10-20261011/`); a third R10-B prompt branch exists (`faa572eb`). SHA-scoped claims that stale the moment main moves past ffc54eb:

1. `current-state.md:4` (header "آخر تحديث 11 أكتوبر … R10 التالية ولم تبدأ"), `:17` (§1 R9@e80f7509 + "R10 لم تبدأ"), `:105` (§9 "R10 هي التالية ولم تبدأ") — must be rewritten by the merging PR per §7 closure requirements.
2. `ZAI-STRUCTURAL-REMEDIATION-R0-R10-EXECUTION-CONTRACT-20261007.md:3/:19/:21` (status `R10_…_NOT_STARTED` + fetch-origin/main instructions) — dated-update fields, need a dated reconciliation.
3. `STRUCTURAL-REMEDIATION-PLAN-20261007.md:13` — same status line.
4. `REFACTORING-CONTROL.md:188` (الخطوة الحية) and `:213` (§15-2 row "R10 التالية").
5. `items/ARCH-007.json` `next_action` and `workstreams/WS-216.json` `next_action` ("R10 hostile final audit and closure is next and has not started. No cleanup or branch deletion.") — plus the 3 generated views quoting them (AGENT-BRIEF:37, ACTIVE-WORK:7, MASTER-TRACKER.csv:5/.md) — regenerate via `generate_tracker.py` in the same PR.
6. The R10-A ledger/report themselves are window-scoped facts (AUDIT_SHA_X=ffc54eb, CI run 38131757677, "open PRs #344/#351") — historically true after merge, but any "current" phrasing in them stales.
7. `context.md:10` is **already stale at ffc54eb** (see N3) and compounds.

Key mechanical note: **no validator will fail** when main advances — `WS-216.base_sha=507a28e2` is protected by validate.py's snapshot-only-main-workstream exemption (:155–164), and `merge_sha`/`verified_on_main_sha` (=e80f7509) remain ancestors; the meta digest only breaks if JSONs change without regeneration. The phase-status staleness is therefore **human-detectable only** — exactly the #348/#349 pattern (post-merge reconciliation PRs were needed each time). The R10-B/R10 closure PR must bundle: current-state update + contract/plan/CONTROL status reconciliation + ARCH-007/WS-216 next_action + view regeneration.

### E-UNV-006 — preserved UI branch immutability

- Branch exists: `origin/docs/ux-ui-zed-handoff-20260921`, head **`f28b0fa6b933336fb1b847b906bf126de6f87e2d`**, authored **2026-09-21 20:05:22 +0000** by Qays7753 ("docs: add approved UX/UI implementation package"; one prior commit b88c931e 20:04:47 "add Zed UX/UI handoff entry point").
- Non-ancestor status: merge-base with main = `b0b4cea66a06c295c65eb895dc2b9067c8b732cf` (2026-09-21, OPS-003 closure); the two handoff commits are **NOT ancestors of main** — the branch is deliberately unmerged/diverged.
- In-repo immutability evidence:
  - `evidence/branch-cleanup-snapshot-2026-09-30.json` — `excluded_branch_names` explicitly lists `docs/ux-ui-zed-handoff-20260921` among 10 preserved names (45 verified deletion candidates do not include it); snapshot pins `main_sha_verified=6f6e1afe…` provenance.
  - `current-state.md:85` (§8.2 item 6): "فرع … غير المدمج **محفوظ عمدًا** (يحوي ملفات فريدة) — لا يُحذف قبل قرار مالك صريح (اللوق §88–§90)".
  - `current-state.md:106` (§9 المحظور): "لا لمس فرع UI المحفوظ".
  - `current-state-log.md:850` (handoff executed read-only @ f28b0fa), `:1790` and `:2074` (R5 verification "محفوظ بلا لمس"), `:1805` (R0 verification "محفوظ عند f28b0fa6 لم يُمس").
- Assessment: immutability is enforced by documented exclusion records + repeated per-wave verification attestations + explicit prohibition rows — no mechanical branch-protection (server-side) is evidenced in-repo (that would live in GitHub settings, unverifiable from the clone). Static evidence is strong and consistent across ≥5 independent dated attestations.

---

## 6. New findings (not in R10-A)

| ID | Finding | Evidence (file:line) | Severity | Disposition recommendation |
|---|---|---|---|---|
| **RV5-N1** | LEGAL-001 blocked_reason is stale/false: cites FIN-007 as unmet dependency, but FIN-007 has been VERIFIED since 2026-09-22 (893e3c864, WS-173/PR #211). True remaining blocker is external (specialist selection — owner_decision field). R10-A's "3 BLOCKED carry exact blockers" is refuted for this item. | `items/LEGAL-001.json` (blocked_reason, updated_at 2026-09-19) vs `items/FIN-007.json` (VERIFIED, verified_on_main_sha 893e3c864…) | S3 | Dated correction of blocked_reason in a docs-only control batch (part of R10-B docs wave): replace dependency-based blocker with the external owner-action blocker. |
| **RV5-N2** | DEVICE-001 blocked_reason half-stale: cites "UX-001, REL-001"; REL-001 VERIFIED since 2026-09-23 (027fc7b5). UX-001 (IN_PROGRESS) and external device availability still stand. | `items/DEVICE-001.json` vs `items/REL-001.json` | S3 | Same dated correction (drop REL-001; keep UX-001 + external environment). |
| **RV5-N3** | `docs/operations/control/context.md` — a LIVE control doc ("السياق الدائم", routed from AGENTS §2 CORE+OPS pack) — carries stale live-state: :10 row "`main` الحالي … آخر SHA مُتحقق منه: 2680fd86… (2026-10-02)" (9 days / ~40 PRs stale at ffc54eb); :11 "آخر موجة = UX-001 Phase 2… WS-204…TEST-001" (last waves are now R0–R9); :12 "لا توجد Claims أو PRs تشغيلية نشطة" (WS-216 IN_PROGRESS in the same directory's views); :75 "قائمة PRE-PILOT تضم 35 متطلبًا" (live pre-pilot.json: 43); :91 quotes a 2026-10-02 §8.2 snapshot. This is a live-instance of the F-033 drift family that PR #350's policy ("no live doc claims a non-live-fact SHA as current main") did not catch — R10-A's residual list (log/report entries only) missed it. | `context.md:10–12, :75, :89–91` | S3 | Add context.md to the R10 reconciliation batch: either date-stamp its الحالة المختصرة rows or convert them to pointers to current-state.md §1/§8.2 (its own :91 already declares current-state §8.2 authoritative — the rows should not duplicate it). |
| **RV5-N4** | Gate-definition mismatch: `releases/pre-pilot.json` requires 43 items (updated 2026-09-29) but `items/PILOT-001.json` lists only 35 dependencies (updated 2026-09-19). Missing 8: FIN-009, REM-001..REM-007 (all VERIFIED — no current gating impact, but the two canonical gate definitions disagree and the item was never reconciled when the gate file was updated). | `pre-pilot.json` required_items (43) vs `PILOT-001.json` dependencies (35) | S3 | Reconcile PILOT-001 dependencies with pre-pilot.json (or document the intended difference) in the R10-B docs batch. |
| **RV5-N5** | Dangling pointer in a live decision doc: `docs/decisions/review-finance-c2-decision-v1.md:67` references `apps/prototype-web/client/src/pages/Review.tsx` which does not exist (pages contain DeliveryReview.tsx / SharePreview.tsx). | file:line as cited | S4 | Dated correction or note in the decisions doc. |
| **RV5-N6** | Dangling attachment: `docs/decisions/remaining-capabilities-review-v1.md:155` links `../../../upload/pasted_content.txt` — no `upload/` dir in repo; the "attached capabilities map" underpinning the decision is not in-repo. | file:line as cited | S4 | Record the map's canonical location (external) or import it under docs/ with a dated note. |
| **RV5-N7** | (Refinement, R10-A F-033 residual) context.md:10 uses the "`main` الحالي" phrasing with a stale SHA in a live doc — one instance beyond R10-A's residual list (which named only current-state-log §174-175, worklog Entry 88, WS-203 note, REFACTORING-EXECUTION-REPORT:103). | context.md:10 | S3 (merged with N3) | — |
| **RV5-N8** | (Info) BE-001..003 next_action phrasing uses a literal Python-tuple string "تابع ('DUPLICATE_HISTORICAL', 'OPS-003')" — machine-ish text in a human field; harmless but confusing. | items/BE-001..003.json | S4 | Cosmetic cleanup in a docs batch. |
| **RV5-N9** | (Refinement of R10-A counts) "17 PILOT_EVIDENCE_REQUIRED" is a miscount; canonical = 14 (B.1). Also R10-A's citation of L-C/L-E/L-G/V7/V10/V12 as "INDEPENDENT-TRACKS-RECORD rows" is a location slip (they are R0 §6.4 / plan A.6–A.7 rows; INDEPENDENT-TRACKS-RECORD holds R/S/T/U/V/W/X). | see A.4/B.1 | S3 (record correction) | Correct the R10-A ledger numbers/attributions in the R10 evidence package before closure. |

## 7. Unverified limits

- **No executions:** validate.py, generate_tracker.py --check, unittest, pnpm check were NOT run (read-only mandate). Freshness (B.6) was verified by independently reimplementing the digest/sha256/counting logic — equivalent evidence, but not the tool's own exit code.
- **Network/PR state:** GitHub API rate-limited during the session (prs-open.json contains a rate-limit error). Open-PR facts (#344/#351/#352) come from the clone's fetched remote refs + the R10-A inventory (untrusted input, used only as a claim to check against local refs); current merge state of #351/#352 on GitHub is unverified from here.
- **Remote refs may be stale:** the clone's origin refs reflect the last fetch; branch heads (e3be3897 / a2a1af7e / faa572eb / f28b0fa6) are verified as present in local refs, not as live-current.
- **The "17" decomposition is inferential:** the R10-A package does not itemize the 17 IDs; BE-001..005+V-001..012 (=17) is the most plausible source of the miscount, but PILOT(14)+OUT_OF_SCOPE(3)=17 is arithmetically possible too.
- **External-repo instruments unverifiable:** the V-* items' pilot-validation plan and BE/SCOPE source reports live in github.com/Qays7753/Documents — outside this clone; their existence/content (including whether they define detection methods) could not be checked (network prohibited).
- **Dangling-link sweep coverage:** 372+30 markdown files, 732+1 relative links; exotic link forms (raw `<path>` autolinks, non-md extensions, links inside code fences) were not exhaustively parsed; Arabic-label edge cases could hide a small residual. Archive-doc links counted but classified historical without individual severity triage.
- **In-repo evidence only for E-UNV-006:** server-side branch protection / GitHub UI state cannot be verified from the clone; immutability rests on in-repo exclusion records + attestations.
- Contract 40 (ownership map) itself was only spot-checked (rows cited by other docs); a full contract-40 row-by-row verification belongs to RV1/RV2 scope.

## 8. Closure statement

**No writes were performed to the repository.** The clone at `/home/z/my-project/r10b/clone` remains at `ffc54eb1150932c9bba88b48a7c38275f2a3effa` with a clean tree; the only file created by this review is this report under `/home/z/my-project/r10b/scratch/reviewers/`.
