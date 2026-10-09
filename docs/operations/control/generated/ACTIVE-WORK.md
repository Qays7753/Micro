# Active Work

> مولّد آليًا من Workstream claims؛ يشمل المراجعة المطلوبة حتى لا يختفي Claim قديم.

| ID | الحالة | الفرع | PR | البنود | الخطوة التالية |
|---|---|---|---|---|---|
| WS-216 | IN_PROGRESS | \`refactoring/r6-w1-records-reconciliation-20261009\` | — | ARCH-007 | مسح R6 القراءة-فقط مكتمل ومقبول: تقريره الكنوني وحزمة قرار المالك على main عبر PR #337 عند fd92d7e8812726dcca8d27d3ad64c8f24dc96abd (docs/operations/control/evidence/structural-remediation-r6-20261009/). R6-W1 (مصالحة السجلات — توثيق/Operations Control فقط) منفذة على الفرع refactoring/r6-w1-records-reconciliation-20261009 من fd92d7e8: F-002/F-003/F-004/F-005/F-006/F-007/F-008/F-011/F-012/F-017/F-026 + مصفوفة المكتشفات R6-SCAN-F-001..027 الدائمة في جرد الملفات §8؛ صفر تغيير كود/اختبار/سكربت/CSS. الخطوة التالية: فتح/مراجعة PR الـW1 ثم دمج بتفويض منفصل، وبعده R6-W2 (إصلاح F-001 الاختباري + F-024 بعد جرد المواقع الدقيق) ثم R6-W3 (فصل text-density-count.py). لا يبدأ R7 قبل إغلاق مكتشفات R6 أو تسجيل قرار محمي لكل بند. |
