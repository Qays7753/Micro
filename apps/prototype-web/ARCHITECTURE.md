# معمارية Web App لـMicro Prototype

## نطاق الحزمة الحالي

تحتوي هذه الحزمة Web UI للـPrototype. اكتمل فيها **Slice 0** للغلاف العربي RTL، واكتمل بناء **Slice 1** للتأسيس المحلي ومسودات الطلب. لا تنشئ هذه الطبقة طلبًا ماليًا مكتملًا، ولا تحسب مبلغًا أو تكلفة أو ربحًا أو عربونًا أو تحصيلًا.

## مسار المسؤولية

```text
React UI
  → Application services / view state
  → Micro Domain Core في ../../src/domain/craft-order
  → LocalStore port
  → IndexedDB adapter + export/import محلي لاحقًا
```

لا تستورد مكونات React `IndexedDbLocalStore`، ولا تحسب قاعدة مالية. يوجد Adapter ذاكرة للاختبار وAdapter IndexedDB للمتصفح؛ وكلاهما يمران عبر `ProfileService` أو `DraftService`.

## ما تنفذه Slice 1

تحفظ Slice 1 ملف نشاط محليًا ومسودات قبل Domain فقط. يثبت الملف اسم النشاط وJOD ومسار الحرفة المخصصة. وتحتوي المسودة على النية والوصف والعميل الاختياري والمواصفات والكمية. لا تحتوي حقل سعر أو تكلفة أو كاش أو نتيجة؛ لذلك لا تمثل `CraftOrder` بعد، ولا تستدعي `createCraftOrder` الذي يتطلب Snapshot تكلفة مكتملًا.

يستخدم Adapter إصدار مخطط IndexedDB صريحًا `schemaVersion = 1`. لا تزال migrations التاريخية وExport/Import والتحقق الذري وإعادة الضبط الآمنة نطاق **Slice 5**.

## حدود لا تتغير

التفضيل البصري قد يحفظ محليًا، وملف النشاط والمسودة يحفظان محليًا، لكن لا توجد Cloud Sync أو Workspace أو Auth أو صلاحيات أو Service Worker أو PWA مكتمل. لا يوصف الحفظ بأنه نسخة سحابية أو Backup حتى تنفذ دورة الحماية المحلية واختباراتها.
