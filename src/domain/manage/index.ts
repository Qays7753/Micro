/**
 * M1.7 (§14.1/§14.3 / قرار المالك D-5): السطح العام لمجال مانج
 * (`src/domain/manage/`). يحمل وحدة الفلس (M1.7) ووحدة قيود الدفتر
 * Q1–Q20 مع معادلة التوازن والبناء والتحقق (M2.2 — التوسيع تعديل مقصود
 * في نفس الـPR كما نص رأس هذا الملف، عبر باب knip المعلن نفسه)، ووحدة
 * ثوابت INV-1…INV-10 العشرة بفحوصها الصرفة فوق حالة الدفتر (M2.3 — عبر
 * الباب المعلن نفسه)؛ تُضاف إليه لاحقًا وحدات العقود والأشكال بموجاتها
 * المصرَّح بها.
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
export type {
  ExpenseCategory,
  LedgerAccountId,
  LedgerAccountShape,
  LedgerEntryBuildInput,
  LedgerEntryDirection,
  LedgerEntryTypeId,
  LedgerEntryTypeSpec,
  LedgerEntryValidationInput,
  LedgerPosting,
  LedgerPostingSignRule,
  LedgerRefundChoice,
  LedgerWriteOffLineKind,
  ReversedLedgerEntry,
  RevenueKind,
  BuiltLedgerEntry,
} from "./ledger/index.js";
export {
  EXPENSE_CATEGORIES,
  LEDGER_ACCOUNTS,
  LEDGER_ACCOUNT_SHAPES,
  REVENUE_KINDS,
  isExpenseCategory,
  isRevenueKind,
  LEDGER_ENTRY_TYPES,
  LEDGER_ENTRY_TYPE_IDS,
  isLedgerEntryTypeId,
  entryBalanceDifferenceFils,
  validateLedgerEntry,
  buildLedgerEntry,
} from "./ledger/index.js";
export type {
  CachedFigures,
  CoreInvariantResults,
  InvariantBalanceLine,
  InvariantBox,
  InvariantCheckResult,
  InvariantEntry,
  InvariantId,
  InvariantOperation,
  InvariantPosting,
  InvariantSale,
  InvariantSaleLine,
  LedgerCheckState,
} from "./invariants/index.js";
export {
  assertLedgerCoreInvariants,
  checkInv1,
  checkInv10,
  checkInv2,
  checkInv3,
  checkInv4,
  checkInv5,
  checkInv6,
  checkInv7,
  checkInv8,
  checkInv9,
} from "./invariants/index.js";
/* M2.5 (wave G): السطح العام لعمليات §5 — مخططات العمليات الصرفة
 * (planners) وواجهة الخطة التي يؤلّفها العامل مع معالج M2.4 داخل
 * معاملته الواحدة. التوسيع في نفس الـPR عبر باب knip المعلن نفسه
 * (رأس هذا الملف)، كما في M2.2/M2.3 قبله. */
export type {
  ManageOperationKind,
  OpeningInput,
  OperationContext,
  OperationContextInput,
  OperationPlan,
  OperationWritePlan,
  PlanBalanceLine,
  PlanExtraWrites,
  PlanLoadState,
  TxQuery,
} from "./operations/support.js";
export type { SetupInput, SetupBoxSlot } from "./operations/setup.js";
export type { AddBoxInput } from "./operations/addBox.js";
export type { AddPriorBalanceInput } from "./operations/addPriorBalance.js";
export {
  OperationRejected,
  reject,
  requireName,
  requirePositiveFils,
  requireNonNegativeFils,
  requireDate,
  requireRequestId,
  validateOpening,
  requireContext,
} from "./operations/support.js";
export { planSetup } from "./operations/setup.js";
export { planAddBox } from "./operations/addBox.js";
export { planAddPriorBalance } from "./operations/addPriorBalance.js";
