/**
 * M5.2 (UX §2.0 C-09 «صف الطلب»): اسم العميل (أو «بدون اسم») · وصف أول
 * بند · الحالة `st.*` · «المدفوع {X} من {Y}» أو «المدفوع {X}» · زر سياقي
 * على طرفه. كبسة الصف ← P-21 (تفاصيل الطلب).
 *
 * كل قيمة تمر جاهزة من الأب (أرقام §8.2 من استجابة الخادم نصًا)؛ المكوّن
 * عرض خالص — لا حساب ولا تحويل.
 */
import { useLocation } from "wouter";
import { t, type ManageStringKey } from "@/application/manage/strings";
import { fill, jodDashboardAmount } from "@/application/manage/presentation";

/** مفتاح الحالة §6 → نص الكتالوج (st.*). */
const STATUS_KEYS: Readonly<Record<string, ManageStringKey>> = {
  scheduled: "st.scheduled",
  overdue: "st.overdue",
  delivered_unpaid: "st.delivered_unpaid",
  completed: "st.completed",
  cancelled: "st.cancelled",
};

export function saleStatusText(status: string): string {
  const key = STATUS_KEYS[status];
  return key === undefined ? status : t(key);
}

export interface OrderRowProps {
  /** معرف الطلب (مسار P-21). */
  saleId: string;
  /** اسم العميل أو null («بدون اسم» l.no_name). */
  customerName: string | null;
  /** وصف أول بند (من قراءة الخادم). */
  firstLineDescription: string;
  /** حالة §6 (st.*). */
  status: string;
  /** نص «المدفوع…» جاهز من الأب (l.paid_of/l.paid_only المستوفى). */
  paidText: string;
  /** زر سياقي على طرف الصف (اختياري): نصه الكتالوجي ووجهته. */
  action?: { labelKey: ManageStringKey; onClick: () => void };
  /** إظهار شارة الحالة (P-12 بلا شارة «متأخر» ولا ألوان تحذير — §7.2). */
  showStatus?: boolean;
}

export function OrderRow({
  saleId,
  customerName,
  firstLineDescription,
  status,
  paidText,
  action,
  showStatus = true,
}: OrderRowProps) {
  const [, navigate] = useLocation();
  return (
    <div className="micro-manage-row">
      <div className="micro-manage-row__main">
        <button
          type="button"
          className="micro-manage-row__title"
          onClick={() => navigate(`/manage/sale/${saleId}`)}
        >
          {customerName ?? t("l.no_name")}
        </button>
        {showStatus ? <span className="micro-manage-chip">{saleStatusText(status)}</span> : null}
      </div>
      <div className="micro-manage-row__meta">
        <button
          type="button"
          className="micro-manage-row__meta-text"
          onClick={() => navigate(`/manage/sale/${saleId}`)}
        >
          {firstLineDescription}
        </button>
        <span>{paidText}</span>
      </div>
      {action ? (
        <div className="micro-manage-row__actions">
          <button type="button" className="micro-manage-link" onClick={action.onClick}>
            {t(action.labelKey)}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** «المدفوع {X} من {Y}» قبل التسليم بلا سعر نهائي: «المدفوع {X}» فقط (§6).
 *  X وY بصيغة اللوحة (R-20/G-24: أرقام «مشروعي الآن» مثل جمل اللوحة). */
export function paidOfText(paidFils: number, ofFils: number | null): string {
  return ofFils === null
    ? fill("l.paid_only", { X: jodDashboardAmount(paidFils) })
    : fill("l.paid_of", { X: jodDashboardAmount(paidFils), Y: jodDashboardAmount(ofFils) });
}
