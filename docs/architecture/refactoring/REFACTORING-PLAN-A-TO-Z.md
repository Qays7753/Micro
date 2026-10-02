# Micro — البحث المعماري النهائي وخطة إعادة الهيكلة من A إلى Z

**التاريخ:** 2026-09-30
**النسخة:** v1.3 — إضافة بوابة التغطية المهنية وحدود الأمان والحالة والبيانات والإصدار دون تنفيذ
**المرحلة:** بحث واستشارة وتخطيط فقط
**الحالة:** لا يوجد تنفيذ، ولا تعديل كود، ولا نقل، ولا حذف، ولا دمج
**حالة المرجع:** مرجع واحد لخطة إعادة الهيكلة؛ لا يُعد تفويضًا بالتنفيذ
**مصادر المراجعة:** البحث المعماري السابق، تقارير الوكلاء الأربعة، تعليمات Micro، ومراجعة Claude AI بتاريخ 2026-10-01

## 1. الرأي النهائي الواحد

> **يبقى Micro تطبيقًا واحدًا من نوع Modular Monolith، بحدود وحدات منطقية مبنية على مسؤوليات العمل، ويُدار العمل القادم كبرنامج Boundary Consolidation محدود، لا كإعادة بناء شاملة. لا يبدأ أي تغيير بنيوي إلا بعد تجميد التطوير غير المرتبط، ومسح بنيوي للقراءة فقط، ومراجعة المالك وقبول النتائج، ثم موجات صغيرة قابلة للرجوع مع اختبار وCI بعد كل موجة.**

هذا هو الرأي الذي خرجت به بعد مقارنة:

- البحث المستقل في مراجع برمجية وأكاديمية؛
- التقارير الأربعة المرفقة؛
- التوليف السابق؛
- تعليمات Micro وبوابة ما بعد Group 6.

التقارير الثلاثة التي لم تستخدم المستودع الحي لا تُهمل. هي مفيدة جدًا في المبادئ العامة والخيارات المستقبلية. لكن لا نستخدمها لإثبات حالة ملف أو مجلد أو رقم داخل Micro. أما التقرير الذي فحص نسخة من المستودع، فنستخدمه كمصدر أدلة مرشح للمصالحة، لا كإغلاق نهائي، لأنه لم يشغّل كل فحوص Micro ولم يقرأ كامل المسح الهيكلي المقبول.

## 2. ماذا أثبت البحث؟

### Modular Monolith أفضل من Microservices الآن

المراجع العملية والأكاديمية لا تقول إن Modular Monolith هو الحل الصحيح دائمًا. لكنها تدعم هذا الاختيار عندما تكون حدود المجال ما زالت تتعلم، وحجم النظام لا يحتاج نشرًا مستقلًا، وتشغيل Offline مهمًا، وكلفة التوزيع أعلى من فائدته. هذا ينطبق على وضع Micro الحالي. الحدود يجب أن تكون حقيقية ومقاسة داخل تطبيق واحد، لا مجرد مجلدات جميلة [S1][S2][S3][S5][S6].

يوجد رأي معاكس معتبر يرى أن الأنظمة الكبيرة ذات المجال المعروف وفرق التطوير المستقلة قد تبدأ بوحدات مستقلة من البداية. هذا لا ينطبق حاليًا على Micro، لكنه يبقى Trigger مستقبليًا إذا ظهرت حاجة حقيقية إلى نشر أو توسع أو عزل مستقل [S4].

### التنظيم يجب أن يخفي قرارات التغيير

المبدأ الأقوى ليس «ضع كل الملفات المتشابهة معًا»، بل أن يخفي كل حد القرار الأكثر عرضة للتغير. هذا هو جوهر Information Hiding: إذا تغيّرت قاعدة مالية أو التخزين أو طريقة التزامن أو الواجهة، لا يجب أن تضطر كل الأجزاء إلى التغير معها [S7].

لذلك لا ننظم حسب الشاشة أو نوع الملف فقط. ننظم حول مسؤوليات العمل، لكن لا نقرر أسماء الوحدات النهائية قبل المسح الحي وOwnership Map.

### المعمارية لا تعيش بالوثائق وحدها

التقارير والبحث متفقون على أن المعمارية تتآكل عندما توجد القواعد في الوثائق فقط. لذلك نحتاج حراسًا قابلة للتشغيل:

- منع Deep Imports؛
- منع الدورات؛
- منع زيادة المخالفات الموجودة؛
- منع دخول قواعد المال إلى UI أو Storage؛
- تسجيل مالك كل مفهوم؛
- قياس التغير بدل الاكتفاء بالانطباع.

لكن الحراس لا تثبت أن المعمارية صحيحة بالكامل؛ هي تفحص خصائص محددة فقط. لذلك نحتاج معها مراجعة المالك، اختبارات السلوك، التوثيق، وسجل الاستثناءات [S8][S9][S10][S11].

### إعادة الهيكلة يجب أن تكون تدريجية

الأبحاث والمراجع العملية تدعم أن إعادة الهيكلة الآمنة تحتاج:

1. خط أساس للسلوك؛
2. عقدًا واضحًا؛
3. حدودًا ضيقة؛
4. اختبارات Characterization وContract؛
5. نقلًا تدريجيًا؛
6. إمكانية إبقاء المسار القديم مؤقتًا؛
7. حذف المسار القديم فقط بعد إثبات عدم استخدامه.

لذلك لا نعمل Big Bang Rewrite. ننفذ Vertical Slices صغيرة، كل واحدة قابلة للتراجع [S12].

### DDD مفيد كطريقة تفكير، لا كطقس

نستخدم من DDD ما يساعد Micro فعلًا:

- لغة واضحة لكل مجال؛
- مالك واحد لكل مفهوم؛
- حدود منطقية؛
- عقود بين الوحدات؛
- طبقة Domain مستقلة؛
- Application رفيعة للتنسيق.

ولا نستخدم الآن:

- Aggregates لكل شيء؛
- CQRS كاملًا؛
- Event Bus داخليًا بلا حاجة؛
- Sagas؛
- Microservices تلقائية؛
- طبقات نظرية كثيرة [S13].

### العقود المحايدة عن اللغة مهمة، لكن لا نبني منظومة متعددة اللغات الآن

نحتاج عقودًا وTest Vectors محايدة عن TypeScript عندما تكون مفيدة لحماية معنى المال والتواريخ والحالات والتصدير. لكن لا نبدأ الآن بـ:

- Dart؛
- Flutter؛
- Kotlin؛
- Swift؛
- Python؛
- Code Generation؛
- OpenAPI قبل وجود API؛
- Backend؛
- Sync.

العقد يجب ألا يعتمد على `undefined` أو `Date` أو React أو IndexedDB أو Classes ذات سلوك. أما اختيار JSON Schema أو صيغة أخرى فيكون تدريجيًا، وبقدر ما يحتاجه أول مستهلك غير TypeScript [S14].

## 3. مقارنة التقارير الأربعة

| المصدر | كيف نستخدمه |
|---|---|
| تقرير الاستشارة الحي | أدلة مرشحة عن import graph، الدورات، الملفات الكبيرة، Public APIs، والتخزين. يحتاج مصالحة مع `main` الحالي وفحوص Micro الرسمية. |
| التقرير الأول العام | مرجع قوي لمبدأ Ports، Shared Kernel، Test Vectors، والإنفاذ التدريجي. لا يثبت حالة Micro الحالية. |
| التقرير الثاني العام | مرجع منظم لتصنيف الوحدات والموجات وشروط القبول. لا يحدد أسماء Micro النهائية. |
| التقرير الصيني | مرجع قوي للمستقبل: Flutter/Dart، Kotlin/Swift، Python، منع التكرار، والاعتماد على العقود. لا يثبت حالة Micro الحالية. |

### اختلافات حسمناها

#### تقسيم Finance

لن ندمج Expenses أو Owner Funds أو Loans داخل Finance، ولن نفصلها نهائيًا، قبل Ownership Map حي يجيب عن:

- من يملك السجل؟
- من يملك دورة حياته؟
- من يحسب الرقم؟
- ما المستهلكون؟
- هل الفصل يمنع تكرار الحقيقة أم يصنعه؟

#### نقل القواعد من Application إلى Domain

لن ننقل منطقًا ماليًا أو دلاليًا داخل موجة Structural ميكانيكية، حتى لو بقي نص الدالة كما هو؛ لأن النقل قد يغير الاعتماديات، توقيت الأخطاء، أو سلوك المستهلكين. أي ملاحظة من هذا النوع تصبح مسارًا دلاليًا مستقلًا.

#### JOD ومقياس المال

أحد التقارير اقترح أسًّا دوليًا من ثلاث منازل للدينار الأردني. هذا لا يُعتمد في Micro.

> **عقد Micro الحالي: القرش = 1/100 من الدينار، وبمنزلتين، دون ترحيل تاريخي تلقائي.**

لا نغير المقياس، ولا نعيد ترميز البيانات، ولا ندخل `JOD = 1000` داخل عقد مستقبلي. إذا احتجنا عقدًا محايدًا لاحقًا، يذكر `scale` صراحةً.

#### Actor/Provenance

لن نضيف حقل Actor أو Provenance الآن. هذا تغيير في Schema والبيانات، ويؤجل إلى Auth/Workspace/Sync بقرار مستقل.

#### Result وError Codes

لن نحول Runtime Errors إلى `Result<T,E>` الآن. يمكن توثيق Error Codes لاحقًا، لكن تغيير شكل الأخطاء موجة سلوكية مستقلة.

## 4. المبادئ المعمارية النهائية

1. **Local-first:** القلب يعمل دون شبكة، وأي Python أو Sync مستقبلي تابع للحقيقة المحلية لا مالك لها.
2. **Modular Monolith:** تطبيق ونشر واحدان حاليًا، مع وحدات منطقية وحدود عامة واضحة.
3. **Information Hiding:** كل حد يخفي قرارًا قابلًا للتغير، لا مجرد مجموعة ملفات.
4. **Ownership قبل الحركة:** لكل مفهوم مالك واحد وموضع حساب واحد.
5. **Dependency inward:** Presentation → Application → Domain، وApplication تعتمد على Ports، وAdapters تنفذ Ports.
6. **Domain مستقل:** لا React، ولا Browser API، ولا IndexedDB، ولا Storage Adapter داخل Domain.
7. **Public doors only:** لا Deep Imports، ولا وصول إلى الملفات الداخلية لوحدة أخرى.
8. **Ports عند الحاجة:** لا Interface إلا عند وجود تنفيذ ثانٍ حقيقي أو Migration Driver مسمى ومقبول.
9. **Shared Kernel صغير:** فقط Primitive نقي محايد للغة، مستخدم من أكثر من وحدة، وبمالك وميزانية دخول.
10. **مصدر حقيقة واحد:** Read Models مشتقة وليست مصادر جديدة للمعادلات.
11. **التاريخ محفوظ:** لا تغيير صامت لمحتوى Snapshot أو تفسيره أو Schema أو Export/Import.
12. **Structure لا تختلط مع Semantics:** لا إصلاح مالي مخفي داخل نقل ملفات.
13. **Ratchet لا Rewrite:** نبدأ بتسجيل المخالفات، ثم نمنع زيادتها، ثم نشدد تدريجيًا.
14. **Reversibility:** كل موجة لها Base SHA وParity Oracle وRollback Boundary.
15. **Future by Trigger:** لا Dart أو Python أو Sync أو Service Extraction قبل حاجة مثبتة وقرار مالك.
16. **العقد يحدد المعنى، والحارس يفرضه:** العقود والسياسات المالية تفسر السلوك الحاكم؛ أما CI وGuards فتثبت خصائص محددة ولا تتغلب على عقد أو قرار مالك.
17. **التصحيح لا يمحو التاريخ:** لا تُعدّل السجلات أو اللقطات التاريخية بصمت. عند الحاجة يُستخدم Use Case تصحيح أو عكس أو حدث جديد وفق عقد المجال، ولا تُفرض قاعدة `append-only` العامة على كل نوع من البيانات دون تصنيف.
18. **الرجوع يخص الكود والبيانات معًا:** لا يوصف `git revert` بأنه آمن تلقائيًا بعد كتابة بيانات بالنمط الجديد؛ يجب فحص توافق القراءة وحد الرجوع وخطة استعادة البيانات لكل موجة.

## 5. التصنيف الصحيح قبل تحديد المجلدات

لا نقرر الآن هل الاسم النهائي هو `kernel` أو `foundation` أو `shared-kernel` أو `modules`. هذه أسماء تنفيذية تأتي بعد المسح والملكية.

### Business Module

يملك مفهومًا ولغةً ودورة حياة وقواعد متماسكة.

### Application

ينسق Use Cases، ويحدد حدود العملية، ويستعمل Ports، لكنه لا يخترع قاعدة مالية.

### Read Model

يجمع ويقرأ ويعرض من Public APIs، ولا يصبح مصدر حقيقة.

### Adapter

ينفذ IndexedDB أو Memory أو Transfer أو Clock أو Diagnostics، ولا يملك سياسة مالية.

### Contract Artifact

Schema أو DTO أو Error Code أو Test Vector أو Fixture. ليس مكانًا لمنطق العمل.

### Shared Kernel

Primitive نقي، بلا I/O أو React، مستخدم من وحدتين على الأقل، مع سجل مالك وقاعدة دخول.

### قواعد التصنيف

- `PRESERVE`: شيء سليم ومثبت، لا ينقل لمجرد النظافة.
- `REFRAME`: الملكية متماسكة لكن الاسم أو الواجهة غير واضحين.
- `MERGE`: نفس المالك ودورة الحياة ومصدر الحقيقة.
- `SPLIT`: ملكية أو لغة أو دورة حياة أو Invariant مستقلة، مع Consumer Inventory كامل.
- `DEFER`: فكرة مستقبلية أو مساحة رفيعة.
- `FIX_NOW`: توثيق أو Guard أو Drift دون تغيير معنى.
- `OUT_OF_SCOPE`: كود أو معنى أو Schema أو UI غير داخل الموجة.
- `OWNER_DECISION_REQUIRED`: تعارض لا يجوز تخمينه.

## 6. ما يجب تجميده قبل البداية

بما أن المستخدم قرر عدم تنفيذ أي إصلاح أو تطوير إلى أن تنتهي إعادة الهيكلة، نعتمد هذا التجميد التشغيلي:

- لا إصلاحات مالية جديدة؛
- لا Features جديدة؛
- لا UI أو CSS أو Copy أو Navigation؛
- لا Schema أو Migration أو Export/Import؛
- لا Backend أو API أو Sync؛
- لا Flutter أو Dart أو Kotlin أو Swift أو Python؛
- لا Cleanup أو Delete أو Archive؛
- لا نقل ملفات خارج الموجة الموافق عليها؛
- لا تغيير أسماء مفاهيم أو IDs؛
- لا PRs غير مرتبطة بالبرنامج البنيوي.

### استثناء الطوارئ فقط

إذا ظهر خطر وشيك لفقد بيانات أو ثغرة أمنية قابلة للاستغلال، يسجل كـIncident مستقل، ويعالج بأصغر Patch ممكن مع موافقة المالك واختبار ورجوع واضح. لا يجوز أن يتحول إلى فرصة لإعادة الهيكلة أو تغيير السلوك. بعده يعاد تثبيت خط الأساس وتتوقف الموجة المتأثرة حتى المراجعة.

### 6.1 شرط خروج مهمة تنظيف الوثائق قبل بدء الهيكلة

تنظيف الوثائق والتقارير والمهارات مسار مستقل يسبق إعادة الهيكلة، ولا يُخلط معها. لا تُعلن مهمة التنظيف منتهية لمجرد انتهاء Agent من القراءة أو إنشاء تقرير مختصر. يجب أن تتحقق الشروط الآتية:

1. وجود تقرير Markdown واحد كامل ومتحقق من وجوده ومحتواه.
2. وجود Manifest يصنف كل ملف داخل نطاق التنظيف دون صفوف مبهمة أو ملفات غير مصنفة بلا سبب.
3. تحديد مصدر واحد لكل مفهوم، مع تسجيل النسخ المكررة والتعارضات.
4. مراجعة المالك للتقرير وقبول قائمة الحذف والدمج والعزل قبل أي كتابة.
5. تنفيذ التنظيف المعتمد فقط في موجات منفصلة، ثم التحقق من الروابط والفهارس والحواجز.
6. تثبيت `main` وSHA جديد بعد إغلاق التنظيف، ثم استخدامه كخط أساس للهيكلة.

لا يبدأ Wave A البنيوي قبل تحقق هذه الشروط أو تسجيل سبب صريح يوافق عليه المالك لعدم تحقق أحدها.

### 6.2 القراءة المسموحة للتحقق دون توسيع النطاق

في مهمة تنظيف الوثائق، يجوز قراءة الكود والاختبارات والإعدادات بالقدر اللازم لإثبات أن وثيقة أو Script أو Test مستخدم أو غير مستخدم. هذه القراءة لا تفتح تحليلًا معماريًا جديدًا ولا تسمح بتعديل الكود. إذا تعذر التحقق من اعتماد ملف بسبب نقص الأدلة، يُصنف `OWNER_DECISION_REQUIRED` أو `DEFER` بدل التخمين.

## 7. خطة إعادة الهيكلة من A إلى Z

كل موجة تتطلب: دخول واضح، نطاقًا محدودًا، اختبارًا، مراجعة مالك، حد رجوع، وشرط توقف. لا تبدأ الموجة التالية تلقائيًا.

| الحرف | الموجة | ما الذي يحدث | شرط الخروج |
|---|---|---|---|
| **A** | Freeze & Charter | تثبيت التجميد، Base SHA، Structural-only، واستثناء الطوارئ. | اعتماد المالك للميثاق. |
| **B** | Scan Reconciliation | مقارنة المسح البنيوي المقبول مع `main` الحالي، دون إعادة ما هو صالح. | تقرير فجوات ومصادر أدلة واضح. |
| **C** | Read-only Structure Scan | فحص الوحدات، المسؤوليات، الأحجام والنمو، الآثار الجانبية والتهيئة، Public APIs، imports، cycles، الإعدادات والأسرار، الاعتماديات والأداة، التزامن والفشل والاستعادة، الأداء، الملفات المولدة، tests/docs، التخزين والتصدير. | تقرير مصنف إلى VERIFIED/INFERRED/UNVERIFIED مع سجل حجم ومسؤولية وتغطية كامل. |
| **D** | Parity Baseline | تثبيت نتائج الاختبارات، حتمية الاختبار، Export Goldens، Snapshots، Round-trips، Vectors، Error Identity، وإشارات الأداء والبدء عند تأثرها. | Baseline محفوظ ونتيجة Pass/Fail صريحة وحدود توافق ورجوع. |
| **E** | Findings Acceptance | تصنيف النتائج إلى FIX_NOW/PRESERVE/DEFER/OUT_OF_SCOPE/OWNER_DECISION_REQUIRED. | المالك يقبل المسح والخريطة. هذه بوابة Micro الإلزامية. |
| **F** | Ownership Registry | مفهوم ← مالكه ← مكان حسابه ← مستهلكوه ← تخزينه وتاريخه. | تغطية كاملة أو تعارضات مسجلة. |
| **G** | Architecture Target Rules | توثيق dependency direction، Public Surfaces، Shared Kernel rules، Naming aliases، Side Effects، Configuration Boundaries، Generated Ownership، Error/Recovery Boundaries. | قبول قواعد الهدف دون فرض مسارات مجلدات نهائية. |
| **H** | Guard Observe | تشغيل حراس Deep Imports وCycles وLayer Violations وRegistry Coverage وحجم/مسؤولية/نمو الملفات وGenerated Drift في وضع المراقبة. | Baseline Deterministic مع Exceptions واضحة. |
| **I** | Guard Ratchet | منع زيادة المخالفات، واختبارات إيجابية وسلبية للحراس، ومنع إضافة مسؤولية جديدة إلى ملف خطر دون استثناء. | CI يرفض مخالفة جديدة دون تعديل Production. |
| **J** | Public Surface Pilot | إنشاء Public Re-export فقط لوحدة لها مستهلك فعلي. | Typecheck واختبارات وGuard ناجحة. |
| **K** | Import Consolidation | إعادة توجيه Imports إلى Public API، دون تعديل أجسام الدوال. | انخفاض Deep Imports وعدم تغير Bundle أو السلوك. |
| **L** | File-Move Pilot | نقل ملف واحد فقط بعد Consumer Inventory وHash/Rename Identity. | الملف مطابق، الاختبارات خضراء، ولا Consumers مجهولين. |
| **M** | Measured Consolidation | تكرار K/L لوحدة مثبتة فقط، لا Mass Move. | تحسن مقاس في الحدود دون زيادة Coupling أو Chatter. |
| **N** | Port Inventory | جرد Port Candidates، خصوصًا LocalStore وCommit Guards، دون Split. | كل Method مصنف بمالك ومستهلك وسلوك. |
| **O** | Port Extraction | Capability Ports عند حاجة حقيقية، مع Facade توافقية. | Local وMemory ينجحان في نفس Contract Tests. |
| **P** | Adapter Boundary | عزل Concrete Storage/Transfer عن بقية التطبيق، دون إعادة كتابة Adapters أو تغيير Schema. | Conformance وRound-trip وEntity Touchpoints ناجحة. |
| **Q** | Test & Documentation Map | ربط كل Test وDocument وGenerated Artifact وOperational/Recovery Contract بوحدة أو Cross-cutting، دون حذف أو ترقيم جديد. | Coverage لا تنخفض، والوثائق تطابق Registry، والملفات المولدة لها مصدر واضح. |
| **R** | Semantic Repair Track | إصلاحات مثل Rounding أو Date أو Error Shape أو Quantity بشكل منفصل، إن اعتمدها المالك. | لا تُحسب Structural Completion إلا بعد مسارها المستقل. |
| **S** | Schema/Export Track | توثيق الصيغة الحالية أو Schema يدويًا عند Trigger، مع Backward Import. | لا تغيير Version أو Bytes أو Historical Meaning. |
| **T** | UI Boundary Track | يفتح فقط بقرار مالك؛ Read Models/Public APIs دون Visual Redesign. | UI Gate مستقل وRTL/سلوك الواجهة محفوظ. |
| **U** | Vector Portability | عند ظهور مستهلك غير TypeScript: Vectors للمال والتاريخ والحالات والأخطاء. | Vectors خضراء في TypeScript وعقودها واضحة. |
| **V** | Mobile Gate | عند وجود قرار حقيقي لتطبيق محمول: Spike منفصل Flutter أو Native. | نفس Vectors وParity قبل أي اعتماد. |
| **W** | Python/API Gate | عند حاجة API/Auth/Sync/Reporting حقيقية؛ Contract-first. | Python لا يملك Offline Financial Truth. |
| **X** | Service Extraction Assessment | دراسة استخراج Service فقط عند ثبات الحد ووجود فائدة مستقلة قابلة للقياس. | ADR بأرقام التشغيل والفشل والتكلفة والرجوع. |
| **Y** | Completion Audit | إعادة المسح، مطابقة Registry وTree وDocs وGuards وTests وVersions. | لا Drift غير مفسر، وكل Finding مغلق أو مقبول مؤجلًا. |
| **Z** | Closure & Moratorium | توثيق ما تم وما لم يتم، إغلاق البرنامج، وتثبيت الحراس كحماية دائمة. | توقيع المالك على Structural Completion. |

### 7.1 تقوية الخطة بعد مراجعة Claude AI

هذه الإضافات جزء من الخطة نفسها، وليست خطة بديلة:

1. **المقاييس قبل النقل:** قبل أول موجة كتابة، يُسجل خط الأساس لعدد الدورات، وDeep Imports، ومخالفات الطبقات، والحسابات المكررة، والمفاهيم بلا مالك، وملفات التوثيق غير المصنفة. لا نعلن تحسنًا بلا مقارنة رقمية.
2. **اختبارات السلوك قبل الهيكلة:** تُثبت Golden/Characterization Tests وContract Tests وRound-trip وExport Vectors قبل أول Move أو Import Rewrite يمس مستهلكًا حقيقيًا. المرحلة D شرط دخول، وليست توثيقًا اختياريًا لاحقًا.
3. **Fitness Functions قابلة للتشغيل:** كل قاعدة نريد حمايتها يجب أن يكون لها Guard أو اختبار أو فحص قابل للتكرار، مثل منع Deep Imports والدورات وزيادة مخالفات الطبقات ودخول قواعد المال إلى UI أو Storage. الوثيقة وحدها لا تكفي.
4. **سجل قرارات معماري ADR:** أي تغيير في حدود وحدة، أو مصدر حقيقة، أو Public API، أو Port، أو استثناء معماري يحتاج ADR يذكر السبب والبدائل والأثر وحالة القرار (`ACCEPTED` أو `SUPERSEDED`)، مع ربطه بالموجة والـSHA.
5. **سياسة الطبقات المؤقتة:** أي Facade أو Shim أو Compatibility Layer مؤقت يجب أن يملك مالكًا وسببًا وشروط إزالة ومؤشرًا يثبت متى يُزال. لا نسمح بتحول التوافق المؤقت إلى طبقة دائمة بلا قرار.
6. **عقد Agent:** يقرأ Agent المرجع الحاكم والحالة الحية وOwnership Map قبل التعديل، ويحدد مالك المفهوم، ولا ينشئ `utils` أو `common` عامة أو مجلدًا رئيسيًا جديدًا بلا ADR، ويتوقف عند الغموض المالي أو المعماري، ولا يضعف الحراس لتمرير الفحص.
7. **Handoff قصير:** ينتهي كل عمل Agent بملخص قصير يذكر ما تم، وما لم يتم، وSHA، والفحوص، والقرار المطلوب، وحد الرجوع. لا يُنشأ تقرير تاريخي طويل لكل جلسة.
8. **إصدار المرجع:** أي تحديث جوهري لهذه الخطة أو قواعدها يرفع رقم النسخة ويسجل التاريخ وسبب التغيير. لا يجوز أن يقرأ Agent نسخة قديمة دون أن يعرف أنها مستبدلة.

هذه الإضافات لا تمنح إذنًا لنقل الملفات أو تغيير السلوك. هي تقوي بوابات القياس، والاختبار، والقرار، والإنفاذ.

### 7.2 بوابة التغطية المهنية الإضافية قبل أي نقل

أثبتت المراجعة اللاحقة أن حصر الخطر في ثلاثة أسطح كبيرة لا يكفي. قبل أول Move أو Import Rewrite، يجب أن يثبت المسح الحالي أنه فحص النظام كاملًا، ثم صنّف كل نتيجة إلى `FIX_NOW` أو `PRESERVE` أو `WATCH` أو `DEFER` أو `OUT_OF_SCOPE` أو `OWNER_DECISION_REQUIRED`. لا يعني ذلك أن كل شيء سيُعاد تنظيمه؛ يعني فقط أن عدم التغيير قرار موثق لا شيء منسي.

يجب أن يغطي المسح الإضافي الآثار الجانبية والتهيئة، Public APIs والعقود، الإعدادات والبيئة والأسرار، حدود الأمان والصلاحيات، الاعتماديات والأداة، التزامن والفشل والاستعادة، دورة حياة الحالة والكاش والأحداث والإبطال، دورة حياة البيانات والنسخ الاحتياطي والاستعادة والاحتفاظ، الأداء والموارد، الملفات المولدة ومصادرها، حتمية الاختبارات، الترحيل والرجوع، المراقبة والتشخيص، قابلية إعادة البناء وتطابق بيئة الإصدار، ونظافة المستودع والتتبع. لكل سطح يجب أن يوجد دليل ونتيجة وتصنيف، دون كشف أسرار أو فتح مسار تنفيذ جديد.

### 7.3 معيار الملفات الكبيرة والمتوسطة والقريبة من الحد

تستخدم Micro الأرقام كإشارة مراجعة، لا كأمر تقسيم آلي:

| التصنيف الإرشادي | Non-blank LOC للملف الإنتاجي | الإجراء |
|---|---:|---|
| `NORMAL` | أقل من 400 | لا إجراء حجمي بحد ذاته |
| `WATCH` | 400–799 | مراقبة النمو ومنع إضافة مسؤولية غير مرتبطة دون مراجعة |
| `SPLIT_CANDIDATE` | 800–1,199 | تحليل مسؤوليات وخطة منع تضخم قبل إضافة نطاق جديد |
| `SPLIT_NOW` | 1,200 فأكثر مع تعدد مسؤوليات، أو أي حجم مع خرق حدود خطير | بطاقة تقسيم ومستهلكون واختبارات قبل النقل |

ملف كبير ذو مسؤولية واحدة متماسكة قد يبقى مع سبب ومالك وحد نمو؛ وملف صغير مختلط الطبقات قد يحتاج تقسيمًا. ملفات الاختبار وFixtures والملفات المولدة والإعدادات لها تصنيف منفصل.

ينشأ `FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md` داخل مساحة إعادة الهيكلة، ويغطي كل ملف في نطاق المسح مع المسار، الحجم، الصادرات، الاستيرادات، المستهلكين، المسؤوليات، الآثار الجانبية، الاختبارات، مصدر الحقيقة، حالة النمو، المالك، الإجراء، وأثر الرجوع. يضاف حارس تدريجي يمنع زيادة جديدة في `SPLIT_NOW` وينبه عند عبور حد، مع استثناء موثق بمالك وسبب وتاريخ مراجعة.

## 8. ما يبقى خارج إعادة الهيكلة

### مسار مستقل للمعنى المالي

أي مشكلة في Rounding أو Quantity أو Date أو Error Identity أو Duplicate Calculation أو Immutability لا تُصلح داخل نقل الملفات. لها بطاقة إصلاح وقرار واختبارات مستقلة.

### مسار مستقل للتخزين والتصدير

لا تغيير في Schema أو Export Version أو Migration أو Historical Reader داخل Structural Refactor.

### مسار مستقل للواجهة

UI/UX وCSS وTSX وCopy وNavigation مغلقة حتى يفتحها المالك، ومنفصلة عن مشروع التصميم الجديد.

### مسار مستقل للمستقبل

Dart وFlutter وKotlin وSwift وPython وAPI وSync وAuth وMicroservices لا تدخل هذا البرنامج إلا عند Trigger واضح.

## 9. شروط Structural Completion

لا نعلن الانتهاء لأن المجلدات أصبحت أجمل. تنتهي إعادة الهيكلة فقط عندما:

1. يكون المسح الحي مصالحًا ومقبولًا، ويغطي سجل الحجم والمسؤولية والنمو والأسطح المهنية الإضافية؛
2. يكون Registry يغطي الوحدات والمفاهيم والمستهلكين؛
3. تعمل Guards في CI وتمنع الزيادة؛
4. يكون كل Move أو Import Rewrite مدعومًا بـConsumer Inventory؛
5. تبقى الاختبارات وSnapshots وExports وBackward Imports متكافئة؛
6. لا يتغير Schema أو Export أو Historical Interpretation؛
7. لا يتسلل UI أو Future Platform إلى Structural Diff؛
8. لا يوجد Duplicate Financial Computation غير مفسر؛
9. تكون كل الاستثناءات والـWaivers مسجلة ولا تزداد، ولا توجد ملفات `SPLIT_NOW` أو مخاطر مهنية غير مصنفة؛
10. يراجع المالك Completion Audit ويوقع الإغلاق؛
11. يدخل النظام بعدها في Moratorium يمنع Structural Expansion بلا سبب مقاس وقرار جديد.

## 10. قرارات المالك التي تحجب التقدم فعلًا

لا تحتاج إلى اتخاذ قرارات حول أسماء مجلدات أو أدوات صغيرة الآن. القرارات الحاجبة هي:

1. اعتماد التجميد وWave A؛
2. قبول المسح ونتائجه قبل أي تغيير بنيوي؛
3. قبول Ownership Map قبل أي Merge أو Split أو Move؛
4. تثبيت مقياس Micro الحالي للمال دون Migration؛
5. فتح أي Semantic Track منفصل؛
6. فتح Schema/Export Track منفصل؛
7. فتح UI Track؛
8. اعتماد Trigger حقيقي لـDart/Python/API/Sync/Service Extraction؛
9. قبول Completion Audit والإغلاق النهائي.

## 11. الخلاصة التنفيذية

نعم، أنت على الطريق الصحيح، لكن ليس المطلوب «إعادة كتابة النظام حتى يصبح مثاليًا». المطلوب هو:

> **تجميد التغيير، إثبات الوضع الحالي، تحديد ملكية كل مفهوم، وضع حراس دائمة، ثم إصلاح الحدود التي يثبت المسح أنها تحتاج إصلاحًا، مع إبقاء السلوك المالي والتاريخي كما هو.**

بهذا نمنع:

- إعادة هيكلة ثالثة؛
- تغييرًا ماليًا مخفيًا؛
- بناء Flutter أو Python مبكرًا؛
- نقل ملفات لا نعرف مستهلكيها؛
- تضخمًا جديدًا في `shared` أو `utils` أو `services`؛
- خلط UI مع القلب المالي.

**لا يوجد في هذا الملف تفويض تنفيذ.** بعد اعتمادك للرأي والخطة فقط ننتقل إلى Wave A ثم B/C كمسح ومصالحة وقراءة، ولا نبدأ نقل الملفات قبل بوابة Micro وموافقة المالك.

## سجل التحديث

### v1.1 — 2026-10-01

دُمجت الملاحظات المفيدة من مراجعة Claude AI داخل الخطة نفسها: شرط خروج تنظيف الوثائق، حدود القراءة للتحقق من اعتماد الملفات، المقاييس القابلة للمقارنة، Golden/Characterization وContract Tests كشرط دخول، Fitness Functions، ADRs، سياسة الطبقات المؤقتة، عقد Agent، Handoff المختصر، وإصدار المرجع. كما ثُبت أن العقود تحدد المعنى وأن الحراس تفرض خصائص محددة فقط، وأن التصحيح لا يمحو التاريخ وأن الرجوع البرمجي لا يُفترض أنه آمن للبيانات تلقائيًا.

لم تُفتح منصة جديدة، ولم يتغير مقياس Micro المالي، ولم يتغير أي عقد أو Schema أو Export/Import أو سلوك إنتاجي نتيجة هذا التحديث.

## References

**[S1]:** Martin Fowler, "Monolith First" — https://martinfowler.com/bliki/MonolithFirst.html
**[S2]:** Simon Brown, "Modular monoliths and package by component" — https://simonbrown.je/modular-monolith/
**[S3]:** Microsoft, "Identify microservice boundaries" — https://learn.microsoft.com/en-us/azure/architecture/microservices/model/microservice-boundaries
**[S4]:** Stefan Tilkov, "Don’t start with a monolith — when your goal is a microservices architecture" — https://martinfowler.com/articles/dont-start-monolith.html
**[S5]:** Auer et al., "From monolithic systems to Microservices: An assessment framework" — https://www.sciencedirect.com/science/article/pii/S0950584921000793
**[S6]:** "Evolution of microservices identification in monolith decomposition: A systematic review" — https://ieeexplore.ieee.org/abstract/document/10431792/
**[S7]:** David Parnas, "On the Criteria To Be Used in Decomposing Systems into Modules" — https://dl.acm.org/doi/10.1145/361598.361623
**[S8]:** Sangal et al., "Using Dependency Models to Manage Complex Software Architecture" — https://dl.acm.org/doi/10.1145/1094811.1094824
**[S9]:** MacCormack, Baldwin, Rusnak, "Exploring the Structure of Complex Software Designs" — https://pubsonline.informs.org/doi/abs/10.1287/mnsc.1060.0552
**[S10]:** Kim et al., "A Field Study of Refactoring Challenges and Benefits" — https://dl.acm.org/doi/10.1145/2393596.2393655
**[S11]:** CMU SEI, "Why Architecture Conformance Matters for Software Systems" — https://www.sei.cmu.edu/library/why-architecture-conformance-matters-for-software-systems/
**[S12]:** Opdyke and incremental migration guidance — https://www.laputan.org/pub/papers/opdyke-thesis.pdf ; https://martinfowler.com/bliki/BranchByAbstraction.html ; https://martinfowler.com/bliki/StranglerFigApplication.html
**[S13]:** Eric Evans, "Domain-Driven Design Reference" — https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf
**[S14]:** Protocol Buffers, Avro, RFC 8259, RFC 8785 — https://protobuf.dev/overview/ ; https://avro.apache.org/docs/1.11.1/specification/ ; https://www.rfc-editor.org/rfc/rfc8259.html ; https://www.rfc-editor.org/rfc/rfc8785.html
**[S15]:** Local-first, Android architecture, and OpenAPI — https://dl.acm.org/doi/10.1145/3359591.3359737 ; https://developer.android.com/topic/architecture ; https://www.openapis.org/what-is-openapi

**Final status:** `OWNER_REVIEW_REQUIRED`
**Implementation authorized:** `NO`
**Repository modified:** `NO`
**Unrelated development:** `FROZEN`
**First allowed wave:** `READ_ONLY STRUCTURE/ARCHITECTURE/CODE ORGANIZATION SCAN AFTER OWNER GATE`
