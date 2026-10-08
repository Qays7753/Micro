# R4 — Transfer/Schema/Export/Import — Execution Report (2026-10-08)

**البرنامج:** `WS-216` / `ARCH-007` — successor البنيوي R0–R10.
**الموجة:** R4 — حدود Transfer وSchema وExport/Import والتاريخ + إغلاق R3.
**الأساس:** `origin/main` = `1c54c552670e239aa606a58f6859f0ffd8662456` (بعد R3: PR #332 @ `8eeb473` + مصالحتها PR #333 @ `1c54c55`).
**الفرع:** `refactoring/r4-transfer-schema-export-20261008`.
**العقد الحاكم:** `ZAI-STRUCTURAL-REMEDIATION-R0-R10-EXECUTION-CONTRACT-20261007.md` + `STRUCTURAL-REMEDIATION-PLAN-20261007.md` R4 + أمر المالك «Micro — ZAI R3 Closeout and R4 Transfer Root-Fix Execution» (هذه الجلسة).
**البطاقات:** `docs/operations/control/evidence/structural-remediation-r4-20261008/R4-REPAIR-CARDS.md` (كُتبت قبل أي تغيير إنتاجي — S0).

---

## 0. نقطة التحقق قبل الكتابة (Preflight — قراءة فقط)

- `git fetch origin --prune` → `origin/main` = **`1c54c55`** — مطابق للنقطة المرجعية المعروفة للمالك حرفيًا؛ **صفر STATE_DRIFT**.
- فروع remote: 15 فرعًا (كلها تاريخ موجات منتهية)؛ **صفر PRs مفتوحة** (تحقق API موثق بالمصادقة).
- فرع `refactoring/structural-remediation-r0-r10-20261007` موجود عند `c9909c2` **بلا أي التزام متقدم على main** (فرع R0 التاريخي — ليس حامل عمل حي)؛ أُنشئ فرع R4 المخصص من `origin/main` مباشرة.
- العمل المحلي: النسخة العاملة `repo-postscan` كانت نظيفة عند `d95a530` (خلف main بالالتزام الأخير وحده)؛ لا عمل غير معروف يمكن دهسه.
- **المخطط/التصدير:** `localSchemaVersion = 38` (types.ts:55) و`localExportVersion = 30` (types.ts:71) — كما هما.
- **D11/D13 بلا انحدار:** مواقع `persistedMoneyTextMinor` مطابقة لأساس R2 (policies.ts:1429,1506؛ deliveryReviewService.ts:605؛ cashCountMessages.ts:12,18,19)؛ صفر `new Date()` في src/domain غير الاختبارات؛ صفر استدعاء `localDateInAmman()` بلا وسيط في الإنتاج؛ `todayInAmman` على `systemClock` الصريح.
- Operations Control: `validate.py` خروج 0 (81 عنصرًا/55 workstream/claim نشط واحد = WS-214 التاريخي المتقاعد A-to-Z — معروف وموثق)؛ تحذيرا WS-170 (تاريخي) وWS-214 (فرع متقاعد) حميدان موثقان.
- قراءة إلزامية أُثبتت: AGENTS.md، العقد الحاكم، الخطة، تقرير R3 وبطاقاتها، سجل الملكية، سجل الملفات، سجل المسارات المستقلة (STR-608/623)، JSONs الحية.
- البيئة: node v24.21.0، pnpm 9.15.9 (أعيد تثبيته)، القرص 10% — لا عبء.

**الخلاصة:** الحالة الحية تصالح تمامًا مع نقطة التحقق المعروفة؛ فُتحت Phase A ثم B–D وفقًا للأمر دون أي توقف محمي.

## 1. الملخص التنفيذي

أُغلقت بنود R3 المتبقية المطلوبة قبل R4 **كلها بحالة نهائية** (بوابة A6): اختبارات وحدة مباشرة للحرّاس الأربعة (R3-N3)، أجنحة رفض/عمق للقدرات الأربع (HAF-1)، حذف سطر فرع CI المتقاعد (R3-N5 — القرار المفوض)، وتصويبا التوثيق (R3-A1 تعداد الـ23 طريقة + R3-A2 تصنيف MemoryLocalStore مع التسليم لـR6). ثم نُفذت R4: **جرد كامل لقيم القبول** (مصفوفة §5)، **توحيد القيم الحالية عند مالكها الكنوني** (إغلاق STR-623 بموجب بوابة STR-608 الموثقة: قائمة مجال جديدة واحدة + استهلاك مباشر في الموقعين الحدوديين + تحويل مراسي القبول إلى إثبات استهلاك)، **إصلاح جذر فجوة القناة المهيكلة** في guided prepare (مسارات الرمي كانت تفلت للقاطع العام)، و**قرارات PRESERVE موثقة** لملفات النقل الكبيرة بعد مراجعة شقوق حقيقية (C1/C2/C3) و**تحقق بوابة Schema 38/Export 30** (D1 — صحيحان، لا تغيير). صفر تغيير بصري UI؛ صفر تغيير مالي/دلالي/تاريخي؛ القبول والرفض كما هما حرفيًا (القناة فقط تحسنت). الاختبارات: **2388/2388 تطبيقًا** (كان 2336) و**682/682 جذريًا**؛ الحراس 15/15؛ الميزانية 629,438/154,677 تحت السقفين.

## 2. إغلاق R3 (Phase A) — البوابة

| البند | الحالة | الدليل |
|---|---|---|
| R4-A1 تصويب المقاييس واللغة | CLOSED_WITH_EVIDENCE | تصويب مؤرخ في تقرير R3 §7 (تعداد 3+9+9+2 + الصياغة المرجعية) |
| R4-A2 تصنيف MemoryLocalStore | PRESERVED_WITH_RATIONALE | تحقق حي: production/storage في كل السجلات؛ بطاقة W6 التسعة عناصر + تسليم R6 مؤرخ |
| R4-A3 حرّاس بلا اختبار مباشر | CLOSED_WITH_EVIDENCE | 4 ملفات / 39 اختبارًا — السلوك (قبول/رفض/إعادة استخدام/لا كتابة جزئية) |
| R4-A4 فرع CI المتقاعد | CLOSED_WITH_EVIDENCE | حذف السطر + تحديث اختبار السياسة في نفس الشريحة (e6eae5d) |
| R4-A5 عمق القدرات (HAF-1) | CLOSED_WITH_EVIDENCE | 8 اختبارات مزدوجة المحوّل؛ الرفض المشتق من سلوك المحوّلين الحي لا مخترع |
| البوابة A6 | مُجتازة | كل البنود في حالة نهائية؛ لا DEFERRED عامة |

## 3. ما نُفذ في R4 (Phase B–D)

### B2 — توحيد القيم الحالية (إغلاق STR-623 بموجب STR-608)

1. **قائمة مجال كنسية جديدة:** `cashWalletKinds` في `src/domain/cash-continuity/types.ts` — نفس نمط `SOURCE_REF_KINDS` في الملف نفسه (والقوائم الأربع الأخرى في المجال). هذا هو «القرار الموثق» الذي انتظرته بوابة STR-608: الهامش الحي 20,656 خام/656 gzip (كان 129 خامًا عند D-034).
2. **guidedOpeningImportService:** طاقما `walletKinds` و`materialUnits` يُبنان من المجال مباشرة (`new Set<CashWalletKind>(cashWalletKinds)` / `new Set<MaterialUnit>(domainMaterialUnits)`) — البرميلان مستوردان أصلًا في الشظية فصفر أثر حزمة صافٍ.
3. **agreementContextService:** يستورد `AGREEMENT_SOURCE_ACCEPTANCE` و`LegacyAgreementSource` من `transferCompatibilityValues` (السجل الكنوني) ويبني طاقمه منه — استيراد تطبيقي داخلي مباشر (نمط Wave B/ADR-011 الموثق على باب transfers).
4. **مراسي القبول:** `check-acceptance-value-anchors.mjs` تحول من «تساوي حرفي بين نسختين» إلى «إثبات الاستهلاك الكنوني المباشر» (استيراد + بناء + خلوّ من النسخة الحرفية) مع تثبيت القوائم الكنونية نفسها؛ سلبياته السبع تثبت الاصطياد عند أي رجوع.
5. **ما بقي حرفيًا (موثق لا مخفي):** اتحادات GUARDED_UNION داخل `transferFamilyValidators.ts` نفسه (isCashWalletKind/isUnitDimension/...) — تفويضها التشغيلي مؤجل بقرار D-034 قائم (سحب براميل catalog/cash-continuity إلى رأس شظية النقل الرئيسة يهدد هامش gzip البالغ 656 بايتًا)؛ محروسة بمراسي `domainTransferDriftAnchors` ثنائية الطبقة (الأنواع + التشغيل). المالك الدلالي واحد (اتحاد المجال) — ليست «مصدرين نشطين» بل استهلاكًا محروسًا موثق السبب، وأي رفع مستقبلي للتفويض يفتح بقرار مالك (محفز موثق في §6).

### B4 — القناة المهيكلة عند حد النقل

- **الفجوة المكتشفة:** `guidedOpeningImportService.prepare` كان يستدعي `parseFile` خارج أي عقال بينما ترمي دوال `.map()` الداخلية `Error` صريحة للبنود المعطوبة — الرمي يصل قاطع الواجهة العام فتظهر «تعذر قراءة ملف البداية» العامة بدل الرفض المهيكل بنص السبب. لا خطر بيانات (الرمي قبل أي كتابة والواجهة تلتقط)، لكنه ناقض عقد R2 (M-03/D2) والمسار الكامل المجاور المحمي أصلًا.
- **الإصلاح:** لف `parseFile` بعقال مهيكل بنمط R2 نفسه — `{ok:false, code:"validation_error", message: بنص الرمي}`؛ قرار القبول/الرفض لم يتغير (البنود المعطوبة كانت تُرفض وتبقى تُرفض — تحسنت القناة والنص فقط).
- **تحقق B4 الكامل:** `isLocalDate` = نواة المجال (لا ترمي أبدًا؛ السنوات 0000–0099 مقبولة كما كانت؛ الدوران مرفوض)؛ `isDate` = `isValidTimestamp` النواة؛ لا `Date.parse` في حقول التاريخ المحلي (حارس date-arithmetic-ownership R1–R6 أخضر)؛ guided `isDate` أصلح في R2؛ العقال المهيكل محكم في المسارين الكامل والموجه الآن؛ الفشل لا يستبدل جزئيًا أبدًا (أجنحة exe014/rejection خضراء).

### C1/C2/C3 — قرارات البنية (PRESERVE موثقة بعد مراجعة الشقوق)

- **C1 transferFamilyValidators (1,745):** بطاقة ADR-017 §3 قائمة — مراجعة R4 لم تجد شق مسؤولية جديدًا (العائلات شرائح عملية تحقق واحدة؛ B2 قللت التكرار الفعلي بلا تقسيم). السجل كما هو.
- **C2 transferSnapshotValidation (1,193):** كان SPLIT_CANDIDATE بشرط «characterization first» — التوصيف قائم الآن (4 ملفات). المراجعة الحية: قواعد العلاقات (التفرّد/المراجع/الطي/الأزواج) تُبنى على ~15 طقم معرّفات مشترك تتراكم عبر العائلات بالترتيب نفسه — الفصل يخيط الأطقم بين وحدات بلا مكسب ملكية = شق آلي بالأقسام لا شق مسؤولية. صُعد تصنيف السجل إلى **PRESERVE موثق** بمحفزي إعادة فتح (عائلة بملكية علاقات مستقلة / إتمام 4D).
- **C3 السلسلة الكاملة:** `prepareImport` (parse → format → pair gate → date/record → [integrity → migration → validation → counts] داخل عقال مهيكل) ثم `confirmImport` (نسخة متحققة قبل الاستبدال → replaceSnapshot ذرّي) — وحدة واحدة مفهومة بلا حلقة مفقودة؛ الثغرة الوحيدة (guided parseFile) رُدمت.

### D1 — بوابة Schema 38 / Export 30

**PRESERVE_BY_DESIGN بالأدلة:** الكود (`types.ts:55/:71`)؛ الذهبية الحالية `current-pair.golden.json` تحمل 30/38؛ `MANIFEST.json` يربطها بمولدها وأمرها؛ 25 زوجًا تاريخيًا مدعومًا لكل منها ذهبية `legacy-minimal-*` واختبار زوج (`releasedPairs`)؛ اختبارات schema27–34 + envelope27 + rel001 + historical817 خضراء. لا خلل ثبت → لا حزمة قرار محمية → لا تغيير.

## 4. مصفوفة قيم القبول (خلاصة الجرد الحي — B1)

| التصنيف | العائلات | المصدر | الحارس |
|---|---|---|---|
| DOMAIN_RUNTIME_LIST | materialUnits، expenseBudgetStatuses/KnowledgeLevels/periodKey، wasteContext، sharedProjectShare، ownerEntitlement\*، allocationPolicy، delivery terms/deposit meanings | استهلاك مباشر من المجال وقت التشغيل | النوع + اختبارات الاستهلاك |
| HISTORICAL_REGISTRY | LEGACY_AGREEMENT_SOURCES (3) فوق الاتحاد الحالي (5)؛ 25 زوج إصدار مدعومًا | `transferCompatibilityValues.ts` + `transferEnvelope.ts` حصرًا | `transferCompatibilityRegistry.test.ts` (كل قيمة بلا صف = فشل) + الذهبيات + عقد 39 |
| GUARDED_UNION | knowledge/result/order/settlement/schedule statuses، financial/asset/loan/deposit types، unitDimension، cash kinds+entry types، inventory movement، recurring sets، yield، shortCash، expenseContext | حرفيات في المدققات = اتحادات المجال | مراسي `domainTransferDriftAnchors` (satisfies Record<Union,true>) + اختبار الحارس زمني الأنواع والتشغيل |
| STR-623 (سابقًا) | agreementContext 8 قيم + guided طاقمان | **موحدة الآن عند مالكها** (B2) | مراسي الاستهلاك الجديدة (سلبيات مثبتة) |

المصفوفة التفصيلية الكاملة (قيمة/قيمة بمصدرها ومستهلكها واختبارها) = `TRANSFER_ACCEPTANCE_SOURCES` في السجل الكنوني نفسه + صفوف سجل الملكية §4 — بقيت مطابقة للحي بعد التوحيد.

## 5. الاختبارات والفحوص (الرأس النهائي للفرع)

- `pnpm --filter @micro/prototype-web test -- --run`: **323 ملفًا / 2388 اختبارًا — كلها PASS** (كان 319/2336 عند دخول R4؛ +4 ملفات حرّاس/+52 اختبارًا).
- `pnpm --filter @micro/prototype-web test -- --run transfer export migration schema`: **32 ملفًا / 305 اختبارات PASS** (حد R4 كاملًا).
- `pnpm test` (الجذري): **682/682 PASS** (كان 681؛ +1 اختبار مراسٍ).
- `pnpm typecheck` + app tsc: صفر أخطاء. `pnpm lint`: 0 أخطاء/35 تحذيرًا (السقف 37). `prettier --check`: نظيف.
- `pnpm guards` (السلسلة الكاملة 15): كلها PASS — secrets (1537/0)، test-focus (383/0)، entity-touchpoints، runtime-cycles (419/0)، doc-index، current-state-size، skill-references، image-policy، module-boundaries (388؛ الراتشات كما هي)، type-cycles (1=الأساس)، registry-coverage، **acceptance-value-anchors (الوضع الجديد: استهلاك كنوني)**، file-size-ratchet (482؛ صفر تصعيد)، vendored-braces، date-arithmetic-ownership (R1–R6).
- `pnpm text-density` + `pnpm design-guards`: PASS (92 زوج تباين).
- `python3 scripts/operations-control/validate.py`: خروج 0. `generate_tracker.py --check`: بلا انحراف بعد التحديث.
- **الميزانية:** الدخول **629,438 خام / 154,677 gzip** تحت 650,000/155,300 (دلتا الدخول عن R3: +94/+33 بايت — قائمة المجال الجديدة والاستهلاك)؛ الأسطح: lazy 102/1,414,665/434,699 وprecache 187/2,741,464 — **تحسن غير مقفل** عن الأساس.
- `git diff --check`: نظيف.

## 6. ما لم يتغير (حدود محمية)

- **Schema 38 / Export 30** وكل الهجرات والذهبيات وMANIFEST — لم تُمس بايتًا.
- **سلوك القبول/الرفض** — القيم متطابقة حرفيًا قبل التوحيد وبعده (المراسي القديمة كانت تثبت التساوي قبل التحويل)؛ تحسنت **القناة** فقط في guided (رفض مهيكل بنص السبب بدل رسالة عامة).
- **UI/UX** — صفر تغيير بصري/DOM/تنقل/نسخ.
- **المعاني المالية** — collection ليس ربحًا... إلخ: لم تُمس؛ لا صيغة ولا تقريب ولا تصنيف.
- **types.ts** والحراس التسعة والمحوّلان — صفر تغيير إنتاجي في التخزين (القدرات أنواع فقط كما خلفتها R3).
- **التاريخ** — لا حذف قيم توافقية ولا إعادة تفسير ملفات قديمة.

## 7. ما بقى خارج هذه الجلسة (تسليم موثق لا DEFER مغموض)

| البند | المالك | المحفز | الشرط |
|---|---|---|---|
| شطر المحوّلين (IndexedDB/Memory) | **R6 المعتمدة** (قائمة فحصها الإلزامية) | مجموعة قدرة جديدة/ترحيل/عبور شريط | قرار مالك في R6 بعد إعادة الفحص |
| تفويض GUARDED_UNION التشغيلي في مدققات النقل (4D) | قرار مالك لاحق (D-034/STR-608) | هامش gzip يسمح (اليوم 656 بايت — لا يسمح بسحب برميلين) | بطاقة بقرار مالك مع قياس أثر |
| STR-608 الموحّد المتبقي (لا مواقع نصية متبقية — البوابة أُغلقت لمواقعها) | مكتمل لهذه الجلسة | — | — |

## 8. حدود الرجوع

كل شريحة commit مستقل يعود بـ`git revert` واحد: S1/S2 اختبارات فقط (صفر إنتاج)؛ S3 سطر CI واحد + اختباره؛ S4 التوحيل (يعود بالنسخ الحرفية المحروسة تعمل كما كانت — لا أثر بيانات)؛ S5/S7 توثيق. الموجة كاملة تعود بسلسلة الشريحات بترتيبها المعكوس. لا هجرة ولا مخطط ولا سلوك محوّل في أي شريحة.

## 9. الحالة

- المخطط/التصدير 38/30 كما هما؛ لا تغيير مالي/دلالي/تاريخي/أمان/صلاحية/UI.
- **R4_REMEDIATION_COMPLETE على الفرع** — في انتظار التدقيق العدائي النهائي وبوابة المالك (الدمج بقرار منفصل كما يشترط أمر الموجة؛ Merge Manifest جاهز في `R4-MANIFEST.md`).

*السجلات المكملة: بطاقات R4 (حالة التنفيذ)، سجل الملكية (صفوف STR-623 الموحدة)، سجل المسارات المستقلة (إغلاق STR-623)، WS-216/ARCH-007 (JSON ثم Views)، current-state واللوق §149، worklog Entry 58، خريطة الاختبارات مجددة.*
