/** Micro G3 UI: phone-first RTL form; one financial action, explicit knowledge, and no hidden allocation. */
import { ArrowRight, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { formatMoneyMinor, localDateInAmman } from "@/presentation/formatters";
import type { FinancialEvent, FinancialEventType, OperatingExpenseContext, SharedProjectShareBasis } from "@micro-domain/financial-event/index.js";

const definition: Record<FinancialEventType, { title: string; description: string; effect: string; counterparty: string }> = {
  owner_investment_cash: { title: "تسجيل استثمار المالك", description: "مال أُدخل للمشروع. ليس مبيعات ولا ربحًا.", effect: "يزيد الكاش المسجل ومال المالك فقط.", counterparty: "اختياري: مصدر المال" },
  owner_withdrawal_cash: { title: "تسجيل سحب شخصي", description: "مال أخذه المالك من المشروع لاستعمال شخصي.", effect: "ينقص الكاش ومال المالك؛ لا يسجل مصروف تشغيل.", counterparty: "اختياري: ملاحظة السحب" },
  operating_expense_cash: { title: "تسجيل مصروف مدفوع", description: "خروج كاش فعلي لمصروف تشغيلي معروف.", effect: "ينقص الكاش ويسجل مصروفًا، لكنه لا يحمّل تلقائيًا على طلب.", counterparty: "الجهة المدفوع لها" },
  operating_expense_payable: { title: "تسجيل مصروف مستحق", description: "مصروف أو فاتورة للمشروع لم تُدفع بعد.", effect: "يزيد ما عليك للمورد ويسجل مصروفًا، من دون تغيير الكاش.", counterparty: "المورد أو الجهة المستحقة" },
  payable_settlement_cash: { title: "تسديد التزام", description: "دفع كاش مقابل التزام سجلته سابقًا لمورد.", effect: "ينقص الكاش وما عليك، ولا يسجل المصروف مرة ثانية.", counterparty: "المورد أو الجهة المستحقة" },
};
const types = new Set<FinancialEventType>(Object.keys(definition) as FinancialEventType[]);
const ammanDate = () => {
  return localDateInAmman();
};
const knowledgeFromBasis = (basis: SharedProjectShareBasis): OperatingExpenseContext["knowledge"] => basis === "agreed_fixed_share" ? "known" : basis === "owner_estimate" ? "estimated" : "needs_review";
const sourceDescription: Record<SharedProjectShareBasis, string> = {
  agreed_fixed_share: "حصة ثابتة معلنة للمشروع؛ تظهر النتيجة مسجلة ضمن حدودها المعروفة.",
  owner_estimate: "تقديرك الحالي لحصة المشروع؛ تدخل النتيجة مرة واحدة وتبقى الصورة ناقصة.",
  needs_review: "تعرف أن المبلغ حصة للمشروع، لكنك تحتاج مراجعة مصدره قبل الاعتماد عليه.",
};

export default function FinancialEventEditor() {
  const { type: rawType } = useParams<{ type: string }>();
  const [, navigate] = useLocation();
  const { projectFinance, notifyDataChanged } = usePrototypeServices();
  const type = types.has(rawType as FinancialEventType) ? rawType as FinancialEventType : null;
  const [amountMinor, setAmountMinor] = useState(0);
  const [validAmount, setValidAmount] = useState(true);
  const [date, setDate] = useState(() => ammanDate());
  const [note, setNote] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [relationship, setRelationship] = useState<OperatingExpenseContext["relationship"]>("project");
  const [behavior, setBehavior] = useState<OperatingExpenseContext["behavior"]>("unknown");
  const [purpose, setPurpose] = useState<OperatingExpenseContext["purpose"]>("project_general");
  const [knowledge, setKnowledge] = useState<OperatingExpenseContext["knowledge"]>("known");
  const [sharedBasis, setSharedBasis] = useState<SharedProjectShareBasis>("owner_estimate");
  const [sharedNote, setSharedNote] = useState("");
  const [events, setEvents] = useState<readonly FinancialEvent[]>([]);
  const [relatedEventId, setRelatedEventId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const idempotencyKey = useRef(`finance-ui-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);

  useEffect(() => { projectFinance.listEvents().then((result) => { if (result.ok) setEvents(result.value); }); }, [projectFinance]);
  const payableOptions = useMemo(() => events
    .filter((event) => event.type === "operating_expense_payable")
    .map((event) => ({ event, remaining: event.amountMinor - events.filter((candidate) => candidate.type === "payable_settlement_cash" && candidate.relatedEventId === event.id).reduce((sum, candidate) => sum + candidate.amountMinor, 0) }))
    .filter((item) => item.remaining > 0), [events]);

  if (!type) return <section className="micro-page micro-not-found"><h1>نوع الحدث غير متاح</h1><p>ارجع إلى الوضع المالي واختر حدثًا واضحًا.</p><button className="micro-button micro-button-primary" type="button" onClick={() => navigate("/finance")}>الوضع المالي</button></section>;

  const content = definition[type];
  const isOperatingExpense = type === "operating_expense_cash" || type === "operating_expense_payable";
  const sharedKnowledge = knowledgeFromBasis(sharedBasis);
  const expenseContext: OperatingExpenseContext | null = !isOperatingExpense ? null : relationship === "shared"
    ? { relationship, behavior, purpose, knowledge: sharedKnowledge, sharedProjectShare: { basis: sharedBasis, note: sharedNote.trim() || null } }
    : { relationship, behavior, purpose, knowledge, sharedProjectShare: null };

  async function save() {
    const selectedType = type;
    if (!selectedType) return;
    if (!validAmount || amountMinor <= 0) { setMessage("أدخل مبلغًا صالحًا بالأرقام الإنجليزية قبل الحفظ."); return; }
    setMessage(null); setSaving(true);
    const result = await projectFinance.record({ type: selectedType, amountMinor, occurredOn: date, note, counterparty: counterparty || null, relatedEventId: selectedType === "payable_settlement_cash" ? relatedEventId || null : null, expenseContext, idempotencyKey: idempotencyKey.current });
    setSaving(false);
    if (!result.ok) { setMessage(result.message); return; }
    notifyDataChanged();
    setMessage(result.reused ? "هذا الحدث محفوظ سابقًا؛ لم نكرر أثره." : "تم حفظ الحدث المالي محليًا.");
  }

  return <section className="micro-page micro-finance-page">
    <button className="micro-back-button" type="button" onClick={() => navigate("/finance")}><ArrowRight aria-hidden="true" /> الوضع المالي</button>
    <div className="micro-page-heading"><span className="micro-overline">حدث مالي محلي</span><h1>{content.title}</h1><p>{content.description}</p></div>
    <section className="micro-decision-card"><span>الأثر المعروف</span><strong>{content.effect}</strong><p>لا يغيّر هذا الحدث نتيجة طلب قائم أو صافي ربح المشروع تلقائيًا.</p></section>
    <section className="micro-form-card">
      <label className="micro-field"><span>المبلغ بالدينار الأردني</span><EnglishNumberInput value={amountMinor} kind="money" onNumericChange={setAmountMinor} onTextValidityChange={setValidAmount} aria-label="المبلغ بالدينار الأردني" /></label>
      <label className="micro-field"><span>تاريخ الواقعة</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      <label className="micro-field"><span>{content.counterparty}</span><input value={counterparty} onChange={(event) => setCounterparty(event.target.value)} placeholder="اختياري" /></label>
      {isOperatingExpense ? <ExpenseClassification
        relationship={relationship} setRelationship={setRelationship}
        behavior={behavior} setBehavior={setBehavior}
        purpose={purpose} setPurpose={setPurpose}
        knowledge={knowledge} setKnowledge={setKnowledge}
        sharedBasis={sharedBasis} setSharedBasis={setSharedBasis}
        sharedNote={sharedNote} setSharedNote={setSharedNote}
        sharedKnowledge={sharedKnowledge}
      /> : null}
      {type === "payable_settlement_cash" ? <label className="micro-field"><span>الالتزام الذي تسدده (المبالغ بد.أ)</span><select value={relatedEventId} onChange={(event) => setRelatedEventId(event.target.value)}><option value="">اختر التزامًا مسجلًا</option>{payableOptions.map(({ event, remaining }) => <option key={event.id} value={event.id}>{event.note} · المتبقي {formatMoneyOption(remaining)}</option>)}</select></label> : null}
      <label className="micro-field"><span>ما الذي حدث؟</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="مثال: دفعت توصيل الطلبات للأسبوع" /></label>
      {message ? <p className={message.startsWith("تم ") || message.startsWith("هذا ") ? "micro-save-note" : "micro-field-error"} role="status">{message}</p> : null}
      <button className="micro-button micro-button-primary micro-save-cost" type="button" disabled={saving} onClick={save}><Save aria-hidden="true" />{saving ? "جارٍ الحفظ…" : isOperatingExpense ? "حفظ المصروف المصنف" : "حفظ الحدث"}</button>
    </section>
  </section>;
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
  sharedBasis: SharedProjectShareBasis;
  setSharedBasis: (value: SharedProjectShareBasis) => void;
  sharedNote: string;
  setSharedNote: (value: string) => void;
  sharedKnowledge: OperatingExpenseContext["knowledge"];
};

function formatMoneyOption(minor: number) { return formatMoneyMinor(minor); }

function ExpenseClassification(props: ExpenseClassificationProps) {
  const { relationship, setRelationship, behavior, setBehavior, purpose, setPurpose, knowledge, setKnowledge, sharedBasis, setSharedBasis, sharedNote, setSharedNote, sharedKnowledge } = props;
  return <section className="micro-expense-classification" aria-labelledby="expense-classification-title">
    <div><span className="micro-overline">افهم الأثر قبل الحفظ</span><h2 id="expense-classification-title">كيف يخدم هذا المصروف المشروع؟</h2><p>التصنيف لا يحمّل المصروف على طلب تلقائيًا؛ هو يوضح سياقه ودرجة معرفتك به.</p></div>
    <label className="micro-field"><span>علاقة المبلغ بالمشروع</span><select value={relationship} onChange={(event) => setRelationship(event.target.value as OperatingExpenseContext["relationship"])}><option value="project">للمشروع بالكامل</option><option value="shared">حصة المشروع من مصروف مشترك</option></select><small>{relationship === "shared" ? "أدخل حصة المشروع فقط، لا إجمالي فاتورة البيت أو الاستخدام الشخصي." : "هذا المبلغ يخدم المشروع بالكامل كما هو مسجل."}</small></label>
    <div className="micro-field-grid"><label className="micro-field"><span>سلوكه</span><select value={behavior} onChange={(event) => setBehavior(event.target.value as OperatingExpenseContext["behavior"])}><option value="fixed">ثابت غالبًا</option><option value="variable">يتغير مع العمل</option><option value="mixed">مختلط</option><option value="unknown">غير متأكد</option></select></label><label className="micro-field"><span>ما الذي يخدمه؟</span><select value={purpose} onChange={(event) => setPurpose(event.target.value as OperatingExpenseContext["purpose"])}><option value="project_general">المشروع عمومًا</option><option value="period">فترة محددة</option><option value="order">طلب محدد</option><option value="product">منتج محدد</option><option value="campaign">حملة</option><option value="unallocated">لا أوزعه الآن</option></select></label></div>
    {relationship === "shared" ? <><label className="micro-field"><span>كيف عرفت أن هذا مبلغ حصة المشروع؟</span><select value={sharedBasis} onChange={(event) => setSharedBasis(event.target.value as SharedProjectShareBasis)}><option value="agreed_fixed_share">حصة ثابتة معلنة</option><option value="owner_estimate">تقديري الحالي</option><option value="needs_review">أحتاج مراجعة المصدر</option></select><small>{sourceDescription[sharedBasis]}</small></label><label className="micro-field"><span>ملاحظة عن المصدر</span><input value={sharedNote} onChange={(event) => setSharedNote(event.target.value)} placeholder="اختياري: مثال، نسبة متفق عليها مع البيت" /></label><p className="micro-expense-route-note">درجة المعرفة: {sharedKnowledge === "known" ? "معروف" : sharedKnowledge === "estimated" ? "تقديري" : "يحتاج مراجعة"}. تدخل الحصة في نتيجة الفترة مرة واحدة، ولا توزع على طلب أو منتج.</p></> : <label className="micro-field"><span>درجة المعرفة</span><select value={knowledge} onChange={(event) => setKnowledge(event.target.value as OperatingExpenseContext["knowledge"])}><option value="known">معروف</option><option value="estimated">تقديري</option><option value="needs_review">يحتاج مراجعة</option></select><small>{knowledge === "known" ? "تؤكد أن المبلغ المسجل يمثل حصة المشروع كما تعرفها الآن." : "سيبقى المصروف مسجلًا، لكن نتيجة الفترة ستصرح بأنه يحتاج مراجعة."}</small></label>}
    <p className="micro-expense-route-note">ليس هذا المكان لشراء خامات ستبقى في المخزون أو شراء أصل طويل الاستخدام أو سحب شخصي؛ هذه مسارات مالية مختلفة.</p>
  </section>;
}
