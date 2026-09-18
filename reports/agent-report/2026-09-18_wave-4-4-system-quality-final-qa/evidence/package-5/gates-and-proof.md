# أدلة الحزمة 5 — P-4.4-5: الوصول ولوحة المفاتيح وZoom وReflow (WCAG 2.2 AA)

**PR:** [#185](https://github.com/Qays7753/Micro/pull/185) · **Head:** `8edbbca4a0` · **Merge:** `5f2594abd4221723e69798dfd62346e5a5627a2a` · CI أخضر على PR وعلى Merge SHA

## الملفات (10، +747/−406)

- عائلة الخطوط كاملة إلى rem: 375 تعريف font-size في `index.css` + 11 توكن `--vf-text-*` — تكبير نص المتصفح يعمل؛ الهوية عند 16px لم تتغير بالميلي. stylelint وحارس design-tokens اعتمدا سلم NN/16 بنفس القيم.
- ما بقي px عمدًا: المسافات والأنصاف والحدود وأهداف اللمس 44/48px (محروسة بU-09).
- علم `fieldError` يرفع `aria-invalid` لتحقق الحقلي فقط لا لفشل الحفظ — QuickSaleForm/QuickExpenseForm/LoanEditor مع `aria-describedby`.
- `Field.tsx` الأساسي: وصلات الوصول تلقائية عند controlId.
- `Accessibility.w44.dom.test.tsx` (7): أسماء وصول الأزرار، ربط خطأ التحقق، وصلات Field، لا Enter في textarea، أفعال عالية الأثر بمسار تراجع، لا px متبقية، prefers-reduced-motion.

## البوابات

typecheck ✓ · lint 0/37 ✓ · format ✓ · text-density ✓ · design-guards 82/82 + سلم stylelint rem ✓ · guards الأربعة ✓ · Domain 404 ✓ · Web 1553 ✓ · build ✓ · Schema/Export 35/27 ✓
