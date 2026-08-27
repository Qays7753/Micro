# Micro — عقد تصنيف بيانات الشبكة وقاموس الحقول N-06

**الحالة:** `CURRENT / EXPANSION E-00 / CONTRACT ONLY`
**المالك:** Manus Agent 1
**تاريخ القرار:** 27 أغسطس 2026

## Major Discussion Points

## 1. سؤال القرار والنطاق

يعالج هذا العقد سؤالًا محددًا: **«ما الحد الأدنى من الحقول التي يحتاجها كل سجل شبكي، وما درجة حساسيتها، ومتى يسمح بعرضها أو الاحتفاظ بها؟»**

الهدف ليس تخطيط جداول جاهزة أو جمع بيانات شاملة. الهدف منع تضخم الحقول ومنع أن تقرر شاشة أو API لاحقًا أن اسمًا أو سعرًا أو هاتفًا «مفيد حتمًا» بلا غرض وScope وموافقة. الأسماء أدناه مفردات مشتركة قابلة للتعديل قبل schema، وليست جداول قاعدة بيانات منفذة.

## 2. تصنيف موحد للبيانات

| التصنيف | أمثلة | قاعدة الجمع والعرض |
|---|---|---|
| `manage_private` | كاش، دين، ربح، CostSnapshot، عميل، Export محلي. | لا يدخل الشبكة في L أو A إلا قرار ربط مستقل محدد. |
| `network_identity_private` | وسيلة استعادة أو تعريف شخص عند A. | أقل مقدار ممكن، في طبقة هوية محكومة لا في Listing أو Attention. |
| `workspace_private` | عضو جهة، إعداد تشغيلي، سبب داخلي. | للعضوية المخولة فقط؛ لا يعرض في Search. |
| `public_after_approval` | اسم Listing ووصفه وصورة/منطقة عامة معتمدة. | لا ينشر قبل Moderation وحالة نشر صريحة. |
| `interaction_scoped` | كمية/وحدة/نافذة Need، رد مورد، Quote. | يظهر فقط للجهة والدور والتفاعل المبرر. |
| `delivery_scoped` | عنوان/هاتف/تعليمات حمل أو تسليم. | لا يكشف قبل Scope وPreview وموافقة Owner أو طالب الحركة. |
| `audit_restricted` | فاعل، فعل، وقت، مرجع، سبب قرار. | يستخدم للمسؤولية؛ لا يتحول إلى تقييم شخصية أو Feed عام. |

## 3. قاموس الحقول الأدنى

| الكيان | الحقول الأدنى | تصنيف الحقول | لا تضف الآن |
|---|---|---|---|
| `network_identity` | `id`، حالة الهوية، تاريخ إنشاء/تعطيل. | identity private. | لقب عام، سمعة، ملاحظات داخلية، بيانات مالية. |
| `network_workspace` | `id`، نوع الجهة، اسم عرض، حالة، tenant key. | workspace/private أو public حسب الحالة. | أرصدة، اشتراك، KPIs أو تقييم. |
| `network_membership` | identity، workspace، role، status، created/ended، inviter ref. | workspace private/audit. | صلاحيات حرة بلا Role، كلمات مرور. |
| `service_attention` | source، subject ref، state، next action، updated at، recipient ref. | interaction scoped. | مبلغ، هاتف، محتوى كامل، score أو urgency مصطنع. |
| `network_notification` | recipient، type، subject ref، created/read at. | role private. | اعتبار `read` قبولًا أو تغيرًا للحالة. |
| `market_need` | owner/workspace ref، title/description، category، area، unit/quantity optional، window optional، status. | interaction scoped. | عميل، Snapshot، ربح، سعر بيع، كامل Inventory. |
| `market_response` | need ref، supplier/workspace ref، offer description، price/range optional، unit optional، readiness optional، status. | interaction scoped. | اتفاق دفع، receipt، Rating أو بيانات منافس. |
| `supplier_listing` | workspace ref، name، category، description، area، unit/range optional، publish status. | private ثم public approved. | inventory live، SKU إلزامي، pricing engine، customer data. |
| `listing_media` | listing ref، owner ref، private object ref، review/public status، created at. | private ثم public approved. | public URL دائم أو metadata لا يلزم المراجعة. |
| `delivery_request` | requester/workspace ref، direction، general scope، window، package description optional، status. | interaction/delivery scoped. | عنوان/هاتف تلقائي أو cash/collection أو order complete. |
| `delivery_quote` | request ref، courier/workspace ref، amount/range optional، currency declared if included، availability, expiry, status. | interaction scoped. | Expense أو payment status أو pricing recommendation. |
| `delivery_assignment` | accepted quote ref، courier workspace ref، disclosure scope، current status. | delivery scoped. | GPS stream أو Driver account افتراضي. |
| `delivery_status_event` | assignment ref، prior/next status، actor, occurred at، source، reason optional. | delivery/audit restricted. | إثبات دفع أو استلام مخزون/تسليم Order. |
| `network_audit_event` | workspace/actor/action/subject/result/occurred at/reason optional. | audit restricted. | secret أو token أو full private payload. |

## 4. قواعد الحقول المالية والتاريخية

إذا حمل Quote أو Response مبلغًا، فهو **معلومة أعلنها الطرف الخارجي** لا التزام مالي أو مصروف أو قيمة معترف بها. يحدد عقد العملة/التقريب لاحقًا تمثيلًا دقيقًا قبل الكود؛ لا يستعمل Float في Domain ولا `0` بدل عدم المعرفة. لا ينقل هذا المبلغ إلى JOD minor في Manage أو إلى نتيجة مالية بلا إدخال Owner مستقل.

كل الكيانات الشبكية تحتاج معرفًا مستقرًا ووقت إنشاء وتحديث وفاعلًا وفق حساسيتها. لا يعني `updated_at` أن الحدث التاريخي أعيد كتابته؛ Status Events وDecisions المحكومة تحفظ حدثًا/سببًا منفصلين أو Revision، ولا تستعمل Update صامتًا لمحو ما قاله طرف سابق.

## 5. قواعد إضافة أو إزالة حقل

لا يضاف حقل إلا بعد الإجابة المكتوبة: من يحتاجه؟ في أي موقف؟ لماذا لا يكفي بديل أخف؟ ما التصنيف؟ من يراه في كل مرحلة؟ متى ينتهي غرضه؟ ما اختبار رفض الوصول؟ وما أثره على Manage والتصدير والاستعادة؟ الحقل الذي لا يملك هذه الإجابات يبقى خارج Schema وواجهة الإدخال.

لا يحذف حقل حساس أو Listing/Response/Status/Audit بلا أثر. يحدد عقد Migration/Retention لاحقًا إن كان الإخفاء أو الإيقاف أو الحذف المبرر ممكنًا، ولا يقرر Agent هذا في Feature PR.

## 6. سيناريوهات القبول

| الحالة | النتيجة المطلوبة |
|---|---|
| Owner ينشر Need من سياق مادة في Manage | لا ينسخ Snapshot أو الكاش أو عميل أو سعر البيع؛ يظهر Preview للحقول المختارة فقط. |
| Supplier يضيف صورة | يبقى object خاصًا ومربوطًا بـListing وحالة Review، لا URL عام دائم. |
| Courier يقدم Quote بمبلغ | يظهر بوصفه عرضًا معلنًا، لا Expense ولا قيمة مالية معترف بها. |
| Admin يقرأ Audit | يرى الحد الأدنى من الفعل/الفاعل/السبب، لا أسرارًا أو مال Manage. |
| API Search | يعيد الحقول العامة أو scoped فقط بعد Policy، لا تمام Row داخلي. |

## Action Points

- [ ] قبل E-01، تتحول المفردات إلى Schema/DTO بعد مراجعة كل حقل لا قبله.
- [ ] قبل أي حقل Payment أو Phone أو GPS أو Rating أو Analytics، ينشأ عقد قرار مستقل بسبب ومصفوفة وصول وتقييم خصوصية.
- [ ] أي تغير في التصدير المحلي أو Schema Manage يوقف هذه الشريحة ويخضع لعقد Migration/Export/Import مستقل.

## References

[1]: [عقد الهوية والوصول](18-network-identity-workspace-access-contract.md)
[2]: [عقد دورة البيانات والاستعادة](23-network-data-lifecycle-recovery-contract.md)
[3]: [مصفوفة الأدوار والوصول](../expansion/ROLE-ACCESS-MATRIX.md)
