# Micro — Refactoring Control

**الحالة:** `OWNER_REVIEW_REQUIRED`
**المرحلة الحالية:** `PRE-SCAN / REPORT-ONLY`
**نوع المساحة:** مساحة تخطيط وتحكم لإعادة الهيكلة، وليست مصدرًا معماريًا منافسًا.

## الغرض

هذا المجلد يجمع الملفات التي يحتاجها برنامج إعادة هيكلة **التطبيق الحالي** فقط، بهدف تحسين:

- سهولة التطوير والتوسع؛
- سهولة تغيير قاعدة أو مبدأ دون تعديل النظام كله؛
- سهولة اكتشاف المشكلة وإصلاحها؛
- وضوح ملكية كل مفهوم ومصدر حقيقته؛
- حماية المنطق المالي والتاريخي من التغيير الصامت.

لا يعني وجود هذا المجلد أن إعادة الهيكلة بدأت، ولا يمنح أي Agent إذنًا بنقل الملفات أو إعادة تنظيم الكود.

## السلطة

1. `AGENTS.md` هو بوابة القراءة والتنفيذ الحاكمة.
2. `docs/operations/current-state.md` هو الحالة الحية لـ`main`.
3. `REFACTORING-PLAN-A-TO-Z.md` هو الخطة المعمارية المرجعية الوحيدة لهذا البرنامج.
4. `REFACTORING-CONTROL.md` يحدد حالة البرنامج وبواباته التشغيلية.
5. تقرير المسح القادم `STRUCTURE-ARCHITECTURE-CODE-ORGANIZATION-SCAN.md` سيكون سجل المكتشفات، وليس تفويضًا بالتنفيذ.

إذا تعارض أي ملف هنا مع عقد أو سياسة مالية أو قرار مالك، تتغلب الوثيقة الحاكمة ويسجل التعارض بدل التخمين.

## الملفات

| الملف | الوظيفة | الحالة |
|---|---|---|
| `REFACTORING-PLAN-A-TO-Z.md` | الرأي المعماري والخطة من A إلى Z | مرجع تخطيطي؛ لا تفويض تنفيذ |
| `REFACTORING-CONTROL.md` | حالة البرنامج، الحدود، البوابات، وقواعد التسليم | حاكم لمسار البرنامج فقط |
| `ZAI-STRUCTURE-ARCHITECTURE-SCAN-PROMPT.md` | الأمر الجاهز لـZ AI لتنفيذ المسح وإعداد التقرير | Prompt إصدار 1 |
| `STRUCTURE-ARCHITECTURE-CODE-ORGANIZATION-SCAN.md` | تقرير Z AI القادم | لا يُنشأ أو يُحدّث إلا في مرحلة المسح |

## القاعدة الأساسية

```text
read-only structure scan
→ owner reviews findings and target map
→ owner accepts classifications and remediation waves
→ controlled structural changes on a dedicated branch
→ focused tests and CI after every approved wave
```

## ممنوع في مرحلة المسح الحالية

- تعديل `apps/` أو `src/` أو `tests/` أو `scripts/`؛
- نقل أو إعادة تسمية أو حذف أي ملف؛
- إنشاء مجلد `features/` أو `shared/` أو `utils/` جديد؛
- تغيير المعادلات أو المصطلحات أو السياسات المالية؛
- تغيير Schema أو Migration أو Export/Import أو Historical Interpretation؛
- تعديل UI/UX أو CSS أو TSX أو tokens أو DOM أو visual QA؛
- بناء Dart أو Flutter أو Python أو API أو Sync أو Auth؛
- دمج نتائج المسح أو تنفيذ أي موجة بنيوية قبل مراجعة المالك.

يجوز فقط إنشاء/تحديث تقرير المسح وملفات التحكم التوثيقية داخل هذا المجلد، مع PR منفصل وواضح.
