# تقرير التنفيذ الموحد — التحليل المستقل A-to-Z ومصالحة Control ومزامنة قرارات Market وDelivery

**المستودع:** `https://github.com/Qays7753/Micro`
**الفرع:** `zai/micro-market-delivery-handoff-20261111` (فرع التسليم القائم؛ لا عمل على `main`)
**أساس الحزمة المتوقع:** `16c90e48bdc018939f97f41d05e969c900bc30e0` — تحقق حيًا وهو رأس `origin/main` الفعلي وقت البدء.
**التزام حزمة التسليم:** `ba81b5c3` (تهيئة الحزمة) ثم `79882b2834d97c827fd7ba694a0859be3297db20` (توسيعها بالتحليل القبلي) — رأس الفرع عند البدء، شجرة نظيفة بلا تعديلات.
**كاتب التقرير:** Z AI — المحلل والمنفذ الوحيد المفوض على هذا الفرع (توثيق وControl فقط).
**لغة التقرير:** عربية للمالك، مع الإبقاء على المسارات والمعرفات والأوامر والحالات الخام كما هي.

---

## 0. بطاقة الفهم (واجبة قبل أي عمل وفق AGENTS.md §10)

| البند | المحتوى |
|---|---|
| المستخدم وسؤال القرار | المالك (Qays) يحتاج صورة حقيقية واحدة: أين يقف Micro فعليًا من Market وDelivery، وما الذي تعتمده مواصفاته الست، وما الفجوات والأفعال القادمة بدقة لكل طرف. |
| النطاق المصرح | تحليل مستقل A-to-Z للقراءة فقط، ثم مصالحة Operations Control لدمج PR #384، ثم مزامنة قرارات OD المعتمدة في الوثائق الكانونية، ثم تقرير موحد وخطة مراحل — كل ذلك على هذا الفرع في التزامات منفصلة. |
| خارج النطاق (non-goals) | أي كود تطبيق أو اختبار تطبيق أو ترحيل أو مخطط أو UI؛ أي إعادة هيكلة أو نقل ملفات؛ أي وصول لحساب Cloudflare أو Google أو أي مزود؛ أي نشر أو دمج أو PR أو لمس `main`؛ أي رفع سقف أو تعديل generated يدويًا. |
| الثوابت المحروسة | المال المحلي لا يتأثر بالشبكة (AGENTS §6)؛ `localSchemaVersion`/`localExportVersion` = 41/34 وزوج الاستيراد 29؛ سقف 20,480 بايت لـ`current-state.md`؛ سقفا الحزمة 650,000/155,300؛ لا `VERIFIED` دون دليل خاص على main. |
| حالات الفشل المتوقعة | انحراف حالة Git عن المتوقع (STATE_DRIFT)؛ فشل مدقق Control خارج نطاق المصالحة؛ تعارض جوهري بين المواصفات الست؛ حاجة المصنف xlsx لأداة غير متاحة. |
| معيار القبول | مدقق Control يمر؛ Views مولدة من JSON لا محررة يدويًا؛ الوثائق الكانونية متسقة مع كل OD-01…OD-21 وOD01…OD31 بلا لغة متناقضة حاكمة؛ التقرير يوثق الأدلة والأوامر والفحوص الفعلية. |
| حد الاستعادة (rollback) | كل التزام توثيقي مستقل قابل للعكس بـrevert منفرد؛ التزام Control يعكس بإرجاع JSON المصدر وإعادة توليد Views؛ لا أثر runtime أو بيانات في أي التزام من التزامات هذه المهمة. |
| ما يبقى مجهولًا | حالة حماية الفروع (نُقلت من تقرير المسح: `protected=false`)؛ أي حالة حساب مزود حية (لا يوجد دليل مستودعي عليها)؛ تفاصيل تشغيلية لم تحسمها OD (مذكورة في §7 من هذا التقرير). |

**ما قرأه المنفذ قبل أول تعديل:** `AGENTS.md` كاملًا، `docs/operations/current-state.md`، `docs/operations/control/README.md` و`generated/AGENT-BRIEF.md` و`generated/ACTIVE-WORK.md`، `docs/operations/control/schemas/{item,workstream}.schema.json`، `scripts/operations-control/{validate,generate_tracker}.py`، `docs/expansion/` كاملًا (README/DECISIONS/TRACKER/E00-*/ROLE-ACCESS-MATRIX/MARKET-DELIVERY-OWNER-IA-CONTRACT/FOUR-PARTY-*/SEVEN-AGENT)، العقود الشبكية `docs/contracts/18…25` بالأسماء الكاملة، المواصفات الست المعتمدة تحت `inputs/approved-feature-specs/` (سجلات قرارات المالك كاملة + الأقسام المفصلة)، مخرجات أربع مجالات مسح قراءة-فوق للكود (معمارية/بيانات؛ هوية وأمن وخصوصية؛ Cloudflare وتكاملات وCI؛ ملاءمة Market/Delivery للكود)، ثم تقرير المسح البنيوي المرفق ومواد الخلفية بوصفها مدخلات مقارنة لا مصادر تنفيذ.

---

## 1. التحقق الحي قبل أي عمل (Phase 0 — قراءة فقط)

كل ما يلي نُفذ فعليًا بتاريخ 2026-11-12 على استنساخ نظيف:

| البند | النتيجة الموثقة |
|---|---|
| `git fetch origin --prune` ثم `git rev-parse origin/main` | `16c90e48bdc018939f97f41d05e969c900bc30e0` — مطابق للأساس المتوقع حرفيًا؛ **لا انحراف حالة (no STATE_DRIFT)**. |
| رأس فرع التسليم | `79882b2834d97c827fd7ba694a0859be3297db20`؛ `git merge-base HEAD origin/main` = رأس `main` نفسه؛ فوقه التزاما الحزمة فقط؛ `git status --porcelain` فارغ. |
| الفروع البعيدة | `origin/main` و`origin/zai/micro-market-delivery-handoff-20261111` فقط. |
| PR #384 (GitHub API) | `state=closed`، `merged=true`، `merge_commit_sha=16c90e48…`، `merged_at=2026-11-06T12:41:53Z`، `merged_by=Qays7753`، القاعدة `main` عند `111cd9dd…`، الرأس `uxr/integration-20261105` عند `c4fa77dd…`. |
| فحوص رأس الدمج `16c90e48` | Check runs: `Cloudflare Pages` = completed/success (12:42:28Z) و`checks` = completed/success (12:41:59Z→12:46:21Z). هذا دليل نجاح هذين الفحصين على رأس الدمج فقط، ولا يعني `VERIFIED` لأي بند Control. |
| PRs المفتوحة | صفر — لا مطالبات متنافسة. |
| سلامة المدخلات المجمدة | `sha256sum -c SHA256SUMS.txt` داخل مجلد الحزمة: 15/15 OK (بصمة الملفات الست المعتمدة وملفات التوجيه والخلفية كلها مطابقة). |
| `python3 scripts/operations-control/validate.py` (قبل أي تعديل) | Exit 0 — لكن **لأن `gh` CLI غير متاح فقُفز فحص تطابق PR/Workstream**؛ أي أن النجاح المحلي لا يعكس تناقض WS-248 الموثق أدناه. السجل الحقيقي متقادم رغم نجاح المدقق في هذه البيئة. |
| مؤشر مهم | تقرير المسح المرفق يسجل `protected=false` لفرع `main` (من استعلام صاحب المسح)؛ لم يعيد المنفذ هذا الاستعلام لأنه يحتاج صلاحية كتابة، وسجل هنا كنقل من التقرير لا كتحقق مستقل. |

**الخلل المعروف المؤكد (TRUTH-STATUS-01 في تقرير المسح — أكده التحليل المستقل):** PR #384 مدموج في `main` عند `16c90e48…` بينما: `WS-248`/`DOC-032` ما زالا `IN_REVIEW` بنص «PR #384 يبقى Draft»، و`docs/operations/current-state.md` ما زال يصف الرأس `111cd9dd…` وPR #384 كمسودة. المعالجة مصرح بها صراحة في المرحلة 1 أدناه.

---

## 2. الخريطة المستقلة للنظام الحالي (كتبت قبل المقارنة مع تقرير المسح)

> منهج الاستقلال: بُنيت هذه الخريطة من قراءة الكود والاختبارات والوثائق الكانونية مباشرة (بمساعدة أربع مجالات مسح قراءة-فوق غير متداخلة)، ثم قورنت بعدئذ بتقرير المسح المرفق (§4 أدناه). لا ادعاء تنفيذ هنا لأي قدرة شبكية.

### 2.1 المكدس ونقاط الدخول

- مساحة عمل pnpm (`pnpm-workspace.yaml`: `apps/*`, `tools/*`): تطبيق واحد `apps/prototype-web` (`@micro/prototype-web`) + أداة داخلية `tools/micromatch-shim` (تحصين micromatch). الجذر `package.json` بلا اعتماديات تشغيلية.
- الواجهة: React 19 + Vite 7 + Tailwind 4 + `wouter` (توجيه) + `vaul` + `lucide-react`؛ TypeScript صارم (`tsconfig.json`: `NodeNext`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`).
- الدخول: `apps/prototype-web/client/index.html` (`lang="ar" dir="rtl"`، بلا أي نداء شبكة — الوسم التحليلي أزيل ووثق بتعليق) ← `client/src/main.tsx` (يشغّل `registerPwaServiceWorker()`) ← `App.tsx` (ErrorBoundary → PrototypeServicesProvider → ThemeProvider → `MicroRouter`).
- التوجيه: `client/src/app/MicroRouter.tsx` — نحو 60 مسارًا بتحميل كسول، منها `/market` و`/delivery` كإعلانَي «قريبًا» صادقين (التفصيل §2.6).
- القشرة: `components/layout/MicroAppShell.tsx` مع شريط سفلي خماسي معرف في `client/src/app/navigation.ts` `primaryNavigation`: `المالية (/finance) | الطلبات (/orders) | الرئيسية (/) | التوصيل (/delivery) | السوق (/market)` — قرار NAV-001 §1 المنفذ.

### 2.2 الطبقات وحدود الميزات

- سلسلة المسؤولية المنفذة: `React UI → Application services (≈26 منزلًا، 55 خدمة) → Domain (src/domain/ — 19 مجالًا، TS نقي صفر اعتماديات) → PrototypeLocalStore (منفذ) → IndexedDbLocalStore`.
- الفصل مفروض مزدوجًا: ESLint (`eslint.config.js`: منع استيراد `@/storage/local/*` من pages/components؛ منع React من application/storage؛ منع أي استيراد غير نسبي داخل `src/domain/**` ومنع globals المتصفح فيه؛ منع `Math.round/floor` في المجال والتطبيق) + حراس AST في `scripts/check-module-boundaries.mjs` (R1–R9 مع خطوط أساس) و`check-layer-boundaries.mjs` وغيرها من حراس `pnpm guards`.

### 2.3 التخزين والبيانات

- منفذ التخزين: `storage/local/types.ts` — `localSchemaVersion = 41` (سطر 94)، `localExportVersion = 34` (سطر 131)؛ محوّلان متكافئان `IndexedDbLocalStore.ts` و`MemoryLocalStore.ts` بقواعد كتابة مشتركة (`*CommitGuard.ts`).
- قاعدة `micro-prototype-local` بـ41 مخزن كائنات (`storage/local/indexedDbStores.ts` و`indexedDbMigrations.ts` — نمط الإضافة فقط D-037).
- التصدير/الاستيراد: `application/transfers/localTransferService.ts` — مظروف `micro-prototype-local-export` مع SHA-256، زوج حي 41/34، و`RELEASED_LEGACY_EXPORT_PAIRS` = 24 زوجًا موروثًا (الإجمالي المقبول 29)؛ الاستعادة `replaceIndexedDbSnapshot` بمعاملة واحدة ذرية.
- كتابة حساسة: `idempotencyKey` إلزامي في المجال (`src/domain/financial-event/policies.ts:375`)، ورفض `storage_stale` بلا كتابة عند تعارض المراجعة، ولا كتابة عمياء.

### 2.4 الهوية والأمن والخصوصية (الوضع الحالي المنفذ)

- **لا يوجد أي Auth/جلسة/دور/صلاحية/مستأجر في الكود** — تحقق بالمسح الشامل: لا `auth|login|oauth|jwt|supabase|firebase` في `src/` أو `apps/`؛ الهوية الوحيدة مالك محلي `local-owner-profile` (`application/owner/ownerProfileService.ts`) بحقول مزود مستقبلية `null`.
- لا كود خادم إطلاقًا (لا `api/` أو `functions/` أو `workers/`)؛ لا `fetch()` في كود التشغيل (الوكيل الوحيد dev-only: `vitePluginStorageProxy` بـ`BUILT_IN_FORGE_API_URL` خارج بناء الإنتاج).
- التشخيص محلي بثمانية حقول ثابتة (`application/diagnostics/localDiagnosticsService.ts`) بلا أي مسار إرسال (اختبار يثبت غياب fetch/XHR/sendBeacon).
- `scripts/check-secrets.mjs` يمسح شجرة العمل بأنماط عالية الدقة (يشمل `github_pat_`)؛ مسح تاريخي شهري في `.github/workflows/history-secret-scan.yml`.
- الخصوصية الحالية: مخزن `counterparties` يحفظ أسماء/هواتف اختيارية للعرض فقط، **وهي تدخل ملف التصدير** — نقطة تحفظ خصوصية مستقبلية عند أي ربط شبكي.
- قفل التطبيق المحلي (عقد 37) **ألغي بقرار مالك مؤرخ 2026-10-24** وحُذف كوده بلا بديل؛ يلاحظ أن `docs/quality/security-boundaries.md` §3 ما زال يصفه وصفًا حيًا (انحسار توثيقي، لا صلة بمهمتنا التنفيذية).

### 2.5 الاختبارات وCI والنشر

- اختبارات: vitest — الجذر 83 ملفًا/1019 اختبارًا (آخر موثق) والتطبيق 428 ملفًا (~3.4 ألف اختبار، آخر عد موثق 3368 عند `638ccf45`)؛ `pnpm check` سلسلة كاملة (operations-control:test/check → typecheck → lint بحد 37 تحذير → format → text-density → design-guards → guards → test → prototype:check/test/build).
- `.github/workflows/ci.yml`: مهمة واحدة `checks` على push/PR — **لا خطوة نشر**؛ ترفع artifact فقط. المهمة الثانية `history-secret-scan.yml` شهرية.
- ميزانية الحزمة: `RAW_BYTE_LIMIT=650_000`/`GZIP_BYTE_LIMIT=155_300` مفروضة داخل البناء نفسه (`vitePluginBundleBudgetGate`) وبعدَه.
- PWA: `vite-plugin-pwa` (precache + `registerType: prompt`) مع تحديث آمن للمسودات (عقد 38: `client/src/pwa/dirtyRegistry.ts`) — كل الأصول محلية.
- المضيف: **Cloudflare Pages عبر GitHub App خارجي** — دليل المستودع: ملفات اصطلاح Pages `apps/prototype-web/client/public/_headers` (CSP `connect-src 'self'`) و`_redirects`، ومخرج البناء `dist/public`، ومتغيرات بيئة `CF_PAGES`/`CF_PAGES_COMMIT_SHA` في `vite.config.ts` و`check-bundle-surfaces.mjs` مع خطوط أساس لكل بيئة. **لا يوجد `wrangler.*` ولا خطوة نشر في CI ولا functions** — التهيئة من جانب المزود خارج المستودع.

### 2.6 ملاءمة Market وDelivery للكود الحالي

- `/market` → `pages/Market.tsx` و`/delivery` → `pages/Delivery.tsx`: بطاقتا «قريبًا» بلا خدمات ولا كتابة — يحرسهما اختبار `app/ownershipBoundaries.exe017.test.ts:171` (لا `usePrototypeServices` ولا استيراد تخزين/تطبيق).
- «اسأل Micro» عنصر واحد عند الطلب في قائمة «مايكرو» (`components/layout/AppHeader.tsx`) يفتح لوحة إعلان محلية (`app/futureServices.ts`) — لا AI ولا إرسال.
- `disabledCapabilities` محصورة في 4 قدرات Manage (`application/preferences/preferenceService.ts:49`: orders/inventory/suppliers/catalog) — لا علاقة لها بمقعدي التوسعة.
- **لا يوجد أي كيان مجال أو تخزين أو خدمة لـMarket/Delivery/الشبكة** — لا `vendor|سائق|driver|listing` في الكود. مفهوم «التوصيل» المنفذ حاليًا هو حقل شروط تسليم طلب الحرفة المحلي (`src/domain/craft-order/types.ts`: `DeliveryResponsibility`, `OrderDeliveryTerms` + `application/fulfillment/DeliveryReviewService`) وهو محاسبة Manage، ويجب ألا يختلط بميزة Delivery الشبكية المستقبلية (يحفظ الفصلَ أيضًا نص `futureServices.ts`).
- مقعدا الشريط السفلي (`التوصيل` و`السوق`) **محجوزان ومنفذان** بقرار NAV-001 — وهذا يتقدم على نصوص E-00.14 الأقدم التي تضع التوصيل في أيقونة AppBar (انظر §4.3).

### 2.7 جرد التكاملات من أدلة المستودع فقط

| التكامل | التصنيف | الدليل (مسار/رمز/اسم إعداد) | ما يبقى للتحقق |
|---|---|---|---|
| الاستضافة/Cloudflare Pages | `SOURCE_CONFIG_PRESENT` (اصطلاحات بناء فقط داخل المستودع؛ التهيئة نفسها خارجية) | `apps/prototype-web/client/public/_headers`, `_redirects`; `vite.config.ts` (`CF_PAGES_COMMIT_SHA`); `check-bundle-surfaces.mjs` بيئات `cloudflare-pages` | اسم مشروع Pages وإعداداته خارج المستودع (غير قابل للتحقق هنا) |
| CI/GitHub Actions | `SOURCE_CONFIG_PRESENT` | `.github/workflows/ci.yml` (مهمة `checks`، artifact بلا نشر)، `history-secret-scan.yml` | لا شيء جوهريًا |
| هوية Google/موفر هوية | `DOCUMENTED_ONLY` | المواصفات المعتمدة (Market سجل OD-05؛ Delivery §4) + `docs/contracts/18-…` — لا كود ولا إعداد | اختيار/إعداد المزود الفعلي وOAuth URIs (قرار مالك + Manus) |
| API/خلفية (Workers/BFF) | `PROPOSED` | المواصفات (Market §8 `/api/market/v1` + BFF؛ Delivery الملحق ب) — لا كود | القرار المعماري والبنية (AR01/OD-20 غير محسومين) |
| قاعدة بيانات (D1 أو Postgres/RLS) | `PROPOSED` | `docs/expansion/E00-TECHNICAL-ARCHITECTURE-DECISION.md` §5 + دليل D1-vs-Postgres في المواصفات — لا تهيئة | إثبات العزل/الأداء/التكلفة ثم ADR |
| تخزين ملفات/صور خاص (R2) | `PROPOSED` | المواصفات (Market §7.2 مسار رفع أحادي عبر Worker + حدود؛ مراجع R2 في المتطلبات التقنية كمراجع لا تفعيل) | اختيار المزود وسياسة الاحتفاظ/الاستعادة (عقد 22 نقطة عمل) |
| إشعارات Push/بريد/SMS | `NOT_FOUND` (كود) / `DOCUMENTED_ONLY` (عقد 19: صندوق داخلي أساس) | لا `new Notification` في الكود؛ عقد 19 §9 مجموعة مغلقة داخل التطبيق | قرار لاحق بعد الدليل (لا يفترض مزود) |
| DNS/TLS/CORS/Origin مخصص | `NOT_FOUND` في المستودع | لا تهيئة نطاق في المستودع؛ توصية Origin مخصص للسائق في المواصفات `PROPOSED` | قرار مالك/Manus عند التفعيل |
| تحديد المعدل/ضوابط الإساءة | `DOCUMENTED_ONLY` | `DECISIONS.md` EX-O16 + بوابة الجاهزية §9 + أرقام المواصفات (10 تقديمات/جهة/يوم، 60 صورة/يوم، 5 بلاغات/حساب/يوم) | اعتماد الأرقام وتنفيذها عند البناء |
| سجلات/مراقبة خارجية | `NOT_FOUND` | لا Sentry/تحليلات؛ التشخيص محلي فقط (مثبت بالاختبار) | قرار تشغيلي لاحق |
| نسخ احتياطي سحابي | `NOT_FOUND` | الاستعادة الحالية تصدير/استيراد محلي محروس (عقد 39) فقط | قرار لاحق |
| بيئات/أسرار | `SOURCE_CONFIG_PRESENT` (نظافة) | لا `.env` ملتزم؛ workflow بلا `secrets.*`؛ `check-secrets.mjs` في CI | أسرار المزود عند التفعيل (خارج المستودع) |
| PWA/تحديث آمن | `SOURCE_CONFIG_PRESENT` | `vite.config.ts` VitePWA + عقد 38 + `client/src/pwa/*` | لا شيء (منفذ ومحروس) |

**لا يوجد في المستودع أي دليل على مورد هوية أو قاعدة بيانات أو تخزين أو إشعار أو نشر «مفعّل». كل ما هو شبكي `PROPOSED` أو `DOCUMENTED_ONLY`.**

### 2.8 مصفوفة النتائج الداخلية (قبل أي تعديل)

- **سلوك مؤكد:** تطبيق Manage محلي بالكامل، ماليًا محروسًا، بلا شبكة ولا هوية؛ القبول الوحيد هو ما على `main` باختباراته.
- **فجوات Market/Delivery:** كل شيء شبكي غائب عن الكود بالكامل (إعلانا «قريبًا» فقط) — وهذا متسق مع «قرار وتصميم فقط» في `docs/expansion/README.md` §3.
- **مجهولات التكامل:** كل بند `PROPOSED`/`DOCUMENTED_ONLY` في §2.7 يحتاج قرارًا وإثباتًا قبل أي كود.
- **مخاطر خصوصية/أمن مستقبلية:** عزل مستندات السائق الخاصة (OD28/OD29)؛ صور الموردين قبل النشر (OD-09/OD-16)؛ بيانات `counterparties` في التصدير عند أي جسر؛ إثبات عزل DB/API قبل أي طرف حقيقي (بوابة A).
- **قرارات مالك ما زالت مفقودة فعلًا:** (رغم اكتمال قرارات المنتج في المواصفات الست) تبقى مفتوحة: اختيار مزود الهوية تقنيًا وتفعيله؛ اختيار DB (D1 مقابل Postgres/RLS) وADR الإثبات؛ سياسة الاحتفاظ/الاستعادة/الحذف القانونية للوثائق والصور (EX-O14 والمراجعة القانونية)؛ أرقام ضوابط الإساءة النهائية (EX-O16)؛ ترتيب أولوية Market مقابل Delivery في التنفيذ إذا لم يقرر المالك غير ذلك؛ قرار Origin/نشر بوابة السائق.
- **أصغر مراحل آمنة (رأي مهني مبني على الدليل، لا إذن تنفيذ):** (1) إغلاق الموجة التوثيقية هذه؛ (2) نموذج أولي مستقل محلي/محاكى إن اختاره المالك كخط تحضيري **لا يُعد قبولًا** (انظر §5)؛ (3) قبول متصل محدود المشاركين وفق OD-06/OD-23 بعد بوابة الهوية والعزل؛ (4) إنتاج تدريجي بعد بوابات الجاهزية. التفصيل الكامل في خطة المراحل (§8) التي تُستكمل في الالتزام الختامي.

---

## 3. المصالحة المطلوبة في Control (ملخص؛ التنفيذ في الالتزام الثاني)

الخلل الموثق وحلّه المخطط وفق `AGENTS.md` §14 وسلّم الانتقالات في `validate.py`:

1. `WS-248.json` و`DOC-032.json`: الانتقال القانوني `IN_REVIEW → MERGED_UNVERIFIED` مع `merge_sha = 16c90e48bdc018939f97f41d05e969c900bc30e0` وتحديث `next_action` إلى مسار `VERIFIED` (دليل خاص على main + قرار مالك)، مع إلحاق سجل حالة مؤرخ. **لا `VERIFIED`** — نجاح فحصَي الدمج العامين لا يثبت قبول بنود W05 التفصيلية على main.
2. `docs/operations/current-state.md`: تحديث الحقول الحية فقط (رأس `main`، دمج PR #384، حالة W01–W05) داخل سقف 20,480 بايت.
3. `docs/operations/current-state-log.md`: إلحاق سجل مؤرخ (append-only) يوثق المصالحة.
4. إعادة توليد Views من JSON عبر المولد الموثق، ثم تحديث Workbook بالطريقة المعتمدة (صف في Change History) ثم `--refresh-excel-meta` وفحص سلامة zip — **لا تحرير يدوي لأي ملف generated**.
5. الفحوص الواجبة: `validate.py`، `unittest discover`، `generate_tracker.py --check`، `git diff --check` — توثيق الحالة الخام لكل أمر.

*(تُستكمل الأقسام 4–11 تدريجيًا مع التزامات المراحل على هذا الفرع نفسه، ويعلن الالتزام الختامي الحالة النهائية والحالة الختامية الموحدة.)*
