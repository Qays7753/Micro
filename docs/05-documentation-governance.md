# حوكمة وثائق مشروع SaaS

**الإصدار:** 1.2 — بعد تثبيت Web-first Prototype وBuild Charter

## 1. قاعدة السلطة

لا يوجد ملف واحد يتغلب على كل المجالات. تُستخدم سلطة مجالّية صريحة:

| المجال | المرجع الحاكم |
|---|---|
| معنى التكلفة والسعر والربح والكاش والقبض والتسوية | العقود والسياسات المالية في `docs/contracts/`، وبالأخص `05-financial-p0-policies.md` |
| هوية Micro وProblem Statement والمعمارية التجارية | `docs/01-product-and-technical-blueprint.md` |
| المرحلة وما يدخل التنفيذ الحالي | `docs/implementation/01-execution-roadmap.md` و`03-pre-build-alignment-v1.md` |
| المشكلة والتشغيل والتوجيه | وثائق `docs/product/` |
| تجربة الهاتف وواجهة المستخدم | `docs/product/mobile-ui-ux-reference-v1.md`، بوصفه مرجع عقد التجربة لا تنفيذًا، مع `ai-skills/micro-web-native-ux/` و`ai-skills/micro-design-system/` كإرشادات تشغيلية لا سلطة منتجية |
| نطاق وسلوك Prototype الهاتف | `docs/implementation/mobile-prototype-spec-v1.md`، بوصفه مواصفة بناء واختبار لا قدرة منفذة |
| منصة Prototype وخطة البناء | `docs/implementation/prototype-build-charter-v1.md`، بوصفه ميثاق تنفيذ يثبت Web-first وAndroid-like وPWA-ready وCloudflare وخطة الشرائح، ولا يتغلب على العقود |
| تحويل المصادر إلى قرارات بناء | `docs/research/micro-build-logic-v1.md` ثم المكتبة العالمية |
| تشغيل مهارات الوكلاء | `ai-skills/README.ar.md` والمهارات المتخصصة، مع بقاء الوثائق والعقود مصدر الحقيقة |
| تتبع القرارات | `docs/02-decision-log.md` |

عند وجود تعارض حقيقي، يُعتمد المرجع الحاكم في مجاله ويُسجل التعارض والملفات المتأثرة في `docs/02-decision-log.md` بدل ترك القارئ يختار بنفسه. لا يجوز للـBlueprint أن يغيّر معنى عقد مالي، ولا لعقد مالي أن يعيد تعريف هوية المنتج.

الوثائق الداعمة تشرح الدليل أو القرار لكنها لا تغيّر هوية المنتج وحدها. الأرشيف يحفظ التاريخ ولا يجوز استخدامه لبناء ميزة أو معمارية إلا إذا أعيد اعتماده صراحة.

## 2. تصنيف الملفات

| التصنيف | معنى التصنيف | طريقة القراءة |
|---|---|---|
| `CURRENT` | قرار أو قاعدة حالية | يجب قراءته عند بدء مهمة مرتبطة به |
| `SUPPORTING` | دليل أو مرجع يساند القرار | يُقرأ عند الحاجة للتحقق أو التنفيذ |
| `ARCHIVE` | وثيقة تاريخية أو مسودة أو قرار سابق | لا يُعتمد تلقائيًا |
| `LEGACY` | خاص بنظام Accounting السابق | لا يعرّف المنتج الجديد؛ يُفتح فقط للترحيل أو المقارنة |
| `RESTRICTED` | ملف نظام أو ملف لا يخص المنتج | لا يُنقل ولا يُعدل |

## 3. المرجع الحالي المختصر

| الأولوية | الملف | التصنيف | الوظيفة |
|---:|---|---|---|
| 0 | `AGENTS.md` | CURRENT / ENTRY POINT | نقطة الدخول الأولى وترتيب القراءة والقواعد غير القابلة للكسر |
| 1 | `docs/01-product-and-technical-blueprint.md` | CURRENT | Problem Statement، Product Goal، الفئات، MVP التجاري اللاحق، الطلبات، المال، SaaS، التقنية |
| 2 | `docs/03-hypothesis-register.md` | CURRENT | سجل الفرضيات ومعايير تحويل المجهول إلى قرار |
| 3 | `docs/04-product-truth-map.md` | CURRENT | ما هو مثبت ومرجح ومجهول ومصدر الدليل |
| 4 | `docs/07-field-evidence-map.md` | CURRENT | الدليل الميداني وحدود ما تثبته خبرة المؤسس |
| 5 | `docs/06-reference-library.md` | SUPPORTING | فهرس مشاريع GitHub والأنماط والتراخيص |
| 6 | `docs/research/global-build-reference-library-v1.md` | CURRENT / RESEARCH AUTHORITY | المعرفة العالمية المحفوظة، المفاهيم، المنطق، التراخيص، وقرارات build/study/defer/reject |
| 7 | `docs/research/micro-build-logic-v1.md` | CURRENT / BUILD LOGIC | تحويل المصادر إلى منطق Domain وUX وPrototype ومراحل مستقبلية |
| 8 | `ai-skills/README.ar.md` | CURRENT | طريقة تشغيل المهارات مع أي ذكاء اصطناعي |
| 9 | `docs/research/architecture-and-stack-decision.md` | SUPPORTING | مقارنة أولية للـStack؛ لا يتجاوز قرار الملف الأساسي |
| 10 | `docs/research/architecture-decision-reassessment.md` | SUPPORTING / HISTORY | سجل قرار النواة المستقلة ومبرراته التاريخية |
| 11 | `docs/research/github-global-research-round2.md` | SUPPORTING / HISTORY | تقرير البحث العالمي الثاني؛ يُقرأ لتتبع التاريخ لا كمرجع تجميعي أحدث |
| 12 | `docs/research/github-global-research.md` | SUPPORTING / HISTORY | تقرير البحث العالمي الأول؛ يُقرأ لتتبع التاريخ لا كمرجع تجميعي أحدث |
| 13 | `docs/decisions/01-first-vertical-slice.md` | CURRENT | قرار الشريحة التنفيذية الأولى |
| 14 | `docs/decisions/02-repository-policy.md` | CURRENT | سياسة الملكية والترخيص المؤقتة |
| 15 | `docs/decisions/03-scenario-validation-and-system-scope.md` | CURRENT | قرار السيناريوهات وحدود النظام |
| 16 | `docs/contracts/` | CURRENT | عقود المجال التنفيذية |
| 17 | `docs/08-glossary.md` | CURRENT | قاموس المصطلحات |
| 18 | `docs/implementation/01-execution-roadmap.md` | CURRENT | خارطة التنفيذ والبوابات |
| 19 | `docs/implementation/02-domain-contract-coverage.md` | CURRENT | مطابقة العقود مع Domain Core والحدود المؤجلة |
| 20 | `docs/implementation/03-pre-build-alignment-v1.md` | CURRENT / GATE | تعريف Prototype وMVP وبوابة المحاكاة قبل البناء |
| 21 | `docs/quality/pre-build-experiment-simulation-v1.md` | CURRENT / EVIDENCE | نتائج المحاكاة الحتمية وحدودها |
| 22 | `docs/quality/simulated-first-read-cloud-code-v1.md` | CURRENT / QUALITY REVIEW | محاكاة قراءة Agent جديد قبل القراءة الفعلية لـCloud Code |
| 23A | `docs/product/mobile-ui-ux-reference-v1.md` | CURRENT / CANONICAL / PHONE-FIRST | عقد تجربة الهاتف، المرئيات، المكونات، الحالات، والصدق المالي |
| 23B | `docs/implementation/mobile-prototype-spec-v1.md` | CURRENT / CANONICAL / PROTOTYPE | مواصفة الشاشات، الرحلات، الحالات، الربط، والحدود |
| 23C | `docs/implementation/prototype-build-charter-v1.md` | CURRENT / CANONICAL / BUILD CHARTER | قرار Web-first وAndroid-like وPWA-ready وCloudflare وخطة الشرائح وملكية المسارات |
| 23D | `ai-skills/micro-web-native-ux/` و`ai-skills/micro-design-system/` و`ai-skills/micro-local-first-prototype/` و`ai-skills/micro-prototype-qa/` | CURRENT / OPERATIONAL SKILLS | إرشادات تشغيلية متخصصة لا تستبدل الوثائق أو العقود |
| 23 | `docs/quality/cloud-code-first-read-findings-v1.md` | CURRENT / QUALITY REVIEW | نتائج القراءة الفعلية من Cloud Code والتحقق من ملاحظاتها |

## 4. ترتيب القراءة حسب المهمة

| المهمة | اقرأ أولًا | ثم اقرأ عند الحاجة |
|---|---|---|
| قرار منتج أو ميزة | الملف الأساسي + حارس المنتج | سجل الفرضيات وTruth Map |
| تكلفة أو ربح أو طلب | الملف الأساسي + حارس المجال | قواعد المجال والاختبارات |
| كود أو قاعدة بيانات أو نشر | الملف الأساسي + قرار الشريحة + العقود + حارس التنفيذ | قرار Stack، الأمان، ومصفوفة التحقق |
| Domain Core | قرار الشريحة + العقود + خارطة التنفيذ + بوابة Pre-build | `src/domain/` و`tests/domain/` |
| Prototype Web-first Android-like | بوابة Pre-build + المحاكاة + خارطة التنفيذ + العقود + `docs/product/mobile-ui-ux-reference-v1.md` + `docs/implementation/mobile-prototype-spec-v1.md` + `docs/implementation/prototype-build-charter-v1.md` | النموذج التشغيلي وسياسة التوجيه ومصفوفة السيناريوهات والمهارات الأربع المتخصصة |
| بحث خارجي أو GitHub | Truth Map + `global-build-reference-library-v1.md` + `micro-build-logic-v1.md` | `docs/06-reference-library.md` وتقارير البحث التاريخية وسجل التراخيص |
| مراجعة نظام Accounting القديم | الملف الأساسي فقط لتحديد المطلوب | ملفات LEGACY المحددة فقط |

## 5. قواعد التحديث

كل تعديل جوهري يحدّث الإصدار أو تاريخ المراجعة، ويذكر الملفات المتأثرة. لا تُنشأ وثيقة جديدة إذا كان التغيير تصحيحًا مباشرًا للمرجع الأساسي. إذا احتجنا دراسة طويلة، تُحفظ كـSUPPORTING وتُضاف خلاصة قرارها إلى المرجع الأساسي. ملف الدليل الميداني وجدول مطابقة العقود ومرجع UI/UX ومواصفة Prototype وBuild Charter ملفات CURRENT لأنهما يثبتان حدود الدليل أو عقد التجربة أو نطاق البناء، ويجب إدراجها في الفهرس عند إنشائها. المهارات المتخصصة CURRENT/OPERATIONAL؛ تشرح طريقة التنفيذ ولا تنشئ سلطة مستقلة على المنتج أو المال.

لا تحذف وثيقة تاريخية نهائيًا قبل التأكد من عدم وجود قرار أو دليل غير منقول. انقلها إلى الأرشيف مع ملف يشرح سبب الأرشفة والمرجع البديل.

## 6. ما يجب ألا يحدث

لا يقرأ المساعد ملفات خارج المستودع تلقائيًا. لا يستخدم أي أرشيف أو وثيقة قديمة كمرجع حالي. لا يستعيد قرارًا مسحوبًا لأن صياغته أطول أو لأنه يحتوي على ميزات أكثر.

## 7. بوابة قبل الكود

قبل أي تنفيذ، يجب أن يذكر المطور أو الذكاء الاصطناعي: الملف الأساسي المعتمد، الفرضية، النطاق، الملفات التي سيعدلها، الملفات التي لن يقرأها، ومعيار القبول. قبل Adapter أو واجهة Prototype، يجب أيضًا اجتياز `docs/implementation/03-pre-build-alignment-v1.md`، وقراءة `docs/implementation/prototype-build-charter-v1.md`، وتفعيل المهارة المتخصصة المناسبة، وتوثيق نتائج المحاكاة. إذا احتاج ملفًا مؤرشفًا، يذكر السبب والجزء المطلوب فقط.


## 8. الوثائق canonical بعد اختبار السيناريوهات

تضاف المجلدات التالية إلى طبقة `CURRENT` في هذا المستودع:

| المسار | الوظيفة |
|---|---|
| `docs/product/problem-statement-v4.md` | المشكلة والأضرار والأسئلة الأساسية، والنواة العامة والـProfiles والمشاريع المختلطة |
| `docs/product/system-definition-v1.md` | تعريف Micro وحدوده وقيمته |
| `docs/product/user-operating-model-v1.md` | الاستخدام اليومي والأسبوعي والشهري |
| `docs/product/financial-operating-model-v1.md` | المعالجة المالية الداخلية وحدودها |
| `docs/contracts/05-financial-p0-policies.md` | سياسات المال التنفيذية لنتيجة الطلب والتكلفة والسعر وحدود Prototype |
| `docs/product/guidance-interaction-policy-v1.md` | التوجيه داخل العمل دون تعليم قسري |
| `docs/scenarios/` | الشخصيات والحالات والأسئلة ونتائج الاختبار |
| `docs/quality/scenario-coverage-matrix-v1.md` | مطابقة المشكلات بالقدرات والاختبارات |
| `docs/research/jordan-financial-problems-evidence.md` | الأدلة المحلية والخارجية وحدودها |
| `docs/implementation/03-pre-build-alignment-v1.md` | بوابة الفرق بين Prototype وMVP وخطة المحاكاة قبل الكود |
| `docs/implementation/prototype-build-charter-v1.md` | ميثاق Web-first وAndroid-like وPWA-ready وCloudflare وخطة الشرائح والحوكمة قبل الكود |
| `docs/quality/pre-build-experiment-simulation-v1.md` | نتائج المحاكاة وحدودها |
| `docs/research/global-build-reference-library-v1.md` | المعرفة العالمية المحفوظة وقرارات المصادر |
| `docs/research/micro-build-logic-v1.md` | منطق تحويل المصادر إلى بناء واختبار |
| `ai-skills/` المتخصصة الأربع | إرشادات تشغيلية للواجهة والتصميم والتخزين والـQA؛ لا تتغلب على الوثائق أو العقود |
| `docs/quality/simulated-first-read-cloud-code-v1.md` | مراجعة محاكية لقابلية القراءة الأولى وحدود التنفيذ |
| `docs/quality/cloud-code-first-read-findings-v1.md` | نتائج القراءة الفعلية من Cloud Code والتحقق والإجراءات التابعة |

هذه الملفات تحفظ المعرفة التي تم تثبيتها خارج المحادثة. ويُضاف `docs/contracts/05-financial-p0-policies.md` إلى القراءة الإلزامية عند أي قرار مالي؛ فهو لا يوسع Prototype، بل يمنع ترك معنى النتيجة والتكلفة والسعر ضمنيًا. مرجع `mobile-ui-ux-reference-v1.md` يحدد عقد التجربة ولا يثبت أن الواجهة منفذة، ومواصفة `mobile-prototype-spec-v1.md` تحدد ما يجب بناؤه واختباره ولا تتغلب على عقود المال أو حدود Domain Core. لا تُرفع نسخ مراحل أو تقارير محادثة بأسماء متعددة إذا كان محتواها قد دُمج في هذه المراجع. إذا تغيّر مضمون جوهري، يُحدّث الملف canonical وتُسجّل الإحالة في سجل القرارات بدل إنشاء نسخة منافسة.

مجموعة السيناريوهات اختبار اصطناعي وليست دليلًا إحصائيًا للسوق. وخبرة المؤسس والدراسات الخارجية تُصنف وفق قوتها وحدودها في Truth Map، ولا تتحول تلقائيًا إلى ميزات أو ادعاءات تجارية.
