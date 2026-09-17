# Wave 4.3 — تغطية المسارات (Route Coverage)

**BASE_SHA:** `9179ea785d7c35790c422a997fa210aaf7e875a6` · **نهاية الكود:** `a95fffa753`
**مصدر المسارات:** `apps/prototype-web/client/src/app/MicroRouter.tsx` (كل `<Route path>` مسجل).
**التعريف المرجعي:** [screen-contract-matrix.md](./screen-contract-matrix.md) — هذا الملف يثبت التغطية العددية والقوالب المطبقة.

## 1. الحصر العددي

| الفئة | العدد | ملاحظة |
|---|---|---|
| مسارات مسجلة في الراوتر | 59 | بلا `<Route>` خارج الملف |
| شاشات فعلية | 52 | لكل منها صف كامل في المصفوفة |
| تحويلات توافقية | 2 | `/finance/new/owner_withdrawal_cash` · `/review` (تحيل مع سياق، لا شاشات) |
| NotFound | 1 | `*` — «هذه الصفحة ليست جزءًا من هذا الإصدار» |
| مسارات بنمط معامل عميق | 4 | ضمن الـ52 (مثل `/cash/entry/:id/reverse`، `/orders/draft/:id/*`) |
| حالات معامل عميقة موثقة | 12 | `?returnTo` `?event` `?layer` `?focus` `?mode` `?purchase` `?material` `?destinationWalletId` `?setup` `?intent` `?from` (+`?view` داخلي للمالية) |
| **Routes بلا تعريف أو قالب أو حالة** | **0** | تحقق آلي (routeClassifier/routeKnowledgeSync) + مراجعة مستقلة |

## 2. القوالب المطبقة (مفاتيح المصفوفة)

| القالب | المعنى | العدد | أمثلة |
|---|---|---|---|
| A | سطح قائمة | 20 | `/` `/orders` `/finance` `/tools` `/market` `/catalog` `/parties` `/suppliers` `/cash` `/assets` `/loans` `/profile` `/settings` `/foundation` `/finance/more` `/finance/activity` `/schedule` `/inventory` `/tools/integrity` `/finance/owner-entitlement` |
| B | محرر عميق | 28 | محررات المسودة/الاتفاق/التكلفة/الحدث/الشراء/الحركات/المحافظ/السحب/G5/المواعيد/التقدير… |
| C | تفاصيل | 6 | `/orders/:id` `/assets/:id` `/loans/:id` `/cash/wallet/:id` `/tools/estimate/:id` (+قراءة التسليم ضمن B) |
| D | ورقة Sheet | 1 | `/collect` |
| E | حالة خاصة | 1 | NotFound |
| تحويل | إحالة موثقة | 2 | انظر أعلاه |

## 3. الحزم المالكة للتغطية

| الحزمة | الأسطح المملوكة (تطبيق القالب أو إعادة الترتيب) |
|---|---|
| P-4.3-1 | القشرة كاملة (AppHeader/MicroAppShell/BottomNav) + `/profile` + `/settings` (قائمة/حساب/مظهر) |
| P-4.3-2 | `/` (إعادة البناء الكاملة) + أوراق التسجيل السريع |
| P-4.3-3 | `/finance` (الوضع الآن/ملخص الفترة) + «شو عليّ؟» + `/tools/integrity` (قراءة مقروءة) + بطاقات المركز |
| P-4.3-4 | `/orders` (مجموعات الحالة) + `/orders/:id` + `/orders/:id/deliver` + `/collect` + `/share/preview` + محرر/تصحيح البيع المباشر |
| P-4.3-5 | `/cash` وأسرتها التسعة (دفتر/محفظة جديدة/توزيع/تحويل/عدّ/ضبط/رصيد لاحقًا/عكس) + محرر الشراء وتسديده |
| P-4.3-6 | الأسطح المتبقية كلها: `/catalog` `/tools` `/market` `/foundation` `/setup` `/suppliers` `/inventory` وأسرته `/assets` وأسرته `/loans` وأسرته `/parties` `/schedule` وأسرته `/finance/new/:type` `/finance/activity` `/finance/statement` — مع إصلاحات GAP الموثقة |

## 4. أدلة التحقق

1. **حراس التنقل القائمة** (navigationContract.test · routeClassifier.test · routeKnowledgeSync · group1Surfaces · Nav001/Nav003): خضراء بلا تعديل يسقط تغطية.
2. **اختبارات البداية الباردة** للروابط المهمة: قائمة في test-results.md §الرحلات — كل رابط عميم يفتح سطحه أو يحال بصدق.
3. **المراجعة المستقلة** (بند 7 من قائمتها): «كل مسارات MicroRouter التسعة والخمسين لها صف في مصفوفة العقد — لا Route بلا تعريف صحيح».
4. **QA الحي**: 16 مسارًا فُتحت مباشرة على 360 و15 على 430 (فاتح/ليلي) بلا تمرير أفقي ولا خطأ Console.
