/** Phone-first direct-sale form. It records a sale, never an order or inferred profit. */
/* X-06 (و٤): المتفق عن المقبوض — النظام ينبّه ولا يقرّر: ثلاثة خيارات والثالث صالح.
 * «خفّضتُ السعر» تخفيض موثَّق لا تعديلًا في مكانه، والأصل يبقى في السجل. */
import { ArrowRight, Ban, ReceiptText, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { withFrom } from "@/app/navigationContract";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { useFormDirty } from "@/components/forms/useFormDirty";
import { formatMoneyMinor, localDateInAmman } from "@/presentation/formatters";
import type {
  DirectSaleCollectionStatus,
  DirectSale,
} from "@micro-domain/direct-sale/index.js";
import { directSaleOutstandingMinor } from "@micro-domain/direct-sale/index.js";
import type { CatalogItem } from "@micro-domain/catalog/index.js";

type DifferenceChoice = "price_cut" | "remaining_debt" | "needs_review";

const collectionStatusLabel: Record<DirectSaleCollectionStatus, string> = {
  collected_in_full: "مقبوض كامل",
  partial_debt: "الفرق دَين على العميل",
  partial_needs_review: "الفرق يحتاج مراجعة",
};

/* المجموعة ٣ (Scope D — §10.1): معامل سياق السجل ?product=<id> — يصل من زر
 * «سجّل بيع هذا المنتج» في الكتالوج؛ يعبّئ المرجع واقتراحاته المعلنة مرة واحدة،
 * والسعر الفعلي يبقى بيد المالك (P-002). غير الصالح يُهمل بهدوء كإخوته.
 * (و٥-ب): يُقرأ من useSearch — المسار الحقيقي يصل بلا استعلام.) */
function productParamFromSearch(search: string): string | null {
  const value = new URLSearchParams(search).get("product");
  return value && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : null;
}

type SaleDone = {
  sale: DirectSale;
  walletName: string | null;
  attributedMinor: number;
};

export default function DirectSaleEditor() {
  const [location, navigate] = useLocation();
  /* و٥-ب (مجموعة ٣): معامل المنتج يُقرأ من useSearch — المسار الحقيقي بلا استعلام. */
  const search = useSearch();
  /* المجموعة ١ (Scope A): الرجوع والخروج بعد النجاح يعودان للمصدر (?from) لا لهدف ثابت. */
  const returnPath = useReturnPath();
  const { directSales, catalog, projectFinance, cashContinuity, notifyDataChanged } =
    usePrototypeServices();
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
  /* D-001: زبون البيع الآجل حقل مستقل — يظهر حيث يوجد دين أو زبون مسجل. */
  const [customerName, setCustomerName] = useState("");
  const [catalogItemId, setCatalogItemId] = useState("");
  const [references, setReferences] = useState<readonly CatalogItem[]>([]);
  /* P-002: المرجع المختار الآن — لعرض الاقتراحات المعلّمة لا لتقرير السعر. */
  const [suggestedReference, setSuggestedReference] = useState<CatalogItem | null>(null);
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
  /* المجموعة ٣ (Scope D — §10.4): إغلاق واقعي بعد التسجيل — ما بيع، السعر الفعلي،
   * أثر الكاش/الذمة، وصل السجل، والرجوع للمصدر؛ شاشة نتيجة لا تُطمس. */
  const [done, setDone] = useState<SaleDone | null>(null);
  /* المجموعة ٣ (Scope D): وجهة القبض الصريحة عند الإنشاء — الدرج افتراضيًا حين
   * يوجد، وغير الموزع خيار معلن؛ النسبة تتم بعد نجاح التسجيل بمسار المجموعة ٢ نفسه. */
  const [wallets, setWallets] = useState<readonly { id: string; name: string }[]>([]);
  const [saleWalletId, setSaleWalletId] = useState("");
  const [productNotice, setProductNotice] = useState<string | null>(null);
  const appliedProductRef = useRef(false);
  /* U-005 (دورة التدقيق النهائي): لقطة القيم الأولية تُلتقط بعد تحميل السجل
   * (loadedToken) لا عند التركيب فقط — حماية المدخلات غير المحفوظة في محرر
   * البيع المباشر نفسه، وهو الحالة المسماة في توحيد تنقّل التفاصيل. */
  const [loadedToken, setLoadedToken] = useState(0);
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
    catalog
      .list({ includeInactive: true })
      .then(result => {
        if (!result.ok) return;
        setReferences(result.items);
        /* المجموعة ٣ (§10.1): الوصلة العميقة للمنتج تُطبق مرة واحدة عند الإنشاء —
         * المرجع الموقوف لا يُعبّأ (إشعار صادق)، والمحذوف يُهمل بهدوء. */
        const requestedProduct =
          !editing && !appliedProductRef.current ? productParamFromSearch(search) : null;
        if (!requestedProduct) return;
        appliedProductRef.current = true;
        const selected = result.items.find(item => item.id === requestedProduct) ?? null;
        if (!selected) return;
        if (!selected.active) {
          setProductNotice("هذا المرجع موقوف — سُجّل البيع بلا ربط أو فعّله من الكتالوج.");
          return;
        }
        setCatalogItemId(selected.id);
        if (!itemName.trim() || result.items.some(reference => reference.name === itemName.trim()))
          setItemName(selected.name);
        if (selected.defaultPriceMinor != null && revenueMinor === 0 && quantity === 1)
          setRevenueMinor(selected.defaultPriceMinor);
        if (selected.defaultUnitCostMinor != null && quantity === 1 && !costKnown) {
          setCostKnown(true);
          setCostMinor(selected.defaultUnitCostMinor);
        }
        setSuggestedReference(selected);
        /* فحص حي (مجموعة ٣): التعبئة المقترحة «قيم محمّلة» لا كتابة مستخدم —
         * تُعاد لقطة الوسخ بعدها فلا يعترض الخروج الصامت بمستخدم لم يكتب شيئًا. */
        setLoadedToken(token => token + 1);
      })
      .catch(() => setReferences([]));
  }, [catalog]);

  /* المجموعة ٣ (Scope D): محافظ القبض تُقرأ عند الإنشاء فقط — التعديل لا يحرك الكاش. */
  useEffect(() => {
    if (editing) return;
    let active = true;
    cashContinuity
      .overview()
      .then(result => {
        if (!active || !result.ok) return;
        setWallets(result.value.wallets.map(wallet => ({ id: wallet.id, name: wallet.name })));
        const drawer = result.value.wallets.find(wallet => wallet.kind === "cash_drawer");
        setSaleWalletId(current => current || drawer?.id || "");
      })
      .catch(() => setWallets([]));
    return () => {
      active = false;
    };
  }, [cashContinuity, editing]);

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
      setCustomerName(sale.customerName ?? "");
      setCatalogItemId(sale.catalogItemId ?? "");
      setOccurredOn(sale.occurredOn);
      setNote(sale.note);
      if (sale.collectionStatus === "partial_debt") setDifferenceChoice("remaining_debt");
      else if (sale.collectionStatus === "partial_needs_review") setDifferenceChoice("needs_review");
      /* اللقطة الأولية تُعاد التقاطها مع القيم المحمّلة في نفس الدفعة. */
      setLoadedToken(token => token + 1);
    });
    return () => {
      active = false;
    };
  }, [directSales, saleId, reloadToken]);

  /* المقبوض المحسوب: فارغ = السعر المتفق (قبض كامل). */
  const resolvedCollected = collectedEmpty ? revenueMinor : collectedMinor;
  const difference = revenueMinor - resolvedCollected;
  /* U-005 (دورة التدقيق النهائي): حماية المدخلات غير المحفوظة — زر الرجوع والمتصفح
   * كلاهما يمران بالحارس: «ابقَ / احفظ ثم اخرج / اخرج بلا حفظ». */
  const isDirty = useFormDirty(
    [
      itemName,
      quantity,
      revenueMinor,
      collectedEmpty,
      collectedMinor,
      costKnown,
      costMinor,
      customerName,
      catalogItemId,
      occurredOn,
      note,
      differenceChoice,
    ],
    loadedToken,
  );
  const requestNavigation = useUnsavedChangesGuard({ isDirty, onSave: () => save() });

  async function save(): Promise<boolean> {
    if (savedSale?.status === "cancelled") {
      setMessage("هذا البيع ملغى ولا يمكن تعديله.");
      return false;
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
      return false;
    }
    if (resolvedCollected > revenueMinor) {
      setMessage("المقبوض لا يتجاوز السعر المتفق عليه — سجّل فرقك قرارًا في التسعير لا في القبض.");
      return false;
    }
    /* X-06: النظام ينبّه ولا يقرّر — الفرق يوقف الحفظ ويعرض الخيارات الثلاثة. */
    if (difference > 0 && differenceChoice === null) {
      setMessage("at_difference_prompt");
      return false;
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
          customerName: customerName.trim() || null,
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
          customerName: customerName.trim() || null,
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
      return false;
    }
    notifyDataChanged();
    /* التعديل يخرج لمصدره كما كان — لا شاشة نتيجة لسجل قائم. */
    if (editing) {
      navigate(returnPath);
      return true;
    }
    /* المجموعة ٣ (Scope D): تخصيص صريح بعد التسجيل — نفس مسار المجموعة ٢
     * (distributeUnallocated) بمفتاح عملية مشتق من مفتاح الإرسال نفسه؛
     * إعادة المحاولة أو الضغط المكرر لا يكرر التخصيص. */
    let walletName: string | null = null;
    let attributedMinor = 0;
    if (saleWalletId && resolvedCollected > 0) {
      const attribution = await projectFinance.distributeUnallocated({
        walletId: saleWalletId,
        deltaMinor: resolvedCollected,
        note: "تخصيص قبض بيع من محرر البيع",
        operationKey: `${idempotencyKey.current}:attribute`,
        sourceRefId: result.value.id,
        sourceRefKind: "sale",
      });
      if (attribution.ok) {
        walletName = wallets.find(wallet => wallet.id === saleWalletId)?.name ?? null;
        attributedMinor = resolvedCollected;
      } else {
        /* البيع سُجل والقبض محفوظ — الفشل في النسبة لا يفقد المال؛ يُعرض السبب. */
        setMessage(attribution.message);
      }
    }
    /* نجاح محلي مكتمل: يُعاد ضبط لقطة الوسخ فلا يعترض الخروج من شاشة النتيجة. */
    setLoadedToken(token => token + 1);
    setDone({ sale: result.value, walletName, attributedMinor });
    return true;
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
      return false;
    }
    notifyDataChanged();
    navigate(returnPath);
    return true;
  }

  if (editing && loadingSale)
    return (
      <div className="micro-route-loading" role="status">
        جارٍ تحميل البيع المباشر…
      </div>
    );

  /* المجموعة ٣ (§10.4): إغلاق واقعي بعد التسجيل — ما بيع والسعر الفعلي وأثر
   * الكاش/الذمة ووصل السجل والرجوع للمصدر؛ الرقم من السجل المُرجع نفسه. */
  if (done && !editing) {
    const sale = done.sale;
    const reference = references.find(item => item.id === sale.catalogItemId) ?? null;
    const outstandingMinor = directSaleOutstandingMinor(sale);
    return (
      <section className="micro-page micro-finance-page">
        <div className="micro-page-heading">
          <span className="micro-overline">بيع مباشر · انسجّل</span>
          <h1>سُجّل البيع</h1>
        </div>
        <section className="micro-decision-card" aria-label="نتيجة البيع">
          <span>ما تم بيعه</span>
          <strong>
            {sale.itemName}
            {sale.quantity > 1 ? ` ×${sale.quantity}` : ""}
          </strong>
          <p>
            السعر الفعلي: {formatMoneyMinor(sale.revenueMinor)} د.أ · قُبض الآن:{" "}
            {formatMoneyMinor(sale.collectedMinor)} د.أ
          </p>
          <p>
            {outstandingMinor > 0
              ? sale.collectionStatus === "partial_debt"
                ? `دين على ${sale.customerName ?? "الزبون"}: ${formatMoneyMinor(outstandingMinor)} د.أ — يظهر في «لي عند العملاء» ودفتر الناس.`
                : `فرق معلّق للمراجعة: ${formatMoneyMinor(outstandingMinor)} د.أ — لم يُقرّر بعد.`
              : "قُبض المبلغ كاملًا — لا دين من هذا البيع."}
          </p>
          <p>
            {done.attributedMinor > 0
              ? `نُسب القبض إلى «${done.walletName ?? "المحفظة"}»: ${formatMoneyMinor(done.attributedMinor)} د.أ — حركة موثقة في دفتر المحفظة.`
              : "بقي القبض في الكاش غير الموزع — وزّعه على محفظة عندما تعرف وجهته."}
          </p>
          {reference ? <p>مرجع مرتبط: {reference.name} — الربط للتوثيق فقط.</p> : null}
          <p className="micro-local-truth">سُجل محليًا على هذا الجهاز — الضغط مرتين لا يضاعف أثرًا.</p>
        </section>
        <div className="micro-form-actions">
          <button
            className="micro-button micro-button-primary"
            type="button"
            onClick={() =>
              requestNavigation(
                withFrom(`/direct-sales/${encodeURIComponent(sale.id)}`, returnPath),
              )
            }
          >
            <ReceiptText aria-hidden="true" /> افتح السجل
          </button>
          <button
            className="micro-button micro-button-secondary"
            type="button"
            onClick={() => requestNavigation(returnPath)}
          >
            تم
          </button>
        </div>
      </section>
    );
  }

  const showDifferencePrompt = message === "at_difference_prompt" && difference > 0;

  return (
    <section className="micro-page micro-finance-page">
      <button
        className="micro-back-button"
        type="button"
        onClick={() => requestNavigation(returnPath)}
      >
        <ArrowRight aria-hidden="true" /> {returnPath === "/orders" ? "العمل" : "رجوع"}
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
          {/* بند ٢٥ (قرارات المالك): دلالة الكمية معلنة — الكمية توثيق، والسعر إجمالي
              البيع كاملًا لا سعر القطعة؛ لا يضرب النظام عنك ولا يخمّن. */}
          <small>
            عدد القطع في هذا البيع — للتوثيق. السعر الذي تدخله أدناه هو إجمالي البيع كاملًا، لا سعر
            القطعة الواحدة.
          </small>
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
          <select
            value={catalogItemId}
            aria-label="ربط مرجع"
            onChange={event => {
              const selectedId = event.target.value;
              setCatalogItemId(selectedId);
              const selected = references.find(
                candidate => candidate.id === selectedId && candidate.active,
              );
              if (!editing) {
                /* P-002 (الخيار أ): اختيار مرجع يعبّئ اسمه واقتراحاته كمقترح معلن
                 * قابل للتعديل — والسعر الفعلي هو ما تؤكده أنت عند الحفظ.
                 * لا نعبّئ شيئًا في وضع التعديل: قيم البيع المسجّلة هي الحقيقة. */
                if (selected) {
                  if (!itemName.trim() || references.some(ref => ref.name === itemName.trim()))
                    setItemName(selected.name);
                  if (selected.defaultPriceMinor != null && revenueMinor === 0 && quantity === 1)
                    setRevenueMinor(selected.defaultPriceMinor);
                  if (selected.defaultUnitCostMinor != null && quantity === 1 && !costKnown) {
                    setCostKnown(true);
                    setCostMinor(selected.defaultUnitCostMinor);
                  }
                }
                setSuggestedReference(selected ?? null);
              }
            }}
          >
            <option value="">لا أربط هذا البيع بمرجع الآن</option>
            {references
              .filter(reference => reference.active || reference.id === catalogItemId)
              .map(reference => (
                <option key={reference.id} value={reference.id}>
                  {reference.name}
                  {reference.active ? "" : " · مرجع موقوف"}
                </option>
              ))}
          </select>
          {!editing ? (
            <small>
              {suggestedReference
                ? suggestedReference.defaultPriceMinor != null
                  ? quantity > 1
                    ? `الاقتراح المسجّل سعرٌ للقطعة الواحدة (${formatMoneyMinor(
                        suggestedReference.defaultPriceMinor,
                      )} د.أ)؛ مع كمية أكبر من ١ لا يُعبّأ تلقائيًا — اضرب بنفسك وأدخل الإجمالي الفعلي.`
                    : `سعر مقترح من المرجع: ${formatMoneyMinor(
                        suggestedReference.defaultPriceMinor,
                      )} د.أ — عدّله ليصير السعر الفعلي لهذا البيع.`
                  : "هذا المرجع بلا سعر افتراضي مسجّل — السعر الفعلي ما تدخله بنفسك."
                : "اختيار مرجع يعبّئ الاسم والاقتراحات فقط؛ لا يفرض سعرًا ولا يحسب مخزونًا."}
            </small>
          ) : (
            <small>الربط لا يغيّر السعر ولا التكلفة المسجّلين؛ البيع يحتفظ بنسخته وقت حفظه.</small>
          )}
        </label>
        {suggestedReference && suggestedReference.defaultUnitCostMinor != null && !editing ? (
          <p className="micro-save-note" role="status">
            تكلفة مقترحة من المرجع: {formatMoneyMinor(suggestedReference.defaultUnitCostMinor)} د.أ — نسخة
            تُحفظ مع هذا البيع وحده؛ عدّلها أو اختر «لا أعرف الآن» فتبقى التكلفة مجهولة بصدق.
          </p>
        ) : null}
        {productNotice ? (
          <p className="micro-save-note" role="status">
            {productNotice}
          </p>
        ) : null}
        {/* D-001: الزبون حقل مستقل — يظهر عند وجود دين أو زبون مسجل، ويجتمع باسمه في دفتر الناس. */}
        {difference > 0 || customerName.trim() !== "" ? (
          <label className="micro-field">
            <span>اسم الزبون</span>
            <input
              value={customerName}
              onChange={event => setCustomerName(event.target.value)}
              aria-label="اسم الزبون"
            />
          </label>
        ) : null}
        {/* المجموعة ٣ (Scope D — §10.1): وجهة القبض الصريحة عند الإنشاء — الدرج افتراضيًا
            حين يوجد وغير الموزع خيار معلن؛ لا تخصيص صامت ولا محفظة تُختار نيابةً عن المالك. */}
        {!editing && wallets.length > 0 ? (
          <label className="micro-field">
            <span>
              وجهة القبض <small>الدرج افتراضيًا حين يوجد — غير الموزع خيار صريح</small>
            </span>
            <select
              value={saleWalletId}
              onChange={event => setSaleWalletId(event.target.value)}
              aria-label="وجهة القبض"
            >
              <option value="">غير موزع — يبقى هنا حتى توزّعه بقرار</option>
              {wallets.map(wallet => (
                <option key={wallet.id} value={wallet.id}>
                  {wallet.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
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
              {formatMoneyMinor(difference)} د.أ.
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
          <div className="micro-form-actions micro-sticky-save">
            <button className="micro-button micro-button-primary micro-save-cost" type="button" disabled={saving} onClick={save}>
            <Save aria-hidden="true" />
            {saving ? "جارٍ الحفظ…" : editing ? "حفظ تصحيح البيع" : "حفظ البيع المباشر"}
          </button>
          </div>
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
