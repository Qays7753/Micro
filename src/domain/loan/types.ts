/**
 * المجموعة ٤ (عقد ٢٩ — القروض الصادرة): «الدَّين ليس مصروفًا» — إقراض شخص مالًا
 * يحوّل الكاش إلى ذمّة لصالح المشروع، لا يخفض الربح ولا يخصم من مصروف ولا من
 * مال المالك. السجل يحمل العقد (المستدين، الأصل، التاريخ) وسجل الدفعات؛
 * المتبقي قراءة مشتقة من الأحداث النشطة — لا يُخزن رصيد ولا يُخمَّن.
 */
import type { MoneyMinor } from "../shared/index.js";

export type LoanRepaymentRecord = {
  id: string;
  amountMinor: MoneyMinor;
  date: string;
  note: string | null;
  /* ربط حدث السداد المالي — الحقيقة المالية للدفعة. */
  eventId: string;
  /* تراجع موثق للدفعة: السبب والوقت وربط حدث التراجع؛ null = دفعة قائمة. */
  reversal: { reason: string; at: string; reversalEventId: string } | null;
};

export type LoanRecord = {
  id: string;
  borrowerName: string;
  principalMinor: MoneyMinor;
  loanDate: string;
  /* سبب أو سياق القرض — نص حر اختياري للعرض فقط. */
  purposeNote: string | null;
  /* مصدر المال (اسم محفظة/صندوق كما اختاره المالك) — وسم معلوماتي لا حركة محفظة. */
  sourceWalletId: string | null;
  /* ربط حدث إخراج أصل القرض. */
  principalEventId: string;
  repayments: readonly LoanRepaymentRecord[];
  /* تعديلات موثقة على بيانات القرض (المبلغ/المستدين) — التاريخ يبقى. */
  corrections: readonly { reason: string; at: string }[];
  operationKey: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateLoanRecordInput = {
  id: string;
  borrowerName: string;
  principalMinor: MoneyMinor;
  loanDate: string;
  purposeNote?: string | null;
  sourceWalletId?: string | null;
  principalEventId: string;
  operationKey: string;
  createdAt: string;
};

export type LoanStatus = "open" | "settled";

export type LoanReading = {
  status: LoanStatus;
  principalMinor: number;
  repaidActiveMinor: number;
  outstandingMinor: number;
  repaymentCount: number;
};

export type AddLoanRepaymentInput = {
  repaymentId: string;
  amountMinor: MoneyMinor;
  date: string;
  note?: string | null;
  eventId: string;
};
