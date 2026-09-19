# تقرير تنفيذ — الحزمة (أ) من إصلاحات السلامة قبل الـPilot (G-001/G-002/G-003/G-006)

**التاريخ (Asia/Amman):** 2026-09-20
**الوكيل:** ZAI / Super Z (جلسة تنفيذ مضبوطة بموجز مالك)
**Workstream:** WS-162 · **PR:** https://github.com/Qays7753/Micro/pull/190
**الفرع:** `fix/pre-pilot-safety-a-b` (مكدّسة من `main` مباشرة)

---

## 1. خط الأساس والحدود

| الحقل | القيمة |
|---|---|
| MICRO_BASE_SHA | `3702c90131472c7ebb117dc0d7d67cd96a47cfc6` (origin/main) |
| MICRO_BASE_CI_STATUS | SUCCESS — GitHub Actions «CI» على `3702c9013…` اكتمل 2026-09-19T20:41:31Z (مُتحقق حيًا عبر API) |
| MICRO_BASE_WORKTREE_STATUS | CLEAN (استنساخ نظيف؛ صفر PRs مفتوحة؛ صفر Claims نشطة) |
| PACKAGE_A_HEAD_SHA | `233861763598c64f9ee4d1f3fb46f5ffb04714fb` |
| PACKAGE_A_PR | https://github.com/Qays7753/Micro/pull/190 (#190) |
| PACKAGE_A_STATUS | PR_READY |
| PACKAGE_A_MERGE_SHA | NOT_MERGED (ALLOW_MICRO_MERGE غير مفعّل — لا دمج من هذه المهمة) |
| STARTED_AT_ASIA_AMMAN | 2026-09-20 00:21:52 +03 |

حد التنفيذ: `MICRO_BRANCH_PR_TRACKER_ONLY` — فروع وPRs وتقارير Micro فقط؛ لا push مباشر إلى `main`، لا دمج، لا حذف فروع، لا نشر، لا لمس Documents.

## 2. الملفات المتغيرة بالضبط (33 ملفًا)

**نطاق جديد (7):**
- `src/domain/inventory-material/policies.ts` (تعديل: دالتان نقيتان جديدتان)
- `apps/prototype-web/client/src/storage/local/orderCommitGuard.ts` (جديد)
- `apps/prototype-web/client/src/storage/local/supplierAttributionCommitGuard.ts` (جديد)
- `apps/prototype-web/client/src/application/finance/withdrawalWalletGuard.ts` (جديد)
- `apps/prototype-web/client/src/storage/local/orderCommitGuard.test.ts` (جديد — 7 اختبارات)
- `apps/prototype-web/client/src/application/fulfillment/orderWriteStaleResults.test.ts` (جديد — 9)
- `apps/prototype-web/client/src/application/fulfillment/deliveryReviewService.priorConsumption.test.ts` (جديد — 11)
- `apps/prototype-web/client/src/application/suppliers/supplierPurchaseService.attributionAtomicity.test.ts` (جديد — 12)
- `apps/prototype-web/client/src/application/finance/withdrawalWalletGuard.test.ts` (جديد — 13)

**نطاق معدّل (تنفيذ):**
- `apps/prototype-web/client/src/storage/local/types.ts` (الواجهة: `commitOrderUpdate` + `commitOrderDelivery(base,…)` + `commitSupplierPurchaseWithAttribution`)
- `apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.ts` (الالتزامان الجديدان + فحص القاعدة في `commitOrderDelivery`)
- `apps/prototype-web/client/src/storage/local/MemoryLocalStore.ts` (التوأم نفسه)
- `apps/prototype-web/client/src/application/fulfillment/fulfillmentService.ts` (persistGuarded لكل عمليات الكتابة)
- `apps/prototype-web/client/src/application/fulfillment/deliveryReviewService.ts` (G-001 عرضًا وحدَّ كتابة + G-003 قاعدة التسليم)
- `apps/prototype-web/client/src/application/agreements/agreementService.ts` (startExecution محروس)
- `apps/prototype-web/client/src/application/agreements/agreementContextService.ts` (سياق المتابعة محروس)
- `apps/prototype-web/client/src/application/suppliers/supplierPurchaseService.ts` (الالتزام الذرّي الموحد)
- `apps/prototype-web/client/src/application/finance/ownerEntitlementService.ts` (حرس السحب للدفتر)
- `apps/prototype-web/client/src/application/finance/projectFinancialService.ts` (حرس السحب لمسار الحدث + `sourceWalletId`)
- `apps/prototype-web/client/src/application/finance/integrityCheckService.ts` (MIC-17)
- `apps/prototype-web/client/src/pages/DeliveryReview.tsx` (عرض المستهلك سابقًا والمتبقي والتعبئة بالمتبقي)
- `apps/prototype-web/client/src/pages/OrderDetail.tsx` (بطاقة تعارض §31 بفعل إعادة القراءة)
- `apps/prototype-web/client/src/pages/OwnerWithdrawalEditor.tsx` و`pages/FinancialEventEditor.tsx` (تمرير `sourceWalletId`)
- `scripts/text-density-count.py` (سقف ToolsIntegrity 85→86 موثقًا في الملف نفسه — عنوان MIC-17 الإلزامي وحده؛ لا نصوص عرض جديدة)

**نطاق معدّل (اختبارات قائمة حُرّكت لمسارات الكتابة الجديدة — نفس السلوك المتوقع):**
`adapterConformance.group10.test.ts`، `IndexedDbLocalStore.delivery.test.ts`، `supplierScheduleStaleResults.test.ts` (مضاعف الفشل المحقون)، `G3Hardening.dom.test.tsx` (العدّ والإقحام عبر الالتزام الموحد)، `collectionService.test.ts` (حقن الفشل عبر `commitOrderUpdate`)، `ownerEntitlementService.test.ts` و`ownerCrossModelDuplicates.test.ts` و`ownerEntitlementTransfer.test.ts` (بذر رصيد افتتاحي للمحفظة — السحب فوق الرصيد يُرفع الآن)، `integrityCheckService.test.ts` (قائمة الفحوص + MIC-17).

**نطاق Tracker/تقارير:** `docs/operations/control/items/G-00{1,2,3,6}.json`، `workstreams/review/WS-162.json`، `generated/*` (Views + Excel + Meta معاد توليدها)، `reports/agent-report/2026-09-20_pre-pilot-safety-package-a/*`، `reports/agent-report/README.md`، `docs/operations/control/reports/index.json`، `docs/operations/current-state.md` (§41)، `docs/quality/pre-pilot-safety-package-a-qa-2026-09-20.md`.

## 3. كل Finding: السلوك قبل/بعد + السبب الجذري + قرار التنفيذ

### G-001 — فخ الاستهلاك المزدوج عند التسليم (P1)

- **قبل (CONFIRMED_CODE):** `buildReview` في `deliveryReviewService.ts` كان يقترح المخطط كاملًا من نسخة التكلفة مقابل المتاح الكلي للمادة (`summarizeMaterialInventory` بلا تصفية طلب) — استهلاك يدوي سابق مرتبط بنفس الطلب يُتجاهل، فيُستهلك مرتين أو يُختلق نقص كاذب؛ الصفحة تعبّئ بالمخطط كاملًا؛ حد الكتابة لم يكن يتحقق من المتبقي.
- **بعد:** دالتا نطاق نقيتان (`orderLinkedConsumptionMilli` بعقد ١٣ — استهلاك مرتبط بالطلب مع استبعاد المعكوس، و`remainingToConsumeMilli`)؛ الصف الجديد يفضح `alreadyConsumedForOrderMilli` و`remainingToConsumeMilli`، والاقتراح والنقص على المتبقي (`skip` عند اكتمال الاستهلاك المخطط)؛ حد الكتابة يرفض أي صف يتجاوز المتبقي برسالة بأرقام صادقة ولا يكتب شيئًا؛ الواجهة تعرض «مستهلك سابقًا لهذا الطلب / المتبقي» وتعبّئ بالمتبقي. بلا استهلاك سابق: المتبقي = المخطط حرفيًا (سلوك اليوم نفسه — مُختبر).
- **السبب الجذري:** اقتراح الكمية بُني على المخطط لا على «المخطط ناقص المنفذ فعليًا لهذا الطلب» (عقد ١٣ موجود لكن لم يُستهلك في مسار التسليم).
- **قرار التنفيذ:** الحارس على مستويين (عرض + حد كتابة) كما يطلب البند نفسه؛ لا قصّ صامت ولا تغيير تعريف إيراد/COGS — الحركات append-only والقيم من متوسط التحرك وقت الكتابة كما كان.

### G-002 — ذرية تخصيص دفعة المورد للمحفظة (P2)

- **قبل (CONFIRMED_CODE):** الدفعة تُحفظ بمعاملة أولى (`commitSupplierPurchase`) ثم التخصيص بمعاملة ثانية (`attributePaymentToWallet` → `commitCashContinuity`)؛ الفشل المتأخر يُبتلع في `attributionNote`؛ إعادة الإرسال تُرجع `reused` فتتخطى التخصيص إلى الأبد (البوابتان `!saved.value.reused` عند السطرين 231/289 قبل الإصلاح).
- **بعد:** التزام واحد ذرّي على المحوّلين `commitSupplierPurchaseWithAttribution` (شراء/دفعة + قيد التخصيص معًا أو لا شيء)؛ إعادة الاستخدام تحل التخصيص داخل المعاملة من الحقيقة المخزّنة (شفاء حتمي بمفتاح `:initial-attribute`/`:attribute`، والمبلغ والمحفظة والمصدر من الدفعة المخزّنة نفسها)؛ فحص قراءة-only جديد **MIC-17** يكشف أي دفعة موصولة بمحفظة بلا قيد تغطية مطابق (يشمل بقايا ما قبل الإصلاح)؛ فشل محقون آليًا لا يترك حالة نصفية.
- **السبب الجذري:** توزيع الكتابة على معاملتين + معاملة `reused` كمكتمل.
- **قرار التنفيذ:** الخيار المفضل في المواصفة (معاملة ذرّية واحدة) لأن النمط قائم في المستودع (commitOrderDelivery بخمسة مخازن)؛ الشفاء داخل المعاملة يغطي البقايا التاريخية دون سياسة جديدة.

### G-003 — حرس القراءة القديمة عند حفظ الطلب (P2)

- **قبل (CONFIRMED_CODE):** كل عمليات fulfillment/agreement/سياق الاتفاق تكتب عبر `saveOrder` (writeOne أعمى — آخر كاتب يفوز)؛ مسار التسليم يكتب الطلب بلا فحص القاعدة؛ `FulfillmentResult` لا يحمل `storage_stale` أصلًا.
- **بعد:** التزام محروس `commitOrderUpdate(base, next, keys)` على المحوّلين: مفتاح الحتمية أولًا (إعادة تشغيل = reused بلا كتابة)، ثم مطابقة السجل الحي للقاعدة المقروءة داخل حد الكتابة (أي تغيّر = `storage_stale` ولا يُكتب شيء)، ثم امتداد الأحداث حرفيًا (null ≡ undefined للبيانات القديمة)؛ `commitOrderDelivery` يتحقق القاعدة نفسها قبل أي put؛ الخدمات الثلاث تمر به؛ `OrderDetail` يعرض بطاقة تعارض §31 (role=alert + «أعد قراءة السجل الحي» + بقاء القيم غير المحفوظة)؛ Collect/DeliveryReview/AgreementEditor تعرض رسالة الحارس الحرفية.
- **السبب الجذري:** كتابة عمياء read-modify-write خارج أي حارس — نفس الثغرة التي أغلقتها المجموعة ٢/٣ للمورد/الموعد/العكس وتركت لمسارات الطلب العائلية (موثقة كتأجيل في todo.md القديم).
- **قرار التنفيذ:** نمط «القاعدة مقابل الحي» الكنوني نفسه (تماثل `previous*` في حارس المورد) — لا نمط جديد يُخترع ولا عدّاد أحداث هش.

### G-006 — توحيد حرس السحب بين مساري مال المالك (P3)

- **قبل (CONFIRMED_CODE):** مسار الدفتر (`recordMovement`) يتحقق وجود المحفظة فقط — سحب فوق الرصيد يجعلها سالبة بصمت (اختبارات قائمة كانت تكرّس ذلك بنجاح متوقع على رصيد صفري)؛ مسار الحدث يفحص التغطية بعد حفظ الحدث (`distributeUnallocated`) برسالة بلا المتاح.
- **بعد:** سياسة كنونية واحدة `evaluateWithdrawalWalletCoverage` (طبقة التطبيق، تُستورد من المسارين): المبلغ صحيح موجب → المحفظة موجودة → الرصيد يغطي، ورسالة الرفض تعرض **المتاح والمطلوب**؛ مسار الدفتر يرفض قبل أي كتابة (draw فقط — الإرجاع/التسويات تضيف للرصيد فلا تُحرس)؛ مسار الحدث يقبل `sourceWalletId` ويحرس قبل حفظ الحدث (الصفحتان تمررانه)؛ `distributeUnallocated` يبقى دفاعًا في العمق بعد الحفظ؛ السحب ما زال خارج مصاريف الفترة ونتيجتها (مُختبر على المسارين).
- **السبب الجذري:** حرسان منفصلان بمنطقين مختلفين لم يلتقيا عند سياسة واحدة.
- **قرار التنفيذ:** وحدة حرس واحدة مشتركة (لا نسختين) — يستوفي «سياسة/خدمة واحدة أو حرس كنوني واحد» حرفيًا.

## 4. الاختبارات والأوامر ونتائجها بالضبط

**اختبارات جديدة (52):**

| الملف | العدد | التغطية |
|---|---|---|
| `storage/local/orderCommitGuard.test.ts` | 7 | مفقود/مفتاح/قاعدة/إسقاط حدث/تغيير غلاف/التزام/قِدم بيانات |
| `application/fulfillment/orderWriteStaleResults.test.ts` | 9 | مساران متزامنان (فائز محفوظ)؛ إعادة مفتاح = reused؛ إعادة واعية تنجح؛ طلبات مستقلة لا تتعارض؛ مسار الاتفاق؛ تسليم بتحصيل متزامن = رفض بلا كتابة؛ بيانات قديمة؛ فشل تخزيني حقيقي؛ عبور استعادة |
| `application/fulfillment/deliveryReviewService.priorConsumption.test.ts` | 11 | كامل/جزئي/بلا استهلاك سابق/متعدد المواد/مختلط/بلا نقص كاذب/مخزون ناقص/معكوس مستبعد/رفض حد الكتابة بلا كتابة/تسليم المتبقي فقط/إعادة التشغيل/بلا تكلفة مزدوجة |
| `application/suppliers/supplierPurchaseService.attributionAtomicity.test.ts` | 12 | نقدي/آجل بدفعة محفظة/دفعة لاحقة/محافظ متعددة/محفظة غير موجودة/فشل محقون آلي (لا حالة نصفية)/شفاء بقايا تاريخية ثم MIC-17 PASS/نقر مزدوج متزامن/إعادة مفتاح بعد نجاح كامل/MIC-17 سليم/MIC-17 ناقص عمدًا/عبور تصدير-استعادة ثم كتابة |
| `application/finance/withdrawalWalletGuard.test.ts` | 13 | الحرس النقي (أقل/يساوي/أكثر/صفر/غير موجودة/مبالغ فاسدة/غير الموزع) + الدفتر (أقل/يساوي/أكثر بلا كتابة ثم محفظة أخرى/إعادة مفتاح/عكس يستعيد) + الحدث (فوق الرصيد بلا حدث/ضمن الرصيد/غير الموزع) + تكافؤ المسارين برسالة واحدة + إثبات خارج مصاريف الفترة |

**الأوامر ونتائجها:**

| الأمر | النتيجة |
|---|---|
| `pnpm check` | **نجاح من طرف إلى طرف** (خروج 0) — يشمل: operations-control tests + validate + typecheck (صفر أخطاء) + lint (ضمن سقف 37) + format:check + text-density (كل الأسطح ضمن السقوف) + design-guards + guards (أسرار 1577/0، تركيز، كيانات، دورات) + `pnpm test` **36 ملفًا / 404 اختبارات ناجحة** + `pnpm prototype:check` + `pnpm prototype:test` **228 ملفًا / 1611 اختبارًا ناجحة** + build + bundle budget **PASS (607,141 خام / 143,986 gzip تحت 650,000/155,000)** |
| `python3 scripts/operations-control/validate.py` | valid — 64 بندًا، 4 Workstreams، Claim نشط واحد (WS-162 IN_REVIEW) |
| `python3 scripts/operations-control/generate_tracker.py` + `--refresh-excel-meta` | Views + CSV + Excel + Meta معاد توليدها ومتطابقة |
| `node scripts/check-secrets.mjs` | PASS — 1577 ملفًا، صفر أنماط أسرار |
| `git diff --check` | نظيف |

**الفشل المحقون آلي (fault injection) لا إثبات متصفح حي** — تصنيفه NOT_EXECUTED للتحقق الحي (انظر §7).

## 5. بوابة قبول الحزمة (أ)

- [x] البنود الأربعة لها اختبارات مركزة (52 اختبارًا جديدًا) وكلها ناجحة.
- [x] الاختبارات القائمة ذات الصلة ناجحة (الإجمالي 1611+404 بعد تحرير 8 ملفات اختبار حُرّكت لمسارات الكتابة الجديدة بنفس التوقعات).
- [x] فحوص Micro الكاملة تمر (`pnpm check` خروج 0).
- [x] typecheck/lint/format/build/ميزانية الحزمة/حراس البنية/فحص الأسرار/فحص التركيز كلها ناجحة.
- [x] **NO_SCHEMA_OR_EXPORT_CHANGE** — `localSchemaVersion=35` و`localExportVersion=27` كما هما؛ لا مخزن جديد ولا شكل سجل ولا ترحيل (الشفاء يكتب قيد `CashContinuityEntry` عاديًا)؛ `persistent-entity-touchpoints.json` لم يُمس (لا كيان دائم جديد).
- [x] لا تغيير خارج النطاق المسموح (قائمة الملفات أعلاه حصرية).
- [x] Tracker JSON صالح والـViews متطابقة (validator ناجح).
- [x] هذا التقرير وملف نتائج الاختبارات (`test-results.md`) موجودان داخل Micro.
- [x] PR #190 مفتوح بقائمة ملفات وأوامر وSHAs وقيود دقيقة.

استُثني واحد موثق: سقف كثافة النص ToolsIntegrity **85→86** (تعليق موثق داخل `scripts/text-density-count.py`): عنوان MIC-17 «تخصيص محافظ دفعات الموردين» يدخل سجل الفحوص الإلزامي الذي تطلبه مواصفة G-002 نفسها — رفع بواحد فقط، بلا نصوص عرض جديدة (كل نصوص MIC-17 الأخرى قوالب لحظة-فعل أو مُقحمة فلا تُحتسب)، بنمط السابقات الموثقة كل إضافة فحص (MIC-8/المجموعة ٤/المجموعة ٥).

## 6. أثر المخطط/التصدير

**NO_SCHEMA_OR_EXPORT_CHANGE** — السبب: كل الإصلاحات فوق المخازن والسجلات القائمة (طلب، مشتريات مورد، قيود استمرارية الكاش، حركات المخزون)؛ الشفاء يكتب قيدًا عاديًا بمفتاح حتمي في مخزن قائم؛ اختبارات عبور الاستعادة (replaceSnapshot ثم كتابة ناجحة، وعبور زوج الشراء/التخصيص) ضمن الحزمة.

## 7. QA حي — NOT_EXECUTED

| البند | الحالة |
|---|---|
| متصفح حي (مسارات/عرض/بيانات/كونسول) | **NOT_EXECUTED** — لا بيئة متصفح حية في جلسة التنفيذ هذه؛ كل اختبارات DOM ضمن `pnpm check` تعمل عبر jsdom وخدمات حقيقية فوق مخزن الذاكرة (وfake-indexeddb في اختبارات المحوّلات) |
| جهاز فعلي | NOT_EXECUTED (كما في بيئة الموجة 4.4: REAL_DEVICE_QA_NOT_PERFORMED) |
| الأثر | رسائل الحارس وعرض الصفوف مغطاة نصيًا في اختبارات DOM/خدمة؛ التحقق الحي يبقى للمراجعة أو بيئة المالك |

سجل QA موجز: `docs/quality/pre-pilot-safety-package-a-qa-2026-09-20.md`.

## 8. تغييرات التراكر وأدلة الانتقال

- `G-001/G-002/G-003/G-006`: `REVIEW_REQUIRED` → `IN_PROGRESS` (actor `claim:ws-162`, 2026-09-20) → `IN_REVIEW` (actor `pr:190`, 2026-09-20) — داخل PR #190 نفسه مع إعادة توليد Views/Excel/Meta.
- `WS-162`: CLAIMED → IN_REVIEW (pr: 190)؛ الحزمة ب (G-004/G-005) ستفتح Claimًا مستقلًا WS-163 من رأس هذه الحزمة بمناطق/عقود منفصلة.
- لا `VERIFIED` ولا `MERGED_UNVERIFIED` — لا دمج في هذه المهمة (ALLOW_MICRO_MERGE غير مفعّل).
- `todo.md` لم يُمس عمدًا (منظر توافق مجمد بقرار PR #188؛ تحديثه من مسار الدمج).

## 9. قيود ومعرفة تاريخية لم تُعَد

- تقرير التدقيق الخارجي (مستودع Documents) **لم يُقرأ ولم يُعدّل ولم يُرفع إليه شيء** — خارج نطاق المهمة؛ الاكتشافات مقيمة من بنود التراكر الكنونية (`finding_state: CONFIRMED`) ومن الكود الحي — كل السلوكيات «قبل» أعلاه **CONFIRMED_CODE** على `3702c90`، والقصص الحية للمستخدم **HISTORICAL_EVIDENCE** (أصل التدقيق) وأعراضها التشغيلية **CONFIRMED_LIVE** استنتاجًا من الكود.
- عكس دفعة مورد مرتبطة بمحفظة لا يعكس تخصيص محفظتها اليوم (سلوك قائم موثق؛ قرار مرآة العكس للمالك وحده) — MIC-17 يحتسب المرتجع في المتوقع كي لا يزيف إنذارًا كاذبًا، والقرار موثق للمالك.
- حارس تغطية المحفظة لدفعة المورد يبقى قبل الكتابة في الخدمة (بماطيل `commitOrderDelivery` السابق) — سباق نظري داخل المعاملة موثق في الاختبارات.
- سقف lint الفعلي 37 والتحذيرات ضمنه؛ البناء 607,141/143,986 ضمن الميزانية.

## 10. حدود المهمة — تأكيدات

- **MICRO_ONLY_SCOPE** — لم يُستنسخ مستودع Documents ولم يُقرأ ولم يُعدّل ولم يُرفع إليه شيء.
- لا Phase 2، لا UI/UX redesign (كل نصوص الواجهة الجديدة قوالب عرض دقيقة)، لا Pilot، لا تنظيف فروع، لا إعادة هيكلة، لا نشر/production، لا تغيير إعدادات/أذونات.
- لا push مباشر إلى `main`؛ لا دمج (PR #190 مفتوح فقط)؛ لا حذف فروع.
- **NO_TOKEN_STORED** — بيان الاعتماد لم يُطبع ولم يُخزَّن في أي ملف/سجل/التزام/تكوين Git داخل المستودع؛ فحص الأسرار نظيف (1577/0). *(التحقق الختامي بعد آخر push في القسم 12.)*

## 11. تسميات الحالة المستخدمة في هذا التقرير

`CONFIRMED_CODE` (كل جذور العيوب والمواقع على `3702c90`) · `CONFIRMED_LIVE` (استنتاج الأعراض التشغيلية) · `HISTORICAL_EVIDENCE` (أصل التدقيق الخارجي غير المقروء) · `NOT_EXECUTED` (QA الحي/الجهاز؛ حقن الفشل آلي لا حي) · `PR_READY` (الحزمة أ).

## 12. بعد آخر push

أُعيد التحقق: لا قيمة اعتماد في الملفات المتتبعة أو غير المتتبعة أو تكوين Git أو تاريخ الأوامر أو التقارير أو اللقطات — `NO_TOKEN_STORED`.
