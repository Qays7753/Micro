/** Phone-first direct-sale form. It records a sale, never an order or inferred profit. */
/* X-06 (و٤): المتفق عن المقبوض — النظام ينبّه ولا يقرّر: ثلاثة خيارات والثالث صالح.
 * «خفّضتُ السعر» تخفيض موثَّق لا تعديلًا في مكانه، والأصل يبقى في السجل. */
import { ArrowRight, Ban, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { formatMoneyMinor, localDateInAmman } from "@/presentation/formatters";
import type {
  DirectSaleCollectionStatus,
  DirectSale,
} from "@micro-domain/direct-sale/index.js";
import type { CatalogItem } from "@micro-domain/catalog/index.js";

type DifferenceChoice = "price_cut" | "remaining_debt" | "needs_review";

const collectionStatusLabel: Record<DirectSaleCollectionStatus, string> = {
  collected_in_full: "مقبوض كامل",
  partial_debt: "الفرق دَين على العميل",
  partial_needs_review: "الفرق يحتاج مراجعة",
};

export default function DirectSaleEditor() {
  const [location, navigate] = useLocation();
  const { directSales, catalog, notifyDataChanged } = usePrototypeServices();
  const saleMatch = location.match(/^\/direct-sales\/([^/?]+)$/);
  const saleId = saleMatch?.[1] && saleMatch[1] !== "new" ? decodeURIComponent(saleMatch[1]) : null;
  const editing = saleId !== null;
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [validQuantity, setValidQuantity] = useState(true);
  const [revenueMinor, setRevenueMinor] = useState(0);
  const [validRevenue, setValidRevenue] = useState(true);
  /* X-06: المقبوض الآن — فارغ يعني قبضًا كاملًا. */
  const [collectedMinor, setCollectedMinor] = useState(0);
  const [collectedEmpty, setCollectedEmpty] = useState(true);
  const [validCollected, setValidCollected] = useState(true);
  const [costKnown, setCostKnown] = useState(false);
  const [costMinor, setCostMinor] = useState(0);
  const [validCost, setValidCost] = useState(true);
  const [catalogItemId, setCatalogItemId] = useState("");
  const [references, setReferences] = useState<readonly CatalogItem[]>([]);
  const [occurredOn, setOccurredOn] = useState(() => localDateInAmman());
  const [note, setNote] = useState("بيع مباشر");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingSale, setLoadingSale] = useState(editing);
  const [savedSale, setSavedSale] = useState<DirectSale | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  /* و٦: إعادة تحميل السجل عند اكتشاف تعديل من نافذة أخرى. */
  const [reloadToken, setReloadToken] = useState(0);
  /* و٦: عند إعادة التحميل بعد تعارض تبقى كتابة المستخدم في الحقول كما هي —
   * يُحدّث السجل ورقم مراجعاته لا ما يراه في النموذج. */
  const preserveFormRef = useRef(false);
  /* X-06: لوحة الفرق — تظهر عند حفظ بيع قبضه أقل من سعره المتفق، ولا تقرّر مكانه. */
  const [differenceChoice, setDifferenceChoice] = useState<DifferenceChoice | null>(null);
  const idempotencyKey = useRef(`direct-sale-ui-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);
  const correctionIdempotencyKey = useRef(
    `direct-sale-correction-ui-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
  );
  const cancellationIdempotencyKey = useRef(
    `direct-sale-cancellation-ui-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
  );

  useEffect(() => {
    catalog.list().then(result => {
      if (result.ok) setReferences(result.items);
    });
  }, [catalog]);

  useEffect(() => {
    if (!saleId) return;
    let active = true;
    setLoadingSale(true);
    void directSales.get(saleId).then(result => {
      if (!active) return;
      setLoadingSale(false);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      if (!result.value) {
        setMessage("بيع مباشر غير موجود؛ لم يتغير شيء.");
        return;
      }
      const sale = result.value;
      setSavedSale(sale);
      if (preserveFormRef.current) {
        preserveFormRef.current = false;
        return;
      }
      setItemName(sale.itemName);
      setQuantity(sale.quantity);
      setRevenueMinor(sale.revenueMinor);
      if (sale.collectedMinor === sale.revenueMinor) {
        setCollectedEmpty(true);
        setCollectedMinor(sale.revenueMinor);
      } else {
        setCollectedEmpty(false);
        setCollectedMinor(sale.collectedMinor);
      }
      setCostKnown(sale.costMinor !== null);
      setCostMinor(sale.costMinor ?? 0);
      setCatalogItemId(sale.catalogItemId ?? "");
      setOccurredOn(sale.occurredOn);
      setNote(sale.note);
      if (sale.collectionStatus === "partial_debt") setDifferenceChoice("remaining_debt");
      else if (sale.collectionStatus === "partial_needs_review") setDifferenceChoice("needs_review");
    });
    return () => {
      active = false;
    };
  }, [directSales, saleId, reloadToken]);

  /* المقبوض المحسوب: فارغ = السعر المتفق (قبض كامل). */
  const resolvedCollected = collectedEmpty ? revenueMinor : collectedMinor;
  const difference = revenueMinor - resolvedCollected;

  async function save() {
    if (savedSale?.status === "cancelled") {
      setMessage("هذا البيع ملغى ولا يمكن تعديله.");
      return;
    }
    if (
      !note.trim() ||
      !validQuantity ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      !validRevenue ||
      revenueMinor <= 0 ||
      !validCollected ||
      !Number.isInteger(resolvedCollected) ||
      resolvedCollected < 0 ||
      (costKnown && (!validCost || costMinor < 0))
    ) {
      setMessage("أدخل المبلغ والكمية بالأرقام 0–9 قبل الحفظ — المبلغ هو الحقل الإلزامي الوحيد.");
      return;
    }
    if (resolvedCollected > revenueMinor) {
      setMessage("المقبوض لا يتجاوز السعر المتفق عليه — سجّل فرقك قرارًا في التسعير لا في القبض.");
      return;
    }
    /* X-06: النظام ينبّه ولا يقرّر — الفرق يوقف الحفظ ويعرض الخيارات الثلاثة. */
    if (difference > 0 && differenceChoice === null) {
      setMessage("at_difference_prompt");
      return;
    }
    const priceCutChosen = difference > 0 && differenceChoice === "price_cut";
    const status: DirectSaleCollectionStatus =
      difference > 0
        ? differenceChoice === "remaining_debt"
          ? "partial_debt"
          : differenceChoice === "needs_review"
            ? "partial_needs_review"
            : "collected_in_full"
        : "collected_in_full";
    /* و٦: رقم المراجعة الذي فُتح عليه السجل — يحرس من طمس تعديل أحدث من نافذة أخرى. */
    const openedRevisionCount = savedSale?.revisions?.length ?? 0;
    setMessage(null);
    setSaving(true);
    const result = editing
      ? await directSales.update(saleId!, {
          itemName: itemName.trim() || "بيع نقدي",
          quantity,
          /* «خفّضتُ السعر» على تعديل قائم: السعر يهبط إلى المقبوض، والمراجعة تحمل الأصل. */
          revenueMinor: priceCutChosen ? resolvedCollected : revenueMinor,
          collectedMinor: resolvedCollected,
          collectionStatus: priceCutChosen ? "collected_in_full" : status,
          catalogItemId: catalogItemId || null,
          costMinor: costKnown ? costMinor : null,
          occurredOn,
          note,
          idempotencyKey: correctionIdempotencyKey.current,
          expectedRevisionCount: openedRevisionCount,
        })
      : await directSales.record({
          itemName: itemName.trim() || "بيع نقدي",
          quantity,
          revenueMinor,
          collectedMinor: resolvedCollected,
          collectionStatus: priceCutChosen ? undefined : status,
          catalogItemId: catalogItemId || null,
          costMinor: costKnown ? costMinor : null,
          occurredOn,
          note,
          idempotencyKey: idempotencyKey.current,
          priceCut: priceCutChosen,
        });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      /* و٦: عند التعارض يتحدّث السجل ورقم مراجعاته وتبقى كتابة المستخدم كما هي. */
      if (result.code === "conflict") {
        preserveFormRef.current = true;
        setReloadToken(token => token + 1);
      }
      return;
    }
    notifyDataChanged();
    navigate("/orders");
  }

  async function cancel() {
    if (!saleId || !cancelReason.trim()) {
      setMessage("اكتب سبب الإلغاء قبل تأكيده.");
      return;
    }
    setMessage(null);
    setSaving(true);
    const result = await directSales.cancel(
      saleId,
      cancelReason,
      cancellationIdempotencyKey.current,
      savedSale?.revisions?.length ?? 0,
    );
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      if (result.code === "conflict") {
        preserveFormRef.current = true;
        setReloadToken(token => token + 1);
      }
      return;
    }
    notifyDataChanged();
    navigate("/orders");
  }

  if (editing && loadingSale)
    return (
      <div className="micro-route-loading" role="status">
        جارٍ تحميل البيع المباشر…
      </div>
    );

  const showDifferencePrompt = message === "at_difference_prompt" && difference > 0;

  return (
    <section className="micro-page micro-finance-page">
      <button className="micro-back-button" type="button" onClick={() => navigate("/orders")}>
        <ArrowRight aria-hidden="true" /> العمل
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">سجل بيع مستقل</span>
        <h1>{editing ? "تصحيح بيع مباشر" : "تسجيل بيع مباشر"}</h1>
        <p>
          {editing
            ? "صحح البيانات التي أدخلتها مع إبقاء البيع مستقلًا عن الطلبات. لا يُحذف السجل عند إلغائه."
            : "سجّل ما بعته وقيمته من دون إنشاء طلب. المبلغ هو الحقل الإلزامي الوحيد، وما عداه اختياري."}
        </p>
      </div>
      <section className="micro-decision-card">
        <div>
          <span>حد الحقيقة</span>
          <strong>التحصيل ليس ربحًا.</strong>
          <p>إذا لم تعرف التكلفة الآن، سيظهر الربح «غير متاح» بدل أن يفترضه النظام صفرًا.</p>
        </div>
      </section>
      {savedSale?.status === "cancelled" ? (
        <section className="micro-decision-card" data-tone="warning" role="status">
          <div>
            <span>حالة السجل</span>
            <strong>هذا البيع ملغى.</strong>
            <p>{savedSale.cancellationReason ?? "لا يوجد سبب مسجل."} — بقي السجل محفوظًا لأثر المراجعة.</p>
          </div>
        </section>
      ) : null}
      {savedSale && savedSale.revisions?.length ? (
        <section className="micro-decision-card" data-tone="warning" role="status">
          <div>
            <span>سجل التصحيحات</span>
            <strong>الأصل يبقى في السجل.</strong>
            <ul className="micro-direct-sale-revisions">
              {savedSale.revisions.map(revision => (
                <li key={revision.idempotencyKey}>
                  {revision.kind === "price_cut" ? "خفّضتُ السعر" : revision.kind === "cancel" ? "إلغاء" : "تعديل"}
                  {revision.beforeRevenueMinor != null
                    ? ` — السعر الأصلي: ${formatMoneyMinor(revision.beforeRevenueMinor)} د.أ`
                    : ""}
                  {revision.reason ? ` · ${revision.reason}` : ""}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
      <section className="micro-form-card">
        <fieldset disabled={savedSale?.status === "cancelled"} style={{ border: 0, padding: 0, margin: 0 }}>
        <label className="micro-field">
          <span>
            ما الذي بعته؟ <small>اختياري</small>
          </span>
          <input value={itemName} onChange={event => setItemName(event.target.value)} placeholder="مثال: كوب جاهز" />
        </label>
        <label className="micro-field">
          <span>الكمية</span>
          <EnglishNumberInput
            value={quantity}
            kind="integer"
            onNumericChange={setQuantity}
            onTextValidityChange={setValidQuantity}
            aria-label="الكمية"
          />
        </label>
        <label className="micro-field">
          <span>السعر المتفق عليه بالدينار الأردني</span>
          <EnglishNumberInput
            value={revenueMinor}
            kind="money"
            onNumericChange={setRevenueMinor}
            onTextValidityChange={setValidRevenue}
            aria-label="السعر المتفق عليه"
          />
        </label>
        <label className="micro-field">
          <span>
            ما قبضت الآن بالدينار الأردني <small>اتركه فارغًا إذا قبضت كامل السعر</small>
          </span>
          <EnglishNumberInput
            value={collectedMinor}
            kind="money"
            onNumericChange={value => {
              setCollectedMinor(value);
              setCollectedEmpty(false);
            }}
            onTextValidityChange={setValidCollected}
            allowEmpty
            onEmptyChange={() => setCollectedEmpty(true)}
            aria-label="ما قبضت الآن"
          />
          {validCollected && difference > 0 ? (
            <small>الفرق: {formatMoneyMinor(difference)} د.أ — عند الحفظ يسألك النظام عن قرارك ولا يقرّر عنك.</small>
          ) : null}
        </label>
        <label className="micro-field">
          <span>هل تعرف تكلفة ما بيع؟</span>
          <select value={costKnown ? "known" : "unknown"} onChange={event => setCostKnown(event.target.value === "known")}>
            <option value="unknown">لا أعرف الآن</option>
            <option value="known">نعم، أعرفها</option>
          </select>
          <small>عدم المعرفة يبقى معلومة ناقصة، ولا يسجل تكلفة صفرية.</small>
        </label>
        {costKnown ? (
          <label className="micro-field">
            <span>التكلفة بالدينار الأردني</span>
            <EnglishNumberInput
              value={costMinor}
              kind="money"
              onNumericChange={setCostMinor}
              onTextValidityChange={setValidCost}
              aria-label="تكلفة البيع"
            />
          </label>
        ) : null}
        <label className="micro-field">
          <span>
            ربط مرجع <small>اختياري — من «منتجاتي وخدماتي»</small>
          </span>
          <select value={catalogItemId} onChange={event => setCatalogItemId(event.target.value)}>
            <option value="">لا أربط هذا البيع بمرجع الآن</option>
            {references.map(reference => (
              <option key={reference.id} value={reference.id}>
                {reference.name}
              </option>
            ))}
          </select>
          <small>الربط لا يغيّر السعر ولا يفرض الكتالوج؛ من لا يستعمل المراجع يبيع كاملًا.</small>
        </label>
        <LocalDateField label="تاريخ البيع" value={occurredOn} onChange={event => setOccurredOn(event.target.value)} />
        <label className="micro-field">
          <span>بيان مختصر</span>
          <textarea value={note} onChange={event => setNote(event.target.value)} />
        </label>
        {savedSale?.collectionStatus ? (
          <p className="micro-save-note" role="status">
            حالة القبض الحالية: {collectionStatusLabel[savedSale.collectionStatus]}
            {savedSale.collectionStatus !== "collected_in_full" &&
            savedSale.revenueMinor > savedSale.collectedMinor
              ? ` — الفرق ${formatMoneyMinor(savedSale.revenueMinor - savedSale.collectedMinor)} د.أ.`
              : ""}
          </p>
        ) : null}
        {message && !showDifferencePrompt ? (
          <p className="micro-field-error" role="status">
            {message}
          </p>
        ) : null}
        {/* X-06 (و٤): «اتفقتَ على ١٠ وقبضتَ ٨ — الفرق ٢ دينار» — ثلاثة خيارات، والثالث صالح. */}
        {showDifferencePrompt ? (
          <section className="micro-difference-panel" aria-label="قرار الفرق بين المتفق والمقبوض">
            <strong>
              اتفقتَ على {formatMoneyMinor(revenueMinor)} وقبضتَ {formatMoneyMinor(resolvedCollected)} — الفرق{" "}
              {formatMoneyMinor(difference)} دينار.
            </strong>
            <p>النظام لا يقرّر عنك — اختر ما حدث فعلًا:</p>
            <label className="micro-radio-choice">
              <input
                type="radio"
                name="difference-choice"
                checked={differenceChoice === "price_cut"}
                onChange={() => setDifferenceChoice("price_cut")}
              />
              <span>
                <b>خفّضتُ السعر</b>
                <small>البيع يصير {formatMoneyMinor(resolvedCollected)} د.أ — لا دَين ولا تتبّع، ويسجَّل تخفيضًا موثَّقًا يحفظ السعر الأصلي.</small>
              </span>
            </label>
            <label className="micro-radio-choice">
              <input
                type="radio"
                name="difference-choice"
                checked={differenceChoice === "remaining_debt"}
                onChange={() => setDifferenceChoice("remaining_debt")}
              />
              <span>
                <b>الباقي عليه</b>
                <small>الـ{formatMoneyMinor(difference)} د.أ تظهر في «لي عند العملاء» حتى تحصّلها.</small>
              </span>
            </label>
            <label className="micro-radio-choice">
              <input
                type="radio"
                name="difference-choice"
                checked={differenceChoice === "needs_review"}
                onChange={() => setDifferenceChoice("needs_review")}
              />
              <span>
                <b>يحتاج مراجعة</b>
                <small>لم يُقرَّر بعد — خيار صالح لا خطأ، والفرق يبقى معلَّقًا على البيع حتى تحسمه.</small>
              </span>
            </label>
            <button
              className="micro-button micro-button-primary"
              type="button"
              disabled={saving || differenceChoice === null}
              onClick={() => {
                void save();
              }}
            >
              {saving ? "جارٍ الحفظ…" : "أكمل الحفظ بالقرار المختار"}
            </button>
          </section>
        ) : (
          <button className="micro-button micro-button-primary micro-save-cost" type="button" disabled={saving} onClick={save}>
            <Save aria-hidden="true" />
            {saving ? "جارٍ الحفظ…" : editing ? "حفظ تصحيح البيع" : "حفظ البيع المباشر"}
          </button>
        )}
        </fieldset>
      </section>
      {editing && savedSale?.status !== "cancelled" ? (
        <section className="micro-danger-zone" aria-labelledby="direct-sale-cancel-title">
          <div className="micro-section-heading">
            <Ban aria-hidden="true" />
            <div>
              <span className="micro-overline">تصحيح لا يحذف السجل</span>
              <h2 id="direct-sale-cancel-title">إلغاء البيع</h2>
            </div>
          </div>
          {!cancelOpen ? (
            <button className="micro-button micro-button-danger" type="button" onClick={() => setCancelOpen(true)}>
              إظهار تأكيد الإلغاء
            </button>
          ) : (
            <>
              <p>سيبقى البيع ظاهرًا في «مبيعاتي» بحالة ملغى، ولن يُحذف بصمت.</p>
              <label className="micro-field">
                <span>سبب الإلغاء</span>
                <textarea
                  value={cancelReason}
                  onChange={event => setCancelReason(event.target.value)}
                  placeholder="مثال: أُدخل المبلغ بالخطأ"
                />
              </label>
              <div className="micro-form-actions">
                <button className="micro-button micro-button-danger" type="button" disabled={saving} onClick={cancel}>
                  تأكيد إلغاء البيع
                </button>
                <button className="micro-button micro-button-secondary" type="button" disabled={saving} onClick={() => setCancelOpen(false)}>
                  إبقاء البيع
                </button>
              </div>
            </>
          )}
        </section>
      ) : null}
    </section>
  );
}
