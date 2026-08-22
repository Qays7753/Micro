---
name: micro-design-system
description: تطبيق ومراجعة نظام هوية Micro والتوكنات على Web App وLight/Dark وFigma-to-code. استخدم هذه المهارة عند إنشاء أو تعديل الألوان، الخطوط، المسافات، المكونات، الثيمات، الحالات، أو ملفات التصميم والكود المرتبطة بها.
---

# Micro Design System

## الغرض

حافظ على مصدر واحد للحقيقة لهوية Micro، ثم حوّل التوكنات الرسمية إلى متغيرات قابلة للاستخدام في Web App. افصل Primitive Tokens عن Semantic Tokens، ولا تسمح بأن تتحول مكتبة أو قالب خارجي إلى هوية المنتج.

## المراجع الملزمة

اقرأ قبل أي تعديل:

- [`../../docs/product/mobile-ui-ux-reference-v1.md`](../../docs/product/mobile-ui-ux-reference-v1.md)
- [`../../docs/implementation/prototype-build-charter-v1.md`](../../docs/implementation/prototype-build-charter-v1.md)
- [`../../docs/implementation/mobile-prototype-spec-v1.md`](../../docs/implementation/mobile-prototype-spec-v1.md)
- [`../../docs/05-documentation-governance.md`](../../docs/05-documentation-governance.md)

إذا احتاج التنفيذ إلى ملف tokens مستقل، اجعل المرجع الدلالي هو وثيقة UI/UX الحالية، وسجّل المسار الجديد في الفهرس بدل إنشاء مرجع منافس.

## قواعد التوكنات

1. استخدم أسماء دلالية مثل `background`, `surface`, `foreground`, `muted`, `primary`, `border`, `success`, `warning`, و`error` داخل المكونات.
2. لا تضع Hex خامًا في JSX/TSX/CSS component عندما توجد قيمة Semantic معتمدة.
3. لا تعكس Light Mode إلى Dark Mode حسابيًا. عرّف قيمة كل Semantic Token في الوضعين مع الحفاظ على المعنى والتباين.
4. احترم قيم Micro الرسمية الموجودة في UI/UX Reference. لا تغيّر التيراكوتا أو التركواز أو المحايدات أو درجات الحالة دون قرار Canonical جديد.
5. افصل لون الهوية عن اللون الدلالي. التيراكوتا لا يعني ربحًا، والأخضر لا يعني كاشًا، والأحمر لا يعني دائمًا خسارة.
6. اختبر النص العادي والصغير، النص فوق الأزرار، الحواف، التركيز، disabled، وطبقات Bottom Sheet في الوضعين.
7. لا تجعل التباين اللوني وحده يحمل الحالة؛ أضف نصًا أو علامة مفهومة، خصوصًا للحالات المالية `estimated`, `missing`, `needs_review`.
8. اربط الخط العربي والوزن والـline-height بالمرجع الرسمي، واختبر النص الطويل والأرقام العربية/الغربية حسب عقد المحتوى.

## مكونات يجب ضبطها

طبّق التوكنات على App Shell، Header، Bottom Navigation، FAB، Button، Text Field، Amount Input، Select، Chip، Card، Bottom Sheet، Dialog، Toast/Snackbar، Status، Result، Loading، Empty، Error، وNo-results.

لكل مكوّن وثّق: الاستخدام، الحجم، padding، radius، border، shadow، الحالة الافتراضية، hover/pressed/focus/disabled/loading/error، وقاعدة Dark Mode. إذا لم توجد قيمة في المرجع، لا تخترع قيمة صامتة؛ ارفع قرارًا صغيرًا للمراجعة.

## Figma والكود

استخدم Figma للاستكشاف أو توثيق المكوّنات، لكن لا تعتبر أي Kit خارجي مصدر حقيقة. عند نقل فكرة من Material 3 أو Figma، انقل السلوك أو الهيكل وأعد تنفيذه بتوكنات Micro. افحص الترخيص قبل نسخ الأصول أو الكود، وسجّل المصدر والنسخة والغرض.

## سير العمل

ابدأ بجرد القيم المستخدمة في التغيير. طابق كل قيمة مع Token رسمي. أنشئ أو حدّث التوكنات، ثم طبّقها على المكوّنات، ثم اختبر Light/Dark على أحجام 360 و390 و430px، ثم افحص RTL والنصوص الطويلة والـkeyboard والطبقات.

إذا كان التغيير بصريًا فقط، لا تغير منطق Domain أو Application. وإذا كشف التصميم حاجة إلى حالة مالية جديدة، أوقف التغيير واستدعِ مهارات المنتج والمال والسيناريوهات قبل تعديل الكود.

## معيار القبول

يُقبل التغيير عندما لا توجد قيم خام غير مبررة، وتتطابق الألوان والقياسات مع UI/UX Reference، وتحافظ Light/Dark على المعنى والتباين، وتعمل المكونات مع RTL والنصوص الطويلة، وتظهر حالات التركيز والتعطيل والخطأ بوضوح، وتنجح لقطات المقارنة أو المراجعة اليدوية.

## ممنوعات

لا تستورد Material أو Figma Kit كاملًا لتصبح هوية Micro. لا تستخدم تدرجات أو ظلالًا أو radius جديدة لمجرد الزينة. لا تجعل Dark Mode نسخة سوداء عامة. لا تستخدم اللون لإخفاء نقص البيانات أو تحويل العربون إلى ربح أو الدين إلى كاش.
