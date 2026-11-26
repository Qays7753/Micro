# Micro Manage v2 — جرد الحذف (DELETION-MANIFEST)

> **M1.9 (قرار المالك D-10، 26/11/2026):** كل مسار يُخطَّط لحذفه يُعلَن هنا **قبل** حذفه — لا يعود كود ميت بصمت. الحارس `scripts/check-deleted-imports.mjs` (مسجَّل في `guards`) يقرأ هذا الجرد ويفشل البناء إذا استورد أي ملف إنتاج مسارًا موسومًا `deleted` (بالمستعار أو بالنسبي)، وإذا عاد مسار محذوف إلى الشجرة.
>
> **المصدر:** مسارات IMPACT.md §1 (جدول المناطق المالية المحذوفة + مستوردوها) و§13 (حالات الفصل وحذف شاشة تسليم الطلب). المسارات أدناه بصيغها الفعلية في المستودع (`apps/prototype-web/…` حيث يقع العميل). الحالة: `planned` (معلَن، لا يُفرض بعد) أو `deleted` (مُنفَّذ، يُفرض فورًا). المراحل من لوحة `TRACKER.md` — الحذف الكامل في المرحلة ٦، وقد يسبقه فصل منفَّذ في مرحلة سابقة.

| المسار | السبب | البديل | الحالة | المرحلة |
|---|---|---|---|---|
| `src/domain/craft-order/policies.ts` | منطق الطلبات القديم (IMPACT §1.1) | كيان «بيع أو طلب» الجديد (§5) | planned | المرحلة ٦ |
| `src/domain/craft-order/types.ts` | أنواع الطلبات القديمة (IMPACT §1.1) | أنواع البيع/الطلب الجديدة (§3) | planned | المرحلة ٦ |
| `src/domain/craft-order/deliveryContribution.ts` | مساهمة التسليم في الطلب القديم (IMPACT §1.1) | قيود التسليم في Q1–Q20 (§4) | planned | المرحلة ٦ |
| `src/domain/financial-event/policies.ts` | الأحداث المالية الـ19 (`DELTA_TABLE`) (IMPACT §1.1) | القيود المحاسبية Q1–Q20 (§4) | planned | المرحلة ٦ |
| `src/domain/cash-continuity/` | النقد والمحافظ (IMPACT §1.1) | صندوقان (نقد/حساب) + المطابقة (§7.1) | planned | المرحلة ٦ |
| `src/domain/inventory-material/` | المخزون والمواد (IMPACT §1.1) | لا مخزون في النظام الجديد (R-14) | planned | المرحلة ٦ |
| `src/domain/supplier-purchase/` | المشتريات والموردون (IMPACT §1.1) | «كل شراء مصروف» (§8، D-12) | planned | المرحلة ٦ |
| `src/domain/direct-sale/` | البيع المباشر (IMPACT §1.1) | يُدمج في كيان «بيع أو طلب» (§5) | planned | المرحلة ٦ |
| `src/domain/owner-entitlement/` | حق المالك القديم (IMPACT §1.1) | إيداع/سحب شخصي (Q1–Q20) | planned | المرحلة ٦ |
| `src/domain/asset/` | الأصول (IMPACT §1.1) | لا أصول — المعدات مصروف معروض (S2، §8) | planned | المرحلة ٦ |
| `src/domain/loan/` | القروض الممنوحة (IMPACT §1.1) | سلفة لشخص (سطر التزامات) | planned | المرحلة ٦ |
| `src/domain/received-loan/` | القروض المستدانة (IMPACT §1.1) | مبلغ مستدان من شخص (Q1–Q20) | planned | المرحلة ٦ |
| `src/domain/budget/` | الميزانيات (IMPACT §1.1) | لا ميزانيات — صرف من العمليات | planned | المرحلة ٦ |
| `src/domain/recurring-expense/` | المصاريف المتكررة (IMPACT §1.1) | تسجيل المصروف يدويًا عند وقوعه | planned | المرحلة ٦ |
| `src/domain/recurring-margin/` | الهامش المتكرر (IMPACT §1.1) | ربح §8 من القيود وحدها | planned | المرحلة ٦ |
| `src/domain/financial-analysis/` | التحليل المالي القديم (IMPACT §1.1) | يعاد بناؤه على معادلات §8/§8.2 | planned | المرحلة ٦ |
| `src/domain/planning/` | التخطيط/التقديرات (IMPACT §1.1) | ينتقل إلى أدواتي (استقلال نواته نُفِّذ في M1.1) — الحذف بعد اكتمال النقل | planned | المرحلة ٦ |
| `src/domain/catalog/` | الكتالوج (IMPACT §1.1) | «منتجاتي» تُبنى من الصفر (§3.3) | planned | المرحلة ٦ |
| `src/domain/party/` | الأطراف (IMPACT §1.1) | الاسم نص حر (R-17، §3.4) | planned | المرحلة ٦ |
| `src/domain/actual-time/` | الوقت الفعلي (IMPACT §1.1) | أعمار الالتزامات من القيود (§8) | planned | المرحلة ٦ |
| `apps/prototype-web/client/src/pages/DeliveryReview.tsx` | شاشة تسليم طلب مانج (مسار `/orders/:id/deliver`) — ليست مكوّن التوصيل (IMPACT §13/§7) | شاشات المبيعات الجديدة (P-60 وما جاورها) | planned | المرحلة ٦ |
| `apps/prototype-web/client/src/components/ask/AskDraftCard.tsx` | مسودة «اسأل Micro» المالية — كتابة `financialEvents` (فصل S3 المعتمد) | إعادة تصميم على النظام الجديد بقرار لاحق | deleted | المرحلة ١ (M1.3) |

## ملاحظات الحارس

- الصفوف `planned` تعريفية حتى تاريخ حذفها: عند الحذف الفعلي تُغيَّر حالتها إلى `deleted` **في نفس الـPR الذي يحذف المسار** — فيمنع الحارس عودة أي مستورد لها فورًا (بالمستعار `@micro-domain/…` و`@/…` وبالنسبي).
- الاستثناء: مستوردو الملفات **المتبقية** من عائلة قيد الفصل (مثل إعادة تصدير `craft-order` التوافقية لـ`src/domain/costing/` بعد M1.1) لا يُعدّون مخالفة ما دام صفهم `planned`.
- مسح الحارس: ملفات الإنتاج تحت `src/` و`apps/prototype-web/client/src/` و`apps/prototype-web/worker/` (بلا اختبارات) — استيراد من خارج هذه الجذور خارج نطاق الرصد الموثَّق.
