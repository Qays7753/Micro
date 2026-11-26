/**
 * M1.7 (§14.1/§14.3 / قرار المالك D-5): السطح العام لمجال مانج
 * (`src/domain/manage/`). يحمل وحدة الفلس (M1.7) ووحدة قيود الدفتر
 * Q1–Q20 مع معادلة التوازن والبناء والتحقق (M2.2 — التوسيع تعديل مقصود
 * في نفس الـPR كما نص رأس هذا الملف، عبر باب knip المعلن نفسه)؛ تُضاف
 * إليه لاحقًا وحدات الثوابت والعقود والأشكال بموجاتها المصرَّح بها.
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
