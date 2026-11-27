/**
 * M5.2 (UX P-10 «مشروعي الآن» + §8/§8.2 + §7.2): صورة اللحظة وشو لازم
 * يعمل المستخدم هلأ — وجهة الفتح دائمًا.
 *
 * المحتوى بالترتيب الحرفي: الرأس (الاسم + الإعدادات) · بطاقة العودة بعد
 * الانقطاع (§7.2 — أول عنصر، تبقى حتى إكمال التدفق، لا فتح تلقائي لأي
 * صفحة) · تنبيه الرصيد السالب · الرصيد · المستحقات · الالتزامات · تذكير
 * المطابقة (R-8 — مخفي عند ظهور التنبيه السالب؛ «لاحقاً» يخفيه للجلسة
 * G-10) · طلبات اليوم والغد · الطلبات المتأخرة · المستحقات المتأخرة ·
 * الأزرار السريعة C-07.
 *
 * كل رقم من استجابات الخادم كما هي (صفر حساب): الأرصدة نصوصها الجاهزة،
 * ومؤشرات §8.2 الخام تُنسّق بطبقة العرض (R-20/G-24). تجميع اليوم/الغد
 * مقارنة نصوص تواريخ من الخادم (لا حساب مالي)؛ «الغد» بنواة التاريخ
 * المشتركة.
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Settings } from "lucide-react";
import { Button, Notice } from "@/components/primitives";
import { QuickActionBar } from "@/components/manage/QuickActionBar";
import { OrderRow, paidOfText } from "@/components/manage/OrderRow";
import { t } from "@/application/manage/strings";
import { ageTextR19, fill, jodDashboardAmount, nextLocalDate } from "@/application/manage/presentation";
import {
  detectAbsence,
  fetchManageFigures,
  fetchManageProject,
  fetchManageSaleRows,
  fetchReconciliationLog,
  isNetworkFailure,
  type ManageFiguresResponse,
  type ProjectStateResponse,
  type ReconciliationLogResponse,
  type SaleRow,
} from "@/application/manage/api";
import { todayInAmman } from "@/application/time";

/** G-10: «لاحقاً» يخفي التذكير حتى الفتح الجاي — حالة جلسة (نمط lastHomePeriod). */
let reminderDismissedThisSession = false;

type NowState =
  { phase: "loading" } | { phase: "error"; message: string } | { phase: "ready"; data: ReadyData };

interface ReadyData {
  project: ProjectStateResponse;
  figures: ManageFiguresResponse;
  log: ReconciliationLogResponse;
  rows: SaleRow[];
}

export default function NowPage() {
  const [, navigate] = useLocation();
  const [state, setState] = useState<NowState>({ phase: "loading" });

  const load = useCallback(async () => {
    setState({ phase: "loading" });
    /* §7.2-1: الكشف عند فتح التطبيق — كتابة حتمية بالحالة (المفتوح يتمدد)؛
     * فشلها الشبكي لا يمنع قراءة الصفحة (الاتصال كله خارج حينها). */
    try {
      await detectAbsence();
    } catch {
      /* honest: the reads below will tell the truth about connectivity */
    }
    try {
      const [project, figures, log, rowsResponse] = await Promise.all([
        fetchManageProject(),
        fetchManageFigures(),
        fetchReconciliationLog(),
        fetchManageSaleRows(),
      ]);
      setState({
        phase: "ready",
        data: { project, figures, log, rows: rowsResponse.sales },
      });
    } catch (error) {
      if (isNetworkFailure(error)) {
        setState({ phase: "error", message: t("E-OFFLINE") });
        return;
      }
      /* 404 الموحّد: لا مشروع مالي بعد ← P-01 (R-24). */
      navigate("/manage/start");
    }
  }, [navigate]);

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

  const { project, figures, rows } = state.data;
  const today = todayInAmman();
  const tomorrow = nextLocalDate(today);

  /* §7.3/UX: التنبيه السالب لصندوق معروف فقط (المجهول بلا تنبيه). */
  const activeBoxes = figures.boxes.filter(box => box.status === "active");
  const negativeKnown = activeBoxes.some(box => box.openingStatus === "known" && (box.balanceFils ?? 0) < 0);
  const unknownBalance = figures.flags.unknownBalance;
  const showReminder = state.data.log.due && !negativeKnown && !reminderDismissedThisSession;

  /* G-06: طلبات اليوم والغد — غير المسلَّم وغير الملغى بتاريخ التخطيط، بغض
   * النظر عن المتتبّع؛ التجميع مقارنة نص تاريخ الخادم (لا حساب مالي). */
  const openRows = rows.filter(row => row.deliveredOn === null && row.status !== "cancelled");
  const todayRows = openRows.filter(row => row.plannedDeliveryOn === today);
  const tomorrowRows = openRows.filter(row => row.plannedDeliveryOn === tomorrow);
  const overdueRows = openRows.filter(row => row.status === "overdue");
  const overdueReceivables = figures.overdueReceivables;

  const totalText = figures.totalBalance.fils === null ? "" : figures.totalBalance.textDashboard;
  const cashBox = activeBoxes.find(box => box.kind === "cash");
  const accountBox = activeBoxes.find(box => box.kind === "account");
  const twoBoxes = cashBox !== undefined && accountBox !== undefined;
  const boxText = (box: typeof cashBox): string =>
    box === undefined ? "" : box.balanceFils === null ? t("l.unknown_balance") : (box.textDashboard ?? "");
  const breakdown =
    twoBoxes && cashBox !== undefined && accountBox !== undefined
      ? `${t("f.cash")} ${boxText(cashBox)} · ${t("f.account")} ${boxText(accountBox)}`
      : null;

  return (
    <div className="micro-manage-page micro-manage-page--with-quickbar">
      {/* ١. الرأس: اسم المشروع + الإعدادات (P-11). */}
      <header className="micro-manage-head">
        <h1 className="micro-manage-head__title">{project.name}</h1>
        <button
          type="button"
          className="micro-manage-icon-button"
          aria-label={t("t.settings")}
          onClick={() => navigate("/manage/settings")}
        >
          <Settings aria-hidden="true" />
        </button>
      </header>

      {/* ٢. بطاقة العودة بعد الانقطاع (§7.2 — لا فتح تلقائي). */}
      {project.openAbsence !== null ? (
        <section className="micro-manage-card" data-testid="manage-return-card">
          <p className="micro-manage-card__line">
            {fill("r.absence_intro", { days: String(project.openAbsence.daysSinceLastRecord) })}
          </p>
          <div className="micro-manage-card__actions">
            <Button action="create" onClick={() => navigate("/manage/return/orders")}>
              {t("a.start")}
            </Button>
          </div>
        </section>
      ) : null}

      {/* ٣. تنبيه الرصيد السالب (صندوق معروف أقل من صفر — §7.3). */}
      {negativeKnown ? (
        <section className="micro-manage-card">
          <p className="micro-manage-card__line">{t("w.negative_box")}</p>
          <div className="micro-manage-card__actions">
            <Button action="create" onClick={() => navigate("/manage/reconcile")}>
              {t("a.start_recon")}
            </Button>
          </div>
        </section>
      ) : null}

      {/* ٤. الرصيد: الإجمالي + التفصيل مع صندوقين؛ المجهول مكانه. */}
      <button
        type="button"
        className="micro-manage-card micro-manage-card--clickable"
        onClick={() => navigate("/manage/boxes")}
      >
        {unknownBalance ? (
          /* N-37: جملة الرصيد المجهول الكاملة مكان جملة الرصيد. */
          <p className="micro-manage-card__line">{t("s.balance_unknown")}</p>
        ) : (
          <p className="micro-manage-card__line">{fill("s.balance", { amount: totalText })}</p>
        )}
        {twoBoxes && cashBox !== undefined && accountBox !== undefined ? (
          <p className="micro-manage-card__line micro-manage-card__line--secondary">
            {t("f.cash")} {boxText(cashBox)} · {t("f.account")} {boxText(accountBox)}
          </p>
        ) : null}
      </button>

      {/* ٥. المستحقات لك — تخفى عند الصفر. */}
      {figures.receivables.fils !== 0 ? (
        <button
          type="button"
          className="micro-manage-card micro-manage-card--clickable"
          onClick={() => navigate("/manage/balances?tab=to_me")}
        >
          <p className="micro-manage-card__line">
            {fill("s.receivables", { amount: figures.receivables.textDashboard })}
          </p>
        </button>
      ) : null}

      {/* ٦. الالتزامات عليك — N-26 بلا دفعات مقدمة؛ تخفى عند الصفر. */}
      {figures.payables.fils !== 0 ? (
        <button
          type="button"
          className="micro-manage-card micro-manage-card--clickable"
          onClick={() => navigate("/manage/balances?tab=by_me")}
        >
          <p className="micro-manage-card__line">
            {figures.payablesPrepayments.fils === 0
              ? fill("s.payables_no_pre", { amount: figures.payables.textDashboard })
              : fill("s.payables", {
                  amount: figures.payables.textDashboard,
                  pre: figures.payablesPrepayments.textDashboard,
                })}
          </p>
        </button>
      ) : null}

      {/* ٧. تذكير المطابقة (R-8) — يختفي مع التنبيه السالب؛ «لاحقاً» G-10. */}
      {showReminder ? (
        <section className="micro-manage-card" data-testid="manage-recon-reminder">
          {/* G-09 (قراءة موثقة): مع صندوق مجهول تسقط جملة «رصيدك المسجَّل…»
           * (سابقة P-50: «صفوف الصناديق بدون الجملة») — والأزرار تبقى بحكم
           * R-8؛ المطابقة هي طريق المجهول إلى المعرفة. */}
          {unknownBalance ? null : (
            <p className="micro-manage-card__line">
              {breakdown === null
                ? fill("r.prompt_single", { total: totalText })
                : fill("r.prompt", { total: totalText, breakdown })}
            </p>
          )}
          <div className="micro-manage-card__actions">
            <Button action="create" onClick={() => navigate("/manage/reconcile")}>
              {t("a.start_recon")}
            </Button>
            <Button
              action="quiet"
              onClick={() => {
                reminderDismissedThisSession = true;
                setState({ ...state });
              }}
            >
              {t("d.recon_later")}
            </Button>
          </div>
        </section>
      ) : null}

      {/* ٨. طلبات اليوم والغد (G-06). */}
      {todayRows.length > 0 || tomorrowRows.length > 0 ? (
        <section className="micro-manage-section">
          <h2 className="micro-manage-section__title">{t("s.today_orders")}</h2>
          {todayRows.length > 0 ? (
            <>
              <p className="micro-manage-section__title micro-manage-section__title--sub">{t("a.today")}</p>
              <div className="micro-manage-rows">
                {todayRows.slice(0, 5).map(row => (
                  <OrderRow
                    key={row.id}
                    saleId={row.id}
                    customerName={row.customerName}
                    firstLineDescription={row.firstLineDescription}
                    status={row.status}
                    paidText={paidOfText(row.paidFils, row.ofFils)}
                    action={{
                      labelKey: "a.deliver",
                      onClick: () => navigate(`/manage/op/deliver/${row.id}`),
                    }}
                  />
                ))}
              </div>
            </>
          ) : null}
          {tomorrowRows.length > 0 ? (
            <>
              <p className="micro-manage-section__title micro-manage-section__title--sub">
                {t("a.tomorrow")}
              </p>
              <div className="micro-manage-rows">
                {tomorrowRows.slice(0, 5).map(row => (
                  <OrderRow
                    key={row.id}
                    saleId={row.id}
                    customerName={row.customerName}
                    firstLineDescription={row.firstLineDescription}
                    status={row.status}
                    paidText={paidOfText(row.paidFils, row.ofFils)}
                  />
                ))}
              </div>
            </>
          ) : null}
          {todayRows.length > 5 ? (
            <button
              type="button"
              className="micro-manage-link"
              onClick={() => navigate(`/manage/tracker?day=${today}`)}
            >
              {t("a.view_all")}
            </button>
          ) : null}
        </section>
      ) : null}

      {/* ٩. الطلبات المتأخرة. */}
      {overdueRows.length > 0 ? (
        <section className="micro-manage-section">
          <h2 className="micro-manage-section__title">{t("s.overdue_orders")}</h2>
          <div className="micro-manage-rows">
            {overdueRows.slice(0, 5).map(row => (
              <OrderRow
                key={row.id}
                saleId={row.id}
                customerName={row.customerName}
                firstLineDescription={row.firstLineDescription}
                status={row.status}
                paidText={paidOfText(row.paidFils, row.ofFils)}
                action={{
                  labelKey: "a.deliver",
                  onClick: () => navigate(`/manage/op/deliver/${row.id}`),
                }}
              />
            ))}
          </div>
          {overdueRows.length > 5 ? (
            <button
              type="button"
              className="micro-manage-link"
              onClick={() => navigate("/manage/tracker?mode=list")}
            >
              {t("a.view_all")}
            </button>
          ) : null}
        </section>
      ) : null}

      {/* ١٠. المستحقات المتأخرة (N-05) — حد أقصى 3 + عرض الكل. */}
      {overdueReceivables.length > 0 ? (
        <section className="micro-manage-section">
          <h2 className="micro-manage-section__title">{t("s.overdue_receivables")}</h2>
          <div className="micro-manage-rows">
            {overdueReceivables.slice(0, 3).map(line => (
              <button
                key={line.lineId}
                type="button"
                className="micro-manage-row"
                onClick={() => navigate(`/manage/balances/${line.lineId}`)}
              >
                <span className="micro-manage-row__title">
                  {fill("s.overdue_receivable", {
                    name: line.counterpartyName ?? t("l.no_name"),
                    amount: jodDashboardAmount(line.outstandingFils),
                    age: ageTextR19(line.originOn, today),
                  })}
                </span>
              </button>
            ))}
          </div>
          {overdueReceivables.length > 3 ? (
            <button
              type="button"
              className="micro-manage-link"
              onClick={() => navigate("/manage/balances?tab=to_me")}
            >
              {t("a.view_all")}
            </button>
          ) : null}
        </section>
      ) : null}

      {/* ١١. الأزرار السريعة C-07 — ثابتة أسفل الشاشة. */}
      <QuickActionBar />
    </div>
  );
}
