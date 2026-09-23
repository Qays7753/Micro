/**
 * FIN-001 (WS-178 — Wave 6 — القروض المستلمة/الاقتراض): «المقترض ليس دخلًا» —
 * قبض قرض يرفع الكاش ويرفع التزامًا مستقلًا؛ ليس إيرادًا ولا ربحًا ولا مصروفًا
 * تشغيليًا ولا رأس مال مالك. السجل يحمل العقد (المُقرض ونوعه الصريح الذي اختاره
 * المستخدم — لا تخمين للنوع الاقتصادي — والأصل وتاريخ القبض والمحفظة وتاريخ
 * الاستحقاق الاختياري) وسجل الدفعات؛ المتبقي قراءة مشتقة من الدفعات القائمة —
 * لا يُخزن رصيد ولا يُخمَّن. تاريخ الاستحقاق وسم عرض فقط: لا مصروف ولا تنبيه
 * إلزامي. الفوائد والرسوم خارج هذا المسار تمامًا (تتطلب عقدًا مستقلًا).
 */
import type { MoneyMinor } from "../shared/index.js";

/** دفعة سداد أصل قرض مستلم — المبلغ والتاريخ والحدث المالي المرتبط. */
export type ReceivedLoanRepaymentRecord = {
  id: string;
  amountMinor: MoneyMinor;
  date: string;
  note: string | null;
  /* ربط حدث السداد المالي — الحقيقة المالية للدفعة. */
  eventId: string;
  /* تراجع موثق للدفعة: السبب والوقت وربط حدث التراجع؛ null = دفعة قائمة. */
  reversal: { reason: string; at: string; reversalEventId: string } | null;
};

/** نوع المُقرض — اختيار صريح من المستخدم عند الإنشاء؛ لا قيمة افتراضية. */
export type ReceivedLoanLenderType = "owner" | "person" | "institution";

export type ReceivedLoanRecord = {
  id: string;
  /* اسم المُقرض كما أدخله المستخدم. */
  lenderName: string;
  /* النوع الاقتصادي الصريح الذي اختاره المستخدم — قرض مالك/فرد/مؤسسة؛
   * لا يُخمَّن ولا يُفاضل تلقائيًا بين قرض وتحويل ورأس مال. */
  lenderType: ReceivedLoanLenderType;
  principalMinor: MoneyMinor;
  /* تاريخ قبض أصل القرض (تاريخ محلي). */
  receivedOn: string;
  /* تاريخ الاستحقاق الاختياري — وسم عرض فقط: لا مصروف ولا تنبيه إلزامي. */
  dueOn: string | null;
  /* سبب أو سياق القرض — نص حر اختياري للعرض فقط. */
  note: string | null;
  /* المحفظة التي دخل إليها المال (اسم كما اختاره المالك) — وسم معلوماتي
   * لا حركة محفظة؛ حركة الكاش من حدثها المالي وحده. */
  walletId: string | null;
  /* ربط حدث قبض أصل القرض المستلم. */
  principalEventId: string;
  repayments: readonly ReceivedLoanRepaymentRecord[];
  /* تعديلات موثقة على بيانات القرض — التاريخ يبقى. */
  corrections: readonly { reason: string; at: string }[];
  operationKey: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateReceivedLoanRecordInput = {
  id: string;
  lenderName: string;
  lenderType: ReceivedLoanLenderType;
  principalMinor: MoneyMinor;
  receivedOn: string;
  dueOn?: string | null;
  note?: string | null;
  walletId?: string | null;
  principalEventId: string;
  operationKey: string;
  createdAt: string;
};

export type ReceivedLoanStatus = "open" | "settled";

export type ReceivedLoanReading = {
  status: ReceivedLoanStatus;
  principalMinor: number;
  repaidActiveMinor: number;
  outstandingMinor: number;
  repaymentCount: number;
};

export type AddReceivedLoanRepaymentInput = {
  repaymentId: string;
  amountMinor: MoneyMinor;
  date: string;
  note?: string | null;
  eventId: string;
};
