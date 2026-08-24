# حالة Micro الحية — مصدر الاستلام التنفيذي

**الحالة:** `CURRENT / UPDATE WITH EVERY MERGED SLICE`
**آخر تحديث:** 24 أغسطس 2026
**مرجع Git:** شغّل `git switch main && git pull --ff-only origin main && git rev-parse --short HEAD`؛ لا تعتمد رقم commit ثابتًا داخل وثيقة حية.

> هذا الملف يجيب عن سؤال واحد: **«إذا فتحت المستودع الآن، ما الذي أستطيع قوله أو تغييره بأمان؟»** لا يغير العقود ولا يحل محلها.
>
> **حالة الدمج الحالية:** PWA مدمجة على `main` عبر PR #54 وG5 عبر PR #53 وG6-A عبر PR #57، كما اندمجت G6-B وG7-A عبر PR #60. لا توجد شريحة وظيفية مفتوحة؛ `main` هو مرجع القدرات المدمجة.

## 1. قاعدة التشغيل الحالية

| الحقل | القيمة |
|---|---|
| الفرع المعتمد | `main` فقط |
| لغة العمل | العربية؛ الإدخال الرقمي ASCII/LTR |
| نمط Prototype | Web-first، RTL، phone-first، local-first عبر IndexedDB |
| التدفق المعتمد | React → Application Service → Domain → `PrototypeLocalStore` → IndexedDB |
| قاعدة دمج | فرع مستقل → فحوص محلية → PR → CI ناجح → دمج `main` |
| حساب المستخدم/السحابة | Auth والمزامنة والبيانات الحقيقية غير منفذة؛ PWA تشغيلية محلية/ثابتة فقط بلا حساب أو سحابة |

## 2. ما هو منفذ على `main`

| القدرة | الحالة والحد |
|---|---|
| الطلب والاتفاق والتنفيذ والتحصيل/الدين | منفذ محليًا؛ القبض ليس ربحًا والدين ليس كاشًا. |
| المصروف والمورد والشراء والالتزام والدفعات | منفذ؛ شراء المادة لا يصبح COGS تلقائيًا. |
| محافظ الكاش والافتتاح والتحويل والضبط والعكس | منفذ؛ كل تصحيح قابل للعكس وبسبب. |
| المادة والمخزون والاستهلاك والهدر | منفذ؛ فرق المادة للطلب تفسيري فقط. |
| نتيجة الفترة الأوسع G3 | منفذ؛ تفصل حصة المشروع المشتركة ومصدرها وسبب النقص؛ ليست صافي ربح نهائيًا. |
| كتالوج اختياري G4-A | منفذ؛ مرجع منتج/خدمة اختياري، ربط صريح للطلب الجديد، هامش مباشر مسجل وفرق مادة تفسيري. |
| وضع التشغيل والوقت الفعلي G4-B | منفذ محليًا وبشكل اختياري: تفضيل وضع تشغيل، تفعيل تتبع وقت، تسجيل دقائق للطلب وعكسها بسبب، وفرق وقت مخطط/منفذ تفسيري. يستند إلى Domain/Application/LocalStore وschema 18/export 9؛ لا أجر أو COGS أو تكلفة فعلية أو تسعير أو تعديل Snapshot. |
| هامش المساهمة والسيولة القصيرة G5 | منفذ كقراءة قرار محلية: هامش من طلبات نهائية وتكاليف مسجلة، نقطة تعادل مفككة من المزيج، وتوقع قصير من الكاش المسجل والتحصيلات/الالتزامات المؤرخة أو المعلنة. الإعلان لا يصبح قبضًا أو دفعًا، ولا يتجاوز الرصيد المرتبط، والعكس يحفظ سبب المالك. ليست صافي ربح نهائيًا أو COGS فعليًا أو تنبؤًا أو توصية. |
| الاستعادة المحلية | export/import ذري مع ترحيل الإصدارات السابقة؛ لا backup سحابي أو مزامنة. |
| PWA التشغيلية | منفذة كطبقة نشر/تشغيل فقط: Manifest RTL محلي، أيقونات محلية، App Shell precache، direct-route fallback وCloudflare headers، وتثبيت صادق Android/iOS وتحديث اختياري؛ لا تقرأ IndexedDB ولا تضيف backup أو sync. القبول الفعلي على جهاز Android/iOS وعنوان Pages الإنتاجي ما زال مطلوبًا. |
| G6-A التقويم الشهري التشغيلي | منفذ كقراءة `MonthOverview` مشتقة من المواعيد القائمة وشبكة شهر RTL داخل `/schedule`؛ يوضح الوقت المعروف والمجهول والتحذير المشتق من التعارض/السعة، ولا ينشئ تكرارًا أو موعدًا أو تخزينًا جديدًا أو أثرًا ماليًا. |
| G6-B التكرار المحلي المحدود | منفذ محليًا: قوالب أسبوعية/شهرية، 1–12 ظهورًا مستقلًا، idempotency، skips صريحة، وإلغاء الظهورات المستقبلية المشتقة بسبب مكتوب؛ لا reminders أو cron أو تقويم خارجي أو حجز أو موارد. |
| G7-A مصدر الاتفاق والمتابعة | منفذ محليًا: مصدر اتفاق اختياري، ملخص متابعة مكتوب، موعد محلي، قراءة مستحق/قادم، وتاريخ تغيير أو إزالة بسبب مكتوب؛ لا CRM أو رسائل أو تذكيرات تلقائية أو أثر مالي. |

## 3. الحدود غير القابلة للتفاوض

لا تصف أي سطح حالي بأنه COGS فعلي أو صافي ربح نهائي أو قيمة مشروع أو توقع نقدي. لا يغير أي تعديل `CostSnapshot` أو طلبًا تاريخيًا بصمت. لا توزع مصروفًا مشتركًا على طلب أو منتج بلا عقد وأساس معلن. لا تحول الوقت الفعلي إلى أجر أو تكلفة فعلية أو سعر مقترح. لا تحذف حدثًا حساسًا؛ صححه بعكس أو تسوية موثقة.

## 4. الحالة المتوقفة عمدًا

**لا تبدأ أي مجموعة أو قدرة مالية/بنية جديدة الآن.** اكتملت G4-B وG5 وG6-A وG6-B وG7-A، وأضيفت PWA التشغيلية المصرح بها كطبقة نشر ثابتة فقط. لا توسع G6-B إلى daily/RRULE/reminders أو التقويم الخارجي أو الحجز أو الموارد. لا توسع G7-A إلى CRM أو رسائل أو تذكيرات تلقائية. لا تنتقل إلى POS أو مزامنة أو Auth أو أي معنى سحابي قبل طلب صريح جديد من مالك المنتج. لا توسّع الوقت الفعلي إلى أجر أو تكلفة أو توصية سعر، ولا توسّع G5 إلى صافي ربح نهائي أو COGS فعلي أو تنبؤ/توصية من دون عقد مستقل.

## 5. أول قراءة إلزامية حسب المهمة

| إذا كان المطلوب | اقرأ بعد هذا الملف |
|---|---|
| مراجعة أو تعديل مالي | `docs/contracts/05-financial-p0-policies.md` ثم العقد المتصل و`docs/implementation/02-domain-contract-coverage.md` |
| مراجعة أو تعديل G4-B عند تفويض جديد | `docs/contracts/16-optional-operating-mode-and-actual-time-contract.md` ثم `src/domain/actual-time/` و`apps/prototype-web/client/src/application/time/` و`apps/prototype-web/client/src/components/presentation/ActualTimePanel.tsx` |
| مراجعة أو تعديل G5 عند تفويض جديد | `docs/contracts/17-contribution-break-even-short-cash-g5-contract.md` ثم `src/domain/g5/` و`apps/prototype-web/client/src/application/g5/` و`apps/prototype-web/client/src/pages/Finance.tsx` |
| مراجعة أو تعديل G6-A عند تفويض جديد | `docs/contracts/18-derived-monthly-order-schedule-g6-a-contract.md` ثم `apps/prototype-web/client/src/application/scheduling/scheduleService.ts` و`apps/prototype-web/client/src/pages/Schedule.tsx` |
| مراجعة أو تعديل G6-B/G7-A عند تفويض جديد | `docs/contracts/19-bounded-local-schedule-recurrence-g6-b-contract.md` و`docs/contracts/20-agreement-source-follow-up-g7-a-contract.md` ثم خدمات recurrence/agreement context؛ لا توسع الحدود دون عقد جديد. |
| واجهة Prototype | `docs/product/mobile-ui-ux-reference-v1.md` و`docs/implementation/mobile-prototype-spec-v1.md` والمهارات المحلية المذكورة في `AGENTS.md` |
| LocalStore أو استعادة | `docs/contracts/16-optional-operating-mode-and-actual-time-contract.md` و`apps/prototype-web/client/src/storage/local/` و`apps/prototype-web/client/src/application/transfers/` |

قبل أي من هذه القراءات المتخصصة، اقرأ `docs/operations/micro-thinking-charter-v1.md` وأنشئ بطاقة فهم. لا يملك الوكيل حق البدء من نقطة تقنية فقط؛ يجب أن يربط الشريحة بموقف مستخدم وسؤال قرار وحد معرفة وبوابة قدرة.

## 6. حالة مساحة العمل المقبولة

ملف `apps/prototype-web/client/public/__manus__/version.json` مولد محليًا وقد يظهر كتغيير؛ **لا يضاف إلى Git**. يجب أن يكون أي تغيير آخر مفسرًا في PR أو مُزالًا قبل التسليم.

## 7. ما يجب تحديثه عند الإغلاق القادم

عند إغلاق/دمج شريحة جديدة، يعدل الوكيل هذا الملف في نفس PR ليحدث: commit/PR، جدول «ما هو منفذ»، جدول «الحالة المتوقفة عمدًا»، إصدارات schema/export إن تغيرت، ومسار القراءة التالي. PWA مدمجة على `main` عبر PR #54 وG5 عبر PR #53 وG6-B/G7-A عبر PR #60. يظل اختبار iOS الفعلي مطلوبًا قبل إعلان قبول PWA الإنتاجي متعدد المنصات. ثم يحدث `todo.md` فقط بما يطابق الواقع المندمج.

## References

[1]: [قائمة التنفيذ](../../todo.md)
[2]: [مطابقة العقود بالتنفيذ](../implementation/02-domain-contract-coverage.md)
[3]: [عقد G4-B](../contracts/16-optional-operating-mode-and-actual-time-contract.md)
[4]: [بروتوكول التسليم](agent-handoff-protocol-v1.md)
