# R11 W2a — مصفوفة جسد Transfer الكاملة وأدلة OD-COUNTS/OD-KEYS (قبل أي تغيير سلوك)

**الموجة:** R11 متابعة — Phase 2 (W2a) | **التاريخ:** 15 أكتوبر 2026 (UTC) | **المنفذ:** ZAI (كاتب واحد)
**العقد الحاكم:** `R11-CONTINUE-ALL-REMAINING-WAVES-SAME-PR-2026-10-15.md` §8 (المثبت على `3fd10015`)
**القرارات المنفذة:** OD-COUNTS (`TEST_SIDE_ONLY — 31_OF_31_REQUIRED`) وOD-KEYS (مرحلة التوصيف فقط من `W2_GATED`) | **الـPR:** #368 | **لا تغيير إنتاجي إطلاقًا**

---

## 1. الجسد الكامل (The corpus matrix)

| صف المصفوفة | المحتوى المقيس | الدليل الحي | الحالة |
|---|---|---|---|
| ملفات الزوج الحالي `(38, 30)` الصالحة | ذهبي `current-pair.golden.json` (مشتق من 8/17 عبر الترحيل والاستعادة والتصدير) + ذهبي `current-pair-supplement.golden.json` (غني بالعائلات؛ 10 عائلات غير صفرية) + تصدير حي فوق المهايئين | `exportGoldens.test.ts` (مقارنة عميقة كاملة) + `transferCountsOracle.odcounts.test.ts` + `transferTopLevelKeys.odkeys.characterization.test.ts` | `VERIFIED` |
| كل الأزواج الموروثة المدعومة | **24 زوجًا** في `RELEASED_LEGACY_EXPORT_PAIRS` (29/37 نزولًا إلى 6/14) | `localTransferService.releasedPairs.test.ts` (قبول كل زوج + رفض الأزواج غير الصادرة) + `localTransferService.schema29..34.test.ts` + `historical817.fixture.ts` | `VERIFIED` |
| الذهبيات الـ27 وMANIFEST | 27 ملف ذهبي (25 تراثيًاmin + حاليان) + `MANIFEST.json` ببصمات sha256 لكل ملف | `exportGoldens.test.ts` يطابق البصمات والبنية — **لم تُمس** (بايتًا بايت) | `VERIFIED — UNCHANGED` |
| ملفات ينتجها المصدّر | تصدير حي فارغ ومزروع فوق IndexedDB وMemory (`createExport`) | `transferCountsOracle.odcounts.test.ts` (round trip كامل) + `dataRoundTrip.exe014.test.ts` | `VERIFIED` |
| ثوابت الاستيراد (fixtures) | عهدة 8/17 الأمينة + ملفات minimalFileForPair للأزواج الـ24 | `historical817.fixture.ts` + `localTransferService.releasedPairs.test.ts` | `VERIFIED` |
| المفاتيح العلوية المجهولة (data) | توصيف السلوك الحالي بالضبط | `transferTopLevelKeys.odkeys.characterization.test.ts` (§3 أدناه) | `VERIFIED` |
| المفاتيح غير العائلية التي يصدرها المصدّر | `profile`, `ownerProfile`, `preferences`, `inventoryActivation` — مشتقة من الجسد لا مذكورة يدويًا | الاشتقاق في الاختبار نفسه (35 مفتاحًا مسموحًا إجمالًا) | `VERIFIED` |
| القيم المعطوبة | مدقق عائلات كامل + عهدة معطوبة + أعراض مقصوصة | `transferFamilyValidators.characterization.test.ts` + `localTransferService.prepareImport.rejection.test.ts` + `familyOrphan` | `VERIFIED` |
| المدخلات متعددة الأعطال وأسبقية الرفض الأول | مصفوفة 7 أعطال × مفتاح مجهول حاضر: صيغة ← إصدار ← بنية exportedAt/data ← بصمة ← بنية خام (مصفوفة/غياب) ← تحقق العائلات ← العدادات | `transferTopLevelKeys.odkeys.characterization.test.ts` (الرسائل الحرفية مثبتة لكل عطل) | `VERIFIED` |
| جولات IndexedDB وMemory | كل أطقم العدّاد والجولة الكاملة (استيراد ← تأكيد ← إعادة تصدير) فوق المهايئين | `transferCountsOracle.odcounts.test.ts` | `VERIFIED` |
| تغطية مدققات عائلات Transfer | 31 عائلة في السجل الكنوني `TRANSFER_ARRAY_FAMILY_ROLES` == عائلات مخرجات المصدّر (meta-test) | `transferCountsOracle.odcounts.test.ts` + `transferFamilyValidators.characterization.test.ts` | `VERIFIED` |
| مستدعو confirmImport وتدفق PreparedImport | نقطة الختم الوحيدة S-2 (opaque brand) داخل `prepareImport` وحدها؛ مستدعو الواجهة عبر الخدمة | `preparedImport.provenance.test.ts` + `dataRoundTrip.exe014.test.ts` + الجولة الكاملة في العدّاد | `VERIFIED` |
| P-05 وADR-017 | `transferFamilyValidators` محفوظ PRESERVE بحد نموه المرتبط؛ اللاتماثل 22/31 مسجل الآن كدليل | ملحق ADR-017 المؤرخ 2026-10-15 (أدناه) | `VERIFIED` |

## 2. OD-COUNTS — العدّاد الجانبي-الاختبار المدفوع بالسجل

- **الملف:** `application/transfers/transferCountsOracle.odcounts.test.ts` (7 اختبارات).
- **الاستقلال:** العدّاد يعدّ العائلات الـ31 من أي لقطة دون اطلاع على `LocalExportCounts`؛ وmeta-test يشتق العائلات من مخرجات المصدّر نفسه (ذهبيا الزوج الحالي) ويطابقها مع مفاتيح السجل حرفيًا (31/31)، والمعدود (22) مع مفاتيح عدادات المصدّر حرفيًا.
- **التغطية المزدوجة:** فوق IndexedDB وMemory معًا: `replaceSnapshot` ← `readSnapshot` ← `createExport` — لكل عائلة معدودة: `counts[key] == oracle[key]`؛ ولكل عائلة غير معدودة: لا مفتاح عد لها إطلاقًا.
- **اللاتماثل 22/31:** العائلات التسع المطلوبة-غير-المعدودة مثبتة بالاسم (recurrences, catalogItems, measurementUnits, directConversions, catalogTemplates, actualTimeRecords, shortCashDeclarations, allocationPolicies, costEstimates) — مسجلة كدليل في ملحق ADR-017 (2026-10-15)، **لا** كحقل في Export 30. تغطية غير صفرية على صنف اللاتماثل نفسه (سجلان في بنود المنتجات عبر `createCatalogItem`).
- **الممنوع المحترم:** لا حقول عد جديدة داخل Export 30؛ الذهبيات وMANIFEST وLegacy وSchema 38 لم تُمس (بايتًا بايت — `exportGoldens.test.ts` أخضر).

## 3. OD-KEYS — توصيف مفاتيح data العلوية (قبل أي تفعيل رفض)

- **الملف:** `application/transfers/transferTopLevelKeys.odkeys.characterization.test.ts` (16 اختبارًا).
- **المجموعة المسموحة (35):** مشتقة من سجل الـ31 + المفاتيح غير العائلية الأربعة التي يصدرها المصدّر فعليًا (`profile`/`ownerProfile`/`preferences`/`inventoryActivation`) — لا قائمة يدوية عامة.
- **جسد المصدّر نظيف:** كل ملف في الجسد (ذهبيًا الزوج الحالي + تصدير حي فارغ ومزروع فوق المهايئين) لا ينتج أي مفتاح خارج المجموعة — شرط W2-2 الأول مثبت.
- **مفاتيح المظروف الحالية مثبتة (8):** appVersion/counts/data/exportedAt/format/integrity/schemaVersion/version.
- **السلوك الحالي موصوف بالضبط:** مفتاح data علوي مجهول في ملف الزوج الحالي (ببصمة معاد ختمها وعدادات سليمة) **مقبول اليوم** — يظهر في بيانات معاينة الاستيراد، ثم **يُسقط عند الاستبدال** (`replaceSnapshot` لا يكتبه) ولا يظهر في قراءة المخزن ولا في إعادة التصدير — **لا حفظ دوري للمفاتيح المجهولة** في السلوك القائم (فوق المهايئين). العائلات المعروفة نجت كاملة.
- **الإرث (8/17) بمفتاح مجهول:** مقبول كما هو تمامًا ويُسقط عند الاستمرار مثلًا — الإرث لا يتغير.
- **كتلة counts بمفتاح مجهول (حالٍ):** مرفوضة أصلًا برسالة MED-002 الحرفية (مثبتة).
- **أسبقية الرفض الأول (7 أعطال):** مع المفتاح المجهول حاضرًا، كل عطل قائم يظل يُرفض برسالته الأصلية حرفيًا وبترتيبه: الصيغة ← الإصدار ← exportedAt/data ← البصمة ← البنية الخام ← تحقق العائلات ← العدادات. المفتاح المجهول لا يغير الأسبقية ولا يشارك في الرسائل — شرط W2-2 الثالث مثبت.

## 4. بوابة حمولة W2b (التسجيل المطلوب)

تفعيل الرفض الصارم (W2-2/W2b) للزوج الحالي وحده **معطل** حتى اعتماد المالك الحرفي لحمولة الخطأ الدقيقة:
- **رمز الخطأ:** غير معتمد بعد.
- **النص العربي:** المسودة في حزمة قرارات المالك («تعذّر استيراد الملف لأنه يحتوي على أقسام بيانات غير معروفة لهذا الإصدار.») **مسودة للمراجعة وليست اعتمادًا نهائيًا** — `EXACT_PAYLOAD_REQUIRED`.
- كل شروط W2-2 الأخرى (جسد المصدّر، الإرث والذهبيات، الأسبقية، الاشتقاق من السجل، السلبيات، عدم صدى أسماء المفاتيح، عدم إدخال حفظ دوري) موصوفة وجاهزة للإثبات النهائي عند التفعيل.

```text
R11_W2A_CHARACTERIZATION_COMPLETE — OWNER_PAYLOAD_GATE_RECORDED
NO_PRODUCTION_CHANGE
NO_MERGE_PERFORMED
```

## 5. الأوامر والنتائج

- `pnpm --filter @micro/prototype-web test -- client/src/application/transfers` — **34 ملفًا / 326 اختبارًا كلها خضراء** (منها 23 جديدة في هذه الموجة: 7 عدّاد + 16 توصيف مفاتيح).
- الرأس: التزام هذه الموجة على الفرع `security/r11-lock-fail-closed-20261015` (PR #368).
- المراجع: المراجعات الخمس القراءة-فقط على الـPR كاملًا في نهاية برنامج المتابعة (عقد المتابعة §15).

---

## 6. إضافة مؤرخة — تفعيل W2b (W2-2) في موجة المتابعة الموحدة (2026-10-16)

> **Append-only:** هذا القسم إضافة مؤرخة على توصيف W2a أعلاه؛ المتن التاريخي (§1–§5) محفوظ كما كُتب ولا يُعاد كتابته.

- **فتح البوابة:** بوابة حمولة W2b (§4 أعلاه: `EXACT_PAYLOAD_REQUIRED`) فُكّت باعتماد المالك النهائي في عقد المتابعة الموحدة §3.2 — الحمولة الحرفية مسجلة append-only في `../r11-unified-followup-20261016/evidence/W2B-OWNER-PAYLOAD-ADDENDUM-2026-10-16.md` (رمز `validation_error` عبر الثابت الكنوني القائم `VALIDATION_ERROR` + النص العربي الدقيق).
- **التنفيذ:** الفحص يعمل في `prepareImport` بعد بوابة العدادات حصرًا — الموضع الذي أثبتت مصفوفة الأعطال السبعة (§3 أعلاه) أنه لا يعيد ترتيب أي رفض قائم — والاشتقاق الإنتاجي في `transferTopLevelDataKeys.ts`: سجل العائلات الـ31 + سجل Record مستنفد وقت الترجمة للمفاتيح غير العائلية الأربعة (استنفاد مفروض: أي حقل لقطة جديد غير مصفوفي يكسر البناء حتى يُسجل) = 35 مفتاحًا، مع meta-test يثبت التكافؤ مع مفاتيح اللقطة الفارغة الكنونية.
- **السلوك قبل/بعد (الزوج الحالي 38/30 وحده):** قبل — مفتاح data علوي مجهول مقبول، يظهر في المعاينة ويُسقط عند الاستبدال بلا حفظ دوري. بعد — **مرفوض** برمز `validation_error` والنص العربي الحرفي المعتمد، بلا صدى لأسماء المفاتيح، وقبل أي كتابة (صفر أثر على الجهاز).
- **الثبات المثبت بالاختبارات (ملف `transferTopLevelKeys.w2b.rejection.test.ts` + تحديث التوصيف أعلاه):** أسبقية الأعطال السبعة كما هي حرفيًا مع المفتاح المجهول حاضرًا (مصفوفة §3 خضراء بلا تعديل)؛ الأزواج التراثية الـ24 مقبولة حتى مع مفتاح مجهول؛ الذهبيان الحاليان وMANIFEST مقبولان ببصماتهما؛ مفاتيح المصدّر غير العائلية الأربعة مقبولة؛ مخرجات المصدّر الحية نظيفة فوق المهايئين؛ جولة الاستيراد←التأكيد←إعادة التصدير نظيفة؛ الرفض صفر كتابات (deep-equal قبل/بعد فوق IndexedDB وMemory معًا)؛ ولا قيمة مُحضّرة يمكن تأكيدها بعد الرفض.
- **المحفوظ حرفيًا:** Schema 38 وExport 30 وكل الذهبيات وMANIFEST ومخرج المصدّر وسلوك backup-first وPreparedImport/confirmImport وذرّية التخزين والمفاتيح المتداخلة داخل سجلات العائلات (نطاق هذه الموجة حدود data العلوية وحدها).
- **حد الرجوع:** قبل دمج الـPR: الإغلاق دون دمج (لا أثر سلوكي). بعد الدمج: revert الالتزام السلوكي وحده (الفحص معزول في موضعه بعد العدادات ولا يشاركه كود آخر) يعيد سلوك القبول القائم.
- **الحالة:** `W2B_ACTIVATED_FOR_CURRENT_PAIR_ONLY — EXACT_PAYLOAD — PRECEDENCE_PRESERVED — ZERO_WRITE_ON_REJECTION`.
