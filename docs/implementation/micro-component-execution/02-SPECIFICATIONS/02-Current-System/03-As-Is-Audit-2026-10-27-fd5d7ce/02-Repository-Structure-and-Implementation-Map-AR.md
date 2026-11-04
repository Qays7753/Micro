# Micro — التقرير 2: خريطة بنية المستودع ومواضع التعديل كما هي في الكود

> **تقرير تدقيق «كما هي» (as-is) للقراءة فقط.** يوثق البنية القائمة فعليًا ومواضع التعديل الصحيحة مستقبلًا، ولا يقترح قالب مجلدات مفضلًا ولا يفوض أي إعادة هيكلة. لم يُجرَ أي تعديل على Micro. التقرير المرافق: [`01-Component-Data-and-Financial-Map-AR.md`](01-Component-Data-and-Financial-Map-AR.md) (البيانات والمال — مرجع معاجم الحقول والعائلات DF).

## البطاقة المرجعية

| البند | القيمة |
|---|---|
| المصدر | `https://github.com/Qays7753/Micro.git` — استنساخ مجهول للقراءة فقط |
| الفرع / الالتزام | `main` @ [`fd5d7ce689d32d8dcc462bcea2ff1c006256f064`](https://github.com/Qays7753/Micro/tree/fd5d7ce689d32d8dcc462bcea2ff1c006256f064) (المختصر `fd5d7ce`، بتاريخ 2026-10-18) |
| تاريخ التدقيق | 2026-10-27 (آسيا/عمّان) |
| جولة التصحيح V2 | 2026-10-27 نفس اليوم — تصحيحات موجهة (RPT-02/04/05) دون إعادة تدقيق؛ رأس `origin/main` أعيد التحقق منه = `fd5d7ce` بلا انحراف (E-074) |
| جولة التصحيح V3 | 2026-10-27 نفس اليوم — تحقق وتصحيح موجه (COR-01..03) فوق V2 دون إعادة تدقيق؛ أعيد التحقق من `origin/main` = `fd5d7ce` بلا انحراف والشجرة نظيفة (E-079) |
| الملفات المتعقبة | 1780 (منها 810 داخل `apps/` و665 داخل `docs/`) |
| التنفيذ | القائد + 4 وكلاء حقيقيين (A1/A2/A3/A4) + فحوص معزولة منفذة بالكامل (كل مراحل `pnpm check` نجحت — التقرير 1 §2.4) |
| اصطلاح الحقيقة | نفس شعارات التقرير 1: (مصدر)/(تشغيل)/(استنتاج)/(فرضية)/(غير محقق)؛ معرفات الأدلة E-0xx..E-4xx |

---

## جولة التصحيح V2 — ملخص التغييرات ومصفوفة الإغلاق (2026-10-27)

> صُحح هذا التقرير ضمن جولة تصحيح موجهة (RPT-01..05) دون إعادة تدقيق ودون أي لمس لمستودع Micro؛ خط الأساس كما هو (رأس `origin/main` = `fd5d7ce` بلا انحراف — E-074). التغييران الدلاليان الكبيران (RPT-01 معاجم البيانات وRPT-03 المشتق المخزون) حُققا في التقرير 1 (قسم «جولة التصحيح V2» والملحق أ هناك)؛ هذا التقرير صُحح في ثلاثة مواضع:

- **RPT-02**: صُحح البند (6) في §9 — التفضيلات (`local-preferences`) **داخل** لقطة التصدير/الاستعادة؛ المستثنيان عمدًا هما مسودات النماذج العابرة (`form-drafts`) والقفل (`local-security`) فقط — **(مصدر، E-070)**. عبارة V1 كانت تُدرج التفضيلات مع القفل خارج اللقطة خطأً.
- **RPT-04**: صُحح صف UNIT-043 في §5 — مقابله البنيوي هو لوحتا إعلان «قريبًا» في `components/layout/AppHeader.tsx` (النقل والتوصيل، اسأل Micro) لا `FinanceUpcoming.tsx`؛ فالأخير قراءة متابعة مالية يُشارك في ملكه UNIT-021 (+UNIT-018) — **(مصدر، E-072/E-073)**.
- **RPT-05**: صُحح جرد الأدلة في §12 — 290 معرفًا فريدًا معرّفًا فعليًا لنسخة V1 (لا 275؛ الرقم القديم جمع النطاقات المعلنة وأدرج الـ17 في القوس نفسه) + 10 معرفات V2 — **(مصدر، E-075)**.

| البند | الحالة | الموضع المصحح |
|---|---|---|
| RPT-01 معاجم البيانات | مغلق في التقرير 1 | الملحق أ هناك (لا تغيير بنيوي هنا) |
| RPT-02 تغطية النسخ | **مغلق** | §9 البند (6) |
| RPT-03 المشتق المخزون | مغلق في التقرير 1 | §1/§7-ح/الملحق أ هناك |
| RPT-04 UNIT-043 | **مغلق** | §5 (الصفان UNIT-021/UNIT-043) |
| RPT-05 جرد الأدلة | **مغلق** | §12 (الجرد المصحح) |


## جولة التصحيح V3 — ملخص التغييرات ومصفوفة الإغلاق COR-01..03 (2026-10-27)

> جولة تحقق وتصحيح موجهة فوق V2 بثلاث ملاحظات مراجعة (COR-01..03)؛ لا إعادة تدقيق ولا أي لمس لمستودع Micro. أعيد التحقق من الرأس البعيد: `origin/main` = `fd5d7ce` بلا انحراف (E-079). التغييران الدلاليان (COR-01 شرح ربح البيع المباشر، وCOR-02 المعاجم المتداخلة) حُققا في التقرير 1 — فلا نصًا في هذا التقرير يصف المعادلة المالية أو بنى السجلات؛ ما مسّ هذا التقرير هو جرد الأدلة واتساقه مع التقرير 1:

- **COR-03**: حُدّث جرد §12 — المعرفات التسعة التي بقيت بعد V2 بلا تعريف (E-111..E-117 وE-172 وE-174) عرّفها القائد بتحقق مباشر V3 في التقرير 1 §9.2 (ترحيلات `indexedDbMigrations.ts` وحارسا `supplierScheduleCommitGuard.ts` و`cashContinuityCommitGuard.ts`)، فيصبح الإجمالي المعرّف عبر النسخ الثلاث **312** (لا 300) — **(مصدر، E-079)**. لا يستشهد نص هذا التقرير بأي من المعرفات التسعة، فلا يتغير هنا غير الجرد والعدّ.
- **COR-01/COR-02**: تصحيح «وصف الربح عند تحصيل الدين» في التقرير 1 كان خطأ صياغة تقرير لا عيب تنفيذ في Micro — ولا موضع لهذا التقرير البنيوي؛ حُدّثت البطاقة المرجعية أعلاه فقط.

| البند | الحالة | الموضع هنا |
|---|---|---|
| COR-01 ربح البيع المباشر | مغلق في التقرير 1 (خطأ صياغة تقرير لا عيب تنفيذ) | لا موضع هنا |
| COR-02 المعاجم المتداخلة | مغلق في التقرير 1 (أ.3.1/أ.3.3/أ.5.1 وغيرها هناك) | لا موضع هنا |
| COR-03 الاستشهادات غير المعرفة | **مغلق** | §12 (الجرد المصحح) |


## 1. الملخص التنفيذي

**الحكم البنيوي**: Micro **مستودع واحد (modular monolith) محكوم بنظام سقوف (ratchet) غير معتاد الصرامة**. المسار الموثق (React → خدمة تطبيق → مجال → منفذ `PrototypeLocalStore` → IndexedDB) **مفروض ميكانيكيًا** بنحو 30 آلية فرض (13 كتلة ESLint + ~26 سكربت حرس + بوابات بناء + حراس مدموجة في الاختبارات)، وكل حارس يحمل اختبار ذاتيًا خاصًا (38 ملف `scripts/*.test.mjs` — حتى ملف `eslint.config.js` نفسه مُختبَر). الأساسات (baselines) **تفشل مغلقًا في الاتجاهين**: النمو غير المصرح به والانكماش الصامت معًا — **(مصدر، E-303..E-335؛ تشغيل، E-051)**.

**نقطة دقيقة موثقة داخل المستودع نفسه**: اتجاه الاستيراد الساكن معاكس لسهم المسؤولية — محولات التخزين تستورد **أنواع** المجال (75 حافة عبر البراميل، صفر عكسي)؛ المجال لا يعرف التخزين أصلًا ونقاءه مثبت (استيرادات نسبية فقط، صفر حزم/متصفح) — **(مصدر، E-381/E-344)**.

**الاستثناءات المجمدة كلها معلنة ومسعورة، لا شيء صامت**: 17 حافة قيمة UI→مجال، 52 استيرادًا داخليًا UI→application (36 جذر تركيب + 13 رحلة كسولة + 3 شوائم عرض)، 19 حافة نوعية UI→تخزين، حافتا تشغيل وحيدتان للتخزين (StartupGate وPrototypeServicesContext)، دورة نوع واحدة في التخزين، **دورتان قيميتان حيّتان بين البيوت** (`finance↔financial-analysis` و`preferences↔time`) + SCC نوعي خماسي البيوت — كلها في أسس مرقومة يفشل الحارس عند نموها **وعند حلها الصامت أيضًا** (تصميم مضاد للصمت) — **(مصدر، E-312..E-318/E-444/E-445)**.

**بقايا إعادة الهيكلة**: شبه نظيفة. شوائم العرض الثلاث (`export *`) مجمّدة بشرط إزالة موثق؛ وحدات R7-5 المحذوفة غابت فعلًا عن الشجرة (تحقق git) وصفوف سجلها تبقى تاريخية؛ ترحيل مسودات ARCH-012 تقاعد بجثة محذوفة متحققة؛ الديون المعروفة مسجلة بنطاقات (OrderDetail ‏1869 وFinance ‏1500 في SPLIT_NOW؛ OwnerEntitlement ‏1161 SPLIT_CANDIDATE؛ transferFamilyValidators ‏1745 محفوظ بقرار ADR-017) — **(مصدر، E-346..E-353/E-446)**.

**التكرار المصنف**: تكرار معرفي واحد محكوم (مدققات النقل تكرر اتحادات الحالة من المجال — مسجل DUPLICATE بحارس انجراف وحل جذري مسمى 4D مؤجل ببوابة مالك)؛ مهايئان متكافئان مشروعان بالبرهان (conformance)؛ مرايا مال في الواجهة مجمّدة بعدّاد لكل ملف (13 في OrderDetail)؛ توحيد مصدر حقيقي لـ resultCodes والتنسيق والتسميات — **(مصدر، E-348..E-354)**.

**الاختبارات**: 447 ملف اختبار (مجال 41 + حراس ذاتيون 38 + تطبيق 368) — نُفذت كاملة هنا: مجموعة الجذر 79 ملفًا/952 اختبارًا، والتطبيق 368 ملفًا/2737 اختبارًا، كلها خضراء — **(تشغيل، E-052/E-054)**. CI يتشغل بخطوة تحقق واحدة `pnpm check` (12 مرحلة) بإجراءات مثبتة SHA وNode 22.23.3 وfrozen-lockfile وbudget تدقيق مع سجل استثناءات.

**الخلاصة للمهندس المستقبلي**: مواضع التعديل محددة ومحروسة (§8)؛ إضافة قدرة تمر عبر أبواب البيوت (doors) وسجل الملكية وفحص الكيانات؛ تغيير قاعدة مالية يقع حصريًا في `src/domain/<family>/policies.ts`؛ الكسر سيُلتقط آليًا عند أقرب `pnpm check` — البنية تفرض نفسها بدل أن تتذكرها.

---

## 2. شجرة المجلدات وخريطة المسؤوليات

الشجرة أدناه بعد استبعاد الضجيج (node_modules، dist، الخطوط، الأصول، المولدات). المسارات نسبية لجذر المستودع.

```
Micro/
├── apps/prototype-web/              # المنتج: حزمة عمل pnpm واحدة @micro/prototype-web
│   ├── ARCHITECTURE.md              # وثيقة معمارية الحزمة (عربية بتصحيحات مؤرخة)
│   ├── client/
│   │   ├── public/                  # أصول ثابتة (خطوط woff2، علامات PWA، _headers، _redirects)
│   │   └── src/
│   │       ├── main.tsx / App.tsx   # الإقلاع: ErrorBoundary > PrototypeServicesProvider > Theme > Router
│   │       ├── app/                 # (18 ملفًا) القشرة: MicroRouter (65 مسارًا)، StartupGate،
│   │       │                        #   CapabilityRouteGate، navigation/Contract، routeClassifier،
│   │       │                        #   quickRecording، useReturnNavigation، useDisabledCapabilities
│   │       ├── application/         # (36 بيتًا / 299 ملف .ts / 145 اختبارًا مجاورًا) خدمات الاستخدام:
│   │       │                        #   finance (55)، transfers (48)، inventory، fulfillment، agreements،
│   │       │                        #   owner-money، cash، collections، suppliers، loans، assets، …
│   │       │                        #   لكل بيت باب index.ts اختياريًا (29 بابًا من 36)
│   │       ├── storage/             # local/ (54 ملفًا): المهايئان + المنفذ types.ts (130 طريقة)
│   │       │                        #   + migrations/stores/snapshot/lifecycle/primitives
│   │       │                        #   + 9 حراس التزام + capabilities/ (16×3) — diagnostics/ منفصل
│   │       ├── pages/               # (74 ملفًا = 60 صفحة موجهة + 14 اختبارًا) تركيب شاشات فقط
│   │       ├── components/          # primitives/ (10) + layout/ (8) + finance/ (18) + forms/ (13)
│   │       │                        #   + catalog/ owner/ settings/ order*/ cost/ loans/ security/ brand/…
│   │       ├── presentation/        # (17) تنقية عرض: formatters، stateAdapter، activityLabels، plurals…
│   │       │                        #   (3 منها شوائم إعادة تصدير انتقالية)
│   │       ├── contexts/            # ThemeContext (79 سطرًا، ADR-009)
│   │       ├── lib/                 # syncSha256، textDelivery، utils (أوراق)
│   │       ├── pwa/                 # (9) تسجيل SW، تثبيت، dirtyRegistry، إشعارات زمن التشغيل
│   │       ├── styles/              # vf-tokens.css (جسر الرموز الوحيد) + primitives + theme-dark
│   │       └── testing/             # مساعدات اختبار (R10-B5)
│   ├── scripts/                     # check-bundle-budget/surfaces، فحص تغطية typecheck الاختبارات
│   ├── dev-tools/                   # debug-collector — تطوير فقط عبر وسطاء Vite
│   └── vite.config.ts / vitest.config.ts / tsconfig*.json
├── src/domain/                      # نواة المجال: 18 عائلة نقية (types/policies/index لكل عائلة)
│                                    #   + ملفات متخصصة (deliveryAttribution، previewDerivations…)
├── tests/                           # مجموعة الجذر: tests/domain (39 ملفًا) + owner-entitlement
├── scripts/                         # 73 ملفًا: ~26 حرسًا + 38 اختبارًا ذاتيًا + حراس بايثون
│                                    #   (تصميم/تباين/كثافة نص) + operations-control/ + security/
├── docs/                            # 665 ملفًا: contracts 01-43 + architecture/ (ADRs 18 + refactoring/)
│                                    #   + operations/ (control: 94 عنصرًا و41 Workstream) + product/
│                                    #   + quality/ + expansion/ + scenarios/ + research/ + fixtures/
├── ai-skills/                       # 9 حزم مهارات محمولة تقرأ عبر جدول AGENTS.md فقط
├── tools/micromatch-shim            # مرآة micromatch خالية من braces (أمنية، ESLint مخصص)
├── .github/workflows/               # ci.yml + history-secret-scan.yml
├── reports/ + planning/ + .claude/ + .replit   # مخازن غير سلطوية (لا تقرأ افتراضيًا)
└── eslint.config.js / tsconfig.json / vitest.config.ts / package.json / pnpm-workspace.yaml
```

**خريطة المسؤوليات بعبارة واحدة لكل طبقة**: `main/App` إقلاع وتركيب · `app/` توجيه وبوابات وعقد تنقل وجذر حقن · `application/` حالات استخدام بلا React ولا UI · `src/domain/` قواعد مال/كمية/زمن خالصة بلا إدخال/إخراج · `storage/` منفذ ومهايئات وحراس · `pages/` تركيب شاشات · `components/` أنماط مشتركة وبدائع · `presentation/` تنقية عرض فقط · `pwa/` تعبئة/تحديث آمن · `scripts/` فرض بنيوي ذاتي الاختبار · `docs/` سلطة موثقة بترتيب قراءة مفروض.

---

## 3. الطبقات والحدود الفعلية — الموثق مقابل المفروض مقابل المخالف

### 3.1 الاتجاه الموثق والفرض الميكانيكي

الاتجاه المسؤول (موثق في `apps/prototype-web/ARCHITECTURE.md:20-28`): الواجهة → خدمات التطبيق → المجال → منفذ التخزين → IndexedDB؛ ولا وصول مباشر من الواجهة إلى التخزين. هذا **ليس مجرد توثيق**: مصفوفة الفرض أدناه تلخص ~30 آلية (التفاصيل الكاملة بأسطرها عند A3 — E-303..E-335 — وقد نُفذ سلسلة `pnpm guards` كاملة هنا بنجاح [تشغيل، E-051]):

| # | الآلية | الملف الحامل | ما تفرضه | الأساس/الاستثناء |
|---|---|---|---|---|
| 1-2 | نقاء المجال (استيرادات + بيئة) | `eslint.config.js:26-121` | المجال: استيرادات نسبية فقط، صفر حزم/UI؛ ممنوع indexedDB/localStorage/document/window في المجال | لا شيء |
| 3 | ملكية تقريب المال | `eslint.config.js:35-42,341-402` | حظر Math في المجال والتطبيق خارج النواة | 4 ملفات معفاة بسبب موثق |
| 4-5 | حظر وصول الواجهة للتخزين والمتصفح | `eslint.config.js:123-171,279-303,406-457` | لا استيراد قيمة من `@/storage/local/*` في الصفحات/المكونات (النوعي مسموح بسياسة)؛ لا localStorage/sessionStorage/window | استثناءان موثقان: StartupGate وPrototypeServicesContext |
| 6-7 | خلو التطبيق/التخزين من React وخلو البدائع من التبعيات | `eslint.config.js:177-248` | صفر React في application/storage؛ البدائع أوراق (react/clsx/lucide/أشقاء/presentation فقط) | لا شيء |
| 8 | أرضية أمنية للأدوات المبيعة | `eslint.config.js:486-503` | tools/**: لا eval/new Function، مساواة صارمة… | مرآة حرفية عن قصد |
| 9 | حدود الوحدات R1–R9 (AST) | `scripts/check-module-boundaries.mjs` (852 سطرًا) | R1 منع الاستيراد العميق للمجال من خارجه؛ R2 حواف قيمة UI→مجال؛ R3 حواف قيمة application→presentation (صفر بعد Wave B)؛ R5 حافتا تشغيل UI→تخزين؛ R6 استيرادات UI الداخلية لبيوت التطبيق مقابل أساس JSON؛ R8 الحواف النوعية UI→تخزين؛ R9 إحصاء حواف البيوت مع سقوف أزواج ودورات جديدة = فشل | أساسان JSON + نمو المجمدة (17/52/19/2) |
| 10-11 | دورات التشغيل والأنواع | `check-runtime-cycles.mjs` / `check-type-cycles.mjs` | تارجان على الاستيرادات الحاملة للقيم (أساس صفر)؛ تعداد SCC النوعي (أساس 1) | دورة نوع واحدة مجمدة في التخزين |
| 12 | فصل القراءة/الكتابة في التطبيق | `check-application-readwrite.mjs` | ملفات القراءة المسجلة (+ كل ملف بعلامة `PC-4 read-model:`) لا تستدعي save/commit/delete/replace/clear | قوائم موثقة |
| 13 | أسطح أبواب البيوت | `check-application-door-surfaces.mjs` + أساس | كل `application/**/index.ts` يصدّر رموزه المثبتة بالضبط (قيمًا وأنواعًا)؛ `export *` ممنوع؛ باب جديد/رمز محذوف = فشل | 29 بابًا مثبتًا |
| 14-15 | ملكية الزمن | `check-application-ambient-time.mjs` / `check-date-arithmetic-ownership.mjs` | `Date.now()` في التطبيق فقط كاحتياط معرف (21 موضعًا مثبتًا)؛ `Date.UTC` ممنوع في كل الإنتاج؛ حساب التواريخ عبر نواة المجال فقط | 21 موضعًا + 5 مواضع احتياط للتقسيم النصي |
| 16 | تحويلات المال | `check-money-minor-casts.mjs` | تصريحات `as *Minor` خارج المناطق المعتمدة = صفر؛ المخارج 13 موضعًا مرقومًا | 13 |
| 17-18 | حراس مستمعي IDB والتشخيصات | `check-storage-listener-guards.mjs` / `check-diagnostics-storage.mjs` | كل `.onsuccess` في ملفات حدود IDB الأربعة محروس؛ localStorage الإنتاجي في موضع واحد مسجل | إعفاءات مسماة |
| 19-20 | معجم التسميات + أسطح الحوارات | `check-label-vocabulary.mjs` / `check-a11y-dialog-surfaces.mjs` | مضاهئة حرفية للتسميات الكنونية؛ كل سطح حوار مصنف بنموذج | 32 مدخلًا / 7 أسطح |
| 21 | سقوف أحجام الملفات | `check-file-size-ratchet.mjs` | نطاقات NORMAL<400 / WATCH 400-799 / SPLIT_CANDIDATE 800-1199 / SPLIT_NOW≥1200 سطرًا؛ النمو داخل النطاق يفشل بلا قيد سجل؛ تدقيق انجراف merge-base يمنع تحرير الأساس في نفس الـPR | سجل بمراجع مالك |
| 22-24 | تغطية السجلات والمراسي | `check-registry-coverage` / `check-acceptance-value-anchors` / `check-entity-touchpoints` | كل بيت تطبيق وعائلة مجال في سجل الملكية؛ 3 مواضع قبول تستهلك السجلات الكنونية؛ كل مخزن كيان مسجل بنقاط اتصاله | لا شيء |
| 25 | اختبار ذاتي لحدود الطبقات | `check-layer-boundaries.test.mjs` | يشغل **الـeslint الحقيقي** على عينات مثبتة يثبت سلوك القواعد 1-6 | عينات |
| 26 | ميزانيات الحزمة | `apps/.../check-bundle-budget.mjs` + بوابة داخل `vite build` | خام ≤650,000 / مضغوط ≤155,300 بايت + أسطح كسولة مرقومة (102 lazy) | أسس لكل بيئة (نُفذت هنا [تشغيل، E-055]: 630,709/154,928) |
| 27 | سقف تحذيرات lint | `package.json` + `check-lint-warning-baseline.mjs` | ≤37 (أساس دقيق 35 + كشف انجراف المزيج + إعادة ترسيخ عند النقصان) | 35 (نُفذ: 35 تحذيرًا [تشغيل، E-056]) |
| 28-29 | حراس التصميم والكثافة النصية | بايثون + stylelint | حظر الألوان الخام (hex/rgb/hsl)؛ 82-92 زوج تباين WCAG بسمتين؛ سقوف نص عربية لكل سطح | سجلات PAGES |
| 30 | حراس مدموجة في الاختبارات | `moneyLayerGuard.contract.test.ts` ورفاقه | تجميد عدادات مرايا المال لكل ملف (OrderDetail ‏13)؛ إحصاء الأصناف التراثية؛ عقد الأبواب؛ مزامنة جرد المسارات | جداول مثبتة داخل الاختبارات |

### 3.2 الحكم: الموثق = المفروض، والاستثناءات معلنة

- **لم يُعثر على مخالفات صامتة للاتجاه الموثق** خارج الأسس المعلنة: لا React في application/storage، ولا استيراد قيمة من التخزين في الصفحات، ولا إدخال/إخراج في المجال (تحقق موضعي + الحراس 9/10/11 كانت ستمسكها) — **(مصدر/استنتاج، E-307/E-319)**.
- **الدورتان القيميتان الحيتان** بين البيوت (`finance↔financial-analysis` و`preferences↔time`) وSCC الأنواع الخماسي: حقيقية لكنها محصورة ومسعورة، والحارس يفشل حلها الصامت أيضًا حتى يُعاد ترسيخ الأساس عمدًا — انظر ARCH-F001 وحزمة WP-A3-3.
- **قاعدة الانجراف الموثقة**: «الأسس الحية والسجلات هي السلطة؛ الأرقام النثرية في الوثائق لقطات تاريخية» — أثبت التدقيق ثلاث حالات انجراف عددية أضلت حتى الوكيل A3 (21 زوجًا مقابل 24 فعليًا؛ 22/31 مقابل 22/35؛ 13/8 مقابل 17/16) — **(مصدر، E-444/E-448/E-375؛ انظر ARCH-F007)**.

---

## 4. نقاط الدخول والواجهات العامة واختيار التخزين

### 4.1 سلسلة الإقلاع (مصدر، E-336..E-340)

`client/src/main.tsx` (رسم الجذر + `registerPwaServiceWorker`) → `App.tsx` (ErrorBoundary > PrototypeServicesProvider > ThemeProvider > MicroRouter) → `MicroRouter.tsx` (65 تسجيل مسار، 60 تحميلًا كسولًا، تحويلان تراثيان موثقان: `/finance/new/owner_withdrawal_cash`→`/finance/withdraw` و`/review`→`/finance`) → `StartupGate` (تحميل الملف مرة/جلسة، توجيه الأول إلى `/setup`، طلب التخزين الدائم مرة) → `AppLockGate` (حجاب القفل النمطي) → `Switch` + `MicroAppShell` (ترويسة/تنقل سفلي خماسي/FAB). `CapabilityRouteGate` يغلف مسارات إنشاء 4 قدرات فقط؛ `routeClassifier` يصنف المسارات (setup/deep/surface) لقرار إظهار الكروم.

### 4.2 المنافذ العامة (مصدر، E-341..E-345)

| المنفذ | الموضع | الدور |
|---|---|---|
| `PrototypeLocalStore` | `storage/local/types.ts:437+` (~130 طريقة؛ الزوج 38/30 مثبت هنا) | منفذ التخزين الوحيد؛ المهايئان يحققانه؛ 16 منفذ قدرة `Pick` ضيقة في `capabilities/` |
| `usePrototypeServices` / `PrototypeServicesContext` | `app/PrototypeServicesContext.tsx` | **جذر التركيب الوحيد**: متجر مفرد `createBrowserLocalStore()` عند تحميل الوحدة (سطر 259) + `createServices()` يركب ~46 حقل خدمة بحقن صريح (260-350) + تحميلات كسولة بعد الإقلاع (transfers/recurring/loans) + إبطال عبر `BroadcastChannel` وعدّاد `dataVersion` + `getPrototypeLocalStore()` للخدمات المتأخرة حصرًا |
| `createBrowserLocalStore` | `storage/local/createBrowserLocalStore.ts` (7 أسطر) | **اختيار التخزين**: يعيد `new IndexedDbLocalStore()` خلف المنفذ — نقطة الاستبدال الوحيدة (Memory في الاختبارات فقط) |
| أبواب البيوت | `application/<house>/index.ts` (29 من 36) | الواجهة الاستيرادية الرسمية لكل بيت؛ أسطحها مثبتة بالحارس 13 |
| براميل المجال | `@micro-domain/<family>/index.js` (19 برميلًا) | السطح العام للمجال؛ مقفول بـ`tests/domain/public-surface.test.ts` |
| عقد التنقل | `app/navigationContract.ts` | `?returnTo=` الوعاء القانوني؛ معجم معلمات مغلق؛ عمال مساعدات |
| مزامنة جرد المسارات | `application/diagnostics/routeTemplate.ts` ↔ MicroRouter | اختبار يشتق المسارات من مصدر الموجه نفسه |

### 4.3 اصطلاحات التسمية والاستيراد (الموثق مقابل المستخدم)

- المسارات المستعارة: `@/` لجذر client/src و`@micro-domain/` لبراميل المجال (تعريف في vite/vitest configs) — مستخدمة باتساق.
- التسمية: `<Thing>Service.ts` للخدمات، `*Store.ts` للمخازن، `*CommitGuard.ts` للحراس، `*.dom.test.tsx` لرحلات الواجهة، `*.contract.test.ts` لعقود التكافؤ، `*.characterization.test.ts` لاختبارات التوصيف — النمط مستخدم بانتظام عبر 447 ملف اختبار.
- المخالفات المعلنة: 3 شوائم عرض بـ`export *` (تجميد انتقالي)، واستثناءات مسماة في ESLint — لا شيء غير معلن.

---

## 5. ربط مكونات الـ 45 بالبنية (خريطة ملاحة سريعة)

الحالة الكاملة وسلوك كل مكون في التقرير 1 §3/§5؛ هذا الجدول يحدد **المواضع البنيوية** فقط: أين الواجهة، أين الأمر، أين مالك السياسة، أين التخزين، أين القراءة، أين الاختبار. اختصارات: S=خدمة في `application/`، P=سياسة في `src/domain/<عائلة>/policies.ts`، T=مخازن (الأسماء في التقرير 1 §4.2)، R=قارئ/إسقاط.

| المعرف | الواجهة (pages/ أو app/) | الأمر (S) | مالك السياسة (P) | التخزين (T) | القراءة (R) | الاختبارات الممثلة |
|---|---|---|---|---|---|---|
| UNIT-001 | `Setup.tsx` | preferences/profile | — | DF-19 | — | `Setup.ui.test.tsx` |
| UNIT-002 | `Foundation.tsx` + guided import | transfers/guidedOpeningImport | مجال العائلات المستهدفة | DF-03/06/19 | `influentialSnapshotFamilies` | عقود الاستيراد الموجه |
| UNIT-003 | `Home.tsx` | home/homeControlCenter | — (قراءة فقط) | — | `readPosition`+`readRecordedPeriodResult` | `Home.dom.test` |
| UNIT-004 | `app/quickRecording` + `components/layout/QuickActionSheet` | direct-sales/finance | نفس 005/015 | نفس 005/015 | نفس 005/015 | `QuickForms*.dom.test` |
| UNIT-005 | `DirectSaleEditor.tsx` | direct-sales/directSaleService | direct-sale | `direct-sales` | الموقع/الفترة/الأطراف | `DirectSaleEditor.ui.test` + عائلة المجال |
| UNIT-006 | `Orders.tsx` | — (قراءة) | — | DF-01 | `Orders.ui.test` | `Orders.ui.test.tsx` |
| UNIT-007 | `NewDraft/DraftEditor.tsx` | drafts/draftService | — | `order-drafts` | — | عقود المسودات |
| UNIT-008 | `CostEditor.tsx` | cost | craft-order (calculateCostSnapshot) | DF-01 (لقطات) | `OrderDetail` | `craft-order.test` |
| UNIT-009 | `AgreementEditor.tsx` | agreements/agreementService | craft-order (create/transition/collectDeposit) | DF-01+DF-13 ذري | ورقة التحصيل | `AgreementEditor.dom.test` + `agreementService` |
| UNIT-010 | `OrderDetail.tsx` | fulfillment/fulfillmentService | craft-order (كامل دورة الحياة) | DF-01 | `agreements/orderDetailViewModel` | `OrdJourneys` + `R1.orderDetailVoid` + `moneyLayerGuard` |
| UNIT-011 | `DeliveryReview.tsx` | fulfillment/deliveryReviewService | craft-order + inventory-material | 5 مخازن بمعاملة | الفترة/المخزون | `craft-order-corrections`/`d15-settlement`/`review-lock` |
| UNIT-012 | `Schedule(+Editor).tsx` | scheduling | — (تحديث محروس) | DF-13 | — | `ScheduleEditor.dom.test` |
| UNIT-013 | `Finance.tsx` | finance (بيت 55 ملفًا) | budget/financial-analysis/asset… | قراءة فقط | `financeState` + `projectFinancial*Reads` | `G3*.dom` + `Finance*.dom` |
| UNIT-013B | `components/finance/ExpenseBudgetsSectionBody` | budgets/expenseBudgetService | budget | `expense-budgets` | مشتق من الأحداث (D-038) | `budget.test` + `FinanceBudgets.w174` |
| UNIT-014 | `FinanceMore.tsx` | — (قراءة) | — | — | — | `FinanceMore.w42` |
| UNIT-015 | `FinancialEventEditor.tsx` | finance/projectFinancialEventWrites | financial-event (DELTA_TABLE) | DF-02 (+DF-03 إسناد) | الموقع/الفترة/الميزانيات | `FinancialEventEditor.*.test` + `financial-event.test` |
| UNIT-016 | `Statement.tsx` | finance/statementService | — | قراءة | القارئات الكنونية | `StatementPeriod.w173` |
| UNIT-017 | `FinanceActivity.tsx` | activity | — | قراءة | البيان+الفترة | `FinanceActivity.*` |
| UNIT-018 | مدمجة (`/review`→`/finance`) | fulfillment (depositOverview) + collections | — | DF-01/03 | `readPosition.pendingRetainedDeposits` | `FinanceObligations.w43` |
| UNIT-019 | `RecurringExpense*` (4 أسطح) | recurring/recurringExpenseService | recurring-expense | 3 مخازن + DF-02 ذري | القادم/الميزانيات | `recurringExpenseCommitGuard` + `RecurringExpense*.dom` |
| UNIT-020 | `OwnerEntitlement.tsx` + `OwnerWithdrawalEditor` | owner-money/ownerEntitlementService | owner-entitlement + owner-safe-withdrawal | 4 مخازن + DF-03 ذري | `ownerEntitlementViewModel` | `owner-entitlement.test` + `OwnerWithdrawalEditor.ui` |
| UNIT-021 | `FinanceUpcoming.tsx` + `G5DeclarationEditor` | financial-analysis | financial-analysis | DF-17 | قادم/استحقاقات (مشترك مع UNIT-018 — تصحيح V2/RPT-04) | `FinanceUpcoming.dom` + `G5Activity.dom` |
| UNIT-022 | `CashWallets/WalletLedger` | cash/cashContinuityService | cash-continuity | DF-03 | دفتر المحفظة | `CashWallets.dom` + `cash-continuity.test` |
| UNIT-023 | `CashTransferEditor.tsx` | cash (transfer) | cash-continuity | DF-03 (زوج) | — | `cash-continuity.test` |
| UNIT-024 | `CashDistribution.tsx` | finance (distributeUnallocated) | cash-continuity (allocation) | DF-03 | `unallocatedCashMinor` | `projectFinancialEventWrites` اختبارات |
| UNIT-025 | `CashCount.tsx` + `CashAdjustmentEditor` | cash (adjust) | cash-continuity | DF-03 | — | `CashCountMessages` + `cashJourneys` |
| UNIT-026 | `Collect.tsx` | collections/collectionService | craft-order/direct-sale | DF-01/21 (+DF-03) | ورقة التحصيل | `CashJourneys` + `OrdJourneys` |
| UNIT-027 | `Suppliers` + `SupplierPurchaseEditor` | suppliers/supplierPurchaseService | supplier-purchase | DF-05 (+DF-03 ذري) | الموقع/الأطراف | `supplier-purchase-*.test` |
| UNIT-028 | `InventoryMaterials` + محررات | inventory (عائلة) | inventory-material | DF-06 | نظرة المخزون | `inventory-material.test` + `Inventory*.dom` |
| UNIT-029 | `Catalog.tsx` + `components/catalog/*` | catalog/catalogService | catalog + recurring-margin | DF-07 | مقترحات المسودة | `catalog.test` + `Catalog.ui` |
| UNIT-030 | `Tools.tsx` | — | — | — | — | `ToolsCleanup.w42` |
| UNIT-031 | `CostCalculator.tsx` | estimates (preview) | craft-order (نفس اللقطة) | لا كتابة | — | `exact-values.characterization` |
| UNIT-032 | `EstimateDetail.tsx` | estimates/costEstimateService | — | `cost-estimates` | — | عقود التقديرات |
| UNIT-033 | `ToolsIntegrity.tsx` | diagnostics/integrityCheckService | — | قراءة فقط | MIC-1..18 | `ToolsIntegrity.ui` + `integrity` عقود |
| UNIT-034 | `Assets*` (3 أسطح) | assets/assetService | asset | DF-09+DF-02 ذري | الفترة/الجسر | `asset.test` + `assetResidual` + `G4Assets` |
| UNIT-035 | `Loans*` | loans/loanService | loan | DF-10+DF-02 ذري | الموقع | `loan.test` + `G4Loans` |
| UNIT-036 | `ReceivedLoan*` | loans/receivedLoanService | received-loan | DF-11+DF-02 ذري | الموقع | `receivedLoan.test` + `ReceivedLoanEditor.w178` |
| UNIT-037 | `Parties.tsx` | parties/partyLedgerService | — | **لا مخزن** (قراءة مشتقة) | تجميع الأسماء | `PartiesLedger.dom` |
| UNIT-038 | `Settings.tsx` + `components/settings/*` | preferences + security | — | DF-19/23 | — | `Settings.*.test` + `Set003*` |
| UNIT-039 | `Profile.tsx` | profile | — | DF-19 | — | `Profile.ui.test` |
| UNIT-040 | `SharePreview.tsx` | share/shareMessageService | — | لا كتابة | — | `OrderShare.exe015` |
| UNIT-041 | `Market.tsx` | — | — | لا شيء | — | `SmokeOnlyPagesJourneys` |
| UNIT-042 | `components/security/AppLockGate` | security/localLockService | — | DF-23 | — | `AppLockGate.idleCharacterization` + `Settings.lockGate` |
| UNIT-043 | `components/layout/AppHeader.tsx` (لوحتا «قريبًا»: transport/assistant) | — (إعلان صادق فقط) | — | لا شيء — لا سجل ولا مسار خدمة | — | — (تصحيح V2/RPT-04 — E-072) |
| UNIT-044 | `components/settings/SettingsDataProtectionSection` | transfers/localTransferService | — | 35 مخزنًا (لقطة) | عدادات المظروف | `adapterConformance` + `rollbackRehearsal` + goldens |

**تغطية النسخ**: كل عائلات اللقطة الـ 35 داخل التصدير/الاستعادة باستثناء المعلن (مسودات النماذج والقفل) — التفاصيل والتثبت في التقرير 1 §4.7. **تغطية الترحيل**: تغيير أي نموذج يمر بـ`indexedDbMigrations.ts` (المخطط) و`transferSnapshotMigrations.ts` (المظروف) مع اختبارات التوثيق والذهبيات.

---

## 6. أدلة إعادة الهيكلة والبقايا الانتقالية

خضع المستودع لسلسلة برامج بنيوية موثقة ومغلقة: مسح المجموعة 7 (قراءة فقط) → معالجة رباعية (المجموعات 8-11، WS-212 متحقق) → برنامج A-to-Z البنيوي (WS-214) → برنامج ما بعد المسح W0-W10 (WS-215) → الخلف البنيوي R0-R11 (WS-216/ARCH-007، موجاته مدموجة ومتحققة عند SHAs موثقة في `current-state.md` §9) → ARCH-012 (تقاعد ترحيل المسودات التراثية عند `f0904260`). **التجميد البنيوي فعال**: لا مسار بنيوي جديد إلا بمسح قراءة-فقط وقبول مالك.

ما وجده التدقيق **فعليًا في الشجرة الحالية**:

1. **شوائم عرض انتقالية ×3** — `presentation/formatters.ts` و`activityLabels.ts` و`orderAgreementPresentation.ts` كل واحدة إعادة تصدير `export *` من بيت التطبيق المالك (موجة B / ADR-011)، مجمّدة حتى موجة الواجهة، ومسجلة في أساس R6 (مصدر، E-353).
2. **وحدات R7-5 المحذوفة غابت فعلًا**: براميل g5 وخدمات التوافق الثلاث (`finance/ownerEntitlementService`، `finance/recurringExpenseService`، `withdrawalWalletGuard`) **ليست في الشجرة** (حذف عند `bfa48d44` بإثبات صفر مستهلك)؛ صفوفها في سجل الأحجام **سجلات تاريخية** تُقرأ بالملاحظات المؤرخة (مصدر، E-347).
3. **ARCH-012**: ملف `legacyFormDraftMigration*` غير موجود إطلاقًا في الشجرة (تحقق glob + `git show f0904260` يحذف 148+229 سطرًا)؛ باب المسودات أُفرغ من 5 رموز تراثية وإعفاء الحارس 18 أزيل بنفس الـPR (مصدر، E-346).
4. **دورات البيوت الحية** (المصفوفة §3.2) — البقية البنيوية الوحيدة «الحية» بمعنى الاعتماد الدائري، محصورة ومسعورة (مصدر، E-318/E-445).
5. **نظافة الموتى غير معتادة**: لا صفحات يتيمة (كل الـ60 موجهة)، ولا بيوت يتيمة (سجل الملكية يغطي 36/36)، ولا كتل CSS مكررة (75 كتلة أزيلت بإثبات صفر مستهلك وفق MIGRATION_STATUS)، وواجهات مزودة أزيلت (Toaster/Tooltip) (مصدر/استنتاج، E-385/E-331).
6. **أرقام لقطة تنجرف في النثر** (ARCH-F007): عناوين الخدمات في ARCHITECTURE.md وأحجام contract-40 §8 وADRs تحمل أرقامًا لحظية بتصحيحات مؤرخة — القاعدة المعمول بها داخل المستودع: الأسس الحية تسود.

---

## 7. مكتشفات التكرار — مصنفة

| # | النوع | الموضع | التصنيف والقرار الموثق |
|---|---|---|---|
| 1 | **تكرار معرفي محكوم** | `application/transfers/transferFamilyValidators.ts` (1745 سطرًا / 76 مخرجًا) يكرر اتحادات قبول الحالة من أنواع المجال | مسجل DUPLICATE في سجل الملكية؛ محروس بحارس اندرافت (`domainTransferDriftGuard`) + سجل قيم توافق + ذهبيات؛ **الحل الجذري مسمى**: الاستهلاك 4D لحراس المجال الزمنية — مؤجل ببوابة مالك (ADR-017 §3). إزالته اليوم ليست توصية (مصدر، E-348) |
| 2 | **مهايئان متكافئان** | `IndexedDbLocalStore` (4404) مقابل `MemoryLocalStore` (2132) | مشروع بالبرهان: نفس المنفذ ونفس الحراس التسعة + أجنحة مطابقة (13/13 + 42/42)؛ Memory يبقي واجهات المتصفح خارج اختبارات التطبيق — ليس تكرارًا قابلًا للإزالة (مصدر، E-349) |
| 3 | **شوائم إعادة تصدير** | 3 شوائم عرض + 36 استيراد جذر تركيب | انتقالية مجمّدة بشرط إزالة موثق (موجة الواجهة) (مصدر، E-353/E-315) |
| 4 | **مرايا مال في الواجهة** | حسابات مالية في TSX مجمّدة بعدّاد لكل ملف (OrderDetail ‏13) | دين حقيقي مسجل (عائلة F-049) محروس بـ`moneyLayerGuard`؛ الإزالة تتطلب موجة واجهة بقرار مالك (مصدر، E-351) — انظر ARCH-F003 |
| 5 | **حواف قيمة UI→مجال** | 17 حافة في 16 ملفًا | سياسة استثناء موثقة بشرط خروج قابل للقياس (صفر حواف)؛ ليست ازدواج بيانات بل إعادة اشتقاق عرض من دوال مجال نقية (مصدر، E-312) |
| 6 | **توحيد مصدر مثبت (لا تكرار)** | `resultCodes` إعادة تصدير وحيدة (ADR-012)؛ `formatting/formatters` الكنوني والعرض مجرد شويمة؛ معجم التسميات في `domain/shared/numeric.ts` بمضاهئة مرقومة | مقصود ومحروس — نقيض التكرار (مصدر، E-354/E-328) |
| 7 | **لقطات وذخائر مشروعة** | `docs/fixtures/export-goldens/` (28 ملف ذهبية) + أسس الأسطح والميزانيات | أدلة مثبتة لا كودًا مكررًا (مصدر، E-377) |
| 8 | **تكرار توثيقي** | تكرار الحقائق نفسها بأرقام متباعدة عبر السجلات وADRs والتصحيحات المؤرخة | طبقة وثائقية بقواعد أسبقية صريحة («التصحيح المؤرخ يسود») — عبء قراءة لا عيب كود (استنتاج، E-375) |

**غير مرشح للإزالة** (صريح): المهايئان، الشوائم عدا شرطها الموثق، الحواف النوعية الـ19، استيرادات جذر التركيب الـ36 — كلها إما مشروعة بالبرهان أو مجمّدة بقرار.

---

## 8. دليل الملاحة للتعديل — أين يعدل المهندس ماذا

كل المواضع أدناه **موجودة فعلًا وتعمل** (ليست مقترحات)؛ والحراس التي ستشتعل مذكورة. مقترحاتي المميزة معلمة [توصية] وليست نقاط تمديد قائمة.

| نوع التغيير | الموضع الكنوني | ما يشتعل عند `pnpm check` |
|---|---|---|
| (أ) واجهة صفحة | `apps/prototype-web/client/src/pages/<Screen>.tsx`؛ الأنماط المشتركة في `components/<family>/`؛ البدائع في `components/primitives/`؛ CSS بفئات `.micro-*` ورموز `--vf-*` فقط | legacyClassCensus + text-density + design-guards + سقوف الأسطح |
| (ب) قاعدة مالية | `src/domain/<family>/policies.ts` (وحدة حاكمة واحدة لكل حساب مشترك — نقاء استيراد المجال) | نقاء المجال ESLint + اختبارات المجال + moneyLayerGuard (قاعدة التعريف الواحد) |
| (ج) أمر/خدمة تطبيق | `application/<house>/<service>Service.ts` + باب البيت `index.ts` + التركيب في `PrototypeServicesContext.createServices` إن كانت جديدة | حارس أسطح الأبواب (نفس الـPR) + سجل الملكية (بيت جديد) + R6 للمستهلكين من الواجهة |
| (د) نوع نموذج مجال | `src/domain/<family>/types.ts` + البرميل `index.ts` (السطح مقفول بـ`public-surface.test`) | اختبار السطح العام + محولات التخزين (يجب تحديث المهايئين + منفذ القدرة) |
| (هـ) تخزين/مخزن | `storage/local/types.ts` (المنفذ والزوج 38/30) + `indexedDbStores.ts`/`indexedDbMigrations.ts` + المهايئان + منفذ القدرة المقابل؛ الكتابات الحساسة عبر `commit*` وليس `save*` | سجل الكيانات (نفس الشريحة) + رفع الزوج = قرار مالك بـdiff مزدوج + سقف حجم الملفات على PRESERVE |
| (و) قارئ/إسقاط | البيت المالك (أمثلة عاملة: `application/finance/projectFinancialReads.ts`، `financeState.ts`، `agreements/orderDetailViewModel.ts`، `owner-money/ownerEntitlementViewModel.ts`)؛ الملفات الجديدة توسم `PC-4 read-model:` | حارس القراءة/الكتابة (يمنع الكتابة تلقائيًا) |
| (ز) تحقق إدخال | `application/input/englishNumeric.ts` + `components/forms/English*Input` (أرقام ASCII/LTR تفشل مغلقًا عند الدقة غير المدعومة)؛ ثوابت المجال في policies | حارس تصريحات المال + قائمة إعفاءات Math |
| (ح) ترحيل | `storage/local/indexedDbMigrations.ts` (المخطط — «يقرأ القديم كما كُتب») + `application/transfers/transferSnapshotMigrations.ts` (المظروف) + أزواج القبول في `transferEnvelope.ts` | اختبارات التوثيق + الذهبيات + رفع الزوج قرار مالك |
| (ط) نسخ/تصدير | `application/transfers/localTransferService.ts` (واجهة) + عائلة transfers + واجهة الإعدادات `SettingsDataProtectionSection` | توثيق عقد 39 + عدادات صارمة + golden round-trips |
| (ي) اختبارات | المجال: `tests/domain/`؛ رحلات الواجهة: `*.dom.test.tsx` مجاورة؛ عقود التكافؤ: `*.contract.test.ts`؛ حراس ذاتيون بجانب السكربت | `pnpm check` هو حد الدخول (12 مرحلة) |
| نقاط التمديد الموثقة القائمة | EXTENSION_PLAYBOOK ‏A-H · أبواب البيوت (PC-3) · منافذ القدرات (ADR-015: منفذ Pick + مراسي + عقد مهايئين) · ساعة قابلة للحقن (`application/time/clock.ts` — 42 موضع حقن) · مزامنة ROUTE_TEMPLATES · `getPrototypeLocalStore()` للخدمات المتأخرة | بحسب النوع أعلاه |
| [توصية] الفجوة الوحيدة في الملاحة | لا يوجد فهرس واحد «أين تعيش الأرقام» للصفحات (يغطيه جزئيًا جدول SOURCE_OF_TRUTH + سجل الملكية) | — |

---

## 9. التشغيل المحلي ومرونة المستقبل (بالأدلة، بلا اقتراح تنفيذ)

- **فصل القواعد عن الإدخال/الإخراج**: المعنى المالي مفصول كليًا — المجال نقي (الحراس 1-2)، الخدمات بلا سياسات، المهايئات بلا اجتهاد (ترجمة + حراس ثوابت بنيوية فقط). الزمن منفذ وحيد قابل للحقن؛ حساب التواريخ نواة أعداد صحيحة؛ `Date.UTC` ممنوع في كل الإنتاج — **(مصدر، E-361/E-362)**.
- **هويات مستقرة**: مفاتيح حتمية على العمليات القابلة لإعادة المحاولة؛ احتياط معرفات عشوائي بمواضع مرقومة (21)؛ مفاتيح عمليات مطبوعة (`:confirm`, `:reverse-collection:`…)؛ إبطال قراءة عبر التبويبات بـBroadcastChannel — **(مصدر، E-208 A3)**.
- **النقل/الإصدارات**: زوج صريح 38/30 محروس؛ مظروف بهاش وعدادات (22 عائلة معدودة من 35 — فجوة العد الموثقة OD-COUNTS)؛ 24 زوجًا تراثيًا مقبولًا؛ دورة تصدير→استيراد→إعادة تصدير مثبتة بالاختبارات — **(مصدر، E-363/E-448)**.
- **حدود المعاملات والتصحيح**: كتابات حساسة عبر `commit*` المحروسة حصرًا؛ تصحيح = عكس كامل + سبب + حتمية؛ `needs_review` يقفل تغيير الحالة/اللقطة/الأثر المالي — **(مصدر، التقرير 1 §4.5)**.
- **فجوات مرتبطة بالمستقبل (موثقة كحدود لا كعيوب)**: (1) عقد 04 يحدد آلة حالات المزامنة (local_only→pending_sync→synced) لكن لا SyncQueue ولا synced ولا conflict منفذة في المجال — الحالات عمليًا local_only؛ (2) لا طبقة auth/workspace/مستخدمين (خط أحمر منتج)؛ (3) `replaceSnapshot` استبدال لقطة كامل بلا دلتا تزايدي؛ (4) 13 عائلة غير معدودة في المظروف؛ (5) لا قصة كتاب متعددة خارج إبطال التبويبات في المتصفح الواحد؛ (6) **مسودات النماذج العابرة والقفل** خارج اللقطة عمدًا (`form-drafts` — عقد 36؛ `local-security` — عقد 37 وينجو من التصفير)؛ أما **التفضيلات (`local-preferences`) فداخل اللقطة** وتنتقل مع التصدير/الاستعادة (تصحيح V2/RPT-02: عبارة V1 كانت تُدرجها مع القفل خطأً؛ معاملتا القراءة/الاستبدال تتضمنان `preferencesStore` صراحة — E-070) — **(مصدر، E-363/E-381/عقد 04/E-070)**. **لا يصادق هذا التدقيق على جاهزية سحاب/مزامنة/auth — الأدلة أعلاه توصف فقط.**

---

## 10. حزم عمل مقترحة (للمسائل المثبتة فقط — كلها تحتاج بوابة مالك بسبب التجميد البنيوي النشط)

| الحزمة | المسألة المثبتة | المكونات المتأثرة | الترتيب والمخاطر | معيار القبول |
|---|---|---|---|---|
| WP-A3-1 | إحالة حواف قيمة UI→مجال الـ17 (شرط خروج موثق بـADR-011: صفر حواف) | 16 ملفًا (صفحات ومكونات عرض) | موجات حافة-بحافة عبر خدمات قراءة/مهايئات عرض؛ مخاطرة بايتات حزمة الإقلاع (مقيسة +89 gzip لثلاثة مواضع ساكنة في ADR-018) | أساس R2 يتقلص رتيبيًا؛ `pnpm check` أخضر؛ صفر مفاتيح R6 جديدة |
| WP-A3-2 | إزالة الشوائم الثلاث (ذيل WP-A3-1) | presentation/ + 3 مفاتيح R6 | مخاطرة منخفضة (إعادة تصدير حرفية) | صفر مستهلكين؛ الشوائم محذوفة؛ الصفوف موسومة |
| WP-A3-3 | حل الدورتين القيميتين بين البيوت | finance/financial-analysis + preferences/time | يتطلب إعادة ترسيخ الإحصاء بنفس الـPR (الحارس يفشل الحل الصامت)؛ لمس عائلتين PRESERVE | sccBaselines يتقلص؛ حارسا الدورات يبقيان خضراء |
| WP-A3-4 | استهلاك 4D لحراس المجال الزمنية في مدققات النقل (الحل الجذري المسمى) | transfers + المجال | مخاطرة عالية (توافق بيانات 24 زوجًا تراثيًا)؛ يحتاج اختبارات وحيش + ذهبيات | صفر فروق ذهبية؛ جولات المهايئين كما هي |
| WP-A3-5 | إحالة مرايا المال في الواجهة (عائلة F-049: 13 في OrderDetail وغيره) | OrderDetail وأشباهه | موجة واجهة بقرار مالك؛ اختبارات توصيف قبل أي نقل | جدول moneyLayerGuard يتقلص بإثبات لكل ملف؛ قيم متطابقة بايتًا |
| WP-A3-6 | استكمال تقسيم SPLIT_NOW (OrderDetail ‏1869 / Finance ‏1500) | صفحتان + viewModels مستخرجة | حزم R6-F17-P01/P02 مسجلة أصلًا؛ يحتاج بوابة مالك بواجهة عامة مثبتة | سقوف الأحجام تعود للنطاقات؛ الأسطح محفوظة |
| WP-A3-7 | رموز أنواع أبواب بلا مستهلك (6 أبواب) | أبواب البيوت الستة | مخاطرة منخفضة؛ موجة لاحقة | أساس الأبواب يتقلص بنفس الـPR |

**لكل نقلة/دمج/إزالة مقترحة أعلاه**: السبب مثبت بالأساس الحي؛ المالك الباقي معلن (بيوت التطبيق/نماذج العرض)؛ البديل موجود (خدمات القراءة/الأبواب)؛ أثر البيانات/التاريخ/النسخ معدوم (كلها تحويلات كود بلا لمس مخازن) — ما عدا WP-A3-4 حيث التوافق معزز بالذهبيات والأزواج المقبولة. **لا يفترض هذا التقرير أن إعادة بناء شاملة ضرورية — العكس مثبت أعلاه.**

---

## 11. المكتشفات (ARCH-F)

| المعرف | العنوان | الدليل والسبب | الأثر والأولوية | التوصية ومعيار القبول |
|---|---|---|---|---|
| ARCH-F001 | دورتان قيميتان حيتان بين البيوت + SCC أنواع خماسي | E-318/E-445: `finance↔financial-analysis` و`preferences↔time` في أساس sccBaselines الحي | اعتماد دائري حقيقي محصور ومسعور؛ يعقد التملك والفهم. **متوسط (بنية)** | WP-A3-3 ببوابة مالك. القبول: الأساس يتقلص والحارسان أخضران |
| ARCH-F002 | 17 حافة قيمة UI→مجال + 52 استيرادًا داخليًا UI→application | E-312/E-315/E-444: أسس مرقومة موثقة النمو (13/8→17/16 بموجات معلنة) | استثناء سياسة موثق بشرط خروج قابل للقياس؛ يخفف عزل الواجهة. **متوسط (دين مقنن)** | WP-A3-1/2. القبول: تقلص رتيبي للأساسين |
| ARCH-F003 | مرايا مال في الواجهة (13 سطرًا في OrderDetail) — قاعدة أعمال في TSX | E-351: moneyLayerGuard يجمّد العدادات لكل ملف (عائلة F-049) | ازدواج حساب مالي حقيقي بين الواجهة والمجال، مجمّد لا منسي. **متوسط** | WP-A3-5 بتوصيف قيمي قبل النقل. القبول: العداد يتقلص بإثبات تكافؤ |
| ARCH-F004 | ملفات ضخمة مسجلة SPLIT_NOW/SPLIT_CANDIDATE | E-446/E-350: OrderDetail ‏1869 / Finance ‏1500 / OwnerEntitlement ‏1161 / Catalog ‏806 (WATCH)؛ استخراج viewModels جزئي منجز | قابلية مراجعة وملاحة. **متوسط (خطة مسجلة أصلًا)** | WP-A3-6 عبر الحزم المسجلة ببوابة مالك. القبول: عودة النطاقات |
| ARCH-F005 | شوائم عرض انتقالية ×3 (`export *`) | E-353: إعادة تصدير مجمّدة بشرط إزالة موثق | عبء ملاحة بسيط. **منخفض** | WP-A3-2. القبول: صفر مستهلكين ثم حذف |
| ARCH-F006 | تكرار معرفي محكوم في مدققات النقل (1745 سطرًا) | E-348: سجل الملكية يصنفه DUPLICATE بحارس اندرافت وحل جذري مسمى 4D | فخ انجرافت محروس آليًا. **منخفض الآن / عالٍ عند أي توسعة عائلات** | WP-A3-4 عند الحاجة ببوابة مالك. القبول: ذهبيات ثابتة |
| ARCH-F007 | أرقام لقطة تنجرف في نثر الوثائق (الأسس الحية تسود) | E-444/E-448/E-375: 21 زوجًا (ADR) مقابل 24 فعليًا؛ 22/31 مقابل 22/35؛ 13/8 مقابل 17/16؛ + صفوف العقود الثلاثة (DATA-F005 مالك البيانات هناك) | أضلت حتى وكيل التدقيق A3 — عبء قارئ. **منخفض (توثيق)** | [توصية] تدقيق أرقام دوري موحد أو إحالة صريحة إلى الأساس في كل نثر رقمي. القبول: الأرقام النثرية تحيل للأساس |
| ARCH-F008 | صفوف سجل تاريخية لملفات محذوفة (R7-5 وغيرها) | E-347: الصفوف تبقى بلاحظة «تاريخي» | قارئ السجل يميز الحي من التاريخي بالملاحظات فقط. **منخفض (توثيق)** | [استنتاج] عرف قائم ومعلن؛ لا فعل ضروري |
| ARCH-F009 | ستة أبواب تحمل رمز نوع بلا مستهلك حي | E-374: parties/activity/financial-pulse/follow-up/cost/estimates | سطح ميت تقريبًا. **منخفض** | WP-A3-7. القبول: تقليص الأساس بنفس الـPR |
| ARCH-F010 | انحراف بيئة Node بين CI (22.23.3) والمحلي (24) | E-055 [تشغيل]: البناء والميزانيات نجحت هنا على 24؛ ADR-018 يوثق الانحراف | قياسات الميزانية حساسة للإصدار؛ أُعيد إنتاجها بنجاح هنا. **منخفض (مراقبة)** | [استنتاج] الاستمرار بالتثبيت الحالي للأسس لكل بيئة |
| ARCH-F011 | عبء الوثائق الحوكمية الضخم (665 ملفًا بترتيب قراءة مفروض) | E-370/E-384: 43 عقدًا + ADRs + control (94 عنصرًا/41 Workstream) + فهارس | ملاحة أولى لكل مهمة عبر AGENTS §2 إلزامية — ناجحة لكنها تكلفة دخول حقيقية لأي مهندس/وكيل جديد. **منخفض (تصميم مقصود)** | [استنتاج] لا فعل؛ يوثق كلفتها للمالك |

---

## 12. فهرس الأدلة البنيوية المفتاحية

| المعرف | الواقع (المسار عند `fd5d7ce`) |
|---|---|
| E-301/E-302 | شجرة الجذر + تركيبة `pnpm check` الـ12 مرحلة (`package.json:22`) |
| E-303..E-310 | `eslint.config.js` — قواعد النقاء والمال وحدود الواجهة/التطبيق/التخزين + سقف lint ‏37/35 |
| E-311..E-318 | `scripts/check-module-boundaries.mjs` + أسسان JSON — R1..R9 بأرقامها المجمدة (17/52/19/2 + 129 حافة بيت) |
| E-319/E-320 | حارسا الدورات (تارجان) — أساس صفر قيمي + SCC نوعي واحد |
| E-321..E-334 | حراس القراءة/الأبواب/الزمن/التواريخ/التصريحات/المستمعين/التشخيصات/التسميات/الحوارات/الأحجام/السجلات/الكيانات + الاختبار الذاتي للحدود |
| E-335/E-055/E-056 | ميزانيتا الحزمة 650,000/155,300 + التنفيذ هنا 630,709/154,928 وlint ‏35 [تشغيل] |
| E-336..E-343 | سلسلة الإقلاع + المنافذ + 36 بيتًا/29 بابًا/53 خدمة/46 حقل حقن |
| E-344/E-345 | 18 عائلة مجال + منفذ التخزين ومنافذ القدرات |
| E-346/E-347 | تحقق git لتقاعد ARCH-012 وإزالة R7-5 |
| E-348..E-354 | تصنيف التكرار الكامل (المدققات/المهايئان/الشوائم/المرايا/التوحيد) |
| E-355/E-052/E-054 | جرد الاختبارات 447 ملفًا + التنفيذ الكامل هنا (952 + 2737 اختبارًا أخضر) [تشغيل] |
| E-356 | `ci.yml` — إجراءات مثبتة SHA، Node 22.23.3، خطوة تحقق واحدة، تدقيق مع سجل استثناءات |
| E-357..E-360/E-435 | سلسلة الحراس 26 + الموجه 65 مسارًا/60 كسولًا + عقد التنقل |
| E-361..E-363 | منفذ الساعة + نواة التواريخ + زوج الإصدارات والأزواج التراثية |
| E-365..E-369/E-378/E-379 | القشرة والثيم وبوابة القفل وPWA وتركيب App والاستثناءان التشغيليان للتخزين |
| E-381/E-384/E-385 | وثيقة المعمارية + هيكل operations + المخازن غير السلطوية |
| E-444/E-445/E-446 | تحقق A4 المستقل للأرقام المجمدة والدورات وأحجام الملفات (wc -l) |

**إجمالي أدلة التدقيق (جرد V2 المصحح — RPT-05/E-075؛ وجرد V3 — COR-03/E-079)**: **290 معرفًا فريدًا معرّفًا فعليًا** لنسخة V1 (القائد 17، A1 ‏84 — نطاقها المعلن 86 لكن E-109/E-123 لم يعرَّفا قط في ملاحظات العمل، A2 ‏48، A3 ‏85، A4 ‏56) + 10 معرفات تحقق لجولة V2 ‏(E-067..E-076) + 9 تعريفات بتحقق مباشر لجولة V3 للمعرفات التي كانت مستشهدًا بها بلا تعريف (E-111..E-117 وE-172 وE-174) + 3 تحققات قائد لجولة V3 ‏(E-077..E-079) = **312 عبر النسخ الثلاث**؛ رقم V1 «275» كان يجمع النطاقات المعلنة للوكلاء الأربعة (86+48+85+56) ثم يدرج الـ17 في القوس نفسه. فهرس الحامل الكبير أعلاه؛ والفهرس الكامل القابل للفحص لكل معرف مستشهد به في التقريرين في التقرير 1 §9.2. الملاحظات التفصيلية للوكلاء ملفات عمل خاصة لم تُنشر.

**خاتمة**: بُنية Micro الحالية متماسكة ومفروضة آليًا إلى درجة استثنائية، وبقايا إعادة الهيكلة فيها معلنة ومسعورة لا صامتة، والديون البنيوية مسجلة بخطط خروج قابلة للقياس. لم يتغير أي ملف في Micro خلال هذا التدقيق (شجرة نظيفة عند `fd5d7ce`)؛ وكل «نجاح» مذكور هنا إما مصدري مثبت أو منفذ فعلي في بيئة معزولة موثقة (التقرير 1 §2.4). أي تعديل مستقبلي يتبع دليل §8 ويصطدم بحراسه عند أول `pnpm check`. وأعيد التحقق في جولتي التصحيح V2 وV3 بالتاريخ نفسه: `origin/main` = `fd5d7ce` بلا انحراف في كل مرة (E-074/E-079).
