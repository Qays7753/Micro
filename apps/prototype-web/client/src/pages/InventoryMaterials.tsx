/** Style: Micro decision path — stock is an explainable material fact, never an implied profit report. */
import {
  ArrowLeft,
  Boxes,
  CircleMinus,
  PackageMinus,
  PackagePlus,
  Plus,
  RotateCcw,
  Scissors,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { withFrom } from "@/app/navigationContract";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type { InventoryShortage, InventoryMovement } from "@micro-domain/inventory-material/index.js";
import type {
  InventoryActivationState,
  InventoryMaterialOverview,
  InventoryOverview,
} from "@/application/inventory/inventoryMaterialService";
import { LocalDateValue, MoneyValue, QuantityValue } from "@/components/presentation/DisplayValue";
import { localDateInAmman, formatArabicPlural, formatMoneyMinor } from "@/presentation/formatters";
import { savedMovementCountLabel } from "@/presentation/plurals";
const label = (type: InventoryMovement["type"]) =>
  ({
    opening: "رصيد مادة بداية",
    purchase_receipt: "استلام شراء",
    consumption: "استهلاك مادة",
    waste: "هدر مادة",
    adjustment: "ضبط مادة",
    reversal: "تراجع عن حركة",
  })[type];
const unitWord = (unit: string) =>
  unit === "piece"
    ? "قطعة"
    : unit === "meter"
      ? "متر"
      : unit === "kilogram"
        ? "كيلوغرام"
        : unit === "liter"
          ? "لتر"
          : "وحدة أخرى";
type State =
  | { phase: "loading" }
  | { phase: "error" }
  | {
      phase: "ready";
      overview: InventoryOverview;
      movements: readonly InventoryMovement[];
      shortages: readonly InventoryShortage[];
      activation: InventoryActivationState;
    };
/* القرار ٢٠: تأكيد إخراج الفاقد يعرض القيمة كاملة ويبيّن أن الفعل تسجيل هدر — قبل التنفيذ وبعده. */
type ExtractionDraft = {
  materialId: string;
  materialName: string;
  quantityMilli: number;
  valueMinor: number;
};
/* المجموعة ٢ (عقد ٢٨): إيقاف المتابعة — حوار عواقب معلنة، لا حذف ولا تحويل مجهول إلى صفر. */
type UntrackDraft = InventoryMaterialOverview;
export default function InventoryMaterials() {
  const [, navigate] = useLocation();
  /* S1-10: الرجوع للمصدر (?from) مع بديل قانوني ثابت (عقد ٢٦ §٢.٢). */
  const returnPath = useReturnPath();
  const { inventory, dataVersion, notifyDataChanged } = usePrototypeServices();
  const [state, setState] = useState<State>({ phase: "loading" });
  const [activating, setActivating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  /* القرار ٢٠: حالة إخراج الفاقد — مسودة الفعل وسببه ومفتاح العملية. */
  const [extraction, setExtraction] = useState<ExtractionDraft | null>(null);
  const [extractionReason, setExtractionReason] = useState("");
  const [extracting, setExtracting] = useState(false);
  /* المجموعة ٢ (عقد ٢٨): حالة إيقاف/إعادة المتابعة وحل النقص. */
  const [untrackTarget, setUntrackTarget] = useState<UntrackDraft | null>(null);
  const [trackingBusy, setTrackingBusy] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const operationKeyRef = useRef(`inventory-activation-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);
  const extractionKeyRef = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    Promise.all([
      inventory.overview(),
      inventory.movements(),
      inventory.shortages(),
      inventory.readActivation(),
    ]).then(([overview, movements, shortages, activation]) => {
      if (!active) return;
      if (!overview.ok || !movements.ok || !shortages.ok || !activation.ok) {
        setState({ phase: "error" });
        return;
      }
      setState({
        phase: "ready",
        overview: overview.value,
        movements: movements.value,
        shortages: shortages.value,
        activation: activation.value,
      });
    });
    return () => {
      active = false;
    };
  }, [inventory, dataVersion]);
  /* القرار ٩: تفعيل صريح بتاريخ اليوم — لحظة معلنة تُعرض، والرصيد يومها يكفي. */
  async function activateInventory() {
    setActivating(true);
    const result = await inventory.activate({ operationKey: operationKeyRef.current });
    setActivating(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    notifyDataChanged();
    setMessage(`تم تفعيل المخزون بتاريخ ${result.value.activatedOn} — اللحظة معلنة في السجل.`);
  }
  /* القرار ٢٠ (عقد ١١ المعدّل): إخراج الفاقد — حركة هدر بقيمة المتبقي كاملة، لا حذف.
   * الإشعار قبل التأكيد وبعده يبيّن أن المالك يسجّل هدرًا وبأي قيمة. */
  async function confirmExtraction() {
    if (!extraction) return;
    const reason = extractionReason.trim();
    if (!reason) {
      setMessage("اكتب سبب الإخراج قبل تأكيده — سبب الهدر مطلوب كالعادة.");
      return;
    }
    if (!extractionKeyRef.current)
      extractionKeyRef.current = `inventory-extract-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
    setExtracting(true);
    const result = await inventory.extractRemainder({
      materialId: extraction.materialId,
      occurredOn: localDateInAmman(),
      reason,
      operationKey: extractionKeyRef.current,
    });
    setExtracting(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    notifyDataChanged();
    setExtraction(null);
    setExtractionReason("");
    extractionKeyRef.current = null;
    setMessage(
      "سُجّل إخراج الفاقد — أنت سجّلت هدرًا: كامل المتبقي انتقل إلى الهدر بقيمته، ومخزون المادة صفر صادق. السجل محفوظ ولا يُحذف.",
    );
  }
  /* المجموعة ٢ (عقد ٢٨): إيقاف المتابعة — الحركات كلها تبقى، والرصيد يجمَّد في السجل. */
  async function confirmUntrack() {
    if (!untrackTarget) return;
    setTrackingBusy(true);
    const result = await inventory.untrackMaterial({
      materialId: untrackTarget.id,
      reason: null,
      operationKey: `inventory-untrack-${untrackTarget.id}-${Date.now()}`,
    });
    setTrackingBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    notifyDataChanged();
    setUntrackTarget(null);
    setMessage("أُوقفت المتابعة — الحركات محفوظة وإعادة التفعيل متاحة لاحقًا.");
  }
  async function retrack(material: InventoryMaterialOverview) {
    setTrackingBusy(true);
    const result = await inventory.retrackMaterial({
      materialId: material.id,
      operationKey: `inventory-retrack-${material.id}-${Date.now()}`,
    });
    setTrackingBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    notifyDataChanged();
    setMessage(
      "عادت المتابعة — رصيد المادة «غير محدد بعد» حتى تؤكده من جديد؛ أكّده ليعود رقمًا موثوقًا.",
    );
  }
  /* المجموعة ٢ (عقد ٢٨ / D-027): حل النقص صريح — بيان الحل يُطلب وقت التنفيذ. */
  async function confirmResolve(shortage: InventoryShortage) {
    if (!resolutionNote.trim()) {
      setMessage("اكتب بيان الحل — مثال: استلمت بديلًا من المورد.");
      return;
    }
    setTrackingBusy(true);
    const result = await inventory.resolveShortage({
      shortageId: shortage.id,
      resolutionNote: resolutionNote.trim(),
      resolvedOn: localDateInAmman(),
    });
    setTrackingBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    notifyDataChanged();
    setResolvingId(null);
    setResolutionNote("");
    setMessage("حُلّ سجل النقص — توثيق الحل محفوظ مع السجل الأصلي، ولا شيء حُذف.");
  }
  if (state.phase === "loading")
    return (
      <div className="micro-route-loading" role="status">
        جارٍ قراءة المواد المحلية…
      </div>
    );
  if (state.phase === "error")
    return (
      <section className="micro-page micro-not-found">
        <h1>تعذر قراءة المواد</h1>
        <p>لم يتغير أي سجل. أعد فتح التطبيق للمحاولة.</p>
        <button
          className="micro-button micro-button-primary"
          type="button"
          onClick={() => navigate(withFrom("/finance", "/inventory"))}
        >
          مالي
        </button>
      </section>
    );
  const tracked = state.overview.materials.filter(
    material => !material.tracking || material.tracking.status === "tracked",
  );
  const untracked = state.overview.materials.filter(material => material.tracking?.status === "untracked");
  const materialCountLabel = formatArabicPlural(tracked.length, {
    zero: "لا مواد متتبَّعة بعد",
    one: "مادة واحدة متتبَّعة",
    two: "مادتان متتبَّعتان",
    few: "مواد متتبَّعة",
    many: "مادة متتبَّعة",
    other: "مادة متتبَّعة",
  });
  const notActivated = state.activation.activatedOn === null;
  const reversedMovementIds = new Set(
    state.movements
      .filter(movement => movement.type === "reversal" && movement.reversesMovementId)
      .map(movement => movement.reversesMovementId),
  );
  return (
    <section className="micro-page micro-finance-page">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        <ArrowLeft aria-hidden="true" /> {returnPath === "/finance" ? "مالي" : "رجوع"}
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">مخزون بسيط</span>
        <h1>المواد والمخزون</h1>
        <p>سجّل ما يتوفر فعلًا، ثم اربط الاستهلاك أو الهدر بحدث واضح. شراء المواد لا يصبح تكلفة بيع هنا.</p>
      </div>
      {message ? (
        <p className="micro-save-note" role="status">
          {message}
        </p>
      ) : null}
      {/* القرار ٩ + §٢.٨: قبل التفعيل الموضع غير نشط معلنًا — لا بوابة، والتفعيل بتاريخ اليوم. */}
      {notActivated ? (
        <section className="micro-inventory-inactive" aria-labelledby="inventory-inactive-title">
          <SlidersHorizontal aria-hidden="true" />
          <div>
            <span className="micro-overline">موضع غير نشط</span>
            <h2 id="inventory-inactive-title">المخزون غير مفعّل</h2>
            <p>
              تفعيله يغيّر أرقام التكلفة: من لحظة التفعيل تدخل حركات المواد شبكة المصادر. لقطة رصيد يوم
              التفعيل تكفي — لا يُطلب استيراد تاريخ سابق.
            </p>
          </div>
          <button
            className="micro-button micro-button-primary"
            type="button"
            disabled={activating}
            onClick={() => {
              void activateInventory();
            }}
          >
            {activating ? "جارٍ التفعيل…" : "تفعيل بتاريخ اليوم"}
          </button>
        </section>
      ) : (
        <section className="micro-decision-card">
          <SlidersHorizontal aria-hidden="true" />
          <div>
            <span>حد الحقيقة · القيم (د.أ)</span>
            <strong>
              {state.activation.source === "declared" ? "مُدار بتفعيل صريح منذ " : "مُدار من "}
              <LocalDateValue value={state.activation.activatedOn ?? ""} />
            </strong>
          </div>
        </section>
      )}
      {/* مبدأ Micro: أفعال المادة لا تظهر كأنها متاحة قبل وجود مادة مسجلة. */}
      <div className="micro-cash-actions">
        <button
          className="micro-button micro-button-primary"
          type="button"
          onClick={() => navigate(withFrom("/inventory/material/new", "/inventory"))}
        >
          <Plus aria-hidden="true" /> مادة جديدة
        </button>
        {tracked.length ? (
          <button
            className="micro-button micro-button-secondary"
            type="button"
            onClick={() => navigate(withFrom("/inventory/movement/receipt", "/inventory"))}
          >
            <PackagePlus aria-hidden="true" /> استلام شراء
          </button>
        ) : (
          <div className="micro-later-action" role="status">
            <strong>استلام شراء — لاحقًا</strong>
            <small>أضف مادة أولًا.</small>
          </div>
        )}
      </div>
      <div className="micro-cash-actions">
        {tracked.length ? (
          <>
            <button
              className="micro-button micro-button-secondary"
              type="button"
              onClick={() => navigate(withFrom("/inventory/movement/consume", "/inventory"))}
            >
              <Scissors aria-hidden="true" /> استهلاك أو استلام نقص
            </button>
            <button
              className="micro-button micro-button-secondary"
              type="button"
              onClick={() => navigate(withFrom("/inventory/movement/waste", "/inventory"))}
            >
              <CircleMinus aria-hidden="true" /> هدر أو ضبط
            </button>
          </>
        ) : (
          <div className="micro-later-action" role="status">
            <strong>الاستهلاك والهدر — لاحقًا</strong>
            <small>أضف مادة وفعّل متابعتها أولًا حتى تختار سجلًا حقيقيًا.</small>
          </div>
        )}
      </div>
      <section className="micro-supplier-list">
        <div className="micro-finance-event-heading">
          <span className="micro-overline">المتاح الآن</span>
          <h2>{materialCountLabel}</h2>
        </div>
        {tracked.length ? (
          tracked.map(material => {
            const shortagesForMaterial = state.shortages.filter(
              shortage => shortage.materialId === material.id,
            );
            const openShortages = shortagesForMaterial.filter(shortage => shortage.status === "open");
            const unconfirmed = material.quantityKnowledge === "unconfirmed";
            return (
              <article key={material.id} data-testid={`tracked-material-${material.name}`}>
                <div>
                  <strong>
                    <Boxes aria-hidden="true" /> {material.name}
                  </strong>
                  <small>
                    {unitWord(material.unit)} · {savedMovementCountLabel(material.movementCount)}
                    {material.awaitingReceiptPurchaseCount > 0
                      ? ` · بانتظار الاستلام: ${formatMoneyMinor(material.awaitingReceiptRemainingMinor)} د.أ من ${material.awaitingReceiptPurchaseCount} شراء`
                      : ""}
                  </small>
                  <div className="micro-material-knowledge">
                    {openShortages.length > 0 ? (
                      <span className="micro-status-chip" data-status="warn">
                        نقص مفتوح: {openShortages.length}
                      </span>
                    ) : null}
                    {unconfirmed ? (
                      <span className="micro-status-chip" data-status="warn">
                        غير محدد بعد
                      </span>
                    ) : null}
                    {material.costKnowledge === "unknown" ? (
                      <small>التكلفة غير معروفة</small>
                    ) : material.costKnowledge === "partial" ? (
                      <small>تكلفة معروفة جزئيًا</small>
                    ) : null}
                    {material.opening?.quantityState === "confirmed" && material.opening?.quantityMilli === 0 ? (
                      <small>صفر مؤكد</small>
                    ) : null}
                    {unconfirmed && material.movementCount > 0 ? (
                      <small>الكمية من الحركات فقط — رصيد البداية غير محدد بعد</small>
                    ) : null}
                  </div>
                </div>
                <div className="micro-supplier-balance">
                  <b>
                    {unconfirmed && material.movementCount === 0 ? (
                      <span className="micro-unknown-value">—</span>
                    ) : (
                      <QuantityValue valueMilli={material.quantityMilli} />
                    )}
                  </b>
                  <small>
                    <MoneyValue minor={material.valueMinor} className="micro-inline-number" />
                  </small>
                  {unconfirmed ? (
                    <button
                      className="micro-button micro-button-quiet"
                      type="button"
                      onClick={() =>
                        navigate(
                          withFrom(`/inventory/material/${encodeURIComponent(material.id)}/confirm`, "/inventory"),
                        )
                      }
                    >
                      أكّد الرصيد
                    </button>
                  ) : material.quantityMilli > 0 ? (
                    <button
                      className="micro-button micro-button-quiet"
                      type="button"
                      onClick={() => {
                        extractionKeyRef.current = null;
                        setExtractionReason("");
                        setExtraction({
                          materialId: material.id,
                          materialName: material.name,
                          quantityMilli: material.quantityMilli,
                          valueMinor: material.valueMinor,
                        });
                      }}
                    >
                      <PackageMinus aria-hidden="true" /> أخرِج المتبقي
                    </button>
                  ) : null}
                  <button
                    className="micro-text-action"
                    type="button"
                    onClick={() => setUntrackTarget(material)}
                  >
                    أوقف المتابعة
                  </button>
                </div>
                {shortagesForMaterial.length > 0 ? (
                  <details className="micro-shortage-details" data-testid={`shortage-details-${material.name}`}>
                    <summary>
                      نقص مفتوح: {openShortages.length} سجل
                      {shortagesForMaterial.length !== openShortages.length
                        ? ` (من أصل ${shortagesForMaterial.length})`
                        : ""}
                    </summary>
                    {shortagesForMaterial.map(shortage => (
                      <div key={shortage.id} className="micro-shortage-record">
                        <div>
                          <strong>
                            طُلب <QuantityValue valueMilli={shortage.requestedQuantityMilli} /> · المتاح كان{" "}
                            <QuantityValue valueMilli={shortage.availableQuantityMilli} /> · النقص{" "}
                            <QuantityValue valueMilli={shortage.shortageQuantityMilli} />
                          </strong>
                          <small>
                            <LocalDateValue value={shortage.occurredOn} /> · {shortage.note}
                            {shortage.status === "resolved" ? (
                              <>
                                {" · حُلّ بتاريخ "}
                                <LocalDateValue value={shortage.resolvedOn ?? ""} /> — {shortage.resolutionNote}
                              </>
                            ) : (
                              ""
                            )}
                          </small>
                        </div>
                        {shortage.status === "open" ? (
                          resolvingId === shortage.id ? (
                            <div className="micro-shortage-resolve">
                              <label className="micro-field">
                                <span>بيان الحل</span>
                                <input
                                  value={resolutionNote}
                                  onChange={event => setResolutionNote(event.target.value)}
                                  placeholder="مثال: استلمت بديلًا من المورد"
                                />
                              </label>
                              <div className="micro-form-actions">
                                <button
                                  className="micro-button micro-button-primary"
                                  type="button"
                                  disabled={trackingBusy}
                                  onClick={() => {
                                    void confirmResolve(shortage);
                                  }}
                                >
                                  سجّل الحل
                                </button>
                                <button
                                  className="micro-button micro-button-secondary"
                                  type="button"
                                  onClick={() => {
                                    setResolvingId(null);
                                    setResolutionNote("");
                                  }}
                                >
                                  إلغاء
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              className="micro-button micro-button-quiet"
                              type="button"
                              onClick={() => {
                                setResolvingId(shortage.id);
                                setResolutionNote("");
                              }}
                            >
                              سجّل الحل
                            </button>
                          )
                        ) : null}
                      </div>
                    ))}
                  </details>
                ) : null}
              </article>
            );
          })
        ) : (
          <p>
            لا مواد متتبَّعة بعد — أضف مادة واختر متابعة كميتها. لا يفرض Micro المخزون على الخدمة.
          </p>
        )}
      </section>
      {untracked.length > 0 ? (
        <section className="micro-supplier-list">
          <div className="micro-finance-event-heading">
            <span className="micro-overline">للتكلفة فقط</span>
            <h2>
              {formatArabicPlural(untracked.length, {
                zero: "",
                one: "مادة واحدة",
                two: "مادتان",
                few: "مواد",
                many: "مادة",
                other: "مادة",
              })}
            </h2>
          </div>
          {untracked.map(material => (
            <article key={material.id} data-testid={`untracked-material-${material.name}`}>
              <div>
                <strong>
                  <Boxes aria-hidden="true" /> {material.name}
                </strong>
                <small>
                  {unitWord(material.unit)} · {savedMovementCountLabel(material.movementCount)} · للتكلفة فقط
                </small>
              </div>
              <div className="micro-supplier-balance">
                <b>
                  <span className="micro-unknown-value">—</span>
                </b>
                <small>بلا رصيد متبع</small>
                <button
                  className="micro-text-action"
                  type="button"
                  disabled={trackingBusy}
                  onClick={() => {
                    void retrack(material);
                  }}
                >
                  فعّل المتابعة
                </button>
              </div>
            </article>
          ))}
        </section>
      ) : null}
      {/* المجموعة ٢ (عقد ٢٨): إيقاف المتابعة — عواقب معلنة قبل القرار، وإلغاء آمن. */}
      {untrackTarget ? (
        <section className="micro-danger-zone" aria-labelledby="untrack-title" data-testid="untrack-dialog">
          <div className="micro-section-heading">
            <SlidersHorizontal aria-hidden="true" />
            <div>
              <span className="micro-overline">أنت توقف المتابعة</span>
              <h2 id="untrack-title">أوقف متابعة {untrackTarget.name}</h2>
            </div>
          </div>
          <p>
            الرصيد الحالي:{" "}
            <QuantityValue valueMilli={untrackTarget.quantityMilli} className="micro-inline-number" /> · القيمة:{" "}
            <MoneyValue minor={untrackTarget.valueMinor} className="micro-inline-number" /> د.أ ·{" "}
            {savedMovementCountLabel(untrackTarget.movementCount)}
            {untrackTarget.costKnowledge === "unknown" ? " · التكلفة غير معروفة" : ""}
          </p>
          <ul className="micro-consequence-list">
            <li>تبقى كل الحركات محفوظة في سجل الحركات — لا يُحذف شيء.</li>
            <li>لن تظهر المادة في نماذج الاستلام والاستهلاك والهدر.</li>
            <li>تبقى المشتريات المرتبطة بها مرتبطة كما هي.</li>
            <li>يمكنك إعادة التفعيل لاحقًا — ويعود رصيدها «غير محدد بعد» حتى تؤكده من جديد.</li>
          </ul>
          <div className="micro-form-actions">
            <button
              className="micro-button micro-button-danger"
              type="button"
              disabled={trackingBusy}
              onClick={() => {
                void confirmUntrack();
              }}
            >
              {trackingBusy ? "جارٍ الإيقاف…" : "أوقف المتابعة"}
            </button>
            <button
              className="micro-button micro-button-secondary"
              type="button"
              disabled={trackingBusy}
              onClick={() => setUntrackTarget(null)}
            >
              إلغاء
            </button>
          </div>
        </section>
      ) : null}
      {/* القرار ٢٠: تأكيد إخراج الفاقد — يعرض الكمية والقيمة كاملة ويبيّن أن الفعل تسجيل هدر. */}
      {extraction ? (
        <section className="micro-danger-zone" aria-labelledby="inventory-extract-title">
          <div className="micro-section-heading">
            <PackageMinus aria-hidden="true" />
            <div>
              <span className="micro-overline">أنت تسجّل هدرًا</span>
              <h2 id="inventory-extract-title">أخرِج المتبقي: {extraction.materialName}</h2>
            </div>
          </div>
          <p>
            سيُسجَّل <strong>هدر</strong> بكمية{" "}
            <QuantityValue valueMilli={extraction.quantityMilli} className="micro-inline-number" /> وقيمته
            كاملة <MoneyValue minor={extraction.valueMinor} className="micro-inline-number" /> د.أ — لا حذف
            ولا شطبًا بلا أثر. يصير مخزون المادة بعدها صفرًا صادقًا والقيمة تظهر في الهدر. القدرة عامة: إن كانت
            المادة تلفت كلها فهذا بابها أيضًا.
          </p>
          <label className="micro-field">
            <span>سبب الإخراج</span>
            <textarea
              value={extractionReason}
              onChange={event => setExtractionReason(event.target.value)}
              placeholder="مثال: فتات لا يمكن استعماله، أو مادة تلفت"
            />
          </label>
          <div className="micro-form-actions">
            <button
              className="micro-button micro-button-danger"
              type="button"
              disabled={extracting}
              onClick={() => {
                void confirmExtraction();
              }}
            >
              {extracting ? "جارٍ التسجيل…" : "أكّد إخراج الفاقد"}
            </button>
            <button
              className="micro-button micro-button-secondary"
              type="button"
              disabled={extracting}
              onClick={() => {
                setExtraction(null);
                setExtractionReason("");
                extractionKeyRef.current = null;
              }}
            >
              إلغاء
            </button>
          </div>
        </section>
      ) : null}
      {state.movements.length ? (
        <section className="micro-supplier-list micro-cash-history">
          <div className="micro-finance-event-heading">
            <span className="micro-overline">أحدث الحركات</span>
            <h2>سجل لا يحذف بصمت</h2>
          </div>
          {state.movements.slice(0, 8).map(movement => {
            const reversed = reversedMovementIds.has(movement.id);
            return (
              <article key={movement.id}>
                <div>
                  <strong>{label(movement.type)}</strong>
                  <small>
                    <LocalDateValue value={movement.occurredOn} /> · {movement.note}
                    {movement.reason ? ` · السبب: ${movement.reason}` : ""}
                    {reversed ? " · مرتدة موثقًا" : ""}
                  </small>
                </div>
                <div className="micro-supplier-balance">
                  <b>
                    <QuantityValue valueMilli={movement.quantityDeltaMilli} className="micro-inline-number" />
                  </b>
                  <small>
                    <MoneyValue minor={movement.valueDeltaMinor} showPlus className="micro-inline-number" />
                  </small>
                  {movement.type !== "reversal" && !reversed ? (
                    <button
                      className="micro-button micro-button-quiet"
                      type="button"
                      onClick={() => navigate(withFrom(`/inventory/movement/${movement.id}/reverse`, "/inventory"))}
                    >
                      <RotateCcw aria-hidden="true" /> تراجع
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      ) : null}
    </section>
  );
}
