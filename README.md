# Micro

خدمة SaaS لنظام إدارة مالية وتشغيلية عملي لأصحاب المشاريع المنزلية والمتناهية الصغر، تبدأ من الأردن والدينار الأردني، وتُبنى أولًا للحرف اليدوية والأطعمة المنزلية والخدمات. يفكر النظام ماليًا ومحاسبيًا في الداخل، ويوجه المستخدم داخل سير العمل بلغة عملية.

## ما المشكلة التي نحلها؟

صاحب المشروع يبيع وينفق ويستخدم وقته وموارده ويستقبل طلبات، لكنه لا يستطيع في الوقت المناسب أن يعرف بثقة تكلفة ما يبيع، ربحه أو خسارته، الكاش القابل للاستخدام، وما اتفق عليه ومتى يجب تنفيذه. يساعد Micro على تسجيل ما يحدث بأقل جهد، وتفسير التكلفة والنتيجة والطلب والكاش بدرجة صدق مناسبة، ثم اختيار الفعل التالي.

## ما هذا المستودع الآن؟

هذه الدفعة هي **مرجع قرار وDomain Core قابل للاختبار وSlice 2 للـPrototype**. تحتوي على عقود المجال، ونواة أولية لمسار طلب حرفة يدوية مخصصة، وحزمة Web App في `apps/prototype-web/` لواجهة RTL محلية وLight/Dark وتأسيس محلي ومسودات قابلة للحفظ والاستئناف وSnapshot تكلفة وسعر حماية عبر Domain Core. لا تحتوي بعد على اتفاق أو موعد أو عربون أو تسليم أو تحصيل أو دين أو نتيجة طلب أو export/import. كما لا تحتوي SaaS قابلًا للإطلاق أو استقبال بيانات حقيقية، ولا نسخة من Accounting أو zman-app أو كود خارجي منقول.

ابدأ من [`docs/00-document-index.md`](docs/00-document-index.md)، ثم اقرأ [`docs/01-product-and-technical-blueprint.md`](docs/01-product-and-technical-blueprint.md). وللتعريف الحالي، راجع [`docs/product/problem-statement-v3.md`](docs/product/problem-statement-v3.md) و[`docs/product/system-definition-v1.md`](docs/product/system-definition-v1.md) و[`docs/product/user-operating-model-v1.md`](docs/product/user-operating-model-v1.md). عند استخدام أي ذكاء اصطناعي، اقرأ [`ai-skills/README.ar.md`](ai-skills/README.ar.md) وفعّل المهارة المناسبة.

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
| `apps/prototype-web/` | Web-first Prototype: App Shell وRTL وLight/Dark والتأسيس والمسودات وSnapshots تكلفة وسعر حماية، مع Application وLocalStore معزولين |

## قواعد مهمة

لا تعتبر وجود ميزة في نظام قديم أو مشروع مفتوح المصدر دليلًا على ضرورتها. لا تغيّر قرارًا معتمدًا دون دليل وسجل قرار. لا تعرض ربحًا نهائيًا عند نقص أو تغير أو قدم التكلفة؛ النواة تحمل `resultStatus` لتوضيح ذلك. لا تخلط حالة اشتراك SaaS بمالية صاحب المشروع. لا تضف بوابة دفع للمستخدم في MVP. لا تدخل كودًا خارجيًا قبل فحص الترخيص والمصدر والملاءمة. عند إلغاء طلب ذي عربون، لا تُفترض سياسة رد أو احتفاظ؛ يبدأ الطلب بـ`needs_review` وتنفذ التسوية كعملية مستقلة.

## الحالة الحالية

المرحلة الحالية هي Domain Core والعقود والاختبارات، مع **Slice 0 وSlice 1 وSlice 2 من Prototype الهاتف المحلي**: Web App بملء الشاشة، RTL، App Shell، تنقل، Bottom Sheet، Light/Dark، تأسيس محلي، مسودات قبل Domain، وSnapshots تكلفة تاريخية وسعر حماية محسوبين عبر Domain Core. لا يمثل سعر الحماية سعر سوق أو اتفاقًا أو ربحًا، ولا تنشئ الشاشة حركة كاش. الشريحة التالية هي: اتفاق وموعد → عربون اختياري → تنفيذ → تسليم → قبض أو دين → نتيجة وفعل تالٍ. النواة الحالية تطبق نسخ التكلفة، حالات المعرفة، `resultStatus`، فصل العربون عن التحصيل، وإلغاء العربون بتسوية صريحة أو `needs_review`. لم تربط الواجهة بعد مسودتها بـDomain Core لإنشاء CraftOrder، ولم تُنفذ حماية export/import أو PWA أو Cloudflare deployment أو Native wrapper أو SaaS أو استقبال بيانات مستخدمين حقيقية؛ لذلك لا يجوز الادعاء بالجاهزية التجارية.
