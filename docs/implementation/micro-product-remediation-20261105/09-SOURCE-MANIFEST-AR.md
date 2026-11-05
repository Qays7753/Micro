# مصدر الحزمة وبصماتها وحدود إثباتها

التاريخ 2026-11-05 — عمّان. فرع main المتحقق عبر GitHub أثناء الإعداد: `111cd9dd3ffa8ee78b951fd4394b11b6b3cb0521`. استعلام PRs المفتوحة أعاد قائمة فارغة. هذه لقطة وقت القراءة؛ يعاد التحقق قبل التنفيذ.

## المصادر المقروءة

1. سجل الإصلاح الموحد MICRO-REMEDIATION-01 V1.
2. تصور المالية FIN-PAGE-PROP-01 V1.
3. CURRENT-PRODUCT-EXPERIENCE-AUDIT-AR(2).md، 561 سطرًا، بلا اقتطاع في القراءة.
4. PAGE-DECISION-PACK-AR(2).md، 349 سطرًا، بلا اقتطاع في القراءة.
5. MICRO-PERFORMANCE-AUDIT-31-POINTS-2026-11-04-REV1.md، 595 سطرًا، بلا اقتطاع في القراءة.

نسخها في sources/ نسخ نصية مرجعية من القراءة الحالية، وليست وعد تطابق بايتات الملف الأصلي. لا يعاد عد إصدار الأداء الأصلي فوقREV1، ولا نسختي(1)/(2) المتطابقتين كتدقيقين مستقلين.

**بصمة ZIP المصدر الأصلي (محفوظة ولا تتغير عند تحرير النسخة المنشورة):** `4ca1688e0e5f1ff9976e2acd3f21d712b6326b3fceb06f2d8d9c1bda31718c7f`.

استرجعت شجرة المستودع الكاملة عند SHA أعلاه، وAGENTS وREADME والحالة الحية وميثاق التفكير وحدود مرحلة Prototype، ووثائق المصدر والتكامل والمعمارية وADRs ومهارات UX/Design/QA، والموجه ومصادر Home وOrders وSettings وFinance ولوحة الوظائف وتجهيز الخدمات وpackage scripts. استُخدم منها ما يخص الملكية والتبعية والحدود؛ هذا ليس تدقيقًا جديدًا لكل دالة أو إقرار تطابق جميع العقود.

## المصادر الرسمية الداعمة للمعايير

- https://www.w3.org/TR/WCAG22/
- https://www.w3.org/WAI/ARIA/apg/patterns/radio/
- https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
- https://developer.apple.com/design/human-interface-guidelines/buttons
- https://support.google.com/accessibility/android/answer/7101858?hl=en

فُصل المعيار عن الإرشاد وقرار المنتج في03. لم ننسخ واجهة أو كودًا من هذه المصادر.

## فحص اكتمال الحزمة

- 31/31 معرفًا مصدريًا بمالك دفعة واحد، دون تكرار ID في جدول العمل.
- 62/62 ملف صفحة إنتاجي من شجرة pages/، مع استبعاد ملفات الاختبار، مربوط بعقد ودفعة.
- في `MicroRouter.tsx`: 70 عنصر Route، 69 بصفة path، و4 Redirect؛ وRouteLoadingState واحد لا يدخل العد. لا يساوي ذلك عدد الرحلات المختبرة.
- 9 دفعات UXR-00..08 وبطاقة لكل منها، ومسودة أمر مستقلة للدفعة01فقط.
- الروابط النسبية في ملفات الحزمة المؤلفة فُحصت. روابط المصادر التاريخية ومسارات /home/z القديمة أدلة منقولة لا ملفات متاحة هنا.
- فحص صياغة JavaScript للمعاينة نجح. لا فحص مرئي كامل أو تشغيل مالي في هذه الجولة؛ حالة القبول تبقى غير منفذة.
- لا رموز وصول أو placeholders تنفيذية في الملفات المؤلفة. الأمثلة والأسماء المالية اصطناعية.

## SHA-256 للملفات

لا تشمل هذه القائمة بصمة هذا الفهرس نفسه لتجنب التعريف الدائري. البصمات أدناه للنسخة المنشورة بعد التصحيحات؛ بصمة ZIP الأصلية مستقلة أعلاه. تحقق GitHub/الرأس يسجل في Control ونتيجة UXR-00.

| الملف | SHA-256 |
|---|---|
| `00-START-HERE-AR.md` | `5924d0b9fd698d06b8e538356f73770f9f625841468300c29b6c15bb2b3ad6ab` |
| `01-PROGRAM-AND-AUTHORITY-AR.md` | `bbc2241d11d1b426366cb0063f62cedd28b9ad5f22aac873cccaab451a4e6eaa` |
| `02-PAGE-CONTRACTS-AR.md` | `e5d7d46f69853eaa2236e71764b6a8aa3a27473c63c31ae9f29358d30a499435` |
| `03-CONTENT-AND-SOP-AR.md` | `1565a3491cea1c0755fe9e94a93fe1dc77008c4fc9f170b567dcb51c04004318` |
| `04-WORK-ORDERS-AR.md` | `4f7488d62f8258bd763233c36633a685e660e91dda1829cbde965ce3952fb457` |
| `05-SOURCE-AND-PAGE-COVERAGE-AR.md` | `aa7b0a54a3e5788d4f5d07f19be52e7d18dea499f46d251337911a799774dbef` |
| `06-ACCEPTANCE-AND-EVIDENCE-AR.md` | `410d4b11c5d408dea050f24c4067badca440e3c151794dfaa5e50af8ea917f73` |
| `07-PROGRAM-TRACKER-AR.md` | `3950b7ce809baba2deffed5722d42fe8795643e8253a1ec6a57e6311015cbb19` |
| `08-MANUS-HANDOFF-AR.md` | `52c80f1761aa7e873c2b3287b82541241486cc9a9fe44d85263339102ac707f4` |
| `sources/CURRENT-PRODUCT-EXPERIENCE-AUDIT-AR(2).md` | `fb2e2a8a391a4880f24c167eba62a914b8f375a3cd29c798f358d859663c198e` |
| `sources/MICRO-PERFORMANCE-AUDIT-31-POINTS-2026-11-04-REV1.md` | `d41cd2e6b5326bfbbce1fb62799086cb6c61041accfb2e2cd7d8797f496381fb` |
| `sources/Micro-Finance-Page-Proposal-AR.md` | `9ef39216138b737318caff4df9fa34cef2233c9825d8f53f5b91b122ee24514b` |
| `sources/Micro-Unified-Remediation-Scope-and-Register-AR.md` | `93ffa5fad27ffe4fce3f459d6a4951a3269cbc8405fa6dd7661f54b4a70fa59b` |
| `sources/PAGE-DECISION-PACK-AR(2).md` | `14a24ad38636106fa936738fc369a6b3c558733506f74cd0ad6250f7e63a6233` |
| `stages/UXR-00-STAGE-CARD-AR.md` | `30a4da66a544f4b1c2212f100da8694c5827052ab0db1b3175b720fe9c5d590c` |
| `stages/UXR-01-EXECUTION-PROMPT-AR.md` | `6f1ee274299b8825c1f88e9ba54510465f1d5361eb5094733d8469303284740c` |
| `stages/UXR-01-STAGE-CARD-AR.md` | `5aa8e34a98a577f871e617e5fbdc21df7d73e314008f11efc4febb1d8dd901cb` |
| `stages/UXR-02-STAGE-CARD-AR.md` | `38e3fef7dca22f02a7c23d88bd8b6380b0f132b9af8b3d066ccbdd5bee69c8f5` |
| `stages/UXR-03-STAGE-CARD-AR.md` | `c9a9bf6229f6ada1dce5b63f3c47e5e45245ccfb7d09128266895cb153a22fc8` |
| `stages/UXR-04-STAGE-CARD-AR.md` | `1ede1788796bda0958b2178f535049b47e1ec8c097742cc5d865c0eaba5566f2` |
| `stages/UXR-05-STAGE-CARD-AR.md` | `e82911fae4a4e00ca3fb47d19b9c54e2d8d3646749c35fc043cd8a0ac924a9b1` |
| `stages/UXR-06-STAGE-CARD-AR.md` | `e107f17f3eb7dfd9dd8ac14318e1ed7f0a5cd789ba807bc46d3cc328c65c51ed` |
| `stages/UXR-07-STAGE-CARD-AR.md` | `71205db6d5fc3e72808460ad4ed123433710a1306a02e4218c9535d551c11546` |
| `stages/UXR-08-STAGE-CARD-AR.md` | `750251d90755dffd4067da5597c05ed6ad4ac22a430ddf01d2a5e6bea354b015` |
