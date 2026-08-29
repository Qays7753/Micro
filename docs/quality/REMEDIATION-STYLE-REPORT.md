# Micro — Remediation Style Report

Branch `remediation/full-2026` (56 commits, `8ee0832..HEAD`) · base `main @ 8ee0832` · PR #140 (draft, unmerged) · gate green at head: 112 root + 306 prototype tests, lint 0 errors / 48 warnings, `pnpm check` exit 0.

Sources: `/home/z/my-project/worklog.md` (entries R-0, R-3, R-4, R-5, R-6, R-7b, R-7c), `git log 8ee0832..HEAD` (all 56 commits, subjects + bodies), `download/MICRO-REVIEW-FINDINGS.md`, `download/MICRO-REMEDIATION-PLAN.md`. Two worklog entries that would have narrated Phase 6 + L-02..L-07 and the quality-gate pass (R-8) were lost to context deadlines; for those commits the commit bodies themselves are the evidence and are quoted as such below.

---

## 1. Purpose and method

This report answers one question: **do the 56 remediation commits read like the rest of the repo, or can a repo-knowledgeable reader identify the new lines by style alone?**

Method — the 9-dimension style protocol applied to every change:

1. **Result shapes** — services return `{ ok: true; value; reused? } | { ok: false; code: "validation_error" | "storage_error"; message }`.
2. **User-copy language** — Arabic in every user-visible string, English in every identifier, enum, and code comment (one recorded exception).
3. **Layering** — financial meaning lives only in `src/domain`; pages → application services → storage.
4. **Regression-test discipline** — fail-first tests (written to fail on the unfixed or neutralized tree), named by finding.
5. **Describe-block tagging** — finding-tagged `describe` titles.
6. **Fixture style** — module-level fixtures with spread, forced by the 48-warning lint budget.
7. **Commit-message house format** — `fix(<finding-id>): …` subject with a five-section body.
8. **Commit granularity** — one finding (or one homogeneous copy family) per commit.
9. **Test-suite placement** — domain/service tests in the existing suites; jsdom tests at `src/` level named `U0X.dom.test.tsx`.

Two operative rules made the protocol concrete:

- **Read before writing:** before touching a file, the implementer read the target file plus at least two sibling files that already solve the same class of problem (evidenced throughout the bodies: A-02 "mirrors the same file's own reversal-aware convention (`readOrderActualMaterialComparison`)"; A-09 "the same Intl Asia/Amman formatToParts idiom every sibling reader already carries"; C-01 "pattern exists in the same file"; U-02 "matching the sibling SupplierPurchaseEditor's own pattern"; U-10 "the durable-preferences pattern already existed").
- **One-line self-check per commit:** every commit body closes with a Verification line (the gate numbers) and a **"Deliberately unchanged"** line naming exactly what was *not* touched — the self-check that the change stayed inside its finding and inside the house style.

---

## 2. Idiom catalogue observed in this repo

- **Result shapes:** `{ ok: true; value: T; reused?: boolean } | { ok: false; code: "validation_error" | "storage_error"; message: string }` (e.g. `projectFinancialService.ts:136-137`); the failure `message` is Arabic. All new service code (A-01's `listSettleablePayables`, C-06's `readBrowserPersistence`, U-10's preference writers) follows it.
- **Arabic user copy, English code identifiers:** user-visible strings are Arabic (`«تعذر قراءة السجلات المالية المحلية.»`); enums, types, function names stay English (`KnowledgeState`, `settlementStatus === "debt"`); raw enum values are mapped to Arabic before rendering (L-03's status map, c58a197's `ORDER_STATUS_AR`).
- **Domain purity + application-service orchestration:** derivations of financial meaning live in `src/domain/**/policies.ts` and are consumed by services (`activeSettlementsMinor` (A-01), `isRegisteredCustomerDebt` (A-05), `calculateBreakEvenUnits` (C-03), `perOutputUnitAmountMinor` (A-07 migration 3)); pages hold presentation only.
- **Fail-first regression tests named by finding:** tests were written against the unfixed tree (U-02: "written first, failed, then passed"), pinned to the review's reproducer sequences (A-01's 10,000 → 6,000 → reverse → 10,000), or verified by neutralizing the fix and re-running (R-5: A-08, A-09, A-10-domain, A-10-import, C-03-service each failed 1 test without the fix).
- **Finding-tagged describe blocks:** e.g. the A-04 describe in `tests/domain/craft-order.test.ts`; new tests sit "beside the module's existing describe blocks" (A-01) rather than in new files.
- **Module-level test fixtures:** base-fixture spread idiom introduced to keep test describes under the lint function-size limits — the 48-warning budget forced it (R-4: "97-line describe → base-fixture spread idiom"; R-5: "split 87-line describe via module-level fixtures (lint stays 48)").
- **Commit-message house format:** `fix(<id>): <imperative one-liner>` — lowercase, Arabic-first for copy fixes — with body sections *Root cause / Fix (What changed) / Tests (Idiom) / Verification / Deliberately unchanged*; docs commits use `docs(...)`. Every one of the 56 commits follows it.
- **One-finding-per-commit** (plan guardrail 7), with two recorded batching exceptions (§4).
- **MemoryLocalStore-backed service tests:** service tests execute the real services over `MemoryLocalStore` (the U-05 test body: "real services over MemoryLocalStore"), continuing the verification-log methodology.
- **jsdom dom-tests at `src/` level named `U0X.dom.test.tsx`:** the pre-existing `U01.dom.test.tsx` precedent (prior review) was continued as `U05`, `U06`, `U10`, `U11.dom.test.tsx` (+ `U09.css.test.ts`), all using the mocked-services hook + wouter pattern with plain `toBeTruthy` assertions.

---

## 3. Conformance table — one row per commit

Ordered oldest → newest. "Files" is the changed-file count from `git log --name-only`. QA-phase corrections are listed with the finding they complete.

| SHA | Finding | Files (scope) | Idiom followed | Deviations / notes |
|---|---|---|---|---|
| 2bc3e80 | (process) | 3 — docs/quality: VERIFICATION-LOG + both review reports | docs commit; PR made self-contained | None |
| 973367c | E-05 | 1 — TRACKER.md | docs fix with acceptance grep in body | None |
| af82e83 | E-06 | 1 — TRACKER.md | same | None |
| 6b79e85 | E-07 | 1 — E00-EXECUTION-PROTOCOL.md | same | None |
| 570d368 | E-08 | 1 — HISTORICAL-SOURCES.md | same | **Card amended, recorded:** the plan's literal header («مُلغى») would have falsely cancelled 4 live rows; neutral header «القرار البديل» implements the card's intent |
| 130a836 | E-20 | 1 — TRACKER.md | same | None |
| 36a209f | E-21 | 1 — EXPANSION-GLOSSARY.md | same | None |
| da6c5ca | A-01 | 9 — financial-event domain + index, pFS, g5Service, FinancialEventEditor + tests | single domain derivation consumed by all readers; fail-first domain + service tests | Scope extension (recorded in VERIFICATION-LOG note 2): a **5th consumer** (`g5Service.validateRelation`) beyond the card's four |
| 21fa2bb | A-03 | 3 — pFS, g5Service + test | guard clauses returning Arabic validation messages; reuses A-01's predicate | None |
| c92857e | C-01 | 2 — g5Service + test | mirrors the same file's `payables()` exclusion convention | Recorded structural limitation: a reversal landing in a *later* window shows no negative fixed expense in G5 (inherent to G5's non-negative inputs) |
| 7d378cc | A-02 | 2 — inventoryMaterialService + test | in-file `reversedMovementIds` Set pattern, matching its sibling reader | None |
| 3422e56 | A-05 | 5 — financialPulseService, g5Service + test, craft-order domain | one domain predicate consumed by both services | **Necessary completion recorded:** linkage restricted to debt orders (`listLinkOptions` + `validateRelation`); 4 existing tests amended to register debt first — numeric assertions unchanged |
| e5dea55 | (glossary) | 1 — docs/08-glossary.md | binding artifact per plan Appendix B | None |
| 5886521 | L-01 | 8 — g5Service, Finance, G5DeclarationEditor, both stores, contract 17, g5 domain + test | glossary family swap per Appendix A | **Scope extensions recorded:** 21 domain g5 strings + both storage layers' error messages joined the family; short-cash metric labels; contract 17 terminology note |
| cc46a13 | U-01 + L-06 | 2 — UnsavedChangesGuard + `.history.test.tsx` | jsdom U0X pattern; ask-explicitly philosophy (no silent save) | **Two findings in one commit** — the plan itself pairs them (Phase 3: "U-01+L-06"); jsdom notes recorded inline (vaul pointer-capture polyfill, `fireEvent` for the drawer) |
| 2f332a1 | U-02 | 2 — FinancialEventEditor + ui test | sibling SupplierPurchaseEditor navigate-on-success pattern; message starts with «لم» so the existing styling heuristic routes it to the error class | None |
| 356fe80 | U-04 | 15 — editor + ui test, 7 domain policy files incl. shared, 5 test files | Arabic guard messages via a new shared `fieldLabelAr` map; editor required-marker | **Scope extension recorded:** craft-order/g5 helper templates joined the five modules; ~15 test assertions updated EN→AR with purpose preserved |
| 7c8e0f2 | A-07 (guard) | 3 — eslint.config.js, craft-order + owner-entitlement policies | guard first, migrations after (plan PR-1); temporary `TODO(A-07)` inline allowlists | Decision recorded: `Math.ceil` stays permitted (contract 03 unit-cost ceiling); 7 allowlists at landing |
| 1700bfb | A-04 (A-07 migration 1) | 5 — craft-order policies, shared index + numeric, 2 test files | shared-helper rounding; `quantityMilliExact` added in `shared/numeric` (the rounding home, guard-exempt) | **Process slip (R-4):** committed once while the gate showed 50 warnings (the `&&` chain bound to the output filter, not the gate); both new warnings fixed, gate re-run green at 48, unpushed commit amended. Recorded input-validation tightening: sub-milli quantities now rejected loudly |
| a892ace | A-07 (contract) | 1 — contract 05 §5.3 | group-B contract-first discipline | None |
| 46c8ac7 | A-07 (migration 2) | 4 — owner-entitlement policies + test, vitest.config.ts | `roundHalfUp` through shared helpers on all four computations | **Discovery recorded:** `src/domain/owner-entitlement/policies.test.ts` was executed by no vitest config — the root include was widened to `src/**/*.test.ts`, wiring 10 tests into the gate; calendar day-span `Math.round` became exact division |
| dc6c18f | A-07 (migration 3) | 4 — Catalog.tsx + ui test, recurring-margin policies + test | new domain export `perOutputUnitAmountMinor`; page keeps presentation only; last allowlist removed | New export — a new seam, though in the module that owns allocation |
| ec97415 | A-10 | 4 — cash-continuity domain, cashContinuityService + test, localTransferService + test | policy's adjacent single-purpose guard ifs; validator `group.some` chain | Second leg (import validator) executed per the card |
| 4af66c1 | A-08 | 2 — craft-order policies + test | one-line transition-table addition in the same position as sibling rows; module-level `a08DraftOrder` fixture; finding-tagged describe | English transition-error copy deliberately left (U-04 scope decision; re-assessed later by the sweep — see c58a197) |
| 8362611 | A-09 | 2 — craft-order policies + test | Intl Asia/Amman `formatToParts` idiom | **Deviation:** the date helper (`ammanLocalDate`) is re-implemented locally per the sibling idiom rather than extracted to shared — the repo's own A-01 lesson argues for one derivation; recorded here |
| 092fe0f | C-03 | 4 — pFS + test, g5 policies + test | guarded ratio extracted as `calculateBreakEvenUnits` in the g5 domain; service calls it; refusal renders «غير متاح» + reason | New export (new seam) — see §5 |
| 20ba580 | C-06 | 4 — preferenceService + test, Settings.tsx, eslint.config.js | `PreferenceService.readBrowserPersistence()` (+ module-level sibling for non-DI callers); page imports only the service | ESLint boundary rule widened — see §5; lint probe demonstrated on the working tree, then removed |
| 823bdb7 | U-05 | 2 — Finance.tsx, U05.dom.test.tsx | U0X jsdom pattern; real services over MemoryLocalStore | **Deviation:** one code comment is in Arabic («نطاق غير صالح هو خطأ حقل…») — the repo's comments are otherwise English |
| 0a11ff0 | U-06 | 4 — MicroAppShell, NewDraft, index.css, U06.dom.test.tsx | route param consumed once on mount; U0X jsdom pattern | None |
| 801aaa5 | U-09 | 2 — index.css, U09.css.test.ts | CSS contract test pins the exact values the card set | New test genre (see §5); live re-measurement deferred to browser QA — no field-acceptance claimed |
| 22b3816 | U-10 | 9 — PwaInstallControl, install.ts + test, preferenceService + test, scheduleService, actualTimeService, storage types, U10.dom.test.tsx | durable-preferences pattern (`LocalPreferences`); pure window predicate `isInstallBannerDismissalActive` | Additive field `installBannerDismissedAt` (no version bump; lenient validator) — see §5 |
| 1fb83c2 | U-11 | 2 — Settings.tsx, U11.dom.test.tsx | secondary text button beside the icon; aria-labels kept | Small product nod inside the card's allowance: data-protection layer now open by default |
| 66708d0 | U-03, U-07, U-08 (+ A-06 register) | 2 — draft-dismissal-mini-spec-v1.md, remediation-open-decisions-v1.md | group-C discipline: record options/consequences/recommendation, decide nothing | **Three cards in one docs commit** (record-keeping only, no fixes) |
| bf429d5 | L-02 | 21 — pages + services | mechanical Appendix A replacement; code identifiers/comments/test names untouched | **Scope extensions recorded:** import-preview count label, both file-parse error messages, recurringWorkService margin truth line |
| c3660ce | L-03 | 4 — Finance, OwnerEntitlement, g5 policies + test | `order.itemName` + Arabic status map (the `orderResultStatusAr` set idiom) | The structural fix (move sentence-building out of `src/domain`) deferred per the card's own note |
| 3695f81 | L-04 | 4 — recurringWorkService, Catalog, OrderDetail, Review | Appendix A rows; boundary sentence survives verbatim | **Scope extension recorded:** Review's indicator footnote + Catalog's margin explanation; domain copy deliberately left to the QA pass (completed in 7619e42/3d43624) |
| 28b6d95 | L-05 | 3 — U05.dom.test.tsx, pFS, Finance | contract's own public name («نتيجة الفترة المسجلة») | **Scope extension recorded:** coverage reason in pFS also carried the banned «هامش المساهمة»; honest «ليست صافي ربح نهائيًا» disclaimers kept verbatim |
| d656414 | L-07 | 9 — pFS, g5Service test, recurringWorkService, Catalog, Finance, FinancialEventEditor, both stores, g5 domain | family swap with participles («موزّع/غير موزّع»); genuine download contexts keep «تحميل» | **Deviation:** the one domain-layer G5 reason string joined the family (same screen, same word) — Phase 7 was scoped to the client, recorded as such |
| 1e7abd0 | L-08 | 7 — OwnerEntitlement, Finance, ownerEntitlementService, pFS, both stores, owner-entitlement domain | family swap (~90 strings) incl. page labels, aria-labels, placeholders, service + storage errors | Supplier «تاريخ الاستحقاق» (a payable's due date, contract 09) deliberately kept — different concept; fixture notes untouched (input data) |
| 0c7646a | L-09 | 6 — homeControlCenterService, ActualTimePanel, G5DeclarationEditor, pFS, g5 domain + test | family swap per Appendix A | **Scope extension recorded:** G5 editor link hint, both pFS liquidity truths, g5 domain reason «دين بلا تاريخ كافٍ» + coupled test |
| fa28935 | L-10 | 8 — Orders, OrderDetail, Finance, Schedule, OwnerEntitlement, homeControlCenterService, craft-order domain + test | one variant remains («الخطوة التالية») | **Scope extension recorded:** Schedule.tsx:951 + an OwnerEntitlement card the verifier had missed, two prose uses, and the domain guidance sentence ×4 with its coupled test |
| 2daf8a8 | L-11 | 4 — CostEditor, FinancialEventEditor, G5DeclarationEditor, OrderDetail | one wording on all four surfaces; `KnowledgeState` enum and stored values untouched | **Scope extension recorded:** FinancialEventEditor shared-expense route note + CostEditor material-list badge |
| 3e7608d | L-12 | 27 — 10 pages, 6 services, both stores, 6 domain policy modules + shared numeric, 3 coupled tests | family swap (~130 strings); confirm-dialog explanations keep their structure | Mechanics, function names, types, storage untouched |
| f792db5 | L-13 | 9 — OwnerEntitlement + services + both stores + 2 domains + coupled tests | the page's own plain explanation reused («نسخة جديدة بإعداداتك الجديدة») | Policy successors renamed consistently with entitlement successors |
| 01dc7ef | L-14 | 2 — Home.tsx, homeControlCenterService | nav label wins; loading/error/truth copy follows | The ungrammatical capacity sentence fixed per the card |
| 15e5178 | L-15 | 4 — Home, homeControlCenterService, Finance, Catalog | existing `formatLocalDate(Long)` / `formatMonthLabel`; remaining numeric dates wrapped in `bdi` | None |
| f2b89fd | L-16 | 21 — pages, services, both stores, catalog domain | one name per action-concept; «تثبيت» reserved for app install | Coupled tests updated; «الواقعة» retired for «حدث مالي» |
| 14e2999 | L-17 | 7 — recurrenceService, localTransferService.test, CashReversalEditor, InventoryMovementEditor, Schedule, Setup, orderAgreementPresentation | real words for invented ones; no invented features | One fixture string follows the rename («موعد قادم من قالب…») |
| 3629b94 | L-18 | 5 — CashWallets, Catalog, InventoryMaterials, plurals.ts + plurals.test.ts | `formatArabicPlural` helper (extended with full-form sets) | +4 dual-form tests («أثران محفوظان» at two) |
| — | L-19 | none | verified-no-op: systematic scan found zero micro-button labels over 28 chars after the L-01/L-08/L-17 renames | No commit needed (R-7c) |
| 07d54c3 | E-09, E-13, E-14, E-19, E-12, E-18, E-16, E-17, E-01, E-02, E-03, E-10, E-11 (Phase-8 specs) | 11 — contracts 19/20/21/22/24/25 + 5 expansion docs | spec-writing: contracts amended, decisions recorded as EX-O09..EX-O16 with labeled defaults | **Batching deviation:** 14 cards in one docs commit; E-04 was not in the card list and remains unwritten (flagged, not silent); MANAGE-NETWORK-MIGRATION-EXPORT-GATE deliberately untouched (E-15) |
| c58a197 | U-04 (QA completion) | 4 — craft-order + g5 policies, 2 domain tests | module's own voice; `ORDER_STATUS_AR` map (L-03's set idiom); direct-Arabic label idiom | The class R-3 had flagged for the sweep: 25 remaining English business-rule throws; 12 assertions follow renamed strings, purposes preserved |
| 3d43624 | L-02/L-04/L-07 (QA completion) | 1 — recurring-margin domain | the wording the service layer already uses; conditions and numbers byte-identical | Contract 14's internal «تحميل المصروف المشترك» kept; a contract UI-terms note recorded as follow-up |
| 7619e42 | L-04/L-05/L-02 (QA completion) | 3 — actual-time, g5, owner-entitlement domains | glossary's own phrasing; each sentence's guarantee kept verbatim | «درجة المعرفة» concept-reference sentences deliberately kept (L-11 scope); contracts 05/12/17 internal terminology kept |
| 8883155 | L-16 (QA completion) | 1 — NewDraft.tsx | the family's own verb («وتسجّلها»), matching the sentence's first half | Schedule's slot-confirm «تثبيت» sentence deferred — recorded for the owner |
| 995ce7c | C-06 (QA correction) | 1 — Settings.tsx | type-only import idiom (`BrowserPersistenceReading`) | Dead value-import left behind by the C-06 rewrite (no lint rule covers unused imports); module-level export kept — it is the service's public surface |
| d920246 | (process) | 1 — docs/operations/current-state.md | append-only per the doc's own rule; §15 records the remediation | Historical §12/§13 wording kept with a terminology note; header date stays at last merged state (merge PR bumps it) |

---

## 4. Deviations and scope extensions recorded

Every deviation below is recorded in the worklog or the commit body itself; none was silent.

**Scope extensions (same finding family, larger than the card assumed):**

- **L-01 (5886521):** the «متوقع» family extended into `src/domain/g5` (21 user-visible strings) and both storage layers' error messages — leaving them would mix vocabularies mid-sentence; plus the short-cash metric labels and a terminology note in contract 17.
- **L-09 (0c7646a):** beyond the four Appendix A rows — the G5 editor link hint, both `projectFinancialService` liquidity truths, and the g5 domain reason «دين بلا تاريخ كافٍ» with its coupled test.
- **L-10 (fa28935):** all user-visible instances, not the ~7 spec'd — including two surfaces the verifier had missed (Schedule.tsx:951, an OwnerEntitlement card), two prose uses, and the domain guidance sentence ×4 with its coupled test.
- **L-11 (2daf8a8):** the FinancialEventEditor shared-expense route note and the CostEditor material-list badge — same banned label/option on the same surfaces.
- **A-05 (3422e56):** a "necessary completion discovered during implementation" — the declaration-linkage side was restricted to debt orders (`listLinkOptions` + `validateRelation`); four existing tests amended to register debt first, every numeric assertion unchanged.
- **A-01 (da6c5ca):** a fifth consumer (`g5Service.validateRelation`) beyond the card's four readers, surfaced at verification.
- **U-04 (356fe80):** craft-order and g5 helper templates joined the five modules (later completed in c58a197).
- **L-02/L-04/L-05/L-07:** recorded row extensions inside each body (see §3).

**Style deviations:**

- **A-09 (8362611):** `ammanLocalDate` re-implemented locally in `craft-order/policies.ts` following the sibling idiom, instead of extracting one shared helper — consistent with how every sibling reader carries its own copy today, but at odds with the single-derivation lesson of A-01.
- **U-05 (823bdb7):** one Arabic code comment («نطاق غير صالح هو خطأ حقل، لا خطأ شاشة…») where the repo's comments are otherwise English.
- **L-07 (d656414):** one domain-layer G5 string joined a client-scoped copy family (same word, same screen — recorded in the body).
- **E-08 (570d368):** the plan's literal header fix was amended (neutral «القرار البديل») because the literal text would have falsely cancelled four live rows — the card's intent implemented truthfully, amendment recorded.

**Commit-granularity deviations (plan guardrail 7 is one-finding-per-commit):**

- `cc46a13` carries U-01 + L-06 — the plan itself pairs them ("U-01+L-06", Phase 3), because the honesty of the drawer sentence is the second half of the interception fix.
- `07d54c3` batches the fourteen Phase-8 spec cards into one docs commit; `66708d0` batches the three decision-record documents. Both are documents-only.

**Process slips (both caught and corrected, both disclosed):**

- **The A-04 commit at 50 warnings (R-4):** the first `1700bfb` executed while `pnpm check` failed at 50 warnings — the `&&` chain was bound to the output filter, not to the gate's exit code. Caught immediately; both new warnings fixed (a 62-line `calculateCostSnapshot` helper extraction and a 97-line describe split via the base-fixture idiom); gate re-run green at 48; the still-unpushed commit was amended. Rule going forward: the gate's exit code is checked explicitly before every commit.
- **The R-5 verification-script restore bug:** the fail-first verification script had a restore-assert bug that briefly removed the A-10 fixes from the working tree; the fixes were re-applied and re-verified. Recorded in the R-5 worklog entry for this report.

---

## 5. New patterns introduced

All four introduce a *seam* a knowledgeable reader would notice as new — but each follows an existing repo principle (domain ownership, service wrapping, contract tests, lint-enforced architecture):

1. **`calculateBreakEvenUnits` export (092fe0f, C-03):** the guarded break-even ratio extracted from `calculateBreakEven` as the period-aggregates variant in the g5 domain, so the application layer calls the domain instead of re-implementing the formula. Same shape as the pre-existing domain exports; new name.
2. **Preferences-service persistence wrapper (20ba580, C-06):** `PreferenceService.readBrowserPersistence()` plus a module-level sibling for non-DI callers; the page imports only the service.
3. **CSS contract test (801aaa5, U-09):** `U09.css.test.ts` pins `min-height: 48px` on the period inputs and `min-height: 44px / min-width: 48px` on text actions — a new test genre (no prior CSS test existed), in the U0X-at-src-level naming family.
4. **ESLint boundary rule widened (20ba580, C-06):** the pages/components boundary now bans `@/storage/local/*` value imports with `allowTypeImports` — pages keep typing against the store's exported types.

Also new, recorded for completeness: the A-07 `no-restricted-syntax` guard banning raw `Math.round`/`Math.floor` in `src/domain` (7c8e0f2), with `src/domain/shared/**` exempt and `Math.ceil` permitted (contract 03); the sentinel-history-entry pattern for dirty-form back interception (cc46a13); the root vitest include widened to `src/**/*.test.ts` (46c8ac7), which wired an orphaned test file into the gate; and the base-fixture spread idiom in tests (§2).

---

## 6. Style defects left alone

- **The 48 baseline lint warnings.** The lint budget (`--max-warnings 48`) was held at exactly the baseline through all 56 commits; the pre-existing complexity/max-lines warnings in domain policies were not addressed — out of scope, and the budget itself forced the fixture idiom instead.
- **«درجة المعرفة» in concept-reference strings.** Five strings outside L-11's four surfaces keep the old label (orderAgreementPresentation explanation, two Finance/coverage exclusion reasons, two domain validation sentences) — never flagged by the review, deliberately kept by L-11's scope, and re-confirmed as deliberately kept in 7619e42's body. A current grep finds them still present (plus the term in `apps/prototype-web/ideas.md`, a design note).
- **«Owner Draw» token.** Still present in one `ownerEntitlementService` truth sentence (`ownerEntitlementService.ts:250`) — L-02 passed over it; **remaining** (not fixed by any QA commit; verified on the branch head).
- **«تقديري معلن» G5 option** keeps «معلن» (an L-01 family leftover, recorded in R-7b).
- **Supplier-side vocabulary** — «ذمة المورد» and «تاريخ الاستحقاق» — deliberately kept: different concepts (a payable's due date per contract 09), not in Appendix A.
- **Contracts' internal terminology:** contracts 05/12/17 keep «هامش المساهمة»/«اعتراف»; contract 14 keeps «تحميل المصروف المشترك»; contract UI-terms notes recorded as follow-ups (3d43624, 7619e42).
- **ROLE-ACCESS-MATRIX §3** delivery_scoped disclosure row was left un-re-worded to the new side-based consent rule (R-6, minimal-pass decision).
- **Two money-deferral phrases** survive in `docs/quality/` archives (historical records, outside Agent 4's write scope).
- **English transition-error copy in craft-order** was deliberately left at A-08 (U-04 scope decision) and later translated in c58a197.

---

## 7. Consistency verdict

**Honest answer: a repo-knowledgeable reader would mostly *not* identify the new lines by style alone.** The commits copy sibling idioms explicitly and name their sources in the bodies; test placement, result shapes, layering, Arabic copy, and commit format all follow the house style; every copy family landed with an acceptance grep.

Where a knowledgeable reader *would* spot new lines — all of them seams, not style breaks:

1. **New exports:** `activeSettlementsMinor`, `reversedEventIds` (A-01), `isRegisteredCustomerDebt` (A-05), `calculateBreakEvenUnits` (C-03), `perOutputUnitAmountMinor` (A-07), `quantityMilliExact` (A-04), `readBrowserPersistence` (C-06), `installBannerDismissedAt` (U-10) — new names in old modules.
2. **New files/test genres:** `U05/U06/U10/U11.dom.test.tsx` and `U09.css.test.ts` at `src/` level (following the `U01.dom.test.tsx` precedent, so stylistically native, but new files nonetheless), and `plurals.test.ts`.
3. **One Arabic code comment** (U-05) against the English-comment norm.
4. **One locally re-implemented date helper** (A-09) where the A-01 lesson would predict a shared derivation.
5. **Config changes:** the ESLint guard (A-07), the widened storage-import boundary (C-06), and the root vitest include widening (46c8ac7) — visible in `eslint.config.js` / `vitest.config.ts`, invisible in product code.
6. **The base-fixture spread idiom** in newer test files — a recognizably newer pattern, though it exists to satisfy the repo's own lint budget.

Nothing in the 56 commits introduces a competing result shape, a second rounding policy, an English user string, a page-level financial derivation, or a delete-without-trail — the specific defect classes this review was convened to remove.
