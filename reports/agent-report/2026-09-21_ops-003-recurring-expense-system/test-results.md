# نتائج الاختبارات — OPS-003 (موجات A–E) · رأس الفرع `4d72806` · 2026-09-21

جميع الأوامر من جذر المستودع (`corepack pnpm` 9.15.9؛ vitest 4.1.11؛ jsdom للـDOM).

## البوابة الكنسية

| الأمر | النتيجة |
|---|---|
| `pnpm check` (الكنسي الكامل: operations-control:test/check + typecheck + lint + format + text-density + design-guards + guards + test + prototype:check/test/build) | **EXIT 0** — سجل كامل: `/home/z/my-project/.check-waveE.log` |
| الاختبارات الجذعية (`pnpm test`) | ٣٧ ملفًا / **٤٣٤ اختبارًا** PASS |
| اختبارات التطبيق (`pnpm prototype:test`) | ٢٤٧ ملفًا / **١٧٤٦ اختبارًا** PASS |
| `pnpm lint` | **٣٧/٣٧** (٠ أخطاء؛ الملفات الجديدة بلا تحذيرات) |
| `pnpm prototype:build` + ميزانية الحزمة | PASS — خام **٦٢٦,٢٢٢/٦٥٠,٠٠٠** + gzip **١٤٨,٧٥٠/١٥٥,٠٠٠** (D-034) |
| `validate.py` | صالح — ٦٤ بندًا، ١٣ عملًا، ١ claim نشط (WS-171) |
| `generate_tracker.py --check` | Views + Excel meta محدثة |
| `check-secrets` / `check-test-focus` / `check-entity-touchpoints` / `check-runtime-cycles` | PASS / PASS (٢٨٤ ملف اختبار، ٠ `.only`/`.skip`) / PASS (٣٥ مخزنًا) / PASS (٢٩٢ ملفًا) |
| `git diff --check` | نظيف |

## المجموعات المركزة (أرقام الموجات)

| المجموعة | الملف | العدد |
|---|---|---|
| دومين المصروف المتكرر | `tests/domain/recurring-expense.test.ts` | ٢٥ (دورة/تقويم متجهات ٢٨-٣١/كبيسة/انتقالات/حد الاستئناف/حارس الاصطدام) |
| السطح العام للدومين | `tests/domain/public-surface.test.ts` | ١٥ (وصف ٤ واعٍ للبرميل الجديد) |
| خدمة المصروف المتكرر | `client/src/application/finance/recurringExpenseService.test.ts` | ٢٠ |
| حارس الالتزام | `client/src/storage/local/recurringExpenseCommitGuard.test.ts` | ٥ |
| مطابقة المحولين (تكرارية) | `client/src/storage/local/adapterConformance.recurringExpense.test.ts` | ٣ |
| مخزن IndexedDB (تكراري) | `client/src/storage/local/IndexedDbLocalStore.recurringExpense.test.ts` | ٢ |
| ترحيل ٣٥→٣٦ | `client/src/storage/local/IndexedDbLocalStore.open-count.test.ts` (سلسلة الترقية) | ضمن المجموعة |
| النقل/المغلف ٢٨ | `client/src/application/transfers/localTransferService.recurringExpense.test.ts` | ٣ (ذات ٥ حالات رفض داخلها) |
| كل مجموعات النقل | `client/src/application/transfers/` | ١٢٠ |
| DOM أسطح التكرار | `client/src/RecurringExpenseSurfaces.dom.test.tsx` | ١٧ |
| تحذير المحرر اليدوي | `client/src/pages/FinancialEventEditor.ui.test.tsx` | +١ (٤ إجمالي الملف) |

## تغطية المخاطر المالية (مصفوفة القبول)

| الخطر | الدليل |
|---|---|
| لا حدث عند الاستحقاق/التأخر | خدمة «متأخر انتباه لا دين» + DOM «الفتح لا يكتب حدثًا» — اللقطة صفر أحداث |
| التخطي لا يكتب صفرًا ولا حدثًا | خدمة + DOM + نقل — اللقطة قبل=بعد |
| تأكيد مزدوج (متتابع/متزامن) = حدث واحد | خدمة (reused + Promise.all) + DOM |
| المجهول لا يصير نجاحًا | خدمة (فحص/إعادة/يتيم) + DOM (لا زعم؛ العلامة محايدة) |
| الفشل الموثق برسالة صادقة | خدمة + DOM («لم يُسجل المصروف») |
| التراجع يحفظ الأصل ولا يفتح الفترة ولا يسمح بثانٍ | خدمة (عكس كنوني) + DOM (عرض مشتق) |
| المراجعة الخلف تحمي المقَرَّرة | دومين + خدمة (٢٠٢٦-٠٩ تبقى مراجعة ١) |
| dueOn/occurredOn/confirmedAt متمايزة | خدمة (قيم ثلاث مختلفة مثبتة) + DOM («تاريخ حدوث المصروف» مميزًا) |
| غياب المبلغ رفض بلا كتابة | خدمة + DOM |
| الإلغاء مستقبلي فقط بلا مس تاريخ | خدمة + DOM |
| الاصطدام عبر الأنواع رفض صادر | حارس + مطابقة المحولين |
| الترحيل/التوافق (٢٧/٣٥ موروث، ٢٨/٣٦ ذهاب-إياب) | مجموعات النقل والترحيل |
| الحتمية داخل حد الكتابة | حارس + مطابقة (Promise.all→١) |

**لا `.only` ولا `.skip` ولا اختبار معطّل** — حارس التركيز يثبت (٢٨٤ ملفًا).
