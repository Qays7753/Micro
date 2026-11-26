/**
 * M2.2 (§4 + §3.8 + §14.1 — مانج-في₂، الموجة E): أنواع قيود الدفتر
 * (`src/domain/manage/ledger/`) — السطح النوعي الصرف الذي يقوم عليه السجل
 * والبناء والتحقق.
 *
 * مبادئ ملزمة داخل الموديول:
 *  1. مال مانج هو `MoneyFils` (عدد صحيح آمن بالفلس — M1.7)؛ كل المقدار في
 *     الترحيلات فلس صرف، ولا تحويل وحدة واحد داخل الموديول.
 *  2. الدومين صرف خالص (§14.1): لا I/O ولا ساعة — التواريخ تمرَّر قيمًا
 *     (نص تاريخ عمان المحلي كما هو، معتمً عند التمرير)، والمعرفات مراجع
 *     مغلقة لا يفحص شكلها هنا (UUID وغيره قرار طبقة الكتابة M2.4+).
 *  3. لا معادلة §8 هنا إطلاقًا (نص المهمة): هذا الموديول يكتب القيود
 *     الصحيحة فقط؛ الأشكال تُحسب في موديول القراءة وحده (M2.11).
 *  4. الاستيراد نسبي داخل شجرة مانج حصرًا (نقاء R11/§14.3).
 */
import type { MoneyFils } from "../money/types.js";

/** حسابات الدفتر العشرة حرفيًا من §3.8 (`ledger_posting.account`). */
export type LedgerAccountId =
  "BOX" | "AR" | "AP" | "PRE" | "REV" | "EXP" | "OPEN" | "OWN_IN" | "OWN_OUT" | "UNEXP";

/** معرّفات أنواع القيود العشرين حرفيًا من §4 (`ledger_entry.entry_type`). */
export type LedgerEntryTypeId =
  | "Q1"
  | "Q2"
  | "Q3"
  | "Q4"
  | "Q5"
  | "Q6"
  | "Q7"
  | "Q8"
  | "Q9"
  | "Q10"
  | "Q11"
  | "Q12"
  | "Q13"
  | "Q14"
  | "Q15"
  | "Q16"
  | "Q17"
  | "Q18"
  | "Q19"
  | "Q20";

/**
 * اتجاه النوع = أثره على أرصدة الصناديق، مشتق ميكانيكيًا من ترحيلات §4 نفسها
 * لا باجتهاد: `in` — كل ترحيلاته على BOX موجبة؛ `out` — ترحيلاته على BOX
 * سالبة إن وُجدت (قد لا يرحّل BOX أصلًا في بعض حالاته)؛ `none` — لا يرحّل
 * إلى BOX أبدًا؛ `mixed` — يرحّل إلى BOX بالإشارتين معًا (Q14) أو بمقدار
 * مُوقَّع يختار المدخل إشارته (Q19) أو مرآة نوع آخر (Q20).
 */
export type LedgerEntryDirection = "in" | "out" | "none" | "mixed";

/** قاعدة إشارة النوع على حساب معيّن: موجب/سالب دائمًا، أو «أيّهما» (Q14/Q19/Q20). */
export type LedgerPostingSignRule = "positive" | "negative" | "either";

/** تعداد فئات المصروف الثابت R-10 (حرفيًا كما في قيد القاعدة 0018). */
export type ExpenseCategory =
  | "materials_packaging"
  | "utilities"
  | "gas"
  | "rent"
  | "transport"
  | "ads"
  | "tools"
  | "equipment"
  | "other"
  | "sale_delivery";

/** تعداد أنواع الإيراد لترحيلات REV حصرًا (§3.8، حرفيًا كما في 0018). */
export type RevenueKind = "delivery" | "kept_prepayment" | "overpayment" | "return" | "write_off";

/** أنواع أسطر الشطب `to_me` التي يفتحها Q17 (§3.6/§4). */
export type LedgerWriteOffLineKind = "sale_remainder" | "prior_receivable" | "loan_given";

/** اختيار الاسترداد النقدي/المؤجل في Q15 وQ16 (§4). */
export type LedgerRefundChoice =
  { mode: "none" } | { mode: "now"; boxId: string } | { mode: "later"; lineId: string };

/**
 * ترحيل دفتر (§3.8 `ledger_posting`) قبل إسناد مفاتيحه القاعدية: الحساب
 * والمرجع حسب الحساب وcategory لـEXP حصرًا وrev_kind لـREV حصرًا والمقدار
 * المُوقَّع بالفلس (≠ 0) — أنواع اختيارية تُحذف لا تُسند undefined.
 */
export interface LedgerPosting {
  account: LedgerAccountId;
  /** BOX→box.id · AR/AP→balance_line.id · PRE/REV→sale.id (REV يجوز إسقاطه). */
  refId?: string;
  /** EXP حصرًا (R-10)؛ يُسقط لكل حساب آخر. */
  category?: ExpenseCategory;
  /** REV حصرًا؛ يُسقط لكل حساب آخر. */
  revKind?: RevenueKind;
  /** المقدار المُوقَّع بالفلس؛ لا يجوز أن يكون صفرًا (§3.8). */
  deltaFils: MoneyFils;
}

/** قيد مُبنى جاهز للكتابة (§3.8 `ledger_entry`) مع ترحيلاته، بلا مفاتيح القاعدة. */
export interface BuiltLedgerEntry {
  entryType: LedgerEntryTypeId;
  /** تاريخ عمان المحلي للقيد؛ في Q20 هو تاريخ المعكوس نفسه (§4). */
  effectiveOn: string;
  /** Q20 حصرًا (§3.8: reverses_entry_id على Q20 فقط وبالعكس). */
  reversesEntryId?: string;
  postings: LedgerPosting[];
}

/**
 * القيد المعكوس بترحيلاته كما يمرَّر لبناء Q20 (منشؤه طبقة العمليات M2.4+).
 * النوع يسمح كتابيًا بأي معرّف نوع (مداخل غير مُدقَّقة)، والرفض وقت التشغيل:
 * Q20 على Q20 = E-REVERSE-REVERSAL (§5 OP-CANCEL-OPERATION).
 */
export interface ReversedLedgerEntry {
  id: string;
  entryType: LedgerEntryTypeId;
  effectiveOn: string;
  postings: readonly LedgerPosting[];
}

/** مدخل التحقق الخام: النوع والتاريخ وترحيلات القيد وشكل عكسه إن كان Q20. */
export interface LedgerEntryValidationInput {
  entryType: string;
  effectiveOn: string;
  reversesEntryId?: string;
  /** واجب لـQ20: نوع القيد المعكوس — رفض Q20 هنا هو E-REVERSE-REVERSAL. */
  reversedEntryType?: string;
  postings: readonly LedgerPosting[];
}

/** مدخلات بناء القيد — اتحاد مميَّز على `type`، حالة لكل نوع من أنواع §4 العشرين. */
export type LedgerEntryBuildInput =
  | { type: "Q1"; effectiveOn: string; boxId: string; amountFils: MoneyFils }
  | { type: "Q2"; effectiveOn: string; lineId: string; amountFils: MoneyFils }
  | { type: "Q3"; effectiveOn: string; lineId: string; amountFils: MoneyFils }
  | {
      type: "Q4";
      effectiveOn: string;
      boxId: string;
      saleId: string;
      amountFils: MoneyFils;
    }
  | {
      type: "Q5";
      effectiveOn: string;
      saleId: string;
      priceFils: MoneyFils;
      prepaymentFils: MoneyFils;
      /** واجب حين P > p (سطر sale_remainder الجديد). */
      remainderLineId?: string;
      /** واجب حين p > P (سطر customer_refund الجديد). */
      refundLineId?: string;
    }
  | {
      type: "Q6";
      effectiveOn: string;
      boxId: string;
      lineId: string;
      amountFils: MoneyFils;
    }
  | {
      type: "Q7";
      effectiveOn: string;
      boxId: string;
      lineId: string;
      amountFils: MoneyFils;
    }
  | {
      type: "Q8";
      effectiveOn: string;
      boxId: string;
      category: ExpenseCategory;
      amountFils: MoneyFils;
    }
  | {
      type: "Q9";
      effectiveOn: string;
      lineId: string;
      category: ExpenseCategory;
      amountFils: MoneyFils;
    }
  | { type: "Q10"; effectiveOn: string; boxId: string; amountFils: MoneyFils }
  | {
      type: "Q11";
      effectiveOn: string;
      boxId: string;
      lineId: string;
      amountFils: MoneyFils;
    }
  | { type: "Q12"; effectiveOn: string; boxId: string; amountFils: MoneyFils }
  | {
      type: "Q13";
      effectiveOn: string;
      boxId: string;
      lineId: string;
      amountFils: MoneyFils;
    }
  | {
      type: "Q14";
      effectiveOn: string;
      fromBoxId: string;
      toBoxId: string;
      amountFils: MoneyFils;
    }
  | {
      type: "Q15";
      effectiveOn: string;
      saleId: string;
      prepaymentFils: MoneyFils;
      keptFils: MoneyFils;
      refund: LedgerRefundChoice;
    }
  | {
      type: "Q16";
      effectiveOn: string;
      saleId: string;
      returnFils: MoneyFils;
      /** واجب حين x = min(r, outstanding) > 0 (سطر باقي البيع). */
      remainderLineId?: string;
      /** المستحق القائم لسطر باقي البيع يمرَّر محسوبًا من الخارج (§8.2 لا تُحسب هنا). */
      remainderOutstandingFils: MoneyFils;
      refund: LedgerRefundChoice;
    }
  | {
      type: "Q17";
      effectiveOn: string;
      lineId: string;
      lineKind: LedgerWriteOffLineKind;
      /** واجب لـsale_remainder حصرًا (§3.6: sale_id لسطر باقي البيع). */
      saleId?: string;
      amountFils: MoneyFils;
    }
  | {
      type: "Q18";
      effectiveOn: string;
      boxId: string;
      saleId: string;
      excessFils: MoneyFils;
    }
  | { type: "Q19"; effectiveOn: string; boxId: string; differenceFils: MoneyFils }
  | { type: "Q20"; reversed: ReversedLedgerEntry };
