# أدلة الموجة B — M1.6 (خرج الأوامر الخام، بلا أي تحرير)

> جُمعت على فرع `feature/manage-v2`. §١–§٣ قبل الالتزام (شجرة `fa5f10c7` + ملفات العمل)، §٤–§٦ على شجرة الالتزام النهائي `9d5e308c`.

## §١ — الفشل المقصود أولًا (الاختبارات قبل أي كود تنفيذي)

الأمر: `corepack pnpm vitest run scripts/check-module-boundaries.test.mjs`

```
 ❯ scripts/check-module-boundaries.test.mjs (47 tests | 8 failed) 3442ms
     × R10: a client file importing the manage domain via alias (barrel or bare) is rejected — type or value 11ms
     × R10: a RELATIVE client import into src/domain/manage is caught even when the target file does not exist yet 2ms
     × R10: a client import into worker/application/manage (relative, real worker location) is caught — target need not exist 1ms
     × R10: lookalike area names (management, market) are NOT the manage area — no over-matching 2ms
     ✓ R10: non-client sources are not this rule's business (a domain file importing the manage barrel is left to R11/§14) 1ms
     × R11: a manage-domain file importing its own subtree and src/domain/shared passes (both spellings) 2ms
     × R11: a manage-domain file importing another domain area (even its barrel, even type-only) is rejected 2ms
     × R11: client/worker internals from the manage domain are rejected; external packages are not repo paths 2ms
     × the live repository has zero R10/R11 violations (no Manage code yet — the rules stand ready) 696ms

⎯⎯⎯⎯ Failed Tests 8 ⎯⎯⎯

 Test Files  1 failed (1)
      Tests  8 failed | 39 passed (47)
```

(عينات أسباب الفشل: `expect(r10).toHaveLength(2)` → `Array length 0 ≠ 2`؛ `expect(result.stats.clientToManage).toBe(2)` → `undefined ≠ 2` — القاعدتان غير موجودتين بعد.)

## §٢ — إثبات القبول: الحارس يفشل على أدوات مخالفة مقصودة (النص الحرفي للأمر: prove it)

أُنشئ ملفان مؤقتان ثم الأمر: `node scripts/check-module-boundaries.mjs`

```
module-boundaries: FAIL — 3 خرقًا جديدًا فوق الأساس المقبول:
  [R10-client-to-manage-import] apps/prototype-web/client/src/lib/m16ClientLeakFixture.ts -> @micro-domain/manage/index.js
    استيراد من العميل إلى مجال مانج أو معالجاته السيرفرية (M1.6/§14.3/D-5): العميل API رفيع + عرض + كاش بلا أي حساب؛ أزل الحافة — لا استثناءات مسجلة
  [R10-client-to-manage-import] apps/prototype-web/client/src/lib/m16ClientLeakFixture.ts -> ../../../worker/application/manage/createExpense.js
    استيراد من العميل إلى مجال مانج أو معالجاته السيرفرية (M1.6/§14.3/D-5): العميل API رفيع + عرض + كاش بلا أي حساب؛ أزل الحافة — لا استثناءات مسجلة
  [R11-manage-domain-import] src/domain/manage/m16DomainLeakFixture.ts -> ../planning/index.js
    مجال مانج يستورد هدفًا داخليًا خارج شجرته وshared (M1.6/§14.3): مانج وحدة منفصلة داخل التطبيق؛ أزل الحافة — لا استثناءات مسجلة

GUARD_EXIT_WITH_FIXTURES=1
```

ملاحظة: هدفَا الاستيراد المخالفان (`src/domain/manage/**` و`apps/prototype-web/worker/application/manage/**`) **غير موجودين على الشجرة** — الاصطياد بالتحويل الافتراضي (متطلب «rules must be ready قبل وجود الكود»).

## §٣ — الإزالة والنجاح (remove the fixture)

أُزيل الملفان (والمجلد الفارغ `src/domain/manage/`) ثم:

```
GUARD_EXIT_CLEAN=0
git status --short
 M scripts/check-module-boundaries.mjs
 M scripts/check-module-boundaries.test.mjs
(لا أثر لملفي الإثبات)

module-boundaries: PASS — 464 ملف إنتاج؛ …؛ 0 حافة عميل→مانج و0 حافة أجنبية من مجال مانج (صفر مسموح — R10/R11 جاهزتان قبل كود مانج، M1.6/§14.3/D-5)؛ صفر زيادة صامتة (ratchet — Wave 4E/RC-9 + Wave H/STR-617 + الخطوة ٦/STR-615 + R8/R8-F-019 + M1.6/R10-R11)
```

## §٤ — بوابة الموجة على شجرة الالتزام `9d5e308c`

### `corepack pnpm guards` (exit 0 — ٢٠ PASS / صفر FAIL)

```

> micro@0.1.0 guards /home/z/my-project/Micro
> node scripts/check-secrets.mjs && node scripts/check-test-focus.mjs && node scripts/check-entity-touchpoints.mjs && node scripts/check-runtime-cycles.mjs && node scripts/check-doc-index-coverage.mjs && node scripts/check-current-state-size.mjs && node scripts/check-agent-document-contract.mjs && node scripts/check-skill-references.mjs && node scripts/check-image-policy.mjs && node scripts/check-module-boundaries.mjs && node scripts/check-lint-warning-baseline.mjs && node scripts/check-type-cycles.mjs && node scripts/check-registry-coverage.mjs && node scripts/check-acceptance-value-anchors.mjs && node scripts/check-file-size-ratchet.mjs && node scripts/check-vendored-braces.mjs && node scripts/check-date-arithmetic-ownership.mjs && node scripts/check-application-door-surfaces.mjs && node scripts/check-application-readwrite.mjs && node scripts/check-storage-listener-guards.mjs && node apps/prototype-web/scripts/check-test-typecheck-coverage.mjs && node scripts/check-money-minor-casts.mjs && node scripts/check-application-ambient-time.mjs && node scripts/check-diagnostics-storage.mjs && node scripts/check-label-vocabulary.mjs && node scripts/check-a11y-dialog-surfaces.mjs

check-secrets: PASS — 2385 files scanned, 0 secret patterns
check-test-focus: PASS — 534 test files (JS + Python), 0 focus/skip occurrences
check-entity-touchpoints: PASS — manifest covers every store, every declared path exists, every omission has a reason
runtime-cycle-guard: 508 production files scanned, 0 runtime cycles (type-only edges ignored)
check-doc-index-coverage: catalog coverage complete
check-current-state-size: live contract intact (16710/20480 bytes)
check-agent-document-contract: contract intact
check-skill-references: 8 skills registered, all references resolve
check-image-policy: 50 images, all within the approved baseline (source scope: git — generated/ignored output excluded by definition)
module-boundaries: PASS — 464 ملف إنتاج؛ الأساس المقبول: 4 استيرادًا عميقًا داخل المجال، 15 حافة واجهة→مجال، 0 حافة تطبيق→عرض، 3 حافة عميقة عابرة لمناطق المجال، 2 حافة واجهة→تخزين (resolution-based)، 66 استيرادًا عميقًا واجهة→دواخل بيوت التطبيق (راتشة R6/STR-615)، 0 حافة مكوّن→صفحة (الصنف الممنوع — R8-F-019)؛ 23 حافة نوعية واجهة→تخزين (راتشة R8/D-01 على أساس 19 مفتاحًا)؛ 124 حافة أزواج بيوت تطبيق منها 84 قيمة و40 نوعًا (راتشة R9/D-07 على جرد 130/81/49 مع إعفاءات OD-10 الورقية)؛ 0 حافة عميل→مانج و0 حافة أجنبية من مجال مانج (صفر مسموح — R10/R11 جاهزتان قبل كود مانج، M1.6/§14.3/D-5)؛ صفر زيادة صامتة (ratchet — Wave 4E/RC-9 + Wave H/STR-617 + الخطوة ٦/STR-615 + R8/R8-F-019 + M1.6/R10-R11)
check-lint-warning-baseline: PASS — 35 تحذيرًا بالضبط (max-lines-per-function=18 + complexity=17) = الأساس المعتمد؛ السقف 37 باقٍ في سطر lint دون مساس (D-05/R10A-F-026 — OD-GUARD)
type-cycles: PASS — 1 دورة نوعية قائمة (كلها ضمن الأساس المقبول)؛ صفر دورة جديدة صامتة (Wave H/STR-617 بند 1)
registry-coverage: PASS — 41 بيت تطبيق و20 منطقة مجال كلها مذكورة في سجل الملكية (Wave H/STR-617 بند 5)
acceptance-value-anchors: PASS — مواقع الاستهلاك الأربعة المحروسة (agreementContextService وagreementService لمصادر الاتفاق من سجل التوافق؛ walletKinds وmaterialUnits في guided من المجال) تستهلك مصادرها الكنونية مباشرة والقوائم الكنونية بأعضائها الموثقة — رجوع أي موقع إلى نسخة حرفية (بصيغتيها) يُصاد حتميًا بالسلبيات المثبتة (Wave H/STR-623 ثم توحيد R4-B2 ثم إغلاق R4-REC-5)؛ وعائلات F-024 الست (inventoryMovementType وcatalogItemKind وscheduleStatus وyieldReadiness وshortCashDeclaration وexpenseContext) مثبتة من الجهتين: اتحاد المجال == مدققة النقل == الطاقم الموثق (R6-W2/F-024)
file-size-ratchet: تدقيق الانجراف مقابل origin/main @ 5a9064e657a40041ebe63c8f107d57a802f6b93f
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/App.tsx: 23 -> 28 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/app/MicroRouter.tsx: 299 -> 313 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/app/PrototypeServicesContext.tsx: 360 -> 663 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/app/StartupGate.tsx: 96 -> 109 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/app/navigation.ts: 64 -> 72 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/app/navigationContract.ts: 226 -> 232 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/app/routeClassifier.ts: 100 -> 103 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/app/useDisabledCapabilities.ts: 36 -> 39 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/activity/activityService.ts: 542 -> 591 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/activity/index.ts: 12 -> 19 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/agreements/agreementPresentation.ts: 106 -> 137 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/agreements/agreementPrice.ts: 19 -> 38 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/agreements/agreementService.ts: 247 -> 347 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/agreements/index.ts: 20 -> 31 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/assets/assetService.ts: 501 -> 697 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/cash/cashContinuityService.ts: 319 -> 356 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/catalog/catalogService.ts: 431 -> 484 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/collections/collectionService.ts: 240 -> 260 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/cost/costService.ts: 99 -> 198 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/delivery/deliveryService.ts: 400 -> 474 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/diagnostics/routeTemplate.ts: 58 -> 62 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/direct-sales/directSaleEditorModel.ts: 184 -> 349 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/direct-sales/directSaleService.ts: 255 -> 354 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/drafts/draftService.ts: 116 -> 193 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/drafts/formDraftService.ts: 129 -> 146 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/drafts/index.ts: 19 -> 22 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/estimates/costEstimateService.ts: 147 -> 155 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/finance/dueDatesService.ts: 120 -> 122 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/finance/financialEventEditorModel.ts: 209 -> 342 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/finance/index.ts: 64 -> 70 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/finance/integrityCheckCoreFinance.ts: 430 -> 436 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/finance/integrityCheckOffenderSummaries.ts: 123 -> 124 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/finance/projectFinancialEventWrites.ts: 443 -> 539 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/finance/projectFinancialPeriodReads.ts: 422 -> 479 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/finance/projectFinancialReads.ts: 230 -> 235 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/finance/projectFinancialService.ts: 152 -> 160 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/finance/projectFinancialTypes.ts: 288 -> 301 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/finance/statementMarkdownService.ts: 231 -> 264 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/financial-records/correctionHistoryService.ts: 487 -> 488 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/financial-records/expenseRecordIntent.ts: 108 -> 217 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/financial-records/index.ts: 30 -> 38 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/financial-records/retainedDepositService.ts: 248 -> 252 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/follow-up/index.ts: 12 -> 29 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/follow-up/unifiedFollowUpService.ts: 459 -> 525 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/fulfillment/fulfillmentService.ts: 756 -> 759 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/home/homeControlCenterModel.ts: 209 -> 225 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/home/index.ts: 18 -> 20 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/inventory/index.ts: 28 -> 32 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/inventory/inventoryMaterialLifecycle.ts: 246 -> 286 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/inventory/inventoryMaterialModel.ts: 258 -> 296 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/inventory/inventoryMaterialReads.ts: 324 -> 357 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/inventory/inventoryMaterialShortages.ts: 167 -> 209 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/inventory/inventoryMaterialWaste.ts: 166 -> 200 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/inventory/inventoryMaterialWrites.ts: 276 -> 375 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/inventory/inventoryMovementEditorModel.ts: 136 -> 137 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/parties/index.ts: 12 -> 29 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/parties/partyLedgerService.ts: 227 -> 304 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/preferences/index.ts: 12 -> 27 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/preferences/preferenceService.ts: 164 -> 225 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/profile/profileService.ts: 43 -> 106 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/recurring/recurringExpenseService.ts: 770 -> 963 (SPLIT_CANDIDATE)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/scheduling/index.ts: 20 -> 41 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/scheduling/scheduleReads.ts: 181 -> 206 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/scheduling/scheduleService.ts: 495 -> 505 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/security/index.ts: 12 -> 18 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/suppliers/supplierPurchaseEditorModel.ts: 106 -> 165 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/suppliers/supplierPurchaseService.ts: 410 -> 506 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/transfers/domainTransferDriftAnchors.ts: 97 -> 108 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/transfers/guidedOpeningImportService.ts: 382 -> 444 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/transfers/index.ts: 13 -> 42 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/transfers/localTransferService.ts: 306 -> 550 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/transfers/transferCounters.ts: 62 -> 75 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/transfers/transferEnvelope.ts: 71 -> 76 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/transfers/transferFamilyValidators.ts: 1730 -> 2316 (SPLIT_NOW)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/transfers/transferSnapshotMigrations.ts: 346 -> 444 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/application/transfers/transferSnapshotValidation.ts: 1192 -> 1401 (SPLIT_NOW)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/components/ErrorBoundary.tsx: 80 -> 83 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/components/direct-sales/SaleCollectionReversalSection.tsx: 199 -> 208 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/components/finance/FinanceObligationsCard.tsx: 102 -> 105 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/components/finance/FinancePeriodResultSection.tsx: 496 -> 517 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/components/finance/expenseFormModel.ts: 77 -> 82 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/components/forms/EnglishNumberInput.tsx: 107 -> 130 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/components/layout/MicroAppShell.tsx: 148 -> 194 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/components/layout/QuickActionSheet.tsx: 335 -> 336 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/components/orders/OrderDepositPanels.tsx: 523 -> 530 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/components/presentation/DecisionPanel.tsx: 25 -> 26 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/components/presentation/EventEffectPreview.tsx: 150 -> 166 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/components/primitives/Field.tsx: 62 -> 82 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/components/primitives/Notice.tsx: 91 -> 106 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/components/primitives/markers.tsx: 36 -> 37 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/components/settings/SettingsCapabilitiesSection.tsx: 197 -> 209 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/components/settings/SettingsDataProtectionSection.tsx: 583 -> 629 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/contexts/ThemeContext.tsx: 72 -> 75 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/index.css: 7365 -> 7465 (SPLIT_NOW)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/lib/syncSha256.ts: 112 -> 125 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/AgreementEditor.tsx: 652 -> 748 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/AssetDetail.tsx: 526 -> 626 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/AssetEditor.tsx: 357 -> 437 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/Assets.tsx: 160 -> 165 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/CashAdjustmentEditor.tsx: 202 -> 203 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/CashCount.tsx: 228 -> 345 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/CashOpeningLaterEditor.tsx: 198 -> 199 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/CashReversalEditor.tsx: 220 -> 226 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/CashTransferEditor.tsx: 193 -> 222 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/CashWalletEditor.tsx: 135 -> 136 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/CashWallets.tsx: 306 -> 308 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/CostCalculator.tsx: 609 -> 925 (SPLIT_CANDIDATE)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/CostEditor.tsx: 637 -> 1055 (SPLIT_CANDIDATE)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/DeliveryBookingDetail.tsx: 596 -> 777 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/DeliveryBookingEditor.tsx: 401 -> 602 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/DirectSaleEditor.tsx: 999 -> 1628 (SPLIT_NOW)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/DraftEditor.tsx: 525 -> 1043 (SPLIT_CANDIDATE)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/DriverBookingDetail.tsx: 731 -> 846 (SPLIT_CANDIDATE)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/DriverPortal.tsx: 439 -> 502 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/FinanceActivity.tsx: 311 -> 333 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/FinanceUpcoming.tsx: 257 -> 444 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/FinancialEventEditor.tsx: 1194 -> 1792 (SPLIT_NOW)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/Foundation.tsx: 328 -> 793 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/InventoryMaterials.tsx: 842 -> 863 (SPLIT_CANDIDATE)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/InventoryMovementEditor.tsx: 954 -> 1032 (SPLIT_CANDIDATE)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/InventoryReversalEditor.tsx: 170 -> 171 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/Market.tsx: 230 -> 385 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/MarketListingEditor.tsx: 493 -> 683 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/MarketReview.tsx: 574 -> 584 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/MarketVendorWorkspace.tsx: 523 -> 664 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/NotFound.tsx: 17 -> 18 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/Orders.tsx: 439 -> 1029 (SPLIT_CANDIDATE)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/OwnerWithdrawalEditor.tsx: 349 -> 350 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/Parties.tsx: 213 -> 397 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/Profile.tsx: 333 -> 401 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/RecurringExpenseDetail.tsx: 564 -> 660 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/RecurringExpenseEditor.tsx: 381 -> 385 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/Schedule.tsx: 996 -> 1011 (SPLIT_CANDIDATE)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/Settings.tsx: 704 -> 981 (SPLIT_CANDIDATE)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/Setup.tsx: 432 -> 617 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/Statement.tsx: 796 -> 816 (SPLIT_CANDIDATE)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/SupplierPurchaseEditor.tsx: 1176 -> 1818 (SPLIT_NOW)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pages/Suppliers.tsx: 227 -> 232 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/presentation/stateAdapter.ts: 149 -> 151 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/pwa/PwaRuntimeNotice.tsx: 98 -> 124 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.ts: 4391 -> 5651 (SPLIT_NOW)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/storage/local/MemoryLocalStore.ts: 2087 -> 2804 (SPLIT_NOW)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/storage/local/capabilities/assetStore.ts: 35 -> 39 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/storage/local/capabilities/costEstimateStore.ts: 35 -> 39 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/storage/local/capabilities/directSaleStore.ts: 34 -> 35 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/storage/local/capabilities/inventoryMaterialStore.ts: 39 -> 40 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/storage/local/capabilities/recurringExpenseStore.ts: 46 -> 47 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/storage/local/cashContinuityCommitGuard.ts: 28 -> 126 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/storage/local/indexedDbLifecycle.ts: 112 -> 135 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/storage/local/indexedDbSnapshot.ts: 451 -> 514 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/storage/local/influentialSnapshotFamilies.ts: 130 -> 153 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/storage/local/recurringExpenseCommitGuard.ts: 154 -> 173 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/storage/local/supplierScheduleCommitGuard.ts: 336 -> 368 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/client/src/storage/local/types.ts: 876 -> 1384 (SPLIT_NOW)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/scripts/bundle-surfaces-baseline.json: 108 -> 132 (NORMAL)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/worker/api/adminPanel.ts: 487 -> 491 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/worker/api/deliveryChange.ts: 408 -> 418 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/worker/api/deliveryExecution.ts: 489 -> 618 (WATCH)
file-size-ratchet: REANCHORED (documented) apps/prototype-web/worker/api/marketReview.ts: 454 -> 568 (WATCH)
file-size-ratchet: REANCHORED (documented) scripts/check-application-readwrite.mjs: 370 -> 374 (NORMAL)
file-size-ratchet: REANCHORED (documented) scripts/check-doc-index-coverage.mjs: 148 -> 176 (NORMAL)
file-size-ratchet: REANCHORED (documented) scripts/check-entity-touchpoints.mjs: 249 -> 254 (NORMAL)
file-size-ratchet: REANCHORED (documented) scripts/check-image-policy.mjs: 164 -> 180 (NORMAL)
file-size-ratchet: REANCHORED (documented) scripts/check-module-boundaries.mjs: 822 -> 840 (SPLIT_CANDIDATE)
file-size-ratchet: REANCHORED (documented) scripts/check-secrets.mjs: 204 -> 213 (NORMAL)
file-size-ratchet: REANCHORED (documented) scripts/ci-audit-check.mjs: 214 -> 244 (NORMAL)
file-size-ratchet: REANCHORED (documented) scripts/generate-test-map.mjs: 291 -> 346 (NORMAL)
file-size-ratchet: REANCHORED (documented) scripts/operations-control/generate_tracker.py: 195 -> 199 (NORMAL)
file-size-ratchet: REANCHORED (documented) scripts/operations-control/test_operations_control.py: 99 -> 106 (NORMAL)
file-size-ratchet: REANCHORED (documented) scripts/operations-control/validate.py: 368 -> 377 (NORMAL)
file-size-ratchet: REANCHORED (documented) scripts/security/scan-git-history-secrets.mjs: 303 -> 458 (WATCH)
file-size-ratchet: REANCHORED (documented) scripts/ui-application-import-baseline.json: 72 -> 75 (NORMAL)
file-size-ratchet: REANCHORED (documented) scripts/vendored-braces-baseline.json: 51 -> 54 (NORMAL)
file-size-ratchet: REANCHORED (documented) src/domain/asset/policies.ts: 349 -> 438 (WATCH)
file-size-ratchet: REANCHORED (documented) src/domain/asset/types.ts: 118 -> 147 (NORMAL)
file-size-ratchet: REANCHORED (documented) src/domain/cash-continuity/index.ts: 2 -> 4 (NORMAL)
file-size-ratchet: REANCHORED (documented) src/domain/cash-continuity/policies.ts: 119 -> 133 (NORMAL)
file-size-ratchet: REANCHORED (documented) src/domain/cash-continuity/types.ts: 100 -> 132 (NORMAL)
file-size-ratchet: REANCHORED (documented) src/domain/craft-order/deliveryTermsValidation.ts: 81 -> 106 (NORMAL)
file-size-ratchet: REANCHORED (documented) src/domain/craft-order/index.ts: 52 -> 62 (NORMAL)
file-size-ratchet: REANCHORED (documented) src/domain/direct-sale/index.ts: 2 -> 3 (NORMAL)
file-size-ratchet: REANCHORED (documented) src/domain/direct-sale/policies.ts: 182 -> 360 (NORMAL)
file-size-ratchet: REANCHORED (documented) src/domain/direct-sale/types.ts: 77 -> 181 (NORMAL)
file-size-ratchet: REANCHORED (documented) src/domain/financial-event/index.ts: 10 -> 11 (NORMAL)
file-size-ratchet: REANCHORED (documented) src/domain/financial-event/policies.ts: 521 -> 539 (WATCH)
file-size-ratchet: REANCHORED (documented) src/domain/financial-event/types.ts: 148 -> 155 (NORMAL)
file-size-ratchet: REANCHORED (documented) src/domain/inventory-material/policies.ts: 334 -> 344 (NORMAL)
file-size-ratchet: REANCHORED (documented) src/domain/inventory-material/types.ts: 127 -> 138 (NORMAL)
file-size-ratchet: REANCHORED (documented) src/domain/planning/policies.ts: 561 -> 616 (WATCH)
file-size-ratchet: REANCHORED (documented) src/domain/shared/index.ts: 22 -> 51 (NORMAL)
file-size-ratchet: REANCHORED (documented) src/domain/supplier-purchase/index.ts: 2 -> 5 (NORMAL)
file-size-ratchet: REANCHORED (documented) src/domain/supplier-purchase/policies.ts: 281 -> 434 (WATCH)
file-size-ratchet: REANCHORED (documented) src/domain/supplier-purchase/types.ts: 115 -> 162 (NORMAL)
file-size-ratchet: PASS — 644 ملفًا مشمولًا (الأساس 514؛ انكماش 31؛ محذوف 14؛ إرساءات موثقة 193)؛ صفر نمو غير مبرر داخل الشريط أو عابره (R8-2/R8-F-005+F-006)؛ تراخيص الإرساء محسولة آليًا ضد شجرة OC (37 مرجعًا — F-028)
check-vendored-braces: scanned 13090 installed JS files for the braces@3.0.3 signature ("exceeds max characters")
check-vendored-braces: vendored copy — prettier@3.9.6 :: index.mjs
check-vendored-braces: vendored copy — rollup@4.62.4 :: dist/es/shared/watch.js
check-vendored-braces: vendored copy — rollup@4.62.4 :: dist/shared/index.js
check-vendored-braces: vendored copy — vite@7.3.7 :: dist/node/chunks/config.js
check-vendored-braces: PASS — 4 vendored copy/copies, exactly matching the documented baseline (documented upstream limitation — see docs/quality/vendored-braces-inventory.md; the graph-level elimination is guarded separately)
check-date-arithmetic-ownership: PASS — no Date.UTC in production; the Date object/Date.parse are kernel-file-only in the domain; no unguarded business-date slicing in any app layer (AST-bound ?? exemption, 4 approved sites); no localDateInAmman without an explicit instant; no ambient new Date() in the domain (R1–R6 clean).
application-door-surfaces: PASS — 34 بابًا (أي عمق) + 1 ملف جذر إنتاجيًا؛ الأسطح (قيمًا وأنواعًا) مطابقة للأساس المسجل؛ صفر توسيع/انكماش/برميل غير مرئي صامت (R5/S2 — PC-3/R0-N20)
application-readwrite: PASS — 18 ملف قارئ مسجلًا + 10 موسوم PC-4؛ صفر استدعاءات كتابة (save/commit/delete/replace/clear بأول حرف كبير)؛ القارئ لا يكتب حتميًا في حدود المفردات الموثقة (R5/S3 — F-08)؛ جسم القراءة خارج العائلات الخمس 80/80 ملفًا (راتشة عضوية+خاصية D-04 — R10A-F-019/OD-GUARD)
check-storage-listener-guards: PASS — 105 onsuccess listeners across 5 storage boundary files, all guarded (or documented exemptions: 2)
check-test-typecheck-coverage: PASS — 442 test files inside the app typecheck program (NF-020 part 2)
check-money-minor-casts: PASS — 507 ملف إنتاج مفحوصًا (خارج المناطق المعتمدة)؛ صفر تأكيدات داخلية إلى عائلة Minor (أساس 0)؛ صفر تأكيدات خارجية غير مصرحة؛ 13/13 موقع تضييق هوية as-number مطابقًا للأساس (D-02/OD-MONEY — MoneyMinor = number كما هو؛ W5 مغلقة بمحفزاتها)
application-ambient-time: PASS — 175 ملف إنتاج تطبيقي؛ 25 منطقة ID-fallback معتمدة فيها 25 نداء Date.now() معفى؛ 3 تحليلًا صريحًا (مسموح)؛ منفذ الساعة الموثق 1 موقعًا؛ صفر قراءة ساعة غير عائلية (ratشة OD-TIME على جرد 25 موقعًا: 21 شكل-أ + 4 شكل-ب — تصحيح مؤرخ 2026-11-22 DOC-041/WS-251)
diagnostics-storage: PASS — 436 ملف إنتاج زُرع؛ صفر وصول غير مسجل لمفاتيح تخزين المتصفح؛ الموضع المسجل الوحيد بالضبط: مهايئ التشخيص (apps/prototype-web/client/src/storage/diagnostics/browserDiagnosticStorage.ts — R11-W1A-NF-001)؛ الاستثناء التراثي للمسودات أُزيل بتقاعد ARCH-012 (2026-10-15)؛ والمهايئ نظيف من منفذ التخزين المالية/المحلية (فصل الحدود سارٍ)
label-vocabulary: PASS — 45 تسمية دومين كنونية؛ 436 ملف إنتاج زُرع؛ 34 مدخلًا مثبتًا مصنفًا يغطي 40 موضعًا حيًّا (owner-gated/variant — راتشة OD-LABEL: التكرار الجديد يُرفض حتى يصنف)؛ مستهلك طبقة التطبيق الوحيد المحايد (agreementPresentation) يستهلك fieldLabelAr من الدومين
a11y-dialog-surfaces: PASS — 436 ملف إنتاج زُرع؛ 10 سطحًا حواريًا مصنفًا (9 ملفًا يحمل تصريح حوار حيًا)؛ أي سطح حوار جديد يُرفض حتى يصنف في نفس الـPR (W4-0/OD-A11Y)؛ فخ التركيز قانوني للـTRUE_MODAL وحده
```

### `corepack pnpm test` (exit 0 — ٨٦ ملفًا / ١٠٤٠ اختبارًا)

```
 ✓ scripts/check-registry-coverage.test.mjs (4 tests) 278ms
 ✓ scripts/check-current-state-size.test.mjs (4 tests) 15ms
 ✓ scripts/check-agent-document-contract.test.mjs (4 tests) 27ms
 ✓ scripts/check-type-cycles.test.mjs (4 tests) 1319ms
 ✓ scripts/check-doc-index-coverage.test.mjs (3 tests) 49ms
 Test Files  86 passed (86)
      Tests  1040 passed (1040)
   Duration  75.12s (transform 1.28s, setup 0ms, import 6.52s, tests 58.80s, environment 7ms)
```

### `corepack pnpm typecheck` (exit 0)

```

> micro@0.1.0 typecheck /home/z/my-project/Micro
> tsc --noEmit

```

### `corepack pnpm lint` (exit 0 — تشديد إضافي)

```
✖ 35 problems (0 errors, 35 warnings)

```

### قياس راتشة الحجم للملف المعدَّل

```
check-module-boundaries.mjs nbLoc = 840 (السقف المرسى 840)
```

### فرز أسطر قيم الأسس في الـdiff (يثبت أن مصفوفات الأسس حرفية)

```
count=0
``` (صفر = لا سطر قيمة واحد تغيّر)
