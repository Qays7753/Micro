/** Phone-first direct-sale form. It records a sale, never an order or inferred profit. */
/* X-06 (و٤): المتفق عن المقبوض — النظام ينبّه ولا يقرّر: ثلاثة خيارات والثالث صالح.
 * «خفّضتُ السعر» تخفيض موثَّق لا تعديلًا في مكانه، والأصل يبقى في السجل. */
import { ArrowRight, Ban, ReceiptText, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { withReturnTo } from "@/app/navigationContract";
import { saleDonePartialAttributionNote } from "@/app/resultFeedback";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { useDisabledCapabilities } from "@/app/useDisabledCapabilities";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { useFormDirty } from "@/components/forms/useFormDirty";
import { FormDraftRestoreBanner } from "@/components/forms/FormDraftRestoreBanner";
import { useFormDraft } from "@/components/forms/useFormDraft";
import { SaleCollectionReversalSection } from "@/components/direct-sales/SaleCollectionReversalSection";
import { formatLocalDate, formatMoneyMinor, localDateInAmman } from "@/presentation/formatters";
import type { DirectSaleCollectionStatus, DirectSale } from "@micro-domain/direct-sale/index.js";
import {
  directSaleOutstandingMinor,
  directSaleRefundOutstandingMinor,
} from "@micro-domain/direct-sale/index.js";
import type { CatalogItem } from "@micro-domain/catalog/index.js";
/* R7/R6-F17-P07 (2026-10-10): قرار المحرر النقي (بوابة التحقق/قرار الفرق
 * X-06/تعيين المرجع من الوصلة/خريطة السجل المحمّل) من بيته التطبيقي —
 * استيراد عميق موثق بأساس (لا باب لبيت direct-sales بعد). */
import {
  directSalePreviewParts,
  directSaleToFormValues,
  effectiveDifferenceChoice,
  paymentModeFromDraft,
  proposeProductParam,
  resolveCollectedForMode,
  resolveDifferenceOutcome,
  validateDirectSaleSubmission,
  type DifferenceChoice,
  type PaymentMode,
} from "@/application/direct-sales/directSaleEditorModel";

import { Button, FeedbackNote } from "@/components/primitives";
import { todayInAmman } from "@/application/time";

const collectionStatusLabel: Record<DirectSaleCollectionStatus, string> = {
  collected_in_full: "مقبوض كامل",
  partial_debt: "الفرق دَين على العميل",
  partial_needs_review: "الفرق يحتاج مراجعة",
  /* S11 (UNIT-005/PD-02): الحق المتبقي أُلغي بالمرتجع — وصف صادق للحالة. */
  returned_full: "مُرتجع كاملًا — الحق أُلغي",
};

type SaleDone = {
  sale: DirectSale;
  walletName: string | null;
  attributedMinor: number;
  /* Z2.3 (§3.4 — Partial Success): سبب فشل الخطوة التابعة (نسبة المحفظة)
   * بعد بيع سُجل — يُعرض على شاشة النتيجة مفصولًا عن المنجز؛ null عند
   * نجاح النسبة أو عدم وجود وجهة أصلًا. */
  attributionFailure: string | null;
};

export default function DirectSaleEditor() {
  const [location, navigate] = useLocation();
  /* و٥-ب (مجموعة ٣): معامل المنتج يُقرأ من useSearch — المسار الحقيقي بلا استعلام. */
  const search = useSearch();
  /* المجموعة ١ (Scope A): الرجوع والخروج بعد النجاح يعودان للمصدر (?from) لا لهدف ثابت. */
  const returnPath = useReturnPath();
  const {
    directSales,
    /* S11: حركات البيع (المرتجع الكامل ودفع الرد) تُحمَّل كسولًا فوق
     * المخزن نفسه بعد الإقلاع — مثل خدمات النقل والأطراف. */
    saleMovements,
    catalog,
    projectFinance,
    cashContinuity,
    saleCollectionReversal,
    partyDirectory,
    dataVersion,
    notifyDataChanged,
    formDrafts,
  } = usePrototypeServices();
  /* G-004: المخزون متوقف عن الإدخال — وصلة استهلاك مواد البيع تختفي؛
   * البيع نفسه وقراءته كما هما. */
  const { disabled: disabledCapabilities } = useDisabledCapabilities();
  const inventoryEntryEnabled = !disabledCapabilities.includes("inventory");
  const saleMatch = location.match(/^\/direct-sales\/([^/?]+)$/);
  const saleId = saleMatch?.[1] && saleMatch[1] !== "new" ? decodeURIComponent(saleMatch[1]) : null;
  const editing = saleId !== null;
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [validQuantity, setValidQuantity] = useState(true);
  const [revenueMinor, setRevenueMinor] = useState(0);
  const [validRevenue, setValidRevenue] = useState(true);
  /* S11-MR-001 (UNIT-005 A2/س2 + B3-F02): وضع الدفع الصريح — الكامل مقترح
   * ظاهرًا؛ الجزء يكشف المبلغ، و«لم أستلم» صفرٌ صريح باختيار المالك؛
   * الفراغ لم يعد يُفسّر قبضًا كاملًا ولا صفرًا (المعنى يأتي من الوضع). */
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("full");
  /* X-06: مبلغ الجزء — يُفحص عند حفظ الوضع الجزئي وحده. */
  const [collectedMinor, setCollectedMinor] = useState(0);
  const [collectedEmpty, setCollectedEmpty] = useState(true);
  const [validCollected, setValidCollected] = useState(true);
  /* S11-MR-001: مسودة ما قبل الأوضاع استُعادت بفرق لم يُحسم باتفاق صريح —
   * قرار معناه يظل مطلوبًا قبل الحفظ (لا يُمنح دينًا بصمت). */
  const [undecidedDifference, setUndecidedDifference] = useState(false);
  const [differentCaseOpen, setDifferentCaseOpen] = useState(false);
  const [costKnown, setCostKnown] = useState(false);
  const [costMinor, setCostMinor] = useState(0);
  const [validCost, setValidCost] = useState(true);
  /* D-001: زبون البيع الآجل حقل مستقل — يظهر حيث يوجد دين أو زبون مسجل.
   * S05 (DOC-014 / UNIT-037 A1/A2): تعريف بسيط أو اختيار محفوظ صريح —
   * كتابة الاسم تعريف على هذه العملية، وربط المحفوظ يثبّت لقطة تسميته
   * على المصدر، و«حفظه لإعادة الاستخدام» خيار غير محدد مسبقًا. */
  const [customerName, setCustomerName] = useState("");
  const [customerPartyId, setCustomerPartyId] = useState<string | null>(null);
  const [saveForReuse, setSaveForReuse] = useState(false);
  const [partyOptions, setPartyOptions] = useState<readonly { id: string; label: string }[]>([]);
  const [partySaveFailure, setPartySaveFailure] = useState<{ label: string; message: string } | null>(null);
  const [catalogItemId, setCatalogItemId] = useState("");
  const [references, setReferences] = useState<readonly CatalogItem[]>([]);
  /* P-002: المرجع المختار الآن — لعرض الاقتراحات المعلّمة لا لتقرير السعر. */
  const [suggestedReference, setSuggestedReference] = useState<CatalogItem | null>(null);
  const [occurredOn, setOccurredOn] = useState(() => todayInAmman());
  const [note, setNote] = useState("بيع مباشر");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /* P0 (إعادة الدخول): عهدة تزامنية — حوار «احفظ واستمر» أو نبضة ثانية أثناء
   * حفظ جارٍ لا تُعيد نداء الحفظ نفسه؛ الحتمية محفوظة في المخزن أيضًا كخط دفاع ثانٍ. */
  const saveInFlightRef = useRef(false);
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
  /* S11-MR-001 (B3-F08 + B5 «فشل قراءة المحافظ»): حالة قراءة المحافظ مستقلة
   * — التحميل والفشل والجاهزية ظاهرة بصدق؛ الفشل ليس «لا محافظ»، والقبض
   * لا يختفي، وإعادة القراءة فعل صريح. */
  const [walletsLoading, setWalletsLoading] = useState(false);
  const [walletsReadFailed, setWalletsReadFailed] = useState(false);
  const [walletsRetryToken, setWalletsRetryToken] = useState(0);
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
  /* S11 (UNIT-005/PD-02 + UNIT-026 sale-slice): حالة فعل المرتجع الكامل ودفع
   * الرد — نية واحدة لكل فعل (مفتاح ثابت عند الإعادة) وتاريخ أعمال حقيقي.
   * تصحيح المراجعات R5-001/002/003: الإفصاح محروس بحالة حية (زر الإبقاء
   * يغلقه فعلًا)، والتغذية الراجعة محلية للقسم (النجاح status لا قناة
   * الخطأ)، وصلاحية نص مبلغ الرد محروسة كبقية الحقول المالية. */
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnDate, setReturnDate] = useState(todayInAmman());
  const [returnFeedback, setReturnFeedback] = useState<{ kind: "error" | "status"; text: string } | null>(
    null,
  );
  const [refundAmountMinor, setRefundAmountMinor] = useState(0);
  const [validRefund, setValidRefund] = useState(true);
  const [refundDate, setRefundDate] = useState(todayInAmman());
  const [refundWalletId, setRefundWalletId] = useState("");
  const [refundFeedback, setRefundFeedback] = useState<{ kind: "error" | "status"; text: string } | null>(
    null,
  );
  const returnIdempotencyKey = useRef(
    `direct-sale-return-ui-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
  );
  const refundIdempotencyKey = useRef(
    `direct-sale-refund-ui-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
  );

  useEffect(() => {
    catalog
      .list({ includeInactive: true })
      .then(result => {
        if (!result.ok) return;
        setReferences(result.items);
        /* R7/P07: تعيين المرجع المقترح قرار تطبيقي — الإشعار والقيم المطبقة
         * تُنفذ هنا (النسخة والإشعارات واجهة). */
        const proposal = proposeProductParam(result.items, search, {
          editing,
          alreadyApplied: appliedProductRef.current,
          itemName,
          revenueMinor,
          quantity,
          costKnown,
        });
        if (proposal.kind === "none") return;
        /* الطلب يُستهلك مرة واحدة في كل الحالات غير «none» — كما كان الأصل. */
        appliedProductRef.current = true;
        if (proposal.kind === "unavailable") return;
        if (proposal.kind === "inactive_reference") {
          setProductNotice("هذا المرجع موقوف — سُجّل البيع بلا ربط أو فعّله من منتجاتي وخدماتي.");
          return;
        }
        setCatalogItemId(proposal.catalogItemId);
        if (proposal.itemName !== null) setItemName(proposal.itemName);
        if (proposal.revenueMinor !== null) setRevenueMinor(proposal.revenueMinor);
        if (proposal.cost !== null) {
          setCostKnown(true);
          setCostMinor(proposal.cost.minor);
        }
        setSuggestedReference(result.items.find(item => item.id === proposal.suggestedReferenceId) ?? null);
        /* فحص حي (مجموعة ٣): التعبئة المقترحة «قيم محمّلة» لا كتابة مستخدم —
         * تُعاد لقطة الوسخ بعدها فلا يعترض الخروج الصامت بمستخدم لم يكتب شيئًا. */
        setLoadedToken(token => token + 1);
      })
      .catch(() => setReferences([]));
  }, [catalog, dataVersion]);

  /* المجموعة ٣ (Scope D): محافظ القبض تُقرأ عند الإنشاء فقط — التعديل لا يحرك
   * الكاش. استثناء S11 (تصحيح المراجعة R2-004): قسم دفع الرد على بيع مُرتجع
   * يظهر في وضع التعديل ويحتاج المحافظ (خيار الصرف) — فتُقرأ المحافظ هناك
   * أيضًا دون مساس بقرار الدرج الافتراضي (خاص بالإنشاء وحده). */
  useEffect(() => {
    if (editing && !savedSale?.return) return;
    let active = true;
    setWalletsLoading(true);
    setWalletsReadFailed(false);
    cashContinuity
      .overview()
      .then(result => {
        if (!active) return;
        setWalletsLoading(false);
        if (!result.ok) {
          /* B5: الفشل ليس «لا محافظ» — القبض باقٍ والوجهة قابلة لإعادة القراءة. */
          setWalletsReadFailed(true);
          return;
        }
        setWallets(result.value.wallets.map(wallet => ({ id: wallet.id, name: wallet.name })));
        if (!editing) {
          const drawer = result.value.wallets.find(wallet => wallet.kind === "cash_drawer");
          setSaleWalletId(current => current || drawer?.id || "");
        }
      })
      .catch(() => {
        if (!active) return;
        setWalletsLoading(false);
        setWalletsReadFailed(true);
      });
    return () => {
      active = false;
    };
  }, [cashContinuity, editing, savedSale?.return, dataVersion, walletsRetryToken]);

  /* S05 (DOC-014 / UNIT-037 A2): خيارات الأطراف المحفوظة النشطة للمختار —
   * تُحمّل عند جاهزية الخدمة الكسولة؛ الفشل يبقي القائمة فارغة بصدق (لا
   * يمنع البيع ولا يفرض طرفًا). */
  useEffect(() => {
    if (!partyDirectory || editing) return;
    let active = true;
    void partyDirectory.suggestParties().then(result => {
      if (!active || !result.ok) return;
      setPartyOptions(result.value);
    });
    return () => {
      active = false;
    };
  }, [partyDirectory, editing, dataVersion]);

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
      /* R7/P07: خريطة السجل المحمّل إلى قيم النموذج عند صاحبها التطبيقي. */
      const values = directSaleToFormValues(sale);
      setItemName(values.itemName);
      setQuantity(values.quantity);
      setRevenueMinor(values.revenueMinor);
      /* S11-MR-001: وضع السجل القائم من محفوظه — لا افتراض إنشائي عليه. */
      setPaymentMode(values.paymentMode);
      setCollectedEmpty(values.collectedEmpty);
      setCollectedMinor(values.collectedMinor);
      setCostKnown(values.costKnown);
      setCostMinor(values.costMinor);
      setCustomerName(values.customerName);
      setCustomerPartyId(values.customerPartyId || null);
      setCatalogItemId(values.catalogItemId);
      setOccurredOn(values.occurredOn);
      setNote(values.note);
      setDifferenceChoice(values.differenceChoice);
      /* اللقطة الأولية تُعاد التقاطها مع القيم المحمّلة في نفس الدفعة. */
      setLoadedToken(token => token + 1);
    });
    return () => {
      active = false;
    };
  }, [directSales, saleId, reloadToken, dataVersion]);

  /* S11-MR-001: المقبوض الفعّال من وضع الدفع الصريح — الكامل = الإجمالي،
   * والجزء = المُدخل، و«لم أستلم» صفرٌ صريح؛ لا فراغ يُفسّر مالًا. */
  const resolvedCollected = resolveCollectedForMode(paymentMode, revenueMinor, collectedMinor);
  const difference = revenueMinor - resolvedCollected;
  const effectiveChoice = effectiveDifferenceChoice(paymentMode, differenceChoice);
  const debtIntent = difference > 0 && effectiveChoice === "remaining_debt";
  /* س3 «حالة مختلفة؟»: تظهر عند وجود فرق فقط — ولا تُعاد على من اختار الدين
   * صراحة في الدفع؛ قرار فعال أو فرق معلّق يفتحها. */
  useEffect(() => {
    if (undecidedDifference || differenceChoice === "price_cut" || differenceChoice === "needs_review")
      setDifferentCaseOpen(true);
  }, [undecidedDifference, differenceChoice]);
  /* U-005 (دورة التدقيق النهائي): حماية المدخلات غير المحفوظة — زر الرجوع والمتصفح
   * كلاهما يمران بالحارس: «ابقَ / احفظ ثم اخرج / اخرج بلا حفظ». */
  const isDirty = useFormDirty(
    [
      itemName,
      quantity,
      revenueMinor,
      paymentMode,
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
  /* المجموعة ٥ (عقد ٣٦): مسودة للبيع جديد فقط — التعديل فوق سجل قائم بلا
   * مسودة (تعارضه مع النهائي يمنع الاستعادة الصامتة). شكل القيم موسوم
   * صراحةً (وضع الدفع/قرار الفرق اتحادين لا حرفيين) فلا يستنتج الاستدعاء
   * النوع الحرفي ويضيّق ما يُكتب لاحقًا في onValuesChanged. */
  const directSaleDraftDefaults: {
    itemName: string;
    quantity: number;
    revenueMinor: number;
    paymentMode: PaymentMode;
    collectedEmpty: boolean;
    collectedMinor: number;
    differenceChoice: DifferenceChoice | null;
    differenceUndecided: boolean;
    costKnown: boolean;
    costMinor: number;
    customerName: string;
    customerPartyId: string;
    saveForReuse: boolean;
    catalogItemId: string;
    occurredOn: string;
    note: string;
  } = {
    itemName: "",
    quantity: 1,
    revenueMinor: 0,
    paymentMode: "full",
    collectedEmpty: true,
    collectedMinor: 0,
    differenceChoice: null,
    differenceUndecided: false,
    costKnown: false,
    costMinor: 0,
    customerName: "",
    customerPartyId: "",
    saveForReuse: false,
    catalogItemId: "",
    occurredOn: todayInAmman(),
    note: "",
  };
  const saleDraft = useFormDraft(formDrafts, "direct_sale", editing ? null : "new", directSaleDraftDefaults);
  const restoredFromOffer = useRef(false);
  useEffect(() => {
    if (editing || !isDirty || saleDraft.state.phase === "restore-offer") return;
    saleDraft.onValuesChanged({
      itemName,
      quantity,
      revenueMinor,
      paymentMode,
      /* S11-MR-001: الشكل متوافق مع الأمام والخلف — collectedEmpty/Minor
       * يُكتبان بمعنى الوضع الحالي فتقرأه أي نسخة، والوضع والقرار المعلق
       * للنسخة الجديدة. */
      collectedEmpty: paymentMode === "partial" ? collectedEmpty : paymentMode === "full",
      collectedMinor: paymentMode === "partial" ? collectedMinor : 0,
      differenceChoice,
      differenceUndecided: undecidedDifference,
      costKnown,
      costMinor,
      customerName,
      customerPartyId: customerPartyId ?? "",
      saveForReuse,
      catalogItemId,
      occurredOn,
      note,
    });
  }, [
    itemName,
    quantity,
    revenueMinor,
    paymentMode,
    collectedEmpty,
    collectedMinor,
    costKnown,
    costMinor,
    customerName,
    customerPartyId,
    saveForReuse,
    catalogItemId,
    occurredOn,
    note,
    differenceChoice,
    undecidedDifference,
    isDirty,
    editing,
    saleDraft.state.phase,
  ]);
  useEffect(() => {
    if (saleDraft.state.phase === "drafting" && restoredFromOffer.current) {
      restoredFromOffer.current = false;
      /* S11-MR-001: هجرة شكل المسودة — القديمة تُترجم بمعناها الأصلي
       * (collectedEmpty) ولا يُسند معنى دين جديد بصمت؛ القراءة شكلٌ حر
       * (المخزن قد يحمل مسودة نسخة أقدم من شكل اليوم). */
      const saved = saleDraft.state.values as unknown as Record<string, unknown>;
      const migrated = paymentModeFromDraft(saved);
      setPaymentMode(migrated.mode);
      setUndecidedDifference(migrated.undecidedDifference);
      setItemName(String(saved.itemName ?? ""));
      setQuantity(Number(saved.quantity ?? 1));
      setRevenueMinor(Number(saved.revenueMinor ?? 0));
      setCollectedEmpty(saved.collectedEmpty !== false);
      setCollectedMinor(Number(saved.collectedMinor ?? 0));
      setDifferenceChoice(
        saved.differenceChoice === "price_cut" ||
          saved.differenceChoice === "remaining_debt" ||
          saved.differenceChoice === "needs_review"
          ? saved.differenceChoice
          : null,
      );
      setCostKnown(saved.costKnown === true);
      setCostMinor(Number(saved.costMinor ?? 0));
      setCustomerName(String(saved.customerName ?? ""));
      setCustomerPartyId(String(saved.customerPartyId ?? "") || null);
      setSaveForReuse(saved.saveForReuse === true);
      setCatalogItemId(String(saved.catalogItemId ?? ""));
      setOccurredOn(String(saved.occurredOn ?? todayInAmman()));
      /* B3-F13: البيان تقني لا يُحرر في الإنشاء — الفراغ المستعاد يأخذ
       * الافتراض الصادق لا أن يحجب الحفظ برسالة حقل محذوف من الشاشة. */
      setNote(String(saved.note ?? "") || "بيع مباشر");
    }
    if (saleDraft.state.phase === "restore-offer") restoredFromOffer.current = true;
  }, [saleDraft.state.phase]);

  async function save(): Promise<boolean> {
    if (saveInFlightRef.current) return false;
    if (savedSale?.status === "cancelled") {
      setMessage("هذا البيع ملغى ولا يمكن تعديله.");
      return false;
    }
    /* R7/P07: بوابة التحقق عند صاحبها التطبيقي — القرار كود والنسخة هنا. */
    const problem = validateDirectSaleSubmission({
      note,
      validQuantity,
      quantity,
      validRevenue,
      revenueMinor,
      paymentMode,
      validCollected,
      collectedEmpty,
      partialCollectedMinor: collectedMinor,
      costKnown,
      validCost,
      costMinor,
      difference,
      differenceChoice,
      undecidedDifference,
    });
    if (problem === "missing_required_fields") {
      setMessage("أدخل المبلغ والكمية بالأرقام 0–9 قبل الحفظ — المبلغ هو الحقل الإلزامي الوحيد.");
      return false;
    }
    if (problem === "collected_exceeds_price") {
      setMessage("المقبوض لا يتجاوز السعر المتفق عليه — سجّل فرقك قرارًا في التسعير لا في القبض.");
      return false;
    }
    if (problem === "partial_amount_required") {
      setMessage("أدخل مبلغ ما قُبض الآن — أو اختر «لم أستلم والمبلغ دَين» إن لم يُقبض شيء.");
      return false;
    }
    if (problem === "partial_amount_equals_total") {
      setMessage("المقبوض يساوي إجمالي البيع — اختر «استلمت كامل المبلغ».");
      return false;
    }
    if (problem === "difference_choice_required") {
      setMessage("قرار الفرق من مسودتك السابقة ما زال معلقًا — اختر معناه في «حالة مختلفة؟» قبل الحفظ.");
      setDifferentCaseOpen(true);
      return false;
    }
    /* R7/P07: قرار الفرق X-06 عند صاحبه التطبيقي — الوضع الصريح هو الدين ما
     * لم تختر حالة مختلفة (تخفيض/مراجعة). */
    const { collectionStatus: status, priceCut: priceCutChosen } = resolveDifferenceOutcome(
      difference,
      effectiveChoice,
    );
    /* و٦: رقم المراجعة الذي فُتح عليه السجل — يحرس من طمس تعديل أحدث من نافذة أخرى. */
    const openedRevisionCount = savedSale?.revisions?.length ?? 0;
    setMessage(null);
    saveInFlightRef.current = true;
    setSaving(true);
    let result: Awaited<ReturnType<typeof directSales.record>>;
    try {
      result = editing
        ? await directSales.update(saleId!, {
            itemName: itemName.trim() || "بيع نقدي",
            quantity,
            /* «خفّضتُ السعر» على تعديل قائم: السعر يهبط إلى المقبوض، والمراجعة تحمل الأصل. */
            revenueMinor: priceCutChosen ? resolvedCollected : revenueMinor,
            collectedMinor: resolvedCollected,
            collectionStatus: priceCutChosen ? "collected_in_full" : status,
            catalogItemId: catalogItemId || null,
            customerName: customerName.trim() || null,
            /* S05 (DOC-014 / UNIT-037): الرابط الصريح إن اختير محفوظًا. */
            customerPartyId,
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
            /* S05 (DOC-014 / UNIT-037): الرابط الصريح إن اختير محفوظًا. */
            customerPartyId,
            costMinor: costKnown ? costMinor : null,
            occurredOn,
            note,
            idempotencyKey: idempotencyKey.current,
            priceCut: priceCutChosen,
            /* S11 (UNIT-005 §6 — الذرية): البيع والقبض الابتدائي والحق المشتق
             * وتخصيص المحفظة المختار والتزام واحد داخل حد الكتابة الواحد —
             * لا نجاح جزئي ولا نافذة تخصيص لاحقة؛ الغياب = غير موزع صريح،
             * ولا نية محفظة عند قبض صفري (لا تخصيص بلا مال). */
            wallet: !editing && resolvedCollected > 0 && saleWalletId ? { walletId: saleWalletId } : null,
          });
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
    if (!result.ok) {
      setMessage(result.message);
      /* و٦: عند التعارض يتحدّث السجل ورقم مراجعاته وتبقى كتابة المستخدم كما هي. */
      if (result.code === "conflict") {
        preserveFormRef.current = true;
        setReloadToken(token => token + 1);
      }
      return false;
    }
    if (!editing) await saleDraft.clearFormDraft();
    /* التعديل يخرج لمصدره كما كان — لا شاشة نتيجة لسجل قائم. */
    if (editing) {
      /* FIN-004: تعديل السجل القائم كتابة واحدة — الإشعار بعدها مباشرة. */
      notifyDataChanged();
      navigate(returnPath);
      return true;
    }
    /* S11 (UNIT-005 §6 — الذرية): البيع وتخصيص المحفظة المختار كُتبا معًا في
     * حد واحد (commitDirectSaleWrite) — لا نافذة تخصيص لاحقة ولا نجاح جزئي:
     * التخصيص المكتوب يُقرأ من سطر القبض الابتدائي القائم نفسه. */
    let walletName: string | null = null;
    let attributedMinor = 0;
    let attributionFailure: string | null = null;
    const initialEntry = result.value.collections?.find(entry => entry.id === `${result.value.id}:initial`);
    if (initialEntry?.allocationEntryId) {
      walletName = wallets.find(wallet => wallet.id === saleWalletId)?.name ?? null;
      attributedMinor = initialEntry.amountMinor;
    }
    /* S05 (DOC-014 / UNIT-037 B3 + SDF-041): حفظ الطرف الاختياري منفصل عن
     * التزام البيع تمامًا — البيع نجح وأُعلن، والحفظ أمر مستقل بمفتاح مشتق
     * من مفتاح الإرسال نفسه (إعادة المحاولة لا تنشئ طرفًا ثانيًا)؛ فشله
     * يُعرض نتيجة جزئية صادقة مع إعادة محاولة للحفظ وحده — لا يُعاد البيع
     * ولا يُتراجع ولا يتكرر أبدًا. */
    let partySaveFailed: { label: string; message: string } | null = null;
    if (!editing && saveForReuse && !customerPartyId && customerName.trim() && partyDirectory) {
      const partySaved = await partyDirectory.save({
        label: customerName,
        phone: null,
        note: null,
        operationKey: `${idempotencyKey.current}:party-save`,
      });
      if (!partySaved.ok) partySaveFailed = { label: customerName.trim(), message: partySaved.message };
      else notifyDataChanged();
    }
    /* FIN-004 (قرار المالك المعتمد ٢٠٢٦-٠٩-١٦): الإشعار بعد اكتمال كل الكتابات
     * (البيع ثم نسبة المحفظة) — الحالة الملتزَمة فقط تُعلن. */
    notifyDataChanged();
    /* نجاح محلي مكتمل: يُعاد ضبط لقطة الوسخ فلا يعترض الخروج من شاشة النتيجة. */
    setLoadedToken(token => token + 1);
    setPartySaveFailure(partySaveFailed);
    setDone({ sale: result.value, walletName, attributedMinor, attributionFailure });
    return true;
  }

  /* S05 (DOC-014 / UNIT-037 B3 + SDF-041): إعادة محاولة حفظ العميل وحده —
   * البيع نجح ولا يُعاد ولا يُتراجع أبدًا؛ المفتاح نفسه المتولد من مفتاح
   * الإرسال: إعادة المحاولة إما نجاح جديد أو إعادة استخدام صادقة إن سبق
   * نجاحه خفية — لا طرف ثانٍ ولا أثر مكرر أبدًا. */
  async function retryPartySave() {
    if (!partyDirectory || !partySaveFailure) return;
    const retried = await partyDirectory.save({
      label: partySaveFailure.label,
      phone: null,
      note: null,
      operationKey: `${idempotencyKey.current}:party-save`,
    });
    if (!retried.ok) {
      setPartySaveFailure({ ...partySaveFailure, message: retried.message });
      return;
    }
    setPartySaveFailure(null);
    notifyDataChanged();
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
    /* المجموعة ٦ (تدقيق A1 — FT-02): عكس تخصيصات المحفظة بعد الإلغاء قد يفشل
     * (تخزين) — الإلغاء نفسه نجح لكن المال بقي في غير الموزع بانتظار قرار؛
     * نُبقي الصفحة مفتوحة بالرسالة بدل مغادرة صامتة. */
    if (result.allocationReversalNotice) {
      setMessage(result.allocationReversalNotice);
      return true;
    }
    navigate(returnPath);
    return true;
  }

  /* S11 (UNIT-005/PD-02 — أمر b33a8877 §6): المرتجع الكامل — يلغي الحق
   * المتبقي ويثبت رد المقبوض فعليًا فقط؛ الأصل والتاريخ محفوظان ولا نقص
   * نقد قبل دفع رد فعلي. */
  async function submitFullReturn() {
    if (!saleMovements) {
      setReturnFeedback({ kind: "error", text: "جارٍ تجهيز خدمة الحفظ — لحظة ثم أعد المحاولة." });
      return;
    }
    if (!saleId || !returnReason.trim()) {
      setReturnFeedback({ kind: "error", text: "اكتب سبب المرتجع قبل تأكيده." });
      return;
    }
    setReturnFeedback(null);
    setSaving(true);
    const result = await saleMovements.fullReturn(saleId, {
      occurredOn: returnDate,
      reason: returnReason,
      operationKey: returnIdempotencyKey.current,
    });
    setSaving(false);
    if (!result.ok) {
      setReturnFeedback({ kind: "error", text: result.message });
      if (result.code === "conflict") {
        preserveFormRef.current = true;
        setReloadToken(token => token + 1);
      }
      return;
    }
    notifyDataChanged();
    setReturnOpen(false);
    setReturnFeedback({
      kind: "status",
      text: "سُجّل المرتجع الكامل — أُلغي المتبقي وثبت حق الرد بالمقبوض.",
    });
  }

  /* S11 (UNIT-026 sale-slice / SDF-054): دفع رد فعلي مؤرخ — لا يتجاوز حق
   * الرد القائم ولا يُدفع مرتين؛ الصرف من محفظة مختارة أو من غير الموزع. */
  async function submitRefundPayment() {
    if (!saleMovements) {
      setRefundFeedback({ kind: "error", text: "جارٍ تجهيز خدمة الحفظ — لحظة ثم أعد المحاولة." });
      return;
    }
    if (!saleId) return;
    if (!validRefund || !Number.isInteger(refundAmountMinor) || refundAmountMinor <= 0) {
      setRefundFeedback({ kind: "error", text: "أدخل مبلغ دفع الرد بالأرقام 0–9." });
      return;
    }
    setRefundFeedback(null);
    setSaving(true);
    const result = await saleMovements.payRefund(saleId, {
      amountMinor: refundAmountMinor,
      occurredOn: refundDate,
      operationKey: refundIdempotencyKey.current,
      walletId: refundWalletId || null,
    });
    setSaving(false);
    if (!result.ok) {
      setRefundFeedback({ kind: "error", text: result.message });
      if (result.code === "conflict") {
        preserveFormRef.current = true;
        setReloadToken(token => token + 1);
      }
      return;
    }
    notifyDataChanged();
    setRefundFeedback({ kind: "status", text: "سُجّل دفع الرد بتاريخه." });
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
                ? `دين على ${sale.customerName ?? "الزبون"}: ${formatMoneyMinor(outstandingMinor)} د.أ — يظهر في «لي عند العملاء».`
                : `فرق معلّق للمراجعة: ${formatMoneyMinor(outstandingMinor)} د.أ — لم يُقرّر بعد.`
              : "قُبض المبلغ كاملًا — لا دين من هذا البيع."}
          </p>
          {done.attributionFailure ? (
            /* Z2.3 (§3.4 — Partial Success): المنجز والناقص مفصولان صريحين —
               البيع سُجل وقُبضه محفوظ (السطور أعلاه)، والنسبة وحدها لم تتم
               بسببها؛ الفعل التالي «افتح السجل» أسفل — لا مسار إعادة تسجيل
               للبيع أبدًا. */
            <p className="micro-local-truth" role="status">
              {saleDonePartialAttributionNote(done.attributionFailure)}
            </p>
          ) : (
            <p>
              {done.attributedMinor > 0
                ? `نُسب القبض إلى «${done.walletName ?? "المحفظة"}»: ${formatMoneyMinor(done.attributedMinor)} د.أ — حركة موثقة في دفتر المحفظة.`
                : "بقي القبض في الكاش غير الموزع — وزّعه على محفظة عندما تعرف وجهته."}
            </p>
          )}
          {partySaveFailure ? (
            /* S05 (DOC-014 / UNIT-037 B3 + SDF-041): البيع نجح والحفظ الاختياري
               وحده لم يتم — نتيجة جزئية صادقة مع إعادة محاولة للحفظ وحده؛
               إعادة البيع أو تراجعه مستحيلة من هنا. */
            <p className="micro-local-truth" role="status">
              تم حفظ البيع؛ لم يُحفظ العميل في القائمة — {partySaveFailure.message}{" "}
              <button type="button" className="micro-text-action" onClick={() => void retryPartySave()}>
                أعد محاولة حفظه في القائمة
              </button>
            </p>
          ) : null}
          {reference ? <p>مرجع مرتبط: {reference.name} — الربط للتوثيق فقط.</p> : null}
          <p className="micro-local-truth">سُجل محليًا على هذا الجهاز — الضغط مرتين لا يضاعف أثرًا.</p>
        </section>
        {/* المجموعة ٣ (عقد D5/§5.6): ربط المخزون بالبيع مباشر اختياري صريح — لا
            يُخصم شيء لمجرد البيع؛ إن استهلكت مواد متتبَّعة فسجّلها من هنا بمسار
            عقد ٢٨ نفسه (معاينة ونقص موثق وتراجع). */}
        <section className="micro-decision-card" aria-label="ربط اختياري بالمخزون">
          <p>
            فيك مواد متتبَّعة استُهلكت في هذا البيع؟ سجّل استهلاكها بصلة صريحة بهذا البيع — اختياري تمامًا،
            والبيع صحيح بدونه.
          </p>
          {inventoryEntryEnabled ? (
            <Button
              action="quiet"

              onClick={() =>
                requestNavigation(
                  withReturnTo(
                    `/inventory/movement/consume?sale=${encodeURIComponent(sale.id)}`,
                    `/direct-sales/${encodeURIComponent(sale.id)}`,
                  ),
                )
              }
            >
              سجّل استهلاك مواد لهذا البيع
            </Button>
          ) : (
            /* G-004: إدخال المخزون متوقف — قراءة صادقة بلا زر إنشاء. */
            <p className="micro-field-hint">إدخال المخزون متوقف من الإعدادات.</p>
          )}
        </section>
        <div className="micro-form-actions">
          <Button
            action="secondary"

            onClick={() =>
              requestNavigation(withReturnTo(`/direct-sales/${encodeURIComponent(sale.id)}`, returnPath))
            }
          >
            <ReceiptText aria-hidden="true" /> افتح السجل
          </Button>
          <Button
            action="secondary"

            onClick={() => requestNavigation(returnPath)}
          >
            تم
          </Button>
        </div>
      </section>
    );
  }

  /* S11-MR-001 (A2/س2): تبديل وضع الدفع نية واجهة صرفة — لا كتابة مالية هنا
   * ولا مساس بمفتاح العملية؛ التخفيض إلى صفر منطقة D05 غير المعتمدة فلا
   * يبقى قرار تخفيض فوق وضع «لم أستلم»، والمراجعة تبقى صالحة في كل فرق. */
  function selectPaymentMode(mode: PaymentMode) {
    setPaymentMode(mode);
    if (mode === "none") setDifferenceChoice(choice => (choice === "price_cut" ? null : choice));
  }

  /* S11-MR-001 (A2/س8): معاينة ملاصقة للحفظ من النية الفعّالة الصحيحة — تُشتق
   * من الوضع والقرار والمبالغ التي سيُبنى بها أمر الحفظ نفسه، ولا تُعرض عند
   * مدخل غير صالح (لا رقم من نص فاسد ولا معاينة متقادمة). */
  const previewText = (() => {
    const parts = directSalePreviewParts({
      valid: validRevenue && (paymentMode !== "partial" || (validCollected && !collectedEmpty)),
      paymentMode,
      revenueMinor,
      resolvedCollectedMinor: resolvedCollected,
      difference,
      effectiveChoice,
    });
    if (parts.kind === "unavailable") return null;
    if (parts.kind === "price_cut")
      return `البيع يصير ${formatMoneyMinor(parts.effectiveSaleMinor)} · المقبوض ${formatMoneyMinor(
        parts.effectiveSaleMinor,
      )} · لا دين`;
    const who = customerName.trim() ? ` على ${customerName.trim()}` : "";
    if (parts.kind === "review")
      return parts.none
        ? `البيع ${formatMoneyMinor(parts.saleMinor)} · لم يُقبض · فرق ${formatMoneyMinor(
            parts.pendingMinor,
          )} يحتاج مراجعة`
        : `البيع ${formatMoneyMinor(parts.saleMinor)} · المقبوض ${formatMoneyMinor(
            parts.collectedMinor,
          )} · فرق ${formatMoneyMinor(parts.pendingMinor)} يحتاج مراجعة`;
    if (parts.kind === "debt")
      return parts.none
        ? `البيع ${formatMoneyMinor(parts.saleMinor)} · لم يُقبض · دين ${formatMoneyMinor(
            parts.debtMinor,
          )}${who}`
        : `البيع ${formatMoneyMinor(parts.saleMinor)} · المقبوض ${formatMoneyMinor(
            parts.collectedMinor,
          )} · دين ${formatMoneyMinor(parts.debtMinor)}${who}`;
    return `البيع ${formatMoneyMinor(parts.saleMinor)} · المقبوض ${formatMoneyMinor(
      parts.saleMinor,
    )} · قُبض كاملًا`;
  })();

  return (
    <section className="micro-page micro-finance-page">
      <button className="micro-back-button" type="button" onClick={() => requestNavigation(returnPath)}>
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
      {!editing && saleDraft.state.phase === "restore-offer" ? (
        <FormDraftRestoreBanner
          savedAt={saleDraft.state.savedAt}
          onRestore={saleDraft.restoreDraft}
          onDiscard={saleDraft.discardDraft}
        />
      ) : null}
      {!editing && saleDraft.state.phase === "drafting" && saleDraft.state.saveFailed ? (
        <p className="micro-field-error" role="alert">
          تعذر حفظ المسودة محليًا — قيمك أمامك كما هي ولم يُسجّل أي بيع؛ أكمل الكتابة أو الحفظ النهائي.
        </p>
      ) : !editing && saleDraft.state.phase === "drafting" && saleDraft.state.lastSavedAt ? (
        <p className="micro-offline-truth" role="status">
          مسودتك محفوظة محليًا — آخر حفظ{" "}
          <bdi dir="ltr">{formatLocalDate(localDateInAmman(saleDraft.state.lastSavedAt))}</bdi>؛ لم يُسجّل
          البيع بعد.
        </p>
      ) : null}
      <section className="micro-decision-card">
        <div>
          <span>حد الحقيقة</span>
          <strong>التحصيل ليس ربحًا.</strong>
          {/* المجموعة ٦ (البند ٤ — S3-12 §10.2 قاعدة ١): الشرح خلف علامة
              قراءة هادئة — السطر القوي يبقى، والتفصيل عند طلبه. */}
          <details className="micro-inline-disclosure">
            <summary>اقرأ حد الربح</summary>
            <p>إذا لم تعرف التكلفة الآن، سيظهر الربح «غير متاح» بدل أن يفترضه النظام صفرًا.</p>
          </details>
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
                  {revision.kind === "price_cut"
                    ? "خفّضتُ السعر"
                    : revision.kind === "cancel"
                      ? "إلغاء"
                      : "تعديل"}
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
      <SaleCollectionReversalSection
        saleId={saleId}
        saleStatus={savedSale?.status ?? "active"}
        saleCollectionReversal={saleCollectionReversal}
        dataVersion={dataVersion}
        notifyDataChanged={notifyDataChanged}
      />
      <section className="micro-form-card">
        <fieldset disabled={savedSale?.status === "cancelled"} style={{ border: 0, padding: 0, margin: 0 }}>
          {/* S11-MR-001 (UNIT-005 A2/س1 + B3-F01): إجمالي البيع أولًا — حقل
              المال الوحيد المقدَّم؛ اسمه ثابت ولا يتحول إلى «المقبوض». */}
          <label className="micro-field">
            <span>إجمالي البيع — د.أ</span>
            <EnglishNumberInput
              value={revenueMinor}
              kind="money"
              onNumericChange={setRevenueMinor}
              onTextValidityChange={setValidRevenue}
            />
          </label>
          {/* S11-MR-001 (A2/س2 + B3-F02): الدفع نية صريحة — الكامل مقترح ظاهرًا؛
              الجزء يكشف المبلغ والباقي دَين صريح من الخيار فيجهز تعريفه دون سؤال
              فرق ثانٍ؛ و«لم أستلم» صفرٌ معلوم باختيار المالك لا بتفسير فراغ. */}
          <fieldset className="micro-payment-mode">
            <legend>الدفع</legend>
            <label className="micro-radio-choice">
              <input
                type="radio"
                name="payment-mode"
                checked={paymentMode === "full"}
                onChange={() => selectPaymentMode("full")}
              />
              <span>
                <b>استلمت كامل المبلغ</b>
              </span>
            </label>
            <label className="micro-radio-choice">
              <input
                type="radio"
                name="payment-mode"
                checked={paymentMode === "partial"}
                onChange={() => selectPaymentMode("partial")}
              />
              <span>
                <b>استلمت جزءًا والباقي دَين</b>
              </span>
            </label>
            {paymentMode === "partial" ? (
              <label className="micro-field">
                <span>المقبوض الآن — د.أ</span>
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
                />
              </label>
            ) : null}
            <label className="micro-radio-choice">
              <input
                type="radio"
                name="payment-mode"
                checked={paymentMode === "none"}
                onChange={() => selectPaymentMode("none")}
              />
              <span>
                <b>لم أستلم والمبلغ دَين</b>
              </span>
            </label>
          </fieldset>
          {/* S11-MR-001 (A2/س3 «عند الحاجة فقط»): حالة مختلفة؟ — لا تُعاد على
              من اختار الدين صراحة في الدفع؛ التخفيض بمعاينة السعر الفعلي، ولا
              تحويل مراجعة إلى دين تلقائيًا. */}
          {difference > 0 ? (
            <details
              className="micro-inline-disclosure"
              open={differentCaseOpen}
              onToggle={event => setDifferentCaseOpen(event.currentTarget.open)}
            >
              <summary>حالة مختلفة؟</summary>
              {undecidedDifference ? (
                <p className="micro-field-hint" role="status">
                  قرار الفرق من مسودتك السابقة ما زال معلقًا — اختر ما حدث فعلًا قبل الحفظ.
                </p>
              ) : null}
              {resolvedCollected > 0 ? (
                <label className="micro-radio-choice">
                  <input
                    type="radio"
                    name="difference-choice"
                    checked={differenceChoice === "price_cut"}
                    onChange={() => {
                      setDifferenceChoice("price_cut");
                      setUndecidedDifference(false);
                    }}
                  />
                  <span>
                    <b>خفّضتُ السعر فعلًا</b>
                    <small>
                      البيع يصير {formatMoneyMinor(resolvedCollected)} د.أ — لا دَين ولا تتبّع، ويسجَّل
                      تخفيضًا موثَّقًا يحفظ السعر الأصلي.
                    </small>
                  </span>
                </label>
              ) : null}
              <label className="micro-radio-choice">
                <input
                  type="radio"
                  name="difference-choice"
                  checked={differenceChoice === "needs_review"}
                  onChange={() => {
                    setDifferenceChoice("needs_review");
                    setUndecidedDifference(false);
                  }}
                />
                <span>
                  <b>الفرق يحتاج مراجعة</b>
                  <small>لم يُقرَّر بعد — خيار صالح لا خطأ، والفرق يبقى معلَّقًا على البيع حتى تحسمه.</small>
                </span>
              </label>
              {differenceChoice !== null ? (
                <button
                  type="button"
                  className="micro-text-action"
                  onClick={() => {
                    setDifferenceChoice(null);
                    setUndecidedDifference(false);
                    setDifferentCaseOpen(false);
                  }}
                >
                  ألغِ الحالة الخاصة — الباقي دَين كما اخترت في الدفع
                </button>
              ) : null}
            </details>
          ) : null}
          {/* S11-MR-002 (UNIT-005 A2/س2 «فيجهز تعريفه» + B3-F05): تعريف صاحب
              المتبقي متاح دائمًا — اختيار محفوظ صريح أو اسم لهذه العملية؛ عند
              الدفع الكامل يبقى «إضافة عميل — اختياري» متاحًا حتى بلا دين ولا
              اسم مُدخل سابقًا (وحدة واحدة ثابتة: لا قفز تركيز بين موضعين). */}
          <section className="micro-party-identity">
            {partyOptions.length > 0 ? (
              <label className="micro-field">
                <span>
                  عميل محفوظ{" "}
                  <small>
                    {debtIntent
                      ? "اختر من حفظته أو اكتب اسمًا جديدًا أدناه"
                      : "اختياري — اتركه فارغًا لبيع نقدي"}
                  </small>
                </span>
                <select
                  value={customerPartyId ?? ""}
                  onChange={event => {
                    const selected = event.target.value;
                    const party = partyOptions.find(option => option.id === selected);
                    setCustomerPartyId(selected || null);
                    /* اختيار المحفوظ يثبّت لقطة تسميته على المصدر — لا يورث
                     * سعرًا ولا موعدًا ولا مبلغًا من عملية سابقة (A2). */
                    if (party) {
                      setCustomerName(party.label);
                      setSaveForReuse(false);
                    } else {
                      setCustomerName("");
                    }
                  }}
                  aria-label="عميل محفوظ"
                >
                  <option value="">— بلا اختيار —</option>
                  {partyOptions.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="micro-field">
              <span>{debtIntent ? "على مَن المبلغ؟ — اسم أو وصف" : "إضافة عميل — اختياري"}</span>
              <input
                value={customerName}
                onChange={event => {
                  setCustomerName(event.target.value);
                  /* كتابة اسم جديدة تعريف على هذه العملية — تفك أي ربط سابق. */
                  setCustomerPartyId(null);
                }}
                aria-label={debtIntent ? "على مَن المبلغ؟ — اسم أو وصف" : "إضافة عميل — اختياري"}
              />
            </label>
            {!editing && !customerPartyId && customerName.trim() ? (
              <label className="micro-confirm-warning">
                <input
                  type="checkbox"
                  checked={saveForReuse}
                  onChange={event => setSaveForReuse(event.target.checked)}
                />
                <span>حفظه لإعادة الاستخدام في قائمة العملاء والموردين</span>
              </label>
            ) : null}
            {debtIntent && !customerName.trim() && !customerPartyId ? (
              <p className="micro-field-error" role="alert">
                اكتب اسمًا أو وصفًا يعرّف صاحب المبلغ المتبقي، أو اختر عميلًا محفوظًا — المتبقي بلا تعريف يضيع
                من المتابعة.
              </p>
            ) : null}
          </section>
          {/* S11-MR-001 (A2/س4 «عند قبض>0» + B3-F08): وجهة القبض تظهر عند تسجيل
              قبض موجب فعلي فقط — الدرج افتراضيًا حين يوجد وغير الموزع خيار
              معلن؛ حالات القراءة مستقلة والفشل ليس «لا محافظ». */}
          {!editing && resolvedCollected > 0 ? (
            <div>
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
              {walletsLoading ? <p className="micro-field-hint">جارٍ قراءة المحافظ…</p> : null}
              {walletsReadFailed ? (
                <p className="micro-field-error" role="alert">
                  تعذّرت قراءة المحافظ — قبض البيع لن يضيع؛ اختر «غير موزع» أو{" "}
                  <button
                    type="button"
                    className="micro-text-action"
                    onClick={() => setWalletsRetryToken(token => token + 1)}
                  >
                    أعد قراءة المحافظ
                  </button>
                </p>
              ) : null}
            </div>
          ) : null}
          <label className="micro-field">
            <span>هل تعرف تكلفة ما بيع؟</span>
            <select
              value={costKnown ? "known" : "unknown"}
              onChange={event => setCostKnown(event.target.value === "known")}
            >
              <option value="unknown">لا أعرف الآن</option>
              <option value="known">نعم، أعرفها</option>
            </select>
            <details className="micro-inline-disclosure">
              <summary>معنى «لا أعرف الآن»</summary>
              <p>عدم المعرفة يبقى معلومة ناقصة، ولا يسجل تكلفة صفرية.</p>
            </details>
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
          <LocalDateField
            label="تاريخ البيع"
            value={occurredOn}
            onChange={event => setOccurredOn(event.target.value)}
          />
          {/* S11-MR-001 (A2/س7): تفاصيل إضافية مطوية — وصف البيع ومنتج أو خدمة
              وكمية للتوثيق؛ لا حقل بيان ثانٍ في الإنشاء (B3-F13)، والجزء المعني
              ينفتح عند حمل رابط منتج (?product=). */}
          <details
            className="micro-inline-disclosure"
            open={Boolean(catalogItemId) && !editing ? true : undefined}
          >
            <summary>تفاصيل إضافية</summary>
            <label className="micro-field">
              <span>
                ما الذي بعته؟ <small>اختياري</small>
              </span>
              <input
                value={itemName}
                onChange={event => setItemName(event.target.value)}
                placeholder="مثال: كوب جاهز"
              />
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
              {/* بند ٢٥ (قرارات المالك) + المجموعة ٦ (البند ٤ — S3-12، §10.2 قاعدة ١):
                دلالة الكمية وراء إفصاح مسمّى 44px — الشرح يُصل عند طلبه لا يثقل الوجه. */}
              <details className="micro-inline-disclosure">
                <summary>معنى الكمية</summary>
                <p>
                  عدد القطع في هذا البيع — للتوثيق. السعر الذي تدخله أعلاه هو إجمالي البيع كاملًا، لا سعر
                  القطعة الواحدة.
                </p>
              </details>
            </label>
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
                          )} د.أ)؛ مع كمية أكبر من 1 لا يُعبّأ تلقائيًا — اضرب بنفسك وأدخل الإجمالي الفعلي.`
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
          </details>
          {productNotice ? <FeedbackNote kind="advisory" word={productNotice} /> : null}
          {/* B3-F13: لا حقل بيان ثانٍ في الإنشاء — البيان في التعديل فوق السجل
              القائم فقط (الملاحظة التاريخية المختلفة تظهر وتصحح ولا تُسحق). */}
          {editing ? (
            <label className="micro-field">
              <span>بيان مختصر</span>
              <textarea value={note} onChange={event => setNote(event.target.value)} />
            </label>
          ) : null}
          {savedSale?.collectionStatus ? (
            <p className="micro-save-note" role="status">
              حالة القبض الحالية: {collectionStatusLabel[savedSale.collectionStatus]}
              {/* تصحيح المراجعة R5-006: المرتجع الكامل ألغى حقه — لا لاحقة
                  «الفرق» بعده (حق الرد القائم يعرضه قسم دفع الرد وحده). */}
              {savedSale.collectionStatus !== "collected_in_full" &&
              savedSale.collectionStatus !== "returned_full" &&
              savedSale.revenueMinor > savedSale.collectedMinor
                ? ` — الفرق ${formatMoneyMinor(savedSale.revenueMinor - savedSale.collectedMinor)} د.أ.`
                : ""}
            </p>
          ) : null}
          {message ? (
            <p className="micro-field-error" role="alert">
              {message}
            </p>
          ) : null}
          {/* S11-MR-001 (A2/س8): معاينة قصيرة ملاصقة للحفظ — من النية الفعّالة
              الصحيحة نفسها التي سيُحفظ بها الأمر («البيع15.00 · المقبوض5.00 ·
              دين10.00 على ليان»)؛ لا فقرة تعليم ولا رقم من مدخل غير صالح. */}
          {previewText ? <p className="micro-save-preview">{previewText}</p> : null}
          <div className="micro-form-actions micro-sticky-save">
            <Button
              action="save"
              block

              disabled={saving}
              onClick={save}
            >
              <Save aria-hidden="true" />
              {saving ? "جارٍ الحفظ…" : editing ? "حفظ تصحيح البيع" : "حفظ البيع المباشر"}
            </Button>
          </div>
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
            <Button
              action="destructive"

              onClick={() => setCancelOpen(true)}
            >
              إظهار تأكيد الإلغاء
            </Button>
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
                <Button
                  action="destructive"

                  disabled={saving}
                  onClick={cancel}
                >
                  تأكيد إلغاء البيع
                </Button>
                <Button
                  action="secondary"

                  disabled={saving}
                  onClick={() => setCancelOpen(false)}
                >
                  إبقاء البيع
                </Button>
              </div>
            </>
          )}
        </section>
      ) : null}
      {/* S11 (UNIT-005/PD-02 — أمر b33a8877 §6): المرتجع الكامل فعل مستقل عن
          الإلغاء وعن تخفيض السعر — يُبقي البيع الأصل وتاريخه، ويلغي الحق
          المتبقي، ويثبت رد المقبوض فعليًا فقط؛ لا نقص نقد قبل دفع رد فعلي
          ولا إرجاع مخزون تلقائي. المحتوى خلف إفصاح مطوي (نمط نظام التصميم
          §10.1: غير محسوب في السكون، وسقف كثافة النص المحروس لا يُرفع). */}
      {editing && savedSale?.status !== "cancelled" && !savedSale?.return ? (
        <section className="micro-danger-zone" aria-labelledby="direct-sale-return-title">
          {/* تصحيح المراجعة R5-001: إفصاح محروس بحالة حية — زر «إبقاء البيع"
              يغلقه فعلًا (لا زرًا صامتًا) وحالة النجاح تغلقه بعد التنفيذ. */}
          <details
            className="micro-inline-disclosure"
            open={returnOpen}
            onToggle={event => setReturnOpen(event.currentTarget.open)}
          >
            <summary
              id="direct-sale-return-title"
              onClick={event => {
                /* الإفصاح محروس بالحالة وحدها (preventDefault) — النقر الأصلي
                 * يقلب الخاصية خلاف واجهة React فينزع التزامن؛ الحالة مصدر
                 * الحقيقة وزر الإبقاء يغلق فعلًا. */
                event.preventDefault();
                setReturnOpen(open => !open);
              }}
            >
              المرتجع الكامل
            </summary>
            <p>
              سيبقى البيع الأصل وتاريخه محفوظين، ويُلغى المتبقي غير المقبوض، ويثبت حق رد المقبوض فعليًا — لا
              يخرج نقد حتى تسجل دفع الرد.
            </p>
            <LocalDateField
              label="تاريخ المرتجع"
              value={returnDate}
              onChange={event => setReturnDate(event.target.value)}
            />
            <label className="micro-field">
              <span>سبب المرتجع</span>
              <textarea
                value={returnReason}
                onChange={event => {
                  setReturnReason(event.target.value);
                  /* تصحيح المراجعة R5-008: تحرير السبب يمسح خطأ التحقق القديم
                   * (نمط ورقة التحصيل) — لا يبقى خطأ مثبت تحت مدخل متغير. */
                  setReturnFeedback(null);
                }}
                placeholder="مثال: أُرجع كاملًا"
              />
            </label>
            <div className="micro-form-actions">
              <Button
                action="destructive"

                disabled={saving}
                onClick={() => {
                  void submitFullReturn();
                }}
              >
                {saving ? "جارٍ تسجيل المرتجع…" : "تأكيد المرتجع الكامل"}
              </Button>
              <Button
                action="secondary"

                disabled={saving}
                onClick={() => {
                  /* تصحيح المراجعة R5-007: الإبقاء يغلق الإفصاح ويمسح التغذية
                   * الراجعة فلا يبقى نص قديم تحت إفصاح مغلق. */
                  setReturnOpen(false);
                  setReturnFeedback(null);
                }}
              >
                إبقاء البيع
              </Button>
            </div>
          </details>
          {/* تصحيح المراجعة R5-007: التغذية الراجعة خارج الإفصاح المطوي —
              نجاح المرتجع يغلق الإفصاح ويبقى النص مرئيًا معلنًا (المحتوى
              المطوي لا يعرض ولا يُعلن في المتصفح الحقيقي). */}
          {returnFeedback ? (
            <p
              className={returnFeedback.kind === "error" ? "micro-field-error" : "micro-save-note"}
              role={returnFeedback.kind === "error" ? "alert" : "status"}
            >
              {returnFeedback.text}
            </p>
          ) : null}
        </section>
      ) : null}
      {/* S11 (UNIT-026 sale-slice / SDF-054): دفع رد فعلي مؤرخ على بيع مُرتجع —
          ضمن حق الرد القائم، ولا يُدفع مرتين؛ الصرف من محفظة مختارة أو من
          غير الموزع، والكاش ينقص بقدره من مصدره الواحد. */}
      {editing && savedSale?.return ? (
        <section className="micro-form-card" aria-labelledby="direct-sale-refund-title">
          <details className="micro-inline-disclosure" open>
            <summary id="direct-sale-refund-title">المرتجع الكامل</summary>
            <p role="status">
              الحق القائم <bdi dir="ltr">{formatMoneyMinor(directSaleRefundOutstandingMinor(savedSale))}</bdi>{" "}
              د.أ من أصل <bdi dir="ltr">{formatMoneyMinor(savedSale.return.refundDueMinor)}</bdi> د.أ مقبوض —
              سُجّل المرتجع بتاريخ <bdi dir="ltr">{formatLocalDate(savedSale.return.occurredOn)}</bdi>.
            </p>
            {directSaleRefundOutstandingMinor(savedSale) > 0 ? (
              <>
                <label className="micro-field">
                  <span>مبلغ دفع الرد — د.أ</span>
                  <EnglishNumberInput
                    value={refundAmountMinor}
                    kind="money"
                    onNumericChange={value => {
                      setRefundAmountMinor(value);
                      /* تصحيح المراجعة R5-008: تحرير المبلغ يمسح الخطأ القديم. */
                      setRefundFeedback(null);
                    }}
                    onTextValidityChange={setValidRefund}
                    aria-label="مبلغ دفع الرد"
                  />
                </label>
                <LocalDateField
                  label="تاريخ دفع الرد"
                  value={refundDate}
                  onChange={event => setRefundDate(event.target.value)}
                />
                <label className="micro-field">
                  <span>من أي محفظة؟ (اختياري)</span>
                  <select value={refundWalletId} onChange={event => setRefundWalletId(event.target.value)}>
                    <option value="">غير موزع</option>
                    {wallets.map(wallet => (
                      <option key={wallet.id} value={wallet.id}>
                        {wallet.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="micro-form-actions">
                  <Button
                    action="save"

                    disabled={saving}
                    onClick={() => {
                      void submitRefundPayment();
                    }}
                  >
                    {saving ? "جارٍ تسجيل دفع الرد…" : "سجّل دفع الرد"}
                  </Button>
                </div>
                {/* تصحيح المراجعة R5-002: تغذية راجعة محلية للقسم — الخطأ alert
                    والنجاح status بجوار زر الفعل لا في قناة الخطأ البعيدة. */}
                {refundFeedback ? (
                  <p
                    className={refundFeedback.kind === "error" ? "micro-field-error" : "micro-save-note"}
                    role={refundFeedback.kind === "error" ? "alert" : "status"}
                  >
                    {refundFeedback.text}
                  </p>
                ) : null}
              </>
            ) : (
              <p role="status">لا دفع رد قائمًا على هذا البيع.</p>
            )}
          </details>
        </section>
      ) : null}
    </section>
  );
}
