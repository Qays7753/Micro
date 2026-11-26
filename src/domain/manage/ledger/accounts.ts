/**
 * M2.2 (§3.8 + R-10 — مانج-في₂، الموجة E): حسابات الدفتر العشرة وأشكال
 * الترحيل المسموحة لكل حساب — مرآة صرفية داخل المجال لقيود `ledger_posting`
 * التي فرضتها الهجرة 0018 على مستوى القاعدة (M2.1).
 *
 * الغاية: القيد السيئ يُرفض في الموديول قبل أي وصول إلى القاعدة (البند
 * المؤجَّل من M2.1 إلى هنا)؛ ما ترفضه القاعدة يرفضه المجال أولًا بنفس
 * القواعد الحرفية: شكل ref_id حسب الحساب، وcategory لـEXP حصرًا بتعداد
 * R-10، وrev_kind لـREV حصرًا بتعداده الخمسي، وdelta ≠ 0.
 */
import type { ExpenseCategory, LedgerAccountId, RevenueKind } from "./types.js";

/** الحسابات العشرة بترتيب §3.8 الحرفي. */
export const LEDGER_ACCOUNTS: readonly LedgerAccountId[] = [
  "BOX",
  "AR",
  "AP",
  "PRE",
  "REV",
  "EXP",
  "OPEN",
  "OWN_IN",
  "OWN_OUT",
  "UNEXP",
];

/**
 * شكل الحساب من ترحيلاته (§3.8 حرفيًا):
 *  - refId: `required` (BOX/AR/AP/PRE — مرجع واجب) · `optional` (REV —
 *    sale_id يجوز إسقاطه) · `forbidden` (البقية — لا مرجع إطلاقًا).
 *  - categoryAllowed: EXP وحده يحمل فئة (R-10).
 *  - revKindAllowed: REV وحده يحمل نوع الإيراد.
 */
export interface LedgerAccountShape {
  refId: "required" | "optional" | "forbidden";
  categoryAllowed: boolean;
  revKindAllowed: boolean;
}

/** أشكال الحسابات العشرة حرفيًا من §3.8 (قيد الشكل في 0018). */
export const LEDGER_ACCOUNT_SHAPES: Readonly<Record<LedgerAccountId, LedgerAccountShape>> = {
  BOX: { refId: "required", categoryAllowed: false, revKindAllowed: false },
  AR: { refId: "required", categoryAllowed: false, revKindAllowed: false },
  AP: { refId: "required", categoryAllowed: false, revKindAllowed: false },
  PRE: { refId: "required", categoryAllowed: false, revKindAllowed: false },
  REV: { refId: "optional", categoryAllowed: false, revKindAllowed: true },
  EXP: { refId: "forbidden", categoryAllowed: true, revKindAllowed: false },
  OPEN: { refId: "forbidden", categoryAllowed: false, revKindAllowed: false },
  OWN_IN: { refId: "forbidden", categoryAllowed: false, revKindAllowed: false },
  OWN_OUT: { refId: "forbidden", categoryAllowed: false, revKindAllowed: false },
  UNEXP: { refId: "forbidden", categoryAllowed: false, revKindAllowed: false },
};

/** تعداد فئات المصروف R-10 الثابت (حرفيًا كما في قيد القاعدة 0018). */
export const EXPENSE_CATEGORIES: readonly ExpenseCategory[] = [
  "materials_packaging",
  "utilities",
  "gas",
  "rent",
  "transport",
  "ads",
  "tools",
  "equipment",
  "other",
  "sale_delivery",
];

/** تعداد أنواع الإيراد الخمسي لترحيلات REV (§3.8 حرفيًا). */
export const REVENUE_KINDS: readonly RevenueKind[] = [
  "delivery",
  "kept_prepayment",
  "overpayment",
  "return",
  "write_off",
];

/** هل القيمة من تعداد فئات المصروف R-10؟ (فحص وقت تشغيل لمدخلات غير مُدقَّقة). */
export function isExpenseCategory(value: string): value is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}

/** هل القيمة من تعداد أنواع الإيراد؟ (فحص وقت تشغيل لمدخلات غير مُدقَّقة). */
export function isRevenueKind(value: string): value is RevenueKind {
  return (REVENUE_KINDS as readonly string[]).includes(value);
}
