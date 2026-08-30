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
};

function equalAgreementValues(left: AgreementFormValues | null, right: AgreementFormValues | null) {
  return Boolean(
    left &&
    right &&
    left.priceMinor === right.priceMinor &&
    left.deliveryDate === right.deliveryDate &&
    left.depositMinor === right.depositMinor &&
    left.source === right.source &&
    left.acknowledgesBelowFloor === right.acknowledgesBelowFloor,
  );
}

export default function AgreementEditor() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { drafts, costs, agreements, dataVersion, notifyDataChanged } = usePrototypeServices();
  const [draft, setDraft] = useState<OrderDraft | null>(null);
  const [priceMinor, setPriceMinor] = useState<number | null>(startAgreementPrice());
  const [deliveryDate, setDeliveryDate] = useState("");
  const [depositMinor, setDepositMinor] = useState<number | null>(null);
  const [source, setSource] = useState<AgreementSource | "">("");
  const [acknowledgesBelowFloor, setAcknowledgesBelowFloor] = useState(false);
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
      };
      setDraft(loaded);
      setPriceMinor(loadedValues.priceMinor);
      setDeliveryDate(loadedValues.deliveryDate);
      setDepositMinor(loadedValues.depositMinor);
      setSource(loadedValues.source);
      setAcknowledgesBelowFloor(loadedValues.acknowledgesBelowFloor);
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
  const currentValues = { priceMinor, deliveryDate, depositMinor, source, acknowledgesBelowFloor };
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
    const result = await agreements.createFromDraft(draft, {
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
        <p className="micro-deposit-truth">
          <CircleAlert aria-hidden="true" /> العربون كاش محصل مرتبط بالطلب، وليس ربحًا نهائيًا أو تسليمًا
          تلقائيًا.
        </p>
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
      </section>
    </section>
  );
}
