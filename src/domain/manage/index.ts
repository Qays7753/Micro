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
  PlanResultData,
  TxQuery,
} from "./operations/support.js";
export type { SetupInput, SetupBoxSlot } from "./operations/setup.js";
export type { AddBoxInput } from "./operations/addBox.js";
export type { AddPriorBalanceInput } from "./operations/addPriorBalance.js";
/* M2.6 (wave G): OP-EXPENSE — الباب المعلن نفسه. */
export type { ExpenseInput, ExpensePayment, ExpenseSource } from "./operations/expense.js";
/* M2.7 (wave G): حركات مال المالك والتحويل بين الصناديق — الباب المعلن نفسه. */
export type {
  OwnerDepositInput,
  OwnerDepositSource,
  OwnerWithdrawalInput,
  OwnerWithdrawalType,
} from "./operations/ownerMoney.js";
export type { TransferInput } from "./operations/transfer.js";
/* M2.8 (wave H): التحصيل والدفع بالتخصيص بالاسم — الباب المعلن نفسه. */
export type { CollectInput, CollectShortfall } from "./operations/collect.js";
export type { PayInput } from "./operations/pay.js";
/* M2.9 (wave H): الشطب المستقل — الباب المعلن نفسه. */
export type { WriteOffInput } from "./operations/writeOff.js";
/* M2.10 (wave H): التصحيح والإلغاء — الباب المعلن نفسه. */
export type { CorrectInput } from "./operations/correct.js";
export type { CancelOperationInput } from "./operations/cancelOperation.js";
/* M2.10-correction (knip door): خطاف مرحلة التصحيح نفسه — النوع أُغفل من الباب
 * يوم الموجة H فصار «تصديرًا غير مستخدم» لراسم knip (مستهلكه الوحيد العامل
 * خارج نطاقه)؛ يُغلق بالباب المعلن نفسه. */
export type { PlanRevisionEntries } from "./operations/support.js";
/* M2.11 (wave I): مساعدات الأشكال الصرفة لموديول القراءة — الباب المعلن نفسه. */
export type { FigurePeriodKind, PerTenRatio, PeriodRange, ProfitBar } from "./figures/index.js";
export {
  displayDate,
  perTenRatio,
  periodLabel,
  periodRangeOf,
  profitBarsOf,
  periodOverlapsIncompleteAbsence,
  expectedProfitFils,
} from "./figures/index.js";
export type { OpenBalanceLine } from "./operations/allocation.js";
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
export { planExpense } from "./operations/expense.js";
export { planOwnerDeposit, planOwnerWithdrawal } from "./operations/ownerMoney.js";
export { planTransfer } from "./operations/transfer.js";
export { planCollect } from "./operations/collect.js";
export { planPay } from "./operations/pay.js";
export { planWriteOff } from "./operations/writeOff.js";
export { planCorrect } from "./operations/correct.js";
export { planCancelOperation } from "./operations/cancelOperation.js";
/* M3.3 (phase 3): OP-PREPAYMENT — الباب المعلن نفسه. */
export type { PrepaymentInput } from "./operations/prepayment.js";
export { planPrepayment } from "./operations/prepayment.js";
/* M3.2 (phase 3): OP-SALE-CREATE + لقطة البنود — الباب المعلن نفسه. */
export type { SaleCreateInput, SaleCreateLineInput, SaleLineWrite } from "./operations/saleCreate.js";
export { planSaleCreate } from "./operations/saleCreate.js";
/* M3.1 (phase 3): منتجاتي + لقطة البند — باب knip المعلن نفسه (رأس هذا
 * الملف). */
export type {
  ProductComponentForm,
  ProductComponentInput,
  ProductForm,
  ProductFormInput,
} from "./products.js";
export {
  validateProductForm,
  productUnitCostFils,
  productLineSnapshot,
  freeTextLineSnapshot,
  defaultFinalPriceFils,
} from "./products.js";
