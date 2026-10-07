# Micro — الخطة الجذرية الشاملة لإصلاح وإعادة هيكلة النظام

> **For agentic workers:** لا يبدأ أي تعديل كودي قبل إغلاق بوابة R0، ومراجعة هذه الخطة، وتحويل كل موجة إلى بطاقة تنفيذ وPR مستقل قابل للرجوع. استخدم `MUST`, `MUST NOT`, `STOP`, `VERIFY`, و`REPORT` عند تحويل الخطة إلى عقد تنفيذ لـZAI.

**Goal:** إصلاح كل عيب بنيوي أو تنظيمي أو متعلق بمصدر الحقيقة أو حدود الطبقات أو الاختبارات أو الحراس في Micro، وإعادة تنظيم النظام الحالي ليكون قابلًا للتغيير مستقبلًا دون إعادة فتح برنامج إعادة الهيكلة نفسه، مع عدم إخفاء أي تغيير مالي أو تاريخي أو Schema/Export/Import أو UI داخل نقل بنيوي.

**Architecture:** يبقى Micro **Modular Monolith محليًا**. تُنقل المسؤوليات إلى حدود واضحة حسب الملكية والقدرة، وتُضيق العقود قبل نقل المستهلكين، ويُفصل المعنى المالي عن العرض والتخزين. لا توجد عملية نقل جماعي أعمى؛ كل موجة تبدأ بخريطة مستهلكين واختبارات تكافؤ وتنتهي بدليل قبول وRollback boundary.

**Tech Stack:** pnpm 9، TypeScript، React/Vite، Vitest، IndexedDB وMemory adapter، Operations Control من JSON إلى Markdown/CSV/XLSX، GitHub PR/CI.

**Spec:** تقريري `FLASH-PASS-A-PRINCIPLES-REVIEW-2026-10-04.md` و`STRUCTURE-ARCHITECTURE-CODE-ORGANIZATION-SCAN-2026-10-04.md`، ومرجع Micro المعماري، وعقد الملكية التقنية 40، وقرارات المالك المثبتة في هذه الخطة.

**الحالة:** `PLAN_READY_FOR_OWNER_REVIEW — NO_CODE_EXECUTION_STARTED`

**خط البداية الحي الذي تم التحقق منه قبل كتابة الخطة:**

- المستودع: `Qays7753/Micro`
- `main`: `25594773a83ec5eb1e9dde5feaf1c808c0ff686f`
- PRs المفتوحة: لا توجد
- الفروع البعيدة: `main` و`docs/ux-ui-zed-handoff-20260921` فقط
- فرع UI محفوظ ولم يُحذف أو يُعدّل
- آخر CI معروف على رأس `main`: ناجح، Run `37529936832`
- يجب على R0 إعادة التحقق من هذه القيم حيًا قبل أي كتابة؛ لا تُعامل القيم السابقة كبديل عن التحقق الحي.

## المبادئ الإلزامية

1. **لا عيب حالي مؤجل:** أي خلل مثبت في الكود أو الوثائق السلطوية أو مصدر الحقيقة أو الحارس أو الاختبار يدخل موجة تنفيذ محددة، ولا يُغلق بعبارة عامة مثل `DEFER`.
2. **لا حفظ سلبي:** كل عنصر يصنف `PRESERVE_BY_DESIGN` يجب أن يملك بطاقة قرار فيها: سبب الإبقاء، المالك، المستهلكون، الاختبارات، حد النمو، محفز إعادة الفتح، وشرط الخروج. إذا كشف الفحص seam حقيقيًا، يُفصل.
3. **لا تغيير مخفي:** أي تغيير في المعنى المالي أو التقريب أو Rejection behavior أو التاريخ المحفوظ أو Schema أو Export/Import أو Legacy Acceptance أو صلاحيات UI يوقف الموجة ويُسجل كتغيير محمي مستقل.
4. **التوافق ليس ذريعة لإبقاء خلل:** نحافظ فقط على العقد التاريخي الصحيح أو الضروري. إذا ثبت أن عقدًا أو صيغة أو معادلة خاطئة، تُصلح الآن بإصدار أو Migration أو مسار تصحيح واضح، لا بتغيير صامت.
5. **عدم وجود مستخدمين لا يلغي الاختبارات التاريخية:** غياب المستخدمين يسهل التعديل، لكنه لا يبرر حذف Golden artifacts أو إعادة تفسير البيانات القديمة بلا عقد واضح.
6. **مصدر حقيقة واحد لكل مفهوم:** القوائم الحالية، الحسابات، الرسائل المنظمة، أنواع التخزين، وقرارات الملكية يجب أن يكون لكل منها مصدر نشط واحد. النسخ الموجودة عند حدود untrusted input أو التاريخ يجب أن تكون موسومة ومبررة وليست مصادرًا سرية.
7. **التقسيم حسب المسؤولية لا حسب عدد الأسطر:** لا File-per-function ولا Mass Barrel. التقسيم مطلوب عندما توجد مسؤوليات مستقلة أو حدود تغيير واضحة.
8. **لا تعديل مباشر على `main`:** Writer واحد على فرع تنفيذ طويل العمر، وPR أو Slice واضح لكل موجة، وCI بعد كل موجة، ودمج فقط بعد بوابة القبول.
9. **تحديث Operations Control من JSON المصدر:** لا تعديل يدوي للـViews المولدة. بعد كل موجة: تحديث JSON، تشغيل generator، ثم validator.
10. **UI structural فقط:** يمكن إصلاح حدود UI، View Models، استيرادات الأنواع، وحذف Shims بعد إثبات صفر المستهلكين. لا CSS أو DOM أو Tokens أو Navigation أو Visual UX داخل هذا البرنامج.
11. **Bundle ceiling:** سقف الحزمة هو `650,000 raw` و`155,300 gzip`. `155,300` هو سقف الحزمة الكاملة، وليس حجم ملف واحد. لا يجوز رفعه تلقائيًا.
12. **File-size bands:** القياس بعدد الأسطر غير الفارغة `nbLOC`: أقل من 400 `NORMAL`، 400–799 `WATCH`، 800–1,199 `SPLIT_CANDIDATE`، 1,200 فأكثر `SPLIT_NOW`. هذه إشارة مراجعة، لكن كل ملف في `SPLIT_NOW` يدخل بطاقة قرار وتنفيذ أو Preserve evidence كامل.
13. **لا إعادة تنفيذ لما هو موجود:** R0 يميز `EXISTING`, `ADOPT`, `REIMPLEMENT`, `REJECT`, و`NEEDS_REVIEW`. لا تُعاد موجات أو تقسيمات موجودة على `main`.

## التصنيفات النهائية لكل finding

كل finding من تقريري Flash وStructure يجب أن ينتهي بأحد التصنيفات التالية مع دليل:

| التصنيف | معناه في هذه الخطة |
|---|---|
| `FIX_NOW` | عيب حالي مثبت يدخل موجة محددة ولا يُؤجل |
| `FIX_NOW_AFTER_CHARACTERIZATION` | عيب حالي، لكن يجب تثبيت السلوك أولًا قبل الإصلاح |
| `PRESERVE_BY_DESIGN` | ليس عيبًا بعد التحقق، مع بطاقة إبقاء وحد نمو ومحفز إعادة فتح |
| `CLOSED_OUT_OF_SCOPE_NO_TRIGGER` | نظام أو منصة غير موجودة أصلًا، وليست عيبًا في النظام الحالي، مع Trigger واضح |
| `OWNER_DECISION_REQUIRED` | قرار محمي يغير المعنى المالي أو التاريخ أو عقد البيانات؛ لا يُخفى ولا يُحسم بتخمين |
| `BLOCKED` | دليل أو صلاحية مفقودة؛ يتوقف المسار ولا يتحول إلى ادعاء نجاح |

**القاعدة:** لا يجوز أن تبقى مشكلة حالية مثبتة في `DEFERRED` العام. البنود المستقبلية مثل Mobile وSync وBackend ليست عيوبًا مؤجلة؛ هي `CLOSED_OUT_OF_SCOPE_NO_TRIGGER` حتى يتحقق Trigger قابل للملاحظة ويصادق عليه المالك.

---

# خريطة التنفيذ والتبعيات

```text
R0 Baseline وRepair Cards
  ↓
R1 Truth/Governance/Documentation
  ↓
R2 Money/Formatting/Input/Date characterization
  ↓
R3 Storage capability contracts and adapters
  ↓
R4 Transfer/Schema/Export/Import/History
  ↓
R5 Application reader/writer and public doors
  ↓
R6 Large-file and responsibility restructuring
  ↓
R7 UI structural boundaries and shim removal
  ↓
R8 Guards, bundle surfaces, file-growth ratchets and CI
  ↓
R9 Test map, journeys, rollback rehearsal and evidence
  ↓
R10 Hostile final audit and closure on main
```

الموجات متسلسلة. يمكن تقسيم الموجة إلى Slices داخل الفرع نفسه، لكن لا تبدأ الموجة التالية قبل إغلاق بوابة الموجة الحالية أو تسجيل Blocker دقيق.

---

# R0 — تثبيت خط البداية وبطاقات الإصلاح

**نوع الموجة:** قراءة فقط، بلا Commit أو Push أو PR.

**الهدف:** منع تكرار ما تم، ومنع الاعتماد على تقارير أقدم من `main` الحالي.

**الملفات التي تُقرأ:**

- `AGENTS.md`
- `docs/operations/current-state.md`
- `docs/operations/current-state-log.md`
- `docs/operations/control/**/*.json`
- `docs/architecture/refactoring/*`
- `docs/contracts/40-technical-ownership-map-contract.md`
- `docs/architecture/ADRs/*`
- `scripts/check-*.mjs`
- `apps/prototype-web/scripts/check-bundle-budget.mjs`
- `scripts/file-size-ratchet-baseline.json`
- `src/domain/**`
- `apps/prototype-web/client/src/application/**`
- `apps/prototype-web/client/src/storage/local/**`
- `apps/prototype-web/client/src/presentation/**`
- `apps/prototype-web/client/src/pages/**`

**الإجراءات:**

- [ ] Fetch حي لـ`origin/main` وتسجيل SHA الكامل.
- [ ] التحقق من PRs والفروع والعمل المحلي والعمل غير المرفوع.
- [ ] إعادة قياس `localSchemaVersion` و`localExportVersion`.
- [ ] إعادة قياس عدد الملفات، bands، وBundle من `main` الحالي.
- [ ] مقارنة نتائج التقريرين مع الكود الحالي وإخراج `REPORT_FACT → CURRENT_MAIN_EVIDENCE`.
- [ ] تحديد ما هو موجود أصلًا وما يحتاج إعادة تنفيذ.
- [ ] إنشاء Repair Card لكل finding، وتحتوي: السبب الجذري، الملفات، المالك، المستهلكون، الاختبارات، الأثر، التصنيف، القبول، والرجوع.
- [ ] تسجيل كل بند من قائمة الملفات الكبيرة، وليس الأسماء العامة فقط.
- [ ] عدم إعادة تشغيل المسح الشامل القديم؛ R0 تحديث حالة فقط.

**القبول:**

```text
R0_COMPLETE — CURRENT_BASELINE_VERIFIED
NO_REPOSITORY_WRITES_PERFORMED
NO_UNOWNED_LOCAL_WORK
NO_BLIND_REEXECUTION
```

**التوقف:** أي اختلاف غير مفسر في SHA أو PR أو عمل محلي أو Schema/Export يوقف التنفيذ.

---

# R1 — مصدر الحقيقة والحوكمة والوثائق السلطوية

**الهدف:** إصلاح السبب الذي يجعل Agent أو مطورًا مستقبليًا يقرأ حالة متعارضة أو Registry قديمًا.

**Findings المغطاة:** F-01، F-02، F-03، F-04، F-05، PA-1..PA-4، PC-1..PC-4، PG-1..PG-6، RS-1..RS-5.

**ملفات متوقعة:**

- `docs/architecture/refactoring/README.md`
- `docs/architecture/refactoring/REFACTORING-CONTROL.md`
- `docs/architecture/refactoring/REFACTORING-EXECUTION-REPORT.md`
- `docs/architecture/refactoring/OWNERSHIP-AND-TRUTH-REGISTRY.md`
- `docs/architecture/refactoring/FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md`
- `docs/operations/current-state.md`
- `docs/operations/current-state-log.md`
- `docs/operations/control/*.json`
- `docs/operations/control/generated/*`
- `docs/00-document-index.md`
- `.github/workflows/ci.yml`
- `scripts/check-skill-references.mjs`
- `scripts/check-test-focus.mjs`
- `scripts/check-secrets.mjs`
- `scripts/check-module-boundaries.mjs`

**الإجراءات:**

- [ ] توحيد حالة البرنامج الحية دون حذف السجل التاريخي.
- [ ] تحديث SHA من Fetch حي لا من تقرير سابق.
- [ ] تصحيح اسم `g5Service` إلى `financialAnalysisService` حيث يصف الكود الحالي، مع إبقاء حقيقة type-only إذا أثبتها الرسم.
- [ ] إصلاح استيراد Owner Money إلى canonical path قبل أي حذف Shim.
- [ ] معالجة Header الذي يدعي Guard غير مطبق: إما تنفيذ الفحص الحقيقي أو تصحيح الوصف، وليس إبقاء التناقض.
- [ ] توحيد استثناء `fixtures` في الحراس مع اختبار سلبي وإيجابي.
- [ ] إزالة تكرار `pnpm lint` من CI دون حذف الفحص الفعلي.
- [ ] إضافة قاعدة Write-path authority لكل حقيقة.
- [ ] تسجيل Context وEvent وBroadcastChannel و`dataVersion` كـPublic Surfaces مملوكة.
- [ ] إضافة مصير Feature retirement: Preserve أو Migrate أو Tombstone.
- [ ] تثبيت مالك Locale/RTL/Formatting دون إدخال Locale APIs إلى Domain.
- [ ] فصل Principles Charter عن Governance Policy وعن Program Runbook وفق RS-1..RS-5.
- [ ] إضافة Precedence: Contracts ثم Principles ثم Active ADRs ثم Registries ثم Generated Views ثم Worklogs.
- [ ] إضافة owner وreview trigger وstaleness لكل Registry وGovernance artifact.
- [ ] إضافة metadata لكل Guard: `proves`, `does-not-prove`, و`change-class`.
- [ ] تحديث JSON المصدر ثم توليد Views وتشغيل validator.

**الاختبارات:**

```bash
node scripts/check-doc-index-coverage.mjs
python3 scripts/operations-control/validate.py
python3 scripts/operations-control/generate_tracker.py --check
pnpm lint
```

**القبول:** لا تعارض حي في الوثائق السلطوية، ولا Registry يصف اسمًا أو علاقة غير موجودة، ولا Guard يدعي أكثر مما يفحصه.

**الرجوع:** Revert وثائقي واحد، دون أثر كودي أو مالي.

---

# R2 — المال، التنسيق، الإدخال، التاريخ، والرسائل

**الهدف:** إصلاح حدود المعنى المالي دون تغيير النتائج بصمت.

**الملفات والمحاور:**

- `src/domain/shared/currency.ts`
- `src/domain/shared/numeric.ts`
- `src/domain/shared/businessTime.ts`
- `apps/prototype-web/client/src/application/input/englishNumeric.ts`
- `apps/prototype-web/client/src/presentation/formatters.ts`
- `src/domain/craft-order/policies.ts`
- `src/domain/delivery-contribution/**`
- `src/domain/loan/**`
- `src/domain/received-loan/**`
- `src/domain/recurring-margin/**`
- `apps/prototype-web/client/src/application/transfers/transferFamilyValidators.ts`
- `apps/prototype-web/client/src/application/suppliers/**`
- مواضع `isLocalDate` الثلاثة.

**الإجراءات:**

- [ ] جرد كل موضع Money representation وRounding وParsing وDisplay Formatting.
- [ ] تثبيت Kernel واحد لكل وظيفة وعدم نقل Business Rules إلى Formatter.
- [ ] كتابة Characterization tests قبل أي توحيد للتاريخ أو الرسائل.
- [ ] توحيد date-validity بعد مقارنة الحدود: invalid calendar date، timezone، null، historical imports.
- [ ] تصنيف رسائل المال إلى `Message-only` و`Persisted-note` و`Semantic-rule`.
- [ ] تحويل الرسائل الجديدة إلى Error/Event identity منظمة بدل وضع القاعدة المالية داخل نص.
- [ ] عدم إعادة كتابة موضعي Persisted Notes بصمت؛ إذا ثبت أن صيغة التخزين نفسها خاطئة، يُنشأ تصحيح versioned مع اختبار قراءة القديم والجديد.
- [ ] منع `Date.now` و`Math.random` وLocale APIs داخل Domain، واستخدام Injection المملوك.
- [ ] توثيق Supplier guard mirror كدفاع fail-closed، ثم فحص هل ما زال mirror ضروريًا. إذا كان غير ضروري يُزال؛ وإذا بقي فله coupling test.
- [ ] إعادة فحص كل حسابات `derivePeriodCogs` وWithdrawal Coverage وApplication sums. لا تُنقل إلى Domain إلا بدليل ملكية دلالية مستقل.

**التوقف المحمي:** أي اختلاف في ناتج مالي أو Rejection behavior أو نص تاريخي محفوظ ينتج `SEMANTIC_CHANGE_MANIFEST` ويمنع الدمج حتى يُحسم بشكل صريح.

**الاختبارات:**

```bash
pnpm --filter @micro/domain test -- --run
pnpm --filter @micro/prototype-web test -- --run
pnpm typecheck
pnpm lint
```

**القبول:** مصدر نشط واحد لكل قاعدة، تكافؤ نتائج قبل/بعد حيث لا يوجد قرار دلالي، وغياب أي تغيير صامت في التاريخ أو الرسائل المحفوظة.

**الرجوع:** Revert للـSlice، مع بقاء الكود القديم والاختبارات الذهبية.

---

# R3 — Storage Capability Extraction وإصلاح البوابة الكبيرة

**الهدف:** إزالة اعتماد المستهلكين غير الضروري على `PrototypeLocalStore` الكامل، ومعالجة التنفيذين IndexedDB وMemory من الداخل دون كسر parity.

**السطح الأساسي:**

- `apps/prototype-web/client/src/storage/local/types.ts`
- `apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.ts`
- `apps/prototype-web/client/src/storage/local/MemoryLocalStore.ts`
- `apps/prototype-web/client/src/storage/local/indexedDbMigrations.ts`
- `apps/prototype-web/client/src/storage/local/indexedDbSnapshot.ts`
- `apps/prototype-web/client/src/storage/local/*CommitGuard.ts`
- `apps/prototype-web/client/src/storage/local/capabilities/**`
- `apps/prototype-web/client/src/app/PrototypeServicesContext.tsx`
- `apps/prototype-web/client/src/storage/local/**/*.test.*`

**Capabilities التي يجب فحصها وإعطاؤها disposition:**

- Order Lifecycle
- Owner Money / Entitlement
- Financial Records
- Budgets / Planning
- Inventory / Materials
- Loans
- Recurring Planning
- Allocation / Short Cash حيث يثبت أنها قدرة مستقلة
- Backup / Snapshot / Transfer boundary

**الإجراءات:**

- [ ] بناء مصفوفة لكل Capability: methods، types، owner، consumers، adapter methods، tests، write guards، rollback.
- [ ] استخراج TypeScript narrow interfaces من الـPort الحالي، لا إنشاء عقود موازية غير مرتبطة به.
- [ ] تطبيق كل Capability على IndexedDB وMemory مع عقد اختبار مشترك.
- [ ] نقل الخدمات إلى النوع الضيق بدل `PrototypeLocalStore` الكامل.
- [ ] الحفاظ على 9 commit guards ومكان واحد لمعنى idempotency وCAS و`storage_stale`.
- [ ] تقسيم ملفات Adapter داخليًا حسب Store family أو capability عندما يقلل مساحة التغيير، مع إبقاء Adapter composition root واحدًا.
- [ ] حذف طريقة تخزين فقط بعد إثبات: صفر production consumers، صفر test/fixture consumers غير المقصودة، عدم وجود export/import dependency، ونجاح parity.
- [ ] إبقاء Facade القديم مؤقتًا فقط حتى يصبح عدد مستهلكيه صفرًا؛ بعد ذلك يُحذف في Slice مستقل.
- [ ] عدم تغيير Schema أو Migration أو Export/Import داخل Slice capability إلا إذا ظهر finding في R4 وببطاقة منفصلة.

**الاختبارات:**

```bash
pnpm --filter @micro/prototype-web test -- --run storage
pnpm --filter @micro/prototype-web test -- --run adapterConformance
pnpm typecheck
node scripts/check-entity-touchpoints.mjs
```

**القبول:** parity كامل بين IndexedDB وMemory، لا كتابة بلا Guard، لا مستهلك يعتمد على البوابة الكاملة دون سبب، ولا حذف قبل إثبات الصفر.

**الرجوع:** كل Capability تُرجع وحدها، والـFacade القديم يبقى صالحًا حتى نجاح النقل.

---

# R4 — Transfer وSchema وExport/Import والتاريخ

**الهدف:** إزالة التكرار النشط دون كسر قبول الملفات الصحيحة، ومعالجة العقد نفسه الآن إذا أثبت الفحص أنه غير صحيح.

**الملفات:**

- `apps/prototype-web/client/src/application/transfers/localTransferService.ts`
- `apps/prototype-web/client/src/application/transfers/transferEnvelope.ts`
- `apps/prototype-web/client/src/application/transfers/transferSnapshotValidation.ts`
- `apps/prototype-web/client/src/application/transfers/transferSnapshotMigrations.ts`
- `apps/prototype-web/client/src/application/transfers/transferFamilyValidators.ts`
- `apps/prototype-web/client/src/application/transfers/transferCompatibilityValues.ts`
- `apps/prototype-web/client/src/storage/local/types.ts`
- `docs/fixtures/export-goldens/**`
- `docs/contracts/39*` و`docs/contracts/40*`
- اختبارات النقل والترحيل والـgoldens.

**الإجراءات:**

- [ ] جرد كل قيمة قبول حالية وتاريخية وتصنيفها: Current Domain، Current Transfer boundary، Historical compatibility.
- [ ] ربط القيم الحالية بمصدر Domain runtime الصحيح أو بAdapter حدودي واحد.
- [ ] إبقاء القيم التاريخية في Registry واحد واضح فقط إذا كانت لازمة لقبول البيانات القديمة.
- [ ] حذف أي قائمة مكررة بلا وظيفة أو دمجها في مصدر واحد.
- [ ] إعادة تقييم `transferFamilyValidators.ts`: تقسيمه حسب family/version إذا أثبتت البطاقات أن ذلك يحسن الملكية، مع إبقاء facade واحد وقبول untrusted input صريحًا.
- [ ] عدم اعتبار قبول untrusted input مصدرًا منافسًا للـDomain؛ يجب أن يكون Boundary policy موسومًا ومختبرًا.
- [ ] مراجعة Schema 38 وExport 30 من الكود والgoldens والـMANIFEST.
- [ ] إذا كانت الصيغة الحالية صحيحة: تُحفظ مع تنظيف بنيتها وإثبات السبب.
- [ ] إذا ثبت أن الصيغة نفسها خاطئة: إنشاء إصدار جديد، Migration، backward import عند الإمكان، واختبارات old/new، دون حذف التاريخ بصمت.
- [ ] تنفيذ Round-trip وtamper rejection وbackup-before-replace وlegacy pair tests.

**الاختبارات:**

```bash
pnpm --filter @micro/prototype-web test -- --run transfers
pnpm --filter @micro/prototype-web test -- --run export
pnpm --filter @micro/prototype-web test -- --run migration
pnpm typecheck
node scripts/check-entity-touchpoints.mjs
```

**القبول:** لا مصدران نشطان للقيم الحالية، كل Legacy pair مصنف، كل Golden يطابق MANIFEST، والبيانات لا تتلف عند فشل Import.

**التوقف:** أي تغيير في `localSchemaVersion` أو `localExportVersion` أو Legacy Acceptance يحتاج Manifest محمي قبل الدمج، لكنه لا يُرحّل إلى برنامج آخر؛ يُعالج داخل مسار R4 بعد القرار الصريح.

**الرجوع:** Revert للـSlice مع إبقاء Import القديم عاملًا حتى تثبت النسخة الجديدة.

---

# R5 — Application boundaries وReader/Writer وPublic Doors

**الهدف:** إنهاء خلط القراءة والكتابة، وتحسين Feature discoverability دون Mass Barrel.

**الملفات والمحاور:**

- `apps/prototype-web/client/src/application/finance/projectFinancialService.ts`
- عائلات Financial Reads/Writes الناتجة أو الموجودة على `main`
- `apps/prototype-web/client/src/application/finance/*`
- `apps/prototype-web/client/src/application/owner-money/**`
- `apps/prototype-web/client/src/application/financial-records/**`
- `apps/prototype-web/client/src/application/budgets/**`
- `apps/prototype-web/client/src/application/transfers/**`
- `apps/prototype-web/client/src/application/**/index.ts` عند إنشاء Door ضيق
- `scripts/check-module-boundaries.mjs`
- `docs/contracts/40-technical-ownership-map-contract.md`

**الإجراءات:**

- [ ] Consumer inventory كامل قبل كل نقل.
- [ ] Characterization tests لكل read/write path.
- [ ] فصل Reader وWriter surfaces مع الحفاظ على الحسابات في مالكها الصحيح.
- [ ] تعريف كل Read Model: inputs، derivation owner، invalidation، stale behavior.
- [ ] إنشاء Application Public Door فقط عندما يوجد Consumer فعلي ويكون الباب أضيق من محتوى المجلد.
- [ ] نقل المستهلكين واحدًا تلو الآخر، وتسجيل أي Deep Import متبقٍ بسبب صحيح.
- [ ] إصلاح Owner Money إلى canonical home، ثم التحقق من عدم وجود مستهلكين لمسارات Finance shim.
- [ ] عدم نقل `derivePeriodCogs` أو Withdrawal Coverage إلى Domain لمجرد الفصل الاسمي.
- [ ] معالجة الاستيرادات العميقة، بما فيها `settlementInvariant`، بمصفوفة قرار: Barrel، نقل ملكية، أو استثناء مقاس ومؤقت. لا يبقى استثناء بلا إعادة فحص.
- [ ] إضافة Guard يمنع Door واسعًا أو Deep Import جديدًا، مع استثناءات محددة بمالك ومراجعة.

**القبول:** Reader لا يكتب، Writer لا يصبح مصدر قراءة منافسًا، كل Door له Consumer ومالك، ولا Deep Import جديد غير مصنف.

**الرجوع:** إعادة المستهلكين إلى paths السابقة، دون حذف internals قبل نجاح النقل.

---

# R6 — إصلاح كل الملفات الكبيرة وحدود المسؤوليات

**الهدف:** مراجعة كل ملف كبير حاليًا، وتقسيم كل ملف يثبت أنه يجمع مسؤوليات مستقلة، وعدم إغلاق أي ملف بعبارة `cohesive` غير مدعومة.

**قائمة الفحص الإلزامية:**

- `apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.ts`
- `apps/prototype-web/client/src/storage/local/MemoryLocalStore.ts`
- `apps/prototype-web/client/src/pages/OrderDetail.tsx`
- `apps/prototype-web/client/src/application/transfers/transferFamilyValidators.ts`
- `apps/prototype-web/client/src/pages/Finance.tsx`
- `apps/prototype-web/client/src/application/finance/projectFinancialService.ts`
- `apps/prototype-web/client/src/application/finance/integrityCheckService.ts`
- `apps/prototype-web/client/src/application/inventory/inventoryMaterialService.ts`
- `src/domain/craft-order/policies.ts`
- `apps/prototype-web/client/src/pages/FinancialEventEditor.tsx`
- كل ملف `SPLIT_CANDIDATE` و`WATCH` الذي زاد أو يملك أكثر من responsibility seam.
- `apps/prototype-web/client/src/storage/local/types.ts`
- `scripts/text-density-count.py` إذا بقي ضمن نطاق الكود القابل للتقسيم.

**لكل ملف:**

- [ ] تحديد المسؤوليات لا عدد الأسطر فقط.
- [ ] تحديد owner وconsumers وtest boundary وchange locality.
- [ ] تحديد seam حقيقي.
- [ ] استخراج أجزاء مستقلة عندما يثبت ذلك.
- [ ] إبقاء public facade ضيقًا عند الحاجة.
- [ ] نقل الاختبارات مع المسؤولية أو إنشاء contract suite.
- [ ] تحديث file register وgrowth bound في نفس Slice.
- [ ] حذف imports والتصديرات التي أصبحت ميتة.
- [ ] منع File-per-function أو تقسيم يؤدي إلى fan-out أسوأ.

**قاعدة الملفات المتماسكة:**

إذا أثبتت البطاقة أن ملفًا ما مسؤولية واحدة فعلًا، لا يُترك دون عمل؛ بل يُفحص داخليًا من ناحية:

- تقسيم التنفيذ إلى أجزاء داخلية ذات حدود واضحة.
- تثبيت owner وgrowth bound.
- إضافة tests على seam.
- إزالة أي helper ميت أو تكرار داخلي.
- إنشاء Trigger دقيق لإعادة فتح التقسيم.

إذا بقي الملف بعد ذلك، يكون `PRESERVE_BY_DESIGN` بقرار مثبت، وليس `DEFER`.

**القبول:** لا ملف `SPLIT_NOW` بلا Split حقيقي أو بطاقة إبقاء كاملة ومراجعة، ولا نمو صامت داخل Band.

**الرجوع:** Revert لعائلة الملف فقط، دون rollback جماعي.

---

# R7 — UI structural boundaries وCompatibility Shims

**الهدف:** جعل استبدال UI أو تطويره لاحقًا ممكنًا دون تحريك المال أو التخزين، دون الدخول في Visual redesign.

**الملفات والمحاور:**

- `apps/prototype-web/client/src/pages/**`
- `apps/prototype-web/client/src/components/**`
- `apps/prototype-web/client/src/application/**`
- `apps/prototype-web/client/src/presentation/**`
- شيمات `g5` و`finance` و`owner-money` والسجلات/الميزانيات.
- `scripts/check-module-boundaries.mjs`
- اختبارات الصفحات والـjourneys.

**الإجراءات:**

- [ ] جرد كل UI type/value import من storage وdomain وapplication.
- [ ] إنشاء Application Query Surfaces وView Models عند وجود seam مثبت.
- [ ] فصل `FinanceState` والقراءة عن صفحات UI الكبيرة عندما يثبت ذلك.
- [ ] إصلاح component→page type edge أو توثيقه كعقد مؤقت بمالك وشرط خروج.
- [ ] نقل المستهلكين من المسارات القديمة إلى canonical paths.
- [ ] لكل Shim: consumer inventory، سبب، بديل، اختبار، وشرط الصفر.
- [ ] حذف Shim إذا أصبح consumer count = 0، في Slice منفصل قابل للرجوع.
- [ ] استكمال Journey tests للصفحات ذات Smoke-only coverage: `CashReversalEditor`, `CashWalletEditor`, `G5DeclarationEditor`, `InventoryReversalEditor`, `ReceivedLoanDetail`, `SharePreview`، أو تسجيل سبب موثق إذا أثبت R0 أن الاسم/الحالة تغيرت.
- [ ] إبقاء CSS/DOM/Tokens/Navigation/Visual UX خارج هذه الموجة.

**القبول:** UI لا يملك Financial Truth ولا يقرأ storage runtime، وShims الضرورية فقط تبقى مع دليل، وغير الضرورية تُحذف الآن.

**الرجوع:** إعادة المستهلكين إلى Shim السابقة دون فقدان سلوك أو تغيير بصري.

---

# R8 — Bundle وFile Growth وGuard Charters وCI

**الهدف:** منع عودة المشاكل بعد انتهاء البرنامج، وقياس كل سطح إنتاجي ذي أثر.

**الملفات:**

- `apps/prototype-web/scripts/check-bundle-budget.mjs`
- `scripts/check-file-size-ratchet.mjs`
- `scripts/file-size-ratchet-baseline.json`
- `scripts/check-module-boundaries.mjs`
- `scripts/check-secrets.mjs`
- `scripts/check-test-focus.mjs`
- `scripts/check-doc-index-coverage.mjs`
- `scripts/check-skill-references.mjs`
- `.github/workflows/ci.yml`
- اختبارات كل Guard.

**الإجراءات:**

- [ ] قياس Entry chunks.
- [ ] قياس Lazy route chunks.
- [ ] قياس Service Worker precache.
- [ ] قياس إجمالي JavaScript وRaw/Gzip.
- [ ] إبقاء `650,000 raw / 155,300 gzip` كسقف البرنامج، دون رفع تلقائي.
- [ ] إذا كان سطحًا جديدًا لا يدخل السقف الحالي، تسجيله صراحةً بدل ادعاء أن الحارس يقيسه.
- [ ] تحويل File-size ratchet من منع التصعيد بين Bands فقط إلى منع نمو غير مبرر داخل Band، مع عدم تعديل baseline في نفس PR لإخفاء النمو.
- [ ] إضافة Guard metadata واختبارات negative لكل Guard.
- [ ] توسيع secrets coverage فقط إذا أثبت R0 فجوة فعلية، مع الحفاظ على عدم false positives في fixtures.
- [ ] توحيد fixtures scope بين الحراس.
- [ ] معالجة presentation→domain وcomponent→page وسياسة Application deep imports.
- [ ] إزالة تكرار CI دون حذف تغطية.
- [ ] توضيح الفرق بين ما يثبته الحارس وما لا يثبته.

**القبول:** لا Bundle blind spot غير مصنف، ولا نمو ملف أو حد جديد يمر بتعديل baseline صامت، وكل Guard له charter واختبار سلبي.

**الرجوع:** Revert للـGuard أو السياسة؛ لا سقف أعلى تلقائيًا.

---

# R9 — الاختبارات، الخرائط، والتراجع الفعلي

**الهدف:** تحويل كل قرار بنيوي إلى دليل قابل لإعادة الفحص.

**المخرجات:**

- Feature → Module → Contract → Test → Owner map
- Test map للملفات والمسؤوليات
- Storage parity matrix
- Transfer/Legacy/Golden matrix
- Boundary and Door matrix
- Guard proves/does-not-prove matrix
- Rollback rehearsal record
- Current-state reconciliation

**الإجراءات:**

- [ ] تشغيل الاختبارات الموجهة لكل Slice.
- [ ] تشغيل root tests وapp tests وtypecheck وlint وformat وguards بعد كل موجة، مع عدم إعادة تشغيل فحص ناجح لنفس SHA دون تغيير.
- [ ] تشغيل Journey tests للصفحات المحددة.
- [ ] تشغيل adapter parity على IndexedDB وMemory.
- [ ] تشغيل round-trip وlegacy goldens عند لمس Transfer.
- [ ] إضافة negative tests للحراس الجديدة.
- [ ] تنفيذ Rollback rehearsal على نسخة عمل منفصلة للتغييرات التي تكتب صيغة بيانات؛ لا يكفي وجود وثيقة.
- [ ] تحديث Operations Control من JSON ثم توليد Views.
- [ ] تحديث register والـownership map من الكود الحي.

**القبول:** كل Finding له Test أو Guard أو Contract أو Preserve evidence أو Trigger مصادق عليه، ولا توجد ادعاءات `VERIFIED` بلا أمر أو SHA أو رابط CI.

---

# R10 — التدقيق العدائي والإغلاق

**الهدف:** إثبات أن البرنامج أنهى العيوب الحالية، لا مجرد نقل الملفات.

**قائمة التدقيق:**

- [ ] كل F-01..F-14 مُغلق بتصنيف ودليل.
- [ ] كل PA-1..PA-4 وPC-1..PC-4 وPG-1..PG-6 وRS-1..RS-5 مثبت.
- [ ] كل ملف كبير حالي له Split أو Preserve evidence كامل.
- [ ] لا مصدر حقيقة نشط مكرر.
- [ ] لا Shim غير لازمة.
- [ ] لا Deep Import غير مبرر.
- [ ] لا Reader يكتب ولا Writer يصبح مصدر قراءة منافسًا.
- [ ] Storage capabilities متطابقة في IndexedDB وMemory.
- [ ] Schema/Export/Import/History لها عقد واضح، وأي تغيير لها versioned ومختبر.
- [ ] Bundle surfaces مقاسة، وRaw/Gzip تحت السقف أو بقرار محمي صريح.
- [ ] File-size guard يمنع النمو غير المبرر.
- [ ] كل Guard يذكر ما يثبته وما لا يثبته.
- [ ] Registry والوثائق المولدة تطابق الكود وSHA.
- [ ] لا PRs مفتوحة مرتبطة بالبرنامج.
- [ ] لا عمل محلي أو Remote غير مرفوع.
- [ ] فرع UI محفوظ دون تعديل.

**الحالة النهائية المطلوبة:**

```text
STRUCTURAL_REMEDIATION_COMPLETE — VERIFIED_ON_MAIN
NO_CURRENT_DEFECT_DEFERRED
NO_UNOWNED_STRUCTURAL_FINDINGS
NO_OPEN_PROGRAM_PRS
NO_HIDDEN_FINANCIAL_OR_HISTORICAL_CHANGE
SCHEMA_EXPORT_DECISION_EXPLICIT
NO_UNJUSTIFIED_SHIMS
NO_UNJUSTIFIED_LARGE_FILES
BUNDLE_AND_FILE_GROWTH_GUARDED
UI_VISUAL_REDESIGN_NOT_INCLUDED
FUTURE_TRACKS_HAVE_EXPLICIT_TRIGGERS
```

---

# مصفوفة ما يدخل الآن وما لا يدخل

| الموضوع | التصنيف في هذه الخطة | الإجراء |
|---|---|---|
| توثيق متعارض أو SHA قديم أو Registry غير صحيح | `FIX_NOW` | R1 |
| Owner Money عبر Shim قديم | `FIX_NOW` | R1 ثم R7 |
| تكرار lint أو اختلاف fixtures في الحراس | `FIX_NOW` | R1/R8 |
| Formatting/Locale/Date/Money messages | `FIX_NOW_AFTER_CHARACTERIZATION` | R2 |
| Persisted notes | `FIX_NOW_AFTER_CHARACTERIZATION` | R2، بلا تغيير صامت |
| Storage Port الكبير | `FIX_NOW` | R3 |
| IndexedDB/Memory adapters | `FIX_NOW` | R3، تقسيم داخلي أو حدود capabilities |
| Transfer current acceptance duplication | `FIX_NOW` | R4 |
| Historical compatibility values | `FIX_NOW` إذا كانت خاطئة/مكررة، وإلا `PRESERVE_BY_DESIGN` مع Registry واحد | R4 |
| Schema/Export 38/30 | `FIX_NOW` إذا ثبت خلله؛ وإلا `PRESERVE_BY_DESIGN` مع Contract evidence | R4 |
| Reader/Writer mixing | `FIX_NOW` | R5 |
| Application Public Doors | `FIX_NOW` | R5 |
| Deep imports والاستثناءات | `FIX_NOW` | R5 |
| كل ملفات `SPLIT_NOW` | `FIX_NOW` أو `PRESERVE_BY_DESIGN` بعد بطاقة كاملة، لا `DEFER` عام | R6 |
| UI structural boundaries وShims | `FIX_NOW` | R7 |
| CSS/DOM/Tokens/Visual UX | `CLOSED_OUT_OF_SCOPE_NO_TRIGGER` لهذا البرنامج | مسار UI مستقل عند فتحه |
| Bundle blind spots وgrowth guards | `FIX_NOW` | R8 |
| Tests/maps/rollback evidence | `FIX_NOW` | R9 |
| Mobile/Sync/Backend/API/Multi-currency بلا Trigger | `CLOSED_OUT_OF_SCOPE_NO_TRIGGER` | لا يُبنى الآن |
| Formal verification وEvent Sourcing وMicroservices بلا Trigger | `REJECT_AS_OVERENGINEERING` | لا يُضاف |

---

# عقد كل PR أو Slice

كل PR أو Slice يجب أن يحتوي في وصفه وتقريره:

```text
Wave ID
Repair Card IDs
Base full SHA
Source branch and target branch
Exact changed files
Consumer inventory
Root cause
Canonical source of truth
Evidence class per claim
Financial/schema/export/history/UI impact
Before/after file bands
Before/after raw/gzip when production build is affected
Commands and exit codes
Focused tests
Full required checks for the new SHA
CI URLs
Acceptance criteria
Rollback boundary
Remaining findings with exact disposition
Final status
```

**ممنوع:**

- دمج مباشر في `main`.
- نقل ملفات بلا Consumer inventory.
- حذف Shim أو Facade قبل إثبات صفر المستهلكين.
- رفع Bundle ceiling لمجرد تمرير CI.
- تعديل baseline لإخفاء نمو.
- تغيير مالي أو تاريخي أو Schema/Export داخل PR اسمه structural دون Manifest.
- اعتبار تقرير قديم أو فرع محذوف دليلًا على الحالة الحالية.

---

# معيار القرار الجذري

قبل إغلاق أي بطاقة، يجب أن تجيب الأدلة عن الأسئلة التالية:

1. هل أزلنا السبب الجذري أم غيّرنا مكانه؟
2. هل بقي مصدر حقيقة نشط ثانٍ؟
3. هل أصبح التغيير المستقبلي محليًا داخل حدود واضحة؟
4. هل يستطيع Agent أو مطور جديد اكتشاف المالك والمستهلك والاختبار؟
5. هل حُمي السلوك المالي والتاريخي، أو سُجل التغيير صراحةً؟
6. هل يمكن الرجوع إلى ما قبل الموجة دون rollback جماعي؟
7. هل يمنع Guard عودة المشكلة بدل تسجيلها فقط؟
8. هل حجم الملفات والحزمة تحت سيطرة حقيقية؟
9. هل أبقينا شيئًا لأنه صحيح ومبرر، أم لأنه أسهل من إصلاحه؟
10. هل يمكن بدء تطوير UI أو Feature جديدة دون إعادة فتح هذه المشكلة البنيوية؟

إذا كانت الإجابة على السؤال الأخير أو أي سؤال من 1 إلى 9 غير مثبتة، لا تُغلق البطاقة.

---

# القرار التشغيلي التالي

1. هذه الخطة هي **خطة تنفيذ** وليست تعديلًا للكود.
2. يجب مراجعتها كحزمة واحدة، ثم تُحوّل إلى عقد ZAI مختصر يشير إلى هذا الملف المثبت على GitHub.
3. يبدأ ZAI بـR0 فقط، ثم يكمل R1→R10 بالتتابع على فرع مستقل.
4. عند Protected decision حقيقي، يتوقف فقط عند القرار المحدد، لا عند كل خطوة روتينية.
5. بعد كل موجة: اختبارات، CI، تقرير، تحديث Tracker، ثم الانتقال.
6. لا إعلان إغلاق حتى يكون كل عيب حالي مثبتًا إما `FIXED` أو `PRESERVE_BY_DESIGN` بدليل كامل، ولا يبقى `DEFERRED` عام.

```text
PLAN_STATUS: COMPLETE_FOR_OWNER_REVIEW
CURRENT_DEFECT_POLICY: NO_CURRENT_DEFECT_DEFERRED
STRUCTURAL_EXECUTION: NOT_STARTED
NEXT_STEP: OWNER_ACCEPTANCE_OF_THIS_PLAN_THEN_ZAI_EXECUTION-CONTRACT
NO_CODE_OR_GITHUB_WRITES_PERFORMED_BY_THIS_PLAN
```


---

# Appendix A — مصفوفة التتبع الصريحة لمعيار النجاح

> أُضيف هذا الملحق بعد تدقيق آلي وحرفي للخطة مقابل التقريرين. وجود البند هنا لا يعني أنه نُفذ؛ يعني أن له مكانًا صريحًا في خطة التنفيذ، وتصنيفًا، ومخرج قبول.

## A.1 نتائج Structure Scan

| ID | التصنيف في الخطة | الموجة | مخرج القبول |
|---|---|---|---|
| F-01 | `FIX_NOW` | R1 | وثائق المرحلة الحية متطابقة، والتاريخ القديم محفوظ |
| F-02 | `FIX_NOW` | R1 | SHA مأخوذ من Fetch حي ويطابق `main` وقت التحديث |
| F-03 | `FIX_NOW` | R1 | Registry يذكر `financialAnalysisService` والعلاقة الحية الصحيحة |
| F-04 | `FIX_NOW` | R1 | لا production consumer يستخدم Finance compatibility shim داخليًا |
| F-05a | `FIX_NOW` | R1/R8 | Header الحارس يطابق الفحص الفعلي أو يُنفذ الفحص المعلن |
| F-05b | `FIX_NOW` | R1/R8 | استثناء `fixtures` موحد ومختبر بين الحراس |
| F-05c | `FIX_NOW` | R1 | CI يحتوي فحص lint فعليًا مرة واحدة دون فقد التغطية |
| F-06 | `FIX_NOW` | R5 | Application doors ضيقة، لكل منها Consumer فعلي، ولا Mass Barrel |
| F-07 | `FIX_NOW_AFTER_CHARACTERIZATION` | R2/R5 | قرار Formatting Kernel مثبت، ولا نقل يكسر الرسائل المعروفة |
| F-08 | `FIX_NOW_AFTER_CHARACTERIZATION` | R5 | Reader وWriter منفصلان ميكانيكيًا مع Contract 40 وParity |
| F-09 | `FIX_NOW` | R7 | UI لا يقرأ Storage runtime، وView Models موجودة حيث يثبت seam |
| F-10 | `FIX_NOW` | R8 | File-size ratchet يمنع النمو غير المبرر داخل Band، لا Baseline drift |
| F-11 | `FIX_NOW` | R8 | Entry وLazy وPWA precache مقاسة أو مصنفة بحدود صريحة |
| F-12 | `FIX_NOW` | R7/R9 | الصفحات الست لها Journey evidence أو قرار نطاق صريح لكل صفحة |
| F-13 | `FIX_NOW_AFTER_CHARACTERIZATION` | R2/R4/R7 | كل تكرار مصنف: إزالة، توحيد، أو Preserve evidence |
| F-13c | `FIX_NOW_AFTER_CHARACTERIZATION` | R2 | مواضع Money messages، ومنها Persisted Notes، لها قرار نصي صريح |
| F-14 | `FIX_NOW` | R1/R8/R9 | فجوات الحراس لها Guard أو Charter أو تصنيف واضح |
| F-15 | `PRESERVE_BY_DESIGN` | R3/R4/R9 | سلسلة الحماية المالية والتاريخية لها Preserve cards واختبارات |

## A.2 تعارضات Structure والروابط المحمية

| ID | الموجة | الإجراء |
|---|---|---|
| CON-1 | R1 | توحيد مرحلة البرنامج الحية مع إبقاء كل سجل تاريخي كما هو |
| CON-2 | R1 | تحديث SHA الحي، مع إبقاء قاعدة Fetch-first |
| CON-3 | R1 | تصحيح دورة الاسم القديمة مع إبقاء حقيقة type-only إن ثبتت |
| CON-4 | R1 | إبقاء Banner `SUPERSEDED` وتحديث أي Metadata حي من المصدر الصحيح |
| STR-106 | R7 | مراجعة UI→Domain value imports، وإزالة أو تثبيت الاستثناءات فقط بدليل |
| STR-203 | R2/R5 | قرار Formatting Kernel ثم تطبيقه ميكانيكيًا |
| STR-204b | R5/R6 | فحص type-only cycle وعدم تحويله إلى runtime cycle |
| STR-204c | R7 | استخراج Page-owned View Model عند ثبوت seam |
| STR-301 | R3 | معالجة 131-method Storage Port عبر Capabilities، لا حذفًا عشوائيًا *(تصحيح مؤرخ 2026-10-07 — R1/TG-01: المنفذ الحي **130** طريقة بعد إزالة STR-618 لـ`getActualTimeRecord` (2026-10-04، قبل كتابة هذه الخطة)؛ القياس: عدّ أعضاء `PrototypeLocalStore` في `storage/local/types.ts` — انظر تقرير R1) * |
| STR-302 | R2/R5 | فحص ملكية القواعد المالية دون نقلها بصمت إلى Domain |
| STR-305 | R7 | نقل UI من Persistence record types إلى View Models عند ثبوت الحاجة |
| STR-307 | R3/R8 | إبقاء type-only Storage cycle أو إزالته فقط بعد إثبات عدم الحاجة |
| FIN-002 | R7 | إزالة lazy UI service construction غير الضروري أو توثيقه بحد واضح |
| AV-04 | R4 | إبقاء missing-integrity rejection محروسًا في Import |
| AV-05 | R4 | إبقاء Money safety validation في Transfer boundary مع Drift/Golden evidence |
| EXE-014 | R3/R4 | إثبات verified backup قبل `replaceSnapshot` وعدم السماح بالاستبدال الفاشل |

## A.3 الأسطح التي يجب أن تظهر في بطاقات الموجات

هذه ليست عناوين عامة؛ يجب أن تظهر بالاسم في R0 وRepair Cards وR10:

- `PrototypeLocalStore` ذو 131 طريقة. *(تصحيح مؤرخ 2026-10-07 — R1/TG-01: الحي **130** طريقة (STR-618)؛ يجب على بطاقة R3 أن تجرد المنفذ الحي لا رقم هذه السطر.)*
- `IndexedDbLocalStore` و`MemoryLocalStore` وتكافؤهما.
- تسعة Commit Guards.
- Migrations و`storage_stale` وBackup قبل `replaceSnapshot`.
- `transferFamilyValidators.ts` وقيم Current/Historical.
- `localTransferService.ts` وEnvelope وCounters وSHA-256.
- Goldens و`MANIFEST` وكل Legacy pairs الواقعية.
- `MoneyMinor` وJOD و2dp وRounding وParsing وDisplay Formatting.
- `derivePeriodCogs` وWithdrawal Coverage وApplication sums.
- `presentation/formatters.ts` و`application/input/englishNumeric.ts`.
- `projectFinancialService.ts` Reader/Writer surfaces.
- `settlementInvariant` وكل Deep Import مصنف.
- Compatibility Shims التسع/الثماني التي تظهرها الحالة الحية، مع Consumer count لكل واحدة.
- `OrderDetail.tsx` و`Finance.tsx` و`FinancialEventEditor.tsx` وباقي صفحات `SPLIT_NOW`.
- `src/domain/craft-order/policies.ts` كـDomain kernel حساس.
- `index.css` و`text-density-count.py` إذا بقي أي منهما داخل نطاق الحارس.
- Application Public Doors وDeep Imports وRoute Knowledge.
- Context وBroadcastChannel و`dataVersion` وكل Runtime channel.

**شرط Storage إضافي:** R0 يجب أن يستخرج **كل مجموعات Capability المسجلة في Registry، وعددها الحي، لا أن يفترض القائمة السابقة**. R3 يجب أن يعطي كل مجموعة disposition: `EXTRACT_NOW`, `REVIEW_AND_SPLIT`, أو `PRESERVE_BY_DESIGN` مع سبب ومالك واختبار وشرط خروج.

## A.4 إضافات Flash المطلوبة في الخطة

### المبادئ PA-1 إلى PA-4

| ID | الموجة | معيار النجاح |
|---|---|---|
| PA-1 | R1/R3/R5 | لكل حقيقة Write Path واحد معروف؛ external/sync لا يكتب حوله |
| PA-2 | R1/R8 | كل Context/Event/BroadcastChannel قناة مملوكة بعقد وAdmission |
| PA-3 | R1/R4 | Retiring Feature لها Preserve/Migrate/Tombstone للبيانات وExport |
| PA-4 | R1/R2/R7 | المعنى المالي مستقل عن Locale، ومالك واحد للغة والأرقام والتقويم وRTL |

### التوضيحات PC-1 إلى PC-4

| ID | الموجة | معيار النجاح |
|---|---|---|
| PC-1 | R1/R2/R9 | Domain لا يقرأ Clock/Random/Locale ambient، بما في ذلك الاستخدام غير المباشر المثبت |
| PC-2 | R1/R10 | كل Trigger شرط ملاحظ ومسجل، والمالك وحده يصادق على تحققه |
| PC-3 | R5/R8 | كل Public Door يعرض ما يحتاجه المستهلك، وتوسيع الباب يظهر في مراجعة |
| PC-4 | R2/R5/R9 | كل Read Model يذكر Inputs وDerivation وInvalidation، ولا يصبح Authority جديدة |

### آليات الحوكمة PG-1 إلى PG-6

| ID | الموجة | معيار النجاح |
|---|---|---|
| PG-1 | R1/R9 | Registry له تاريخ reconciliation ويُطابق الكود أو يذكر اتجاه التصحيح |
| PG-2 | R1/R8 | كل Guard يذكر ما يثبته وما لا يثبته وتصنيف تغييره |
| PG-3 | R1 | Decision-rights map وStanding Decisions log قابلان للاستشهاد |
| PG-4 | R1 | Precedence بين Contracts/Principles/ADRs/Registries/Views/Worklogs مثبت |
| PG-5 | R1/R10 | كل Governance artifact له Owner وReview Trigger وStaleness status |
| PG-6 | R4/R9 | عند كتابة صيغة جديدة يوجد Data Rollback procedure وRehearsal على نسخة |

### إعادة تشكيل المرجع RS-1 إلى RS-5

| ID | التنفيذ |
|---|---|
| RS-1 | دمج Reversibility وData Rollback في مبدأ واحد، ونقل التفاصيل الإجرائية إلى Runbook |
| RS-2 | دمج Historical Integrity وAppend-only Corrections مع توضيح حد التصحيح |
| RS-3 | نقل Size Bands وCompletion Vocabulary إلى Policy/Runbook، مع إبقاء قاعدة المراجعة في المبادئ |
| RS-4 | نقل قائمة Guards المتغيرة إلى CI/Runbook، وتثبيت Metadata الدائم في الحوكمة |
| RS-5 | نقل Freeze/Wave/Handoff إلى Program Plan، لا إلى المبادئ الدائمة |

## A.5 تعارضات Flash C1 إلى C5

| ID | سبب المشكلة | الموجة التي تغلقها |
|---|---|---|
| C1 | تكرار P14/P18 في Rollback | R1 وR9 عبر RS-1 |
| C2 | حد غير واضح بين Data-at-rest وAppend-only Correction | R1/R2/R4 عبر RS-2 |
| C3 | Freeze الخاص بالبرنامج مختلط مع Governance الدائم | R1 عبر RS-5 |
| C4 | Port/Second implementation يمكن أن يتوسع بلا Trigger | R1/R3 عبر PC-2 وTrigger Matrix |
| C5 | منع إضعاف Guard بلا مسار تصحيح False Positive | R1/R8 عبر PG-2 |

## A.6 عدسات Flash L-A إلى L-F

| ID | المضمون | الموجة |
|---|---|---|
| L-A | استدامة الحوكمة وتقادم السجلات | R1/R9/R10 |
| L-B | حقوق القرار ومنع إعادة السؤال | R1 |
| L-C | Retention/Deletion/Archival ونمو البيانات المحلي | R1: Trigger فقط، لا تنفيذ بلا Trigger |
| L-D | قابلية إعادة بناء النتيجة المالية من Inputs دائمة | R2/R9، عبر Q-h ودليل فعلي |
| L-E | نطاق Security/Trust للبيانات المحلية | R1: scope وTrigger، لا منصة أمنية بلا Trigger |
| L-F | معرفة الوكيل وترتيب أولوية الوثائق | R1/R10 |

## A.7 Change Vectors V1 إلى V12

| ID | الموجة أو التصنيف |
|---|---|
| V1 Partial refunds | R2/R4؛ أي تغيير تاريخي أو Aggregate يملك Manifest |
| V2 Money contract | Preserve الآن؛ أي تغيير لاحق Owner Decision ومسار Schema/semantic مستقل |
| V3 UI overhaul | R7 structural فقط؛ Visual redesign في UI Track مستقل |
| V4 سؤال مكان Field/Owner | R1/R5 عبر Registry وDoors وFeature map |
| V5 Retire Feature | R1/R4 عبر PA-3 وPreserve/Migrate/Tombstone |
| V6 تعارض ADR أو Registry | R1 عبر PG-1 وPG-4 |
| V7 Runtime performance regression | R8 Trigger فقط حتى يظهر Regression مقاس |
| V8 Cross-module reactive update | R1/R8 عبر PA-2 وعقد Runtime channels |
| V9 Guard false positive | R1/R8 عبر PG-2 ومسار Correct لا Weaken صامت |
| V10 Multi-workspace/Auth/Sync | `CLOSED_OUT_OF_SCOPE_NO_TRIGGER` حتى Trigger مصادق |
| V11 Error shape change | R2 عبر Error identity وCharacterization |
| V12 Code generator | `CLOSED_OUT_OF_SCOPE_NO_TRIGGER` حتى أول Generator فعلي |

## A.8 أسئلة التحقق Q-a إلى Q-j

تُطرح الأسئلة نفسها في R0، ويجب أن يجيب عنها R9/R10 بأمر أو ملف أو رابط CI، لا بجملة وصفية:

| السؤال | دليل الإغلاق المطلوب |
|---|---|
| Q-a Registry vs live code | عينة owners/consumers/calculation locations متطابقة |
| Q-b Guard claim vs assertion | Guard charter وnegative test |
| Q-c Domain ambient clock/random/locale | scan/lint/type evidence، مع توضيح أي ambient مسموح |
| Q-d Read Model derivation/invalidation | Read Model registry وtests |
| Q-e Non-import runtime channels | Runtime channel inventory مع Owner/Admission/Contract |
| Q-f Rounding/Parsing/Formatting count | single-source inventory وmoney-layer tests |
| Q-g Export/Import versions | Golden/round-trip/migration matrix لكل نسخة واقعية |
| Q-h Financial reconstructability | durable-input reconstruction evidence بدرجة محددة |
| Q-i Rollback rehearsal | سجل تجربة على نسخة، أو `NOT_APPLICABLE` بسبب لا يكتب صيغة |
| Q-j Superseded docs and CI wiring | doc-index/Operations Control/CI evidence |

## A.9 المسارات المستقبلية والرفض الصريح للـOverengineering

| الفئة | التصنيف |
|---|---|
| Sync/Multi-device | `CLOSED_OUT_OF_SCOPE_NO_TRIGGER`: جهاز ثانٍ حقيقي مع استخدام ملتزم |
| Second platform | `CLOSED_OUT_OF_SCOPE_NO_TRIGGER`: طلب منصة ملتزم مع استخدام مسمى |
| Retention/Deletion/Archival | Trigger: أول بيانات مستخدم خارجي أو إشارة تنظيمية |
| Security threat model للتوزيع العام | Trigger: توزيع خارج أجهزة المالك المسيطر عليها |
| Runtime performance budgets | Trigger: Regression مقاس يؤثر على التفاعل |
| Backend/API/OpenAPI | Trigger: مستهلك خارجي حقيقي |
| Python/Analytics | Trigger: حاجة تحليل لا تعمل داخل العميل |
| Code generator policy | Trigger: أول Generator فعلي |
| Formal verification/model checking | `REJECT_AS_OVERENGINEERING` |
| Multi-currency abstraction | `REJECT_AS_OVERENGINEERING` حتى Trigger تجاري صريح |
| Event Sourcing retrofit | `REJECT_AS_OVERENGINEERING` |
| Consumer-driven contract infrastructure داخليًا | `REJECT_AS_OVERENGINEERING` |
| Architecture-fitness dashboards/Telemetry platform | `REJECT_AS_OVERENGINEERING` |
| Team-topology rules وADR لكل PR روتيني | `REJECT_AS_OVERENGINEERING` |

## A.10 مراجعة اكتمال الملحق

- [x] كل F-01..F-15 له تصنيف وموجة ومعيار قبول.
- [x] كل CON-1..CON-4 له إصلاح أو تصنيف صريح.
- [x] كل STR/FIN/AV/EXE load-bearing identifier المذكور في التقرير له مسار في الخطة.
- [x] PA-1..PA-4 وPC-1..PC-4 وPG-1..PG-6 موجودة بالاسم.
- [x] RS-1..RS-5 موجودة بالاسم.
- [x] C1..C5 وL-A..L-F وV1..V12 موجودة بالاسم.
- [x] Q-a..Q-j تحولت إلى Acceptance evidence.
- [x] Storage وTransfer وSchema/Export/History وMoney kernels وUI boundaries وGuards وCI وDocs وTests كلها ممثلة.
- [x] `155,300 gzip` و`650,000 raw` وFile-size bands مثبتة دون خلط بين Bundle وFile.
- [x] لا يوجد عيب حالي مصنف `DEFERRED` عامًا؛ ما بقي خارج النطاق له Trigger أو رفض صريح.

**نتيجة تدقيق التغطية:**

```text
TRACEABILITY_AUDIT: COMPLETE
REPORT_FINDINGS: EXPLICITLY_MAPPED
PRINCIPLES_AND_GOVERNANCE: EXPLICITLY_MAPPED
ACCEPTANCE_QUESTIONS: EXPLICITLY_MAPPED
PLAN_IS_EXECUTION_READY_FOR_OWNER_APPROVAL: YES
CODE_EXECUTION: NOT_STARTED
```

| L-G | Python/Analytics واحتياج التحليل غير القابل للتنفيذ داخل العميل | R1 لتثبيت Trigger، ثم مسار مستقل فقط عند تحقق الحاجة |
