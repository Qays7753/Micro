# Micro Manage v2 — تحليل أثر إعادة البناء على الكود

> **النوع:** قراءة فقط. **الالتزام:** `5a9064e` على `main`، والفرع `feature/manage-v2`. **التاريخ:** 25/11/2026.
> **القاعدة:** كل نقطة معها مسار الملف والدالة. وحيث لا يوجد دليل قاطع مكتوب «غير متأكد» مع السبب.
> **لم يُعدَّل أي كود في هذا التقرير.** الملفات المضافة: `docs/manage-v2/*` فقط.
> **قرارات المالك المطبَّقة هنا:** (١) التخزين المحلي القديم لمانج كمصدر بيانات يُمسح، ويُسمح بكاش للقراءة فقط والسيرفر هو المصدر الوحيد؛ (٢) المكونات الأخرى تُفصل فقط بموافقة مسبقة لكل حالة؛ (٣) اختبارات الكود المحذوف تُمسح وتُكتب اختبارات المواصفات؛ (٤) مانج له دوال مال خاصة بالفلس، والدوال المشتركة مع التوصيل/السوق لا تتغير.

---

## 0. ملخص تنفيذي

1. **حجم السطح:** 73 صفحة (`client/src/pages/*.tsx` بلا اختبارات)، 82 مسارًا (`app/MicroRouter.tsx`)، 107 ملف إنتاجي يستورد `@/storage/local`، وطبقة التخزين المحلي 16,457 سطرًا.
2. **المال:** كل شيء على `1 minor = 1/100` في `src/domain/shared/currency.ts:2`؛ العرض منزلتان (`application/formatting/formatters.ts:23,98`)، الإدخال منزلتان (`application/input/englishNumeric.ts:24,33`)، و32 ملف إنتاجي فيه `/100` و6 فيه `*100`.
3. **الخادم:** PostgreSQL عبر Cloudflare Hyperdrive أصلًا (`worker/db/db.ts`، `worker/db/pg.ts`)، والـ`batch` معاملة واحدة. جدول `manage_record` مستندي (JSON) ويقبل UPDATE بـCAS (`worker/api/manageWrites.ts:110`) — تعارض مباشر مع دفتر ثابت.
4. **التخزين المحلي:** 42 مخزنًا (`storage/local/indexedDbStores.ts`)، مخطط v42 (`storage/local/types.ts:94`)، صفر `deleteObjectStore`، و14 حارس كتابة. لا يوجد محرك مزامنة أصلًا (`app/manageOnlineGuard.ts` بوابة وضع فقط).
5. **أدواتي:** تعتمد على مجال الطلبات — `src/domain/planning/policies.ts:18` يستورد `calculateCostSnapshot` من `craft-order`، وتقدير أداة يغذّي تكلفة الطلب (`application/agreements/orderDetailViewModel.ts:71`). الحذف قبل الفصل يكسرها.
6. **«اسأل Micro»:** يكتب حدثًا ماليًا قديمًا مباشرة للخادم (`components/ask/AskDraftCard.tsx:150`) عائلة `financialEvents`، ويستخدم مخزن `ask-history` المحلي (`application/ask/askHistoryService.ts:17`) — الحالة الثانية تخص سجل المحادثة لا المال.
7. **التوصيل والسوق:** لا يعتمدان على مجال مانج المالي. `application/delivery/deliveryService.ts` يستورد `apiFetch` فقط، والسوق لا يستورد مجالًا. لكن `pages/DeliveryReview.tsx` (شاشة تسليم الطلب داخل مانج، مسار `/orders/:id/deliver`) تستخدم `formatMoneyMinor` وتُحذف مع مانج.
8. **الحذف على مستوى التطبيق:** `worker/api/projectLifecycle.ts:88` يصدّر كل عائلات `manage_record`، و`:261` يحذفها كلها ضمن حذف المشروع — مسار تطبيقي قائم يجب أن يبقى صالحًا.
9. **الاختبارات:** 558 ملفًا / 154,484 سطرًا، و275 ملفًا يلمس مجالًا محذوفًا (منهج العدّ: `find` + `grep` على أسماء المجالات). لا أداة كود ميت اليوم (تُضاف `knip` بقرار المالك).
10. **الوثائق:** 41 ملفًا يذكر «قرش/1/100»، منها `docs/product-source-of-truth.md:20` و`docs/contracts/25-network-money-representation-contract.md:21`، وسجل الملكية `docs/architecture/refactoring/OWNERSHIP-AND-TRUTH-REGISTRY.md` (حارس `check-registry-coverage`).

**أخطر 5 نقاط:** (١) وحدة المال: أي دالة مشتركة تتغير تعرض التوصيل/أدواتي بعشر أضعاف — الحل: وحدة فلس جديدة خاصة بمانج، وعدم لمس المشتركة. (٢) دفتر ثابت فوق مخزن JSON يقبل UPDATE. (٣) فصل أدواتي عن `craft-order` قبل الحذف. (٤) كاتب مالي موازٍ في «اسأل Micro». (٥) التخزين المحلي: 107 ملفًا و14 حارسًا وسجل محادثة Ask داخل نفس القاعدة.

---

## 1. المنطقة ١ — الاعتماديات: من يستورد الكود المالي المُراد حذفه

### 1.1 المجالات المالية الحالية وحجمها

| المجال | المسار | القرار |
|---|---|---|
| الطلبات | `src/domain/craft-order/{policies,types,deliveryContribution}.ts` | يُمسح ويُستبدل بكيان «بيع أو طلب» |
| الأحداث المالية (19 نوعًا) | `src/domain/financial-event/policies.ts` (`DELTA_TABLE`) | يُمسح ويُستبدل بـQ1–Q20 |
| النقد والمحافظ | `src/domain/cash-continuity/*` | يُمسح ويُستبدل بصندوقين + مطابقة |
| المخزون والمواد | `src/domain/inventory-material/*` | يُمسح (لا مخزون) |
| المشتريات والموردون | `src/domain/supplier-purchase/*` | يُمسح |
| البيع المباشر | `src/domain/direct-sale/*` | يُدمج في «بيع أو طلب» |
| حق المالك | `src/domain/owner-entitlement/*` | يُمسح ويبقى إيداع/سحب شخصي |
| الأصول | `src/domain/asset/*` | يُمسح |
| القروض | `src/domain/{loan,received-loan}/*` | يُمسح |
| الميزانيات | `src/domain/budget/*` | يُمسح |
| المصاريف المتكررة والهامش | `src/domain/{recurring-expense,recurring-margin}/*` | يُمسح |
| التحليل المالي | `src/domain/financial-analysis/*` | يُعاد بناؤه على §8 |
| التخطيط/التقديرات | `src/domain/planning/*` | **ينتقل إلى أدواتي قبل الحذف** |
| الكتالوج | `src/domain/catalog/*` | يُمسح؛ «منتجاتي» تُبنى من الصفر |
| الأطراف | `src/domain/party/*` | يُمسح؛ الاسم نص حر |
| الوقت الفعلي | `src/domain/actual-time/*` | يُمسح |

### 1.2 المستوردون (ملفات إنتاجية، بلا اختبارات)

| المستورد | الملف/الدالة | ماذا يستورد | الأثر |
|---|---|---|---|
| أدواتي | `src/domain/planning/policies.ts:18` | `calculateCostSnapshot` من `craft-order` | **فصل إلزامي قبل الحذف** |
| أدواتي (واجهة) | `pages/CostCalculator.tsx` | `formatMoneyMinor` + `EnglishNumberInput` | تبقى على وحدة العرض الحالية (قرار المالك: الدوال المشتركة لا تتغير) |
| تقدير → تكلفة طلب | `application/agreements/orderDetailViewModel.ts:71-72` | يقرأ `draft.sourceEstimateId` ثم `costEstimates.get` | **يُقطع** (لا ربط بين أدواتي والطلبات، §14.3) |
| «اسأل Micro» | `components/ask/AskDraftCard.tsx:150` | `constructFinancialEventRecord` + `saveManageRecord("financialEvents")` | **فصل بموافقة المالك**: إزالة مسار المسودة المالية |
| «اسأل Micro» (سجل) | `application/ask/askHistoryService.ts:17` | `PrototypeLocalStore` + `ask-history` | يبقى؛ ليس ماليًا (انظر ٣.٣) |
| التوصيل | `application/delivery/deliveryService.ts` | `apiFetch` فقط | **لا أثر** |
| السوق | `application/market/*` | لا يستورد مجالًا | **لا أثر** |
| لوحة الإشراف | `application/admin/adminPanelService.ts`، `worker/api/adminPanel.ts:13` | `apiFetch` فقط؛ تعليق صريح بعدم قراءة `manage_record` | **لا أثر** |
| الترحيل/التصدير | `application/transfers/*` | يعرف كل عائلة `manage_record` | يُعاد بناؤه (لا ترحيل بيانات) |
| حذف/تصدير المشروع | `worker/api/projectLifecycle.ts:88,261` | يقرأ كل العائلات ويحذفها | **تطبيقي**: يُبقي العقد ويُحدَّث ليطابق المخطط الجديد — بموافقة |

**خلاصة:** الحذف يمسّ أدواتي و«اسأل Micro» والترحيل، ولا يمسّ التوصيل ولا السوق. كل مسّ خارج مانج يحتاج موافقة مسبقة مكتوبة في هذا التقرير (القسم ٨).

---

## 2. المنطقة ٢ — التخزين وقاعدة البيانات

### 2.1 الواقع الحالي

| العنصر | الدليل | الحالة |
|---|---|---|
| جدول السجلات | `worker/db/migrations-pg/0004_manage_records.sql` — `manage_record(workspace_id, family, record_id, data_json TEXT, updated_at BIGINT)` | يُستبدل بجداول §3 |
| الكتابة | `worker/api/manageWrites.ts:33` `saveManageRecord`؛ `:83` `ON CONFLICT DO NOTHING`؛ `:110` `UPDATE … WHERE updated_at = ?` (CAS) | **UPDATE ممنوع على الدفتر** |
| لا حذف سجل | تعليق الملف: «No single-record delete exists on this surface by design» | يبقى المبدأ |
| الاستبدال الكامل | `worker/api/manageMigration.ts:224,364` `DELETE FROM manage_record WHERE workspace_id = ?` | أداة مسح فقط |
| القراءة | `worker/api/manageReads.ts:73,90,126,155` (`listFamilies`, `listFamilyRecords`, `getRecord`, `manageMode`) | تُستبدل بقراءات §8 |
| المسارات | `worker/routes.manage.ts` — `api/manage/link`, `/mode`, `/families`, `/records/:family`, `/records/:family/:id` (GET/PUT), `/migrate/{status,apply,rollback}` | تُقلَّص |
| الهجرات | `worker/db/migrations-pg/` 17 ملفًا؛ هجرات D1 القديمة `worker/db/migrations/` 6 ملفات (تاريخ مُتجاوَز) | هجرات جديدة مرقّمة فقط |
| الملكية | `worker/api/manageReads.ts:32` `requireManageOwnerAudited` + `manage_owner_link` (`0003_manage_online_foundation.sql:13`) | يُعاد استخدامه |
| منع التكرار | `worker/idempotency.ts:52,116,132` (`reserveIdempotent`, `lookupIdempotent`, `storeIdempotent`) | يُعاد استخدامه لـR-25 |
| مساحة العمل | `workspace` (`0001_init.sql:55`) + `manage_enabled` (`0003:6`) | يبقى |

### 2.2 الجداول الجديدة المطلوبة (§3)

`project`, `box`, `product`, `product_component`, `sale`, `sale_line`, `balance_line`, `operation`, `ledger_entry`, `ledger_posting`, `absence_event`, `reconciliation`, `reconciliation_box` — كلها `project_id`، والمال `BIGINT` بالفلس، والتواريخ `DATE` بتوقيت عمّان.

**قواعد الحذف:** لا ترحيل ولا نسخ احتياطي (لا بيانات). مسح `manage_record` للمساحة ثم بناء الجداول. **الهجرات إلى الأمام فقط** (§14.4)، ولا تُحذف هجرات قديمة من التاريخ.

---

## 3. المنطقة ٣ — المزامنة والتخزين المحلي

### 3.1 الواقع

| العنصر | الدليل | العدد/الحجم |
|---|---|---|
| أسماء المخازن | `storage/local/indexedDbStores.ts` | **42 مخزنًا** |
| إصدار المخطط | `storage/local/types.ts:94` `localSchemaVersion = 42` | — |
| الترقية | `storage/local/indexedDbMigrations.ts` `applySchemaUpgrade` | لا `deleteObjectStore` إطلاقًا (0 نتيجة بحث) |
| حراس الكتابة | `storage/local/*CommitGuard.ts` | **14 حارسًا** |
| حجم الطبقة | `storage/local/*.ts` بلا اختبارات | **16,457 سطرًا** |
| المستوردون | `grep "@/storage/local"` بلا اختبارات | **107 ملفًا** |
| المزامنة | `app/manageOnlineGuard.ts:47,72,108` (`refreshManageOnlineMode`, `assertLocalFinancialWriteAllowed`, `guardLocalStoreForOnlineMode`) | **بوابة وضع فقط، لا طابور ولا دمج** |
| حقن الخدمات | `app/PrototypeServicesContext.tsx` | 671 سطرًا، يبني كل خدمة فوق المخزن المحلي |

### 3.2 القرار المطبَّق (المالك)

- التخزين المحلي القديم **كمصدر بيانات يُمسح كله**: لا قراءة حالة، ولا كتابة، ولا حراس كتابة محلية لمانج.
- **يُسمح بكاش قراءة** لسرعة فتح الشاشات: نسخة من استجابة السيرفر، تُحدَّث منه، ولا تُعتبر حقيقة أبدًا. أي حفظ يذهب للسيرفر أولًا، ولا تظهر نجاحًا إلا بعد إقراره (R-23).
- **السيرفر هو المصدر الوحيد** لكل رقم مالي.

### 3.3 ما يجب أن يبقى من القاعدة المحلية (ليس ملك مانج)

| المخزن | المستخدم | القرار |
|---|---|---|
| `ask-history` (`indexedDbStores.ts:112`) | «اسأل Micro» (`application/ask/askHistoryService.ts:17`) | **يبقى** — حذف القاعدة كاملة يمسح سجل محادثات مكوّن آخر |
| `activity-profile`, `owner-profile`, `local-preferences`, `form-drafts`, `local-security`, `command-receipts` | التطبيق | تبقى كما هي (خارج نطاق مانج) |

**الاستنتاج:** الحل ليس حذف قاعدة المتصفح، بل **إسقاط مخازن مانج المالية** من المخطط (رفع إصدار مع `deleteObjectStore`، أو قاعدة مانج v2 منفصلة). لا يوجد اليوم أي `deleteObjectStore`، فالخيار يحتاج كتابة صريحة في موجة التخزين. **القرار (المالك):** رفع الإصدار مع `deleteObjectStore` لمخازن مانج فقط، وإبقاء `ask-history` ومخازن التطبيق (مهمة M6.3).

---

## 4. المنطقة ٤ — من القرش (1/100) إلى الفلس (1/1000)

### 4.1 نقاط التعريف

| النقطة | الملف/الدالة | الواقع | الخطر |
|---|---|---|---|
| نوع المال | `src/domain/shared/currency.ts:2` `MoneyMinor` | 1/100 | جذري |
| النص المحفوظ | `src/domain/shared/currency.ts` `persistedMoneyTextMinor` | منزلتان + «د.أ» | متوسط |
| العرض | `application/formatting/formatters.ts:23` `moneyFormatter` (2 منازل)، `:98` `formatMoneyMinor` (`minor/100`)، `:105` `formatMoneyWithUnit` | 2 منازل | **عالي: عرض ١٠×** |
| الإدخال | `application/input/englishNumeric.ts:24` `moneyPartial` (منزلتان)، `:33` `parseEnglishNumericText` (`major*100`) | 2 منازل | **عالي: إدخال ١٠×** |
| حارس المال | `scripts/check-money-minor-casts.mjs` (راتشة 0 داخليًا/13 خارجيًا)، `client/src/moneyLayerGuard.contract.test.ts` | يحمي الاسم لا الوحدة | يُحدَّث |
| تحويلات مضمّنة | 32 ملف إنتاجي فيه `/100`، 6 فيها `*100` | تتبع ملفاتها المحذوفة أو تُحوَّل | عالي |

### 4.2 القرار المطبَّق (المالك) وتصميمه

1. **وحدة فلس جديدة خاصة بمانج**: `MoneyFils` + `formatFils` + `parseFilsText` + ثوابت `FILS_PER_JOD = 1000`، في موديول مانج المالي الجديد. لا إعادة استخدام اسم `MoneyMinor` بدلالة جديدة (كي يفشل البناء في كل مستهلك غير محوَّل).
2. **الدوال المشتركة لا تتغير**: `formatMoneyMinor`, `formatMoneyWithUnit`, `persistedMoneyTextMinor`, `parseEnglishNumericText("money")`, `EnglishNumberInput` — تبقى بدلالة 1/100 لأن **التوصيل** و**أدواتي** و**السوق** تعتمد عليها.
3. **المستهلكون الخارجيون المثبتون للدوال المشتركة:**
   - `pages/DeliveryReview.tsx:442,497,555,558` — شاشة تسليم طلب داخل مانج تُحذف، فلا تبقى.
   - `pages/CostCalculator.tsx` (أدواتي) — تبقى كما هي بلا تغيير.
   - `worker/domain/delivery.ts` (`parseMinorAmount`: «minor ×100») — **لا يُمسّ**.
   - `application/market/marketEstimate.ts:26-31` (`1e-6` BigInt، `formatMicroJodAsJod`) — **لا يُمسّ**.
4. **حدود الوحدة:** كل رقم في جداول مانج الجديدة بالفلس؛ ولا رقم مالي يُقبل من الشبكة بلا تحقق نطاق `BIGINT` صحيح. لا تحويل تلقائي بين وحدات المكونات.

**تحذير مسجَّل:** أي محاولة «توحيد» الوحدات بين مانج والتوصيل تُنتج خطأ ١٠× صامت. الفصل بالاسم هو الحماية.

---

## 5. المنطقة ٥ — التواريخ والوقت

| العنصر | الدليل | الحالة |
|---|---|---|
| توقيت عمّان | `src/domain/shared/businessTime.ts` (`Asia/Amman`, `localDateInAmman`) | يبقى |
| الساعة | `application/time/clock.ts` (`Clock`, `systemClock`) + حارس `scripts/check-application-ambient-time.mjs` | يبقى؛ التواريخ تُمرَّر للدومين |
| فهرس الأسبوع | `src/domain/shared/numeric.ts` (0 = الأحد) | يبقى؛ **يُضاف** `startOfWeekSunday` |
| جمع الأيام | `localDatePlusDays`, `isValidLocalDate` في `shared/*` | يبقى |
| التاريخ المحلي في القاعدة | الجداول الجديدة `DATE` لا `TIMESTAMP` للحركات | جديد |
| عرض التاريخ | `dd/mm/yyyy` في §9 | يُنفَّذ في منسّق مانج |

لا تعارض: البنية الزمنية جاهزة؛ الناقص مساعد بداية الأسبوع وتجميع التقارير عليه.

---

## 6. المنطقة ٦ — الواجهة والتنقل

| العنصر | الدليل | الأثر |
|---|---|---|
| المسارات | `app/MicroRouter.tsx` (82 مسارًا) | يُقلَّص إلى ثلاث شاشات + P-01 + النماذج؛ تُحذف مسارات `/schedule*`, `/cash*`, `/inventory*`, `/suppliers*`, `/parties`, `/catalog`, `/assets*`, `/loans*`, `/finance/recurring*`, `/finance/owner-entitlement`, `/finance/g5/*`, `/direct-sales*`, `/orders/:id/deliver` (DeliveryReview), `/foundation` |
| الصفحات | `pages/*.tsx` (73) | يبقى منها: `Home`→«مشروعي الآن»، `Orders`/`OrderDetail`→«الطلبات»، `Finance`→«المالية»، `Setup`→P-01، `Settings`/`Profile`، وأدواتي `Tools`+`CostCalculator`+`HourValue`+`SalesQuantity`+`InvoiceShare`+`IdeaReview`+`EstimateDetail`، والتوصيل والسوق كما هي |
| الشريط السفلي | `components/layout/BottomNav.tsx` + `app/navigation.ts::primaryNavigation` | تطبيقي: يبقى 5 تبويبات؛ **«الرئيسية» → «مشروعي الآن»** (التعديل الوحيد المسموح على الشريط) |
| التسميات | `app/navigation.ts::getNavigationLabel` | تُقلَّم |
| النصوص العربية | لا كتالوج؛ **155 ملف TSX** فيه نص عربي حرفي (قياس على `grep -P` لنطاق U+0600–U+06FF، بلا اختبارات)، وحارس `scripts/check-label-vocabulary.mjs` | يُبنى كتالوج مفاتيح §10/§11 لأسطح مانج فقط |
| مكوّنات قابلة لإعادة الاستخدام | `components/primitives/{Button,Field,ChoiceRow,EmptyState,StatusChip,Notice}`, `components/forms/{EnglishNumberInput,LocalDateField,useFormDirty,UnsavedChangesGuard,useFormDraft}`, `components/presentation/{DisplayValue,MoneyValue}` | تبقى؛ يُضاف `FilsInput`/`FilsValue` لمانج |
| التقويم | لا مكوّن مستقل؛ الشبكة داخل `pages/Schedule.tsx` و`pages/Orders.tsx` | يُستخرج مكوّن «متتبّع الطلبات» (أسبوع الأحد–السبت) |
| القدرات | `application/preferences/preferenceService.ts` (`CAPABILITY_IDS`), `app/CapabilityRouteGate.tsx` | تُقلَّص إلى ما يخص مانج v2، وإلا بقيت بوابات لمسارات محذوفة |
| الأزرار السريعة | لا وجود لها اليوم | تُبنى (C-07) |

---

## 7. المنطقة ٧ — ميزات مرتبطة بشكل غير مباشر

| الميزة | الملف/الدالة | الأثر |
|---|---|---|
| الإعدادات — القدرات | `SettingsCapabilitiesSection.tsx`, `CAPABILITY_IDS` | تُقلَّص مع المسارات |
| الإعدادات — البيانات/الاستعادة | `SettingsDataProtectionSection.tsx`, `SettingsProjectDataSection.tsx`, `application/transfers/*` | يُعاد بناؤها: مظروف v2 يرفض القديم صراحةً |
| الإعدادات — فحص البيانات | `SettingsDataCheckSection.tsx`, `application/finance/integrityCheck*.ts` | يُستبدل بفحص دفتر v2 (INV-1…INV-4) |
| وضع التشغيل | `SettingsOperatingModeSection.tsx` + `workspace.manage_online_only` | يبقى؛ كل كتابة مانج تمر به |
| التأسيس | `pages/Setup.tsx`, `pages/Foundation.tsx` | `Setup` يبقى ويُطابق P-01؛ `Foundation` يُحذف (لا إدخال إجباري غير P-01) |
| «مشروعي الآن» | `pages/Home.tsx`, `application/home/*` | يُعاد بناؤه على §8 (يقرأ اليوم `ProjectFinancialService`) |
| الملف الشخصي | `pages/Profile.tsx`, `application/profile/*` | يبقى (تطبيقي) |
| تصدير/حذف المشروع | `worker/api/projectLifecycle.ts:88,261` | **تطبيقي**: يقرأ كل العائلات ويحذفها؛ يجب أن يبقى صالحًا مع الجداول الجديدة (§14.6) |
| «اسأل Micro» | `components/ask/*`, `application/ask/*` | **لا يُعاد تصميمه**: يُزال مسار المسودة المالية فقط بموافقة (انظر ٨-S2) |

---

## 8. المنطقة ٨ — الاختبارات وأدوات كشف الكود الميت

| العنصر | الدليل | العدد |
|---|---|---|
| ملفات الاختبار | `find` على `*.test.ts(x)`/`*.test.mjs` بلا `node_modules` | **558** |
| أسطر الاختبار | نفس المجموعة | **154,484** |
| تلمس مجالًا محذوفًا | `grep` على أسماء المجالات المالية | **275** |
| بوابة `pnpm check` | `package.json` | operations-control + typecheck + lint (37 تحذيرًا) + format + text-density + design-guards + **26 حارسًا** + test + prototype check/test/build |
| حراس ستحتاج تعديلًا | `check-registry-coverage`, `check-module-boundaries`, `check-file-size-ratchet`, `check-money-minor-casts`, `check-doc-index-coverage`, `check-label-vocabulary` | — |
| كشف الكود الميت | `package.json` | **غير موجود** اليوم (لا knip/ts-prune/depcheck) — **قرار المالك: يُضاف knip من الآن** على مسارات مانج وأدواتي |
| CI | `.github/workflows/ci.yml` | مهمة واحدة، PostgreSQL 17.5 كخدمة، `pnpm check` |

**القرار المطبَّق (المالك):** اختبارات الكود المحذوف **تُمسح معه**، والاختبارات الجديدة تُكتب من المواصفات (S1–S9، T1–T60). يُضاف حارس «لا استيراد من مسار محذوف» + جرد حذف (`DELETION-MANIFEST.md`) + **`knip` من الآن** (قرار المالك ٨) كي لا يعود الكود الميت بصمت.

---

## 9. المنطقة ٩ — الوثائق التي ستصير غلطًا

| الوثيقة | الدليل | الأثر |
|---|---|---|
| تعريف المنتج | `docs/product-source-of-truth.md:20` (القرش 1/100، offline-first) | يُحدَّث: فلس، أونلاين فقط، أربع عمليات، ثلاث شاشات |
| عقد تمثيل المال | `docs/contracts/25-network-money-representation-contract.md:21` | **يصبح غير صحيح** لتطابق `MoneyMinor` بين مانج والشبكة؛ يُحدَّث بحدود واضحة (مانج بالفلس، التوصيل/السوق كما هما) |
| سجل الملكية | `docs/architecture/refactoring/OWNERSHIP-AND-TRUTH-REGISTRY.md` | يُحدَّث إلزاميًا وإلا فشل `check-registry-coverage` |
| فهرس الوثائق | `docs/00-document-index.md` + `check-doc-index-coverage` | تُضاف وثائق `docs/manage-v2/*` |
| المخطط المعماري | `docs/01-product-and-technical-blueprint.md` | يُعاد كتابته لمانج v2 |
| سجل القرارات | `docs/02-decision-log.md`, `docs/decisions/*` | تُؤرشف قرارات 19 نوع حدث/حق المالك/المخزون |
| «قرش/1/100» | **41 ملف md** | جرد وتحديث/أرشفة |
| التتبع | `docs/implementation-traceability.md`, `docs/implementation/**` | يُؤرشف |

---

## 10. المنطقة ١٠ — الأشياء على مستوى التطبيق

| العنصر | الموجود في الكود | الحالة |
|---|---|---|
| تسجيل الدخول (Google) | `worker/auth/*`, `worker/auth/session.ts`, `client/src/application/network/sessionService.ts`, `app/useNetworkSession.ts` | **يُعاد استخدامه** |
| الحساب/الهوية | `network_identity`, `network_membership`, `workspace`, `workspace_member` (`0001_init.sql:26-77`), `application/identity/*` | **يُعاد استخدامه** |
| ربط مانج بالحساب | `manage_owner_link` (`0003`), `api/manage/link`, `startManageLink`/`confirmManageLink` (`manageOnlineService.ts:89,100`) | **يُعاد استخدامه** |
| أونلاين فقط | `workspace.manage_online_only` (`0006`), `manageMode` (`manageReads.ts:155`), `app/manageOnlineGuard.ts` | يبقى؛ يصبح كل حفظ عبر السيرفر |
| قاعدة Cloudflare | `worker/db/db.ts` + `worker/db/pg.ts` (Hyperdrive/PostgreSQL) | **موجود** — التفاصيل في ١١ |
| الشريط السفلي | `components/layout/BottomNav.tsx`, `app/navigation.ts` | تطبيقي |
| تصدير/حذف المشروع | `worker/api/projectLifecycle.ts` (`api/account/projects/:id/{export,delete}`) | تطبيقي — يحتاج تكييفًا لا إعادة بناء |
| الصور/الوسائط | `worker/media.ts`, `media_object` | خارج النطاق |

**الناقص:** لا شيء جوهري على مستوى التطبيق. **غير متأكد:** لا يوجد ملف `wrangler.*` في المستودع، فربط Hyperdrive/النشر يُعرَّف خارج المستودع — يحتاج تأكيدًا منك قبل أي نشر.

---

## 11. المنطقة ١١ — قاعدة Cloudflare: D1 أم Postgres؟

### 11.1 الدليل من الكود

- `worker/db/db.ts` (رأس الملف): «The active engine is PostgreSQL via Hyperdrive (EX-D20); the earlier D1 engine and its migrations remain under `db/migrations/` as labelled superseded history.»
- `worker/db/pg.ts`: محوّل PostgreSQL فوق Hyperdrive، `batch` = `BEGIN…COMMIT` (معاملة واحدة)، وترجمة `?` إلى `$n`.
- `worker/env.ts`: الربط `DB` هو `PgDatabaseBinding` (يحمل `connectionString`) أو `Db` في الاختبارات.
- الهجرات الفعّالة: `worker/db/migrations-pg/` (17)؛ هجرات D1: `worker/db/migrations/` (6، متجاوَزة).

### 11.2 مطابقة المتطلبات

| المتطلب | Postgres/Hyperdrive اليوم | D1 |
|---|---|---|
| معاملة واحدة لكل عملية (R-12) | ✅ `db.batch` = BEGIN…COMMIT | ⚠️ `batch` ذرّي لكن بلا معاملات تفاعلية |
| منع تعديل القيود | ✅ ممكن بـ`REVOKE UPDATE/DELETE` أو trigger يرفض | ⚠️ ممكن بـtrigger، لكن بلا أدوار/صلاحيات دقيقة |
| معرّف طلب فريد (R-25) | ✅ جدول `idempotency` + فهرس فريد | ⚠️ ممكن، بقيود |
| قيود FK وCHECK | ✅ كاملة | ✅ جزئية |
| `BIGINT` للفلس | ✅ `BIGINT` أصلي | ✅ |
| التوافق مع الموجود | ✅ هو المحرك الحالي | ❌ هجرة عكسية بلا داعٍ |

**القرار (المالك):** **PostgreSQL عبر Hyperdrive**. السبب: هو المحرك الفعلي اليوم، و`batch` يمنح المعاملة الواحدة المطلوبة، ويمكن فرض append-only على مستوى القاعدة (trigger/صلاحيات) لا على مستوى الكود فقط.

**غير متأكد:** إعداد Hyperdrive الإنتاجي (حجم الاتصالات، حدود المجمع) غير مرئي في المستودع. لا يغيّر التوصية لكنه يحتاج تأكيدًا قبل النشر.

---

## 12. المنطقة ١٢ — توزيع المجلدات الحقيقي (§14) — مُصحَّح بقرار المالك

**التصحيح الملزم (قرار المالك):** تنفيذ العمليات (التحميل، الدومين، المعاملة الواحدة، منع التكرار) وحساب كل أرقام §8/§8.2 **على السيرفر**، لأن R-23 تجعل السيرفر المصدر الوحيد. الواجهة عميل API رفيع + عرض + كاش قراءة، **ولا تحسب أي رقم مالي**.

الهيكل الحالي: `src/domain/*` (نواة نقية) + `apps/prototype-web/client/src/{application,pages,components,storage}` + `apps/prototype-web/worker/{api,domain,db}`.

| طبقة §14.1 | المكان | المحتوى | ممنوع |
|---|---|---|---|
| Domain | `src/domain/manage/ledger/` | Q1–Q20، قاعدة التوازن، `MoneyFils`، ثوابت R-1…R-27 | أي I/O أو ساعة أو شبكة |
| Domain | `src/domain/manage/operations/` | عقود العمليات (§5) كدوال نقية تُرجع قيودًا | أي وصول لقاعدة |
| Domain | `src/domain/manage/figures/` | معادلات §8 و§8.2 فقط | أي حساب في العميل |
| Application (سيرفر) | `worker/application/manage/` | معالج لكل عملية: تحميل الحالة، نداء الدومين، **معاملة واحدة**، حجز idempotency ذرّي، نتيجة/رمز خطأ | أي حساب مالي خاص به |
| Application (سيرفر) | `worker/application/manage/figures/` | موديول القراءة الواحد: يُرجع أرقام §8 جاهزة للعميل | أي صياغة عرض |
| Infrastructure (سيرفر) | `worker/api/manage/` + `worker/db/migrations-pg/` | مسارات HTTP، مستودعات، هجرات، فرض append-only | أي منطق مالي |
| UI (عميل) | `client/src/pages/manage/{now,orders,finance}/` + `client/src/components/manage/` | P-01…P-80 تعرض ما يرجعه السيرفر | **أي حساب أو تحويل وحدة** |
| Client API | `client/src/application/manage/api/` | عميل رفيع: طلب/استجابة، رموز أخطاء، لا رياضيات | أي منطق أعمال |
| Cache | `client/src/storage/manage-cache/` | كاش قراءة فقط يُحدَّث من السيرفر | أن يكون مصدر حقيقة |
| Strings | `client/src/application/manage/strings/` | كتالوج مفاتيح §10/§11 | نص حرفي خارج الكتالوج |

**قاعدة الحدود:** لا يستورد `src/domain/manage` أو `worker/application/manage` أي شيء من `craft-order`/`financial-event`/`cash-continuity`/…، ولا يستورد التوصيل/السوق/أدواتي منه. `check-module-boundaries` يُحدَّث ليفرض الاتجاه: `worker/api/manage → worker/application/manage → src/domain/manage`، والعميل لا يستورد الدومين إطلاقًا.

**أثر التصحيح:** لا يوجد `client/src/application/manage` كطبقة تنفيذ. العميل لا يحمل معادلة واحدة من §8؛ أي رقم معروض جاء جاهزًا من السيرفر (وهذا يجعل فحص R-3 في المراجعة أقوى: بحث آلي عن أي رياضيات مالية في مجلدات العميل).

## 13. «لازم يصير قبل الحذف» — حالات الفصل التي تحتاج موافقتك

كل بند هنا **لا يُنفَّذ قبل موافقتك الصريحة** (قرار المالك رقم ٢)، والفصل فقط بلا إعادة تصميم:

| # | المكوّن | الملف/الدالة | ما سيُنفَّذ | ما لن يُنفَّذ |
|---|---|---|---|---|
| S1 | أدواتي | `src/domain/planning/policies.ts:18` | نقل `calculateCostSnapshot` (وما يستدعيه) إلى موديول محايد داخل أدواتي/`src/domain/costing/`، وتحويل الاستيراد | لا تغيير في معادلات أدواتي ولا شاشاتها |
| S2 | أدواتي | `application/agreements/orderDetailViewModel.ts:71-72` | قطع قراءة `sourceEstimateId` من نموذج الطلب | لا حذف لأداة ولا لتقدير محفوظ |
| S3 | «اسأل Micro» | `components/ask/AskDraftCard.tsx:150` | إزالة مسار «تسجيل حركة مالية» من المسودة (زر/مسار الكتابة إلى `financialEvents`) | لا تغيير في المحادثة ولا في `application/ask` الأخرى |
| S4 | «اسأل Micro» | `application/ask/askHistoryService.ts:17` | لا شيء — يبقى مخزن `ask-history` | لا يُمسّ |
| S5 | تطبيقي | `worker/api/projectLifecycle.ts:88,261` | تكييف التصدير/الحذف ليقرأ الجداول الجديدة ويحذفها | لا تغيير في عقد الـAPI ولا في سلوك الحذف |
| S6 | تطبيقي | `application/transfers/*` | استبدال المظروف القديم بمظروف v2 يرفض القديم صراحةً | لا ترحيل بيانات |
| S7 | التوصيل/السوق | — | **لا شيء** (لا اعتماد على مانج) | ممنوع أي تعديل |

**التوصيل والسوق:** لا يتأثران بالحذف. الشيء الوحيد الذي يخص التوصيل داخل مانج هو شاشة `pages/DeliveryReview.tsx` (مسار `/orders/:id/deliver`) وهي شاشة تسليم طلب مانج لا مكوّن التوصيل، وتُحذف مع مانج.

---

## 14. التعارضات بين الملفات والكود

| # | القاعدة | الواقع | التعارض | المعالجة |
|---|---|---|---|---|
| ١ | فلس 1/1000 | `MoneyMinor` 1/100 + منسّقان + 32 ملفًا | جذري | وحدة فلس جديدة، والمشتركة لا تتغير |
| ٢ | القيود لا تُعدَّل | `manageWrites.ts:110` UPDATE CAS | مباشر | جداول دفتر بلا UPDATE/DELETE + trigger |
| ٣ | لا رصيد مخزَّن | حقول مجمّعة اليوم (`order.collectedMinor`, `purchase.paidMinor`, `owner-entitlement-opening-balances`) | مباشر | كل الأرصدة من الترحيلات |
| ٤ | معاملة واحدة لكل عملية | `batch` موجود لكن ليس مفروضًا على كل مسار | جزئي | معالج واحد لكل عملية يستخدم `batch` |
| ٥ | كل قيد متوازن | لا قيد مزدوج اليوم؛ `DELTA_TABLE` | جذري | `assertBalanced` قبل كل كتابة + اختبار خاصية |
| ٦ | أسبوع الأحد–السبت | فهرس 0=الأحد موجود، لا مساعد بداية أسبوع | جزئي | يُضاف |
| ٧ | لقطة بنود ثابتة | `costSnapshot` موجود في `craft-order/types.ts` | متوافق | يُعاد استخدام المبدأ في `sale_line` |
| ٨ | لا كيانات زبائن | `party/*` + `counterparties` | مباشر | الاسم نص |
| ٩ | التكلفة المتوقعة لا تدخل الربح | تُخصم اليوم في `projectFinancialPeriodReads.ts` | مباشر | الربح من القيود فقط |
| ١٠ | نصوص من كتالوج | 155 ملفًا فيه نص عربي حرفي | جذري | كتالوج لأسطح مانج + حارس للنص الحرفي في الملفات الجديدة |
| ١١ | أدواتي منفصلة | `planning → craft-order` | مباشر | S1/S2 |
| ١٢ | أربع عمليات | 19 نوع حدث + بيع مباشر + عربون | جذري | Q1–Q20 |
| ١٣ | صندوقان كحد أقصى | `cash-wallets` متعدد | مباشر | قيد `UNIQUE(project_id, kind)` |
| ١٤ | لا مخزون | مخزنان + حركات | مباشر | حذف كامل |
| ١٥ | عودة بعد 14 يومًا | لا كشف انقطاع | ناقص | يُبنى من آخر قيد |
| ١٦ | «تعديل/إلغاء حركة» مقابل قيود ثابتة | الكود الحالي يعكس ولا يعدّل (`projectFinancialEventWrites.ts:216,321`) | **ليس تعارضًا** | التعديل/الإلغاء = Q20 + قيد جديد |
| ١٧ | «كل شراء مصروف» | اليوم تُخصم تكلفة البضاعة من اللقطة | **مقصود ومحسوم** | الربح = إيراد − مصاريف بلا COGS؛ القديم يُمسح كله |
| ١٨ | السجل المالي داخل الطلب | لا يوجد سجل موحّد اليوم | ناقص | P-21 يعرض عمليات الطلب |

**غير متأكد:** تعارض محتمل بين «الطلب يُعدَّل بعد التسليم في حقول غير مالية» (§3.4) و«P-60 بعد التسليم يمنع البنود» — المواصفات تحسمها: الحقول غير المالية تُعدَّل مباشرة بلا عملية، والبنود مقفولة. لا يحتاج قرارًا.

---

## 15. القرارات — محسومة من المالك (25/11/2026)

| # | القرار | القرار النهائي | الأثر على الخطة |
|---|---|---|---|
| ١ | محرك القاعدة | **PostgreSQL عبر Hyperdrive** | الهجرات في `worker/db/migrations-pg/`؛ `batch` معاملة واحدة |
| ٢ | قاعدة المتصفح | **رفع الإصدار مع `deleteObjectStore` لمخازن مانج**، وإبقاء `ask-history` ومخازن التطبيق | مهمة M6.3 |
| ٣ | `manage_record` | **مسح كل العائلات**، ثم **حذف الجدول نفسه بهجرة جديدة** بعد ألا يقرأه كود | M6.5 |
| ٤ | شكل القيد | **`ledger_entry` + `ledger_posting`** (محسوم بالمواصفات) | M2.1/M2.2 |
| ٥ | منتجاتي | **من الصفر** | M3.1 |
| ٦ | ربط التقدير بالطلب | **يُنقطع** | M1.2 |
| ٧ | كتالوج النصوص | **أسطح مانج + حارس للنص الحرفي في الملفات الجديدة** | M1.8 |
| ٨ | الكود الميت | **الحارس + `DELETION-MANIFEST.md` + أداة knip من الآن** (على الأقل لمسارات مانج وأدواتي) | M1.9 + M1.11 |
| ٩ | الفصل | **موافقة على S1، S2، S3، S5، S6**؛ S4 بلا إجراء | المرحلة 1 |
| ١٠ | تكلفة البضاعة | **لا COGS**: الربح = الإيراد − المصاريف، والقديم يُمسح كله | §8 كما هي |
| ١١ | اسم التبويب | **«الرئيسية» → «مشروعي الآن»**، وهذا التعديل الوحيد المسموح على الشريط السفلي | M5.2 |
| ١٢ | الأمن | **SRV-03 يُحل داخل الشغل**: حجز معرّف التكرار **بنفس معاملة** العملية؛ **MNG-LOCAL-01** يُحل بحذف الكتابة المحلية ويُتحقق منه في المراجعة؛ **SRV-07** يُراعى في إعادة بناء الاستيراد/التصدير | M2.4 + M7.4 |
| ١٣ | النشر | `wrangler`/Hyperdrive **غير مطلوبين الآن**، يُؤكَّدان قبل النشر | — |

## 16. ملاحظة أمنية (سجل التدقيق المفتوح)

تُعاد فحص البنود ذات الصلة في كل موجة: `MNG-LOCAL-01` (كتابات مالية محلية تتجاوز حاجز online-only)، `SRV-03` (idempotency غير ذرّي)، `SRV-07` (استيرادان متزامنان). هذا التقرير **لا يغلق** أي بند منها، ولا يُعدّ دليل إصلاح.
