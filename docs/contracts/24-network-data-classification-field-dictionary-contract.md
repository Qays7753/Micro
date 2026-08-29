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
| `delivery_scoped` | عنوان/هاتف/تعليمات حمل أو تسليم. | لا يكشف قبل Scope وPreview وموافقة الجهة التي ينتمي إليها صاحب البيانات: يوافق Owner على بيانات عميله، وتوافق كل جهة على بياناتها (منها عنوان Owner كوجهة واسم/رقم منفذ الحركة عند الساعي)، وطلب حركة ينشئه مورد وجهته Owner لا ينكشف منه شيء قبل معاينة Owner صريحة. يُسند كل إفصاح إلى سجل `consent_record`. |
| `audit_restricted` | فاعل، فعل، وقت، مرجع، سبب قرار. | يستخدم للمسؤولية؛ لا يتحول إلى تقييم شخصية أو Feed عام. |

**قاعدة موافقة صاحب البيانات (تعديل E-11):** الموافقة تعود للجهة التي ينتمي إليها صاحب البيانات، لا إلى «طالب الحركة» أيًّا كان: بيانات عميل المالك تكشف بموافقة Owner ومعاينته؛ بيانات جهة التوصيل نفسها (اسم منفذ الحركة ورقمه) تكشف بموافقة جهتها؛ وعندما يكون Owner هو وجهة الطلب لا يكشف عنوانه إلا بمعاينته صريحة. تبقى **ميكانيكا موافقة العميل النهائي نفسه** (هل يُطلع العميل أو يوافق؟ وبأي نص؟) سؤالًا مفتوحًا مؤجلًا إلى المراجعة القانونية (EX-O14 في `DECISIONS.md`)، ولا يعتبر غيابها اليوم رضًا ضمنيًا.

## 3. قاموس الحقول الأدنى

| الكيان | الحقول الأدنى | تصنيف الحقول | لا تضف الآن |
|---|---|---|---|
| `network_identity` | `id`، حالة الهوية، تاريخ إنشاء/تعطيل. | identity private. | لقب عام، سمعة، ملاحظات داخلية، بيانات مالية. |
| `network_workspace` | `id`، نوع الجهة، اسم عرض، حالة، tenant key. | workspace/private أو public حسب الحالة. | أرصدة، اشتراك، KPIs أو تقييم. |
| `network_membership` | identity، workspace، role، status، created/ended، inviter ref. | workspace private/audit. | صلاحيات حرة بلا Role، كلمات مرور. |
| `network_attention` | source، subject ref، state، next action، updated at، recipient ref، **مستوى إلحاح مبرر** (يستنبط من موعد أو نافذة موثقة فقط: قرار مطلوب / موعد قريب / معلومات). | interaction scoped. | مبلغ، هاتف، محتوى كامل، score أو urgency مصطنع أو محسوب، أو صندوق خدمات مركزي. |
| `network_notification` | recipient، type، subject ref، created/read at. | role private. | اعتبار `read` قبولًا أو تغيرًا للحالة. |
| `market_need` | owner/workspace ref، title/description، category، area، unit/quantity optional، window optional، status. | interaction scoped. | عميل، Snapshot، ربح، سعر بيع، كامل Inventory. |
| `market_response` | need ref، supplier/workspace ref، offer description، price/range optional (تمثيل minor وفق العقد 25)، unit optional، readiness optional، status. | interaction scoped. | اتفاق دفع، receipt، Rating أو بيانات منافس. |
| `supplier_listing` | workspace ref، name، category، description، area/coverage declared، unit/range optional، publish status. | private ثم public approved. | inventory live، SKU إلزامي، pricing engine، customer data أو تغطية مضمونة. |
| `listing_media` | listing ref، owner ref، private object ref، review/public status، created at. | private ثم public approved. | public URL دائم أو metadata لا يلزم المراجعة. |
| `delivery_request` | requester/workspace ref، direction، general scope، window، package description optional، `vehicle_requirement` optional after Wedge، status. | interaction/delivery scoped. | عنوان/هاتف تلقائي أو cash/collection أو order complete أو سيارة/سائق محدد. |
| `delivery_quote` | request ref، courier/workspace ref، amount/range optional (تمثيل minor وفق العقد 25؛ عملة واحدة JOD حتى حسم EX-O13)، availability، expiry، status. | interaction scoped. | Expense أو payment status أو pricing recommendation. |
| `delivery_assignment` | accepted quote ref، courier workspace ref، disclosure scope، current status. | delivery scoped. | GPS stream أو Driver account افتراضي. |
| `delivery_status_event` | assignment ref، prior/next status، actor, occurred at، source، reason optional. | delivery/audit restricted. | إثبات دفع أو استلام مخزون/تسليم Order. |
| `network_audit_event` | workspace/actor/action/subject/result/occurred at/reason optional. | audit restricted. | secret أو token أو full private payload. |
| `network_invitation` | inviter ref، workspace ref، role، status، expiry، استخدمات محدودة (used/limit)، created at. | workspace private/audit. | دعوة دائمة أو مفتوحة الاستخدام أو صلاحية تتجاوز الدور المحدد أو أي بيانات Manage. |
| `network_access_decision` | actor ref، action، subject ref، decision، reason optional، occurred at. | audit restricted. | تنفيذ القرار في الواجهة فقط، أو تخزينه بلا مرجع سجل، أو احتواؤه secret أو token. |
| `external_reference` | owner ref، network record ref، source type، reference id، intent، created at. | interaction scoped من جهة الشبكة؛ لا يمنح الطرف الخارجي أي قراءة لسياق Manage. | نسخ payload من Manage أو مزامنة تلقائية أو صلاحية قراءة متبادلة. |
| `recording_suggestion` | owner ref، external ref، suggestion type، status، explanation. | role private للمالك. | تعبئة مبلغ أو تاريخ أو نوع حدث أو حساب كاش، أو اقتراح مالي بلا مرجع يبرره. |
| `delivery_exception` | request/assignment ref، classification (عدد محدود وفق العقد 21 §3.3)، status (`open` / `resolved` / `closed_unresolved`)، responsible next party، reason، evidence refs، created/updated at. | delivery/audit restricted. | حذف تاريخ المهمة، أو وضع «مكتمل» لإخفاء المشكلة، أو لوم طرف بلا حدث موثق. |
| `market_decision` | subject ref، decision، actor، occurred at، reason optional. | audit restricted (ويظهر للطرف المعني ملخصًا يخصه فقط). | تعديل قرار سابق أو محو التاريخ أو قرار بلا فاعل ووقت. |
| `consent_record` | consenter ref، consent scope، subject ref، consented at، valid until، revoked at. | audit restricted. | اعتباره بديلًا عن سياسة الاحتفاظ القانونية، أو ترحيل محتوى كامل معه، أو سحب صامت بلا أثر. |
| `courier_company_profile` ⚠️ لا يُفعَّل قبل حسم EX-O10 | workspace ref، declared coverage area، service description، status. | public_after_approval بعد مراجعة، أو interaction_scoped داخل دليل الطالب. | أسعار منافسين أو عروضهم، توفر حي، GPS، أو تغطية مضمونة خارج ما أقره Wedge. |

**اكتمال القاموس (E-09):** الجدول أعلاه يغطي الآن كل كيان سمّته العقود 18–21 (عشرون كيانًا) ويضيف `consent_record` (E-13) و`courier_company_profile` (معلقًا على EX-O10). أي كيان شبكي جديد لا يدخل هذا القاموس إلا بصف وبإجابات قاعدة §5.

> **تسوية تناقض سابق (C5):** العقد 19 §2 يطلب «مستوى إلحاح مبرر» لـ`network_attention`؛ وكانت قاعدة «لا تضف الآن» في هذا القاموس تحظر «urgency مصطنعًا». الصف أعلاه يحسم المعنى: المستوى المسموح مشتق من موعد أو نافذة موثقة في السجل نفسه (قرار مطلوب / موعد قريب / معلومات)، وتظل قاعدة العرض في العقد 19 §3 (قرار صريح أولًا، ثم موعد قريب، ثم الأحدث). أي إلحاح أو ترتيب لا يستند إلى موعد موثق يبقى محظورًا. الحقول الموقوفة على قرارات المالك (EX-O10 وEX-O11) موصوفة في §3.1 ولا تدخل Schema قبل الحسم.

### 3.1 حقول معلّقة على قرارات مالك مفتوحة

هذه الحقول **مواصفة افتراضية بانتظار حسم المالك**؛ لا تدخل Schema ولا واجهة قبل القرار، وسقطت أو أعيد تحديد نطاقها إن اختار المالك خيارًا آخر.

| الكيان | الحقل المعلق | الافتراضي المقترح (الخيار أ) | البدائل وشرطها |
|---|---|---|---|
| `market_response` | `contact_channel` | نسخة من قناة الاتصال المعتمدة في Listing الجهة — يظهر للمالك بعد نشر الرد، مقيدًا بما أقرته Moderation في Listing الأصل؛ لا حقل نص حر. | إن حسم EX-O11 بالخيار (ب) يُحذف الحقل ويُشترط Listing معتمد للرد؛ وإن حُسم بالخيار (ج) تبقى قناة Listing وحدها. وفي حال (أ) تمتد مراجعة العقد 22 §2 لتشمل قناة الرد قبل تفعيلها. |
| `delivery_request` | `routing` | مرجع توجيه صريح يحدد كيف يصل الطلب إلى الساعي؛ دلالاته الثلاث موثقة في العقد 21 §2 ومعلقة على EX-O10. | كل دلالة تغيّر بنية الطلب والدليل وسؤال رؤية السواعي لعروض بعضهم؛ لا يختار Agent واحدة. |

### 3.2 دورة حياة `consent_record` (E-13)

- **الإنشاء:** عند كل Preview وإقرار إفصاح (نشر Need، إفصاح Delivery، قبول عرض يكشف Scopeًا أوسع) ينشأ سجل يذكر: من وافق، وعلى أي Scope، وعلى مرجع أي سجل، ومتى.
- **النطاق:** Scope السجل صريح (هذه المهمة / هذا الاحتياج)؛ لا موافقة «عامة» دائمة بلا نافذة زمنية.
- **السحب:** `revoked at` يوقف أي إفصاح **جديد**؛ ما كُشف سابقًا يبقى في سجله التاريخي، ولا يُحذف بصمت.
- **الاحتفاظ:** مدد الاحتفاظ وأثرها القانوني مؤجلة إلى المراجعة القانونية (OR-O04 / EX-O14) ولا يقررها هذا القاموس.

## 4. قواعد الحقول المالية والتاريخية

إذا حمل Quote أو Response مبلغًا، فهو **معلومة أعلنها الطرف الخارجي** لا التزام مالي أو مصروف أو قيمة معترف بها. يحدد [عقد تمثيل مبالغ الشبكة N-07](25-network-money-representation-contract.md) التمثيل الدقيق قبل الكود؛ لا يستعمل Float في Domain ولا `0` بدل عدم المعرفة. لا ينقل هذا المبلغ إلى JOD minor في Manage أو إلى نتيجة مالية بلا إدخال Owner مستقل.

كل الكيانات الشبكية تحتاج معرفًا مستقرًا ووقت إنشاء وتحديث وفاعلًا وفق حساسيتها. لا يعني `updated_at` أن الحدث التاريخي أعيد كتابته؛ Status Events وDecisions المحكومة تحفظ حدثًا/سببًا منفصلين أو Revision، ولا تستعمل Update صامتًا لمحو ما قاله طرف سابق.

## 5. قواعد إضافة أو إزالة حقل

لا يضاف حقل إلا بعد الإجابة المكتوبة: من يحتاجه؟ في أي موقف؟ لماذا لا يكفي بديل أخف؟ ما التصنيف؟ من يراه في كل مرحلة؟ متى ينتهي غرضه؟ ما اختبار رفض الوصول؟ وما أثره على Manage والتصدير والاستعادة؟ الحقل الذي لا يملك هذه الإجابات يبقى خارج Schema وواجهة الإدخال.

لا يحذف حقل حساس أو Listing/Response/Status/Audit بلا أثر. يحدد عقد Migration/Retention لاحقًا إن كان الإخفاء أو الإيقاف أو الحذف المبرر ممكنًا، ولا يقرر Agent هذا في Feature PR.

فلاتر `السوق` مثل نص البحث والفئة ونطاق التغطية هي حالة اكتشاف تملك غرضًا قصيرًا، ولا تحفظ كـProfile أو Analytics أو سجل شبكة بلا قرار مستقل. `vehicle_requirement` لا يضاف إلا إذا حسم Wedge سبب الحاجة وقيمه المسموح بها وScope قبل Quote، وتبقى حالته `غير متأكد` صريحة بدل تخمين سيارة أو قدرة.

## 6. سيناريوهات القبول

| الحالة | النتيجة المطلوبة |
|---|---|
| Owner ينشر Need من سياق مادة في Manage | لا ينسخ Snapshot أو الكاش أو عميل أو سعر البيع؛ يظهر Preview للحقول المختارة فقط. |
| Supplier يضيف صورة | يبقى object خاصًا ومربوطًا بـListing وحالة Review، لا URL عام دائم. |
| Courier يقدم Quote بمبلغ | يظهر بوصفه عرضًا معلنًا، لا Expense ولا قيمة مالية معترف بها. |
| Admin يقرأ Audit | يرى الحد الأدنى من الفعل/الفاعل/السبب، لا أسرارًا أو مال Manage. |
| API Search | يعيد الحقول العامة أو scoped فقط بعد Policy، لا تمام Row داخلي. |
| Owner يسحب موافقته على إفصاح مهمة | لا إفصاح جديد بعد السحب؛ ما كُشف سابقًا يبقى في سجله التاريخي بلا حذف صامت (§3.2). |

## Action Points

- [ ] قبل E-01، تتحول المفردات إلى Schema/DTO بعد مراجعة كل حقل لا قبله، وتبدأ بمراجعة الصفوف الثمانية المضافة هنا والحقول المعلقة في §3.1.
- [ ] قبل أي حقل Payment أو Phone أو GPS أو Rating أو Analytics، ينشأ عقد قرار مستقل بسبب ومصفوفة وصول وتقييم خصوصية.
- [ ] أي تغير في التصدير المحلي أو Schema Manage يوقف هذه الشريحة ويخضع لعقد Migration/Export/Import مستقل.

## References

[1]: [عقد الهوية والوصول](18-network-identity-workspace-access-contract.md)
[2]: [عقد دورة البيانات والاستعادة](23-network-data-lifecycle-recovery-contract.md)
[3]: [مصفوفة الأدوار والوصول](../expansion/ROLE-ACCESS-MATRIX.md)
[4]: [عقد تمثيل مبالغ الشبكة](25-network-money-representation-contract.md)
[5]: [قرارات التوسعة — EX-O10…EX-O14](../expansion/DECISIONS.md)
