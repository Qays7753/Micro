/**
 * المجموعة ٣ (عقد D5): مراجعة التسليم — السطح الكامل قبل الالتزام. يعرض السعر
 * والمقبوض والعربون والمتبقي والتكلفة بحالتها، ويقترح استهلاك المواد المتتبَّعة
 * المرتبطة بالطلب بلا خصم خفي، ويسمح بقبض عند التسليم بوجهة محفظة صريحة،
 * ويطلب تأكيدًا واحدًا واضحًا قبل معاملة ذرّية واحدة. عكس التسليم له مساره
 * الموثق من صفحة الطلب.
 */
import { ArrowRight, CheckCircle2, PackageOpen, TriangleAlert, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { withFrom } from "@/app/navigationContract";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { EnglishQuantityInput } from "@/components/forms/EnglishQuantityInput";
import { useFormDirty } from "@/components/forms/useFormDirty";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { LocalDateValue, MoneyValue } from "@/components/presentation/DisplayValue";
import { formatMoneyMinor } from "@/presentation/formatters";
import type {
  DeliveryConsumptionAction,
  DeliveryReview,
} from "@/application/fulfillment/deliveryReviewService";

type PageState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; review: DeliveryReview }
  | {
      phase: "done";
      revenueMinor: number;
      movementsCount: number;
      shortagesCount: number;
      collectedMinor: number | null;
      notice: string | null;
    };

type RowChoice = { quantityMilli: number; action: DeliveryConsumptionAction };

const knowledgeLabel: Record<string, string> = {
  known: "معروفة",
  estimated: "تقديرية",
  partial: "جزئية",
  incomplete: "ناقصة",
  stale: "متقادمة",
  variable: "متغيرة",
};

const actionLabel: Record<DeliveryConsumptionAction, string> = {
  consume: "استهلاك كامل",
  consume_with_shortage: "استهلاك المتاح + توثيق النقص",
  record_shortage: "توثيق النقص فقط",
  skip: "بلا حركة كمية",
};

export default function DeliveryReviewPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const returnPath = useReturnPath("/orders");
  const { deliveryReview, cashContinuity, dataVersion, notifyDataChanged } = usePrototypeServices();

  const [state, setState] = useState<PageState>({ phase: "loading" });
  const [wallets, setWallets] = useState<readonly { id: string; name: string; kind: string }[]>([]);
  const [choices, setChoices] = useState<Record<string, RowChoice>>({});
  const [finalPriceMinor, setFinalPriceMinor] = useState<number>(0);
  const [priceReason, setPriceReason] = useState("");
  const [collectAmountMinor, setCollectAmountMinor] = useState<number>(0);
  const [walletId, setWalletId] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const idempotencyKeyRef = useRef(
    globalThis.crypto?.randomUUID?.() ?? `deliver-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  const orderId = params.id ?? "";

  useEffect(() => {
    let active = true;
    setState({ phase: "loading" });
    Promise.all([deliveryReview.buildReview(orderId), cashContinuity.overview()]).then(
      ([reviewResult, walletsResult]) => {
        if (!active) return;
        if (!reviewResult.ok) {
          setState({ phase: "error", message: reviewResult.message });
          return;
        }
        setState({ phase: "ready", review: reviewResult.value });
        setFinalPriceMinor(reviewResult.value.money.agreedPriceMinor);
        /* لا قبض مفترض: القبض عند التسليم اختيار صريح — فراغه الحالة الصادقة
         * (لم يُسجَّل قبض) لا «حصّلنا المتبقي تلقائيًا» على طريقة زمن. */
        setCollectAmountMinor(0);
        setChoices(
          Object.fromEntries(
            reviewResult.value.consumption.rows.map(row => [
              row.materialId,
              {
                quantityMilli: row.plannedQuantityMilli,
                action: row.suggestedAction,
              } satisfies RowChoice,
            ]),
          ),
        );
        if (walletsResult.ok) {
          setWallets(walletsResult.value.wallets);
          const drawer = walletsResult.value.wallets.find(wallet => wallet.kind === "cash_drawer");
          if (drawer) setWalletId(drawer.id);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [deliveryReview, cashContinuity, orderId, dataVersion]);

  const ready = state.phase === "ready" ? state.review : null;
  const priceChanged = ready !== null && finalPriceMinor !== ready.money.agreedPriceMinor;
  const collectPlanned =
    ready !== null && collectAmountMinor > 0 && collectAmountMinor <= ready.money.receivableMinor;

  const isDirty = useMemo(
    () =>
      state.phase === "ready" &&
      (priceChanged ||
        collectPlanned ||
        Object.values(choices).some(choice => choice.action === "skip" || choice.quantityMilli > 0)),
    [state.phase, priceChanged, collectPlanned, choices],
  );
  useFormDirty(
    [finalPriceMinor, priceReason, collectAmountMinor, walletId, choices],
    state.phase === "ready",
  );
  const requestNavigation = useUnsavedChangesGuard({ isDirty, onSave: () => submit() });

  async function submit(): Promise<boolean> {
    if (!ready) return false;
    if (priceChanged && !priceReason.trim()) {
      setMessage("أكمل سبب تعديل السعر عند التسليم قبل الحفظ.");
      return false;
    }
    if (collectAmountMinor > ready.money.receivableMinor) {
      setMessage("المقبوض عند التسليم لا يمكن أن يتجاوز المتبقي على الطلب.");
      return false;
    }
    setSubmitting(true);
    setMessage(null);
    const result = await deliveryReview.commitDelivery(orderId, {
      rows: Object.entries(choices).map(([materialId, choice]) => ({
        materialId,
        quantityMilli: choice.quantityMilli,
        action: choice.action,
      })),
      finalPriceMinor: priceChanged ? finalPriceMinor : null,
      priceRevisionReason: priceChanged ? priceReason.trim() : null,
      collectNow:
        collectAmountMinor > 0 ? { amountMinor: collectAmountMinor, walletId: walletId || null } : null,
      operationKey: idempotencyKeyRef.current,
    });
    setSubmitting(false);
    if (!result.ok) {
      setMessage(result.message);
      return false;
    }
    notifyDataChanged();
    setState({
      phase: "done",
      revenueMinor: result.value.stored.order.recognizedRevenueMinor,
      movementsCount: result.value.movements.length,
      shortagesCount: result.value.shortages.length,
      collectedMinor: collectAmountMinor > 0 ? collectAmountMinor : null,
      notice: result.value.notice,
    });
    return true;
  }

  const orderHref = withFrom(`/orders/${orderId}`, returnPath);

  return (
    <section className="micro-page micro-delivery-review-page">
      <button className="micro-back-button" type="button" onClick={() => requestNavigation(orderHref)}>
        <ArrowRight aria-hidden="true" /> تفاصيل الطلب
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">مراجعة قبل الالتزام</span>
        <h1>مراجعة التسليم</h1>
        {ready ? (
          <p>
            {ready.itemName} · {ready.customerName} · موعد التسليم{" "}
            <LocalDateValue value={ready.deliveryDate} />
          </p>
        ) : null}
      </div>

      {state.phase === "loading" ? <p className="micro-local-truth">جارٍ تحضير المراجعة…</p> : null}
      {state.phase === "error" ? <p className="micro-field-error">{state.message}</p> : null}

      {ready ? (
        <>
          {/* المال قبل الالتزام: سعر/مقبوض/عربون/متبقٍ/تكلفة بحالتها — لا رقم بلا معنى. */}
          <section className="micro-summary-grid" aria-label="مراجعة المال عند التسليم">
            <div>
              <span>السعر المتفق عليه (د.أ)</span>
              <strong>
                <MoneyValue minor={ready.money.agreedPriceMinor} />
              </strong>
            </div>
            <div>
              <span>المقبوض حتى الآن (د.أ)</span>
              <strong>
                <MoneyValue minor={ready.money.collectedMinor} />
              </strong>
            </div>
            <div>
              <span>منه عربون (د.أ)</span>
              <strong>
                <MoneyValue minor={ready.money.depositCollectedMinor} />
              </strong>
            </div>
            <div>
              <span>المتبقي على العميل (د.أ)</span>
              <strong>
                <MoneyValue minor={ready.money.receivableMinor} />
              </strong>
            </div>
            <div>
              <span>
                تكلفة النسخة ({knowledgeLabel[ready.money.knowledgeState] ?? ready.money.knowledgeState})
                (د.أ)
              </span>
              <strong>
                <MoneyValue minor={ready.money.snapshotCostMinor} />
              </strong>
            </div>
            <div>
              <span>الإيراد عند التأكيد (د.أ)</span>
              <strong>
                <MoneyValue minor={priceChanged ? finalPriceMinor : ready.money.agreedPriceMinor} />
              </strong>
            </div>
          </section>
          <p className="micro-local-truth">
            التأكيد يعترف بالإيراد مرة واحدة هنا؛ القبض ليس إيرادًا والعربون محسوب ضمن المقبوض.
          </p>

          {ready.warnings.length > 0 ? (
            <section className="micro-form-grid" aria-label="تنبيهات قبل التسليم">
              {ready.warnings.map(warning => (
                <p className="micro-cost-disclaimer" key={warning}>
                  <TriangleAlert aria-hidden="true" /> {warning}
                </p>
              ))}
            </section>
          ) : null}

          {/* المخزون المقترح: مواد متتبَّعة مرتبطة بالطلب فقط — لا خصم خفي. */}
          <section className="micro-delivery-consumption" aria-label="أثر المخزون عند التسليم">
            <h2>شو رح يتغير في المخزون؟</h2>
            {/* المجموعة ٤ (عقد ٢٩): إعلان الخصم التلقائي من القالب — علم صريح
             * يظهر هنا؛ الحركات تبقى داخل تأكيد واحد ذرّي لا تخصم عند الفتح. */}
            {ready.consumption.autoConsume ? (
              <p className="micro-local-truth">
                <Zap aria-hidden="true" /> خصم تلقائي مفعّل لهذا المنتج: الاقتراحات جاهزة ضمن تأكيد التسليم
                الواحد — بلا خطوة إضافية وبلا أثر عند فتح الصفحة.
              </p>
            ) : null}
            {ready.consumption.rows.length === 0 ? (
              <p className="micro-local-truth">
                <PackageOpen aria-hidden="true" /> لا مواد مرتبطة بهذا الطلب في المخزون — التسليم بلا أثر على
                الكميات.
              </p>
            ) : (
              <ul className="micro-consumption-rows">
                {ready.consumption.rows.map(row => {
                  const choice = choices[row.materialId] ?? {
                    quantityMilli: row.plannedQuantityMilli,
                    action: row.suggestedAction,
                  };
                  const planned = choice.quantityMilli / 1000;
                  return (
                    <li key={row.materialId} className="micro-consumption-row">
                      <div className="micro-consumption-head">
                        <strong>{row.materialName}</strong>
                        <span>
                          {row.tracked ? (
                            <>
                              المتاح: {(row.availableQuantityMilli / 1000).toFixed(3).replace(/\.?0+$/, "")}{" "}
                              {row.unitLabel} · تكلفة الرصيد:{" "}
                              {row.costKnowledge === "unknown"
                                ? "غير معروفة"
                                : row.costKnowledge === "partial"
                                  ? "جزئية"
                                  : "معروفة"}
                            </>
                          ) : (
                            "غير متتبَّعة — مرجع تكلفة فقط، لا حركة كمية"
                          )}
                        </span>
                      </div>
                      {row.tracked ? (
                        <div className="micro-consumption-controls">
                          <label className="micro-field">
                            <span>الكمية المستهلكة ({row.unitLabel})</span>
                            <EnglishQuantityInput
                              valueMilli={choice.quantityMilli}
                              onMilliChange={value =>
                                setChoices(current => ({
                                  ...current,
                                  [row.materialId]: { ...choice, quantityMilli: value },
                                }))
                              }
                              aria-label={`كمية استهلاك ${row.materialName}`}
                            />
                          </label>
                          <label className="micro-field">
                            <span>القرار</span>
                            <select
                              value={choice.action}
                              onChange={event =>
                                setChoices(current => ({
                                  ...current,
                                  [row.materialId]: {
                                    ...choice,
                                    action: event.target.value as DeliveryConsumptionAction,
                                  },
                                }))
                              }
                              aria-label={`قرار استهلاك ${row.materialName}`}
                            >
                              {(Object.keys(actionLabel) as DeliveryConsumptionAction[]).map(action => (
                                <option key={action} value={action}>
                                  {actionLabel[action]}
                                </option>
                              ))}
                            </select>
                          </label>
                          {choice.quantityMilli > row.availableQuantityMilli ? (
                            <p className="micro-cost-disclaimer">
                              <TriangleAlert aria-hidden="true" /> النقص المتوقع:{" "}
                              {((choice.quantityMilli - row.availableQuantityMilli) / 1000).toFixed(3)}{" "}
                              {row.unitLabel} — يُوثَّق نقصًا صريحًا ولا يصير الرصيد سالبًا.
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
            {ready.consumption.unlinkedItems.length > 0 ? (
              <details className="micro-additional-details">
                <summary className="micro-additional-details-summary">
                  <span>بنود تكلفة بلا مواد مخزون</span>
                  <small>{ready.consumption.unlinkedItems.length} بند</small>
                </summary>
                <div className="micro-additional-details-body">
                  <ul className="micro-unlinked-items">
                    {ready.consumption.unlinkedItems.map(item => (
                      <li key={item.name}>
                        {item.name} — {item.quantity} {item.unit} (تكلفة فقط، بلا حركة كمية)
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            ) : null}
          </section>

          {/* إفصاح تدريجي: تصحيح السعر والقبض عند التسليم — الافتراضي أبسط رحلة. */}
          <button
            className="micro-disclosure-button"
            type="button"
            onClick={() => setShowAdvanced(current => !current)}
          >
            {showAdvanced ? "إخفاء خيارات التسليم المتقدمة" : "خيارات متقدمة: تعديل السعر والقبض عند التسليم"}
          </button>
          {showAdvanced ? (
            <section className="micro-advanced-delivery" aria-label="خيارات التسليم المتقدمة">
              <label className="micro-field">
                <span>السعر النهائي عند التسليم (د.أ)</span>
                <EnglishNumberInput
                  value={finalPriceMinor}
                  kind="money"
                  onNumericChange={setFinalPriceMinor}
                  aria-label="السعر النهائي عند التسليم"
                />
              </label>
              {priceChanged ? (
                <>
                  <p className="micro-local-truth">
                    الفرق عن المتفق عليه:{" "}
                    {formatMoneyMinor(Math.abs(finalPriceMinor - ready.money.agreedPriceMinor))} د.أ — يُسجَّل
                    تصحيحًا موثقًا بسببه ويبقى الاتفاق الأصلي في الأحداث.
                  </p>
                  <label className="micro-field">
                    <span>سبب تعديل السعر</span>
                    <input
                      type="text"
                      value={priceReason}
                      onChange={event => setPriceReason(event.target.value)}
                      placeholder="مثال: أضاف الزبون طلبًا إضافيًا عند الاستلام"
                      aria-label="سبب تعديل السعر عند التسليم"
                    />
                  </label>
                </>
              ) : null}
              {ready.money.receivableMinor > 0 ? (
                <>
                  <label className="micro-field">
                    <span>قبض من المتبقي عند التسليم (د.أ)</span>
                    <EnglishNumberInput
                      value={collectAmountMinor}
                      kind="money"
                      onNumericChange={setCollectAmountMinor}
                      aria-label="المقبوض عند التسليم"
                    />
                  </label>
                  {collectPlanned ? (
                    <label className="micro-field">
                      <span>وجهة الكاش</span>
                      <select
                        value={walletId}
                        onChange={event => setWalletId(event.target.value)}
                        aria-label="وجهة كاش التسليم"
                      >
                        <option value="">غير موزع — يُوزَّع لاحقًا بقرار صريح</option>
                        {wallets.map(wallet => (
                          <option key={wallet.id} value={wallet.id}>
                            {wallet.name} (
                            {wallet.kind === "cash_drawer"
                              ? "درج"
                              : wallet.kind === "bank_account"
                                ? "حساب بنكي"
                                : wallet.kind === "digital_wallet"
                                  ? "محفظة رقمية"
                                  : "مكان كاش"}
                            )
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {collectAmountMinor > ready.money.receivableMinor ? (
                    <p className="micro-field-error">
                      المقبوض يتجاوز المتبقي ({formatMoneyMinor(ready.money.receivableMinor)} د.أ).
                    </p>
                  ) : null}
                </>
              ) : null}
            </section>
          ) : null}

          {message ? <p className="micro-field-error">{message}</p> : null}
          <div className="micro-form-actions">
            <button
              className="micro-button micro-button-primary"
              type="button"
              disabled={submitting}
              onClick={() => {
                void submit();
              }}
            >
              <CheckCircle2 aria-hidden="true" />
              {submitting ? "جارٍ تأكيد التسليم…" : "أكّد التسليم"}
            </button>
            <button
              className="micro-button micro-button-secondary"
              type="button"
              disabled={submitting}
              onClick={() => requestNavigation(orderHref)}
            >
              رجوع بلا تسليم
            </button>
          </div>
        </>
      ) : null}

      {state.phase === "done" ? (
        <section className="micro-delivery-done" aria-label="نتيجة التسليم">
          <h2>
            <CheckCircle2 aria-hidden="true" /> تم تسجيل التسليم
          </h2>
          <ul className="micro-done-facts">
            <li>
              الإيراد المعترف: <MoneyValue minor={state.revenueMinor} className="micro-inline-number" /> د.أ —
              مرة واحدة.
            </li>
            <li>حركات استهلاك مخزون: {state.movementsCount}.</li>
            <li>سجلات نقص موثقة: {state.shortagesCount}.</li>
            {state.collectedMinor !== null ? (
              <li>
                قُبض عند التسليم: <MoneyValue minor={state.collectedMinor} className="micro-inline-number" />{" "}
                د.أ — تحصيل لا إيراد.
              </li>
            ) : (
              <li>لم يُسجَّل قبض جديد عند التسليم.</li>
            )}
          </ul>
          {state.notice ? <p className="micro-cost-disclaimer">{state.notice}</p> : null}
          <div className="micro-form-actions">
            <button
              className="micro-button micro-button-primary"
              type="button"
              onClick={() => navigate(orderHref)}
            >
              فتح تفاصيل الطلب
            </button>
          </div>
        </section>
      ) : null}
    </section>
  );
}
