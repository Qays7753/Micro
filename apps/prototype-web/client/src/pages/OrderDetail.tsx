/* مبدأ Micro: يعرض الطلب حالته الفعلية وفعلًا تاليًا واحدًا، ولا يساوي الحفظ ببدء التنفيذ أو التحصيل. */
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  HandCoins,
  Landmark,
  PackageCheck,
  PencilLine,
  Play,
  RotateCcw,
  Save,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { withFrom } from "@/app/navigationContract";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type { AgreementResult } from "@/application/agreements/agreementService";
import type { FulfillmentResult } from "@/application/fulfillment/fulfillmentService";
import type {
  CollectionReversalPreview,
  CollectionReversalResult,
} from "@/application/collections/collectionReversalService";
import { CorrectionPreview } from "@/components/finance/CorrectionPreview";
import { ActualTimePanel } from "@/components/presentation/ActualTimePanel";
import { AgreementContextPanel } from "@/components/order/AgreementContextPanel";
import { ActualMaterialPanel, type MaterialState } from "@/components/order/ActualMaterialPanel";
import { OrderEventLog } from "@/components/order/OrderEventLog";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { LocalDateValue, MoneyValue } from "@/components/presentation/DisplayValue";
import type { StoredCraftOrder, CostEstimate } from "@/storage/local/types";
import { formatMoneyMinor } from "@/presentation/formatters";
import { getAgreementPresentation } from "@/presentation/orderAgreementPresentation";

/* §10.2: الحقيقة في الرقم والتسمية — النتيجة تسمية حالتها، بلا جملة تشرح نفسها. */
const resultLabel: Record<string, string> = {
  final: "نتيجة الطلب معروفة",
  estimated: "نتيجة الطلب تقديرية",
  incomplete: "النتيجة غير مكتملة",
  review_required: "النتيجة تحتاج مراجعة",
};

type OrderDetailState =
  { phase: "loading" } | { phase: "error" } | { phase: "ready"; stored: StoredCraftOrder };
const preDeliveryStatuses = ["provisional_agreement", "confirmed", "in_progress", "ready"];
/* المجموعة ١ (Scope E): القدرات الحقيقية تُكشف في سياقها — الوقت والمادة الفعليان
 * يصعدان من «تفاصيل إضافية» إلى سطح الطلب عندما يصل التنفيذ؛ ما قبله يبقى مطويًا. */
const executionStatuses = ["in_progress", "ready"];

export default function OrderDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  /* المجموعة ١ (Scope A): الرجوع للمصدر (?from) أو الطلبات كبديل قانوني. */
  const returnPath = useReturnPath();
  const { actualTime, agreements, agreementContext, fulfillment, inventory, drafts, costEstimates, collectionReversal, dataVersion, notifyDataChanged } =
    usePrototypeServices();
  const [stored, setStored] = useState<StoredCraftOrder | null>(null);
  const [state, setState] = useState<OrderDetailState>({ phase: "loading" });
  const [materialState, setMaterialState] = useState<MaterialState>({ phase: "loading" });
  /* المجموعة ٣ (Scope E — §11.3): التقدير المصدر — وصلة أثر فقط؛ إن حُذف لا تُعرض. */
  const [sourceEstimate, setSourceEstimate] = useState<CostEstimate | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isActing, setIsActing] = useState(false);
  /* القرار ١٩: الإلغاء بثلاثة أسباب بنقرة مع تخطٍ متاح، والعربون ثلاثة خيارات. */
  const [cancelPanelOpen, setCancelPanelOpen] = useState(false);
  const [otherReason, setOtherReason] = useState("");
  const [otherReasonOpen, setOtherReasonOpen] = useState(false);
  const [depositReason, setDepositReason] = useState("");
  /* §٥-١٦ (رحلة ٢): تحصيل الدين المسجل — المبلغ يُملأ بالمتبقي افتراضيًا. */
  const [debtCollectMinor, setDebtCollectMinor] = useState(0);
  const [validDebtCollect, setValidDebtCollect] = useState(true);
  /* المجموعة ٢ (§10.5): تعديل السعر بعد الاتفاق — تصحيح موثق داخل الطلب. */
  const [pricePanelOpen, setPricePanelOpen] = useState(false);
  const [newPriceMinor, setNewPriceMinor] = useState(0);
  const [validNewPrice, setValidNewPrice] = useState(true);
  const [priceReason, setPriceReason] = useState("");
  /* المجموعة ٢ (§10.3): التراجع الموثق عن قبضة مسجلة على الطلب.
   * المجموعة ٦ (البند ١ — S2-04أ): التراجع المزدوج عن القبضة مع تخصيصها
   * المطابق — مفتاح جذر واحد لكل فتح لوحة يجعل إعادة المحاولة آمنة. */
  const [reversalEventId, setReversalEventId] = useState<string | null>(null);
  const [reversalMinor, setReversalMinor] = useState(0);
  const [validReversal, setValidReversal] = useState(true);
  const [reversalReason, setReversalReason] = useState("");
  /* المجموعة ٦ (البند ١): معاينة المطابقة + وضع التراجع (مزدوج/مفرد). */
  const [compoundPreview, setCompoundPreview] = useState<CollectionReversalPreview | null>(null);
  const [compoundMode, setCompoundMode] = useState(true);
  const reversalOperationKeyRef = useRef(
    `order-reversal-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
  );

  const openReversalPanel = (eventId: string, amountMinor: number) => {
    reversalOperationKeyRef.current = `order-reversal-${
      globalThis.crypto?.randomUUID?.() ?? Date.now()
    }`;
    setCompoundMode(true);
    setReversalEventId(eventId);
    setReversalMinor(amountMinor);
    setReversalReason("");
  };

  /* معاينة التراجع المزدوج: حالة مطابقة التخصيص وأرقام المحفظة/غير الموزع
   * قبل/بعد — تُقرأ محليًا مع كل فتح لوحة أو تحديث بيانات. */
  useEffect(() => {
    let active = true;
    if (!reversalEventId || state.phase !== "ready") {
      setCompoundPreview(null);
      return;
    }
    void (async () => {
      const result = await collectionReversal.preview({
        orderId: state.stored.id,
        collectionEventId: reversalEventId,
      });
      if (active) setCompoundPreview(result.ok ? result.value : null);
    })();
    return () => {
      active = false;
    };
  }, [reversalEventId, state, collectionReversal, dataVersion]);

  const closeReversalPanel = () => {
    setReversalEventId(null);
    setReversalReason("");
    setReversalMinor(0);
    setCompoundPreview(null);
  };

  useEffect(() => {
    if (state.phase === "ready") setNewPriceMinor(state.stored.order.agreedPriceMinor);
  }, [state]);

  /* بعد كل تحصيل ناجح يعاد ملء الحقل بالمتبقي الجديد. */
  useEffect(() => {
    if (state.phase === "ready" && state.stored.order.settlementStatus === "debt")
      setDebtCollectMinor(state.stored.order.receivableMinor);
  }, [state]);

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

  /* المجموعة ٣ (§11.3): «المصدر: تقدير» — المسودة المرتبطة تحمل معرّف التقدير؛
   * العرض وصلة قراءة لا تغيّر شيئًا، والتقدير المحذوف يُغيب بصدق لا بخطأ. */
  useEffect(() => {
    let active = true;
    void (async () => {
      const draftsResult = await drafts.list();
      if (!active || !draftsResult.ok) return;
      const draft =
        draftsResult.value.find(candidate => candidate.linkedOrderId === params.id) ?? null;
      if (!draft?.sourceEstimateId) return;
      const estimateResult = await costEstimates.get(draft.sourceEstimateId);
      if (!active || !estimateResult.ok || !estimateResult.value) return;
      setSourceEstimate(estimateResult.value);
    })();
    return () => {
      active = false;
    };
  }, [drafts, costEstimates, params.id, dataVersion]);

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
        <button
          className="micro-button micro-button-primary"
          type="button"
          onClick={() => navigate(returnPath)}
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
  const result = resultLabel[order.resultStatus] ?? resultLabel.review_required;
  /* المجموعة ٦ (البند ٤ — S3-12): ملخص الإفصاح يسمي الأفعال المتاحة فعلًا حسب
   * حالة الطلب — قابل للاكتشاف بلا فتح، وبلا ذكر فعل لا ينطبق. */
  const correctionsSummary = [
    ...(["draft", "cancelled", "needs_review"].includes(order.status) ? [] : ["تعديل السعر"]),
    ...(order.status !== "cancelled" &&
    order.events.some(event => event.type === "collection_recorded")
      ? ["تراجع عن قبضة"]
      : []),
    ...(preDeliveryStatuses.includes(order.status) ? ["إلغاء الطلب"] : []),
  ].join(" · ");

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

  /* المجموعة ٦ (البند ١): تنفيذ التراجع — مزدوجًا أو مفردًا — عبر الخدمة الذرّية
   * نفسها؛ إعادة المحاولة بمفتاح الجذر نفسه لا تكرر أي أثر. */
  async function runReversal(compound: boolean) {
    if (!stored || !reversalEventId) return;
    const result = await collectionReversal.reverse({
      orderId: stored.id,
      collectionEventId: reversalEventId,
      amountMinor: reversalMinor,
      reason: reversalReason,
      operationKey: reversalOperationKeyRef.current,
      alsoReverseAllocation: compound,
    });
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setStored(result.value.stored);
    setState({ phase: "ready", stored: result.value.stored });
    notifyDataChanged();
    closeReversalPanel();
    setCompoundMode(true);
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
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        <ArrowRight aria-hidden="true" /> {returnPath === "/orders" ? "الطلبات" : "رجوع"}
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
      {/* المجموعة ٦ (البند ٤ — S3-12): تصحيحات الطلب خلف إفصاح واحد — الحالة
          الملحّة والفعل الأساسي والنتيجة تبقى ظاهرة بلا تمرير، والثانوي خلف فعل
          واضح قابل للاكتشاف. لا حذف لمعلومة ولا رفع لسقف الكثافة. */}
      {!["draft", "cancelled"].includes(order.status) ? (
        <details className="micro-additional-details">
          <summary className="micro-additional-details-summary">
            <span>تصحيحات موثقة على الطلب</span>
            <small>{correctionsSummary}</small>
          </summary>
          <div className="micro-additional-details-body">
            {/* المجموعة ٢ (§10.5): تعديل السعر بعد الاتفاق — تصحيح موثق داخل الطلب لا
                إلغاء وإعادة إنشاء. الاتفاق الأصلي باقٍ في الأحداث والسبب إلزامي. */}
            {["draft", "cancelled", "needs_review"].includes(order.status) ? null : pricePanelOpen ? (
        <section className="micro-cancel-panel" aria-label="تعديل السعر بعد الاتفاق">
          <strong>عدّل السعر المتفق عليه</strong>
          <label className="micro-field">
            <span>السعر الجديد (د.أ)</span>
            <EnglishNumberInput
              value={newPriceMinor}
              kind="money"
              onNumericChange={setNewPriceMinor}
              onTextValidityChange={setValidNewPrice}
              aria-label="السعر الجديد بعد الاتفاق"
            />
          </label>
          {validNewPrice && newPriceMinor !== order.agreedPriceMinor ? (
            <CorrectionPreview
              action="تعديل سعر الطلب بعد الاتفاق"
              originalLabel={`اتفاق «${order.itemName}» بسعر ${formatMoneyMinor(order.agreedPriceMinor)} د.أ`}
              originalDetail={`العربون ${formatMoneyMinor(order.depositCollectedMinor)} د.أ · المقبوض ${formatMoneyMinor(order.collectedMinor)} د.أ`}
              intro="الطلب لا يُلغى ولا يُعاد إنشاؤه: السعر الجديد يفتح المتبقي من جديد، والعربون والقبضات المسجلة تبقى كما هي، والاتفاق الأصلي باقٍ في الأحداث."
              dimensions={[
                {
                  label: "المتبقي على العميل",
                  beforeMinor: order.receivableMinor,
                  afterMinor: Math.max(newPriceMinor - order.collectedMinor, 0),
                },
                { label: "الكاش المقبوض", beforeMinor: order.collectedMinor, afterMinor: order.collectedMinor },
                {
                  label: "الإيراد المعروف بعد التسليم",
                  beforeMinor: order.recognizedRevenueMinor,
                  afterMinor: ["delivered", "settled"].includes(order.status) ? newPriceMinor : order.recognizedRevenueMinor,
                },
                { label: "أمانات", beforeMinor: 0, afterMinor: 0 },
              ]}
              unchanged={["العربون المحصل وقيمته", "القبضات المسجلة وتواريخها", "تكلفة الطلب"]}
              resulting={[
                { label: "المتبقي بعد التعديل", amountMinor: Math.max(newPriceMinor - order.collectedMinor, 0) },
              ]}
              reversibleNote="تصحيح موثق: يمكن تعديل لاحق بمراجعة جديدة؛ كل تعديل يُحفظ بسببه وبسعر ما قبله."
              reason={priceReason}
              onReasonChange={setPriceReason}
              reasonPlaceholder="مثال: اتفقنا على زيادة بعد شغل إضافي"
              error={message}
              busy={isActing}
              confirmLabel="أكّد تعديل السعر"
              busyLabel="جارٍ حفظ التعديل…"
              onConfirm={() => {
                void run(() => fulfillment.revisePrice(stored.id, { newPriceMinor, reason: priceReason }));
                setPriceReason("");
              }}
              onCancel={() => {
                setPricePanelOpen(false);
                setPriceReason("");
                setNewPriceMinor(order.agreedPriceMinor);
              }}
            />
          ) : null}
          {validNewPrice && newPriceMinor === order.agreedPriceMinor && !priceReason ? (
            <p className="micro-local-truth">السعر الجديد يطابق الحالي — لا تصحيح بلا تغيير.</p>
          ) : null}
        </section>
            ) : (
              <button
                className="micro-button micro-button-quiet"
                type="button"
                disabled={isActing}
                onClick={() => setPricePanelOpen(true)}
              >
                <PencilLine aria-hidden="true" /> عدّل السعر بعد الاتفاق
              </button>
            )}
            {/* القرار ١٩: الإلغاء من أي حالة قبل التسليم عبر cancelOrder وحدها (عقد ٠٢) —
                السبب اختياري بثلاثة أزرار بنقرة، والتخطي متاح. */}
            {preDeliveryStatuses.includes(order.status) ? (
              cancelPanelOpen ? (
                <section className="micro-cancel-panel" aria-label="تأكيد إلغاء الطلب">
                  <strong>لماذا تلغي هذا الطلب؟</strong>
                  <p>
                    السبب اختياري — اختر بنقرة أو تخطَّ. الإلغاء لا يحذف الطلب ولا أحداثه؛ يسجّل تسوية موثقة ويبقى
                    في السجل.
                  </p>
                  {order.depositCollectedMinor > 0 ? (
                    <p className="micro-warning-copy">
                      يوجد عربون محصل (
                      <MoneyValue minor={order.depositCollectedMinor} className="micro-inline-number" /> د.أ) — يبقى
                      بعد الإلغاء «يحتاج مراجعة» حتى تردّه أو تحتفظ به صراحة، وهذا خيار صالح لا خطأ.
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
            {/* المجموعة ٦ (البند ١ — S2-04أ): التراجع الموثق عن قبضة مسجلة،
                والمزدوج عن القبضة مع تخصيصها المطابق عند توفر مطابقة كاملة —
                فعل واحد، معاينة صادقة، ومعاملة ذرّية واحدة. */}
            {order.status !== "cancelled"
              ? (() => {
                  const collections = order.events.filter(event => event.type === "collection_recorded");
                  if (collections.length === 0) return null;
                  const remainingOf = (eventId: string) => {
                    const source = order.events.find(event => event.id === eventId);
                    const reversed = order.events
                      .filter(
                        event => event.type === "collection_reversed" && event.reversesEventId === eventId,
                      )
                      .reduce((sum, event) => sum + (event.amountMinor ?? 0), 0);
                    return (source?.amountMinor ?? 0) - reversed;
                  };
                  const openCollections = collections.filter(event => remainingOf(event.id) > 0);
                  const target = reversalEventId
                    ? order.events.find(event => event.id === reversalEventId) ?? null
                    : null;
                  const preview = compoundPreview;
                  const allocation = preview?.allocation ?? null;
                  const compoundAvailable =
                    preview?.status === "full_match" &&
                    allocation !== null &&
                    reversalMinor === preview.remainingMinor;
                  const useCompound = compoundMode && compoundAvailable;
                  return (
                    <section className="micro-cancel-panel" aria-label="تراجع موثق عن قبضة">
                      {reversalEventId && target ? (
                        <>
                          <label className="micro-field">
                            <span>مبلغ التراجع (د.أ)</span>
                            <EnglishNumberInput
                              value={reversalMinor}
                              kind="money"
                              onNumericChange={setReversalMinor}
                              onTextValidityChange={setValidReversal}
                              aria-label="مبلغ التراجع عن القبضة"
                            />
                          </label>
                          {validReversal &&
                          reversalMinor > 0 &&
                          reversalMinor <= remainingOf(target.id) &&
                          preview ? (
                            <CorrectionPreview
                              action={
                                useCompound
                                  ? "تراجع موثق عن القبضة والتخصيص معًا"
                                  : "تراجع موثق عن قبضة على الطلب"
                              }
                              originalLabel={`قبضة ${formatMoneyMinor(target.amountMinor ?? 0)} د.أ على «${order.itemName}»`}
                              originalDetail={
                                useCompound && allocation
                                  ? `مخصصة بمحفظة «${allocation.walletName}» · المتبقي الحالي على العميل ${formatMoneyMinor(order.receivableMinor)} د.أ`
                                  : `المتبقي الحالي على العميل ${formatMoneyMinor(order.receivableMinor)} د.أ`
                              }
                              intro={
                                useCompound && allocation
                                  ? "المبلغ يعود للعميل من محفظته المخصصة والقبضة نفسها — الأصلان باقيان والتراجعان موثقان معًا بمعاملة واحدة."
                                  : "المبلغ المقبوض يعود للعميل والمتبقي يفتح من جديد — علاقة التدقيق صريحة والقبضة الأصلية باقية."
                              }
                              dimensions={
                                useCompound && allocation
                                  ? [
                                      {
                                        label: "الكاش المقبوض",
                                        beforeMinor: order.collectedMinor,
                                        afterMinor: order.collectedMinor - reversalMinor,
                                      },
                                      {
                                        label: "المتبقي على العميل",
                                        beforeMinor: order.receivableMinor,
                                        afterMinor: order.receivableMinor + reversalMinor,
                                      },
                                      {
                                        label: `رصيد محفظة «${allocation.walletName}»`,
                                        beforeMinor: preview.walletBalanceBeforeMinor ?? 0,
                                        afterMinor: preview.walletBalanceAfterMinor ?? 0,
                                      },
                                      {
                                        label: "الكاش غير الموزع",
                                        beforeMinor: preview.unallocatedBeforeMinor ?? 0,
                                        afterMinor: preview.unallocatedAfterMinor ?? 0,
                                      },
                                      {
                                        label: "الإيراد المعروف",
                                        beforeMinor: order.recognizedRevenueMinor,
                                        afterMinor: order.recognizedRevenueMinor,
                                      },
                                    ]
                                  : [
                                      {
                                        label: "الكاش المقبوض",
                                        beforeMinor: order.collectedMinor,
                                        afterMinor: order.collectedMinor - reversalMinor,
                                      },
                                      {
                                        label: "المتبقي على العميل",
                                        beforeMinor: order.receivableMinor,
                                        afterMinor: order.receivableMinor + reversalMinor,
                                      },
                                      {
                                        label: "الإيراد المعروف",
                                        beforeMinor: order.recognizedRevenueMinor,
                                        afterMinor: order.recognizedRevenueMinor,
                                      },
                                    ]
                              }
                              unchanged={["الإيراد والنتيجة لا تتغير", "تكلفة الطلب", "سعر الاتفاق"]}
                              resulting={[
                                {
                                  label: "المتبقي بعد التراجع",
                                  amountMinor: order.receivableMinor + reversalMinor,
                                },
                              ]}
                              reversibleNote={
                                useCompound
                                  ? "التراجع التراكمي لا يتجاوز مبلغ القبضة، وفك التخصيص يعيد قيمته إلى غير الموزع — الأصلان باقيان والعملية واحدة."
                                  : "التراجع التراكمي لا يتجاوز مبلغ القبضة؛ عربون الطلب له مسار تسويته الخاص."
                              }
                              reason={reversalReason}
                              onReasonChange={setReversalReason}
                              reasonPlaceholder="مثال: رجّعت المبلغ للزبون من الدرج"
                              error={message}
                              busy={isActing}
                              confirmLabel={
                                useCompound ? "أكّد التراجع عن القبضة والتخصيص" : "أكّد التراجع الموثق"
                              }
                              busyLabel="جارٍ توثيق التراجع…"
                              onConfirm={() => {
                                void runReversal(useCompound);
                              }}
                              onCancel={closeReversalPanel}
                            >
                              {useCompound ? (
                                <button
                                  className="micro-button micro-button-quiet"
                                  type="button"
                                  disabled={isActing}
                                  onClick={() => setCompoundMode(false)}
                                >
                                  تراجع عن القبضة لحالها بدلًا
                                </button>
                              ) : compoundAvailable ? (
                                <button
                                  className="micro-button micro-button-quiet"
                                  type="button"
                                  disabled={isActing}
                                  onClick={() => setCompoundMode(true)}
                                >
                                  تراجع عن القبضة والتخصيص معًا
                                </button>
                              ) : preview?.refusalReason ? (
                                <p className="micro-local-truth">{preview.refusalReason}</p>
                              ) : null}
                              {useCompound && preview?.walletWarning ? (
                                <p className="micro-warning-copy" role="alert">
                                  {preview.walletWarning}
                                </p>
                              ) : null}
                            </CorrectionPreview>
                          ) : null}
                        </>
                      ) : openCollections.length > 0 ? (
                        <>
                          <strong>قبضات مسجلة قابلة للتراجع الموثق</strong>
                          <div className="micro-form-actions micro-contextual-actions">
                            {openCollections.map(event => (
                              <button
                                key={event.id}
                                className="micro-button micro-button-quiet"
                                type="button"
                                disabled={isActing}
                                onClick={() => {
                                  openReversalPanel(event.id, remainingOf(event.id));
                                }}
                              >
                                <RotateCcw aria-hidden="true" /> تراجع عن {formatMoneyMinor(remainingOf(event.id))} د.أ
                              </button>
                            ))}
                          </div>
                        </>
                      ) : null}
                    </section>
                  );
                })()
              : null}
          </div>
        </details>
      ) : null}
      {order.depositCollectedMinor > 0 ? (
        <section className="micro-deposit-truth">
          <CircleDollarSign aria-hidden="true" />
          <span>
            <b>
              عربون محصل (د.أ):{" "}
              <MoneyValue minor={order.depositCollectedMinor} className="micro-inline-number" />
            </b>
            <small>كاش مرتبط بالطلب</small>
          </span>
        </section>
      ) : (
        <section className="micro-note-card">
          <span>العربون</span>
          <p>لم يُسجَّل عربون لهذا الطلب.</p>
        </section>
      )}
      {contextualAction}
      {/* المجموعة ١ (Scope E): أثناء التنفيذ — قراءة الوقت والمادة الفعلية ظاهرة
          بلا طي، ووصلة استهلاك المادة تحفظ سياق الطلب الأصلي للتعبئة والرجوع. */}
      {executionStatuses.includes(order.status) ? (
        <section className="micro-execution-layer" aria-label="قراءة التنفيذ">
          <ActualMaterialPanel
            state={materialState}
            onRecord={() =>
              navigate(`/inventory/movement/consume?order=${stored.id}&from=/orders/${stored.id}`)
            }
          />
          <ActualTimePanel
            orderId={stored.id}
            actualTime={actualTime}
            dataVersion={dataVersion}
            notifyDataChanged={notifyDataChanged}
          />
        </section>
      ) : null}
      {/* القرار ١٩: عربون طلب ملغى ينتظر قرارًا — ثلاثة خيارات لا اثنان. */}
      {order.status === "cancelled" && order.depositSettlement === "needs_review" ? (
        <section className="micro-cancel-panel" aria-label="تسوية عربون طلب ملغى">
          <strong>
            عربون محصل ينتظر قرارك (
            <MoneyValue minor={order.depositCollectedMinor} className="micro-inline-number" /> د.أ)
          </strong>
          <p>
            ردّ العربون ينزل الرصيد المقبوض فعليًا، والاحتفاظ به يبقيه محصلًا. أو اتركه «يحتاج مراجعة» وتابع
            لاحقًا — خيار صالح لا خطأ.
          </p>
          <label className="micro-field">
            <span>
              سبب التسوية <small>مطلوب عند الرد أو الاحتفاظ</small>
            </span>
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
          <p>عربون مُرَدّ بتسوية موثقة.</p>
        </section>
      ) : null}
      {order.status === "cancelled" && order.depositSettlement === "retain_deposit" ? (
        <section className="micro-note-card">
          <CircleDollarSign aria-hidden="true" />
          <p>عربون محتفظ به رصيدًا بتسوية موثقة.</p>
        </section>
      ) : null}
      {order.status === "cancelled" && order.depositCollectedMinor === 0 ? (
        <section className="micro-note-card">
          <XCircle aria-hidden="true" />
          <p>أُلغي هذا الطلب بلا عربون محصل.</p>
        </section>
      ) : null}
      {message ? (
        <p className="micro-field-error" role="alert">
          {message}
        </p>
      ) : null}
      {/* §٥-١٦ (رحلة ٢): الدين المسجل قابل للتحصيل — المبلغ حقل وحيد معبأ بالمتبقي،
          والتحصيل يقلل الدين ولا يعيد فتح الطلب. */}
      {order.status === "settled" && order.settlementStatus === "debt" ? (
        <section className="micro-cancel-panel" aria-label="تحصيل الدين المسجل">
          <label className="micro-field">
            <span>قبضت الآن من الدين (د.أ)</span>
            <EnglishNumberInput
              value={debtCollectMinor}
              kind="money"
              onNumericChange={setDebtCollectMinor}
              onTextValidityChange={setValidDebtCollect}
              aria-label="قبضت الآن من الدين"
            />
          </label>
          <div className="micro-form-actions micro-contextual-actions">
            <button
              className="micro-button micro-button-primary"
              type="button"
              disabled={isActing || !validDebtCollect || debtCollectMinor <= 0}
              onClick={() => {
                void run(() => fulfillment.collectDebt(stored.id, debtCollectMinor));
              }}
            >
              <HandCoins aria-hidden="true" /> {isActing ? "جارٍ التسجيل…" : "سجّل القبض"}
            </button>
          </div>
        </section>
      ) : null}
      {order.status === "settled" && order.settlementStatus === "paid" ? (
        <section className="micro-note-card">
          <CheckCircle2 aria-hidden="true" />
          <p>تم التحصيل الكامل وإغلاق الطلب.</p>
        </section>
      ) : null}
      {["delivered", "settled"].includes(order.status) ? (
        <section className="micro-result-card" data-result={order.resultStatus}>
          <span>{result}</span>
          {order.profitIndicatorMinor !== null ? (
            <strong>
              <MoneyValue minor={order.profitIndicatorMinor} />
            </strong>
          ) : (
            <strong>—</strong>
          )}
          <small>
            المحتسب عند التسليم — السعر (د.أ):{" "}
            <MoneyValue minor={order.recognizedRevenueMinor} className="micro-inline-number" /> · التكلفة
            (د.أ): <MoneyValue minor={order.recognizedCostMinor} className="micro-inline-number" />
          </small>
        </section>
      ) : null}
      <details className="micro-additional-details">
        <summary className="micro-additional-details-summary">
          <span>تفاصيل إضافية</span>
          <small>
            {executionStatuses.includes(order.status) ? "الاتفاق وسجل الطلب" : "الاتفاق، المواد، الوقت، وسجل الطلب"}
          </small>
        </summary>
        <div className="micro-additional-details-body">
          {sourceEstimate ? (
            <section className="micro-form-card" aria-label="المصدر: تقدير">
              <h2 className="micro-section-title">المصدر: تقدير</h2>
              <p className="micro-muted-copy">
                بدأ هذا الطلب من تقديرك «{sourceEstimate.title}» — نُسخت منه اقتراحات وقتها؛ لا يربط
                السعر الحالي بشيء الآن.
              </p>
              <button
                className="micro-text-action"
                type="button"
                onClick={() =>
                  navigate(
                    withFrom(
                      `/tools/estimate/${encodeURIComponent(sourceEstimate.id)}`,
                      `/orders/${stored.id}`,
                    ),
                  )
                }
              >
                افتح التقدير <ArrowLeft aria-hidden="true" />
              </button>
            </section>
          ) : null}
          <AgreementContextPanel
            stored={stored}
            service={agreementContext}
            onSaved={next => {
              setStored(next);
              setState({ phase: "ready", stored: next });
              notifyDataChanged();
            }}
          />
          {executionStatuses.includes(order.status) ? null : (
            <>
              <ActualMaterialPanel
                state={materialState}
                onRecord={() =>
                  /* S1-06: نفس نمط فرع التنفيذ — الاستهلاك مرتبط بطلبه لا بأول طلب في القائمة. */
                  navigate(`/inventory/movement/consume?order=${stored.id}&from=/orders/${stored.id}`)
                }
              />
              <ActualTimePanel
                orderId={stored.id}
                actualTime={actualTime}
                dataVersion={dataVersion}
                notifyDataChanged={notifyDataChanged}
              />
            </>
          )}
          <OrderEventLog events={order.events} />
        </div>
      </details>
    </section>
  );
}
