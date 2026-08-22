# فهرس وثائق SaaS — اقرأ هذا أولًا

**حالة الفهرس:** المرجع التشغيلي قبل الانتقال إلى Prototype المرحلة 2.

## ابدأ بهذه الملفات فقط

| الترتيب | الملف | الحالة | متى يُقرأ؟ |
|---:|---|---|---|
| 0 | `AGENTS.md` | CURRENT / ENTRY POINT | نقطة الدخول الأولى وترتيب القراءة والقواعد غير القابلة للكسر |
| 1 | `docs/01-product-and-technical-blueprint.md` | CURRENT / AUTHORITY | كل قرار منتج أو تقنية أو تنفيذ |
| 2 | `docs/02-decision-log.md` | CURRENT / AUTHORITY | معرفة القرار المعتمد والقرار المسحوب |
| 3 | `docs/03-hypothesis-register.md` | CURRENT | فرضية أو ميزة أو اختبار |
| 4 | `docs/04-product-truth-map.md` | CURRENT | وزن الدليل وما هو مجهول |
| 5 | `docs/07-field-evidence-map.md` | CURRENT | الدليل الميداني وحدود ما تثبته خبرة المؤسس |
| 6 | `ai-skills/README.ar.md` | CURRENT | تشغيل مهارات الذكاء الاصطناعي |
| 7 | `docs/05-documentation-governance.md` | CURRENT | إدارة الوثائق وتعارضاتها |
| 8 | `docs/decisions/01-first-vertical-slice.md` | CURRENT | قرار الشريحة التنفيذية الأولى |
| 9 | `docs/decisions/02-repository-policy.md` | CURRENT | سياسة الملكية والترخيص المؤقتة |
| 10 | `docs/decisions/03-scenario-validation-and-system-scope.md` | CURRENT | قرار مجموعة السيناريوهات وحدود النظام |
| 11 | `docs/contracts/` | CURRENT | عقود النتيجة والطلب والتكلفة والمزامنة وسياسات المال P0، ومنها `05-financial-p0-policies.md` |
| 12 | `docs/08-glossary.md` | CURRENT | قاموس المصطلحات المعتمد |
| 13 | `docs/implementation/01-execution-roadmap.md` | CURRENT | خارطة التنفيذ والبوابات |
| 14 | `docs/implementation/02-domain-contract-coverage.md` | CURRENT | مطابقة العقود مع Domain Core والحدود المؤجلة |
| 15 | `docs/product/problem-statement-v3.md` | CURRENT | المشكلة والأضرار والأسئلة التي يجب حلها |
| 16 | `docs/product/system-definition-v1.md` | CURRENT | تعريف Micro وحدوده وقيمته ونواته |
| 17 | `docs/product/user-operating-model-v1.md` | CURRENT | الاستخدام اليومي والأسبوعي والشهري |
| 18 | `docs/product/financial-operating-model-v1.md` | CURRENT | النموذج المالي الداخلي للأحداث والنتائج |
| 19 | `docs/product/guidance-interaction-policy-v1.md` | CURRENT | التوجيه داخل سير العمل دون تعليم قسري |
| 20 | `docs/scenarios/scenario-test-set-v1.md` | CURRENT | الشخصيات العشر والحالات والأسئلة المئة |
| 21 | `docs/scenarios/scenario-test-results-v1.md` | CURRENT | نتائج التغطية والفجوات |
| 22 | `docs/quality/scenario-coverage-matrix-v1.md` | CURRENT | ربط المشكلات بالسيناريوهات والقدرات |
| 23 | `docs/research/jordan-financial-problems-evidence.md` | SUPPORTING | الأدلة المحلية والخارجية وحدودها |
| 24 | `ai-skills/micro-scenario-validation/` | CURRENT | اختبار القرارات على الشخصيات والحالات والأسئلة |
| 25 | `docs/implementation/03-pre-build-alignment-v1.md` | CURRENT / GATE | تعريف المراحل وبوابة المحاكاة قبل البناء |
| 26 | `docs/quality/pre-build-experiment-simulation-v1.md` | CURRENT / EVIDENCE | نتائج المحاكاة الحتمية لتجارب ما قبل البناء |
| 27 | `docs/quality/pre-build-experiment-simulation-v1.json` | SUPPORTING DATA | البيانات القابلة لإعادة الفحص للمحاكاة |
| 28 | `docs/research/global-build-reference-library-v1.md` | CURRENT / RESEARCH AUTHORITY | المعرفة العالمية المحفوظة والمفاهيم والتراخيص وقرارات build/study/defer/reject |
| 29 | `docs/research/micro-build-logic-v1.md` | CURRENT / BUILD LOGIC | تحويل المصادر إلى منطق Domain وUX وPrototype ومراحل البناء اللاحقة |
| 30 | `docs/quality/simulated-first-read-cloud-code-v1.md` | CURRENT / QUALITY REVIEW | محاكاة قراءة Agent جديد وحدود ما يفهمه قبل القراءة الفعلية لـCloud Code |
| 31 | `docs/quality/cloud-code-first-read-findings-v1.md` | CURRENT / QUALITY REVIEW | نتائج قراءة Cloud Code الفعلية والتحقق من ملاحظاتها |

## الوثائق التنفيذية الإلزامية

قبل أي قرار منتج أو تصميم تجربة، اقرأ `docs/product/problem-statement-v3.md` و`docs/product/system-definition-v1.md` و`docs/product/user-operating-model-v1.md` و`docs/scenarios/scenario-test-set-v1.md` و`docs/implementation/03-pre-build-alignment-v1.md`. قبل أي قرار مالي أو Domain، اقرأ `docs/product/financial-operating-model-v1.md` و`docs/contracts/05-financial-p0-policies.md` ومصفوفة التغطية. لا يبدأ الكود قبل اجتياز بوابة Pre-build وقراءة `docs/quality/pre-build-experiment-simulation-v1.md` وبياناتها.

## العقود التنفيذية الإلزامية

قبل كتابة كود أو واجهة، اقرأ `docs/decisions/01-first-vertical-slice.md` ثم العقود الموجودة في `docs/contracts/`، وبالأخص `docs/contracts/05-financial-p0-policies.md` عند أي نتيجة أو تكلفة أو سعر أو مصروف. لا يجوز أن يحسم الكود معنى العربون أو التسليم أو التكلفة أو المزامنة بدل العقد.

## اقرأ حسب نوع المهمة

| نوع المهمة | ملفات إضافية |
|---|---|
| بحث عالمي أو GitHub | `docs/research/global-build-reference-library-v1.md` ثم `docs/research/micro-build-logic-v1.md`؛ وللتاريخ `docs/06-reference-library.md` وملفات البحث السابقة |
| تكلفة وربح وطلبات | مراجع `ai-skills/microbusiness-finance-operations/` داخل المستودع |
| كود وأمن ومزامنة ونشر | مراجع `ai-skills/saas-delivery-verifier/` داخل المستودع |
| قرار UX أو MVP | `docs/decisions/01-first-vertical-slice.md` ثم مراجع `ai-skills/saas-product-guardian/` و`ai-skills/micro-scenario-validation/` داخل المستودع |
| تغيير المفهوم أو النموذج المالي أو التدفق | `docs/scenarios/scenario-test-set-v1.md` و`docs/quality/scenario-coverage-matrix-v1.md` و`docs/quality/pre-build-experiment-simulation-v1.md` ثم `ai-skills/micro-scenario-validation/` |
| تنفيذ Domain Core أو Prototype | `docs/implementation/01-execution-roadmap.md` و`docs/implementation/03-pre-build-alignment-v1.md` والعقود ثم `ai-skills/saas-delivery-verifier/` |
| مراجعة Accounting أو zman-app | افتح المرجع الحالي أولًا، ثم ملف الحالة المطلوب فقط |

## ملفات داعمة غير سلطوية

`docs/research/architecture-and-stack-decision.md`، `docs/research/architecture-decision-reassessment.md`، `docs/research/architecture-decision-matrix.md`، `docs/research/order-tracking-case-study.md`، وملفات المهارات داخل `ai-skills/`. أما الوثائق canonical الجديدة داخل `docs/product/` و`docs/scenarios/` و`docs/quality/` فهي CURRENT ويجب عدم معاملتها كدراسات داعمة.

هذه الملفات مفيدة عند الحاجة، لكن خلاصتها لا تتجاوز المرجع الأساسي. إذا تعارضت، سجّل التعارض ولا تختر الصياغة الأطول تلقائيًا.

## ملفات ARCHIVE/LEGACY

الأرشيف والوثائق القديمة ليست ضمن هذه الدفعة. إذا احتجت الرجوع إليها، استخدم نسخة مساحة العمل خارج المستودع فقط، ولا تعتبرها مرجعًا لبناء المنتج الجديد.

## بروتوكول بدء جلسة

اكتب في أول مخرجاتك:

> قرأت المرجع الأساسي والفهرس. المهمة هي [..]. سأستخدم [..] فقط، ولن أعتمد على ARCHIVE/LEGACY إلا لـ[..].

ثم اذكر: الفرضية أو القرار، الملفات التي ستتغير، معيار القبول، وما بقي مجهولًا.

## بروتوكول الإغلاق

بعد العمل، حدّث المرجع المناسب وسجل القرار أو الفرضية. لا تنشئ ملفًا جديدًا لمجرد تسجيل فقرة صغيرة. إذا أنشأت دراسة جديدة، أضفها إلى هذا الفهرس مع تصنيفها. عند بحث مصدر عالمي، لا يكفي حفظ الرابط؛ يجب تحديث مكتبة المصادر ومنطق البناء أو تسجيل سبب عدم الاعتماد.

## لا تلمس

لا تنقل أو تحذف `.safety_warning.md` أو ملفات النظام أو أسرار البيئة. لا تشغّل كودًا من مشاريع خارجية بناءً على README فقط.
