# Micro

نظام إدارة مالية وتشغيلية عملي لأصحاب المشاريع المنزلية والمتناهية الصغر، يبدأ من الأردن والدينار الأردني. Micro عام في نواته، ويدعم مستقبلًا Profiles اختيارية للحرفة والطعام والخدمات والزراعة والسياحة والتجارة والمشاريع المختلطة، من دون فرض قالب واحد أو تحويله إلى ERP. يفكر النظام ماليًا ومحاسبيًا في الداخل، ويوجه المستخدم داخل سير العمل بلغة عملية.

## ما المشكلة التي نحلها؟

صاحب المشروع يبيع وينفق ويستخدم وقته وموارده ويستقبل طلبات، لكنه لا يستطيع في الوقت المناسب أن يعرف بثقة تكلفة ما يبيع، ربحه أو خسارته، الكاش القابل للاستخدام، وما اتفق عليه ومتى يجب تنفيذه. يساعد Micro على تسجيل ما يحدث بأقل جهد، وتفسير التكلفة والنتيجة والطلب والكاش بدرجة صدق مناسبة، ثم اختيار الفعل التالي.

## ما الذي يثبته هذا المستودع؟

يحتوي المستودع على عقود المجال وDomain Core وPrototype Web محليًا في `apps/prototype-web/`، إضافة إلى الاختبارات وحراس الجودة وأدلة التشغيل. النظام Web-first وlocal-first؛ لا تدّعِ وجود Auth أو Sync أو Cloud أو بيانات مستخدمين حقيقية أو تطبيق Native أو Pilot إنتاجي إلا إذا أثبتها الكود والاختبارات و`main` والحالة الحية. الحالة التنفيذية ليست ثابتة داخل README؛ مصدرها الحي هو [`docs/operations/current-state.md`](docs/operations/current-state.md).

توجد PWA وتهيئة Cloudflare Pages ضمن حدود Prototype، لكن قبول Android/iOS أو standalone أو Offline الإنتاجي ميدانيًا ليس افتراضًا. لا يحتوي المستودع SaaS أو استقبال بيانات حقيقية، ولا يعتمد على نسخة من Accounting أو zman-app أو كود خارجي منقول.

## من أين يبدأ Agent؟

`AGENTS.md` هو نقطة الدخول الأولى وجدول التوجيه الوحيد. بعده اقرأ [`docs/operations/current-state.md`](docs/operations/current-state.md) للحالة التنفيذية الحية، ثم [`docs/operations/agent-development-sop-v1.md`](docs/operations/agent-development-sop-v1.md) لدورة التنفيذ و[`docs/operations/agent-handoff-protocol-v1.md`](docs/operations/agent-handoff-protocol-v1.md) لتسليم الحالة. استخدم [`docs/operations/README.md`](docs/operations/README.md) لخريطة التشغيل و[`docs/operations/control/README.md`](docs/operations/control/README.md) لسجل الـClaims، و[`docs/00-document-index.md`](docs/00-document-index.md) للبحث والاستشهاد فقط؛ الفهرس ليس قائمة قراءة.

لا تبدأ تعديلًا قبل تثبيت `origin/main`، وفحص الحالة الحية وPRs وClaims، وكتابة بطاقة فهم تحدد النطاق وخارجه والعقد ومعيار القبول وحد الاستعادة. لا تُنشئ قائمة قراءة أو SOP أو `AGENT.md` منافسًا. عند العمل على Market أو Delivery أو «الخدمات»، ابدأ أيضًا من [`docs/expansion/README.md`](docs/expansion/README.md) ولا تعامل الوثائق التاريخية أو التقارير الخارجية كتعليمات تنفيذ.

## مصادر السلطة

| السؤال | المصدر |
|---|---|
| ما معنى السلوك أو المال؟ | العقود والسياسات المالية ذات الصلة في `docs/contracts/` و`docs/decisions/` |
| ما القرار المعتمد أو المسحوب؟ | [`docs/02-decision-log.md`](docs/02-decision-log.md) والقرارات المفهرسة |
| ما الموجود فعليًا على `main`؟ | الكود والاختبارات وPR المدمج و[`current-state.md`](docs/operations/current-state.md) |
| ما الذي يعمل عليه Agent؟ | Operations Control و`generated/AGENT-BRIEF.md` و`generated/ACTIVE-WORK.md` |
| ما التاريخ؟ | [`current-state-log.md`](docs/operations/current-state-log.md) — append-only |
| كيف يبدأ Agent وينفذ ويسلّم؟ | [`AGENTS.md`](AGENTS.md) وSOP وHandoff أعلاه |
| ما الفرضيات والأدلة؟ | [`docs/03-hypothesis-register.md`](docs/03-hypothesis-register.md) و[`docs/04-product-truth-map.md`](docs/04-product-truth-map.md) |
| أين تُراجع مواصفات المكونات؟ | بوابة لاحقة بعقد وClaim مستقلين؛ لا تبدأ تلقائيًا من README |

## المراجع الأساسية

- [`docs/01-product-and-technical-blueprint.md`](docs/01-product-and-technical-blueprint.md): Problem Statement وProduct Goal وMVP والتقنية.
- [`docs/05-documentation-governance.md`](docs/05-documentation-governance.md): قواعد إدارة الوثائق وتعارضاتها.
- [`docs/research/global-build-reference-library-v1.md`](docs/research/global-build-reference-library-v1.md): مراجع الأنماط والتراخيص وبوابة إدخال الكود الخارجي.
- [`docs/product/`](docs/product/): تعريف النظام ونموذج الاستخدام والنموذج المالي وسياسة التوجيه.
- [`docs/scenarios/`](docs/scenarios/): الشخصيات والحالات والأسئلة ونتائج الاختبار.
- [`docs/quality/scenario-coverage-matrix-v1.md`](docs/quality/scenario-coverage-matrix-v1.md): ربط المشكلات بالسيناريوهات والقدرات.
- [`docs/research/jordan-financial-problems-evidence.md`](docs/research/jordan-financial-problems-evidence.md): الأدلة الأردنية والخارجية وحدودها.
- [`docs/expansion/`](docs/expansion/): نقطة الدخول والقرارات والـTracker لتوسعة Market وDelivery؛ توثق ولا تعني أن القدرة منفذة.
- [`ai-skills/`](ai-skills/): حزمة المهارات المحمولة الخاصة بالمنتج، وتُقرأ عبر جدول `AGENTS.md` فقط.
- [`src/domain/`](src/domain/): Domain Core المستقل.
- [`tests/domain/`](tests/domain/): اختبارات المجال القابلة للتشغيل.

## قواعد المنتج الثابتة

لا تعتبر وجود ميزة في نظام قديم أو مشروع مفتوح المصدر دليلًا على ضرورتها. لا تغيّر قرارًا معتمدًا دون دليل وسجل قرار. لا تعرض ربحًا نهائيًا عند نقص أو تغير أو قدم التكلفة؛ النواة تحمل `resultStatus` لتوضيح ذلك. لا تخلط حالة اشتراك SaaS بمالية صاحب المشروع، ولا تضف بوابة دفع للمستخدم في MVP. لا تدخل كودًا خارجيًا قبل فحص الترخيص والمصدر والملاءمة. عند إلغاء طلب ذي عربون، لا تُفترض سياسة رد أو احتفاظ؛ يبدأ الطلب بـ`needs_review` وتنفذ التسوية كعملية مستقلة.

لا تضع قواعد المال أو المجال في React/UI، ولا تصل الصفحات مباشرة إلى التخزين. لا ترفع حدود Schema/Export أو lint أو bundle بصمت. لا تغيّر التاريخ أو Snapshot أو نتيجة مالية بصمت، ولا تضف قدرة خارج المرحلة الحالية. عند تعارض عقد أو غموض مالي أو فشل حاجز، توقف وسجّل القرار المطلوب بدل الافتراض.

## التشغيل والفحص المحلي

```bash
pnpm install --frozen-lockfile
pnpm check
```

لعمل توثيقي أو Claim، اتبع أوامر Operations Control في [`docs/operations/control/README.md`](docs/operations/control/README.md). عدّل JSON المصدر ثم ولّد Views؛ لا تعدّل الملفات المولدة يدويًا. لا تُستخدم `todo.md` لإدارة العمل؛ هو كعب توافق تاريخي محروس.

## بنية المستودع المختصرة

- `src/domain/`: نواة المجال المستقلة.
- `apps/prototype-web/`: Prototype Web وطبقات Application وStorage وPresentation.
- `docs/contracts/`: العقود الحاكمة للسلوك.
- `docs/operations/`: الحالة الحية، Handoff، SOP، وOperations Control.
- `scripts/`: الحراس وأدوات التحقق والتوليد.
- `tests/`: اختبارات المجال والحدود.
- `ai-skills/`: مهارات Micro المحمولة.

تفاصيل المراحل والقدرات التي اندمجت أو توقفت أو بقيت محكومة ببوابات لا تُكرر هنا؛ تُقرأ من الحالة الحية والسجلات والعقود المشار إليها أعلاه. مراجعة Micro Component Specification and Architecture Review تأتي بعد إغلاق عقد التشغيل والتوثيق الحالي، وفي مسار منفصل بمراجعة مالك واضحة. لا تخلطها مع README أو مع إصلاحات تطبيقية.
