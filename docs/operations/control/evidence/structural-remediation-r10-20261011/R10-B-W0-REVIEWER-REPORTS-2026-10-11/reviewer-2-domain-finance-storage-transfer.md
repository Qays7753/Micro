# R10-B Reviewer 2 (RV2) — Domain / Finance / Storage / Transfer / History

- **Role:** R10-B canonical prompt §6 role 2 — financial meaning, owner-money import/export, Schema 38 / Export 30, legacy acceptance, Transfer/Golden coverage, IndexedDB/Memory parity, dates and persisted values.
- **Repository:** `/home/z/my-project/r10b/clone`, branch `main`.
- **SHA verified:** `git rev-parse HEAD` → **`ffc54eb1150932c9bba88b48a7c38275f2a3effa`** (equals the expected HEAD; last commit `2026-10-11 13:23:04 +0300 "Merge R9 base snapshot control policy"`; working tree clean per `git status --short` = empty).
- **Date of review:** 2026-10-11 (Asia/Amman).
- **Read-only statement:** This review performed **zero writes** to the repository — no file created/modified/deleted/staged, no git write commands, no installs, no builds, no test runs, no network. All conclusions derive from my own reading of live code at HEAD. The prior R10-A package under `scratch/r10a-package/` was consulted **only** as a list of claims to re-verify; every CONFIRM/DISPROVE/REFINE below is backed by fresh inspection cited as file:line.
- **Protected invariants treated as untouchable (verified, not challenged):** `localSchemaVersion=38` (types.ts:55), `localExportVersion=30` (types.ts:71), financial meaning/rounding (MoneyMinor integer discipline — §B4), historical meaning/date behavior (Amman kernel — §B5), legacy file acceptance (24 released pairs — §A1), Transfer/import/export semantics (§A1, §B1–B2, §B7).

---

## 1. Commands actually executed (all read-only)

```
git -C /home/z/my-project/r10b/clone rev-parse HEAD            # ffc54eb... (verified)
git -C /home/z/my-project/r10b/clone branch --show-current     # main
git -C /home/z/my-project/r10b/clone status --short            # empty (clean)
git -C /home/z/my-project/r10b/clone log -1 --format=...       # date/subject only
wc -l <key files>                                              # line counts
python3 (read-only):                                           # analysis only, stdout only
  - enumerate PrototypeLocalStore interface methods (types.ts)
  - per-adapter class-method parity check (IndexedDb/Memory)
  - method-name reference scan across 341 client test files
  - cross-adapter duplicated-literal diff
  - golden JSON inspection (counts keys, owner family presence)
rg / Read / Glob / LS over: application/transfers/*, storage/local/*,
  src/domain/shared/*, scripts/check-date-arithmetic-ownership.mjs(+test),
  docs/fixtures/export-goldens/*, pages/Settings.tsx, package.json files,
  docs/operations/control/evidence/structural-remediation-r9-20261010/r9c-browser-evidence/*
```

No output was written anywhere except this file (in `scratch/reviewers/`).

## 2. Files / symbols / line-ranges inspected (primary evidence)

| File | Ranges / symbols |
|---|---|
| `apps/prototype-web/client/src/application/transfers/transferCounters.ts` (65 lines) | `exportCountsOf` 8–31 (18 families, lines 10–29); `verifyTransferCounts` 34–64 (extra-key rejection :50, integer/negative/mismatch :51–59, rejection :60–61) |
| `apps/prototype-web/client/src/application/transfers/transferSnapshotValidation.ts` (1193) | required/optional array gate 76–123; `validateOwnerProfile` :136; owner defaulting **851–862**; owner relation validation 863–1088 (incl. movement→cashContinuityEntries :1043–1052); asset/loan event cross-checks 1097–1128, 1184–1191; budget rules 1158–1177 |
| `apps/prototype-web/client/src/application/transfers/localTransferService.ts` (316) | `TransferSummary` 40–83 (owner fields :63–66); `summary()` 92–136 (owner :119–122); `createExport` 146–170 (digest :161, counts :163); `prepareImport` 172–225 (structured-throw wrapper 195–209); `confirmImport` 227–242 (backup-first :231); `createVerifiedExport` 245–258; `emptySnapshot` 261–305 |
| `apps/prototype-web/client/src/application/transfers/transferEnvelope.ts` (76) | `RELEASED_LEGACY_EXPORT_PAIRS` 15–40 (24 pairs); `isCurrentPair` 42–44; `verifyTransferIntegrity` 57–75 (current-must-have-digest :68–72) |
| `apps/prototype-web/client/src/application/transfers/transferSnapshotMigrations.ts` (347) | `...raw` spread :15; owner families 173–222 (coerce-to-[]); `actualTimeRecords` current/legacy asymmetry 167–171 |
| `apps/prototype-web/client/src/storage/local/types.ts` (884) | `localSchemaVersion=38` :55; `localExportVersion=30` :71; `LocalExportCounts` 115–137 (18 keys); `LocalStoreSnapshot` 344–394 (35 fields); `LocalExportFile` 395–406; `PrototypeLocalStore` interface (130 methods — enumerated programmatically) |
| `apps/prototype-web/client/src/storage/local/indexedDbSnapshot.ts` (453) | `readIndexedDbSnapshot` 95–231 (35 stores; owner reads 164–169, 210–214); `replaceIndexedDbSnapshot` 233–453 (owner clear 380–383, owner put 417–422; guarded abort 322–347) |
| `apps/prototype-web/client/src/storage/local/MemoryLocalStore.ts` (2095) | `RECURRENCE_STALE_MESSAGE` :84–85; stale sites :636/:639/:644; `readSnapshot` 1395–1436; `replaceSnapshot` 1437–1526 (owner 1458–1461, 1500–1509) |
| `apps/prototype-web/client/src/storage/local/indexedDbStores.ts` (70) | shared `RECURRENCE_STALE_MESSAGE` :23–24 |
| `apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.ts` (4396) | import :88; stale sites :1359/:1370/:1379; `readSnapshot`/`replaceSnapshot` 2891–2896 |
| `apps/prototype-web/client/src/storage/local/influentialSnapshotFamilies.ts` (137) | complete `satisfies`-checked family registry :22–114; `snapshotSystemIsEmpty` :129–131 |
| `apps/prototype-web/client/src/storage/local/indexedDbLifecycle.ts` (119) | connection cache :16–27; `failure()` storage_stale identity :29–52 |
| `apps/prototype-web/client/src/lib/syncSha256.ts` (119) | `utf8Bytes` 7–34 (CESU-8 branches :15–31); hash core 52–119 |
| `apps/prototype-web/client/src/application/transfers/exportGoldens.test.ts` (399) | golden derivation + MANIFEST pinning; supplement seeding incl. owner draw 150–159; manifest count 27 :381 |
| `docs/fixtures/export-goldens/*` (28 files) | all 27 goldens + MANIFEST inspected programmatically |
| `scripts/check-date-arithmetic-ownership.mjs` (221) + `.test.mjs` | patterns :130–140; per-line scan :152–197; R4 `??` same-line exemption :174–181 |
| `src/domain/shared/businessTime.ts` (64), `numeric.ts` (249), `currency.ts` (40) | kernel contracts (see §B4–B5) |
| `apps/prototype-web/client/src/application/time/clock.ts` (50) | `systemClock` :36; `todayInAmman` :48–50 |
| `apps/prototype-web/client/src/application/transfers/guidedOpeningImportService.ts` (394) | emptiness gate :204/:243/:364; partial snapshot literal 322–344 |
| `apps/prototype-web/client/src/pages/Settings.tsx` (729) | transfer UI flow 360–459 |
| Tests cited: `localTransferService.releasedPairs.test.ts` (25 ACCEPTED :373–399 / 11 REJECTED :401–413; counters tamper matrix :579–629), `localTransferService.envelope27.test.ts` (tamper incl. re-sealed forgery :157–166), `ownerEntitlementTransfer.test.ts` (legacy O1 acceptance :257–294), `transferCounters.migrations.characterization.test.ts`, `localTransferService.prepareImport.rejection.test.ts`, `adapterConformance.group10.test.ts` (28-commit matrix 1089–1119), `IndexedDbLocalStore.test.ts` (`import "fake-indexeddb/auto"` :1) |
| `docs/operations/control/evidence/structural-remediation-r9-20261010/r9c-browser-evidence/` | README + f7-verdict.json + f7-run.json (real-Chromium evidence chain) |

---

## 3. Part A — Re-verification of R10-A findings

### A1. R10A-F-009 (S2) — owner-money families outside counters + required-array gate → **CONFIRMED and REFINED** (line numbers sharpened; one aggravating nuance found)

**(a) Counters — CONFIRMED.** `LocalExportCounts` (types.ts:115–137) and `exportCountsOf` (transferCounters.ts:8–31) count exactly **18 families** (transferCounters.ts:10–29):
`orders, directSales, financialEvents, supplierPurchases, cashWallets, cashContinuityEntries, materials, inventoryMovements, inventoryShortages, assets, loans, recurringExpenseSeries, recurringExpenseRevisions, recurringExpenseOccurrences, expenseBudgets, receivedLoans, schedules, drafts`.
**None of the 4 owner families** (`ownerEntitlementPolicies`, `ownerEntitlementRecords`, `ownerEntitlementOpeningBalances`, `ownerMovements`) appears — neither in the type nor in the function.

**(b) Required-array gate — CONFIRMED with corrected enumeration.** The gate (transferSnapshotValidation.ts:77–123) has:
- **19 strictly-required arrays** (must be present as arrays or the file is rejected): `drafts` :79, `orders` :80, `directSales` :81, `schedules` :82, `recurrences` :83, `financialEvents` :84, `supplierPurchases` :85, `cashWallets` :86, `cashContinuityEntries` :87, `materials` :88, `inventoryMovements` :89, `catalogItems` :94, `measurementUnits` :95, `directConversions` :96, `catalogTemplates` :97, `actualTimeRecords` :98, `shortCashDeclarations` :99, `allocationPolicies` :100, `costEstimates` :101.
- **8 optional-if-absent arrays** (absent OK; present-but-non-array REJECTED): `inventoryShortages` :91–93, `assets` :103, `loans` :104, `recurringExpenseSeries` :106–108, `recurringExpenseRevisions` :109–111, `recurringExpenseOccurrences` :112–114, `expenseBudgets` :116–118, `receivedLoans` :121.
- Total gate coverage: 27 of the 31 snapshot array families. **The 4 owner families appear nowhere in the gate.** (R10-A's "~24 required arrays" is imprecise; the precise split is 19 strict + 8 optional = 27.)

**(c) Defaulting to [] — CONFIRMED, refined to lines 851–862** (R10-A said 851–861; the four `Array.isArray(x) ? x : []` const declarations span **851–862**).

**Consequence trace (my own end-to-end walk of `prepareImport`, localTransferService.ts:172–225):**
1. `isCurrentPair` (version 30 / schema 38) ✓ → `verifyTransferIntegrity` (transferEnvelope.ts:57–75): attacker **re-seals** → recomputed digest matches (`syncSha256Hex(JSON.stringify(candidate.data))`, :66).
2. `migrateTransferSnapshot` (migrations :173–222): owner families absent → `[]`.
3. `validateSnapshot`: gate passes (owner families not required); :851–862 re-defaults to `[]`; owner relation checks (863–1088) run over empty sets.
4. `verifyTransferCounts`: the 18 counted keys still match the migrated data; extra-key rejection (:50) applies **only to the `counts` object**, which the attacker regenerates honestly for the 18 keys.
5. Preview succeeds; `summary()` reports `ownerEntitlementPolicies/Records/OpeningBalances/ownerMovements: 0` (localTransferService.ts:119–122) — the **only** (soft, user-facing) signal.
6. `confirmImport` → `replaceSnapshot` **clears the four owner stores and writes nothing** (indexedDbSnapshot.ts:380–383 clear, :417–422 put; MemoryLocalStore.ts:1458–1461, 1500–1509). **Owner ledger erased; re-export launders the loss** (readSnapshot reads the now-empty stores).

**Present-vs-absent behavior for owner families in a current-pair file (traced):**
- Present as valid arrays → per-record migration defaults (seriesId ?? id, successorOfPolicyId ?? null, sourceKeys legacy default, reversal fields ?? null, relatedOpeningBalanceId ?? null, openingBalanceDeltaMinor ?? 0 — migrations :173–222) then **strict relational validation**: policy id/idempotencyKey/(seriesId,version) uniqueness :867–878; successor chain rules :879–897; active-overlap :898–906; entitlement→policy FK + version match + reversal mirror :910–945; active-entitlement sourceKey/period overlap :946–962; opening-balance uniqueness/reversal/single-active :966–997; movement→wallet, →entitlement, →opening-balance, →draw-source relations :1003–1038; **movement→cashContinuityEntries cross-family evidence** (`owner-movement:${idempotencyKey}`, :1043–1052); movement reversal mirroring :1056–1075; opening-balance settlement bound :1076–1088. When present, coverage is thorough.
- Present but **non-array** → **silently coerced to `[]` by BOTH the migration (173–222) and validation (851–862)** — *not* rejected. This is strictly weaker than the legacy-optional pattern (e.g. `inventoryShortages` present-but-non-array IS rejected, :91–93). → new finding RV2-N1 below.
- Absent → `[]` everywhere; imports cleanly (the exploit).

**Cross-link nuance (why wholesale delete is the silent path):** partial deletes that break cross-references ARE caught (e.g. keeping `ownerMovements` with `relatedEntitlementId` while deleting `ownerEntitlementRecords` fails :1016–1020; movements require matching cash entries :1043–1052). Deleting **all four families together** leaves no dangling reference anywhere — no other family points INTO the owner families — hence silent. (Contrast: assets/loans have bidirectional event-context guards, :1097–1128 + :1184–1191.)

**Legacy pairs + goldens — CONFIRMED optional-if-absent by design and by test:**
- 24 released legacy pairs (transferEnvelope.ts:15–40); `releasedPairs.test.ts` ACCEPTED = 25 (current + 24 legacy) :373–399, REJECTED = 11 :401–413.
- 27 goldens + MANIFEST (verified programmatically; MANIFEST pins 27 entries). All 24 `legacy-minimal-*.golden.json` contain **only 6 data keys** (profile, preferences, drafts, orders, schedules, financialEvents), no counts, no integrity — owner families absent and accepted (`exportGoldens.test.ts:305–320`).
- `ownerEntitlementTransfer.test.ts:257–294` pins the **intended legacy contract**: a 12/21 file with the 4 owner families deleted imports and initializes them `[]`. The fix (RC-1) must keep exactly this for legacy pairs while gating current-pair files.
- Current-pair goldens: `current-pair.golden.json` and `current-pair-supplement.golden.json` both have **counts blocks with exactly the 18 keys**; both carry the 4 owner families in data (supplement has `ownerMovements` length 1 — the owner draw seeded at exportGoldens.test.ts:150–159). **RC-1 golden impact: both current-pair goldens + MANIFEST must be regenerated (`GOLDEN_UPDATE=1`); `transferCounters.migrations.characterization.test.ts:32–36,66` pins counter shape and must be updated. Legacy goldens are unaffected (no counts blocks).**
- Untested today: no test drops a data family and re-seals (the counters tamper matrix :605–621 mutates only the `counts` block; the re-sealed forgery test envelope27:157–166 tests only the safe-integer bound).

**Verdict: R10A-F-009 CONFIRMED in full** (three locations, exact enumerations above), **REFINED** on two points: gate line span 77–123 (not 79–113), defaulting span 851–862, and the aggravating non-array-coercion nuance (RV2-N1).

### A2. R10A-F-008 (S3) — 6 adapter methods without direct test invocation → **REFINED (denominator clarified; gaps confirmed with coverage map)**

- `PrototypeLocalStore` interface: **130 methods** (programmatic enumeration of types.ts).
- Both adapters implement **130/130 with zero extra public methods** (programmatic class-surface check: IndexedDbLocalStore 130/130, MemoryLocalStore 130/130) — parity intact.
- **Storage-local test corpus (45 files under `src/storage/local/**`): 6 methods never invoked by name** — `getOwnerProfile`, `saveOwnerProfile`, `saveSchedule`, `deleteDraft`, `deleteFormDraft`, `deleteLocalSecurity`. This matches R10-A's "6 gaps" when the denominator is the adapter/conformance corpus.
- **Full client test corpus (341 files): 3 methods never referenced by name anywhere** — `deleteDraft`, `deleteFormDraft`, `deleteLocalSecurity`. The other three ARE exercised elsewhere: `getOwnerProfile`/`saveOwnerProfile` (ownerProfileService.test.ts, localTransferService.test.ts, dataRoundTrip.exe014.test.ts), `saveSchedule` (ScheduleEditor.dom.test.tsx, homeControlCenterService.test.ts, supplierScheduleStaleResults.test.ts, localTransferService tests).
- The 3 never-named methods are exercised **indirectly through services on a real MemoryLocalStore**: `DraftService.delete` (draftService.test.ts:61,76,86 → store.deleteDraft), `FormDraftService.discard` (formDraftService.test.ts:21,80 → store.deleteFormDraft), `LocalLockService.disable` (localLockService.test.ts:74–81,171–185 → store.deleteLocalSecurity).
- **Residual true gap:** no *direct* invocation of these 6 in the per-family adapter suites, and their **IndexedDB implementations** (thin `deleteOne`/`writeOne`/`readOne` delegations — IndexedDbLocalStore.ts:184–221 area) are covered only via other families' use of the same primitives under fake-indexeddb. Risk is low (one-line delegations to shared primitives) but the conformance claim "every method exercised per adapter" is not literally true for these 6.

### A3. R10A-F-010 (S3) — syncSha256 lacks an independent oracle; CESU-8 surrogate deviation → **CONFIRMED (oracle gap) + REFINED (deviation is latent/unreachable on live paths)**

- Implementation: pure-JS FIPS 180-4 SHA-256 (syncSha256.ts:52–119), own UTF-8 encoder `utf8Bytes` (:7–34).
- **Oracle gap CONFIRMED:** every test that verifies a digest computes the expected value **with `syncSha256Hex` itself** (prepareImport.rejection.test.ts:29; transferEnvelope.characterization.test.ts:62,69; envelope27.test.ts:165; releasedPairs.test.ts:344; exportGoldens.test.ts:264). No FIPS test vectors (e.g. `"abc"` → `ba7816bf…`) and no node:crypto cross-check of the data digest exist anywhere in app tests. The only node:crypto hash (`sha256Of`, exportGoldens.test.ts:64) hashes golden **file text** for the MANIFEST — it never cross-checks `syncSha256Hex`.
- **CESU-8 deviation CONFIRMED as coded, but unreachable on current call sites:** `utf8Bytes` encodes a lone **low** surrogate as 3-byte CESU-8 (`ED B0 80`-class, else-branch :29–31) and a lone **high** surrogate as CESU-8 **only when it is the last character** (:15 condition `i + 1 < text.length` fails → else-branch); a lone high surrogate **followed by a non-low** char becomes U+FFFD (:27) — an internal inconsistency (same character encodes differently by position). WHATWG `TextEncoder` replaces every lone surrogate with U+FFFD. **However**, every live caller hashes `JSON.stringify(...)` output (localTransferService.ts:161,217; transferEnvelope.ts:66), and well-formed `JSON.stringify` (ES2019+) escapes lone surrogates to ASCII `\uD800`-style sequences — so the deviating branches cannot be reached through the transfer pipeline today, and digest self-consistency holds end-to-end. Severity of the deviation itself: latent (S4); the **oracle gap** is the substantive S3 (a coding error in the hash core would be invisible to the suite).

### A4. R10A-F-011 (S3) — duplicated RECURRENCE_STALE_MESSAGE without identity proof → **CONFIRMED and EXTENDED (family of ~45 literals, zero byte-identity tests)**

- Declaration 1: `indexedDbStores.ts:23–24` (exported); imported by IndexedDbLocalStore.ts:88; used at :1359, :1370, :1379 (`commitRecurrence` guard paths).
- Declaration 2: `MemoryLocalStore.ts:84–85` (module-local duplicate, same Arabic literal verbatim); used at :636, :639, :644.
- **No test anywhere asserts this message text** (`rg` for the literal across all test files: 0 hits).
- **Extension (new, RV2-N2):** a programmatic literal-diff of the two adapters finds **~45 duplicated Arabic message literals** present verbatim in both files (e.g. `"لم نجد الطلب المحلي لتسجيل التسليم."` IndexedDbLocalStore.ts:710 / MemoryLocalStore.ts:390; owner-reversal conflict messages; order/sale/loan not-found messages…). The 28-commit conformance matrix (`adapterConformance.group10.test.ts:1089–1119`) asserts `ok`/`reused` but contains **zero `.message` assertions** — cross-adapter message byte-identity is unproven for the entire family. (Other message families ARE single-sourced via shared guard modules: orderCommitGuard, supplierScheduleCommitGuard's `validateScheduleUpdate`, loan/receivedLoan/expenseBudget/cashContinuity guards, supplierAttributionCommitGuard — imported by both adapters; `SECOND_WALLET_OPENING_MESSAGE` and storage_stale identity via indexedDbLifecycle `failure()` :29–52 are shared. The duplication is exactly the non-guard-module messages.)

### A5. R10A-F-014 (S3) — date-slice guard is textual/line-based → **CONFIRMED**

- `scripts/check-date-arithmetic-ownership.mjs`: comment-stripping with string-literal awareness (:87–127), then **per-line regex** tests (:152–196). R4 pattern `RAW_DATE_SLICE_PATTERN` (:130) matches `.slice(0,10)` / `.substring(0,10)` / `.split("T")[0]` in any spacing; the exemption (:174–181) is purely textual: if the text **before the match on the same line** contains `??`, the use is treated as a guarded fallback. No semantic analysis of what the `??` guards (a `??` belonging to an unrelated sub-expression on the same line would falsely exempt a genuinely raw slice; a guarded fallback split across lines would false-positive).
- **The 5 guarded `slice(0,10)` uses in production (enumerated):**
  1. `components/finance/CorrectionsLayer.tsx:82` — `formatLocalDate(businessDateFromTimestamp(entry.recordedAt)) ?? entry.recordedAt.slice(0, 10)`
  2. `components/settings/SettingsDataProtectionSection.tsx:171` — `… ?? lastExport.slice(0, 10)`
  3. `components/forms/FormDraftRestoreBanner.tsx:59` — `… ?? savedAt.slice(0, 10)`
  4. `application/financial-records/correctionHistoryService.ts:342` — `ammanDateOrNull(revision.createdAt) ?? revision.createdAt.slice(0, 10)`
  5. `application/financial-records/correctionHistoryService.ts:478` — `ammanDateOrNull(revision.changedAt) ?? revision.changedAt.slice(0, 10)`
  All five follow the documented pattern (canonical derivation first, raw slice only as fallback). No unguarded production slice exists (guard + my independent `rg` sweep agree).

---

## 4. Part B — Mandatory analogous-pattern searches

### B1. COMPLETE persisted-family matrix (the critical deliverable)

`LocalStoreSnapshot` (types.ts:344–394) has **35 fields: 31 array families + 4 singletons**. The 31st array family count includes every `readonly X[]` field. Matrix against the three tamper-evidence layers (current-pair semantics; legacy = optional-if-absent for all post-hoc families):

| # | Family (array) | In LocalExportCounts (18)? | In required-array gate? | Migration behavior (absent) | Deletion caught on re-sealed current file? |
|---|---|---|---|---|---|
| 1 | drafts | ✔ counted | ✔ strict (:79) | n/a (required) | YES (gate) |
| 2 | orders | ✔ | ✔ strict (:80) | n/a | YES (gate + count) |
| 3 | directSales | ✔ | ✔ strict (:81) | n/a | YES (gate + count) |
| 4 | schedules | ✔ | ✔ strict (:82) | n/a | YES (gate + count) |
| 5 | recurrences | ✖ | ✔ strict (:83) | n/a | YES (gate only; no count) |
| 6 | financialEvents | ✔ | ✔ strict (:84) | n/a | YES (gate + count) |
| 7 | supplierPurchases | ✔ | ✔ strict (:85) | n/a | YES (gate + count) |
| 8 | cashWallets | ✔ | ✔ strict (:86) | n/a | YES (gate + count) |
| 9 | cashContinuityEntries | ✔ | ✔ strict (:87) | n/a | YES (gate + count) |
| 10 | materials | ✔ | ✔ strict (:88) | n/a | YES (gate + count) |
| 11 | inventoryMovements | ✔ | ✔ strict (:89) | n/a | YES (gate + count) |
| 12 | inventoryShortages | ✔ | optional (:91–93, non-array rejected) | `[]` (:140) | YES (count) |
| 13 | catalogItems | ✖ | ✔ strict (:94) | n/a | YES (gate only) |
| 14 | measurementUnits | ✖ | ✔ strict (:95) | n/a | YES (gate only) |
| 15 | directConversions | ✖ | ✔ strict (:96) | n/a | YES (gate only) |
| 16 | catalogTemplates | ✖ | ✔ strict (:97) | n/a | YES (gate only) |
| 17 | actualTimeRecords | ✖ | ✔ strict (:98) | current→`undefined`→gate rejects; legacy→`[]` (:167–171) | YES (gate; *current files must carry it*) |
| 18 | shortCashDeclarations | ✖ | ✔ strict (:99) | n/a | YES (gate only) |
| 19 | allocationPolicies | ✖ | ✔ strict (:100) | n/a | YES (gate only) |
| 20 | costEstimates | ✖ | ✔ strict (:101) | n/a | YES (gate only) |
| 21 | **ownerEntitlementPolicies** | ✖ | **✖ NOT IN GATE** | `[]` (migrations :173–183; validation :851–853) | **NO — silent erasure** |
| 22 | **ownerEntitlementRecords** | ✖ | **✖** | `[]` (:184–198; :854–856) | **NO** |
| 23 | **ownerEntitlementOpeningBalances** | ✖ | **✖** | `[]` (:199–209; :857–859) | **NO** |
| 24 | **ownerMovements** | ✖ | **✖** | `[]` (:210–222; :860–862) | **NO** |
| 25 | assets | ✔ | optional (:103) | `[]` (:240–254) | YES (count) + event-context backrefs (:1184–1185) |
| 26 | loans | ✔ | optional (:104) | `[]` (:255–273) | YES (count) + backrefs (:1186–1190) |
| 27 | receivedLoans | ✔ | optional (:121) | `[]` (:277–296) | YES (count) + backrefs (:1189) |
| 28 | recurringExpenseSeries | ✔ | optional (:106–108) | `[]` (:299–310) | YES (count) |
| 29 | recurringExpenseRevisions | ✔ | optional (:109–111) | `[]` (:311–323) | YES (count) |
| 30 | recurringExpenseOccurrences | ✔ | optional (:112–114) | `[]` (:324–340) | YES (count) |
| 31 | expenseBudgets | ✔ | optional (:116–118) | `[]` (:344) | YES (count) |

Singletons (by design outside counting; absence legitimate): `profile`, `ownerProfile` (validated-if-present :124–136), `preferences` (:137–162), `inventoryActivation` (:163–176).

**Matrix conclusions:**
1. **The 4 owner families are the ONLY array families that are neither counted nor gated** — the only full gaps. R10-A's claim holds exactly.
2. 9 families (recurrences, catalogItems, measurementUnits, directConversions, catalogTemplates, actualTimeRecords, shortCashDeclarations, allocationPolicies, costEstimates) are **required-but-uncounted**: deletion is caught by the gate, but they lack count-level cross-evidence (defense-in-depth asymmetry vs the 18 counted; see RV2-N6 — owner decision whether RC-1 extends counters to full coverage or only closes the owner gap).
3. Owner families are additionally the only ones whose **present-but-non-array** value is silently coerced to `[]` rather than rejected (RV2-N1).
4. A complete, `satisfies`-enforced family registry **already exists** (`INFLUENTIAL_SNAPSHOT_FAMILIES`, influentialSnapshotFamilies.ts:22–114 — every `keyof LocalStoreSnapshot` must appear or the build breaks; owner families included at :68–80). It powers the emptiness gate (`snapshotSystemIsEmpty` :129–131) used by guided opening import + start-fresh. **Repair-design input:** this is the in-repo precedent for compile-time-complete family registries the RC-1 repair can mirror for counters/required-arrays (owner decision on mechanism).

### B2. Other validation paths — any other family missed?

- **Envelope digest** (transferEnvelope.ts:57–75): covers the whole `data` object as serialized — any tampering **without** recomputation is caught for ALL families (including owner). The re-seal scenario is what the counters/gate layer exists for; owner families are outside it (§A1).
- **Counts extra-key rejection** (transferCounters.ts:50): applies to the `counts` object only. **Data-level unknown keys are NOT rejected**: `migrateTransferSnapshot` spreads `...raw` (migrations :15), so an attacker may add arbitrary new top-level keys to `data` of a re-sealed file; they ride through `validateSnapshot` (no unknown-key check) into the migrated snapshot. They are **inert at the persistence layer** (replaceSnapshot writes only the 35 known stores — indexedDbSnapshot.ts:273–431; MemoryLocalStore.ts:1472–1524 assigns only known Maps) and are dropped on re-export (readSnapshot reconstructs only known fields). Envelope-level unknown keys are likewise ignored (file reconstruction picks known fields only, localTransferService.ts:210–223). → RV2-N3 (S4, defense-in-depth).
- **Pair gate**: 24 legacy pairs + current (25 accepted / 11 rejected, string-coercion rejected — releasedPairs.test.ts:373–443). No family dimension.
- **Guided opening import** (guidedOpeningImportService.ts): separate format (`micro-guided-opening-import` v1), only wallets+materials, gated on **complete** emptiness (uses `snapshotSystemIsEmpty` — full 35-family registry), writes via domain constructors; its snapshot literal omits optional families (:322–344) relying on adapter-side `?? []` normalization — parity holds in both adapters; no owner-data loss possible (system provably empty of owner records before write).

### B3. Storage parity — **CONFIRMED 130/130 × 2, zero extra public surface**

Programmatic check (see §1): `PrototypeLocalStore` = 130 methods; `IndexedDbLocalStore` implements 130/130, `MemoryLocalStore` implements 130/130; no extra public methods on either. Shared commit-guard modules used by both adapters: orderCommitGuard, supplierScheduleCommitGuard, loanCommitGuard, receivedLoanCommitGuard, expenseBudgetCommitGuard, cashContinuityCommitGuard (incl. `SECOND_WALLET_OPENING_MESSAGE`), supplierAttributionCommitGuard, plus deliveryReversal/recurringExpense guard imports — the R10-A "9 shared commit guards" figure reconciles with these shared modules. `storage_stale` identity single-sourced in `indexedDbLifecycle.failure()` (:29–52; staleConnections WeakSet + VersionError). The only duplicated behavioral literal family is the ~45 adapter messages (RV2-N2).

### B4. Persisted money representation — **MoneyMinor discipline CONFIRMED**

- **Sole persisted-text formatter:** `persistedMoneyTextMinor` (src/domain/shared/currency.ts:31–40) — defined exactly once; pure integer division/remainder (2 decimals, no grouping, unit inside, negative supported, fail-closed `throw` on non-safe-integer). Its consumers are enumerated and frozen by `moneyLayerGuard.contract.test.ts:172–182` (the five persisted-money writers: craft-order policies :1429/:1506, deliveryReviewService, cashCountMessages ×2).
- **No float money anywhere:** zero `parseFloat` in production (`src/` + app); `Math.round` appears only in `quantityMilliExact` (numeric.ts:221 — quantity milli conversion kernel, validated); money paths carry `Number.isSafeInteger`/`Number.isInteger` guards (e.g. craft-order policies ×4, financial-event policies ×6).
- **`/100` on money exists only in throw-message text** (loan policies :82; received-loan :106; craft-order :1195/:1334/:1411; deliveryContribution :47–49 — the 11 frozen throw-message inclusions) and in `persistedMoneyTextMinor` itself (integer division). `toFixed(2)/(3)` sites are limited to the documented preserves: recurring-margin rate descriptions (recurring-margin/policies.ts:294–301, non-unification constraint) and the input-echo kernel (application/input/englishNumeric.ts:74,79 — display echo only).
- Rounding kernels: `roundHalfUp`, `floorRatio`, `ceilRatio`, `sumSafeIntegers`, `addSafe` (numeric.ts:129, 227–244) — pure integer math. **No violations found.**

### B5. Dates — **kernel and injectability CONFIRMED; guard scope boundary noted**

- Kernel: `src/domain/shared/numeric.ts` — pure-integer proleptic Gregorian, years 0000–9999 (contract :1–7, range check :40), Howard Hinnant `days_from_civil` (:44–76); `businessTime.ts` — `localDateInAmman(instant)` **explicit instant mandatory** (:47–53, throws `INVALID_INSTANT_MESSAGE`), `ammanDateOrNull` (:56–64); Intl `Asia/Amman` formatter (:33–38).
- Clock port: `Clock` type, single `systemClock` (clock.ts:36), `todayInAmman(clock = systemClock)` the **sole** named "today" boundary (:48–50); services take injectable clocks (42 injection sites unified per STR-618; verified in transfer/golden/cash/owner services read).
- Guard coverage (`check-date-arithmetic-ownership.mjs`): R1 Date.UTC banned in all production; R2/R3/R6 domain-only (new Date/Date.parse kernel-file-only; ambient `new Date()` banned in domain); R4 raw slicing banned in all app layers with the textual `??` exemption; R5 zero-arg `localDateInAmman` banned everywhere. Guard has its own positive/negative test file.
- **Boundary (residual, not guarded):** ambient `new Date()`/`Date.now()` in the **app layer outside src/domain** is not banned by any rule. Live sites found (all non-financial): id-generation fallbacks (`crypto.randomUUID ?? Date.now()…` — QuickSaleForm:61, QuickExpenseForm:72, OrderDepositPanels:51/53, SaleCollectionReversalSection:21, ActualTimePanel:32, ExpenseBudgetsSectionBody:49, costService:28, recurringWorkService:148, collectionReversalService:91, projectFinancialEventWrites:51, ownerProfileService:54, cashContinuityService:77 — the R10A-F-012 "three id generators" family); PWA banner (PwaInstallControl:62,80); lock-gate idle timing (AppLockGate:85,87,93); presentation preview `recordedAt` never persisted (EventEffectPreview:115); FormDraftRestoreBanner:20 (injectable default). None of these write persisted financial values. → note for RV2-N7 (informational).

### B6. Duplicated message/error literals across adapters+services — **family enumerated (RV2-N2)**

~45 Arabic message literals duplicated verbatim between IndexedDbLocalStore.ts and MemoryLocalStore.ts (see §A4 for method). Guard-module messages and `storage_stale`/`SECOND_WALLET_OPENING` identities are single-sourced. No `.message` assertions exist in the adapter-conformance corpus; none of the duplicated literals is asserted in any test. `INVALID_INSTANT_MESSAGE` is the counter-example of the right pattern (exported constant + frozen literal anchors in tests, businessTime.ts:40–44).

### B7. Validation-before-write, atomicity, backup — **CONFIRMED sound; two documented caveats**

- Import path: `prepareImport` validates **everything before any write** (envelope → migration → validateSnapshot → counts; structured-throw wrapper :195–209); only explicit `confirmImport` writes. `confirmImport` **creates a full-cycle verified backup first** (`createVerifiedExport` :231–238) and refuses to write if the backup cannot be produced — no replacement without a rollback path.
- Atomicity: IndexedDB `replaceSnapshot` is one readwrite transaction over all 35 stores with clears-then-puts and the R9-GA-F1 guarded-abort fix (indexedDbSnapshot.ts:314–448) — sync throws abort the transaction before the original error propagates. Memory `replaceSnapshot` is a synchronous assignment block over cloned data (single JS turn). `resetAll` uses the same atomic replace.
- Caveat 1 (by design, documented): `resetAll` does not itself require a backup — the UI gate does (Settings.tsx reset flow reaches `performReset` only after a successful verified export + lock-code confirmation, :360–375, :386).
- Caveat 2 (by design): `confirmImport` does not re-validate the preview object (single-validation contract; the only production caller passes `prepareImport`'s output verbatim — Settings.tsx:425→430→459). A hypothetical future caller constructing a `TransferPreview` directly would bypass validation → RV2-N5 (S4 informational).
- `createVerifiedExport` round-trips the export through `prepareImport` before declaring it usable as a backup (:245–258) — an export whose own data fails import cannot become a rollback artifact.

---

## 5. Part C — E-UNV research input

### E-UNV-001 (real-browser IndexedDB) — what can/cannot be proven in this Linux/jsdom environment

- **Cannot be proven here (and is not proven by repo CI):** the repo's test suite runs on **jsdom + fake-indexeddb 6.2.5** (`IndexedDbLocalStore.test.ts:1 "fake-indexeddb/auto"`; R9-C README confirms: no playwright/puppeteer/cypress/webdriver in any package.json or CI job — independently verified by my package.json scan). Real-engine semantics — transaction ordering/durability quirks, multi-tab `versionchange` races, quota/private-mode behavior, Safari/Firefox engine differences — are NOT covered by CI.
- **What DOES exist (committed, out-of-band, from R9-C, 2026-10-11):** a reproducible real-Chromium evidence chain in `docs/.../r9c-browser-evidence/` (README + `f7-manifest.json` content-addressed + `adapter-entry.js` bundle SHA-pinned + `f7-verdict.json`/`f7-run.json`). The recorded run (HeadlessChrome/156.0.8078.4) exercised the **RB-3 legs** of the adapter bundle against native IndexedDB: `commitFinancialEventCorrection` and `saveDirectSale` with poisoned (uncloneable) payloads → honest `storage_error` with the ORIGINAL DataCloneError message and state intact (all four verdict booleans true, zero console errors). Its own "honest boundary" section states what it does not prove: not a repeatable CI check; read-failure surfaces and UI gates not browser-verified.
- **Net:** real-browser coverage = 2 operation legs, one engine, one recorded run, plus a 2026-10-10 page-surface run — a floor, not a harness. The standing in-repo CI harness recommendation (R9-GA-F7) remains open. In THIS environment (no browser execution allowed) I could only verify the evidence chain's existence, integrity model, and honesty of its stated limits.

### E-UNV-012 (accounting standards) — what the repo claims, and where preservation-only language lives

- **No accounting-standards correctness claim exists anywhere.** The build charter explicitly forbids drifting into an accounting system: "منع أي Agent أو مطور من توسيع المرحلة إلى SaaS أو ERP أو نظام محاسبي عام قبل وجود دليل" (docs/implementation/prototype-build-charter-v1.md:32); the target user is a non-accountant craft owner (:43, :94).
- The deepest financial claim is the **conceptual equations audit** (docs/operations/control/evidence/reconciliation-2026-09-26/02-zai-financial-equations/micro-financial-equations-audit-2026-09-25.md): 171 equations/rules inventoried (EQ-001..171), 149 with direct tests; it uses an independent professional-rating layer (GOOD_PRACTICE / ACCEPTABLE_WITH_CAVEAT / NEEDS_IMPROVEMENT / CONCEPTUALLY_RISKY) but **explicitly disclaims** completeness-as-correctness: "اكتمال الجرد ليس إثباتًا للصحة… القرار المفهومي يبقى للمالك وحده", and it records open contradictions (debt-ceiling basis, delivery-cost gap, break-even naming) awaiting owner decisions.
- **Preservation-only language locations:** the audit's rule "لا تُنفذ أي توصية تغيّر معنى المال قبل قرار المالك" (no money-meaning change without owner decision); OWNERSHIP-AND-TRUTH-REGISTRY.md (§around :292, :315) — financial meaning (values, rounding, classification, error identity) owned by the domain, never derived from display/Locale; persisted-money formatting frozen via the single canonical formatter with legacy text read-as-stored (no migration); R10-B protected invariants (schema 38 / export 30 / legacy acceptance / transfer semantics) mirror these. **For E-UNV-012 disposition: the repo's own posture is "internally consistent, heavily tested, owner-decision-gated" — NOT "compliant with GAAP/IFRS or any external standard"; no external accountant attestation exists.**

### E-UNV-011 (production data) — confirmed absent

- The product is a **local-first PWA prototype**: `private: true` (package.json), client-only Vite build, no server component (no express/fastify anywhere), zero telemetry/analytics/sentry in client source (verified by search). All state lives in the device's IndexedDB (+ transient localStorage drafts). No production users, no production dataset, no hosted backend — **no production data exists to protect or migrate**; the only "real" data are the owner's own local test devices and the committed golden fixtures (synthetic, MANIFEST-pinned).

---

## 6. New findings (not in the R10-A list)

| ID | Finding | Evidence | Severity | Disposition recommendation |
|---|---|---|---|---|
| **RV2-N1** | Owner-family **present-but-non-array** values are silently coerced to `[]` in BOTH the migration and the validator — unlike every other optional family (e.g. `inventoryShortages` :91–93 rejects non-array). A corrupt owner family value in a re-sealed current file is dropped, not rejected; also internally inconsistent with the `[]`-default-vs-reject pattern of legacy families. | migrations :173–222; validation :851–862; contrast :91–121 | **S3** (aggravates R10A-F-009) | Fold into RC-1: when adding the owner gate for current-pair files, make present-values-must-be-arrays (mirror inventoryShortages semantics) and add a characterization test. Long-term: derive all optional-family semantics from one shared table so presence rules cannot diverge per family. |
| **RV2-N2** | Cross-adapter duplicated message literal **family ≈ 45 strings** (RECURRENCE_STALE_MESSAGE is one instance); the 28-commit conformance matrix has zero `.message` assertions — no byte-identity proof for any of them; none asserted in any test. | §A4; adapterConformance.group10.test.ts:1089–1119 | **S3-family** | Short-term: add one conformance test asserting both adapters return byte-identical messages for a sampled rejection set per family (or snapshot the message tables). Long-term: extract the duplicated literals into shared guard/constant modules (pattern already proven: `SECOND_WALLET_OPENING_MESSAGE`, `INVALID_INSTANT_MESSAGE`) or a single adapter-message table consumed by both. |
| **RV2-N3** | No **data-level extra-key rejection**: unknown top-level keys in `data` pass migrate (spread :15) + validateSnapshot and reach the preview object; inert at persistence (only known stores written) and dropped on re-export, but they widen the accepted-grammar surface and could confuse future family additions (a typo'd new family would import "successfully" while being dropped). | migrations :15; indexedDbSnapshot.ts:273–431; MemoryLocalStore.ts:1472–1524 | **S4** | Short-term: optional strict-mode extra-key check on current-pair files (mirror counts' extra-key rejection at transferCounters.ts:50) — must be version-gated to preserve legacy acceptance. Long-term: single schema table driving counts+gate+extra-keys so the three layers cannot drift (the `satisfies` registry pattern of influentialSnapshotFamilies.ts:22–114 is the in-repo precedent). |
| **RV2-N4** | (Repair-design input, not a defect) A **compile-time-complete family registry already exists** — `INFLUENTIAL_SNAPSHOT_FAMILIES` with `satisfies Record<keyof LocalStoreSnapshot, …>` (build breaks if a family is missing), including owner families. RC-1 can mirror this mechanism for `LocalExportCounts`/required-arrays instead of hand-maintained lists. | influentialSnapshotFamilies.ts:22–114 | — | Offer to the owner decision package as the mechanism for RC-1 and any future family addition (makes "forgot the counters" a compile error). |
| **RV2-N5** | `confirmImport` trusts the preview object without re-validation (single-validation contract). Only production caller passes `prepareImport` output verbatim today. | localTransferService.ts:227–242; Settings.tsx:425–459 | **S4** | Document the contract on `confirmImport` (typed brand or comment); optionally re-run `validateSnapshot` on `preview.file.data` (cheap, idempotent) as defense-in-depth. Do NOT change wire semantics. |
| **RV2-N6** | 9 required-but-uncounted families (recurrences, catalogItems, measurementUnits, directConversions, catalogTemplates, actualTimeRecords, shortCashDeclarations, allocationPolicies, costEstimates) — deletion caught by the gate but no count cross-evidence; asymmetric with the 18 counted families. | matrix §B1 | **S4** (informational) | Owner decision whether RC-1's counter extension covers only the 4 owner families (minimal golden churn: 2 current-pair goldens + MANIFEST + counters characterization) or all 13 uncounted (larger churn, uniform tamper-evidence). Either way export version stays 30 (counts are additive keys; legacy files have no counts). |
| **RV2-N7** | App-layer ambient `new Date()`/`Date.now()` sites (~17) outside guard scope (R6 is domain-only): id-fallbacks, PWA banner, lock idle timing, one never-persisted preview timestamp. No persisted financial value is affected. | §B5 list | **S4** (informational) | If the owner wants total ambient-time ownership, extend the guard with an app-layer allowlist (the ~17 sites) rather than a blanket ban; id-fallbacks are the R10A-F-012 family and out of my lens's repair scope. |

---

## 7. Unverified limits (honest boundaries of this review)

1. **No execution:** I ran no tests, builds, or migrations (read-only mandate); all behavioral statements derive from code reading and existing test/golden content, not from re-running them.
2. **No real browser:** E-UNV-001 as stated (§5) — fake-indexeddb semantics assumed for all IndexedDB claims; the R9-C Chromium evidence was read, not re-executed.
3. **Golden byte-stability:** I verified golden JSON structure/keys programmatically but did not re-derive digests or re-run the golden comparison suite; MANIFEST SHAs were not recomputed (no test runs allowed).
4. **Full per-record validator reading:** `transferFamilyValidators.ts` (~large) was consulted for imports/structure and spot-checked, not exhaustively line-read; the per-family record-shape correctness is backed by the existing characterization suites, which I did not execute.
5. **Domain equation semantics:** financial-meaning correctness (rounding direction, entitlement math) was verified at the discipline/ownership level (single kernels, integer math, guard enumerations), not by re-deriving the 171 audited equations.
6. **syncSha256 correctness:** not independently recomputed (no execution); the oracle gap is asserted from test-content inspection, and the CESU-8 analysis is from code reading of `utf8Bytes` branches.
7. **Test-file scan denominators:** the 341-file corpus is `apps/prototype-web/**` `*.test.ts(x)`; tests elsewhere (e.g. root `tests/`) could reference the 3 "never-named" methods — spot checks suggest none exist, but the scan is name-based, not coverage-instrumentation-based.

---

## 8. Write attestation

**No writes performed to the repository.** The only file created by this review is this report at `/home/z/my-project/r10b/scratch/reviewers/reviewer-2-domain-finance-storage-transfer.md` (outside the clone). `git status` at start and end of inspection showed a clean tree at `ffc54eb1150932c9bba88b48a7c38275f2a3effa`.

**Bottom line for the owner decision package:** R10A-F-009 is **confirmed exactly** — the 4 owner-money families are the only array families covered by *neither* the 18-key counters nor the 19-strict+8-optional required-array gate, defaulted to `[]` at transferSnapshotValidation.ts:851–862, with the added aggravation (RV2-N1) that present-but-corrupt values are silently coerced rather than rejected. RC-1 is correctly scoped; its golden impact is precisely 2 current-pair goldens + MANIFEST + the counters characterization test (legacy goldens and legacy acceptance untouched); the in-repo `satisfies`-registry pattern (RV2-N4) is the recommended enforcement mechanism so this class of gap becomes a compile error.
