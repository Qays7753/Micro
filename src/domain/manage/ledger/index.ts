/**
 * M2.2 (§4 + §3.8 — مانج-في₂، الموجة E): برميل موديول قيود الدفتر
 * (`src/domain/manage/ledger/`) — السجل النوعي للأنواع Q1–Q20، ومعادلة
 * التوازن لكل قيد، والبناء والتحقق. لا يضيف ولا يعيد تسمية؛ يجمع فقط.
 */
export type {
  ExpenseCategory,
  LedgerAccountId,
  LedgerEntryBuildInput,
  LedgerEntryDirection,
  LedgerEntryTypeId,
  LedgerEntryValidationInput,
  LedgerPosting,
  LedgerPostingSignRule,
  LedgerRefundChoice,
  LedgerWriteOffLineKind,
  ReversedLedgerEntry,
  RevenueKind,
  BuiltLedgerEntry,
} from "./types.js";
export type { LedgerAccountShape } from "./accounts.js";
export type { LedgerEntryTypeSpec } from "./registry.js";
export {
  EXPENSE_CATEGORIES,
  LEDGER_ACCOUNTS,
  LEDGER_ACCOUNT_SHAPES,
  REVENUE_KINDS,
  isExpenseCategory,
  isRevenueKind,
} from "./accounts.js";
export { LEDGER_ENTRY_TYPES, LEDGER_ENTRY_TYPE_IDS, isLedgerEntryTypeId } from "./registry.js";
export { entryBalanceDifferenceFils } from "./balanceRule.js";
export { validateLedgerEntry } from "./validateEntry.js";
export { buildLedgerEntry } from "./buildEntry.js";
