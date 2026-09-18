# أدلة الحزمة 1 — P-4.4-1: بقايا Wave 4.3 واتساق طبقة القراءة

**PR:** [#181](https://github.com/Qays7753/Micro/pull/181) · **Head:** `1c74310484` · **Merge:** `5020145c7ab62503b121f6c377134f41bfc8c1ce` · CI أخضر على PR وعلى Merge SHA

## الملفات (15، +675/−103)

- `application/assets/assetService.ts` + `application/loans/loanService.ts`: `overview()` ترجع `{ rows, totals }` — معادلات الاختزال نفسها انتقلت من العرض إلى خدمة القراءة.
- `application/finance/projectFinancialService.ts`: `operatingPayablesMinor` (= `project.payableMinor`) — القيمة التي كانت FinanceObligationsCard تطرحها في العرض.
- `pages/Finance.tsx`/`Assets.tsx`/`Loans.tsx` + `FinanceObligationsCard.tsx`: تقرأ من نموذج القراءة — لا طرح في العرض.
- `pages/Home.tsx` + `application/homeControlCenterService.ts`: بطاقات الحقائق بمصادر D8 حقيقية (كاش→/cash، لي عند العملاء→/parties، عليّ للموردين→سطح شو عليّ؟، غير الموزع→/cash)؛ الحقائق غير المسجلة بلا Chevron ولا وجهة مختلقة.
- `pages/ToolsIntegrity.tsx`: حذف زر «أظهر المعرّفات» الميت (بلا منتج صحي بعد D9) — المعرفات الخام تبقى داخل تفاصيل المخالف عند وجودها.
- لوحتا النقل/اسأل Micro: `aria-haspopup="dialog"` + فتح/إغلاق خارجي + Escape + حبس Tab + إعادة التركيز للمشغّل — نمط قائمة الشعار نفسه.

## إثبات التطابق قبل/بعد

`ReadLayerParity.w44.dom.test.tsx` (10 اختبارات): fixtures موثقة لملخصات الأصول/القروض/الالتزامات — نفس الأرقام قبل النقل وبعده؛ ضمان القراءة النقية (لا كتابة في خدمات القراءة)؛ مصادر D8؛ إزالة الزر الميت؛ سلوك Escape/التركيز.

## البوابات

typecheck ✓ · lint 0/37 ✓ · format ✓ · text-density ✓ · design-guards 82/82 ✓ · secrets ✓ · test-focus ✓ · entity-touchpoints ✓ · cycles ✓ · Domain 404 ✓ · Web 1511 ✓ · build ✓ · bundle 598,989/142,152 ✓ · Schema/Export 35/27 بلا تغيير ✓
