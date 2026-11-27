/**
 * M5.3 (UX P-21 «تفاصيل الطلب» + §6): كل شي عن الطلب وكل إجراء متاح عليه
 * حسب حالته — الرأس (الاسم + الحالة + تعديل + ⋯)، الدفع وخط الرد المفتوح،
 * الربح المتوقع، التواريخ (المخطط/الفعلي/التسجيل/آخر تعديل)، البنود،
 * السعر النهائي، تكلفة التوصيل (+ إضافة)، الملاحظة، السجل المالي (صفوف
 * C-10: التاريخ والنوع والمبلغ والصندوق مع صندوقين)، المتتبّع (الحذف
 * والإضافة من هنا وحده)، وشريط الإجراءات (أساسي واحد حسب الحالة والباقي
 * في ⋯).
 *
 * كل رقم من استجابة الخادم كما هي (صفر حساب)؛ أزرار الحالات توجّه لنماذجها
 * (M5.8/M5.9) وروابطها القانونية.
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Edit, MoreHorizontal, Plus } from "lucide-react";
import { Button, EmptyState } from "@/components/primitives";
import { OrderRow, saleStatusText } from "@/components/manage/OrderRow";
import { t, type ManageStringKey } from "@/application/manage/strings";
import { fill, formatDateR21, jodInputText } from "@/application/manage/presentation";
import {
  addSaleToTracker,
  fetchSaleDetails,
  hideSaleFromTracker,
  type SaleDetailsResponse,
} from "@/application/manage/api";

/** أسماء أنواع السجل المالي (جدول ج-1) — المفتاح حسب العملية. */
const HISTORY_KIND_LABELS: Readonly<Record<string, ManageStringKey>> = {
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
  "OP-SALE-DELIVERY-COST": "f.delivery_cost",
};

/** نص الصندوق (C-10: «الصندوق (مع صندوقين بس)»). */
function boxText(boxKind: string): string {
  return boxKind === "cash" ? t("f.cash") : t("f.account");
}

export default function SaleDetailPage() {
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const saleId = params.id ?? "";
  const [details, setDetails] = useState<SaleDetailsResponse | null>(null);
  const [missing, setMissing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setDetails(await fetchSaleDetails(saleId));
    } catch {
      setMissing(true);
    }
  }, [saleId]);
  useEffect(() => {
    if (saleId.length > 0) void load();
    else setMissing(true);
  }, [load, saleId]);

  if (missing) {
    return (
      <div className="micro-manage-page">
        <EmptyState title={t("e.empty_search")} />
        <Button action="secondary" onClick={() => navigate("/")}>
          {t("a.back")}
        </Button>
      </div>
    );
  }
  if (details === null) {
    return (
      <div className="micro-manage-page" aria-busy="true">
        <span className="micro-manage-page__loading" />
      </div>
    );
  }

  const { sale } = details;
  const status = sale.status;
  const isScheduled = status === "scheduled" || status === "overdue";
  const isDelivered = status === "delivered_unpaid" || status === "completed";
  const hasOpenRefund = sale.customerRefundDueFils !== null;
  const twoBoxes = details.boxesCount > 1;

  /** الأزرار بحسب انتقالات §6 — الأساسي حسب الحالة والباقي بقائمة ⋯. */
  const actions: Array<{ key: ManageStringKey; to: string; primary?: boolean }> = [];
  if (isScheduled) {
    actions.push({ key: "a.deliver", to: `/manage/op/deliver/${sale.id}`, primary: true });
    actions.push({ key: "a.prepayment", to: `/manage/op/prepayment/${sale.id}` });
    actions.push({ key: "a.cancel", to: `/manage/op/cancel-sale/${sale.id}` });
  }
  if (status === "delivered_unpaid") {
    actions.push({ key: "a.collect_now", to: `/manage/op/collect?sale=${sale.id}`, primary: true });
    actions.push({ key: "f.short_writeoff", to: `/manage/op/writeoff?sale=${sale.id}` });
    actions.push({ key: "a.return", to: `/manage/op/return/${sale.id}` });
    actions.push({ key: "a.price_correction", to: `/manage/op/price-correction/${sale.id}` });
    actions.push({ key: "a.undo_delivery", to: `/manage/op/undo-delivery/${sale.id}` });
  }
  if (status === "completed") {
    actions.push({ key: "a.return", to: `/manage/op/return/${sale.id}` });
    actions.push({ key: "a.price_correction", to: `/manage/op/price-correction/${sale.id}` });
    actions.push({ key: "a.undo_delivery", to: `/manage/op/undo-delivery/${sale.id}` });
  }
  if (hasOpenRefund) {
    /* «سداد» أساسي إذا ما في غيره (مكتمل/ملغى)؛ وإلا فهو بالقائمة الثانوية. */
    actions.push({
      key: "op.pay",
      to: `/manage/op/collect?refund=${sale.id}`,
      primary: !isScheduled && status !== "delivered_unpaid",
    });
  }
  const primaryActions = actions.filter(action => action.primary);
  const secondaryActions = actions.filter(action => !action.primary);

  return (
    <div className="micro-manage-page">
      <header className="micro-manage-head">
        <h1 className="micro-manage-head__title">
          {sale.customerName ?? t("l.no_name")}{" "}
          <span className="micro-manage-chip">{saleStatusText(status)}</span>
        </h1>
        <button
          type="button"
          className="micro-manage-icon-button"
          aria-label={t("a.edit")}
          onClick={() => navigate(`/manage/op/sale?id=${sale.id}`)}
        >
          <Edit aria-hidden="true" />
        </button>
        <button
          type="button"
          className="micro-manage-icon-button"
          aria-label="⋯"
          onClick={() => setMenuOpen(open => !open)}
        >
          <MoreHorizontal aria-hidden="true" />
        </button>
      </header>

      {/* قائمة ⋯: الإجراءات الثانوية وحدها (الأساسي بشريط الإجراءات). */}
      {menuOpen && secondaryActions.length > 0 ? (
        <div className="micro-manage-rows">
          {secondaryActions.map(action => (
            <button
              key={action.key + action.to}
              type="button"
              className="micro-manage-row"
              onClick={() => navigate(action.to)}
            >
              <span className="micro-manage-row__title">{t(action.key)}</span>
            </button>
          ))}
        </div>
      ) : null}

      {/* الدفع + خط الرد المفتوح + الربح المتوقع. */}
      <section className="micro-manage-card">
        <p className="micro-manage-card__line">
          {sale.paidOfFils === null
            ? fill("l.paid_only", { X: `${jodInputText(sale.paidFils)} ${t("l.currency")}` })
            : fill("l.paid_of", {
                X: `${jodInputText(sale.paidFils)} ${t("l.currency")}`,
                Y: `${jodInputText(sale.paidOfFils)} ${t("l.currency")}`,
              })}
        </p>
        {hasOpenRefund ? (
          <p className="micro-manage-card__line">
            {fill("S-REFUND-DUE", { amount: sale.customerRefundDueText ?? "" })}
          </p>
        ) : null}
        {sale.expectedProfitFils !== null ? (
          <p className="micro-manage-card__line micro-manage-card__line--secondary">
            {t("l.expected_profit")} {jodInputText(sale.expectedProfitFils)} {t("l.currency")}
          </p>
        ) : null}
      </section>

      {/* التواريخ: المخطط والفعلي والتسجيل وآخر تعديل. */}
      <section className="micro-manage-card">
        <p className="micro-manage-card__line micro-manage-card__line--secondary">
          {t("f.planned_date")}: {formatDateR21(sale.plannedDeliveryOn)}
        </p>
        {sale.deliveredOn !== null ? (
          <p className="micro-manage-card__line micro-manage-card__line--secondary">
            {t("f.actual_date")}: {formatDateR21(sale.deliveredOn)}
          </p>
        ) : null}
        <p className="micro-manage-card__line micro-manage-card__line--secondary">
          {t("f.registered")}: {formatDateR21(sale.registeredOn)}
        </p>
        {sale.lastEditOn !== null ? (
          <p className="micro-manage-card__line micro-manage-card__line--secondary">
            {fill("l.last_edit", { date: formatDateR21(sale.lastEditOn) })}
          </p>
        ) : null}
      </section>

      {/* البنود: وصف · كمية مع الوحدة · سعر الوحدة كما أُدخل. */}
      <section className="micro-manage-section">
        <h2 className="micro-manage-section__title">{t("f.lines")}</h2>
        <div className="micro-manage-rows">
          {details.lines.map(line => (
            <div key={line.id} className="micro-manage-row">
              <span className="micro-manage-row__main">
                <span className="micro-manage-row__title">{line.description}</span>
                <span className="micro-manage-row__meta">
                  {t("f.quantity")}: {jodInputText(line.quantityMilli)}
                  {line.unitLabel !== null ? ` ${line.unitLabel}` : ""}
                </span>
              </span>
              {line.unitPriceFils !== null ? (
                <span className="micro-manage-row__meta">
                  {t("f.unit_price")}: {jodInputText(line.unitPriceFils)} {t("l.currency")}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {/* السعر النهائي. */}
      {sale.finalPriceText !== null ? (
        <section className="micro-manage-card">
          <p className="micro-manage-card__line">
            {t("f.final_price")}: {sale.finalPriceText}
          </p>
        </section>
      ) : null}

      {/* تكلفة التوصيل التي دفعتها: القسم ما دام الطلب غير ملغى (زر «+»
       * يظهر حتى مع عدم وجود حركات — P-21 §7/جدول الأزرار). */}
      {status !== "cancelled" ? (
        <section className="micro-manage-section">
          <h2 className="micro-manage-section__title">{t("f.sale_delivery")}</h2>
          {details.deliveryCosts.length > 0 ? (
            <div className="micro-manage-rows">
              {details.deliveryCosts.map(cost => (
                <button
                  key={cost.operationId}
                  type="button"
                  className="micro-manage-row"
                  onClick={() => navigate(`/manage/activity/${cost.operationId}`)}
                >
                  <span className="micro-manage-row__main">
                    <span className="micro-manage-row__title">
                      {cost.source === "personal"
                        ? t("f.personal_money")
                        : cost.source === "cash"
                          ? t("f.cash")
                          : t("f.account")}
                    </span>
                    <span className="micro-manage-row__amount">{cost.amountText}</span>
                  </span>
                  <span className="micro-manage-row__meta">{formatDateR21(cost.effectiveOn)}</span>
                </button>
              ))}
            </div>
          ) : null}
          <Button action="secondary" onClick={() => navigate(`/manage/op/sale-delivery/${sale.id}`)}>
            <Plus aria-hidden="true" /> {t("f.sale_delivery")}
          </Button>
        </section>
      ) : null}

      {/* الملاحظة. */}
      {sale.note !== null && sale.note.length > 0 ? (
        <section className="micro-manage-section">
          <h2 className="micro-manage-section__title">{t("f.note")}</h2>
          <p className="micro-manage-card__line">{sale.note}</p>
        </section>
      ) : null}

      {/* السجل المالي: صفوف C-10 — التاريخ والنوع والمبلغ والصندوق
       * (مع صندوقين فقط) ووسما «معدَّلة»/«ملغاة». */}
      {details.history.length > 0 ? (
        <section className="micro-manage-section">
          <h2 className="micro-manage-section__title">{t("s.sale_history")}</h2>
          <div className="micro-manage-rows">
            {details.history.map(entry => (
              <button
                key={entry.operationId}
                type="button"
                className="micro-manage-row"
                onClick={() => navigate(`/manage/activity/${entry.operationId}`)}
              >
                <span className="micro-manage-row__main">
                  <span className="micro-manage-row__title">
                    {HISTORY_KIND_LABELS[entry.kind] === undefined
                      ? entry.kind
                      : t(HISTORY_KIND_LABELS[entry.kind]!)}
                    {entry.corrected ? ` · ${t("l.edited")}` : ""}
                    {entry.status === "reversed" ? ` · ${t("l.cancelled_op")}` : ""}
                  </span>
                  {entry.amountText !== null ? (
                    <span className="micro-manage-row__amount">{entry.amountText}</span>
                  ) : null}
                </span>
                <span className="micro-manage-row__meta">
                  {formatDateR21(entry.effectiveOn)}
                  {twoBoxes && entry.boxKind !== null ? ` · ${boxText(entry.boxKind)}` : ""}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {/* المتتبّع: الحذف/الإضافة من هنا وحده (إخفاء بلا أثر مالي — T31). */}
      {sale.tracked && !sale.hiddenFromTracker ? (
        <Button action="quiet" onClick={() => void hideSaleFromTracker(sale.id).then(() => void load())}>
          {t("a.hide_tracker")}
        </Button>
      ) : (
        <Button action="quiet" onClick={() => void addSaleToTracker(sale.id).then(() => void load())}>
          {t("a.add_to_tracker")}
        </Button>
      )}

      {/* شريط الإجراءات: الأساسي حسب الحالة. */}
      {primaryActions.length > 0 ? (
        <div className="micro-manage-sheet__save">
          {primaryActions.map(action => (
            <Button key={action.key + action.to} action="create" block onClick={() => navigate(action.to)}>
              {t(action.key)}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
