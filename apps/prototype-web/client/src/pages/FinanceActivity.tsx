/**
 * المجموعة ٥ (عقد ٣٠ — القارئ الكامل «آخر ما حدث»): كل نشاط مسجّل في مكان
 * واحد — بيع وطلب وتسليم ومصروف وشراء وقرض وأصل وإهلاك وعربون وتحصيل وتحويل
 * محفظة وحركة مخزون وهدر وتصحيح — مع كلمة أثر واحدة لكل صف ورابط لمصدره.
 *
 * عقد الصفحة:
 * - القارئ سطح قراءة: لا يكتب شيئًا؛ كل تعديل من شاشته الأصلية.
 * - لا محرك حساب: لا إجماليات هنا — الأرقام الإجمالية بيتها كشف الفترة.
 * - المجهول يظهر مجهولًا: صف بلا رقم صادق يعرض «—» لا صفرًا.
 * - التصفية بالعائلة والفترة أفعال عرض فقط لا تعيد تفسير السجل.
 */
import { Activity, ArrowLeft, Receipt } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import {
  activityEffectLabel,
  activityEffectNote,
  activityFamilyLabel,
  activityStatusLabel,
} from "@/presentation/activityLabels";
import {
  formatLocalDate,
  formatLocalDateLong,
  formatQuantityMilli,
  localDateInAmman,
} from "@/presentation/formatters";
import type { ActivityEffectClass, ActivityFamily, ActivityRecord } from "@/application/activity/activityService";

type State =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; rows: readonly ActivityRecord[] };

type PeriodRange = "this_week" | "last_week" | "this_month" | "all" | "custom";

const DAY = 24 * 60 * 60 * 1000;
const shiftDate = (localDate: string, days: number): string => {
  const [year, month, day] = localDate.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10);
};
function weekBounds(today: string): { from: string; to: string } {
  const [year, month, day] = today.split("-").map(Number);
  const weekday = new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay();
  const from = shiftDate(today, -weekday);
  return { from, to: shiftDate(from, 6) };
}
function monthBounds(today: string): { from: string; to: string } {
  const [year, month] = today.split("-").map(Number);
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? { y: year! + 1, m: 1 } : { y: year, m: month! + 1 };
  const to = shiftDate(`${nextMonth.y}-${String(nextMonth.m).padStart(2, "0")}-01`, -1);
  return { from, to };
}

/* عائلات مرتبة بحسب أولوية الأسئلة: ما الذي أثّر على الكاش أولًا. */
const FAMILY_FILTERS: readonly (ActivityFamily | "all")[] = [
  "all",
  "sale",
  "collection",
  "deposit",
  "expense",
  "purchase_payment",
  "loan",
  "asset",
  "depreciation",
  "inventory_receipt",
  "inventory_consumption",
  "waste",
  "wallet_transfer",
  "delivery",
  "order",
  "correction",
];

const effectTone: Record<ActivityEffectClass, string> = {
  cash_in: "in",
  cash_out: "out",
  non_cash: "quiet",
  payable: "quiet",
  owner_money: "quiet",
  trust: "quiet",
  pending: "pending",
  informational: "quiet",
};

function ActivityRow({ row, onOpen }: { row: ActivityRecord; onOpen: (path: string) => void }) {
  return (
    <article className="micro-finance-event micro-activity-row" data-status={row.status} data-effect={row.effect}>
      <button className="micro-activity-row-button" type="button" onClick={() => onOpen(row.sourceHref)}>
        <span className="micro-activity-row-main">
          <span>
            <strong>{activityFamilyLabel[row.family]}</strong>
            {row.detail ? <small>{row.detail}</small> : null}
            <small className="micro-activity-row-meta">
              <time dateTime={row.occurredOn ?? undefined}>
                {formatLocalDate(row.occurredOn) ?? formatLocalDate(row.recordedAt.slice(0, 10)) ?? "—"}
              </time>
              <span className={`micro-activity-effect micro-activity-effect-${effectTone[row.effect]}`}>
                {activityEffectLabel[row.effect]}
              </span>
              {row.status !== "active" ? <span>{activityStatusLabel[row.status]}</span> : null}
              {row.quantityMilli ? <span>{formatQuantityMilli(row.quantityMilli)} وحدة</span> : null}
            </small>
            {activityEffectNote[row.effect] ? (
              <small className="micro-activity-note">{activityEffectNote[row.effect]}</small>
            ) : null}
          </span>
          <b>
            <MoneyValue minor={row.amountMinor} /> {row.amountMinor !== null ? "د.أ" : ""}
          </b>
        </span>
        <ArrowLeft aria-hidden="true" />
      </button>
    </article>
  );
}

export default function FinanceActivity() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const returnPath = useReturnPath();
  const { activity, dataVersion } = usePrototypeServices();
  const today = localDateInAmman();
  const thisWeek = weekBounds(today);
  const lastWeek = weekBounds(shiftDate(today, -7));
  const thisMonth = monthBounds(today);
  const [range, setRange] = useState<PeriodRange>("this_week");
  const [from, setFrom] = useState(thisWeek.from);
  const [to, setTo] = useState(thisWeek.to);
  const [family, setFamily] = useState<ActivityFamily | "all">("all");
  const [state, setState] = useState<State>({ phase: "loading" });

  const applyQuick = (value: PeriodRange) => {
    setRange(value);
    if (value === "this_week") {
      setFrom(thisWeek.from);
      setTo(thisWeek.to);
    } else if (value === "last_week") {
      setFrom(lastWeek.from);
      setTo(lastWeek.to);
    } else if (value === "this_month") {
      setFrom(thisMonth.from);
      setTo(thisMonth.to);
    } else if (value === "all") {
      setFrom("");
      setTo("");
    }
  };

  useEffect(() => {
    let active = true;
    activity
      .read({
        limit: 120,
        perFamilyLimit: 20,
        from: from || null,
        to: to || null,
        families: family === "all" ? null : [family],
      })
      .then(result => {
        if (!active) return;
        setState(
          result.ok ? { phase: "ready", rows: result.value } : { phase: "error", message: result.message },
        );
      });
    return () => {
      active = false;
    };
  }, [activity, from, to, family, range, dataVersion]);

  if (state.phase === "loading")
    return (
      <div className="micro-route-loading" role="status">
        جارٍ قراءة النشاط…
      </div>
    );
  if (state.phase === "error")
    return (
      <section className="micro-page micro-not-found">
        <h1>تعذر قراءة النشاط</h1>
        <p>{state.message}</p>
        <button className="micro-button micro-button-primary" type="button" onClick={() => navigate(returnPath)}>
          رجوع
        </button>
      </section>
    );

  const referrer = new URLSearchParams(search).get("from");
  const openSource = (path: string) =>
    navigate(`${path}${path.includes("?") ? "&" : "?"}from=${encodeURIComponent(referrer ?? "/finance/activity")}`);

  return (
    <section className="micro-page micro-activity-page">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        <ArrowLeft aria-hidden="true" /> رجوع
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">سجل النشاط · المبالغ (د.أ)</span>
        <h1>آخر ما حدث</h1>
        <p>
          {range === "all"
            ? "كل النشاط المسجّل منذ البداية."
            : `من ${formatLocalDateLong(from) ?? from} إلى ${formatLocalDateLong(to) ?? to}`}{" "}
          كل صف يحمل أثره (نقدي/غير نقدي/معلّق) ورابطًا لمصدره.
        </p>
      </div>
      <section className="micro-form-card" aria-label="نطاق النشاط">
        <div className="micro-form-actions" role="group" aria-label="نطاقات سريعة">
          {(
            [
              ["this_week", "هذا الأسبوع"],
              ["last_week", "الأسبوع الماضي"],
              ["this_month", "هذا الشهر"],
              ["all", "منذ البداية"],
              ["custom", "نطاق مخصص"],
            ] as readonly [PeriodRange, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              className="micro-text-action"
              type="button"
              aria-pressed={range === value}
              onClick={() => applyQuick(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {range === "custom" ? (
          <div className="micro-period-range-fields">
            <LocalDateField label="من" value={from} onChange={event => setFrom(event.target.value)} />
            <LocalDateField label="إلى" value={to} onChange={event => setTo(event.target.value)} />
          </div>
        ) : null}
      </section>
      <section className="micro-form-card" aria-label="تصفية العائلة">
        <div className="micro-form-actions micro-activity-filters" role="group" aria-label="عائلات النشاط">
          {FAMILY_FILTERS.map(value => (
            <button
              key={value}
              className="micro-text-action"
              type="button"
              aria-pressed={family === value}
              onClick={() => setFamily(value)}
            >
              {value === "all" ? "الكل" : activityFamilyLabel[value]}
            </button>
          ))}
        </div>
      </section>
      {state.rows.length === 0 ? (
        <div className="micro-empty-state">
          <Activity aria-hidden="true" />
          <p className="micro-empty-copy">
            لا نشاط في هذا النطاق. أول تسجيل من زر «سجّل» يظهر هنا مع أثره، أو وسّع النطاق إلى «منذ البداية».
          </p>
        </div>
      ) : (
        <section className="micro-supplier-list" aria-label="صفوف النشاط">
          <div className="micro-finance-event-heading">
            <span className="micro-overline">
              <Receipt aria-hidden="true" /> النشاط
            </span>
            <h2>الصفوف الأحدث أولًا</h2>
          </div>
          {state.rows.map(row => (
            <ActivityRow key={row.id} row={row} onOpen={openSource} />
          ))}
        </section>
      )}
      <div className="micro-offline-truth" role="note">
        يعمل بلا إنترنت — يُقرأ من سجلك المحلي ولا يغيّر شيئًا.
      </div>
    </section>
  );
}
