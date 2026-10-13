# Micro R11 — Owner Decision Package
## حزمة قرارات المالك المبنية على استشارة Cloud Code

**التاريخ:** 2026-10-13
**الحالة:** `OWNER_DECISIONS_COMPLETE — S0_AND_W1A_SCOPE_READY; NO_IMPLEMENTATION_STARTED`
**المرجع:** تقرير R11 Wave 0 المقبول والمُدمج على `main`
**Main بعد دمج Wave 0:** `5ef4ce08841bcd4ff7c5fb185a0fe2eeef6852fd`
**الهدف:** إغلاق جميع قرارات R11 بدقة قبل بدء `S0` و`W1a`.

> هذه الحزمة لا تمنح صلاحية تنفيذ. لا يبدأ S0 أو أي موجة كودية إلا بعد اعتماد المالك للنطاق والقرارات والـpayloads المطلوبة.

---

## 1. قاعدة الاعتماد

كل قرار يجب أن ينتهي بواحد من الآتي:

- إصلاح جذري في موجة محددة؛
- سياسة مالك دقيقة مع Guard/Monitor؛
- Preserve مبرهن مع تسديد evidence debt؛
- Finding توثيقي مغلق بإضافة append-only؛
- أو إثبات أنه غير صحيح/out of scope.

لا يوجد `DEFER` عام. وأي شرط سابق للتنفيذ هو **بوابة محددة** لها دليل وقبول وrollback، وليس تأجيلًا مفتوحًا.

## 2. الثوابت غير القابلة للتغيير

- `localSchemaVersion = 38`.
- `localExportVersion = 30`.
- توافق 24 زوجًا Legacy.
- توافق Current 38/30.
- 27 Golden files وMANIFEST ما لم يعتمد المالك تغييرًا منفصلًا.
- 130 طريقة في `PrototypeLocalStore` وتكافؤ IndexedDB/Memory.
- Transaction atomicity و`storage_stale` identity.
- Rejection precedence وmulti-fault behavior.
- PWA/build identity D1.
- Bundle raw `650000` وgzip `155300`.
- Lint ceiling `37` وعدم رفعه.
- عدم تغيير Arabic copy أو RTL أو visual UI ضمن هذه الحزمة.
- لا barrels ولا bulk moves ولا structural refactoring جماعي.
- لا إعادة فتح R2 D11/D13 أو R10-B المغلقة دون Regression مثبت.
- لا تعديل صامت على التاريخ أو Matrix قديم.

---

# 3. القرارات المقترحة

## 3.0 سجل الاعتمادات الفعلية

### OD-GUARD — معتمد

- **قرار المالك:** اعتماد الخيار A.
- **النطاق المعتمد:** D-01 وD-03 وD-04 وD-05.
- **Baselines المعتمدة:** 19 type-only UI→Storage edges، و63 read-like Application files، و35 lint warnings، مع بقاء lint ceiling = 37.
- **حدود التنفيذ:** Guards وfixtures وtests وregistration وevidence فقط؛ لا runtime behavior change، لا نقل ملفات، لا barrels، لا تغيير مالي أو Schema/Export/Import، ولا رفع أي سقف.
- **المنفذ:** ZAI فقط؛ Manus لا يعدّل كود التطبيق.
- **ترتيب التنفيذ:** D-01 وD-04 وD-05 في `W1a-1`، وD-03 في `W1a-2`، مع commit وrollback مستقلين لكل Guard.
- **حالة القرار:** `OWNER_APPROVED — READY_FOR_W1A_SCOPE_GATE`.
- **شرط الفتح:** لا يبدأ التنفيذ قبل إغلاق Owner Decision Package، اعتماد S0 إن كان ضمن النطاق، وإنشاء PR/فرع تنفيذي مستقل ببوابات واختبارات واضحة.

### OD-MONEY — معتمد

- **قرار المالك:** اعتماد الخيار A.
- **النطاق المعتمد:** إبقاء `MoneyMinor = number` حاليًا، مع ADR يثبت السياسة وGuard يراقب casts وunit-mixing حول عائلة `*Minor` خارج kernels/formatter.
- **حماية مستمرة:** integer kernels، sole persisted formatter، frozen writer surface، وmoney-layer guard.
- **W5:** غير مفتوحة حاليًا؛ لا تفتح إلا عند Trigger موثق: unit-confusion defect، أو multi-currency/وحدة مالية ثانية، أو raw number يصل إلى persisted money writer، أو دليل mixing لا تمنعه الحواجز الحالية.
- **الممنوع:** partial branding، branding شامل دون Trigger، runtime/persisted representation change، Schema/Export/Import change، أو casts لإسكات TypeScript.
- **الموجة:** Monitor في `W1a-2`؛ W5 تبقى عقدًا مشروطًا غير مفتوح.
- **حالة القرار:** `OWNER_APPROVED — OPTION_A — W5_TRIGGER_GATED`.

## OD-GUARD — اعتماد حزمة Guards الأربعة

**التوصية:** اعتماد الخيار A.

**يشمل:**

1. D-01 / `R10A-F-006`: ratchet لـUI→Storage type-only edges، baseline الكامل 19، مع إبقاء مجموعة 17 القديمة معلّمة للمقارنة التاريخية.
2. D-03 / `R10A-F-014`: ربط إعفاء `??` بالـAST لا بالنص الموجود في السطر.
3. D-04 / `R10A-F-019`: Guard للـread-like corpus كاملًا، مع membership ratchet وproperty check، baseline 63.
4. D-05 / `R10A-F-026`: tripwire دقيق لعدد التحذيرات الحالي 35، مع بقاء السقف 37 وعدم رفعه.

**الموجة:** `W1a-1` لـD-01/D-04/D-05، و`W1a-2` لـD-03.

**المسموح:** Guards، fixtures، tests، registration، evidence، docs.

**الممنوع:** runtime changes، نقل ملفات، barrels، تغيير ceilings، نقل Guards القديمة إلى helper جديد في نفس الموجة.

**القبول:** كل Guard يمر على baseline ويفشل على fixture الضعف، مع rollback مستقل لكل Guard.

**حالة المالك:** `OWNER_APPROVED — OPTION_A`.

---

## OD-MONEY — سياسة MoneyMinor مع Monitor

**التوصية:** إبقاء السياسة الحالية `MoneyMinor = number` مع Guard للـcasts/unit mixing.

**لا نبدأ Branding الآن.** لا يوجد دليل حالي على unit-confusion defect، والـbranding الشامل سيطال عائلة واسعة. Branding الجزئي لـ`MoneyMinor` وحده مرفوض لأنه غير متسق.

**الإغلاق المقترح:**

- ADR يثبت السياسة عمدًا.
- Guard `G-D02` يراقب assertions/casts غير المسموحة حول عائلة `*Minor` خارج kernels/formatter.
- الإبقاء على integer kernels، sole persisted formatter، frozen writer surface، وmoney-layer guard.
- تسجيل baseline ومنهج العد.

**Trigger يفتح W5 مستقبلًا:**

- عيب مثبت كان سيُمنع بالـbrand؛
- دخول multi-currency أو وحدة مالية ثانية؛
- وصول raw number إلى persisted money writer؛
- أو دليل unit mixing حقيقي.

**الموجة:** `W1a-2` للـMonitor؛ `W5` غير مفتوحة.

**حالة المالك:** `OWNER_APPROVED — OPTION_A`.

---

## OD-10 — Application internal deep-import policy

### سجل اعتماد المالك

- **قرار المالك:** اعتماد الخيار A باعتباره الخيار الأفضل للنظام.
- **النطاق المعتمد:** leaf/shared infrastructure exemptions ضيقة ومثبتة فقط لـ`time`, `formatting`, `identity`, و`resultCodes.ts` بعد تحقق invariants؛ house-pair ratchet لباقي edges؛ فصل value/type caps؛ وفحص value cycles على مستوى house.
- **الأدلة المعتمدة:** listing كامل للـ128 edge، baseline 80 value و48 type، وتوثيق الحافتين اللتين نمتا في R10-B.
- **الممنوع:** barrels، mass moves، blanket per-edge allowlists، ونقل `materialUnitLabels` أو `paymentSourcePolicy` كحل شكلي.
- **الموجة:** `W1a-1` كـGuard مستقل، مع قياس SCC وشروط leaf exemption قبل التنفيذ.
- **المنفذ:** ZAI فقط؛ Manus لا يعدّل كود التطبيق.
- **حالة القرار:** `OWNER_APPROVED — OPTION_A — GUARD_ONLY`.

**التوصية:** الخيار A.

- leaf/shared infrastructure الضيق فقط يكون exempt-by-design: `time`, `formatting`, `identity`, و`resultCodes.ts` بعد تحقق invariants.
- house-pair ratchet لباقي edges، مع فصل value/type caps.
- value-cycle check على مستوى house.
- listing كامل للـ128 edge كدليل قياس.
- لا per-edge blanket allowlist.
- لا barrels، لا mass moves، ولا نقل `materialUnitLabels` أو `paymentSourcePolicy` كحل شكلي.

**الموجة:** `W1a-1`؛ نُقلت من W3 لأنها Guard-only.

**بوابة قبل التنفيذ:** قياس SCC للـhouses والتحقق من شروط leaf exemption.

**حالة المالك:** `OWNER_APPROVED — OPTION_A`.

---

## OD-KEYS — unknown top-level data keys

### سجل اعتماد المالك

- **قرار المالك:** اعتماد الخيار A.
- **النطاق المعتمد:** رفض unknown top-level data keys فقط للزوج الحالي `(Schema 38, Export 30)`، بعد characterization، وبعد كل الفحوص الحالية حتى لا يتغير rejection precedence.
- **الحماية:** إبقاء 24 Legacy pairs، Current/Goldens/MANIFEST، Schema 38، Export 30، وbackup-first دون تغيير.
- **بوابات إلزامية قبل W2-2:** اشتقاق allowed set من registry الـ31، فحص أي non-family keys ينتجها exporter، اعتماد اسم Error Code والنص العربي، ثم تفعيل الرفض في commit مستقل.
- **الممنوع:** حفظ unknown keys عبر round-trip، تغيير versions، إعادة ترتيب validators، أو echo لأسماء المفاتيح.
- **الموجة:** `W2-1` characterization وevidence، ثم `W2-2` behavior flip مستقل.
- **المنفذ:** ZAI فقط؛ Manus لا يعدّل كود التطبيق.
- **حالة القرار:** `OWNER_APPROVED — OPTION_A — W2_GATED`.

**التوصية:** الخيار A، لكن بتنفيذ owner-gated في W2.

- رفض unknown top-level data keys فقط للزوج المعلن `(Schema 38, Export 30)`.
- وضع الفحص بعد كل الفحوص الحالية حتى لا يتغير rejection precedence.
- اشتقاق allowed set من registry 31 عائلة، مع إدراج أي non-family keys يصدرها exporter إن وجدت.
- إبقاء Legacy 24 زوجًا دون تغيير.
- لا echo لأسماء المفاتيح في الرسالة.
- لا تغيير Schema/Export أو Golden/MANIFEST.

**الموجة:**

- `W2-1`: characterization وcorpus evidence.
- `W2-2`: behavior flip فقط بعد اعتماد code/error payload.

**القرار التفصيلي المطلوب لاحقًا قبل W2-2:**

- Error code name.
- Arabic error copy.
- اعتماد corpus الذي يثبت أن exporters لا تنتج مفاتيح غير مسجلة.

**النص المقترح للمراجعة:**

> `تعذّر استيراد الملف لأنه يحتوي على أقسام بيانات غير معروفة لهذا الإصدار.`

هذا النص **مسودة** وليس اعتمادًا نهائيًا.

**حالة المالك:** `OWNER_APPROVED — OPTION_A`; `EXACT_PAYLOAD_REQUIRED` قبل W2-2.

---

## OD-COUNTS — Registry-driven test-side oracle

### سجل اعتماد المالك

- **قرار المالك:** اعتماد registry-driven test-side oracle للـ31 عائلة.
- **النطاق المعتمد:** cardinality evidence لكل عائلة عبر IndexedDB وMemory، وmeta-test يثبت تطابق registry والـoracle، مع توثيق asymmetry الحالية 22/31 في ADR-017.
- **الممنوع:** إضافة count fields داخل Export، تغيير Export 30، تغيير Goldens/MANIFEST، أو تغيير Legacy.
- **الموجة:** `W2-1` كاختبارات وأدلة فقط.
- **المنفذ:** ZAI فقط؛ Manus لا يعدّل كود التطبيق.
- **حالة القرار:** `OWNER_APPROVED — TEST_SIDE_ONLY — 31_OF_31_REQUIRED`.

**التوصية:** الخيار D/C test-side.

- Oracle يدور على registry الـ31 عائلة.
- cardinality evidence لكل عائلة عبر IndexedDB وMemory.
- meta-test يثبت `registry == oracle`.
- تسجيل asymmetry الحالية 22/31 في ADR-017.
- لا إضافة count fields داخل export الحالي.
- لا تغيير Export 30 أو Goldens.

**الموجة:** `W2-1`، test-only.

**القبول:** 31/31 covered وGoldens byte-identical.

**حالة المالك:** `OWNER_APPROVED — TEST_SIDE_ONLY`.

---

## OD-TIME — حدود Application ambient time

### سجل اعتماد المالك

- **قرار المالك:** اعتماد AST-bound effect-class guard.
- **النطاق المعتمد:** تصنيف 21 ID-fallback site وموقع parsing، وإضافة فئات UI/lock-idle عند ثبوت الحاجة؛ لا clock injection للـID fallback.
- **الاختبارات المعتمدة:** characterization منفصل لـlock-idle يشمل backward/forward jumps وsuspend/resume وreal-browser check.
- **الممنوع:** تغيير lock-idle behavior داخل W1b، أو إعادة فتح R2 D11/D13، أو إدخال date semantics جديدة.
- **الموجة:** `W1b` بعد توفر AST helper من D-03.
- **المنفذ:** ZAI فقط؛ Manus لا يعدّل كود التطبيق.
- **حالة القرار:** `OWNER_APPROVED — AST_GUARD_NO_ID_INJECTION`.

**التوصية:** الخيار A مع موقف D: لا نحقن clock في ID fallback.

- AST-bound effect-class allowlist.
- تصنيف 21 ID-fallback site + parsing site.
- عدم اعتبار ID opaque clock-derived تاريخًا أو قيمة مالية.
- إبقاء UI timers خارج Application guard، باستثناء lock-idle الذي يحتاج characterization منفصلًا.
- اختبار lock-idle بالـfake clocks: backward jump، forward jump، suspend/resume، وreal-browser check.
- إذا ظهر fail-open، يسجل Finding جديد وقرار جديد؛ لا يُصلح خفية داخل W1b.
- لا تعديل R2 D11/D13.

**الموجة:** `W1b` بعد توفر AST helper من D-03.

**حالة المالك:** `OWNER_APPROVED — AST_GUARD_NO_ID_INJECTION`.

---

## OD-SEC — History scan وRecurring workflow

### سجل اعتماد المالك

- **قرار المالك:** اعتماد A+C باعتباره الخيار الأفضل.
- **النطاق المعتمد:** S0 one-time history scan على fresh mirror، ثم Workflow دوري scheduled + manual dispatch، non-blocking افتراضيًا، وأحمر عند finding أو scanner error.
- **حماية الأسرار:** fingerprint-only output، redaction test، لا طباعة match text، لا history rewrite، لا rotation تلقائية، ولا تعديل للـworking-tree guard.
- **بوابة التنفيذ:** مهمة مستقلة عبر ZAI فقط، مع secure credential mechanism ودون كشف أي Secret في التقرير.
- **حالة القرار:** `OWNER_APPROVED — A_PLUS_C — NON_BLOCKING_RECURRING`.

**التوصية:** A الآن + C لاحقًا.

### S0 — one-time history scan

- fresh mirror.
- branches، tags، PR head refs، reachable blobs، commit/tag messages.
- نفس pattern table الموجود في working-tree guard.
- fingerprint-only output؛ لا طباعة match text.
- self-test على fake secret مضاف ثم محذوف.
- redaction test.
- لا history rewrite، لا rotation تلقائية، لا تعديل للـworking-tree guard.

### بعد S0

- Workflow دوري scheduled + manual dispatch.
- non-blocking افتراضيًا.
- red على finding أو scanner error.
- يصبح blocking فقط بقرار منفصل عند incident أو trigger واضح.

**حالة المالك:** `OWNER_APPROVED — A_PLUS_C` قبل فتح S0.

---

## OD-LABEL — Vocabulary ownership

### سجل اعتماد المالك

- **قرار المالك:** إبقاء `fieldLabelAr` في Domain، ونقل المطابق byte-identical فقط.
- **النطاق المعتمد:** مقارنة UTF-8 bytes وcode points، واختبارات DOM text وduplicate-literal scan، مع إبقاء النصوص العربية كما هي.
- **حماية الحدود:** لا زيادة في R2/R6؛ إذا تعذر النقل edge-neutral أو ظهر variant مقصود، يتوقف المستهلك المتأثر لقرار مالك مستقل.
- **الموجة:** `W3` بعد census لكل مستهلك.
- **المنفذ:** ZAI فقط؛ Manus لا يعدّل كود التطبيق.
- **حالة القرار:** `OWNER_APPROVED — BYTE_IDENTICAL_ONLY — R2_R6_PROTECTED`.

**التوصية:** الخيار A.

- إبقاء `fieldLabelAr` في Domain.
- نقل المستهلكين الأربعة فقط إذا كانت النصوص byte-identical.
- عدم تعديل vocabulary أو Arabic copy.
- مقارنة UTF-8 bytes/code points، وليس مجرد الشكل المرئي.
- اختبار DOM text.
- duplicate-literal scan.
- إذا كان هناك variant مقصود، يسجل كـowner payload مستقل ولا يُفرض عليه توحيد آلي.
- يجب ألا تزيد R2/R6؛ إذا تعذر edge-neutral migration يتوقف الجزء المتأثر لقرار مالك دقيق.

**الموجة:** `W3`.

**حالة المالك:** `OWNER_APPROVED — BYTE_IDENTICAL_ONLY`; التنفيذ يحتاج census قبل اختيار المستهلكين فعليًا.

---

## OD-A11Y — Accessibility semantics-first

### سجل اعتماد المالك

- **قرار المالك:** اعتماد الخيار B.
- **النطاق المعتمد:** `W4-0` تصنيف interaction model، ثم D-14، ثم D-13، ثم D-15.
- **حدود التنفيذ:** semantics/focus/inert/restore واختبارات فقط؛ لا visual redesign، لا CSS/layout/tokens/navigation، ولا تغيير Copy.
- **المرجع:** AppLockGate يبقى oracle ولا يُعدّل ضمن W4.
- **الموجة:** `W4` بالتسلسل المستقل لكل خطوة.
- **المنفذ:** ZAI فقط؛ Manus لا يعدّل كود التطبيق.
- **حالة القرار:** `OWNER_APPROVED — OPTION_B — SEMANTICS_ONLY`.

**التوصية:** الخيار B.

1. `W4-0`: تصنيف interaction model.
2. `D-14`: overlay focus/inert/restore، P1 داخل W4.
3. `D-13`: اختيار dialog/disclosure/region حسب الاستخدام الحقيقي.
4. `D-15`: itemization ثم disposition لكل residual.

**القواعد:**

- focus trap فقط للـtrue modal.
- لا trap للـnon-modal/disclosure/inline panel.
- إبقاء AppLockGate كما هو oracle.
- لا CSS/layout/tokens/navigation/copy changes.
- Arabic accessible names عبر visible headings، دون strings جديدة إلا بقرار.
- RTL tab order واختبارات browser حقيقية عند الحاجة.

**الموجة:** `W4`.

**حالة المالك:** `OWNER_APPROVED — OPTION_B — SEMANTICS_ONLY`.

---

## OD-PRESERVE — إعادة تثبيت البطاقات الخمس

### سجل اعتماد المالك

- **قرار المالك:** اعتماد الخيار A مع دفعة أدلة P-03 من الخيار B.
- **النطاق المعتمد:** إبقاء P-01 إلى P-05 Preserve؛ تنفيذ tests/docs/evidence فقط.
- **الممنوع:** split أو move أو تغيير transaction boundaries أو rejection precedence أو 130 methods أو Schema/Export.
- **Trigger الاستثناء:** defect مثبت، parity divergence، أو seam transaction-closed مع Owner Decision مستقل؛ الحجم وحده ليس Trigger.
- **المنفذ:** ZAI فقط؛ Manus لا يعدّل كود التطبيق.
- **حالة القرار:** `OWNER_APPROVED — PRESERVE_ALL_FIVE — EVIDENCE_ONLY`.

**التوصية:** الخيار A مع تنفيذ B كدفعة أدلة P-03.

تبقى Preserve:

- `P-01` IndexedDbLocalStore.
- `P-02` MemoryLocalStore.
- `P-03` craft-order/policies.
- `P-04` storage/local/types.ts.
- `P-05` transferFamilyValidators + ADR-017.

**العمل المسموح الآن:** tests/docs/evidence فقط.

- P-01/P-02: parity ledger، method completeness، failure injection، atomicity، `storage_stale`.
- P-03: direct characterization tests، boundary values، Arabic message code points، mutation/weakening drills.
- P-04: type-level constants/method manifest tests.
- P-05: registry completeness، precedence matrix، ADR addendum في W2.

**الممنوع:** split أو move أو تغيير transaction boundaries أو rejection precedence أو 130 methods.

**حالة المالك:** `OWNER_APPROVED — PRESERVE_ALL_FIVE — EVIDENCE_ONLY`.

---

## OD-RECORD — R11-W0-NF-001

### سجل اعتماد المالك

- **قرار المالك:** اعتماد الخيار A.
- **النطاق المعتمد:** append-only addendum يحفظ القيم التاريخية كـ`UNVERIFIED` ويضيف methods/scope/tool/version/command/base SHA/date/raw-output hash/reviewer، مع إبقاء R10-B Matrix دون تعديل صامت.
- **الموجة:** `W1b` ضمن حوكمة الأدلة، لا موجة كود مستقلة.
- **المنفذ:** ZAI فقط؛ Manus لا يعدّل Matrix أو التاريخ.
- **حالة القرار:** `OWNER_APPROVED — APPEND_ONLY_EVIDENCE_GOVERNANCE`.

**التوصية:** الخيار A.

- Append-only addendum.
- إبقاء Matrix R10-B دون تعديل صامت.
- نقل القيم القديمة حرفيًا مع وسم `UNVERIFIED`.
- إضافة القيم الجديدة مع method/scope/tool/version/command/base SHA/date/raw-output hash/reviewer.
- إنشاء census template دائم للمستقبل.

**الموجة:** `W1b`.

**حالة المالك:** `OWNER_APPROVED — APPEND_ONLY_EVIDENCE_GOVERNANCE`.

---

# 4. قرارات S-1 وS-2

## S-1 — PeriodRange

### سجل اعتماد المالك

- **قرار المالك:** حل التعارض جذريًا بإعادة تسمية المعنى page-local غير المالي مع إبقاء الاسم `PeriodRange` على semantic المالي/date-owned بعد census للـcallers.
- **الاسم المعتمد مبدئيًا:** `FinanceActivityPeriodKey`؛ يؤكده ZAI عند تنفيذ caller census قبل الكتابة، ويستمر به ما لم تثبت الأدلة أن الدلالة مختلفة جذريًا.
- **الاختبارات:** type-level collision/assignability test و`tsc`، مع emitted JS مطابق.
- **الموجة:** `W1b`، rename-only مستقل.
- **المنفذ:** ZAI فقط؛ Manus لا يعدّل كود التطبيق.
- **حالة القرار:** `OWNER_APPROVED — RENAME_PAGE_LOCAL_MEANING`.

**الاتجاه المقترح:** إعادة تسمية أحد المعنيين فقط، مع إبقاء الاسم على semantic المالي/date-owned بعد census للـcallers.

**القاعدة:** لا يبدأ التنفيذ قبل تحديد الاسم البديل اعتمادًا على الاستخدام الفعلي، مع type-level collision/assignability test.

**الحالة:** `OWNER_APPROVED — EXACT_NAME_VALIDATION_GATE_BEFORE_W1b`؛ الاسم المبدئي `FinanceActivityPeriodKey` ويثبت نهائيًا من ZAI بعد census.

## S-2 — PreparedImport

### سجل اعتماد المالك

- **قرار المالك:** اعتماد phantom/opaque `PreparedImport` brand.
- **النطاق المعتمد:** mint وحيد داخل `prepareImport`، signature مميز لـ`confirmImport`، caller census، negative test، source-scan test، وtest-only forge helper.
- **الممنوع:** runtime re-validation أو wire-semantics change أو production forge sites.
- **القبول:** emitted JS/runtime behavior مطابق، وforgery يفشل compile-time.
- **الموجة:** `W1b`.
- **المنفذ:** ZAI فقط؛ Manus لا يعدّل كود التطبيق.
- **حالة القرار:** `OWNER_APPROVED — OPAQUE_PREPARED_IMPORT`.

**التوصية:** phantom/opaque `PreparedImport` brand.

- يُmint فقط داخل `prepareImport`.
- `confirmImport` يقبل النوع المميز فقط.
- caller census.
- `@ts-expect-error` negative test.
- source scan يمنع production forge sites.
- test-only forge helper مسموح.
- emitted JS/runtime behavior يجب أن يبقى مطابقًا.
- runtime re-validation خارج النطاق إلا بقرار مستقل.

**الموجة:** `W1b`.

---

# 5. ترتيب التنفيذ المقترح

1. `S0` — History scan evidence-only.
2. `W1a-1` — D-01, D-04, D-05, D-07.
3. `W1a-2` — D-03, D-02 monitor.
4. `W1b` — D-06, D-10, D-12, D-16 recurring workflow، P-01..P-04 evidence، P-03 direct tests، NF-001 addendum.
5. `W2` — D-11 oracle، D-09 strict current-pair gate، P-05.
6. `W3` — D-08 labels.
7. `W4` — D-14 ثم D-13 ثم D-15.
8. `W5` — غير مفتوحة؛ لا تفتح إلا Trigger موثق لـMoneyMinor branding.

## لماذا لا ندمج كل شيء؟

- S0 أمني/تشغيلي.
- W1a Guards قابلة للرجوع ومنخفضة المخاطر.
- W1b type/test/docs.
- W2 يغير import rejection behavior ويحتاج corpus.
- W3 يغير source of truth للنصوص.
- W4 يغير accessibility interaction contracts.

خلطها في موجة واحدة يخفي سبب الفشل ويصعّب rollback، حتى مع عدم وجود مستخدمين.

---

# 6. حالة الحزمة

```text
OWNER_DECISION_PACKAGE_APPROVED — EXECUTION_HANDOFF_READY
ALL_11_DECISIONS_APPROVED
ALL_16_FINDINGS_DISPOSITIONED
ALL_5_PRESERVE_CARDS_RE_RATIFIED
S0_SCOPE_APPROVED — ZAI_EXECUTION_ONLY
W1A_SCOPE_APPROVED — ZAI_EXECUTION_ONLY
W2_W3_W4_SCOPE_APPROVED — GATED_AFTER_PRIOR_WAVES
W5_CLOSED_BY_POLICY — TRIGGER_GATED
NO_IMPLEMENTATION_STARTED
NO_GENERIC_DEFER_USED
```

## ما يحتاجه المالك الآن

تم اعتماد الحزمة كاملة وفق توصيات Cloud Code، مع بوابات تنفيذ محددة. يسجل Manus لكل موجة:

- القرار النهائي؛
- الخيار؛
- النطاق؛
- الممنوع؛
- أدلة القبول؛
- rollback؛
- wave؛
- وقرار فتح/عدم فتح كل موجة.

**لا يبدأ التنفيذ تلقائيًا من هذه الوثيقة وحدها.** التنفيذ سيكون عبر ZAI فقط، على فرع/PR مستقل، وبعد تسليم Prompt تنفيذي منفصل يحدد baseline الحي، الملفات المسموحة، الاختبارات، والـrollback. لا يعد هذا الاعتماد Merge أو Deployment approval.
