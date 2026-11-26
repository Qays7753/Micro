/**
 * M2.2 (§4 — مانج-في₂، الموجة E): سجل أنواع القيود Q1–Q20 — «المكان الواحد»
 * الذي تُعرَّف فيه أنواع القيود وترحيلاتها (§14.2: أنواع القيود وترحيلاتها
 * موديول واحد — السجل؛ كل نوع جديد يدخل هنا مع اختبار توازنه).
 *
 * لكل نوع (كما ينص أمر المهمة): المعرف، الاسم (اسم §4 الحرفي)، الاتجاه
 * (أثره على أرصدة الصناديق من ترحيلات §4 نفسها)، الحسابات التي يجوز له
 * الترحيل إليها (من ترحيلات §4 حصرًا)، قواعد الإشارة لكل حساب (إشارات
 * ترحيلات §4 الحرفية)، وهل هو قابل للعكس (Q20 وحدها غير قابلة — §5
 * OP-CANCEL-OPERATION: E-REVERSE-REVERSAL).
 *
 * لا شيء هنا يحسب معادلة §8 — السجل بيانات وصفية وترحيلات حرفية فقط.
 */
import { LEDGER_ACCOUNTS } from "./accounts.js";
import type {
  LedgerAccountId,
  LedgerEntryDirection,
  LedgerEntryTypeId,
  LedgerPostingSignRule,
} from "./types.js";

/** البيانات الوصفية الكاملة لنوع قيد واحد. */
export interface LedgerEntryTypeSpec {
  /** المعرف الحرفي من §4 (Q1…Q20 — تعداد قيد القاعدة 0018 نفسه). */
  id: LedgerEntryTypeId;
  /** اسم §4 الحرفي (إنجليزية المصدر؛ نصوص الواجهة العربية من الكتالوج M1.8 لا من هنا). */
  name: string;
  /** أثر النوع على أرصدة الصناديق (مشتق ميكانيكيًا من ترحيلات §4 — لا اجتهاد). */
  direction: LedgerEntryDirection;
  /** الحسابات التي يجوز للنوع الترحيل إليها (مجموعة ترحيلات §4 حصرًا). */
  allowedAccounts: readonly LedgerAccountId[];
  /** قاعدة إشارة كل حساب يرحّل إليه النوع: موجب/سالب دائمًا أو «أيّهما». */
  signRules: Readonly<Partial<Record<LedgerAccountId, LedgerPostingSignRule>>>;
  /** قابل للعكس بـQ20؟ الأنواع Q1–Q19 كلها قابلة، وQ20 وحدها لا (E-REVERSE-REVERSAL). */
  reversible: boolean;
}

/** السجل: الأنواع العشرون بترتيب §4 الحرفي. */
export const LEDGER_ENTRY_TYPE_IDS: readonly LedgerEntryTypeId[] = [
  "Q1",
  "Q2",
  "Q3",
  "Q4",
  "Q5",
  "Q6",
  "Q7",
  "Q8",
  "Q9",
  "Q10",
  "Q11",
  "Q12",
  "Q13",
  "Q14",
  "Q15",
  "Q16",
  "Q17",
  "Q18",
  "Q19",
  "Q20",
];

/** خريطة السجل — مفاتيحها الأنواع العشرون بالضبط. */
export const LEDGER_ENTRY_TYPES: Readonly<Record<LedgerEntryTypeId, LedgerEntryTypeSpec>> = {
  Q1: {
    id: "Q1",
    name: "Opening box balance",
    direction: "in",
    allowedAccounts: ["BOX", "OPEN"],
    signRules: { BOX: "positive", OPEN: "positive" },
    reversible: true,
  },
  Q2: {
    id: "Q2",
    name: "Prior receivable",
    direction: "none",
    allowedAccounts: ["AR", "OPEN"],
    signRules: { AR: "positive", OPEN: "positive" },
    reversible: true,
  },
  Q3: {
    id: "Q3",
    name: "Prior payable",
    direction: "none",
    allowedAccounts: ["AP", "OPEN"],
    signRules: { AP: "positive", OPEN: "negative" },
    reversible: true,
  },
  Q4: {
    id: "Q4",
    name: "Prepayment",
    direction: "in",
    allowedAccounts: ["BOX", "PRE"],
    signRules: { BOX: "positive", PRE: "positive" },
    reversible: true,
  },
  Q5: {
    id: "Q5",
    name: "Delivery",
    direction: "none",
    allowedAccounts: ["REV", "PRE", "AR", "AP"],
    signRules: { REV: "positive", PRE: "negative", AR: "positive", AP: "positive" },
    reversible: true,
  },
  Q6: {
    id: "Q6",
    name: "Collection",
    direction: "in",
    allowedAccounts: ["BOX", "AR"],
    signRules: { BOX: "positive", AR: "negative" },
    reversible: true,
  },
  Q7: {
    id: "Q7",
    name: "Payment",
    direction: "out",
    allowedAccounts: ["BOX", "AP"],
    signRules: { BOX: "negative", AP: "negative" },
    reversible: true,
  },
  Q8: {
    id: "Q8",
    name: "Paid expense",
    direction: "out",
    allowedAccounts: ["BOX", "EXP"],
    signRules: { BOX: "negative", EXP: "positive" },
    reversible: true,
  },
  Q9: {
    id: "Q9",
    name: "Credit expense",
    direction: "none",
    allowedAccounts: ["AP", "EXP"],
    signRules: { AP: "positive", EXP: "positive" },
    reversible: true,
  },
  Q10: {
    id: "Q10",
    name: "Owner deposit",
    direction: "in",
    allowedAccounts: ["BOX", "OWN_IN"],
    signRules: { BOX: "positive", OWN_IN: "positive" },
    reversible: true,
  },
  Q11: {
    id: "Q11",
    name: "Borrow",
    direction: "in",
    allowedAccounts: ["BOX", "AP"],
    signRules: { BOX: "positive", AP: "positive" },
    reversible: true,
  },
  Q12: {
    id: "Q12",
    name: "Owner withdrawal",
    direction: "out",
    allowedAccounts: ["BOX", "OWN_OUT"],
    signRules: { BOX: "negative", OWN_OUT: "positive" },
    reversible: true,
  },
  Q13: {
    id: "Q13",
    name: "Lend",
    direction: "out",
    allowedAccounts: ["BOX", "AR"],
    signRules: { BOX: "negative", AR: "positive" },
    reversible: true,
  },
  Q14: {
    id: "Q14",
    name: "Transfer",
    direction: "mixed",
    allowedAccounts: ["BOX"],
    signRules: { BOX: "either" },
    reversible: true,
  },
  Q15: {
    id: "Q15",
    name: "Cancel sale with prepayments",
    direction: "out",
    allowedAccounts: ["PRE", "REV", "BOX", "AP"],
    signRules: { PRE: "negative", REV: "positive", BOX: "negative", AP: "positive" },
    reversible: true,
  },
  Q16: {
    id: "Q16",
    name: "Return",
    direction: "out",
    allowedAccounts: ["REV", "AR", "BOX", "AP"],
    signRules: { REV: "negative", AR: "negative", BOX: "negative", AP: "positive" },
    reversible: true,
  },
  Q17: {
    id: "Q17",
    name: "Write-off",
    direction: "none",
    allowedAccounts: ["AR", "REV", "OPEN", "OWN_OUT"],
    signRules: { AR: "negative", REV: "negative", OPEN: "negative", OWN_OUT: "positive" },
    reversible: true,
  },
  Q18: {
    id: "Q18",
    name: "Overpayment kept",
    direction: "in",
    allowedAccounts: ["BOX", "REV"],
    signRules: { BOX: "positive", REV: "positive" },
    reversible: true,
  },
  Q19: {
    id: "Q19",
    name: "Reconciliation adjustment",
    direction: "mixed",
    allowedAccounts: ["BOX", "UNEXP"],
    signRules: { BOX: "either", UNEXP: "either" },
    reversible: true,
  },
  Q20: {
    id: "Q20",
    name: "Reversal",
    direction: "mixed",
    /* مرآة أي نوع قابل للعكس — حساباته اتحاد حسابات الأنواع كلها */
    allowedAccounts: LEDGER_ACCOUNTS,
    signRules: {
      BOX: "either",
      AR: "either",
      AP: "either",
      PRE: "either",
      REV: "either",
      EXP: "either",
      OPEN: "either",
      OWN_IN: "either",
      OWN_OUT: "either",
      UNEXP: "either",
    },
    reversible: false,
  },
};

/** هل القيمة معرّف نوع قيد معروف (Q1–Q20)؟ — حارس وقت التشغيل للمدخلات الخام. */
export function isLedgerEntryTypeId(value: string): value is LedgerEntryTypeId {
  return LEDGER_ENTRY_TYPE_IDS.includes(value as LedgerEntryTypeId);
}
