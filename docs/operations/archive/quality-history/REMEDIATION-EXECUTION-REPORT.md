# Micro — Remediation Execution Report

Full-system review remediation · branch `remediation/full-2026` (56 commits, `8ee0832..d920246`) · base `main @ 8ee0832` (untouched) · PR #140 draft open, **not merged** · **all 56 commits pushed to origin** — remote HEAD `d920246`, confirmed via `git ls-remote` after `GH_TOKEN` re-provision (R-5 closed).

Sources: `worklog.md` (R-0, R-3, R-4, R-5, R-6, R-7b, R-7c), `git log 8ee0832..HEAD` (subjects + bodies), `docs/quality/VERIFICATION-LOG.md` (commit 2bc3e80), `download/MICRO-REVIEW-FINDINGS.md`, `download/MICRO-REMEDIATION-PLAN.md`.

---

## 1. Executive summary

- **64 findings** from the five-agent full-system review (Agent 1 code, Agent 2 accounting, Agent 3 UX, Agent 4 language, Agent 5 expansion; duplicates merged C-02→A-02 and C-04+C-05→A-07; 2 CRITICAL, 20 HIGH, 33 MEDIUM, 9 LOW). **All 64 CONFIRMED** by Agent 1's independent verification on the unfixed tree (12 fresh reproducer failures + re-location of every anchor; commit 2bc3e80).
- **Terminal states:** 38 fixed in code with gated commits (Phases 1–7); 6 fixed docs-only (Phase 0); 8 spec-committed (Phase 8); 5 spec-committed with an explicit open owner question; 1 mini-spec + escalated (U-08); 4 escalated as pure owner decisions (A-06, U-03, U-07, E-15); 1 verified-no-op (L-19); 1 spec unwritten and carried forward (E-04).
- **Tests:** 87 root + 264 prototype (baseline) → **112 root + 306 prototype** (+25 / +42; 351 → 418 total; count never decreased). **Lint unchanged: 0 errors / 48 warnings** at every gate. `main` untouched at `8ee0832`.
- **No schema/export version change anywhere; no historical value altered.** One additive non-financial `LocalPreferences` field (`installBannerDismissedAt`, U-10).
- **Quality gate:** Agent 3 reviewed all 56 commits across 7 checks; verdicts ACCEPTED for all — after five QA correction commits (c58a197, 3d43624, 7619e42, 8883155, 995ce7c; the brief counts the last four as the gate's corrections, c58a197 closed the U-04-class leftover R-3 had flagged) and the current-state §15 record (d920246). The R-8 worklog entry that would have narrated the gate pass was lost to a context deadline; the corrections are evidenced by the commits themselves (see §6).
- **Push status:** all 56 commits on `origin/remediation/full-2026` (remote HEAD `d920246`, confirmed via `git ls-remote`); the 34-commit backlog (`dc6c18f..d920246`) was pushed in one batch after `GH_TOKEN` re-provision — R-5 closed.

---

## 2. Per-finding table (all 64 IDs)

Verdict column: Agent 1's independent verification (VERIFICATION-LOG.md, commit 2bc3e80) — **every finding CONFIRMED**; nothing was NOT-REPRODUCIBLE, ALREADY-FIXED, or INVALID. Group per plan §3 († = not explicitly listed in §3; classified from the card's own dependencies).

| ID | Severity | Verdict | Status | Group | Commit(s) | Approach | Test added | Gate note |
|---|---|---|---|---|---|---|---|---|
| C-01 | CRITICAL | CONFIRMED | FIXED | A | c92857e | G5 `expenseInputs` nets reversals period-locally like the G3 reader (contract 14 §6) | Y — g5Service.test.ts (same-window reversal, cross-period, unallocated double-count) | Fail-first; gate 90+272 |
| C-03 | MEDIUM | CONFIRMED | FIXED | A | 092fe0f | Coverage card calls new domain export `calculateBreakEvenUnits`; overflow → null + reason | Y — tests/domain/g5.test.ts (vectors, overflow) + projectFinancialService.test.ts (9e15-minor → null) | Neutralization fail-first; gate green |
| C-06 | LOW | CONFIRMED | FIXED | A | 20ba580 (+995ce7c QA) | `PreferenceService.readBrowserPersistence()`; ESLint bans `@/storage/local/*` value imports from pages (`allowTypeImports`) | Y — preferenceService.test.ts (navigator shapes); lint probe demonstrated then removed | QA: dead value-import corrected (995ce7c) |
| A-01 | CRITICAL | CONFIRMED | FIXED | A | da6c5ca | One domain derivation `activeSettlementsMinor` + `reversedEventIds` wired into all **five** readers (5th consumer `validateRelation` found at verification) | Y — tests/domain/financial-event.test.ts (+3) + three-surface agreement service tests (+3) | Fail-first; gate 90+267 |
| A-02 | HIGH | CONFIRMED | FIXED | A | 7d378cc | Purchase-receipt quota excludes receipts a live reversal cancelled | Y — inventoryMaterialService.test.ts (+2) | Fail-first; gate 90+274 |
| A-03 | HIGH | CONFIRMED | FIXED | A | 21fa2bb | Settlement source must be live (reuses A-01 predicate) + dropdown filter | Y — projectFinancialService.test.ts (+2) | Fail-first; gate 90+269 |
| A-04 | MEDIUM | CONFIRMED | FIXED | A (behind A-07 guard) | 1700bfb (amended) | Integer-space rounding via shared `quantityMilliExact`/`roundHalfUp`; sub-milli rejected loudly | Y — craft-order + shared tests (+5: 1.005×100→101, 0.29×50→15, 91min→152, sub-milli, helper vectors) | Process slip: committed at 50 warnings, amended (§6); gate 95+284 |
| A-05 | MEDIUM | CONFIRMED | FIXED | A | 3422e56 | `isRegisteredCustomerDebt` domain predicate consumed by G5 + pulse; declaration linkage restricted to debt orders | Y — g5Service.test.ts (+2; pulse/G5 agreement) | Fail-first; gate 90+276 |
| A-06 | MEDIUM | CONFIRMED | ESCALATED | B/C | 66708d0 (register §4) | Dust-trap fix changes *when consumption is allowed* (contract 11 policy) — owner picks consume-to-remaining vs message-only | N — no code change | Docs-only; check re-run green |
| A-07 | MEDIUM | CONFIRMED | FIXED | B (contract first) | 7c8e0f2 + a892ace + 1700bfb + 46c8ac7 + dc6c18f | ESLint guard bans raw Math.round/floor in src/domain (Math.ceil allowed, contract 03); contract 05 §5.3 written **before** the 151→152 boundary change; 3 migrations (craft-order, owner-entitlement, catalog preview via `perOutputUnitAmountMinor`) | Y — +10 root (46c8ac7, incl. wiring an orphaned test file; 91min→152, 2.5×101→253, bps share) +2 root (dc6c18f: 2.475→248, page-vs-domain agreement) | Zero allowlists at end; gate 105→107 root |
| A-08 | LOW | CONFIRMED | FIXED | A | 4af66c1 | `draft → postponed` added to the transition table per contract 02 | Y — craft-order.test.ts (draft→postponed OK; delivered still rejects) | Neutralization fail-first |
| A-09 | LOW | CONFIRMED | FIXED | A | 8362611 | Freshness compares Amman-local calendar dates (Intl formatToParts), not UTC instants | Y — craft-order.test.ts (same-day known; yesterday stale) | Neutralization fail-first |
| A-10 | LOW | CONFIRMED | FIXED | A | ec97415 | Domain requires transfer delta sign to match direction; import validator gains the same two conditions | Y — cashContinuityService.test.ts (−3000 rejected) + localTransferService.test.ts (flipped-sign pair refused) | Neutralization fail-first (both legs) |
| U-01 | HIGH | CONFIRMED | FIXED | A | cc46a13 | Sentinel history entry + popstate interception + beforeunload around dirty forms | Y — UnsavedChangesGuard.history.test.tsx (+5 jsdom) | Fail-first; gate 90+281 |
| U-02 | HIGH | CONFIRMED | FIXED | A | 2f332a1 | Editor navigates to ledger on success; reused-save message states the edit was NOT saved | Y — FinancialEventEditor.ui.test.tsx (+2, written first) | Fail-first; gate 90+283 |
| U-03 | HIGH | CONFIRMED | ESCALATED | B/C | 66708d0 (register §1) | Expose `cancelOrder` in OrderDetail vs document the deferral — owner decision (contract 02 already documents the path) | N | Docs-only |
| U-04 | MEDIUM | CONFIRMED | FIXED | A | 356fe80 (+c58a197 QA) | Shared `fieldLabelAr` map + Arabic guards in the five modules (incl. business rules); editor required-marker. QA completion: craft-order/g5's 25 remaining English throws via `ORDER_STATUS_AR` | Y — editor empty-note test + ~15 assertions EN→AR; QA: 12 assertions follow renames | rg "is required" → zero; QA: rg English throws in src/domain → zero |
| U-05 | MEDIUM | CONFIRMED | FIXED | A | 823bdb7 | Inverted month range is an inline field error; last valid reading stays on screen | Y — U05.dom.test.tsx (+1) | Fail-first; gate 112+290 |
| U-06 | MEDIUM | CONFIRMED | FIXED | A | 0a11ff0 | Quick-action intent rides the route (`?intent=`); NewDraft consumes it once | Y — U06.dom.test.tsx (+4) | Fail-first; gate 112+294 |
| U-07 | MEDIUM | CONFIRMED | ESCALATED | C† | 66708d0 (register §2) | Sheet composition (expense/purchase/material entries) needs the owner's nod | N | Docs-only |
| U-08 | MEDIUM | CONFIRMED | SPEC-WRITTEN + ESCALATED | B/C | 66708d0 (mini-spec + register §3) | `docs/product/draft-dismissal-mini-spec-v1.md`: dismiss-with-reason, immutable history, attention reorder; storage implications stop at the migration gate | N — tests owed at implementation | Docs-only |
| U-09 | MEDIUM | CONFIRMED | FIXED | A | 801aaa5 | 48px min-height on month inputs; 44/48px on text actions | Y — U09.css.test.ts (+2, CSS contract test) | Fail-first (neutralized stylesheet); gate 112+296; live re-measurement deferred to browser QA |
| U-10 | MEDIUM | CONFIRMED | FIXED | A | 22b3816 | `installBannerDismissedAt` in LocalPreferences + pure 30-day window predicate; writers preserve the field | Y — preferenceService/install/U10.dom.test.tsx (+5: 29/31-day boundary, survives theme save, hidden after remount) | Fail-first; gate 112+301 |
| U-11 | LOW | CONFIRMED | FIXED | A | 1fb83c2 | Backup actions carry Arabic text labels («تصدير»/«استيراد»); data layer open by default | Y — U11.dom.test.tsx (+1) | Fail-first; gate 112+302 |
| L-01 | HIGH | CONFIRMED | FIXED | B | 5886521 (glossary e5dea55) | «متوقع» family across 8 files incl. domain + storage strings; contract 17 terminology note | 1 assertion follows rename | Copy-only; gate 90+276 |
| L-02 | HIGH | CONFIRMED | FIXED | B | bf429d5 (+3d43624 QA) | English tokens purged per Appendix A (21 files); QA completed recurring-margin domain copy | 1 assertion moved (source-name fact) | Acceptance grep; QA: rg banned tokens in src/domain → zero |
| L-03 | HIGH | CONFIRMED | FIXED | A | c3660ce | Exclusion sentences use `order.itemName` + Arabic status map; audit lines carry dates, not UUIDs | Root exclusion test pins named sentence + asserts id absent | Gate 112+302 |
| L-04 | HIGH | CONFIRMED | FIXED | B | 3695f81 (+7619e42 QA) | «المحتسب عند التسليم» replaces recognition jargon; QA completed owner-entitlement domain copy | N (no test asserted the wording) | Acceptance grep «معترف» → zero (client), then domain (QA) |
| L-05 | HIGH | CONFIRMED | FIXED | B | 28b6d95 (+7619e42 QA) | «نتيجة الفترة المسجلة» / «الهامش بعد الكلفة المباشرة» / «كم وحدة تغطي المصاريف الثابتة»; QA completed G5 margin reasons | 3 U05 heading assertions moved | Acceptance greps → zero |
| L-06 | HIGH | CONFIRMED | FIXED | A† (with U-01) | cc46a13 | Drawer copy states the truth where interception is impossible (promise narrowed, never widened) | Y — covered by the U-01 history test | With U-01 |
| L-07 | MEDIUM | CONFIRMED | FIXED | B | d656414 (+3d43624 QA) | «توزيع» family incl. the domain g5 reason string; QA completed recurring-margin domain | g5Service gap-reason filter follows rename | Acceptance grep leaves only genuine load contexts |
| L-08 | MEDIUM | CONFIRMED | FIXED | B | 1e7abd0 | «حق المالك» retires «استحقاق» (7 files, ~90 strings) | N (no coupled assertions) | Copy-only; gate 112+302 |
| L-09 | MEDIUM | CONFIRMED | FIXED | B | 0c7646a | «دين» retires «ذمة» (6 files; scope extension recorded) | Coupled root test updated | Acceptance grep: only supplier-payable side remains (different concept) |
| L-10 | MEDIUM | CONFIRMED | FIXED | A† | fa28935 | Canonical «الخطوة التالية» (8 files incl. domain guidance ×4) | Coupled craft-order test updated | Acceptance grep: one variant remains |
| L-11 | MEDIUM | CONFIRMED | FIXED | B | 2daf8a8 | «حالة الرقم: مؤكد / تقديري» on all four surfaces; enum untouched | N (no coupled tests) | One wording everywhere; 5 concept-reference strings deliberately kept |
| L-12 | MEDIUM | CONFIRMED | FIXED | B | 3e7608d | «تراجع موثق» family (28 files, ~130 strings) | 3 coupled tests updated | Copy-only; mechanics untouched |
| L-13 | MEDIUM | CONFIRMED | FIXED | B | f792db5 | «نسخة جديدة» retires «خليفة/السلسلة/قفل» | Coupled service/transfer tests updated | Acceptance grep → zero |
| L-14 | MEDIUM | CONFIRMED | FIXED | A† | 01dc7ef | Home unified to «مشروعي الآن»; «مركز قيادة» retires; ungrammatical capacity sentence fixed | N | Copy-only |
| L-15 | MEDIUM | CONFIRMED | FIXED | A | 15e5178 | Every owner-read date through `formatLocalDate(Long)`/`formatMonthLabel`; numeric remains in `bdi` | N | Acceptance grep: no raw ISO in rendered strings |
| L-16 | MEDIUM | CONFIRMED | FIXED | B | f2b89fd (+8883155 QA) | One name per action («طلب من عميل», «تسجيل الاتفاق», «نسخة جديدة», «حدث مالي»); QA completed NewDraft's guard note | Coupled tests updated | Acceptance greps; QA rg «تثب» leaves install family + deferred Schedule sentence |
| L-17 | MEDIUM | CONFIRMED | FIXED | A† | 14e2999 | Real words («مواعيد قادمة», no «الحارس», no invented archive, «مشغل حرفي») | Fixture string follows rename | Acceptance grep → zero |
| L-18 | LOW | CONFIRMED | FIXED | A | 3629b94 | Four count templates through `formatArabicPlural` (helper extended with full-form sets) | Y — plurals.test.ts (+4 dual-form) | Gate 302→306 |
| L-19 | LOW | CONFIRMED | VERIFIED-NOOP | A | — (no commit) | Systematic scan: zero micro-button labels over 28 chars after the L-01/L-08/L-17 renames (worst now 26) | N | R-7c records the verification; nothing to change |
| E-01 | HIGH | CONFIRMED | SPEC + OPEN QUESTION | C (X-06) | 07d54c3 | Contract 21 §3.1 courier-silence path as a labeled default (no_quotes_received, 48h, time-evaluated, 3 exits) — pending EX-O09 | N/A (docs) | Matrix verified: every state has an exit |
| E-02 | HIGH | CONFIRMED | SPEC + OPEN QUESTION | B† | 07d54c3 | Contract 21 §3.2 full 52-row transition matrix (state × event → next, actor, guard); re-request loop restored; dispute exit defined | N/A | Every delivery state verified present with an exit or documented terminal |
| E-03 | HIGH | CONFIRMED | SPEC + OPEN QUESTION | C | 07d54c3 | Routing field with three candidate semantics documented; `courier_company_profile` dictionary row conditional on EX-O10; ROLE-ACCESS-MATRIX cell defined by the routing rule | N/A | Programmatic table-structure check |
| E-04 | HIGH | CONFIRMED | **UNWRITTEN** (next phase) | B† | — (interim guard in 07d54c3) | Quote lifecycle was not in Agent 4's card list; contract 21 §3.2 carries an interim honest guard (expired quotes not acceptable); `quote_expired` notification notes the dependency | N/A | Flagged in R-6 — not silently dropped |
| E-05 | HIGH | CONFIRMED | FIXED (docs) | A | 973367c | TRACKER L-04.2 cites contract 21 states verbatim + maintenance rule | N/A | Acceptance grep: "dispatched" → zero |
| E-06 | HIGH | CONFIRMED | FIXED (docs) | A | af82e83 | TRACKER L-03.3 cites contract 20 §3.3 (resubmit loop restored) | N/A | Acceptance grep: "under_review" → zero |
| E-07 | MEDIUM | CONFIRMED | FIXED (docs) | A | 6b79e85 | Protocol §2 regenerated from TRACKER §2.1 (14 rows) + maintenance rule; acceptance criterion amended (contract 23 legitimately in two packages) — recorded | N/A | Row sets verified equal |
| E-08 | MEDIUM | CONFIRMED | FIXED (docs) | A | 570d368 | HISTORICAL-SOURCES stale row fixed; neutral header «القرار البديل» (card amendment recorded) | N/A | No cell asserts a false current decision |
| E-09 | HIGH | CONFIRMED | SPEC-WRITTEN | B | 07d54c3 | Contract 24: 8 dictionary rows (6 missing entities + consent_record + conditional courier profile); justified-urgency field added | N/A | All 20 entities of contracts 18–21 verified covered |
| E-10 | HIGH | CONFIRMED | SPEC + OPEN QUESTION | C (X-05) | 07d54c3 | Response contact channel as pending field (option-a default) per EX-O11 | N/A | Docs |
| E-11 | HIGH | CONFIRMED | SPEC + OPEN QUESTION | C | 07d54c3 | Consent belongs to the data subject's side (contract 24 §2); owner previews supplier-requested deliveries; customer-side mechanics deferred EX-O14 | N/A | Docs |
| E-12 | MEDIUM | CONFIRMED | SPEC-WRITTEN | C | 07d54c3 | Gate §9 blocking abuse-control requirements (daily limits, duplicate detection, courier read-auditing) — numbers pending EX-O16; contract 22 §4 audit list extended | N/A | Closing evidence per requirement |
| E-13 | MEDIUM | CONFIRMED | SPEC-WRITTEN | B | 07d54c3 | `consent_record` entity with lifecycle (create/scope/revoke/retention-deferred) | N/A | Dictionary row verified |
| E-14 | MEDIUM | CONFIRMED | SPEC-WRITTEN | B | 07d54c3 | **Contract 25 NEW**: JOD minor units reusing MoneyMinor semantics; null ≠ 0; sub-minor rejected; five boundaries restated; multi-currency → EX-O13 | N/A | Deferral-phrase grep clean across docs/contracts |
| E-15 | MEDIUM | CONFIRMED | ESCALATED | C | 07d54c3 (EX-O12 record only) | Storage location + draft-export scope is the owner's; the migration gate deliberately keeps its NO-MIGRATION truth; SOP row states the drill's actual scope | N/A | Docs only — no decision made |
| E-16 | MEDIUM | CONFIRMED | SPEC-WRITTEN | B† | 07d54c3 | Contract 20: `window_ended` transition (14-day default), honest zero-response state «لا ردود بعد — بيان، لا حكم», response-expiry trigger | N/A | No immortal published needs |
| E-17 | MEDIUM | CONFIRMED | SPEC-WRITTEN | B† | 07d54c3 | Listing/media lifecycle exits drawn + `listing_media` state machine + moderation backlog policy (thresholds pending EX-O15) | N/A | Every listing state has an exit |
| E-18 | MEDIUM | CONFIRMED | SPEC-WRITTEN | C | 07d54c3 | Gate §10 named Jordan legal-domain checklist expanding OR-O04 (6 domains, each with the question and the gate it blocks) | N/A | Docs |
| E-19 | MEDIUM | CONFIRMED | SPEC-WRITTEN | B | 07d54c3 | Contract 19 §9: 12 notification types with trigger, recipient, deep-link, dedup key; no marketing; owner-decision-gated types stay inactive | N/A | Docs |
| E-20 | LOW | CONFIRMED | FIXED (docs) | A | 130a836 | TRACKER L-00.4 cites the IA contract's delivery section names verbatim | N/A | Both sources identical |
| E-21 | LOW | CONFIRMED | FIXED (docs) | A | 36a209f | «ممثل مخول» removed from the glossary Owner row; delegation deferral recorded | N/A | Glossary matches contract 18 |

---

## 3. Statuses by category

**Fixed in code — Phases 1–7 (38 findings).**
Phase 1 reversal family: A-01, A-03, C-01, A-02. Phase 2: A-05, L-01. Phase 3: U-01+L-06, U-02, U-04. Phase 4: A-07 (guard + 3 migrations, with A-04 as migration 1). Phase 5: A-10, A-08, A-09, C-03, C-06. Phase 6: U-05, U-06, U-09, U-10, U-11. Phase 7: L-02..L-18 (L-03/L-15/L-18 group A; the glossary-bound families after the glossary was adopted as a binding artifact, e5dea55).

**Docs/specs.**
- Phase 0 fixed: E-05, E-06, E-07, E-08, E-20, E-21 (six commits, each with its acceptance grep; two card amendments recorded — E-07's two-packages criterion, E-08's neutral header).
- Phase 8 spec-committed: E-09, E-13, E-14 (contract 25 new), E-16, E-17, E-19, E-12, E-18 — mechanisms written, no commercial decision made.
- Spec + open question: E-01 (EX-O09), E-02 (depends on EX-O09), E-03 (EX-O10), E-10 (EX-O11), E-11 (EX-O14) — defaults labeled, awaiting the owner.
- Escalated: E-15 (EX-O12 — the migration gate deliberately untouched).
- Unwritten: E-04 (quote lifecycle) — flagged in R-6, carried to the next phase.

**Escalated owner decisions (no code):** U-03, U-07, U-08 (mechanism specified in the mini-spec, implementation stopped at the migration gate), A-06, plus the prior-plan opens restated for completeness (X-01, X-03, X-04, X-05, X-06, D-04, P-01 layers 1–3, G-01/G-03). Register: `docs/quality/remediation-open-decisions-v1.md` (commit 66708d0).

**Verified-noop:** L-19 (no commit; the scan is recorded in R-7c).

---

## 4. Contracts written/amended (worklog R-6)

- **New:** `docs/contracts/25-network-money-representation-contract.md` (E-14) — JOD minor units reusing `MoneyMinor` semantics, integer-only, two explicit bounds, null ≠ 0, sub-minor input rejected, no arithmetic on network amounts, five financial boundaries restated.
- **Amended:** contract 19 (§9 notification type/trigger table — 12 types, E-19); contract 20 (§3.1 window_ended + honest zero-response, §3.2 response expiry, §3.3 listing/media exits, §3.4 moderation backlog, E-16/E-17); contract 21 (§2 routing field, §3.1 courier-silence default, §3.2 52-row transition matrix + re-request loop + pre-acceptance withdrawal + interim E-04 guard, §3.3 exception enums, §3.4 completion dispute, E-01/E-02/E-03); contract 22 (§4 courier read-audit list, E-12); contract 24 (8 dictionary rows, §2 side-based consent rule, §3.1/§3.2 pending fields + consent_record lifecycle, §4 deferral phrase replaced by a contract-25 link, E-09/E-13/E-03/E-10/E-11/E-14).
- **Contract 05 §5.3** (a892ace, group B before migration): entitlement rounding is half-up to the nearest minor unit, exclusively through the shared helpers — written **before** the A-07 migration that changes the 91min×100 boundary case 151 → 152.
- **Contract 17** terminology note (5886521, L-01): maps the contract's internal term to the UI word «متوقع».
- **Binding glossary:** `docs/08-glossary.md` (e5dea55) adopted per plan Appendix B, including the two KEEP verdicts («سعر الحماية»; «عربون / عليّ للموردين / رصيد / تسوية»).
- Expansion docs: DECISIONS.md §3/§4 extended with EX-O09..EX-O16 (options, consequences, labeled defaults); TRACKER §2.2 spec-status table; ROLE-ACCESS-MATRIX, home-trial SOP, readiness gate §9/§10 updated; MANAGE-NETWORK-MIGRATION-EXPORT-GATE deliberately untouched (E-15).

---

## 5. Schema/export changes

- **`localSchemaVersion` / `localExportVersion`: unchanged.** No Group-A fix bumped a version; nothing reached the migration gate.
- **One additive, non-financial field:** `installBannerDismissedAt` on `LocalPreferences` (U-10, 22b3816) — null default, written by `PreferenceService`, 30-day re-show window. Compatibility rationale (commit body): the field defaults to null on read, the import validator stays lenient, old exports import unchanged, and no stored financial value exists on this record.
- **No historical value altered anywhere.** All Phase-1 money fixes are read-path derivations; restored/imported data heals at read time. The only user-visible number changes are the two documented boundary cases: A-04's rounding counter-examples (1.005×100 → 101, 0.29×50 → 15) and A-07's entitlement 151 → 152 — both contract-authorized (contract 05 §5.3 first).

---

## 6. Quality-gate history

- **Gate discipline:** `pnpm check` green before every commit (typecheck, lint, both test suites, build). After the A-04 slip the gate's exit code was checked explicitly before every commit (R-4/R-5).
- **Agent 3 reviewed all 56 commits across 7 checks** (the plan's reviewer checklist: one-card-per-commit, authorization group, acceptance criteria verbatim, test-count floor, version bump check, stored-value/write-path check, boundary check). **Verdicts: ACCEPTED for all** — after the QA-phase corrections below.
- **QA corrections (all five fix(qa) commits, disclosed in full):**
  1. **c58a197** — the U-04-class leftover R-3 had flagged: 25 English business-rule throws in craft-order/g5 translated; 12 assertions follow renamed strings.
  2. **3d43624** — completes L-02/L-04/L-07 in `src/domain/recurring-margin` (the Catalog panel rendered the domain's old vocabulary verbatim).
  3. **7619e42** — the last glossary-banned words leave the domain copy («معترف», «هامش المساهمة», «Snapshot» in owner-entitlement/g5/actual-time).
  4. **8883155** — completes L-16's family in NewDraft («وتسجّلها»).
  5. **995ce7c** — corrects a C-06 leftover dead import (Settings value-imported a module-level sibling it no longer called).
  The brief counts the last four as the gate's corrections; c58a197 closed the sweep item R-3 had queued. All are copy-only or import-only; every body carries the verification numbers.
- **d920246** — `docs/operations/current-state.md` §15 records the remediation on the branch (append-only per the doc's own rule), after the gate noted the canonical doc stopped at §14.
- **Process slips, both caught and corrected, both disclosed:**
  - **A-04 committed at 50 warnings (R-4):** the `&&` chain bound to the output filter, not the gate. Both new warnings fixed, gate re-run green at 48, the unpushed commit amended.
  - **R-5 verification-script restore bug:** a restore-assert bug briefly removed the A-10 fixes during fail-first verification; re-applied and re-verified.
- **Worklog loss:** the R-8 entry (quality-gate + sweep narrative) was lost to a context deadline; the corrections above are evidenced by the commits themselves and their verification lines (each records 112 root / 306 prototype, lint 0/48).

---

## 7. Test-count trajectory

Checkpoint values as recorded in the worklog and commit bodies (worklog entries R-3/R-4/R-5/R-7b/R-7c survive; the two intermediate steps marked ◇ are evidenced by commit bodies of the lost entries):

| # | Root + Prototype | After | Evidence |
|---|---|---|---|
| 0 | 87 + 264 | baseline, main @ 8ee0832 | Task 1 / R-0 |
| 1 | 90 + 284 | Phases 1–3 (R-3): A-01 +3 root; prototype +20 across A-01/A-03/C-01/A-02/A-05/U-01+L-06/U-02/U-04 | R-3 |
| 2 | 95 + 284 | A-07 guard (no count change) + A-04 (+5 root) | R-4 |
| ◇ | 105 + 284 | A-07 migration 2 (+10 root, incl. wiring the orphaned owner-entitlement test file) | 46c8ac7 body |
| 3 | 107 + 284 | A-07 migration 3 (+2 root) | dc6c18f body |
| 4 | 112 + 284 | Phase 5 domain legs (+5 root) | R-5 |
| 5 | 112 + 289 | Phase 5 service legs (+5 prototype) | R-5 |
| 6 | 112 + 290 | U-05 (+1) | 823bdb7 body |
| ◇ | 112 + 294 | U-06 (+4) | 0a11ff0 body |
| 7 | 112 + 296 | U-09 (+2) | 801aaa5 body |
| 8 | 112 + 301 | U-10 (+5) | 22b3816 body |
| 9 | 112 + 302 | U-11 (+1); held through L-02..L-17 (copy-only) | 1fb83c2 body / R-7b |
| 10 | 112 + 306 | L-18 dual-form tests (+4) | R-7c |

Floor honored: the count never decreased (plan guardrail 8: ≥ 87 + 264 + new). Final gain: **+25 root / +42 prototype** (351 → 418 tests; root files 10 → 11, prototype files 49 → 57).

---

## 8. Escalations needing owner decision

Register: `docs/quality/remediation-open-decisions-v1.md` (66708d0) + `docs/expansion/DECISIONS.md` §3/§4 EX-O09..EX-O16 (07d54c3).

**Core-product decisions:**
1. **U-03** — expose order cancellation in OrderDetail (recommended: yes, contract-02-conformant) vs document the deferral. The ledger currently keeps a wrong-price order forever.
2. **U-07** — quick-sheet composition: add expense/purchase/material entries (all routes exist).
3. **U-08** — draft-dismissal mechanism: mini-spec written (`docs/product/draft-dismissal-mini-spec-v1.md`), recommended dismiss-with-reason; the two new OrderDraft fields stop at the migration gate.
4. **A-06** — inventory dust-trap: consume-to-remaining-value with reason vs keep refusal with an honest boundary message (contract 11 policy; must amend the contract first either way).
5. **D-04** (prior open, restated) — which knowledge deficiency surfaces first when several are missing.

**Expansion decisions (EX-O09..EX-O16), each with options, consequences, and a labeled default:**
EX-O09 courier silence (48h default) · EX-O10 routing model (a/b/c) · EX-O11 response contact loop · EX-O12 network storage location + draft-export scope (E-15; the migration gate keeps its NO-MIGRATION truth until decided) · EX-O13 multi-currency · EX-O14 customer-side consent mechanics (legal) · EX-O15 moderation backlog thresholds · EX-O16 abuse-control numbers (gate-A blocking).

**Prior-plan opens, unchanged:** X-01 (second-profile migration path), X-03 (wedge selection), X-04 (profile exit), X-05 (supplier acquisition), X-06 (courier silence — now spec'd with a default, decision pending), P-01 layers 1–3 (backup cadence UX), G-01/G-03 (governance volume / CI architecture tests).

---

## 9. Next-phase notes

1. **Push complete:** all 56 verified commits are on `origin/remediation/full-2026` (remote HEAD `d920246`, confirmed via `git ls-remote`); PR #140 stays draft; merge is an owner action after review.
2. **E-04 (quote lifecycle) unwritten:** expiry behaviour, withdrawal after acceptance, multi-quote cardinality, post-acceptance price change. Contract 21 §3.2 carries an interim honest guard (expired quotes not acceptable); `quote_expired` notification notes the dependency.
3. **QA follow-up observations (recorded, not fixed):** «درجة المعرفة» survives in five concept-reference strings outside L-11's surfaces (never flagged; deliberately kept — candidate for a future family); «Owner Draw» token in one ownerEntitlementService truth sentence; «تقديري معلن» G5 option keeps «معلن»; Schedule's slot-confirm «تثبيت» sentence (deferred by L-16 as a separate concept); contract UI-terms notes for contracts 05/12/14/17 (glossary binds user copy, not contract internals); ROLE-ACCESS-MATRIX §3 disclosure-row wording not yet aligned to the side-based consent rule.
4. **P-01 layers 1–3** (backup cadence/reminders) remain the prior plan's open item; U-11 removed one barrier.
5. **X-01 prior opens** unchanged (see §8).
6. **current-state.md §15** must be merged with the branch; its header date intentionally stays at the last merged state until the merge PR.

---

## 10. Final `pnpm check` output summary

Run at branch head (`d920246`) after all work:

- **Exit code: 0.**
- Typecheck (`tsc --noEmit`): clean.
- Lint: **0 errors / 48 warnings** — exactly the pre-remediation baseline (`✖ 48 problems (0 errors, 48 warnings)`; the warning set is the pre-existing complexity / max-lines-per-function family in domain policies).
- Tests: root suite **11 files / 112 tests passed**; prototype suite **57 files / 306 tests passed** (0 failed, 0 skipped).
- Build: vite production build + PWA `generateSW` succeed (49 precache entries, 1140.44 KiB; built in ~3.7s).

The gate is green at head with the test floor raised by 67 tests and the warning count unchanged from the baseline.
