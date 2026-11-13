# Expansion — بوابة Migration وExport بين Manage والشبكة

**الحالة:** `CURRENT / DECISION: NO MANAGE MIGRATION`
**الغرض:** منع تغير schema/export أو نقل بيانات مالية باسم ربط Market أو Delivery من دون عقد ومراجعة مستقلة.

## Major Discussion Points

## 1. القرار الحالي

لا تتغير `localSchemaVersion` أو `localExportVersion` بسبب E-00 أو L-01 أو E-01. لا تنقل Micro Manage مالًا أو طلبات أو عملاء أو Snapshotات أو مخزونًا إلى الشبكة. لا يشمل `local export/import` بيانات Market/Delivery المتصلة أو عضوياتها أو وسائطها كأنها جزء من Snapshot Manage.

> **رابط خارجي اختياري ليس Migration.** `external_reference` أو `recording_suggestion` يحملان مرجعًا ومصدرًا اختاره Owner، ولا ينسخان payload أو يعطيان قدرة قراءة متبادلة.

> **ملاحظة مؤرخة 2026-11-13 (EX-D22 — تفويض المالك المنقح `MASTER-PROMPT-EN.md` عند `0d4ae258`):** هذا القرار `NO MANAGE MIGRATION` **يبقى نافذًا كما هو**. المصرح به إضافيًا لهذه المهمة حصرًا هو **الجسر القشري/الهوياتي الأدنى**: مدخل/مسار من القشرة المشتركة يعرض تجربة Manage المحلية القائمة كما هي، وعقد ربط مستقبلي مستقر (principal + حدود هوية→Workspace) يُنفذ في طبقة الشبكة **خارج** لقطة التصدير والمخازن المحلية — بشرط ألا يغيّر سلوك Manage المالي/المحلي ولا `localSchemaVersion`/`localExportVersion` ولا أزواج الاستيراد المقبولة ولا التصدير/الاستعادة، وأن يثبت ذلك بفحوص Manage القائمة دون تغيير. نقل بيانات/مال Manage إلى هدف PostgreSQL يتم في مرحلة وفرع مستقلين ببطاقة قرار من قالب §3 — ولا يُنشأ ذلك الفرع الآن، ولا يُربط مال محلي بهوية سحابية بالبريد الإلكتروني وحده أبدًا.

## 2. متى يحتاج الأمر عقد Migration مستقلًا

| التغيير المقترح | هل يحتاج عقد/PR مستقلة؟ | لماذا |
|---|---:|---|
| إضافة Domain/Storage محلي جديد لـL | نعم. | يغير Schema/Export/Restore أو يحتاج قرارًا صريحًا «لا تغيير» مثبتًا. |
| ربط Need باسم مادة مختارة | نعم، إذا خزّن رابطًا في Manage. | يجب تحديد تاريخية الرابط وExport/Import وغياب المادة. |
| عرض Attention/Notification متصل داخل Market أو Delivery | لا في Manage Schema إن كان منفصلًا تمامًا. | لا ينسخ سجل الشبكة ولا يعدل مالًا؛ يحتاج عقد Network فقط. |
| اقتراح تسجيل Expense/Purchase/Inventory | نعم، إن مرر أي حقل مالي أو غير مرجع محدود. | خطر مبلغ/تاريخ/نوع مفروض أو تكرار. |
| نسخ Order/Customer/address إلى Delivery | نعم، قبل أي حقل؛ وقرار خصوصية مستقل. | ليس سياقًا تقنيًا عاديًا بل إفصاح حساس وتاريخي. |
| دمج/مزامنة Manage بين أجهزة | نعم، مشروع منفصل. | تعارضات/تكرار/Recovery وتحويل نموذج local-first. |

## 3. قالب القرار الإلزامي

أي PR تقترح تغييرًا في الجدول أعلاه تكتب قبل الكود:

| الحقل | المطلوب |
|---|---|
| المشكلة والبديل الأخف | لماذا لا يكفي Reference أو إدخال Owner منفصل؟ |
| الكيانات والحقول | ما الجديد وما السابق وما الحساس؟ |
| نسخة Schema/Export | القيمة قبل/بعد، وخطة الملفات القديمة والجديدة. |
| التاريخ والمال | هل يغير طلبًا/Snapshot/نتيجة/كاش؟ وكيف يمنع الكتابة الصامتة؟ |
| الاستعادة والتراجع | Restore وImport وrollback وما يحدث للفشل/التكرار. |
| الخصوصية | ما الذي يخرج من Manage ولماذا ومن يراه؟ |
| الاختبارات | Domain/Application/Store/Export-Import/negative cases/QA. |
| القبول والحد | ما يثبت وما يبقى خارج النطاق. |

## 4. اختبار الحارس

قبل دمج أي Feature Network، يفحص المراجع أن فرقها لا يغير ملفات Schema/Export/LocalStore أو عقود المال، ما لم تشير إلى قرار Migration مستقل ومعتمد. اختبار واحد على الأقل يثبت أن قبول Response أو Quote أو Status لا يغير Snapshot أو كاش أو دين أو مخزون أو Order التاريخي.

## Action Points

- [ ] يبقى هذا القرار `NO MANAGE MIGRATION` حتى يظهر سبب مستخدم مثبت وموافقة مالك على بطاقة قرار كاملة.
- [ ] يضاف رابط هذه البوابة إلى كل PR L/E تمس سياق Manage أو تخزينًا أو Export/Import.
- [ ] لا تُخفى migration ضمن dependency update أو refactor أو «تحسين تجربة»؛ توقف الـPR وتفصلها.

## References

[1]: [عقد الخدمات وحدود Manage](../contracts/19-services-notification-manage-boundary-contract.md)
[2]: [عقد دورة البيانات والاستعادة](../contracts/23-network-data-lifecycle-recovery-contract.md)
[3]: [العقد الحالي للمزامنة المحدودة](../contracts/04-limited-sync-contract.md)
