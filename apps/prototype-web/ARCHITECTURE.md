# معمارية Web App لـMicro Prototype

## نطاق الحزمة الحالي

تحتوي هذه الحزمة Web UI للـPrototype. اكتمل فيها **Slice 0** للغلاف العربي RTL، و**Slice 1** للتأسيس والمسودة المحلية، و**Slice 2** لبناء Snapshot تكلفة وسعر حماية. لا تنشئ هذه الطبقة اتفاقًا أو عربونًا أو تحصيلًا أو دينًا أو تسليمًا أو نتيجة طلب.

## مسار المسؤولية

```text
React UI
  → Application services / view state
  → Micro Domain Core في ../../src/domain/craft-order
  → LocalStore port
  → IndexedDB adapter + export/import محلي لاحقًا
```

لا تستورد مكونات React `IndexedDbLocalStore`، ولا تحسب قاعدة مالية. يمر التأسيس عبر `ProfileService`، والمسودة عبر `DraftService`، وحساب التكلفة وسعر الحماية عبر `CostService` الذي يستدعي نقطة الدخول العامة لـDomain Core.

## ما تحفظه محليًا الآن

يحفظ Prototype ملف النشاط ومسودات قبل Domain. تحتوي المسودة على النية والوصف والعميل الاختياري والمواصفات والكمية وتاريخ Snapshots تكلفة غير قابل للتعديل. كل Snapshot مسجل revision جديد، ويظل snapshot السابق داخل المسودة بدل تغييره بصمت.

يستخدم Adapter إصدار مخطط IndexedDB صريحًا `schemaVersion = 2`. ينقل migration الإصدار 1 المسودات القديمة بإضافة سجل Snapshots فارغ، فلا يفقد وصف المسودة أو بياناتها السابقة. Export/Import والتحقق الذري وإعادة الضبط الآمنة لا تزال نطاق **Slice 5**.

## حدود Slice 2

`CostService` يحول مدخلات المواد والوقت والتغليف والتوصيل والهدر وهامش الحماية إلى `calculateCostSnapshot` في Domain Core. لذلك تكون `plannedCostMinor` و`unitCostMinor` و`priceFloorMinor` و`knowledgeState` ناتجة من Domain، لا من React. يظل **سعر الحماية** رقمًا يحمي من التكلفة المدخلة، لا سعر سوق ولا قرار قبول ولا ربحًا. الوقت المفقود يبقي التكلفة ناقصة؛ والعناصر المقدرة تبقيها تقديرية.

## حدود لا تتغير

التفضيل البصري وملف النشاط والمسودات وSnapshots تحفظ محليًا، لكن لا توجد Cloud Sync أو Workspace أو Auth أو صلاحيات أو Service Worker أو PWA مكتمل. لا يوصف الحفظ بأنه نسخة سحابية أو Backup حتى تنفذ دورة الحماية المحلية واختباراتها.
