# عرض «ما يثبته كل حارس» (Guard Proves / Does-Not-Prove View)

**الحالة:** `CURRENT / VIEW — إحالة لا مصدر حقيقة` · **أُنشئ:** 2026-10-11 (R10-B1/R10A-F-037) · **الغرض:** يجيب الوكيل البارد عن «ما الذي يثبته كل حارس وما الذي لا يثبته؟ وأين يجري كل منها؟» بمسار واحد.

---

## 1. الجدول الكنوني

المرجع الحاكم الكامل — بما فيه عمودي «لا يثبت» و«تصنيف التغييرات» لكل حارس — هو:
**`docs/architecture/refactoring/REFACTORING-PLAN-A-TO-Z.md` §4.3.1 «ميتاداتا الحراس الدائمة الموثقة (PG-2)»** (20 حارسًا عند آخر تحديث مؤرخ). لا يكرر هذا العرض مضامينه.

## 2. خريطة التشغيل — أي أمر يشغّل ماذا

| الأمر | ما يشغّله | ملاحظات |
|---|---|---|
| `pnpm guards` | 18 حارس نصي: secrets, test-focus, entity-touchpoints, runtime-cycles, doc-index-coverage, current-state-size, skill-references, image-policy, module-boundaries, type-cycles, registry-coverage, acceptance-value-anchors, file-size-ratchet, vendored-braces, date-arithmetic-ownership, application-door-surfaces, application-readwrite, storage-listener-guards | تعريف السلسلة في `package.json` |
| `pnpm design-guards` | design-token-guards.py + theme-contrast-guard.py + stylelint | حراس التصميم الثلاثة |
| `pnpm text-density` | text-density-count.py | كثافة النص |
| داخل بناء النموذج (`prototype:build`) | `check-bundle-budget` + `check-bundle-surfaces` | حارسا البناء (وثّقا في §4.3.1 بتحديث R8-F-021) |

## 3. قاعدة القراءة الحاكمة

الحارس يثبت **فقط** ما يقوله جدوله الكنوني، ولا شيء فوقه: حارس أخضر لا يعني «السطح سليم» بل «الخاصية المحروسة المحددة لم تنكسر». الفروق الدقيقة (مثل: دورات القيم مقابل الدورات النوعية؛ حواف القيمة والنوع والديناميكي في حدود الوحدات؛ الأساس مقابل السقف في الراتشة) موثقة في §4.3.1 نفسه وهو الحكم عند أي التباس.

## 4. ماذا يثبت هذا العرض وماذا لا يثبت

**يثبت:** أن سؤال «ماذا يثبت الحارس X؟» له مسار إجابة واحد من نقطة البداية الباردة. **لا يثبت:** حالة أي حارس الآن — الحالة تُقرأ من آخر تشغيل (CI / `pnpm check`). عند إضافة حارس مستقبلي: يُحدَّث §4.3.1 أولًا (المرجع) ثم خريطة التشغيل هنا.

## 5. نقطة العودة (Rollback)

عرض توثيقي إحالي؛ إرجاعه commit توثيقي واحد بلا أثر تشغيلي.
