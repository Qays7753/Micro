/** Micro G3 UI: phone-first RTL form; one financial action, explicit knowledge, and no hidden allocation. */
/* مبدأ Micro: يشرح الحدث المالي أثره المحلي بوضوح، ولا يختلط عرضه مع نتيجة الطلب أو الربح. */
import { ArrowRight, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { useLocation, useParams } from "wouter";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { formatMoneyMinor, localDateInAmman } from "@/presentation/formatters";
import type { SettleablePayable } from "@/application/finance/projectFinancialService";
import type {
  FinancialEventType,
  OperatingExpenseContext,
  SharedProjectShareBasis,
} from "@micro-domain/financial-event/index.js";

type SharedMode = "fixed" | "percentage" | "estimate" | "defer";
const definition: Record<
  FinancialEventType,
  { title: string; description: string; effect: string; counterparty: string }
> = {
  owner_investment_cash: {
    title: "تسجيل استثمار المالك",
    description: "مال أُدخل للمشروع. ليس مبيعات ولا ربحًا.",
    effect: "يزيد الكاش المسجل ومال المالك فقط.",
    counterparty: "اختياري: مصدر المال",
  },
  owner_withdrawal_cash: {
    title: "تسجيل سحب شخصي",
    description: "مال أخذه المالك من المشروع لاستعمال شخصي.",
    effect: "ينقص الكاش ومال المالك؛ لا يسجل مصروف تشغيل.",
    counterparty: "اختياري: ملاحظة السحب",
  },
  operating_expense_cash: {
    title: "تسجيل مصروف مدفوع",
    description: "خروج كاش فعلي لمصروف تشغيلي معروف.",
    effect: "ينقص الكاش ويسجل مصروفًا، لكنه لا يحمّل تلقائيًا على طلب.",
    counterparty: "الجهة المدفوع لها",
  },
  operating_expense_payable: {
    title: "تسجيل مصروف مستحق",
    description: "مصروف أو فاتورة للمشروع لم تُدفع بعد.",
    effect: "يزيد ما عليك للمورد ويسجل مصروفًا، من دون تغيير الكاش.",
    counterparty: "المورد أو الجهة المستحقة",
  },
  payable_settlement_cash: {
    title: "تسديد التزام",
    description: "دفع كاش مقابل التزام سجلته سابقًا لمورد.",
    effect: "ينقص الكاش وما عليك، ولا يسجل المصروف مرة ثانية.",
    counterparty: "المورد أو الجهة المستحقة",
  },
};
const types = new Set<FinancialEventType>(Object.keys(definition) as FinancialEventType[]);
const ammanDate = () => localDateInAmman();
const basisFromMode = (mode: SharedMode): SharedProjectShareBasis =>
  mode === "percentage"
    ? "agreed_percentage"
    : mode === "estimate"
      ? "owner_estimate"
      : mode === "defer"
        ? "needs_review"
        : "agreed_fixed_share";
const knowledgeFromBasis = (basis: SharedProjectShareBasis): OperatingExpenseContext["knowledge"] =>
  basis === "agreed_fixed_share" || basis === "agreed_percentage"
    ? "known"
    : basis === "owner_estimate"
      ? "estimated"
      : "needs_review";
const sourceDescription: Record<SharedProjectShareBasis, string> = {
  agreed_fixed_share: "أدخل حصة المشروع فقط؛ لا يحفظ النظام إجمالي فاتورة البيت.",
  agreed_percentage: "أدخل الإجمالي والنسبة الصريحة؛ يحسب النظام حصة المشروع بدقة ويحفظها في السجل.",
  owner_estimate: "تقديرك الحالي لحصة المشروع؛ تدخل مرة واحدة وتبقى الصورة ناقصة.",
  needs_review: "يحفظ إجمالي المصدر كغير موزّع؛ لا يصبح صفرًا ولا يخصم من النتيجة.",
};

export default function FinancialEventEditor() {
  const { type: rawType } = useParams<{ type: string }>();
  const [, navigate] = useLocation();
  const { projectFinance, notifyDataChanged } = usePrototypeServices();
  const type = types.has(rawType as FinancialEventType) ? (rawType as FinancialEventType) : null;
  const [amountMinor, setAmountMinor] = useState(0);
  const [validAmount, setValidAmount] = useState(true);
  const [sharedTotalAmountMinor, setSharedTotalAmountMinor] = useState(0);
  const [validSharedTotal, setValidSharedTotal] = useState(true);
  const [sharedPercentage, setSharedPercentage] = useState(0);
  const [validSharedPercentage, setValidSharedPercentage] = useState(true);
  const [date, setDate] = useState(() => ammanDate());
  const [note, setNote] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [relationship, setRelationship] = useState<OperatingExpenseContext["relationship"]>("project");
  const [behavior, setBehavior] = useState<OperatingExpenseContext["behavior"]>("unknown");
  const [purpose, setPurpose] = useState<OperatingExpenseContext["purpose"]>("project_general");
  const [knowledge, setKnowledge] = useState<OperatingExpenseContext["knowledge"]>("known");
  const [sharedMode, setSharedMode] = useState<SharedMode>("fixed");
  const [sharedNote, setSharedNote] = useState("");
  const [payableOptions, setPayableOptions] = useState<readonly SettleablePayable[]>([]);
  const [relatedEventId, setRelatedEventId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const idempotencyKey = useRef(`finance-ui-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);

  useEffect(() => {
    projectFinance.listSettleablePayables().then(result => {
      if (result.ok) setPayableOptions(result.value);
    });
  }, [projectFinance]);

  if (!type)
    return (
      <section className="micro-page micro-not-found">
        <h1>نوع الحدث غير متاح</h1>
        <p>ارجع إلى الوضع المالي واختر حدثًا واضحًا.</p>
        <button
          className="micro-button micro-button-primary"
          type="button"
          onClick={() => navigate("/finance")}
        >
          الوضع المالي
        </button>
      </section>
    );

  const content = definition[type];
  const isOperatingExpense = type === "operating_expense_cash" || type === "operating_expense_payable";
  const isShared = isOperatingExpense && relationship === "shared";
  const sharedBasis = basisFromMode(sharedMode);
  const sharedKnowledge = knowledgeFromBasis(sharedBasis);
  const expenseContext: OperatingExpenseContext | null = !isOperatingExpense
    ? null
    : relationship === "shared"
      ? {
          relationship,
          behavior,
          purpose,
          knowledge: sharedKnowledge,
          sharedProjectShare: { basis: sharedBasis, note: sharedNote.trim() || null },
        }
      : { relationship, behavior, purpose, knowledge, sharedProjectShare: null };
  const primaryAmountValid =
    isShared && sharedMode === "percentage"
      ? validSharedTotal &&
        sharedTotalAmountMinor > 0 &&
        validSharedPercentage &&
        sharedPercentage > 0 &&
        sharedPercentage <= 100
      : validAmount && amountMinor > 0;

  async function save() {
    const selectedType = type;
    if (!selectedType) return;
    if (!primaryAmountValid) {
      setMessage(
        isShared && sharedMode === "percentage"
          ? "أدخل إجماليًا ونسبة صحيحة بين 0 و100 قبل الحفظ."
          : "أدخل مبلغًا صالحًا بالأرقام 0–9 قبل الحفظ.",
      );
      return;
    }
    if (!note.trim()) {
      setMessage("اكتب ما حدث قبل الحفظ؛ الوصف جزء من السجل المالي.");
      return;
    }
    setMessage(null);
    setSaving(true);
    const sharedExpense = isShared
      ? sharedMode === "percentage"
        ? {
            mode: "percentage" as const,
            sharedTotalAmountMinor,
            sharedPercentageBps: Math.round(sharedPercentage * 100),
          }
        : sharedMode === "defer"
          ? { mode: "defer" as const, sharedTotalAmountMinor: amountMinor }
          : { mode: sharedMode, amountMinor }
      : undefined;
    const result = await projectFinance.record({
      type: selectedType,
      ...(sharedMode === "percentage" && isShared ? {} : { amountMinor }),
      occurredOn: date,
      note,
      counterparty: counterparty || null,
      relatedEventId: selectedType === "payable_settlement_cash" ? relatedEventId || null : null,
      expenseContext,
      sharedExpense,
      idempotencyKey: idempotencyKey.current,
    });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    notifyDataChanged();
    if (result.reused) {
      setMessage(
        "لم يُحفظ التعديل. هذا الحدث مسجل سابقًا بنفس المفتاح؛ للتصحيح اعكس الحدث الأصلي وسجّل حدثًا جديدًا.",
      );
      return;
    }
    setMessage("تم حفظ الحدث المالي محليًا.");
    navigate("/finance");
  }

  return (
    <section className="micro-page micro-finance-page">
      <button className="micro-back-button" type="button" onClick={() => navigate("/finance")}>
        <ArrowRight aria-hidden="true" /> الوضع المالي
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">حدث مالي محلي</span>
        <h1>{content.title}</h1>
        <p>{content.description}</p>
      </div>
      <section className="micro-decision-card">
        <span>الأثر المعروف</span>
        <strong>{content.effect}</strong>
        <p>لا يغيّر هذا الحدث نتيجة طلب قائم أو صافي ربح المشروع تلقائيًا.</p>
      </section>
      <section className="micro-form-card">
        {isShared && sharedMode === "percentage" ? (
          <>
            <label className="micro-field">
              <span>إجمالي المصروف المشترك</span>
              <EnglishNumberInput
                value={sharedTotalAmountMinor}
                kind="money"
                onNumericChange={setSharedTotalAmountMinor}
                onTextValidityChange={setValidSharedTotal}
                aria-label="إجمالي المصروف المشترك"
              />
              <small>هذا هو إجمالي الفاتورة أو المصدر، وليس الحصة التي ستدخل النتيجة.</small>
            </label>
            <label className="micro-field">
              <span>نسبة حصة المشروع (%)</span>
              <EnglishNumberInput
                value={sharedPercentage}
                kind="decimal"
                onNumericChange={setSharedPercentage}
                onTextValidityChange={setValidSharedPercentage}
                aria-label="نسبة حصة المشروع"
              />
              <small>أدخل نسبة صريحة بين 0 و100؛ يحفظ النظام النسبة والحصة المحسوبة بالتقريب الثابت.</small>
            </label>
          </>
        ) : (
          <label className="micro-field">
            <span>
              {isShared && sharedMode === "defer"
                ? "إجمالي المصروف المصدر"
                : isShared
                  ? "حصة المشروع بالدينار الأردني"
                  : "المبلغ بالدينار الأردني"}
            </span>
            <EnglishNumberInput
              value={amountMinor}
              kind="money"
              onNumericChange={setAmountMinor}
              onTextValidityChange={setValidAmount}
              aria-label="المبلغ بالدينار الأردني"
            />
            <small>
              {isShared && sharedMode === "defer"
                ? "سيبقى هذا الإجمالي غير موزّع حتى تحدد حصة المشروع."
                : null}
            </small>
          </label>
        )}
        <LocalDateField label="تاريخ الواقعة" value={date} onChange={event => setDate(event.target.value)} />
        <label className="micro-field">
          <span>{content.counterparty}</span>
          <input
            value={counterparty}
            onChange={event => setCounterparty(event.target.value)}
            placeholder="اختياري"
          />
        </label>
        {isOperatingExpense ? (
          <details className="micro-decision-layer micro-expense-details">
            <summary className="micro-decision-layer-summary">
              <span>
                <b>أضف سياقًا للمصروف</b>
                <small>التصنيف والمعرفة وحصة المشروع عند الحاجة.</small>
              </span>
              <strong>افتح التفاصيل</strong>
            </summary>
            <ExpenseClassification
              relationship={relationship}
              setRelationship={setRelationship}
              behavior={behavior}
              setBehavior={setBehavior}
              purpose={purpose}
              setPurpose={setPurpose}
              knowledge={knowledge}
              setKnowledge={setKnowledge}
              sharedMode={sharedMode}
              setSharedMode={setSharedMode}
              sharedNote={sharedNote}
              setSharedNote={setSharedNote}
              sharedKnowledge={sharedKnowledge}
            />
          </details>
        ) : null}
        {type === "payable_settlement_cash" ? (
          <label className="micro-field">
            <span>الالتزام الذي تسدده (المبالغ د.أ)</span>
            <select value={relatedEventId} onChange={event => setRelatedEventId(event.target.value)}>
              <option value="">اختر التزامًا مسجلًا</option>
              {payableOptions.map(({ event, remainingMinor }) => (
                <option key={event.id} value={event.id}>
                  {event.note} · المتبقي {formatMoneyOption(remainingMinor)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="micro-field">
          <span>ما الذي حدث؟ (مطلوب)</span>
          <textarea
            value={note}
            onChange={event => setNote(event.target.value)}
            placeholder="مثال: دفعت توصيل الطلبات للأسبوع"
          />
        </label>
        {message ? (
          <p
            className={
              message.startsWith("تم ") || message.startsWith("هذا ")
                ? "micro-save-note"
                : "micro-field-error"
            }
            role="status"
          >
            {message}
          </p>
        ) : null}
        <button
          className="micro-button micro-button-primary micro-save-cost"
          type="button"
          disabled={saving}
          onClick={() => void save()}
        >
          <Save aria-hidden="true" />
          {saving ? "جارٍ الحفظ…" : isOperatingExpense ? "حفظ المصروف المصنف" : "حفظ الحدث"}
        </button>
      </section>
    </section>
  );
}

type ExpenseClassificationProps = {
  relationship: OperatingExpenseContext["relationship"];
  setRelationship: (value: OperatingExpenseContext["relationship"]) => void;
  behavior: OperatingExpenseContext["behavior"];
  setBehavior: (value: OperatingExpenseContext["behavior"]) => void;
  purpose: OperatingExpenseContext["purpose"];
  setPurpose: (value: OperatingExpenseContext["purpose"]) => void;
  knowledge: OperatingExpenseContext["knowledge"];
  setKnowledge: (value: OperatingExpenseContext["knowledge"]) => void;
  sharedMode: SharedMode;
  setSharedMode: (value: SharedMode) => void;
  sharedNote: string;
  setSharedNote: (value: string) => void;
  sharedKnowledge: OperatingExpenseContext["knowledge"];
};

function formatMoneyOption(minor: number) {
  return formatMoneyMinor(minor);
}

function ExpenseClassification(props: ExpenseClassificationProps) {
  const {
    relationship,
    setRelationship,
    behavior,
    setBehavior,
    purpose,
    setPurpose,
    knowledge,
    setKnowledge,
    sharedMode,
    setSharedMode,
    sharedNote,
    setSharedNote,
    sharedKnowledge,
  } = props;
  const sharedBasis = basisFromMode(sharedMode);
  return (
    <section className="micro-expense-classification" aria-labelledby="expense-classification-title">
      <div>
        <span className="micro-overline">افهم الأثر قبل الحفظ</span>
        <h2 id="expense-classification-title">كيف يخدم هذا المصروف المشروع؟</h2>
        <p>التصنيف لا يحمّل المصروف على طلب تلقائيًا؛ هو يوضح سياقه ودرجة معرفتك به.</p>
      </div>
      <label className="micro-field">
        <span>علاقة المبلغ بالمشروع</span>
        <select
          value={relationship}
          onChange={event => setRelationship(event.target.value as OperatingExpenseContext["relationship"])}
        >
          <option value="project">للمشروع بالكامل</option>
          <option value="shared">مصروف مشترك مع البيت أو نشاط آخر</option>
        </select>
        <small>
          {relationship === "shared"
            ? "لن يوزّع النظام إجمالي فاتورة مشتركة على الربح إلا إذا حددت الحصة أو أبقيتها غير موزّعة بوضوح."
            : "هذا المبلغ يخدم المشروع بالكامل كما هو مسجل."}
        </small>
      </label>
      <div className="micro-field-grid">
        <label className="micro-field">
          <span>سلوكه</span>
          <select
            value={behavior}
            onChange={event => setBehavior(event.target.value as OperatingExpenseContext["behavior"])}
          >
            <option value="fixed">ثابت غالبًا</option>
            <option value="variable">يتغير مع العمل</option>
            <option value="mixed">مختلط</option>
            <option value="unknown">غير متأكد</option>
          </select>
        </label>
        <label className="micro-field">
          <span>ما الذي يخدمه؟</span>
          <select
            value={purpose}
            onChange={event => setPurpose(event.target.value as OperatingExpenseContext["purpose"])}
          >
            <option value="project_general">المشروع عمومًا</option>
            <option value="period">فترة محددة</option>
            <option value="order">طلب محدد</option>
            <option value="product">منتج محدد</option>
            <option value="campaign">حملة</option>
            <option value="unallocated">لا أوزعه الآن</option>
          </select>
        </label>
      </div>
      {relationship === "shared" ? (
        <>
          <label className="micro-field">
            <span>كيف تريد تسجيل حصة المشروع؟</span>
            <select value={sharedMode} onChange={event => setSharedMode(event.target.value as SharedMode)}>
              <option value="fixed">مبلغ حصة معروف</option>
              <option value="percentage">نسبة من إجمالي معلوم</option>
              <option value="estimate">تقدير المالك</option>
              <option value="defer">أؤجل تحديد الحصة</option>
            </select>
            <small>{sourceDescription[sharedBasis]}</small>
          </label>
          <label className="micro-field">
            <span>ملاحظة عن المصدر</span>
            <input
              value={sharedNote}
              onChange={event => setSharedNote(event.target.value)}
              placeholder="اختياري: مثال، نسبة متفق عليها مع البيت"
            />
          </label>
          <p className="micro-expense-route-note">
            درجة المعرفة:{" "}
            {sharedKnowledge === "known"
              ? "معروف"
              : sharedKnowledge === "estimated"
                ? "تقديري"
                : "يحتاج مراجعة"}
            . تدخل الحصة الموزّعة في نتيجة الفترة مرة واحدة، أما المؤجل فيظهر كغير موزّع ولا يساوي صفرًا.
          </p>
        </>
      ) : (
        <label className="micro-field">
          <span>درجة المعرفة</span>
          <select
            value={knowledge}
            onChange={event => setKnowledge(event.target.value as OperatingExpenseContext["knowledge"])}
          >
            <option value="known">معروف</option>
            <option value="estimated">تقديري</option>
            <option value="needs_review">يحتاج مراجعة</option>
          </select>
          <small>
            {knowledge === "known"
              ? "تؤكد أن المبلغ المسجل يمثل مصروف المشروع كما تعرفه الآن."
              : "سيبقى المصروف مسجلًا، لكن نتيجة الفترة ستصرح بأنه يحتاج مراجعة أو تقديرًا."}
          </small>
        </label>
      )}
      <p className="micro-expense-route-note">
        ليس هذا المكان لشراء خامات ستبقى في المخزون أو شراء أصل طويل الاستخدام أو سحب شخصي؛ هذه مسارات مالية
        مختلفة.
      </p>
    </section>
  );
}
