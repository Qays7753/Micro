/* مبدأ Micro: يثبت الاتفاق ما يعرفه المالك الآن، ويبقي بدء التنفيذ والتحصيل أفعالًا منفصلة. */
import { ArrowRight, CircleAlert, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import {
  agreementPriceIsReady,
  applyProtectionPriceAsStart,
  protectionPriceIsReadyForAgreement,
  startAgreementPrice,
} from "@/application/agreements/agreementPrice";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import type { AgreementSource, OrderDraft } from "@/storage/local/types";
import { getAgreementPresentation } from "@/presentation/orderAgreementPresentation";

type AgreementFormValues = {
  priceMinor: number | null;
  deliveryDate: string;
  depositMinor: number | null;
  source: AgreementSource | "";
  acknowledgesBelowFloor: boolean;
  /* (إصلاح تكاملي — مجموعة ٤): اسم العميل يُطلب عند الاتفاق لا عند المسودة —
   * مسودة «تصميم مخطط» بلا حقل اسم لا يمكنها بلوغ الاتفاق أبدًا إلا من هنا. */
  customerName: string;
};

function equalAgreementValues(left: AgreementFormValues | null, right: AgreementFormValues | null) {
  return Boolean(
    left &&
    right &&
    left.priceMinor === right.priceMinor &&
    left.deliveryDate === right.deliveryDate &&
    left.depositMinor === right.depositMinor &&
    left.source === right.source &&
    left.acknowledgesBelowFloor === right.acknowledgesBelowFloor &&
    left.customerName === right.customerName,
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
    partyLedger,
    dataVersion,
    notifyDataChanged,
  } = usePrototypeServices();
  const [draft, setDraft] = useState<OrderDraft | null>(null);
  const [priceMinor, setPriceMinor] = useState<number | null>(startAgreementPrice());
  const [deliveryDate, setDeliveryDate] = useState("");
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
      /* Conflict B: الجهات المتكررة فقط — جهة قائمة تُختار باسمها (لا كيان
       * إدخال مزدوج)، والاسم الجديد يصبح جهة عند تكراره. */
      const ledger = await partyLedger.read({ repeatedOnly: true });
      if (active && ledger.ok)
        setPartySuggestions(ledger.value.parties.map(party => party.name).slice(0, 12));
    })();
    return () => {
      active = false;
    };
  }, [cashContinuity, partyLedger, dataVersion]);
  const [source, setSource] = useState<AgreementSource | "">("");
  const [acknowledgesBelowFloor, setAcknowledgesBelowFloor] = useState(false);
  /* (إصلاح تكاملي — مجموعة ٤): الاسم يُعبّأ من المسودة إن وُجد. */
  const [customerName, setCustomerName] = useState("");
  /* Conflict B: اسم طلب ودّي اختياري — تسمية للعرض فوق اسم العمل. */
  const [orderName, setOrderName] = useState("");
  /* Conflict B: مقترحات الجهات المتكررة — اختيار جهة محفوظة أو إنشاء جديدة. */
  const [partySuggestions, setPartySuggestions] = useState<readonly string[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPriceValid, setIsPriceValid] = useState(true);
  const [isDepositValid, setIsDepositValid] = useState(true);
  const initialValuesRef = useRef<AgreementFormValues | null>(null);
  useEffect(() => {
    let active = true;
    drafts.get(params.id).then(result => {
      if (!active) return;
      if (!result.ok || !result.value) {
        setState("error");
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
        depositMinor: null,
        source: "" as const,
        acknowledgesBelowFloor: false,
        customerName: loaded.customerName,
      };
      setDraft(loaded);
      setPriceMinor(loadedValues.priceMinor);
      setDeliveryDate(loadedValues.deliveryDate);
      setDepositMinor(loadedValues.depositMinor);
      setSource(loadedValues.source);
      setAcknowledgesBelowFloor(loadedValues.acknowledgesBelowFloor);
      setCustomerName(loadedValues.customerName);
      setOrderName(loaded.orderName ?? "");
      initialValuesRef.current = loadedValues;
      setState("ready");
    });
    return () => {
      active = false;
    };
  }, [costs, dataVersion, drafts, navigate, params.id]);
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
    deliveryDate,
  });
  const currentValues = {
    priceMinor,
    deliveryDate,
    depositMinor,
    source,
    acknowledgesBelowFloor,
    customerName,
  };
  const isDirty = Boolean(
    initialValuesRef.current && !equalAgreementValues(currentValues, initialValuesRef.current),
  );
  async function persistAgreement(): Promise<string | null> {
    if (!draft) return null;
    setMessage(null);
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
    if (!deliveryDate) {
      setMessage("موعد التسليم: اختر تاريخًا صحيحًا قبل تسجيل الاتفاق.");
      return null;
    }
    if (isBelowFloor && !acknowledgesBelowFloor) {
      setMessage("إقرار سعر الحماية: فعّل مربع الإقرار بعد مراجعة السبب، ثم أعد التسجيل.");
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
      deliveryDate,
      depositMinor: depositMinor ?? 0,
      agreementSource: source || null,
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
  if (state === "loading")
    return (
      <div className="micro-route-loading" role="status">
        جارٍ فتح الاتفاق…
      </div>
    );
  if (state === "error" || !draft || !preview?.ok)
    return (
      <section className="micro-page micro-not-found">
        <h1>التكلفة المطلوبة غير متاحة</h1>
        <p>احفظ نسخة تكلفة صالحة قبل تسجيل الاتفاق.</p>
        <button
          className="micro-button micro-button-primary"
          type="button"
          onClick={() => navigate(`/orders/draft/${params.id}/cost`)}
        >
          فتح التكلفة
        </button>
      </section>
    );
  async function submit() {
    const storedId = await persistAgreement();
    if (storedId) navigate(`/orders/${storedId}`);
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
      <section className="micro-cost-result" data-knowledge={preview.snapshot.knowledgeState}>
        <span>سعر الحماية المشتق من نسخة التكلفة (د.أ)</span>
        <strong>
          {canUseProtectionPrice ? <MoneyValue minor={protectionPriceMinor} /> : "غير متاح بعد"}
        </strong>
        <small>
          {!canUseProtectionPrice
            ? "وقت العمل أو بند مؤثر ما زال ناقصًا؛ لا نعرض هذه القراءة الجزئية كسعر حماية ولا نستخدمها لبداية الاتفاق."
            : preview.snapshot.knowledgeState === "known"
              ? "قيمة مشتقة من التكلفة المسجلة، وليست السعر المتفق عليه."
              : "قيمة مشتقة من تكلفة تحتاج مراجعة؛ راجع الافتراضات قبل تسجيل السعر."}
        </small>
      </section>
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
        <LocalDateField
          id="agreement-delivery-date"
          label="موعد التسليم"
          value={deliveryDate}
          aria-invalid={hasFormError && !deliveryDate}
          aria-describedby={hasFormError ? "agreement-form-error" : undefined}
          onChange={event => setDeliveryDate(event.target.value)}
        />
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
            اسم الطلب <small>اختياري — تسمية تعرضها فوق اسم العمل</small>
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
            اسم الجهة <small>اختياري — الجهة تحدد لاحقًا من صفحة الطلب</small>
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
              لاحقًا من صفحة الطلب (اختيار جهة قائمة أو اسم جديد يصبح جهة عند تكراره).
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
        {message ? (
          <p id="agreement-form-error" className="micro-field-error" role="alert">
            {message}
          </p>
        ) : null}
        <div className="micro-form-actions micro-sticky-save">
          <button
            className="micro-button micro-button-primary micro-save-cost"
            type="button"
            disabled={isSaving}
            onClick={() => {
              void submit();
            }}
          >
            <Save aria-hidden="true" />
            {isSaving ? "جارٍ تسجيل الاتفاق…" : "تسجيل الاتفاق"}
          </button>
        </div>
      </section>
    </section>
  );
}
