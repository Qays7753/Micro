/* مبدأ Micro: يعرض الطلب حالته الفعلية وفعلًا تاليًا واحدًا، ولا يساوي الحفظ ببدء التنفيذ أو التحصيل. */
import { Share2 } from "lucide-react";
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
import {
  collectionShareDraft,
  deliveryShareDraft,
  orderShareDraft,
  reminderShareDraft,
} from "@/application/share/shareMessageService";
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
/* Conflict F (AV-07): الإلغاء متاح حيث يُتِمّ بأمان — يشمل «يحتاج مراجعة» بعد عكس
 * التسليم (النطاق يسمح والقفل الموثق يحرس المسلّم غير المعكوس برسالة صادقة). */
const cancellableStatuses = [...preDeliveryStatuses, "needs_review", "postponed"];
const canCancelOrder = (order: { status: string }) => cancellableStatuses.includes(order.status);
/* المجموعة ١ (Scope E): القدرات الحقيقية تُكشف في سياقها — الوقت والمادة الفعليان
 * يصعدان من «تفاصيل إضافية» إلى سطح الطلب عندما يصل التنفيذ؛ ما قبله يبقى مطويًا. */
const executionStatuses = ["in_progress", "ready"];

/* المجموعة ٣ (عقد D4 — SA-5 R4): هل عُكس آخر تسليم؟ منطق النطاق نفسه — آخر حدث
 * تسليم له عكس مقابل؛ لا يكفي وجود عكس قديم لتسليم أقدم. */
function lastDeliveryWasReversed(order: {
  events: readonly { id: string; type: string; toStatus?: string; reversesEventId?: string }[];
}): boolean {
  const lastDelivery = [...order.events]
    .reverse()
    .find(event => event.type === "status_changed" && event.toStatus === "delivered");
  if (!lastDelivery) return false;
  return order.events.some(
    event => event.type === "delivery_reversed" && event.reversesEventId === lastDelivery.id,
  );
}

export default function OrderDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  /* المجموعة ١ (Scope A): الرجوع للمصدر (?from) أو الطلبات كبديل قانوني. */
  const returnPath = useReturnPath();
  const {
    actualTime,
    agreements,
    agreementContext,
    fulfillment,
    deliveryReview,
    inventory,
    drafts,
    costEstimates,
    collectionReversal,
    retainedDeposits,
    cashContinuity,
    projectFinance,
    partyLedger,
    dataVersion,
    notifyDataChanged,
  } = usePrototypeServices();
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
  /* Conflict E: مبلغ صريح للتسوية (ردًا أو احتفاظًا) — يبدأ من الاقتراح
   * القائم على التكلفة الموثقة ويقبل التعديل بتحذير وسبب موثق. */
  const [settleAmount, setSettleAmount] = useState<number | null>(null);
  /* المجموعة ٤ (عقد ٢٩): معنى العربون المحتفظ به — قرار صريح يُوثَّق حدثًا ماليًا. */
  const [classifyMeaning, setClassifyMeaning] = useState<"owner" | "revenue" | null>(null);
  const [classifyReason, setClassifyReason] = useState("");
  const [classifyAmount, setClassifyAmount] = useState<number | null>(null);
  /* Conflict B: تسمية جهة الطلب غير المسمّى — تعبئة باتجاه واحد. */
  const [assignNameOpen, setAssignNameOpen] = useState(false);
  const [assignNameValue, setAssignNameValue] = useState("");
  const [partySuggestions, setPartySuggestions] = useState<readonly string[]>([]);
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
  const reversalOperationKeyRef = useRef(`order-reversal-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);

  /* المجموعة ٣ (عقد D4/D5): عكس التسليم المكتمل — تصحيح موثق من تفاصيل الطلب. */
  const [deliveryReversalOpen, setDeliveryReversalOpen] = useState(false);
  const [deliveryReversalReason, setDeliveryReversalReason] = useState("");

  const openReversalPanel = (eventId: string, amountMinor: number) => {
    reversalOperationKeyRef.current = `order-reversal-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
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
      const draft = draftsResult.value.find(candidate => candidate.linkedOrderId === params.id) ?? null;
      if (!draft?.sourceEstimateId) return;
      const estimateResult = await costEstimates.get(draft.sourceEstimateId);
      if (!active || !estimateResult.ok || !estimateResult.value) return;
      setSourceEstimate(estimateResult.value);
    })();
    return () => {
      active = false;
    };
  }, [drafts, costEstimates, params.id, dataVersion]);

  /* عقد الإغلاق العميق (WF-01/FC-04): عربون إضافي أثناء الرحلة — المبلغ
   * ووجهة الكاش صريحة قبل الحفظ، والعربون دَين مرتبط بالطلب لا إيران.
   * (الخطافات قبل أي خروج مبكر — قاعدة الخطافات.) */
  const [depositPanelOpen, setDepositPanelOpen] = useState(false);
  const [extraDepositMinor, setExtraDepositMinor] = useState(0);
  const [validExtraDeposit, setValidExtraDeposit] = useState(true);
  const [depositWalletId, setDepositWalletId] = useState("");
  const [walletOptions, setWalletOptions] = useState<readonly { id: string; name: string; kind: string }[]>(
    [],
  );
  const depositOperationKeyRef = useRef(`order-deposit-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);

  /* وجهات العربون: تُقرأ عند فتح اللوحة — كاش متاح فعلًا لا قوائم ثابتة. */
  useEffect(() => {
    if (!depositPanelOpen) return;
    let active = true;
    void (async () => {
      const overview = await cashContinuity.overview();
      if (active && overview.ok) setWalletOptions(overview.value.wallets);
    })();
    return () => {
      active = false;
    };
  }, [depositPanelOpen, cashContinuity, dataVersion]);

  /* Conflict B: مقترحات تسمية الجهة — الجهات المتكررة القائمة. */
  useEffect(() => {
    if (!stored || stored.order.customerName.trim()) return;
    let active = true;
    void (async () => {
      const ledger = await partyLedger.read({ repeatedOnly: true });
      if (active && ledger.ok)
        setPartySuggestions(ledger.value.parties.map(party => party.name).slice(0, 12));
    })();
    return () => {
      active = false;
    };
  }, [stored, partyLedger, dataVersion]);

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
    ...(order.status !== "cancelled" && order.events.some(event => event.type === "collection_recorded")
      ? ["تراجع عن قبضة"]
      : []),
    ...(canCancelOrder(order) ? ["إلغاء الطلب"] : []),
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

  /* Conflict B: تسمية جهة الطلب غير المسمّى — تعبئة باتجاه واحد عبر النطاق. */
  async function assignCustomerName(name: string) {
    if (!stored) return;
    setMessage(null);
    setIsActing(true);
    const result = await fulfillment.assignCustomerName(stored.id, name);
    setIsActing(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setStored(result.stored);
    setState({ phase: "ready", stored: result.stored });
    setAssignNameOpen(false);
    setAssignNameValue("");
    notifyDataChanged();
  }

  /* المجموعة ٤ (عقد ٢٩): تصنيف أو إعادة تصنيف معنى العربون — التصحيح عكس + بديل ذرّي،
   * والطلب يُحدَّث مع الحدث في معاملة واحدة. الافتراضي الآمن «معلق» يبقى حتى الاختيار. */
  async function classifyDeposit(meaning: "owner" | "revenue", reason: string) {
    if (!stored) return;
    setMessage(null);
    setIsActing(true);
    /* Conflict E: مبلغ التصنيف صريح — الافتراضي كامل غير المصنَّف من المحتفظ به. */
    const unclassifiedMinor =
      (stored.order.depositRetainedMinor ?? 0) -
      (stored.order.depositClassifiedOwnerMinor ?? 0) -
      (stored.order.depositClassifiedRevenueMinor ?? 0);
    const result = await retainedDeposits.classify(
      stored.id,
      meaning,
      reason,
      classifyAmount ?? (unclassifiedMinor > 0 ? unclassifiedMinor : undefined),
    );
    setIsActing(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setStored(result.value.order);
    setState({ phase: "ready", stored: result.value.order });
    setClassifyMeaning(null);
    setClassifyReason("");
    setClassifyAmount(null);
    notifyDataChanged();
  }

  async function reclassifyDeposit(meaning: "owner" | "revenue", reason: string) {
    if (!stored) return;
    setMessage(null);
    setIsActing(true);
    const result = await retainedDeposits.reclassify(stored.id, { toMeaning: meaning, reason });
    setIsActing(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setStored(result.value.order);
    setState({ phase: "ready", stored: result.value.order });
    setClassifyMeaning(null);
    setClassifyReason("");
    notifyDataChanged();
  }

  async function cancelWithReason(reason: string) {
    setCancelPanelOpen(false);
    setOtherReasonOpen(false);
    setOtherReason("");
    await run(() => fulfillment.cancel(stored!.id, reason));
  }

  /* المجموعة ٣ (عقد D4): عكس التسليم — الإيراد يُحيَّد والحركات تُعكس مرآةً
   * والكاش المقبوض لا يُمس؛ الطلب ينتقل إلى مراجعة صريحة قابلة للاستئناف. */
  async function runDeliveryReversal() {
    if (!stored) return;
    const result = await deliveryReview.reverseDelivery(stored.id, { reason: deliveryReversalReason });
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setStored(result.value.stored);
    setState({ phase: "ready", stored: result.value.stored });
    notifyDataChanged();
    setDeliveryReversalOpen(false);
    setDeliveryReversalReason("");
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

  /* WF-01/FC-04: إغلاق لوحة العربون وإعادة الحقول لهيئتها الآمنة. */
  const closeDepositPanel = () => {
    setDepositPanelOpen(false);
    setExtraDepositMinor(0);
    setValidExtraDeposit(true);
    setDepositWalletId("");
  };

  /* WF-01/FC-04: العربون يُسجّل على الطلب أولًا (دومين ذرّي ومفتاح حتمي)، ثم
   * إن اختار المالك محفظة يُخصّص الكاش إليها بمفتاح مشتق من مفتاح العربون
   * نفسه — إعادة المحاولة أو النقر المزدوج لا يكرر التخصيص. فشل التخصيص
   * لا يمس العربون المسجل: يبقى في غير الموزع ويعرض السبب بصدق. */
  async function recordExtraDeposit(): Promise<void> {
    if (state.phase !== "ready") return;
    const order = state.stored.order;
    const remainingMinor = order.agreedPriceMinor - order.collectedMinor;
    if (!validExtraDeposit || !Number.isInteger(extraDepositMinor) || extraDepositMinor <= 0) {
      setMessage("أدخل مبلغ العربون رقمًا صحيحًا موجبًا بالأرقام 0–9.");
      return;
    }
    if (extraDepositMinor > remainingMinor) {
      setMessage(`العربون لا يتجاوز المتبقي من السعر — المتبقي ${formatMoneyMinor(remainingMinor)} د.أ.`);
      return;
    }
    setIsActing(true);
    try {
      const result = await fulfillment.collectDeposit(state.stored.id, {
        amountMinor: extraDepositMinor,
        operationKey: depositOperationKeyRef.current,
      });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      if (depositWalletId) {
        const attribution = await projectFinance.distributeUnallocated({
          walletId: depositWalletId,
          deltaMinor: extraDepositMinor,
          note: `عربون إضافي على طلب «${order.itemName}»`,
          operationKey: `${depositOperationKeyRef.current}:attribute`,
          sourceRefId: state.stored.id,
          sourceRefKind: "order",
          sourceRefLineId: `${state.stored.id}:${depositOperationKeyRef.current}`,
        });
        if (!attribution.ok) {
          /* العربون محصل والتخصيص تعذّر — المال في غير الموزع والرسالة صادقة. */
          setMessage(
            `سُجّل العربون، وتعذر تخصيصه للمحفظة: ${attribution.message} — المبلغ في الكاش غير الموزع.`,
          );
        }
      }
      setStored(result.stored);
      setState({ phase: "ready", stored: result.stored });
      notifyDataChanged();
      closeDepositPanel();
    } finally {
      setIsActing(false);
    }
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
      /* المجموعة ٣ (عقد D5): لا تسليم بنقرة واحدة — مراجعة كاملة قبل الالتزام:
       * المال والمخزون المقترح والقبض الاختياري ثم تأكيد واحد لمعاملة ذرّية. */
      <button
        className="micro-button micro-button-primary micro-save-cost"
        type="button"
        onClick={() => {
          navigate(withFrom(`/orders/${stored.id}/deliver`, `/orders/${stored.id}`));
        }}
      >
        <CheckCircle2 aria-hidden="true" />
        راجع التسليم وسجّله
      </button>
    ) : order.status === "needs_review" && lastDeliveryWasReversed(order) ? (
      /* المجموعة ٣ (عقد D4): الاستئناف الموثق بعد عكس التسليم — انتقالات النطاق
       * نفسها لا مسار خاص؛ المراجعة تُغلق بقرار صريح لا صمتًا. */
      <button
        className="micro-button micro-button-primary micro-save-cost"
        type="button"
        disabled={isActing}
        onClick={() => {
          void run(() => fulfillment.resumeAfterReview(stored.id));
        }}
      >
        <Play aria-hidden="true" />
        {isActing ? "جارٍ الاستئناف…" : "استئناف التنفيذ بعد المراجعة"}
      </button>
    ) : order.status === "delivered" && order.receivableMinor > 0 ? (
      <div className="micro-form-actions micro-contextual-actions">
        {/* المجموعة ٣ (عقد D5): التحصيل عبر ورقة التحصيل — وجهة محفظة صريحة
            وتحصيل واحد موثق؛ لا قبض بلا وجهة من هنا. */}
        <button
          className="micro-button micro-button-primary"
          type="button"
          onClick={() => {
            navigate(withFrom(`/collect?source=order:${stored.id}`, `/orders/${stored.id}`));
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
        {/* Conflict B: اسم الطلب الودّي يظهر فوق اسم العمل إن وُجد. */}
        <h1>{order.orderName?.trim() ? order.orderName : order.itemName}</h1>
        <p>
          {order.customerName.trim() ? order.customerName : "زبون بلا اسم — سمِّ الجهة لاحقًا"} · الكمية:{" "}
          {order.quantity}
          {order.orderName?.trim() ? ` · ${order.itemName}` : ""}
        </p>
      </div>
      {/* Conflict B: تسمية جهة طلب بلا اسم — تعبئة باتجاه واحد (اختيار جهة
          قائمة أو اسم جديد يصبح جهة عند تكراره)؛ الديون غير المسماة تبقى
          ظاهرة بتحذير في ورقة التحصيل حتى التسمية. */}
      {order.status !== "cancelled" && !order.customerName.trim() ? (
        assignNameOpen ? (
          <section
            className="micro-cancel-panel"
            aria-label="تسمية جهة الطلب"
            data-testid="assign-party-panel"
          >
            <strong>سمِّ جهة هذا الطلب</strong>
            <p>
              اسم الجهة يجعل الدين والتحصيل قابلين للتتبع في دفتر الناس (يظهر عند تكرار الاسم مرتين). هذا
              الطلب بلا اسم حتى الآن — التسمية تعبئة باتجاه واحد لا إعادة تسمية.
            </p>
            <label className="micro-field">
              <span>اسم الجهة</span>
              <input
                value={assignNameValue}
                onChange={event => setAssignNameValue(event.target.value)}
                placeholder="مثال: سارة"
                aria-label="اسم جهة الطلب"
                list="order-party-suggestions"
              />
              <datalist id="order-party-suggestions">
                {partySuggestions.map(name => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </label>
            <div className="micro-form-actions micro-contextual-actions">
              <button
                className="micro-button micro-button-primary"
                type="button"
                disabled={isActing || !assignNameValue.trim()}
                onClick={() => void assignCustomerName(assignNameValue)}
              >
                احفظ اسم الجهة
              </button>
              <button
                className="micro-button micro-button-quiet"
                type="button"
                onClick={() => setAssignNameOpen(false)}
              >
                لاحقًا
              </button>
            </div>
          </section>
        ) : (
          <button
            className="micro-text-action"
            type="button"
            onClick={() => setAssignNameOpen(true)}
            data-testid="assign-party-opener"
          >
            سمِّ جهة هذا الطلب
          </button>
        )
      ) : null}
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
                      {
                        label: "الكاش المقبوض",
                        beforeMinor: order.collectedMinor,
                        afterMinor: order.collectedMinor,
                      },
                      {
                        label: "الإيراد المعروف بعد التسليم",
                        beforeMinor: order.recognizedRevenueMinor,
                        afterMinor: ["delivered", "settled"].includes(order.status)
                          ? newPriceMinor
                          : order.recognizedRevenueMinor,
                      },
                      { label: "أمانات", beforeMinor: 0, afterMinor: 0 },
                    ]}
                    unchanged={["العربون المحصل وقيمته", "القبضات المسجلة وتواريخها", "تكلفة الطلب"]}
                    resulting={[
                      {
                        label: "المتبقي بعد التعديل",
                        amountMinor: Math.max(newPriceMinor - order.collectedMinor, 0),
                      },
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
                      void run(() =>
                        fulfillment.revisePrice(stored.id, { newPriceMinor, reason: priceReason }),
                      );
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
            {/* المجموعة ٣ (عقد D4/D5): عكس التسليم المكتمل — تصحيح موثق يحيّد الإيراد
                ويعكس حركات الاستهلاك مرآةً ولا يمس الكاش المقبوض؛ الطلب ينتقل إلى
                «يحتاج مراجعة» ويُستأنف تنفيذه بقرار صريح. */}
            {["delivered", "settled"].includes(order.status) && !lastDeliveryWasReversed(order) ? (
              deliveryReversalOpen ? (
                <section className="micro-cancel-panel" aria-label="عكس التسليم">
                  <CorrectionPreview
                    action="عكس التسليم المكتمل"
                    originalLabel={`تسليم «${order.itemName}» بإيراد معروف ${formatMoneyMinor(order.recognizedRevenueMinor)} د.أ`}
                    originalDetail={`المقبوض ${formatMoneyMinor(order.collectedMinor)} د.أ · التكلفة المعروفة ${formatMoneyMinor(order.recognizedCostMinor)} د.أ`}
                    intro="عكس موثق لا حذف: حدث التسليم وأثره يبقى في السجل، الإيراد والنتيجة يُحيَّدان إلى غياب المعرفة، وحركات استهلاك المواد المرتبطة بهذا التسليم تُعكس مرآةً فيرجع الرصيد. الكاش المقبوض لا يتأثر — عكس قبضة له مساره الخاص."
                    dimensions={[
                      { label: "الإيراد المعروف", beforeMinor: order.recognizedRevenueMinor, afterMinor: 0 },
                      {
                        label: "الكاش المقبوض",
                        beforeMinor: order.collectedMinor,
                        afterMinor: order.collectedMinor,
                      },
                      { label: "أمانات", beforeMinor: 0, afterMinor: 0 },
                    ]}
                    unchanged={[
                      "القبضات المسجلة وتواريخها",
                      "العربون ومسار تسويته إن وجد",
                      "الأحداث السابقة كلها",
                    ]}
                    resulting={[{ label: "نتيجة الطلب بعد العكس", amountMinor: null, unknown: true }]}
                    reversibleNote="بعد العكس ينتقل الطلب إلى «يحتاج مراجعة»: استأنف التنفيذ بقرار صريح أو ألغِ موثقًا؛ إعادة التسليم لاحقًا تسجيل جديد لا تكرار."
                    reason={deliveryReversalReason}
                    onReasonChange={setDeliveryReversalReason}
                    reasonPlaceholder="مثال: سُلّم الطلب للزبون الخطأ"
                    error={message}
                    busy={isActing}
                    confirmLabel="أكّد عكس التسليم"
                    busyLabel="جارٍ عكس التسليم…"
                    danger={true}
                    onConfirm={() => {
                      void (async () => {
                        setIsActing(true);
                        await runDeliveryReversal();
                        setIsActing(false);
                      })();
                    }}
                    onCancel={() => {
                      setDeliveryReversalOpen(false);
                      setDeliveryReversalReason("");
                    }}
                  />
                </section>
              ) : (
                <button
                  className="micro-button micro-button-quiet"
                  type="button"
                  disabled={isActing}
                  onClick={() => setDeliveryReversalOpen(true)}
                >
                  <RotateCcw aria-hidden="true" /> اعكس التسليم
                </button>
              )
            ) : null}
            {/* القرار ١٩ + Conflict F (AV-07): الإلغاء من أي حالة قبل التسليم ومن
                «يحتاج مراجعة»/«مؤجل» عبر cancelOrder وحدها (عقد ٠٢) — مع معاينة
                أثر إلزامية قبل القرار؛ وإن تعذّر الإكمال الآمن يُقفل برسالة صادقة
                من النطاق، لا إلغاء جزئي صامت. */}
            {canCancelOrder(order) ? (
              cancelPanelOpen ? (
                <section className="micro-cancel-panel" aria-label="تأكيد إلغاء الطلب">
                  <strong>لماذا تلغي هذا الطلب؟</strong>
                  {/* معاينة الأثر الإلزامية (Conflict F): العواقب والأرقام قبل
                      أزرار السبب — لا قرار بلا معاينة. */}
                  <div className="micro-finance-reversal-review" data-testid="cancel-impact-preview">
                    <strong>معاينة أثر الإلغاء</strong>
                    <p>
                      الطلب سيُعلَّم ملغًى ويبقى في السجل بتاريخه وأحداثه — لا حذف. الإلغاء نفسه لا يُنشئ
                      إيرادًا ولا خسارة؛ تسوية العربون تُقرّرها بعد الإلغاء بصراحة.
                    </p>
                    {order.status === "needs_review" ? (
                      <p className="micro-note-copy">
                        هذا الطلب في «يحتاج مراجعة» بعد عكس تسليم موثق — الإلغاء يُتِمّ من هنا بأمان. وإن كان
                        ثمة تسليم غير معكوس فسيُقفل الإلغاء برسالة تشرح السبب.
                      </p>
                    ) : null}
                  </div>
                  <p>
                    السبب اختياري — اختر بنقرة أو تخطَّ. الإلغاء لا يحذف الطلب ولا أحداثه؛ يسجّل تسوية موثقة
                    ويبقى في السجل.
                  </p>
                  {order.depositCollectedMinor > 0 ? (
                    <p className="micro-warning-copy">
                      يوجد عربون محصل (
                      <MoneyValue minor={order.depositCollectedMinor} className="micro-inline-number" /> د.أ)
                      — يبقى بعد الإلغاء «يحتاج مراجعة» حتى تردّه أو تحتفظ به صراحة، وهذا خيار صالح لا خطأ.
                    </p>
                  ) : null}
                  {/* عقد الإغلاق العميق (AV-06 — أموال مقبوضة عند الإلغاء): تحصيلات
                      غير العربون تبقى في السجل والكاش بعد الإلغاء بلا مسار تراجع
                      مباشر (التراجع عن قبضة متاح ما دام الطلب حيًا) — التحذير
                      يشرح الأثر ويقدّم الفعل التالي قبل قرار الإلغاء، لا بعده. */}
                  {order.collectedMinor - order.depositCollectedMinor > 0 ? (
                    <p className="micro-warning-copy" data-testid="cancel-collected-warning">
                      يوجد تحصيل غير العربون بقيمة (
                      <MoneyValue
                        minor={order.collectedMinor - order.depositCollectedMinor}
                        className="micro-inline-number"
                      />{" "}
                      د.أ) — بعد الإلغاء تبقى هذه القبضة في السجل والكاش بلا مسار تراجع عن طلب ملغى. إن كنت
                      ستعيد المبلغ للزبون، تراجع عن القبضة أولًا من قسم التحصيلات ثم ألغِ.
                    </p>
                  ) : null}
                  <div className="micro-form-actions micro-contextual-actions">
                    <button
                      className="micro-button micro-button-secondary"
                      type="button"
                      disabled={isActing}
                      onClick={() => {
                        void cancelWithReason("خطأ في السعر");
                      }}
                    >
                      خطأ في السعر
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
            {/* عقد الإغلاق العميق (WF-01/MR-01): عربون إضافي أثناء الرحلة قبل
                التسليم — المسار الذي كانت ورقة التحصيل توجه إليه بلا سطح فعلي.
                العربون يرفع الكاش المقبوض ويبقى دينًا مرتبطًا بالطلب لا إيرادًا؛
                الإيراد يُعرف مرة واحدة عند التسليم، ووجهة الكاش خيار صريح. */}
            {preDeliveryStatuses.includes(order.status) &&
            order.agreedPriceMinor - order.collectedMinor > 0 ? (
              depositPanelOpen ? (
                <section
                  className="micro-cancel-panel"
                  aria-label="تسجيل عربون إضافي"
                  data-testid="extra-deposit-panel"
                >
                  <strong>سجّل عربونًا إضافيًا</strong>
                  <p>
                    دفعة قبل التسليم تُسجَّل عربونًا مرتبطًا بهذا الطلب والزبون — ترفع الكاش المقبوض ولا تُعدّ
                    إيرادًا؛ عند التسليم تُطبَّق على قيمة الطلب مرة واحدة بلا تحصيل مزدوج.
                  </p>
                  <label className="micro-field">
                    <span>مبلغ العربون بالدينار الأردني</span>
                    <EnglishNumberInput
                      value={extraDepositMinor}
                      kind="money"
                      onNumericChange={setExtraDepositMinor}
                      onTextValidityChange={setValidExtraDeposit}
                      aria-label="مبلغ العربون الإضافي"
                    />
                  </label>
                  <label className="micro-field">
                    <span>وجهة الكاش المحصل</span>
                    <select
                      value={depositWalletId}
                      onChange={event => setDepositWalletId(event.target.value)}
                      aria-label="وجهة العربون"
                    >
                      <option value="">غير موزع — يُوزَّع لاحقًا بقرار صريح</option>
                      {walletOptions.map(wallet => (
                        <option key={wallet.id} value={wallet.id}>
                          {wallet.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {validExtraDeposit && extraDepositMinor > 0 ? (
                    <p className="micro-muted-copy" data-testid="extra-deposit-preview">
                      المتبقي على الطلب بعد العربون يصبح{" "}
                      {formatMoneyMinor(
                        Math.max(order.agreedPriceMinor - order.collectedMinor - extraDepositMinor, 0),
                      )}{" "}
                      د.أ · العربون ليس إيرادًا ولا ربحًا الآن.
                    </p>
                  ) : null}
                  <div className="micro-form-actions micro-contextual-actions">
                    <button
                      className="micro-button micro-button-primary"
                      type="button"
                      disabled={isActing || !validExtraDeposit || extraDepositMinor <= 0}
                      onClick={() => {
                        void recordExtraDeposit();
                      }}
                    >
                      سجّل العربون
                    </button>
                    <button
                      className="micro-button micro-button-quiet"
                      type="button"
                      disabled={isActing}
                      onClick={closeDepositPanel}
                    >
                      تراجع
                    </button>
                  </div>
                </section>
              ) : (
                <button
                  className="micro-button micro-button-quiet"
                  type="button"
                  disabled={isActing}
                  onClick={() => {
                    depositOperationKeyRef.current = `order-deposit-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
                    setDepositPanelOpen(true);
                  }}
                >
                  <HandCoins aria-hidden="true" /> سجّل عربونًا إضافيًا
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
                    ? (order.events.find(event => event.id === reversalEventId) ?? null)
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
                                <RotateCcw aria-hidden="true" /> تراجع عن{" "}
                                {formatMoneyMinor(remainingOf(event.id))} د.أ
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
      {/* القرار ١٩ + Conflict E: عربون طلب ملغى ينتظر قرارًا — رد كامل أو جزئي،
          أو احتفاظ جزئي لتغطية التكلفة الموثقة، أو إبقاء معلق — مع معاينة أثر
          رقمية إلزامية قبل القرار، والرد من محفظة المصدر حيث وُجد التخصيص. */}
      {order.status === "cancelled" && order.depositSettlement === "needs_review" ? (
        <section className="micro-cancel-panel" aria-label="تسوية عربون طلب ملغى">
          <strong>
            عربون محصل ينتظر قرارك (
            <MoneyValue minor={order.depositCollectedMinor} className="micro-inline-number" /> د.أ)
          </strong>
          {/* معاينة الأثر الإلزامية (Conflict E): لا قرار بلا أرقام — التكلفة
              الموثقة، ما استُهلك فعلًا، والاقتراح القائم عليها. */}
          {(() => {
            const pendingMinor = order.depositCollectedMinor - (order.depositRetainedMinor ?? 0);
            const documentedCostMinor = order.costSnapshot.plannedCostMinor;
            const coverProposalMinor = Math.min(pendingMinor, documentedCostMinor);
            const refundProposalMinor = pendingMinor - coverProposalMinor;
            return (
              <div className="micro-finance-reversal-review" data-testid="deposit-settlement-preview">
                <strong>معاينة أثر قرار العربون</strong>
                <dl>
                  <div>
                    <dt>العربون المعلق</dt>
                    <dd>
                      <MoneyValue minor={pendingMinor} className="micro-inline-number" /> د.أ
                      {(order.depositRetainedMinor ?? 0) > 0 ? (
                        <small>
                          {" "}
                          (محتفظ به سابقًا:{" "}
                          <MoneyValue
                            minor={order.depositRetainedMinor ?? 0}
                            className="micro-inline-number"
                          />{" "}
                          د.أ)
                        </small>
                      ) : null}
                    </dd>
                  </div>
                  <div>
                    <dt>التكلفة الموثقة للطلب</dt>
                    <dd>
                      <MoneyValue minor={documentedCostMinor} className="micro-inline-number" /> د.أ
                    </dd>
                  </div>
                  <div>
                    <dt>ما استُهلك فعلًا</dt>
                    <dd>
                      0 د.أ — الطلب لم يُسلَّم؛ موادّه لم تُستهلك من المخزون
                      {order.status === "cancelled" ? " والإلغاء نفسه لا يكتب مصروفًا" : ""}.
                    </dd>
                  </div>
                  <div>
                    <dt>الاقتراح بعد التكلفة الموثقة</dt>
                    <dd>
                      احتفظ بما يغطي التكلفة (حتى{" "}
                      <MoneyValue minor={coverProposalMinor} className="micro-inline-number" /> د.أ) وردّ
                      الباقي (
                      <MoneyValue minor={refundProposalMinor} className="micro-inline-number" /> د.أ) — عدّل
                      المبلغ كما تقرر؛ القرار سببه موثق دائمًا.
                    </dd>
                  </div>
                  <div>
                    <dt>أثر الرد على الكاش</dt>
                    <dd>يخرج المردود من رصيدك المقبوض — ومن محفظة المصدر المسجلة حيث وُجد تخصيص العربون.</dd>
                  </div>
                  <div>
                    <dt>أثر الاحتفاظ</dt>
                    <dd>
                      الكاش يبقى محصلًا بلا معنى حتى تصنّفه صراحة: مال مالك (ليس ربحًا) أو إيراد مشروع — لا
                      تصنيف خفي.
                    </dd>
                  </div>
                </dl>
              </div>
            );
          })()}
          <label className="micro-field">
            <span>
              مبلغ التسوية <small>اختياري — الافتراضي كامل المعلق</small>
            </span>
            <EnglishNumberInput
              value={settleAmount ?? order.depositCollectedMinor - (order.depositRetainedMinor ?? 0)}
              kind="money"
              onNumericChange={value => setSettleAmount(value)}
              aria-label="مبلغ تسوية العربون"
            />
            <small>
              اتركه كما هو للتسوية الكاملة، أو اكتب جزئيًا — الباقي يبقى «يحتاج مراجعة» بلا قرار خفي.
            </small>
          </label>
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
                void run(() =>
                  fulfillment.refundDeposit(stored.id, depositReason, settleAmount ?? undefined),
                );
                setDepositReason("");
                setSettleAmount(null);
              }}
            >
              <HandCoins aria-hidden="true" /> رُدَّ العربون
            </button>
            <button
              className="micro-button micro-button-secondary"
              type="button"
              disabled={isActing || !depositReason.trim()}
              onClick={() => {
                void run(() =>
                  fulfillment.retainDeposit(stored.id, depositReason, settleAmount ?? undefined),
                );
                setDepositReason("");
                setSettleAmount(null);
              }}
            >
              احتفظ به رصيدًا
            </button>
          </div>
          <p>أو اتركه «يحتاج مراجعة» وتابع لاحقًا — خيار صالح لا خطأ؛ يبقى ظاهرًا في فحص السلامة حتى تقرر.</p>
        </section>
      ) : null}
      {order.status === "cancelled" && order.depositSettlement === "refund_deposit" ? (
        <section className="micro-note-card">
          <HandCoins aria-hidden="true" />
          <p>عربون مُرَدّ بتسوية موثقة.</p>
        </section>
      ) : null}
      {order.status === "cancelled" && order.depositSettlement === "retain_deposit" ? (
        <section className="micro-cancel-panel" aria-label="معنى العربون المحتفظ به">
          <strong>
            عربون محتفظ به (
            <MoneyValue minor={order.depositCollectedMinor} className="micro-inline-number" /> د.أ) — شو بدك
            تعمل فيه؟
          </strong>
          {(() => {
            const retainedMinor = order.depositRetainedMinor ?? order.depositCollectedMinor;
            const classifiedMinor =
              (order.depositClassifiedOwnerMinor ?? 0) + (order.depositClassifiedRevenueMinor ?? 0);
            const unclassifiedMinor = retainedMinor - classifiedMinor;
            return unclassifiedMinor > 0;
          })() ? (
            <>
              <p>
                الكاش محتفظ به بلا معنى بعد. صنّفه: مال مالك (تسحبه وقتما تشاء)، أو إيراد مشروع (يدخل ربح فترة
                القرار) — بمبلغ صريح إن شئت جزئيًا، والباقي يبقى بانتظار قراره. أو اتركه معلقًا — خيار صالح
                ظاهر حتى تقرر.
              </p>
              {/* المجموعة ٥ (تسديد دَين المجموعة ٤ — بند ٢) + Conflict E: سطر الأثر
               * الرقمي قبل التأكيد — بمبلغ التصنيف الفعلي لا الرقم الكامل فقط. */}
              {(() => {
                const retainedMinor = order.depositRetainedMinor ?? order.depositCollectedMinor;
                const classifiedMinor =
                  (order.depositClassifiedOwnerMinor ?? 0) + (order.depositClassifiedRevenueMinor ?? 0);
                const unclassifiedMinor = retainedMinor - classifiedMinor;
                return (
                  <p className="micro-deposit-effect-line" role="note">
                    هذا التغيير سيؤثر على الرصيد كالتالي: «مال مالك» يرفع مال المالك{" "}
                    <MoneyValue minor={classifyAmount ?? unclassifiedMinor} className="micro-inline-number" />{" "}
                    د.أ بلا أي أثر على نتيجة الفترة؛ و«إيراد مشروع» يضيف{" "}
                    <MoneyValue minor={classifyAmount ?? unclassifiedMinor} className="micro-inline-number" />{" "}
                    د.أ إلى نتيجة فترة القرار بلا كاش جديد (الكاش قُبض سابقًا). كلاهما قابل للتصحيح الموثق
                    لاحقًا.
                    {(order.depositClassifiedOwnerMinor ?? 0) > 0 ||
                    (order.depositClassifiedRevenueMinor ?? 0) > 0 ? (
                      <small>
                        {" "}
                        المصنَّف سابقًا:{" "}
                        <MoneyValue
                          minor={order.depositClassifiedOwnerMinor ?? 0}
                          className="micro-inline-number"
                        />{" "}
                        مال مالك و{" "}
                        <MoneyValue
                          minor={order.depositClassifiedRevenueMinor ?? 0}
                          className="micro-inline-number"
                        />{" "}
                        إيراد — والمعلق{" "}
                        <MoneyValue minor={unclassifiedMinor} className="micro-inline-number" /> د.أ بانتظار
                        هذا القرار.
                      </small>
                    ) : null}
                  </p>
                );
              })()}
              {(() => {
                const retainedMinor = order.depositRetainedMinor ?? order.depositCollectedMinor;
                const classifiedMinor =
                  (order.depositClassifiedOwnerMinor ?? 0) + (order.depositClassifiedRevenueMinor ?? 0);
                const unclassifiedMinor = retainedMinor - classifiedMinor;
                return (
                  <label className="micro-field">
                    <span>
                      مبلغ التصنيف <small>اختياري — الافتراضي كامل غير المصنَّف</small>
                    </span>
                    <EnglishNumberInput
                      value={classifyAmount ?? unclassifiedMinor}
                      kind="money"
                      onNumericChange={value => setClassifyAmount(value)}
                      aria-label="مبلغ تصنيف العربون"
                    />
                  </label>
                );
              })()}
              <label className="micro-field">
                <span>سبب التصنيف (مطلوب عند الاختيار)</span>
                <input
                  value={classifyReason}
                  onChange={event => setClassifyReason(event.target.value)}
                  placeholder="مثال: العميل تنازل عن العربون مقابل الإلغاء"
                />
              </label>
              <div className="micro-form-actions micro-contextual-actions">
                <button
                  className="micro-button micro-button-primary"
                  type="button"
                  disabled={isActing || !classifyReason.trim()}
                  onClick={() => void classifyDeposit("owner", classifyReason)}
                >
                  مال مالك
                </button>
                <button
                  className="micro-button micro-button-secondary"
                  type="button"
                  disabled={isActing || !classifyReason.trim()}
                  onClick={() => void classifyDeposit("revenue", classifyReason)}
                >
                  إيراد مشروع
                </button>
              </div>
            </>
          ) : (
            <>
              <p>
                {order.retainedMeaning === "owner"
                  ? "صُنّف مال مالك — يظهر في مال المالك، وتسحبه وقتما تشاء بلا إيراد جديد."
                  : order.retainedMeaning === "mixed"
                    ? "صُنّف مختلطًا — جزء مال مالك وجزء إيراد مشروع بمبلغين موثقين؛ راجع سجل الأحداث."
                    : "صُنّف إيراد مشروع — يُعترف به مرة واحدة في نتيجة فترة القرار، لا كاش جديد."}
              </p>
              <button
                className="micro-text-action"
                type="button"
                aria-expanded={classifyMeaning !== null}
                onClick={() => setClassifyMeaning(current => (current === null ? "revenue" : null))}
              >
                صحِّح التصنيف بقرار موثق
              </button>
              {classifyMeaning !== null ? (
                <div className="micro-revision-form">
                  {/* أزرار الاختيار داخل fieldset لا label — الاسم المتاح لكل زر
                   * يبقى نصه، والتسمية الشاملة عبر legend (و٩: إمكانية الوصول). */}
                  <fieldset className="micro-field">
                    <legend>التصنيف الجديد</legend>
                    <div className="micro-choice-row">
                      <button
                        className={`micro-button ${classifyMeaning === "owner" ? "micro-button-primary" : "micro-button-secondary"}`}
                        type="button"
                        onClick={() => setClassifyMeaning("owner")}
                      >
                        مال مالك
                      </button>
                      <button
                        className={`micro-button ${classifyMeaning === "revenue" ? "micro-button-primary" : "micro-button-secondary"}`}
                        type="button"
                        onClick={() => setClassifyMeaning("revenue")}
                      >
                        إيراد مشروع
                      </button>
                    </div>
                  </fieldset>
                  <label className="micro-field">
                    <span>سبب التصحيح (مطلوب)</span>
                    <input
                      value={classifyReason}
                      onChange={event => setClassifyReason(event.target.value)}
                      placeholder="مثال: القرار الأول كان متسرعًا"
                    />
                  </label>
                  <div className="micro-form-actions">
                    <button
                      className="micro-button micro-button-primary"
                      type="button"
                      disabled={isActing || !classifyReason.trim()}
                      onClick={() => void reclassifyDeposit(classifyMeaning, classifyReason)}
                    >
                      احفظ التصحيح الموثق
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
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
      {/* §٥-١٦ (رحلة ٢): الدين المسجل قابل للتحصيل — التحصيل يقلل الدين ولا يعيد
          فتح الطلب. المجموعة ٣ (عقد D5 — SA-5 R1): كل تحصيل من الطلب عبر ورقة
          التحصيل — وجهة محفظة صريحة وتحصيل واحد موثق؛ لا قبض بلا وجهة من هنا. */}
      {order.status === "settled" && order.settlementStatus === "debt" ? (
        <section className="micro-decision-card" aria-label="تحصيل الدين المسجل">
          <span>دين مسجل قابل للتحصيل</span>
          <strong>
            <MoneyValue minor={order.receivableMinor} /> د.أ
          </strong>
          <p>حصّله من ورقة التحصيل بوجهة محفظة واضحة — التحصيل كاش ومتبقٍ فقط، لا إيراد جديد.</p>
          <div className="micro-form-actions micro-contextual-actions">
            <button
              className="micro-button micro-button-primary"
              type="button"
              onClick={() => {
                navigate(withFrom(`/collect?source=order:${stored.id}`, `/orders/${stored.id}`));
              }}
            >
              <HandCoins aria-hidden="true" /> حصّل الدين من ورقة التحصيل
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
      {/* المجموعة ٥ (عقد ٣٣): مشاركة يدوية مع الزبون — نص من السجل يُعرض ويُعدّل
       * قبل أن يغادر الجهاز؛ لا إرسال تلقائي ولا قراءة جهات اتصال. */}
      <div className="micro-form-actions micro-contextual-actions">
        <button
          className="micro-text-action"
          type="button"
          onClick={() => {
            const draft = ["delivered", "settled"].includes(order.status)
              ? deliveryShareDraft(stored)
              : order.receivableMinor > 0
                ? reminderShareDraft(stored, order.receivableMinor, stored.followUpDate ?? null)
                : orderShareDraft(stored);
            navigate(withFrom("/share/preview", `/orders/${stored.id}`), { state: { draft } });
          }}
        >
          <Share2 aria-hidden="true" /> شارك رسالة مع الزبون
        </button>
      </div>
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
            {executionStatuses.includes(order.status)
              ? "الاتفاق وسجل الطلب"
              : "الاتفاق، المواد، الوقت، وسجل الطلب"}
          </small>
        </summary>
        <div className="micro-additional-details-body">
          {sourceEstimate ? (
            <section className="micro-form-card" aria-label="المصدر: تقدير">
              <h2 className="micro-section-title">المصدر: تقدير</h2>
              <p className="micro-muted-copy">
                بدأ هذا الطلب من تقديرك «{sourceEstimate.title}» — نُسخت منه اقتراحات وقتها؛ لا يربط السعر
                الحالي بشيء الآن.
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
