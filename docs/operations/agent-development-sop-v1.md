# Micro — SOP تطوير Agent موحد (v1)

**الحالة:** `CURRENT / OPERATIONAL` · **أُنشئ:** 2026-10-11 (R10-B1/R10A-F-037) · **المالك:** برنامج successor البنيوي (WS-216)
**الغرض:** مخرج واحد يجمع «كيف يعمل Agent على مستودع Micro بأمان» — بلا إنشاء مصدر حقيقة ثانٍ: كل بند أدناه **يحيل** إلى مصدره الحاكم ولا يكرر مضامينه.

---

## 1. البداية الباردة (Cold Start) — الترتيب الإلزامي

| # | الخطوة | المصدر الحاكم |
|---|---|---|
| 1 | `git fetch origin --prune` وقراءة `origin/main` الحي (لا تعتمد SHA محفوظًا) | `AGENTS.md` §14 و`current-state.md` الترويسة |
| 2 | قراءة نواة القراءة CORE (الحالة الحية → README → ميثاق التفكير → فهرس الوثائق) | `AGENTS.md` §2 |
| 3 | `python3 scripts/operations-control/validate.py` + قراءة `generated/AGENT-BRIEF.md` و`generated/ACTIVE-WORK.md` وفحص PRs المفتوحة | `docs/operations/control/README.md` §البداية الإلزامية |
| 4 | تحميل حزمة سياق المهمة الواحدة من جدول التوجيه (سقف الحزمة ملزم) | `AGENTS.md` §2 (جدول التوجيه الوحيد) |
| 5 | **أسئلة التكافؤ التشغيلي:** عرض التخزين → [`views/storage-parity-view.md`](views/storage-parity-view.md)؛ النقل/الذهبيات/التوافق → [`views/transfer-legacy-golden-view.md`](views/transfer-legacy-golden-view.md)؛ ما يثبته كل حارس → [`views/guard-proves-view.md`](views/guard-proves-view.md) | هذه الملفات (Views إحالية) |

## 2. الادعاء (Claim) قبل أي تعديل

1. لا كود قبل Workstream claim في `docs/operations/control/workstreams/` (branch + base SHA + items + areas + contracts) وتحقق صفر تداخل مع claim نشط — `AGENTS.md` §14.
2. فرع مستقل من `origin/main` الحي → PR إلى `main` → CI وCloudflare ناجحان → **دمج المالك فقط**. لا push مباشر إلى `main` أبدًا (`current-state.md` §1).
3. كاتب واحد في الوقت نفسه؛ المراجعون القراءة-فقط لا يعدلون.

## 3. أثناء التنفيذ — قواعد لا تقبل التفاوض

- المال/الكمية في `src/domain/` وحدها؛ لا وصول مباشر من UI إلى التخزين أو `localStorage` (ESLlint يفرض) — `AGENTS.md` §10 قاعدة 5/6.
- الحدود الرقمية المحروسة (Schema 38 / Export 30، سقف lint، سقفا الحزمة 650,000/155,300) لا تُرفع بصمت — قرار مالك بdiff مزدوج — `AGENTS.md` §10.
- كل كيان دائم جديد يُسجل في `persistent-entity-touchpoints.json` في نفس الشريحة (الحارس يفشل عند غيابه).
- لا أسرار ولا قيم مالية ولا PII في السجلات/الأخطاء؛ `check-secrets` يمسح.
- بطاقة فهم قبل الكود: النطاق، غير الأهداف، الثوابت المالية، حالات الفشل، معيار القبول، **حد الاستعادة** — `AGENTS.md` §10 قاعدة 2.

## 4. فحوص الإغلاق القياسية لكل شريحة/PR

```bash
pnpm check          # السلسلة الكاملة (ops-control test/check + typecheck + lint + format + text-density + design-guards + guards + test + prototype:check/test/build)
pnpm guards         # الحراس الـ18 النصية (الجدول الكنوني: views/guard-proves-view.md)
pnpm design-guards  # حراس التصميم الثلاثة (tokens + contrast + stylelint)
node scripts/check-doc-index-coverage.mjs
node scripts/check-current-state-size.mjs
git diff --check
```

الاختبارات المركزة إضافية بحسب سطح التغيير (النقل/التصدير/الترحيل/التلاعب/التكافؤ — راجع views النقل والتخزين).

## 5. الإغلاق (Closure) — التزامات PR نفسه

1. تحديث `current-state.md` (الحقول الحية فقط) + إلحاق `current-state-log.md` — `current-state.md` §7.
2. تحديث JSON المصدر (Item/Workstream) ثم `generate_tracker.py` + `--refresh-excel-meta` + `--check` + `validate.py` — لا تحرير يدوي للـViews/Excel.
3. وصف PR وفق القالب: الملفات المتغيرة، نتائج الفحوص، أثر Schema/التصدير/الترحيل (أو «لا ينطبق»)، وما **لم** يتغير عمدًا.
4. تصنيف أي مكتشف جديد: `NEW/DEEPENS/DUPLICATE/REOPENED/FALSE_POSITIVE` قبل أي بند جديد.
5. سجل العمل التتابعي `AGENT-SEQUENTIAL-WORKLOG.md` يُلحق (append-only).

## 6. حدود هذا الـSOP

هذا الملف **خريطة طرق** لا سلطة سلوك: عند أي تعارض، العقود و`AGENTS.md` و`current-state.md` وسجلات Operations Control هي الحكم، وقاعدة التوقف الموحدة (AGENTS §3) تسري. لا يقرأ هذا المند كإذن تجاوز بوابة مالك أو رفع حد محروس.
