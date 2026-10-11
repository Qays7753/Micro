# R9 Preflight — Reviewer 2: Domain, Storage, and Data-Integrity Review

- Task ID: R9-PF-R2
- Reviewer: general-purpose (Reviewer 2 — Domain/Storage/Data-Integrity), READ-ONLY
- Repo: /home/z/my-project/work/micro/repo @ 8b3c9aeb09ca33ed66f0a929c157b668839d0463 (== origin/main, verified `git log --oneline -3` + clean status)
- Scope: Storage Parity Matrix + Transfer/Legacy/Golden Matrix inputs for the R9 preflight evidence reconciliation
- Evidence discipline: every claim tagged VERIFIED (file:line), INFERRED (basis), or UNVERIFIED (why). No repo files were modified.

---

## 1. Port Inventory — PrototypeLocalStore

**Count: exactly 130 members, all methods (no properties).** VERIFIED by scripted count over `apps/prototype-web/client/src/storage/local/types.ts:429-884` (`grep -cE '^\s+(get|save|list|delete|commit|read|replace|clear)[A-Za-z]*\('` → 130; manual line-by-line enumeration agrees; every member is a method returning `Promise<StorageResult<...>>`).

**Protected constants:** VERIFIED `localSchemaVersion = 38` (types.ts:55) and `localExportVersion = 30` (types.ts:71). Pinned in tests by `group6Docs.test.ts:100-101` and `exact-values.cross-surface.test.ts:234-235`. Header comments document the 35→38 chain (D-037 pattern: 35 form-drafts+local-security, 36 recurring-expense trio, 37 expense-budgets, 38 received-loans) and export 27→30 chain.

**Port members grouped by capability area** (numbers = method count; the 16 capability groups + 4 uncovered groups):

| # | Area (capability or uncovered group) | Methods | Covered by capability? |
|---|---|---|---|
| 1 | orderLifecycle | 9: listOrders, getOrder, saveOrder, commitOrderUpdate, commitOrderCollectionReversal, commitDepositRefundSettlement, commitOrderFromDraft, commitOrderDelivery, commitOrderDeliveryReversal | YES |
| 2 | ownerEntitlement | 14: list/get/save Policy, commitOwnerEntitlementPolicySuccessor, list/get/save Record, commitOwnerEntitlementRecordReversal, list/save OpeningBalance, commitOwnerEntitlementOpeningBalanceReversal, list/get OwnerMovement, commitOwnerMovement | YES |
| 3 | financialEvent | 5: list, get, save, commitFinancialEventCorrection, commitFinancialEventReplacement | YES |
| 4 | supplierPurchase | 5: list, get, save, commitSupplierPurchase, commitSupplierPurchaseWithAttribution | YES |
| 5 | directSale | 3: listDirectSales, saveDirectSale, commitDirectSaleCollectionReversal | YES |
| 6 | asset | 4: listAssets, getAsset, commitAssetRecord, commitAssetAcquisitionCorrection | YES |
| 7 | costEstimate | 4: list, get, save, delete | YES |
| 8 | inventoryMaterial | 8: listMaterials, listInventoryMovements, get/saveInventoryActivation, commitInventory, listInventoryShortages, commitInventoryWithShortage, commitInventoryWithEvents | YES |
| 9 | schedule (entries+recurrences) | 9: list/get/save Schedule, commitScheduleCreate, commitScheduleUpdate, list/get/save Recurrence, commitRecurrence | YES |
| 10 | catalog | 13: list/get/save CatalogItem, list/get/save MeasurementUnit, list/get/save DirectConversion, list/get/save CatalogTemplate, commitCatalogTemplateRevision | YES |
| 11 | actualTime | 2: listActualTimeRecords, saveActualTimeRecord | YES |
| 12 | loan (+received loans +deposit classification) | 10: list/get Loan, commitLoanRecord, commitLoanCorrection, list/get ReceivedLoan, commitReceivedLoanRecord, commitReceivedLoanCorrection, commitDepositClassification, commitDepositClassificationCorrection | YES |
| 13 | recurringExpense | 10: list/get Series, list Revisions, list/get Occurrence, commitDraft, commitSeriesChange, commitOccurrences, commitOccurrenceDecision, commitOccurrenceRecord | YES |
| 14 | expenseBudget | 3: listExpenseBudgets, saveExpenseBudget, saveExpenseBudgetRevisionPair | YES |
| 15 | allocationPolicy | 4: list, get, save, commitAllocationPolicySuccessor | YES |
| 16 | shortCashDeclaration | 4: list, get, save, commitShortCashDeclarationReversal | YES |
| 17 | identity/prefs/security (KEEP) | 9: get/saveProfile, get/saveOwnerProfile, get/savePreferences, get/save/deleteLocalSecurity | NO (R3-SC-18) |
| 18 | drafts + form drafts (KEEP) | 9: list/get/save/deleteDraft, get/save/deleteFormDraft, listFormDrafts, clearFormDrafts | NO (R3-SC-17) |
| 19 | cash continuity/wallets (KEEP) | 3: listCashWallets, listCashContinuityEntries, commitCashContinuity | NO (R3-SC-19) |
| 20 | snapshot/transfer pair (R4_BOUNDARY) | 2: readSnapshot, replaceSnapshot | NO (R3-SC-16 — protected pair) |

Sum check: 107 covered + 23 uncovered = 130. ✓ **Live numbers exactly match the R3 report claim ("16 قدرة / 107 من 130")** (R3-STORAGE-CAPABILITY-EXECUTION-REPORT §2/§7, incl. the dated R4-A1 correction enumerating the 23 as 3+9+9+2).

---

## 2. Storage Parity Matrix

Architecture VERIFIED: capabilities are **derived `Pick<>` views** of the port (`interface AssetStore extends Pick<PrototypeLocalStore, AssetStoreMethod>` — capabilities/assetStore.ts:38), NOT wrappers. Both adapters implement the full port (`class IndexedDbLocalStore implements PrototypeLocalStore` — IndexedDbLocalStore.ts:138; `class MemoryLocalStore implements PrototypeLocalStore` — MemoryLocalStore.ts:87). So implementation always lives in the two adapters; the capability files give consumers a narrow, type-checked lens. Every capability has a triple: `<cap>Store.ts` (canonical owner), `<cap>CapabilityAnchors.ts` (type-layer proof both adapters + facade satisfy the lens), `<cap>Capability.contract.test.ts` (3-layer runtime contract). 16×3 = 48 files. VERIFIED 16 anchor files on disk.

Per-capability matrix (IndexedDb line ranges from method-definition grep; Memory likewise; contract tests counted by `it(` declarations; guards listed where a named guard file backs the capability's commit methods):

| Capability | Methods | Canonical owner | IndexedDb implementation (IndexedDbLocalStore.ts) | Memory implementation (MemoryLocalStore.ts) | Contract test (it-count) | Write-guard / concurrency evidence | Migration / snapshot / transfer touchpoints |
|---|---|---|---|---|---|---|---|
| orderLifecycle | 9 | capabilities/orderLifecycleStore.ts | 212-288 (listOrders→commitOrderUpdate), 293-597 (refund settlement, delivery), 590-887 (commitOrderDelivery/Reversal), 2701-2730 (commitOrderFromDraft) | 212-288 zone: 242 (validateOrderCommit), 373, 409 (orderRecordIdentical), 469/481 (delivery reversal guard), 1382 (fromDraft) | orderLifecycleCapability.contract.test.ts (5 it; ~6 runtime) | orderCommitGuard.ts (validateOrderCommit @258/242; orderRecordIdentical @685/409); deliveryReversalCommitGuard.ts (@836-866/469-481); unit tests 7+26; saveOrderGuard.contract.test.ts (1) | snapshot orders family; migration oldVersion<17 (catalogItemId), <20 (followUp fields); transfer migration orders followUp/catalogItemId normalization |
| ownerEntitlement | 14 | capabilities/ownerEntitlementStore.ts | 2340-2716 (policies/records/opening balances/movements + successor/reversal commits) | symmetric blocks (e.g. 1661-1750 zone for guards) | ownerEntitlementCapability.contract.test.ts (5 it; ok-false=2) | inline CAS in adapters (successor/reversal identity checks); OwnerEntitlementStorage.test.ts (3) | snapshot 4 owner families; migration oldVersion<23 (seriesId, successorOfPolicyId, sourceKeys, reversalOfId/reversalReason, relatedOpeningBalanceId, openingBalanceDeltaMinor); ownerEntitlementTransfer.test.ts (5) |
| financialEvent | 5 | capabilities/financialEventStore.ts | 1324-1539 (list/get/save + correction @1341 + replacement @1436) | 706-759 zone | financialEventCapability.contract.test.ts (5 it; ok-false=3: double-reversal, ghost reversal, orphan replacement) | inline in-transaction identity checks (reversal of reversal rejected @1379/1480 area) | snapshot financialEvents; counters key; transfer validators (event deltas, correction chains); R3-N2 legacy-read wing |
| supplierPurchase | 5 | capabilities/supplierPurchaseStore.ts | 1540-1777 (list/get/save @1540-1568, commitSupplierPurchase @1571 guard, withAttribution @1655-1777) | 786/826 guards, 833 attribution | supplierPurchaseCapability.contract.test.ts (5 it; success/reuse lens only) | supplierScheduleCommitGuard.ts validateSupplierPurchaseCommit (IndexedDb:1571,1692; Memory:786,826) + derivedFieldsConsistent; supplierAttributionCommitGuard.ts resolveSupplierPaymentAttribution (1711/833); unit tests 25+6+6 | snapshot supplierPurchases; transfer schema31 test (22/30 labels), payment invariants; G-002 attribution healing in-transaction |
| directSale | 3 | capabilities/directSaleStore.ts | 888-1056 (list @888, save @897, collection reversal →1050) | symmetric | directSaleCapability.contract.test.ts (5 it; success/reuse lens) | reversal idempotency inline; adapterDeliveryReversal.test.ts (3) covers EXE-010 across both adapters (closed R3-N3/S4-FC-5 Memory-only gap) | snapshot directSales (optional family); migration null-normalization of status/cancelledAt/revisions (transferSnapshotMigrations.ts:32-44); directSaleRoundTrip.test.ts (4) |
| asset | 4 | capabilities/assetStore.ts | 2731-2937 (list/get @2731-2740, commitAssetRecord →2761, acquisitionCorrection @2855-2937) | symmetric | assetCapability.contract.test.ts (5 it; reused-lens) | inline guarded commit (idempotency + event linkage) in adapters (per assetStore.ts:14 "no separate guard file") | snapshot assets; migration: none needed (guarded store creation at schema 34); assetResidual.test.ts (3) contract-43 residual fields; familyOrphan asset-event orphan rejection |
| costEstimate | 4 | capabilities/costEstimateStore.ts | 2140-2167 | symmetric | costEstimateCapability.contract.test.ts (7 it incl. R4-A5/HAF-1 determinism wing) | deterministic save-by-id (free tool, no financial effect; deletion free) | snapshot costEstimates; store created at schema 29; no transfer validator beyond shape |
| inventoryMaterial | 8 | capabilities/inventoryMaterialStore.ts | 1839-1977 (list/activation/commit @1868, shortages @1875, withShortage @1889, withEvents @1924) | symmetric | inventoryMaterialCapability.contract.test.ts (7 it incl. HAF-1 determinism+partial-commit wing) | inline in-transaction idempotency (movement keys + event keys, contract D4) | snapshot materials/movements/shortages/activation; migration oldVersion<25 (wasteContext); schema32 transfer tests (23/31, tracking/shortage/purchase-link) |
| schedule | 9 | capabilities/scheduleStore.ts | 1057-1322 (list/get/save @1057-1082, commitScheduleCreate @1073, commitScheduleUpdate @1131, recurrences @1185-1322) | 590-660 zone | scheduleCapability.contract.test.ts (5 it; reuse lens) | supplierScheduleCommitGuard.ts validateScheduleCreate/validateScheduleUpdate (STR-306 combined file) + RECURRENCE_STALE_MESSAGE paths @1253-1299; unit tests in supplierScheduleCommitGuard.test.ts (25) + derivationCoupling (6) | snapshot schedules/recurrences; migration oldVersion<8 & <20 (time/duration, recurrenceId/Index); transfer migration recurrence fields |
| catalog | 13 | capabilities/catalogStore.ts | 1978-2106 (items/units/conversions @1978-2024, templates @2012-2106 incl. commitCatalogTemplateRevision @2031) | 1044-1108 zone | catalogCapability.contract.test.ts (7 it; ok-false=2: stale revision @197, identity conflict @210; + HAF-1 rejection wing) | commitCatalogTemplateRevision CAS inline (previous/next in one transaction) | snapshot catalog 4 families; migration oldVersion<24 (unitId); catalogCoreTransfer.test.ts (4) |
| actualTime | 2 | capabilities/actualTimeStore.ts | 2107-2121 | symmetric | actualTimeCapability.contract.test.ts (7 it incl. HAF-1 determinism wing) | deterministic replace-by-id (idempotent surface by design) | snapshot actualTimeRecords; store schema 27; localTransferService.test actual-time origin/reversal round-trip |
| loan | 10 | capabilities/loanStore.ts | 2938-3564 (loans @2938-3171: guards @3015/3050, correction @3089-3171; receivedLoans @3172-3425: guards @3252/3287, correction @3326-3425; deposit classification @3427-3564) | 1661-1790 zone (1661/1678, 1752/1769) | loanCapability.contract.test.ts (5 it; ok-false=2, stale=3) | loanCommitGuard.ts (validateLoanCommitRelation + findLoanEventByKey), receivedLoanCommitGuard.ts (mirror AV-02); unit tests 11+11 | snapshot loans/receivedLoans; stores schema 33/38; schema34 tests (legacy 25/33, reversal negation, over-depreciation) |
| recurringExpense | 10 | capabilities/recurringExpenseStore.ts | 3566-3990 (list/get @3566-3595, draft @3596 guard @3641, seriesChange @3689 guard @3734, occurrences @3804, decision @3840/3852, record @3891 guards @3924-3955) | 1911-2045 zone | recurringExpenseCapability.contract.test.ts (5 it; ok-false=2, stale=4, incl. concurrency race @238: exactly 1 winner+reuses) | recurringExpenseCommitGuard.ts (draft/seriesChange/materialization/decision/key-collision/recordCommit); unit tests 5; IndexedDbLocalStore.recurringExpense.test.ts (2); adapterConformance.recurringExpense.test.ts (3) | snapshot 3 recurring families (schema 36 / export 28); localTransferService.recurringExpense.test.ts |
| expenseBudget | 3 | capabilities/expenseBudgetStore.ts | 3991-4137 (list @3991, save @3999 guard @4022, revisionPair @4061 guard @4095) | 2047-2096 zone (2052/2068) | expenseBudgetCapability.contract.test.ts (5 it; ok-false=5, stale=6: conflict, stale transition, broken pair, half pair, orphan) | expenseBudgetCommitGuard.ts (validateExpenseBudgetSave CAS-with-expected + revisionPair); unit tests 11; IndexedDbLocalStore.expenseBudget.test.ts (5); adapterConformance.expenseBudget.test.ts (3) | snapshot expenseBudgets (schema 37 / export 29); localTransferService.expenseBudget.test.ts |
| allocationPolicy | 4 | capabilities/allocationPolicyStore.ts | 2122-2236 (list @2122, get @2134, save @2137, successor @2155) | 1110-1175 zone | allocationPolicyCapability.contract.test.ts (5 it; ok-false=3) | successor commit CAS inline | snapshot allocationPolicies; migration oldVersion<26 (rate split rateMinorPerWholeUnit) |
| shortCashDeclaration | 4 | capabilities/shortCashDeclarationStore.ts | 2117-2236 (list @2117, get @2237, save @2240, reversal @2243) | 1176+ zone | shortCashDeclarationCapability.contract.test.ts (5 it; ok-false=3) | reversal linkage inline | snapshot shortCashDeclarations; store schema 26; localTransferService.test G5 migration (v9/18) |

**Contract-test depth (sampled 3 deeply — read in full):**
1. **orderLifecycle** (orderLifecycleCapability.contract.test.ts:159-303): asserts, through the *narrow capability type only*, creation+read, idempotent replay (`reused:true`, no event duplication), **stale-base rejection with `code:"storage_stale"` and no write** (§2, lines 183-187), atomic from-draft (no event doubling), delivery + replay, delivery reversal + replay, collection reversal + replay, deposit refund + replay. This is behavioral parity, not method presence.
2. **supplierPurchase** (supplierPurchaseCapability.contract.test.ts:53-135): create + honest replay, read-as-written, payment single-op relation + replay, withAttribution null-path, direct save. **No stale-rejection inside this file's lens** — rejection/concurrency evidence for this capability lives in supplierScheduleCommitGuard.test.ts (25) + .derivationCoupling.test.ts (6) + supplierAttributionCommitGuard.test.ts (6) + IndexedDb deep suites.
3. **recurringExpense** (recurringExpenseCapability.contract.test.ts:131-238): replay reuse, **materialization conflict → storage_stale, stale decision → storage_stale**, atomic occurrence recording, and a concurrent-race test (line 238: of racing commits exactly one wins and replays reuse).

**Rejection-assertion census across all 16 capability lenses** (grep `ok).toBe(false)` / `storage_stale`): asserted in-lens for 9/16 (orderLifecycle, recurringExpense, expenseBudget, loan, catalog, allocationPolicy, financialEvent, ownerEntitlement, shortCashDeclaration). The other 7 (actualTime, asset, costEstimate, directSale, inventoryMaterial, schedule, supplierPurchase) have success/reuse-only lenses; 4 of them received dedicated R4-A5/HAF-1 depth wings (actualTime, catalog*, costEstimate, inventoryMaterial — *catalog also has stale tests). Residual rejection evidence for schedule/supplierPurchase/directSale/asset comes from guard unit tests and the adapter deep suites (named above, all verified present). **Assessment: structural parity (membership+types) is total and mechanical; behavioral parity is asserted in-lens for 9/16 and via guard-unit + dual-adapter deep suites for the rest — no capability was found with neither.**

**Uncovered 23 methods — classification** (VERIFIED: they exist only on the two adapters; no capability file references them):
- `readSnapshot` / `replaceSnapshot` (2): **intentionally-full-store, R4_BOUNDARY** — protected snapshot pair (R3-SC-16); consumed by exactly the 2 remaining full-port injectors: `localTransferService.ts` and `guidedOpeningImportService.ts` (VERIFIED by grep: only these two files declare a `: PrototypeLocalStore` parameter among 93 files referencing the type).
- Identity/prefs/security (9) + drafts/form-drafts (9) + cash continuity (3): **still-on-adapter by documented KEEP** (R3-SC-17/18/19 cards: growth bounds, owner, removal triggers documented); consumed via local `Pick<>` lenses by profileService/preferenceService/localLockService/draftService/formDraftService/cashContinuityService/walletLedgerService per R3 §4 (INFERRED from R3 report + spot-checked grep of narrow types; not re-enumerated exhaustively in this pass).

**Capability contract totals:** 16 files, 88 `it(` declarations (~100+ runtime instances with describe.each expansion). R3's "9 files / 54 tests" for the 9 new capabilities reconciles as runtime-instance count (53 declarations live → +loop expansions); INFERRED minor counting-convention drift, not a factual mismatch.

---

## 3. Commit Guards — 9 files, one row each

All 9 guards are **pure functions invoked inside the write boundary of BOTH adapters** (not at the service layer). VERIFIED symmetric usage sites: IndexedDbLocalStore.ts imports (lines 57-86) and call sites (258, 685, 836, 859, 1571, 1692, 1711, 1815, 3015, 3050, 3252, 3287, 3641, 3734, 3804, 3852, 3924, 3933, 3947, 4022, 4095) mirror MemoryLocalStore.ts imports (lines 6-28) and call sites (242, 409, 469, 481, 786, 826, 833, 878, 1661, 1678, 1752, 1769, 1911, 1940, 1972, 1989, 2004, 2011, 2015, 2052, 2068). Consumers (non-test) of every guard = exactly {IndexedDbLocalStore, MemoryLocalStore} (+ supplierAttributionCommitGuard and types.ts import the SupplierPurchaseCommit *type* from supplierScheduleCommitGuard — STR-306 shared file).

| Guard file (lines) | Invariant guarded | Unit tests | Adapter call sites (IdxDb / Mem) |
|---|---|---|---|
| orderCommitGuard.ts (102) | G-003: idempotency-key replay → honest reuse; live==base deep CAS incl. updatedAt; events must extend base verbatim; missing record rejected; never throws | orderCommitGuard.test.ts (7) | 258, 685 / 242, 409 |
| deliveryReversalCommitGuard.ts (299) | D-031: reversal replay by key; one-domain-op relation (2 events or 1 from needs_review); mirror movements must match stored; no blind overwrite of concurrent collection | deliveryReversalCommitGuard.test.ts (26) | 836, 859, 866 / 469, 481 |
| expenseBudgetCommitGuard.ts (80) | contract 42 §5/§8: identical save → reuse; CAS via `expected`; revision pair must link supersededById forward; no half pairs; no phantom originals | expenseBudgetCommitGuard.test.ts (11) | 4022, 4095 / 2052, 2068 |
| loanCommitGuard.ts (67) | AV-02: loan record↔event single-domain-op (create / +1 repayment / 1 reversal-mark); no resurrect from payment path; key replay → reuse | loanCommitGuard.test.ts (11) | 3015, 3050 / 1661, 1678 |
| receivedLoanCommitGuard.ts (69) | AV-02 mirror for received loans (principal receipt / repayment / reversal) | receivedLoanCommitGuard.test.ts (11) | 3252, 3287 / 1752, 1769 |
| recurringExpenseCommitGuard.ts (165) | contract 41: draft existence=reuse; series change CAS + revision append; materialization add-only/absent-skip/divergent-reject; decision CAS; record-commit key collision (type/amount) reject | recurringExpenseCommitGuard.test.ts (5) | 3641, 3734, 3804, 3852, 3924-3947 / 1911-2015 |
| supplierAttributionCommitGuard.ts (65) | G-002: wallet attribution resolved from stored truth inside the single commit txn — existing entry returned, missing entry derived from stored payment (wallet/amount/date/source), none stays honestly unattributed; no double-debit via two keys | supplierAttributionCommitGuard.test.ts (6) | 1711 / 833 |
| supplierScheduleCommitGuard.ts (357) | HIGH-001: supplier purchase create/payment/payment_reversal/revision single-op relation + derived-fields consistency (paidMinor/payableMinor/status) + header/payment/reversal/revision identity; **plus** schedule create first-write-only and update one-new-event optimistic concurrency with typed per-event constraints (completed/cancelled/postponed/timing_changed) | supplierScheduleCommitGuard.test.ts (25) + .derivationCoupling.test.ts (6) | 1571, 1692 / 786, 826 (+ schedule paths 1073-1322 / 590-660) |
| cashContinuityCommitGuard.ts (30) | EXE-008/CASH-001: defense-in-depth rejection of a second opening_balance per wallet (existing or within one batch) | cashContinuityOpeningGuard.test.ts (2) | 1815 / 878 |

Guard unit-test total: **110** across 10 test files. The 4 unit files promised at R3-N3 and delivered at R4-A3 (loan/receivedLoan/expenseBudget/supplierAttribution = 39 tests) VERIFIED present, count matches R4 report §2 exactly.

**End-to-end trace 1 — orderCommitGuard:** service builds payload from a read base → `commitOrderUpdate` opens a single-store readwrite transaction (IndexedDbLocalStore.ts:241), `get`s the live record (247), runs `validateOrderCommit(live, base, next, idempotencyKeys)` (258) → not-ok ⇒ `STORAGE_STALE` + `transaction.abort()` (260-262, nothing written); reused ⇒ returns live record, aborts (268-275); else `put(next)` (277). Memory path identical semantics (MemoryLocalStore.ts:242). Behavioral proof: capability contract §2 (stale base → storage_stale, replay → reused), guard unit tests, saveOrderGuard.contract.test.ts.

**End-to-end trace 2 — supplierScheduleCommitGuard:** `commitSupplierPurchase` (IndexedDb 1560-1653) reads stored purchase inside the txn, `validateSupplierPurchaseCommit(stored, commit)` (1571) enforces the single-domain-op relation incl. `derivedFieldsConsistent` (guard:72-81) before any put; `commitSupplierPurchaseWithAttribution` (1655-1777) re-runs the guard (1692) then resolves wallet attribution from stored entries/payment (1711 → supplierAttributionCommitGuard:36-65) so payment+allocation commit atomically or not at all. Memory mirrors at 786/826/833. Behavioral proof: guard unit tests (25+6 derivation-coupling) + supplierPurchase capability replay assertions + G-002 healing scenario in supplierAttributionCommitGuard.test.ts.

---

## 4. Migrations and Snapshots

**indexedDbMigrations.ts (565 lines) — `applySchemaUpgrade(request, event)`:**
- **Store creation is idempotent and version-agnostic** (`if (!objectStoreNames.contains(...))` for all 37 stores, indexedDbStores.ts:9-69). Chain reaches 38 via the DB open at `localSchemaVersion`; the newest additions follow the guarded-creation D-037 pattern: schema 35 `form-drafts`+`local-security` (migrations:255-261), 36 recurring-expense trio (266-280), 37 `expense-budgets` (285-290), 38 `received-loans` (295-298) — each documented as "no data migration, old DB opens and finds them empty".
- **Record normalizations, gated on `event.oldVersion`:** <23 owner-entitlement fields (seriesId, successorOfPolicyId, sourceKeys `legacy:record:{id}`, reversalOfId/Reason, relatedOpeningBalanceId, openingBalanceDeltaMinor — 313-379); <25 inventory movement `wasteContext` (380-395); <26 allocation-policy rate split (396-419); <24 catalog item `unitId` (420-435); <17 drafts+orders `catalogItemId` (+<4 drafts costSnapshots/activeCostSnapshotId/linkedOrderId — 436-497); <8 schedules time/duration fields + preferences capacity (459-484, 551-552); <20 schedules recurrenceId/Index + orders followUp fields (498-541); <18 preferences workMode/actualTimeTrackingEnabled (542-564).
- **Failure bookkeeping:** `StorageOpenError` (storage_upgrade_failed/storage_blocked/storage_stale), `staleConnections` WeakSet, `upgradeErrors` WeakMap, `guardUpgradeCursor` aborts the upgrade transaction and records an honest cause on any cursor error (49-92).
- **MemoryLocalStore migration equivalence: NOT APPLICABLE by design** — Memory starts empty each session (no durable old-shape data exists); the *shape* upgrades that matter for cross-version data are done in the **shared transfer layer** (`migrateTransferSnapshot`), which runs identically for both adapters on import (R4-A2 classified this as PRESERVED_WITH_RATIONALE). INFERRED basis: no version gate exists in MemoryLocalStore.ts; the R4 report card R4-A2 documents the classification.

**indexedDbSnapshot.ts (432 lines):** `readIndexedDbSnapshot` — ONE readonly transaction over 35 stores (95-231); `replaceIndexedDbSnapshot` — ONE readwrite transaction, explicit `.clear()` of all 35 stores then puts, with full optional-field normalization (233-432). `form-drafts` and `local-security` are deliberately excluded from both (documented in types.ts:41-44, indexedDbStores.ts:48-51, and contract 39 §2.5). Atomicity guarantee: IndexedDB transaction = all-or-nothing; the EXE-014 test proves a failing replace leaves prior state whole.

**influentialSnapshotFamilies.ts (136 lines):** contractual registry of all 35 snapshot families with `satisfies Record<keyof LocalStoreSnapshot, SnapshotFamilySpec>` (114) — **any new snapshot family breaks the build until registered** (compile-time completeness). Provides `snapshotSystemIsEmpty` / `occupiedInfluentialFamilies` used by the opening-import gate (EXE-014) so "system empty" is defined once, not by a duplicated list.

**persistentStorage.ts (73 lines):** P-01 layer-0 browser persistence request (`navigator.storage.persist()`), states persisted/not_persisted/unsupported with honest copy; header explicitly states **this is not a backup** and export remains the only transfer path.

---

## 5. Transfer / Legacy / Golden Matrix

### (a) Accepted schema/export version pairs — VERIFIED (two independent sources agree)
- `transferEnvelope.ts:15-40` `RELEASED_LEGACY_EXPORT_PAIRS` = 24 legacy pairs; `isCurrentPair` = 30/38 from the live constants.
- `localTransferService.releasedPairs.test.ts:373-399` `ACCEPTED_PAIRS` = **25 pairs total**: current **30/38** + 24 legacy: 29/37, 28/36, 27/35, 26/34, 25/33, 24/32, 23/31, 22/30, 21/29, 20/28, 19/27, 18/27, 17/26, 16/25, 15/24, 14/23, 13/22, 12/21, 11/20, 10/19, 9/18, 8/17, 7/15, 6/14.
- REJECTED_PAIRS (11, releasedPairs.test.ts:401-413): 8/16, 27/34, 28/35, 29/36, 29/35 (near-miss never-released), 5/12, 4/10, 3/7, 2/6, 1/5 (never-released), 99/99 (unknown). String-coerced version values (`"8"`) rejected without textual matching (releasedPairs:437-443; envelope characterization:52).

### (b) Goldens — docs/fixtures/export-goldens/ — VERIFIED 27 `.golden.json` files + MANIFEST.json
- `current-pair.golden.json` (30/38, byte-stable, derived from the faithful 8/17 via migrate→restore→export)
- `current-pair-supplement.golden.json` (30/38, rich new families via services; byteStable=false — generated IDs frozen)
- `historical-8-17-faithful.golden.json` (the 570eba1-faithful fixture)
- 24 × `legacy-minimal-<v>-<s>.golden.json` — one per accepted legacy pair (6/14 … 29/37), byte-stable
- MANIFEST.json pins generator (exportGoldens.test.ts), regen command (`GOLDEN_UPDATE=1 pnpm --filter @micro/prototype-web test -- exportGoldens`), and **sha256 for every golden**.
- **Pair→golden coverage: complete** — all 25 accepted pairs have ≥1 golden (24 legacy-minimal + current pair; 8/17 additionally has the faithful golden). exportGoldens.test.ts (6 tests) verifies: current-pair byte-for-byte determinism; supplement importability with honest counts; **every released legacy pair's frozen minimal golden still imports to 30/38** (line 305); faithful 8/17 materialized on disk and round-trips (322); MANIFEST sha256 pins catch any manual edit (338); directory hygiene — no unexpected files (390).

### (c) Round-trip evidence (test names cited)
- `localTransferService.test.ts` (30 tests): valid order+events round-trip only after confirmation; direct sales + domain-invariant bypass rejection; classified expenses + legacy-no-context acceptance; general reversal chain + broken-link rejection; v6 upgrade preserving legacy shared expense; G3 percentage/deferred fields + previous pair; v7→v8 without inventing catalog; catalog link reference rejection; catalog defaults corruption rejection; material purchase payment-total inconsistency rejection; balanced cash transfer + one-sided rejection; sign-reversed transfer pair rejection; inventory reversal inconsistency rejection; corrupt/unsupported/partial files leave local data untouched; G5 declarations + v9/18 migration; waste context + allocation evidence; reversal-mismatch rejection; actual-time origin/reversal + legacy array init; corrupt actual-time before replacement; G6-B recurrence + pre-G6-B acceptance; G7-A agreement context; inventory activation round-trip + v19/27 acceptance + corrupt rejection; owner profile round-trip + v21/29 backfill + corrupt rejection; documented payment reversal in verified export (S2-03); historical 18/27 pair (S5-05); allocation sourceRefLineId round-trip.
- Family suites: schema31 (labels, 22/30), schema32 (selective inventory, 23/31), schema33 (product-sale links, 24/32), schema34 (assets/loans/classification + legacy 25/33 + 4 hardening rejections), recurringExpense, expenseBudget, receivedLoan, assetResidual (contract 43), feeOrderRoundTrip (F-007, 6 rejections before any write), directSaleRoundTrip (incl. legacy pre-X-06), capabilitiesRoundTrip (disabled capabilities persist), ownerEntitlementTransfer (5), catalogCoreTransfer (4), rel001 (atomic re-import, clean recovery after rejection).
- `releasedPairs.test.ts`: faithful 8/17 full cycle — import→migrate→confirm→export→re-prepare with counts preserved (451-493), with a machine keys-audit against the 570eba1 type surface (37-318).

### (d) Tamper / replay / duplicate rejection (test names)
- **Digest tampering:** envelope27 "rejects a tampered file by digest before any preview — data unchanged"; "rejects a malformed integrity block"; "rejects a re-sealed forgery whose event amount exceeds the safe-integer bound"; envelope characterization "rejects a current envelope with a corrupted digest (before touching data)".
- **Envelope stripping:** envelope27 "rejects a current-version file with the whole envelope stripped (no integrity, no counts)", "…valid digest but no verification counts"; characterization "rejects a current envelope with no integrity block" (AV-04), while "keeps the legacy path: an old envelope without integrity passes its legacy lane" and "verifies a legacy envelope WITH a present-but-corrupt digest strictly".
- **Counter tampering:** releasedPairs `it.each` 8 variants (missing key, string, NaN, Infinity, float, negative, mismatched, unknown extra key) all rejected with the counters message; negative-zero pinned as honest zero; counters characterization suite (frozen-golden-based).
- **Duplicate/replay:** releasedPairs "rejects … duplicated payment idempotency keys inside one purchase", "duplicated order event (idempotencyKey, type) pair", F-051 "same event id under two different types", F-051 "duplicated ids even when the keys differ (identity is the anchor)"; rel001 re-import idempotence; guided opening import retry idempotence by importId.
- **Structured-rejection regressions (R2):** prepareImport.rejection (out-of-grammar date, shared-share overflow XFER-E2, rollover dates M-04, non-date scheduledFor D5); localDateVariantDivergence (0000-0099 years policy, no-throw).
- **Orphan/hardening:** familyOrphan (asset/loan event orphan rejection, ghost asset context); schema34 hardening (legacy-type event with non-zero asset delta, classification event without order, loan reversal non-negation, over-depreciation below zero book value).

### (e) EXE-014 backup-before-replace — VERIFIED implementation + tests
- Implementation: `localTransferService.ts:227-242` `confirmImport` → **first** `createVerifiedExport()` (245-258: createExport → JSON.stringify → prepareImport full round-trip re-validation); backup failure ⇒ `STORAGE_ERROR` "تعذر إنشاء نسخة احتياطية…" and **nothing is touched**; only then `store.replaceSnapshot(preview.file.data)`; success returns `RestoreResult` carrying the `backup: LocalExportFile` (type at :90). `resetAll` (308-312) is the atomic empty-snapshot replacement behind the same boundary.
- Tests: `dataRoundTrip.exe014.test.ts` (5 tests) — (1) opening-import gate refuses ANY occupied influential family (parameterized over the registry; `a single ${family} record blocks … without touching anything`), empty system still accepts; (2) "round-trips the full snapshot with a genuinely restorable pre-replace backup" (source data built through live services across all core families, backup itself round-trip tested); (3) invalid/unsupported files change nothing; (4) **"confirmImport fails honestly and the old snapshot stays complete"** — a deliberately-failing store double proves the gate reports storage_error and `failingAfter == failingBefore`.
- Mechanism note for the rehearsal owner: the backup is **returned to the caller** (UI flow downloads it); the store layer does not itself retain a durable pre-replace copy.

### (f) Migration-path tests for legacy pairs
Per-pair: 6/14 & general (releasedPairs minimal-file loop covers all 24; localTransferService.test v6/v7/v9-18/pre-G6-B/v19-27/v21-29/18-27 scenarios), 22/30 (schema31), 23/31 (schema32), 24/32 (schema33), 25/33 (schema34), 26/34 (envelope27 "accepts the Group-4 26/34 pair verbatim — legacy promise kept"), 8/17 (releasedPairs faithful + goldens), plus exportGoldens "every released legacy pair has a frozen minimal golden that still imports to 30/38". `transferCounters.migrations.characterization.test.ts` (7 tests) pins migration behavior on the faithful 8/17 (no invented values — assets/loans/shortages/ownerMovements/directSales/costEstimates = [], new fields = null/[]/defaults, historical originals untouched) and the identity path for current snapshots.

### Contract 39 (docs/contracts/39-export-envelope-integrity-contract.md) — binding requirements vs implementation/tests
| Requirement (§2) | Implementation | Test |
|---|---|---|
| 1. Embedded SHA-256 + counts + appVersion | localTransferService.createExport:159-168 (syncSha256Hex over canonical JSON, exportCountsOf, appIdentity) | envelope27 "embeds sha256 integrity, embedded counts, and app version" |
| 2. Preview-then-atomic-replace; F-051 duplicate event-id rejection | prepareImport (validate-first, no writes) + confirmImport→replaceSnapshot single transaction; validateSnapshot identity rules | localTransferService.test round-trips; releasedPairs F-051 pair; exe014 atomicity tests |
| 3. Counters match migrated data; corrupt integrity rejected (DP-01/DP-09) | transferCounters.ts verifyTransferCounts (strict shape/integral/non-negative/exact-match/extra-keys); transferEnvelope.ts verifyTransferIntegrity | counters characterization; envelope27; releasedPairs counter-tamper battery |
| 4. Post-restore integrity check displayed (MIC) | UI surface (Settings data-protection card) — NOT re-verified in this storage-layer pass (UNVERIFIED here; out of reviewer-2 file scope) | — |
| 5. form-drafts & local-security always excluded | indexedDbSnapshot store lists (absent), influentialSnapshotFamilies header, Memory parity | exe014/gate suites via registry completeness |
| 6. Real build identity | buildIdentity.ts via appIdentity (localTransferService.ts:138,167) | envelope27 embed test |

Also honored: §4 "raising any limit or accepting a new pair is an owner decision with double diff" — the pair set lives in one module (transferEnvelope.ts) pinned by characterization tests.

**R4 canonicalization (transferCompatibilityValues.ts) — verified live:** `TRANSFER_HISTORICAL_COMPATIBILITY` currently holds exactly ONE registry row (family `agreementSource`, values `conversation|call|in_person`); `AGREEMENT_SOURCE_ACCEPTANCE` = 5 current + 3 legacy; `TRANSFER_ACCEPTANCE_SOURCES` maps 23 families to DOMAIN_RUNTIME_LIST (3), GUARDED_UNION (19), HISTORICAL_REGISTRY (1). transferCompatibilityRegistry.test.ts (7 tests) enforces registry completeness, exact acceptance-set equality, no undocumented extras, and real domain delegation for materialUnits/unitDimensions. domainTransferDriftGuard.test.ts (10 families + self-test proving the guard can fail) is the reverse-direction oracle.

---

## 6. Rollback Implications (mechanisms only — rehearsal scope belongs to the primary executor)

**Durable-format writers:**
1. **IndexedDB database `micro-prototype-local`** (37 object stores, schema 38) — the only durable financial state; written via guarded transactions and the snapshot pair.
2. **Export file** (`micro-prototype-local-export`, version 30, schema 38) — the only cross-device transfer format; envelope-integrity protected.
3. **Guided-opening-import file** (`micro-guided-opening-import` v1) — separate opening-position format with its own preview/confirm and empty-store gate.
4. **Repo goldens/fixtures** — frozen evidence artifacts (sha256-pinned by MANIFEST).

**Documented backup/rollback mechanisms (verified as mechanisms):**
- **EXE-014 verified pre-replace backup**: every `confirmImport` creates a round-trip-verified export of current state *before* replaceSnapshot and refuses to replace if the backup cannot be produced (localTransferService.ts:227-242); the backup is handed to the caller via `RestoreResult.backup`.
- **Atomic replacement**: replaceSnapshot is a single multi-store transaction (clear+put) in IndexedDB; a failed replacement provably leaves prior state whole (exe014 failing-store test).
- **Manual verified export** (`createVerifiedExport`) — the P-01 gate for any destructive step; "start from scratch" (`resetAll`) uses the same atomic replacement with an explicitly empty snapshot.
- **Browser persistence request** (persistentStorage.ts) — reduces eviction risk; explicitly documented as NOT a backup.
- **Code rollback**: R3 §10 documents per-slice `git revert` as data-safe (type-only changes); R3–R8 waves made no schema/export/migration changes (38/30 held throughout — VERIFIED in worklog invariant lines and live constants).
- **Migration irreversibility note**: IndexedDB `onupgradeneeded` upgrades (to 38) are forward-only; rollback of app code below the version a database was opened with is not covered by any documented mechanism (INFERRED from the upgrade model — standard IndexedDB constraint; no downgrade path exists in indexedDbMigrations.ts). The mitigation of record is the export/backup path above.

---

## 7. Counts Summary + Parity Gaps

**Exact counts (all VERIFIED unless noted):**
- Port members: **130** (100% methods) — types.ts:429-884
- Capability groups: **16** (48 files: 16 Store + 16 Anchors + 16 contract tests)
- Capability methods: **107/130 (82.3%)**; uncovered **23** (9 identity/security + 9 drafts + 3 cash-continuity + 2 snapshot pair)
- Full-port injectors remaining: **2** (localTransferService, guidedOpeningImportService)
- Commit guards: **9 files**, **110 unit tests**, all routed inside both adapters' write boundaries
- Storage test corpus: **44 test files** under storage/local (28 root + 16 capability), ~275 `it(` declarations
- IndexedDB object stores: **37** (35 in snapshot; form-drafts + local-security excluded)
- Snapshot families: **35** (registry compile-complete via `satisfies`)
- Accepted version pairs: **25** (1 current 30/38 + 24 legacy); rejected examples pinned: 11
- Goldens: **27 files + MANIFEST** (sha256-pinned); pair coverage **25/25 complete**
- Transfer layer: 25 test files in transfers/; the 7 mission-listed files alone carry 77 `it(` declarations
- Transfer migrations: single shared `migrateTransferSnapshot` (both adapters); historical registry rows: 1 family (3 values)

**Parity gaps / cautions for the primary executor:**
1. **Behavioral parity is not uniform in-lens**: 9/16 capability contract tests assert rejection/stale paths through the narrow lens; 7 (actualTime, asset, costEstimate, directSale, inventoryMaterial, schedule, supplierPurchase) assert success/reuse only there — their rejection evidence exists but lives in guard unit tests + adapter deep suites (verified present: supplierSchedule 25+6, supplierAttribution 6, deliveryReversal 26, adapterDeliveryReversal 3, IndexedDbLocalStore.* suites). If R9 wants "rejection asserted at the capability lens" as a criterion, that is a documentation/expectation question, not a missing-safety question.
2. **Contract-39 requirement 4 (post-restore MIC integrity-check display)** is implemented at the UI layer — not verified in this pass (UNVERIFIED: outside the storage file set reviewed).
3. **EXE-014 backup durability**: backup is returned to the caller, not persisted by the store layer; its survival depends on the UI download flow (mechanism note for rehearsal scope).
4. **IndexedDB upgrades are forward-only**; no downgrade mechanism is documented (standard constraint; export/restore is the documented recovery path).
5. Minor counting-convention drift between R3's "54 tests" (runtime instances) and the live 53 `it(` declarations in the 9 new capability files — immaterial, noted for reconciliation hygiene.
6. supplierScheduleCommitGuard is a combined file (supplier purchase + schedule guards, STR-306) and its `SupplierPurchaseCommit` type is imported by types.ts and supplierAttributionCommitGuard — a known, documented shared-file coupling, not new drift.

**Bottom line:** the live storage/transfer surface reconciles exactly with the R3/R4/R7/R8 recorded claims (130/107/23 methods; 16 capabilities; 9 guards symmetric in both adapters; 38/30 constants; 25 accepted pairs; 27 goldens with complete pair coverage; EXE-014 verified-backup-before-replace implemented and tested). Structural parity is mechanically enforced (Pick-derived lenses + runtime tsc anchors); behavioral parity is dual-adapter asserted for all capabilities, with in-lens rejection depth for 9/16 and equivalent evidence externalized for the rest.
