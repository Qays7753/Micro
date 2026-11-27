/**
 * M5.3 (UX P-20 «متتبّع الطلبات» + الكونسبت §11): شو مطلوب ومتى — تقويم
 * أسبوعي (الأحد–السبت R-5) وقائمة، والمفتاح يذكر آخر اختيار (الافتراضي
 * تقويم).
 *
 * من يظهر (§11 حرفيًا): الطلبات المضافة للمتتبّع غير المخفية
 * (tracked ∧ !hidden) — أيًا كانت حالته، ولا يُحذف طلب تلقائيًا؛ المجدول
 * والمتأخر والملغى بتاريخ التسليم المخطط، والمسلَّم بتاريخ التسليم الفعلي.
 *
 * التقويم: عنوان الشهر بصيغة R-21 («11/2026») وكبسته تفتح منتقي تاريخ
 * للقفز لأي يوم؛ زر «اليوم» يظهر فقط إذا كان اليوم خارج الشريط أو غير
 * مختار. القائمة تفتح على اليوم (تمرير إليه).
 *
 * كل تاريخ عبر نواة التاريخ المشتركة (فهرس اليوم، الإزاحات) — لا حساب
 * مالي؛ الأرقام نصوص الخادم (paidOfText بقيم §8.2 الخام).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Button, ChoiceRow, ChoiceButton, EmptyState } from "@/components/primitives";
import { OrderRow, paidOfText } from "@/components/manage/OrderRow";
import { t } from "@/application/manage/strings";
import {
  formatDateR21,
  formatMonthR21,
  shiftLocalDate,
  weekStartAnchor,
} from "@/application/manage/presentation";
import { fetchManageSaleRows, type SaleRow } from "@/application/manage/api";
import { todayInAmman } from "@/application/time";

/** آخر وضع محفوظ بين الزيارات (الافتراضي تقويم). */
let lastTrackerMode: "calendar" | "list" = "calendar";

export default function TrackerPage() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(useSearch());
  /* الوضع: معامل الوصول إن وُجد (وصول «عرض الكل» من P-10) وإلا آخر
   * اختيار — والوصول الحالي نفسه يصير «آخر اختيار» (المعامل اختيار
   * المستخدم أيضاً). */
  const [mode, setMode] = useState<"calendar" | "list">(() => {
    const initial =
      params.get("mode") === "list"
        ? "list"
        : params.get("mode") === "calendar"
          ? "calendar"
          : lastTrackerMode;
    lastTrackerMode = initial;
    return initial;
  });
  const today = todayInAmman();
  const [selectedDay, setSelectedDay] = useState(params.get("day") ?? today);
  const [weekAnchor, setWeekAnchor] = useState(params.get("day") ?? today);
  const [rows, setRows] = useState<SaleRow[] | null>(null);
  const todaySection = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setRows((await fetchManageSaleRows()).sales);
  }, []);
  useEffect(() => {
    load().catch(() => setRows([]));
  }, [load]);

  /* من يظهر: المتتبّع غير المخفي بأي حالة (§11 — الملغى يبقى بمخطط تسليمه). */
  const visible = useMemo(() => (rows ?? []).filter(row => row.tracked && !row.hiddenFromTracker), [rows]);
  const byDay = useMemo(() => {
    const map = new Map<string, SaleRow[]>();
    for (const row of visible) {
      const day = row.deliveredOn ?? row.plannedDeliveryOn;
      const list = map.get(day) ?? [];
      list.push(row);
      map.set(day, list);
    }
    return map;
  }, [visible]);

  /* شريط الأسبوع: الأحد أولًا (R-5) — عبر بوابة العرض (STR-106). */
  const weekDays = useMemo(() => {
    const sunday = weekStartAnchor(weekAnchor);
    return Array.from({ length: 7 }, (_, i) => shiftLocalDate(sunday, i));
  }, [weekAnchor]);

  const selectedRows = byDay.get(selectedDay) ?? [];
  /* المتأخرة مثبتة أول القائمة — ولا تتكرر داخل مجموعات التاريخ (القراءة
   * المجموعة للمواصفة: مجموعة التثبيت تحل مكان مجموعة تاريخها) — أيام
   * القائمة من الصفوف غير المتأخرة وحدها (لا مجموعة فارغة ليوم متأخره). */
  const overdueRows = visible.filter(row => row.status === "overdue");
  const overdueIds = new Set(overdueRows.map(row => row.id));
  const listDays = useMemo(() => {
    const days = new Set<string>();
    for (const row of visible) {
      if (overdueIds.has(row.id)) continue;
      const day = row.deliveredOn ?? row.plannedDeliveryOn;
      if (day.length > 0) days.add(day);
    }
    return [...days].sort();
  }, [visible, overdueIds]);
  const todayVisible = weekDays.includes(today);

  /* القائمة تفتح على اليوم: تمرير إلى مجموعته بعد الرسم (إن وُجدت) —
   * النداء الاختياري يحرس بيئات بلا تمرير (jsdom). */
  useEffect(() => {
    if (mode === "list" && rows !== null) {
      todaySection.current?.scrollIntoView?.({ block: "start" });
    }
  }, [mode, rows]);

  /** زر الصف حسب الحالة: «تم التسليم» للمجدول/المتأخر، «تحصيل» للمسلَّم غير المدفوع. */
  function rowAction(row: SaleRow) {
    if (row.status === "scheduled" || row.status === "overdue") {
      return {
        labelKey: "a.deliver" as const,
        onClick: () => navigate(`/manage/op/deliver/${row.id}`),
      };
    }
    if (row.status === "delivered_unpaid") {
      return {
        labelKey: "a.collect_now" as const,
        onClick: () => navigate(`/manage/op/collect?sale=${row.id}`),
      };
    }
    return undefined;
  }

  return (
    <div className="micro-manage-page">
      <header className="micro-manage-head">
        <h1 className="micro-manage-head__title">{t("s.tracker")}</h1>
        <Button action="secondary" onClick={() => navigate("/manage/products")}>
          {t("s.products")}
        </Button>
        <Button action="create" onClick={() => navigate("/manage/op/sale")}>
          {t("t.new_order")}
        </Button>
      </header>

      <ChoiceRow>
        <ChoiceButton
          selected={mode === "calendar"}
          onClick={() => {
            setMode("calendar");
            lastTrackerMode = "calendar";
          }}
        >
          {t("t.calendar")}
        </ChoiceButton>
        <ChoiceButton
          selected={mode === "list"}
          onClick={() => {
            setMode("list");
            lastTrackerMode = "list";
          }}
        >
          {t("t.list")}
        </ChoiceButton>
      </ChoiceRow>

      {rows === null ? (
        <span className="micro-manage-page__loading" />
      ) : mode === "calendar" ? (
        <>
          <div className="micro-manage-week">
            <div className="micro-manage-week__head">
              <button
                type="button"
                className="micro-manage-icon-button"
                aria-label={t("a.back")}
                onClick={() => setWeekAnchor(shiftLocalDate(weekDays[0]!, -7))}
              >
                ‹
              </button>
              {/* عنوان الشهر R-21 — كبسته تفتح منتقي التاريخ للقفز لأي يوم. */}
              <label className="micro-manage-week__month">
                {formatMonthR21(selectedDay)}
                <input
                  type="date"
                  className="micro-manage-week__picker"
                  value={selectedDay}
                  onChange={event => {
                    if (event.target.value.length > 0) {
                      setSelectedDay(event.target.value);
                      setWeekAnchor(event.target.value);
                    }
                  }}
                />
              </label>
              <button
                type="button"
                className="micro-manage-icon-button"
                aria-label={t("a.next")}
                onClick={() => setWeekAnchor(shiftLocalDate(weekDays[6]!, 1))}
              >
                ›
              </button>
            </div>
            <div className="micro-manage-week__days" role="grid">
              {weekDays.map(day => (
                <button
                  key={day}
                  type="button"
                  className={
                    "micro-manage-week__day" +
                    (day === today ? " micro-manage-week__day--today" : "") +
                    (day === selectedDay ? " micro-manage-week__day--selected" : "")
                  }
                  onClick={() => setSelectedDay(day)}
                >
                  <span>{day.slice(8, 10)}</span>
                  {(byDay.get(day) ?? []).length > 0 ? (
                    <span className="micro-manage-week__dot" aria-hidden="true" />
                  ) : null}
                </button>
              ))}
            </div>
            {/* «اليوم» يظهر فقط إذا كان اليوم خارج الشريط أو غير مختار. */}
            {!todayVisible || selectedDay !== today ? (
              <Button
                action="secondary"
                onClick={() => {
                  setSelectedDay(today);
                  setWeekAnchor(today);
                }}
              >
                {t("a.today")}
              </Button>
            ) : null}
          </div>
          {selectedRows.length === 0 ? (
            <EmptyState title={t("e.empty_orders_day")} />
          ) : (
            <div className="micro-manage-rows">
              {selectedRows.map(row => (
                <OrderRow
                  key={row.id}
                  saleId={row.id}
                  customerName={row.customerName}
                  firstLineDescription={row.firstLineDescription}
                  status={row.status}
                  paidText={paidOfText(row.paidFils, row.ofFils)}
                  action={rowAction(row)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {visible.length === 0 ? (
            <EmptyState title={t("e.empty_tracker")} />
          ) : (
            <>
              {overdueRows.length > 0 ? (
                <section className="micro-manage-section">
                  <h2 className="micro-manage-section__title">{t("s.overdue_orders")}</h2>
                  <div className="micro-manage-rows">
                    {overdueRows.map(row => (
                      <OrderRow
                        key={row.id}
                        saleId={row.id}
                        customerName={row.customerName}
                        firstLineDescription={row.firstLineDescription}
                        status={row.status}
                        paidText={paidOfText(row.paidFils, row.ofFils)}
                        action={rowAction(row)}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
              {listDays.map(day => (
                <section
                  key={day}
                  ref={day === today ? todaySection : undefined}
                  className="micro-manage-section"
                >
                  <h2 className="micro-manage-section__title">{formatDateR21(day)}</h2>
                  <div className="micro-manage-rows">
                    {(byDay.get(day) ?? [])
                      .filter(row => !overdueIds.has(row.id))
                      .map(row => (
                        <OrderRow
                          key={row.id}
                          saleId={row.id}
                          customerName={row.customerName}
                          firstLineDescription={row.firstLineDescription}
                          status={row.status}
                          paidText={paidOfText(row.paidFils, row.ofFils)}
                          action={rowAction(row)}
                        />
                      ))}
                  </div>
                </section>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
