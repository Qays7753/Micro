# Contributing to Micro

## قبل أي تغيير

ابدأ بقراءة `docs/00-document-index.md` ثم `docs/01-product-and-technical-blueprint.md`. إذا كان التغيير ماليًا أو تشغيليًا، اقرأ العقود الموجودة في `docs/contracts/` وحزمة `ai-skills/microbusiness-finance-operations/`. إذا كان تقنيًا أو متعلقًا بالنشر، اقرأ `ai-skills/saas-delivery-verifier/`.

قبل كتابة الكود، اكتب بطاقة قرار مختصرة تتضمن المشكلة المرتبطة، الدليل، أقل نطاق، معيار القبول، معيار الفشل، والملفات التي ستتغير. لا تعتبر Accounting أو zman-app أو مشروع GitHub مصدر تعريف للمنتج.

## نطاق الشريحة الحالية

الشريحة الأولى هي طلب حرفة يدوية مخصصة. لا تضف الطعام أو الخدمات أو Billing أو CRM أو POS أو WhatsApp أو مزامنة متعددة الأجهزة إلا بقرار جديد واختبار يبرر التوسع.

## قواعد الكود

يجب أن يبقى Domain Core مستقلًا عن الواجهة والتخزين والمزود. استخدم وحدات نقدية صحيحة أو Decimal، واحفظ `cost_snapshot`، ولا تجعل القبض مساويًا للربح أو العربون ربحًا نهائيًا أو الدين كاشًا.

لا تحذف الأحداث المالية بصمت. استخدم reversal أو settlement، واحفظ `idempotency_key` لكل عملية قابلة لإعادة المحاولة.

## التحقق المحلي

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
```

لا تفتح Pull Request أو ترفع Commit إذا فشل typecheck أو الاختبار أو ظهر سر في التغيير. يجب أن يصف Commit التغيير الفعلي لا نتيجة عامة مثل `update stuff`.

## الكود الخارجي

قبل إدخال مكتبة أو snippet أو كود من GitHub، سجّل الرابط، الإصدار أو commit، الترخيص، سبب الملاءمة، والتعديلات في `THIRD_PARTY_NOTICES.md`. لا تُدخل كودًا بلا ترخيص واضح.
