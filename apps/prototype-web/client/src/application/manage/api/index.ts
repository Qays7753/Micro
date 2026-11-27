/**
 * M5.1 (IMPACT §12 — «Client API»): باب عميل مانج-في₂ — القراءات (reads)
 * والكتابات (writes) وخرائط الأخطاء (errors). عامل رفيع: طلب/استجابة
 * ورموز أخطاء §11 — لا منطق أعمال ولا رياضيات (R10: لا استيراد من مجال
 * مانج ولا من عامل الخادم؛ الأنواع تعكس عقد HTTP حرفيًا).
 */
export { manageErrorCode, isNetworkFailure } from "./errors.js";
export {
  setupProject,
  type ManageOperationResult,
  type ManageWriteOutcome,
  type SetupBoxOpening,
  type SetupBoxSlot,
} from "./writes.js";
export {
  fetchManageFigures,
  type ManagePeriod,
  type ManageFiguresResponse,
  type Figure,
  type UnknownFigure,
} from "./reads.js";
