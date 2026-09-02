/** Style: Micro «مسار القرار» — short, phone-first material-purchase record; no inventory or expense claims. */
/* مبدأ Micro: يوضح مسار الشراء أثر الكاش أو الذمة، ويعرض تواريخه دون تحويله إلى تكلفة بيع. */
/* المجموعة ٢ (§10.4): مسار `:id` صار سطح تفاصيل الشراء وتصحيحه — تعديل موثق بمعاينة
 * أثر قبل الحفظ، وتراجع موثق عن الدفعات اللاحقة؛ الدفع الأولي يُصحح بتعديل الشراء نفسه. */
import { ArrowRight, RotateCcw, Save, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { CorrectionPreview } from "@/components/finance/CorrectionPreview";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { useFormDirty } from "@/components/forms/useFormDirty";
import { LocalDateValue, MoneyValue } from "@/components/presentation/DisplayValue";
import { formatMoneyMinor, localDateInAmman } from "@/presentation/formatters";
import type {
  SupplierPurchase,
  SupplierPurchasePayment,
} from "@micro-domain/supplier-purchase/index.js";

const ammanDate = () => localDateInAmman();

type EditorMode = "new" | "payment" | "edit";

export default function SupplierPurchaseEditor() {
  const { id } = useParams<{ id?: string }>();
  const [location, navigate] = useLocation();
  const isNew = id === "new";
  /* المجموعة ٢: `/suppliers/purchase/:id` = تفاصيل وتصحيح؛ `/payment` = دفعة. */
  const mode: EditorMode = isNew
    ? "new"
    : /\/payment\/?$/u.test(location)
      ? "payment"
      : "edit";
  /* المجموعة ١ (Scope A): الرجوع يعود للمصدر (?from) مع بديل قانوني موثّق. */
  const returnPath = useReturnPath();
  const { supplierPurchases, notifyDataChanged, dataVersion } = usePrototypeServices();
  const [purchase, setPurchase] = useState<SupplierPurchase | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [loadedToken, setLoadedToken] = useState(0);
  const [supplierName, setSupplierName] = useState("");
  const [note, setNote] = useState("");
  const [purchasedOn, setPurchasedOn] = useState(() => ammanDate());
  const [dueOn, setDueOn] = useState("");
  const [totalMinor, setTotalMinor] = useState(0);
  const [initialPaidMinor, setInitialPaidMinor] = useState(0);
  const [paymentMinor, setPaymentMinor] = useState(0);
  const [validMoney, setValidMoney] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /* وضع التعديل: خطوتان — تعبئة ثم معاينة الأثر قبل الحفظ (المجموعة ٢ §10.2). */
  const [editing, setEditing] = useState(false);
  const [editReason, setEditReason] = useState("");
  /* وضع التراجع عن دفعة: الدفعة المستهدفة وسببها. */
  const [reversalTarget, setReversalTarget] = useState<SupplierPurchasePayment | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const idempotencyKey = useRef(`supplier-ui-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);
  const editKeyRef = useRef(`supplier-edit-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);
  const reversalKeyRef = useRef(`payment-reversal-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);

  useEffect(() => {
    if (isNew || !id) return;
    supplierPurchases.list().then(result => {
      if (result.ok) {
        const found = result.value.find(item => item.id === id) ?? null;
        setPurchase(found);
        if (found) {
          /* وضع التعديل يبدأ معبّأً بقيم الشراء الحالية — البديل هو ما يُصحّح. */
          setSupplierName(found.supplierName);
          setNote(found.note);
          setPurchasedOn(found.purchasedOn);
          setDueOn(found.dueOn ?? "");
          setTotalMinor(found.totalMinor);
          const initial = found.payments.find(payment => payment.id === `${found.id}:initial`);
          setInitialPaidMinor(initial?.amountMinor ?? 0);
        }
      }
      setLoading(false);
      setLoadedToken(token => token + 1);
    });
  }, [id, isNew, supplierPurchases, dataVersion]);

  /* U-005 (دورة التدقيق النهائي): حماية المدخلات غير المحفوظة — الرجوع يمر
   * بالحارس: «ابقَ / احفظ ثم اخرج / اخرج بلا حفظ» كبقية المحررات العميقة. */
  const isDirty = useFormDirty(
    [
      supplierName,
      note,
      purchasedOn,
      dueOn,
      totalMinor,
      initialPaidMinor,
      paymentMinor,
      loadedToken,
    ],
    loadedToken,
  );
  const requestNavigation = useUnsavedChangesGuard({
    isDirty,
    onSave: () => (mode === "payment" ? savePayment() : mode === "edit" ? saveEdit() : savePurchase()),
  });

  async function savePurchase(): Promise<boolean> {
    if (!validMoney || totalMinor <= 0 || initialPaidMinor < 0) {
      setMessage("أدخل إجماليًا صالحًا بالأرقام 0–9.");
      return false;
    }
    if (initialPaidMinor > totalMinor) {
      setMessage("لا يمكن أن يتجاوز المدفوع الآن إجمالي الشراء.");
      return false;
    }
    setSaving(true);
    setMessage(null);
    const result = await supplierPurchases.recordPurchase({
      supplierName,
      note,
      purchasedOn,
      dueOn: dueOn || null,
      totalMinor,
      initialPaidMinor,
      idempotencyKey: idempotencyKey.current,
    });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return false;
    }
    notifyDataChanged();
    setMessage(result.reused ? "هذا الشراء محفوظ سابقًا؛ لم نكرر أثره." : "تم حفظ شراء المواد محليًا.");
    /* S1-07: الخروج بعد حفظ ناجح يعود للمصدر (?from) — عقد ٢٦ قاعدة ٣. */
    if (!result.reused) navigate(returnPath);
    return true;
  }
  async function savePayment(): Promise<boolean> {
    if (!purchase || !validMoney || paymentMinor <= 0) {
      setMessage("أدخل دفعة صالحة بالأرقام 0–9.");
      return false;
    }
    setSaving(true);
    setMessage(null);
    const result = await supplierPurchases.recordPayment({
      purchaseId: purchase.id,
      amountMinor: paymentMinor,
      occurredOn: purchasedOn,
      note: note || "دفعة مورد",
      idempotencyKey: idempotencyKey.current,
    });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return false;
    }
    notifyDataChanged();
    setMessage(result.reused ? "هذه الدفعة محفوظة سابقًا؛ لم نكرر أثرها." : "تم حفظ دفعة المورد محليًا.");
    /* S1-07: الخروج بعد حفظ ناجح يعود للمصدر (?from) — عقد ٢٦ قاعدة ٣. */
    if (!result.reused) navigate(returnPath);
    return true;
  }

  /* المجموعة ٢ (§10.4): التعديل الموثق — مراجعة + سبب + حفظ يمر بالخدمة. */
  async function saveEdit(): Promise<boolean> {
    if (!purchase || !validMoney || totalMinor <= 0 || initialPaidMinor < 0) {
      setMessage("أدخل إجماليًا صالحًا بالأرقام 0–9.");
      return false;
    }
    setSaving(true);
    setMessage(null);
    const result = await supplierPurchases.editPurchase({
      purchaseId: purchase.id,
      supplierName,
      note,
      purchasedOn,
      dueOn: dueOn || null,
      totalMinor,
      initialPaidMinor,
      reason: editReason,
      idempotencyKey: editKeyRef.current,
    });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return false;
    }
    notifyDataChanged();
    setEditing(false);
    setEditReason("");
    editKeyRef.current = `supplier-edit-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
    setMessage(result.reused ? "هذا التعديل موثق سابقًا؛ لم نكرر أثره." : "تم تعديل الشراء بمراجعة موثقة.");
    if (!result.reused) {
      setPurchase(result.value);
      setLoadedToken(token => token + 1);
    }
    return true;
  }

  async function savePaymentReversal(): Promise<boolean> {
    if (!purchase || !reversalTarget) return false;
    setSaving(true);
    setMessage(null);
    const result = await supplierPurchases.reversePayment({
      purchaseId: purchase.id,
      paymentId: reversalTarget.id,
      reason: reversalReason,
      occurredOn: ammanDate(),
      idempotencyKey: reversalKeyRef.current,
    });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return false;
    }
    notifyDataChanged();
    setReversalTarget(null);
    setReversalReason("");
    reversalKeyRef.current = `payment-reversal-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
    setMessage(result.reused ? "هذا التراجع موثق سابقًا؛ لم نكرر أثره." : "تم التراجع عن الدفعة موثقًا.");
    if (!result.reused) {
      setPurchase(result.value);
      setLoadedToken(token => token + 1);
    }
    return true;
  }

  /* معاينة تعديل الشراء: فروق الكاش/الذمة بين الأصل والقيم الجديدة.
   * G5-S6: حُرّك الـuseMemo فوق العوائد المبكرة (loading/غير موجود) — هوك بعد عائد
   * مبكر يغيّر عدد الهوكات بين الرندرات ويرمي React رقم 310 على مسار الدفعة/التعديل. */
  const editPreview = useMemo(() => {
    if (!purchase || mode !== "edit") return null;
    /* الإجمالي والدفع الأولي الجديدان يحددان المدفوع الجديد فوق الدفعات اللاحقة. */
    const laterPayments = purchase.payments
      .filter(payment => payment.id !== `${purchase.id}:initial`)
      .reduce((sum, payment) => sum + payment.amountMinor, 0);
    const reversed = (purchase.paymentReversals ?? []).reduce(
      (sum, reversal) => sum + reversal.amountMinor,
      0,
    );
    const paidAfter = initialPaidMinor + laterPayments - reversed;
    const payableComputed = totalMinor - paidAfter;
    return {
      payableBefore: purchase.payableMinor,
      payableAfter: payableComputed,
      cashBefore: purchase.paidMinor,
      cashAfter: paidAfter,
    };
  }, [purchase, mode, totalMinor, initialPaidMinor]);

  if (loading)
    return (
      <div className="micro-route-loading" role="status">
        جارٍ فتح شراء المورد…
      </div>
    );
  if (!isNew && !purchase)
    return (
      <section className="micro-page micro-not-found">
        <h1>شراء المواد غير موجود</h1>
        <p>قد يكون السجل حُذف من هذا الجهاز أو لم يعد متاحًا.</p>
        <button
          className="micro-button micro-button-primary"
          type="button"
          onClick={() => navigate("/suppliers")}
        >
          مشتريات المواد
        </button>
      </section>
    );

  const reversalPreview = reversalTarget && purchase ? {
    payment: reversalTarget,
    payableBefore: purchase.payableMinor,
    payableAfter: purchase.payableMinor + reversalTarget.amountMinor,
    paidBefore: purchase.paidMinor,
    paidAfter: purchase.paidMinor - reversalTarget.amountMinor,
  } : null;

  const paymentMode = mode === "payment";
  return (
    <section className="micro-page micro-finance-page">
      <button
        className="micro-back-button"
        type="button"
        onClick={() => requestNavigation(returnPath)}
      >
        <ArrowRight aria-hidden="true" /> مشتريات المواد
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">
          {paymentMode ? "دفعة مورد" : mode === "edit" ? "تفاصيل شراء وتصحيحه" : "شراء مواد"}
        </span>
        <h1>
          {paymentMode
            ? `دفعة إلى ${purchase?.supplierName ?? ""}`
            : mode === "edit"
              ? `شراء من ${purchase?.supplierName ?? ""}`
              : "سجل شراء مواد"}
        </h1>
        <p>
          {paymentMode
            ? "الدفع يخفض ما بقي لهذا الشراء ولا يسجل مصروفًا مرة ثانية."
            : mode === "edit"
              ? "عدّل الشراء بتصحيح موثق يُعرض أثره قبل الحفظ؛ والدفعة الأولية تُصحح هنا لا بتراجع منفصل."
              : "سجل واقع الشراء والدفع المتفق عليه. لن تحوله Micro إلى تكلفة بيع أو مخزون حتى المرحلة التالية."}
        </p>
      </div>
      {mode === "edit" && purchase ? (
        <>
          <section className="micro-decision-card">
            <span>حقيقة هذا الشراء الآن (د.أ)</span>
            <strong>
              <MoneyValue minor={purchase.totalMinor} /> إجمالي ·{" "}
              <MoneyValue minor={purchase.paidMinor} /> مدفوع ·{" "}
              <MoneyValue minor={purchase.payableMinor} /> متبقٍ
            </strong>
            <p>
              {purchase.note} · اشتري في <LocalDateValue value={purchase.purchasedOn} />
              {/* المجموعة ٦ (البند ٥): تاريخ الاستحقاق رقمي DD/MM/YYYY بجدار
                  ثنائي الاتجاه — لا نص ISO خام. */}
              {purchase.dueOn ? (
                <>
                  {" · يستحق في "}
                  <LocalDateValue value={purchase.dueOn} />
                </>
              ) : ""}
            </p>
            <p>
              تكلفة الشراء ليست مصروف بيع — تدخل النتيجة عند الاستهلاك مستقبلًا؛ أثره الآن كاش وذمة مورد.
            </p>
          </section>
          {/* الدفعات اللاحقة: التراجع الموثق من هنا (المجموعة ٢ §10.4). */}
          {purchase.payments.filter(payment => payment.id !== `${purchase.id}:initial`).length > 0 ? (
            <section className="micro-supplier-list" aria-label="دفعات مسجلة">
              <div className="micro-finance-event-heading">
                <span className="micro-overline">دفعات لاحقة مسجلة</span>
                <h2>تراجع موثق عند الحاجة</h2>
              </div>
              {purchase.payments
                .filter(payment => payment.id !== `${purchase.id}:initial`)
                .map(payment => {
                  const reversed = (purchase.paymentReversals ?? []).some(
                    reversal => reversal.paymentId === payment.id,
                  );
                  return (
                    <article key={payment.id}>
                      <div>
                        <strong>
                          <MoneyValue minor={payment.amountMinor} /> د.أ · {payment.note}
                        </strong>
                        <small>
                          <LocalDateValue value={payment.occurredOn} />
                          {reversed ? " · مرتدة موثقًا" : ""}
                        </small>
                      </div>
                      {!reversed ? (
                        <button
                          className="micro-button micro-button-quiet"
                          type="button"
                          onClick={() => {
                            setReversalTarget(payment);
                            setReversalReason("");
                          }}
                        >
                          <RotateCcw aria-hidden="true" /> تراجع موثق
                        </button>
                      ) : null}
                    </article>
                  );
                })}
            </section>
          ) : null}
          {reversalPreview ? (
            <CorrectionPreview
              action="تراجع موثق عن دفعة مورد"
              originalLabel={`دفعة ${formatMoneyMinor(reversalPreview.payment.amountMinor)} د.أ لـ${purchase.supplierName}`}
              originalDetail={reversalPreview.payment.note}
              intro="الدفعة الأصلية تبقى في السجل وعلاقة التدقيق صريحة؛ التراجع يستعيد المتبقي للمورد ويرد أثر الكاش المدفوع."
              dimensions={[
                { label: "الكاش المدفوع للمورد", beforeMinor: reversalPreview.paidBefore, afterMinor: reversalPreview.paidAfter },
                { label: "ذمة المورد", beforeMinor: reversalPreview.payableBefore, afterMinor: reversalPreview.payableAfter },
                { label: "مصروف/نتيجة الفترة", beforeMinor: 0, afterMinor: 0 },
              ]}
              unchanged={["تكلفة الشراء لا تتغير — لا مصروف يُنشأ ولا يُلغى"]}
              resulting={[
                { label: "المتبقي للمورد بعد التراجع", amountMinor: reversalPreview.payableAfter },
              ]}
              reversibleNote="تراجع واحد لكل دفعة — لا يُنشأ تراجع ثانٍ لنفس الدفعة."
              reason={reversalReason}
              onReasonChange={setReversalReason}
              reasonPlaceholder="مثال: رُدّت الدفعة بالتحويل خطأً"
              error={message}
              busy={saving}
              confirmLabel="أكّد التراجع الموثق"
              busyLabel="جارٍ توثيق التراجع…"
              onConfirm={() => void savePaymentReversal()}
              onCancel={() => {
                setReversalTarget(null);
                setReversalReason("");
              }}
            />
          ) : null}
          {!editing ? (
            <div className="micro-form-actions">
              <button
                className="micro-button micro-button-primary"
                type="button"
                onClick={() => setEditing(true)}
              >
                <Undo2 aria-hidden="true" /> عدّل هذا الشراء
              </button>
              <button
                className="micro-button micro-button-secondary"
                type="button"
                onClick={() =>
                  requestNavigation(`/suppliers/purchase/${encodeURIComponent(purchase.id)}/payment`)
                }
              >
                سجّل دفعة إضافية
              </button>
            </div>
          ) : null}
          {editing ? (
            <section className="micro-form-card" aria-label="تعديل الشراء">
              <label className="micro-field">
                <span>اسم المورد</span>
                <input
                  value={supplierName}
                  onChange={event => setSupplierName(event.target.value)}
                  placeholder="مثال: مورد الخشب"
                />
              </label>
              <label className="micro-field">
                <span>ماذا اشتريت؟</span>
                <textarea value={note} onChange={event => setNote(event.target.value)} />
              </label>
              <LocalDateField
                label="تاريخ الشراء"
                value={purchasedOn}
                onChange={event => setPurchasedOn(event.target.value)}
              />
              <div className="micro-field-grid">
                <label className="micro-field">
                  <span>إجمالي الشراء (د.أ)</span>
                  <EnglishNumberInput
                    value={totalMinor}
                    kind="money"
                    onNumericChange={setTotalMinor}
                    onTextValidityChange={setValidMoney}
                    aria-label="إجمالي الشراء بالدينار الأردني"
                  />
                </label>
                <label className="micro-field">
                  <span>الدفع الأولي (د.أ)</span>
                  <EnglishNumberInput
                    value={initialPaidMinor}
                    kind="money"
                    onNumericChange={setInitialPaidMinor}
                    onTextValidityChange={setValidMoney}
                    aria-label="الدفع الأولي بالدينار الأردني"
                  />
                </label>
              </div>
              <LocalDateField
                label="تاريخ الاستحقاق إن عرفت"
                description="اتركه فارغًا إذا لم تتفق على موعد واضح."
                value={dueOn}
                onChange={event => setDueOn(event.target.value)}
              />
              {message && message.startsWith("أدخل") ? (
                <p className="micro-field-error" role="alert">
                  {message}
                </p>
              ) : null}
              {editPreview ? (
                <CorrectionPreview
                  action="تعديل موثق لسجل الشراء"
                  originalLabel={`شراء من ${purchase.supplierName} · ${formatMoneyMinor(purchase.totalMinor)} د.أ`}
                  originalDetail={`دفع أولي ${formatMoneyMinor(
                    purchase.payments.find(payment => payment.id === `${purchase.id}:initial`)?.amountMinor ?? 0,
                  )} د.أ`}
                  intro="التعديل يُحفظ بمراجعة موثقة تحفظ القيم قبل التصحيح؛ الدفعات اللاحقة وتراجعاتها لا تُمس."
                  dimensions={[
                    { label: "ذمة المورد", beforeMinor: editPreview.payableBefore, afterMinor: editPreview.payableAfter },
                    { label: "الكاش المدفوع للمورد", beforeMinor: editPreview.cashBefore, afterMinor: editPreview.cashAfter },
                    { label: "مصروف/نتيجة الفترة", beforeMinor: 0, afterMinor: 0 },
                  ]}
                  unchanged={["الدفعات اللاحقة كما سُجّلت", "السجل الأصلي باقٍ في التاريخ"]}
                  resulting={[{ label: "المتبقي للمورد بعد التعديل", amountMinor: editPreview.payableAfter }]}
                  reversibleNote="يمكن تصحيح لاحق بتعديل موثق جديد؛ كل مراجعة تُحفظ بقيم ما قبلها."
                  reason={editReason}
                  onReasonChange={setEditReason}
                  reasonPlaceholder="مثال: فاتورة مصححة من المورد"
                  error={message}
                  busy={saving}
                  confirmLabel="أكّد تعديل الشراء"
                  busyLabel="جارٍ حفظ التعديل…"
                  onConfirm={() => void saveEdit()}
                  onCancel={() => {
                    setEditing(false);
                    setEditReason("");
                  }}
                />
              ) : null}
            </section>
          ) : null}
          {message && !message.startsWith("أدخل") ? (
            <p className="micro-save-note" role="status">
              {message}
            </p>
          ) : null}
        </>
      ) : (
        <>
          {paymentMode ? (
            <section className="micro-decision-card">
              <span>المتبقي قبل هذه الدفعة (د.أ)</span>
              <strong>
                <MoneyValue minor={purchase?.payableMinor ?? 0} />
              </strong>
              <p>
                {purchase?.note} · اشتري في <LocalDateValue value={purchase?.purchasedOn ?? ""} />
              </p>
            </section>
          ) : (
            <section className="micro-decision-card">
              <span>حد الحقيقة</span>
              <strong>شراء المواد لا يساوي مصروف بيع</strong>
              <p>سيظهر أثره في الكاش أو ما عليك للمورد فقط، إلى أن نبني المخزون والاستهلاك.</p>
            </section>
          )}
          <section className="micro-form-card">
            {isNew ? (
              <>
                <label className="micro-field">
                  <span>اسم المورد</span>
                  <input
                    value={supplierName}
                    onChange={event => setSupplierName(event.target.value)}
                    placeholder="مثال: مورد الخشب"
                  />
                </label>
                <label className="micro-field">
                  <span>ماذا اشتريت؟</span>
                  <textarea
                    value={note}
                    onChange={event => setNote(event.target.value)}
                    placeholder="مثال: خامات لطلبات قادمة"
                  />
                </label>
                <LocalDateField
                  label="تاريخ الشراء"
                  value={purchasedOn}
                  onChange={event => setPurchasedOn(event.target.value)}
                />
                <div className="micro-field-grid">
                  <label className="micro-field">
                    <span>إجمالي الشراء (د.أ)</span>
                    <EnglishNumberInput
                      value={totalMinor}
                      kind="money"
                      onNumericChange={setTotalMinor}
                      onTextValidityChange={setValidMoney}
                      aria-label="إجمالي الشراء بالدينار الأردني"
                    />
                  </label>
                  <label className="micro-field">
                    <span>ما دُفع الآن</span>
                    <EnglishNumberInput
                      value={initialPaidMinor}
                      kind="money"
                      onNumericChange={setInitialPaidMinor}
                      onTextValidityChange={setValidMoney}
                      aria-label="ما دُفع الآن"
                    />
                  </label>
                </div>
                <LocalDateField
                  label="تاريخ الاستحقاق إن عرفت"
                  description="اتركه فارغًا إذا لم تتفق على موعد واضح."
                  value={dueOn}
                  onChange={event => setDueOn(event.target.value)}
                />
              </>
            ) : (
              <>
                <label className="micro-field">
                  <span>مبلغ الدفعة (د.أ)</span>
                  <EnglishNumberInput
                    value={paymentMinor}
                    kind="money"
                    onNumericChange={setPaymentMinor}
                    onTextValidityChange={setValidMoney}
                    aria-label="مبلغ دفعة المورد"
                  />
                </label>
                <LocalDateField
                  label="تاريخ الدفعة"
                  value={purchasedOn}
                  onChange={event => setPurchasedOn(event.target.value)}
                />
                <label className="micro-field">
                  <span>وصف قصير للدفعة</span>
                  <textarea
                    value={note}
                    onChange={event => setNote(event.target.value)}
                    placeholder="مثال: دفعة ثانية للمورد"
                  />
                </label>
              </>
            )}
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
            <div className="micro-form-actions micro-sticky-save">
              <button
                className="micro-button micro-button-primary micro-save-cost"
                type="button"
                disabled={saving}
                onClick={paymentMode ? savePayment : savePurchase}
              >
                <Save aria-hidden="true" />
                {saving ? "جارٍ الحفظ…" : paymentMode ? "حفظ الدفعة" : "حفظ شراء المواد"}
              </button>
            </div>
          </section>
        </>
      )}
    </section>
  );
}
