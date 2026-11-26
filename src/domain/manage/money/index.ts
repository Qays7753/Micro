/**
 * M1.7 (§9 / IMPACT §4 / قرار المالك D-4): برميل وحدة الفلس — السطح الكامل
 * لموديول مال مانج (`src/domain/manage/money/`). لا يضيف ولا يعيد تسمية؛
 * يجمِّع فقط حتى يكون للاستهلاك بوابة واحدة.
 */
export type { MoneyFils } from "./types.js";
export {
  FILS_PER_JOD,
  filsFromJodText,
  jodTextFromFils,
  addFils,
  subFils,
  mulFilsByQuantityMilli,
  divFils,
} from "./fils.js";
