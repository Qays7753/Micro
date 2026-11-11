# Expansion — قرار المعمارية التقنية قبل الكود

**الحالة:** `CURRENT / E-00 / ARCHITECTURE BOUNDARY + OWNER PLATFORM DIRECTION (EX-D18)`
**لا يختار بنفسه:** كان هذا الملف قبل 2026-11-12 لا يختار مزودًا؛ **اختار المالك صراحةً منصة Cloudflare للنموذج المتصل في 2026-11-12 (EX-D18 في `DECISIONS.md` §1)** ضمن حدود §6 أدناه — والاختيار اتجاه معماري مملوك للمالك، لا تفعيل موارد ولا حساب مزود.

## Major Discussion Points

## 1. القرار المعماري

عند التفعيل المتصل لاحقًا، تبنى طبقة الشبكة كـ**Modular Monolith** ضمن مشروع Micro، وبـBounded Context مستقل عن Manage المحلي. لا تبدأ Microservices ولا نسخ Manage إلى السحابة ولا SQL/ORM داخل React أو Domain. هذا أصغر شكل يسمح بتطبيق هوية وعزل وسجل تدقيق ووسائط وإشعارات لاحقًا مع بقاء العقود قابلة للاختبار والاستبدال.

```text
Micro Owner Experience
  ├─ Manage local-first: Presentation → Application → Domain → PrototypeLocalStore → IndexedDB
  └─ Network capabilities: Presentation → Application → Network Domain → Ports → Connected Adapters
       ├─ Identity / Membership
       ├─ Network data / policy
       ├─ Private media
       ├─ In-app attention / notification
       └─ Audit
```

لا يقرأ `Network Domain` IndexedDB أو React أو مزودًا محددًا، ولا يستطيع Adapter الشبكة أن يكتب حدث Manage. أي جسر هو Application Use Case اختياري يمر بمدخلات Owner وإظهار أثره قبل حفظه داخل Manage.

## 2. قرارات ثابتة قبل اختيار التقنية

| القرار | السبب | أثره على التنفيذ لاحقًا |
|---|---|---|
| Contextان منفصلان: `manage` و`network` | يحمي المال والتاريخ المحليين من حركات شبكة خارجية. | Types وPorts وUse Cases منفصلة؛ لا استيراد Domain شبكة في منطق المال دون عقد جسر. |
| Contracts أولًا | حالات Need/Quote/Status/Moderation لا تتغير مع تغيير مزود. | DTO/Schema بعد العقد واختبار Use Case قبل Adapter. |
| API/DB/File policy دفاع متعدد الطبقات | لا تحقق واجهة وحده عزلًا. | identity + membership + policy في كل Query/Mutation/File/Search/Export. |
| in-app attention أساس | Push والهاتف والخلفية ليست ضمانًا مبكرًا. | Notification سجل دائم قابل للعرض داخل Market أو Delivery بحسب مصدره؛ Push إضافة لاحقة فقط. |
| Media خاصة قبل النشر | الصور قد تكشف محتوى أو معلومات حساسة. | object private، قرار Moderation، وصول قصير/متحقق، لا URL عام دائم. |
| لا نقل Manage بلا Migration contract | السجل المالي والتصدير لا يتحملان نسخًا تدريجيًا مبهمًا. | Network يبدأ فارغًا ومفصولًا؛ أي جسر/ترحيل PR منفصلة. |

## 3. Ports المستقبلية الأدنى

| Port | يستقبل/يعيد | لا يسمح له |
|---|---|---|
| `NetworkIdentityPort` | سياق هوية وجلسة وMembership موثقة. | حق عالمي أو وصول Manage. |
| `NetworkPolicyPort` | قرار يسمح/يرفض فعلًا أو حقلًا في Scope محدد. | منطق عرض أو تجاوز DB/API. |
| `NetworkRepositoryPort` | كيانات Network وعملية idempotent. | تنفيذ SQL داخل Domain أو كتابة Manage. |
| `NetworkMediaPort` | طلب رفع خاص/حالة Review/قراءة مخولة. | URL عام قبل policy أو Media بلا Owner. |
| `NetworkAttentionPort` | Attention/Notification مملوكة لمستلم. | Push كحقيقة أو تغير حالة ذاتي عند القراءة. |
| `NetworkAuditPort` | Audit append-only محدود. | حذف صامت أو تخزين أسرار/مال خاص. |
| `ManageContextPort` | سياق اختياري اختاره Owner أو تسجيل suggestion. | استخراج كل Manage أو حفظ مال من Event خارجي. |

هذه واجهات تصميمية فقط. لا يخلق Agent ملفًا برمجيًا أو package أو configuration من هذه القائمة إلا في E-01 وبعد مقارنة تقنية وقرار مالك.

## 4. تشغيل وإشعارات وتكاملات

لا نفترض WebSocket أو worker مستمر أو polling كثيف أو webhooks أو تطبيق هاتف أصلي أو API لشركة توصيل. يبدأ المسار المتصل مستقبلاً بطلبات/استجابات عادية وسجل attention داخل التطبيق. أي تدفق «عند حدوث X افعل Y» يحتاج تقييم trigger ووقت الاستجابة ومزود وقدرة تشغيل وتكلفة قبل البناء.

لا ندمج WhatsApp أو SMS أو خرائط أو APIs خارجية أو AI Matching في E-01–E-04. وجودها كفكرة لا يثبت availability أو صلاحية أو حاجة أو موافقة مشاركة بيانات.

## 5. بوابة اختيار المزود عند A

قبل اختيار مزود، تقارن الخيارات على: عزل tenant في DB وAPI وfile، الاستعادة والنسخ، سرية الأسرار، audit، تكلفة النمو، سياسة بيانات الأردن/السوق المقصود، قابلية الاختبار المحلية، قابلية الاستبدال، وملاءمة modular monolith. لا تختار أسرع starter أو ما ظهر في مثال GitHub. يوثق القرار وبدائله ونسخ الاعتمادات وترخيصها وسبب الملاءمة في PR مستقلة.

## 6. قرار المالك المعماري المؤرخ 2026-11-12 — منصة Cloudflare (EX-D18)

اختار المالك صراحةً منصة Cloudflare للنموذج المتصل لـMarket/Delivery (ترخيص بوابة الكود في أمر التنفيذ المعدَّل لحزمة التسليم، التزام `ce21b786`)، والقرار مسجل canonically في `DECISIONS.md` §1 (EX-D18). بنية المنصة ضمن الشكل المعياري في §1: Cloudflare Pages لواجهة Micro الحالية، وBFF متوافق مع Pages Functions/Workers ضمن النشر والمستودع نفسه (Modular Monolith كما هو)، وD1 خلف منفذ `NetworkRepositoryPort` لبيانات شبكة Market/Delivery فقط، وR2 خلف `NetworkMediaPort` للصور وأدلة السائق الخاصة، ودخول Google عبر هوية Micro (§العقد 18) — ولا Supabase ولا Firebase ولا Cloudflare Access بديلًا عن أدوار المستخدمين.

**أربع طبقات تمييز ملزمة لا يجوز الخلط بينها:**

| الطبقة | الحالة في 2026-11-12 |
|---|---|
| (أ) اتجاه اختاره المالك | Cloudflare Pages للواجهة + BFF متوافق مع Pages Functions/Workers ضمن النشر نفسه + D1 لبيانات شبكة Market/Delivery + R2 للصور وأدلة السائق الخاصة + دخول Google عبر هوية Micro؛ بلا Supabase وبقيد الطبقة المجانية أولًا. |
| (ب) كود منفذ في المستودع | ما يُنفذ على فرع التسليم `zai/micro-market-delivery-handoff-20261111` بمطالبة Control الخاصة به (WS-249): كود متوافق مع Workers/Pages وترحيلات D1 ومسارات R2 خاصة ومحاكاة محلية بالفحص — الكود جاهزية للتهيئة لا تشغيل حي. |
| (ج) موارد غير مُهيأة بعد | لا يوجد في المستودع حساب Cloudflare ولا معرف مورد ولا سر: إنشاء مشروع Pages الموجود وربط D1/R2 والأسرار والنطاقات على المالك/Manus بعد التسليم وفق خطوات التسليم الموثقة. |
| (د) قرارات Manage مستمرة مفتوحة | لا نقل لبيانات Manage المالية إلى D1/R2 ولا ربط حدث شبكة بحدث مالي؛ بوابة Migration (`MANAGE-NETWORK-MIGRATION-EXPORT-GATE.md`) و41/34 و29 زوجًا محفوظة؛ أي جسر مستقبلي قرار مالك مستقل. |

معايير المقارنة في §5 تُقرأ الآن هكذا: الاختيار حسمها المالك؛ ويبقى إثبات المعايير (عزل/استعادة/أسرار/تدقيق/تكلفة/قابلية اختبار محلي/استبدال) واجبًا يُقدم بالكود والفحص المحلي وخطوات المالك/Manus قبل أي قبول متصل، وأي نقطة يثبت الفحص استحالتها ضمن الطبقة المجانية تُوقف وتُعرض بخياراتها وتكلفتها بدل التحويل الصامت لمزود آخر.

## Action Points

- [x] ~~قبل E-01، يكتب قرار مزود مستقل ومقارنة خيارات واختبار عزل صغير؛ لا يثبت خيارًا ضمن هذا الملف.~~ **حُسم اختيار المالك 2026-11-12 بEX-D18 (Cloudflare)؛ إثبات المقارنة يقدم بالكود والفحص المحلي وخطوات التهيئة، لا بقرار الملف هذا.**
- [ ] قبل أي API، تحول حالات العقود 18–24 إلى Use Cases وPorts واختبارات رفض/إيجابيات، ثم يبنى Adapter.
- [ ] إذا احتاج العمل استجابة فورية أو تكامل خارجي، يكتب تقييم تشغيل وتكلفة وخصوصية قبل طلب استضافة/عامل دائم أو webhook.

## References

[1]: [عقود E-00](../contracts/)
[2]: [مصفوفة الوصول](ROLE-ACCESS-MATRIX.md)
[3]: [عقد دورة البيانات والاستعادة](../contracts/23-network-data-lifecycle-recovery-contract.md)
