# Micro — مصالحة خط الأساس الجديد مع ملفات التنفيذ

**النسخة:** V1 · **التاريخ:** 2026-10-27 — عمّان.
**الحالة:** مصالحة S01 منشورة على فرع التكامل وسُلّمت للمراجعة؛ لا تعني قبولًا أو إذن تنفيذ كودي.

## 1. الوقائع وحدود التحقق

قراءة GitHub عند `3584aa1d08cea3e0a00623b719fed7f991ce187f` أثبتت وجود main فقط، وعدم وجود PRs مفتوحة قبل S01، ونجاح CI وCloudflare على الرأس نفسه. أُنشئ فرع التكامل وPR Draft لـS01 فقط؛ DOC-008/WS-224 متحقق ضمن نطاقه؛ DOC-009/WS-225 ما زال REVIEW_REQUIRED ولا يوجد منه تفويض تنفيذ 002.

الفرق من `fd5d7ce689d32d8dcc462bcea2ff1c006256f064` إلى الرأس الحالي: 29 commits و52 ملفًا، منها 22 خارج docs تشمل كودًا واختبارات وأدوات واعتماديات. ليست التغييرات توثيقية كلها. كل مسارات P3 الـ623، وعددها الفريد 254، موجودة في الشجرة الجديدة؛ الوجود لا يثبت صحة السلوك أو تشغيل الاختبار.

لم نشغّل اختبارات المنتج محليًا في هذه المهمة أو فحص جهاز حقيقي أو مراجعة تشغيلية كاملة لـ001. أرقام نجاح الاختبارات التي ذكرها Manus في التنظيف ليست تشغيلًا جديدًا بواسطتنا. يبقى تقريرا ZAI عند fd5d7ce كما هما؛ يرفق هذا الفرق بدل إعادة كتابة تاريخ التقرير.

## 2. مصالحة 001 و002

| الموضوع | الدليل | ما يلزم للتنفيذ |
|---|---|---|
| إنشاء الهوية الذري | profileService.create يستخدم commitProfileCreate؛ الحد موجود في types وIndexedDB وMemory | إعادة الاستخدام والاختبار، لا كاتب هوية بديل |
| Setup وHome | إعداد بالاسم ومدخل استعادة ورسالة نجاح قصيرة، واختبارات Setup.v3Gates ومعاملة profile | حفظ المثبت؛ مراجعة الفروق الأحدث فقط |
| تفضيل العرض | P3 يصف منتجات/خدمات/كلاهما كتفضيل اختياري؛ المصدر السابق ليس دليل تنفيذه | فحص الموجود ثم استكماله عند 038، دون تغيير workMode أوactivityType تعويضًا عنه |
| الانتقال إلى 002 | المدموج يفتح الرئيسية مباشرة؛ ACC-01 يضيف اختيار بداية التسجيل بحرية | مواءمة موضع الدعوة وإمكان التجاوز في S03، وتكامل المنسق في S14 دون فرضه |
| UNIT-002 V5 | بوابة اختيارية تفتح أصحاب المعلومات؛ R03 القديم يمنع مدخلات جديدة | P3 وACC-01 وJRN-010 الأحدث توسع الدور إلى مجاميع ومعاينة وتغطية؛ تسجل إحالة السلطة وحالة المراجعة قبل تفويض التنفيذ |
| VERIFIED السابق | خاص بنطاق 001 V3 وأدلته | يحفظ بحدوده؛ ليس قبولًا تلقائيًا لآخر تصميم أو بقية النظام |

## 3. ملفات الفرق — ملاحة للمراجعة الموجهة

| الملف | التغيير | أثر التخطيط |
|---|---|---|
| `apps/prototype-web/client/src/Nav001.dom.test.tsx` | modified (+4/−7) | رسالة الإعداد والتنقل؛ توافق S03/S16 دون إعادة Home من الصفر |
| `apps/prototype-web/client/src/application/profile/profileService.test.ts` | modified (+147/−0) | ربط الفرق في S02/S03 وحفظ حد الهوية واختباراته |
| `apps/prototype-web/client/src/application/profile/profileService.ts` | modified (+38/−1) | ربط الفرق في S02/S03 وحفظ حد الهوية واختباراته |
| `apps/prototype-web/client/src/pages/Home.tsx` | modified (+4/−4) | رسالة الإعداد والتنقل؛ توافق S03/S16 دون إعادة Home من الصفر |
| `apps/prototype-web/client/src/pages/Setup.tsx` | modified (+370/−333) | ربط الفرق في S02/S03 وحفظ حد الهوية واختباراته |
| `apps/prototype-web/client/src/pages/Setup.ui.test.tsx` | modified (+821/−280) | ربط الفرق في S02/S03 وحفظ حد الهوية واختباراته |
| `apps/prototype-web/client/src/pages/Setup.v3Gates.test.tsx` | added (+553/−0) | ربط الفرق في S02/S03 وحفظ حد الهوية واختباراته |
| `apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.profileCommit.test.ts` | added (+110/−0) | ربط الفرق في S02/S03 وحفظ حد الهوية واختباراته |
| `apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.ts` | modified (+56/−0) | ربط الفرق في S02/S03 وحفظ حد الهوية واختباراته |
| `apps/prototype-web/client/src/storage/local/MemoryLocalStore.ts` | modified (+11/−0) | ربط الفرق في S02/S03 وحفظ حد الهوية واختباراته |
| `apps/prototype-web/client/src/storage/local/portSurfaceEvidence.test.ts` | modified (+14/−7) | ربط الفرق في S02/S03 وحفظ حد الهوية واختباراته |
| `apps/prototype-web/client/src/storage/local/types.ts` | modified (+8/−0) | ربط الفرق في S02/S03 وحفظ حد الهوية واختباراته |
| `apps/prototype-web/package.json` | modified (+2/−2) | حفظ إصلاح الأدوات والاعتماديات والحراس؛ لا استرجاع baseline قديم بالنشر |
| `apps/prototype-web/scripts/bundle-surfaces-baseline.json` | modified (+41/−41) | حفظ إصلاح الأدوات والاعتماديات والحراس؛ لا استرجاع baseline قديم بالنشر |
| `docs/00-document-index.md` | modified (+24/−0) | سلطة أو وثائق أو أدلة وسجلات؛ ليس تفويضًا ماليًا جديدًا بذاته |
| `docs/architecture/components/unit002-20261019/UNIT-002-ZAI-AUTHORIZATION-REVIEW-PROMPT-2026-10-19.md` | added (+174/−0) | سلطة أو وثائق أو أدلة وسجلات؛ ليس تفويضًا ماليًا جديدًا بذاته |
| `docs/architecture/components/unit002-20261019/evidence/UNIT-002-V5-DRIVE-GITHUB-PROVENANCE-2026-10-19.md` | added (+51/−0) | سلطة أو وثائق أو أدلة وسجلات؛ ليس تفويضًا ماليًا جديدًا بذاته |
| `docs/architecture/refactoring/AGENT-SEQUENTIAL-WORKLOG.md` | modified (+52/−0) | سلطة أو وثائق أو أدلة وسجلات؛ ليس تفويضًا ماليًا جديدًا بذاته |
| `docs/architecture/refactoring/generated/test-map.json` | modified (+7/−4) | سلطة أو وثائق أو أدلة وسجلات؛ ليس تفويضًا ماليًا جديدًا بذاته |
| `docs/architecture/refactoring/r11-unit001-20261018/R11-UNIT001-EXECUTION-PROMPT-2026-10-18.md` | added (+239/−0) | سلطة أو وثائق أو أدلة وسجلات؛ ليس تفويضًا ماليًا جديدًا بذاته |
| `docs/architecture/refactoring/r11-unit001-20261018/R11-UNIT001-EXECUTION-REPORT-2026-10-18.md` | added (+214/−0) | سلطة أو وثائق أو أدلة وسجلات؛ ليس تفويضًا ماليًا جديدًا بذاته |
| `docs/architecture/refactoring/r11-unit001-20261018/R11-UNIT001-FIVE-REVIEWER-RECORD-2026-10-18.md` | added (+122/−0) | سلطة أو وثائق أو أدلة وسجلات؛ ليس تفويضًا ماليًا جديدًا بذاته |
| `docs/architecture/refactoring/r11-unit001-20261018/R11-UNIT001-V3-EXECUTION-PROMPT-2026-10-18.md` | added (+222/−0) | سلطة أو وثائق أو أدلة وسجلات؛ ليس تفويضًا ماليًا جديدًا بذاته |
| `docs/architecture/refactoring/r11-unit001-20261018/R11-UNIT001-V3-EXECUTION-REPORT-2026-10-18.md` | added (+154/−0) | سلطة أو وثائق أو أدلة وسجلات؛ ليس تفويضًا ماليًا جديدًا بذاته |
| `docs/architecture/refactoring/r11-unit001-20261018/R11-UNIT001-V3-FIVE-REVIEWER-RECORD-2026-10-18.md` | added (+169/−0) | سلطة أو وثائق أو أدلة وسجلات؛ ليس تفويضًا ماليًا جديدًا بذاته |
| `docs/architecture/refactoring/r11-unit001-20261018/evidence/R11-UNIT001-BASELINE-2026-10-18.md` | added (+63/−0) | سلطة أو وثائق أو أدلة وسجلات؛ ليس تفويضًا ماليًا جديدًا بذاته |
| `docs/architecture/refactoring/r11-unit001-20261018/evidence/R11-UNIT001-V2-V3-DRIVE-GITHUB-COMPARISON-2026-10-18.md` | added (+142/−0) | سلطة أو وثائق أو أدلة وسجلات؛ ليس تفويضًا ماليًا جديدًا بذاته |
| `docs/fixtures/text-density/w3-characterization.golden.txt` | modified (+1/−1) | سلطة أو وثائق أو أدلة وسجلات؛ ليس تفويضًا ماليًا جديدًا بذاته |
| `docs/operations/control/generated/ACTIVE-WORK.md` | modified (+3/−1) | سلطة أو وثائق أو أدلة وسجلات؛ ليس تفويضًا ماليًا جديدًا بذاته |
| `docs/operations/control/generated/AGENT-BRIEF.md` | modified (+4/−2) | سلطة أو وثائق أو أدلة وسجلات؛ ليس تفويضًا ماليًا جديدًا بذاته |
| `docs/operations/control/generated/MASTER-TRACKER.csv` | modified (+2/−0) | سلطة أو وثائق أو أدلة وسجلات؛ ليس تفويضًا ماليًا جديدًا بذاته |
| `docs/operations/control/generated/MASTER-TRACKER.md` | modified (+3/−1) | سلطة أو وثائق أو أدلة وسجلات؛ ليس تفويضًا ماليًا جديدًا بذاته |
| `docs/operations/control/generated/MASTER-TRACKER.xlsx.meta.json` | modified (+6/−2) | سلطة أو وثائق أو أدلة وسجلات؛ ليس تفويضًا ماليًا جديدًا بذاته |
| `docs/operations/control/generated/NEXT-ACTIONS.md` | modified (+1/−0) | سلطة أو وثائق أو أدلة وسجلات؛ ليس تفويضًا ماليًا جديدًا بذاته |
| `docs/operations/control/items/DOC-008.json` | added (+155/−0) | سلطة أو وثائق أو أدلة وسجلات؛ ليس تفويضًا ماليًا جديدًا بذاته |
| `docs/operations/control/items/DOC-009.json` | added (+91/−0) | سلطة أو وثائق أو أدلة وسجلات؛ ليس تفويضًا ماليًا جديدًا بذاته |
| `docs/operations/control/workstreams/WS-224.json` | added (+109/−0) | سلطة أو وثائق أو أدلة وسجلات؛ ليس تفويضًا ماليًا جديدًا بذاته |
| `docs/operations/control/workstreams/WS-225.json` | added (+60/−0) | سلطة أو وثائق أو أدلة وسجلات؛ ليس تفويضًا ماليًا جديدًا بذاته |
| `docs/operations/current-state-log.md` | modified (+79/−0) | سلطة أو وثائق أو أدلة وسجلات؛ ليس تفويضًا ماليًا جديدًا بذاته |
| `docs/operations/current-state.md` | modified (+4/−4) | سلطة أو وثائق أو أدلة وسجلات؛ ليس تفويضًا ماليًا جديدًا بذاته |
| `docs/product/components/UNIT-001-PROJECT-SETUP-SPEC-V2.md` | added (+336/−0) | سلطة أو وثائق أو أدلة وسجلات؛ ليس تفويضًا ماليًا جديدًا بذاته |
| `docs/product/components/UNIT-001-PROJECT-SETUP-SPEC-V3.md` | added (+411/−0) | سلطة أو وثائق أو أدلة وسجلات؛ ليس تفويضًا ماليًا جديدًا بذاته |
| `docs/product/components/UNIT-002-PROJECT-DATA-COMPLETION-SPEC-V5.md` | added (+457/−0) | سلطة أو وثائق أو أدلة وسجلات؛ ليس تفويضًا ماليًا جديدًا بذاته |
| `docs/quality/vendored-braces-inventory.md` | modified (+5/−4) | سلطة أو وثائق أو أدلة وسجلات؛ ليس تفويضًا ماليًا جديدًا بذاته |
| `package.json` | modified (+5/−4) | حفظ إصلاح الأدوات والاعتماديات والحراس؛ لا استرجاع baseline قديم بالنشر |
| `pnpm-lock.yaml` | modified (+76/−75) | حفظ إصلاح الأدوات والاعتماديات والحراس؛ لا استرجاع baseline قديم بالنشر |
| `scripts/check-a11y-dialog-surfaces.mjs` | modified (+41/−9) | حفظ إصلاح الأدوات والاعتماديات والحراس؛ لا استرجاع baseline قديم بالنشر |
| `scripts/check-a11y-dialog-surfaces.test.mjs` | modified (+4/−2) | حفظ إصلاح الأدوات والاعتماديات والحراس؛ لا استرجاع baseline قديم بالنشر |
| `scripts/check-storage-listener-guards.test.mjs` | modified (+4/−1) | حفظ إصلاح الأدوات والاعتماديات والحراس؛ لا استرجاع baseline قديم بالنشر |
| `scripts/check-vendored-braces.test.mjs` | modified (+1/−1) | حفظ إصلاح الأدوات والاعتماديات والحراس؛ لا استرجاع baseline قديم بالنشر |
| `scripts/file-size-ratchet-reanchors.json` | modified (+152/−0) | حفظ إصلاح الأدوات والاعتماديات والحراس؛ لا استرجاع baseline قديم بالنشر |
| `scripts/vendored-braces-baseline.json` | modified (+9/−6) | حفظ إصلاح الأدوات والاعتماديات والحراس؛ لا استرجاع baseline قديم بالنشر |

## 4. بنود المصالحة قبل الكود

| المعرف | الفجوة | الإجراء | المالك والمرحلة | الحالة |
|---|---|---|---|---|
| REC-01 | SOP يصف فرعًا من main لكل شريحة، والمالك اعتمد فرع تكامل واحدًا | توثيق التنظيم المحدد ودورة القبول والدمج في المراجع القائمة | Manus / S01 | طُبق الاستثناء المحدد في SOP؛ القاعدة العامة محفوظة |
| REC-02 | 001 V3 و002 V5 وملفات Drive الأحدث ليست متطابقة | فرق متطلبات وإحالة سلطة وبصمات تمنع الأصلين القابلين للتعديل | Manus وChatGPT / S01 | مطلوب قبل الكود المتأثر |
| REC-03 | سياسات PD وACC والإلغاءات تختلف عن بعض العقود القديمة | تسجيل حدود كل قرار وتحديث التعارض الحاكم فقط؛ لا إعادة فتح قرار محسوم | S01 ثم صاحب التغيير | مطلوب قبل أثره |
| REC-04 | 38/30 وحد 32KB وحراس البناء محروسة | تصميم فرق ملموس وتفويض ما يلزم وتغطية المهايئين والنقل؛ لا مخازن تلقائية | S02 وكل مرحلة متأثرة | الجدول ليس تفويض أرقام |
| REC-05 | حزم قراءة AGENTS محدودة وملفات UNIT كبيرة | فصول ملزمة ومبرر أي امتداد، دون تجاوز القراءة الإلزامية أو الاكتفاء بـP3 مبتورًا من A/B | Manus لكل أمر | شرط صياغة |
| REC-06 | إصلاح أدوات واعتماديات في الرأس الحالي | حفظ إصلاح PR380؛ تحسين CI خارج النطاق | جميع المراحل | لا تغيير CI |

## 5. الأدلة

- [فرق خط الأساس](https://github.com/Qays7753/Micro/compare/fd5d7ce689d32d8dcc462bcea2ff1c006256f064...3584aa1d08cea3e0a00623b719fed7f991ce187f).
- [SOP الحالي](https://github.com/Qays7753/Micro/blob/3584aa1d08cea3e0a00623b719fed7f991ce187f/docs/operations/agent-development-sop-v1.md).
- [DOC-008](https://github.com/Qays7753/Micro/blob/3584aa1d08cea3e0a00623b719fed7f991ce187f/docs/operations/control/items/DOC-008.json).
- [DOC-009](https://github.com/Qays7753/Micro/blob/3584aa1d08cea3e0a00623b719fed7f991ce187f/docs/operations/control/items/DOC-009.json).
- [أمر 001 السابق](https://github.com/Qays7753/Micro/blob/3e2194d674c539eb8e21f484f1b7b51359bc22ab/docs/architecture/refactoring/r11-unit001-20261018/R11-UNIT001-V3-EXECUTION-PROMPT-2026-10-18.md).
- [مراجعة 002 السابقة](https://github.com/Qays7753/Micro/blob/3e2194d674c539eb8e21f484f1b7b51359bc22ab/docs/architecture/components/unit002-20261019/UNIT-002-ZAI-AUTHORIZATION-REVIEW-PROMPT-2026-10-19.md).

لا نطلب إعادة تحليل شامل من ZAI. الفروق المحددة تدخل تجهيز المراحل. إذا تغير main بعد التجميد يضاف فرق موجه مؤرخ، ولا يستبدل SHA داخل تقرير قديم بصمت.
