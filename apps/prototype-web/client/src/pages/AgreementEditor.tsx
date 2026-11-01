/* مبدأ Micro: يثبت الاتفاق ما يعرفه المالك الآن، ويبقي بدء التنفيذ والتحصيل أفعالًا منفصلة. */
import { ArrowRight, CircleAlert, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import {
  agreementPriceIsReady,
  agreementSummaryParts,
  applyProtectionPriceAsStart,
  protectionPriceIsReadyForAgreement,
  startAgreementPrice,
} from "@/application/agreements";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import type { AgreementSource, OrderDraft } from "@/storage/local/types";
import { getAgreementPresentation } from "@/presentation/orderAgreementPresentation";
import { formatMoneyMinor } from "@/presentation/formatters";
import type { DeliveryResponsibility } from "@micro-domain/craft-order/index.js";

import { Button } from "@/components/primitives";
type AgreementFormValues = {
  priceMinor: number | null;
  deliveryDate: string;
  /* S12 (UNIT-009 — J002-DEC02): «لم يُحدد بعد» صريح — لا يضع تاريخ اليوم
   * ولا جدولًا؛ المجهول مختلف عن التاريخ وعن الفراغ. */
  deliveryDateUnknown: boolean;
  depositMinor: number | null;
  source: AgreementSource | "";
  acknowledgesBelowFloor: boolean;
  /* (إصلاح تكاملي — مجموعة ٤): اسم العميل يُطلب عند الاتفاق لا عند المسودة —
   * مسودة «تصميم مخطط» بلا حقل اسم لا يمكنها بلوغ الاتفاق أبدًا إلا من هنا. */
  customerName: string;
  /* S12 (UNIT-009 — J002-DEC01): اختيار صريح «التكلفة غير معروفة الآن» عند
   * غياب مرجع تكلفة صالح — مرجع مجهول موثق لا تكلفة 0. */
  costUnknown: boolean;
  /* ORD-003/S12: قسم النقل والتوصيل — النموذج الجديد: لا توصيل أو على
   * المشروع؛ لا رسوم زبون ولا تقاسم في الإنشاء الجديد. */
  deliveryResponsibility: "none" | "project_pays" | "";
  feeChargedMinor: number | null;
  costPaidMinor: number | null;
  feeIncludedInPrice: boolean;
  costIncludedInProductCost: boolean;
  projectShareMinor: number | null;
  customerShareMinor: number | null;
};

function equalAgreementValues(left: AgreementFormValues | null, right: AgreementFormValues | null) {
  return Boolean(
    left &&
    right &&
    left.priceMinor === right.priceMinor &&
    left.deliveryDate === right.deliveryDate &&
    left.deliveryDateUnknown === right.deliveryDateUnknown &&
    left.depositMinor === right.depositMinor &&
    left.source === right.source &&
    left.acknowledgesBelowFloor === right.acknowledgesBelowFloor &&
    left.customerName === right.customerName &&
    left.costUnknown === right.costUnknown &&
    left.deliveryResponsibility === right.deliveryResponsibility &&
    left.feeChargedMinor === right.feeChargedMinor &&
    left.costPaidMinor === right.costPaidMinor &&
    left.feeIncludedInPrice === right.feeIncludedInPrice &&
    left.costIncludedInProductCost === right.costIncludedInProductCost &&
    left.projectShareMinor === right.projectShareMinor &&
    left.customerShareMinor === right.customerShareMinor,
  );
}

export default function AgreementEditor() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const {
    drafts,
    costs,
    agreements,
    cashContinuity,
    projectFinance,
    partyDirectory,
    dataVersion,
    notifyDataChanged,
  } = usePrototypeServices();
  const [draft, setDraft] = useState<OrderDraft | null>(null);
  const [priceMinor, setPriceMinor] = useState<number | null>(startAgreementPrice());
  const [deliveryDate, setDeliveryDate] = useState("");
  /* S12 (UNIT-009 A2/س4 + B3-F04 — J002-DEC02): «لم يُحدد بعد» اختيار صريح —
   * لا يضع تاريخ اليوم ولا جدولًا زائفًا. */
  const [deliveryDateUnknown, setDeliveryDateUnknown] = useState(false);
  const [depositMinor, setDepositMinor] = useState<number | null>(null);
  /* عقد الإغلاق العميق (FC-04 — العقد ٣): وجهة كاش العربون عند الاتفاق — خيار
   * صريح للمالك (محفظة أو غير موزع)، والعربون يبقى دينًا مرتبطًا بالطلب لا
   * إيرانًا. الوجهة تُكتب تخصيصًا موثقًا مرتبطًا بحدث العربون نفسه. */
  const [depositWalletId, setDepositWalletId] = useState("");
  const [walletOptions, setWalletOptions] = useState<readonly { id: string; name: string; kind: string }[]>(
    [],
  );
  useEffect(() => {
    let active = true;
    void (async () => {
      const overview = await cashContinuity.overview();
      if (active && overview.ok) setWalletOptions(overview.value.wallets);
      /* S05 (DOC-014 / UNIT-037 3D-03): مقترحات الجهة من الأطراف المحفوظة
       * النشطة — جارٍ التجهيز (null) يعرض بلا مقترحات لا بفشل صامت. */
      if (partyDirectory) {
        const suggestions = await partyDirectory.suggestLabels();
        if (active && suggestions.ok) setPartySuggestions(suggestions.value.slice(0, 12));
      }
    })();
    return () => {
      active = false;
    };
  }, [cashContinuity, partyDirectory, dataVersion]);
  const [source, setSource] = useState<AgreementSource | "">("");
  const [acknowledgesBelowFloor, setAcknowledgesBelowFloor] = useState(false);
  /* (إصلاح تكاملي — مجموعة ٤): الاسم يُعبّأ من المسودة إن وُجد. */
  const [customerName, setCustomerName] = useState("");
  /* Conflict B: اسم طلب ودّي اختياري — تسمية للعرض فوق اسم العمل. */
  const [orderName, setOrderName] = useState("");
  /* Conflict B: مقترحات الجهات المتكررة — اختيار جهة محفوظة أو إنشاء جديدة. */
  const [partySuggestions, setPartySuggestions] = useState<readonly string[]>([]);
  /* ORD-003/S12: شروط النقل والتوصيل — النموذج الجديد داخل قسم قابل للطي:
   * لا توصيل / على المشروع / بدون شروط (تسجيل لاحق)؛ لا رسوم زبون ولا
   * تقاسم في الإنشاء الجديد. */
  const [deliveryResponsibility, setDeliveryResponsibility] = useState<"none" | "project_pays" | "">("");
  const [feeChargedMinor, setFeeChargedMinor] = useState<number | null>(null);
  const [costPaidMinor, setCostPaidMinor] = useState<number | null>(null);
  const [feeIncludedInPrice, setFeeIncludedInPrice] = useState(false);
  const [costIncludedInProductCost, setCostIncludedInProductCost] = useState(false);
  const [projectShareMinor, setProjectShareMinor] = useState<number | null>(null);
  const [customerShareMinor, setCustomerShareMinor] = useState<number | null>(null);
  const [isFeeValid, setIsFeeValid] = useState(true);
  const [isDeliveryCostValid, setIsDeliveryCostValid] = useState(true);
  const [isProjectShareValid, setIsProjectShareValid] = useState(true);
  const [isCustomerShareValid, setIsCustomerShareValid] = useState(true);
  /* S12 (UNIT-009 — J002-DEC01): اختيار «التكلفة غير معروفة الآن» الصريح —
   * يُعرض عند غياب مرجع تكلفة صالح فقط. */
  const [costUnknown, setCostUnknown] = useState(false);
  /* R10-B4/NF-016: آلة قراءة صريحة — فشل القراءة برسالته الحقيقية مع إعادة
   * محاولة، و«غير موجود» صادق منفصل عنه، لا دمج الاثنين في «التكلفة غير
   * متاحة» (نمط R9-GA-F3.7 الثابت في المحررات المصلحة). */
  const [readState, setReadState] = useState<
    { phase: "loading" } | { phase: "read-error"; message: string } | { phase: "ready" }
  >({ phase: "loading" });
  const [retryCount, setRetryCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPriceValid, setIsPriceValid] = useState(true);
  const [isDepositValid, setIsDepositValid] = useState(true);
  const initialValuesRef = useRef<AgreementFormValues | null>(null);
  useEffect(() => {
    let active = true;
    drafts.get(params.id).then(result => {
      if (!active) return;
      if (!result.ok) {
        setReadState({ phase: "read-error", message: result.message });
        return;
      }
      if (!result.value) {
        /* «غير موجود» رسالة صادقة على سطح خطأ القراءة — نمط R9 الثابت؛
         * لاحظ أنها نص لحظة فعل (message) لا نص سكون. */
        setReadState({
          phase: "read-error",
          message: "لم نجد هذه المسودة؛ قد تكون حذفت محليًا أو أصبحت طلبًا محفوظًا.",
        });
        return;
      }
      const loaded = result.value;
      if (loaded.linkedOrderId) {
        navigate(`/orders/${loaded.linkedOrderId}`);
        return;
      }
      const loadedValues = {
        priceMinor: startAgreementPrice(),
        deliveryDate: "",
        deliveryDateUnknown: false,
        depositMinor: null,
        source: "" as const,
        acknowledgesBelowFloor: false,
        customerName: loaded.customerName,
        costUnknown: false,
        deliveryResponsibility: "" as const,
        feeChargedMinor: null,
        costPaidMinor: null,
        feeIncludedInPrice: false,
        costIncludedInProductCost: false,
        projectShareMinor: null,
        customerShareMinor: null,
      };
      setDraft(loaded);
      setPriceMinor(loadedValues.priceMinor);
      setDeliveryDate(loadedValues.deliveryDate);
      setDeliveryDateUnknown(loadedValues.deliveryDateUnknown);
      setDepositMinor(loadedValues.depositMinor);
      setSource(loadedValues.source);
      setAcknowledgesBelowFloor(loadedValues.acknowledgesBelowFloor);
      setCustomerName(loadedValues.customerName);
      setCostUnknown(loadedValues.costUnknown);
      setOrderName(loaded.orderName ?? "");
      initialValuesRef.current = loadedValues;
      setReadState({ phase: "ready" });
    });
    return () => {
      active = false;
    };
  }, [costs, dataVersion, drafts, navigate, params.id, retryCount]);
  const snapshot = draft?.costSnapshots.find(item => item.id === draft.activeCostSnapshotId) ?? null;
  const preview = useMemo(() => (snapshot ? costs.previewStored(snapshot) : null), [costs, snapshot]);
  const protectionPriceMinor = preview?.ok ? preview.snapshot.priceFloorMinor * (draft?.quantity ?? 1) : null;
  const canUseProtectionPrice = protectionPriceIsReadyForAgreement(
    protectionPriceMinor,
    preview?.ok ? preview.snapshot.knowledgeState : null,
  );
  const isBelowFloor =
    protectionPriceMinor !== null && priceMinor !== null && priceMinor < protectionPriceMinor;
  const agreementPresentation = getAgreementPresentation({
    status: "draft",
    agreedPriceMinor: priceMinor,
    /* S12 (DOC-021 — J002-DEC02، تصحيح R5-F01): التمرير الثلاثي الصادق —
     * المجهول الصريح يمر null فلا يوصف بالنقص، والفراغ يبقى «لم يُدخل بعد». */
    deliveryDate: deliveryDateUnknown ? null : deliveryDate,
  });
  const currentValues = {
    priceMinor,
    deliveryDate,
    deliveryDateUnknown,
    depositMinor,
    source,
    acknowledgesBelowFloor,
    customerName,
    costUnknown,
    deliveryResponsibility,
    feeChargedMinor,
    costPaidMinor,
    feeIncludedInPrice,
    costIncludedInProductCost,
    projectShareMinor,
    customerShareMinor,
  };
  const isDirty = Boolean(
    initialValuesRef.current && !equalAgreementValues(currentValues, initialValuesRef.current),
  );
  /* S12 (UNIT-009 A2/س7): نموذج الإنشاء الجديد — توصيل المشروع وحده؛ الأجرة
   * وحصص التقاسم لم تعد تُعرض في الإنشاء الجديد (P3.3) — توصيل المشروع
   * يحمل كلفته مرة على الطلب. */
  const costApplies = deliveryResponsibility === "project_pays";
  async function persistAgreement(): Promise<string | null> {
    if (!draft) return null;
    setMessage(null);
    /* S12 (DOC-021 — أمر 2e645802 §9): خدمة الاتفاق الكسولة — null = «جارٍ
     * التجهيز» لا فشلًا صامتًا؛ تُعاد المحاولة عند اكتمال التحميل. */
    if (!agreements) {
      setMessage("جارٍ تجهيز خدمة الاتفاق — أعد المحاولة بعد لحظة.");
      return null;
    }
    if (!agreementPriceIsReady(priceMinor)) {
      setMessage("السعر المتفق عليه: أدخل مبلغًا أكبر من صفر أو استخدم سعر الحماية كبداية، ثم أعد التسجيل.");
      return null;
    }
    if (!isPriceValid) {
      setMessage("السعر المتفق عليه: استخدم أرقام 0–9 صحيحة، ثم أعد التسجيل.");
      return null;
    }
    if (depositMinor !== null && !isDepositValid) {
      setMessage("العربون: استخدم أرقام 0–9 صحيحة أو اتركه فارغًا إذا لم تقبض شيئًا، ثم أعد التسجيل.");
      return null;
    }
    /* S12 (UNIT-009 A2/س4 — J002-DEC02): التاريخ أو «لم يُحدد بعد» الصريح —
     * أحدهما لازم؛ المجهول لا يضع تاريخ اليوم ولا جدولًا. */
    if (!deliveryDateUnknown && !deliveryDate) {
      setMessage("موعد التسليم: اختر تاريخًا صحيحًا — أو فعّل «لم يُحدد بعد» صراحةً.");
      return null;
    }
    if (deliveryDateUnknown && deliveryDate) {
      setMessage("موعد التسليم: عطّل «لم يُحدد بعد» قبل إدخال تاريخ، أو أمسح التاريخ.");
      return null;
    }
    if (isBelowFloor && !acknowledgesBelowFloor) {
      setMessage("إقرار سعر الحماية: فعّل مربع الإقرار بعد مراجعة السبب، ثم أعد التسجيل.");
      return null;
    }
    /* S12 (UNIT-009 — J002-DEC01): المجهول الصريح للتكلفة يُقبل فقط عند غياب
     * مرجع صالح — لا يطمس مرجعًا قائمًا. */
    if (costUnknown && preview?.ok) {
      setMessage("التكلفة: لهذه المسودة نسخة تكلفة قائمة — عطّل «غير معروفة الآن» واستعملها.");
      return null;
    }
    if (!costUnknown && !preview?.ok) {
      setMessage("التكلفة: لا يوجد مرجع تكلفة صالح — فعّل «التكلفة غير معروفة الآن» أو افتح التكلفة.");
      return null;
    }
    /* ORD-003/S12: تحقق صلاحية مبالغ النقل قبل أي كتابة — النموذج الجديد
     * كلفة المشروع وحدها. */
    if (costApplies && costPaidMinor !== null && !isDeliveryCostValid) {
      setMessage("كلفة النقل: استخدم أرقام 0–9 صحيحة أو اتركها فارغة إذا لم تُسجل بعد.");
      return null;
    }
    setIsSaving(true);
    /* (إصلاح تكاملي — مجموعة ٤): الاسم المُدخل هنا يُحفظ في المسودة أولًا (مصدر واحد
     * للحقيقة) ثم يُبنى الاتفاق من المسودة المحدّثة — لا مسار كتابة موازٍ. */
    let draftForAgreement = draft;
    const nextOrderName = orderName.trim() || null;
    if (
      (customerName.trim() && customerName.trim() !== draft.customerName) ||
      nextOrderName !== (draft.orderName ?? null)
    ) {
      const savedDraft = await drafts.save({
        ...draft,
        customerName: customerName.trim(),
        orderName: nextOrderName,
      });
      if (!savedDraft.ok) {
        setIsSaving(false);
        setMessage(savedDraft.message);
        return null;
      }
      draftForAgreement = savedDraft.draft;
      setDraft(savedDraft.draft);
    }
    const result = await agreements.createFromDraft(draftForAgreement, {
      agreedPriceMinor: priceMinor,
      /* S12 (UNIT-009 — J002-DEC02): المجهول الصريح يمر null — لا جدول ولا
       * تاريخ صوري؛ القيمة النصية تاريخ محلي صحيح. */
      deliveryDate: deliveryDateUnknown ? null : deliveryDate,
      depositMinor: depositMinor ?? 0,
      agreementSource: source || null,
      costUnknown: costUnknown || undefined,
      /* ORD-003/S12: الشروط تُمرر فقط عند اختيار صريح — النموذج الجديد لا
       * توصيل أو على المشروع؛ لا أجرة زبون ولا تقاسم في الإنشاء الجديد. */
      deliveryTerms: deliveryResponsibility
        ? {
            responsibility: deliveryResponsibility,
            feeIncludedInPrice: false,
            costIncludedInProductCost,
            feeChargedMinor: null,
            costPaidMinor: costApplies ? costPaidMinor : null,
            projectShareMinor: null,
            customerShareMinor: null,
          }
        : null,
    });
    setIsSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return null;
    }
    /* FC-04: وجهة العربون المختارة — تخصيص بمفتاح مشتق من حدث العربون نفسه
     * (`${orderId}:initial-deposit`)؛ فشل التخصيص لا يمس الاتفاق: المبلغ
     * يبقى في غير الموزع والرسالة تعلن السبب. */
    if (depositWalletId && (depositMinor ?? 0) > 0) {
      const attribution = await projectFinance.distributeUnallocated({
        walletId: depositWalletId,
        deltaMinor: depositMinor ?? 0,
        note: `عربون طلب «${draftForAgreement.itemName}»`,
        operationKey: `${result.stored.id}:initial-deposit:attribute`,
        sourceRefId: result.stored.id,
        sourceRefKind: "order",
        sourceRefLineId: `${result.stored.id}:initial-deposit`,
      });
      if (!attribution.ok)
        setMessage(
          `سُجّل الاتفاق والعربون، وتعذر تخصيص الكاش للمحفظة: ${attribution.message} — المبلغ في الكاش غير الموزع.`,
        );
    }
    notifyDataChanged();
    return result.stored.id;
  }
  const requestNavigation = useUnsavedChangesGuard({
    isDirty,
    onSave: async () => Boolean(await persistAgreement()),
  });
  if (readState.phase === "loading")
    return (
      <div className="micro-route-loading" role="status">
        جارٍ فتح الاتفاق…
      </div>
    );
  if (readState.phase === "read-error")
    /* R10-B4/NF-016: فشل القراءة و«غير موجود» معًا برسالتهما الفعلية على
     * سطح خطأ القراءة (نمط R9-GA-F3.7 الثابت) — بصفة alert وإعادة محاولة
     * ومخرج قانوني؛ لا تحميلًا أبديًا ولا دمجًا مع «التكلفة غير متاحة». */
    return (
      <section className="micro-page">
        <button className="micro-back-button" type="button" onClick={() => navigate("/orders")}>
          العودة للطلبات
        </button>
        <p className="micro-field-error" role="alert">
          {readState.message}
        </p>
        <div className="micro-form-actions">
          <Button action="save" onClick={() => setRetryCount(count => count + 1)}>
            إعادة المحاولة
          </Button>
        </div>
      </section>
    );
  if (!draft) return null;
  async function submit() {
    const storedId = await persistAgreement();
    /* ORD-001: بعد كل فعل ناجح — وصول بمعلمة نجاح تعرض رقم الطلب وحالته
     * وأثره المالي والفعل التالي الموصى به. */
    if (storedId) navigate(`/orders/${storedId}?created=1`);
    /* إن تعذّر تخصيص الكاش للوجهة المختارة يبقى المبلغ في غير الموزع بأمان —
     * صفحة الطلب تظهر العربون المحصل، والتوزيع قرار صريح من مالي لاحقًا. */
  }
  function useProtectionPriceAsStart() {
    if (!canUseProtectionPrice) return;
    setPriceMinor(applyProtectionPriceAsStart(protectionPriceMinor));
    setIsPriceValid(true);
    setMessage(null);
  }
  const hasFormError = Boolean(message);
  return (
    <section className="micro-page micro-agreement-page">
      <button
        className="micro-back-button"
        type="button"
        onClick={() => requestNavigation(`/orders/draft/${draft.id}/cost`)}
      >
        <ArrowRight aria-hidden="true" /> العودة للتكلفة
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">{agreementPresentation.label}</span>
        <h1>سجّل ما اتفقت عليه</h1>
      </div>
      {/* S12 (UNIT-009 A2/س2): سياق مختصر من المسودة — وصف وكمية واسم إن وجد؛
          «تعديل» يفتح محرر المسودة (لا إعادة كتابة ما أدخل في 007). */}
      <section className="micro-context-row">
        <p>
          {draft.itemName}
          {draft.quantity > 1 ? ` ×${draft.quantity}` : ""}
          {customerName.trim() ? ` · ${customerName.trim()}` : ""}
        </p>
        <button
          className="micro-text-action"
          type="button"
          onClick={() => requestNavigation(`/orders/draft/${draft.id}`)}
        >
          تعديل
        </button>
      </section>
      <section
        className="micro-cost-result"
        data-knowledge={preview?.ok ? preview.snapshot.knowledgeState : "incomplete"}
      >
        <span>سعر الحماية المشتق من نسخة التكلفة (د.أ)</span>
        <strong>
          {canUseProtectionPrice ? <MoneyValue minor={protectionPriceMinor} /> : "غير متاح بعد"}
        </strong>
        <small>
          {!canUseProtectionPrice
            ? "وقت العمل أو بند مؤثر ما زال ناقصًا؛ لا نعرض هذه القراءة الجزئية كسعر حماية ولا نستخدمها لبداية الاتفاق."
            : preview?.ok && preview.snapshot.knowledgeState === "known"
              ? "قيمة مشتقة من التكلفة المسجلة، وليست السعر المتفق عليه."
              : "قيمة مشتقة من تكلفة تحتاج مراجعة؛ راجع الافتراضات قبل تسجيل السعر."}
        </small>
      </section>
      {/* S12 (UNIT-009 A2/س6 — J002-DEC01): التكلفة كسطر حالة — مرجع صالح أو
          مجهولة صريحة لا تكلفة 0؛ رابط تعديلها عند صاحبها (008). */}
      {preview?.ok ? (
        <p className="micro-save-note" role="status">
          {`التكلفة ${formatMoneyMinor(preview.snapshot.plannedCostMinor)} د.أ —`}{" "}
          <button
            className="micro-text-action"
            type="button"
            onClick={() => requestNavigation(`/orders/draft/${draft.id}/cost`)}
          >
            تعديل
          </button>
        </p>
      ) : (
        <div className="micro-field">
          <label className="micro-confirm-warning">
            <input
              type="checkbox"
              checked={costUnknown}
              onChange={event => setCostUnknown(event.target.checked)}
            />
            <span>التكلفة غير معروفة الآن — سجّل الاتفاق بتكلفة مجهولة بصدق</span>
          </label>
          <p className="micro-field-hint">
            لا تُسجّل تكلفة 0 ولا ربح مزعوم؛ نتيجة الطلب تبقى «غير متاحة» حتى تدخل تكلفة معلومة من التكلفة —
            عد للتكلفة من زر الرجوع أعلاه وقتها.
          </p>
        </div>
      )}
      <section className="micro-form-card">
        <div className="micro-agreement-price-field">
          <label className="micro-field">
            <span>
              السعر المتفق عليه (د.أ) <small>أدخل قرارك، أرقام 0–9 فقط</small>
            </span>
            <EnglishNumberInput
              id="agreement-price"
              value={priceMinor}
              kind="money"
              min="0"
              aria-label="السعر المتفق عليه بالأرقام 0–9"
              aria-invalid={hasFormError && (!isPriceValid || !agreementPriceIsReady(priceMinor))}
              aria-describedby={hasFormError ? "agreement-form-error" : undefined}
              onNumericChange={setPriceMinor}
              onTextValidityChange={setIsPriceValid}
            />
          </label>
          <button
            className="micro-text-action"
            type="button"
            disabled={!canUseProtectionPrice}
            onClick={useProtectionPriceAsStart}
          >
            استخدم سعر الحماية كبداية
          </button>
        </div>
        {isBelowFloor ? (
          <label className="micro-confirm-warning">
            <input
              id="agreement-floor-ack"
              type="checkbox"
              checked={acknowledgesBelowFloor}
              aria-describedby={hasFormError ? "agreement-form-error" : undefined}
              onChange={event => setAcknowledgesBelowFloor(event.target.checked)}
            />
            <span>
              <b>السعر أقل من سعر الحماية.</b> راجعت السبب وأريد تسجيل الاتفاق كما هو.
            </span>
          </label>
        ) : null}
        {/* S12 (UNIT-009 A2/س4 + B3-F04 — J002-DEC02): التاريخ أو «لم يُحدد
            بعد» الصريح — المجهول لا يضع تاريخ اليوم ولا جدولًا، ويُسجّل null
            فيصل السلك بصدق. */}
        {!deliveryDateUnknown ? (
          <LocalDateField
            id="agreement-delivery-date"
            label="موعد التسليم"
            value={deliveryDate}
            aria-invalid={hasFormError && !deliveryDate}
            aria-describedby={hasFormError ? "agreement-form-error" : undefined}
            onChange={event => setDeliveryDate(event.target.value)}
          />
        ) : (
          <p className="micro-save-note" role="status">
            موعد التسليم: لم يُحدد بعد — لا موعد في التقويم، وتحديده لاحقًا لا يعيد إنشاء الاتفاق.
          </p>
        )}
        <label className="micro-confirm-warning">
          <input
            type="checkbox"
            checked={deliveryDateUnknown}
            onChange={event => {
              setDeliveryDateUnknown(event.target.checked);
              if (event.target.checked) setDeliveryDate("");
            }}
          />
          <span>لم يُحدد بعد</span>
        </label>
        <label className="micro-field">
          <span>
            العربون المحصل الآن (د.أ) <small>اختياري؛ اتركه فارغًا إذا لم تقبض</small>
          </span>
          <EnglishNumberInput
            id="agreement-deposit"
            value={depositMinor}
            kind="money"
            min="0"
            allowEmpty
            aria-label="العربون بالأرقام 0–9"
            aria-invalid={hasFormError && depositMinor !== null && !isDepositValid}
            aria-describedby={hasFormError ? "agreement-form-error" : undefined}
            onNumericChange={setDepositMinor}
            onEmptyChange={() => setDepositMinor(null)}
            onTextValidityChange={setIsDepositValid}
          />
        </label>
        {(depositMinor ?? 0) > 0 ? (
          <label className="micro-field">
            <span>وجهة كاش العربون</span>
            <select
              value={depositWalletId}
              onChange={event => setDepositWalletId(event.target.value)}
              aria-label="وجهة كاش العربون"
            >
              <option value="">غير موزع — يُوزّع لاحقًا بقرار صريح</option>
              {walletOptions.map(wallet => (
                <option key={wallet.id} value={wallet.id}>
                  {wallet.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <p className="micro-deposit-truth">
          <CircleAlert aria-hidden="true" /> العربون كاش محصل مرتبط بالطلب، وليس ربحًا نهائيًا أو تسليمًا
          تلقائيًا.
        </p>
        {/* Conflict B: اسم الطلب الودّي اختياري — تسمية للعرض فوق اسم العمل. */}
        <label className="micro-field">
          <span>
            اسم الطلب <small>اختياري</small>
          </span>
          <input
            value={orderName}
            onChange={event => setOrderName(event.target.value)}
            placeholder="مثال: طلب العيد"
            aria-label="اسم الطلب"
            maxLength={80}
          />
        </label>
        <label className="micro-field">
          <span>
            اسم الجهة <small>اختياري</small>
          </span>
          <input
            value={customerName}
            onChange={event => setCustomerName(event.target.value)}
            placeholder="مثال: سارة"
            aria-label="اسم الجهة"
            list="agreement-party-suggestions"
          />
          <datalist id="agreement-party-suggestions">
            {partySuggestions.map(name => (
              <option key={name} value={name} />
            ))}
          </datalist>
          {!customerName.trim() ? (
            <small className="micro-warning-copy" data-testid="unnamed-party-warning">
              طلب بلا اسم جهة — أي دين لاحق سيظهر «زبون بلا اسم» في ورقة التحصيل مع تحذير، ويمكنك تسمية الجهة
              لاحقًا من صفحة الطلب (اختيار اسم مسجل أو اسم جديد يتبع دينه من أول حركة).
            </small>
          ) : null}
        </label>
        <label className="micro-field">
          <span>
            كيف تم الاتفاق؟ <small>اختياري</small>
          </span>
          <select value={source} onChange={event => setSource(event.target.value as AgreementSource | "")}>
            <option value="">غير محدد</option>
            <option value="instagram">Instagram</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="referral">إحالة</option>
            <option value="walk_in">زيارة مباشرة</option>
            <option value="other">أخرى</option>
          </select>
        </label>
        {/* ORD-001/ORD-003/S12 (UNIT-009 A3 + P3.3 — النموذج الجديد):
            معلومات متقدمة داخل قسم قابل للطي — لا يوجد توصيل صريح أو توصيل
            يتحمله المشروع وحده مرة على الطلب؛ لا رسوم زبون ولا تقاسم في
            الإنشاء الجديد، والسجلات القديمة تُقرأ بسياستها. */}
        <details className="micro-advanced-section" data-testid="delivery-terms-section">
          <summary>النقل والتوصيل ومسؤولية كلفته</summary>
          <p className="micro-field-hint">
            اختياري بالكامل. «لا يوجد توصيل» صريح مختلف عن عدم فتح القسم؛ وتوصيل المشروع يحمل كلفته مرة واحدة
            على الطلب، ولا تُحتسب أي أجرة على الزبون في إنشاء الاتفاق الجديد.
          </p>
          <label className="micro-field">
            <span>التوصيل</span>
            <select
              value={deliveryResponsibility}
              aria-label="ترتيب التوصيل عند الاتفاق"
              onChange={event =>
                setDeliveryResponsibility(event.target.value as "none" | "project_pays" | "")
              }
            >
              <option value="">بدون شروط نقل — تسجيل لاحق</option>
              <option value="none">لا يوجد توصيل</option>
              <option value="project_pays">على المشروع — يدفع للناقل</option>
            </select>
          </label>
          {deliveryResponsibility === "none" ? (
            <p className="micro-field-hint">
              لا يوجد توصيل على هذا الطلب — لا أجرة ولا كلفة توصيل تدخل قيمته أو نتيجته.
            </p>
          ) : null}
          {costApplies ? (
            <>
              <label className="micro-field">
                <span>
                  كلفة النقل التي دفعها المشروع (د.أ) <small>اتركها فارغة إذا لم تُسجل بعد</small>
                </span>
                <EnglishNumberInput
                  value={costPaidMinor}
                  kind="money"
                  min="0"
                  allowEmpty
                  aria-label="كلفة النقل المدفوعة من المشروع بالأرقام 0–9"
                  onNumericChange={setCostPaidMinor}
                  onEmptyChange={() => setCostPaidMinor(null)}
                  onTextValidityChange={setIsDeliveryCostValid}
                />
              </label>
              <label className="micro-confirm-warning">
                <input
                  type="checkbox"
                  checked={costIncludedInProductCost}
                  onChange={event => setCostIncludedInProductCost(event.target.checked)}
                />
                <span>الكلفة محتواة أصلًا داخل تكلفة المنتج — لا تُطرح مرة ثانية.</span>
              </label>
            </>
          ) : null}
        </details>
        {message ? (
          <p id="agreement-form-error" className="micro-field-error" role="alert">
            {message}
          </p>
        ) : null}
        {/* S12 (UNIT-009 A2/س8 + B4): ملخص قصير ملاصق للفعل — قيمة الطلب
            المسجلة والمستلم مقدمًا والمتبقي من المدخلات الفعّالة الصحيحة؛
            لا فقرة تعليم ولا رقم من نص فاسد، والمجهول معلن بصدق. */}
        {agreementPriceIsReady(priceMinor) && isPriceValid && (depositMinor === null || isDepositValid) ? (
          <p className="micro-save-preview">
            {(() => {
              /* S12 (تصحيح R5-F03): المعاينة من النية الفعالة القابلة للحفظ فقط —
               * العربون الذي يتجاوز السعر نية يرفضها حد الخدمة، فلا يعرض متبقيًا
               * سالبًا أبدًا (UNIT-009 B4: لا سالب مقبول آليًا) ولا رقمًا من نية
               * غير صالحة. */
              if (depositMinor !== null && priceMinor !== null && depositMinor > priceMinor) {
                return "العربون يتجاوز قيمة الطلب — لا يمكن الحفظ بهذه القيم؛ عدّل أحد الحقلين.";
              }
              const summary = agreementSummaryParts({ priceMinor, depositMinor });
              return `قيمة الطلب المسجلة ${formatMoneyMinor(summary.recordedValueMinor)} د.أ · المستلم مقدمًا ${formatMoneyMinor(
                summary.receivedAdvanceMinor,
              )} د.أ · المتبقي ${formatMoneyMinor(summary.remainingMinor)} د.أ${
                deliveryDateUnknown ? " · الموعد لم يُحدد بعد" : ""
              }${!preview?.ok && costUnknown ? " · التكلفة غير معروفة" : ""}`;
            })()}
          </p>
        ) : null}
        <div className="micro-form-actions micro-sticky-save">
          <Button
            action="save"
            block

            disabled={isSaving}
            onClick={() => {
              void submit();
            }}
          >
            <Save aria-hidden="true" />
            {isSaving ? "جارٍ تسجيل الاتفاق…" : "تسجيل الاتفاق"}
          </Button>
        </div>
      </section>
    </section>
  );
}
