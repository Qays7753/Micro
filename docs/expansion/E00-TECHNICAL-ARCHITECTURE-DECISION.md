# Expansion — قرار المعمارية التقنية قبل الكود

**الحالة:** `CURRENT / E-00 / ARCHITECTURE BOUNDARY ONLY`
**لا يختار:** مزود قاعدة بيانات أو Auth أو ملف أو إشعار، ولا يصرح بتنفيذها.

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

## Action Points

- [ ] قبل E-01، يكتب قرار مزود مستقل ومقارنة خيارات واختبار عزل صغير؛ لا يثبت خيارًا ضمن هذا الملف.
- [ ] قبل أي API، تحول حالات العقود 18–24 إلى Use Cases وPorts واختبارات رفض/إيجابيات، ثم يبنى Adapter.
- [ ] إذا احتاج العمل استجابة فورية أو تكامل خارجي، يكتب تقييم تشغيل وتكلفة وخصوصية قبل طلب استضافة/عامل دائم أو webhook.

## References

[1]: [عقود E-00](../contracts/)
[2]: [مصفوفة الوصول](ROLE-ACCESS-MATRIX.md)
[3]: [عقد دورة البيانات والاستعادة](../contracts/23-network-data-lifecycle-recovery-contract.md)
