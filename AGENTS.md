# Micro — تعليمات القراءة والتنفيذ للـAgents

## 1. الهدف من هذا الملف

هذا الملف هو نقطة الدخول الأولى لأي Agent يعمل على مستودع Micro. لا يستبدل الوثائق canonical؛ بل يمنع القراءة المجتزأة والخلط بين تعريف النظام وما نُفذ فعليًا في الكود.

اللغة التشغيلية الافتراضية هي العربية. يجب أن يذكر Agent في بداية المهمة ما قرأه، وما الذي سيغيره، وما الذي لن يغيره، وما معيار القبول، وما الذي يبقى مجهولًا.

## 2. ترتيب القراءة الإلزامي

ابدأ بخمس قراءات نواة قصيرة، ثم أضف مسار القراءة المشروط بحسب الملفات أو الطبقة التي ستلمسها:

1. `docs/operations/current-state.md` لمعرفة commit المعتمد، ما اندمج، وما المسموح فعله الآن.
2. `README.md` لفهم Micro في سطرين، لا لاستخراج حالة التنفيذ التفصيلية.
3. `docs/operations/micro-thinking-charter-v1.md` لإثبات فهم هدف Micro وطريقة القرار قبل التفكير في كود أو شاشة.
4. `docs/00-document-index.md` لمعرفة سلطة الوثائق ومسار القراءة.
5. `docs/implementation/03-pre-build-alignment-v1.md` لتثبيت حدود المنتج الكامل وPrototype المرحلة 2 وMVP التجاري اللاحق.

| إذا ستلمس | اقرأ قبل التعديل |
|---|---|
| تعريف المنتج أو المعمارية أو قرار مرحلة | `docs/01-product-and-technical-blueprint.md`، و`docs/research/global-build-reference-library-v1.md`، ثم `docs/research/micro-build-logic-v1.md` |
| Domain أو تكلفة أو سعر أو ربح أو كاش أو مخزون أو دين أو مصروف | `docs/contracts/05-financial-p0-policies.md`، و`docs/contracts/` ذات الصلة، و`docs/implementation/02-domain-contract-coverage.md`، و`docs/product/financial-operating-model-v1.md`، و`docs/scenarios/scenario-test-set-v1.md`، و`docs/quality/scenario-coverage-matrix-v1.md`، إضافة إلى مهارات المالية والسيناريوهات |
| Prototype أو صفحة أو مكوّن أو RTL أو حالات واجهة | `docs/product/mobile-ui-ux-reference-v1.md`، و`docs/implementation/mobile-prototype-spec-v1.md`، و`docs/implementation/prototype-build-charter-v1.md`، و`ai-skills/micro-web-native-ux/`، و`ai-skills/micro-prototype-qa/`، و`ai-skills/micro-anti-vibe-interface-audit/` |
| IndexedDB أو LocalStore أو المسودات أو Export/Import | `docs/contracts/04-limited-sync-contract.md`، و`docs/implementation/02-domain-contract-coverage.md`، و`ai-skills/micro-local-first-prototype/`، مع إبقاء `localSchemaVersion` و`localExportVersion` تحت حارس صريح |
| قبول Slice أو PR أو تسليم أو مراجعة Agent سابق | `docs/operations/agent-handoff-protocol-v1.md`، و`docs/operations/slice-handoff-template.md`، و`.github/pull_request_template.md`، و`docs/quality/cloud-code-first-read-findings-v1.md`، و`docs/quality/unified-audit-resolution-v1.md` |
| Profiles أو Activity أو مشروع مختلط أو سياق نشاط | `docs/product/activity-profiles-and-hybrid-projects-v1.md`، ومراجع المنتج والسيناريوهات أعلاه؛ لا تُنشئ عقدًا أو ترحيلًا من الوثيقة وحدها |
| `الخدمات` أو Micro Market أو Micro Delivery أو Supplier/Courier/Admin | `docs/expansion/README.md` ثم `docs/expansion/DECISIONS.md` و`docs/expansion/TRACKER.md` و`E00-EXECUTION-PROTOCOL.md` و`FOUR-PARTY-IMPLEMENTATION-GATE-MAP.md` و`FOUR-PARTY-PORTAL-AND-ACCESS-RECOVERY-GATE.md` و`SEVEN-AGENT-EXPANSION-OPERATING-CHECKLIST.md`؛ اقرأ العقود 18–24 ومصفوفة الدور والسيناريو المتصل بالمهمة، ثم العقود المالية والسيناريوهات؛ لا تستخدم `historical-source/` كمرجع تنفيذ |

هذه طبقات قراءة لا بدائل مختصرة للعقود. عند لمس أكثر من طبقة، تُجمع المسارات المشروطة كلها، وتظل العقود والسياسات المالية ومصفوفات التغطية والوثائق canonical إلزامية. لا تقرأ تقارير البحث التاريخية أو ملفات النظام القديم بوصفها سلطة حالية؛ استخدمها فقط إذا ذكرت سبب الحاجة إليها.

## 3. سلطة الوثائق

عند الاختلاف، استخدم الترتيب التالي:

1. العقود والسياسات المالية التي تحكم السلوك الدقيق.
2. `docs/01-product-and-technical-blueprint.md` لتعريف المنتج والمعمارية التجارية.
3. `docs/implementation/01-execution-roadmap.md` و`docs/implementation/03-pre-build-alignment-v1.md` لتحديد المرحلة.
4. `docs/product/` لتعريف المشكلة والنموذج المالي والتشغيلي والتوجيه.
5. `docs/research/micro-build-logic-v1.md` و`docs/research/global-build-reference-library-v1.md` لتحويل المصادر إلى قرارات.
6. `docs/02-decision-log.md` لتتبع القرارات وتواريخها.
7. `docs/implementation/prototype-build-charter-v1.md` كميثاق تنفيذ للـPrototype؛ يفسر المنصة والنشر والخطة ولا يتغلب على العقود.
8. `docs/quality/unified-audit-resolution-v1.md` كحارس جودة تنفيذي قبل Prototype، ثم `docs/product/mobile-ui-ux-reference-v1.md` كمرجع تجربة و`docs/implementation/mobile-prototype-spec-v1.md` كمواصفة نطاق وسلوك؛ ولا يجوز للأخيرة أو للمهارات أو للملفات الداعمة والتاريخية أن تتغلب على العقود أو هوية المنتج.

إذا ظهر تعارض حقيقي، لا تخمّن. سجله، حدّد الملفات المتأثرة، وأوقف التنفيذ عند النقطة التي قد تغيّر معنى المال أو المرحلة أو هوية المنتج. ولا يبدأ Agent من فهم تقني فقط: يثبت في بطاقة الفهم أنه يعرف موقف المستخدم وسؤال القرار وحد المعرفة ولماذا لا تدخل القدرة المجاورة في الشريحة نفسها.

## 4. ما هو Micro؟

Micro نظام إدارة مالية وتشغيلية كامل للمشروع وصاحب المشروع. هو عميق ماليًا ومحاسبيًا في الداخل، لكنه بسيط وعملي في تجربة المستخدم. يربط الحدث الواقعي بالتكلفة والطلب والربح والكاش والمخزون والذمم ومال المالك والقرار التالي، ويظهر درجة المعرفة بدل الدقة الزائفة.

Micro ليس تطبيق طلبات فقط، وليس تطبيقًا تعليميًا، وليس ERP أو POS أو CRM عامًا. التوجيه داخل الحقل أو التقرير مساعدة مرتبطة بالعمل، وليس دورات أو LMS أو شرطًا لإكمال محتوى.

عند توسعة Market أو Delivery، يبقى Micro منتجًا واحدًا للمالك وManage هو مركزه؛ `الخدمات` لوحة متابعة لا قائمة منتجات. لا يعني قبول عرض مورد أو تحديث توصيل أي أثر مالي أو مخزني تلقائي؛ سجل الواقع داخل Manage وحده وبفعل Owner صريح.

## 5. تعريف المراحل

| المرحلة | معناها |
|---|---|
| Domain Core | نواة TypeScript مستقلة عن الواجهة والتخزين وAuth، وتثبت سلوك شريحة الحرفة الحالية فقط |
| Prototype المرحلة 2 | واجهة هاتف RTL محلية لمسار الحرفة المخصصة، مع Adapter محلي وLocalStore و`local export/import` عند بنائهما؛ هدفها إثبات الفهم والإنجاز، لا SaaS، ويمكن تشغيلها أولًا لمالك واحد دون Roles أو Permissions |
| MVP التجاري اللاحق | نسخة SaaS بعد إثبات القيمة، وتضيف Auth وworkspace وRLS ونسخًا مركزية ومزامنة محدودة عند الحاجة |
| Pilot | استخدام أصحاب مشاريع حقيقيين بقياسات سلوكية وتجارية، وليس محاكاة مكتبية |

لا تقل إن Adapter أو واجهة أو Auth أو Workspace أو Ledger عام أو نقطة تعادل منفذة لمجرد أن الوثائق تصفها كهدف. راجع `docs/implementation/02-domain-contract-coverage.md` وحالة التنفيذ في `docs/research/micro-build-logic-v1.md`.

## 6. قواعد مالية غير قابلة للكسر

- القبض ليس الربح.
- العربون كاش محصل وليس ربحًا نهائيًا تلقائيًا.
- الدين مستحق وليس كاشًا محصلًا.
- التسليم لا يسجل قبضًا تلقائيًا.
- شراء المخزون لا يساوي تكلفة البيع كلها لحظة الشراء.
- السحب الشخصي وحقن رأس المال والقرض ليست مبيعات أو مصاريف تشغيل.
- التكلفة الناقصة لا تساوي صفرًا ولا تسمح بربح نهائي. ووقت الحرفة المعروف بدقائق أو سعر ساعة صفري لا يعد تكلفة عمل مكتملة، بل يصنف `incomplete`.
- لا يغير سعر حالي نتيجة تاريخية أو Snapshot قديمًا بصمت. Snapshot ومدخلاته ومصفوفة تاريخها تُحفظ بالقيمة وتُجمّد عند حدود Domain Core، وتطابق الكمية الداخلية إلزامي.
- إذا دخل طلب مسلّم إلى `needs_review`، تُحجب النتيجة وتُمنع **كل العمليات العامة التي تغيّر الحالة أو Snapshot أو الأثر المالي** حتى يوجد Use Case تصحيح موثق؛ لا يوجد `correctDelivery` منفذ بعد.
- الإلغاء يمر عبر `cancelOrder` مع سبب وتسوية عربون صريحة؛ لا تستخدم `transitionOrder` لإلغاء عام يتجاوز العقد.
- الدفع الكامل مقدمًا ثم التسليم ينقل الطلب إلى `settled` إذا كان المتبقي صفرًا، ويعرض مراجعة النتيجة بدل فعل تحصيل.
- المصروف المشترك لا يُحمّل على طلب أو يُستبعد منه دون قاعدة معلنة.
- كل حدث حساس قابل لإعادة المحاولة يحتاج `idempotency_key` غير فارغ، ويُفحص ضمن نوع العملية؛ لا يجوز حل التعارض المالي بآخر كتابة صامتة.

عند أي نتيجة، اعرض الفترة والمصدر والافتراضات وحالة المعرفة. لا تعرض «ربح المشروع منذ البداية» من `CraftOrder` واحد؛ فهذا يحتاج Ledger عام وفترات وسياسة اعتراف واضحة.

## 7. قواعد القرار والتنفيذ

قبل اقتراح ميزة أو كود:

1. اربط الطلب بمشكلة من Problem Statement وبشخصية وحالة وسؤال.
2. اكتب أقل نتيجة ومدخلات وفعل تالٍ، لا قائمة شاشات.
3. مرّر القرار على السيناريوهات ومصفوفة التغطية.
4. افصل ما هو منفذ، وما هو هدف، وما هو Spike، وما هو مؤجل، وما هو مرفوض.
5. اكتب العقد والـinvariants وحالات الفشل ومعيار القبول.
6. عند استخدام مصدر خارجي، افحص بطاقة المصدر والترخيص والنسخة؛ خذ الفكرة وأعد تنفيذها مستقلًا، ولا تنسخ كودًا من AGPL/GPL/BSL أو مصدر بلا ترخيص مناسب.
7. لا تضف Auth أو Supabase أو Billing أو مزامنة كاملة أو قطاعات إضافية قبل بوابة المرحلة ودليل الحاجة.

## 8. الحالة الحالية وما يليها

لا تضع حالة التنفيذ التفصيلية في هذا الملف؛ فهي تتغير أسرع من قواعد العمل. المرجع الحي الوحيد هو `docs/operations/current-state.md` ويجب أن يطابق `main`. افتحه قبل أي كود، ثم افتح العقد المتصل بالشريحة فقط. إذا كان في الحالة «توقف»، فالتوقف قاعدة تنفيذ لا اقتراح.

## 9. بروتوكول الإغلاق

بعد كل تغيير، يجب أن يذكر Agent الملفات المتغيرة، ويحدّث `docs/operations/current-state.md` و`todo.md` عند دمج Slice، ويحدّث سجل القرار أو الفرضية عند الحاجة، ويشغل الفحوص المناسبة، ويتحقق من عدم وجود أسرار أو تغييرات غير مقصودة. لا يدمج تغييرات في `main` دون مراجعة diff ونتائج CI وموافقة مالك المنتج عندما تكون المهمة تتطلب ذلك.
