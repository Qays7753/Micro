/**
 * Wave 3B (ARCH-002/WS-212 — STR-104/509): مراسي دريفت المجال ↔ النقل.
 *
 * خريطة «Record<UnionType, true>» لكل اتحاد مجال مكرر في مدققات النقل:
 *  - إكمال المفاتيح مفروض نوعيًا: أي إضافة/حذف قيمة في اتحاد المجال دون
 *    تحديث هذا الملف يكسر فحص الأنواع (يفرضه اختبار الحارس زمن التشغيل
 *    عبر tsc — انظر domainTransferDriftGuard.test.ts).
 *  - القيم التاريخية التوافقية خارج هذه الخرائط عمدًا (عقد 39): المدققات
 *    تقبل تاريخيًا أكثر من المجال الحالي — حقن مقصود لا انحراف.
 *
 * لا يحمل هذا الملف أي منطق — بيانات مراسي فقط.
 */
import type {
  KnowledgeState,
  ResultStatus,
  OrderStatus,
  SettlementStatus,
} from "@micro-domain/craft-order/index.js";
import type { DirectSaleCollectionStatus } from "@micro-domain/direct-sale/index.js";
import type { CashWalletKind, CashContinuityEntryType } from "@micro-domain/cash-continuity/index.js";
import type { FinancialEventType } from "@micro-domain/financial-event/index.js";

export const KNOWLEDGE_STATES = {
  known: true,
  estimated: true,
  partial: true,
  incomplete: true,
  stale: true,
  variable: true,
} satisfies Record<KnowledgeState, true>;

export const RESULT_STATUSES = {
  final: true,
  estimated: true,
  incomplete: true,
  review_required: true,
} satisfies Record<ResultStatus, true>;

export const ORDER_STATUSES = {
  draft: true,
  provisional_agreement: true,
  confirmed: true,
  in_progress: true,
  ready: true,
  delivered: true,
  settled: true,
  postponed: true,
  cancelled: true,
  needs_review: true,
} satisfies Record<OrderStatus, true>;

export const SETTLEMENT_STATUSES = {
  unpaid: true,
  partially_paid: true,
  paid: true,
  debt: true,
  cancelled: true,
  cancelled_pending: true,
  cancelled_refunded: true,
  cancelled_retained: true,
} satisfies Record<SettlementStatus, true>;

export const DIRECT_SALE_COLLECTION_STATUSES = {
  collected_in_full: true,
  partial_debt: true,
  partial_needs_review: true,
} satisfies Record<DirectSaleCollectionStatus, true>;

export const CASH_WALLET_KINDS = {
  cash_drawer: true,
  bank_account: true,
  digital_wallet: true,
  other: true,
} satisfies Record<CashWalletKind, true>;

export const CASH_ENTRY_TYPES = {
  opening_balance: true,
  cash_adjustment: true,
  transfer_out: true,
  transfer_in: true,
  reversal: true,
  allocation: true,
} satisfies Record<CashContinuityEntryType, true>;

export const FINANCIAL_EVENT_TYPES = {
  owner_investment_cash: true,
  owner_withdrawal_cash: true,
  operating_expense_cash: true,
  operating_expense_payable: true,
  payable_settlement_cash: true,
  amanah_held_cash: true,
  amanah_released_cash: true,
  loss_non_cash: true,
  asset_purchase_cash: true,
  asset_purchase_payable: true,
  asset_depreciation: true,
  asset_disposal_cash: true,
  asset_writeoff: true,
  loan_outgoing_cash: true,
  loan_repayment_cash: true,
  loan_received_cash: true,
  loan_received_repayment_cash: true,
  deposit_retained_revenue: true,
  deposit_retained_owner: true,
} satisfies Record<FinancialEventType, true>;
