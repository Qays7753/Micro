# R11 UNIT-001 — تقرير تنفيذ المكوّن (2026-10-18)

> **الحالة:** `UNIT001_COMPONENT_IMPLEMENTATION_COMPLETE — PR_READY` (كل معايير القبول المؤتمتة مستوفاة؛ AC11 وAC10-اليدوية بنود صادقة مسجلة أدناه — راجع §غير المنفذ).
> **العقد الحاكم:** `docs/architecture/refactoring/r11-unit001-20261018/R11-UNIT001-EXECUTION-PROMPT-2026-10-18.md` المثبت على `c8d9d5a81807862cfef98ee99b4813d8d2e14b9c` (فرع `docs/r11-unit001-specification-contract-20261018` عبر PR #376 المفتوح — توثيقي؛ لم يُعدَّل ولم يُدمج ولم يُغلق من هذه الموجة).
> **المواصفة الكنسية:** `docs/product/components/UNIT-001-PROJECT-SETUP-SPEC-V2.md` عند `c8d9d5a8…` — النسخة الوحيدة (لا Google Drive ولا نسخة خارجية؛ لم تُنسخ إلى هذا الفرع عمدًا لأن ملكيتها PR #376).
> **المراجعون الخمسة:** `R11-UNIT001-FIVE-REVIEWER-RECORD-2026-10-18.md` (نفس المجلد) — كلهم قراءة-فقط؛ RV3 وRV4 عولج مكتشفاهما الجذريان وأعيد تشغيلهما حتى PASS.

## 1. الهوية والأساس والالتزامات

| الحقل | القيمة |
|---|---|
| المستودع | `Qays7753/Micro` |
| الفرع | `feature/r11-unit001-project-setup-20261018` |
| الأساس الحي المتحقق | `fd5d7ce689d32d8dcc462bcea2ff1c006256f064` (git + GitHub API `branches/main` — تطابق تام؛ STATE_DRIFT=NONE) |
| رأس الفرع النهائي | انظر §14 (الرأس يُحدَّث بآخر التزام توثيقي بعد إنشاء الـPR) |
| الالتزامات (بهذا الترتيب) | `5b1e7ca8` docs(unit001): record baseline and implementation claim · `ca557e14` feat(unit001): implement project setup ownership and flow · `32692c7c` test(unit001): reconcile guard baselines for the component wave · `48cddc21` fix(unit001): apply RV3 remediation — library icon button, aria-busy loading, sentinel consume on leave · `3a3ef71b` test(unit001): re-anchor lazy surfaces at the RV3 remediation head · `e62989d4` test(unit001): restore the 7th ARCH-012-NF-001 launch-interrupt test (RV4-N001) |
| الـPR | واحد إلى `main` من هذا الفرع (لا دمج ولا تنظيف من هنا) |
| PRs المفتوحة عند الجمد | PR #376 وحده (توثيقي) |

**مصالحة القيد المشترك مع PR #376 (RV5-N002):** فرع PR #376 يسجّل `DOC-008`/`WS-224` مسبقًا كتعريف Claim (RESEARCH/CLAIMED) مع Entry 121 في سجل الوكلاء وإحالات فهرس؛ عقد التنفيذ نفسه يوجب استخدام `DOC-008`/`WS-224` لتنفيذ هذه الموجة — فالفرعان يضيفان المعرّفات نفسها بالقصد. **ترتيب الدمج الموصى: #376 أولًا ثم هذا الـPR؛ عند تعارض الملفات المشتركة (DOC-008/WS-224/الفهرس/سجل الوكلاء/Views) تُعتمد نسخة فرع التنفيذ (استمرارية القيد الحية) مع بقاء قصد التعريف المسبق منفّذًا؛ قرار الدمج والترتيب للمالك ولا يُحسم صمتًا.** (عزو توضيحي RV5-N003: تحديثات أسس a11y/text-density ذُكرت في نص رسالة `32692c7c` لكنها واقع الالتزام `ca557e14`؛ رسائل الالتزامات لا تُعدَّل.)

## 2. الملفات المتغيرة ومسؤولية كل منها

| الملف | المسؤولية في هذه الموجة |
|---|---|
| `apps/prototype-web/client/src/pages/Setup.tsx` | إعادة كتابة كاملة إلى شاشة A الواحدة (T01/T02/T03/T06 + حوار T09..T12/T16 + مسودة اسم T13..T15 + حارس الهوية القائمة + تفويض الاستعادة إلى 044)؛ 461→~445 سطرًا بلا أي إدخال نقدي |
| `apps/prototype-web/client/src/pages/Setup.ui.test.tsx` | 44 اختبارًا: AC01..AC10 + ACD001/002/023/024 + سلبيات + دورة حياة ARCH-012-NF-001 كاملة (7/7) + انحدارات RV3 |
| `apps/prototype-web/client/src/application/profile/profileService.ts` | إضافة `create()` — مسار الإنشاء وحده (idempotent؛ لا يعدّل قائمة)؛ `save()` للتعديل (039) كما هو |
| `apps/prototype-web/client/src/application/profile/profileService.test.ts` | 4 اختبارات create جديدة (إنشاء، قائمة دون تعديل، فراغ/فشل قراءة بلا كتابة، فشل كتابة صادق) |
| `apps/prototype-web/client/src/pages/Home.tsx` | لافتة نجاح الإعداد بنص T08 المعتمد وحده (SET-002) |
| `apps/prototype-web/client/src/Nav001.dom.test.tsx` | تحديث اختبار اللافتة إلى T08 (الاسم في الترويسة من مصدره لا داخل اللافتة) |
| `scripts/check-a11y-dialog-surfaces.mjs` (+ `.test.mjs`) | تصنيف سطح حوار معلومات الإعداد (TRUE_MODAL مطابق) في نفس الـPR + تحديث عدد السجل 7→8 |
| `scripts/file-size-ratchet-reanchors.json` | إرساء موثق `R11U1-PROFILE-CREATE-ONLY` (43→74 nbLOC، ocRef WS-224) |
| `apps/prototype-web/scripts/bundle-surfaces-baseline.json` | إرساءان محليان موثقان بالأصل (ca557e14 ثم 48cddc21)؛ سجلات السحابة تتبع بروتوكول ما-بعد-الدفع |
| `docs/fixtures/text-density/w3-characterization.golden.txt` | تجديد الذهبي (Setup 28→11 سلسلة ساكنة، السقف 32 ثابتًا) |
| `docs/00-document-index.md` | إحالات المواد الثلاث للموجة (الأساس/التقرير/سجل المراجعين) |
| `docs/architecture/refactoring/r11-unit001-20261018/**` | دليل الأساس + هذا التقرير + سجل المراجعين |
| `docs/operations/control/items/DOC-008.json` + `workstreams/WS-224.json` + `generated/*` | القيد الحي (مسارات مطابقة للـdiff الفعلي؛ الحالة صادقة) وViews مولدة من JSON وحده |
| `docs/operations/current-state.md` + `current-state-log.md` | تحديث الحقول الحية فقط + إلحاق append-only |
| `docs/architecture/refactoring/AGENT-SEQUENTIAL-WORKLOG.md` | إلحاق Entry (بعد 121 الخاص بفرع PR #376 — انظر §مصالحة) |

**غير الممسوس عمدًا:** StartupGate.tsx، Profile.tsx (039)، Settings/SettingsDataProtectionSection/localTransferService/guidedOpeningImport (044)، FormDraftService وكل طبقة التخزين وأنواعها (38/30)، cashContinuityService وCashWalletEditor (022)، كل CSS/الرموز/التنقل، Domain Core.

## 3. جرد المستهلكين قبل/بعد (بوابة الإزالة B-DUP)

| العنصر المُزال من Setup | قبل | بعد | المالك البديل المثبت | السلبية |
|---|---|---|---|---|
| `cashContinuity.openWallet` من الإعداد | مستهلكان إنتاجيان: Setup + CashWalletEditor | واحد: CashWalletEditor (022) وحده | عقد ٤٠ + عقد ١٠: إعداد المحفظة والافتتاح ملك المالية/المحافظ؛ لم تُمس الخدمة ولا أي مسار آخر | اختبار «no wallet, no opening, no movement» + جرد `openWallet` |
| حقول `walletName/openingChoice/openingMinor` و`EnglishNumberInput` و`todayInAmman` في Setup | مستوردة في Setup فقط (الاستخدام النقدي الوحيد فيها) | صفر في Setup؛ الوحدتان المشتركتان بخدمة ~50 و~47 مستهلكًا آخرين | الإدخال المالي ملك محررات المال حيث تبقى الوحدتان | اختبارات «carries no wizard, no cash fields» |
| قيم مسودة الإعداد المالية | تُستعاد صراحة ضمن مسودة setup (step/walletName/openingChoice/openingMinor) | مسودة اسم فقط؛ الحقول التراثية لا تُقرأ ولا تُطبق ولا تُحوّل مالًا | الحد الموحّد (عقد ٣٦) كما هو؛ لا هجرة ولا حذف سجلات | اختبار legacy-draft (openingMinor=12345 → لا محافظ) + corrupted + legacy-key الخامل |
| نصوص المعالج القديمة | 9 نصوص عرض قائمة | صفر (نصوص V2 وحدها T01..T16) | نصوص المكوّن المعتمدة (B3) | اختبارات السلبية النصية |
| زر «التالي/خطوة سابقة» والتخطّي | مسار المعالج | صفر | — | اختبار شاشة واحدة |

**لا حذف مشترك آخر:** FormDraftService والتخزين و02x/039/042/044 كلها محفوظة (RV1/RV2 جرد مستقل).

## 4. خريطة ميزة→وحدة→عقد→اختبار→مالك

| الميزة | الوحدة | العقد | الاختبار | المالك |
|---|---|---|---|---|
| أول فتح بلا مشروع | StartupGate + Setup | مواصفة V2 R01 | StartupGate.recovery ×3 + Setup «empty first-open read» | 001 |
| فشل قراءة = استرداد | StartupGate + Setup (نص مشترك storageRecoveryCopy) | R01/R07 | «failed identity read enters recovery» + StartupGate.recovery | 001+بوابة |
| هوية قائمة تفتح | StartupGate + Setup حارس الفتح/الإرسال + create() | R02/DUP-002 | «arriving at /setup with an existing project…» + «identity created after mount…» + create-untouched | 001 (الإنشاء) + 039 (التعديل) |
| اسم صالح وحفظه | Setup + ProfileService.create | R05/F01 | «creates the identity once…» + «mixed Arabic/Latin…» + create-tests | 001 |
| فراغ الاسم | Setup | R04 | T05/focus/aria ×3 + create-validation | 001 |
| نجاح→الرئيسية | Setup→Home | R06/T08 | «clears the draft after success» + Nav001 banner | 001→003 |
| فشل الحفظ وإعادة المحاولة | Setup + create() | R07 | T07/retry/proven-file ×3 + create-failure | 001 |
| حوار المعلومات | Setup (مكتبة micro-dialog) | R08/عقد التركيز W4-0 | 6 اختبارات حوار (نصوص/تركيز/Tab/Escape/رجوع/لا حفظ) | 001 |
| مسودة الاسم | FormDraftService (setup) | R09/R10/DUP-023/عقد ٣٦ | 12 اختبار مسودة (عرض/تطبيق/تجاهل/تراثي/فشل/ACD023/دورة 7/7) | 001 (عقد ٣٦ مشترك) |
| مدخل الاستعادة | Setup→Settings | R11/DUP-005/عقد ٢٦ | «delegates… returnTo» + «keeps the draft for return» | 044 |
| حظر التكرار والتعارض | Setup | R12 | «announces progress…» (disabled/aria-busy/تفويض متاح) | 001 |
| لا مال من الإعداد | Setup | R13/DUP-001 | «no wallet, no opening, no movement» | 022/024 ملك النقد |
| رجوع/تحديث | Setup + StartupGate | R14 | mount/unmount cycles + replace-navigation | 001+بوابة |
| RTL/وصول | Setup + primitives | R15/CRIT-16/22 | icon-class/labels/aria/focus/44×44 | 001+المكتبة |

## 5. مصفوفة المتطلب→الاختبار (R01–R15 · F01 · T01–T16 · B4 · B5 · B-DUP · AC)

**القواعد والنصوص:** كل R01..R15 له سلوك مثبت (الخريطة §4) وكل T01..T16 موجود حرفيًا في الإنتاج ومختبر (RV5 نسخ المواضع: Setup.tsx 276/331/341/362/350/375/355/294/304/314/320/283/433/434/435-436/439 + Home.tsx 334). **F01:** بلا حد طول (`maxLength=-1`) ولا حظر لغة، trim ثم رفض الفراغ فقط؛ رسالة الخدمة القديمة («اسم النشاط…») محفوظة عمدًا كخط دفاع أخير وفق ملاحظة B3، والشاشة تعرض T05 أولًا. **B4:** كل صف حالات مغطى (أول فتح/قائم أو فشل/فراغ/صالح قبل الحفظ/جارٍ/فشل/نجاح/مسودة/حوار/استعادة/إغلاق-رجوع). **B5:** كل عقود الجيران محفوظة (002 اختياري لا يفتح تلقائيًا — لا أي فتح مالي من 001؛ 003 يستقبل الحالة الصادقة وT08 دون افتراض كاش؛ 004/005/015 لم تُمس وقواعدها القائمة تعمل بلا محفظة إجبارية — مثبت باختبار FIN-005 القائم واختبار «no wallet» هنا؛ 022/024 بلا كتابة صامتة؛ 039 ملك التعديل؛ 042/044 ملك الاستعادة والحماية).

**حالات القبول:**

| الحالة | الحكم | الدليل |
|---|---|---|
| U001-AC01 | مؤتمت مباشر | «creates the identity once…» + Nav001 (لافتة مرة واحدة) |
| U001-AC02 | مؤتمت مباشر | T05 ×3 + فراغ الخدمة |
| U001-AC03 | مؤتمت مباشر | «mixed Arabic/Latin long names…» + «no invented length» |
| U001-AC04 | مؤتمت مباشر | مسودة ×12 (عرض/تطبيق/تجاهل/بلا ملف نهائي) |
| U001-AC05 | مؤتمت مباشر | T07/retry/proven-file/recovery/T15 |
| U001-AC06 | مؤتمت مباشر | double-submit + exists-after-typing + mount/unmount cycles |
| U001-AC07 | نصف 001 مؤتمت + نصف الجيران بجوارهم | «no wallet, no opening, no movement» هنا؛ بيع/مصروف بلا محفظة بقواعد الجوار القائمة (FIN-005 وغيره) |
| U001-AC08 | مؤتمت مباشر | حوار ×6 (زر/Escape/غطاء/Tab/رجوع/تركيز/لا حفظ) |
| U001-AC09 | نصف 001 مؤتمت (التفويض وسياق الرجوع) + نصف 044 ملكه | «delegates… returnTo=%2Fsetup» + «keeps the draft»؛ تنفيذ الاستعادة نفسه في جناح 044 القائم |
| U001-AC10 | المجموعة الدلالية مؤتمتة (aria/تركيز/تسميات/لمس) + **المجموعة الفيزيائية غير منفذة** | §غير المنفذ |
| U001-AC11 | **غير منفذ (بشري)** | §غير المنفذ |
| U001-ACD001 | نصف 001 مؤتمت + نصف 002 مستقبلي (UNIT-002 لم يبدأ) | «no wallet…» + «no cash fields» |
| U001-ACD002 | مؤتمت مباشر | «rename stays owned by 039…» + create-untouched |
| U001-ACD005 | مدخل 001 مؤتمت + أمرا 044/الأنواع ملك 044 | التفويض بلا صفحة ثانية (assert لا input[file]) |
| U001-ACD023 | نصف 001 مؤتمت + 007/009 بجوارهم | «raw draft twice → one record, no agreement» |
| U001-ACD024 | نصف 001 مؤتمت + المعجم العام بحارسه | «one definition… T05 near the field» + label-vocabulary PASS |

## 6. المكتشفات وتصنيفها الدائم

كل مكتشفات المراجعة الخمسة (RV1-N01/02 · RV2-N01..N04 · RV3-001/002/003 + RV3-N01-R · RV4-N001..N006 · RV5-N001..N008) موثقة بالتصنيف الدائم في `R11-UNIT001-FIVE-REVIEWER-RECORD-2026-10-18.md` — ثلاثة `FIX_NOW` أُغلقت بالدليل (RV3-001، RV3-002، RV3-003 في `48cddc21`؛ RV4-N001 في `e62989d4`)، والبقية `PRESERVE`/`DEFERRED_WITH_EXACT_TRIGGER`/`OUT_OF_SCOPE` بمحفزات دقيقة. **لا «تأجيل عام» واحد.**

## 7. بوابات التحقق — الأوامر ورموز الخروج والأعداد

| الأمر | الخروج | الأعداد/النتيجة |
|---|---|---|
| `pnpm operations-control:test` | 0 | 9/9 |
| `pnpm operations-control:check` | 0 | صالح: 94 بندًا، 66 مسار عمل، Claim نشط واحد؛ تحذيران حميدان موثقان (WS-170 تاريخي؛ gh CLI غير متاح) |
| `pnpm typecheck` | 0 | نظيف |
| `pnpm lint` | 0 | 0 أخطاء؛ 35 تحذيرًا = الأساس (السقف 37 لم يُمس) |
| `pnpm format:check` | 0 | نظيف |
| `pnpm text-density` | 0 | كل الأسطح داخل السقوف؛ Setup 11/32 |
| `pnpm design-guards` | 0 | tokens/contrast/stylelint PASS (92 زوجًا) |
| `pnpm guards` | 0 | 26/26 حراسًا (secrets 1782 ملفًا/0 أنماط؛ a11y-dialog 8 أسطح/7 ملفات؛ module-boundaries؛ ratchet مع الإرساء الموثق؛…) |
| `pnpm test` | 0 | 79 ملفًا / **952/952** |
| `pnpm prototype:check` | 0 | نظيف (tsconfig + node) |
| `pnpm prototype:test` | 0 | 368 ملفًا / **2768/2768** (بعد إصلاح RV4: Setup 44) |
| `pnpm prototype:build` | 0 | الميزانية 631,388/154,996 من 650,000/155,300؛ الأسطح داخل الأساس المرسّى |
| `pnpm check` (السلسلة الكاملة) | **0** | كله أعلاه بترتيب واحد |
| `node scripts/check-doc-index-coverage.mjs` | 0 | التغطية كاملة |
| `node scripts/check-current-state-size.mjs` | 0 | العقد الحي سليم (انظر §10 للحجم بعد التحديث) |
| `git diff --check` | 0 | نظيف |

**ملاحظة CI (RV4-N002):** أول تشغيل github-actions/Cloudflare Pages على رأس الـPR سيفشل حصريًا في قياسَي سطح الرفقة الابتدائية (raw 224,842 > 224,687+8 وgzipNorm 70,752 > 70,716+16) — لأن سجلا البيئتين السحابيتين تُركا عند مراسي `0f527e62` وفق بروتوكول ما-بعد-الدفع الموثق في تاريخ الحارس (ثلاث حالات سابقة بأرقام تشغيل): تُرسّى github-actions من قياسه المباشر وcloudflare-pages باشتقاق فئة البيئة المثبت، ثم تتحقق تشغيلات رأس الـPR النهائية. هذا ليس تعطيلًا للحارس بل بروتوكوله المعتمد؛ القياسات المحلية على رأس الكود مرسّاة بالأصل ومثبتة أعلاه.

## 8. بيانات النطاق الدلالي والمالي والمخطط/التصدير والأمن والوصول والبصر

- **المعاني المالية:** لا تغيير أي معنى مالي؛ الإزالة الوحيدة هي إنشاء المحفظة/الافتتاح من مسار الإعداد (المواصفة/DUP-001)؛ «غياب السجل ليس صفرًا» محفوظ — لا قيمة صفر تُكتب من 001 إطلاقًا.
- **المخطط/التصدير/الاستيراد:** `localSchemaVersion=38`/`localExportVersion=30` كما هما حرفيًا (`storage/local/types.ts` خارج diff)؛ لا هجرة؛ متجر form-drafts كما هو (القيم دلالة صفحة لا مخطط).
- **التاريخ:** لا تعديل سجلات تاريخية؛ لا حذف بيانات؛ المفاتيح التراثية في المتصفحات تبقى خاملة (قرار ARCH-012).
- **الأمن:** صفر أسرار في diff (فحص نمطي + check-secrets)؛ الاعتماد استُخدم من الحقل الآمن فقط ولا يظهر في أي ملف/تقرير/سجل/URL؛ الاستعادة خلف بوابات PIN/الحماية القائمة (044) ولم تُتجاوز.
- **الوصول:** حوار TRUE_MODAL مصنف بنفس الـPR؛ تركيز/Tab/Escape/رجوع/استعادة تركيز؛ T09 مسمى؛ هدف لمس 44×44؛ أخطاء role=alert وaria-invalid/describedby؛ RTL وdir=rtl.
- **البصري:** صفر تغيير CSS/رموز/تنقل/بنية عامة؛ أصناف المكتبة القائمة فقط؛ `loading` الأولي هو عقد الزر القائم نفسه؛ هذا تصحيح دلالات/وصول لا New Design.

## 9. حد الاستعادة والبروفة (RV4-N003)

- **الحدود:** الأساس `fd5d7ce6`؛ كل التزامات الفرع تُعكس كوحدة متسقة (revert لكل التزام منفردًا أو إغلاق الـPR قبل الدمج)؛ لا أثر على main قبل الدمج؛ لا حذف بيانات ولا مسح تخزين متصفح ولا هجرة.
- **البروفة (منفذة 2026-10-18):** (1) عند الأساس: اختباراته المركزية 19/19 ناجحة (worktree معزول). (2) عند رأس الموجة `e62989d4`: reverse-apply للـdiff الكامل (2,691 سطرًا) **بلا أي تعارض**، والشجرة الناتجة **مطابقة للأساس بايتًا-بالبايت** (diff فارغ). **النتيجة: REHEARSAL_PASS — الاستعادة كوحدة نظيفة ومثبتة.**

## 10. السجلات الكنونية والحالة الحية

- `DOC-008`/`WS-224`: مسارات areas مطابقة للـdiff الفعلي (تصحيح RV5-N001)؛ الحالة `IN_REVIEW` بعد إنشاء الـPR (يرفق رقمه)؛ `MERGED_UNVERIFIED` بعد دمج موافق، و`VERIFIED` فقط بعد إثبات ما-بعد-الدمج على رأس main — **لا يُدّعى أي منها هنا.**
- Views المولدة أعيد إخراجها من JSON المصدر وحده؛ `validate.py` PASS.
- `current-state.md`: حُدّثت الحقول الحية فقط (رأس main الحي، Claim WS-224 نشط، فرع PR #376 قائم) داخل سقف 20,480 بايتًا؛ التفصيل append-only في `current-state-log.md` (§جديد لهذه الموجة).
- سجل الوكلاء: Entry ملحق (يحسب رقمه بعد Entry 121 الخاص بفرع PR #376 وفق خطة المصالحة §1).
- الفهرس: إحالات المواد الثلاث تُحل الآن إلى ملفات موجودة.

## 11. غير المنفذ / غير متحقق / محجوب / محفوظ / مستقبلي مُبوّب

| البند | الحكم | المحفز/الشرط الدقيق |
|---|---|---|
| U001-AC11 (فحص فهم بشري مع الفئة المستهدفة) | NOT_EXECUTED | يحتاج جلسة مستخدمين حقيقية عند توفر نموذج قابل للتشغيل؛ نسجل الأخطاء والتردد وطلب المساعدة دون افتراض نتيجة |
| U001-AC10 المجموعة الفيزيائية (هاتف ولوحة مفاتيح فعلية، تكبير، قارئ شاشة حي) | NOT_EXECUTED (المجموعة الدلالية مؤتمتة ومغطاة) | بوابة UAT/DEVICE القائمة (UX-001/UAT-001 خارجية) عند قرار المالك |
| قبول Android/iOS/standalone/Offline الإنتاجي | NOT_EXECUTED (قائم كما هو قبل الموجة) | بوابات PRE-PILOT القائمة |
| حالة CI على رأس الـPR | UNVERIFIED بعد الدفع مباشرة | أول تشغيل بعد الدفع (متوقع فشل القياسين الابتدائيين وفق البروتوكول §7 ثم الإرساء والتحقق النهائي) |
| RV3-N01-R (عابرة وميض تسلسل المتصفح الحقيقي في نافذة ضيقة جدًا) | DEFERRED_WITH_EXACT_TRIGGER | فحص رجوع حي على متصفح/جهاز في UAT |
| بدء UNIT-002 أو أي مكون آخر أو New Design أو دمج أو تنظيف | OUT_OF_SCOPE بقرار العقد | قرار مالك مستقل |

## 12. الفعل التالي الدقيق للمالك

1. راجع هذا الـPR (تقرير التنفيذ + سجل المراجعين + diff 20 ملفًا) — بعقد العينة: أين تُقرر مصالحة القيد المشترك مع PR #376 (الترتيب الموصى: #376 أولًا ثم هذا الـPR؛ عند التعارض تُعتمد نسخ فرع التنفيذ).
2. عند القبول: ادمج هذا الـPR (و#376 قبله)؛ عند الرفض: علّم البنود وسنُصلح بالتزامات جديدة على الفرع.
3. بعد الدمج: تحقق ما-بعد-الدمج على رأس main الفعلي (checks + Pages + إعادة توليد Views عند الحاجة) ثم انقل DOC-008/WS-224 إلى MERGED_UNVERIFIED ثم VERIFIED بالأدلة — لا يُعلن أي منها قبل حدوثه.
4. القرار المستقل التالي: فتح تنفيذ UNIT-002 (استكمال بيانات المشروع) بعقد وClaim مستقلين — لا يبدأ تلقائيًا من هنا.

## 13. علامات الحالة النهائية

```text
UNIT001_COMPONENT_IMPLEMENTATION_COMPLETE — PR_READY
UNIT001_SPEC_TO_CODE_TEST_OWNER_TRACEABILITY — COMPLETE
UNIT001_FIVE_READ_ONLY_REVIEWERS — COMPLETE
NO_MERGE_PERFORMED
NO_BRANCH_CLEANUP_PERFORMED
NO_SECRETS_EXPOSED
```

## 14. ملحق التحديث النهائي (بعد إنشاء الـPR)

- **الـPR:** [#377](https://github.com/Qays7753/Micro/pull/377) — `feature/r11-unit001-project-setup-20261018` → `main` (مفتوح؛ لا دمج ولا تنظيف من هذه الموجة).
- **رأس الفرع عند فتح الـPR:** `b29b2e3c91ad92ef1eb396e1cd59421daffca248` (الالتزامات الستة أعلاه)؛ رأس الفرع النهائي بعد التزام رفع الحالة أدناه هو `pending` حتى الدفع — يُقرأ من `git ls-remote` لا من هنا.
- **رفع الحالة:** DOC-008 وWS-224 انتقلا إلى `IN_REVIEW` مع `pr=377` وEntries تاريخ حالة موثقة؛ Views أُعيد توليدها من JSON وحده (validate.py PASS).
- **توقع CI على رأس الـPR:** كما في §7 (بروتوكول ما-بعد-الدفع الموثق: أول تشغيل يُتوقع فشله حصريًا في قياسَي السطح الابتدائيين ثم يُرسّى ويُتحقق في تشغيلات رأس الـPR النهائية).
- **نقاط تفتيش الـPR:** تُنشر كتعليقات على الـPR نفسه (التزام لكل التزام ذي معنى: الالتزام، النطاق، الاختبارات، البوابة المتبقية).
