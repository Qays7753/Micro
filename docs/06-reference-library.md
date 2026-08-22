# مكتبة مراجع بناء SaaS — الإصدار الأول

> **المرجع التفصيلي المعتمد:** اقرأ أولًا [`docs/research/global-build-reference-library-v1.md`](research/global-build-reference-library-v1.md) لحفظ المفاهيم والمنطق والتراخيص وقرارات المصادر، ثم [`docs/research/micro-build-logic-v1.md`](research/micro-build-logic-v1.md) لمعرفة كيف تتحول هذه المعرفة إلى Prototype ومراحل لاحقة.

هذه المكتبة هي فهرس عملي مختصر للمراجع التي يجوز الرجوع إليها أثناء تطوير النظام. لا تمثل المشاريع الواردة فيها مكونات يجب جمعها، ولا تعني أن وجود ميزة فيها يثبت حاجة السوق. المرجع الأعلى دائمًا هو Problem Statement وخريطة الحقيقة وسجل الفرضيات. إذا اختلفت هذه القائمة المختصرة مع المرجع التفصيلي الجديد، يُراجع سبب الاختلاف ويُسجل القرار بدل اختيار النص الأطول تلقائيًا.

## 1. قاعدة استخدام المكتبة

عند اقتراح ميزة أو كود أو قرار معماري، يجب تسجيل:

| الحقل | المطلوب |
|---|---|
| سؤال المشكلة | أي سؤال من Problem Statement تعالجه؟ |
| المصدر | رابط المشروع والـcommit أو الإصدار إن أمكن |
| نوع الاستفادة | فكرة، نمط UX، نمط Domain، معمارية، كود، اختبار |
| نطاق المصدر | طعام، حرفة، خدمة، محاسبة، SaaS، local-first، توجيه داخل العمل |
| الترخيص | SPDX أو ملف الترخيص الفعلي |
| درجة النضج | نشاط، إصدارات، اختبارات، توثيق، حجم المشروع |
| الفرق عن منتجنا | ما الذي لا ينطبق؟ |
| قرارنا | بناء، دراسة، تأجيل، رفض |

لا يجوز استخدام كود خارجي مجهول الترخيص. ولا يجوز استخدام مشروع كبير كأساس فقط لأنه يحتوي على الوظيفة المطلوبة.

## 2. مراجع المجال والـDomain

| المصدر | النمط المفيد | ما نبنيه نحن | ما نتركه |
|---|---|---|---|
| [Craftplan][1] | منتجات حرفية، catalog، BOM versioning، labor steps، production batches، cost snapshots، calendar | cost structure مبسطة، تخصيص، وقت، snapshot للطلب | BOM متعدد المستويات، lot traceability، forecast، production ERP |
| [CostTable][2] | ingredients، price history، recipe، servings، direct/indirect cost، margin، scaling، local SQLite | محرك تكلفة طعام بوصفة/دفعة/حصة وتاريخ سعر | food-only UI، local-only، غياب order/SaaS |
| [Recipe Costs frontend][3] و[API][4] | تحويل وحدات، تكلفة الوصفة والحصة، فصل frontend/API | Unit Conversion واختبارات الحساب | عمر المشروع الصغير، عدم وجود باقي دورة العمل |
| [POSR][5] | order states، takeaway، preparation، ready، waste، recipe deduction | Order State Machine، قائمة اليوم، capacity warning، waste عند الحاجة | tables، kitchen stations، staff، delivery fleet، gateways |
| [Open Field Service][6] | jobs، duration، priority، materials، checklist، activity log، invoice after completion | خدمة بمدة وفعل إتمام ومواد اختيارية | dispatch، technicians، field-service breadth |
| [EasyAppointments][7] | service availability، duration، calendar، booking rules، notifications | موعد خدمة بسيط وتعارض وتحذير | Google Calendar وbooking platform كاملة |
| [Kimai][8] | وقت مرتبط بعميل/مشروع/معدل، budgets وتقارير | وقت مقدر أولًا ووقت فعلي اختياري | timesheets مؤسسية وصلاحيات وفرق |
| [InvoiceShelf][9] | estimate/invoice/payment، customer accounts، modular domains | فصل الاتفاق والتقدير والتحصيل دون جعل الفاتورة مركز الطلب | نظام فواتير كامل وضرائب معقدة |
| [Chatwoot][10] | conversation، مصدر العميل، قنوات، notes، ownership، audit | `order.source` وملخص اتفاق وتحويل سريع إلى طلب | omnichannel inbox وWhatsApp automation |
| [ERPNext][11] | material consumption، capacity، timesheet، profitability، manufacturing | تحذير قدرة واستهلاك مبسط | ERP، MRP، تصنيع وفروع وموظفون |
| [Akaunting][12] و[Bigcapital][13] | تقارير، محاسبة، modular boundaries، API، e2e | أنماط اختبار وتصدير وحدود مجال | accounting core وchart of accounts كامل |

## 3. مراجع الـPlatform والـSaaS

| المصدر | النمط المفيد | القرار |
|---|---|---|
| [PocketBase][14] | single-binary، SQLite، auth، files، realtime، Go extensibility | مرشح Pilot بخادم واحد فقط، لا قرار إنتاج نهائي قبل backup/restore/load/isolation |
| [Appwrite][15] | Auth، DB، Storage، Functions، Messaging، Hosting، Realtime، self-hosting | بديل كامل لكنه أكبر تشغيلًا؛ لا يضاف قبل قياس الحاجة |
| [RxDB][16] | local-first، replication، schemas، browser/node tests، export/import | مرجع adapter والمزامنة؛ لا نضيفه قبل قياس تعقيد queue والتعارض |
| [Subscrio][17] | entitlement layer مستقلة عن Billing | نصمم boundary للحساب والخطة؛ لا Billing داخل تطبيق المستخدم |
| [Usertour][18] | tours، checklist، surveys، contextual onboarding | نبني checklist وتفسيرًا سياقيًا بسيطًا داخل النواة |

## 4. تصنيف التراخيص العملي

| الفئة | أمثلة | قرارنا |
|---|---|---|
| ترخيص واضح متساهل نسبيًا | MIT في Recipe Costs frontend وOpen Field Service وPocketBase، Apache-2.0 في RxDB، BSD-3-Clause في Appwrite | يمكن الدراسة؛ الكود لا يدخل إلا بعد فحص الجودة والاعتماديات والإسناد |
| Copyleft قوي | GPL-3.0 في ERPNext وEasyAppointments، AGPL-3.0 في Bigcapital وCrater وCraftplan وKimai وInvoiceShelf | دراسة فقط في هذه المرحلة؛ مراجعة قانونية قبل أي اشتقاق أو توزيع |
| ترخيص تجاري/غير SPDX أو شروط خاصة | BSL في Akaunting، أجزاء/حدود ترخيص في Usertour | لا كود دون مراجعة النص الكامل وشروط التوزيع |
| غير واضح أو غائب | POSR، CostTable، Recipe Costs API | ممنوع الاقتباس حاليًا؛ نستعمل ملاحظات عامة فقط |

## 5. مراجع الأنماط القابلة للتعميم

### 5.1 نموذج التكلفة

النمط العام هو أن تكلفة المنتج لا تأتي من سعر واحد؛ بل من عناصر لها وحدة وكمية ومصدر وتاريخ وحالة. في الطعام قد تكون الوصفة والدفعة والحصص؛ في الحرفة خامة ووقت وتخصيص؛ وفي الخدمة وقت ومواد وتنقل. يجب أن ينتج المحرك `known/estimated/incomplete/stale`، ويحفظ snapshot عند اعتماد السعر أو الطلب.

### 5.2 نموذج الطلب

الطلب كيان تشغيلي مستقل عن الفاتورة: له مصدر، زبون، اتفاق، موعد، سعر، تكلفة، عربون، حالة، فعل تالٍ، سجل أحداث، وتنفيذ وتحقيق وتحصيل منفصل. هذه الخلاصة تجمع دروس POSR وOpen Field Service وEasyAppointments وChatwoot.

### 5.3 نموذج local-first

التخزين المحلي ليس مجرد cache. يجب تحديد ما يُسمح بتعديله دون اتصال، وكيف توضع العملية في queue، وكيف تمنع idempotency التكرار، وكيف يظهر التعارض، وكيف يستعيد المستخدم نسخة. يبدأ المنتج بحدود ضيقة لا بمزامنة عامة لكل شيء.

### 5.4 نموذج SaaS

حالة الوصول ليست حركة مالية للمستخدم. نحتفظ بحد entitlement منفصل يمكن أن يمثل trial، active، grace، read-only، suspended، deletion pending. الفوترة يمكن أن تأتي لاحقًا، لكن البيانات والتصدير وعدم الحذف الفوري يجب أن تكون جزءًا من التشغيل المسؤول.

### 5.5 نمط التوجيه داخل العمل

التوجيه الأفضل هنا ليس LMS؛ بل checklist ينجز أول قيمة، مع شرح «لماذا؟» بجانب الحقل، ثم نتيجة وفعل تالٍ. Usertour مرجع لنمط UX، لا مكوّن يجب إدخاله كاملًا.

## 6. ما الذي لم تثبته المكتبة؟

لم تثبت أيًا من المشاريع استعداد أصحاب المشاريع الأردنيين للدفع، أو أن WhatsApp integration سيزيد الاحتفاظ، أو أن offline هو سبب شراء، أو أن كل الأنشطة تحتاج مخزونًا أو وقتًا تفصيليًا. هذه تظل فرضيات يجب اختبارها مع مستخدمين حقيقيين.

## 7. بوابة إدخال أي مرجع جديد

كل مصدر جديد يجب أن يمر أيضًا عبر بطاقة المصدر وسجل القرار في [`docs/research/global-build-reference-library-v1.md`](research/global-build-reference-library-v1.md)، وأن يطابق منطق البناء في [`docs/research/micro-build-logic-v1.md`](research/micro-build-logic-v1.md).

لا يدخل أي مصدر جديد إلى التصميم قبل الإجابة عن الأسئلة التالية:

1. هل يعالج ضررًا محددًا في Problem Statement؟
2. هل يناسب الحرف أو الطعام أو الخدمة، أم يفرض قطاعًا مختلفًا؟
3. هل يزيد عدد الحقول أو الحالات أكثر مما يزيد الوضوح؟
4. هل يحفظ الحقيقة التاريخية أم يعيد حساب الماضي بصمت؟
5. هل توجد اختبارات أو توثيق يبرران الثقة؟
6. هل الترخيص واضح ومتوافق مع SaaS تجاري؟
7. هل نستطيع تنفيذ نسخة أصغر منه داخل Vertical Slice؟
8. ماذا سنحذف منه عمدًا حتى لا ننقل التعقيد؟

## المراجع

[1]: https://github.com/puemos/craftplan "Craftplan"
[2]: https://github.com/kaveenexe/CostTable "CostTable"
[3]: https://github.com/aparkening/recipe_costs_frontend "Recipe Costs frontend"
[4]: https://github.com/aparkening/recipe_costs_api "Recipe Costs API"
[5]: https://github.com/ahmedali5530/restaurant-pos "POSR Restaurant POS"
[6]: https://github.com/clawnify/open-fieldservice "Open Field Service"
[7]: https://github.com/alextselegidis/easyappointments "Easy!Appointments"
[8]: https://github.com/kimai/kimai "Kimai"
[9]: https://github.com/InvoiceShelf/InvoiceShelf "InvoiceShelf"
[10]: https://github.com/chatwoot/chatwoot "Chatwoot"
[11]: https://github.com/frappe/erpnext "ERPNext"
[12]: https://github.com/akaunting/akaunting "Akaunting"
[13]: https://github.com/bigcapitalhq/bigcapital "Bigcapital"
[14]: https://github.com/pocketbase/pocketbase "PocketBase"
[15]: https://github.com/appwrite/appwrite "Appwrite"
[16]: https://github.com/pubkey/rxdb "RxDB"
[17]: https://github.com/jasenf/subscrio "Subscrio"
[18]: https://github.com/usertour/usertour "Usertour"
