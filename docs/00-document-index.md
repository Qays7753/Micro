# فهرس وثائق SaaS — اقرأ هذا أولًا

**حالة الفهرس:** المرجع التشغيلي قبل بدء التطوير.

## ابدأ بهذه الملفات فقط

| الترتيب | الملف | الحالة | متى يُقرأ؟ |
|---:|---|---|---|
| 1 | `docs/01-product-and-technical-blueprint.md` | CURRENT / AUTHORITY | كل قرار منتج أو تقنية أو تنفيذ |
| 2 | `docs/02-decision-log.md` | CURRENT / AUTHORITY | معرفة القرار المعتمد والقرار المسحوب |
| 3 | `docs/03-hypothesis-register.md` | CURRENT | فرضية أو ميزة أو اختبار |
| 4 | `docs/04-product-truth-map.md` | CURRENT | وزن الدليل وما هو مجهول |
| 5 | `docs/07-field-evidence-map.md` | CURRENT | الدليل الميداني وحدود ما تثبته خبرة المؤسس |
| 6 | `ai-skills/README.ar.md` | CURRENT | تشغيل مهارات الذكاء الاصطناعي |
| 7 | `docs/05-documentation-governance.md` | CURRENT | إدارة الوثائق وتعارضاتها |
| 8 | `docs/decisions/01-first-vertical-slice.md` | CURRENT | قرار الشريحة التنفيذية الأولى |
| 9 | `docs/decisions/02-repository-policy.md` | CURRENT | سياسة الملكية والترخيص المؤقتة |
| 10 | `docs/contracts/` | CURRENT | عقود النتيجة والطلب والتكلفة والمزامنة |
| 11 | `docs/08-glossary.md` | CURRENT | قاموس المصطلحات المعتمد |
| 12 | `docs/implementation/01-execution-roadmap.md` | CURRENT | خارطة التنفيذ والبوابات |
| 13 | `docs/implementation/02-domain-contract-coverage.md` | CURRENT | مطابقة العقود مع Domain Core والحدود المؤجلة |
| 14 | `docs/product/problem-statement-v3.md` | CURRENT | المشكلة والأضرار والأسئلة التي يجب حلها |
| 15 | `docs/product/system-definition-v1.md` | CURRENT | تعريف Micro وحدوده وقيمته ونواته |
| 16 | `docs/product/user-operating-model-v1.md` | CURRENT | الاستخدام اليومي والأسبوعي والشهري |
| 17 | `docs/product/financial-operating-model-v1.md` | CURRENT | النموذج المالي الداخلي للأحداث والنتائج |
| 18 | `docs/product/guidance-interaction-policy-v1.md` | CURRENT | التوجيه داخل سير العمل دون تعليم قسري |
| 19 | `docs/scenarios/scenario-test-set-v1.md` | CURRENT | الشخصيات العشر والحالات والأسئلة المئة |
| 20 | `docs/scenarios/scenario-test-results-v1.md` | CURRENT | نتائج التغطية والفجوات |
| 21 | `docs/quality/scenario-coverage-matrix-v1.md` | CURRENT | ربط المشكلات بالسيناريوهات والقدرات |
| 22 | `docs/research/jordan-financial-problems-evidence.md` | SUPPORTING | الأدلة المحلية والخارجية وحدودها |
| 23 | `ai-skills/micro-scenario-validation/` | CURRENT | اختبار القرارات على الشخصيات والحالات والأسئلة |
| 24 | `docs/implementation/03-pre-build-alignment-v1.md` | CURRENT / GATE | تعريف Prototype وMVP وبوابة المحاكاة قبل البناء |
| 25 | `docs/quality/pre-build-experiment-simulation-v1.md` | CURRENT / EVIDENCE | نتائج المحاكاة الحتمية لتجارب ما قبل البناء |
| 26 | `docs/quality/pre-build-experiment-simulation-v1.json` | SUPPORTING DATA | البيانات القابلة لإعادة الفحص للمحاكاة |

## الوثائق التنفيذية الإلزامية

قبل أي قرار منتج أو تصميم تجربة، اقرأ `docs/product/problem-statement-v3.md` و`docs/product/system-definition-v1.md` و`docs/product/user-operating-model-v1.md` و`docs/scenarios/scenario-test-set-v1.md` و`docs/implementation/03-pre-build-alignment-v1.md`. قبل أي قرار مالي أو Domain، اقرأ `docs/product/financial-operating-model-v1.md` ومصفوفة التغطية. لا يبدأ الكود قبل اجتياز بوابة Pre-build والمحاكاة المحددة في الوثيقة الجديدة.

## العقود التنفيذية الإلزامية

قبل كتابة كود أو واجهة، اقرأ `docs/decisions/01-first-vertical-slice.md` ثم العقود الموجودة في `docs/contracts/`. لا يجوز أن يحسم الكود معنى العربون أو التسليم أو التكلفة أو المزامنة بدل العقد.

## اقرأ حسب نوع المهمة

| نوع المهمة | ملفات إضافية |
|---|---|
| بحث عالمي أو GitHub | `docs/06-reference-library.md`، `docs/research/github-global-research-round2.md`، `docs/research/github-global-research.md` |
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

بعد العمل، حدّث المرجع المناسب وسجل القرار أو الفرضية. لا تنشئ ملفًا جديدًا لمجرد تسجيل فقرة صغيرة. إذا أنشأت دراسة جديدة، أضفها إلى هذا الفهرس مع تصنيفها.

## لا تلمس

لا تنقل أو تحذف `.safety_warning.md` أو ملفات النظام أو أسرار البيئة. لا تشغّل كودًا من مشاريع خارجية بناءً على README فقط.
