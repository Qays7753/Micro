---
name: micro-local-first-prototype
description: تصميم وتنفيذ ومراجعة التخزين المحلي لـMicro Prototype، بما في ذلك LocalStore وIndexedDB والمسودات وSnapshots والأحداث وschema وlocal export/import. استخدم هذه المهارة عند ربط التطبيق بالبيانات أو بناء الاستعادة أو اختبار العمل دون اتصال.
---

# Micro Local-first Prototype

## الغرض

وفّر استمرارية محلية آمنة لـPrototype المرحلة 2 دون إنشاء SaaS مركزي أو Ledger عام. اجعل الواجهة تتعامل مع Port/Repository واضح، واجعل التخزين Adapter قابلًا للاستبدال لاحقًا.

## اقرأ قبل التنفيذ

اقرأ:

- [`../../docs/implementation/prototype-build-charter-v1.md`](../../docs/implementation/prototype-build-charter-v1.md)
- [`../../docs/implementation/mobile-prototype-spec-v1.md`](../../docs/implementation/mobile-prototype-spec-v1.md)
- [`../../docs/contracts/05-financial-p0-policies.md`](../../docs/contracts/05-financial-p0-policies.md)
- [`../../docs/contracts/04-limited-sync-contract.md`](../../docs/contracts/04-limited-sync-contract.md)
- [`../../docs/implementation/02-domain-contract-coverage.md`](../../docs/implementation/02-domain-contract-coverage.md)
- [`../../AGENTS.md`](../../AGENTS.md)

لا تعتبر أي مخطط في Accounting أو أي تطبيق خارجي عقدًا لـMicro. استعمل Domain Core والعقود الحالية مصدرًا للحقيقة.

## حدود البيانات

احفظ فقط ما يلزم للمسار المحلي: ملف النشاط، المسودات، الطلب، نسخ التكلفة، الأحداث، حالة النتيجة، تفضيلات الواجهة الضرورية، وبيانات التصدير. لا تضف `workspace_id` أو Auth أو صلاحيات أو مزامنة مركزية في Prototype إلا بقرار جديد.

لا تنشئ جدولًا عامًا للـLedger أو Inventory أو POS. لا تجعل شراء مادة تكلفة بيع مكتملة تلقائيًا. لا تخزن نتيجة محسوبة على أنها حقيقة مستقلة إذا كان يمكن إعادة اشتقاقها من Snapshot والأحداث؛ وثّق مصدر كل View Model.

## عقد LocalStore

عرّف واجهة مستقلة عن IndexedDB، مثل عمليات قراءة/كتابة المسودة والطلب وSnapshot والأحداث، مع نتيجة نجاح/فشل واضحة. اجعل كل عملية حساسة قابلة لإعادة المحاولة عبر `idempotency_key` أو المعرف الذي يفرضه Domain.

استخدم `schemaVersion` صريحًا. لا تغيّر شكل السجل القديم بصمت. كل migration يجب أن تكون قابلة للاختبار، وأن تفشل بوضوح إذا لم يمكن تحويل البيانات بأمان.

افصل ثلاثة أشياء:

1. **Domain state:** ما تقوله عقود Micro.
2. **Persistence record:** شكل الحفظ المحلي والإصدارات.
3. **View model:** ما تحتاجه الشاشة للعرض والتوجيه.

## Export/Import

اجعل التصدير ملفًا محليًا واضحًا يضم version وschemaVersion وبيانات Prototype المطلوبة، ولا تضع أسرارًا أو مفاتيح داخل الملف. عند الاستيراد، افحص نوع الملف والإصدار والبنية والحقول المطلوبة قبل أي كتابة.

طبّق قاعدة: **التحقق أولًا، ثم الاستبدال الذري أو الدمج الموثق، ولا تلمس الحالة الحالية إذا كان الملف غير صالح**. اختبر ملفًا صحيحًا، وملفًا ناقصًا، وملفًا بإصدار غير مدعوم، وملفًا تالفًا. اعرض رسالة عربية وفعلًا تاليًا بدل خطأ تقني صامت.

اختبر Export ثم Import في Store فارغ وStore يحوي مسودات وطلبات وSnapshots وأحداثًا، وتحقق من ثبات القيم والمعرفات والحالات وعدم تكرار الأثر المالي.

## العمل دون اتصال

في Prototype، «محلي فقط» حالة صادقة وليست فشلًا ولا مزامنة مؤجلة ضمنية. لا تعرض أن البيانات محفوظة مركزيًا. إذا أضيف Service Worker أو PWA، يبقى ذلك طبقة تشغيل ولا يغير معنى Domain أو يكرر حدثًا حساسًا.

## سير العمل

ابدأ بالعقد والاختبارات قبل اختيار مكتبة التخزين. ابنِ in-memory adapter صغيرًا إن كان مفيدًا لاختبار Application، ثم نفّذ IndexedDB adapter. اختبر فشل القراءة والكتابة، إعادة التحميل، إغلاق الطبقة، انقطاع الاتصال، وإعادة المحاولة.

لا تجعل React يتصل مباشرةً بـIndexedDB. يمر كل حفظ عبر Application/Use Case، ويعود إلى الواجهة بنتيجة صريحة مثل saved أو validation_error أو storage_error أو needs_review.

## معيار القبول

يُقبل التخزين عندما يحفظ المسودة دون فقد، ويستعيد الطلب وSnapshots والأحداث بعد إعادة التحميل، ويحافظ على التاريخ، ويمنع التكرار، ويفشل بأمان، وينجح Export/Import round-trip، ويرفض الملف غير الصالح دون مسح الحالة الحالية.

## ممنوعات

لا تستخدم `localStorage` كسجل مالي كامل إذا كان الحجم أو atomicity أو البنية لا تكفي. لا تضف Cloud Sync أو Auth أو Backend لأن Cloudflare هو هدف الاستضافة. لا تخفي فشل التخزين. لا تكتب «نسخة احتياطية» إذا كان الملف مجرد تصدير غير مختبر. لا تنقل Dexie schema من Accounting حرفيًا.
