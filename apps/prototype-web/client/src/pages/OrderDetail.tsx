/* مبدأ Micro: يعرض الطلب حالته الفعلية وفعلًا تاليًا واحدًا، ولا يساوي الحفظ ببدء التنفيذ أو التحصيل. */
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  CircleAlert,
  Hammer,
  HandCoins,
  Landmark,
  MessageCircle,
  PackageCheck,
  Play,
  Save,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type { AgreementResult } from "@/application/agreements/agreementService";
import type {
  AgreementContextService,
  AgreementSourceValue,
} from "@/application/agreements/agreementContextService";
import type { FulfillmentResult } from "@/application/fulfillment/fulfillmentService";
import type { OrderActualMaterialComparison } from "@/application/inventory/inventoryMaterialService";
import { ActualTimePanel } from "@/components/presentation/ActualTimePanel";
import { DateTimeValue, LocalDateValue, MoneyValue } from "@/components/presentation/DisplayValue";
import type { AgreementSource, StoredCraftOrder } from "@/storage/local/types";
import { classifyFollowUpDate, localDateInAmman } from "@/application/agreements/followUpDate";
import { getAgreementPresentation } from "@/presentation/orderAgreementPresentation";

const eventLabel: Record<string, string> = {
  created: "إنشاء الطلب",
  status_changed: "تحديث الحالة",
  deposit_collected: "تسجيل العربون",
  collection_recorded: "تسجيل قبض",
  debt_registered: "تسجيل دين",
  specification_revised: "تعديل المواصفات",
  cancelled: "إلغاء",
  deposit_refunded: "رد العربون",
  deposit_retained: "تسوية العربون",
  price_approved: "تسجيل السعر",
};
const resultCopy: Record<string, [string, string]> = {
  final: ["نتيجة الطلب معروفة", "حسب بيانات تكلفة معروفة."],
  estimated: ["نتيجة الطلب تقديرية", "توجد افتراضات في التكلفة."],
  incomplete: ["النتيجة غير مكتملة", "أكمل بيانات الوقت أو التكلفة قبل اعتبارها نهائية."],
  review_required: ["النتيجة تحتاج مراجعة", "راجع الفرضيات أو التعارض قبل اتخاذ قرار جديد."],
};
const agreementSourceLabel: Record<string, string> = {
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  referral: "إحالة",
  walk_in: "زيارة مباشرة",
  other: "أخرى",
  conversation: "محادثة (سجل قديم)",
  call: "مكالمة (سجل قديم)",
  in_person: "لقاء مباشر (سجل قديم)",
};
const allowedSources: readonly AgreementSource[] = ["instagram", "whatsapp", "referral", "walk_in", "other"];
const followUpStateLabel: Record<ReturnType<typeof classifyFollowUpDate>, string> = {
  none: "لا يوجد موعد متابعة",
  invalid: "موعد متابعة يحتاج مراجعة",
  overdue: "متابعة متأخرة",
  today: "متابعة مستحقة اليوم",
  upcoming: "متابعة قادمة",
};
const followUpState = (date: string | null) =>
  followUpStateLabel[classifyFollowUpDate(date, localDateInAmman(new Date()))];

type MaterialState =
  { phase: "loading" } | { phase: "error" } | { phase: "ready"; comparison: OrderActualMaterialComparison };
type OrderDetailState =
  { phase: "loading" } | { phase: "error" } | { phase: "ready"; stored: StoredCraftOrder };
const preDeliveryStatuses = ["provisional_agreement", "confirmed", "in_progress", "ready"];

export default function OrderDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { actualTime, agreements, agreementContext, fulfillment, inventory, dataVersion, notifyDataChanged } =
    usePrototypeServices();
  const [stored, setStored] = useState<StoredCraftOrder | null>(null);
  const [state, setState] = useState<OrderDetailState>({ phase: "loading" });
  const [materialState, setMaterialState] = useState<MaterialState>({ phase: "loading" });
  const [message, setMessage] = useState<string | null>(null);
  const [isActing, setIsActing] = useState(false);
  /* القرار ١٩: الإلغاء بثلاثة أسباب بنقرة مع تخطٍ متاح، والعربون ثلاثة خيارات. */
  const [cancelPanelOpen, setCancelPanelOpen] = useState(false);
  const [otherReason, setOtherReason] = useState("");
  const [otherReasonOpen, setOtherReasonOpen] = useState(false);
  const [depositReason, setDepositReason] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([agreements.get(params.id), inventory.readOrderActualMaterialComparison(params.id)])
      .then(([orderResult, materialResult]) => {
        if (!active) return;
        if (!orderResult.ok || !orderResult.stored) {
          setState({ phase: "error" });
          return;
        }
        setStored(orderResult.stored);
        setState({ phase: "ready", stored: orderResult.stored });
        setMaterialState(
          materialResult.ok ? { phase: "ready", comparison: materialResult.value } : { phase: "error" },
        );
      })
      .catch(() => {
        if (active) setState({ phase: "error" });
      });
    return () => {
      active = false;
    };
  }, [agreements, inventory, dataVersion, params.id]);

  if (state.phase === "loading")
    return (
      <div className="micro-route-loading" role="status">
        جارٍ فتح الطلب…
      </div>
    );
  if (state.phase === "error" || !stored)
    return (
      <section className="micro-page micro-not-found">
        <h1>الطلب غير متاح محليًا</h1>
        <p>ارجع إلى قائمة الطلبات، ثم أعد المحاولة.</p>
        <button
          className="micro-button micro-button-primary"
          type="button"
          onClick={() => navigate("/orders")}
        >
          الطلبات
        </button>
      </section>
    );

  const { order } = stored;
  const agreement = getAgreementPresentation({
    status: order.status,
    agreedPriceMinor: order.agreedPriceMinor,
    deliveryDate: stored.deliveryDate,
    nextAction: order.nextAction,
  });
  const label = agreement.label;
  const result = resultCopy[order.resultStatus] ?? resultCopy.review_required;

  async function run(action: () => Promise<FulfillmentResult | AgreementResult>) {
    setMessage(null);
    setIsActing(true);
    const next = await action();
    setIsActing(false);
    if (!next.ok) {
      setMessage(next.message);
      return;
    }
    setStored(next.stored);
    setState({ phase: "ready", stored: next.stored });
    notifyDataChanged();
  }

  async function cancelWithReason(reason: string) {
    setCancelPanelOpen(false);
    setOtherReasonOpen(false);
    setOtherReason("");
    await run(() => fulfillment.cancel(stored!.id, reason));
  }

  const contextualAction =
    order.status === "provisional_agreement" ? (
      <button
        className="micro-button micro-button-primary micro-save-cost"
        type="button"
        disabled={isActing}
        onClick={() => {
          void run(() => agreements.startExecution(stored.id));
        }}
      >
        <Play aria-hidden="true" />
        {isActing ? "جارٍ بدء التنفيذ…" : "ابدأ التنفيذ"}
      </button>
    ) : order.status === "in_progress" ? (
      <button
        className="micro-button micro-button-primary micro-save-cost"
        type="button"
        disabled={isActing}
        onClick={() => {
          void run(() => fulfillment.markReady(stored.id));
        }}
      >
        <PackageCheck aria-hidden="true" />
        {isActing ? "جارٍ حفظ الجاهزية…" : "الطلب جاهز للتسليم"}
      </button>
    ) : order.status === "ready" ? (
      <button
        className="micro-button micro-button-primary micro-save-cost"
        type="button"
        disabled={isActing}
        onClick={() => {
          void run(() => fulfillment.deliver(stored.id));
        }}
      >
        <CheckCircle2 aria-hidden="true" />
        {isActing ? "جارٍ تسجيل التسليم…" : "تم التسليم"}
      </button>
    ) : order.status === "delivered" && order.receivableMinor > 0 ? (
      <div className="micro-form-actions micro-contextual-actions">
        <button
          className="micro-button micro-button-primary"
          type="button"
          disabled={isActing}
          onClick={() => {
            void run(() => fulfillment.collectFullRemaining(stored.id));
          }}
        >
          <HandCoins aria-hidden="true" /> تحصيل المتبقي الآن
        </button>
        <button
          className="micro-button micro-button-secondary"
          type="button"
          disabled={isActing}
          onClick={() => {
            void run(() => fulfillment.registerRemainingDebt(stored.id));
          }}
        >
          <Landmark aria-hidden="true" /> تسجيله دينًا
        </button>
      </div>
    ) : null;

  return (
    <section className="micro-page micro-order-page">
      <button className="micro-back-button" type="button" onClick={() => navigate("/orders")}>
        <ArrowRight aria-hidden="true" /> الطلبات
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">{label}</span>
        <h1>{order.itemName}</h1>
        <p>
          {order.customerName} · الكمية: {order.quantity}
        </p>
      </div>
      <section className="micro-decision-card">
        <span>الخطوة التالية</span>
        <strong>{agreement.nextAction}</strong>
        <p>
          موعد التسليم: <LocalDateValue value={stored.deliveryDate} />
        </p>
      </section>
      <section className="micro-summary-grid">
        <div>
          <span>السعر المتفق عليه (د.أ)</span>
          <strong>
            <MoneyValue minor={order.agreedPriceMinor} />
          </strong>
        </div>
        <div>
          <span>{order.settlementStatus === "debt" ? "دين مسجل (د.أ)" : "المتبقي (د.أ)"}</span>
          <strong>
            <MoneyValue minor={order.receivableMinor} />
          </strong>
        </div>
      </section>
      {order.depositCollectedMinor > 0 ? (
        <section className="micro-deposit-truth">
          <CircleDollarSign aria-hidden="true" />
          <span>
            <b>
              عربون محصل (د.أ):{" "}
              <MoneyValue minor={order.depositCollectedMinor} className="micro-inline-number" />
            </b>
            <br />
            كاش مرتبط بالطلب، وليس ربحًا نهائيًا.
          </span>
        </section>
      ) : (
        <section className="micro-note-card">
          <span>العربون</span>
          <p>لم يسجل عربون لهذا الطلب. هذا لا يغيّر حالة التسليم أو التحصيل لاحقًا.</p>
        </section>
      )}
      {contextualAction}
      {/* القرار ١٩: الإلغاء من أي حالة قبل التسليم عبر cancelOrder وحدها (عقد ٠٢) —
          السبب اختياري بثلاثة أزرار بنقرة، والتخطي متاح. */}
      {preDeliveryStatuses.includes(order.status) ? (
        cancelPanelOpen ? (
          <section className="micro-cancel-panel" aria-label="تأكيد إلغاء الطلب">
            <strong>لماذا تلغي هذا الطلب؟</strong>
            <p>
              السبب اختياري — اختر بنقرة أو تخطَّ. الإلغاء لا يحذف الطلب ولا أحداثه؛ يسجّل تسوية موثقة
              ويبقى في السجل.
            </p>
            {order.depositCollectedMinor > 0 ? (
              <p className="micro-warning-copy">
                يوجد عربون محصل (
                <MoneyValue minor={order.depositCollectedMinor} className="micro-inline-number" /> د.أ) —
                يبقى بعد الإلغاء «يحتاج مراجعة» حتى تردّه أو تحتفظ به صراحة، وهذا خيار صالح لا خطأ.
              </p>
            ) : null}
            <div className="micro-form-actions micro-contextual-actions">
              <button
                className="micro-button micro-button-secondary"
                type="button"
                disabled={isActing}
                onClick={() => {
                  void cancelWithReason("غلط في السعر");
                }}
              >
                غلط في السعر
              </button>
              <button
                className="micro-button micro-button-secondary"
                type="button"
                disabled={isActing}
                onClick={() => {
                  void cancelWithReason("انسحب العميل");
                }}
              >
                انسحب العميل
              </button>
              <button
                className="micro-button micro-button-secondary"
                type="button"
                disabled={isActing}
                onClick={() => setOtherReasonOpen(true)}
              >
                سبب آخر
              </button>
              <button
                className="micro-button micro-button-quiet"
                type="button"
                disabled={isActing}
                onClick={() => {
                  void cancelWithReason("");
                }}
              >
                تخطّى السبب وألغِ
              </button>
              <button
                className="micro-button micro-button-quiet"
                type="button"
                onClick={() => setCancelPanelOpen(false)}
              >
                تراجع
              </button>
            </div>
            {otherReasonOpen ? (
              <div className="micro-form-actions micro-contextual-actions">
                <label className="micro-field">
                  <span>سبب الإلغاء</span>
                  <input
                    value={otherReason}
                    onChange={event => setOtherReason(event.target.value)}
                    placeholder="مثال: تغيرت مواصفات الطلب"
                  />
                </label>
                <button
                  className="micro-button micro-button-primary"
                  type="button"
                  disabled={isActing || !otherReason.trim()}
                  onClick={() => {
                    void cancelWithReason(otherReason);
                  }}
                >
                  ألغِ الطلب بهذا السبب
                </button>
              </div>
            ) : null}
          </section>
        ) : (
          <button
            className="micro-button micro-button-quiet"
            type="button"
            disabled={isActing}
            onClick={() => setCancelPanelOpen(true)}
          >
            <XCircle aria-hidden="true" /> إلغاء الطلب
          </button>
        )
      ) : null}
      {/* القرار ١٩: عربون طلب ملغى ينتظر قرارًا — ثلاثة خيارات لا اثنان. */}
      {order.status === "cancelled" && order.depositSettlement === "needs_review" ? (
        <section className="micro-cancel-panel" aria-label="تسوية عربون طلب ملغى">
          <strong>
            عربون محصل ينتظر قرارك (
            <MoneyValue minor={order.depositCollectedMinor} className="micro-inline-number" /> د.أ)
          </strong>
          <p>
            ردّ العربون ينزل الرصيد المقبوض فعليًا، والاحتفاظ به يبقيه محصلًا. أو اتركه «يحتاج مراجعة»
            وتابع لاحقًا — خيار صالح لا خطأ.
          </p>
          <label className="micro-field">
            <span>سبب التسوية <small>مطلوب عند الرد أو الاحتفاظ</small></span>
            <input
              value={depositReason}
              onChange={event => setDepositReason(event.target.value)}
              placeholder="مثال: رد العربون نقدًا في المحل"
            />
          </label>
          <div className="micro-form-actions micro-contextual-actions">
            <button
              className="micro-button micro-button-primary"
              type="button"
              disabled={isActing || !depositReason.trim()}
              onClick={() => {
                void run(() => fulfillment.refundDeposit(stored.id, depositReason));
                setDepositReason("");
              }}
            >
              <HandCoins aria-hidden="true" /> رُدَّ العربون
            </button>
            <button
              className="micro-button micro-button-secondary"
              type="button"
              disabled={isActing || !depositReason.trim()}
              onClick={() => {
                void run(() => fulfillment.retainDeposit(stored.id, depositReason));
                setDepositReason("");
              }}
            >
              احتفظ به رصيدًا
            </button>
          </div>
        </section>
      ) : null}
      {order.status === "cancelled" && order.depositSettlement === "refund_deposit" ? (
        <section className="micro-note-card">
          <HandCoins aria-hidden="true" />
          <p>رُدّ عربون هذا الطلب، ونزل الرصيد المقبوض فعليًا بالتسوية الموثقة.</p>
        </section>
      ) : null}
      {order.status === "cancelled" && order.depositSettlement === "retain_deposit" ? (
        <section className="micro-note-card">
          <CircleDollarSign aria-hidden="true" />
          <p>احتُفظ بعربون هذا الطلب رصيدًا بتسوية موثقة؛ بقي محصلًا ولم يُحذف أثره.</p>
        </section>
      ) : null}
      {order.status === "cancelled" && order.depositCollectedMinor === 0 ? (
        <section className="micro-note-card">
          <XCircle aria-hidden="true" />
          <p>أُلغي هذا الطلب بلا عربون محصل؛ بقي في السجل بسببه ولا يُحذف.</p>
        </section>
      ) : null}
      {message ? (
        <p className="micro-field-error" role="alert">
          {message}
        </p>
      ) : null}
      {order.status === "settled" && order.settlementStatus === "debt" ? (
        <section className="micro-note-card">
          <Landmark aria-hidden="true" />
          <p>
            سُجل المتبقي كدين. لم يزد الكاش المحصل، والخطوة التالية هي متابعة التحصيل مع العميل تتم خارج
            التطبيق في هذا الإصدار؛ السجل بقي كما هو.
          </p>
        </section>
      ) : null}
      {order.status === "settled" && order.settlementStatus === "paid" ? (
        <section className="micro-note-card">
          <CheckCircle2 aria-hidden="true" />
          <p>تم التحصيل الكامل وإغلاق الطلب. يمكنك مراجعة نتيجته حسب حالتها أعلاه (مؤكدة أو تقديرية).</p>
        </section>
      ) : null}
      {order.status === "in_progress" ? (
        <section className="micro-note-card">
          <Hammer aria-hidden="true" />
          <p>تسجيل الجاهزية لا يسجل قبضًا أو ربحًا. التسليم خطوة منفصلة بعدها.</p>
        </section>
      ) : null}
      {["delivered", "settled"].includes(order.status) ? (
        <section className="micro-result-card" data-result={order.resultStatus}>
          <span>{result[0]}</span>
          {order.profitIndicatorMinor !== null ? (
            <strong>
              <MoneyValue minor={order.profitIndicatorMinor} />
            </strong>
          ) : (
            <strong>لا تظهر نتيجة رقمية نهائية</strong>
          )}
          <p>{result[1]}</p>
          <small>
            المحتسب عند التسليم — السعر (د.أ):{" "}
            <MoneyValue minor={order.recognizedRevenueMinor} className="micro-inline-number" /> · التكلفة
            (د.أ):{" "}
            <MoneyValue minor={order.recognizedCostMinor} className="micro-inline-number" />
          </small>
        </section>
      ) : null}
      <details className="micro-additional-details">
        <summary className="micro-additional-details-summary">
          <span>تفاصيل إضافية</span>
          <small>الاتفاق، المواد، الوقت، وسجل الطلب</small>
        </summary>
        <div className="micro-additional-details-body">
          <AgreementContextPanel
            stored={stored}
            service={agreementContext}
            onSaved={next => {
              setStored(next);
              setState({ phase: "ready", stored: next });
              notifyDataChanged();
            }}
          />
          <ActualMaterialPanel
            state={materialState}
            onRecord={() => navigate("/inventory/movement/consume")}
          />
          <ActualTimePanel
            orderId={stored.id}
            actualTime={actualTime}
            dataVersion={dataVersion}
            notifyDataChanged={notifyDataChanged}
          />
          <section className="micro-form-card">
            <h2 className="micro-section-title">سجل الطلب</h2>
            <div className="micro-event-list">
              {order.events.map(event => (
                <div key={event.id}>
                  <span className="micro-event-dot" />
                  <p>
                    <b>{eventLabel[event.type] ?? "تحديث الطلب"}</b>
                    <small>
                      <DateTimeValue value={event.createdAt} />
                      {event.amountMinor ? (
                        <>
                          {" "}
                          · <MoneyValue minor={event.amountMinor} className="micro-inline-number" />
                        </>
                      ) : null}
                    </small>
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </details>
      <section className="micro-note-card">
        <CalendarDays aria-hidden="true" />
        <p>الاتفاق والأحداث محفوظة محليًا على هذا الجهاز. لا توجد مزامنة أو مشاركة خارجية في هذا الإصدار.</p>
      </section>
    </section>
  );
}

function AgreementContextPanel({
  stored,
  service,
  onSaved,
}: {
  stored: StoredCraftOrder;
  service: AgreementContextService;
  onSaved: (stored: StoredCraftOrder) => void;
}) {
  const legacySource =
    stored.agreementSource && !allowedSources.includes(stored.agreementSource as AgreementSource)
      ? (stored.agreementSource as AgreementSourceValue)
      : null;
  const [source, setSource] = useState<AgreementSource | "">(
    allowedSources.includes(stored.agreementSource as AgreementSource)
      ? (stored.agreementSource as AgreementSource)
      : "",
  );
  const [sourceTouched, setSourceTouched] = useState(false);
  const [summary, setSummary] = useState(stored.followUpSummary ?? "");
  const [date, setDate] = useState(stored.followUpDate ?? "");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSource(
      allowedSources.includes(stored.agreementSource as AgreementSource)
        ? (stored.agreementSource as AgreementSource)
        : "",
    );
    setSourceTouched(false);
    setSummary(stored.followUpSummary ?? "");
    setDate(stored.followUpDate ?? "");
    setReason("");
  }, [stored]);
  async function save() {
    setMessage(null);
    setSaving(true);
    const nextSource = sourceTouched ? source || null : (legacySource ?? (source || null));
    const result = await service.save(stored.id, {
      agreementSource: nextSource,
      followUpSummary: summary || null,
      followUpDate: date || null,
      followUpReason: reason || null,
    });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setReason("");
    setMessage("تم حفظ سياق الاتفاق والمتابعة محليًا دون تغيير المال أو موعد التسليم.");
    onSaved(result.value);
  }

  return (
    <section className="micro-agreement-context" aria-labelledby="agreement-context-title">
      <div className="micro-agreement-context-heading">
        <div>
          <span className="micro-overline">ذاكرة الاتفاق</span>
          <h2 id="agreement-context-title">من أين جاء الاتفاق ومتى أعود؟</h2>
          <p>سياق قصير يكتبه المالك داخل الطلب. لا ننسخ محادثة ولا نرسل رسالة.</p>
        </div>
        <MessageCircle aria-hidden="true" />
      </div>
      <div className="micro-context-summary">
        <div>
          <span>مصدر الاتفاق</span>
          <strong>
            {legacySource
              ? (agreementSourceLabel[legacySource] ?? "مصدر قديم")
              : stored.agreementSource
                ? (agreementSourceLabel[stored.agreementSource] ?? stored.agreementSource)
                : "غير محدد"}
          </strong>
        </div>
        <div>
          <span>حالة المتابعة</span>
          <strong>{followUpState(stored.followUpDate ?? null)}</strong>
          {stored.followUpDate ? (
            <small>
              <LocalDateValue value={stored.followUpDate} />
            </small>
          ) : null}
        </div>
      </div>
      <div className="micro-form-card">
        <label className="micro-field">
          <span>
            مصدر الاتفاق <small>اختياري</small>
          </span>
          <select
            value={source}
            onChange={event => {
              setSource(event.target.value as AgreementSource | "");
              setSourceTouched(true);
            }}
          >
            <option value="">غير محدد</option>
            <option value="instagram">Instagram</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="referral">إحالة</option>
            <option value="walk_in">زيارة مباشرة</option>
            <option value="other">أخرى</option>
            {legacySource ? (
              <option value={legacySource} disabled>
                {agreementSourceLabel[legacySource] ?? "مصدر قديم محفوظ"}
              </option>
            ) : null}
          </select>
        </label>
        {legacySource ? (
          <p className="micro-context-legacy">
            <CircleAlert aria-hidden="true" /> مصدر الاتفاق القديم محفوظ كما هو حتى تختار مصدرًا جديدًا أو
            «غير محدد» صراحة.
          </p>
        ) : null}
        <label className="micro-field">
          <span>
            ملخص المتابعة <small>اختياري، يكتبه المالك</small>
          </span>
          <textarea
            value={summary}
            onChange={event => setSummary(event.target.value)}
            maxLength={240}
            placeholder="مثال: تأكيد اللون والمقاس مع العميل"
          />
        </label>
        <label className="micro-field">
          <span>
            موعد المتابعة <small>اختياري</small>
          </span>
          <input type="date" value={date} onChange={event => setDate(event.target.value)} />
        </label>
        <label className="micro-field">
          <span>
            هدف أو سبب المتابعة{" "}
            <small>{stored.followUpDate ? "مطلوب عند تغيير التاريخ" : "مطلوب مع موعد المتابعة"}</small>
          </span>
          <input
            type="text"
            value={reason}
            onChange={event => setReason(event.target.value)}
            maxLength={160}
            placeholder="مثال: تأكيد موعد التسليم"
          />
        </label>
        <p className="micro-note-card">
          <CalendarDays aria-hidden="true" />
          <span>المتابعة قراءة محلية مستحقة/قادمة فقط؛ لا تنشئ موعد تسليم أو إشعارًا.</span>
        </p>
        {message ? (
          <p className={message.startsWith("تم ") ? "micro-save-note" : "micro-field-error"} role="status">
            {message}
          </p>
        ) : null}
        <button
          className="micro-button micro-button-primary micro-save-cost"
          type="button"
          disabled={saving}
          onClick={save}
        >
          <Save aria-hidden="true" />
          {saving ? "جارٍ حفظ السياق…" : "حفظ سياق الاتفاق"}
        </button>
      </div>
      {(stored.followUpEvents ?? []).length > 0 ? (
        <div className="micro-context-history">
          <span className="micro-overline">تاريخ المتابعة</span>
          {(stored.followUpEvents ?? []).map(event => (
            <p key={event.id}>
              <b>{event.previousDate ? "تغيير موعد المتابعة" : "إضافة موعد متابعة"}</b>
              <small>
                <LocalDateValue value={event.previousDate} /> ← <LocalDateValue value={event.followUpDate} />{" "}
                · {event.reason}
              </small>
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ActualMaterialPanel({ state, onRecord }: { state: MaterialState; onRecord: () => void }) {
  if (state.phase === "loading")
    return (
      <section className="micro-note-card" aria-live="polite">
        <PackageCheck aria-hidden="true" />
        <p>جارٍ قراءة المادة المنفذة لهذا الطلب…</p>
      </section>
    );
  if (state.phase === "error")
    return (
      <section className="micro-note-card">
        <PackageCheck aria-hidden="true" />
        <p>تعذر قراءة مقارنة المادة الآن. لم يتغير الطلب أو سجله؛ أعد فتحه للمحاولة.</p>
      </section>
    );
  const { comparison } = state;
  if (comparison.status === "not_recorded")
    return (
      <section className="micro-decision-panel" data-tone="warning">
        <div>
          <span className="micro-decision-label">المادة المنفذة مقابل المخطط</span>
          <strong>لم تسجل مادة منفذة لهذا الطلب بعد</strong>
          <p>{comparison.truth}</p>
        </div>
        <button className="micro-text-action" type="button" onClick={onRecord}>
          سجّل استهلاك مادة إذا كان مؤثرًا
        </button>
      </section>
    );
  return (
    <section
      className="micro-info-card"
      data-tone={comparison.status === "needs_review" ? "warning" : undefined}
    >
      <div className="micro-card-copy">
        <span className="micro-card-eyebrow">المادة المنفذة مقابل المخطط</span>
        <h2>
          {comparison.status === "needs_review" ? "فرق المادة يحتاج مراجعة" : "فرق مادة مسجل لهذا الطلب"}
        </h2>
        <p>{comparison.truth}</p>
      </div>
      <div className="micro-record-summary">
        <div>
          <span>مادة مخططة</span>
          <strong>
            <MoneyValue minor={comparison.plannedMaterialMinor} />
          </strong>
        </div>
        <div>
          <span>مادة منفذة مسجلة</span>
          <strong>
            <MoneyValue minor={comparison.actualMaterialMinor ?? 0} />
          </strong>
        </div>
        <div>
          <span>الفرق</span>
          <strong>
            <MoneyValue minor={comparison.varianceMinor ?? 0} showPlus />
          </strong>
        </div>
        <div>
          <span>حركات استهلاك</span>
          <strong className="micro-number">{comparison.consumptionCount}</strong>
        </div>
      </div>
      <p>الفرق ليس ربحًا أو خسارة نهائية؛ راجع الوقت والتوصيل والهدر وبقية البنود قبل تغيير السعر.</p>
    </section>
  );
}
