# Agent 2-d — Data Integrity, Storage, Backup & Recovery (DATA-001)

Repo: `micro-repo-readonly` @ `37319ca` (clean, read-only). Audit date 2026-09-16.
All citations repo-relative. Evidence classes per shared-context §3.4.

## 1. Inventory of persistent data (VERIFIED)

### 1.1 IndexedDB database `micro-prototype-local`, schema v35 — 32 object stores
Source of truth: `apps/prototype-web/client/src/storage/local/indexedDbStores.ts:5-48`.
Cross-checked against `indexedDbMigrations.ts` creation list (all 32 created idempotently) and
`docs/quality/persistent-entity-touchpoints.json` (32 entries). Guard run:
`node scripts/check-entity-touchpoints.mjs` → PASS, exit 0.

Stores: activity-profile, owner-profile, local-preferences, order-drafts, craft-orders,
direct-sales, schedule-entries, schedule-recurrences, financial-events, supplier-purchases,
cash-wallets, cash-continuity-entries, materials, inventory-movements, inventory-activations,
inventory-shortages, catalog-items, measurement-units, direct-conversions, catalog-templates,
actual-time-records, short-cash-declarations, owner-entitlement-policies,
owner-entitlement-records, owner-entitlement-opening-balances, owner-movements,
allocation-policies, cost-estimates, assets, loans, form-drafts, local-security.

### 1.2 localStorage keys (production code only)
- `micro.diagnostics.v1` — localDiagnosticsService.ts:44 (25 entries / 48,000 bytes cap, 8 fixed fields)
- `micro.finance-draft.<type>.v1` (legacy) — legacyFormDraftMigration.ts:47-49, write→verify→delete migration
- `micro.setup-draft.v1` (legacy) — legacyFormDraftMigration.ts:50
No other `localStorage`/`sessionStorage` usage in production code (rg verified; only test files
touch `window.localStorage`). No service-worker-stored user state (SW = vite-plugin-pwa
generateSW, assets precache only — register.ts + vite.config.ts).

### 1.3 Application-level persisted state — all inside IndexedDB stores
- theme, workMode, actualTimeTrackingEnabled, installBannerDismissedAt, lastVerifiedExportAt,
  backupReminderEnabled, disabledCapabilities → single record in `local-preferences`
  (types.ts:143-161). 7 whole-record writers (see §4).
- App lock/PIN: `local-security` singleton (pinHash PBKDF2-SHA256 120k iters + salt; PIN never
  stored) — localLockService.ts:52-66.
- Form drafts: `form-drafts` store (32k-char value cap) — formDraftService.ts:39.
- Sequences/IDs: none persisted (UUIDs inside records; ownerId inside owner-profile;
  schema version = DB version 35; export version 27 in envelope).

## 2. Export/Import/Restore machinery (VERIFIED)

- Export: `LocalTransferService.createExport` (localTransferService.ts:127-156) = readSnapshot
  (single readonly tx over 30 stores, indexedDbSnapshot.ts:83-201) + sha256 integrity digest +
  13 counts + appVersion. `createVerifiedExport` (211-224) re-parses the file full-cycle before
  declaring it ready.
- Import: `prepareImport` (158-197): JSON parse → format gate → version-pair gate (current 27/35
  or 21 released legacy pairs, transferEnvelope.ts:15-49) → date/data gates → integrity verify
  (digest present ⇒ must match; current file without digest/counts rejected — AV-04,
  transferEnvelope.ts:54-72) → `migrateTransferSnapshot` (null-coalescing defaults for every
  family, transferSnapshotMigrations.ts:10-276) → `validateSnapshot` (per-record validators +
  uniqueness + orphan/reversal cross-refs for ALL 30 snapshot fields,
  transferSnapshotValidation.ts:61-1061) → strict counts match for current files
  (transferCounters.ts:27-57). `confirmImport` (199-208) = `replaceSnapshot`.
- Restore/replace: `replaceIndexedDbSnapshot` (indexedDbSnapshot.ts:203-375) — ONE readwrite
  transaction: clear all 30 stores then put all records; onerror/onabort → failure, no partial
  commit (IndexedDB tx atomicity).
- Reset («ابدأ من جديد»): resetAll → replaceSnapshot(emptySnapshot()) (localTransferService.ts:227-274),
  gated by verified export + typed name confirmation + PIN (Settings.tsx:316-387); then clears
  form-drafts + legacy localStorage keys; lock record intentionally preserved.
- Guided opening import: GuidedOpeningImportService (guidedOpeningImportService.ts) — writes
  profile + wallets + opening cash entries + materials + opening movements into an "empty" store
  only, idempotent by importId operation keys; PIN-gated in Settings.
- Migrations: applySchemaUpgrade (indexedDbMigrations.ts:88-521) — idempotent store creation
  (existence checks), oldVersion-gated record normalization (<8, <17, <18, <20, <23, <24, <25, <26).
- PWA dirty-safe update: register.ts:68-76 — no auto reload over dirty forms (contract 38).
- Post-restore integrity check: Settings.tsx:444-457 runs integrityCheck.run() after import,
  shows PASS/WARN/UNAVAILABLE/FAIL with link.
- Registry + guard: docs/quality/persistent-entity-touchpoints.json (32 stores + 3 localStorage
  records, each with adapters/tests/notExportedReason), scripts/check-entity-touchpoints.mjs PASS.

## 3. Coverage comparison (30 snapshot stores + exclusions)

Excluded from export/import/restore BY DESIGN (documented in types.ts:34-37,
contracts 36/37, registry notExportedReason):
- `form-drafts` (transient text drafts; kept as-is on import, cleared on reset with disclosure)
- `local-security` (PIN hash/salt never leaves device; survives import and reset)
- `micro.diagnostics.v1` (private diagnostics; never exported)
- legacy draft keys (migration sources only)

All other 30 stores + the 3 singleton records enter export AND import AND restore, and all 30
fields are validated on import. Store-by-store table in final report.

Minor coverage notes (VERIFIED):
- Envelope counts cover only 13 of 26 array families (transferCounters.ts:9-24); the other 13
  (recurrences, catalog core 4, actualTime, shortCash, owner-entitlement 4, allocation policies,
  cost estimates) rely on the sha256 digest (current files) or validators only (legacy files).
  Legacy pairs (≤26/34) have no digest/counts at all — documented legacy path (contract 39 §4).
- Preferences import validation checks 5 of 9 fields (transferSnapshotValidation.ts:105-130);
  workMode, actualTimeTrackingEnabled, installBannerDismissedAt, disabledCapabilities pass
  through unvalidated (migration spread preserves them; types unchecked at runtime).

## 4. New findings

### NEW-001 — Two preference writers still drop `disabledCapabilities` (SET-003-B incomplete)
- actualTimeService.ts:62-73 `saveOperatingMode` — full-record write without the field
- scheduleService.ts:291-302 `setDailyCapacity` — same omission
- IndexedDbLocalStore.ts:123-125 savePreferences = whole-record put; absence = all capabilities
  re-enabled (types.ts:156-159 "غياب الحقل = الكل مفعّل").
- SET-003-B fix ac8176a touched only preferenceService.ts (3 writers); git show confirms no
  hunks in actualTime/schedule services.
- Reachable: Settings.tsx:262-277 (saveOperatingMode), Schedule.tsx:137 (setDailyCapacity).
- Tests pass (17/17) — no regression coverage for these two writers.
- Class: DEEPENS_EXISTING (SET-003-B), P2, high confidence.

### NEW-002 — Guided-opening import "empty store" gate checks only 15/30 snapshot families
- guidedOpeningImportService.ts:187-201 `emptySnapshot` omits: ownerProfile, preferences,
  directSales, inventoryShortages, inventoryActivation, measurementUnits, directConversions,
  catalogTemplates, ownerEntitlementPolicies/Records/OpeningBalances, ownerMovements,
  allocationPolicies, costEstimates, assets, loans.
- Guided snapshot (304-326) leaves those fields unset → replaceSnapshot normalizes to []/null →
  those stores silently cleared on confirm.
- Reachability today: /settings is a public recovery route without a profile (StartupGate.tsx:9,67);
  theme toggle there writes preferences with no profile → guided opening import would clear it.
  Deeper stores are setup-gated in practice (profile exists → non_empty_store refusal).
- QA g82 plan + guidedOpeningImportService.test.ts:92-105 only proved the gate with a profile
  present; un-checked families never tested.
- Class: Data Risk / Design Gap, P3 (current impact = preferences wipe pre-setup), high
  confidence on code fact, medium on field impact.

## 5. Failure modes (VERIFIED, code-level)
- Partial import: impossible by construction — single readwrite tx + clear/put + onerror→failure.
- Merge rules: none — full replace, no merge; duplicate re-import of same file = idempotent
  replace; guided opening import idempotent via operation keys (alreadyImported check).
- Version mismatch: unknown/unsupported pairs rejected with honest message before any write;
  DB downgrade (older app over newer DB) → VersionError → storage_stale (indexedDbLifecycle.ts:39-45);
  newer app over older DB → onupgradeneeded idempotent migration.
- Restore over existing data: preview + PIN gate (runWhenProtected — import blocked until lock
  enabled; absence of lock is not authorization, Settings.tsx:92-126) + post-restore MIC check.

## 6. Privacy/security (VERIFIED)
- Diagnostics: 8 fields only, fixed safe messages, capped, never sent (no fetch/sendBeacon),
  route templates only (no raw paths/ids). localDiagnosticsService.ts:27-58, 126-155.
- PIN: PBKDF2-SHA256 120k iterations + 16-byte salt; PIN never stored; legacy sha256 records
  auto-upgraded after successful unlock; escalating retry backoff (3/10/30s). localLockService.ts.
- Secrets: check-secrets.mjs guard in CI; no tokens/keys in code (guard exists, repo clean).
- Export file: plaintext JSON with all business data incl. customer names and owner email
  (owner-profile) — by design; app copy warns to keep it safe; no encryption (documented).

## 7. 2-3 month durability estimate (INFERRED — analysis, not testing)
- Volume: records are small JSON (~0.3-3KB); 3 months of daily single-owner use ≈ low single-digit
  MB — far below any IndexedDB quota (Chrome ~60% disk / GBs on Android; iOS ~GBs). Quota is not
  the binding constraint.
- Eviction: `navigator.storage.persist()` requested at every boot (StartupGate.tsx:51-53);
  state displayed honestly in Settings (persistentStorage.ts + SettingsDataProtectionSection).
  If not granted and not installed as PWA, browser eviction under pressure remains possible —
  documented honestly; export is the only transfer path.
- Private/incognito windows: IndexedDB is ephemeral there; no in-app detection or warning found
  (UNVERIFIED at runtime; environmental, not a code defect).
- Manual backup only: Home reminder after 7 days since last verified export
  (homeControlCenterService.ts:481-483), dismissible (O-001). No auto-backup (no cloud — FUTURE_SCOPE).
- Multi-tab: versionchange closes stale connection (indexedDbLifecycle.ts:53-62) + BroadcastChannel
  refresh (PrototypeServicesContext.tsx:121-141). Blocked upgrade → honest storage_blocked.

## 8. Diagnostics run this session (all exit 0)
- `node scripts/check-entity-touchpoints.mjs` → PASS
- `vitest run client/src/application/preferences/preferenceService.test.ts` → 6 passed
- `vitest run client/src/application/transfers/localTransferService.test.ts client/src/storage/local/persistentStorage.test.ts` → 36 passed
- `vitest run client/src/application/time/actualTimeService.test.ts client/src/application/scheduling/scheduleService.test.ts` → 17 passed

## 9. Could NOT verify
- Runtime IndexedDB eviction/quota behavior in real browsers (static audit only).
- Actual behavior in private mode / iOS Safari 7-day ITP deletion (environmental).
- SHA-256 digest reproducibility across JSON key orders for very old hand-edited files
  (logically safe: JS preserves string-key insertion order; not runtime-tested here).
- Whether any real user data exists in unchecked guided-opening families in the field.
