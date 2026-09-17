# نتائج الاختبارات — Wave 4.2

**خط الأساس عند البداية:** 1849 ناجحًا (404 root/domain + 1445 prototype/web) · 0 فاشل · 0 متخطى · Schema/Export: 35/27 · lint: 37 تحذيرًا (السقف 37) · bundle: 590,493 بايت خام (السقف 650,000) / 139,934 gzip (السقف 155,000).

---

## P-4.2-1 — App Shell والتنقل والتسمية

**Head SHA عند الفحص:** يُحدَّث عند الدمج · **الأمر:** `pnpm check` كاملًا (typecheck + lint + format + text-density + design-guards + guards + test + prototype:check + prototype:test + prototype:build + bundle-budget).

| الفحص | النتيجة |
|---|---|
| `pnpm typecheck` / `prototype:check` (tsc) | ✅ نجاح |
| `pnpm lint` | ✅ 0 أخطاء، 37 تحذيرًا (السقف 37 — بلا زيادة) |
| `pnpm format:check` | ✅ بعد توحيد تنسيق OwnerLedgerFormsSection |
| `pnpm text-density` / `design-guards` / `guards` | ✅ نجاح |
| `pnpm test` (domain) | ✅ 404/404 (36 ملفًا) |
| `pnpm prototype:test` (web) | ✅ 1445/1445 (204 ملفات) |
| `pnpm prototype:build` + bundle budget | ✅ PASS (raw 590,493 ≤ 650,000 · gzip 139,934 ≤ 155,000) |
| المجموع | **1849/1849 — بلا انخفاض عن خط الأساس** |

### الاختبارات الحارسة المحدثة في نفس الالتزامات

| الاختبار | ما يحرسه بعد التغيير |
|---|---|
| `app/navigation.test.ts` | تسمية `/catalog` = «منتجاتي وخدماتي» (N-06) — إضافة صريحة |
| `Nav001.dom.test.tsx` | أزرار «سجّل بيعًا/سجّل مصروفًا» في صف التسجيل السريع + لافتة الإقلاع تشير إلى «قسم «المالية»» |
| `QuickActionSheet.guard/category/unit` | أفعال الورقة «سجّل بيعًا/سجّل مصروفًا» (F12) |
| `Set003Capabilities.dom.test.tsx` | بقاء الأساس (بيع/مصروف) عند تعطيل القدرات بالأسماء الموحدة |
| `Foundation.ui.test.tsx` | «سجّل التزامًا لمورد»/«سجّل استثمارًا نقديًا» |
| `R2.keyboardFocus.test.tsx` | فتح الورقة بزر «سجّل بيعًا» من لوحة المفاتيح |
| `FinanceEmptyTruth/Nav003/U05/U07/FinanceJourneys` | h1 «المالية» + تبويب «ملخص الفترة» + نصوص الرجوع الموحدة |
| `FinancialEventEditor.guided.test.tsx` | زر ما بعد الحفظ «ارجع إلى المالية» |

### فحوص الحماية (بلا تغيير مقصود)

- Schema/Export: **35/27** — لم يُمس (لا تغيير في src/domain أو خدمات التصدير).
- لا مقعد سادس: `primaryNavigation` كما هو (خمسة مقاعد) — يحرسه navigation.test.ts.
- لا تغيير Routes، لا مصادر كتابة، لا عقود مالية — الحزمة نصوص وتسمية فقط.
