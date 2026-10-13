# عرض تكافؤ التخزين (Storage Parity View)

**الحالة:** `CURRENT / VIEW — إحالة لا مصدر حقيقة` · **أُنشئ:** 2026-10-11 (R10-B1/R10A-F-037) · **الغرض:** يجيب الوكيل البارد عن «ما تكافؤ IndexedDB/Memory وأين دليله؟» بمسار واحد.

---

## 1. ما يعنيه التكافؤ هنا

التطبيق يعمل على محوّلين للتخزين المحلي بالمنفذ نفسه (`PrototypeLocalStore`): **IndexedDB** (الإنتاج: `IndexedDbLocalStore.ts` + `indexedDbPrimitives.ts`/`indexedDbMigrations.ts`/`indexedDbStores.ts`/`indexedDbLifecycle.ts`) و**Memory** (الاختبار واللقطات: `MemoryLocalStore.ts`). التكافؤ يعني: نفس العقود، نفس رفض التعارض (`storage_stale` بلا كتابة)، نفس هوية الأخطاء، نفس أمان المعاملات وCAS والإدمان (idempotency) على كلا المحوّلين.

## 2. أين الحقيقة (المصادر الحاكمة — لا تُنسخ هنا)

| السؤال | المصدر الحاكم |
|---|---|
| عقد المنفذ وأنواع اللقطة | `apps/prototype-web/client/src/storage/local/types.ts` (Schema 38 / Export 30) |
| قواعد الكتابة الآمنة (حد الكتابة، الفشل `storage_stale`، idempotency) | `AGENTS.md` §10 قاعدة 7/8 و`docs/contracts/04-limited-sync-contract.md` |
| أداة التكافؤ التنفيذية | ملفات `adapterConformance.*.test.ts` و`IndexedDbLocalStore.*.test.ts` و`MemoryLocalStore` المسارات تحت `storage/local/` (تشغيل: `pnpm --filter @micro/prototype-web test -- --run adapterConformance`) |
| حراس حد التخزين | `check-storage-listener-guards.mjs` + `check-entity-touchpoints.mjs` (الجدول الكنوني: `docs/architecture/refactoring/REFACTORING-PLAN-A-TO-Z.md` §4.3.1) |
| سجل الملكية للملفات | `docs/architecture/refactoring/FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md` (قسم التخزين) |

## 3. ماذا يثبت هذا التجميع وماذا لا يثبت

**يثبت:** أن المسار إلى كل دليل تكافؤ مسمى وقابل للتشغيل من مكان واحد (كان هذا الوجه الأضعف في التسليم البارد — R10A-F-037). **لا يثبت:** شيئًا بذاته — هذا عرض إحالي؛ الدليل هو نجاح الاختبارات والحراس في مصادرها أعلاه عند تشغيلها. أي تغيير تكافؤ مستقبلي يحدّث المصادر ثم هذا العرض بالإحالة فقط.

## 4. نقطة العودة (Rollback)

عرض توثيقي إحالي بلا كود؛ حذفه أو إرجاعه commit توثيقي واحد بلا أثر تشغيلي.
