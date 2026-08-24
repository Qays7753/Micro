# حالة Micro الحية — مصدر الاستلام التنفيذي

**الحالة:** `CURRENT / UPDATE WITH EVERY MERGED SLICE`
**آخر تحديث:** 24 أغسطس 2026
**مرجع Git:** شغّل `git switch main && git pull --ff-only origin main && git rev-parse --short HEAD`؛ لا تعتمد رقم commit ثابتًا داخل وثيقة حية.

> هذا الملف يجيب عن سؤال واحد: **«إذا فتحت المستودع الآن، ما الذي أستطيع قوله أو تغييره بأمان؟»** لا يغير العقود ولا يحل محلها.

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
| الاستعادة المحلية | export/import ذري مع ترحيل الإصدارات السابقة؛ لا backup سحابي أو مزامنة. |
| PWA التشغيلية | منفذة كطبقة نشر/تشغيل فقط: Manifest RTL محلي، أيقونات محلية، App Shell precache، direct-route fallback وCloudflare headers، وتثبيت صادق Android/iOS وتحديث اختياري؛ لا تقرأ IndexedDB ولا تضيف backup أو sync. القبول الفعلي على جهاز Android/iOS وعنوان Pages الإنتاجي ما زال مطلوبًا. |

## 3. الحدود غير القابلة للتفاوض

لا تصف أي سطح حالي بأنه COGS فعلي أو صافي ربح نهائي أو قيمة مشروع أو توقع نقدي. لا يغير أي تعديل `CostSnapshot` أو طلبًا تاريخيًا بصمت. لا توزع مصروفًا مشتركًا على طلب أو منتج بلا عقد وأساس معلن. لا تحول الوقت الفعلي إلى أجر أو تكلفة فعلية أو سعر مقترح. لا تحذف حدثًا حساسًا؛ صححه بعكس أو تسوية موثقة.

## 4. الحالة المتوقفة عمدًا

**لا تبدأ أي مجموعة أو قدرة مالية/بنية جديدة الآن.** اكتملت G4-B، وأضيفت PWA التشغيلية المصرح بها كطبقة نشر ثابتة فقط ضمن PR #54؛ لا يجوز الانتقال إلى المجموعة الخامسة أو POS أو مزامنة أو Auth أو أي معنى سحابي قبل طلب صريح جديد من مالك المنتج. لا توسّع معنى الوقت الفعلي إلى أجر أو تكلفة أو توصية سعر من دون عقد مستقل.

## 5. أول قراءة إلزامية حسب المهمة

| إذا كان المطلوب | اقرأ بعد هذا الملف |
|---|---|
| مراجعة أو تعديل مالي | `docs/contracts/05-financial-p0-policies.md` ثم العقد المتصل و`docs/implementation/02-domain-contract-coverage.md` |
| مراجعة أو تعديل G4-B عند تفويض جديد | `docs/contracts/16-optional-operating-mode-and-actual-time-contract.md` ثم `src/domain/actual-time/` و`apps/prototype-web/client/src/application/time/` و`apps/prototype-web/client/src/components/presentation/ActualTimePanel.tsx` |
| واجهة Prototype | `docs/product/mobile-ui-ux-reference-v1.md` و`docs/implementation/mobile-prototype-spec-v1.md` والمهارات المحلية المذكورة في `AGENTS.md` |
| LocalStore أو استعادة | `docs/contracts/16-optional-operating-mode-and-actual-time-contract.md` و`apps/prototype-web/client/src/storage/local/` و`apps/prototype-web/client/src/application/transfers/` |

قبل أي من هذه القراءات المتخصصة، اقرأ `docs/operations/micro-thinking-charter-v1.md` وأنشئ بطاقة فهم. لا يملك الوكيل حق البدء من نقطة تقنية فقط؛ يجب أن يربط الشريحة بموقف مستخدم وسؤال قرار وحد معرفة وبوابة قدرة.

## 6. حالة مساحة العمل المقبولة

ملف `apps/prototype-web/client/public/__manus__/version.json` مولد محليًا وقد يظهر كتغيير؛ **لا يضاف إلى Git**. يجب أن يكون أي تغيير آخر مفسرًا في PR أو مُزالًا قبل التسليم.

## 7. ما يجب تحديثه عند الإغلاق القادم

عند دمج شريحة جديدة، يعدل الوكيل هذا الملف في نفس PR ليحدث: commit/PR، جدول «ما هو منفذ»، جدول «الحالة المتوقفة عمدًا»، إصدارات schema/export إن تغيرت، ومسار القراءة التالي. في PR #54 لا تتغير schema/export؛ ويظل الاختبار الفعلي على Android/iOS وCloudflare Pages قبل إعلان قبول الإنتاج. ثم يحدث `todo.md` فقط بما يطابق الواقع المندمج.

## References

[1]: [قائمة التنفيذ](../../todo.md)
[2]: [مطابقة العقود بالتنفيذ](../implementation/02-domain-contract-coverage.md)
[3]: [عقد G4-B](../contracts/16-optional-operating-mode-and-actual-time-contract.md)
[4]: [بروتوكول التسليم](agent-handoff-protocol-v1.md)
