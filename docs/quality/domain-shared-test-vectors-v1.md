# Micro — Domain Shared Test Vectors v1

هذه المتجهات تثبت أن نقل المساعدات إلى `src/domain/shared/` لا يغيّر نتائج Domain القائمة. القيم قبل النقل وبعده هي نفسها؛ النقل يغيّر موضع التنفيذ أو النوع فقط.

| المتجه                 | المدخل                                    | النتيجة قبل النقل | النتيجة بعد النقل | الحارس                                                |
| ---------------------- | ----------------------------------------- | ----------------: | ----------------: | ----------------------------------------------------- |
| line-item half-up      | `1.5 × 300` في تكلفة مادة                 |             `450` |             `450` | `calculateCostSnapshot`، اختبار craft-order القائم    |
| shared half-up         | `5 ÷ 2`                                   |               `3` |               `3` | `roundHalfUp(5, 2)`                                   |
| unit-cost ceiling      | تكلفة مخططة `100`، كمية `3`               |   تكلفة وحدة `34` |   تكلفة وحدة `34` | `calculateCostSnapshot`؛ `Math.ceil` تبقى سياسة حماية |
| quantity milli         | `5_000` milli-unit، معدل `50` لكل `1.000` |             `250` |             `250` | `calculateAllocationPolicy` per-output                |
| G5 share               | `10_000` قرش، `500` bps                   |             `500` |             `500` | `calculateSharedProjectShareMinor`                    |
| overflow-safe addition | `MAX_SAFE_INTEGER + 1`                    |            `null` |            `null` | `addSafe`                                             |
| local date             | `2026-02-30`                              |          غير صالح |          غير صالح | `isValidLocalDate`                                    |
| ID                     | سلسلة فارغة                               |               رفض |               رفض | `assertId`                                            |

لا يُفترض من هذه المتجهات دعم عملة جديدة أو إعادة حساب سجل تاريخي. `Currency` و`MoneyMinor` type-only، وكل سجل قائم يبقى بالقيمة نفسها.
