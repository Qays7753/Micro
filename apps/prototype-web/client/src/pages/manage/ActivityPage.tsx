/**
 * M5.6 (UX P-41 «الحركات» + ج-١ + R-28): السجل الكامل — بحث بالاسم وفلتر
 * النوع وفلتر الفترة (C-06)، والقائمة الأحدث أولًا صفوف C-10 مع الصفوف
 * المجمّعة (R-28: مبلغها حسب القاعدة وتطابق فلتر أي جزء من أجزائها).
 *
 * سطح قراءة يبقي الشريط (U-005). الفلاتر تُطبق في الخادم والاستجابة
 * تُستهلك كما هي — لا بحث ولا تصنيف في العميل.
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Button, ChoiceRow, ChoiceButton, EmptyState, Notice } from "@/components/primitives";
import { ActivityRowView } from "@/components/manage/ActivityRowView";
import { t, type ManageStringKey } from "@/application/manage/strings";
import { formatDateR21 } from "@/application/manage/presentation";
import { saleStatusText } from "@/components/manage/OrderRow";
import {
  fetchActivityLog,
  fetchManageFigures,
  isNetworkFailure,
  type ActivityLogRow,
  type ManageFiguresResponse,
  type ManagePeriod,
} from "@/application/manage/api";

const PERIODS: ReadonlyArray<{ kind: ManagePeriod; key: ManageStringKey }> = [
  { kind: "week", key: "p.week" },
  { kind: "month", key: "p.month" },
  { kind: "year", key: "p.year" },
  { kind: "since_start", key: "p.all" },
];

/** مجموعات فلتر النوع (ج-١) بترتيب الجدول. */
const TYPE_FILTERS: ReadonlyArray<{ key: ManageStringKey }> = [
  { key: "t.all" },
  { key: "rep.opening" },
  { key: "op.sale" },
  { key: "op.collect" },
  { key: "op.pay" },
  { key: "op.expense" },
  { key: "op.deposit" },
  { key: "op.withdraw" },
  { key: "op.transfer" },
  { key: "op.reconcile" },
];

type ActivityState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; rows: ActivityLogRow[]; twoBoxes: boolean };

/** الفلاتر من الوصل (تُعاد كتابتها عند التغيير — الوصل يحمل الحالة). */
function filtersOf(search: string): { search: string; type: ManageStringKey; period: ManagePeriod } {
  const params = new URLSearchParams(search);
  const type = params.get("type");
  const period = params.get("period");
  const isType = TYPE_FILTERS.some(f => f.key === type);
  return {
    search: params.get("search") ?? "",
    type: isType ? (type as ManageStringKey) : "t.all",
    period: (["week", "month", "year", "since_start"] as const).includes(period as ManagePeriod)
      ? (period as ManagePeriod)
      : "since_start",
  };
}

export default function ActivityPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const [state, setState] = useState<ActivityState>({ phase: "loading" });
  const filters = filtersOf(search);

  const load = useCallback(async () => {
    setState({ phase: "loading" });
    try {
      const [log, figures]: [{ rows: ActivityLogRow[] }, ManageFiguresResponse] = await Promise.all([
        fetchActivityLog({
          search: filters.search.length > 0 ? filters.search : undefined,
          type: filters.type === "t.all" ? "all" : (filters.type as never),
          period: filters.period,
        }),
        fetchManageFigures("month"),
      ]);
      const twoBoxes = figures.boxes.filter(box => box.status === "active").length > 1;
      setState({ phase: "ready", rows: log.rows, twoBoxes });
    } catch (error) {
      if (isNetworkFailure(error)) {
        setState({ phase: "error", message: t("E-OFFLINE") });
        return;
      }
      navigate("/manage/start");
    }
  }, [navigate, filters.search, filters.type, filters.period]);
  useEffect(() => {
    void load();
  }, [load]);

  function setFilter(patch: Record<string, string>): void {
    const params = new URLSearchParams(search);
    for (const [key, value] of Object.entries(patch)) {
      if (value.length === 0) params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    navigate(`/manage/activity${query.length > 0 ? `?${query}` : ""}`);
  }

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

  const hasSearch = filters.search.trim().length > 0;
  const emptyText = hasSearch ? "e.empty_search" : "e.empty_activity";

  return (
    <div className="micro-manage-page">
      <header className="micro-manage-head">
        <h1 className="micro-manage-head__title">{t("s.activity")}</h1>
      </header>

      {/* 2. بحث بالاسم. */}
      <div className="micro-manage-field">
        <input
          type="text"
          value={filters.search}
          placeholder={t("t.search")}
          className="micro-manage-field__input"
          data-testid="manage-activity-search"
          onChange={event => setFilter({ search: event.target.value })}
        />
      </div>

      {/* 3. فلتر النوع: «الكل» + مجموعات ج-١. */}
      <div className="micro-manage-activity-filters" role="group" aria-label={t("t.filter_type")}>
        <p className="micro-manage-section__title">{t("t.filter_type")}</p>
        <ChoiceRow>
          {TYPE_FILTERS.map(item => (
            <ChoiceButton
              key={item.key}
              selected={filters.type === item.key}
              onClick={() => setFilter({ type: item.key === "t.all" ? "" : item.key })}
            >
              {t(item.key)}
            </ChoiceButton>
          ))}
        </ChoiceRow>
      </div>

      {/* 4. فلتر الفترة (C-06) — الافتراضي «منذ البداية». */}
      <div role="group" aria-label={t("t.filter_period")}>
        <p className="micro-manage-section__title">{t("t.filter_period")}</p>
        <ChoiceRow>
          {PERIODS.map(item => (
            <ChoiceButton
              key={item.kind}
              selected={filters.period === item.kind}
              onClick={() => setFilter({ period: item.kind })}
            >
              {t(item.key)}
            </ChoiceButton>
          ))}
        </ChoiceRow>
      </div>

      {/* 5. القائمة — الأحدث أولًا صفوف C-10 (المجمّعة بمعرّفها). */}
      {state.rows.length === 0 ? (
        <EmptyState title={t(emptyText)} />
      ) : (
        <div className="micro-manage-rows">
          {state.rows.map(row =>
            row.compound ? (
              <button
                key={`group-${row.groupId}`}
                type="button"
                className="micro-manage-row"
                onClick={() => navigate(`/manage/activity/group-${encodeURIComponent(row.groupId)}`)}
              >
                <span className="micro-manage-row__main">
                  <span className="micro-manage-row__title">
                    {t(row.labelKey)}
                    {row.saleStatus !== null ? ` · ${saleStatusText(row.saleStatus)}` : ""}
                    {row.corrected ? ` · ${t("l.edited")}` : ""}
                  </span>
                  {row.amountText !== null ? (
                    <span className="micro-manage-row__amount">{row.amountText}</span>
                  ) : null}
                </span>
                <span className="micro-manage-row__meta">
                  {formatDateR21(row.effectiveOn)}
                  {row.name !== null ? ` · ${row.name}` : ""}
                </span>
              </button>
            ) : (
              <ActivityRowView key={row.operationId} row={row} twoBoxes={state.twoBoxes} />
            ),
          )}
        </div>
      )}
    </div>
  );
}
