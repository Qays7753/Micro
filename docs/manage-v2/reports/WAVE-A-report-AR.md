# تقرير الموجة A — المرحلة ١: M1.2 ثم M1.3 (قطع رابط التقدير، وإزالة المسودة المالية من «اسأل Micro»)

- **الموجة:** A (قرار المالك 26/11/2026 — جدول الموجات في `docs/manage-v2/tasks/phase-1-prompt-EN.md`؛ الحالة «authorized now»).
- **المهام بالترتيب المنفَّذ:** M1.2 ← M1.3. لا مهام أخرى مبدوءة، ولا انتقالات بين الموجات.
- **عقد التنفيذ:** `docs/manage-v2/tasks/phase-1-prompt-EN.md` (نموذج الموجة، حدود الكتابة، بوابات الموجة، قناة التسليم) — نُفِّذ حرفيًا: مهمة واحدة لكل تشغيل داخلي بترتيبها، اختبارات أولًا، متتبّع محدَّث في نفس الـcommit، ثم بوابة الموجة.
- **الحالة:** `DONE` لكلا المهمتين (بانتظار مراجعة مانوس وقرار المالك — «التنفيذ ليس قبولًا»).

## 0. الـpreflight (قبل أي كتابة)

```
$ git fetch origin && git branch --show-current && git log -1 --format=%H && git status --short && git ls-files --others --exclude-standard
feature/manage-v2
a5ff462ba52ccda7e0feb68fba5021fa891403f0
(شجرة نظيفة، لا untracked، HEAD = origin/feature/manage-v2)
```

- المتتبّع قبل الموجة: M1.2 ZAI `TODO`، M1.3 ZAI `TODO` — لا `STATE_DRIFT` (الشجرة تطابق المتتبّر حرفيًا).
- M1.1 وM1.1a مسجّلتان `DONE/ACCEPTED` — لم تُمسّا ولم يُعد تنفيذهما.
- الموجة A موجودة في جدول الموجات ومطابقة لقسمي M1.2/M1.3 أدناه.

## 1. المهمة M1.2 — قطع ربط التقدير بتكلفة الطلب (§14.3 / IMPACT S2)

- **الـcommit الخاص بالمهمة:** `addfc21a7d655df41ae560e6826c71ebf981dfa3` (الكود + الاختبارات + تحديث المتتبّر)؛ ورقمه مثبَّت في الالتزام التوثيقي الملاصق `4d9c999c5c47862c0994b9c21574a7b9f95fa711` (نمط M1.1/M1.1a المعتمد).
- **ما تغيّر، ملفًا ملفًا:**

| الملف | التغيير |
|---|---|
| `client/src/application/agreements/orderDetailViewModel.ts` | حُذفت `readSourceEstimate` بجسمها كاملًا، ومستورداتها الثلاثة التي صارت بلا مستهلك (`CostEstimate` نوعًا، `DraftService`، `CostEstimateService`). لا تغيير في أي دالة أخرى. |
| `client/src/pages/OrderDetail.tsx` | حُذفت: حالة `sourceEstimate`، والأثر الذي يقرأ التقدير المصدر، واستيراد `readSourceEstimate`، واستيراد نوع `CostEstimate`، و destructuring خدمتَي `drafts`/`costEstimates` (صارتا بلا استخدام بعد حذف الأثر)، ومقطع «المصدر: تقدير» كاملًا مع زر «افتح التقدير»، واستيراد أيقونة `ArrowLeft` (كان استخدامها الوحيد في المقطع المحذوف — إبقاؤه يكسر أساس تحذيرات اللينت). لا سطر آخر في الصفحة تغيّر. |
| `client/src/application/agreements/orderDetailViewModel.test.ts` | عقد التصدير: تأكيدات الأنواع الثلاثة الباقية + اختبار جديد يطابق سطح التصدير الكامل بالقائمة النهائية (٤ تصديرات بلا أي قارئ تقدير مصدر). |
| `client/src/OrderDetail.noEstimateLink.dom.test.tsx` (جديد) | دخاني DOM ببذرة كاملة: طلب مؤكد + مسودة مرتبطة تحمل `sourceEstimateId` + تقدير حي في المخزن؛ تجسّس على `drafts.list` و`costEstimates.get`؛ التأكيد: لا نداء ولا عرض للمقطع رغم توافر كل شيء. |
| `client/src/G3.dom.test.tsx` | اختبار «source estimate link» قُلب إلى نفيه (لا مقطع ولا وصلة ولا تنقّل) مع إبقاء تأكيد تسميات التصحيح في السجل كما هو؛ البذور نفسها (المسودة تحتفظ بمعرّف التقدير — الحقل باقٍ عمدًا). |
| `docs/manage-v2/TRACKER.md` | قسم ZAI للمهمة (الحالة/الاختبارات/الملاحظات) في نفس الـcommit. |

- **الاختبارات (الأمر، العدد، النتيجة، على أي SHA):**
  - أولًا فشلًا مقصودًا (قبل أي كود، على شجرة `a5ff462b`): `corepack pnpm --filter @micro/prototype-web exec vitest run orderDetailViewModel.test.ts OrderDetail.noEstimateSource` → **٣ فاشلة / ٦ ناجحة**: سطح التصدير يحوي القارئ، ونداء `drafts.list` من الصفحة مرة واحدة، ومقطع «المصدر: تقدير» معروض (نصّ الفشل في ملف الأدلة §١).
  - بعد التنفيذ (شجرة الالتزام `addfc21a`): الأمر نفسه → ٩/٩؛ ومعه `G3.dom.test.tsx` → ٢٢/٢٢.
  - نطاق القبول: `corepack pnpm --filter @micro/prototype-web test` → **٤٧٥ ملفًا / ٣٧٨٢ اختبارًا كلها ناجحة** (شملت `moneyLayerGuard` المجمد: `pages/OrderDetail.tsx` بقي ١٣ سطر حساب كما هو — المقطع المحذوف لم يكن يحسب مالًا)؛ `corepack pnpm typecheck` ناجح؛ `pnpm --filter @micro/prototype-web exec tsc --noEmit` ناجح؛ `corepack pnpm lint` → ٠ أخطاء / ٣٥ تحذيرًا (= الأساس بالضبط).
  - قبول النص الحرفي: `grep -R "readSourceEstimate" client/src` → لا شيء.
- **ما لم يُنفَّذ / مؤجَّل:** لا شيء من نطاق M1.2. (سابق خارج النطاق وبقي: استيرادان غير مستخدمَين `CircleDollarSign`/`Save` في الصفحة كانا كذلك قبل الموجة — جزء من أساس اللينت، لم يُمسّا.)
- **الملفات الممنوعة:** لم تُلمس — `pages/CostEditor.tsx` (تعبئة Tools) لم تتغير؛ `sourceEstimateId` على نوع المسودة (`application/drafts/draftService.ts`، `storage/local/types.ts`) كما هو؛ Market/Delivery/Ask وأسطح التطبيق والدوال المالية المشتركة (`formatMoneyMinor` وأخواتها) لم تتغير (لا سطر واحد تحت أي مسار ممنوع).
- **المتتبّر:** حُدِّث قسم ZAI للمهمة داخل `addfc21a` نفسه، والـSHA ثُبِّت في `4d9c999c`.

## 2. المهمة M1.3 — إزالة المسودة المالية من «اسأل Micro» (حدود النطاق / IMPACT S3)

- **الـcommit الخاص بالمهمة:** `96a4a7221206ae7f14dc2249eca5a79d35cdbf34` (الكود + الاختبارات + دبوس عدّ الحراس + تحديث المتتبّر)؛ ورقمه مثبَّت في الالتزام الملاصق `0ed3cada4e1336e57460753a11944509c4b8a7c5` مع مصالحة أدلة الموجة (§٤ أدناه).
- **ما تغيّر، ملفًا ملفًا:**

| الملف | التغيير |
|---|---|
| `client/src/pages/AskMicro.tsx` | حُذف استيراد `AskDraftCard`، وحذف عرض البطاقة (`result.draft ? <AskDraftCard …/>` بالكامل)، وحُذف حقل `draft` من نوع `AskResult` المحلي للصفحة مع سطر إسناده («remove only the page's unused variable» حرفيًا)؛ عقد الخدمة (`application/network`) لم يُمسّ — الخادم ما زال يرسل `answer/sources/draft` والصفحة تهمل الاقتراح عمدًا (تعليق موثق عند موضع الإسناد). |
| `client/src/components/ask/AskDraftCard.tsx` | **حُذف الملف كاملًا** (٦٠٨ أسطر): بطاقة الحدث المالي (التي كانت تبني السجل بـ`constructFinancialEventRecord` وتكتب إلى عائلة `financialEvents` عبر `saveManageRecord`) وبطاقة حجز التوصيل في الملف نفسه — الأمر نصّ على حذف الملف، والمجلد `components/ask/` خلا فأُزيل. |
| `client/src/AskMicro.noFinancialDraft.dom.test.tsx` (جديد) | دخاني DOM: اقتراح خادمي لمسودة `manage-financial-event` → الإجابة تُعرض، ولا بطاقة ولا زر تسجيل ولا أي نداء إلى `/api/manage/records/**`. |
| `client/src/AskMicro.noFinancialDraft.scan.test.ts` (جديد) | مسح مصدر (نمط moneyLayerGuard): `pages/AskMicro.tsx` + كل ملفات `components/ask/**` بلا أي إشارة إلى `AskDraftCard`/`constructFinancialEventRecord`/`saveManageRecord`/`financialEvents` — القبول الحرفي للأمر مؤتمت. |
| `client/src/pages/AskMicro.dom.test.tsx` | استُبدلت اختبارات بطاقة حجز التوصيل الثلاثة (كتابة بعد الإكمال/إلغاء بلا كتابة/فشل صادق عند الرفض) باختبار واحد يشهد على الغياب: الإجابة والمصادر تعرضان، ولا بطاقة ولا جلب لقائمة السائقين ولا كتابة إلى `/api/delivery/**`. |
| `client/src/pages/AskMicro.governance.dom.test.tsx` | قسم §10.2-5 (اختبارا البطاقة المالية) قُلب إلى نفيه: لا بطاقة ولا أي كتابة إلى عائلة السجلات؛ اختبارات الموافقة والحدود والسجل المحلي كما هي بلا تغيير. |
| `scripts/check-diagnostics-storage.test.mjs` | دبوس عدّ ملفات الإنتاج ٤٣٧→٤٣٦ مع تعليق توثيقي مؤرَّخ (بروتوكول الدبوس نفسه المتبع تاريخيًا لكل تغيير مجموعة ملفات؛ الاختبار يذكر البطاقة صراحة في تعليقه التاريخي). |
| `docs/manage-v2/TRACKER.md` | قسم ZAI للمهمة في نفس الـcommit. |

- **الاختبارات (الأمر، العدد، النتيجة، على أي SHA):**
  - أولًا فشلًا مقصودًا (قبل أي كود): `corepack pnpm --filter @micro/prototype-web exec vitest run AskMicro.noFinancialDraft` → **فشل الاختباران**: الدخاني (البطاقة المالية تُعرض رغم النفي) والمسح (٥ مخالفات مسماة بالملف والرمز — في ملف الأدلة §٢).
  - بعد التنفيذ (شجرة الالتزام `96a4a722`): الأمر نفسه → ٢/٢؛ ومعه `AskMicro.dom` + `AskMicro.governance` → ١٣/١٣.
  - نطاق القبول: `corepack pnpm --filter @micro/prototype-web test` → **٤٧٧ ملفًا / ٣٧٨١ اختبارًا كلها ناجحة**؛ `corepack pnpm test` (الجذر) → **٨٦ ملفًا / ١٠٣١ اختبارًا كلها ناجحة** (بعد مصالحة أدلة الحراس §٤)؛ `corepack pnpm typecheck` ناجح؛ `pnpm --filter @micro/prototype-web exec tsc --noEmit` ناجح؛ `corepack pnpm lint` → ٠ أخطاء / ٣٥ تحذيرًا (= الأساس).
  - قبول النص الحرفي: `grep -R "AskDraftCard\|constructFinancialEventRecord" client/src/pages/AskMicro.tsx client/src/components/ask` → لا شيء (المجلد غير موجود أصلًا).
  - `git diff --stat 96a4a722^..96a4a722 -- apps/prototype-web/client/src/application/ask/` → **فارغ** (الدليل الحرفي على أن `application/ask/**` لم تتغير). المحادثة و`askMicroService` و`ask-history` لم يُمسّ أي منها.
- **ما لم يُنفَّذ / مؤجَّل:** لا شيء من نطاق M1.3. `result.draft` بقيت في عقد الخادم بلا مستهلك عند الصفحة عمدًا (إعادة التصميم على النظام الجديد لاحقة)؛ وحدة `application/ask/askFinancialDraftService.ts` بقيت كما هي (خارج المسموح ومحمية بنص الأمر — مسارها المحتمل مع الكود الميت يُحسم في M1.9/M1.11).
- **الملفات الممنوعة:** لم تُلمس — لا `application/ask/**` ولا `askMicroService` ولا `ask-history` ولا أي مسار Market/Delivery/Tools؛ `client/src/components/ask/**` دخلت نطاق التحرير بتصريح M1.3 الحصري وحده.
- **المتتبّر:** حُدِّث قسم ZAI للمهمة داخل `96a4a722` نفسه، والـSHA ثُبِّت في `0ed3cada`.

## 3. بوابة الموجة (على شجرة الكود المكتملة `0ed3cada` — الشجرة النهائية نفسها ببايتاتها)

| الأمر | النتيجة |
|---|---|
| `corepack pnpm guards` | **exit 0 — كل الفحوص PASS، صفر FAIL** (٢٠ سطر PASS؛ منهم: `lint-warning-baseline: PASS — 35 تحذيرًا بالضبط = الأساس`؛ `registry-coverage: PASS — 41 بيت تطبيق و20 منطقة مجال`؛ `file-size-ratchet: PASS — 644 ملفًا مشمولًا (انكماش 31؛ محذوف 14 — منها البطاقة)؛ صفر نمو غير مبرر`؛ `module-boundaries: PASS — 124 حافة أزواج بيوت تطبيق منها 84 قيمة و40 نوعًا`). |
| `corepack pnpm test` | **exit 0 — ٨٦ ملف اختبار / ١٠٣١ اختبارًا كلها ناجحة، صفر فاشلة.** |
| `corepack pnpm typecheck` | **exit 0 — نظيف.** |
| تشديد إضافي (فوق بوابة الموجة) | `corepack pnpm --filter @micro/prototype-web test` → **٤٧٧ ملفًا / ٣٧٨١ اختبارًا كلها ناجحة** (exit 0)؛ `pnpm --filter @micro/prototype-web exec tsc --noEmit` → نظيف؛ `corepack pnpm lint` → ٠ أخطاء / ٣٥ تحذيرًا = الأساس. |

لا `BLOCKED` ولا `STATE_DRIFT`: كل شرط توقف نصّ عليه الأمر فُحص ولم يتحقق (لا ملف إنتاج آخر يستورد `readSourceEstimate`؛ صفحة Ask تجمّعت بلا مسّ `application/ask/**`).

## 4. مصالحة أدلة الحراس (الالتزام الملاصق `0ed3cada`) — شفافية كاملة

تغييرات الموجة المصرَّح بها حرّكت أدلة حراس مقيدة على الشجرة الحية؛ أُعيد إرساء كل منها في نفس الموجة ببروتوكول التوثيق الذي يفرضه الحارس نفسه (سابقة الالتزام الموثقة `f689854e` «gate-2 fix»)، بلا أي تضعيف: لا عتبة رُفعت، لا إعفاء أُضيف، لا قاعدة تجاهل، لا سقف حُرّك:

| الملف | السبب الميكانيكي | البروتوكول |
|---|---|---|
| `scripts/application-house-edges-census.json` | −٢ صف جرد جانح (M1.2: `orderDetailViewModel → draftService/costEstimateService` غادرا الشجرة) | رسالة الحارس نفسها: «أزل الصف من الجرد وحدّث الإجماليات والأغلف في نفس الـPR» — 126/84/42 → 124/84/40 والأغلف أعيد اشتقاقها + إسناد مؤرَّخ في `provenance.method` |
| `scripts/check-module-boundaries.test.mjs` | دبوس الجرد الحي | تحديث الدبوس بتعليق مؤرَّخ (نمط S16 المتبع) |
| `docs/architecture/refactoring/generated/test-map.json` | أدلة اختبار جديدة للموجة | المولّد الرسمي وحده (`node scripts/generate-test-map.mjs`) — لا تعديل يدوي (إذن المالك في M1.1a) |
| `docs/fixtures/text-density/w3-characterization.golden.txt` | AskMicro 61→17 نصًا ساكنًا بعد حذف البطاقة | إعادة توليد بايت-ببايت — بروتوكول الراتشة المكتوب في ترويسة الاختبار نفسه («يحدث الذهبي في نفس الـPR») |
| `apps/prototype-web/client/src/OrderDetail.noEstimateLink.dom.test.tsx` | تنسيق prettier فقط لملف M1.2 | صفر تغيير منطق |

ملاحظة أمانة مستقبلية (لا تطلب إجراءً الآن): أسطح الحزمة ستُظهر تحسّنًا (انكماشًا) عند أول بناء بعد الحذف — حارس الأسطح يبلّغ التحسّن ولا يفشل به، وإعادة إرساء سجل البناء المولَّد من عمل M1.10/بوابة المرحلة (ملف الأساس خارج مسموح هذه الموجة).

## 5. حدود الشجرة والفرع

- الفروع: عمل على `feature/manage-v2` فقط؛ لا `main`، لا دمج، لا force-push، لا وسوم، لا إعادة كتابة تاريخ منشور (تعديل واحد لالتزام محلي غير مدفوع قبل دفعة الموجة الوحيدة، لضم حذف الملف إلى التزام مهمته بعد أن فكّه stash مؤقت — التاريخ المدفوع النهائي خطي ونظيف).
- صفر اعتماد جديد، صفر كود ميت مضاف، لا نص عربي خارج كتالوجات النصوص القائمة، لا حساب مال في الواجهة (المسارات المحذوفة كانت عرضًا ونداء خدمات فقط).
- لا token ولا سر في أي ملف أو سجل أو رابط.

## 6. روابط الالتزامات

| الغرض | SHA |
|---|---|
| M1.2 — التزام المهمة | `addfc21a7d655df41ae560e6826c71ebf981dfa3` |
| M1.2 — تثبيت الـSHA في المتتبّع | `4d9c999c5c47862c0994b9c21574a7b9f95fa711` |
| M1.3 — التزام المهمة | `96a4a7221206ae7f14dc2249eca5a79d35cdbf34` |
| M1.3 — تثبيت الـSHA + مصالحة أدلة الموجة | `0ed3cada4e1336e57460753a11944509c4b8a7c5` |
| تقرير الموجة + الأدلة (هذان الملفان) | الالتزام الملاصق النهائي على رأس الفرع |

التوقف عند حد الموجة: لا كتابات أخرى بعد هذه الالتزامات، ولا تنظيف ولا تحديثات — بانتظار أمر المالك بالموجة التالية.
