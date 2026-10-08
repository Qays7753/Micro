# R3 — Storage Capability Extraction — Execution Report (2026-10-08)

**البرنامج:** `WS-216` / `ARCH-007` — successor البنيوي R0–R10.
**الموجة:** R3 — استخراج قدرات التخزين وإصلاح البوابة الكبيرة.
**الأساس:** `origin/main` = `b5a9ec3802abd603b5f372aed7dbd10e104a01bf` (بعد دمج R2: PR #330 @ `a0224d6` + مصالحته PR #331 @ `b5a9ec3`).
**الفرع:** `refactoring/r3-storage-capabilities-20261008`.
**العقد الحاكم:** `ZAI-STRUCTURAL-REMEDIATION-R0-R10-EXECUTION-CONTRACT-20261007.md` §R3 + `STRUCTURAL-REMEDIATION-PLAN-20261007.md` R3 + ADR-015 (النمط) + أمر المالك «Micro R2 Closure, D11/D13 Root Verification, and Full R3 Storage Execution» (2026-10-08).
**البطاقات:** `docs/operations/control/evidence/structural-remediation-r3-20261008/R3-REPAIR-CARDS.md` (R3-SC-00..19 + R3-N1..N7 — كُتبت قبل أي تغيير إنتاجي).

---

## 1. الملخص التنفيذي

نُفذت R3 **كاملة لا pilot**: جرد حي للمنفذ (130 طريقة بالضبط) وبطاقة لكل مجموعة، ثم استخراج **تسع قدرات جديدة** (53 طريقة) بنمط RC-7/ADR-015 المثبت (منفذ Pick مشتق + مراسي نوعية + عقد سلوك مزدوج المحوّل + هجرة المستهلكين)، مع **إكمال هجرة كل حاقن المنفذ الكامل** في طبقة التطبيق (48 → 2 فقط: خدمتا Transfer المحميتان بحدود R4). المجموع بعد الموجة: **16 قدرة مستخرجة تغطي 107 من 130 طريقة** (82%)؛ والباقي موثق ببطاقات KEEP/R4_BOUNDARY بأسباب وحدود نمو ومحفزات مراجعة. صفر تغيير مخطط/هجرة/تصدير/استيراد (38/30 كما هما)؛ الحراس التسعة ومعاني idempotency/CAS/storage_stale لم تُمس؛ صفر تغيير بصري UI؛ الاختبارات 2336/2336 تطبيقًا و681/681 جذريًا؛ الميزانية تحت السقوف (الدخول مطابق لما قبل الموجة بالبايت — التغييرات نوعية فقط).

## 2. الجرد الحي (بطاقة R3-SC-00)

- **المنفذ:** `PrototypeLocalStore` في `storage/local/types.ts:429-884` — **130 طريقة** (عدّ آلي؛ يطابق تصحيح R1/TG-01).
- **قبل الموجة:** 7 قدرات (54 طريقة): orderLifecycle، ownerEntitlement، loan، recurringExpense، expenseBudget، allocationPolicy، shortCashDeclaration؛ 48 حاقن منفذ كامل؛ 13 مستهلكًا ضيقًا.
- **بعد الموجة:** +9 قدرات (53 طريقة): financialEvent (5)، supplierPurchase (5)، directSale (3)، asset (4)، costEstimate (4)، inventoryMaterial (8)، schedule (9: جداول+تكرارات)، catalog (13)، actualTime (2) = **16 قدرة / 107 طريقة**؛ حاقنو المنفذ الكامل: **2 فقط** (خدمتا Transfer — R4_BOUNDARY موثقة R3-SC-16).

## 3. التنفيذ حسب الشريحة (كل شريحة commit مستقل قابل للرجوع)

| الشريحة | Commit | المحتوى |
|---|---|---|
| S0 البطاقات | (الأول على الفرع) | الجرد + R3-SC-00..19 + R3-N1..7 قبل أي كود |
| S1 الأحداث المالية | `4dbb09a` سابقًا ضمن التسلسل | financialEventStore + مراسي + عقد مزدوج + هجرة الكاتب (ProjectFinancialEventWritesStore) + تنظيف الاستيراد الميت (R3-N4) |
| S2 مشتريات المورّد | — | supplierPurchaseStore (5) + عقد (التزام HIGH-001 حتمي، الدفعة، attribution G-002) + هجرة الخدمة |
| S3 البيع المباشر | — | directSaleStore (3) + عقد (حفظ حتمي، عكس EXE-010 عبر مصنع النطاق بلا أثر مزدوج — يسد فجوة S4-FC-5) + هجرة الكاتبين |
| S4 الأصول | — | assetStore (4) + عقد (التزام حتمي بحدث مرتبط، تصحيح اقتناء ذرّي) + هجرة الخدمة |
| S5 تقديرات الطلب | — | costEstimateStore (4) + عقد (حفظ/قراءة/حذف حر حتمي) + هجرة المستهلك الوحيد |
| S6 المخزون | — | inventoryMaterialStore (8) + عقد (التزام ذرّي، تنشيط، نقص D-027) + هجرة عائلة الأخوة الست |
| S7 الجداول والتكرارات | — | scheduleStore (9) + عقد (إنشاء HIGH-001، تحديث بحدث واحد، تكرار ذرّي) + هجرة الكاتبين |
| S8 الكتالوج | — | catalogStore (13) + عقد (الأبعاد الثلاثة، مراجعة قالب محروسة) + هجرة الخدمتين |
| S9 الوقت الفعلي | — | actualTimeStore (2) + عقد + هجرة الخدمة + تضييق updateLocalPreferences لزوج التفضيلات |
| S10/S11 هجرة المستهلكين | `5758ca1` | **28 ملفًا**: كل حاقن المنفذ الكامل المتبقي أصبح نوعًا ضيقًا مُصدَّرًا (Pick بالضبط أو تركيبة قدرات)؛ تفاصيل §4 |
| R3-N2 | `f56dca3` | جناح IndexedDB للقراءة القديمة (D11) — النصوص التاريخية حرفية عبر محوّل الإنتاج أيضًا؛ prettier للملفات الملموسة |

(التسلسل الكامل بـ`git log main..HEAD`؛ رسائل الـcommit تحمل تفاصيل كل شريحة.)

## 4. خريطة هجرة المستهلكين (S10/S11)

كل خدمة تعلن عدستها المصدَّرة `<Service>Store`:

- **دورة حياة الطلب:** fulfillmentService (Pick 6 + تركيب ScheduleServiceStore لكونه ينشئ الأخ بمدخله)، deliveryReviewService (7: قراءة + التزاما التسليم وعكسه)، collectionReversalService (4)، collectionService (3).
- **بيت المالية:** projectFinancialReads (7 قراءات)، projectFinancialPeriodReads (6)، projectFinancialInsights (6)، projectFinancialService (اتحاد القراءات الثلاث + ProjectFinancialEventWritesStore)، periodComparisonService (تفويض للقارئ الكنوني)، profitToCashBridgeService (تركيب عبر القارئ + قراءتاه)، integrityCheckService/Model (اتحاد قراءات الفحوص الإحدى عشرة)، integrityCheckOffenderSummaries (7).
- **عابرو العائلات:** activityService (7 قراءات)، partyLedgerService (4)، homeControlCenterService (5)، dailyFollowUpService (2)، dueDatesService (1)، costService (1).
- **عائلات KEEP بعدساتها الدقيقة:** cashContinuityService (3)، walletLedgerService (2)، draftService (4)، formDraftService (5)، profileService/ownerProfileService/preferenceService (أزواج)، localLockService (3).
- **منسّقو العائلات:** inventoryMaterialService (اتحاد الأخوة)، والمنسّقون لا يرون شيئًا خارج احتياج أخويهم.
- **الباقي على المنفذ الكامل (موثق):** localTransferService + guidedOpeningImportService فقط — زوج اللقطة المحمي (R3-SC-16/R4_BOUNDARY؛ EXE-014 النسخة قبل الاستبدال).

## 5. مطابقة IndexedDB/Memory (الأدلة)

كل قدرة جديدة تحمل عقدًا ثلاثي الطبقات (`<cap>Capability.contract.test.ts`): (1) العضوية — المحوّلان يكشفان كل طريقة كدالة؛ (2) السلوك عبر العدسة الضيقة — نفس السيناريو على MemoryLocalStore وIndexedDbLocalStore (fake-indexeddb)؛ (3) المراسي النوعية زمن التشغيل (tsc بامتداد tsconfig الـapp). التسع الجديدة: 9 ملفات / 54 اختبارًا أخضر. مع أجنحة الموجات السابقة (adapterConformance الخمسة + عقود القدرات السبع القائمة) وجناح R3-N2، تغطي العدسة المزدوجة **كل طريقة قدرة مستخرجة (107)** فضلًا عن أجنحة الالتزام العميقة.

## 6. ما لم يتغير (حدود محمية)

- **Schema 38 / Export 30** (`types.ts:55/:71`) — لم يُمس الملف إنتاجيًا إطلاقًا في الموجة.
- **الحراس التسعة** — لا ملف حارس تغيّر؛ supplierScheduleCommitGuard بقي في ملفه المشترك (STR-306).
- **idempotency / CAS / storage_stale** — المعاني داخل المحوّلين كما هي؛ القدرات أنواع فقط لا تغلف النتائج (ممنوع التغليف — R3-SC-00 قيد).
- **types.ts** — لم يُشطر (بوابة Wave O)؛ القدرات ملفات Pick منفصلة؛ دورة النوع الوحيدة القائمة كما هي (1 = الأساس المقبول).
- **transferSnapshotValidation.ts** — صفر أسطر أضيفت (قيد R3-N6؛ R4 يملكه).
- **UI/UX** — صفر تغيير بصري أو DOM أو تنقل؛ تغييرات أنواع وحقن فقط.
- **زوج اللقطة** — لم يُنشأ أي قدرة تعرضه؛ مستهلكاه كما كانا.

## 7. التصرفات النهائية للمجموعات (البطاقات)

| المجموعة | الطرق | التصرف | الأدلة |
|---|---|---|---|
| Order Lifecycle | 9 | EXTRACT_NOW (أُنجز: هجرة 31 مستهلكًا اكتملت) | R3-SC-01 |
| Owner Entitlement | 14 | KEEP (مكتملة سابقًا) | R3-SC-11 |
| Financial Events | 5 | EXTRACT_NOW (أُنجز) | R3-SC-02 |
| Supplier Purchases | 5 | EXTRACT_NOW (أُنجز) | R3-SC-03 |
| Direct Sales | 3 | EXTRACT_NOW (أُنجز) | R3-SC-04 |
| Assets | 4 | EXTRACT_NOW (أُنجز — عدسة المطابقة المطلوبة نفذت) | R3-SC-05 |
| Expense Budgets | 3 | KEEP (مكتملة) | R3-SC-12 |
| Cost Estimates | 4 | EXTRACT_NOW (أُنجز) | R3-SC-06 |
| Inventory/Materials | 8 | EXTRACT_NOW (أُنجز) | R3-SC-07 |
| Loans (+deposit class.) | 10 | KEEP (مكتملة) | R3-SC-13 |
| Recurring Expense | 10 | KEEP (مكتملة) | R3-SC-14 |
| Schedules+Recurrences | 9 | EXTRACT_NOW (أُنجز) | R3-SC-08 |
| Allocation / Short Cash | 4+4 | KEEP (استقلال مثبت) | R3-SC-15 |
| Catalog | 13 | EXTRACT_NOW (أُنجز) | R3-SC-09 |
| Actual Time | 2 | EXTRACT_NOW (أُنجز) | R3-SC-10 |
| Cash Continuity/Wallets | 3 | KEEP (استثناء موثق: مالك/سبب/حد نمو/محفز/شرط إزالة) | R3-SC-19 |
| Identity/Prefs/Security | 9 | KEEP (استثناء موثق كالسابق) | R3-SC-18 |
| Drafts+Form Drafts | 9 | KEEP (استثناء موثق) | R3-SC-17 |
| Backup/Snapshot/Transfer | 2 | R4_BOUNDARY (محمي) | R3-SC-16 |

**23 طريقة إضافية من المجموعات الكبيرة** (قراءات المزيج) تستهلك الآن عبر Pick موضعي — المنفذ الكامل لم يبق له إلا مستهلكا Transfer.

## 8. المكتشفات المرافقة ومصيرها

- **R3-N1 (ADR-015 يقول 15 والحي 14):** تصويب مؤرخ في ADR-015 (شريحة السجلات).
- **R3-N2 (قراءة قديمة عبر IndexedDB):** **نُفذ** — جناح مباشر أخضر.
- **R3-N3 (حرّاس بلا اختبار مباشر):** التزمت البطاقات؛ عقد directSale الجديد يغطي مسار العكس على المحوّلين (كان Memory-only — S4-FC-5)؛ اختبارات الحرّاس الأربعة المتبقية (expenseBudget/loan/receivedLoan/supplierAttribution وحدة مباشرة) تبقى التزامًا مستقبليًا موثقًا في البطاقة (لا يمس مطابقة القدرات).
- **R3-N4 (استيراد ميت):** **نُفذ** — أزيل مع شريحة الأحداث المالية.
- **R3-N5 (فرع R1 في محفزات CI):** بند مالك — لم يُمس.
- **R3-N6 (سقف transferSnapshotValidation):** **التزامًا** — صفر أسطر أضيفت للموجة كلها.
- **R3-N7 (تسمية مرسِ orderLifecycle):** نُفذ تجميليًا ضمن الشريحة (توحيد النمط).

## 9. الاختبارات والفحوص (الرأس النهائي)

(الأرقام الحرفية من التشغيل المحلي على الرأس النهائي للفرع — تُثبت في PR/CI)

- `pnpm --filter @micro/prototype-web test -- --run`: **319 ملفًا / 2336 اختبارًا — كلها PASS** (كان 310/2282؛ +9 ملفات قدرات / +54 اختبارًا).
- `pnpm --filter @micro/prototype-web test -- --run storage`: 40/244 PASS.
- `pnpm --filter @micro/prototype-web test -- --run adapterConformance`: 5/13 PASS.
- `pnpm test` (الجذري): 60 ملفًا / 681 اختبارًا PASS.
- `pnpm typecheck` + app tsc: صفر أخطاء.
- `pnpm lint`: 0 أخطاء / 35 تحذيرًا (السقف 37).
- `prettier --check`: نظيف.
- `node scripts/check-entity-touchpoints.mjs`: PASS.
- الحراس: module-boundaries (388 ملفًا، راتشة R6 كما هي 43 مفتاحًا/47 سجلًا)، file-size-ratchet (482 ملفًا، صفر تصعيد — ضُغطت عدسة profitToCashBridge لتبقى 398 سطرًا تحت شريط WATCH)، runtime-cycles (0)، type-cycles (1 = الأساس)، test-focus (379 ملفًا)، secrets (0)، date-ownership R1-R6، وكل الحراس الـ15.
- **الميزانية:** الدخول 629,344/154,644 (مطابق لما قبل الموجة — التغييرات نوعية تمحى بالبناء) تحت 650,000/155,300؛ lazy 102/1,414,601/434,725 وprecache 187/2,741,306 — تحسن غير مقفل (انضباط ADR-012).
- `git diff --check`: نظيف.

## 10. حدود الرجوع

كل شريحة commit مستقل يعود بـ`git revert` واحد بلا أثر بيانات (أنواع وحقن وتعريفات عقود فقط؛ لا هجرة ولا مخطط ولا سلوك محوّل). الموجة كاملة تعود بrevert سلسلة الشريحات بترتيبها المعكوس.

## 11. الحالة

- المخطط/التصدير 38/30 كما هما؛ لا تغيير مالي/تاريخي/أمان/صلاحية/UI.
- **R3_STORAGE_EXTRACTION_COMPLETE** على الفرع — في انتظار التدقيق العدائي النهائي وبوابة المالك (الدمج بتفويض منفصل كما اشترط أمر الموجة لهذه الجلسة).

*السجلات المكملة: بطاقات R3 (تنفيذ كل بطاقة)، ADR-015 (تصويب مؤرخ)، سجل الملكية (صفوف القدرات)، WS-216/ARCH-007 (JSON ثم Views)، current-state واللوق §147، worklog Entry 56.*
