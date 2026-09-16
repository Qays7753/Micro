# سجل الأوامر التشخيصية والتشغيلات — تدقيق 2026-09-16

جميع الأوامر التالية نُفذت خلال التدقيق على نسخة قراءة فقط من `main @ 37319ca6439746e8ab1946e891c849decca04e5d` (بعد `pnpm install --frozen-lockfile` بـ pnpm 9.15.9 عبر Corepack — لا تعديل على الكود أو الاعتماديات). لم يُنفَّذ `pnpm check` الكامل (بطيء وغير لازم للتدقيق) — استُبدل بتشغيلات مركزة.

## الوكيل 2-a (الأحداث المالية والدفاتر)

| الأمر | الخروج | العدّ |
|---|---|---|
| `pnpm test -- tests/domain/loan.test.ts tests/domain/cash-continuity.test.ts` | 0 | 2 ملف / 8 اختبارات |
| `pnpm --filter @micro/prototype-web test -- client/src/application/loans/loanService.test.ts client/src/storage/local/IndexedDbLocalStore.group4.test.ts` | 0 | 2 ملف / 13 اختبارًا |
| `pnpm --filter @micro/prototype-web test -- client/src/QuickExpenseSource.dom.test.tsx` | 0 | 1 ملف / 5 اختبارات (تثبيت أن إصلاح FIN-005 قائم في السطحين) |
| `pnpm --filter @micro/prototype-web test -- client/src/CashJourneys.dom.test.tsx` | 0 | 1 ملف / 7 اختبارات |

## الوكيل 2-b (المحاسبة والتسوية) — إعادة تشغيل بعد فشل محاولة أولى بمهلة

| الأمر | الخروج | العدّ |
|---|---|---|
| `cd /home/z/my-project/audit-2026-09-16/agents/2-b/diagnostics && vitest run --config vitest.audit.config.ts` (اختبارات تشخيصية خارج المستودع تُسلسل الدورة المحاسبية كاملة وتعيد إنتاج عطل MIC-2) | 0 | 3 ملفات / 3 اختبارات — تشمل: سلسلة 10 حلقات (رصيد افتتاحي، بيع+قبض+دين، مصروف، شراء+دين مورد، دفعة مورد من محفظة، مال مالك/سحب، قرض+سداد، استهلاك مادة، أصل+إهلاك) بمطابقة 8 معادلات متزامنة، وإعادة إنتاج MIC-2 |
| `vitest run tests/domain/{complex-six,exact-values,cash-allocation,cash-continuity,rounding-boundaries,asset,g5}.test.ts` (جذر المستودع) | 0 | 7 ملفات / 85 اختبارًا |
| `vitest run client/src/application/finance/{projectFinancialService,periodResultCanonical,integrityCheckService,ownerEntitlementService,unallocatedDistribution,statementService}.test.ts + cash/cashContinuityService.test.ts + suppliers/supplierPurchaseService.wallet.test.ts + loans/loanService.test.ts` (داخل apps/prototype-web) | 0 | 9 ملفات / 134 اختبارًا |

نتائج السلسلة الكاملة (تشغيلي): recordedCash 231.00 = wallets 180.00 + unallocated 51.00؛ مصادر الكاش 200+30+100−3−9−20+8−60−15 = 231؛ ذمم مدينة 20.00؛ ذمم دائنة 3.00؛ مال المالك 85.00؛ أصول 55.00 (دفترية بعد إهلاك)؛ قروض 12.00؛ أمانات 0؛ نتيجة الفترة 2800 قرشًا بحالة `incomplete` بسبب «إهلاك مسجّل» (سلوك مقصود: الإهلاك يجعل النتيجة غير نهائية). **إعادة إنتاج MIC-2**: محفظة 100 + شراء 50 + دفعة من المحفظة 20 → المعادلة سليمة (80=80+0) لكن MIC-2 يُرجع فشلًا بنيويًا.

## الوكيل 2-c (الطلبات والمشتريات والمخزون والتحصيل)

| الأمر | الخروج | العدّ |
|---|---|---|
| `pnpm test -- tests/domain/inventory-material.test.ts` | 0 | 1 ملف / 12 اختبارًا |
| `pnpm test -- tests/domain/supplier-purchase-corrections.test.ts` | 0 | 1 ملف / 9 اختبارات |
| `pnpm --filter @micro/prototype-web test -- client/src/application/orders/collectionReversalService.test.ts` | 0 | 1 ملف / 10 اختبارات |

## الوكيل 2-d (سلامة البيانات والنسخ والاستعادة)

| الأمر | الخروج | العدّ |
|---|---|---|
| `node scripts/check-entity-touchpoints.mjs` | 0 | حارس الكيانات الدائمة: PASS (32 مخزنًا + 3 سجلات محلية مسجلة) |
| `pnpm --filter @micro/prototype-web test -- client/src/application/preferences/preferenceService.test.ts` | 0 | 1 ملف / 6 اختبارات (لا يغطي الكاتبين المعيبين — انظر AUD-NEW-02) |
| `pnpm --filter @micro/prototype-web test -- client/src/application/transfers/... + storage/local/persistentStorage.test.ts` (مجموعة خدمات النقل والتخزين) | 0 | 36/36 |
| `pnpm --filter @micro/prototype-web test -- actualTimeService + scheduleService` | 0 | 17/17 |

## الوكيل 2-e (المعمارية والاكتشاف والهاتف)

| الأمر | الخروج | العدّ |
|---|---|---|
| `pnpm --filter @micro/prototype-web test -- client/src/app/navigationContract.test.ts` | 0 | 1 ملف / 14 اختبارًا |
| `pnpm --filter @micro/prototype-web test -- client/src/app/routeKnowledgeSync.test.ts client/src/app/navigation.test.ts` | 0 | 2 ملف / 9 اختبارات |
| `python3 scripts/text-density-count.py` | 0 | كل الأسطح داخل السقوف: Finance ‏261/261، Statement ‏205/205، OrderDetail ‏179/179، FinancialEventEditor ‏145/145، Catalog ‏91/91، Schedule ‏99/99 |

## الوكيل الرئيسي — التحقق الحي (جلسة متصفح معزولة، بيانات تجريبية فقط)

- المتصفح: Chromium مقنّع عبر agent-browser (Playwright)، جلسة منفصلة `micro-audit`، مقاس **390×844** فقط (لم تُدَّعَ مقاسات أخرى).
- النظام: https://micro-prototype.pages.dev/ — تطابق الالتزام مؤكد عبر تطابق اسم أصل الباقة `assets/index-DBoPbry_.js` مع مخرج بناء CI للالتزام `37319ca` (تحقق hash الاسم لا فروق بايتية).
- سيناريو الجلسة (بيانات تجريبية): إعداد مشروع «مشروع تدقيق تجريبي» بمحفظة «الدرج» ورصيد افتتاحي 100 → بيع مباشر 60 مقبوض في «غير الموزع» → توزيع 20 للدرج (نجح) → توزيع ثانٍ 30 في نفس الزيارة (رسالة نجاح بلا كتابة — عيب AUD-NEW-01) → شراء مورد 50 بدفعة أولية 20 من المحفظة → تشغيل «فحص سلامة مالي» (فشل MIC-2 الزائف — عيب AUD-NEW-03) → إيقاف قدرة «الطلبات والتنفيذ» ثم حفظ «طريقة العمل» (عودة القدرة بصمت — عيب AUD-NEW-02) → بدء بارد على `/market` (زر «رجوع لمشروعي» نفّذ history.back وهبط على صفحة سابقة لا الرئيسية — عيب AUD-NEW-13).
- أرقام الجلسة النهائية (تطابق مع متوقعات النموذج): كاش كلي 140 = محفظة 100 + غير موزع 40؛ ذمم موردين 30؛ 12/13 فحص سلامة «سليم» و1 «خلل» (هو الفشل الزائف).

## التحقق من النشر

- `curl -s https://micro-prototype.pages.dev/` → `assets/index-DBoPbry_.js` (تطابق حرفي مع سجل CI لالتزام `37319ca`: "bundle-budget: entry=assets/index-DBoPbry_.js"، ملف `ci-main-merge-log.txt` سطر 893).
- CI لالتزام الأساس: أخضر (المرحلة الأخيرة PASS: بناء 647,000/650,000 خام و154,413/155,000 مضغوط + رفع artifact ناجح).
