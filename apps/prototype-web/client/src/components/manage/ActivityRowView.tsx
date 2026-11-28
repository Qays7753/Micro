/**
 * M5.4 (UX §2.0 C-10 «صف الحركة» + جدول ج-١): التاريخ · النوع (بtسميته
 * الشرطية من variant/category كما قرأهما الخادم من payload) · الاسم أو
 * الوصف · المبلغ بـ3 منازل · الصندوق (مع صندوقين) · «معدَّلة»/«ملغاة» ·
 * صف البيع يعرض حالة الطلب · المصروف ذو التوصيل «منها توصيل {amount}».
 *
 * كل قيمة نص جاهز من الأب (قراءة الخادم)؛ المكوّن عرض خالص — لا حساب
 * ولا تحويل. كبسة الصف حسب C-10 يقررها الأب (حسب نوعها).
 */
import { useLocation } from "wouter";
import { t, type ManageStringKey } from "@/application/manage/strings";
import { fill, formatDateR21 } from "@/application/manage/presentation";
import { saleStatusText } from "@/components/manage/OrderRow";
import type { ActivityRow } from "@/application/manage/api";

/** تسميات جدول ج-١ الثابتة — الشرطية عبر variant/category. */
const KIND_LABELS: Readonly<Record<string, ManageStringKey>> = {
  "OP-SETUP": "rep.opening",
  "OP-ADD-BOX": "rep.opening",
  "OP-SALE-CREATE": "op.sale",
  "OP-PREPAYMENT": "a.prepayment",
  "OP-DELIVER": "op.deliver",
  "OP-CANCEL-SALE": "op.cancel_sale",
  "OP-RETURN": "a.return",
  "OP-PRICE-CORRECTION": "a.price_correction",
  "OP-UNDO-DELIVERY": "a.undo_delivery",
  "OP-COLLECT": "op.collect",
  "OP-WRITE-OFF": "f.short_writeoff",
  "OP-PAY": "op.pay",
  "OP-OWNER-DEPOSIT": "op.deposit",
  "OP-OWNER-WITHDRAWAL": "op.withdraw",
  "OP-TRANSFER": "op.transfer",
  "OP-RECONCILE": "op.reconcile",
};

/** التسمية الشرطية لجدول ج-١: السابق والإيداع المستدان والسلفة. */
export function activityKindText(row: ActivityRow): string {
  if (row.kind === "OP-ADD-PRIOR-BALANCE") {
    return t(row.variant === "by_me" ? "f.prior_payable" : "f.prior_receivable");
  }
  if (row.kind === "OP-OWNER-DEPOSIT" && row.variant === "borrowed") {
    return t("f.source_borrowed");
  }
  if (row.kind === "OP-OWNER-WITHDRAWAL" && row.variant === "loan_given") {
    return t("f.withdraw_loan");
  }
  /* صف المصروف: تسميته تصنيفه §10.2 (وتوصيل الطلب تصنيف داخلي). */
  if (row.kind === "OP-EXPENSE" || row.kind === "OP-SALE-DELIVERY-COST") {
    const category = row.category ?? "other";
    const key = category as ManageStringKey;
    return t(key);
  }
  const key = KIND_LABELS[row.kind];
  if (key !== undefined) return t(key);
  if (row.kind === "OP-MERGE-BOXES") return t("a.merge");
  if (row.kind === "OP-SPLIT-BOXES") return t("a.split");
  return row.kind;
}

export interface ActivityRowViewProps {
  row: ActivityRow;
  /** الصندوق يعرض مع صندوقين فقط (C-10). */
  twoBoxes: boolean;
  /** كبسة الصف: وجهتها حسب النوع (C-10: البيع ← P-21، غيره ← P-42). */
  onOpen?: (row: ActivityRow) => void;
}

export function ActivityRowView({ row, twoBoxes, onOpen }: ActivityRowViewProps) {
  const [, navigate] = useLocation();
  /* C-10: صف «بيع أو طلب» غير مجمّع ← P-21 (بمعرف الطلب)؛ غيره ← P-42. */
  function open(): void {
    if (onOpen !== undefined) {
      onOpen(row);
      return;
    }
    if (row.kind === "OP-SALE-CREATE" && row.saleId !== null) {
      navigate(`/manage/sale/${row.saleId}`);
      return;
    }
    navigate(`/manage/activity/${row.operationId}`);
  }
  return (
    <button type="button" className="micro-manage-row" onClick={open}>
      <span className="micro-manage-row__main">
        <span className="micro-manage-row__title">
          {activityKindText(row)}
          {row.saleStatus !== null ? ` · ${saleStatusText(row.saleStatus)}` : ""}
          {row.corrected ? ` · ${t("l.edited")}` : ""}
          {row.cancelled ? ` · ${t("l.cancelled_op")}` : ""}
        </span>
        {row.amountText !== null ? <span className="micro-manage-row__amount">{row.amountText}</span> : null}
      </span>
      <span className="micro-manage-row__meta">
        {formatDateR21(row.effectiveOn)}
        {row.name !== null ? ` · ${row.name}` : ""}
        {twoBoxes && row.boxKind !== null
          ? ` · ${row.boxKind === "cash" ? t("f.cash") : t("f.account")}`
          : ""}
      </span>
      {row.deliveryCostText !== null ? (
        <span className="micro-manage-row__meta">
          {fill("l.delivery_part", { amount: row.deliveryCostText })}
        </span>
      ) : null}
    </button>
  );
}
