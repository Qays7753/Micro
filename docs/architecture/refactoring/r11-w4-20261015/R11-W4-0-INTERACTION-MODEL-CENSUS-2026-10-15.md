# R11 W4-0 — إحصاء نماذج التفاعل (قبل أي تغيير — OD-A11Y الخيار B)

**الموجة:** R11 متابعة — Phase 5 (W4-0) | **التاريخ:** 15 أكتوبر 2026 (UTC) | **المنفذ:** ZAI
**العقد الحاكم:** عقد المتابعة §11 + OD-A11Y (OPTION_B — SEMANTICS_ONLY) | **الـPR:** #368

## 1. الغرض

تصنيف كل سطح حواري في كود الإنتاج **قبل** لمسه (شرط العقد: «classify every surface before changing it»)، وتثبيت التصنيف في حارس دائم يرفض أي سطح حواري جديد غير مصنف — فلا يعود صنف حوار غير مفحوص أبدًا.

## 2. السجل المصنف (الحارس 25: `scripts/check-a11y-dialog-surfaces.mjs`)

| السطح | التصريح الحالي | النموذج | صنف عقد التركيز | القرار |
|---|---|---|---|---|
| `components/security/AppLockGate.tsx` | dialog + aria-modal=true | **TRUE_MODAL** | veil + محتوى inert + autoFocus — **الأوراكل** | لا يُمس في W4 (قرار العقد) |
| `components/security/DataActionPinGate.tsx` | alertdialog + aria-modal=true | **TRUE_MODAL** | autoFocus فقط اليوم | **D-14 FIX_NOW**: veil + احتواء Tab + Escape + استعادة (نمط AppLockGate/UnsavedChangesGuard) |
| `pages/Settings.tsx` (protectionBlocked) | alertdialog + aria-modal=true | **TRUE_MODAL** | لا عقد تركيز إطلاقًا اليوم | **D-14 FIX_NOW**: veil + focus-in + احتواء + Escape + استعادة |
| `components/forms/UnsavedChangesGuard.tsx` | dialog + aria-modal=true | **TRUE_MODAL** | focus-in + احتواء Tab + Escape + استعادة — **مطابق سابقًا** | PRESERVE — لا تغيير |
| `components/layout/AppHeader.tsx` | dialog + **aria-modal=false** | **NON_MODAL** | لا فخ تركيز (صحيح بالتصميم) | PRESERVE — لا تغيير |
| `components/layout/QuickActionSheet.tsx` (تأكيد التجاهل) | alertdialog (متداخل، بلا aria-modal) | **NESTED_CONFIRM** | لا فخ تركيز (تأكيد داخل ورقة قائمة؛ غير تطبيقي-المودال) | PRESERVE — لا تغيير |
| `pages/RecurringExpenseDetail.tsx` (٣ أقسام: إلغاء/تأجيل/تخطي) | dialog **بلا** aria-modal **وبلا** إزاحة تركيز | **INLINE_MISDECLARED** | لا فخ ولا إزاحة (صحيح كمحتوى غير مودال) | **D-13 FIX_NOW**: تصريح region بدل dialog (دلالي فقط؛ لا فخ ولا إزاحة) |

## 3. القواعد المفروضة

- **فخ التركيز قانوني للـTRUE_MODAL وحده** (قرار OD-A11Y الصريح)؛ الألواح غير المودالة والمناطق والأقسام الداخلية: لا فخ أبدًا.
- أي سطح حواري جديد (role=dialog/alertdialog أو aria-modal) غير مصنف → فشل حتى يصنف في نفس الـPR.
- انجراف الدور أو aria-modal عن السجل → فشل (التحديث المقصود يوثق في نفس الـPR).
- ملف مسجل غادر الشجرة → فشل (نظافة السجل).
- **مسبار ارتداد D-13**: بعد تنفيذ D-13 (تقاعد INLINE_MISDECLARED من السجل) يرفض الحارس عودة role="dialog" إلى الأقسام الداخلية أو نقصان مناطقها عن الثلاث.

## 4. البوابة والقياس

- الحارس يعمل حيًّا: 369 ملف إنتاج مزروعة؛ 7 أسطح مصنفة؛ 7 ملفات تحمل تصريح حوار حيًا.
- اختباره الخصومية: 7/7 (سطح جديد يُرفض؛ انجراف دور يُرفض؛ انجراف aria-modal يُرفض؛ تسجيل متقادم يُرفض؛ مسبار D-13 يرتبط بتقاعد الصنف؛ استخراج JSX النصي والتعبيري).
- لا أي تغيير إنتاجي في هذه الخطوة — إحصاء وتصنيف وحارس فقط.

```text
R11_W4_0_INTERACTION_MODEL_CENSUS_COMPLETE — VERIFIED
NO_PRODUCTION_CHANGE
```

الخطوة التالية بالتسلسل المعتمد: **D-14** (بوابات TRUE_MODAL الناقصة) ثم D-13 ثم D-15.
