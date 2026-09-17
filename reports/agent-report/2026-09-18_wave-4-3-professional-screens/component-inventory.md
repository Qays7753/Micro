# Wave 4.3 — جرد المكونات (Component Inventory)

**قاعدة الجرد:** كل سطح/مكوّن لمسته Wave 4.3 مرتب بحزمته وحالته (جديد N · معاد بناء R · معاد استخدام U · منقول M) وحارسه. لم تُضف أي مكتبة UI أو Icons جديدة (lucide-react القائمة غطت كل الأيقونات؛ «✓» في رسائل F08 نص معتمد لا أيقونة).

## P-4.3-1 — أسس التصميم والسطح العلوي

| العنصر | الحالة | الدور | الحارس |
|---|---|---|---|
| `components/layout/AppHeader.tsx` | R (إعادة بناء كاملة) | المنطقة العلوية المفتوحة + قائمة الشعار + لوحتا «قريبًا» | AppSurface.w43 (6) |
| `components/brand/BrandMark.tsx` | U | الشعار داخل الزر | — |
| `components/layout/MicroAppShell.tsx` | U+تعديل | قراءة حالة اكتمال الحساب من `ownerProfile.read()` (قراءة رسمية واحدة) | AppSurface.w43 |
| `components/layout/BottomNav.tsx` | U | الترتيب الخماسي (موروث 4.2) — بلا سادس | Nav001 + المراجعة |
| `contexts/ThemeContext.tsx` | U | theme-color من التوكن — لم يُمس | R3.themeBehavior |
| `app/navigationContract.ts` — `withReturnTo` | U | كل بنود القائمة تفتح بسياق رجوع (EXE-016) | navigationContract.test |

## P-4.3-2 — مشروعي الآن

| العنصر | الحالة | الدور | الحارس |
|---|---|---|---|
| `pages/Home.tsx` | R | الترتيب المهني D6 بالكامل | HomeRedesign.w43 (7) |
| `application/home/homeControlCenterService.ts` + `Model.ts` | U+توسيع قراءة | كل أرقام الرئيسية من `readRecordedPeriodResult`/`readPosition` — لا معادلة واجهة | خدمة (2) + نموذج (1) |
| `components/layout/QuickActionSheet.tsx` | U | حاوية أوراق التسجيل السريع | QuickActionSheet القائمة |
| `components/finance/QuickSaleForm.tsx` | U+تعديل | `<form>` حقيقي لـF13 + تاريخ قابل للتحرير + «سعر البيع الكامل» | QuickFormsEnter.w43 (6) |
| `components/finance/QuickExpenseForm.tsx` | U+تعديل | F13 بالضوابط نفسها | QuickFormsEnter.w43 |

## P-4.3-3 — المالية

| العنصر | الحالة | الدور | الحارس |
|---|---|---|---|
| `components/finance/FinanceObligationsCard.tsx` | **N (الوحيد الجديد)** | سطح «شو عليّ؟» — تجميع عرض من قراءة المركز الرسمية بمصدريها ومساري تسديده | FinanceObligations.w43 (5) |
| `pages/Finance.tsx` | U+إعادة ترتيب | ترتيب «الوضع الآن» + بطاقات قابلة للفتح (D8) | FinancePoliciesWallet + FinanceObligations |
| `application/finance/integrityCheckService.ts` | U+إثراء قراءة فقط | `offenderSample` (اسم/تاريخ/مبلغ/href) — لا تغيير للفحوص الـ13 | IntegrityReadable.w43 (2) |
| `pages/ToolsIntegrity.tsx` | U | صفوف باسم العملية بدل المعرفات الخام (D9) | IntegrityReadable.w43 |
| `presentation/financialEventLabels.ts` | M (إلى presentation/) | بيت واحد لتسميات الأحداث — أخرج 172 سلسلة من كثافة ToolsIntegrity | legacyClassCensus |

## P-4.3-4 — العمل والمشاركة

| العنصر | الحالة | الدور | الحارس |
|---|---|---|---|
| `pages/Orders.tsx` | U+إعادة بناء عرض | مجموعات حالة العمل + «الأولوية الآن» + الخطوة التالية لكل طلب | WorkShare.w43 (4) |
| `pages/OrderDetail.tsx` | U | خريطة الخطوة التالية + إيصالات الحالة | WorkShare + OrdJourneys |
| `pages/Collect.tsx` | U+تعديل | إيصال نجاح التحصيل + زر «شارك إشعار القبض» (F06) من الحدث القائم (عقد ٣٣) | WorkShare.w43 |
| `pages/SharePreview.tsx` + `application/share/shareMessageService.ts` | U | المعاينة القابلة للتحرير + البديل اليدوي الصادق | WorkShare + OrderShare.exe015 |
| `components/orders/OrderDepositPanels.tsx` · `components/direct-sales/SaleCollectionReversalSection.tsx` | U | قاموس «تراجع موثق» وعكس التحصيل بروابط الأصل | R1/R2 القائمة |

## P-4.3-5 — الكاش والمحافظ

| العنصر | الحالة | الدور | الحارس |
|---|---|---|---|
| `pages/CashDistribution.tsx` | U+تعديل | «سُجّل التوزيع ✓»/«سُجّلت التغطية ✓» + Idempotency وdestinationWalletId وreturnTo | CashVocabulary.w43 (3) |
| `application/cash/walletLedgerService.ts` | U+تعديل تسمية | حركة «توزيع من غير الموزع» + ملاحظات عائلة توزيع | walletLedgerService.test |
| `application/finance/projectFinancialService.ts` | U+تعديل ملاحظات | ملاحظات العربون/القبض الافتراضية بعائلة توزيع | projectFinancialService.tests |
| `application/collections/collectionReversalService.ts` | U | حقائق عكس القبضة بالمعجم نفسه | collectionReversal tests |
| `pages/SupplierPurchaseEditor.tsx` (+تسديد) | U | وجهة كاش الدفعة و«غير موزع — يُوزّع لاحقًا بقرار صريح» | supplierPurchaseService.tests |
| `pages/CashWallets.tsx` · `WalletLedger.tsx` | U | عرض غير الموزع والفعل السياقي الشرطي | CashJourneys + FinancePoliciesWallet |

## P-4.3-6 — الشاشات العميقة

| العنصر | الحالة | الدور | الحارس |
|---|---|---|---|
| `pages/FinancialEventEditor.tsx` | U+إصلاح GAP-4.3-08 | الإحالات الصادقة للأصول/القروض/الموردين بفعل نصي حقيقي وreturnTo | DeepScreens.w43 (2) |
| `pages/Loans.tsx` + `presentation/g5Plurals.ts` | U+إصلاح GAP-4.3-09 | مثنى القروض المجرور «من أصل قرضين» | DeepScreens.w43 |
| `pages/Catalog.tsx` (عبر `CatalogReadingsSection`) | U | عرض نتائج السياسات ورابطها السياقي فقط — لا كتابة | Catalog.operationKey + Wave42Package5 |
| `pages/Market.tsx` · `pages/Tools.tsx` · `pages/Setup.tsx` · `pages/Foundation.tsx` · `pages/Profile.tsx` · `pages/Settings.tsx` | U | القوالب المعتمدة (بنية 4.1/4.2 مصانة، إصلاح التعليق المسرّب من #178 في قراءة السياسات) | Set003/ToolsIntegrity/ToolsCleanup/Settings القائمة |
| `pages/Assets.tsx` · `InventoryMaterials.tsx` | U+إصلاح #178 | «المالية» + أيقونة الأشقاء في الرجوع | G4Assets/group2InventorySurfaces |

## ملخص عددي

- مكوّن إنتاج **جديد: 1** (`FinanceObligationsCard`) — لأن السطح لم يكن له وجود.
- **معاد بناء/إعادة ترتيب جوهرية: 4** (AppHeader، Home، Orders، Finance-الوضع الآن).
- **معاد استخدام/تعديل: 25** سطحًا ومكوّنًا.
- **منقول: 1** (financialEventLabels إلى presentation).
- **حراس جدد: 8 ملفات/35 اختبارًا** — البنية التحتية (primitives/lucide/Radix drawer) كلها معاد استخدامها كما هي.
