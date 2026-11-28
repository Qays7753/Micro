/**
 * M5.6 (UX P-42 «تفاصيل الحركة» + P-43 «النسخ السابقة» + ج-1): تفاصيل
 * الحركة بمحتواها الثمانية وأزرارها الحرفية — والصف المجمّع (R-28) يعرض
 * أولًا قائمة عملياته وكبسة أي وحدة تفتح تفاصيلها. «النسخ السابقة» قسم
 * قراءة أسفل الصفحة (نفس المحتوى 1–6 لكل نسخة، الأحدث أولًا).
 *
 * سطح قراءة يبقي الشريط (U-005). مسار المجمّع: id ببادئة «group-».
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Button, EmptyState, Notice } from "@/components/primitives";
import { ActivityRowView } from "@/components/manage/ActivityRowView";
import { t, type ManageStringKey } from "@/application/manage/strings";
import { formatDateR21, fill } from "@/application/manage/presentation";
import {
  fetchActivityLog,
  fetchManageFigures,
  fetchOperationDetails,
  isNetworkFailure,
  type ActivityCompoundRow,
  type OperationVersion,
} from "@/application/manage/api";

/** الأنواع القابلة للتعديل والإلغاء العامّين (جدول P-42). */
const EDITABLE_KINDS: ReadonlySet<string> = new Set([
  "OP-PREPAYMENT",
  "OP-COLLECT",
  "OP-PAY",
  "OP-EXPENSE",
  "OP-SALE-DELIVERY-COST",
  "OP-OWNER-DEPOSIT",
  "OP-OWNER-WITHDRAWAL",
  "OP-TRANSFER",
  "OP-WRITE-OFF",
  "OP-RETURN",
  "OP-ADD-PRIOR-BALANCE",
]);

/** نموذج التصحيح لكل نوع قابل للتعديل (جدول P-42 — روابط M5.8/M5.9). */
const CORRECT_FORMS: Readonly<Record<string, string>> = {
  "OP-PREPAYMENT": "/manage/op/prepayment",
  "OP-COLLECT": "/manage/op/collect",
  "OP-PAY": "/manage/op/collect",
  "OP-EXPENSE": "/manage/op/expense",
  "OP-SALE-DELIVERY-COST": "/manage/op/sale-delivery",
  "OP-OWNER-DEPOSIT": "/manage/op/owner",
  "OP-OWNER-WITHDRAWAL": "/manage/op/owner",
  "OP-TRANSFER": "/manage/op/transfer",
  "OP-WRITE-OFF": "/manage/op/write-off",
  "OP-RETURN": "/manage/op/return",
  "OP-ADD-PRIOR-BALANCE": "/manage/balances/add-prior",
};

type DetailState =
  | { phase: "loading" }
  | { phase: "missing" }
  | { phase: "error"; message: string }
  | {
      phase: "ready";
      kind: "operation";
      details: OperationVersion & { previousVersions: OperationVersion[] };
      twoBoxes: boolean;
    }
  | { phase: "ready"; kind: "group"; group: ActivityCompoundRow; twoBoxes: boolean };

export default function ActivityDetailPage() {
  const [, navigate] = useLocation();
  const routeParams = useParams<{ id: string }>();
  const id = routeParams.id ?? "";
  const [state, setState] = useState<DetailState>({ phase: "loading" });

  const load = useCallback(async () => {
    setState({ phase: "loading" });
    try {
      const figures = await fetchManageFigures("month");
      const twoBoxes = figures.boxes.filter(box => box.status === "active").length > 1;
      if (id.startsWith("group-")) {
        const groupId = decodeURIComponent(id.slice("group-".length));
        const log = await fetchActivityLog({ period: "since_start" });
        const group = log.rows.find(row => row.compound && row.groupId === groupId) as
          ActivityCompoundRow | undefined;
        if (group === undefined) {
          setState({ phase: "missing" });
          return;
        }
        setState({ phase: "ready", kind: "group", group, twoBoxes });
        return;
      }
      setState({
        phase: "ready",
        kind: "operation",
        details: await fetchOperationDetails(id),
        twoBoxes,
      });
    } catch (error) {
      if (isNetworkFailure(error)) {
        setState({ phase: "error", message: t("E-OFFLINE") });
        return;
      }
      /* 404 الموحّد (R-24): فراغ صادق + رجوع. */
      setState({ phase: "missing" });
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  if (state.phase === "loading") {
    return (
      <div className="micro-manage-page" aria-busy="true">
        <span className="micro-manage-page__loading" />
      </div>
    );
  }
  if (state.phase === "error") {
    return (
      <div className="micro-manage-page">
        <Notice tone="error" role="alert">
          {state.message}
        </Notice>
        <Button action="secondary" onClick={() => void load()}>
          {t("a.ok")}
        </Button>
      </div>
    );
  }
  if (state.phase === "missing") {
    return (
      <div className="micro-manage-page">
        <EmptyState title={t("e.empty_search")}>
          <Button action="secondary" onClick={() => navigate("/manage/activity")}>
            {t("a.back")}
          </Button>
        </EmptyState>
      </div>
    );
  }

  /* الصف المجمّع (R-28): قائمة عملياته أولًا — كبسة أي وحدة تفتح تفاصيلها. */
  if (state.kind === "group") {
    return (
      <div className="micro-manage-page">
        <header className="micro-manage-head">
          <h1 className="micro-manage-head__title">{t(state.group.labelKey)}</h1>
        </header>
        <section className="micro-manage-section">
          <h2 className="micro-manage-section__title">{t("s.activity")}</h2>
          <div className="micro-manage-rows">
            {state.group.members.map(member => (
              <button
                key={member.operationId}
                type="button"
                className="micro-manage-row"
                onClick={() => navigate(`/manage/activity/${member.operationId}`)}
              >
                <span className="micro-manage-row__main">
                  <span className="micro-manage-row__title">
                    {kindText(member.kind)}
                    {member.corrected ? ` · ${t("l.edited")}` : ""}
                    {member.cancelled ? ` · ${t("l.cancelled_op")}` : ""}
                  </span>
                  {member.amountText !== null ? (
                    <span className="micro-manage-row__amount">{member.amountText}</span>
                  ) : null}
                </span>
                <span className="micro-manage-row__meta">{formatDateR21(state.group.effectiveOn)}</span>
              </button>
            ))}
          </div>
        </section>
        <Button action="secondary" onClick={() => navigate("/manage/activity")}>
          {t("a.back")}
        </Button>
      </div>
    );
  }

  const details = state.details;
  return (
    <div className="micro-manage-page">
      <header className="micro-manage-head">
        <h1 className="micro-manage-head__title">{kindText(details.kind)}</h1>
      </header>

      <section className="micro-manage-card">
        {/* 1. النوع + معدَّلة/ملغاة. 2. التاريخ الفعلي. */}
        <p className="micro-manage-card__line">
          {kindText(details.kind)}
          {details.corrected ? ` · ${t("l.edited")}` : ""}
          {details.cancelled ? ` · ${t("l.cancelled_op")}` : ""}
          {" · "}
          {formatDateR21(details.effectiveOn)}
        </p>
        {/* 3. المبلغ (+ منها توصيل). */}
        {details.amountText !== null ? (
          <p className="micro-manage-card__line">
            {t("f.amount")}: {details.amountText}
          </p>
        ) : null}
        {details.deliveryCostText !== null ? (
          <p className="micro-manage-card__line micro-manage-card__line--secondary">
            {fill("l.delivery_part", { amount: details.deliveryCostText })}
          </p>
        ) : null}
        {/* 4. الصندوق (صندوقان) أو «من مالي الشخصي». */}
        {details.personalMoney ? (
          <p className="micro-manage-card__line">{t("f.personal_money")}</p>
        ) : state.twoBoxes && details.boxKind !== null ? (
          <p className="micro-manage-card__line">
            {t("f.box")}: {details.boxKind === "cash" ? t("f.cash") : t("f.account")}
          </p>
        ) : null}
        {/* 5. الاسم أو التصنيف. */}
        {details.name !== null ? (
          <p className="micro-manage-card__line">
            {t("f.name")}: {details.name}
          </p>
        ) : null}
        {details.category !== null ? (
          <p className="micro-manage-card__line">
            {t("f.category")}: {t(details.category as ManageStringKey)}
          </p>
        ) : null}
        {/* 6. الملاحظة. */}
        {details.note !== null ? (
          <p className="micro-manage-card__line micro-manage-card__line--secondary">
            {t("f.note")}: {details.note}
          </p>
        ) : null}
      </section>

      {/* 7. «فتح الطلب» إذا مرتبطة بطلب. */}
      {details.saleId !== null ? (
        <Button action="secondary" onClick={() => navigate(`/manage/sale/${details.saleId}`)}>
          {t("a.open_sale")}
        </Button>
      ) : null}

      {/* الأزرار: تعديل/إلغاء للأنواع القابلة (الفعّالة فقط) · إلغاء التسليم
       * وتصحيح السعر لتسليم فعّال · النسخ السابقة إذا معدَّلة. */}
      {!details.cancelled && EDITABLE_KINDS.has(details.kind) ? (
        <div className="micro-manage-card__actions">
          <Button
            action="secondary"
            onClick={() =>
              navigate(`${CORRECT_FORMS[details.kind] ?? "/manage/activity"}?correct=${details.operationId}`)
            }
          >
            {t("a.edit")}
          </Button>
          <Button action="secondary" onClick={() => navigate(`/manage/op/cancel/${details.operationId}`)}>
            {t("a.cancel")}
          </Button>
        </div>
      ) : null}
      {!details.cancelled && details.kind === "OP-DELIVER" ? (
        <div className="micro-manage-card__actions">
          <Button
            action="secondary"
            onClick={() => navigate(`/manage/op/undo-delivery/${details.saleId ?? ""}`)}
          >
            {t("a.undo_delivery")}
          </Button>
          <Button
            action="secondary"
            onClick={() => navigate(`/manage/op/price-correction/${details.saleId ?? ""}`)}
          >
            {t("a.price_correction")}
          </Button>
        </div>
      ) : null}

      {/* 8/P-43 — النسخ السابقة (قراءة فقط، الأحدث أولًا). */}
      {details.previousVersions.length > 0 ? (
        <section className="micro-manage-section">
          <h2 className="micro-manage-section__title">{t("l.previous_versions")}</h2>
          <div className="micro-manage-rows">
            {details.previousVersions.map(version => (
              <div key={version.operationId} className="micro-manage-row micro-manage-row--card">
                <span className="micro-manage-row__main">
                  <span className="micro-manage-row__title">
                    {kindText(version.kind)}
                    {` · ${formatDateR21(version.effectiveOn)}`}
                  </span>
                  {version.amountText !== null ? (
                    <span className="micro-manage-row__amount">{version.amountText}</span>
                  ) : null}
                </span>
                {version.name !== null ? (
                  <span className="micro-manage-row__meta">{version.name}</span>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <Button action="quiet" onClick={() => navigate("/manage/activity")}>
        {t("a.back")}
      </Button>
    </div>
  );
}

/** تسمية النوع (جدول ج-١ الشرطية) — نفس منطق صف الحركة (مصدر واحد). */
function kindText(kind: string): string {
  const map: Record<string, ManageStringKey> = {
    "OP-SETUP": "rep.opening",
    "OP-ADD-BOX": "rep.opening",
    "OP-SALE-CREATE": "op.sale",
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
    "OP-MERGE-BOXES": "a.merge",
    "OP-SPLIT-BOXES": "a.split",
  };
  return map[kind] === undefined ? kind : t(map[kind]);
}
