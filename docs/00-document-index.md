# فهرس وثائق SaaS — اقرأ هذا أولًا

**حالة الفهرس:** المرجع التشغيلي قبل بدء التطوير.

## ابدأ بهذه الملفات فقط

| الترتيب | الملف | الحالة | متى يُقرأ؟ |
|---:|---|---|---|
| 1 | `docs/01-product-and-technical-blueprint.md` | CURRENT / AUTHORITY | كل قرار منتج أو تقنية أو تنفيذ |
| 2 | `docs/02-decision-log.md` | CURRENT / AUTHORITY | معرفة القرار المعتمد والقرار المسحوب |
| 3 | `docs/03-hypothesis-register.md` | CURRENT | فرضية أو ميزة أو اختبار |
| 4 | `docs/04-product-truth-map.md` | CURRENT | وزن الدليل وما هو مجهول |
| 5 | `ai-skills/README.ar.md` | CURRENT | تشغيل مهارات الذكاء الاصطناعي |
| 6 | `docs/05-documentation-governance.md` | CURRENT | إدارة الوثائق وتعارضاتها |

## اقرأ حسب نوع المهمة

| نوع المهمة | ملفات إضافية |
|---|---|
| بحث عالمي أو GitHub | `docs/06-reference-library.md`، `docs/research/github-global-research-round2.md`، `docs/research/github-global-research.md` |
| تكلفة وربح وطلبات | مراجع `ai-skills/microbusiness-finance-operations/` داخل المستودع |
| كود وأمن ومزامنة ونشر | مراجع `ai-skills/saas-delivery-verifier/` داخل المستودع |
| قرار UX أو MVP | مراجع `ai-skills/saas-product-guardian/` داخل المستودع |
| مراجعة Accounting أو zman-app | افتح المرجع الحالي أولًا، ثم ملف الحالة المطلوب فقط |

## ملفات داعمة غير سلطوية

`docs/research/architecture-and-stack-decision.md`، `docs/research/architecture-decision-reassessment.md`، `docs/research/architecture-decision-matrix.md`، `docs/research/order-tracking-case-study.md`، وملفات المهارات داخل `ai-skills/`.

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
