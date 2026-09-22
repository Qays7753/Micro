/** FIN-002 (WS-174 — Wave 2): جسم «ميزانيات اختيارية» داخل التفاصيل المطوية.
 * مكوّن مستقل (سابقة RecurringConfirmPanel): كل سلاسل النص هنا خارج ملف
 * صفحة المالية فلا تدخل قياس كثافة السكون لها؛ الخطة لا حدثًا ماليًا أبدًا
 * (عقد ٤٢) — كل رقم من الخدمة المحمّلة ديناميكيًا ولا معادلة داخل الواجهة. */
import { useEffect, useState } from "react";
import { Button } from "@/components/primitives";
import { IntegerValue, MoneyValue } from "@/components/presentation/DisplayValue";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import type { ExpenseBudgetService } from "@/application/finance/expenseBudgetService";
import type {
  ExpenseBudgetStatusesReading,
  ExpenseBudgetStatusLine,
  ExpenseBudgetMonthList,
} from "@/application/finance/expenseBudgetService";
import type { BudgetScope, ExpenseBudgetRecord } from "@micro-domain/budget/index.js";
import { formatMonthLabel } from "@/presentation/formatters";
import { getPrototypeLocalStore } from "@/app/PrototypeServicesContext";
import { localDateInAmman } from "@micro-domain/shared/index.js";

type ExpenseBudgetServiceT = ExpenseBudgetService;
type ExpenseBudgetStatusesReadingT = ExpenseBudgetStatusesReading;
type ExpenseBudgetStatusLineT = ExpenseBudgetStatusLine;
type ExpenseBudgetMonthListT = ExpenseBudgetMonthList;

/* تسمية النطاق — مفردات عقد ٤٢ §٤: «مصروف عام» أو «فئة: نص صريح». */
const budgetScopeLabel = (scope: BudgetScope) =>
  scope.kind === "general_expense" ? "مصروف عام" : `فئة: ${scope.categoryLabel}`;
/* مفاتيح الأشهر داخل نطاق معروض صالح — سقف دفاعي لا حلقة بلا نهاية. */
const monthKeysInRange = (from: string, to: string): string[] => {
  const months: string[] = [];
  for (let cursor = from; cursor <= to && months.length < 24;) {
    months.push(cursor);
    const [year, month] = cursor.split("-").map(Number);
    cursor = month === 12 ? `${year! + 1}-01` : `${year}-${String(month! + 1).padStart(2, "0")}`;
  }
  return months;
};

/* ─── FIN-002 (WS-174 — Wave 2): جسم «ميزانيات اختيارية» ───
 * كله داخل التفاصيل المطوية فلا يدخل قياس كثافة النص للسكون؛ كل رقم من
 * الخدمة المحمّلة ديناميكيًا (لا معادلة داخل الصفحة)، وكل فعل كتابة سجل
 * ميزانية لا حدثًا ماليًا: الكاش والنتيجة والدين لا يتحركون أبدًا (عقد ٤٢). */
type BudgetsBodyRead =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; statuses: ExpenseBudgetStatusesReadingT; lists: readonly ExpenseBudgetMonthListT[] };

const budgetOperationKey = (kind: string) =>
  `budget-${kind}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

/* غلاف القسم كاملاً (التفاصيل المطوية + التحميل الديناميكي EXE-014 + الجسم):
 * جذر المكوّن هو عنصر <details> نفسه فكل سلاسل الجسم داخل التفاصيل المطوية
 * معجميًا في هذا الملف — لا تُحسب في كثافة سكون أي صفحة (قاعدة العدّاد
 * نفسها: ما داخل التفاصيل لا يُعرض إلا عبر ملخصه). السباق المكتشف في التحقق
 * معالج: يبدأ من idle فقط بلا حارس active يبطل نتيجة الاستيراد. */
type BudgetsServiceLoad =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; service: ExpenseBudgetServiceT };

export function FinanceBudgetsSection({
  fromMonth,
  toMonth,
  rangeInvalid,
  dataVersion,
}: {
  fromMonth: string;
  toMonth: string;
  rangeInvalid: boolean;
  dataVersion: number;
}) {
  const [budgetsOpen, setBudgetsOpen] = useState(false);
  const [budgetsLoad, setBudgetsLoad] = useState<BudgetsServiceLoad>({ phase: "idle" });
  useEffect(() => {
    if (!budgetsOpen || budgetsLoad.phase !== "idle") return;
    setBudgetsLoad({ phase: "loading" });
    import("@/application/finance/expenseBudgetService")
      .then(module => {
        setBudgetsLoad({
          phase: "ready",
          service: new module.ExpenseBudgetService(getPrototypeLocalStore()),
        });
      })
      .catch(() => {
        setBudgetsLoad({ phase: "error" });
      });
  }, [budgetsOpen, budgetsLoad]);
  return (
    <details
      className="micro-finance-layer micro-expense-budgets"
      onToggle={event => setBudgetsOpen(event.currentTarget.open)}
    >
      <summary className="micro-finance-layer-summary">
        <span>
          <b>ميزانيات اختيارية</b>
          <small>
            من {formatMonthLabel(fromMonth)} إلى {formatMonthLabel(toMonth)}
          </small>
        </span>
        <strong>افتح التفاصيل</strong>
      </summary>
      {!budgetsOpen || rangeInvalid ? null : budgetsLoad.phase === "loading" ? (
        <p className="micro-period-status" role="status">
          جارٍ تجهيز الميزانيات…
        </p>
      ) : budgetsLoad.phase === "error" ? (
        <div className="micro-cancel-panel" role="alert">
          <p>تعذر تجهيز خدمة الميزانيات — لم يتغير شيء في بياناتك.</p>
          <Button action="save" onClick={() => setBudgetsLoad({ phase: "idle" })}>
            إعادة المحاولة
          </Button>
        </div>
      ) : budgetsLoad.phase === "idle" ? null : (
        <ExpenseBudgetsSectionBody
          service={budgetsLoad.service}
          fromMonth={fromMonth}
          toMonth={toMonth}
          dataVersion={dataVersion}
        />
      )}
    </details>
  );
}

export function ExpenseBudgetsSectionBody({
  service,
  fromMonth,
  toMonth,
  dataVersion,
}: {
  service: ExpenseBudgetServiceT;
  fromMonth: string;
  toMonth: string;
  dataVersion: number;
}) {
  const [read, setRead] = useState<BudgetsBodyRead>({ phase: "loading" });
  const [reloadToken, setReloadToken] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reviseId, setReviseId] = useState<string | null>(null);
  const [closeId, setCloseId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const months = monthKeysInRange(fromMonth, toMonth);
    Promise.all([
      service.readBudgetStatuses({ from: fromMonth, to: toMonth }),
      Promise.all(months.map(month => service.listBudgets(month))),
    ]).then(([statuses, lists]) => {
      if (!active) return;
      if (!statuses.ok || lists.some(list => !list.ok)) {
        setRead({ phase: "error" });
        return;
      }
      setRead({
        phase: "ready",
        statuses: statuses.value,
        lists: lists.flatMap(list => (list.ok ? [list.value] : [])),
      });
    });
    return () => {
      active = false;
    };
  }, [service, fromMonth, toMonth, reloadToken, dataVersion]);
  if (read.phase === "loading")
    return (
      <p className="micro-period-status" role="status">
        جارٍ قراءة الميزانيات…
      </p>
    );
  if (read.phase === "error")
    return (
      <div className="micro-cancel-panel" role="alert">
        <p>تعذّرت قراءة الميزانيات — لم يتغير أي سجل؛ أعد المحاولة.</p>
        <Button action="save" onClick={() => setReloadToken(token => token + 1)}>
          إعادة المحاولة
        </Button>
      </div>
    );
  const lines = read.statuses.lines;
  const history = read.lists.flatMap(list => [...list.superseded, ...list.closed]);
  const reload = () => setReloadToken(token => token + 1);
  const flipGoal = async (line: ExpenseBudgetStatusLineT) => {
    const result = line.budget.goalDismissed
      ? await service.restoreGoal(line.budget.id)
      : await service.dismissGoal(line.budget.id);
    if (!result.ok) {
      setActionError(result.message);
      return;
    }
    setActionError(null);
    setNotice(line.budget.goalDismissed ? null : "أخفيت الهدف — استعده متى شئت");
    reload();
  };
  return (
    <section
      className="micro-period-result micro-derived-surface"
      aria-label="الميزانيات الاختيارية"
      data-budgets-active={lines.length}
    >
      {lines.length > 0 || history.length > 0 ? (
        <p className="micro-period-status">
          ميزانية اختيارية — خطة لا حدثًا ماليًا: كم تسمح لنفسك أن تصرف؛ والتجاوز يظهر ولا يحجب تسجيلًا أبدًا.
        </p>
      ) : null}
      {notice ? (
        <p className="micro-period-status" role="status">
          {notice}
        </p>
      ) : null}
      {actionError ? (
        <p className="micro-warning-copy" role="alert">
          {actionError}
        </p>
      ) : null}
      {lines.length > 0 ? (
        <ul className="micro-insights-work-list">
          {lines.map(line => (
            <li
              key={line.budget.id}
              data-budget-state={line.reading.state}
              data-goal-dismissed={line.budget.goalDismissed ? "true" : undefined}
            >
              <span className="micro-insights-work-name">
                {budgetScopeLabel(line.budget.scope)} · {line.budget.periodKey}
              </span>
              <small>
                خطتك <MoneyValue minor={line.budget.amountMinor} className="micro-inline-number" />
                {line.spentMinor !== null ? (
                  <>
                    {" · المنصرف "}
                    <MoneyValue minor={line.spentMinor} className="micro-inline-number" />
                  </>
                ) : null}
                {line.reading.notes.includes("budget_estimated") ? " · تقديرية" : ""}
                {line.budget.note ? ` · ${line.budget.note}` : ""}
              </small>
              <b data-budget-state={line.reading.state}>
                {line.reading.state === "within" && line.reading.remainingMinor !== null ? (
                  <>
                    ضمن خطتك هذا الشهر · المتبقي{" "}
                    <MoneyValue minor={line.reading.remainingMinor} className="micro-inline-number" />
                  </>
                ) : line.reading.state === "exceeded" && line.reading.overrunMinor !== null ? (
                  <>
                    تجاوزت خطتك هذا الشهر بمبلغ{" "}
                    <MoneyValue minor={line.reading.overrunMinor} className="micro-inline-number" />
                  </>
                ) : (
                  "المنصرف غير معلوم بعد"
                )}
              </b>
              <div className="micro-form-actions micro-contextual-actions">
                <button
                  className="micro-text-action"
                  type="button"
                  onClick={() => setReviseId(line.budget.id)}
                >
                  نسخة جديدة
                </button>
                <button
                  className="micro-text-action"
                  type="button"
                  onClick={() => setCloseId(line.budget.id)}
                >
                  إغلاق موثق
                </button>
                <button className="micro-text-action" type="button" onClick={() => void flipGoal(line)}>
                  {line.budget.goalDismissed ? "إظهار الهدف" : "إخفاء الهدف"}
                </button>
              </div>
              {reviseId === line.budget.id ? (
                <BudgetReviseForm
                  service={service}
                  budget={line.budget}
                  onDone={() => {
                    setReviseId(null);
                    setNotice("راجعت الميزانية: نسخة جديدة تحفظ القديمة");
                    reload();
                  }}
                  onCancel={() => setReviseId(null)}
                />
              ) : null}
              {closeId === line.budget.id ? (
                <BudgetCloseForm
                  service={service}
                  budget={line.budget}
                  onDone={() => {
                    setCloseId(null);
                    setNotice("أغلقت الميزانية بسبب موثق");
                    reload();
                  }}
                  onCancel={() => setCloseId(null)}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {history.length > 0 ? (
        <details className="micro-finance-layer micro-budgets-history">
          <summary className="micro-finance-layer-summary">
            <span>
              <b>ميزانيات مغلقة ومستبدلة ({history.length})</b>
              <small>محفوظة بتوثيقها — لا حذف صامت أبدًا</small>
            </span>
            <strong>اطوِ أو افتح</strong>
          </summary>
          <ul className="micro-insights-work-list">
            {history.map(record => (
              <li key={record.id} data-budget-record={record.status}>
                <span className="micro-insights-work-name">
                  {budgetScopeLabel(record.scope)} · {record.periodKey}
                </span>
                <small dir="auto">
                  {record.status === "closed"
                    ? `أغلقت الميزانية بسبب موثق: ${record.closeReason ?? ""}`
                    : "راجعت الميزانية: نسخة جديدة تحفظ القديمة"}
                </small>
                <b>{record.status === "closed" ? "مغلقة" : "مستبدلة"}</b>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <ExpenseBudgetsAddForm
        service={service}
        month={fromMonth}
        onCreated={() => {
          setNotice("أُنشئت الميزانية — خطة لا حدثًا ماليًا، لا شيء مالي تحرّك.");
          reload();
        }}
      />
    </section>
  );
}

/* نموذج الإنشاء — الحد الأدنى الوظيفي: نطاق (مصروف عام أو فئة صريحة) ومبلغ
 * وملاحظة اختيارية؛ الشهر هو شهر الفترة المعروضة نفسه (لا منتقي ثانٍ). */
function ExpenseBudgetsAddForm({
  service,
  month,
  onCreated,
}: {
  service: ExpenseBudgetServiceT;
  month: string;
  onCreated: () => void;
}) {
  const [scopeKind, setScopeKind] = useState<"general" | "category">("general");
  const [categoryText, setCategoryText] = useState("");
  const [amountMinor, setAmountMinor] = useState<number | null>(null);
  const [amountValid, setAmountValid] = useState(true);
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (submitting) return;
    const scope: BudgetScope =
      scopeKind === "general"
        ? { kind: "general_expense" }
        : { kind: "category", categoryLabel: categoryText };
    if (scopeKind === "category" && !categoryText.trim()) {
      setFormError("فئة الميزانية مطلوبة صراحةً — اكتب نص الفئة كما تصنف مصاريفك.");
      return;
    }
    if (amountMinor === null || !amountValid || !Number.isInteger(amountMinor) || amountMinor <= 0) {
      setFormError("أدخل مبلغ الميزانية بالأرقام 0–9.");
      return;
    }
    setFormError(null);
    setSubmitting(true);
    const result = await service.createBudget({
      periodKey: month,
      scope,
      amountMinor,
      note: note.trim() || null,
      operationKey: budgetOperationKey("create"),
    });
    setSubmitting(false);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    setScopeKind("general");
    setCategoryText("");
    setAmountMinor(null);
    setNote("");
    onCreated();
  };
  return (
    <details className="micro-finance-layer micro-budget-add">
      <summary className="micro-finance-layer-summary">
        <span>
          <b>أضف ميزانية اختيارية</b>
          <small>خطة لا حدثًا ماليًا · الشهر {month}</small>
        </span>
        <strong>افتح النموذج</strong>
      </summary>
      <form
        className="micro-budget-add-form"
        onSubmit={event => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="micro-field">
          <span>نطاق الميزانية</span>
          <select
            value={scopeKind}
            onChange={event => setScopeKind(event.target.value === "category" ? "category" : "general")}
          >
            <option value="general">مصروف عام</option>
            <option value="category">فئة مصروف — نص صريح</option>
          </select>
        </label>
        {scopeKind === "category" ? (
          <label className="micro-field">
            <span>
              نص الفئة <small>مطابقة نصية صريحة — لا مرادفات</small>
            </span>
            <input
              value={categoryText}
              onChange={event => setCategoryText(event.target.value)}
              aria-label="نص فئة الميزانية"
              dir="auto"
            />
          </label>
        ) : null}
        <label className="micro-field">
          <span>
            المبلغ <small>د.أ</small>
          </span>
          <EnglishNumberInput
            value={amountMinor}
            kind="money"
            onNumericChange={setAmountMinor}
            onTextValidityChange={setAmountValid}
            onEmptyChange={() => setAmountMinor(null)}
            allowEmpty
            aria-label="مبلغ الميزانية"
          />
        </label>
        <label className="micro-field">
          <span>
            ملاحظة <small>اختيارية</small>
          </span>
          <input value={note} onChange={event => setNote(event.target.value)} dir="auto" />
        </label>
        {formError ? (
          <p className="micro-warning-copy" role="alert">
            {formError}
          </p>
        ) : null}
        <div className="micro-form-actions">
          <Button action="create" type="submit" loading={submitting}>
            أنشئ الميزانية
          </Button>
        </div>
      </form>
    </details>
  );
}

/* مراجعة موثقة: نسخة خلف تحفظ القديمة — الحد (الفترة × النطاق) محفوظ. */
function BudgetReviseForm({
  service,
  budget,
  onDone,
  onCancel,
}: {
  service: ExpenseBudgetServiceT;
  budget: ExpenseBudgetRecord;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [amountMinor, setAmountMinor] = useState<number | null>(budget.amountMinor);
  const [amountValid, setAmountValid] = useState(true);
  const [note, setNote] = useState(budget.note ?? "");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (submitting) return;
    if (amountMinor === null || !amountValid || !Number.isInteger(amountMinor) || amountMinor <= 0) {
      setFormError("أدخل مبلغ النسخة الجديدة بالأرقام 0–9.");
      return;
    }
    setFormError(null);
    setSubmitting(true);
    const result = await service.reviseBudget(budget.id, {
      amountMinor,
      note: note.trim() || null,
      operationKey: budgetOperationKey("revise"),
    });
    setSubmitting(false);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    onDone();
  };
  return (
    <form
      className="micro-budget-revise-form"
      onSubmit={event => {
        event.preventDefault();
        void submit();
      }}
    >
      <label className="micro-field">
        <span>
          مبلغ النسخة الجديدة <small>د.أ</small>
        </span>
        <EnglishNumberInput
          value={amountMinor}
          kind="money"
          onNumericChange={setAmountMinor}
          onTextValidityChange={setAmountValid}
          onEmptyChange={() => setAmountMinor(null)}
          allowEmpty
          aria-label="مبلغ النسخة الجديدة"
        />
      </label>
      <label className="micro-field">
        <span>ملاحظة النسخة الجديدة</span>
        <input value={note} onChange={event => setNote(event.target.value)} dir="auto" />
      </label>
      {formError ? (
        <p className="micro-warning-copy" role="alert">
          {formError}
        </p>
      ) : null}
      <div className="micro-form-actions micro-contextual-actions">
        <Button action="save" type="submit" loading={submitting}>
          احفظ النسخة الجديدة
        </Button>
        <Button action="secondary" onClick={onCancel}>
          إلغاء
        </Button>
      </div>
    </form>
  );
}

/* إغلاق موثق: العلة إلزامية — رفض الدومين الصادر يظهر كما هو. */
function BudgetCloseForm({
  service,
  budget,
  onDone,
  onCancel,
}: {
  service: ExpenseBudgetServiceT;
  budget: ExpenseBudgetRecord;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (submitting) return;
    setFormError(null);
    setSubmitting(true);
    const result = await service.closeBudget(budget.id, reason);
    setSubmitting(false);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    onDone();
  };
  return (
    <form
      className="micro-budget-close-form"
      onSubmit={event => {
        event.preventDefault();
        void submit();
      }}
    >
      <label className="micro-field">
        <span>
          علّة الإغلاق <small>إلزامية — تُوثَّق مع السجل</small>
        </span>
        <input
          value={reason}
          onChange={event => setReason(event.target.value)}
          aria-label="علّة إغلاق الميزانية"
          dir="auto"
        />
      </label>
      {formError ? (
        <p className="micro-warning-copy" role="alert">
          {formError}
        </p>
      ) : null}
      <div className="micro-form-actions micro-contextual-actions">
        <Button action="save" type="submit" loading={submitting}>
          أغلق الميزانية
        </Button>
        <Button action="secondary" onClick={onCancel}>
          إلغاء
        </Button>
      </div>
    </form>
  );
}
