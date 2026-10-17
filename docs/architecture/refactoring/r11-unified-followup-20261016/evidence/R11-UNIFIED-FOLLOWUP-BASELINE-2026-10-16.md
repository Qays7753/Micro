# R11 Unified Follow-up — Phase 0 Baseline and Evidence Freeze (2026-10-16)

> **الحالة:** `BASELINE_FROZEN` — جرد القراءة فقط قبل أي كتابة كود (العقد §5 Phase 0).
> **العقد الحاكم:** `R11-UNIFIED-FOLLOWUP-EXECUTION-PROMPT-2026-10-16.md` المثبت على `b0aa8d8b9acbb98d6c262bc76851405936db0112` (فرع `docs/r11-unified-followup-prompt-20261016` عبر PR #371 المفتوح).
> **قاعدة الأدلة:** كل بند موسوم `VERIFIED` (قياس مباشر مسجل) أو `INFERRED` (استنتاج موثق من كود) — لا ترقية للتخمين.

## 1. الأساس الحي (VERIFIED)

| الحقل | القيمة المقيسة |
|---|---|
| `origin/main` (git fetch) | `cb3b9aaae16b2e6336a6b831d2c1de8cf3603acf` |
| `origin/main` (GitHub API `branches/main`) | `cb3b9aaae16b2e6336a6b831d2c1de8cf3603acf` — تطابق تام |
| تلميح العقد («تقريبًا cb3b9aa») | مطابق — **لا انحراف حالة (STATE_DRIFT = NONE)** |
| فرع التنفيذ | `remediation/r11-nf001-nf002-w2b-d12-20261016` — مُنشأ من `origin/main` المُتحقق أعلاه مباشرة (لم يكن موجودًا محليًا أو عن بُعد قبل الإنشاء — لا عمل سابق يُستأنف على هذا الفرع) |
| الـPR | لم يُنشأ بعد — يُنشأ عند اكتمال التنفيذ (عقد واحد لهذه المتابعة الموحدة) |
| فحوص رأس main | CI `checks` و`Cloudflare Pages` على `f0904260` (دمج PR #369) SUCCESS — مسجلة §211؛ رأس `cb3b9aaa` نفسه = دمج PR #370 (مصالحة توثيقية) |
| PRs المفتوحة | #371 (عقد المتابعة — docs فقط)، #367، #364 (عقود موجات سابقة — docs فقط) — لا تداخل areas مع هذا العمل |
| Claims النشطة | صفر — `generated/ACTIVE-WORK.md` فارغ؛ آخر Claim هو WS-221 (VERIFIED مغلق) |
| ملكية الكتابة | كاتب واحد (ZAI) على الفرع أعلاه؛ لا كاتب آخر (الفرع أُنشئ هذه الجلسة ولم يُدفع بعد) |

## 2. حالات البنود المعنية (VERIFIED — قراءة مباشرة من JSON المصدر عند `cb3b9aaa`)

| البند | الحالة الحالية | الملاحظة الدقيقة لهذه الموجة |
|---|---|---|
| `ARCH-011` (R11 lock) | `IN_REVIEW` | **انحراف سجلات فقط:** PR #368 دُمج عند `f221a0127e…` وتحقق (WS-219 = VERIFIED بmerge_sha=verified_on_main_sha=`f221a0127e…`؛ current-state §1 تسجل «R11 المتابعة عند f221a012»)، لكن بند ARCH-011 نفسه بقي IN_REVIEW وnext_action يطلب «قرار المالك على PR #368» — قرارٌ حاصل. تُصالح في Phase 5 كسجلات فقط بأدلة §208/§210. |
| `ARCH-012` (تقاعد الترحيل التراثي) | `VERIFIED` (merge_sha=verified_on_main_sha=`f0904260…`) | Outcome A مكتمل ومدمج؛ المحفزان المسجلان **ARCH-012-NF-001/002** بقيا مستقلين — هذه الموجة تنفذهما بقرار المالك (العقد §3.1). يُعاد فتح البند (REOPENED → IN_PROGRESS) ليوثق الإصلاحين مع حفظ تاريخ Outcome A. |
| `ARCH-013` (W2a/W2b) | `IN_REVIEW` | W2a مكتملة (326/326)؛ بوابة W2b = `EXACT_PAYLOAD_REQUIRED` — **الحمولة الدقيقة الآن معتمدة** في العقد §3.2 (رمز `validation_error` + النص العربي الحرفي) وتُسجل في ملحق الأدلة `W2B-OWNER-PAYLOAD-ADDENDUM-2026-10-16.md` قبل أي كتابة سلوك. |
| `D-12` / `F-040` (مصدر Micro Standard) | مؤجل بقرار مالك موثق (REM-004 `owner_decision`؛ سطر SOURCE_OF_TRUTH.md موسوم «مصدر خارج المستودع، D-12 معلق»؛ current-state §8.2-4) | العقد §3.3 يفتح الإغلاق بالدليل الآن. الجرد الأولي للمرجع الخارجي أسفل §6. |
| `D-13` / `F-055` (calculationVersion) | مؤجل بقرار مالك (REM-004؛ §82 اللوق) | يبقى future-gated — يُثبت في Tracker بخريطة محفز/مالك/فعل تالٍ/حد توقف، بلا أي تنفيذ. |
| `QR-5` / `F-060` (فائدة القروض) | مؤجل بقرار مالك (REM-004؛ §82 اللوق) | يبقى future-gated — لا سياسة فائدة ولا افتراض صفر. |
| `F-043` (بنيوي) | خلف بوابة المالك (فصل موثق في REM-005؛ REM-004 acceptance) | يُسجل في Tracker كبند structural-gate — لا عمل بنيوي هنا إطلاقًا. |
| `GOV-001` (G10-A ضد عقد C1) | `REVIEW_REQUIRED` | يبقى بند مراجعة مالك صريح — لا توحيد ولا اختيار صامت بين العقدين. |
| `DEFERRED_UI` | مؤجل موثق (اللوق §82/§84؛ REM-004) | يبقى نطاقًا مستقبليًا — لا تغيير بصري/CSS/tokens/تنقل/نصوص عرض في هذه الموجة. |

## 3. مخطط استدعاء خدمة المسودات وحدود التخزين (VERIFIED — قراءة كود مباشرة)

```
FormDraftService (application/drafts/formDraftService.ts)
  ├─ read/save/discard/list/clearAll
  ├─ مخزن مستقل form-drafts خارج اللقطة (لا يُصدَّر ولا يُستورد — عقلا localOnlyRecords تقاعد مع ARCH-012)
  ├─ حد الحجم 32,000 حرف JSON (MAX_FORM_DRAFT_VALUE_CHARS) وحارس تزامن expectedUpdatedAt
  └─ Store: PrototypeLocalStore (IndexedDbLocalStore / MemoryLocalStore — تكافؤ مثبت بالاختبارات)

المستهلكون الحاليون (سبعة أنواع FormDraftKind — storage/local/types.ts):
  ├─ pages/Setup.tsx — «setup» (قراءة عرض + حفظ/مسح بأثر التغيير + قبول/تجاهل صريحان)
  ├─ pages/FinancialEventEditor.tsx — «finance_event:<type>» (قراءة عرض + حفظ بالوسخ + قبول/تجاهل + مسح بعد الحفظ الناجح)
  ├─ components/forms/useFormDraft.ts — الخطاف الموحد (restore-offer/drafting/clean) لمستهلكيه:
  │    AssetEditor («asset») · LoanEditor («loan») · SupplierPurchaseEditor («supplier_purchase») · DirectSaleEditor («direct_sale»)
  └─ pages/Settings.tsx — clearAll() فقط ضمن «ابدأ من جديد» المعلن
لا مهايئ تراثي: legacyFormDraftMigration تقاعد بقرار مالك (ARCH-012 Outcome A — main عند f0904260)؛ حارس check-diagnostics-storage بموضع مسجل واحد (مهايئ التشخيص).
```

### 3.1 NF-001 — نافذة إقلاع Setup (قائمة على main — VERIFIED بالتتبع والاختبار المرجعي)

`Setup.tsx` يقرأ المسودة في أثر تركيب غير متزامن (سطر 86–97) بينما **أثر الحفظ/المسح (سطر 102–121) يعمل فورًا عند الفتح قبل استقرار القراءة**: النموذج الفارغ الابتدائي (step=1، اسم فارغ، لا خيار) يجعل `hasRealSetupInput=false` فيُستدعى `formDrafts.discard("setup", null)` — **يمسح سجل المسودة المحفوظ** قبل أن تكتمل القراءة/قبل أن يظهر عرض الاستعادة. القيم تنجو لحظيًا في حالة العرض (draftOffer) والقبول يعيد الحفظ، لكن **إغلاق التبويب قبل القرار يفقد المسودة نهائيًا** (السجل مُسح من التخزين). الحارس `offerPending` لا يحمي النافذة لأنه لا يصبح true إلا بعد استقرار القراءة. الدليل المرجعي القائم: اختبار «persists a draft through the unified boundary…» في Setup.ui.test.tsx يبذر المسودة عبر الخدمة ثم يفتح الصفحة — لا يلتقط النافذة لأنه ينتظر العرض قبل أي إغلاق.

### 3.2 NF-002 — دورة استرجاع المحرر (قائمة على main — VERIFIED بالتتبع والاختبار المؤرخ)

`FinancialEventEditor.restoreDraft()` (سطر 477–501) يطبّق قيم العرض على الحالة ثم يستدعي `clearDraft()` — **يمسح السجل من التخزين** — ثم يجعل النموذج وسخًا (القيم المسترجعة تخالف لقطة useFormDirty الابتدائية) فيُعيد أثر الوسخ **حفظ المسودة** (`formDrafts.save`) بفارق مهام دقيقة: نافذة «مسح ثم إعادة حفظ» يفقد فيها الإغلاق المبكر المسودة، وفشل إعادة الحفظ يفقدها أيضًا. التعليق المؤرخ داخل الاختبار Guided (سطر 278–285) يوثق هذا السلوك القائم حرفيًا («التطبيق يمسح السجل ثم يعيد حفظه بفعل الوسخ — ننتظر استقرار إعادة الحفظ»). كما أن الاسترجاع نفسه يُصنَّف وسخًا (تعديلًا) بينما هو ترطيب للقيم المحفوظة سلفًا — السجل يحمل القيم نفسها أصلًا فلا مبرر لأي مسح.

## 4. حالة W2a واشتقاق المجموعة المسموحة وأسبقية الرفض (VERIFIED — توصيف 2026-10-15 مثبت بالاختبارات)

- **المجموعة المسموحة (35):** مفاتيح سجل `TRANSFER_ARRAY_FAMILY_ROLES` الـ31 (مكتمِل وقت الترجمة satisfiesً على مفاتيح اللقطة المصفوفية) + أربعة مفاتيح غير عائلية يصدرها المصدّر فعليًا (`profile`/`ownerProfile`/`preferences`/`inventoryActivation`) — مشتقة في الاختبار من جسد المصدّر لا من قائمة يدوية.
- **نظافة الجسد:** ذهبيا الزوج الحالي (current-pair + supplement) وتصدير حي فارغ ومزروع فوق المهايئين — لا مفتاح خارج المجموعة (شرط W2-2 الأول).
- **أسبقية الرفض الأولى السباعية (بالترتيب):** الصيغة ← الإصدار ← بنية exportedAt/data ← بصمة التكامل ← البنية الخام للعائلات ← تحقق العائلات (بعد الترحيل) ← العدادات. المفتاح المجهول الحاضر لا يغير أيًّا منها ولا يشارك في رسائلها (شرط W2-2 الثالث — مثبت بمصفوفة 7 أعطال).
- **السلوك الحالي:** مفتاح data علوي مجهول في ملف الزوج الحالي **مقبول** ويظهر في المعاينة ثم يُسقط عند الاستبدال بلا حفظ دوري؛ مفتاح counts مجهول مرفوض أصلًا (MED-002)؛ الإرث (24 زوجًا في RELEASED_LEGACY_EXPORT_PAIRS) مقبول كما هو.
- **بوابة W2b:** كانت `EXACT_PAYLOAD_REQUIRED` — الحمولة الدقيقة الآن معتمدة بالعقد §3.2 وتُسجل في الملحق قبل التنفيذ.

## 5. سطح الاستيراد (VERIFIED)

- `LocalTransferService.prepareImport` هو قمع التحقق الأوحد لملفات النسخ (بوابات المظروف/البصمة/البنية/التحقق/العدادات) — مستدعاه الواجهة: Settings.tsx (فحص النسخة الاحتياطية سطر 209 واستيراد ملف سطر 427)؛ الختم الأحادي S-2 لPreparedImport داخله وحده.
- `guidedOpeningImportService` مسار افتتاحي منفصل بصيغة ملف خاصة (عقد 21/G8.2) — **ليس ضمن نطاق W2b** (لا يستهلك prepareImport ولا زوج 38/30).
- `confirmImport` يبني نسخة احتياطية مُتحققة قبل الاستبدال (backup-first) — سلوك محفوظ.

## 6. مراجع مصدر حقيقة Micro Standard — الجرد الأولي (VERIFIED بالقياس المباشر)

| المرجع داخل المستودع | ما يقوله اليوم |
|---|---|
| `docs/architecture/SOURCE_OF_TRUTH.md` (صفوف لوحة الألوان الجارية وbutton-system) | المصدر الحاكم = `Documents/main micro-standard-v2/design-tokens.css` — موسوم «**مصدر خارج المستودع** (W4-A/F-040: قرار D-12 معلّق لتثبيت الموقع أو نسخة مرجعية بـSHA)»؛ الجسر الوحيد `styles/vf-tokens.css` |
| `docs/architecture/UI_AUX_ARCHITECTURE.md` | «Micro Standard v2 Integration» — Standard والعقود القائمة جسر التنفيذ الحالي |
| `docs/architecture/MIGRATION_STATUS.md` | Standard + vf-tokens.css = «الجسر الوحيد للتنفيذ الحالي» |
| `docs/architecture/CHANGE_PROTOCOL.md` + `ADRs/ADR-001` | Standard v2 أساس التكامل البصري المتحكم |
| `docs/operations/current-state.md` §8.2-4 | «D-12 (مصدر Standard)» ضمن القرارات المؤجلة |
| `REM-004.json` (owner_decision) + `FINAL-LOGIC-INVESTIGATION…2026-09-29.md` §59 | «D-12 مؤجل بقرار المالك ومسجل في §82 وREM-004 — محفوظ كما هو» |

**قياس المرجع الخارجي الحي (GitHub API قراءة فقط، 2026-10-16):**

| الحقل | القيمة |
|---|---|
| المستودع | `Qays7753/Documents` (عام؛ الفرع الافتراضي `main`) |
| رأس `main` الحي | `2396ff09fa52bb7872ae40c10adfc86ee7a0808d` |
| المسار | `micro-standard-v2/design-tokens.css` |
| Blob SHA | `de64f4fe0b2e5b75045e9e54d562c5aa6b85a756` |
| آخر التزام لامس للمسار | `12504582c0c19e2b0ea621a8caf45146410f12df` (2026-09-13T13:54:22Z — «chore: reconcile Micro Standard final copy after audit») |
| المحتوى | 7,636 بايت؛ sha256 `4abcfa3d1f9c1fb720a654e4fdd37fbfc44d5a94ad67286e7ac863eb7b692d10`؛ الترويسة تعلن «Micro Standard v2 — current approved Cloud Code basis» |
| حزمة العائلة الكاملة | `micro-standard-v2/` تحوي 31 ملفًا (منها design-tokens.css وbutton-system.md وMANIFEST.json وRELEASE.md — كل blob SHAs مسجلة في دليل الإغلاق) |

**فصل صريح:** هذا الجرد لمصدر **Micro Standard** القائم وحده (المرجع المعمول به اليوم عبر vf-tokens.css). مادة **New Design / Bold Modular V2** (مستودع التسليم `Micro-Bold-Modular-Design-Handoff-V1` واتجاه V2) **لم تُقرأ ولم تُستورد ولن تظهر** في هذه الموجة أو تقريرها (العقد §3.3).

## 7. حدود هذه الموجة (من العقد §3–§4 — للتثبيت قبل أول كتابة)

- **يُنفَّذ:** NF-001 جذريًا؛ NF-002 جذريًا؛ W2b للزوج الحالي وحده بالحمولة الحرفية؛ D-12/F-040 إغلاق أدلة؛ مصالحة Tracker كاملة.
- **لا يُمس:** New Design؛ UI البصري/CSS/tokens؛ Schema 38؛ Export 30؛ Legacy؛ Goldens؛ MANIFEST؛ الدلالات المالية والتاريخية؛ التنظيم البنيوي؛ D-13/F-055؛ QR-5/F-060؛ F-043؛ GOV-001؛ DEFERRED_UI؛ الأسطح المحمية P-01..P-05.
- **حدود الكتابة:** فرع واحد (`remediation/r11-nf001-nf002-w2b-d12-20261016`) من `cb3b9aaa`؛ PR واحد؛ لا دمج ولا force-push ولا حذف فروع/PRs ولا تنظيف.
- **حد الرجوع المخطط:** قبل دمج الـPR: إغلاقه دون دمج = لا أثر على main. كل التزام متسق وقابل للعكس منفردًا (الحدود الست للعقد §4).

```text
PHASE0_BASELINE_FROZEN — STATE_DRIFT_NONE
SINGLE_WRITER — BRANCH_FROM_VERIFIED_MAIN
NO_CODE_WRITTEN_YET
```
