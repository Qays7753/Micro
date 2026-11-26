/**
 * M1.7 (§14.1/§14.3 / قرار المالك D-5): السطح العام لمجال مانج
 * (`src/domain/manage/`). اليوم يحمل وحدة الفلس وحدها (M1.7)؛ تُضاف إليه
 * لاحقًا وحدات الدفتر والعقود والأشكال بموجاتها المصرَّح بها — التوسيع
 * تعديل مقصود في نفس الـPR لا نموًا صامتًا.
 */
export type { MoneyFils } from "./money/index.js";
export {
  FILS_PER_JOD,
  filsFromJodText,
  jodTextFromFils,
  addFils,
  subFils,
  mulFilsByQuantityMilli,
  divFils,
} from "./money/index.js";
