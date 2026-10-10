# Micro — File Size and Responsibility Register

**الإصدار:** v1.5 (W6/عقد ما بعد المسح — استثناءات طويلة الأجل مقبولة كاملة الأركان للمحولين وسياسات الصنعة، 2026-10-05؛ v1.4 (إعادة قياس — شرائح عناقيد المالية — 2026-10-03)؛ تصحيح Wave E/ADR-016 (2026-10-04): حُذفت وحدة توافق finance/withdrawalWalletGuard.ts (مستوردها الوحيد غير-UI هاجر للبيت الأساس) — أول حذف موثق لوحدة توافق؛ الشيم 9→8؛ تصحيح Wave F/ADR-013 (2026-10-04): قُسّم integrityCheckService.ts داخليًا (1,430 SPLIT_NOW → مُنسِّق 180 NORMAL + 8 ملفات أشقاء في البيت المالي نفسه: integrityCheckModel 149 NORMAL، integrityCheckCoreFinance 430 WATCH [عائلة المجموعة ١: MIC-1/2/4/7/9]، integrityCheckInventory 128 NORMAL [MIC-8]، integrityCheckAssetsLoans 400 WATCH [عائلة عقد ٢٩: MIC-10..13]، integrityCheckContinuity 111 NORMAL [MIC-14..16]، integrityCheckSupplierWallet 65 NORMAL [MIC-17]، integrityCheckSettlementBasis 24 NORMAL [MIC-18 — الاستيراد العميق الموثق STR-205 انتقل معه]، integrityCheckOffenderSummaries 112 NORMAL) — نقل حرفي بلا تغيير دلالة؛ WATCH = مراقبة نمو العائلة وفق زناد مراجعة ADR-013 (أي فحص MIC جديد)؛ أساس الراتشة حُدّث بالتعدادات الحية في نفس الـPR؛ إعادة القياس الشاملة عند رأس الموجة التالي؛ تصحيح Wave F شريحة 2/ADR-013 عنقود ٣ (2026-10-04): قُسّم projectFinancialService.ts داخليًا (1,503 SPLIT_NOW → مُنسِّق 132 NORMAL + 5 أشقاء: projectFinancialTypes 288 NORMAL [أُكمل البيت الورقي بأنواع السطح كلها]، projectFinancialReads 213 NORMAL [المركز والقوائم]، projectFinancialPeriodReads 407 WATCH [عائلة نتيجة الفترة واشتقاق COGS]، projectFinancialInsights 207 NORMAL [المؤشرات — الاستيراد العميق الموثق D-034 انتقل معها]، projectFinancialEventWrites 513 WATCH [مسار الكتابة المحروس + توزيع PA-002 بترتيبه الأصلي]) — نقل حرفي بلا تغيير صيغة/تقريب/تصنيف؛ ورفيق الشريحة (STR-608): تكثيف هامش GZIP — مفردات رسائل resultCodes + معين errorMessageOf لـ105 مواقع النمط الملتقط + ثوابت الملف الواحد — الحزمة 630,886/154,787 (كانت 641,360/154,817 — هامش GZIP 213 بايتًا بعد جولتَي التكثيف؛ أي موجة تمس الحزمة تقيس قبل الدفع وفق ADR-012)؛ تصحيح Wave F شريحة ٣/ADR-014 + بوابة سياسة الحزمة ADR-017 (2026-10-04): قُسّم inventoryMaterialService.ts داخليًا (1,428 SPLIT_NOW → مُنسّق 181 NORMAL + 7 أشقاء في البيت نفسه: model 258 N، reads 305 N، activation 78 N، lifecycle 238 N، writes 269 N، waste 159 N، shortages 161 N — كلها دون WATCH وفق شرط ADR-014) وروافد التكثيف R1/R2 أوصلت الحزمة إلى 630,510/155,088؛ وبقرار المالك الموثق (ADR-017) اشتُق سقف gzip البرنامجي 155,300 من أعلى معدل مقاس (0.2108 بايت/سطر) على المجمع الإنتاجي المتبقي المحدود وصُنّف transferFamilyValidators.ts **PRESERVE** (إبقاء موثق — بطاقة الملف أدناه) فأغلقت شريحة ٣ تحت السقف المشتق بهامش 212 بايتًا؛ لا رفع لاحق في البرنامج
**النطاق:** كل ملف كود إنتاجي/اختبار/سكربت/مولّد/fixture/إعداد متتبَّع في المستودع عند الرأس أدناه
**رأس القياس:** `4a4e317ff10e87ecc07e3f16c890e9c52ef4010b` (branch `refactoring/remediation-program-20261003`) — قياس v1.0 الأول كان عند `a59eeb1546a7323ecfe720e4ce9a77f178474fb6` (فرع تقرير PR #299) *(تصحيح مؤرخ 2026-10-09 — R6-W1 [R6-SCAN-F-002]: رأس المصالحة الحالية `fd92d7e8812726dcca8d27d3ad64c8f24dc96abd` بعد دمج PR #337 — إعادة إصدار §1 وإضافة صفوف الأشقاء الأربعة وملاحظات النمو المؤرخة تمت عنده؛ قيم الصفوف الفردية تبقى تاريخية عند رؤوسها الموثقة إلا ما حمل ملاحظة مؤرخة، وإعادة القياس الشامل الكاملة تبقى التزامًا عند كل رأس موجة يغيّر بنية الملفات وفق §6)*
**الغرض:** سجل تنقّل وتحكم نمو — ليس مصدر سياسة ثانيًا؛ يربط إلى المصادر السلطوية ولا يعيد صياغة قواعدها.

> **منهجية التصنيف:** الفئات (production/test/script/generated/fixture/config) تُستخرج من المسار وأنماط الأسماء؛ الأحجام مقيسة على الشجرة الحية؛ المستهلكون من رسم الاستيراد AST (651 ملفًا) + grep للأسماء للسكربتات/الإعدادات؛ التغطية الاختبارية من استيرادات ملفات الاختبار. الأشرطة إشارة مراجعة لا أمر تقسيم آلي (PLAN-A-TO-Z §7.3). الملفات دون إشارات خاصة تحمل الحقول العامة من المنهجية: المسؤولية = الدور الطبقي للمسار، سبب التغيير = شريط النمو/الإجراء، أثر الرجوع = حسب الطبقة (domain/storage=HIGH، اختبار/مولّد=LOW، الباقي=MEDIUM).

> **تصحيح مؤرخ 2026-10-07 — R1/TG-01 [R0-N6]:** كل إشارة إلى «بطاقات الفجوة» في صفوف هذا الجرد (13 إشارة حية بمقياس `grep -c "بطاقات الفجوة"`؛ قياس R0 قدّرها 15) هي **وعد معلق أُنشئ قبل خريطة G2** ولم يُستكمل: لا يوجد مستند بطاقات فجوة في المستودع. الدليل الفعلي الحالي لتغطية كل صفحة/سطح هو **خريطة الاختبارات والتوثيق المولدة** (`TEST-AND-DOCUMENTATION-MAP.md` + `generated/test-map.json` بفحص انجراف زمن CI المحلي) — تصنيف الدليل (direct/named-reference) وأدلته هما المرجع؛ واستكمال بطاقات فجوة صريحة للملفات ذات الاختبارات الصفرية مجدول في موجة R9. تُقرأ الإشارات التاريخية في الصفوف على هذا الأساس ولا تُحرر فرديًا.

> **استثناءات موثقة (خارج جدول الصفوف):** ملفات `docs/**` التوثيقية غير السلطوية المسار تُحكم بفهرس الوثائق (`scripts/check-doc-index-coverage.mjs`) لا بهذا السجل (منع مصدر حقيقة ثانٍ)؛ الأصول الثنائية تحت `apps/prototype-web/client/public/**` (خطوط/صور/PWA) تُحكم بسياسة الصور والهوية البصرية (`scripts/check-image-policy.mjs`) — كلاهما مذكور هنا بالعد لا بالصفوف. عدد ملفات git المتتبعة الكلي عند رأس القياس = 1,323 (التاريخ: 1,262 عند قياس v1.0 ← 1,308 عند 4C ← 1,313 ← 1,318 ← 1,323)؛ منها 752 ملفًا داخل نطاق هذا السجل (كان 697 — دلتا الموجات موثقة في §7). *(تصحيح مؤرخ 2026-10-09 — R6-W1 [R6-SCAN-F-002]: عند رأس المصالحة `fd92d7e8` المتتبع = 1,551 (1,549 عند `43a0f12` + ملفَي أدلة R6 عبر PR #337) وصفوف §2 = **757** — 753 صفًا + 4 صفوف أشقاء Wave-F أضيفت بمصالحة R6-W1 (F-003)؛ الإضافات دون العتبة منذ رأس القياس (عائلات قدرات R3 وحراس R5 واختباراتها) تحكمها الراتشة (أساس حارٍ حتى R5/S4) وبروتوكول STR-607 نفس-الـPR وتُدرج صفًا عند إعادة القياس الشاملة القادمة — لا صمتًا بل بعدًا مؤرخًا؛ السلطة المرجعية لهذه المصالحة: تقرير مسح R6 المقبول `docs/operations/control/evidence/structural-remediation-r6-20261009/R6-PREFLIGHT-STRUCTURE-ARCHITECTURE-CODE-ORGANIZATION-SCAN-2026-10-09.md` §8)*

## 1. ملخص الأشرطة

| الشريط | العدد | المعنى |
|---|---:|---|
| NORMAL | 681 | لا إجراء حجمي بحد ذاته |
| WATCH | 47 | مراقبة النمو |
| SPLIT_CANDIDATE | 13 | خطة منع تضخم قبل إضافة نطاق |
| SPLIT_NOW | 9 | بطاقة ومستهلكون قبل أي نقل |
| PRESERVE | 3 | استثناء طويل الأجل مقبول كامل الأركان (بطاقة الملف) |
| LARGE_TEST | 4 | أصل اختبار كبير — لا يُحكم كإنتاجي |

**الفئات:** config=21، fixture=29، generated=7، production=343، script=20، test=337

*(تصحيح مؤرخ 2026-10-09 — R6-W1 [R6-SCAN-F-002]، من ← إلى: كان «NORMAL 681 / WATCH 42 / SPLIT_CANDIDATE 13 / SPLIT_NOW 12 / LARGE_TEST 4 (المجموع 752)؛ production=338» ← أصبح الجدول أعلاه (المجموع 757 صفًا؛ production=343). الأسباب الثلاثة الموثقة: (1) صف بيت recurring المنقول (D2) رفع §2 إلى 753 دون §1 (production 338←339)؛ (2) تصعيد profitToCashBridgeService المُؤرَّخ R5/S4 (398←402 nbLOC) صُحّح عموده إلى WATCH مطابقةً لأساس الراتشة الحاكم (NORMAL 682←681، WATCH 42←43)؛ (3) أُضيفت صفوف الأشقاء الأربعة WATCH لـWave F (F-003: EventWrites 443، CoreFinance 430، PeriodReads 422، AssetsLoans 400 — WATCH 43←47، production 339←343). «SPLIT_NOW 12» كانت اصطلاح عدّ (9 + 3 PRESERVE-band) والآن تُعرض صراحةً. التطابق الحي: WATCH 47 صفًا = 47 مفتاح WATCH في `scripts/file-size-ratchet-baseline.json` = الشجرة (تحقق R6-W1 بمقارنة تعداد مباشرة)؛ الملفات بحجم SPLIT_NOW فعلًا = 9 (صفوف Wave-F الثلاثة التاريخية صارت NORMAL حيةً). المصدر: تقرير مسح R6 §8 [F-002] + قياس R6-W1 الحي عند `fd92d7e8`.)*

## 2. جدول السجل (كل ملف داخل النطاق)

الأعمدة: المسار | الفئة | nbLOC (غير فارغ) | raw | bytes | exports | imports (ديناميكية) | مستهلكون | اختبارات مباشرة | الشريطة | المالك | الإجراء | إشارات (S=web-storage، D=DOM-listener، N=navigator، M=module-mutable، B=BroadcastChannel، O=module-singleton، •=barrel عام).

| path | cat | nb | raw | B | exp | imp | cons | tests | growth | owner | action | f |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|---|---|
| `apps/prototype-web/client/src/index.css` | production | 6778 | 6837 | 179128 | 0 | 0 | 1 | 0 | SPLIT_NOW | ui | UI_OUT_OF_SCOPE (design-token guards govern) | — |
| `apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.ts` | production | 4135 | 4139 | 170456 | 2 | 30 | 21 | 19 | PRESERVE | storage | **استثناء طويل الأجل مقبول (W6/عقد ما بعد المسح، 2026-10-05):** مسؤولية واحدة (تنفيذ المحول)؛ العائلة مقسمة سلفًا (Stores/Migrations/Lifecycle/Snapshot/Primitives + 10 حراس كتابة + 7 قدرات)؛ الحجم دالة اتساع المنفذ (131 طريقة *(تصحيح مؤرخ 2026-10-07 — R1/TG-01: الحي **130** بعد STR-618)* ) لا اختلاط مسؤوليات؛ النمو مجمد بالراتشة؛ التكافؤ مثبت (13/13 + 42/42)؛ المحفزات: مجموعة قدرة جديدة/ترحيل/عبور شريط؛ الشرط الخروجي: قرار مالك ب modularization المحولات | M |
| `apps/prototype-web/client/src/storage/local/MemoryLocalStore.ts` | production | 2091 | 2099 | 99357 | 1 | 25 | 180 | 178 | PRESERVE | storage | **استثناء طويل الأجل مقبول (W6/عقد ما بعد المسح، 2026-10-05):** المرآة الذاكرية بنفس أساس الاستثناء أعلاه — مسؤولية واحدة (إثبات قابلية استبدال المحول)؛ سيميائية مطابقة حرفيًا يثبتها 178 ملف اختبار مباشرًا ومصفوفة المطابقة؛ النمو مجمد بالراتشة؛ المحفزات والشرط الخروجي كما في المحول الرئيسي. *(مراجعة R4-A2 مؤرخة 2026-10-08: التصنيف الحي production/storage لا UI — تسليم صريح لموجة R6 المعتمدة: أي شطر حقيقي للمحول الذاكري يقرره R6 بقرار مالك؛ عناصر البطاقة التسعة كاملة في §810 — مالك/سبب/جرد/حد نمو/حارس/محفز/شرط خروج/اختبارات/حد رجوع)* | M |
| `apps/prototype-web/client/src/pages/OrderDetail.tsx` | production | 1814 | 1870 | 98681 | 1 | 28 | 12 | 11 | SPLIT_NOW | ui | **نُفذت الحزمة R6-F17-P01 (R7-2، 2026-10-10):** سطح استعلام تفصيل الطلب وقرارات أقسامه (الاتفاق/التسليم/التحصيل/التصحيحات) انتقل إلى `application/agreements/orderDetailViewModel.ts` — القراءة الرئيسية الصادقة (R1: error/not_found منفصلان) وسلسلة «المصدر: تقدير» ووجهات العربون ومقترحات الجهة وقرارات الأقسام النقية (ORD-002/Z2.2/D-031/S3-12/AV-07)؛ المرايا الـ13 المجمدة كما يحرسها W5-A لم تُمس (FROZEN_SURFACE ثابتة)؛ 11 ملف رحلات/اختبار مباشرًا خضراء (65 اختبارًا) + 6 اختبارات وحدة للنموذج | M |
| `apps/prototype-web/client/src/application/transfers/transferFamilyValidators.ts` | production | 1718 | 1733 | 76500 | 76 | 7 | 8 | 3 | SPLIT_NOW | application | **PRESERVE — إبقاء موثق (تصرّف ADR-017، 2026-10-04):** مسؤولية واحدة متماسكة (تدقيق أشكال حمولات الاستيراد — unknown→boolean بعقود حرفية)، المستهلكون الثمانية كلهم داخل بيت transfers، والحراس (مراسي الدريفت + التوصيف + سجل التوافق + الذهبيات) مسلَّمة وموثقة؛ جذر الخطر تكرار معرفة المجال (STR-104/509) والتقسيم لا يعالجه — العلاج المسمى هو استكمال 4D (استهلاك حرّي المجال) بقرار مالك لاحق؛ لا تقسيم هيكلي في هذا البرنامج، ومحفزات المراجعة وشروط إعادة فتح البطاقة في ADR-017 §3 *(ملاحظة نمو مؤرخة 2026-10-09 — R6-W1 [R6-SCAN-F-005]: الحي **1,730 nbLOC / 77,703 بايت** عند `fd92d7e8` — تجاوز تثبيت ADR-017 (1,718/76,500) بـ +12/+1,203 من التزامات R2 المؤرخة b890f9a2/388dac65/a476ed7a [تفويض نواة التاريخ المحلي] دون ملاحظة مؤرخة وقتها؛ النمو حميد والقرار قائم [F-013]؛ الراتشة تحرس حدود الأشرطة فقط لا التثبيت الدقيق — جملة «النمو مثبّت بالراتشة (1,718/76,500)» أعلاه صُحّحت بهذه الملاحظة، والإنفاذ ضد النمو غير المبرر داخل الشريط = حزمة R8 الموثقة في §7)* *(تصحيح مؤرخ 2026-10-09 — R6-W1 [R6-SCAN-F-007]: الاختبارات المباشرة الحية **4** لا 3 — أُضيف localDateVariantDivergence.characterization)* | M |
| `apps/prototype-web/client/src/pages/Finance.tsx` | production | 1477 | 1498 | 73773 | 1 | 38 | 16 | 15 | SPLIT_NOW | ui | **نُفذت الحزمة R6-F17-P02 (R7-1، 2026-10-10):** أنواع حالة المالية (FinanceState/FinanceBlockId/BridgeState/CashHorizonState) وقراء التجميع (safeBlock/monthBounds/readFinanceOverview/readProfitToCashBridge/readShortCashHorizonBlock) انتقلت إلى البيت التطبيقي `application/finance/financeState.ts` (منفذة + 9 اختبارات وحدة)؛ الأنواع عبر باب المالية (أنواع فقط — +4 إلى أساس الأبواب نفس-الـPR) والقراء باستيراد عميق موثق (+1 مفتاح أساس)؛ **الحافة النوعية مكوّن→صفحة (STR-204c/R6-SCAN-F-019) فُكت من جذرها**: FinancePeriodResultSection يستهلك الحالة من الباب — الدورة القيمية/النوعية المختلطة الوحيدة في الشجرة زالت (مسح الدورات: نوعي 1 = زوج التخزين الأساسي؛ تشغيلي 0)؛ المرايا: الملف ليس في أسرة F-049؛ الحد الأدنى للمحاسبة: 15 رحلة/ملف اختبار مباشرًا خضراء (73 اختبارًا) | M |
| `apps/prototype-web/client/src/application/finance/projectFinancialService.ts` | production | 1503 | 1518 | 80893 | 19 | 17+ | 115 | 94 | SPLIT_NOW | application | **قُسّم داخليًا (Wave F/ADR-013 عنقود ٣ — 2026-10-04):** القارئ الكنوني صار المُنسِّق (132 nbLOC NORMAL — عقد ٤٠ §8 هويةً وواجهة) وعائلات القراءة والكتابة انتقلت حرفيًا إلى 5 أشقاء في البيت نفسه (القيم في هذا الصف تاريخية عند رأس القياس؛ الأشرطة الحية في أساس الراتشة المحدّث نفس-الـPR)؛ لا صيغة ولا تقريب ولا تصنيف تحرّك | M |
| `apps/prototype-web/client/src/application/finance/integrityCheckService.ts` | production | 1430 | 1460 | 78503 | 8 | 12+ | 13 | 11 | SPLIT_NOW | application | **قُسّم داخليًا (Wave F/ADR-013 — 2026-10-04):** صار المُنسِّق وحده (180 nbLOC NORMAL — الحقن والترتيب والتقرير) وعائلات فحوص MIC انتقلت حرفيًا إلى 8 ملفات أشقاء في البيت نفسه (القيم في هذا الصف تاريخية عند رأس القياس؛ الأشرطة الحية في أساس الراتشة المحدّث نفس-الـPR)؛ لا تغيير دلالة ولا إقامة | M |
| `apps/prototype-web/client/src/application/inventory/inventoryMaterialService.ts` | production | 1428 | 1432 | 68300 | 24 | 5 | 68 | 56 | SPLIT_NOW | application | **قُسّم داخليًا (Wave F شريحة ٣/ADR-014 — 2026-10-04، تحت سقف ADR-017 المشتق):** الخدمة صارت منسّقًا رفيعًا (181 nbLOC NORMAL — تفويض رفيع بتوقيع الباني نفسه والصادرات الـ24 كلها معاد تصديرها حرفيًا من النموذج) + 7 أشقاء في البيت نفسه: model (258 NORMAL — أنواع السطح والمصنع)، reads (305 NORMAL — القراءات والاقتراحات)، activation (78 NORMAL)، lifecycle (240 NORMAL — التنشيط والدورة والقصور)، writes (269 NORMAL — الكتابات المحروسة)، waste (159 NORMAL — الهدر) (تصحيح عددي D1 من تدقيق Y — القيم الحية بعد تنقيحات R1/R2)، shortages (161 NORMAL)؛ رسم نجمي (الأشقاء → model فقط؛ الخدمة → الجميع؛ صفر دورات؛ صفر مستورد خارجي للأشقاء)؛ القيم في هذا الصف تاريخية عند رأس القياس، والأشرطة الحية في أساس الراتشة المحدّث نفس-الـPR (400 شريطًا) | M |
| `src/domain/craft-order/policies.ts` | production | 1399 | 1493 | 74026 | 30 | 3 | 3 | 0 | PRESERVE | domain | **استثناء طويل الأجل مقبول (W6/عقد ما بعد المسح، 2026-10-05):** وحدة سياسات مجال الصنعة — دلالة مجمّدة بعقود (02/10/12) وتوصيف حرفي (W2 لنصوص رسائلها) وحارس settlementInvariant؛ التقسيم خلط دلالي عالي الخطورة في أكثر ملف مالي حساسية بلا مكسب بنيوي (الفواصل الدلالية موثقة بالتعليقات)؛ المحفز: عبور الشريط أو موجة مالك مستقبلية بمدى exact؛ الشرط الخروجي: قرار مالك *(ملاحظة نمو مؤرخة 2026-10-09 — R6-W1 [R6-SCAN-F-004/F-006]: الحي **1,413** عند `fd92d7e8` — +14 من التزامات R2 الجذرية 94cfba77 [D11: نص المال الكنوني المُبقَى] و7fcf37d2 [نواة التاريخ المحلي] دون ملاحظة مؤرخة وقتها؛ نمو حميد والقرار قائم؛ جملة «النمو مجمد بالراتشة (1,399)» أعلاه صُحّحت بهذه الملاحظة؛ البطاقة مكتملة الأركان التسعة ومصالحة مع هذا الصف في §3)* | — |
| `apps/prototype-web/client/src/pages/FinancialEventEditor.tsx` | production | 1191 | 1206 | 57898 | 1 | 23 | 5 | 4 | SPLIT_NOW | ui | **نُفذت الحزمة R6-F17-P03 (R7-2، 2026-10-10):** قرار المحرر النقي (سياق المصروف المشترك/أساس ومعرفة الحصة/بوابة صلاحية المبلغ بفروعها/غرض المصروف المشترك/إكراه المسودة TR-11) انتقل إلى `application/finance/financialEventEditorModel.ts` بجوار قناة الكتابة (projectFinancialEventWrites)؛ عقد الإدخال الموجه ٢٧ ونصوصه كما هي عند الصفحة؛ 4 ملفات اختبار مباشرة خضراء (27 اختبارًا) + 14 اختبار وحدة للنموذج | M |
| `apps/prototype-web/client/src/application/transfers/transferSnapshotValidation.ts` | production | 1184 | 1185 | 55530 | 1 | 5 | 2 | 1 | SPLIT_CANDIDATE | application | **PRESERVE — إبقاء موثق (مراجعة R4-C2، 2026-10-08):** كان تصنيفه SPLIT_CANDIDATE بتوصيف مسبق «characterization first (Wave 3A)» — والتوصيف قائم الآن (أربعة ملفات characterization). مراجعة R4: الملف دالة واحدة `validateSnapshot` تجري لكل عائلة فحص الشكل (بتفويض مدققات العائلات) **وقواعد العلاقات المضمّنة** (المراجع/الأيتام/التفرّد/الطي) على مجموعة ~15 طقم معرّفات/مفاتيح مشترك عبر العائلات (orderIds تستهلكها actualTime، catalogIds تستهلكها orders/drafts، طيّ المخزون لكل مادة...) — فصل «قواعد العلاقات» يخيط الأطقم المشتركة بين وحدات لم يغير ملكية حقيقية (مستهلك واحد، سطح اختبار واحد) وهو شق آلي بالأقسام لا شق مسؤولية. محفزات إعادة الفتح: عائلة جديدة بملكية علاقات مستقلة، أو إتمام 4D الذي ينقل فحص الشكل للمجال ويعيد تقييم البنية؛ النمو محروس بالراتشة (1,184/55,530) | — |
| `apps/prototype-web/client/src/pages/SupplierPurchaseEditor.tsx` | production | 1157 | 1184 | 57934 | 1 | 22 | 6 | 5 | SPLIT_CANDIDATE | ui | **حزمة R7 صريحة R6-F17-P04 [R6-SCAN-F-017]:** مسار بنيوي موجه لحزمة R7 «UI structural boundaries» ببطاقة كاملة (owner/seam/نطاق/زناد/اعتماديات/قبول/رحلات/شرط خروج/رجوع/استبعاد بصري صريح) في §3 — لا عمل UI في R6؛ البصري track T حصرًا | M |
| `apps/prototype-web/client/src/pages/OwnerEntitlement.tsx` | production | 1133 | 1157 | 51692 | 1 | 17 | 2 | 1 | SPLIT_CANDIDATE | ui | **حزمة R7 صريحة R6-F17-P05 [R6-SCAN-F-017]:** مسار بنيوي موجه لحزمة R7 «UI structural boundaries» ببطاقة كاملة (owner/seam/نطاق/زناد/اعتماديات/قبول/رحلات/شرط خروج/رجوع/استبعاد بصري صريح) في §3 — لا عمل UI في R6؛ البصري track T حصرًا | M |
| `apps/prototype-web/client/src/application/owner-money/ownerEntitlementService.ts` | production | 1093 | 1109 | 51408 | 14 | 7 | 10 | 8 | SPLIT_CANDIDATE | application | SPLIT_CANDIDATE — cluster home settled in 4B; future slices per registry | — |
| `apps/prototype-web/client/src/pages/Schedule.tsx` | production | 1013 | 1035 | 40876 | 1 | 15+ | 2 | 1 | SPLIT_CANDIDATE | ui | **حزمة R7 صريحة R6-F17-P06 [R6-SCAN-F-017]:** مسار بنيوي موجه لحزمة R7 «UI structural boundaries» ببطاقة كاملة (owner/seam/نطاق/زناد/اعتماديات/قبول/رحلات/شرط خروج/رجوع/استبعاد بصري صريح) في §3 — لا عمل UI في R6؛ البصري track T حصرًا | M |
| `apps/prototype-web/client/src/pages/DirectSaleEditor.tsx` | production | 999 | 1022 | 49496 | 1 | 20 | 5 | 4 | SPLIT_CANDIDATE | ui | **نُفذت الحزمة R6-F17-P07 (R7-2، 2026-10-10):** قرار المحرر النقي (بوابة التحقق/قرار الفرق X-06/تعيين مرجع الوصلة العميقة/خريطة السجل المحمّل) انتقل إلى `application/direct-sales/directSaleEditorModel.ts`؛ مسار عكس التحصيل EXE-010 لم يُمس (مكوّن القسم وخدماته)؛ مرآتا F-049 (فرق/عرض) بقيتا مكانهما؛ 4 ملفات اختبار مباشرة خضراء (21 اختبارًا) + 11 اختبار وحدة للنموذج | M |
| `apps/prototype-web/client/src/pages/InventoryMovementEditor.tsx` | production | 965 | 973 | 46383 | 1 | 15 | 4 | 3 | SPLIT_CANDIDATE | ui | **حزمة R7 صريحة R6-F17-P08 [R6-SCAN-F-017]:** مسار بنيوي موجه لحزمة R7 «UI structural boundaries» ببطاقة كاملة (owner/seam/نطاق/زناد/اعتماديات/قبول/رحلات/شرط خروج/رجوع/استبعاد بصري صريح) في §3 — لا عمل UI في R6؛ البصري track T حصرًا | — |
| `src/domain/financial-analysis/policies.ts` | production | 937 | 976 | 43735 | 7 | 2 | 2 | 0 | SPLIT_CANDIDATE | domain | **PRESERVE — إبقاء موثق كامل الأركان (توحيد R6-W1، 2026-10-09 [R6-SCAN-F-012]):** أربعة عناقيد دلالية (سجلات التصريح/الهامش المباشر/التعادل/بيان السيولة القصيرة) لمستهلكَين اثنين دون استقلالية change-locality — البطاقة الكاملة بعناصرها التسعة في §3؛ لا تغيير دلالة مجال | — |
| `src/domain/owner-entitlement/policies.ts` | production | 906 | 934 | 38310 | 16 | 2 | 1 | 0 | SPLIT_CANDIDATE | domain | **PRESERVE — إبقاء موثق كامل الأركان (توحيد R6-W1، 2026-10-09 [R6-SCAN-F-012]):** ثلاثة عناقيد متماسكة لمجموع واحد (مصانع وعكسات/خمسة محركات حساب/مدققات تشغيلية يفوض إليها transfers) — البطاقة الكاملة بعناصرها التسعة في §3 *(نمو ضمن الشريط +8 موثق — R6-SCAN-F-006؛ انظر §7)* | — |
| `apps/prototype-web/client/src/storage/local/types.ts` | production | 877 | 885 | 51790 | 40 | 17 | 160 | 69 | SPLIT_CANDIDATE | storage | **PRESERVE — إبقاء موثق كامل الأركان (مصالحة R6-W1، 2026-10-09 [R6-SCAN-F-011]):** جرد منفذ Wave N سُلّم بتنفيذ R3 (130 طريقة/22 مجموعة قدرة) — البطاقة الكاملة بعناصرها التسعة في §3؛ أي شطر مستقبلي Schema-adjacent ومحمي بقرار Wave O | — |
| `apps/prototype-web/client/src/pages/InventoryMaterials.tsx` | production | 863 | 880 | 39799 | 1 | 15 | 6 | 5 | SPLIT_CANDIDATE | ui | **حزمة R7 صريحة R6-F17-P09 [R6-SCAN-F-017]:** مسار بنيوي موجه لحزمة R7 «UI structural boundaries» ببطاقة كاملة (owner/seam/نطاق/زناد/اعتماديات/قبول/رحلات/شرط خروج/رجوع/استبعاد بصري صريح) في §3 — لا عمل UI في R6؛ البصري track T حصرًا | M |
| `apps/prototype-web/client/src/components/finance/EventsLayer.tsx` | production | 100 | 101 | 5123 | 1 | 5 | 2 | 1 | NORMAL | ui | **نُفذت الحزمة R6-F17-P10 (R7-1، 2026-10-10):** فصل فعلي للمسؤوليات — منسّق الطبقة وحده هنا (10.6% → 100% من الملف)، وصف الحدث المتوازي (660+ سطرًا: eventLabel/expenseContextLabel/CorrectionMode/familyEventOwner/FinancialEventRow) انتقل حرفيًا إلى الشقيق `components/finance/FinancialEventRow.tsx` (نقلًا لا تعديلًا؛ ربح راتشة: SPLIT_CANDIDATE → NORMAL)؛ المستهلكون كما هم (Finance + group1Surfaces) | — |
| `apps/prototype-web/client/src/components/finance/FinancialEventRow.tsx` | production | 742 | 751 | 36264 | 3 | 13 | 1 | 1 | WATCH | ui | **صف الحدث المالي (R7-1/R6-F17-P10، 2026-10-10):** نقل حرفي من EventsLayer.tsx — مسؤولية واحدة (عرض صف الحدث وقنوات تصحيحه الثلاثية الموثقة D-05 ومسارات المالك FT-03)؛ مدخل أساس الراتشة WATCH في نفس الـPR (ملف جديد يدخل الشريط بقرار نمو مشروع موثق — إعادة تنظيم معتمدة لا نموًا صامتًا)؛ المستهلك الوحيد EventsLayer؛ الحارس: الراتشة + رحلات Finance*/group1Surfaces | — |
| `apps/prototype-web/client/src/pages/Statement.tsx` | production | 815 | 833 | 38464 | 1 | 17 | 3 | 2 | SPLIT_CANDIDATE | ui | **حزمة R7 صريحة R6-F17-P11 [R6-SCAN-F-017]:** مسار بنيوي موجه لحزمة R7 «UI structural boundaries» ببطاقة كاملة (owner/seam/نطاق/زناد/اعتماديات/قبول/رحلات/شرط خروج/رجوع/استبعاد بصري صريح) في §3 — لا عمل UI في R6؛ البصري track T حصرًا | M |
| `apps/prototype-web/client/src/pages/Catalog.tsx` | production | 787 | 813 | 34019 | 1 | 23 | 3 | 2 | WATCH | ui | WATCH — no unrelated responsibility without review | — |
| `apps/prototype-web/client/src/application/finance/recurringExpenseService.ts` | production | 12 | 12 | ~600 | 0 | 1 | 1 | 0 | NORMAL | application | **وحدة توافق (Wave E/ADR-013، 2026-10-04):** الملف الأصلي (784 nbLOC WATCH عند رأس القياس) انتقل إلى بيته `application/recurring/` بنمط 4B/#307؛ هذا كعب إعادة تصدير 12 سطرًا لمستهلكي الواجهة المجمدة — إزالته بشروط مسار UI الموثقة (تصحيح D2 من تدقيق Y — القيم الحية)؛ البيت الأساس أدناه | — |
| `apps/prototype-web/client/src/application/recurring/recurringExpenseService.ts` | production | 770 | 785 | ~37000 | 7 | 8 | 7 | 4 | WATCH | application | WATCH — بيت السلاسل المتكررة بعد نقل Wave E (تصحيح D2 من تدقيق Y — إضافة الصف المفقود للبيت المنقول؛ مبني على قياس v1.4 عند النقل + القياس الحي 770)؛ راتشة وشروط المراجعة كما في عنقود §3 | M |
| `apps/prototype-web/client/src/application/fulfillment/fulfillmentService.ts` | production | 740 | 762 | 40899 | 4 | 6 | 49 | 43 | WATCH | application | WATCH — no unrelated responsibility without review *(نمو ضمن الشريط +16 موثق بمصالحة R6-W1 — R6-SCAN-F-006؛ انظر §7)* | M |
| `apps/prototype-web/client/src/pages/Home.tsx` | production | 732 | 740 | 35559 | 1 | 11 | 7 | 6 | WATCH | ui | WATCH — no unrelated responsibility without review | M |
| `apps/prototype-web/client/src/pages/Settings.tsx` | production | 707 | 731 | 34524 | 1 | 24 | 5 | 4 | WATCH | ui | WATCH — no unrelated responsibility without review | M |
| `apps/prototype-web/client/src/application/fulfillment/deliveryReviewService.ts` | production | 706 | 732 | 35925 | 7 | 10 | 15 | 13 | WATCH | application | WATCH — no unrelated responsibility without review | M |
| `apps/prototype-web/client/src/application/finance/statementService.ts` | production | 669 | 692 | 33996 | 10 | 8 | 21 | 17 | WATCH | application | WATCH — no unrelated responsibility without review *(نمو ضمن الشريط +21 موثق بمصالحة R6-W1 — R6-SCAN-F-006؛ انظر §7)* | M |
| `apps/prototype-web/client/src/pages/AgreementEditor.tsx` | production | 652 | 657 | 30733 | 1 | 13 | 1 | 0 | WATCH | ui | WATCH — no unrelated responsibility without review | M |
| `apps/prototype-web/client/src/pages/CostEditor.tsx` | production | 640 | 657 | 28446 | 1 | 13 | 3 | 2 | WATCH | ui | WATCH — no unrelated responsibility without review | M |
| `apps/prototype-web/client/src/application/home/homeControlCenterService.ts` | production | 610 | 623 | 30481 | 2 | 12 | 10 | 9 | WATCH | application | WATCH — no unrelated responsibility without review *(نمو ضمن الشريط +7 موثق بمصالحة R6-W1 — R6-SCAN-F-006؛ انظر §7)* | — |
| `apps/prototype-web/client/src/pages/CostCalculator.tsx` | production | 604 | 629 | 25891 | 1 | 15 | 3 | 2 | WATCH | ui | WATCH — no unrelated responsibility without review | M |
| `src/domain/recurring-expense/policies.ts` | production | 603 | 647 | 28865 | 35 | 4 | 1 | 0 | WATCH | domain | WATCH — no unrelated responsibility without review | — |
| `apps/prototype-web/client/src/components/catalog/CatalogTemplatesSection.tsx` | production | 602 | 609 | 30092 | 2 | 10 | 1 | 0 | WATCH | ui | WATCH — no unrelated responsibility without review | — |
| `apps/prototype-web/client/src/components/finance/ExpenseBudgetsSectionBody.tsx` | production | 595 | 605 | 23212 | 2 | 10+ | 1 | 0 | WATCH | ui | WATCH — no unrelated responsibility without review | M |
| `apps/prototype-web/client/src/components/settings/SettingsDataProtectionSection.tsx` | production | 579 | 591 | 26926 | 2 | 13 | 1 | 0 | WATCH | ui | WATCH — no unrelated responsibility without review | — |
| `apps/prototype-web/client/src/pages/DeliveryReview.tsx` | production | 561 | 584 | 27211 | 1 | 14 | 3 | 2 | WATCH | ui | WATCH — no unrelated responsibility without review | M |
| `apps/prototype-web/client/src/pages/RecurringExpenseDetail.tsx` | production | 560 | 579 | 23756 | 2 | 11 | 2 | 1 | WATCH | ui | WATCH — no unrelated responsibility without review | M |
| `apps/prototype-web/client/src/storage/local/indexedDbMigrations.ts` | production | 560 | 564 | 26537 | 4 | 2 | 1 | 0 | WATCH | storage | WATCH — no unrelated responsibility without review | MO |
| `apps/prototype-web/client/src/application/finance/recurringWorkService.ts` | production | 557 | 564 | 26486 | 11 | 7 | 12 | 7 | WATCH | application | WATCH — no unrelated responsibility without review | M |
| `apps/prototype-web/client/src/application/financial-analysis/financialAnalysisService.ts` | production | 553 | 572 | 25414 | 10 | 11+ | 8 | 5 | WATCH | application | WATCH — no unrelated responsibility without review | M |
| `apps/prototype-web/client/src/application/activity/activityService.ts` | production | 531 | 557 | 23756 | 6 | 8 | 25 | 21 | WATCH | application | WATCH — no unrelated responsibility without review *(نمو ضمن الشريط +11 موثق بمصالحة R6-W1 — R6-SCAN-F-006؛ انظر §7)* | — |
| `apps/prototype-web/client/src/pages/DraftEditor.tsx` | production | 525 | 538 | 23906 | 1 | 12 | 3 | 2 | WATCH | ui | WATCH — no unrelated responsibility without review | M |
| `apps/prototype-web/client/src/pages/AssetDetail.tsx` | production | 524 | 546 | 25276 | 1 | 15 | 2 | 1 | WATCH | ui | WATCH — no unrelated responsibility without review | — |
| `src/domain/financial-event/policies.ts` | production | 524 | 541 | 28975 | 8 | 2 | 1 | 0 | WATCH | domain | WATCH — no unrelated responsibility without review | — |
| `apps/prototype-web/client/src/components/orders/OrderDepositPanels.tsx` | production | 523 | 531 | 26896 | 2 | 12 | 1 | 0 | WATCH | ui | WATCH — no unrelated responsibility without review | — |
| `apps/prototype-web/client/src/components/finance/FinancePeriodResultSection.tsx` | production | 497 | 502 | 23815 | 2 | 7 | 1 | 0 | WATCH | ui | WATCH — no unrelated responsibility without review | — |
| `apps/prototype-web/client/src/application/scheduling/scheduleService.ts` | production | 496 | 513 | 22008 | 7 | 4 | 36 | 28 | WATCH | application | WATCH — no unrelated responsibility without review | M |
| `apps/prototype-web/client/src/pages/Collect.tsx` | production | 493 | 510 | 23578 | 1 | 16 | 3 | 2 | WATCH | ui | WATCH — no unrelated responsibility without review | M |
| `apps/prototype-web/client/src/pages/MaterialEditor.tsx` | production | 491 | 499 | 22979 | 1 | 15 | 2 | 1 | WATCH | ui | WATCH — no unrelated responsibility without review | — |
| `apps/prototype-web/client/src/application/assets/assetService.ts` | production | 486 | 511 | 21991 | 11 | 4 | 35 | 32 | WATCH | application | WATCH — no unrelated responsibility without review *(نمو ضمن الشريط +15 موثق بمصالحة R6-W1 — R6-SCAN-F-006؛ انظر §7)* | — |
| `apps/prototype-web/client/src/components/finance/FinancePoliciesSection.tsx` | production | 485 | 496 | 23384 | 1 | 9 | 2 | 1 | WATCH | ui | WATCH — no unrelated responsibility without review | — |
| `apps/prototype-web/client/src/styles/primitives.css` | production | 482 | 494 | 14680 | 0 | 0 | 0 | 0 | WATCH | ui | WATCH — no unrelated responsibility without review | — |
| `apps/prototype-web/client/src/application/financial-records/correctionHistoryService.ts` | production | 458 | 481 | 26217 | 7 | 6 | 3 | 1 | WATCH | application | WATCH — band carried over on the move (ratchet baseline re-pathed in the same PR) *(نمو ضمن الشريط +29 موثق بمصالحة R6-W1 — R6-SCAN-F-006؛ انظر §7)* | — |
| `apps/prototype-web/client/src/components/owner/OwnerLedgerFormsSection.tsx` | production | 446 | 451 | 18877 | 2 | 9 | 1 | 0 | WATCH | ui | WATCH — no unrelated responsibility without review | — |
| `apps/prototype-web/client/src/application/finance/projectFinancialEventWrites.ts` | production | 443 | 451 | 26518 | 8 | 11 | 1 | 0 | WATCH | application | WATCH — مسار الكتابة المحروس لعائلة نتيجة الفترة + توزيع PA-002 (Wave F/ADR-013 عنقود ٣؛ انكمش 513←443)؛ محفز المراجعة: مسار كتابة محروس جديد أو عبور شريط؛ عائلة نجمية (الأشقاء→model فقط)؛ الاختبارات عبر واجهة المُنسّق *(صف R6-W1 [R6-SCAN-F-003] بقيمة حية عند `fd92d7e8`)* | — |
| `apps/prototype-web/client/src/pages/Orders.tsx` | production | 439 | 448 | 22110 | 1 | 15 | 3 | 2 | WATCH | ui | WATCH — no unrelated responsibility without review | M |
| `apps/prototype-web/client/src/pages/Setup.tsx` | production | 432 | 439 | 20049 | 1 | 8 | 2 | 1 | WATCH | ui | WATCH — no unrelated responsibility without review | M |
| `apps/prototype-web/client/src/storage/local/indexedDbSnapshot.ts` | production | 430 | 432 | 21907 | 2 | 18 | 1 | 0 | WATCH | storage | WATCH — no unrelated responsibility without review | — |
| `apps/prototype-web/client/src/application/finance/integrityCheckCoreFinance.ts` | production | 430 | 438 | 23726 | 5 | 5 | 1 | 0 | WATCH | application | WATCH — عائلة فحوص MIC المجموعة ١ (MIC-1/2/4/7/9، Wave F/ADR-013)؛ محفز ADR-013: أي فحص MIC جديد؛ عائلة نجمية؛ الاختبارات عبر واجهة المُنسّق *(صف R6-W1 [R6-SCAN-F-003] بقيمة حية عند `fd92d7e8`)* | — |
| `apps/prototype-web/client/src/components/presentation/ActualTimePanel.tsx` | production | 426 | 440 | 17477 | 1 | 9 | 3 | 1 | WATCH | ui | WATCH — no unrelated responsibility without review | M |
| `apps/prototype-web/client/src/application/catalog/catalogService.ts` | production | 425 | 445 | 21096 | 15 | 2 | 16 | 14 | WATCH | application | WATCH — no unrelated responsibility without review *(نمو ضمن الشريط +6 موثق بمصالحة R6-W1 — R6-SCAN-F-006؛ انظر §7)* | — |
| `apps/prototype-web/client/src/application/finance/periodComparisonService.ts` | production | 422 | 436 | 18113 | 6 | 6 | 3 | 2 | WATCH | application | WATCH — no unrelated responsibility without review *(نمو ضمن الشريط +11 موثق بمصالحة R6-W1 — R6-SCAN-F-006؛ انظر §7)* | — |
| `apps/prototype-web/client/src/application/finance/projectFinancialPeriodReads.ts` | production | 422 | 426 | 22116 | 2 | 9 | 1 | 0 | WATCH | application | WATCH — عائلة نتيجة الفترة واشتقاق COGS (Wave F/ADR-013 عنقود ٣؛ يسمّي ملكية derivePeriodCogs وفق STR-302/W2-D/D-034)؛ محفز المراجعة: قاعدة اشتقاق جديدة أو عبور شريط؛ عائلة نجمية؛ الاختبارات عبر واجهة المُنسّق *(صف R6-W1 [R6-SCAN-F-003] بقيمة حية عند `fd92d7e8`)* | — |
| `apps/prototype-web/client/src/application/suppliers/supplierPurchaseService.ts` | production | 421 | 434 | 21352 | 7 | 5 | 45 | 40 | WATCH | application | WATCH — no unrelated responsibility without review | — |
| `apps/prototype-web/client/src/application/finance/integrityCheckAssetsLoans.ts` | production | 400 | 404 | 22183 | 4 | 4 | 1 | 0 | WATCH | application | WATCH — عائلة عقد ٢٩: MIC-10..13 (Wave F/ADR-013)؛ محفز ADR-013: أي فحص MIC جديد؛ عائلة نجمية؛ الاختبارات عبر واجهة المُنسّق *(صف R6-W1 [R6-SCAN-F-003] بقيمة حية عند `fd92d7e8`)* | — |
| `src/domain/recurring-margin/policies.ts` | production | 399 | 414 | 17727 | 7 | 2 | 1 | 0 | NORMAL | domain | NORMAL | — |
| `apps/prototype-web/client/src/application/finance/profitToCashBridgeService.ts` | production | 392 | 407 | 22492 | 4 | 9 | 17 | 16 | WATCH | application | WATCH — مستقر عند 402 [R6-SCAN-F-016] | M *(تصعيد شريط مؤرخ 2026-10-09 — R5/S4: +5 أسطر nbLOC لعقد قراءة PC-4 الرباعي الموثق في الترويسة؛ 398→402 — تحديث أساس الراتشة نفس-الـPR بقرار البطاقة المسبق؛ لا تغيير سلوك)* *(تصحيح مؤرخ 2026-10-09 — R6-W1 [R6-SCAN-F-002]: عمود الشريط صُحّح NORMAL←WATCH مطابقةً لأساس الراتشة الحاكم والقيمة الحية 402؛ البطاقة كاملة في §3)* |
| `apps/prototype-web/client/src/components/owner/OwnerPolicyFormsSection.tsx` | production | 389 | 393 | 16414 | 2 | 9 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/pages/ReceivedLoanDetail.tsx` | production | 370 | 390 | 15632 | 1 | 14+ | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | M |
| `apps/prototype-web/client/src/pages/ScheduleEditor.tsx` | production | 363 | 370 | 15197 | 1 | 11 | 2 | 1 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | M |
| `apps/prototype-web/client/src/app/PrototypeServicesContext.tsx` | production | 360 | 367 | 21943 | 5 | 50+ | 158 | 86 | NORMAL | app-root | NORMAL | BM |
| `apps/prototype-web/client/src/application/transfers/guidedOpeningImportService.ts` | production | 359 | 370 | 16341 | 7 | 4 | 6 | 3 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/pages/AssetEditor.tsx` | production | 356 | 364 | 16717 | 1 | 14 | 2 | 1 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/components/finance/QuickSaleForm.tsx` | production | 355 | 363 | 16673 | 1 | 9 | 3 | 2 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/application/collections/saleCollectionReversalService.ts` | production | 352 | 367 | 16468 | 7 | 6 | 4 | 2 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/pages/OwnerWithdrawalEditor.tsx` | production | 351 | 360 | 18059 | 2 | 14 | 4 | 3 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | M |
| `apps/prototype-web/client/src/application/collections/collectionReversalService.ts` | production | 349 | 370 | 17967 | 6 | 5 | 12 | 10 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/pages/RecurringExpenseEditor.tsx` | production | 349 | 359 | 14813 | 1 | 12 | 2 | 1 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | M |
| `src/domain/asset/policies.ts` | production | 347 | 372 | 17685 | 15 | 3 | 1 | 0 | NORMAL | domain | NORMAL | M |
| `apps/prototype-web/client/src/application/transfers/transferSnapshotMigrations.ts` | production | 346 | 347 | 16170 | 1 | 2 | 3 | 2 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/application/budgets/expenseBudgetService.ts` | production | 345 | 370 | 18485 | 7 | 3 | 3 | 2 | NORMAL | application | NORMAL — mechanical move, tests moved with it | M |
| `apps/prototype-web/client/src/application/cash/cashContinuityService.ts` | production | 343 | 353 | 15558 | 9 | 2 | 71 | 61 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/pages/Loans.tsx` | production | 341 | 351 | 14440 | 1 | 13+ | 5 | 4 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | M |
| `apps/prototype-web/client/src/components/finance/G5DecisionPanel.tsx` | production | 340 | 347 | 13560 | 7 | 7+ | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/components/finance/QuickExpenseForm.tsx` | production | 336 | 345 | 16598 | 1 | 11 | 3 | 2 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | M |
| `apps/prototype-web/client/src/storage/local/supplierScheduleCommitGuard.ts` | production | 336 | 357 | 20226 | 7 | 2 | 6 | 1 | NORMAL | storage | NORMAL | — |
| `apps/prototype-web/client/src/components/layout/QuickActionSheet.tsx` | production | 335 | 350 | 15611 | 4 | 11 | 6 | 5 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `src/domain/inventory-material/policies.ts` | production | 331 | 338 | 18833 | 16 | 2 | 2 | 0 | NORMAL | domain | NORMAL | — |
| `apps/prototype-web/client/src/components/catalog/CatalogItemsSection.tsx` | production | 329 | 336 | 14741 | 2 | 8 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/pages/Foundation.tsx` | production | 328 | 336 | 15918 | 1 | 12 | 2 | 1 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | M |
| `apps/prototype-web/client/src/pages/Profile.tsx` | production | 326 | 340 | 12567 | 1 | 9 | 3 | 2 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | M |
| `apps/prototype-web/client/src/components/catalog/CatalogUnitsSection.tsx` | production | 319 | 324 | 13646 | 2 | 7 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/components/finance/RecurringConfirmPanel.tsx` | production | 316 | 325 | 13863 | 2 | 10 | 2 | 1 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | M |
| `apps/prototype-web/client/src/pages/LoanDetail.tsx` | production | 316 | 334 | 12803 | 1 | 13 | 2 | 1 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/pages/FinanceActivity.tsx` | production | 314 | 328 | 13030 | 1 | 12 | 3 | 2 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | M |
| `apps/prototype-web/client/src/components/layout/AppHeader.tsx` | production | 307 | 320 | 14587 | 1 | 4 | 4 | 3 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | DM |
| `apps/prototype-web/client/src/pages/CashWallets.tsx` | production | 306 | 316 | 13147 | 1 | 12 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | M |
| `apps/prototype-web/client/src/application/transfers/localTransferService.ts` | production | 305 | 315 | 15746 | 5 | 13 | 25 | 22 | NORMAL | application | PRESERVE + characterization (Wave 3A goldens) | — |
| `apps/prototype-web/client/src/application/scheduling/recurrenceService.ts` | production | 302 | 313 | 13180 | 6 | 3 | 6 | 4 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/pages/ToolsIntegrity.tsx` | production | 300 | 310 | 13922 | 1 | 11 | 5 | 4 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/application/loans/receivedLoanService.ts` | production | 294 | 310 | 13223 | 8 | 3 | 6 | 2 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/application/transfers/historical817.fixture.ts` | production | 290 | 306 | 8510 | 15 | 0 | 4 | 4 | NORMAL | application | FIXTURE — version with its consumers | — |
| `apps/prototype-web/client/src/components/forms/UnsavedChangesGuard.tsx` | production | 289 | 302 | 11257 | 9 | 3 | 83 | 54 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | D |
| `src/domain/supplier-purchase/policies.ts` | production | 278 | 289 | 15089 | 4 | 2 | 1 | 0 | NORMAL | domain | NORMAL | — |
| `apps/prototype-web/client/src/components/finance/CorrectionsLayer.tsx` | production | 277 | 285 | 12418 | 1 | 6 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/storage/local/deliveryReversalCommitGuard.ts` | production | 275 | 299 | 15743 | 6 | 3 | 3 | 1 | NORMAL | storage | NORMAL | — |
| `src/domain/craft-order/types.ts` | production | 275 | 300 | 13722 | 25 | 1 | 5 | 0 | NORMAL | domain | NORMAL | — |
| `apps/prototype-web/client/src/pages/FinanceMore.tsx` | production | 272 | 281 | 12337 | 1 | 5 | 2 | 1 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/pages/ReceivedLoanEditor.tsx` | production | 271 | 280 | 12291 | 1 | 14+ | 2 | 1 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | M |
| `apps/prototype-web/client/src/application/loans/loanService.ts` | production | 266 | 282 | 11815 | 8 | 3 | 36 | 32 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/pages/CashDistribution.tsx` | production | 265 | 274 | 13900 | 1 | 13 | 3 | 2 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | M |
| `apps/prototype-web/client/src/application/direct-sales/directSaleService.ts` | production | 264 | 277 | 13545 | 4 | 4 | 26 | 24 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/pages/FinanceUpcoming.tsx` | production | 261 | 273 | 11670 | 1 | 10 | 2 | 1 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | M |
| `src/domain/budget/policies.ts` | production | 261 | 278 | 13558 | 8 | 2 | 1 | 0 | NORMAL | domain | NORMAL | — |
| `apps/prototype-web/client/src/pages/EstimateDetail.tsx` | production | 259 | 279 | 11107 | 1 | 11 | 2 | 1 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | M |
| `apps/prototype-web/client/src/application/agreements/agreementService.ts` | production | 256 | 264 | 11844 | 4 | 4 | 27 | 23 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/app/MicroRouter.tsx` | production | 253 | 257 | 18728 | 2 | 7+ | 2 | 1 | NORMAL | app-root | NORMAL | — |
| `apps/prototype-web/client/src/application/security/localLockService.ts` | production | 246 | 267 | 12308 | 6 | 2 | 8 | 5 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/pages/G5DeclarationEditor.tsx` | production | 240 | 251 | 10675 | 1 | 12 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | M |
| `apps/prototype-web/client/src/components/catalog/CatalogReadingsSection.tsx` | production | 237 | 240 | 13721 | 2 | 7 | 2 | 1 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/pages/LoanEditor.tsx` | production | 235 | 242 | 11090 | 1 | 14 | 2 | 1 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | M |
| `apps/prototype-web/client/src/application/collections/collectionService.ts` | production | 231 | 244 | 12523 | 6 | 9 | 17 | 13 | NORMAL | application | NORMAL | M |
| `apps/prototype-web/client/src/application/finance/statementMarkdownService.ts` | production | 230 | 249 | 11923 | 4 | 4 | 3 | 2 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/pages/Suppliers.tsx` | production | 227 | 234 | 10521 | 1 | 13 | 3 | 2 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | M |
| `apps/prototype-web/client/src/application/parties/partyLedgerService.ts` | production | 221 | 239 | 10881 | 6 | 6 | 9 | 7 | NORMAL | application | NORMAL | M |
| `apps/prototype-web/client/src/pages/CashCount.tsx` | production | 221 | 232 | 9573 | 1 | 13 | 2 | 1 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | M |
| `apps/prototype-web/client/src/pages/Tools.tsx` | production | 216 | 227 | 11175 | 1 | 10 | 4 | 3 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | M |
| `apps/prototype-web/client/src/application/financial-records/retainedDepositService.ts` | production | 213 | 222 | 9634 | 3 | 3 | 8 | 6 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/pages/Parties.tsx` | production | 213 | 222 | 10312 | 1 | 10 | 2 | 1 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | M |
| `apps/prototype-web/client/src/pages/WalletLedger.tsx` | production | 213 | 223 | 10523 | 1 | 10 | 3 | 2 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | M |
| `apps/prototype-web/client/src/application/home/homeControlCenterModel.ts` | production | 209 | 211 | 9714 | 20 | 0 | 3 | 1 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/components/order/AgreementContextPanel.tsx` | production | 208 | 214 | 8347 | 1 | 7 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `src/domain/catalog/policies.ts` | production | 206 | 222 | 10671 | 7 | 1 | 1 | 0 | NORMAL | domain | NORMAL | — |
| `apps/prototype-web/client/src/app/navigationContract.ts` | production | 202 | 216 | 12213 | 12 | 0 | 58 | 7 | NORMAL | app-root | NORMAL | — |
| `apps/prototype-web/client/src/components/direct-sales/SaleCollectionReversalSection.tsx` | production | 199 | 207 | 8487 | 1 | 6 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | M |
| `apps/prototype-web/client/src/pages/CashOpeningLaterEditor.tsx` | production | 198 | 208 | 8856 | 1 | 12 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | M |
| `apps/prototype-web/client/src/components/settings/SettingsCapabilitiesSection.tsx` | production | 197 | 206 | 9942 | 2 | 6 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | M |
| `apps/prototype-web/client/src/application/catalog/templatePlannedCostService.ts` | production | 196 | 207 | 9553 | 6 | 5 | 6 | 3 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/components/security/AppLockGate.tsx` | production | 192 | 201 | 9526 | 1 | 8 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | D |
| `apps/prototype-web/client/src/pages/CashTransferEditor.tsx` | production | 192 | 195 | 8804 | 1 | 12 | 2 | 1 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/pages/FinanceRecurring.tsx` | production | 192 | 205 | 8626 | 1 | 9 | 2 | 1 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | M |
| `src/domain/financial-analysis/types.ts` | production | 189 | 203 | 8790 | 15 | 0 | 3 | 0 | NORMAL | domain | NORMAL | — |
| `apps/prototype-web/client/src/application/finance/upcomingService.ts` | production | 186 | 201 | 8222 | 7 | 5 | 4 | 2 | NORMAL | application | NORMAL | M |
| `src/domain/received-loan/policies.ts` | production | 186 | 199 | 8846 | 6 | 3 | 1 | 0 | NORMAL | domain | NORMAL | — |
| `apps/prototype-web/client/src/application/share/shareMessageService.ts` | production | 183 | 191 | 10900 | 8 | 4 | 4 | 1 | NORMAL | application | NORMAL | — |
| `src/domain/direct-sale/policies.ts` | production | 183 | 197 | 9992 | 5 | 2 | 1 | 0 | NORMAL | domain | NORMAL | — |
| `apps/prototype-web/client/src/presentation/formatters.ts` | production | 181 | 199 | 10596 | 16 | 1 | 93 | 6 | NORMAL | presentation | NORMAL | M |
| `src/domain/recurring-expense/types.ts` | production | 179 | 199 | 8887 | 23 | 1 | 2 | 0 | NORMAL | domain | NORMAL | — |
| `apps/prototype-web/client/src/pages/CashReversalEditor.tsx` | production | 178 | 182 | 7942 | 1 | 13 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | M |
| `apps/prototype-web/client/src/components/security/LockSettingsCard.tsx` | production | 177 | 187 | 6835 | 1 | 6 | 2 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | M |
| `apps/prototype-web/client/src/styles/vf-tokens.css` | production | 177 | 190 | 9779 | 0 | 0 | 0 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/application/time/actualTimeService.ts` | production | 175 | 184 | 8117 | 5 | 3 | 18 | 13 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/components/cost/MaterialSheet.tsx` | production | 175 | 177 | 7967 | 2 | 9 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/application/diagnostics/localDiagnosticsService.ts` | production | 174 | 190 | 8259 | 8 | 2 | 5 | 2 | NORMAL | application | NORMAL | MO |
| `apps/prototype-web/client/src/presentation/catalogPresentation.ts` | production | 174 | 175 | 9135 | 24 | 5 | 8 | 2 | NORMAL | presentation | NORMAL | — |
| `apps/prototype-web/client/src/styles/brand-launch-splash.css` | production | 169 | 182 | 4813 | 0 | 0 | 0 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/application/agreements/agreementContextService.ts` | production | 168 | 175 | 8141 | 7 | 3 | 31 | 28 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/application/finance/periodPresets.ts` | production | 166 | 186 | 9090 | 8 | 1 | 3 | 1 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/components/finance/CorrectionPreview.tsx` | production | 166 | 170 | 5835 | 3 | 3 | 3 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/pages/Assets.tsx` | production | 160 | 168 | 6892 | 1 | 11 | 3 | 2 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/pages/CashAdjustmentEditor.tsx` | production | 160 | 163 | 7173 | 1 | 12 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/application/preferences/preferenceService.ts` | production | 159 | 165 | 9084 | 10 | 3 | 18 | 14 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/styles/theme-dark.css` | production | 158 | 167 | 7766 | 0 | 0 | 0 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/application/cash/walletLedgerService.ts` | production | 157 | 164 | 6774 | 5 | 3 | 5 | 3 | NORMAL | application | NORMAL | M |
| `apps/prototype-web/client/src/storage/local/recurringExpenseCommitGuard.ts` | production | 154 | 165 | 9672 | 10 | 3 | 3 | 1 | NORMAL | storage | NORMAL | — |
| `apps/prototype-web/client/src/application/estimates/costEstimateService.ts` | production | 151 | 161 | 6276 | 3 | 2 | 16 | 14 | NORMAL | application | NORMAL | — |
| `src/domain/owner-entitlement/types.ts` | production | 150 | 162 | 4242 | 15 | 0 | 2 | 0 | NORMAL | domain | NORMAL | — |
| `apps/prototype-web/client/src/presentation/stateAdapter.ts` | production | 149 | 167 | 8936 | 15 | 0 | 4 | 1 | NORMAL | presentation | NORMAL | — |
| `src/domain/financial-event/types.ts` | production | 148 | 152 | 7341 | 11 | 1 | 3 | 0 | NORMAL | domain | NORMAL | — |
| `apps/prototype-web/client/src/components/presentation/EventEffectPreview.tsx` | production | 147 | 153 | 6977 | 4 | 6 | 2 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | M |
| `src/domain/financial-analysis/operatingBreakEven.ts` | production | 147 | 153 | 8823 | 2 | 3 | 3 | 0 | NORMAL | domain | NORMAL | — |
| `src/domain/loan/policies.ts` | production | 143 | 153 | 6639 | 6 | 3 | 1 | 0 | NORMAL | domain | NORMAL | — |
| `apps/prototype-web/client/src/components/loans/RepaymentSheet.tsx` | production | 141 | 145 | 5848 | 1 | 9 | 3 | 1 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `src/domain/catalog/types.ts` | production | 141 | 156 | 5623 | 17 | 0 | 2 | 0 | NORMAL | domain | NORMAL | — |
| `apps/prototype-web/client/src/application/drafts/legacyFormDraftMigration.ts` | production | 140 | 148 | 7306 | 7 | 3 | 6 | 3 | NORMAL | application | NORMAL | M |
| `apps/prototype-web/client/src/components/loans/ReceivedLoanRepaymentSheet.tsx` | production | 139 | 143 | 5875 | 1 | 9 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/components/forms/useFormDraft.ts` | production | 137 | 146 | 5877 | 3 | 3 | 4 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | M |
| `apps/prototype-web/client/src/components/settings/SettingsOperatingModeSection.tsx` | production | 134 | 139 | 6149 | 4 | 5 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/pages/CashWalletEditor.tsx` | production | 132 | 134 | 6342 | 1 | 12 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/storage/local/influentialSnapshotFamilies.ts` | production | 130 | 136 | 8046 | 6 | 1 | 2 | 1 | NORMAL | storage | NORMAL | — |
| `apps/prototype-web/client/src/pages/InventoryReversalEditor.tsx` | production | 129 | 132 | 5599 | 1 | 12 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `src/domain/inventory-material/types.ts` | production | 127 | 127 | 5944 | 15 | 0 | 3 | 0 | NORMAL | domain | NORMAL | — |
| `src/domain/cash-continuity/policies.ts` | production | 126 | 133 | 7220 | 3 | 3 | 1 | 0 | NORMAL | domain | NORMAL | — |
| `apps/prototype-web/client/src/application/fulfillment/deliveryContribution.ts` | production | 123 | 134 | 7227 | 7 | 1 | 1 | 1 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/application/drafts/draftService.ts` | production | 122 | 126 | 5179 | 4 | 1 | 21 | 20 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/application/drafts/formDraftService.ts` | production | 122 | 137 | 6909 | 9 | 1 | 26 | 22 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/application/input/englishNumeric.ts` | production | 118 | 128 | 6408 | 10 | 0 | 16 | 5 | NORMAL | application | NORMAL | — |
| `src/domain/asset/types.ts` | production | 118 | 128 | 6241 | 10 | 1 | 2 | 0 | NORMAL | domain | NORMAL | — |
| `apps/prototype-web/client/src/application/follow-up/dailyFollowUpService.ts` | production | 117 | 129 | 5234 | 4 | 5 | 14 | 11 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/application/transfers/transferCompatibilityValues.ts` | production | 115 | 121 | 8584 | 6 | 1 | 2 | 1 | NORMAL | application | NORMAL — update in lockstep with validator acceptance changes | — |
| `src/domain/supplier-purchase/types.ts` | production | 115 | 115 | 4765 | 9 | 0 | 2 | 0 | NORMAL | domain | NORMAL | — |
| `apps/prototype-web/client/src/application/finance/dueDatesService.ts` | production | 113 | 122 | 4944 | 6 | 4 | 8 | 5 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/pwa/PwaInstallControl.tsx` | production | 113 | 124 | 4538 | 1 | 5 | 2 | 1 | NORMAL | pwa | NORMAL | DM |
| `apps/prototype-web/client/src/lib/syncSha256.ts` | production | 112 | 119 | 4551 | 1 | 0 | 6 | 4 | NORMAL | lib | NORMAL | M |
| `apps/prototype-web/client/src/pwa/register.ts` | production | 112 | 126 | 4259 | 6 | 4 | 4 | 2 | NORMAL | pwa | NORMAL | DM |
| `apps/prototype-web/client/src/storage/local/indexedDbLifecycle.ts` | production | 111 | 118 | 5593 | 6 | 3 | 3 | 0 | NORMAL | storage | NORMAL | M |
| `src/domain/shared/numeric.ts` | production | 111 | 123 | 5021 | 11 | 0 | 1 | 0 | NORMAL | domain | NORMAL | — |
| `apps/prototype-web/client/src/application/owner/ownerProfileService.ts` | production | 109 | 120 | 4621 | 6 | 1 | 3 | 2 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/application/financial-records/expenseRecordIntent.ts` | production | 108 | 112 | 4948 | 4 | 2 | 4 | 1 | NORMAL | application | NORMAL | M |
| `apps/prototype-web/client/src/components/finance/AllocationReviewCard.tsx` | production | 108 | 111 | 5073 | 3 | 3 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/components/forms/EnglishNumberInput.tsx` | production | 107 | 111 | 3581 | 1 | 3 | 48 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/components/forms/EnglishQuantityInput.tsx` | production | 107 | 109 | 3787 | 3 | 3 | 10 | 3 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/presentation/orderAgreementPresentation.ts` | production | 106 | 115 | 3760 | 4 | 0 | 7 | 2 | NORMAL | presentation | NORMAL | — |
| `apps/prototype-web/client/src/storage/local/indexedDbPrimitives.ts` | production | 106 | 111 | 4813 | 5 | 2 | 1 | 0 | NORMAL | storage | NORMAL | — |
| `apps/prototype-web/client/src/components/ui/drawer.tsx` | production | 105 | 117 | 4411 | 1 | 3 | 4 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `src/domain/budget/types.ts` | production | 103 | 118 | 6728 | 16 | 1 | 2 | 0 | NORMAL | domain | NORMAL | — |
| `apps/prototype-web/client/src/components/finance/FinanceObligationsCard.tsx` | production | 102 | 104 | 4277 | 1 | 4 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/pages/SharePreview.tsx` | production | 100 | 107 | 4792 | 2 | 7 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/components/brand/BrandLaunchSplash.tsx` | production | 98 | 110 | 4717 | 2 | 4 | 2 | 1 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/components/presentation/DisplayValue.tsx` | production | 98 | 107 | 3393 | 8 | 2 | 60 | 3 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/pwa/PwaRuntimeNotice.tsx` | production | 98 | 108 | 4076 | 1 | 5 | 2 | 1 | NORMAL | pwa | NORMAL | D |
| `apps/prototype-web/client/src/application/transfers/domainTransferDriftAnchors.ts` | production | 97 | 105 | 3334 | 8 | 4 | 1 | 1 | NORMAL | application | NORMAL — update in lockstep with domain value changes | — |
| `apps/prototype-web/client/src/components/security/DataActionPinGate.tsx` | production | 97 | 100 | 3375 | 1 | 5 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `src/domain/craft-order/settlementInvariant.ts` | production | 97 | 102 | 5330 | 4 | 2 | 1 | 0 | NORMAL | domain | NORMAL | M |
| `apps/prototype-web/client/src/app/StartupGate.tsx` | production | 96 | 99 | 4989 | 3 | 6 | 4 | 2 | NORMAL | app-root | NORMAL | M |
| `apps/prototype-web/client/src/storage/local/orderCommitGuard.ts` | production | 94 | 102 | 6888 | 3 | 2 | 3 | 1 | NORMAL | storage | NORMAL | — |
| `apps/prototype-web/client/src/components/layout/MicroAppShell.tsx` | production | 93 | 96 | 4452 | 1 | 11 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | M |
| `src/domain/recurring-margin/types.ts` | production | 93 | 98 | 2886 | 9 | 0 | 2 | 0 | NORMAL | domain | NORMAL | — |
| `apps/prototype-web/client/src/application/cost/costService.ts` | production | 91 | 96 | 3528 | 4 | 2 | 27 | 24 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/components/primitives/Notice.tsx` | production | 91 | 101 | 4202 | 9 | 4 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `src/domain/owner-safe-withdrawal/policies.ts` | production | 91 | 96 | 5582 | 1 | 1 | 1 | 0 | NORMAL | domain | NORMAL | — |
| `apps/prototype-web/client/src/components/order/ActualMaterialPanel.tsx` | production | 89 | 91 | 4569 | 2 | 4 | 4 | 2 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/presentation/g5Plurals.ts` | production | 88 | 89 | 3255 | 8 | 1 | 7 | 0 | NORMAL | presentation | NORMAL | — |
| `apps/prototype-web/client/src/components/finance/DepositsLayer.tsx` | production | 86 | 88 | 4522 | 1 | 4 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `src/domain/cash-continuity/types.ts` | production | 83 | 83 | 4533 | 8 | 0 | 2 | 0 | NORMAL | domain | NORMAL | — |
| `src/domain/craft-order/deliveryTermsValidation.ts` | production | 81 | 92 | 4877 | 6 | 1 | 1 | 0 | NORMAL | domain | NORMAL | — |
| `apps/prototype-web/client/src/app/routeClassifier.ts` | production | 80 | 85 | 4824 | 4 | 0 | 3 | 2 | NORMAL | app-root | NORMAL | — |
| `apps/prototype-web/client/src/application/inventory/materialSuggestions.ts` | production | 80 | 83 | 4120 | 3 | 3 | 7 | 3 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/components/ErrorBoundary.tsx` | production | 80 | 82 | 3917 | 1 | 5 | 2 | 1 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `src/domain/actual-time/policies.ts` | production | 78 | 82 | 3665 | 3 | 1 | 1 | 0 | NORMAL | domain | NORMAL | — |
| `apps/prototype-web/client/src/application/finance/shortCashHorizon.ts` | production | 77 | 87 | 4419 | 7 | 1 | 3 | 1 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/components/finance/expenseFormModel.ts` | production | 77 | 85 | 5254 | 7 | 2 | 2 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `src/domain/direct-sale/types.ts` | production | 77 | 81 | 3892 | 5 | 1 | 2 | 0 | NORMAL | domain | NORMAL | — |
| `src/domain/received-loan/types.ts` | production | 77 | 84 | 3934 | 7 | 1 | 2 | 0 | NORMAL | domain | NORMAL | — |
| `apps/prototype-web/client/src/application/financial-pulse/financialPulseService.ts` | production | 74 | 80 | 3492 | 4 | 3 | 20 | 17 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/presentation/ownerEntitlementPresentation.ts` | production | 73 | 74 | 3418 | 8 | 1 | 4 | 1 | NORMAL | presentation | NORMAL | O |
| `apps/prototype-web/client/src/contexts/ThemeContext.tsx` | production | 72 | 76 | 3254 | 2 | 2 | 11 | 7 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | M |
| `apps/prototype-web/client/src/application/transfers/transferEnvelope.ts` | production | 71 | 75 | 4396 | 4 | 3 | 3 | 2 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/storage/local/expenseBudgetCommitGuard.ts` | production | 71 | 80 | 4995 | 6 | 1 | 2 | 0 | NORMAL | storage | NORMAL | — |
| `apps/prototype-web/client/src/storage/local/indexedDbStores.ts` | production | 68 | 69 | 5376 | 39 | 0 | 7 | 3 | NORMAL | storage | NORMAL | — |
| `apps/prototype-web/client/src/components/forms/FormDraftRestoreBanner.tsx` | production | 67 | 69 | 2576 | 1 | 4 | 4 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/lib/textDelivery.ts` | production | 67 | 72 | 3415 | 5 | 0 | 3 | 1 | NORMAL | lib | NORMAL | — |
| `apps/prototype-web/client/src/storage/local/persistentStorage.ts` | production | 67 | 73 | 3411 | 4 | 0 | 3 | 1 | NORMAL | storage | NORMAL | — |
| `apps/prototype-web/client/src/storage/local/receivedLoanCommitGuard.ts` | production | 64 | 69 | 4542 | 3 | 2 | 2 | 0 | NORMAL | storage | NORMAL | — |
| `apps/prototype-web/client/src/application/transfers/transferCounters.ts` | production | 62 | 64 | 3866 | 2 | 2 | 3 | 2 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/components/primitives/Field.tsx` | production | 62 | 65 | 3105 | 2 | 4 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/storage/local/loanCommitGuard.ts` | production | 62 | 67 | 4320 | 3 | 2 | 2 | 0 | NORMAL | storage | NORMAL | — |
| `apps/prototype-web/client/src/components/primitives/Row.tsx` | production | 61 | 66 | 2415 | 4 | 2 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/storage/local/supplierAttributionCommitGuard.ts` | production | 61 | 65 | 4065 | 2 | 3 | 2 | 0 | NORMAL | storage | NORMAL | — |
| `src/domain/loan/types.ts` | production | 61 | 67 | 2457 | 6 | 1 | 2 | 0 | NORMAL | domain | NORMAL | — |
| `apps/prototype-web/client/src/components/primitives/Button.tsx` | production | 59 | 63 | 2629 | 3 | 2 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/components/primitives/StatusChip.tsx` | production | 59 | 65 | 2610 | 4 | 4 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/app/quickRecording.tsx` | production | 58 | 64 | 2669 | 3 | 4+ | 8 | 6 | NORMAL | app-root | NORMAL | — |
| `apps/prototype-web/client/src/application/diagnostics/routeTemplate.ts` | production | 58 | 63 | 4093 | 1 | 0 | 4 | 2 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/application/owner-money/withdrawalWalletGuard.ts` | production | 58 | 62 | 3319 | 3 | 2 | 3 | 1 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/pages/Market.tsx` | production | 58 | 60 | 3098 | 1 | 5 | 3 | 2 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/app/CapabilityRouteGate.tsx` | production | 57 | 60 | 2743 | 1 | 5 | 2 | 1 | NORMAL | app-root | NORMAL | — |
| `apps/prototype-web/client/src/application/scheduling/capacityDecisionService.ts` | production | 57 | 59 | 2526 | 3 | 1 | 2 | 1 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/components/primitives/ChoiceRow.tsx` | production | 57 | 62 | 2401 | 4 | 2 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/application/preferences/updateLocalPreferences.ts` | production | 55 | 59 | 3530 | 3 | 1 | 4 | 1 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/app/navigation.ts` | production | 53 | 56 | 4064 | 3 | 2 | 6 | 4 | NORMAL | app-root | NORMAL | — |
| `apps/prototype-web/client/src/presentation/activityLabels.ts` | production | 53 | 57 | 2264 | 4 | 1 | 3 | 1 | NORMAL | presentation | NORMAL | — |
| `src/domain/shared/businessTime.ts` | production | 53 | 55 | 3887 | 2 | 0 | 1 | 0 | NORMAL | domain | NORMAL | — |
| `apps/prototype-web/client/src/app/resultFeedback.ts` | production | 52 | 62 | 6191 | 9 | 0 | 8 | 1 | NORMAL | app-root | NORMAL | — |
| `apps/prototype-web/client/src/components/layout/BottomNav.tsx` | production | 52 | 55 | 1782 | 1 | 1 | 3 | 2 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `src/domain/craft-order/index.ts` | production | 52 | 54 | 1884 | 5 | 0 | 98 | 70 | NORMAL | domain | NORMAL | • |
| `apps/prototype-web/client/src/components/order/OrderEventLog.tsx` | production | 51 | 53 | 2422 | 1 | 2 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `src/domain/craft-order/deliveryContribution.ts` | production | 51 | 53 | 4060 | 2 | 3 | 1 | 0 | NORMAL | domain | NORMAL | — |
| `apps/prototype-web/client/src/components/finance/RestatementNote.tsx` | production | 50 | 53 | 2163 | 1 | 3 | 6 | 1 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/storage/local/capabilities/orderLifecycleStore.ts` | production | 48 | 51 | 3373 | 3 | 1 | 5 | 1 | NORMAL | storage | NORMAL — registry §2 row updated; consumer migration continues per capability (RC-7) | — |
| `apps/prototype-web/client/src/application/financial-records/expenseCategorySuggestions.ts` | production | 47 | 51 | 2050 | 3 | 1 | 2 | 1 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/components/owner/CrossModelDuplicateNotice.tsx` | production | 47 | 49 | 2485 | 1 | 4 | 3 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `src/domain/owner-safe-withdrawal/types.ts` | production | 47 | 51 | 2945 | 4 | 1 | 2 | 0 | NORMAL | domain | NORMAL | — |
| `apps/prototype-web/client/src/components/brand/BrandMark.tsx` | production | 46 | 50 | 2000 | 2 | 1 | 3 | 1 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/presentation/plurals.ts` | production | 45 | 49 | 1678 | 4 | 1 | 5 | 1 | NORMAL | presentation | NORMAL | — |
| `apps/prototype-web/client/src/components/forms/LocalDateField.tsx` | production | 44 | 47 | 1845 | 1 | 2 | 31 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/components/primitives/EmptyState.tsx` | production | 44 | 47 | 1921 | 2 | 2 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/application/profile/profileService.ts` | production | 43 | 45 | 1786 | 2 | 1 | 23 | 22 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/components/settings/SettingsAppearanceSection.tsx` | production | 39 | 41 | 1699 | 2 | 3 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/pwa/install.ts` | production | 38 | 44 | 1941 | 5 | 0 | 2 | 1 | NORMAL | pwa | NORMAL | — |
| `apps/prototype-web/client/src/components/finance/quickFormHelpers.ts` | production | 37 | 41 | 2031 | 2 | 2 | 2 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/app/useDisabledCapabilities.ts` | production | 36 | 40 | 1971 | 3 | 2 | 14 | 0 | NORMAL | app-root | NORMAL | M |
| `apps/prototype-web/client/src/components/primitives/markers.tsx` | production | 36 | 39 | 1446 | 1 | 2 | 4 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/storage/local/capabilities/orderLifecycleCapabilityAnchors.ts` | production | 33 | 37 | 2178 | 3 | 4 | 0 | 0 | NORMAL | storage | NORMAL — keep in lockstep with the capability membership | — |
| `apps/prototype-web/client/src/application/identity/buildIdentity.ts` | production | 32 | 37 | 2408 | 3 | 0 | 3 | 1 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/presentation/financialEventLabels.ts` | production | 30 | 31 | 1947 | 1 | 1 | 3 | 0 | NORMAL | presentation | NORMAL | — |
| `src/domain/actual-time/types.ts` | production | 29 | 31 | 848 | 5 | 0 | 2 | 0 | NORMAL | domain | NORMAL | — |
| `apps/prototype-web/client/src/storage/local/cashContinuityCommitGuard.ts` | production | 28 | 30 | 2093 | 2 | 1 | 3 | 1 | NORMAL | storage | NORMAL | — |
| `apps/prototype-web/client/src/pages/NewDraft.tsx` | production | 27 | 29 | 1911 | 1 | 3 | 2 | 1 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `src/domain/craft-order/deliveryAttribution.ts` | production | 26 | 29 | 1831 | 1 | 1 | 1 | 0 | NORMAL | domain | NORMAL | — |
| `apps/prototype-web/client/src/components/presentation/DecisionPanel.tsx` | production | 25 | 26 | 761 | 1 | 0 | 3 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/components/primitives/index.ts` | production | 24 | 24 | 1083 | 9 | 0 | 97 | 2 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | • |
| `apps/prototype-web/client/src/App.tsx` | production | 23 | 25 | 1259 | 1 | 4 | 4 | 3 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/application/finance/dueDateAging.ts` | production | 23 | 27 | 1685 | 4 | 1 | 3 | 1 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/components/finance/quickActionFormTypes.ts` | production | 23 | 26 | 1248 | 3 | 0 | 5 | 2 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/components/forms/useFormDirty.ts` | production | 23 | 24 | 1948 | 1 | 1 | 23 | 1 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/application/fulfillment/deliveryAttribution.ts` | production | 22 | 24 | 1630 | 2 | 2 | 6 | 2 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/app/useReturnNavigation.ts` | production | 20 | 22 | 1266 | 2 | 3 | 51 | 0 | NORMAL | app-root | NORMAL | — |
| `apps/prototype-web/client/src/application/agreements/agreementPrice.ts` | production | 19 | 22 | 665 | 4 | 0 | 2 | 1 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/application/scheduling/capacityDecisionViewModel.ts` | production | 19 | 21 | 927 | 2 | 2 | 2 | 1 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/components/presentation/InfoCard.tsx` | production | 19 | 20 | 718 | 1 | 1 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `src/domain/owner-entitlement/index.ts` | production | 19 | 19 | 631 | 3 | 0 | 22 | 8 | NORMAL | domain | NORMAL | • |
| `apps/prototype-web/client/src/pages/NotFound.tsx` | production | 17 | 18 | 826 | 1 | 3 | 1 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/presentation/cashCountMessages.ts` | production | 17 | 20 | 1458 | 3 | 1 | 2 | 1 | NORMAL | presentation | NORMAL | — |
| `apps/prototype-web/client/src/application/drafts/formDraftTestHarness.ts` | production | 16 | 17 | 1005 | 1 | 2 | 3 | 3 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/pwa/registerSW.virtual.ts` | production | 16 | 17 | 997 | 2 | 0 | 0 | 0 | NORMAL | pwa | NORMAL | — |
| `src/domain/shared/index.ts` | production | 15 | 15 | 366 | 3 | 0 | 66 | 6 | NORMAL | domain | NORMAL | • |
| `src/domain/g5/index.ts` | production | 14 | 14 | 931 | 1 | 0 | 3 | 1 | NORMAL | domain | NORMAL — frozen until the UI wave removes importers | • |
| `apps/prototype-web/client/src/pwa/dirtyRegistry.ts` | production | 13 | 16 | 639 | 2 | 0 | 6 | 3 | NORMAL | pwa | NORMAL | M |
| `apps/prototype-web/client/src/application/agreements/followUpDate.ts` | production | 11 | 14 | 611 | 3 | 2 | 4 | 1 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/application/g5/g5Service.ts` | production | 11 | 11 | 839 | 1 | 0 | 18 | 15 | NORMAL | application | NORMAL — frozen until the UI wave removes importers | — |
| `apps/prototype-web/client/src/application/finance/expenseBudgetService.ts` | production | 10 | 10 | 688 | 1 | 0 | 1 | 0 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/application/finance/expenseRecordIntent.ts` | production | 10 | 10 | 698 | 1 | 0 | 1 | 0 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/application/finance/ownerEntitlementService.ts` | production | 10 | 10 | 722 | 1 | 0 | 25 | 17 | NORMAL | application | NORMAL — frozen until the UI wave removes importers | — |
| `apps/prototype-web/client/src/application/inventory/inventoryMovementRoute.ts` | production | 10 | 12 | 579 | 2 | 0 | 2 | 1 | NORMAL | application | NORMAL | — |
| `src/domain/financial-event/index.ts` | production | 10 | 10 | 258 | 2 | 0 | 87 | 45 | NORMAL | domain | NORMAL | • |
| `apps/prototype-web/client/src/application/finance/correctionHistoryService.ts` | production | 9 | 9 | 631 | 1 | 0 | 17 | 15 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/application/finance/expenseCategorySuggestions.ts` | production | 9 | 9 | 635 | 1 | 0 | 2 | 0 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/application/finance/retainedDepositService.ts` | production | 9 | 9 | 627 | 1 | 0 | 20 | 19 | NORMAL | application | NORMAL | — |
| `apps/prototype-web/client/src/application/finance/withdrawalWalletGuard.ts` | production | 6 | 6 | 378 | 1 | 0 | 1 | 0 | NORMAL | application | **أُزيلت (Wave E/ADR-016 — 2026-10-04):** فرضية الإزالة «مسار UI» كانت خاطئة لهذه الوحدة — مستوردها الوحيد غير-UI (ownerEntitlementService) فهاجر للبيت الأساس وحُذفت الوحدة؛ الشيم 9→8 | — |
| `apps/prototype-web/client/src/main.tsx` | production | 6 | 7 | 244 | 0 | 4 | 0 | 0 | NORMAL | ui | UI_OUT_OF_SCOPE (Wave T) | — |
| `apps/prototype-web/client/src/storage/local/createBrowserLocalStore.ts` | production | 6 | 7 | 313 | 1 | 2 | 4 | 3 | NORMAL | storage | NORMAL | — |
| `apps/prototype-web/client/src/lib/utils.ts` | production | 5 | 6 | 169 | 1 | 2 | 3 | 0 | NORMAL | lib | NORMAL | — |
| `src/domain/financial-analysis/index.ts` | production | 3 | 3 | 160 | 3 | 0 | 15 | 7 | NORMAL | domain | NORMAL | • |
| `src/domain/shared/currency.ts` | production | 3 | 4 | 100 | 3 | 0 | 1 | 0 | NORMAL | domain | NORMAL | — |
| `src/domain/actual-time/index.ts` | production | 2 | 2 | 59 | 2 | 0 | 10 | 4 | NORMAL | domain | NORMAL | • |
| `src/domain/asset/index.ts` | production | 2 | 2 | 59 | 2 | 0 | 10 | 4 | NORMAL | domain | NORMAL | • |
| `src/domain/budget/index.ts` | production | 2 | 2 | 59 | 2 | 0 | 14 | 5 | NORMAL | domain | NORMAL | • |
| `src/domain/cash-continuity/index.ts` | production | 2 | 2 | 59 | 2 | 0 | 50 | 23 | NORMAL | domain | NORMAL | • |
| `src/domain/catalog/index.ts` | production | 2 | 2 | 59 | 2 | 0 | 31 | 14 | NORMAL | domain | NORMAL | • |
| `src/domain/direct-sale/index.ts` | production | 2 | 2 | 59 | 2 | 0 | 43 | 24 | NORMAL | domain | NORMAL | • |
| `src/domain/inventory-material/index.ts` | production | 2 | 2 | 59 | 2 | 0 | 42 | 23 | NORMAL | domain | NORMAL | • |
| `src/domain/loan/index.ts` | production | 2 | 2 | 59 | 2 | 0 | 9 | 2 | NORMAL | domain | NORMAL | • |
| `src/domain/owner-safe-withdrawal/index.ts` | production | 2 | 2 | 59 | 2 | 0 | 2 | 1 | NORMAL | domain | NORMAL | • |
| `src/domain/received-loan/index.ts` | production | 2 | 2 | 59 | 2 | 0 | 13 | 5 | NORMAL | domain | NORMAL | • |
| `src/domain/recurring-expense/index.ts` | production | 2 | 2 | 59 | 2 | 0 | 17 | 8 | NORMAL | domain | NORMAL | • |
| `src/domain/recurring-margin/index.ts` | production | 2 | 2 | 59 | 2 | 0 | 19 | 10 | NORMAL | domain | NORMAL | • |
| `src/domain/supplier-purchase/index.ts` | production | 2 | 2 | 59 | 2 | 0 | 33 | 21 | NORMAL | domain | NORMAL | • |
| `pnpm-lock.yaml` | config | 5613 | 7056 | 244844 | 0 | 0 | 0 | 0 | NORMAL | infra | INFRA — change via own slice only | — |
| `apps/prototype-web/client/src/application/finance/projectFinancialService.test.ts` | test | 2446 | 2494 | 93800 | 0 | 7 | 0 | 0 | LARGE_TEST | application | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/application/transfers/localTransferService.test.ts` | test | 2011 | 2052 | 77706 | 0 | 13 | 0 | 0 | LARGE_TEST | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/inventory/inventoryMaterialService.test.ts` | test | 1714 | 1752 | 71683 | 0 | 8 | 0 | 0 | LARGE_TEST | application | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/application/finance/integrityCheckService.test.ts` | test | 1414 | 1459 | 61300 | 0 | 16+ | 0 | 0 | LARGE_TEST | application | TEST — judged as test asset, not production | M |
| `scripts/text-density-count.py` | script | 458 | 506 | 19,577 | 0 | 3 | 1 | 0 | WATCH | infra | *(تصحيح مؤرخ 2026-10-09 — R6-W3 [R6-SCAN-F-009]): فُصل دفتر السياسة إلى `scripts/text_density_policy.py` — هذا الملف هو **المحرك** الآن (تحليل/عدّ/تحقق/تقرير) ويستورد السياسة ويتحقق منها عند الإقلاع؛ خرجه بايت-متطابق مع ما قبل الفصل (ذهبي التواصف docs/fixtures/text-density/w3-characterization.golden.txt + اختبار توصيف مباشر)؛ الشريط هبط SPLIT_NOW→WATCH (ربح راتشة، أساس محدّث نفس-الـPR)* | — |
| `scripts/text_density_policy.py` | script | 846 | 852 | 68,666 | 0 | 1 | 1 | 1 | SPLIT_CANDIDATE | infra | **وحدة بيانات سياسة فقط (R6-W3 seam)** — سجل الشاشات PAGES ودفتر السقوف CAPS بتاريخه المؤرخ الكامل (الحفاظ على مصدر الدفتر إلزامي) وEXPLICIT_SERVICES؛ لا منطق فيها (يتحقق المحرك من سلامتها عند الإقلاع: خرج 2 بخطأ صريح عند أي مدخل مشوه)؛ الحجم غالبه تعليقات الإثبات المؤرخة — النمو يحكمه بروتوكول السقوف الموثق نفسه (كل رفع سقف بقرار مؤرخ في مكانه) | — |
| `tests/domain/craft-order.test.ts` | test | 1111 | 1209 | 45569 | 0 | 2 | 0 | 0 | NORMAL | test | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/storage/local/adapterConformance.group10.test.ts` | test | 1062 | 1119 | 39872 | 0 | 13+ | 0 | 0 | NORMAL | storage | TEST — judged as test asset, not production | M |
| `docs/operations/control/generated/MASTER-TRACKER.xlsx` | generated | 1016 | 1044 | 39434 | 0 | 0 | 0 | 0 | NORMAL | ops-generated | GENERATED — no hand edits | — |
| `tests/domain/complex-six.characterization.test.ts` | test | 1005 | 1066 | 40111 | 0 | 7 | 0 | 0 | NORMAL | test | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/group2InventorySurfaces.test.tsx` | test | 936 | 964 | 44407 | 0 | 28 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/fulfillment/fulfillmentService.test.ts` | test | 841 | 880 | 43593 | 0 | 9 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/application/owner-money/ownerEntitlementService.test.ts` | test | 810 | 829 | 30319 | 0 | 5 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.test.ts` | test | 806 | 832 | 30304 | 0 | 8 | 0 | 0 | NORMAL | storage | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/finance/statementService.test.ts` | test | 753 | 769 | 33383 | 0 | 11 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | M |
| `apps/prototype-web/dev-tools/debug-collector.js` | script | 694 | 799 | 24862 | 0 | 0 | 1 | 0 | WATCH | infra | **PRESERVE — تصرف أداة تطوير موثق (مصالحة R6-W1، 2026-10-09 [R6-SCAN-F-008]):** المالك: prototype-web؛ dev-only مثبت (بوابة vite `Q-002` للتطوير فقط + early-return إنتاجي)؛ السبب: أداة تشخيص محلية فوق رأس الرموز لا تدخل رزمة الإنتاج؛ محفز المراجعة: أي محاولة استخدام إنتاجي أو استبدال أداة التشخيص؛ الشرط الخروجي: الإزالة عند الاستبدال بقرار مالك؛ الاختبارات: 0 مباشرة (تسجيل صادق — التحقق التشغيلي يدوي في dev)؛ حد الرجوع: LOW (أداة فقط) | DMN |
| `tests/domain/financial-event.test.ts` | test | 691 | 703 | 24531 | 0 | 2 | 0 | 0 | NORMAL | test | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/G3.dom.test.tsx` | test | 690 | 725 | 37952 | 0 | 32 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/home/homeControlCenterService.test.ts` | test | 651 | 673 | 31842 | 0 | 12 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/finance/profitToCashBridgeService.test.ts` | test | 645 | 659 | 30936 | 0 | 11 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/transfers/localTransferService.releasedPairs.test.ts` | test | 603 | 629 | 24517 | 0 | 6 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/collections/collectionReversalService.test.ts` | test | 563 | 586 | 25681 | 0 | 9 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/application/financial-analysis/financialAnalysisService.test.ts` | test | 557 | 568 | 22303 | 0 | 8 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/application/transfers/dataRoundTrip.exe014.test.ts` | test | 547 | 569 | 22601 | 0 | 16 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/application/finance/operatingBreakEvenModel.test.ts` | test | 546 | 564 | 27047 | 0 | 7 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/pages/Orders.ui.test.tsx` | test | 529 | 576 | 20501 | 0 | 7 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/G3Hardening.dom.test.tsx` | test | 527 | 570 | 29156 | 0 | 30 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/Settings.lockGate.dom.test.tsx` | test | 514 | 550 | 28764 | 0 | 20 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `tests/domain/recurring-expense.test.ts` | test | 511 | 528 | 25183 | 0 | 2 | 0 | 0 | NORMAL | test | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/financial-records/correctionHistoryService.test.ts` | test | 507 | 518 | 20933 | 0 | 7+ | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/FinanceBridge.w173.dom.test.tsx` | test | 496 | 514 | 20603 | 0 | 30 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/application/finance/recurringExpenseService.test.ts` | test | 496 | 573 | 29209 | 0 | 6 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | M |
| `tests/domain/craft-order-d15-settlement.test.ts` | test | 492 | 527 | 24255 | 0 | 3 | 0 | 0 | NORMAL | test | TEST — judged as test asset, not production | M |
| `tests/domain/inventory-material.test.ts` | test | 484 | 493 | 17518 | 0 | 2 | 0 | 0 | NORMAL | test | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/direct-sales/directSaleService.test.ts` | test | 468 | 493 | 18605 | 0 | 3+ | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/fulfillment/deliveryReviewService.test.ts` | test | 467 | 482 | 23275 | 0 | 8 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `eslint.config.js` | config | 466 | 467 | 19212 | 1 | 1 | 2 | 0 | NORMAL | infra | INFRA — change via own slice only | — |
| `apps/prototype-web/client/src/FinanceBudgets.w174.dom.test.tsx` | test | 462 | 486 | 24468 | 0 | 28 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/application/suppliers/supplierPurchaseService.attributionAtomicity.test.ts` | test | 455 | 475 | 20583 | 0 | 10 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/scheduling/scheduleService.test.ts` | test | 453 | 468 | 20293 | 0 | 4+ | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/G6.dom.test.tsx` | test | 449 | 485 | 21777 | 0 | 25 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/application/fulfillment/deliveryReviewService.priorConsumption.test.ts` | test | 443 | 458 | 20799 | 0 | 9 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/Wave4ContractOracles.contract.test.ts` | test | 439 | 464 | 20448 | 0 | 4+ | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/ReadLayerParity.w44.dom.test.tsx` | test | 436 | 459 | 21357 | 0 | 27 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `tests/owner-entitlement.test.ts` | test | 435 | 447 | 14859 | 0 | 2 | 0 | 0 | NORMAL | test | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/transfers/localTransferService.schema34.test.ts` | test | 428 | 442 | 15841 | 0 | 7+ | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | M |
| `docs/fixtures/export-goldens/current-pair-supplement.golden.json` | fixture | 428 | 428 | 14122 | 0 | 0 | 3 | 0 | NORMAL | infra | FIXTURE — version with its consumer | — |
| `apps/prototype-web/client/src/storage/local/deliveryReversalCommitGuard.test.ts` | test | 427 | 460 | 18717 | 0 | 5 | 0 | 0 | NORMAL | storage | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/QuickExpenseSource.dom.test.tsx` | test | 425 | 456 | 23303 | 0 | 10 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/finance/fullCycleReconciliation.exe013.test.ts` | test | 424 | 447 | 20698 | 0 | 17 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `tests/domain/operatingBreakEven.test.ts` | test | 422 | 439 | 19338 | 0 | 2 | 0 | 0 | NORMAL | test | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/supplierScheduleConcurrency.test.ts` | test | 421 | 436 | 19375 | 0 | 5 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `tests/domain/public-surface.test.ts` | test | 421 | 469 | 21213 | 1 | 31 | 0 | 0 | NORMAL | test | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/supplierScheduleStaleResults.test.ts` | test | 419 | 435 | 18654 | 0 | 7 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/pages/FinancialEventEditor.guided.test.tsx` | test | 417 | 438 | 24039 | 0 | 12 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/finance/unallocatedDistribution.test.ts` | test | 413 | 427 | 17580 | 0 | 4 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/application/assets/assetService.test.ts` | test | 412 | 432 | 21674 | 0 | 4 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/application/collections/collectionService.test.ts` | test | 402 | 415 | 18221 | 0 | 9 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/RecurringExpenseSurfaces.dom.test.tsx` | test | 395 | 423 | 21821 | 0 | 15 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `docs/fixtures/export-goldens/current-pair.golden.json` | fixture | 395 | 395 | 12444 | 0 | 0 | 3 | 0 | NORMAL | infra | FIXTURE — version with its consumer | — |
| `apps/prototype-web/client/src/application/owner-money/withdrawalWalletGuard.test.ts` | test | 390 | 410 | 16057 | 0 | 7 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/storage/local/adapterConformance.test.ts` | test | 389 | 414 | 16661 | 0 | 6 | 0 | 0 | NORMAL | storage | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/finance/recurringWorkService.test.ts` | test | 388 | 398 | 14298 | 0 | 7 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/OrdJourneys.dom.test.tsx` | test | 387 | 405 | 21685 | 0 | 21 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `tests/domain/financial-analysis.test.ts` | test | 384 | 403 | 13896 | 0 | 2 | 0 | 0 | NORMAL | test | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/storage/local/adapterDeliveryReversal.test.ts` | test | 379 | 401 | 16564 | 0 | 7 | 0 | 0 | NORMAL | storage | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/application/time/actualTimeService.test.ts` | test | 376 | 385 | 13131 | 0 | 4 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/transfers/exportGoldens.test.ts` | test | 374 | 399 | 18293 | 0 | 22 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/finance/d03DeliveryOperatingPath.test.ts` | test | 373 | 383 | 18511 | 0 | 5 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/application/catalog/catalogCore.test.ts` | test | 371 | 380 | 13253 | 0 | 4 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `tests/domain/budget.test.ts` | test | 371 | 381 | 19102 | 0 | 3 | 0 | 0 | NORMAL | test | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/storage/local/capabilities/orderLifecycleCapability.contract.test.ts` | test | 370 | 394 | 16453 | 0 | 13 | 0 | 0 | NORMAL | storage | TEST — judged as test asset, not production | M |
| `tests/domain/craft-order-corrections.test.ts` | test | 369 | 390 | 15554 | 0 | 2 | 0 | 0 | NORMAL | test | TEST — judged as test asset, not production | M |
| `scripts/operations-control/validate.py` | script | 368 | 422 | 21771 | 0 | 7 | 2 | 0 | NORMAL | infra | INFRA — change via own slice only | — |
| `tests/domain/craft-order-delivery-terms.test.ts` | test | 367 | 386 | 14201 | 0 | 3 | 0 | 0 | NORMAL | test | TEST — judged as test asset, not production | M |
| `scripts/check-entity-touchpoints.test.mjs` | test | 363 | 388 | 16926 | 2 | 8 | 0 | 0 | NORMAL | infra | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.group2.test.ts` | test | 358 | 382 | 16675 | 0 | 6 | 0 | 0 | NORMAL | storage | TEST — judged as test asset, not production | — |
| `scripts/file-size-ratchet-baseline.json` | script | 358 | 358 | 27119 | 0 | 0 | 2 | 0 | NORMAL | infra | INFRA — change via own slice only | — |
| `apps/prototype-web/client/src/application/activity/activityService.test.ts` | test | 357 | 366 | 14081 | 0 | 6 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/transfers/localTransferService.schema32.test.ts` | test | 356 | 361 | 16237 | 0 | 6 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/HomeRedesign.w43.dom.test.tsx` | test | 348 | 366 | 18974 | 0 | 22 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/G2.dom.test.tsx` | test | 347 | 367 | 17260 | 0 | 22 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | M |
| `scripts/check-layer-boundaries.test.mjs` | test | 347 | 373 | 18975 | 0 | 4+ | 0 | 0 | NORMAL | infra | TEST — judged as test asset, not production | — |
| `apps/prototype-web/vite.config.ts` | config | 344 | 379 | 14693 | 1 | 8 | 4 | 0 | NORMAL | infra | INFRA — change via own slice only | M |
| `apps/prototype-web/client/src/application/transfers/localTransferService.receivedLoan.test.ts` | test | 342 | 360 | 17342 | 0 | 6 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/components/primitives/primitives.test.tsx` | test | 339 | 381 | 16929 | 0 | 6 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.receivedLoan.test.ts` | test | 332 | 347 | 15510 | 0 | 6 | 0 | 0 | NORMAL | storage | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/fulfillment/orderWriteStaleResults.test.ts` | test | 330 | 345 | 15137 | 0 | 7 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `docs/fixtures/export-goldens/historical-8-17-faithful.golden.json` | fixture | 328 | 328 | 10560 | 0 | 0 | 2 | 0 | NORMAL | infra | FIXTURE — version with its consumer | — |
| `apps/prototype-web/client/src/application/finance/periodComparisonService.test.ts` | test | 326 | 339 | 15010 | 0 | 7 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/G4RetainedDeposit.dom.test.tsx` | test | 319 | 332 | 15524 | 0 | 22 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/G4Assets.dom.test.tsx` | test | 316 | 332 | 17973 | 0 | 13 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/suppliers/supplierPurchaseService.test.ts` | test | 315 | 318 | 11883 | 0 | 5 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/storage/local/supplierScheduleCommitGuard.test.ts` | test | 313 | 344 | 14264 | 0 | 3 | 0 | 0 | NORMAL | storage | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/G004CapabilityGuard.dom.test.tsx` | test | 312 | 326 | 15206 | 0 | 31 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/app/routeKnowledgeSync.test.ts` | test | 311 | 332 | 17207 | 0 | 6 | 0 | 0 | NORMAL | app-root | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/pages/DirectSaleEditor.ui.test.tsx` | test | 308 | 334 | 15166 | 0 | 7 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/home/homeControlCenterModel.test.ts` | test | 304 | 318 | 11685 | 0 | 2 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/transfers/transferFamilyValidators.characterization.test.ts` | test | 304 | 329 | 12004 | 0 | 8 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/catalog/templatePlannedCostService.test.ts` | test | 301 | 318 | 11786 | 0 | 7 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/storage/local/adapterConformance.recurringExpense.test.ts` | test | 298 | 322 | 14308 | 1 | 8 | 0 | 0 | NORMAL | storage | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/G005FinanceReadIsolation.dom.test.tsx` | test | 293 | 315 | 13970 | 0 | 23 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/application/transfers/ownerEntitlementTransfer.test.ts` | test | 288 | 295 | 11689 | 0 | 7 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/pages/Profile.ui.test.tsx` | test | 282 | 299 | 11689 | 0 | 6 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `src/domain/direct-sale/policies.test.ts` | test | 280 | 300 | 10307 | 0 | 2 | 0 | 0 | NORMAL | domain | TEST — judged as test asset, not production | — |
| `tests/domain/craft-order-g3.test.ts` | test | 276 | 287 | 10822 | 0 | 3 | 0 | 0 | NORMAL | test | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/share/shareMessageService.test.ts` | test | 275 | 294 | 13173 | 0 | 5 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/finance/dueDatesService.test.ts` | test | 272 | 288 | 12230 | 0 | 13 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/pages/OwnerJourneysExe009.dom.test.tsx` | test | 271 | 289 | 12407 | 0 | 9 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | M |
| `tests/domain/supplier-purchase-corrections.test.ts` | test | 265 | 278 | 11144 | 0 | 2 | 0 | 0 | NORMAL | test | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/ReversalSurfacesExe010.dom.test.tsx` | test | 264 | 273 | 12028 | 0 | 29+ | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.delivery.test.ts` | test | 264 | 270 | 10471 | 0 | 8 | 0 | 0 | NORMAL | storage | TEST — judged as test asset, not production | — |
| `scripts/design-token-guards.py` | script | 261 | 294 | 12811 | 0 | 2 | 0 | 0 | NORMAL | infra | INFRA — change via own slice only | — |
| `apps/prototype-web/client/src/styles/vf-tokens.test.ts` | test | 260 | 287 | 12253 | 0 | 3 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | M |
| `scripts/check-runtime-cycles.mjs` | script | 259 | 272 | 10836 | 4 | 5+ | 2 | 0 | NORMAL | infra | INFRA — change via own slice only | M |
| `apps/prototype-web/client/src/ArabicRtlContent.w44.dom.test.tsx` | test | 257 | 274 | 13395 | 0 | 29 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/FinanceUpcoming.dom.test.tsx` | test | 257 | 281 | 13143 | 0 | 18 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/OrderDetail.ui.test.tsx` | test | 256 | 287 | 13614 | 0 | 20 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/agreements/agreementContextService.test.ts` | test | 253 | 260 | 9683 | 0 | 4 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/pages/Setup.ui.test.tsx` | test | 253 | 293 | 14627 | 0 | 8 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/pages/SupplierPurchaseEditor.ui.test.tsx` | test | 253 | 271 | 11666 | 0 | 9 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/budgets/expenseBudgetService.3c.test.ts` | test | 252 | 266 | 11696 | 0 | 4 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/transfers/localTransferService.recurringExpense.test.ts` | test | 252 | 267 | 11870 | 0 | 5 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `scripts/check-module-boundaries.mjs` | script | 250 | 264 | 14885 | 6 | 6 | 1 | 0 | NORMAL | infra | NORMAL — baseline updates only in the same PR as the legitimate edge + registry row | — |
| `apps/prototype-web/client/src/application/finance/statementMarkdownService.test.ts` | test | 249 | 257 | 10961 | 0 | 4 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `scripts/check-entity-touchpoints.mjs` | script | 249 | 272 | 12437 | 8 | 4 | 2 | 0 | NORMAL | infra | INFRA — change via own slice only | — |
| `apps/prototype-web/client/src/WorkShare.w43.dom.test.tsx` | test | 248 | 263 | 12116 | 0 | 19 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/application/financial-records/retainedDepositService.test.ts` | test | 248 | 261 | 10914 | 0 | 7 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/application/finance/upcomingService.test.ts` | test | 246 | 265 | 11628 | 0 | 14 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/application/finance/projectFinancialService.category.test.ts` | test | 244 | 253 | 10771 | 0 | 3 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/G3Delivery.dom.test.tsx` | test | 241 | 256 | 11847 | 0 | 22 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/QuickFormsNotify.dom.test.tsx` | test | 241 | 255 | 12227 | 0 | 12+ | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/application/transfers/localTransferService.expenseBudget.test.ts` | test | 240 | 257 | 12075 | 0 | 5 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `tests/domain/assetResidual.test.ts` | test | 239 | 252 | 10681 | 0 | 3 | 0 | 0 | NORMAL | test | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/suppliers/supplierPurchaseService.wallet.test.ts` | test | 238 | 248 | 11641 | 0 | 6 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `tests/domain/cash-continuity.test.ts` | test | 237 | 250 | 9058 | 0 | 2 | 0 | 0 | NORMAL | test | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/storage/local/OwnerEntitlementStorage.test.ts` | test | 236 | 240 | 8422 | 0 | 5 | 0 | 0 | NORMAL | storage | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/group1Surfaces.test.tsx` | test | 234 | 246 | 10272 | 0 | 20 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/scripts/check-bundle-budget.test.mjs` | test | 233 | 259 | 11846 | 0 | 9 | 0 | 0 | NORMAL | infra | TEST — judged as test asset, not production | M |
| `tests/domain/recurring-margin.test.ts` | test | 231 | 240 | 8194 | 0 | 3 | 0 | 0 | NORMAL | test | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/storage/local/adapterConformance.receivedLoan.test.ts` | test | 229 | 246 | 10488 | 1 | 8 | 0 | 0 | NORMAL | storage | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/cash/cashContinuityService.test.ts` | test | 228 | 232 | 8757 | 0 | 4 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/CashJourneys.dom.test.tsx` | test | 226 | 250 | 13640 | 0 | 10 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/U06.dom.test.tsx` | test | 225 | 251 | 10132 | 0 | 9 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/collections/saleCollectionReversalService.test.ts` | test | 224 | 233 | 11694 | 0 | 5+ | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/exact-values.cross-surface.test.ts` | test | 224 | 237 | 10076 | 0 | 11 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `tests/domain/craft-order-d031.test.ts` | test | 224 | 236 | 9602 | 0 | 2 | 0 | 0 | NORMAL | test | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/Home.dom.test.tsx` | test | 223 | 243 | 12150 | 0 | 18 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/application/finance/breakEvenModelParity.test.ts` | test | 223 | 232 | 10533 | 0 | 6 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | M |
| `tests/domain/asset.test.ts` | test | 221 | 234 | 9379 | 0 | 3 | 0 | 0 | NORMAL | test | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/finance/recurringWorkService.fin006.test.ts` | test | 219 | 227 | 10914 | 0 | 6 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.expenseBudget.test.ts` | test | 219 | 232 | 11222 | 0 | 6 | 0 | 0 | NORMAL | storage | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/QuickFormsEnter.w43.dom.test.tsx` | test | 216 | 232 | 13157 | 0 | 5 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/StatementPeriod.w173.dom.test.tsx` | test | 214 | 230 | 11157 | 0 | 12 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/StateRecovery.w44.dom.test.tsx` | test | 213 | 230 | 9190 | 0 | 10 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/presentation/PresentationFormats.w44.dom.test.tsx` | test | 212 | 238 | 13531 | 0 | 5 | 0 | 0 | NORMAL | presentation | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/Ops001MovementSelection.dom.test.tsx` | test | 211 | 225 | 10576 | 0 | 11 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/FinalLogicOwnerDecisions.contract.test.ts` | test | 210 | 219 | 11045 | 0 | 7+ | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/application/drafts/legacyFormDraftMigration.test.ts` | test | 210 | 227 | 9781 | 0 | 4 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/D005.dom.test.tsx` | test | 209 | 221 | 12308 | 0 | 17 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/Nav001.dom.test.tsx` | test | 209 | 221 | 12046 | 0 | 22 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/transfers/catalogCoreTransfer.test.ts` | test | 208 | 215 | 8446 | 0 | 5 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/transfers/localTransferService.feeOrderRoundTrip.test.ts` | test | 208 | 222 | 10948 | 0 | 7 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/FinanceObligations.w43.dom.test.tsx` | test | 205 | 220 | 10484 | 0 | 25 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/application/transfers/localTransferService.schema31.test.ts` | test | 203 | 213 | 10971 | 0 | 7 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `tests/domain/craft-order-review-lock.test.ts` | test | 202 | 213 | 8765 | 0 | 2 | 0 | 0 | NORMAL | test | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/R2.renderSmoke.test.tsx` | test | 201 | 214 | 7876 | 0 | 9 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/application/loans/receivedLoanService.test.ts` | test | 200 | 211 | 10712 | 0 | 5 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/application/preferences/preferencesFieldPreservation.test.ts` | test | 200 | 212 | 10773 | 0 | 7 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/fulfillment/deliveryContribution.test.ts` | test | 199 | 221 | 8453 | 0 | 2 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/pages/FinancialEventEditor.ui.test.tsx` | test | 199 | 221 | 9521 | 0 | 10 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/financial-analysis/financialAnalysisService.shortCashHorizon.test.ts` | test | 198 | 205 | 8129 | 0 | 5 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/finance/projectFinancialService.evidence.test.ts` | test | 196 | 206 | 9458 | 0 | 5+ | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `docs/fixtures/export-goldens/MANIFEST.json` | fixture | 196 | 196 | 8512 | 0 | 0 | 1 | 0 | NORMAL | infra | FIXTURE — version with its consumer | — |
| `apps/prototype-web/client/src/application/owner-money/ownerCrossModelDuplicates.test.ts` | test | 195 | 205 | 8368 | 0 | 5 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.group4.test.ts` | test | 195 | 203 | 8580 | 0 | 8 | 0 | 0 | NORMAL | storage | TEST — judged as test asset, not production | M |
| `scripts/operations-control/generate_tracker.py` | script | 195 | 238 | 11446 | 0 | 5 | 2 | 0 | NORMAL | infra | INFRA — change via own slice only | — |
| `apps/prototype-web/client/src/G4Loans.dom.test.tsx` | test | 191 | 203 | 10490 | 0 | 15 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/storage/local/adapterConformance.expenseBudget.test.ts` | test | 191 | 211 | 9278 | 1 | 7 | 0 | 0 | NORMAL | storage | TEST — judged as test asset, not production | — |
| `scripts/check-file-size-ratchet.mjs` | script | 190 | 202 | 8883 | 10 | 5 | 1 | 0 | NORMAL | infra | NORMAL — baseline updates are deliberate, reviewable growth records | M |
| `apps/prototype-web/client/src/EventsLayer.familyGuard.dom.test.tsx` | test | 189 | 213 | 10370 | 0 | 17 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/storage/local/recurringExpenseCommitGuard.test.ts` | test | 188 | 193 | 7910 | 0 | 5 | 0 | 0 | NORMAL | storage | TEST — judged as test asset, not production | — |
| `scripts/theme-contrast-guard.py` | script | 188 | 219 | 9247 | 0 | 2 | 0 | 0 | NORMAL | infra | INFRA — change via own slice only | — |
| `scripts/check-module-boundaries.test.mjs` | test | 187 | 198 | 9115 | 0 | 7+ | 0 | 0 | NORMAL | infra | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/application/security/localLockService.test.ts` | test | 186 | 197 | 10103 | 0 | 3 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/PurchasingBridgeExe011.dom.test.tsx` | test | 185 | 200 | 9481 | 0 | 12 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/diagnostics/localDiagnosticsService.test.ts` | test | 185 | 199 | 8192 | 0 | 3 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/InventoryAdjustExe012.dom.test.tsx` | test | 183 | 195 | 9405 | 0 | 10 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/Accessibility.w44.dom.test.tsx` | test | 180 | 197 | 8874 | 0 | 12 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/OrderShare.exe015.dom.test.tsx` | test | 180 | 197 | 9629 | 0 | 20 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `scripts/check-runtime-cycles.test.mjs` | test | 178 | 190 | 9193 | 0 | 8+ | 0 | 0 | NORMAL | infra | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/FinanceJourneys.dom.test.tsx` | test | 177 | 192 | 10280 | 0 | 25 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/U07.dom.test.tsx` | test | 177 | 193 | 9831 | 0 | 18 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/application/fulfillment/deliveryReversalStaleResults.test.ts` | test | 177 | 184 | 7532 | 0 | 6 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/application/fulfillment/reviewLockBoundary.test.ts` | test | 176 | 183 | 7126 | 0 | 7 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/estimates/costEstimateService.test.ts` | test | 175 | 186 | 8588 | 0 | 5+ | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/finance/periodPresets.test.ts` | test | 170 | 185 | 8420 | 0 | 2 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/app/ownershipBoundaries.exe017.test.ts` | test | 169 | 181 | 10869 | 0 | 3 | 0 | 0 | NORMAL | app-root | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/group6Docs.test.ts` | test | 169 | 181 | 11551 | 0 | 5 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/reentrancyGuards.test.ts` | test | 167 | 173 | 7884 | 0 | 7 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/catalog/catalogService.test.ts` | test | 166 | 172 | 6932 | 0 | 6 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/Nav003.exe016.dom.test.tsx` | test | 165 | 180 | 8212 | 0 | 9 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | M |
| `tests/domain/receivedLoan.test.ts` | test | 165 | 175 | 7289 | 0 | 2 | 0 | 0 | NORMAL | test | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/FinanceSafeWithdrawal.w176.dom.test.tsx` | test | 164 | 177 | 9395 | 0 | 23 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/FinanceEmptyTruth.dom.test.tsx` | test | 163 | 175 | 7969 | 0 | 24 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/U001.dom.test.tsx` | test | 163 | 174 | 9085 | 0 | 17 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/U01.dom.test.tsx` | test | 163 | 182 | 6821 | 0 | 10 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `scripts/check-file-size-ratchet.test.mjs` | test | 163 | 177 | 8074 | 0 | 8 | 0 | 0 | NORMAL | infra | TEST — judged as test asset, not production | M |
| `scripts/check-test-focus.test.mjs` | test | 163 | 178 | 7032 | 0 | 8 | 0 | 0 | NORMAL | infra | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/CashVocabulary.w43.dom.test.tsx` | test | 162 | 172 | 7993 | 0 | 12 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/agreements/agreementService.test.ts` | test | 162 | 167 | 6641 | 0 | 5 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/loans/loanService.test.ts` | test | 162 | 173 | 8152 | 0 | 3 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/application/finance/projectFinancialService.familyContexts.test.ts` | test | 161 | 168 | 7759 | 0 | 4 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/InventoryLowStock.dom.test.tsx` | test | 160 | 171 | 8014 | 0 | 10 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/transfers/localTransferService.envelope27.test.ts` | test | 160 | 170 | 9609 | 0 | 5 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/storage/local/cashContinuityOpeningGuard.test.ts` | test | 160 | 173 | 7241 | 0 | 7 | 0 | 0 | NORMAL | storage | TEST — judged as test asset, not production | — |
| `tests/domain/catalog.test.ts` | test | 159 | 164 | 5890 | 0 | 2 | 0 | 0 | NORMAL | test | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/finance/projectFinancialService.redelivery.test.ts` | test | 158 | 164 | 6583 | 0 | 5 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/presentation/stateAdapter.test.ts` | test | 157 | 177 | 6962 | 0 | 5 | 0 | 0 | NORMAL | presentation | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/ActualTimePanel.dom.test.tsx` | test | 156 | 167 | 7524 | 0 | 6 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/CatalogPlannedCost.dom.test.tsx` | test | 153 | 162 | 6105 | 0 | 13 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/FinanceMore.w42.dom.test.tsx` | test | 153 | 173 | 9661 | 0 | 12 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/inventory/materialSuggestions.test.ts` | test | 153 | 164 | 6600 | 0 | 4 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/cash/walletLedgerService.test.ts` | test | 152 | 158 | 6843 | 0 | 5 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/FinancePoliciesWallet.w42.dom.test.tsx` | test | 151 | 170 | 8530 | 0 | 9 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/U004.dom.test.tsx` | test | 151 | 164 | 7666 | 0 | 14 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/transfers/transferCompatibilityRegistry.test.ts` | test | 151 | 160 | 8555 | 0 | 10 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/app/navigationContract.test.ts` | test | 150 | 155 | 8024 | 0 | 2 | 0 | 0 | NORMAL | app-root | TEST — judged as test asset, not production | — |
| `scripts/check-secrets.test.mjs` | test | 150 | 166 | 7511 | 0 | 8 | 0 | 0 | NORMAL | infra | TEST — judged as test asset, not production | — |
| `docs/operations/control/generated/MASTER-TRACKER.xlsx.meta.json` | generated | 148 | 148 | 7787 | 0 | 0 | 0 | 0 | NORMAL | ops-generated | GENERATED — no hand edits | — |
| `apps/prototype-web/client/src/application/fulfillment/deliveryAttribution.test.ts` | test | 146 | 156 | 6245 | 0 | 3 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/G3Cash.dom.test.tsx` | test | 145 | 161 | 7789 | 0 | 8 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/CatalogItemResult.w177.dom.test.tsx` | test | 144 | 150 | 5943 | 0 | 6 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/G004CapabilityDeepLinks.dom.test.tsx` | test | 144 | 155 | 6828 | 0 | 8 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/financial-records/expenseRecordIntent.test.ts` | test | 144 | 156 | 5967 | 0 | 3 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/transfers/domainTransferDriftGuard.test.ts` | test | 144 | 151 | 7239 | 0 | 10 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | M |
| `apps/prototype-web/scripts/check-bundle-budget.mjs` | script | 144 | 155 | 8047 | 9 | 5 | 4 | 0 | NORMAL | infra | INFRA — change via own slice only | M |
| `apps/prototype-web/client/src/Set003Capabilities.dom.test.tsx` | test | 143 | 152 | 7689 | 0 | 18 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/components/order/ActualMaterialPanel.dom.test.tsx` | test | 142 | 152 | 6646 | 0 | 4 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `scripts/check-secrets.mjs` | script | 142 | 152 | 7119 | 9 | 4 | 3 | 0 | NORMAL | infra | INFRA — change via own slice only | — |
| `tests/domain/expense-category-label.test.ts` | test | 142 | 149 | 6236 | 0 | 3 | 0 | 0 | NORMAL | test | TEST — judged as test asset, not production | — |
| `scripts/check-skill-references.mjs` | script | 141 | 149 | 6695 | 9 | 4 | 1 | 0 | NORMAL | infra | INFRA — change via own slice only | MO |
| `apps/prototype-web/client/src/FinanceShortCashHorizon.w175.dom.test.tsx` | test | 139 | 155 | 8643 | 0 | 23 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/transfers/localTransferService.assetResidual.test.ts` | test | 139 | 151 | 7075 | 0 | 6 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/components/ErrorBoundary.dom.test.tsx` | test | 139 | 153 | 7002 | 0 | 4 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/components/brand/BrandLaunchSplash.test.tsx` | test | 139 | 154 | 6055 | 0 | 3 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/PartiesLedger.dom.test.tsx` | test | 138 | 150 | 5536 | 0 | 9 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/application/drafts/draftService.test.ts` | test | 138 | 151 | 7514 | 0 | 3 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | M |
| `tests/domain/loan.test.ts` | test | 138 | 146 | 5427 | 0 | 2 | 0 | 0 | NORMAL | test | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/fulfillment/deliveryReviewService.lockedReview.test.ts` | test | 137 | 144 | 5871 | 0 | 5 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/application/parties/partyLedgerService.customerName.test.ts` | test | 137 | 142 | 5787 | 0 | 4 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/SuppliersDueAging.dom.test.tsx` | test | 136 | 150 | 6812 | 0 | 14 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/preferences/preferenceService.test.ts` | test | 136 | 150 | 6980 | 0 | 3 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | M |
| `scripts/check-doc-index-coverage.mjs` | script | 136 | 143 | 5948 | 6 | 4 | 1 | 0 | NORMAL | infra | INFRA — change via own slice only | — |
| `tests/domain/owner-safe-withdrawal.test.ts` | test | 136 | 149 | 6856 | 0 | 3 | 0 | 0 | NORMAL | test | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/SettingsDataBackupSection.w42.dom.test.tsx` | test | 133 | 146 | 7953 | 0 | 18 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/transfers/guidedOpeningImportService.g82.test.ts` | test | 132 | 141 | 6168 | 0 | 4 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/transfers/localTransferService.directSaleRoundTrip.test.ts` | test | 132 | 144 | 7017 | 0 | 5 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `tests/domain/shared.test.ts` | test | 132 | 141 | 4564 | 0 | 6 | 0 | 0 | NORMAL | test | TEST — judged as test asset, not production | — |
| `tests/domain/actual-time.test.ts` | test | 131 | 135 | 4091 | 0 | 2 | 0 | 0 | NORMAL | test | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/AppSurface.w43.dom.test.tsx` | test | 129 | 139 | 6851 | 0 | 6 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.recurringExpense.test.ts` | test | 129 | 136 | 5798 | 0 | 5 | 0 | 0 | NORMAL | storage | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/ReceivedLoanEditor.w178.dom.test.tsx` | test | 127 | 139 | 7048 | 0 | 8 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/DeepScreens.w43.dom.test.tsx` | test | 125 | 134 | 6716 | 0 | 16 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/finance/periodResultCanonical.test.ts` | test | 125 | 131 | 6103 | 0 | 5 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/parties/partyLedgerService.visibility.test.ts` | test | 125 | 132 | 5347 | 0 | 5 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/pages/Catalog.ui.test.ts` | test | 124 | 134 | 6260 | 0 | 3 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/V2Surface.w183.surfaceAudit.test.ts` | test | 121 | 138 | 6548 | 0 | 2 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `scripts/check-test-focus.mjs` | script | 121 | 131 | 5369 | 8 | 4 | 2 | 0 | NORMAL | infra | INFRA — change via own slice only | — |
| `apps/prototype-web/client/src/storage/local/orderCommitGuard.test.ts` | test | 119 | 129 | 5341 | 0 | 4 | 0 | 0 | NORMAL | storage | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/components/layout/QuickActionSheet.category.test.tsx` | test | 118 | 127 | 5838 | 0 | 7 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/transfers/guidedOpeningImportService.test.ts` | test | 117 | 122 | 4348 | 0 | 3 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/transfers/localTransferService.familyOrphan.test.ts` | test | 116 | 123 | 6045 | 0 | 5 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/transfers/localTransferService.schema29.test.ts` | test | 116 | 121 | 5876 | 0 | 6 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/ToolsIntegrity.ui.test.tsx` | test | 115 | 125 | 6838 | 0 | 11 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/presentation/formatters.test.ts` | test | 115 | 130 | 6430 | 0 | 2 | 0 | 0 | NORMAL | presentation | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/G5Activity.dom.test.tsx` | test | 114 | 126 | 5244 | 0 | 9 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/app/routeParamRegistry.exe016.test.ts` | test | 114 | 122 | 6396 | 0 | 3 | 0 | 0 | NORMAL | app-root | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/moneyLayerGuard.contract.test.ts` | test | 114 | 123 | 6595 | 0 | 4 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `tests/domain/rounding-boundaries.characterization.test.ts` | test | 114 | 120 | 7206 | 0 | 5 | 0 | 0 | NORMAL | test | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/pages/Foundation.ui.test.tsx` | test | 113 | 133 | 5603 | 0 | 5 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/group3Docs.test.ts` | test | 111 | 121 | 7088 | 0 | 4 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/drafts/formDraftService.test.ts` | test | 110 | 118 | 5716 | 0 | 3 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/pwa/register.dom.test.ts` | test | 110 | 124 | 5403 | 0 | 1+ | 0 | 0 | NORMAL | pwa | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/Set003SettingsSection.dom.test.tsx` | test | 109 | 118 | 5904 | 0 | 19 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/IntegrityReadable.w43.dom.test.tsx` | test | 108 | 115 | 6101 | 0 | 12 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `tests/domain/amanah-loss.test.ts` | test | 105 | 107 | 4085 | 0 | 2 | 0 | 0 | NORMAL | test | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/DevicePwa.w44.dom.test.tsx` | test | 103 | 114 | 5657 | 0 | 3 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `tests/domain/waste-context.characterization.test.ts` | test | 103 | 112 | 4784 | 0 | 3 | 0 | 0 | NORMAL | test | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/components/forms/UnsavedChangesGuard.history.test.tsx` | test | 102 | 114 | 4627 | 0 | 5 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/storage/local/CatalogCoreStorage.test.ts` | test | 102 | 106 | 4116 | 0 | 4 | 0 | 0 | NORMAL | storage | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/financial-pulse/financialPulseService.test.ts` | test | 101 | 106 | 4428 | 0 | 7 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/components/layout/QuickActionSheet.guard.test.tsx` | test | 101 | 123 | 5856 | 0 | 5 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/transfers/transferCounters.migrations.characterization.test.ts` | test | 99 | 108 | 4734 | 0 | 8 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `scripts/operations-control/test_operations_control.py` | script | 99 | 117 | 5094 | 0 | 3 | 0 | 0 | NORMAL | infra | INFRA — change via own slice only | — |
| `apps/prototype-web/client/src/application/transfers/localTransferService.schema33.test.ts` | test | 98 | 108 | 4811 | 0 | 5 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/U05.dom.test.tsx` | test | 95 | 106 | 5771 | 0 | 17 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/cost/costService.test.ts` | test | 94 | 101 | 4423 | 0 | 4 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/group2ClosureDocs.test.ts` | test | 94 | 101 | 6185 | 0 | 4 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/group5Docs.test.ts` | test | 94 | 102 | 5807 | 0 | 4 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/transfers/localTransferService.rel001.test.ts` | test | 93 | 103 | 5138 | 0 | 4 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/R3.themeBehavior.test.tsx` | test | 92 | 101 | 4687 | 0 | 8 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/U11.dom.test.tsx` | test | 92 | 101 | 4846 | 0 | 18 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/input/englishNumeric.test.ts` | test | 90 | 97 | 4128 | 0 | 2 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/components/brand/BrandMigrationGate.test.ts` | test | 90 | 99 | 4177 | 0 | 4 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/exact-values.characterization.test.ts` | test | 90 | 99 | 5521 | 0 | 4 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/U005.dom.test.tsx` | test | 89 | 99 | 4463 | 0 | 8 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/R2.financeActivityVoid.test.tsx` | test | 87 | 97 | 3850 | 0 | 7 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `docs/operations/control/generated/MASTER-TRACKER.md` | generated | 85 | 88 | 19248 | 0 | 0 | 0 | 0 | NORMAL | ops-generated | GENERATED — regenerate only via official generator | — |
| `apps/prototype-web/client/src/R1.orderDetailVoid.test.tsx` | test | 83 | 94 | 4404 | 0 | 6 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/transfers/transferEnvelope.characterization.test.ts` | test | 82 | 91 | 4597 | 0 | 4 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `docs/operations/control/generated/MASTER-TRACKER.csv` | generated | 81 | 81 | 66549 | 0 | 0 | 0 | 0 | NORMAL | ops-generated | GENERATED — no hand edits | — |
| `scripts/check-image-policy.mjs` | script | 81 | 87 | 4086 | 6 | 4 | 1 | 0 | NORMAL | infra | INFRA — change via own slice only | — |
| `scripts/check-current-state-size.mjs` | script | 80 | 85 | 3943 | 6 | 4 | 1 | 0 | NORMAL | infra | INFRA — change via own slice only | — |
| `apps/prototype-web/client/src/R2.keyboardFocus.test.tsx` | test | 78 | 91 | 4592 | 0 | 6 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `tests/domain/quantity-characterization.test.ts` | test | 75 | 83 | 4617 | 0 | 2 | 0 | 0 | NORMAL | test | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/components/forms/UnsavedChangesGuard.saveFailure.dom.test.tsx` | test | 73 | 80 | 3405 | 0 | 4 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `.github/workflows/ci.yml` | config | 72 | 84 | 3074 | 0 | 0 | 0 | 0 | NORMAL | infra | INFRA — change via own slice only | — |
| `apps/prototype-web/client/src/U10.dom.test.tsx` | test | 72 | 82 | 3173 | 0 | 5 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/finance/shortCashHorizon.test.ts` | test | 72 | 80 | 3745 | 0 | 2 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/financial-records/expenseCategorySuggestions.test.ts` | test | 72 | 78 | 3139 | 0 | 3 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/owner/ownerProfileService.test.ts` | test | 72 | 78 | 3977 | 0 | 3 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/components/forms/useFormDirty.dom.test.tsx` | test | 71 | 82 | 4197 | 0 | 4 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `tests/domain/exact-values.characterization.test.ts` | test | 70 | 79 | 3852 | 0 | 2 | 0 | 0 | NORMAL | test | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/components/brand/BrandMark.test.tsx` | test | 69 | 80 | 3423 | 0 | 3 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/legacyClassCensus.test.ts` | test | 69 | 75 | 2905 | 0 | 4 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/follow-up/dailyFollowUpService.test.ts` | test | 68 | 73 | 2972 | 0 | 2 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/ToolsCleanup.w42.dom.test.tsx` | test | 67 | 78 | 3941 | 0 | 7 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/Wave42Package5.contract.test.ts` | test | 67 | 74 | 4858 | 0 | 4 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/transfers/localTransferService.capabilitiesRoundTrip.test.ts` | test | 67 | 74 | 3929 | 0 | 5 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/pwa/PwaRuntimeNotice.dom.test.tsx` | test | 67 | 76 | 3161 | 0 | 5 | 0 | 0 | NORMAL | pwa | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/pages/Catalog.operationKey.test.ts` | test | 66 | 76 | 3095 | 0 | 2 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/presentation/businessTime.characterization.test.ts` | test | 66 | 76 | 4530 | 0 | 2 | 0 | 0 | NORMAL | presentation | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/Clean001.surfaceAudit.test.tsx` | test | 63 | 70 | 3449 | 0 | 5 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.open-count.test.ts` | test | 63 | 67 | 2923 | 0 | 3 | 0 | 0 | NORMAL | storage | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/group4Docs.test.ts` | test | 61 | 68 | 3768 | 0 | 4 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `scripts/check-skill-references.test.mjs` | test | 59 | 64 | 2838 | 0 | 5 | 0 | 0 | NORMAL | infra | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/storage/local/persistentStorage.test.ts` | test | 58 | 67 | 2708 | 0 | 2 | 0 | 0 | NORMAL | storage | TEST — judged as test asset, not production | — |
| `scripts/check-image-policy.test.mjs` | test | 58 | 63 | 2406 | 0 | 5 | 0 | 0 | NORMAL | infra | TEST — judged as test asset, not production | — |
| `.github/pull_request_template.md` | config | 57 | 72 | 5790 | 0 | 0 | 1 | 0 | NORMAL | infra | INFRA — change via own slice only | — |
| `tests/domain/businessTime.test.ts` | test | 56 | 63 | 3113 | 0 | 2 | 0 | 0 | NORMAL | test | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/diagnostics/routeTemplateSync.test.ts` | test | 54 | 60 | 3235 | 0 | 4 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `scripts/check-current-state-size.test.mjs` | test | 54 | 59 | 2944 | 0 | 5 | 0 | 0 | NORMAL | infra | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/input/englishNumeric.exact.test.ts` | test | 52 | 57 | 2634 | 0 | 2 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/components/forms/UnsavedChangesGuard.dirtyBridge.dom.test.tsx` | test | 52 | 59 | 2251 | 0 | 5 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/Wave3Glossary.contract.test.ts` | test | 48 | 53 | 3398 | 0 | 3 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/presentation/orderAgreementPresentation.test.ts` | test | 46 | 49 | 1802 | 0 | 2 | 0 | 0 | NORMAL | presentation | TEST — judged as test asset, not production | — |
| `package.json` | config | 45 | 45 | 2514 | 0 | 0 | 0 | 0 | NORMAL | infra | INFRA — change via own slice only | — |
| `.stylelintrc.json` | config | 44 | 44 | 746 | 0 | 0 | 1 | 0 | NORMAL | infra | INFRA — change via own slice only | — |
| `apps/prototype-web/client/src/app/routeClassifier.test.ts` | test | 44 | 48 | 1966 | 0 | 2 | 0 | 0 | NORMAL | app-root | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/pages/OwnerEntitlement.ui.test.ts` | test | 44 | 47 | 1990 | 0 | 2 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/storage/local/saveOrderGuard.contract.test.ts` | test | 44 | 46 | 2418 | 0 | 4 | 0 | 0 | NORMAL | storage | TEST — judged as test asset, not production | — |
| `apps/prototype-web/package.json` | config | 44 | 44 | 1184 | 0 | 0 | 0 | 0 | NORMAL | infra | INFRA — change via own slice only | — |
| `apps/prototype-web/client/src/app/navigation.test.ts` | test | 43 | 47 | 2259 | 0 | 3 | 0 | 0 | NORMAL | app-root | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/components/layout/QuickActionSheet.test.ts` | test | 41 | 48 | 2135 | 0 | 2 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/profile/profileService.test.ts` | test | 40 | 42 | 1651 | 0 | 3 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | M |
| `apps/prototype-web/client/src/U09.css.test.ts` | test | 39 | 45 | 2405 | 0 | 3 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/index.html` | config | 36 | 37 | 2681 | 0 | 0 | 6 | 0 | NORMAL | infra | INFRA — change via own slice only | — |
| `apps/prototype-web/client/src/application/scheduling/capacityDecisionViewModel.test.ts` | test | 36 | 40 | 1878 | 0 | 3 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/pwa/install.test.ts` | test | 35 | 40 | 1796 | 0 | 2 | 0 | 0 | NORMAL | pwa | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/scheduling/capacityDecisionService.test.ts` | test | 34 | 36 | 1235 | 0 | 3 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/presentation/plurals.test.ts` | test | 33 | 37 | 1758 | 0 | 2 | 0 | 0 | NORMAL | presentation | TEST — judged as test asset, not production | — |
| `.gitignore` | config | 32 | 38 | 348 | 0 | 0 | 1 | 0 | NORMAL | infra | INFRA — change via own slice only | — |
| `.replit` | config | 32 | 43 | 731 | 0 | 0 | 2 | 0 | NORMAL | infra | INFRA — change via own slice only | — |
| `apps/prototype-web/client/src/application/agreements/agreementPrice.test.ts` | test | 32 | 36 | 1552 | 0 | 2 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/application/input/englishNumeric.normalize.test.ts` | test | 29 | 34 | 2053 | 0 | 2 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `scripts/check-doc-index-coverage.test.mjs` | test | 29 | 32 | 1437 | 0 | 5 | 0 | 0 | NORMAL | infra | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/components/forms/UnsavedChangesGuard.test.ts` | test | 28 | 33 | 1410 | 0 | 2 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/presentation/cashCountMessages.test.ts` | test | 28 | 31 | 1543 | 0 | 2 | 0 | 0 | NORMAL | presentation | TEST — judged as test asset, not production | — |
| `docs/operations/control/generated/NEXT-ACTIONS.md` | generated | 28 | 30 | 11263 | 0 | 0 | 0 | 0 | NORMAL | ops-generated | GENERATED — no hand edits | — |
| `apps/prototype-web/client/src/application/identity/buildIdentity.test.ts` | test | 25 | 30 | 1724 | 0 | 2 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/app/StartupGate.recovery.test.ts` | test | 24 | 28 | 1456 | 0 | 3 | 0 | 0 | NORMAL | app-root | TEST — judged as test asset, not production | — |
| `apps/prototype-web/tsconfig.json` | config | 24 | 24 | 691 | 0 | 0 | 0 | 0 | NORMAL | infra | INFRA — change via own slice only | — |
| `docs/operations/control/generated/AGENT-BRIEF.md` | generated | 24 | 37 | 2493 | 0 | 0 | 0 | 0 | NORMAL | ops-generated | GENERATED — no hand edits | — |
| `apps/prototype-web/vitest.config.ts` | config | 22 | 23 | 891 | 1 | 3 | 3 | 0 | NORMAL | infra | INFRA — change via own slice only | — |
| `docs/fixtures/g82-guided-opening-import-fixtures.json` | fixture | 22 | 22 | 1750 | 0 | 0 | 1 | 0 | NORMAL | infra | PRESERVE; Wave 3A added 28 export goldens under docs/fixtures/export-goldens/ beside it | — |
| `apps/prototype-web/client/src/application/agreements/followUpDate.test.ts` | test | 20 | 24 | 1078 | 0 | 2 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `apps/prototype-web/client/src/components/forms/EnglishQuantityInput.test.ts` | test | 20 | 24 | 1225 | 0 | 2 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `apps/prototype-web/tsconfig.node.json` | config | 20 | 22 | 479 | 0 | 0 | 1 | 0 | NORMAL | infra | INFRA — change via own slice only | — |
| `.claude/settings.json` | config | 17 | 17 | 357 | 0 | 0 | 0 | 0 | NORMAL | infra | INFRA — change via own slice only | — |
| `apps/prototype-web/client/src/application/inventory/inventoryMovementRoute.test.ts` | test | 15 | 17 | 795 | 0 | 2 | 0 | 0 | NORMAL | application | TEST — judged as test asset, not production | — |
| `tsconfig.json` | config | 15 | 15 | 354 | 0 | 0 | 0 | 0 | NORMAL | infra | INFRA — change via own slice only | — |
| `docs/fixtures/export-goldens/legacy-minimal-10-19.golden.json` | fixture | 14 | 14 | 276 | 0 | 0 | 0 | 0 | NORMAL | infra | FIXTURE — version with its consumer | — |
| `docs/fixtures/export-goldens/legacy-minimal-11-20.golden.json` | fixture | 14 | 14 | 276 | 0 | 0 | 0 | 0 | NORMAL | infra | FIXTURE — version with its consumer | — |
| `docs/fixtures/export-goldens/legacy-minimal-12-21.golden.json` | fixture | 14 | 14 | 276 | 0 | 0 | 0 | 0 | NORMAL | infra | FIXTURE — version with its consumer | — |
| `docs/fixtures/export-goldens/legacy-minimal-13-22.golden.json` | fixture | 14 | 14 | 276 | 0 | 0 | 0 | 0 | NORMAL | infra | FIXTURE — version with its consumer | — |
| `docs/fixtures/export-goldens/legacy-minimal-14-23.golden.json` | fixture | 14 | 14 | 276 | 0 | 0 | 0 | 0 | NORMAL | infra | FIXTURE — version with its consumer | — |
| `docs/fixtures/export-goldens/legacy-minimal-15-24.golden.json` | fixture | 14 | 14 | 276 | 0 | 0 | 0 | 0 | NORMAL | infra | FIXTURE — version with its consumer | — |
| `docs/fixtures/export-goldens/legacy-minimal-16-25.golden.json` | fixture | 14 | 14 | 276 | 0 | 0 | 0 | 0 | NORMAL | infra | FIXTURE — version with its consumer | — |
| `docs/fixtures/export-goldens/legacy-minimal-17-26.golden.json` | fixture | 14 | 14 | 276 | 0 | 0 | 0 | 0 | NORMAL | infra | FIXTURE — version with its consumer | — |
| `docs/fixtures/export-goldens/legacy-minimal-18-27.golden.json` | fixture | 14 | 14 | 276 | 0 | 0 | 0 | 0 | NORMAL | infra | FIXTURE — version with its consumer | — |
| `docs/fixtures/export-goldens/legacy-minimal-19-27.golden.json` | fixture | 14 | 14 | 276 | 0 | 0 | 0 | 0 | NORMAL | infra | FIXTURE — version with its consumer | — |
| `docs/fixtures/export-goldens/legacy-minimal-20-28.golden.json` | fixture | 14 | 14 | 276 | 0 | 0 | 0 | 0 | NORMAL | infra | FIXTURE — version with its consumer | — |
| `docs/fixtures/export-goldens/legacy-minimal-21-29.golden.json` | fixture | 14 | 14 | 276 | 0 | 0 | 0 | 0 | NORMAL | infra | FIXTURE — version with its consumer | — |
| `docs/fixtures/export-goldens/legacy-minimal-22-30.golden.json` | fixture | 14 | 14 | 276 | 0 | 0 | 0 | 0 | NORMAL | infra | FIXTURE — version with its consumer | — |
| `docs/fixtures/export-goldens/legacy-minimal-23-31.golden.json` | fixture | 14 | 14 | 276 | 0 | 0 | 0 | 0 | NORMAL | infra | FIXTURE — version with its consumer | — |
| `docs/fixtures/export-goldens/legacy-minimal-24-32.golden.json` | fixture | 14 | 14 | 276 | 0 | 0 | 0 | 0 | NORMAL | infra | FIXTURE — version with its consumer | — |
| `docs/fixtures/export-goldens/legacy-minimal-25-33.golden.json` | fixture | 14 | 14 | 276 | 0 | 0 | 0 | 0 | NORMAL | infra | FIXTURE — version with its consumer | — |
| `docs/fixtures/export-goldens/legacy-minimal-26-34.golden.json` | fixture | 14 | 14 | 276 | 0 | 0 | 0 | 0 | NORMAL | infra | FIXTURE — version with its consumer | — |
| `docs/fixtures/export-goldens/legacy-minimal-27-35.golden.json` | fixture | 14 | 14 | 276 | 0 | 0 | 0 | 0 | NORMAL | infra | FIXTURE — version with its consumer | — |
| `docs/fixtures/export-goldens/legacy-minimal-28-36.golden.json` | fixture | 14 | 14 | 276 | 0 | 0 | 0 | 0 | NORMAL | infra | FIXTURE — version with its consumer | — |
| `docs/fixtures/export-goldens/legacy-minimal-29-37.golden.json` | fixture | 14 | 14 | 276 | 0 | 0 | 0 | 0 | NORMAL | infra | FIXTURE — version with its consumer | — |
| `docs/fixtures/export-goldens/legacy-minimal-6-14.golden.json` | fixture | 14 | 14 | 275 | 0 | 0 | 0 | 0 | NORMAL | infra | FIXTURE — version with its consumer | — |
| `docs/fixtures/export-goldens/legacy-minimal-7-15.golden.json` | fixture | 14 | 14 | 275 | 0 | 0 | 0 | 0 | NORMAL | infra | FIXTURE — version with its consumer | — |
| `docs/fixtures/export-goldens/legacy-minimal-8-17.golden.json` | fixture | 14 | 14 | 275 | 0 | 0 | 0 | 0 | NORMAL | infra | FIXTURE — version with its consumer | — |
| `docs/fixtures/export-goldens/legacy-minimal-9-18.golden.json` | fixture | 14 | 14 | 275 | 0 | 0 | 0 | 0 | NORMAL | infra | FIXTURE — version with its consumer | — |
| `todo.md` | config | 12 | 15 | 18256 | 0 | 0 | 7 | 0 | NORMAL | infra | INFRA — change via own slice only | — |
| `apps/prototype-web/client/src/pages/OwnerWithdrawalEditor.ui.test.ts` | test | 10 | 12 | 576 | 0 | 2 | 0 | 0 | NORMAL | ui | TEST — judged as test asset, not production | — |
| `vitest.config.ts` | config | 8 | 9 | 415 | 1 | 1 | 3 | 0 | NORMAL | infra | INFRA — change via own slice only | — |
| `.prettierrc.json` | config | 6 | 6 | 100 | 0 | 0 | 1 | 0 | NORMAL | infra | INFRA — change via own slice only | — |
| `scripts/post-merge.sh` | script | 6 | 8 | 170 | 1 | 0 | 0 | 0 | NORMAL | infra | INFRA — change via own slice only | — |
| `docs/operations/control/generated/ACTIVE-WORK.md` | generated | 5 | 7 | 850 | 0 | 0 | 0 | 0 | NORMAL | ops-generated | GENERATED — no hand edits | — |
| `pnpm-workspace.yaml` | config | 4 | 5 | 63 | 0 | 0 | 1 | 0 | NORMAL | infra | INFRA — change via own slice only | — |
| `.gitattributes` | config | 1 | 2 | 49 | 0 | 0 | 1 | 0 | NORMAL | infra | INFRA — change via own slice only | — |

## 3. بطاقات الملفات عالية الخطورة (SPLIT_NOW / SPLIT_CANDIDATE / أدوار مصدر حقيقة)

### `apps/prototype-web/client/src/index.css`

- **الفئة/الطبقة:** production / ui — **nbLOC:** 6778 (raw 6837، 179128 bytes)
- **المسؤولية:** Global stylesheet (design tokens base)
- **Exports/Imports:** 0/0
- **المستهلكون المباشرون (1):** `apps/prototype-web/client/src/main.tsx`
- **آثار جانبية/تهيئة:** لا تُكتشف بالنمط
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** —
- **الاختبارات المباشرة (0):** لا تغطية مباشرة (انظر بطاقات الفجوة)
- **الإجراء:** UI_OUT_OF_SCOPE (design-token guards govern) *(تأكيد مؤرخ 2026-10-09 — R6-W1 [R6-SCAN-F-018]: خارج R6 إلى track T البصري — يحرسه design-token guards وtheme-contrast وstylelint؛ الملف واحد من نطاق مسح R6 الـ26 ومصنف OUT_OF_SCOPE صراحةً في مصفوفة §8)*؛ **أثر الرجوع:** LOW؛ **الاستثناء/التنازل:** —

### `apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.ts`

- **الفئة/الطبقة:** production / storage — **nbLOC:** 4135 (raw 4139، 170456 bytes)
- **المسؤولية:** IndexedDB adapter: 131 methods *(تصحيح مؤرخ 2026-10-07 — R1/TG-01: الحي **130** طريقة بعد STR-618)*, 37 stores, migrations, snapshot freeze
- **Exports/Imports:** 2/30
- **المستهلكون المباشرون (21):** `apps/prototype-web/client/src/application/finance/fullCycleReconciliation.exe013.test.ts`, `apps/prototype-web/client/src/storage/local/CatalogCoreStorage.test.ts`, `apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.delivery.test.ts`, `apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.expenseBudget.test.ts`, `apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.group2.test.ts`, `apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.group4.test.ts`, `apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.open-count.test.ts`, `apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.receivedLoan.test.ts`, `apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.recurringExpense.test.ts`, `apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.test.ts`
- **آثار جانبية/تهيئة:** module-mutable
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** Adapter implementation of the port (IndexedDB specifics isolated here)
- **الاختبارات المباشرة (19):** `fullCycleReconciliation.exe013.test.ts`, `CatalogCoreStorage.test.ts`, `IndexedDbLocalStore.delivery.test.ts`, `IndexedDbLocalStore.expenseBudget.test.ts`, `IndexedDbLocalStore.group2.test.ts`, `IndexedDbLocalStore.group4.test.ts`, `IndexedDbLocalStore.open-count.test.ts`, `IndexedDbLocalStore.receivedLoan.test.ts` *(تصحيح مؤرخ 2026-10-09 — R6-W1 [R6-SCAN-F-007]: العدد الحي **35** ملف اختبار مباشر عند `fd92d7e8` بعد أجنحة R3/R4/R5 — التعداد بالقياس الحي لا يُعدَّل نص التاريخ أعلاه)*
- **الإجراء:** PRESERVE — **استثناء طويل الأجل مقبول (W6/عقد ما بعد المسح، 2026-10-05، قرار المالك 5؛ أرقام مصححة بمصالحة R6-W1 2026-10-09 [R6-SCAN-F-007/F-010]):** المالك: مالك Micro؛ السبب: مسؤولية واحدة (تنفيذ منفذ PrototypeLocalStore لجهة IndexedDB) — الحجم دالة اتساع المنفذ (130 طريقة مصنفة 130/130 — *(تصحيح مؤرخ 2026-10-07 — R1/TG-01: كان «131 طريقة مصنفة 130/130» تناقضًا داخليًا؛ العدد الحي 130 بُناء على الواجهة [STR-618])* ) لا اختلاط مسؤوليات، والعائلة مقسمة سلفًا *(تصحيح مؤرخ 2026-10-09 — R6-W1 [R6-SCAN-F-007]: كان «7 منافذ قدرات» — الحي **16 مجموعة منافذ قدرات** بعد ADR-015 وR3: actualTime، allocationPolicy، asset، catalog، costEstimate، directSale، expenseBudget، financialEvent، inventoryMaterial، loan، orderLifecycle، ownerEntitlement، recurringExpense، schedule، shortCashDeclaration، supplierPurchase)* و*(تصحيح مؤرخ 2026-10-09 — R6-W1 [R6-SCAN-F-007]: كان «10 حراس كتابة مستقلة» — الحي **9 ملفات حراس كتابة** كما في سجل الملكية §2)؛ حد النمو: مثبت بالراتشة (4,135 nbLOC / 4,139 raw — لا عبور)؛ الحراس: check-file-size-ratchet + أجنحة التكافؤ *(تصحيح مؤرخ 2026-10-09 — R6-W1 [R6-SCAN-F-007]: كانت «مصفوفة مطابقة المحولين 13/13 + عقود القدرات 42/42» أرقامًا متقادمة — الحي: **6 ملفات conformance + 16 ملف عقود قدرات** عبر الزوجين [R3/R4])* + حارس الكيانات؛ محفز المراجعة: أي مجموعة قدرة جديدة أو ترحيل أو عبور شريط أو فتح موجة O؛ الشرط الخروجي: قرار مالك مستقبلي بمنصّة المحولات (Wave O — يحكم المحولين معًا كزوج تكافؤ واحد [R6-SCAN-F-010]) أو تقلص المنفذ نفسه؛ حد الرجوع: لا تغيير في هذا الاستثناء (توثيقي) — إلغاؤه بقرار مالك؛ **أثر الرجوع:** HIGH؛ **الاستثناء/التنازل:** موثق كاملًا أعلاه

### `apps/prototype-web/client/src/storage/local/MemoryLocalStore.ts`

- **الفئة/الطبقة:** production / storage — **nbLOC:** 2091 (raw 2099، 99357 bytes)
- **المسؤولية:** In-memory adapter: 131 methods *(تصحيح مؤرخ 2026-10-07 — R1/TG-01: الحي **130** بعد STR-618)* mirroring IndexedDB semantics for tests/parity
- **Exports/Imports:** 1/25
- **المستهلكون المباشرون (180):** `apps/prototype-web/client/src/Accessibility.w44.dom.test.tsx`, `apps/prototype-web/client/src/ActualTimePanel.dom.test.tsx`, `apps/prototype-web/client/src/ArabicRtlContent.w44.dom.test.tsx`, `apps/prototype-web/client/src/CashJourneys.dom.test.tsx`, `apps/prototype-web/client/src/CashVocabulary.w43.dom.test.tsx`, `apps/prototype-web/client/src/CatalogPlannedCost.dom.test.tsx`, `apps/prototype-web/client/src/D005.dom.test.tsx`, `apps/prototype-web/client/src/DeepScreens.w43.dom.test.tsx`, `apps/prototype-web/client/src/EventsLayer.familyGuard.dom.test.tsx`, `apps/prototype-web/client/src/FinalLogicOwnerDecisions.contract.test.ts`
- **آثار جانبية/تهيئة:** module-mutable
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** Second adapter proving port substitutability
- **الاختبارات المباشرة (178):** `Accessibility.w44.dom.test.tsx`, `ActualTimePanel.dom.test.tsx`, `ArabicRtlContent.w44.dom.test.tsx`, `CashJourneys.dom.test.tsx`, `CashVocabulary.w43.dom.test.tsx`, `CatalogPlannedCost.dom.test.tsx`, `D005.dom.test.tsx`, `DeepScreens.w43.dom.test.tsx` *(تصحيح مؤرخ 2026-10-09 — R6-W1 [R6-SCAN-F-007]: العدد الحي **198** ملف اختبار مباشر عند `fd92d7e8` بعد أجنحة R3–R5 — قائمة الأسماء أعلاه تاريخية عند رأس القياس)*
- **الإجراء:** PRESERVE — **استثناء طويل الأجل مقبول (W6/عقد ما بعد المسح، 2026-10-05، قرار المالك 5):** نفس أساس المحول الرئيسي حرفيًا: مسؤولية واحدة (المرآة الذاكرية المثبتة لقابلية استبدال المحول)؛ السيميائية المطابقة حرفيًا يحرسها 178 ملف اختبار مباشرًا *(الحي 198 — تصحيح R6-W1/F-007)* + أجنحة التكافؤ الحية (6 conformance + 16 عقود قدرات عبر الزوجين — تصحيح R6-W1/F-007 لـ«مصفوفة المطابقة»)؛ حد النمو: مثبت بالراتشة (2,091 nbLOC / 2,099 raw)؛ المحفزات والشرط الخروجي كما في بطاقة المحول الرئيسي (قرار مالك واحد يحكم الثنين معًا — هما زوج التكافؤ)؛ **أثر الرجوع:** HIGH؛ **الاستثناء/التنازل:** موثق كاملًا أعلاه
- **مراجعة R4-A2 (مؤرخة 2026-10-08):** تحقق حي عند `1c54c55` — التصنيف production/storage/PRESERVE (لا «visual-UI out-of-scope» في أي سجل حي: هذا السجل وعقد 40 وتقرير R0 كلها production/storage). **التصرف النهائي:** `PRESERVE_BY_DESIGN` مع تسليم صريح لموجة R6 المعتمدة (قائمة فحص R6 الإلزامية تتضمن الملف): أي شطر حقيقي للمحول الذاكري يقرره R6 بقرار مالك بعد إعادة الفحص؛ بطاقة W6 تبقى الحارس حتى ذلك الحين. عناصر البطاقة التسعة كاملة: المالك (storage)، السبب (أعلاه)، جرد المستهلكين (180)، حد النمو (راتشة 2,091/2,099)، الحارس (الراتشة + مصفوفة المطابقة)، محفز المراجعة (مجموعة قدرة جديدة/ترحيل/عبور شريط — كما في المحول الرئيسي)، الشرط الخروجي (قرار مالك ب modularization المحولات)، الاختبارات (178 مباشرًا)، حد الرجوع (HIGH).
- **قرار R6 (مصالحة R6-W1، 2026-10-09 [R6-SCAN-F-010 — إغلاق تسليم R4-A2]):** مسح R6 القراءة-فقط راجع الملف وأجاب حزمة القرار: **PRESERVE** — (أ) إبقاء المحولين كزوج تكافؤ (المقبول: تشغيل اختباري فقط، صفر أثر رزمة، لا أشقاء ذاكرة، حراس الكتابة التسعة مشتركون)؛ (ب) modularization لكل قدرة = **Wave O بقرار مالك يحكم المحولين معًا** كزوج واحد بأجنحة conformance كوَحْيَر؛ (ج) استخراج بدائيات مشتركة = مرفوض (سطح ثالث بلا مالك). الشرط الخروجي: قرار Wave O. محفزات المراجعة: مجموعة قدرة جديدة/ترحيل/عبور شريط. الدليل: تقرير مسح R6 §10/F-010 (`docs/operations/control/evidence/structural-remediation-r6-20261009/R6-PREFLIGHT-STRUCTURE-ARCHITECTURE-CODE-ORGANIZATION-SCAN-2026-10-09.md`).

### `apps/prototype-web/client/src/pages/OrderDetail.tsx`

- **الفئة/الطبقة:** production / ui — **nbLOC:** 1833 (raw 1888، 99913 bytes)
- **المسؤولية:** Order detail page (UI orchestrator)
- **Exports/Imports:** 1/28
- **المستهلكون المباشرون (12):** `apps/prototype-web/client/src/ArabicRtlContent.w44.dom.test.tsx`, `apps/prototype-web/client/src/G3.dom.test.tsx`, `apps/prototype-web/client/src/G3Delivery.dom.test.tsx`, `apps/prototype-web/client/src/G3Hardening.dom.test.tsx`, `apps/prototype-web/client/src/G4RetainedDeposit.dom.test.tsx`, `apps/prototype-web/client/src/G6.dom.test.tsx`, `apps/prototype-web/client/src/OrdJourneys.dom.test.tsx`, `apps/prototype-web/client/src/OrderDetail.ui.test.tsx`, `apps/prototype-web/client/src/OrderShare.exe015.dom.test.tsx`, `apps/prototype-web/client/src/R1.orderDetailVoid.test.tsx`
- **آثار جانبية/تهيئة:** module-mutable
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** —
- **الاختبارات المباشرة (11):** `ArabicRtlContent.w44.dom.test.tsx`, `G3.dom.test.tsx`, `G3Delivery.dom.test.tsx`, `G3Hardening.dom.test.tsx`, `G4RetainedDeposit.dom.test.tsx`, `G6.dom.test.tsx`, `OrdJourneys.dom.test.tsx`, `OrderDetail.ui.test.tsx`
- **الإجراء:** **حزمة R7 صريحة R6-F17-P01 `OrderDetail.tsx` [R6-SCAN-F-017 — تحويل المسار إلى DEFER package موثق بمصالحة R6-W1، 2026-10-09؛ كان إجراءً عامًا بلا أركان]:**
  - **المالك:** Micro owner (بوابة R7)؛ منفذ R7: منفذ موجة UI structural boundaries.
  - **المسؤولية/seam المتأثر:** منسّق صفحة تفصيل الطلب — 51 useState على مستوى الملف؛ 13 موقع مرآة مجمدة يحرسها W5-A moneyLayerGuard؛ ضمن عائلة المحررات 97–99% دالة واحدة.
  - **نطاق R7:** جرد استخراج view-model لكل قسم (الاتفاق/التسليم/التحصيل/التصحيحات) مع الإبقاء على المرايا الـ13 المجمدة كما يحرسها W5-A — أي تحريك مرآة يستلزم تحديث أساس الحارس نفس-الـPR.
  - **الزناد:** تفويض/بدء موجة R7 بقرار المالك (لا شيء يبدأ تلقائيًا).
  - **الاعتماديات:** خطة successor §R7؛ أمر R6-W1 يثبت هذه الحزم دون تنفيذ.
  - **معايير القبول:** استخراج view-model/query-surface بلا نقل أي حقيقة مالية للواجهة؛ صفر تغيير سلوك مالي/دلالي/تاريخي؛ الأجنحة خضراء على الرأس المدفوع.
  - **توقع الرحلات/الاختبارات:** الرحلات القائمة (OrdJourneys/G3*/G6/G4RetainedDeposit/OrderShare/ArabicRtlContent) تبقى خضراء كما هي؛ تُستكمل رحلات الأقسام المستخرجة عند اكتمال الاستخراج.
  - **الشرط الخروجي:** الصفحة تُدار عبر سطح استعلام مستخرج بعقد موثق وjourney tests تغطي المسار.
  - **حد الرجوع:** revert شريحة الصفحة فقط (إعادة الصفحة إلى وحدتها السابقة بلا فقدان سلوك).
  - **استبعاد صريح:** **لا عمل بصري/UI في هذه الحزمة** — CSS/DOM/tokens/تنقل/نصوص كلها على track T خلف بوابة مالك مستقلة؛ R7 بنيوي حصرًا.
  - **أثر الرجوع:** MEDIUM؛ **الاستثناء/التنازل:** —
  - **الإغلاق (R7-2، 2026-10-10):** منفذة — `application/agreements/orderDetailViewModel.ts` (سطح الاستعلام + قرارات الأقسام) + 6 اختبارات وحدة؛ استيراد عميق موثق بأساس (+1 مفتاح)؛ الرحلات الـ11 خضراء (65 اختبارًا)؛ المرايا الـ13 كما هي.
  - **الإغلاق (R7-1، 2026-10-10):** منفذة على الفرع `refactoring/r7-structural-ui-boundaries-20261010` — استخراج كامل لسطح الحالة/الاستعلام إلى `application/finance/financeState.ts` (الأنواع عبر الباب أنواعًا فقط؛ القراء باستيراد عميق موثق بأساس)؛ فك الدورة المختلطة F-019 مثبتًا (لا استيراد إنتاجي متبقٍ لـ`@/pages/Finance` من مكون؛ حراسا الدورات أخضران)؛ 15 ملف رحلات/اختبار مباشرًا خضراء (73 اختبارًا) + 9 اختبارات وحدة جديدة للوحدة؛ باب المالية +4 أنواع بأساس نفس-الـPR؛ مواقع FIN-002 الخمسة للبناء الكسول كما هي؛ دخول الحزمة 629,300/154,690 (الخام مطابق والـgzip +7 بايتات فقط لسطر إعادة تصدير الأنواع).

### `apps/prototype-web/client/src/application/transfers/transferFamilyValidators.ts`

- **الفئة/الطبقة:** production / application — **nbLOC:** 1718 (raw 1733، 76500 bytes)
- **المسؤولية:** Export/import family validators: hand-duplicated domain literal unions (~83 sets, STR-104/509)
- **Exports/Imports:** 76/7
- **المستهلكون المباشرون (8):** `apps/prototype-web/client/src/application/transfers/domainTransferDriftGuard.test.ts`, `apps/prototype-web/client/src/application/transfers/localTransferService.ts`, `apps/prototype-web/client/src/application/transfers/transferCompatibilityRegistry.test.ts`, `apps/prototype-web/client/src/application/transfers/transferCounters.ts`, `apps/prototype-web/client/src/application/transfers/transferEnvelope.ts`, `apps/prototype-web/client/src/application/transfers/transferFamilyValidators.characterization.test.ts`, `apps/prototype-web/client/src/application/transfers/transferSnapshotMigrations.ts`, `apps/prototype-web/client/src/application/transfers/transferSnapshotValidation.ts`
- **آثار جانبية/تهيئة:** لا تُكتشف بالنمط
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** DUPLICATE (risk): current-value acceptance sets duplicated from Domain unions — drift trap
- **الاختبارات المباشرة (3):** `domainTransferDriftGuard.test.ts`, `transferCompatibilityRegistry.test.ts`, `transferFamilyValidators.characterization.test.ts`
- **الإجراء:** **PRESERVE — إبقاء موثق (تصرّف ADR-017 §3، 2026-10-04، معماريًا أولًا ومستقلًا عن الميزانية):** (١) **التماسك:** مسؤولية واحدة — تدقيق أشكال حمولات النقل المستوردة (رأس الملف: عائلات التدقيق المنقولة حرفيًا من localTransferService؛ عقود حرفية بلا تغيير سلوك)؛ العائلات شرائح متوازية-data لعملية تحقق واحدة (prepareImport → validate → replaceSnapshot) تتغير معًا وتُستهلك معًا عبر واجهة واحدة وتُختبر معًا — ليست مسؤوليات مستقلة (قابل بالمقارنة: F1/F2/F3 كانت خدمات مختوطة المسؤوليات موثقة في خطة المسح §6؛ هذا الملف مسؤوليته الواحدة موثقة هناك). (٢) **الملكية والاحتواء:** المستهلكون المباشرون الثمانية كلهم داخل application/transfers/؛ علاقة انحراف المجال يملكها domainTransferDriftGuard + سجل التوافق + الذهبيات (متطلبات «قبل أي نقل» مسلَّمة). (٣) **جذر الخطر:** الدور DUPLICATE — تكرار اتحادات المجال (STR-104/509)؛ التقسيم يبدّد المعرفة المكررة في ملفات أكثر ولا يزيل التكرار؛ العلاج المسمى استكمال 4D (استهلاك حرّي المجال) بقرار مالك لاحق خارج نطاق هذا البرنامج. (٤) **حد النمو:** *(تصحيح مؤرخ 2026-10-09 — R6-W1 [R6-SCAN-F-005]: كانت «مثبّت بالراتشة عند 1,718 nbLOC / 76,500 بايت — أي نمو يصعّد الراتشة ويعيد فتح القرار» — الراتشة بأساس الأشرطة تحرس حدود الأشرطة فقط لا التثبيت الدقيق؛ الحي عند `fd92d7e8`: **1,730 nbLOC / 77,703 بايت** (+12/+1,203 من التزامات R2 المؤرخة b890f9a2/388dac65/a476ed7a — تفويض نواة التاريخ المحلي، اتجاه قصدي)؛ النمو حميد وقرار الإبقاء قائم [F-013]؛ الإنفاذ ضد النمو غير المبرر داخل الشريط ينتقل إلى حزمة R8 المعلنة في الخطة §R8 [«تحويل الراتشة من منع التصعيد بين الأشرطة فقط إلى منع نمو غير مبرر داخل الشريط، مع عدم تعديل baseline في نفس PR لإخفاء النمو»] — المالك: مالك الحراس؛ الزناد: بدء R8؛ الشرط الخروجي: الراتشة ترفض نموًا داخل-شريط غير مبرر؛ الرجوع: revert حارس واحد؛ حتى R8 يُحرس التثبيت الدقيق بالملاحظات المؤرخة هنا)* (٥) **محفزات المراجعة:** عائلة كيان جديدة في صيغة اللقطة؛ اتحاد يدوي جديد (فشل مرساة الدريفت)؛ تصعيد الراتشة؛ قرار رفع حرّي المجال (STR-104/211/509). (٦) **شرط إعادة فتح التقسيم:** بعد أن يصدّر المجال حرّي وقت-التشغيل لاتحادات الحالات ويستهلكها الملف، إن ظل فوق شريطه تُعاد بطاقة التقسيم الداخلي بقرار مالك جديد مسعّرة بمقدّر الفئة B (أرضية S-INTERLEAVED ‏0.5409 بايت/nbLOC) — لا تقسيم تلقائي بحسب الحجم أبدًا. **لا يُحتسب شريحة إنتاجية مخططة في المجمع المحدود لميزانية الحزمة (ADR-017 §4).**؛ **أثر الرجوع:** HIGH — rejection behavior is data-compat؛ **الاستثناء/التنازل:** —

### `apps/prototype-web/client/src/pages/Finance.tsx`

- **الفئة/الطبقة:** production / ui — **nbLOC:** 1619 (raw 1639، 82932 bytes)
- **المسؤولية:** Finance page (UI orchestrator; calls calculateSafeWithdrawal STR-304)
- **Exports/Imports:** 3/38 (+5 dynamic)
- **المستهلكون المباشرون (17):** `apps/prototype-web/client/src/D005.dom.test.tsx`, `apps/prototype-web/client/src/EventsLayer.familyGuard.dom.test.tsx`, `apps/prototype-web/client/src/FinanceBridge.w173.dom.test.tsx`, `apps/prototype-web/client/src/FinanceBudgets.w174.dom.test.tsx`, `apps/prototype-web/client/src/FinanceEmptyTruth.dom.test.tsx`, `apps/prototype-web/client/src/FinanceJourneys.dom.test.tsx`, `apps/prototype-web/client/src/FinanceObligations.w43.dom.test.tsx`, `apps/prototype-web/client/src/FinanceSafeWithdrawal.w176.dom.test.tsx`, `apps/prototype-web/client/src/FinanceShortCashHorizon.w175.dom.test.tsx`, `apps/prototype-web/client/src/G005FinanceReadIsolation.dom.test.tsx`
- **آثار جانبية/تهيئة:** module-mutable
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** —
- **الاختبارات المباشرة (15):** `D005.dom.test.tsx`, `EventsLayer.familyGuard.dom.test.tsx`, `FinanceBridge.w173.dom.test.tsx`, `FinanceBudgets.w174.dom.test.tsx`, `FinanceEmptyTruth.dom.test.tsx`, `FinanceJourneys.dom.test.tsx`, `FinanceObligations.w43.dom.test.tsx`, `FinanceSafeWithdrawal.w176.dom.test.tsx`
- **الإجراء:** **حزمة R7 صريحة R6-F17-P02 `Finance.tsx` [R6-SCAN-F-017 — تحويل المسار إلى DEFER package موثق بمصالحة R6-W1، 2026-10-09؛ كان إجراءً عامًا بلا أركان]:**
  - **المالك:** Micro owner (بوابة R7)؛ منفذ R7: منفذ موجة UI structural boundaries.
  - **المسؤولية/seam المتأثر:** منسّق صفحة المالية — 17 نداء خدمة عبر 9 أبواب؛ **استخراج FinanceState (STR-204c) هو الحل الموثق للدورة القيمية/النوعية المختلطة الوحيدة في الشجرة (FinancePeriodResultSection.tsx:12 type ↔ Finance.tsx:68 value — R6-SCAN-F-019)**؛ القارئ الوحيد للصفحة لـreadRecordedPeriodResult عند :292.
  - **نطاق R7:** فصل حالة Finance/سطح الاستعلام عن العرض؛ حل الدورة المختلطة بالاستخراج؛ تغطية مواقع FIN-002 الخمسة الموثقة للبناء الكسول.
  - **الزناد:** تفويض/بدء موجة R7 بقرار المالك (لا شيء يبدأ تلقائيًا).
  - **الاعتماديات:** خطة successor §R7؛ أمر R6-W1 يثبت هذه الحزم دون تنفيذ.
  - **معايير القبول:** استخراج view-model/query-surface بلا نقل أي حقيقة مالية للواجهة؛ صفر تغيير سلوك مالي/دلالي/تاريخي؛ الأجنحة خضراء على الرأس المدفوع.
  - **توقع الرحلات/الاختبارات:** رحلات Finance* + اختبار التجسس periodResultCanonical يبقى أخضر؛ الدورة المختلطة تختفي ويُتحقق بمسح دورات محدث.
  - **الشرط الخروجي:** الصفحة تُدار عبر سطح استعلام مستخرج بعقد موثق وjourney tests تغطي المسار.
  - **حد الرجوع:** revert شريحة الصفحة فقط (إعادة الصفحة إلى وحدتها السابقة بلا فقدان سلوك).
  - **استبعاد صريح:** **لا عمل بصري/UI في هذه الحزمة** — CSS/DOM/tokens/تنقل/نصوص كلها على track T خلف بوابة مالك مستقلة؛ R7 بنيوي حصرًا.
  - **أثر الرجوع:** MEDIUM؛ **الاستثناء/التنازل:** —

### `apps/prototype-web/client/src/application/finance/projectFinancialService.ts`

- **الفئة/الطبقة:** production / application — **nbLOC:** 1503 (raw 1518، 80893 bytes)
- **المسؤولية:** Canonical financial read model: period results, allocation reads, family contexts
- **Exports/Imports:** 19/17 (+1 dynamic)
- **المستهلكون المباشرون (115):** `apps/prototype-web/client/src/ArabicRtlContent.w44.dom.test.tsx`, `apps/prototype-web/client/src/CashJourneys.dom.test.tsx`, `apps/prototype-web/client/src/CashVocabulary.w43.dom.test.tsx`, `apps/prototype-web/client/src/D005.dom.test.tsx`, `apps/prototype-web/client/src/DeepScreens.w43.dom.test.tsx`, `apps/prototype-web/client/src/EventsLayer.familyGuard.dom.test.tsx`, `apps/prototype-web/client/src/FinanceBridge.w173.dom.test.tsx`, `apps/prototype-web/client/src/FinanceBudgets.w174.dom.test.tsx`, `apps/prototype-web/client/src/FinanceEmptyTruth.dom.test.tsx`, `apps/prototype-web/client/src/FinanceJourneys.dom.test.tsx`
- **آثار جانبية/تهيئة:** module-mutable
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** AUTHORITATIVE financial reader per contract 40 + tests
- **الاختبارات المباشرة (94):** `ArabicRtlContent.w44.dom.test.tsx`, `CashJourneys.dom.test.tsx`, `CashVocabulary.w43.dom.test.tsx`, `D005.dom.test.tsx`, `DeepScreens.w43.dom.test.tsx`, `EventsLayer.familyGuard.dom.test.tsx`, `FinanceBridge.w173.dom.test.tsx`, `FinanceBudgets.w174.dom.test.tsx`
- **الإجراء:** **نُفّذ التقسيم الداخلي (Wave F/ADR-013 عنقود ٣ — 2026-10-04):** المُنسِّق 132 nbLOC NORMAL (القارئ الكنوني — عقد ٤٠ §8: الحقن والساعة والتفويض؛ حراسا التجميع REM-007 بقيا في الخدمة) + 5 أشقاء في البيت نفسه — projectFinancialTypes (288 NORMAL — بيت النموذج الورقي أُكمل بأنواع السطح كلها فوق أساس Wave E)، projectFinancialReads (213 NORMAL — المركز والقوائم)، projectFinancialPeriodReads (407 WATCH — عائلة نتيجة الفترة: اشتقاق COGS وتصنيف المصروفات والاعتراف بآخر تسليم ساري)، projectFinancialInsights (207 NORMAL — المؤشرات: التركيب المعياري والتغطية والسيولة؛ الاستيراد العميق الموثق D-034/operatingBreakEven انتقل معها — أساس حارس الحدود R1 وسجل الملكية §5 حُدّثا نفس-الـPR)، projectFinancialEventWrites (513 WATCH — مسار الكتابة المحروس كاملًا بكل حراسه + توزيع PA-002 بترتيبه الأصلي). قراءة المؤشرات والتوزيع يستهلكان القارئ عبر سطح الكائن الحي (PeriodReadSurface/ProjectFinancialReader — يمرران الخدمة نفسها) فمسار «القارئ الكنوني الواحد» الذي يحرسه اختبار التجسس periodResultCanonical محفوظ كما كان. **رفيق STR-608 (نفس الـPR):** تكثيف هامش GZIP — مفردات رسائل الفشل القرائي الثلاث في resultCodes + معين errorMessageOf (105 مواقع النمط الملتقط) + ثوابت الملف الواحد؛ الحزمة 630,886/154,787 مقابل 641,360/154,817 عند الرأس بعد جولتَي تكثيف (رسائل resultCodes + معين errorMessageOf لـ105 مواقع + بواني الفشل الثلاثة لـ421 موقعًا — أنقذت بوابة CI التي فشلت بهامش 9 بايتات على سلسلة أدوات Pages)، هامش GZIP 213 بايتًا؛ أي موجة تمس الحزمة تقيس قبل الدفع وفق ADR-012؛ **أثر الرجوع:** HIGH (revert الالتزام — جراحة ملفات + تكثيف مفردات، لا أثر بيانات)؛ **الاستثناء/التنازل:** D-034 operatingBreakEven انتقل مع المؤشرات إلى projectFinancialInsights.ts

### `apps/prototype-web/client/src/application/finance/integrityCheckService.ts`

- **الفئة/الطبقة:** production / application — **nbLOC:** 1430 (raw 1460، 78503 bytes)
- **المسؤولية:** Integrity diagnostics over persisted records (read-only checks)
- **Exports/Imports:** 8/12 (+1 dynamic)
- **المستهلكون المباشرون (13):** `apps/prototype-web/client/src/FinanceMore.w42.dom.test.tsx`, `apps/prototype-web/client/src/IntegrityReadable.w43.dom.test.tsx`, `apps/prototype-web/client/src/ReadLayerParity.w44.dom.test.tsx`, `apps/prototype-web/client/src/Set003SettingsSection.dom.test.tsx`, `apps/prototype-web/client/src/Settings.lockGate.dom.test.tsx`, `apps/prototype-web/client/src/SettingsDataBackupSection.w42.dom.test.tsx`, `apps/prototype-web/client/src/ToolsIntegrity.ui.test.tsx`, `apps/prototype-web/client/src/U11.dom.test.tsx`, `apps/prototype-web/client/src/app/PrototypeServicesContext.tsx`, `apps/prototype-web/client/src/application/finance/fullCycleReconciliation.exe013.test.ts`
- **آثار جانبية/تهيئة:** module-mutable
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** Diagnostics consumer, never owns financial rules
- **الاختبارات المباشرة (11):** `FinanceMore.w42.dom.test.tsx`, `IntegrityReadable.w43.dom.test.tsx`, `ReadLayerParity.w44.dom.test.tsx`, `Set003SettingsSection.dom.test.tsx`, `Settings.lockGate.dom.test.tsx`, `SettingsDataBackupSection.w42.dom.test.tsx`, `ToolsIntegrity.ui.test.tsx`, `U11.dom.test.tsx`
- **الإجراء:** **نُفّذ التقسيم الداخلي (Wave F/ADR-013 — 2026-10-04):** المُنسِّق 180 nbLOC NORMAL + 8 أشقاء في البيت نفسه — integrityCheckModel (149 NORMAL — الأنواع وسجل الفحوص وبُناة النتائج)، integrityCheckCoreFinance (430 WATCH — المجموعة ١: MIC-1/2/4/7/9)، integrityCheckInventory (128 NORMAL — MIC-8 عقد ٢٨)، integrityCheckAssetsLoans (400 WATCH — عقد ٢٩: MIC-10..13)، integrityCheckContinuity (111 NORMAL — عقد ٣٥: MIC-14..16)، integrityCheckSupplierWallet (65 NORMAL — G-002: MIC-17)، integrityCheckSettlementBasis (24 NORMAL — F-004/F-005: MIC-18)، integrityCheckOffenderSummaries (112 NORMAL — إثراء Wave 4.3). نقل حرفي بلا تغيير دلالة ولا إقامة (عقد ٤٠ §2)؛ WATCH = مراقبة نمو العائلة (زناد ADR-013: أي فحص MIC جديد)؛ **أثر الرجوع:** MEDIUM (revert الالتزام — جراحة ملفات صرفة)؛ **الاستثناء/التنازل:** STR-313/STR-205 الاستيراد العميق الموثق انتقل مع MIC-18 إلى integrityCheckSettlementBasis.ts:24 (أساس حارس الحدود R1 وسجل الملكية §5 حُدّثا نفس-الـPR)

### `apps/prototype-web/client/src/application/inventory/inventoryMaterialService.ts`

- **الفئة/الطبقة:** production / application — **nbLOC:** 1428 (raw 1432، 68300 bytes)
- **المسؤولية:** Inventory material lifecycle: consume/waste/shortage coordination
- **Exports/Imports:** 24/5
- **المستهلكون المباشرون (68):** `apps/prototype-web/client/src/ArabicRtlContent.w44.dom.test.tsx`, `apps/prototype-web/client/src/CatalogPlannedCost.dom.test.tsx`, `apps/prototype-web/client/src/D005.dom.test.tsx`, `apps/prototype-web/client/src/EventsLayer.familyGuard.dom.test.tsx`, `apps/prototype-web/client/src/FinanceBridge.w173.dom.test.tsx`, `apps/prototype-web/client/src/FinanceBudgets.w174.dom.test.tsx`, `apps/prototype-web/client/src/FinanceEmptyTruth.dom.test.tsx`, `apps/prototype-web/client/src/FinanceJourneys.dom.test.tsx`, `apps/prototype-web/client/src/FinanceObligations.w43.dom.test.tsx`, `apps/prototype-web/client/src/FinanceSafeWithdrawal.w176.dom.test.tsx`
- **آثار جانبية/تهيئة:** لا تُكتشف بالنمط
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** Application coordinator over domain policies
- **الاختبارات المباشرة (56):** `ArabicRtlContent.w44.dom.test.tsx`, `CatalogPlannedCost.dom.test.tsx`, `D005.dom.test.tsx`, `EventsLayer.familyGuard.dom.test.tsx`, `FinanceBridge.w173.dom.test.tsx`, `FinanceBudgets.w174.dom.test.tsx`, `FinanceEmptyTruth.dom.test.tsx`, `FinanceJourneys.dom.test.tsx`
- **الإجراء:** **نُفّذ التقسيم الداخلي (Wave F شريحة ٣/ADR-014 — 2026-10-04، تحت سقف ADR-017 المشتق):** المُنسّق الرفيع 181 nbLOC NORMAL (تفويض رفيع بتوقيع الباني نفسه؛ الصادرات الـ24 كلها معاد تصديرها حرفيًا من النموذج — الـ71 مستهلكًا لم يمسهم شيء) + 7 أشقاء في البيت نفسه: inventoryMaterialModel 258 NORMAL (أنواع السطح والمصنع)، inventoryMaterialReads 305 NORMAL (القراءات والاقتراحات)، inventoryMaterialActivation 78 NORMAL، inventoryMaterialLifecycle 238 NORMAL (التنشيط والدورة والقصور)، inventoryMaterialWrites 269 NORMAL (الكتابات المحروسة)، inventoryMaterialWaste 159 NORMAL (الهدر — فُصل حين بلغت الكتابات مجتمعة 404 WATCH مخالفةً شرط ADR-014 «تبقى الملفات بعد التقسيم دون WATCH»)، inventoryMaterialShortages 161 NORMAL؛ رسم نجمي (الأشقاء → model فقط؛ الخدمة → الجميع؛ صفر دورات؛ صفر مستورد خارجي للأشقاء — تحقق جرد المستهلكين)؛ نقل حرفي بالاستخراج اللفظي مع تحويلات ميكانيكية فقط (dedent وthis.store→store وthis.now()→now() بتمرير المراجع)؛ رفيق الشريحة (STR-608): تكثيفات R1/R2 الموثقة (عكس معرفات الحركات ×5، مفاتيح العمليات ×9، بواني storageFailure ×8، materialById ×10، ثابت رسالة التنشيط) — الحزمة النهائية 630,510/155,088 (كانت عند الرأس 630,886/154,787 — صافي −376 خام/+301 gzip؛ الخام تحت الرأس والـgzip داخل سقف ADR-017 المشتق 155,300 بهامش 212)؛ أساس الراتشة حُدّث بالتعدادات الحية في نفس الـPR (400 شريطًا)؛ القيم في هذا الصف تاريخية عند رأس القياس؛ **أثر الرجوع:** MEDIUM (revert الالتزام — جراحة ملفات بلا أثر بيانات)؛ **الاستثناء/التنازل:** —

### `src/domain/craft-order/policies.ts`

- **الفئة/الطبقة:** production / domain — **nbLOC:** 1399 (raw 1493، 74026 bytes)
- **المسؤولية:** Craft-order domain rules: agreement, delivery, settlement, corrections
- **Exports/Imports:** 30/3
- **المستهلكون المباشرون (3):** `src/domain/craft-order/deliveryContribution.ts`, `src/domain/craft-order/index.ts`, `src/domain/craft-order/settlementInvariant.ts`
- **آثار جانبية/تهيئة:** لا تُكتشف بالنمط
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** AUTHORITATIVE domain policy (frozen semantics)
- **الاختبارات المباشرة (0):** لا يستورد الملفَ ملفُ اختبار مباشرة *(تصحيح مؤرخ 2026-10-09 — R6-W1 [R6-SCAN-F-004 = إتمام R0-N8]: كانت «لا تغطية مباشرة (انظر بطاقات الفجوة)» — عبارة مضللة ومؤشرها معلق: لا مستند بطاقات فجوة في المستودع [R0-N6] والدليل الفعلي للتغطية هو خريطة الاختبارات والتوثيق المولدة `TEST-AND-DOCUMENTATION-MAP.md` + `generated/test-map.json`؛ التغطية الفعلية غير مباشرة وحقيقية: ~171 اختبارًا يصل الملف عبر برميل craft-order في 7 أجنحة مجال، وsettlementInvariant (MIC-18) يحرس ثابت التسوية، وmoneyLayerGuard يعدّ مواقع الملف صراحة (:113/:116/:143/:168-169)، وتوصيف W2 يثبت نصوص رسائله حرفيًا؛ الفجوة الصادقة المسجلة: لا اختبار مباشر للوحدة نفسها — تُقيَّم في موجة اختبارات مالك مستقبلية، لا في R6)*
- **الإجراء:** **PRESERVE — استثناء طويل الأجل مقبول كامل الأركان (W6/عقد ما بعد المسح، 2026-10-05؛ إكمال الأركان ومصالحة الأقسام بموجة R6-W1، 2026-10-09 [R6-SCAN-F-004]):** (١) المالك: domain/craft-order. (٢) السبب: مسؤولية واحدة — سياسات مجال الصنعة (اتفاق/تسليم/تسوية/تصحيحات) بدلالة مجمّدة بعقود 02/10/12؛ التقسيم خلط دلالي عالي الخطورة في أكثر ملف مالي حساسية بلا مكسب بنيوي، والفواصل الدلالية موثقة بالتعليقات. (٣) جرد المستهلكين: 3 داخل المجال (deliveryContribution، البرميل، settlementInvariant) + التطبيق عبر البرميل + استيراد ديناميكي عميق واحد موثق (integrityCheckSettlementBasis — STR-205). (٤) حد النمو: راتشة الشريط PRESERVE — الحي **1,413 nbLOC** عند `fd92d7e8` (+14 موثقة بمصالحة R6-W1، أعلاه في §2). (٥) الحراس: check-file-size-ratchet + settlementInvariant + تعداد moneyLayerGuard + توصيف W2. (٦) محفز المراجعة: عبور شريط، فحص تسوية جديد، أو موجة مالك مستقبلية بمدى exact. (٧) الشرط الخروجي: قرار مالك. (٨) الاختبارات: كما وُثّق أعلاه (غير مباشرة حقيقية؛ لا مباشرة — فجوة مسجلة). (٩) حد الرجوع: HIGH — settlement invariant. **أثر الرجوع:** HIGH — settlement invariant؛ **الاستثناء/التنازل:** موثق كاملًا أعلاه — §2 و§3 صارا متطابقين بمصالحة R6-W1

### `apps/prototype-web/client/src/pages/FinancialEventEditor.tsx`

- **الفئة/الطبقة:** production / ui — **nbLOC:** 1268 (raw 1285، 62162 bytes)
- **المسؤولية:** Financial event editor page (UI)
- **Exports/Imports:** 1/23
- **المستهلكون المباشرون (5):** `apps/prototype-web/client/src/DeepScreens.w43.dom.test.tsx`, `apps/prototype-web/client/src/app/MicroRouter.tsx`, `apps/prototype-web/client/src/pages/FinancialEventEditor.guided.test.tsx`, `apps/prototype-web/client/src/pages/FinancialEventEditor.ui.test.tsx`, `apps/prototype-web/client/src/pages/OwnerJourneysExe009.dom.test.tsx`
- **آثار جانبية/تهيئة:** module-mutable
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** —
- **الاختبارات المباشرة (4):** `DeepScreens.w43.dom.test.tsx`, `FinancialEventEditor.guided.test.tsx`, `FinancialEventEditor.ui.test.tsx`, `OwnerJourneysExe009.dom.test.tsx`
- **الإجراء:** **حزمة R7 صريحة R6-F17-P03 `FinancialEventEditor.tsx` [R6-SCAN-F-017 — تحويل المسار إلى DEFER package موثق بمصالحة R6-W1، 2026-10-09؛ كان إجراءً عامًا بلا أركان]:**
  - **المالك:** Micro owner (بوابة R7)؛ منفذ R7: منفذ موجة UI structural boundaries.
  - **المسؤولية/seam المتأثر:** محرر الحدث المالي — 31 useState على مستوى الملف؛ ضمن عائلة المحررات 97–99% دالة واحدة.
  - **نطاق R7:** جرد استخراج نموذج عرض المحرر (حالات النموذج/التحقق/القنوات) خلف سطح استعلام مع الإبقاء على عقد الإدخال الموجه (عقد 27).
  - **الزناد:** تفويض/بدء موجة R7 بقرار المالك (لا شيء يبدأ تلقائيًا).
  - **الاعتماديات:** خطة successor §R7؛ أمر R6-W1 يثبت هذه الحزم دون تنفيذ.
  - **معايير القبول:** استخراج view-model/query-surface بلا نقل أي حقيقة مالية للواجهة؛ صفر تغيير سلوك مالي/دلالي/تاريخي؛ الأجنحة خضراء على الرأس المدفوع.
  - **توقع الرحلات/الاختبارات:** رحلات DeepScreens/OwnerJourneysExe009 + اختبارات guided/ui للمحرر تبقى خضراء.
  - **الشرط الخروجي:** الصفحة تُدار عبر سطح استعلام مستخرج بعقد موثق وjourney tests تغطي المسار.
  - **حد الرجوع:** revert شريحة الصفحة فقط (إعادة الصفحة إلى وحدتها السابقة بلا فقدان سلوك).
  - **استبعاد صريح:** **لا عمل بصري/UI في هذه الحزمة** — CSS/DOM/tokens/تنقل/نصوص كلها على track T خلف بوابة مالك مستقلة؛ R7 بنيوي حصرًا.
  - **أثر الرجوع:** MEDIUM؛ **الاستثناء/التنازل:** —
  - **الإغلاق (R7-2، 2026-10-10):** منفذة — `application/finance/financialEventEditorModel.ts` (قرار المحرر النقي) + 14 اختبار وحدة؛ الاستيراد العميق موثق؛ الاختبارات الموجهة/الواجهة/الرحلات خضراء (27 اختبارًا)؛ عقد ٢৭ محفوظًا نصًا وسلوكًا.

### `scripts/text-density-count.py`

- **الفئة/الطبقة:** script / infra — **nbLOC:** 1253 (raw 1298، 85132 bytes)
- **المسؤولية:** Doc text-density guard (root package script `text-density`)
- **Exports/Imports:** 0/2
- **المستهلكون المباشرون (1):** `scripts/check-file-size-ratchet.test.mjs`
- **آثار جانبية/تهيئة:** لا تُكتشف بالنمط
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** Tooling guard; consumed by pnpm check
- **الاختبارات المباشرة (0):** لا تغطية مباشرة (انظر بطاقات الفجوة)
- **الإجراء:** *(تصحيح مؤرخ 2026-10-09 — R6-W1 [R6-SCAN-F-009 — يعمّق R0-N6]: كانت «PRESERVE (size is cohesive single-purpose)» تأكيدًا مجردًا لا يسنده القياس: تركيب الملف 57% تعليقات + دفتر راتشة CAPS (كتلة 744 سطرًا/48 مدخلًا) مقابل محرك قياس ~350–400 سطر؛ seam حقيقي = **المحرك مقابل بيانات السياسة**؛ 0 اختبارات مباشرة؛ مؤشر «بطاقات الفجوة» معلق [R0-N6]؛ خارج رسم بناء vite (محايد للحزمة))* **FIX_NOW → حزمة R6-W3 المعتمدة (قرار المالك بمراجعة R6):** فصل دفتر CAPS إلى وحدة بيانات مستقلة بعد اختبار توصيف يثبت المخرجات أولًا؛ تحديث صفوف السجل والراتشة وخريطة الاختبارات في نفس الـPR؛ القبول: مخرجات `pnpm text-density` متطابقة بايت-ببايت قبل/بعد + اختبارات جديدة خضراء؛ المالك: مالك الحراس/الأدوات؛ الزناد: هذه المصالحة (بدء W3 بأمر المالك)؛ الشرط الخروجي: الملف يغادر شريط SPLIT_NOW بملاحظة مؤرخة؛ الرجوع: revert الشريحة (استعادة الملف الواحد). **لا تنفّذ في W1 — توثيق فقط.** *(إغلاق مؤرخ 2026-10-09 — R6-W3 منفذة على الفرع `refactoring/r6-w3-text-density-tooling-20261009`: اختبار التواصيف كُتب وشُغّل على الملف قبل الفصل (أخضر)، ثم فُصل الدفتر إلى `scripts/text_density_policy.py`، والمخرجات بايت-متطابقة (4,117 بايت، خرج 0، stderr فارغ — sha256 للذهبي 812a24bb…)، والمحرك 458 nbLOC ب شريط WATCH والدفتر 846 nbLOC بصف أعلاه، والراتشة والأساس وخريطة الاختبارات حُدثت نفس-الـPR، واختبار توصيف دائم + سلبيتان (سقف معدول يُكشف بالفشل، ومدخل مشوه يُرفض بخرج 2)؛ لا تغيير سلوك تطبيق ولا حزمة)*؛ **أثر الرجوع:** LOW — revert الشريحة يستعيد الملف الواحد؛ **الاستثناء/التنازل:** —

### `apps/prototype-web/client/src/application/transfers/transferSnapshotValidation.ts`

- **الفئة/الطبقة:** production / application — **nbLOC:** 1184 (raw 1185، 55530 bytes)
- **المسؤولية:** Snapshot relation validation: orchestrate family validators + cross-family relation rules (same checks, same order, same acceptance decisions)
- **الإجراء:** **PRESERVE — إبقاء موثق (مراجعة R4-C2، 2026-10-08، فوق التصنيف السابق SPLIT_CANDIDATE/«characterization first»):** التوصيف المطلوب قائم (transferFamilyValidators.characterization + transferEnvelope.characterization + transferCounters.migrations.characterization + localDateVariantDivergence). المراجعة الحية: قواعد العلاقات (تفرّد المفاتيح/الهويات، المراجع عبر العائلات، طيّ المخزون غير السالب، أزواج التخصيص والمراجعة) تُبنى على أطقم معرّفات مشتركة تتراكم عبر العائلات بالترتيب نفسه — الشق الهيكلي يمرّر 15+ طقمًا بين وحدات بلا مكسب ملكية. محفز إعادة الفتح: عائلة جديدة بملكية علاقات مستقلة أو إتمام 4D *(نمو ضمن الشريط +8 موثق بمصالحة R6-W1 2026-10-09 [R6-SCAN-F-006]: الحي 1,192 عند `fd92d7e8` من التزام R2 b890f9a2؛ نمو حميد — انظر §7؛ ونقاط الضعف المسجلة [R6-SCAN-F-013]: ≥4 كتل عكس/تفرّد شبه متطابقة = هدف تنظيف داخلي تحت قاعدة الملف المتماسك، ودبابيس النمو لينة حتى حزمة R8)*؛ **أثر الرجوع:** HIGH (سلوك رفض البيانات)؛ **الاستثناء/التنازل:** موثق أعلاه
- **Exports/Imports:** 1/5
- **المستهلكون المباشرون (2):** `apps/prototype-web/client/src/application/transfers/localTransferService.ts`, `apps/prototype-web/client/src/application/transfers/transferFamilyValidators.characterization.test.ts`
- **آثار جانبية/تهيئة:** لا تُكتشف بالنمط
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** Import acceptance gate (pairs with contract 39)
- **الاختبارات المباشرة (1):** `transferFamilyValidators.characterization.test.ts`

### `apps/prototype-web/client/src/pages/SupplierPurchaseEditor.tsx`

- **الفئة/الطبقة:** production / ui — **nbLOC:** 1157 (raw 1184، 57934 bytes)
- **المسؤولية:** ui implementation (heuristic; see methodology)
- **Exports/Imports:** 1/22
- **المستهلكون المباشرون (6):** `apps/prototype-web/client/src/G004CapabilityGuard.dom.test.tsx`, `apps/prototype-web/client/src/G3Hardening.dom.test.tsx`, `apps/prototype-web/client/src/PurchasingBridgeExe011.dom.test.tsx`, `apps/prototype-web/client/src/app/MicroRouter.tsx`, `apps/prototype-web/client/src/group2InventorySurfaces.test.tsx`, `apps/prototype-web/client/src/pages/SupplierPurchaseEditor.ui.test.tsx`
- **آثار جانبية/تهيئة:** module-mutable
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** —
- **الاختبارات المباشرة (5):** `G004CapabilityGuard.dom.test.tsx`, `G3Hardening.dom.test.tsx`, `PurchasingBridgeExe011.dom.test.tsx`, `group2InventorySurfaces.test.tsx`, `SupplierPurchaseEditor.ui.test.tsx`
- **الإجراء:** **حزمة R7 صريحة R6-F17-P04 `SupplierPurchaseEditor.tsx` [R6-SCAN-F-017 — تحويل المسار إلى DEFER package موثق بمصالحة R6-W1، 2026-10-09؛ كان «SPLIT_CANDIDATE — growth-control plan before adding scope» بلا أركان]:**
  - **المالك:** Micro owner (بوابة R7)؛ منفذ R7: منفذ موجة UI structural boundaries.
  - **المسؤولية/seam المتأثر:** محرر شراء المورّد — ضمن عائلة المحررات 97–99% دالة واحدة.
  - **نطاق R7:** جرد استخراج نموذج عرض المحرر (بنود الشراء/الدفعات/التحقق) خلف سطح استعلام مع الحفاظ على علاقة عقد 07.
  - **الزناد:** تفويض/بدء موجة R7 بقرار المالك (لا شيء يبدأ تلقائيًا).
  - **الاعتماديات:** خطة successor §R7؛ أمر R6-W1 يثبت هذه الحزم دون تنفيذ.
  - **معايير القبول:** استخراج view-model/query-surface بلا نقل أي حقيقة مالية للواجهة؛ صفر تغيير سلوك مالي/دلالي/تاريخي؛ الأجنحة خضراء على الرأس المدفوع.
  - **توقع الرحلات/الاختبارات:** رحلات PurchasingBridgeExe011/G3Hardening/G004CapabilityGuard + اختبار ui للمحرر تبقى خضراء.
  - **الشرط الخروجي:** الصفحة/المكوّن يُدار عبر سطح استعلام مستخرج بعقد موثق وjourney tests تغطي المسار.
  - **حد الرجوع:** revert شريحة الصفحة/المكوّن فقط (إعادة الوحدة إلى حالتها السابقة بلا فقدان سلوك).
  - **استبعاد صريح:** **لا عمل بصري/UI في هذه الحزمة** — CSS/DOM/tokens/تنقل/نصوص كلها على track T خلف بوابة مالك مستقلة؛ R7 بنيوي حصرًا.
  - **أثر الرجوع:** MEDIUM؛ **الاستثناء/التنازل:** —

### `apps/prototype-web/client/src/pages/OwnerEntitlement.tsx`

- **الفئة/الطبقة:** production / ui — **nbLOC:** 1133 (raw 1157، 51692 bytes)
- **المسؤولية:** ui implementation (heuristic; see methodology)
- **Exports/Imports:** 1/17
- **المستهلكون المباشرون (2):** `apps/prototype-web/client/src/G6.dom.test.tsx`, `apps/prototype-web/client/src/app/MicroRouter.tsx`
- **آثار جانبية/تهيئة:** module-mutable
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** —
- **الاختبارات المباشرة (1):** `G6.dom.test.tsx`
- **الإجراء:** **حزمة R7 صريحة R6-F17-P05 `OwnerEntitlement.tsx` [R6-SCAN-F-017 — تحويل المسار إلى DEFER package موثق بمصالحة R6-W1، 2026-10-09؛ كان «SPLIT_CANDIDATE — growth-control plan before adding scope» بلا أركان]:**
  - **المالك:** Micro owner (بوابة R7)؛ منفذ R7: منفذ موجة UI structural boundaries.
  - **المسؤولية/seam المتأثر:** صفحة استحقاق المالك — **52 useState على مستوى الملف: الأعلى في الشجرة**.
  - **نطاق R7:** جرد استخراج نموذج عرض الاستحقاق (السياسات/الحركات/السحب الآمن) خلف سطح استعلام؛ أعلى مرشح للفصل داخل حزمة R7.
  - **الزناد:** تفويض/بدء موجة R7 بقرار المالك (لا شيء يبدأ تلقائيًا).
  - **الاعتماديات:** خطة successor §R7؛ أمر R6-W1 يثبت هذه الحزم دون تنفيذ.
  - **معايير القبول:** استخراج view-model/query-surface بلا نقل أي حقيقة مالية للواجهة؛ صفر تغيير سلوك مالي/دلالي/تاريخي؛ الأجنحة خضراء على الرأس المدفوع.
  - **توقع الرحلات/الاختبارات:** رحلة G6 تبقى خضراء وتُستكمل رحلات الأقسام المستخرجة.
  - **الشرط الخروجي:** الصفحة/المكوّن يُدار عبر سطح استعلام مستخرج بعقد موثق وjourney tests تغطي المسار.
  - **حد الرجوع:** revert شريحة الصفحة/المكوّن فقط (إعادة الوحدة إلى حالتها السابقة بلا فقدان سلوك).
  - **استبعاد صريح:** **لا عمل بصري/UI في هذه الحزمة** — CSS/DOM/tokens/تنقل/نصوص كلها على track T خلف بوابة مالك مستقلة؛ R7 بنيوي حصرًا.
  - **أثر الرجوع:** MEDIUM؛ **الاستثناء/التنازل:** —

### `apps/prototype-web/client/src/application/owner-money/ownerEntitlementService.ts`

- **الفئة/الطبقة:** production / application — **nbLOC:** 1093 (raw 1109، 51408 bytes)
- **المسؤولية:** Owner entitlement record lifecycle + settlement coordination (moved with the Owner Money cluster — Wave 4B)
- **Exports/Imports:** 14/7
- **المستهلكون المباشرون (10):** `apps/prototype-web/client/src/app/PrototypeServicesContext.tsx`, `apps/prototype-web/client/src/application/finance/fullCycleReconciliation.exe013.test.ts`, `apps/prototype-web/client/src/application/finance/ownerEntitlementService.ts`, `apps/prototype-web/client/src/application/finance/statementService.test.ts`, `apps/prototype-web/client/src/application/owner-money/ownerCrossModelDuplicates.test.ts`, `apps/prototype-web/client/src/application/owner-money/ownerEntitlementService.test.ts`, `apps/prototype-web/client/src/application/owner-money/withdrawalWalletGuard.test.ts`, `apps/prototype-web/client/src/application/transfers/dataRoundTrip.exe014.test.ts`, `apps/prototype-web/client/src/application/transfers/exportGoldens.test.ts`, `apps/prototype-web/client/src/application/transfers/ownerEntitlementTransfer.test.ts`
- **آثار جانبية/تهيئة:** لا تُكتشف بالنمط
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** Owner-money cluster member (registry §3); withdrawalWalletGuard rule-localization stays OWNER_DECISION (STR-302)
- **الاختبارات المباشرة (8):** `fullCycleReconciliation.exe013.test.ts`, `statementService.test.ts`, `ownerCrossModelDuplicates.test.ts`, `ownerEntitlementService.test.ts`, `withdrawalWalletGuard.test.ts`, `dataRoundTrip.exe014.test.ts`, `exportGoldens.test.ts`, `ownerEntitlementTransfer.test.ts`
- **الإجراء:** **PRESERVE الآن + حزمة مستقبلية owner-gated موثقة (مصالحة R6-W1، 2026-10-09 [R6-SCAN-F-014]):** *(كان «SPLIT_CANDIDATE — cluster home settled in 4B; future slices per registry» — عبارات بلا أركان)* (١) المالك: application/owner-money. (٢) السبب: عقد PC-4 write-path موثق في الترويسة (:1–6) — 8 طرق كتابة (`reverseMovement` :978–:1018) والقراءات مقدمات كتابة موثقة لا نموذج قراءة منافس؛ قفل الكاتب الوحيد عبر منفذ القدرة. (٣) seam قراءة/كتابة حقيقي موجود لكنه محمي: تسوية عنقود 4B قرار مالك، واقتران محقق (`recordEntitlement:711`→`this.calculate`؛ `readOwnerMoneyOverview:376`→`this.readOverview` — محركات خاصة مشتركة). (٤) حد النمو: راتشة الشريط SPLIT_CANDIDATE (1,093 مسجل؛ الحي **1,003** عند `fd92d7e8` — −90 موثقة من STR-608/R2/PC-4؛ هامش 196 nbLOC تحت السقف). (٥) الحراس: الراتشة + حارس readwrite (الملف مستثنى عمدًا ككاتب) + عقود القدرة. (٦) محفز المراجعة: طريقة كتابة تاسعة أو قراءة تتحول نموذجًا مستقلًا. (٧) **الحزمة المستقبلية:** استخراج القراءات خلف الباب بعقد PC-4 في موجة owner-gated بعد R7 — المالك: Micro owner؛ الزناد: اكتمال R7 + تعليمات المالك؛ الشرط الخروجي: قراءات مستخرجة خلف الباب بعقد قراءة موثق. (٨) الاختبارات: 8 مباشرة. (٩) حد الرجوع: HIGH. *(تصحيح مؤرخ — R6-W1: سطر البطاقة «reverseMovement :978–:1018» وفق القياس الحي؛ كان مرجع سطر سابق منزاحًا)*؛ **الاستثناء/التنازل:** —

### `apps/prototype-web/client/src/pages/Schedule.tsx`

- **الفئة/الطبقة:** production / ui — **nbLOC:** 1013 (raw 1035، 40876 bytes)
- **المسؤولية:** ui implementation (heuristic; see methodology)
- **Exports/Imports:** 1/15 (+1 dynamic)
- **المستهلكون المباشرون (2):** `apps/prototype-web/client/src/G004CapabilityGuard.dom.test.tsx`, `apps/prototype-web/client/src/app/MicroRouter.tsx`
- **آثار جانبية/تهيئة:** module-mutable
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** —
- **الاختبارات المباشرة (1):** `G004CapabilityGuard.dom.test.tsx`
- **الإجراء:** **حزمة R7 صريحة R6-F17-P06 `Schedule.tsx` [R6-SCAN-F-017 — تحويل المسار إلى DEFER package موثق بمصالحة R6-W1، 2026-10-09؛ كان «SPLIT_CANDIDATE — growth-control plan before adding scope» بلا أركان]:**
  - **المالك:** Micro owner (بوابة R7)؛ منفذ R7: منفذ موجة UI structural boundaries.
  - **المسؤولية/seam المتأثر:** صفحة الجدول — 32% من الملف للمكوّن الرئيسي (68% أقسام مساندة).
  - **نطاق R7:** فصل أقسام الجدول وحالته عن العرض وفق جرد الاستخراج.
  - **الزناد:** تفويض/بدء موجة R7 بقرار المالك (لا شيء يبدأ تلقائيًا).
  - **الاعتماديات:** خطة successor §R7؛ أمر R6-W1 يثبت هذه الحزم دون تنفيذ.
  - **معايير القبول:** استخراج view-model/query-surface بلا نقل أي حقيقة مالية للواجهة؛ صفر تغيير سلوك مالي/دلالي/تاريخي؛ الأجنحة خضراء على الرأس المدفوع.
  - **توقع الرحلات/الاختبارات:** اختبار G004CapabilityGuard + رحلات الجدول المضافة عند الاستخراج.
  - **الشرط الخروجي:** الصفحة/المكوّن يُدار عبر سطح استعلام مستخرج بعقد موثق وjourney tests تغطي المسار.
  - **حد الرجوع:** revert شريحة الصفحة/المكوّن فقط (إعادة الوحدة إلى حالتها السابقة بلا فقدان سلوك).
  - **استبعاد صريح:** **لا عمل بصري/UI في هذه الحزمة** — CSS/DOM/tokens/تنقل/نصوص كلها على track T خلف بوابة مالك مستقلة؛ R7 بنيوي حصرًا.
  - **أثر الرجوع:** MEDIUM؛ **الاستثناء/التنازل:** —

### `apps/prototype-web/client/src/pages/DirectSaleEditor.tsx`

- **الفئة/الطبقة:** production / ui — **nbLOC:** 998 (raw 1022، 49905 bytes)
- **المسؤولية:** ui implementation (heuristic; see methodology)
- **Exports/Imports:** 1/20
- **المستهلكون المباشرون (5):** `apps/prototype-web/client/src/G3.dom.test.tsx`, `apps/prototype-web/client/src/ReversalSurfacesExe010.dom.test.tsx`, `apps/prototype-web/client/src/U005.dom.test.tsx`, `apps/prototype-web/client/src/app/MicroRouter.tsx`, `apps/prototype-web/client/src/pages/DirectSaleEditor.ui.test.tsx`
- **آثار جانبية/تهيئة:** module-mutable
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** —
- **الاختبارات المباشرة (4):** `G3.dom.test.tsx`, `ReversalSurfacesExe010.dom.test.tsx`, `U005.dom.test.tsx`, `DirectSaleEditor.ui.test.tsx`
- **الإجراء:** **حزمة R7 صريحة R6-F17-P07 `DirectSaleEditor.tsx` [R6-SCAN-F-017 — تحويل المسار إلى DEFER package موثق بمصالحة R6-W1، 2026-10-09؛ كان «SPLIT_CANDIDATE — growth-control plan before adding scope» بلا أركان]:**
  - **المالك:** Micro owner (بوابة R7)؛ منفذ R7: منفذ موجة UI structural boundaries.
  - **المسؤولية/seam المتأثر:** محرر البيع المباشر — ضمن عائلة المحررات 97–99% دالة واحدة.
  - **نطاق R7:** جرد استخراج نموذج عرض المحرر خلف سطح استعلام مع الحفاظ على مسار عكس التحصيل (EXE-010).
  - **الزناد:** تفويض/بدء موجة R7 بقرار المالك (لا شيء يبدأ تلقائيًا).
  - **الاعتماديات:** خطة successor §R7؛ أمر R6-W1 يثبت هذه الحزم دون تنفيذ.
  - **معايير القبول:** استخراج view-model/query-surface بلا نقل أي حقيقة مالية للواجهة؛ صفر تغيير سلوك مالي/دلالي/تاريخي؛ الأجنحة خضراء على الرأس المدفوع.
  - **توقع الرحلات/الاختبارات:** رحلات G3/ReversalSurfacesExe010/U005 + اختبار ui تبقى خضراء.
  - **الشرط الخروجي:** الصفحة/المكوّن يُدار عبر سطح استعلام مستخرج بعقد موثق وjourney tests تغطي المسار.
  - **حد الرجوع:** revert شريحة الصفحة/المكوّن فقط (إعادة الوحدة إلى حالتها السابقة بلا فقدان سلوك).
  - **استبعاد صريح:** **لا عمل بصري/UI في هذه الحزمة** — CSS/DOM/tokens/تنقل/نصوص كلها على track T خلف بوابة مالك مستقلة؛ R7 بنيوي حصرًا.
  - **أثر الرجوع:** MEDIUM؛ **الاستثناء/التنازل:** —
  - **الإغلاق (R7-2، 2026-10-10):** منفذة — `application/direct-sales/directSaleEditorModel.ts` (بوابة التحقق/قرار الفرق X-06/تعيين المرجع/خريطة السجل) + 11 اختبار وحدة؛ الاستيراد العميق موثق؛ EXE-010 ومرآتا F-049 لم يُمسا؛ الاختبارات الأربعة خضراء (21 اختبارًا).

### `apps/prototype-web/client/src/pages/InventoryMovementEditor.tsx`

- **الفئة/الطبقة:** production / ui — **nbLOC:** 965 (raw 973، 46383 bytes)
- **المسؤولية:** ui implementation (heuristic; see methodology)
- **Exports/Imports:** 1/15
- **المستهلكون المباشرون (4):** `apps/prototype-web/client/src/InventoryAdjustExe012.dom.test.tsx`, `apps/prototype-web/client/src/Ops001MovementSelection.dom.test.tsx`, `apps/prototype-web/client/src/app/MicroRouter.tsx`, `apps/prototype-web/client/src/group2InventorySurfaces.test.tsx`
- **آثار جانبية/تهيئة:** لا تُكتشف بالنمط
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** —
- **الاختبارات المباشرة (3):** `InventoryAdjustExe012.dom.test.tsx`, `Ops001MovementSelection.dom.test.tsx`, `group2InventorySurfaces.test.tsx`
- **الإجراء:** **حزمة R7 صريحة R6-F17-P08 `InventoryMovementEditor.tsx` [R6-SCAN-F-017 — تحويل المسار إلى DEFER package موثق بمصالحة R6-W1، 2026-10-09؛ كان «SPLIT_CANDIDATE — growth-control plan before adding scope» بلا أركان]:**
  - **المالك:** Micro owner (بوابة R7)؛ منفذ R7: منفذ موجة UI structural boundaries.
  - **المسؤولية/seam المتأثر:** محرر حركة المخزون — ضمن عائلة المحررات 97–99% دالة واحدة.
  - **نطاق R7:** جرد استخراج نموذج عرض المحرر خلف سطح استعلام.
  - **الزناد:** تفويض/بدء موجة R7 بقرار المالك (لا شيء يبدأ تلقائيًا).
  - **الاعتماديات:** خطة successor §R7؛ أمر R6-W1 يثبت هذه الحزم دون تنفيذ.
  - **معايير القبول:** استخراج view-model/query-surface بلا نقل أي حقيقة مالية للواجهة؛ صفر تغيير سلوك مالي/دلالي/تاريخي؛ الأجنحة خضراء على الرأس المدفوع.
  - **توقع الرحلات/الاختبارات:** رحلات InventoryAdjustExe012/Ops001MovementSelection + group2InventorySurfaces تبقى خضراء.
  - **الشرط الخروجي:** الصفحة/المكوّن يُدار عبر سطح استعلام مستخرج بعقد موثق وjourney tests تغطي المسار.
  - **حد الرجوع:** revert شريحة الصفحة/المكوّن فقط (إعادة الوحدة إلى حالتها السابقة بلا فقدان سلوك).
  - **استبعاد صريح:** **لا عمل بصري/UI في هذه الحزمة** — CSS/DOM/tokens/تنقل/نصوص كلها على track T خلف بوابة مالك مستقلة؛ R7 بنيوي حصرًا.
  - **أثر الرجوع:** MEDIUM؛ **الاستثناء/التنازل:** —

### `src/domain/financial-analysis/policies.ts`

- **الفئة/الطبقة:** production / domain — **nbLOC:** 937 (raw 976، 43735 bytes)
- **المسؤولية:** Break-even/liquidity domain rules (canonical home since Wave 4A; historical g5)
- **Exports/Imports:** 7/2
- **المستهلكون المباشرون (2):** `src/domain/financial-analysis/index.ts`, `src/domain/financial-analysis/operatingBreakEven.ts`
- **آثار جانبية/تهيئة:** لا تُكتشف بالنمط
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** —
- **الاختبارات المباشرة (0):** لا تغطية مباشرة (انظر بطاقات الفجوة)
- **الإجراء:** **PRESERVE — إبقاء موثق كامل الأركان (توحيد R6-W1، 2026-10-09 [R6-SCAN-F-012]؛ كان «SPLIT_CANDIDATE — content unchanged by the 4A rename; growth-control plan before adding scope»):** (١) المالك: domain/financial-analysis. (٢) السبب: أربعة عناقيد دلالية (سجلات التصريح، الهامش المباشر، التعادل، بيان السيولة القصيرة) لمستهلكَين اثنين (البرميل + operatingBreakEven) باستيرادات نقية — توجد فواصل اسمية لكن لا استقلالية change-locality: التقسيم يجمّد دلالة مجال مكتملة عبر ملفات أكثر بخلط أعلى بلا مكسب ملكية (مبدأ الخطة: لا شطر سياسات مجال متماسكة). (٣) الجرد: أعلاه. (٤) حد النمو: راتشة الشريط (937 مسجل؛ الحي 937). (٥) الحراس: الراتشة + نقاء المجال (ESLint) + أجنحة المجال. (٦) محفز المراجعة: مستهلك ثالث خارج المجال أو عنقود يستقل ملكيةً. (٧) الشرط الخروجي: قرار مالك بموجة دلالية (STR-302). (٨) الاختبارات: غير مباشرة عبر أجنحة المجال (خريطة الاختبارات المولدة). (٩) حد الرجوع: MEDIUM؛ **الاستثناء/التنازل:** —

### `src/domain/owner-entitlement/policies.ts`

- **الفئة/الطبقة:** production / domain — **nbLOC:** 906 (raw 934، 38310 bytes)
- **المسؤولية:** Owner entitlement domain rules
- **Exports/Imports:** 16/2
- **المستهلكون المباشرون (1):** `src/domain/owner-entitlement/index.ts`
- **آثار جانبية/تهيئة:** لا تُكتشف بالنمط
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** —
- **الاختبارات المباشرة (0):** لا تغطية مباشرة (انظر بطاقات الفجوة)
- **الإجراء:** **PRESERVE — إبقاء موثق كامل الأركان (توحيد R6-W1، 2026-10-09 [R6-SCAN-F-012]؛ كان «SPLIT_CANDIDATE — PRESERVE (domain purity; registry row)»):** (١) المالك: domain/owner-entitlement. (٢) السبب: ثلاثة عناقيد متماسكة لمجموع واحد (مصانع السجلات وعكساتها / خمسة محركات الحساب / المدققات التشغيلية التي يفوض إليها transfers أصلًا) — الكل يخدم مجموع استحقاق المالك وحده بملكية واحدة وتغيّر معًا. (٣) الجرد: مستهلك واحد (البرميل) + التطبيق عبره. (٤) حد النمو: راتشة الشريط (906 مسجل؛ الحي **914** عند `fd92d7e8` — +8 موثقة [R6-SCAN-F-006] من التزامات R2 a476ed7a/7fcf37d2). (٥) الحراس: الراتشة + نقاء المجال + أجنحة المجال. (٦) محفز المراجعة: عنقود يستقل ملكية أو مستهلك خارجي جديد. (٧) الشرط الخروجي: قرار مالك. (٨) الاختبارات: غير مباشرة عبر أجنحة المجال. (٩) حد الرجوع: MEDIUM؛ **الاستثناء/التنازل:** —

### `apps/prototype-web/client/src/storage/local/types.ts`

- **الفئة/الطبقة:** production / storage — **nbLOC:** 877 (raw 885، 51790 bytes)
- **المسؤولية:** Storage port + persistence types + schema/export version constants (38/30) + guarded commit types
- **Exports/Imports:** 40/17
- **المستهلكون المباشرون (160):** `apps/prototype-web/client/src/FinalLogicOwnerDecisions.contract.test.ts`, `apps/prototype-web/client/src/FinanceBridge.w173.dom.test.tsx`, `apps/prototype-web/client/src/FinanceBudgets.w174.dom.test.tsx`, `apps/prototype-web/client/src/FinanceUpcoming.dom.test.tsx`, `apps/prototype-web/client/src/G3Hardening.dom.test.tsx`, `apps/prototype-web/client/src/G4RetainedDeposit.dom.test.tsx`, `apps/prototype-web/client/src/InventoryLowStock.dom.test.tsx`, `apps/prototype-web/client/src/Ops001MovementSelection.dom.test.tsx`, `apps/prototype-web/client/src/ReversalSurfacesExe010.dom.test.tsx`, `apps/prototype-web/client/src/StatementPeriod.w173.dom.test.tsx`
- **آثار جانبية/تهيئة:** لا تُكتشف بالنمط
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** AUTHORITATIVE: PrototypeLocalStore port, persistence record types, localSchemaVersion/localExportVersion
- **الاختبارات المباشرة (69):** `FinalLogicOwnerDecisions.contract.test.ts`, `FinanceBridge.w173.dom.test.tsx`, `FinanceBudgets.w174.dom.test.tsx`, `FinanceUpcoming.dom.test.tsx`, `G3Hardening.dom.test.tsx`, `G4RetainedDeposit.dom.test.tsx`, `InventoryLowStock.dom.test.tsx`, `Ops001MovementSelection.dom.test.tsx`
- **الإجراء:** **PRESERVE — إبقاء موثق كامل الأركان (ترقية الإجراء بمصالحة R6-W1، 2026-10-09 [R6-SCAN-F-011]؛ كان «SPLIT_CANDIDATE — PRESERVE structure this program (port inventory Wave N)»):** (١) المالك: storage. (٢) السبب: مسؤولية واحدة — منفذ PrototypeLocalStore وأنواع السجلات الدائمة وثوابت الإصدار؛ التركيب الموصوف حيًا: عائلات اللقطات :344–394، مظروف التصدير :395–406 (ملاصق لعقد 39)، رموز النتائج :407–419، المنفذ :429–884 (52% من الملف). (٣) جرد Wave N سُلّم بتنفيذ R3: **130 طريقة في 22 مجموعة قدرة** موثقة في سجل الملكية §2. (٤) حد النمو: راتشة الشريط SPLIT_CANDIDATE (الحي 876 nbLOC عند `fd92d7e8`). (٥) الحراس: الراتشة + اختبارات حوكمة الإصدار (4+) + 28 ذهبية + MANIFEST + اختبار الأزواج المقبولة. (٦) محفز المراجعة: مجموعة قدرة جديدة أو ترحيل أو عبور شريط. (٧) الشرط الخروجي: قرار **Wave O** بقرار مالك. (٨) الاختبارات: 69 مباشرة + حوكمة الإصدار. (٩) حد الرجوع: HIGH. **الملف Schema-adjacent بالتعريف:** يثبّت `localSchemaVersion=38` و`localExportVersion=30` عند :55/:71 — **أي شطر مستقبلي قرار محمي يتطلب بوابة Wave O وأدلة تكافؤ/عقد كاملة، ولا يُمس في هذا البرنامج.**؛ **أثر الرجوع:** HIGH — version constants and record shapes are data-compat surface؛ **الاستثناء/التنازل:** STR-307 documented type-only cycle member

### `apps/prototype-web/client/src/pages/InventoryMaterials.tsx`

- **الفئة/الطبقة:** production / ui — **nbLOC:** 863 (raw 880، 39799 bytes)
- **المسؤولية:** ui implementation (heuristic; see methodology)
- **Exports/Imports:** 1/15
- **المستهلكون المباشرون (6):** `apps/prototype-web/client/src/G004CapabilityGuard.dom.test.tsx`, `apps/prototype-web/client/src/InventoryAdjustExe012.dom.test.tsx`, `apps/prototype-web/client/src/InventoryLowStock.dom.test.tsx`, `apps/prototype-web/client/src/PurchasingBridgeExe011.dom.test.tsx`, `apps/prototype-web/client/src/app/MicroRouter.tsx`, `apps/prototype-web/client/src/group2InventorySurfaces.test.tsx`
- **آثار جانبية/تهيئة:** module-mutable
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** —
- **الاختبارات المباشرة (5):** `G004CapabilityGuard.dom.test.tsx`, `InventoryAdjustExe012.dom.test.tsx`, `InventoryLowStock.dom.test.tsx`, `PurchasingBridgeExe011.dom.test.tsx`, `group2InventorySurfaces.test.tsx`
- **الإجراء:** **حزمة R7 صريحة R6-F17-P09 `InventoryMaterials.tsx` [R6-SCAN-F-017 — تحويل المسار إلى DEFER package موثق بمصالحة R6-W1، 2026-10-09؛ كان «SPLIT_CANDIDATE — growth-control plan before adding scope» بلا أركان]:**
  - **المالك:** Micro owner (بوابة R7)؛ منفذ R7: منفذ موجة UI structural boundaries.
  - **المسؤولية/seam المتأثر:** صفحة مواد المخزون — منسّق قراءات المخزون والاقتراحات.
  - **نطاق R7:** جرد استخراج نموذج عرض الصفحة خلف سطح استعلام.
  - **الزناد:** تفويض/بدء موجة R7 بقرار المالك (لا شيء يبدأ تلقائيًا).
  - **الاعتماديات:** خطة successor §R7؛ أمر R6-W1 يثبت هذه الحزم دون تنفيذ.
  - **معايير القبول:** استخراج view-model/query-surface بلا نقل أي حقيقة مالية للواجهة؛ صفر تغيير سلوك مالي/دلالي/تاريخي؛ الأجنحة خضراء على الرأس المدفوع.
  - **توقع الرحلات/الاختبارات:** رحلات G004CapabilityGuard/InventoryAdjustExe012/InventoryLowStock/PurchasingBridgeExe011 + group2InventorySurfaces تبقى خضراء.
  - **الشرط الخروجي:** الصفحة/المكوّن يُدار عبر سطح استعلام مستخرج بعقد موثق وjourney tests تغطي المسار.
  - **حد الرجوع:** revert شريحة الصفحة/المكوّن فقط (إعادة الوحدة إلى حالتها السابقة بلا فقدان سلوك).
  - **استبعاد صريح:** **لا عمل بصري/UI في هذه الحزمة** — CSS/DOM/tokens/تنقل/نصوص كلها على track T خلف بوابة مالك مستقلة؛ R7 بنيوي حصرًا.
  - **أثر الرجوع:** MEDIUM؛ **الاستثناء/التنازل:** —

### `apps/prototype-web/client/src/components/finance/EventsLayer.tsx`

- **الفئة/الطبقة:** production / ui — **nbLOC:** 834 (raw 843، 40324 bytes)
- **المسؤولية:** ui implementation (heuristic; see methodology)
- **Exports/Imports:** 3/13
- **المستهلكون المباشرون (2):** `apps/prototype-web/client/src/group1Surfaces.test.tsx`, `apps/prototype-web/client/src/pages/Finance.tsx`
- **آثار جانبية/تهيئة:** لا تُكتشف بالنمط
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** —
- **الاختبارات المباشرة (1):** `group1Surfaces.test.tsx`
- **الإجراء:** **حزمة R7 صريحة R6-F17-P10 `components/finance/EventsLayer.tsx` [R6-SCAN-F-017 — تحويل المسار إلى DEFER package موثق بمصالحة R6-W1، 2026-10-09؛ كان «SPLIT_CANDIDATE — growth-control plan before adding scope» بلا أركان]:**
  - **المالك:** Micro owner (بوابة R7)؛ منفذ R7: منفذ موجة UI structural boundaries.
  - **المسؤولية/seam المتأثر:** طبقة أحداث المالية — **10.6% فقط للمكوّن الرئيسي** (الباقي أقسام عرض متوازية).
  - **نطاق R7:** فصل أقسام العرض عن منطق التجميع وفق جرد الاستخراج.
  - **الزناد:** تفويض/بدء موجة R7 بقرار المالك (لا شيء يبدأ تلقائيًا).
  - **الاعتماديات:** خطة successor §R7؛ أمر R6-W1 يثبت هذه الحزم دون تنفيذ.
  - **معايير القبول:** استخراج view-model/query-surface بلا نقل أي حقيقة مالية للواجهة؛ صفر تغيير سلوك مالي/دلالي/تاريخي؛ الأجنحة خضراء على الرأس المدفوع.
  - **توقع الرحلات/الاختبارات:** اختبار group1Surfaces + رحلات Finance* التي تمر بالطبقة تبقى خضراء.
  - **الشرط الخروجي:** الصفحة/المكوّن يُدار عبر سطح استعلام مستخرج بعقد موثق وjourney tests تغطي المسار.
  - **حد الرجوع:** revert شريحة الصفحة/المكوّن فقط (إعادة الوحدة إلى حالتها السابقة بلا فقدان سلوك).
  - **استبعاد صريح:** **لا عمل بصري/UI في هذه الحزمة** — CSS/DOM/tokens/تنقل/نصوص كلها على track T خلف بوابة مالك مستقلة؛ R7 بنيوي حصرًا.
  - **أثر الرجوع:** MEDIUM؛ **الاستثناء/التنازل:** —
  - **الإغلاق (R7-1، 2026-10-10):** منفذة على الفرع نفسه — نقل حرفي لصف الحدث وأدواته (eventLabel/expenseContextLabel/CorrectionMode/familyEventOwner/FinancialEventRow) إلى `components/finance/FinancialEventRow.tsx`؛ الطبقة 100 سطر NORMAL (كانت 834 SPLIT_CANDIDATE) والصف 742 nbLOC WATCH بمدخل أساس نفس-الـPR؛ المستهلكون لم يتغيروا (Finance:70 + group1Surfaces)؛ رحلات group1Surfaces/EventsLayer.familyGuard/FinanceJourneys/D005 خضراء.

### `apps/prototype-web/client/src/pages/Statement.tsx`

- **الفئة/الطبقة:** production / ui — **nbLOC:** 815 (raw 833، 38464 bytes)
- **المسؤولية:** ui implementation (heuristic; see methodology)
- **Exports/Imports:** 1/17
- **المستهلكون المباشرون (3):** `apps/prototype-web/client/src/G2.dom.test.tsx`, `apps/prototype-web/client/src/StatementPeriod.w173.dom.test.tsx`, `apps/prototype-web/client/src/app/MicroRouter.tsx`
- **آثار جانبية/تهيئة:** module-mutable
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** —
- **الاختبارات المباشرة (2):** `G2.dom.test.tsx`, `StatementPeriod.w173.dom.test.tsx`
- **الإجراء:** **حزمة R7 صريحة R6-F17-P11 `Statement.tsx` [R6-SCAN-F-017 — تحويل المسار إلى DEFER package موثق بمصالحة R6-W1، 2026-10-09؛ كان «SPLIT_CANDIDATE — growth-control plan before adding scope» بلا أركان]:**
  - **المالك:** Micro owner (بوابة R7)؛ منفذ R7: منفذ موجة UI structural boundaries.
  - **المسؤولية/seam المتأثر:** صفحة البيان — منسّق عرض بيان الفترة؛ **تحمل أيضًا ملاحظة track-T منفصلة [R6-SCAN-F-022]: الاستنساخ المباشر الوحيد لخدمة عديمة الحالة خارج جذر التركيب عند :167 (StatementMarkdownService — لا يكسر قاعدة طبقة؛ تسويته ضمن جرد التركيب لموجة UI)**.
  - **نطاق R7:** جرد استخراج نموذج عرض البيان خلف سطح استعلام + تسوية موضع خدمة الماركداون مع جرد التركيب.
  - **الزناد:** تفويض/بدء موجة R7 بقرار المالك (لا شيء يبدأ تلقائيًا).
  - **الاعتماديات:** خطة successor §R7؛ أمر R6-W1 يثبت هذه الحزم دون تنفيذ.
  - **معايير القبول:** استخراج view-model/query-surface بلا نقل أي حقيقة مالية للواجهة؛ صفر تغيير سلوك مالي/دلالي/تاريخي؛ الأجنحة خضراء على الرأس المدفوع.
  - **توقع الرحلات/الاختبارات:** رحلتا G2/StatementPeriod.w173 تبقيان خضراوين.
  - **الشرط الخروجي:** الصفحة/المكوّن يُدار عبر سطح استعلام مستخرج بعقد موثق وjourney tests تغطي المسار.
  - **حد الرجوع:** revert شريحة الصفحة/المكوّن فقط (إعادة الوحدة إلى حالتها السابقة بلا فقدان سلوك).
  - **استبعاد صريح:** **لا عمل بصري/UI في هذه الحزمة** — CSS/DOM/tokens/تنقل/نصوص كلها على track T خلف بوابة مالك مستقلة؛ R7 بنيوي حصرًا.
  - **أثر الرجوع:** MEDIUM؛ **الاستثناء/التنازل:** —

### `apps/prototype-web/client/src/application/financial-analysis/financialAnalysisService.ts`

- **الفئة/الطبقة:** production / application — **nbLOC:** 553 (raw 572، 25414 bytes)
- **المسؤولية:** Break-even/liquidity application service (canonical home since Wave 4A)
- **Exports/Imports:** 10/11 (+1 dynamic)
- **المستهلكون المباشرون (8):** `apps/prototype-web/client/src/app/PrototypeServicesContext.tsx`, `apps/prototype-web/client/src/application/finance/breakEvenModelParity.test.ts`, `apps/prototype-web/client/src/application/finance/d03DeliveryOperatingPath.test.ts`, `apps/prototype-web/client/src/application/finance/operatingBreakEvenModel.test.ts`, `apps/prototype-web/client/src/application/finance/projectFinancialService.ts`, `apps/prototype-web/client/src/application/financial-analysis/financialAnalysisService.shortCashHorizon.test.ts`, `apps/prototype-web/client/src/application/financial-analysis/financialAnalysisService.test.ts`, `apps/prototype-web/client/src/application/g5/g5Service.ts`
- **آثار جانبية/تهيئة:** module-mutable
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** —
- **الاختبارات المباشرة (5):** `breakEvenModelParity.test.ts`, `d03DeliveryOperatingPath.test.ts`, `operatingBreakEvenModel.test.ts`, `financialAnalysisService.shortCashHorizon.test.ts`, `financialAnalysisService.test.ts`
- **الإجراء:** WATCH — no unrelated responsibility without review؛ **أثر الرجوع:** HIGH؛ **الاستثناء/التنازل:** D-034 dynamic-import waiver

### `apps/prototype-web/client/src/application/financial-records/correctionHistoryService.ts`

- **الفئة/الطبقة:** production / application — **nbLOC:** 458 (raw 481، 26217 bytes)
- **المسؤولية:** Correction history reads over persisted records (moved with the Financial Records cluster — 4B follow-up)
- **Exports/Imports:** 7/6
- **المستهلكون المباشرون (3):** `apps/prototype-web/client/src/app/PrototypeServicesContext.tsx`, `apps/prototype-web/client/src/application/finance/correctionHistoryService.ts`, `apps/prototype-web/client/src/application/financial-records/correctionHistoryService.test.ts`
- **آثار جانبية/تهيئة:** لا تُكتشف بالنمط
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** Read model over storage; canonical reader stays projectFinancialService (contract 40)
- **الاختبارات المباشرة (1):** `correctionHistoryService.test.ts`
- **الإجراء:** WATCH — band carried over on the move (ratchet baseline re-pathed in the same PR)؛ **أثر الرجوع:** HIGH؛ **الاستثناء/التنازل:** —

### `apps/prototype-web/client/src/storage/local/capabilities/orderLifecycleCapability.contract.test.ts`

- **الفئة/الطبقة:** test / storage — **nbLOC:** 370 (raw 394، 16453 bytes)
- **المسؤولية:** Capability-lens contract suite run against BOTH adapters (membership, guarded writes, replay, stale)
- **Exports/Imports:** 0/13
- **المستهلكون المباشرون (0):** —
- **آثار جانبية/تهيئة:** module-mutable
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** Parity oracle for the pilot capability
- **الاختبارات المباشرة (0):** لا تغطية مباشرة (انظر بطاقات الفجوة)
- **الإجراء:** TEST — judged as test asset, not production؛ **أثر الرجوع:** LOW؛ **الاستثناء/التنازل:** —

### `apps/prototype-web/client/src/application/budgets/expenseBudgetService.ts`

- **الفئة/الطبقة:** production / application — **nbLOC:** 345 (raw 370، 18485 bytes)
- **المسؤولية:** Expense budgets (contract 42) — moved with the Budgets & Planning cluster (4B follow-up)
- **Exports/Imports:** 7/3
- **المستهلكون المباشرون (3):** `apps/prototype-web/client/src/application/budgets/expenseBudgetService.3c.test.ts`, `apps/prototype-web/client/src/application/finance/expenseBudgetService.ts`, `apps/prototype-web/client/src/application/transfers/exportGoldens.test.ts`
- **آثار جانبية/تهيئة:** module-mutable
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** Plan records, not financial events (contract 42); direct coverage added in 3C
- **الاختبارات المباشرة (2):** `expenseBudgetService.3c.test.ts`, `exportGoldens.test.ts`
- **الإجراء:** NORMAL — mechanical move, tests moved with it؛ **أثر الرجوع:** HIGH؛ **الاستثناء/التنازل:** —

### `apps/prototype-web/client/src/application/transfers/localTransferService.ts`

- **الفئة/الطبقة:** production / application — **nbLOC:** 305 (raw 315، 15746 bytes)
- **المسؤولية:** Export/import orchestration: envelope, migrations, atomic replaceSnapshot w/ verified backup
- **Exports/Imports:** 5/13
- **المستهلكون المباشرون (25):** `apps/prototype-web/client/src/app/PrototypeServicesContext.tsx`, `apps/prototype-web/client/src/application/transfers/catalogCoreTransfer.test.ts`, `apps/prototype-web/client/src/application/transfers/dataRoundTrip.exe014.test.ts`, `apps/prototype-web/client/src/application/transfers/exportGoldens.test.ts`, `apps/prototype-web/client/src/application/transfers/localTransferService.assetResidual.test.ts`, `apps/prototype-web/client/src/application/transfers/localTransferService.capabilitiesRoundTrip.test.ts`, `apps/prototype-web/client/src/application/transfers/localTransferService.directSaleRoundTrip.test.ts`, `apps/prototype-web/client/src/application/transfers/localTransferService.envelope27.test.ts`, `apps/prototype-web/client/src/application/transfers/localTransferService.expenseBudget.test.ts`, `apps/prototype-web/client/src/application/transfers/localTransferService.familyOrphan.test.ts`
- **آثار جانبية/تهيئة:** لا تُكتشف بالنمط
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** AUTHORITATIVE: released historical pairs + migration chain
- **الاختبارات المباشرة (22):** `catalogCoreTransfer.test.ts`, `dataRoundTrip.exe014.test.ts`, `exportGoldens.test.ts`, `localTransferService.assetResidual.test.ts`, `localTransferService.capabilitiesRoundTrip.test.ts`, `localTransferService.directSaleRoundTrip.test.ts`, `localTransferService.envelope27.test.ts`, `localTransferService.expenseBudget.test.ts`
- **الإجراء:** PRESERVE + characterization (Wave 3A goldens)؛ **أثر الرجوع:** HIGH؛ **الاستثناء/التنازل:** —

### `apps/prototype-web/client/src/application/transfers/historical817.fixture.ts`

- **الفئة/الطبقة:** production / application — **nbLOC:** 290 (raw 306، 8510 bytes)
- **المسؤولية:** Shared 8/17-era custodial fixture (extracted Wave 3A) used by pairs + goldens tests
- **Exports/Imports:** 15/0
- **المستهلكون المباشرون (4):** `apps/prototype-web/client/src/application/transfers/exportGoldens.test.ts`, `apps/prototype-web/client/src/application/transfers/localTransferService.releasedPairs.test.ts`, `apps/prototype-web/client/src/application/transfers/transferCounters.migrations.characterization.test.ts`, `apps/prototype-web/client/src/application/transfers/transferFamilyValidators.characterization.test.ts`
- **آثار جانبية/تهيئة:** لا تُكتشف بالنمط
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** Test data source for the 8/17 parity baseline
- **الاختبارات المباشرة (4):** `exportGoldens.test.ts`, `localTransferService.releasedPairs.test.ts`, `transferCounters.migrations.characterization.test.ts`, `transferFamilyValidators.characterization.test.ts`
- **الإجراء:** FIXTURE — version with its consumers؛ **أثر الرجوع:** LOW؛ **الاستثناء/التنازل:** —

### `scripts/check-module-boundaries.mjs`

- **الفئة/الطبقة:** script / infra — **nbLOC:** 250 (raw 264، 14885 bytes)
- **المسؤولية:** Wave 4E resolution-based boundary observer: deep-domain/UI-to-domain/application-to-presentation ratchets with embedded accepted baselines
- **Exports/Imports:** 6/6
- **المستهلكون المباشرون (1):** `scripts/check-module-boundaries.test.mjs`
- **آثار جانبية/تهيئة:** لا تُكتشف بالنمط
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** GUARD — baselines mirror registry §5 accepted state; CI rejects new edges only
- **الاختبارات المباشرة (0):** لا تغطية مباشرة (انظر بطاقات الفجوة)
- **الإجراء:** NORMAL — baseline updates only in the same PR as the legitimate edge + registry row؛ **أثر الرجوع:** LOW — revert restores pre-4E guarding؛ **الاستثناء/التنازل:** —

### `scripts/check-file-size-ratchet.mjs`

- **الفئة/الطبقة:** script / infra — **nbLOC:** 190 (raw 202، 8883 bytes)
- **المسؤولية:** Wave 4E band ratchet over production+script files (register thresholds literal)
- **Exports/Imports:** 10/5
- **المستهلكون المباشرون (1):** `scripts/check-file-size-ratchet.test.mjs`
- **آثار جانبية/تهيئة:** module-mutable
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** GUARD — baseline JSON is the accepted state (generated from register v1.2)
- **الاختبارات المباشرة (0):** لا تغطية مباشرة (انظر بطاقات الفجوة)
- **الإجراء:** NORMAL — baseline updates are deliberate, reviewable growth records؛ **أثر الرجوع:** LOW؛ **الاستثناء/التنازل:** —

### `apps/prototype-web/client/src/application/transfers/transferCompatibilityRegistry.test.ts`

- **الفئة/الطبقة:** test / application — **nbLOC:** 151 (raw 160، 8555 bytes)
- **المسؤولية:** Wave 4D registry tests: completeness, exact acceptance (current union + registry), delegation probes, tsc type layer
- **Exports/Imports:** 0/10
- **المستهلكون المباشرون (0):** —
- **آثار جانبية/تهيئة:** module-mutable
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** Executable proof of the compatibility registry
- **الاختبارات المباشرة (0):** لا تغطية مباشرة (انظر بطاقات الفجوة)
- **الإجراء:** TEST — judged as test asset, not production؛ **أثر الرجوع:** LOW؛ **الاستثناء/التنازل:** —

### `apps/prototype-web/client/src/application/transfers/transferCompatibilityValues.ts`

- **الفئة/الطبقة:** production / application — **nbLOC:** 115 (raw 121، 8584 bytes)
- **المسؤولية:** Wave 4D historical-compatibility registry: the only home for acceptance values beyond current domain/storage unions + acceptance-source map
- **Exports/Imports:** 6/1
- **المستهلكون المباشرون (2):** `apps/prototype-web/client/src/application/transfers/transferCompatibilityRegistry.test.ts`, `apps/prototype-web/client/src/application/transfers/transferFamilyValidators.ts`
- **آثار جانبية/تهيئة:** لا تُكتشف بالنمط
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** AUTHORITATIVE for historical compatibility values (contract 39); type-locked outside the current union
- **الاختبارات المباشرة (1):** `transferCompatibilityRegistry.test.ts`
- **الإجراء:** NORMAL — update in lockstep with validator acceptance changes؛ **أثر الرجوع:** MEDIUM — type-only authority doc؛ **الاستثناء/التنازل:** —

### `apps/prototype-web/client/src/application/transfers/domainTransferDriftAnchors.ts`

- **الفئة/الطبقة:** production / application — **nbLOC:** 97 (raw 105، 3334 bytes)
- **المسؤولية:** Wave 3B drift anchors: domain-union completeness maps for the transfer validators (no logic)
- **Exports/Imports:** 8/4
- **المستهلكون المباشرون (1):** `apps/prototype-web/client/src/application/transfers/domainTransferDriftGuard.test.ts`
- **آثار جانبية/تهيئة:** لا تُكتشف بالنمط
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** Drift-guard data source (type-enforced on live domain unions)
- **الاختبارات المباشرة (1):** `domainTransferDriftGuard.test.ts`
- **الإجراء:** NORMAL — update in lockstep with domain value changes؛ **أثر الرجوع:** LOW؛ **الاستثناء/التنازل:** —

### `docs/operations/control/generated/MASTER-TRACKER.md`

- **الفئة/الطبقة:** generated / ops-generated — **nbLOC:** 85 (raw 88، 19248 bytes)
- **المسؤولية:** Generated view of Operations Control (never hand-edited)
- **Exports/Imports:** 0/0
- **المستهلكون المباشرون (0):** —
- **آثار جانبية/تهيئة:** لا تُكتشف بالنمط
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** GENERATED — source = items/*.json + workstreams/*.json + generate_tracker.py
- **الاختبارات المباشرة (0):** لا تغطية مباشرة (انظر بطاقات الفجوة)
- **الإجراء:** GENERATED — regenerate only via official generator؛ **أثر الرجوع:** LOW؛ **الاستثناء/التنازل:** —

### `apps/prototype-web/client/src/storage/local/capabilities/orderLifecycleStore.ts`

- **الفئة/الطبقة:** production / storage — **nbLOC:** 48 (raw 51، 3373 bytes)
- **المسؤولية:** Wave 4C pilot capability port: order lifecycle (9 methods) derived from the facade via Pick
- **Exports/Imports:** 3/1
- **المستهلكون المباشرون (5):** `apps/prototype-web/client/src/application/agreements/agreementContextService.ts`, `apps/prototype-web/client/src/application/agreements/agreementService.ts`, `apps/prototype-web/client/src/application/financial-pulse/financialPulseService.ts`, `apps/prototype-web/client/src/storage/local/capabilities/orderLifecycleCapability.contract.test.ts`, `apps/prototype-web/client/src/storage/local/capabilities/orderLifecycleCapabilityAnchors.ts`
- **آثار جانبية/تهيئة:** لا تُكتشف بالنمط
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** CAPABILITY VIEW — PrototypeLocalStore (types.ts) stays the authoritative port; signatures cannot drift
- **الاختبارات المباشرة (1):** `orderLifecycleCapability.contract.test.ts`
- **الإجراء:** NORMAL — registry §2 row updated; consumer migration continues per capability (RC-7)؛ **أثر الرجوع:** HIGH (type-only; revert restores facade-only typing)؛ **الاستثناء/التنازل:** —

### `apps/prototype-web/client/src/storage/local/capabilities/orderLifecycleCapabilityAnchors.ts`

- **الفئة/الطبقة:** production / storage — **nbLOC:** 33 (raw 37، 2178 bytes)
- **المسؤولية:** Type-level anchors proving both adapters + the facade satisfy the capability (no runtime logic)
- **Exports/Imports:** 3/4
- **المستهلكون المباشرون (0):** —
- **آثار جانبية/تهيئة:** لا تُكتشف بالنمط
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** Enforced by app tsc + the capability contract test (spawned tsc — Wave 3B pattern)
- **الاختبارات المباشرة (0):** لا تغطية مباشرة (انظر بطاقات الفجوة)
- **الإجراء:** NORMAL — keep in lockstep with the capability membership؛ **أثر الرجوع:** LOW؛ **الاستثناء/التنازل:** —

### `docs/fixtures/g82-guided-opening-import-fixtures.json`

- **الفئة/الطبقة:** fixture / infra — **nbLOC:** 22 (raw 22، 1750 bytes)
- **المسؤولية:** Guided-opening import fixtures (repo fixture consumed by a test)
- **Exports/Imports:** 0/0
- **المستهلكون المباشرون (1):** `apps/prototype-web/client/src/application/transfers/guidedOpeningImportService.g82.test.ts`
- **آثار جانبية/تهيئة:** لا تُكتشف بالنمط
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** —
- **الاختبارات المباشرة (0):** لا تغطية مباشرة (انظر بطاقات الفجوة)
- **الإجراء:** PRESERVE; Wave 3A added 28 export goldens under docs/fixtures/export-goldens/ beside it؛ **أثر الرجوع:** LOW؛ **الاستثناء/التنازل:** —

### `src/domain/g5/index.ts`

- **الفئة/الطبقة:** production / domain — **nbLOC:** 14 (raw 14، 931 bytes)
- **المسؤولية:** Documented compatibility barrel (frozen-UI specifiers) — re-exports domain/financial-analysis (Wave 4A)
- **Exports/Imports:** 1/0
- **المستهلكون المباشرون (3):** `apps/prototype-web/client/src/components/finance/G5DecisionPanel.tsx`, `apps/prototype-web/client/src/pages/Finance.tsx`, `tests/domain/public-surface.test.ts`
- **آثار جانبية/تهيئة:** لا تُكتشف بالنمط
- **دور API العام:** barrel عام؛ **دور مصدر الحقيقة:** COMPAT SHIM — surface equality pinned by public-surface test
- **الاختبارات المباشرة (1):** `public-surface.test.ts`
- **الإجراء:** NORMAL — frozen until the UI wave removes importers؛ **أثر الرجوع:** LOW؛ **الاستثناء/التنازل:** —

### `apps/prototype-web/client/src/application/g5/g5Service.ts`

- **الفئة/الطبقة:** production / application — **nbLOC:** 11 (raw 11، 839 bytes)
- **المسؤولية:** Documented compatibility shim (frozen-UI specifiers) — re-exports application/financial-analysis (Wave 4A)
- **Exports/Imports:** 1/0
- **المستهلكون المباشرون (18):** `apps/prototype-web/client/src/D005.dom.test.tsx`, `apps/prototype-web/client/src/EventsLayer.familyGuard.dom.test.tsx`, `apps/prototype-web/client/src/FinanceBridge.w173.dom.test.tsx`, `apps/prototype-web/client/src/FinanceBudgets.w174.dom.test.tsx`, `apps/prototype-web/client/src/FinanceEmptyTruth.dom.test.tsx`, `apps/prototype-web/client/src/FinanceJourneys.dom.test.tsx`, `apps/prototype-web/client/src/FinanceObligations.w43.dom.test.tsx`, `apps/prototype-web/client/src/FinanceSafeWithdrawal.w176.dom.test.tsx`, `apps/prototype-web/client/src/FinanceShortCashHorizon.w175.dom.test.tsx`, `apps/prototype-web/client/src/G005FinanceReadIsolation.dom.test.tsx`
- **آثار جانبية/تهيئة:** لا تُكتشف بالنمط
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** COMPAT SHIM — not a source of truth; removal is owner-gated with the UI track
- **الاختبارات المباشرة (15):** `D005.dom.test.tsx`, `EventsLayer.familyGuard.dom.test.tsx`, `FinanceBridge.w173.dom.test.tsx`, `FinanceBudgets.w174.dom.test.tsx`, `FinanceEmptyTruth.dom.test.tsx`, `FinanceJourneys.dom.test.tsx`, `FinanceObligations.w43.dom.test.tsx`, `FinanceSafeWithdrawal.w176.dom.test.tsx`
- **الإجراء:** NORMAL — frozen until the UI wave removes importers؛ **أثر الرجوع:** LOW؛ **الاستثناء/التنازل:** —

### `apps/prototype-web/client/src/application/finance/ownerEntitlementService.ts`

- **الفئة/الطبقة:** production / application — **nbLOC:** 10 (raw 10، 722 bytes)
- **المسؤولية:** Documented compatibility shim (frozen-UI specifiers) — re-exports application/owner-money (Wave 4B)
- **Exports/Imports:** 1/0
- **المستهلكون المباشرون (25):** `apps/prototype-web/client/src/D005.dom.test.tsx`, `apps/prototype-web/client/src/DeepScreens.w43.dom.test.tsx`, `apps/prototype-web/client/src/EventsLayer.familyGuard.dom.test.tsx`, `apps/prototype-web/client/src/FinanceBridge.w173.dom.test.tsx`, `apps/prototype-web/client/src/FinanceBudgets.w174.dom.test.tsx`, `apps/prototype-web/client/src/FinanceEmptyTruth.dom.test.tsx`, `apps/prototype-web/client/src/FinanceJourneys.dom.test.tsx`, `apps/prototype-web/client/src/FinanceObligations.w43.dom.test.tsx`, `apps/prototype-web/client/src/FinanceSafeWithdrawal.w176.dom.test.tsx`, `apps/prototype-web/client/src/FinanceShortCashHorizon.w175.dom.test.tsx`
- **آثار جانبية/تهيئة:** لا تُكتشف بالنمط
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** COMPAT SHIM — not a source of truth
- **الاختبارات المباشرة (17):** `D005.dom.test.tsx`, `DeepScreens.w43.dom.test.tsx`, `EventsLayer.familyGuard.dom.test.tsx`, `FinanceBridge.w173.dom.test.tsx`, `FinanceBudgets.w174.dom.test.tsx`, `FinanceEmptyTruth.dom.test.tsx`, `FinanceJourneys.dom.test.tsx`, `FinanceObligations.w43.dom.test.tsx`
- **الإجراء:** NORMAL — frozen until the UI wave removes importers؛ **أثر الرجوع:** LOW؛ **الاستثناء/التنازل:** —

### `apps/prototype-web/client/src/application/finance/withdrawalWalletGuard.ts`

- **الفئة/الطبقة:** production / application — **nbLOC:** 6 (raw 6، 378 bytes)
- **المسؤولية:** Documented compatibility shim (frozen-UI specifiers) — re-exports application/owner-money (Wave 4B)
- **Exports/Imports:** 1/0
- **المستهلكون المباشرون (1):** `apps/prototype-web/client/src/application/owner-money/ownerEntitlementService.ts`
- **آثار جانبية/تهيئة:** لا تُكتشف بالنمط
- **دور API العام:** وحدة داخلية؛ **دور مصدر الحقيقة:** COMPAT SHIM — not a source of truth
- **الاختبارات المباشرة (0):** لا تغطية مباشرة (انظر بطاقات الفجوة)
- **الإجراء:** NORMAL — frozen until the UI wave removes importers؛ **أثر الرجوع:** LOW؛ **الاستثناء/التنازل:** —

## 4. تغطية الأسطح المهنية الإضافية (نتيجة أو تصنيف صريح لكل سطح)

| السطح | النتيجة/الدليل | التصنيف |
|---|---|---|
| الآثار الجانبية والتهيئة عند الاستيراد | 167 ملفًا بإشارات جانبية بالنمط عند إعادة القياس؛ 7 مواضع حالة وحدة قابلة للتغيير مسجلة في مسح S2 (أبرزها localDiagnostics singleton تستهلكه ErrorBoundary/Settings/pwa)؛ StartupGate وPrototypeServicesContext (DI كسول ×4) نقطتا التهيئة الرئيسيتان | VERIFIED — مذكرة أعلاه؛ أي إضافة تستلزم تحديثًا |
| الـPublic APIs والعقود والمستهلكون الخارجيون | *(تصحيح مؤرخ 2026-10-07 — R1/TG-01 [R0-N4]، اتجاه من ← إلى: كان «18 برميل domain عام… التطبيق ليس له براميل… DEFER إلى J/K» — قياس v1.4 عابر للموجات):* **19 برميل domain عام** (أضيف برميل توافق g5 بعد إعادة تسمية 4A) + قفل سطح عام باختبار؛ و**التطبيق له 29 بابًا عامًا (public doors)** بقرار ADR-018 (2026-10-05، STR-615): مستهلكو الواجهة يستوردون عبر الأبواب، والاستيراد العميق من داخل التطبيق مجمّد بأساس R6 *(تصحيح مؤرخ 2026-10-09 — R6-W1 [R6-SCAN-F-007]: كان «43 مفتاحًا محتجزًا = 36 جذر تركيب + 7 شيمات مجمدة» — الحي بعد هجرة R5/S1 **42 مفتاحًا = 36 جذر تركيب + 6 شيمات** [Finance.tsx وExpenseBudgetsSectionBody هاجرا إلى باب budgets]؛ المواقع الحية 47 كما هي [الموقع النوعي لـG5DecisionPanel:54 صار يُعدّ تحت مفتاحه القائم])* يحرسه `check-module-boundaries` بعقد اختبار يثبت قيمة سطح كل باب (`applicationDoors.contract.test.ts`) — STR-213/STR-615 منفذان | VERIFIED — البنية الحية أعلاه؛ مراجعة الأبواب عند أي مستهلك جديد (PC-3) |
| الإعدادات وقيم البيئة وحدود الأسرار | لا متغيرات بيئة زمن تشغيل (local-first بلا خلفية)؛ `scripts/check-secrets.mjs` يمسح المستودع (1,311 ملفًا) ويُشغل في CI ضمن guards | PRESERVE — الحارس قائم |
| الأمان والثقة والصلاحيات | بلا Auth (نطاق المرحلة)؛ AppLockGate/DataActionPinGate بوابات قفل محلية؛ التشخيص محدود بثمانية حقول ولا يُرفع أبدًا (STR-310)؛ security-boundaries.md يوثق الحدود | PRESERVE — لا تغيير سياسة صلاحيات |
| الاعتماديات والأداة والقيود | pnpm 9.15.9 + lockfile مجمّد + `--ignore-scripts` في CI + audit بحد إعادة محاولة؛ لا اعتماديات غير مستخدمة مكتشفة في المسح | PRESERVE |
| التزامن وإعادة المحاولة والفشل الجزئي والاستعادة والحتمية | 9 حراس كتابة نقية (idempotency + CAS stale-write) داخل حد الكتابة؛ replaceSnapshot ذري مع نسخة احتياطية متحققة (EXE-014) | PRESERVE (STR-306/314) |
| دورة حياة الحالة والكاش والأحداث والإبطال | *(تصحيح مؤرخ 2026-10-07 — R1/TG-01 [R0-N4]، من ← إلى: كان «لا BroadcastChannel في الإنتاج (0 مطابقات نافعة)… ThemeContext الحالة الوحيدة للسياق» — لم يعد صحيحًا):* قناة **BroadcastChannel واحدة** `micro-data-changed` يملكها جذر التركيب `PrototypeServicesContext.tsx:162-182` للتنبيه بين النوافذ (مسجلة كسطح عام مملوك في سجل الملكية §8 — PA-2)؛ عدّاد إبطال **`dataVersion`** يعيد تركيب غلاف السياق فقط دون إعادة بناء الخدمات؛ **أربعة سياقات React إنتاجية** (PrototypeServices/QuickRecording/UnsavedChanges/Theme) كلها مسجلة بمالكها في §8 المذكور؛ إبطال قراءات الخدمات بإعادة الاستعلام | PRESERVE — لا قناة جديدة إلا بصف ملكية وقبول (PA-2) |
| دورة حياة البيانات والنسخ/الاستعادة والاحتفاظ والحذف والخصوصية | export/import هو مسار النسخ/الاستعادة الوحيد (عقد 39)؛ لا حذف بيانات تلقائي؛ لا PII في التشخيص أو السجلات | PRESERVE — لا حذف/ترحيل بيانات في هذا البرنامج |
| الأداء والموارد وميزانية الحزمة | سقفا **650,000/155,300** بايت محرسان في CI (`check-bundle-budget.mjs` مصدر وحيد) *(تصحيح مؤرخ 2026-10-07 — R1/TG-01 [R0-N4]: كان «155,000» — سقف gzip رُفع إلى 155,300 بقرار المالك الموجه ADR-017 بتاريخ 2026-10-04 = ceil_to_100(155,088+200)؛ لا رفع لاحق في البرنامج)*؛ راتشة الأسطح الكسولة/‎precache (`check-bundle-surfaces.mjs` + أساس ADR-012)؛ 4 خدمات بتحميل كسول (D-034) | PRESERVE — القياس إلزامي عند أي تغيير استيراد |
| الملفات المولدة ومصادرها الحقيقية | 7 ملفات views في operations/control/generated — المصدر JSON + generate_tracker.py (لا تحرير يدوي)؛ __manus__/version.json خارج git | GENERATED — حارس validate.py يرفض الانحراف |
| حتمية الاختبارات والاقتران بالوقت/الترتيب/البيئة | TEST-001/WS-205 أصلح الاقتران بالتاريخ (2026-10-01)؛ لا أجهزة وهمية للوقت غير محكومة؛ مصفوفة توثيق موجودة | PRESERVE — راقبة عند إضافة اختبارات |
| الترحيل والرجوع وتوافق القارئ القديم/الكاتب الجديد | الأزواج التاريخية المقبولة في localTransferService + عقد 39 (المصدر القابل للتنفيذ: `ACCEPTED_PAIRS` في localTransferService.releasedPairs.test.ts)؛ migrations متسلسلة؛ ممنوع تغييرها في هذا البرنامج | PRESERVE — مقيّد بالموجات 3A ذهبيات |
| هوية الأخطاء والتشخيص والمراقبة | هوية أخطاء عربية حرفية في المجال؛ رفض storage_stale بلا كتابة؛ تشخيص محلي ثماني الحقول لا يُرفع | PRESERVE — لا تغيير رسائل في الموجات البنيوية |
| تكافؤ بيئة البناء/الإصدار المحلية وCI | CI = pnpm 9.15.9 + Node 22 + frozen lockfile + نفس أوامر pnpm check المحلية | PRESERVE — قيد توثيق عند أي تغيير أداة |
| تتبع الفروع/PRs/التقارير ونظافة المستودع | Operations Control validator + current-state/log انضباط التأريخ؛ فرع UI محفوظ عمدًا لا يُمس | PRESERVE |

## 5. قواعد ضبط النمو (مطابقة PLAN-A-TO-Z §7.3)

- لا تضاف مسؤولية جديدة إلى أي ملف WATCH/SPLIT_CANDIDATE/SPLIT_NOW دون تحديث هذا السجل وتسجيل الاستثناء أو خطة التقسيم.
- أي ملف يعبر حدًا (400/800/1200 nbLOC) يرفع الحارس التحذيري (وضع المراقبة أولًا ثم ratchet — Wave 4E).
- الاستثناء يحتاج مالكًا وسببًا وتاريخ مراجعة وانتهاءً.

## 6. حدود هذا السجل

- المستهلكون للسكربتات/الإعدادات مقيسون بمراجع الاسم (grep) — أقل دقة من رسم AST للكود.
- المسؤوليات الحرفية منسوخة يدويًا للملفات الحرجة فقط؛ البقيةheuristics طبقية موثقة في المنهجية.
- السجل لا يعيد صياغة قواعد مالية أو عقودًا؛ المصادر السلطوية تظل العقود و `docs/operations/current-state.md`.

**توليد:** سكربت القياس محفوظ خارج المستودع (بيئة الوكيل)؛ إعادة القياس إلزامية عند كل موجة تُغيّر بنية الملفات — رأس القياس الحالي `4a4e317`.

## 7. التحديثات المؤرخة (إعادة القياس v1.1 — Wave 4C)

**تحديث مؤرخ 2026-10-03 (Wave A — STR-607: إكمال تعداد أساس الراتشة):** أُكمل تعداد `scripts/file-size-ratchet-baseline.json` من 350 إلى **357/357** — أُضيفت المداخل السبعة المقيسة غير المتتبعة: الأهداف المنقولة الخمسة من شرائح العناقيد (`budgets/expenseBudgetService`، `finance/correctionHistoryService` [وحدة التوافق]، `financial-records/expenseCategorySuggestions`، `financial-records/expenseRecordIntent`، `financial-records/retainedDepositService`) وسكربتا حارس 4E (`check-file-size-ratchet.mjs`، `check-module-boundaries.mjs`) — كلها شريط NORMAL كما قيست بمنطق الحارس نفسه؛ **صفر عتبة رُفعت وصفر شريط لملف قائم تغير** (العتبات في نص الحارس لا في الأساس). البروتوكول الموثق نفسه: تحديث الأساس في نفس الـPR للشريحة المشروعة مع قيد هنا. الحارس أخضر بعد الإكمال: «357 ملفًا مشمولًا (الأساس 357؛ انكماش 0؛ محذوف 0)».

**تحديث مؤرخ 2026-10-03 (Wave 4C — إعادة القياس الكاملة v1.1):** أعيد بناء رسم الاستيراد (651 عقدة) وإعادة قياس كل الصفوف والأشرطة والفئات عند الرأس أعلاه — يفي بالتزام إعادة القياس المؤجل من إغلاق المرحلة الأولى (تدقيق Agent 5). الفئات الآن: production=332 (كانت 324 عند v1.0)، test=334 (327)، fixture=29 (1 — ذهبيات 3A الـ28)، script=17، config=21، generated=7 — المجموع 740 (كان 697). أضافت 4C ملفين إنتاجيين واختبارًا واحدًا تحت `storage/local/capabilities/` (قدرة دورة حياة الطلب — RC-7) وهاجرت ثلاث خدمات (agreementService، agreementContextService، financialPulseService) إلى النوع الضيق.

**تحديث مؤرخ 2026-10-03 (Wave 4B):** عنقود مال المالك انتقل إلى `application/owner-money/` مع وحدتي توافق في `application/finance/` للواجهة المجمدة (تُقاسان صفين مستقلين بوصفهما COMPAT SHIM).

**تحديث مؤرخ 2026-10-03 (Wave 4A):** مسارات g5 الأساسية صارت `financial-analysis` (Domain/Application)؛ وحدتا توافق (`src/domain/g5/index.ts`، `application/g5/g5Service.ts`) تحفظان محددات الواجهة المجمدة.

**تحديث مؤرخ 2026-10-03 (Wave 4D — إعادة قياس v1.2):** أُضيف سجل التوافق التاريخي (transferCompatibilityValues.ts + اختباره) وتوحيد مصادر قبول المدققات: تفويض بلا كلفة لما برميله داخل أصلًا في رأس الحزمة (materialUnits + قائمتا الميزانية) واستهلاك مصدر الاتفاق من السجل نفسه؛ والقيم التاريخية (3 مصادر اتفاق) صارت في سجلها الموثق وحده؛ وتفويض unitDimensions وقوائم المصروف المتكرر الأربع مؤجل عمدًا (D-034 — هامش السقف الخام) وطواقمها الحرفية موسومة المصدر ومحروسة. طواقم القبول كما هي حرفيًا في كل الدفعات (شهدت بها اختبارات الوصف والذهبيات قبل وبعد). الفئات الآن: production=333، test=335 — المجموع 742.

**تحديث مؤرخ 2026-10-03 (Wave 4E — إعادة قياس v1.3):** أُضيف حارسان واختباراتهما (check-module-boundaries — مراقب حدود قائم على الفَلْحة بثلاث قواعد راتشة بأساس مقبول مضمّن؛ check-file-size-ratchet — راتشة الأشرطة الحجمية بأساس JSON من 350 ملفًا) ووُصلا في سلسلة guards في CI. صفر تغيير إنتاج؛ الحزمة بالبايت نفسه. الفئات الآن: production=333، test=337، script=20 (+3: الحارسان + ملف الأساس)، المجموع 747.

**تحديث مؤرخ 2026-10-03 (شرائح عناقيد المالية — إعادة قياس v1.4):** انتقل عنقود «السجلات المالية» إلى `application/financial-records/` (expenseRecordIntent، expenseCategorySuggestions، correctionHistoryService، retainedDepositService + اختباراتهما الأربعة) وعنقود «الميزانيات والتخطيط» إلى `application/budgets/` (expenseBudgetService + اختباره) بنمط 4B الميكانيكي: نقل ملفات + 5 وحدات توافق للواجهة المجمدة + تحديث المستوردين غير-UI؛ أساسا حارسي 4E حُدّثا في نفس الـPR (حافة R3 لـcorrectionHistory أُعيدت للمسار الجديد بنفس العدد 14؛ مدخل WATCH لـcorrectionHistory أُعيد توجيهه). بقية العناقيد مؤجلة بأسبابها الموثقة (إقامة محروسة بعقد 40 للفحص والعمل المتكرر والقارئ الكنوني).

**تحديث مؤرخ 2026-10-03 (Waves 3A/3B/3C):** ذهبيات التصدير (28 ملفًا تحت `docs/fixtures/export-goldens/` — فئة fixture) + مراسي الدريفت + اختبارات وصف العنقود والميزانيات؛ إضافات اختبار/fixture بلا أي لمس إنتاج عدا استخراج العهدة المشتركة `historical817.fixture.ts`.

**تحديث مؤرخ 2026-10-09 (مصالحة R6-W1 — سجلات/توثيق فقط؛ WS-216/ARCH-007؛ الأصل: مسح R6 القراءة-فقط المقبول وتقريره الكنوني `docs/operations/control/evidence/structural-remediation-r6-20261009/R6-PREFLIGHT-STRUCTURE-ARCHITECTURE-CODE-ORGANIZATION-SCAN-2026-10-09.md` وحزمة قرار المالك `R6-OWNER-REVIEW-AND-DECISION-PACKAGE-2026-10-09.md`):** نُفذت التصحيحات التوثيقية المعتمدة عند رأس المصالحة `fd92d7e8` بلا أي تغيير كود/اختبار/سكربت: (1) [F-002] إعادة إصدار §1 (681/47/13/9/3/4 = 757) وتصحيح عمود profitToCashBridge إلى WATCH ومرجع رأس القياس — التفاصيل في مواضعها؛ (2) [F-003] صفوف الأشقاء الأربعة؛ (3) [F-004] إكمال بطاقة craft-order ومصالحة §2/§3 وإصلاح المؤشر المعلق؛ (4) [F-005] ملاحظة نمو TFV وتصحيح لغة التثبيت؛ (5) [F-006] جدول dispositions النمو داخل-الشريط أدناه؛ (6) [F-007] الأرقام المتقادمة (قدرات 7→16، حراس كتابة 10→9، تكافؤ 6+16، اختبارات مباشرة TFV 4 / IndexedDb 35 / Memory 198، أساس §4 ‏42)؛ (7) [F-008] تصرف debug-collector الكامل؛ (8) [F-011] بطاقة types.ts الكاملة؛ (9) [F-012] توحيد بطاقتي سياسات المجال؛ (10) [F-017] حزم R7 الصريحة للملفات الـ11؛ (11) [F-026] ملحق §23.8 في خطة الانتقال؛ (12) مصفوفة المكتشفات §8 أدناه. **حزمة إنفاذ R8 (المسجلة بموجب F-005/F-006 — تُنفذ في R8 لا الآن):** تحويل `check-file-size-ratchet` من منع التصعيد بين الأشرطة فقط إلى منع نمو غير مبرر داخل الشريط مع منع تعديل baseline في نفس PR لإخفاء النمو — المالك: مالك الحراس؛ الزناد: بدء موجة R8؛ الشرط الخروجي: الراتشة ترفض النمو داخل-الشريط غير المبرر؛ الرجوع: revert حارس واحد.

**جدول dispositions النمو داخل-الشريط المؤرخ (F-006 — مقيس حيًا عند `fd92d7e8` مقابل رأس القياس 4a4e317؛ كل الأسباب من git history موثقة بالتزاماتها):**

| الملف | المسجل ← الحي (nbLOC) | السبب (التزامات) | التصرف |
|---|---|---|---|
| `application/transfers/transferFamilyValidators.ts` | 1,718 ← 1,730 | R2: b890f9a2 + 388dac65 + a476ed7a (تفويض نواة التاريخ المحلي) | حميد — القرار قائم [F-013]؛ الإنفاذ R8 |
| `src/domain/craft-order/policies.ts` | 1,399 ← 1,413 | R2: 94cfba77 (D11 نص المال الكنوني) + 7fcf37d2 (نواة التاريخ) | حميد — القرار قائم [F-004]؛ الإنفاذ R8 |
| `application/transfers/transferSnapshotValidation.ts` | 1,184 ← 1,192 | R2: b890f9a2 | حميد — القرار قائم [F-013]؛ الإنفاذ R8 |
| `src/domain/owner-entitlement/policies.ts` | 906 ← 914 | R2: a476ed7a + 7fcf37d2 | حميد — القرار قائم [F-012]؛ الإنفاذ R8 |
| `application/financial-records/correctionHistoryService.ts` | 458 ← 487 (+29) | R5/S4: 28be1f01 (ترويسات PC-4 تعليقية) + R2: 9a5c50a0 + Wave F: c8ba74e7 + d13f892c (تنسيق) | حميد — تعليقات وبناة فشل موحدة |
| `application/finance/statementService.ts` | 669 ← 690 (+21) | 28be1f01 + 9a5c50a0 + c8ba74e7 + 731f549d | حميد — قارئ PC-4 |
| `application/fulfillment/fulfillmentService.ts` | 740 ← 756 (+16) | f56dca3d + 5758ca11 (هجرة R3) + c8ba74e7 | حميد — هجرة قدرات |
| `application/assets/assetService.ts` | 486 ← 501 (+15) | ce27fc22 (قدرة R3-S4) + 388dac65 + 9a5c50a0 | حميد — هجرة قدرة |
| `application/activity/activityService.ts` | 531 ← 542 (+11) | f56dca3d + 5758ca11 | حميد — هجرة R3 |
| `application/finance/periodComparisonService.ts` | 422 ← 433 (+11) | 28be1f01 + 5758ca11 + c8ba74e7 | حميد — قارئ PC-4 |
| `application/home/homeControlCenterService.ts` | 610 ← 617 (+7) | f56dca3d + 5758ca11 + a476ed7a | حميد |
| `application/catalog/catalogService.ts` | 425 ← 431 (+6) | f56dca3d + 19c45bf2 (قدرة R3-S8) | حميد — هجرة قدرة |
| `src/domain/shared/numeric.ts` | 111 ← 224 (+113) | R2: 7fcf37d2 (إعادة كتابة نواة التاريخ المحلي عدد-صحيح خالص — النواة نفسها نبتت هنا) + a476ed7a + 388dac65 | حميد — النواة الكنونية الآن (مالك الوقت/العدد)؛ ترقّب WATCH عند 400 |
| `scripts/check-module-boundaries.mjs` | 250 ← 398 (+148) | e085addc (إغلاق نقطة عمى الماسح R5/S1: ImportTypeNode + js/jsx) + 2659a8ad (راتشة R6) + 36a096df (STR-617) + 4a0165ad | **ملف حارس على بعد سطرين من عتبة WATCH (400)** — المالك: مالك الحراس؛ يُرقّب يدويًا حتى حزمة R8؛ أي إضافة قاعدة جديدة تقيس وتوثّق نفس-الـPR |

*(تصحيح مؤرخ إضافي [R6-SCAN-F-007]: سطر التقدم السابق لتقرير R5 في سجل حدود R5 كان يشير projectFinancialInsights.ts:140 — الحي :145؛ صُحّح بملاحظة مؤرخة في ذلك السجل نفسه، لا هنا.)*


**تحديث مؤرخ 2026-10-09 (R6-W2 [R6-SCAN-F-024]: نمو حارس مراسي قيم القبول — قياس نفس-الـPR بروتوكول STR-607):** امتد `scripts/check-acceptance-value-anchors.mjs` من 221 إلى **363 nbLOC (+142)** بإضافة عائلات GUARDED_UNION الست (inventoryMovementType وcatalogItemKind وscheduleStatus وyieldReadiness وshortCashDeclaration وexpenseContext) بتثبيت مزدوج (اتحاد المجال == مدققة النقل == الطاقم الموثق) وسلبيات اتجاهين — الشريط **NORMAL** (عتبة WATCH ‏400) والراتشة خضراء؛ واختباره `check-acceptance-value-anchors.test.mjs` من 206 إلى **360 nbLOC** (غير متتبع بالأساس — أصل اختباري). الملف دون صف §2 (إضافة Wave H بعد قياس v1.4 — تحكمه الراتشة والبروتوكول) ويُدرج صفًا عند إعادة القياس الشاملة القادمة. لا عتبة رُفعت ولا شريط تغير.

**تحديث مؤرخ 2026-10-09 (R6-W3 [R6-SCAN-F-009]: فصل محرك/سياسة عدّاد الكثافة — تحديث الأساس نفس-الـPR):** فُصل `scripts/text-density-count.py` (كان 1,253 nbLOC بشريط SPLIT_NOW) إلى **محرك** (`scripts/text-density-count.py` — 458 nbLOC، شريط WATCH؛ ربح راتشة: خُفض مدخل الأساس SPLIT_NOW→WATCH) و**وحدة بيانات سياسة** (`scripts/text_density_policy.py` — 846 nbLOC، شريط SPLIT_CANDIDATE بمدخل أساس جديد موثق هنا وبصف §2 أعلاه؛ الحجم غالبه تاريخ السقوف المؤرخ المحفوظ حرفيًا). المخرجات بايت-متطابقة قبل/بعد (ذهبي تواصيف 4,117 بايت sha256‏ 812a24bb… + 7 اختبارات توصيف/حدّ/سلبيات). أُضيف ملف اختبار التوصيف `scripts/text-density-count.characterization.test.mjs` (139 nbLOC — أصل اختباري غير متتبع بالأساس) والذهبي تحت `docs/fixtures/text-density/` (فئة fixture). صفر عتبة رُفعت؛ صفر تغيير سقوف كثافة؛ لا تغيير سلوك تطبيق.

## 8. مصفوفة مكتشفات مسح R6 (R6-SCAN-F-001..027) — السجل الدائم للتصرفات

> **مصدر السلطة:** تقرير مسح R6 القراءة-فقط المقبول `docs/operations/control/evidence/structural-remediation-r6-20261009/R6-PREFLIGHT-STRUCTURE-ARCHITECTURE-CODE-ORGANIZATION-SCAN-2026-10-09.md` (SHA-256 ‎`e06a27a44baa2d28e53485fc36a8d7aa83605c8c32ab8cc07ab1d3290ae9c777`) وحزمة قرار المالك `R6-OWNER-REVIEW-AND-DECISION-PACKAGE-2026-10-09.md` (SHA-256 ‎`13387db9a7b494699b9f805addd647931424a544592604008fcb4df2b57059e2`) على main عبر PR #337 عند `fd92d7e8812726dcca8d27d3ad64c8f24dc96abd`. هذا القسم سجل تصرفات دائم داخل السجل الكنوني للملفات — **ليس مصدر حقيقة ثانيًا**: الأدلة الكاملة في التقرير؛ ولا تُحرر صفوفه التاريخية بل تُحدَّث بأعمدة مؤرخة.
>
> **نطاق المسح (26 ملفًا — تصحيح جمع الملخص [قرار مراجعة المالك §تناقضات-1]):** 10 PRESERVE ببطاقات كاملة + 3 محلية بتقسيم Wave F (منسّقات الآن 152/200/203) + 11 مسار UI بنيوي إلى R7 + أداة واحدة (text-density-count.py) + **`index.css` صراحةً [F-018 OUT_OF_SCOPE / track T]** = 26. المسح نُفذ عند `43a0f12`؛ القياس الحي للمصالحة عند `fd92d7e8` (فرق الوثائق فقط).

| المكتشف | العنوان | الصنف | العلاقة | الموجة/المسار | التصرف الدائم |
|---|---|---|---|---|---|
| F-001 | اختبار StateRecovery.w44.dom.test.tsx:116 — assertion حالة-وسطية متسابقة (عيب حتمية اختبار لا تطبيق) | FIX_NOW (ملف اختبار فقط) | NEW | **R6-W2** | إصلاح بجذر المشكلة: deferred-promise/releaseRead gate بنمط Home.dom.test.tsx:157 المسبق — بلا إضعاف assertion ولا لمس Assets.tsx؛ خارج W1 (لا يُلمس الملف هنا)؛ خط الأساس المسجل: CI run 37894104251 فشل عند `43a0f12` ونجح عند `fd92d7e8` (run 37976142458) — سلوك متسابق موثق لا عيب تطبيق |
| F-002 | ملخص §1 متقادم مقابل §2 والشجرة | FIX_NOW (توثيق) | DEEPENS R0-N4/N9 | R6-W1 | **منفذ في هذه المصالحة** — §1 أعيد إصداره (681/47/13/9/3/4=757) + تصحيح عمود profitToCash + مرجع الرأس |
| F-003 | صفوف أشقاء Wave-F الأربعة غائبة | FIX_NOW (توثيق) | DEEPENS R0-N4 | R6-W1 | **منفذ** — الصفوف الأربعة بقيم حية |
| F-004 | بطاقة craft-order ناقصة/متعارضة (R0-N8) | FIX_NOW (توثيق) | REOPENED (إتمام R0-N8) | R6-W1 | **منفذ** — البطاقة مكتملة الأركان التسعة ومصالحة والمؤشر مصلح |
| F-005 | تجاوز تثبيت TFV المؤرخ بلا ملاحظة | FIX_NOW (توثيق) + DEFER الإنفاذ→R8 | DEEPENS R0-N17/F-10 | R6-W1 + R8 | **منفذ توثيقيًا** — الملاحظة المؤرخة + تصحيح لغة التثبيت + حزمة R8 مسجلة |
| F-006 | مجتمع النمو الصامت داخل-الشريط (≥12 ملفًا + numeric + الحارس) | FIX_NOW (توثيق) + DEFER الإنفاذ→R8 | DEEPENS R0-N17 | R6-W1 + R8 | **منفذ توثيقيًا** — جدول dispositions الكامل في §7 + حزمة R8 مسجلة |
| F-007 | أرقام بطاقات متقادمة | FIX_NOW (توثيق) | DEEPENS R0-N4 | R6-W1 | **منفذ** — القدرات 16، حراس الكتابة 9، التكافؤ 6+16، الاختبارات المباشرة 4/35/198، أساس §4 ‏42، انحراف سطر D-034 في سجل R5 مصححًا هناك |
| F-008 | debug-collector بلا تغطية سجل | FIX_NOW (توثيق) | NEW | R6-W1 | **منفذ** — التصرف الكامل في §2 |
| F-009 | text-density-count.py — تأكيد إبقاء مجرد يكذبه القياس (seam محرك/بيانات حقيقي) | FIX_NOW (أدوات فقط) | DEEPENS R0-N6 | **R6-W3 (معتمدة — ليست اختيارية بقرار المراجعة)** | البطاقة مصححة بحزمة W3 الكاملة (توصيف أولًا ثم فصل الدفتر ثم تحديث السجلات نفس-الـPR؛ مخرجات بايت-متطابقة) — **لا تنفذ في W1** |
| F-010 | المحولان — PRESERVE كزوج تكافؤ | PRESERVE | CONFIRMS W6/R4-A2 | — | بطاقتا W6 قائمتان + قرار R6 يغلق تسليم R4-A2 (§3)؛ الخروج = Wave O بقرار مالك واحد للزوج |
| F-011 | types.ts — ترقية الإجراء إلى بطاقة كاملة | PRESERVE (توثيق) | DEEPENS | R6-W1 | **منفذ** — Schema-adjacent موثق؛ 38/30 مثبتان عند :55/:71؛ الشطر القادم محمي بـWave O |
| F-012 | توحيد بطاقتي سياسات المجال | PRESERVE (توثيق) | CONFIRMS | R6-W1 | **منفذ** — البطاقتان بتسعة أركان؛ صفر تغيير دلالة |
| F-013 | TFV + TSV — إعادة تحقق الإبقاء مع نقاط ضعف مسجلة | PRESERVE | CONFIRMS ADR-017/R4-C2 | — | عناصر ADR-017 كلها أعيد التحقق حيًا؛ نقاط الضعف (≥4 كتل شبه متطابقة في TSV؛ دبابيس نمو لينة) مسجلة في البطاقتين؛ محفزات إعادة الفتح قائمة |
| F-014 | ownerEntitlementService — seam محمي | PRESERVE الآن + DEFER owner-gated | CONFIRMS + يحدّد S2 | — | البطاقة كاملة (§3)؛ الحزمة المستقبلية: استخراج القراءات بعد R7 بقرار مالك — الزناد والخروج والرجوع موثقة |
| F-015 | عائلات ما بعد التقسيم (PFS/integrity/inventory) | PRESERVE | CONFIRMS Wave F/ADR-013/014 | — | نجومية العائلات متحققة حيًا؛ الأشقاء الأربعة صاروا صفوفًا (F-003) |
| F-016 | profitToCashBridge مستقر عند WATCH 402 | PRESERVE | CONFIRMS R5/S4 | — | العمود مصحح؛ ترويسة PC-4 دقيقة |
| F-017 | مسارات UI البنيوية — حزم R7 صريحة | FIX_NOW (توثيق) + DEFER العمل→R7 | DEEPENS F-09/STR-305/204c | R6-W1 (توثيق) → R7 (عمل) | **منفذ** — الحزم الـ11 (P01..P11) ببطاقات كاملة في §3؛ لا عمل UI في R6 |
| F-018 | index.css — خارج R6 | OUT_OF_SCOPE (track T) | CONFIRMS | track T | موثق في البطاقة والمصفوفة؛ ضمن جمع الـ26 صراحةً |
| F-019 | الدورة المختلطة الوحيدة FinancePeriodResultSection↔Finance | DEFER | CONFIRMS R0-N2 حيًا | **R7** (فك) + **R8** (صنف حارس) | الحل = استخراج FinanceState ضمن P02؛ حارس كشف الدورات المختلطة = R8؛ المالك: مالك الحراس + منفذ R7 |
| F-020 | عيب مرشح الأسطح الكسولة (check-bundle-surfaces.mjs:60) | DEFER | CONFIRMS R0-N1 حيًا | **R8** | الإصلاح بدلالات manifest (isEntry/isDynamicEntry) كحارس الميزانية؛ **لا يُعدل أساس في W1**؛ المالك: مالك الحراس |
| F-021 | شبكة الحراس وحدود الأساس متحققة حرفيًا | PRESERVE | CONFIRMS سجل R5 | — | 17/17 عند `43a0f12` بتوثيق CI؛ أعيد التحقق بالمصالحة |
| F-022 | Statement.tsx:167 — استنساخ خدمة عديمة الحالة خارج جذر التركيب | OUT_OF_SCOPE (ملاحظة track T) | NEW | track T | موثق في بطاقة P11؛ لا كسر قاعدة؛ التسوية ضمن جرد تركيب موجة UI |
| F-023 | احتكاك السجلات تصميم مقصود ضد النمو الصامت | PRESERVE (+ مدخل R7) | NEW | R7 (مدخل ergonomics) | البقاء قرارًا مثبتًا؛ R7 يضيف scaffold/checklist لا يزيل الراتشات |
| F-024 | توسيع مراسي قيم القبول (~6 أطقم) | FIX_NOW (اختباري؛ بجدولة مالك) | DEEPENS STR-104/509 | **R6-W2** | مسجل كمرشح معتمد — **لا يبدأ قبل جرد مواقع دقيق** (paths/أسطر/استيراد كنوني/بناء/سلبيات/سبب لكل موقع) يسلمه منفذ W2؛ الجذر 4D يبقى مسارًا دلاليًا owner-gated |
| F-025 | خريطة الاختبارات/التوثيق مكتملة لكل نطاق الـ26 | PRESERVE | CONFIRMS | — | لا ملف ميت اختباريًا؛ test-map --check بلا انجراف؛ LARGE_TEST مسجلة وتخترق العائلات عبر المُنسّق |
| F-026 | §23.8 لخطة الانتقال متأخرة ثلاث موجات | FIX_NOW (توثيق) | DEEPENS R0-N9 | R6-W1 | **منفذ** — الملحق المؤرخ في REFACTORING-ARCHITECTURE-AND-MIGRATION-PLAN.md §23.8 |
| F-027 | سلاسل الاكتشاف مكتملة والمواقع الكسولة الخمسة موثقة | PRESERVE | CONFIRMS | R7 (مدخل) | مواقع FIN-002 الخمسة مرصودة لجرد R7 |

*(أُنشئ هذا القسم بمصالحة R6-W1، 2026-10-09، عند `fd92d7e8` — علاقات NEW/DEEPENS/REOPENED/CONFIRMS كما في تقرير المسح §13؛ لا توجد IDs مكررة ولا مكتشفات محذفة صامتة.)*
