/**
 * S13 (DOC-022 / UNIT-018 + UNIT-012 — أمر 2158b0fc §6): «المتابعة» الموحدة
 * — واجهة واحدة تجمع مواعيد العمل (من قراءة 012 النقية) والاستحقاقات
 * المالية من أصحابها (تحصيل 005/010، دفعة مورد 027، سداد مصروف 015،
 * مراجعة دورة 019). قراءة خالصة: الفتح والتصفية والرجوع لا يكتبان مالًا
 * ولا موعدًا ولا دورة (U018-R01/R02، SDF-013)؛ كل مصدر بحالته المستقلة
 * ففشله يعزل نفسه ولا يخفي السليم (U018-R17/R18)؛ التصفية والترتيب على
 * المجتمع كله قبل حد العرض مع عدد صادق (U018-R16)؛ بلا موعد ≠ متأخر،
 * والتاريخ التالف حالة إصلاح معلنة لا تاريخ اليوم (U018-R06/F06).
 */
import { BellRing, ChevronLeft, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { usePrototypeServices, getPrototypeLocalStore } from "@/app/PrototypeServicesContext";
import { withReturnTo } from "@/app/navigationContract";
import { Button, EmptyState, StatusChip } from "@/components/primitives";
import { LocalDateValue, MoneyValue, TimeValue } from "@/components/presentation/DisplayValue";
import { formatLocalDate } from "@/presentation/formatters";
import {
  projectFollowUp,
  type FollowUpFilter,
  type FollowUpGroup,
  type FollowUpSourceKey,
  type FollowUpTask,
  type UnifiedFollowUpResult,
} from "@/application/follow-up";

const GROUP_LABELS: Record<FollowUpGroup, string> = {
  overdue: "متأخر",
  today: "اليوم",
  upcoming: "القادم",
  undated: "لم يُحدد موعدها",
  invalid: "الموعد يحتاج تصحيحًا",
};

const SOURCE_LABELS: Record<FollowUpSourceKey, string> = {
  schedules: "مواعيد التسليم",
  customerFollowUps: "متابعة العملاء",
  receivables: "مستحقات التحصيل",
  supplierPayables: "استحقاقات الموردين",
  expensePayables: "مصاريف مستحقة",
  recurringReviews: "دورات المصروف المتكرر",
};

const TASK_ACTION_LABELS: Partial<Record<FollowUpTask["taskKind"], string>> = {
  delivery: "مراجعة التسليم",
  customer_followup: "متابعة العميل",
  receivable: "فتح مصدر التحصيل",
  supplier_payable: "تسجيل دفعة",
  expense_payable: "سداد المصروف",
  recurring_review: "مراجعة المصروف المتكرر",
};

const TASK_TYPE_LABELS: Partial<Record<FollowUpTask["taskKind"], string>> = {
  delivery: "تسليم طلب",
  customer_followup: "متابعة عميل",
  receivable: "تحصيل من عميل",
  supplier_payable: "دفعة لمورد",
  expense_payable: "سداد مصروف",
  recurring_review: "مراجعة مصروف متكرر",
};

const PAGE_SIZE = 20;

type FilterDraft = FollowUpFilter & { fromText: string; toText: string };
const DEFAULT_FILTER: FilterDraft = { taskKind: "all", period: null, fromText: "", toText: "" };

export default function FinanceUpcoming() {
  const [location, navigate] = useLocation();
  const { collections, dueDates, projectFinance, dataVersion } = usePrototypeServices();
  const [reading, setReading] = useState<UnifiedFollowUpResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  /* SDF-061: ختم الجيل — استجابة الجيل القديم تُهمل ولا تُخلط مع الأحدث. */
  const generationRef = useRef(0);
  const [applied, setApplied] = useState<FilterDraft>(DEFAULT_FILTER);
  const [draft, setDraft] = useState<FilterDraft>(DEFAULT_FILTER);
  const [filterOpen, setFilterOpen] = useState(false);
  const [shownCount, setShownCount] = useState(PAGE_SIZE);

  useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    let active = true;
    /* الخدمة تُحمّل عند أول فتح (نمط الخدمات الكسولة) — لا تدخل كومة الإقلاع.
     * عدسة التسليمات النشطة تُركّب هنا من باب الجدولة (STR-615/OD-10) —
     * القارئ الموحد يستقبلها بنيويًا فلا زوج بيوت بين المتابعة والجدولة. */
    Promise.all([import("@/application/follow-up"), import("@/application/scheduling")])
      .then(([followUp, scheduling]) => {
        const service = new followUp.UnifiedFollowUpService(
          scheduling.activeDeliveryLens(getPrototypeLocalStore()),
          getPrototypeLocalStore(),
          collections,
          dueDates,
          projectFinance,
          getPrototypeLocalStore(),
        );
        return service.read();
      })
      .then(result => {
        if (!active || generation !== generationRef.current) return;
        if (result.ok) {
          setReading(result);
          setLoadError(null);
        } else {
          setLoadError(result.message);
        }
      })
      .catch((error: unknown) => {
        if (!active || generation !== generationRef.current) return;
        setLoadError(error instanceof Error ? error.message : "تعذرت قراءة المتابعة.");
      });
    return () => {
      active = false;
    };
  }, [collections, dueDates, projectFinance, dataVersion, reloadToken]);

  const open = (href: string) => navigate(withReturnTo(href, location));

  const appliedFilter: FollowUpFilter = useMemo(() => {
    if (applied.period === null) return { taskKind: applied.taskKind, period: null };
    return { taskKind: applied.taskKind, period: applied.period };
  }, [applied]);

  const projection = useMemo(
    () => (reading && reading.ok ? projectFollowUp(reading.value, appliedFilter) : null),
    [reading, appliedFilter],
  );

  if (loadError !== null && reading === null)
    return (
      <section className="micro-page micro-not-found">
        <h1>تعذر تحميل المتابعة</h1>
        <p role="alert">{loadError} لم يتم تغيير شيء؛ أعد المحاولة.</p>
        <Button action="save" onClick={() => setReloadToken(token => token + 1)}>
          إعادة المحاولة
        </Button>
      </section>
    );
  if (reading === null || projection === null)
    return (
      <div className="micro-route-loading" role="status">
        جارٍ تحميل المتابعة…
      </div>
    );

  const today = reading.ok ? reading.value.asOf : "";
  const visibleGroups = projection.groups.filter(group => group.tasks.length > 0);
  const totalShown = visibleGroups.reduce((sum, group) => sum + group.tasks.length, 0);

  const applyFilter = () => {
    const from = draft.fromText.trim();
    const to = draft.toText.trim();
    const fromValid = from === "" || /^\d{4}-\d{2}-\d{2}$/.test(from);
    const toValid = to === "" || /^\d{4}-\d{2}-\d{2}$/.test(to);
    if (!fromValid || !toValid || (from !== "" && to !== "" && from > to)) {
      setDraft(current => ({ ...current }));
      return;
    }
    const period =
      from === "" && to === ""
        ? null
        : { from: from === "" ? "0000-01-01" : from, to: to === "" ? "9999-12-31" : to };
    setApplied({ ...draft, period });
    setShownCount(PAGE_SIZE);
    setFilterOpen(false);
  };

  return (
    <section className="micro-page">
      <div className="micro-page-heading">
        <span className="micro-overline">قراءة موحدة · بلا أثر مالي</span>
        <h1>المتابعة</h1>
        <p>المواعيد والمبالغ التي تحتاج إجراء — كلٌّ من سجله، والفعل عند صاحبه.</p>
      </div>
      <p className="micro-scope-line" role="status">
        اليوم: <LocalDateValue value={today} /> · {projection.readyTaskCount} مهمة مقروءة
        {totalShown > shownCount ? ` (يُعرض ${shownCount})` : ""}
      </p>

      {/* فشل مصدر معزول — السليم يبقى ظاهرًا وإعادة المحاولة للمصدر المتعذر وحده */}
      {projection.errorSources.length > 0 ? (
        <section className="micro-source-errors" aria-label="مصادر تعذرت قراءتها">
          {projection.errorSources.map(source => (
            <p key={source.key} className="micro-field-error" role="alert">
              تعذرت قراءة {SOURCE_LABELS[source.key]} — {source.message}
            </p>
          ))}
          <Button action="secondary" onClick={() => setReloadToken(token => token + 1)}>
            أعد قراءة المتابعة
          </Button>
        </section>
      ) : null}

      <div className="micro-orders-search">
        <Button action="secondary" onClick={() => setFilterOpen(openState => !openState)}>
          <SlidersHorizontal aria-hidden="true" /> تصفية
        </Button>
      </div>
      {filterOpen ? (
        <section className="micro-form-card" aria-label="لوحة تصفية المتابعة">
          <fieldset>
            <legend>نوع المهمة</legend>
            {(
              [
                ["all", "الكل"],
                ["delivery", "عمل ومواعيد"],
                ["receivable", "تحصيل"],
                ["supplier_payable", "دفعة مورد"],
                ["expense_payable", "سداد مصروف"],
                ["recurring_review", "مراجعة مصروف متكرر"],
              ] as const
            ).map(([value, label]) => (
              <label className="micro-radio-choice" key={value}>
                <input
                  type="radio"
                  name="followup-kind"
                  checked={draft.taskKind === value}
                  onChange={() => setDraft(current => ({ ...current, taskKind: value }))}
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>الفترة (على موعد المهمة)</legend>
            <label className="micro-field">
              <span>من (YYYY-MM-DD)</span>
              <input
                type="date"
                value={draft.fromText}
                onChange={event => setDraft(current => ({ ...current, fromText: event.target.value }))}
              />
            </label>
            <label className="micro-field">
              <span>إلى (YYYY-MM-DD)</span>
              <input
                type="date"
                value={draft.toText}
                onChange={event => setDraft(current => ({ ...current, toText: event.target.value }))}
              />
            </label>
            <p className="micro-field-hint">بلا موعد لا يدخل فترة مخصصة — مدخله المستقل يبقى ظاهرًا.</p>
          </fieldset>
          <div className="micro-form-actions">
            <Button action="save" onClick={applyFilter}>
              تطبيق
            </Button>
            <Button
              action="secondary"
              onClick={() => {
                setApplied(DEFAULT_FILTER);
                setDraft(DEFAULT_FILTER);
                setShownCount(PAGE_SIZE);
                setFilterOpen(false);
              }}
            >
              إعادة ضبط
            </Button>
            <Button
              action="quiet"
              onClick={() => {
                setDraft(applied);
                setFilterOpen(false);
              }}
            >
              إلغاء
            </Button>
          </div>
        </section>
      ) : null}

      {visibleGroups.length === 0 ? (
        <EmptyState
          aria-labelledby="followup-empty-title"
          symbol={<BellRing />}
          state={<StatusChip state="no-data">لا مهام تطابق</StatusChip>}
          title={<h2 id="followup-empty-title">لا مهام متابعة بهذه التصفية</h2>}
          description={
            projection.readyTaskCount === 0
              ? "لا توجد مهام متابعة مسجلة — هذه قراءة سجلاتك لا تدقيقًا لكل واقع مشروعك."
              : "عدّل التصفية أو امسحها — المهام المسجلة ما زالت عند مصادرها."
          }
        />
      ) : (
        <>
          {(() => {
            /* حد العرض تدريجي على المجموعات بالترتيب — العدد الكلي صادق فوقه. */
            let budget = shownCount;
            return visibleGroups.map(group => {
              const shown = group.tasks.slice(0, Math.max(0, budget));
              budget -= shown.length;
              return (
                <section
                  className="micro-draft-list"
                  aria-labelledby={`group-${group.group}`}
                  key={group.group}
                >
                  <h2 id={`group-${group.group}`}>
                    {GROUP_LABELS[group.group]} ({group.tasks.length})
                  </h2>
                  {shown.map(task => (
                    <FollowUpRow key={task.itemKey} task={task} onOpen={open} />
                  ))}
                </section>
              );
            });
          })()}
          {totalShown > shownCount ? (
            <Button action="secondary" onClick={() => setShownCount(count => count + PAGE_SIZE)}>
              عرض المزيد ({totalShown - shownCount} متبقية)
            </Button>
          ) : null}
        </>
      )}

      <details className="micro-inline-disclosure">
        <summary>حول المتابعة</summary>
        <p>
          تجمع المتابعة المواعيد والمبالغ التي تحتاج إجراء من سجلاتها. التذكير لا يسجل دفعًا أو مصروفًا، وما
          لم يحدد موعده لا يعد متأخرًا، والفعل يفتح صاحبه ولا يكتب من هنا.
        </p>
      </details>
    </section>
  );
}

/* ─── صف المهمة (U018-A2): نوع وفعل واضحان ثم الاسم والموعد ثم مبلغ بدوره ─── */

function FollowUpRow({ task, onOpen }: { task: FollowUpTask; onOpen: (href: string) => void }) {
  const typeLabel = TASK_TYPE_LABELS[task.taskKind] ?? "مهمة متابعة";
  const actionLabel = TASK_ACTION_LABELS[task.taskKind] ?? "فتح المصدر";
  return (
    <button className="micro-draft-row" type="button" onClick={() => onOpen(task.sourceHref)}>
      <span className="micro-draft-symbol">
        <BellRing aria-hidden="true" />
      </span>
      <span>
        <strong dir="auto">
          {typeLabel} — {task.title}
          {task.party ? ` · ${task.party}` : ""}
        </strong>
        <small>
          {task.dueOn === null ? (
            task.dateState === "invalid" ? (
              "الموعد يحتاج تصحيحًا"
            ) : (
              "لم يحدد موعدها"
            )
          ) : (
            <>
              <LocalDateValue value={task.dueOn} />
              {task.scheduledTime ? (
                <>
                  {" "}
                  · <TimeValue value={task.scheduledTime} />
                </>
              ) : null}
            </>
          )}
        </small>
        {task.amountMinor !== null && task.amountRole !== null ? (
          <small>
            {task.amountRole}
            {task.amountProposed ? " (مقترح — ليس دينًا)" : ""}:{" "}
            <MoneyValue minor={task.amountMinor} className="micro-inline-number" />
          </small>
        ) : null}
        <small className="micro-row-next-action">الخطوة التالية: {actionLabel} — من مصدره.</small>
      </span>
      <ChevronLeft aria-hidden="true" />
    </button>
  );
}
