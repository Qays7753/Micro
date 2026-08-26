# حالة Micro التشغيلية الحية

**الحالة:** `CURRENT / UPDATE WITH EVERY MERGED SLICE`
**آخر تحديث:** 26 أغسطس 2026
**قاعدة العمل:** العربية، RTL، phone-first، والأرقام المالية ASCII/LTR.

> هذا السجل يجيب عن سؤال واحد: **«إذا فتحت المستودع الآن، ما الذي أستطيع قوله أو تغييره بأمان؟»** لا يحل محل العقود أو فحوص Git. قبل أي عمل على البرنامج المالي نفّذ دائمًا `git fetch origin --prune` واقرأ رأس الـBridge البعيد؛ لا يُعامل أي SHA مذكور هنا كرأس حالي بعد commits لاحقة.

## 1. المصدر المعتمد والحالة العامة

| الحقل | الحقيقة الحالية |
|---|---|
| `main` | `60b642ea2d9d30b63fdb1634268b8ad809a97ac1` بعد PR #115 التجميعية؛ هذا هو الرأس المعتمد للحزمة المالية. |
| برنامج الحزمة المالية | انتهى على الـBridge تاريخيًا ثم اندمج تجميعيًا إلى `main` عبر PR #115؛ فرع الـBridge تقاعد بعد الدمج. |
| طريق التنفيذ | React → Application Service → Domain → `PrototypeLocalStore` → IndexedDB. لا وصول مباشر من UI إلى IndexedDB. |
| قاعدة التسليم | فرع مستقل → فحوص محلية → PR إلى Bridge → CI وCloudflare ناجحان → دمج في Bridge. لا push مباشر إلى Bridge. |
| طريق `main` | اكتملت مراجعة الحزمة والتفويض والدمج التجميعي. أي توسع لاحق يبدأ كقرار/فرع/PR مستقل من `main`. |
| نمط المنتج | Web-first، local-first، بلا Auth أو Sync أو Cloud أو حسابات مستخدمين أو بيانات حقيقة خارج الجهاز. |

## 2. ما هو منشور على `main`

| المجال | الحالة والحد |
|---|---|
| الطلب والاتفاق والتنفيذ والتحصيل/الدين | منفذ محليًا؛ القبض ليس ربحًا والدين ليس كاشًا. |
| المصروف والمورد والشراء والدفعات | منفذ محليًا؛ الشراء لا يصبح COGS تلقائيًا. |
| محافظ الكاش والافتتاح والتحويل والضبط والعكس | منفذ؛ كل تصحيح بعكس كامل وسبب ومفتاح idempotency. |
| المادة والمخزون والاستهلاك والهدر | منفذ؛ فرق المادة للطلب تفسيري ولا يغير Snapshot. |
| الكتالوج والوقت وقراءات مالية تاريخية | توجد قدرات محلية تاريخية على `main`، لكنها لا تساوي شرائح Bridge الجديدة ولا توسع حدودها. |
| الاستعادة وPWA | export/import ذري محلي وPWA تشغيلية بلا backup أو Sync. اختبار Android/iOS وOffline الإنتاجي وPages production وPilot البشري ما زال غير منفذ. |
| برامج UX السابقة | برنامج إصلاح القرار البصري V1–V6 وتصحيحه مدمج على `main` عبر PR #96؛ لا يغير معنى المال أو Schema أو Export/Import. |

## 3. الحزمة المالية G3–G5 المدمجة على `main`

كل الشرائح التالية **مقبولة وظيفيًا ضمن نطاقها ومندمجة تجميعيًا على `main` عبر PR #115**. هذا لا يعني أن المنتج اجتاز جهازًا فعليًا أو Pilot.

| الشريحة | سجل PR على Bridge | ما هو مقبول ضمن النطاق | الحد الصريح |
|---|---|---|---|
| G3 — نتيجة الفترة والمصروف المشترك | #98، #99، #100، #101 → #115 | «صافي الربح التشغيلي المسجل للفترة»، حصة مشروع مشتركة، وCOGS اختيارية من استهلاك مثبت مرتبط بطلب `final` وغير معكوس. | ليست COGS كاملة/قانونية ولا صافي ربح نهائي أو ضريبي ولا توزيع خفي على منتج/طلب. |
| O1 — استحقاق المالك | #102، #103، #104 → #115 | سياسات استحقاق مؤرخة ومتعددة، successor بلا إعادة كتابة التاريخ، افتتاح موجب/سالب، سحب/إرجاع/استثمار فعلي وعكس موثق. | لا payroll موظفين أو ضرائب أو تعدد ملاك قانوني أو Banking أو Cloud. |
| G4-A — نواة الكتالوج | #105، #106، #107 → #115 | كتالوج اختياري، وحدات ضمن بُعد، تحويل مباشر صريح، قالب مكونات وyield اختياريان؛ تصحيح اتجاه المصدر → الوجهة. | لا Profile قطاعي أو BOM متعدد المستويات أو إنتاج مخزون نهائي أو أثر مالي تلقائي. |
| G4-B — قراءة الهامش والتحميل | #108، #109، #110 → #115 | وقت فعلي، هدر سياقي، سياسات تحميل اختيارية، هامش مباشر مسجل وقراءة بعد التحميل؛ `rateMinorPerWholeUnit` لكل `1.000` وحدة مع جمع الكمية قبل round-half-up. | الوقت ليس أجرًا أو تكلفة فعلية أو سعرًا؛ لا COGS كاملة أو توصية تسعير أو صافي ربح نهائي. |
| G5 — التعادل والسيولة المسجلة | #111، #112 → #115 | هامش مساهمة من final/Snapshot، تعادل بوحدة منظمة أو «المزيج المسجل»، وسيولة قصيرة من كاش مسجل وإعلانات مؤرخة قابلة للعكس. | لا Forecast أو AI أو توصية شراء/اقتراض/تسعير؛ الإعلان لا يغير كاشًا أو ذمة أو ربحًا. |
| تصحيح مراجعة الحزمة | #113، #114 → #115 | تحقق/تلخيص/ترحيل/استيراد صريح لسجلات الوقت الفعلي، ومصالحة سجل الحالة والعقود. | لا يغير حساب G4-B أو G5 أو schema/export أو أثرًا ماليًا. |

### 3.1 تكامل التخزين والاستعادة للحزمة

| العنصر | الحقيقة |
|---|---|
| الإصدار المحلي | schema `26` وexport `17`. لا تغير #113 هذين الإصدارين لأنها تضيف تحقق import، لا شكل بيانات جديدًا. |
| الاستيراد | يتحقق قبل `replaceSnapshot` الذري من علاقات G3/O1/G4/G5، ومن template/unit/conversion، ومن successor/reversal، ومن سجل الوقت الفعلي وعكسه. |
| الوقت الفعلي | لا يقبل import سجلًا بلا طلب، أو بدقائق صفرية، أو بمفتاح مكرر، أو بعكس مكسور/مكرر/غير متزن. يظهر عدده في معاينة التصدير. |
| التوافق | الملفات القديمة المدعومة تهاجر إلى الحقول الجديدة بأصفار/مصفوفات آمنة فقط حيث يسمح العقد، بلا اختراع مال أو وقت أو COGS. |
| الحدود | لا مزامنة، ولا استعادة بين أجهزة، ولا Cloud backup. التصدير اليدوي مطلوب قبل تغيير الهاتف أو مسح بيانات المتصفح. |

## 4. حدود مالية غير قابلة للتفاوض

> collection ≠ profit، debt ≠ cash، purchase ≠ COGS، owner money ≠ sale/expense، missing ≠ zero.

لا تصف أي سطح بأنه COGS كاملة أو صافي ربح نهائي أو قيمة مشروع أو توقع مضمون. في G3، COGS اختيارية من دليل استهلاك فقط؛ عند غياب الدليل يبقى Snapshot بديلًا معلنًا. لا يغير أي مسار `CostSnapshot` أو طلبًا تاريخيًا بصمت. لا توزع مصروفًا أو هدرًا أو استهلاكًا عامًا على طلب/منتج بلا عقد وأساس ظاهر. لا تحول وقت التنفيذ إلى أجر أو تكلفة فعلية أو سعر مقترح. كل تصحيح حساس بعكس أو تسوية موثقة؛ لا حذف صامت أو restatement.

## 5. ما هو متوقف عمدًا

| المجال | الحالة |
|---|---|
| التنفيذ المتتابع G3 → O1 → G4-A → G4-B → G5 | انتهى وقُبل وظيفيًا، ثم اندمج إلى `main` عبر PR #115. لا شريحة مالية جديدة تلقائيًا. |
| `main` | يحتوي الحزمة المالية المقبولة. أي توسع جديد يحتاج قرار نطاق وعقد وفرع وPR مستقلة. |
| Activity Profiles | لا Profiles للطعام أو الخدمات أو الزراعة أو السياحة أو mixed schema. قرار النواة العامة لا يصرح تنفيذها الآن. |
| توسعات المنصة | لا POS أو Auth أو Sync أو Cloud أو Banking أو CRM أو Reminders أو Calendar خارجي أو Ledger قانوني أو ضرائب أو Forecast أو AI. |
| القبول الميداني | Android وiOS وstandalone وOffline reload وCloudflare Pages production وPilot بشري لم تُقبل. لا ترفع فحوص sandbox إلى ادعاء قبول ميداني. |

## 6. أول قراءة إلزامية حسب المهمة

| إذا كان المطلوب | اقرأ بعد هذا الملف |
|---|---|
| مراجعة مالية عامة | `docs/contracts/05-financial-p0-policies.md` ثم `docs/implementation/02-domain-contract-coverage.md`. |
| G3 | `docs/contracts/14-period-result-allocation-policy-prototype-contract.md` و`apps/prototype-web/client/src/application/finance/`. |
| O1 | `src/domain/owner-entitlement/` و`apps/prototype-web/client/src/application/finance/ownerEntitlementService.ts`. |
| G4-A | `docs/contracts/15-catalog-reference-prototype-contract.md` و`src/domain/catalog/` و`apps/prototype-web/client/src/application/catalog/`. |
| G4-B | `docs/contracts/16-optional-operating-mode-and-actual-time-contract.md` و`src/domain/recurring-margin/` و`src/domain/actual-time/`. |
| G5 | `docs/contracts/17-contribution-break-even-short-cash-g5-contract.md` و`src/domain/g5/` و`apps/prototype-web/client/src/application/g5/`. |
| LocalStore أو الاستعادة | `apps/prototype-web/client/src/storage/local/` و`apps/prototype-web/client/src/application/transfers/localTransferService.ts`. |
| واجهة Prototype | `docs/product/mobile-ui-ux-reference-v1.md` و`docs/implementation/mobile-prototype-spec-v1.md`. |

قبل أي قراءة متخصصة، اقرأ `docs/operations/micro-thinking-charter-v1.md`. يجب ربط أي تعديل بموقف مستخدم وسؤال قرار وحد معرفة وفعل تالٍ؛ لا يبدأ العمل من اختيار تقني وحده.

## 7. متطلبات الإغلاق القادم

أي PR لاحقة يجب أن تحدّث هذا الملف داخل الـPR نفسها، وتذكر: النطاق، العقد، PR التاريخية، schema/export إن تغيرتا، أثر الاستيراد/التصدير، الحدود، والفعل التالي. لا تذكر SHA دمج PR الحالية بوصفها رأسًا لاحقًا؛ استخدم `git fetch origin --prune`. لا تضف `apps/prototype-web/client/public/__manus__/version.json` إلى Git، ولا تخلط تغييرات `todo.md` المحلي داخل commit.

## References

[1]: [مطابقة العقود بالتنفيذ](../implementation/02-domain-contract-coverage.md)
[2]: [عقد G3](../contracts/14-period-result-allocation-policy-prototype-contract.md)
[3]: [عقد G4-B](../contracts/16-optional-operating-mode-and-actual-time-contract.md)
[4]: [عقد G5](../contracts/17-contribution-break-even-short-cash-g5-contract.md)
[5]: [بروتوكول التسليم](agent-handoff-protocol-v1.md)
