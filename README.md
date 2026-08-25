# Micro

نظام إدارة مالية وتشغيلية عملي لأصحاب المشاريع المنزلية والمتناهية الصغر، يبدأ من الأردن والدينار الأردني. Micro عام في نواته، ويدعم مستقبلًا Profiles اختيارية للحرفة والطعام والخدمات والزراعة والسياحة والتجارة والمشاريع المختلطة، من دون فرض قالب واحد أو تحويله إلى ERP. يفكر النظام ماليًا ومحاسبيًا في الداخل، ويوجه المستخدم داخل سير العمل بلغة عملية.

## ما المشكلة التي نحلها؟

صاحب المشروع يبيع وينفق ويستخدم وقته وموارده ويستقبل طلبات، لكنه لا يستطيع في الوقت المناسب أن يعرف بثقة تكلفة ما يبيع، ربحه أو خسارته، الكاش القابل للاستخدام، وما اتفق عليه ومتى يجب تنفيذه. يساعد Micro على تسجيل ما يحدث بأقل جهد، وتفسير التكلفة والنتيجة والطلب والكاش بدرجة صدق مناسبة، ثم اختيار الفعل التالي.

## ما هذا المستودع الآن؟

هذا المستودع يحتوي عقود المجال وDomain Core وPrototype Web محليًا في `apps/prototype-web/`، ويُدار بوصفه سلسلة شرائح مستقلة لا «نسخة نهائية». الحالة المنفذة وحدودها الدقيقة ليست ثابتة داخل README؛ مصدرها الحي هو [`docs/operations/current-state.md`](docs/operations/current-state.md). لا يحتوي PWA أو استضافة Cloudflare أو Native أو SaaS أو استقبال بيانات حقيقية، ولا نسخة من Accounting أو zman-app أو كود خارجي منقول.

إذا كنت Agent جديدًا، ابدأ من [`docs/operations/current-state.md`](docs/operations/current-state.md) ثم [`AGENTS.md`](AGENTS.md) و[`docs/operations/README.md`](docs/operations/README.md). بعد ذلك اقرأ [`docs/00-document-index.md`](docs/00-document-index.md)، ثم المرجع والعقد المتصلين بالمهمة فقط. ولتعريف Micro، راجع [`docs/product/problem-statement-v4.md`](docs/product/problem-statement-v4.md) و[`docs/product/system-definition-v1.md`](docs/product/system-definition-v1.md) و[`docs/product/user-operating-model-v1.md`](docs/product/user-operating-model-v1.md) و[`docs/product/activity-profiles-and-hybrid-projects-v1.md`](docs/product/activity-profiles-and-hybrid-projects-v1.md).

## المراجع الأساسية

| المرجع | الغرض |
|---|---|
| `docs/01-product-and-technical-blueprint.md` | Problem Statement وProduct Goal وMVP والتقنية |
| `docs/02-decision-log.md` | القرارات المعتمدة والمسحوبة |
| `docs/03-hypothesis-register.md` | الفرضيات ومعايير الاختبار |
| `docs/04-product-truth-map.md` | قوة الأدلة وما بقي مجهولًا |
| `docs/05-documentation-governance.md` | قواعد إدارة الوثائق |
| `docs/06-reference-library.md` | مراجع GitHub والأنماط والتراخيص |
| `docs/product/` | Problem Statement وتعريف النظام ونموذج الاستخدام والنموذج المالي وسياسة التوجيه |
| `docs/scenarios/` | الشخصيات والحالات والأسئلة ونتائج الاختبار |
| `docs/quality/scenario-coverage-matrix-v1.md` | ربط المشكلات بالسيناريوهات والقدرات |
| `docs/research/jordan-financial-problems-evidence.md` | الأدلة الأردنية والخارجية وحدودها |
| `ai-skills/` | حزمة المهارات المحمولة الخاصة بالمنتج |
| `src/domain/craft-order/` | Domain Core للشريحة الأولى |
| `tests/domain/` | اختبارات المجال القابلة للتشغيل |
| `apps/prototype-web/` | Web-first Prototype: App Shell وRTL وLight/Dark والتأسيس والمسودات وSnapshots تكلفة وسعر حماية واتفاق وعربون وتنفيذ وتسليم وتحصيل أو دين ونتيجة وحماية محلية Export/Import، مع Application وLocalStore معزولين |

## قواعد مهمة

لا تعتبر وجود ميزة في نظام قديم أو مشروع مفتوح المصدر دليلًا على ضرورتها. لا تغيّر قرارًا معتمدًا دون دليل وسجل قرار. لا تعرض ربحًا نهائيًا عند نقص أو تغير أو قدم التكلفة؛ النواة تحمل `resultStatus` لتوضيح ذلك. لا تخلط حالة اشتراك SaaS بمالية صاحب المشروع. لا تضف بوابة دفع للمستخدم في MVP. لا تدخل كودًا خارجيًا قبل فحص الترخيص والمصدر والملاءمة. عند إلغاء طلب ذي عربون، لا تُفترض سياسة رد أو احتفاظ؛ يبدأ الطلب بـ`needs_review` وتنفذ التسوية كعملية مستقلة.

## الحالة الحالية

الحالة التنفيذية ليست ثابتة داخل README. اقرأ [`docs/operations/current-state.md`](docs/operations/current-state.md) لمعرفة ما اندمج في `main` وما توقف عمدًا وما الخطوة التالية المسموحة. لا تدّعِ PWA أو مزامنة أو SaaS أو Native أو بيانات مستخدمين حقيقية أو صافي ربح نهائي ما لم يذكرها هذا المرجع الحي مع PR واختبار مدمجين.
