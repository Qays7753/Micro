/**
 * M5.1 (IMPACT §12 — «Client API»): باب عميل مانج-في₂ — القراءات (reads)
 * والكتابات (writes) وخرائط الأخطاء (errors). عامل رفيع: طلب/استجابة
 * ورموز أخطاء §11 — لا منطق أعمال ولا رياضيات (R10: لا استيراد من مجال
 * مانج ولا من عامل الخادم؛ الأنواع تعكس عقد HTTP حرفيًا).
 */
export { manageErrorCode, isNetworkFailure } from "./errors.js";
export {
  setupProject,
  detectAbsence,
  renameProject,
  collectPayment,
  payDebt,
  hideSaleFromTracker,
  addSaleToTracker,
  saveManageProduct,
  archiveManageProduct,
  addManageBox,
  mergeManageBoxes,
  splitManageBoxes,
  addPriorBalance,
  finishReconcile,
  transferBetweenBoxes,
  type ManageOperationResult,
  type ManageWriteOutcome,
  type SetupBoxOpening,
  type SetupBoxSlot,
} from "./writes.js";
export {
  fetchManageFigures,
  fetchManageProject,
  fetchReconciliationLog,
  fetchManageSaleRows,
  fetchSaleDetails,
  fetchManageProducts,
  fetchRecentActivity,
  fetchActivityLog,
  fetchOperationDetails,
  fetchBalanceLine,
  fetchReconcileDiff,
  type ActivityCompoundRow,
  type ActivityLogFilters,
  type ActivityLogRow,
  type BalanceLineDetails,
  type OperationVersion,
  type ReconcileBoxDiff,
  type ReconcileDiffResponse,
  type ManagePeriod,
  type ManageFiguresResponse,
  type Figure,
  type UnknownFigure,
  type ProjectStateResponse,
  type ReconciliationLogResponse,
  type SaleRow,
  type SaleDetailsResponse,
  type ProductItem,
  type ActivityRow,
} from "./reads.js";
