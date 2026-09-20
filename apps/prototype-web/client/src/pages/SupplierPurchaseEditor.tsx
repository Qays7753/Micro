/** Style: Micro «مسار القرار» — short, phone-first material-purchase record; no inventory or expense claims. */
/* مبدأ Micro: يوضح مسار الشراء أثر الكاش أو الذمة، ويعرض تواريخه دون تحويله إلى تكلفة بيع. */
/* المجموعة ٢ (§10.4): مسار `:id` صار سطح تفاصيل الشراء وتصحيحه — تعديل موثق بمعاينة
 * أثر قبل الحفظ، وتراجع موثق عن الدفعات اللاحقة؛ الدفع الأولي يُصحح بتعديل الشراء نفسه. */
import { ArrowRight, PackagePlus, RotateCcw, Save, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { withReturnTo } from "@/app/navigationContract";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { useDisabledCapabilities } from "@/app/useDisabledCapabilities";
import { STALE_CONFLICT_NOTE, STALE_RELOAD_ACTION_LABEL, STALE_RELOADED_NOTE } from "@/app/resultFeedback";
import { CorrectionPreview } from "@/components/finance/CorrectionPreview";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { EnglishQuantityInput } from "@/components/forms/EnglishQuantityInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { FormDraftRestoreBanner } from "@/components/forms/FormDraftRestoreBanner";
import { useFormDraft } from "@/components/forms/useFormDraft";
import { useFormDirty } from "@/components/forms/useFormDirty";
import { LocalDateValue, MoneyValue, QuantityValue } from "@/components/presentation/DisplayValue";
import {
  formatLocalDate,
  formatMoneyMinor,
  formatQuantityMilli,
  localDateInAmman,
} from "@/presentation/formatters";
import type { SupplierPurchase, SupplierPurchasePayment } from "@micro-domain/supplier-purchase/index.js";
import type { Material } from "@micro-domain/inventory-material/index.js";
import type { PurchaseReceiptStatus } from "@/application/inventory/inventoryMaterialService";

import { Button } from "@/components/primitives";
const ammanDate = () => localDateInAmman();

type EditorMode = "new" | "payment" | "edit";

/* FIN-003 (قرار المالك المعتمد ٢٠٢٦-٠٩-١٦): مصدر دفعة المورد — القيمة
 * الفارغة = الكاش غير الموزع (خيار صريح)، والقيمة الحرجة تعني «لم يُختر
 * بعد» في حالة المحافظ المتعددة حيث الاختيار إلزامي. */
const UNSET_PAYMENT_SOURCE = "__unset__";

export default function SupplierPurchaseEditor() {
  const { id } = useParams<{ id?: string }>();
  const [location, navigate] = useLocation();
  const isNew = id === "new";
  /* المجموعة ٢: `/suppliers/purchase/:id` = تفاصيل وتصحيح؛ `/payment` = دفعة. */
  const mode: EditorMode = isNew ? "new" : /\/payment\/?$/u.test(location) ? "payment" : "edit";
  /* المجموعة ١ (Scope A): الرجوع يعود للمصدر (?from) مع بديل قانوني موثّق. */
  const returnPath = useReturnPath();
  const { supplierPurchases, inventory, notifyDataChanged, dataVersion, formDrafts, cashContinuity } =
    usePrototypeServices();
  /* G-004: المخزون متوقف عن الإدخال — وصلتا استلام المواد في المخزون تختفيان؛
   * الشراء والدفعات والذمم القائمة كما هي (وعد الإعدادات). */
  const { disabled: disabledCapabilities } = useDisabledCapabilities();
  const inventoryEntryEnabled = !disabledCapabilities.includes("inventory");
  const [purchase, setPurchase] = useState<SupplierPurchase | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [loadedToken, setLoadedToken] = useState(0);
  const [supplierName, setSupplierName] = useState("");
  const [note, setNote] = useState("");
  const [purchasedOn, setPurchasedOn] = useState(() => ammanDate());
  const [dueOn, setDueOn] = useState("");
  const [totalMinor, setTotalMinor] = useState(0);
  const [initialPaidMinor, setInitialPaidMinor] = useState(0);
  const [paymentMinor, setPaymentMinor] = useState(0);
  const [validMoney, setValidMoney] = useState(true);
  /* التحصين الكامل (المجموعة ٣): ملاحظة مُطبوعة النبرة بدل تخمين البادئة
   * العربية — الفشل خطأ ظاهر دائمًا لا نجاحًا مزيفًا. */
  const [feedback, setFeedback] = useState<{
    tone: "error" | "success" | "info";
    text: string;
    source: "purchase" | "payment" | "edit" | "reversal";
  } | null>(null);
  /* عقد §31 (المجموعة ٢): تعارض قِدم التخزين يصل مُطبوعًا (storage_stale) —
   * رحلة استرجاع صريحة: إعادة قراءة ثم قرار واعٍ، لا تكرار أعمى. */
  const [staleConflict, setStaleConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  /* المجموعة ٢ (عقد ٢٨ / TR-07): ربط المادة والكمية المتوقعة وحالة الاستلام. */
  const [materialId, setMaterialId] = useState("");
  const [expectedQuantityMilli, setExpectedQuantityMilli] = useState(0);
  const [quantityValid, setQuantityValid] = useState(true);
  const [materialOptions, setMaterialOptions] = useState<readonly Material[]>([]);
  const [receiptStatus, setReceiptStatus] = useState<PurchaseReceiptStatus | null>(null);
  /* وضع التعديل: خطوتان — تعبئة ثم معاينة الأثر قبل الحفظ (المجموعة ٢ §10.2). */
  const [editing, setEditing] = useState(false);
  const [editReason, setEditReason] = useState("");
  /* وضع التراجع عن دفعة: الدفعة المستهدفة وسببها. */
  const [reversalTarget, setReversalTarget] = useState<SupplierPurchasePayment | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  /* EXE-011 (PUR-001 / AUD-NEW-08): شراء مرتبط بمادة متتبَّعة — استمرار صريح
   * إلى رحلة الاستلام بعد الحفظ بدل الخروج الصامت إلى القائمة؛ والعودة إلى
   * المصدر تبقى فعلًا ثانيًا صريحًا فيحيى عقد ٢٦ قاعدة ٣ بلا حذف. */
  const [receiptContinuation, setReceiptContinuation] = useState<{ purchaseId: string } | null>(null);
  const idempotencyKey = useRef(`supplier-ui-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);
  const editKeyRef = useRef(`supplier-edit-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);
  const reversalKeyRef = useRef(`payment-reversal-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);
  /* FIN-003: خيارات المحافظ ومصدر الدفعة المختار — لا تذكر آخر اختيار. */
  const [walletOptions, setWalletOptions] = useState<readonly { id: string; name: string }[]>([]);
  const [paymentWalletId, setPaymentWalletId] = useState<string>(UNSET_PAYMENT_SOURCE);
  const paymentSourceChosenRef = useRef(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const overview = await cashContinuity.overview();
      if (active && overview.ok)
        setWalletOptions(overview.value.wallets.map(wallet => ({ id: wallet.id, name: wallet.name })));
    })();
    return () => {
      active = false;
    };
  }, [cashContinuity, dataVersion]);

  /* FIN-003: قاعدة مصدر الصرف — بلا محافظ: غير الموزع (بتحذير معلن)؛
   * محفظة واحدة: تُعيّن مسبقًا بشكل مرئي؛ محافظ متعددة: اختيار إلزامي صريح
   * (محفظة أو الكاش غير الموزع) — لا اختيار صامت نيابة عن المالك. */
  useEffect(() => {
    if (paymentSourceChosenRef.current) return;
    if (walletOptions.length === 1) setPaymentWalletId(walletOptions[0]!.id);
    else if (walletOptions.length === 0) setPaymentWalletId("");
    else setPaymentWalletId(UNSET_PAYMENT_SOURCE);
  }, [walletOptions]);

  useEffect(() => {
    if (isNew || !id) return;
    supplierPurchases.list().then(result => {
      if (result.ok) {
        const found = result.value.find(item => item.id === id) ?? null;
        setPurchase(found);
        if (found) {
          /* وضع التعديل يبدأ معبّأً بقيم الشراء الحالية — البديل هو ما يُصحّح. */
          setSupplierName(found.supplierName);
          setNote(found.note);
          setPurchasedOn(found.purchasedOn);
          setDueOn(found.dueOn ?? "");
          setTotalMinor(found.totalMinor);
          const initial = found.payments.find(payment => payment.id === `${found.id}:initial`);
          setInitialPaidMinor(initial?.amountMinor ?? 0);
          /* المجموعة ٢ (عقد ٢٨): ربط المادة والكمية المتوقعة من السجل. */
          setMaterialId(found.materialId ?? "");
          setExpectedQuantityMilli(found.expectedQuantityMilli ?? 0);
        }
      }
      setLoading(false);
      setLoadedToken(token => token + 1);
    });
  }, [id, isNew, supplierPurchases, dataVersion]);
  /* المجموعة ٢ (عقد ٢٨): خيارات المواد لكل الأنواع (متتبَّعة وغير متتبَّة) —
   * الربط اختياري، والاستلام لاحقًا على المادة المتتبَّعة. */
  useEffect(() => {
    if (mode === "payment") return;
    inventory.references().then(result => {
      if (result.ok) setMaterialOptions(result.value.allMaterials);
    });
  }, [inventory, dataVersion, mode]);
  /* المجموعة ٢ (عقد ٢٨ / TR-07): حالة الاستلام الحية لبطاقة الجسر. */
  useEffect(() => {
    if (mode !== "edit" || !id) {
      setReceiptStatus(null);
      return;
    }
    inventory.purchaseReceiptStatus(id).then(result => {
      if (result.ok) setReceiptStatus(result.value);
    });
  }, [mode, id, inventory, dataVersion]);

  /* U-005 (دورة التدقيق النهائي): حماية المدخلات غير المحفوظة — الرجوع يمر
   * بالحارس: «ابقَ / احفظ ثم اخرج / اخرج بلا حفظ» كبقية المحررات العميقة. */
  const isDirty = useFormDirty(
    [
      supplierName,
      note,
      purchasedOn,
      dueOn,
      totalMinor,
      initialPaidMinor,
      paymentMinor,
      materialId,
      expectedQuantityMilli,
      loadedToken,
    ],
    loadedToken,
  );
  const requestNavigation = useUnsavedChangesGuard({
    isDirty,
    onSave: () => (mode === "payment" ? savePayment() : mode === "edit" ? saveEdit() : savePurchase()),
  });
  /* المجموعة ٥ (عقد ٣٦): مسودة نصية لشراء جديد فقط — وضع الدفع/التعديل فوق
   * سجل قائم لا مسودة له (تعارضه مع السجل النهائي يمنع الاستعادة الصامتة). */
  const purchaseDraft = useFormDraft(formDrafts, "supplier_purchase", isNew ? "new" : null, {
    supplierName: "",
    note: "",
    purchasedOn: ammanDate(),
    dueOn: "",
    totalMinor: 0,
    initialPaidMinor: 0,
    materialId: "",
    expectedQuantityMilli: 0,
  });
  const restoredFromOffer = useRef(false);
  useEffect(() => {
    if (!isNew || !isDirty || purchaseDraft.state.phase === "restore-offer") return;
    purchaseDraft.onValuesChanged({
      supplierName,
      note,
      purchasedOn,
      dueOn,
      totalMinor,
      initialPaidMinor,
      materialId,
      expectedQuantityMilli,
    });
  }, [
    supplierName,
    note,
    purchasedOn,
    dueOn,
    totalMinor,
    initialPaidMinor,
    materialId,
    expectedQuantityMilli,
    isDirty,
    isNew,
    purchaseDraft.state.phase,
  ]);
  useEffect(() => {
    if (purchaseDraft.state.phase === "drafting" && restoredFromOffer.current) {
      restoredFromOffer.current = false;
      const saved = purchaseDraft.state.values;
      setSupplierName(String(saved.supplierName ?? ""));
      setNote(String(saved.note ?? ""));
      setPurchasedOn(String(saved.purchasedOn ?? ammanDate()));
      setDueOn(String(saved.dueOn ?? ""));
      setTotalMinor(Number(saved.totalMinor ?? 0));
      setInitialPaidMinor(Number(saved.initialPaidMinor ?? 0));
      setMaterialId(String(saved.materialId ?? ""));
      setExpectedQuantityMilli(Number(saved.expectedQuantityMilli ?? 0));
    }
    if (purchaseDraft.state.phase === "restore-offer") restoredFromOffer.current = true;
  }, [purchaseDraft.state.phase]);

  function reportFailure(
    result: { ok: false; code: string; message: string },
    source: "purchase" | "payment" | "edit" | "reversal",
  ): void {
    if (result.code === "storage_stale") setStaleConflict(true);
    setFeedback({ tone: "error", text: result.message, source });
  }

  /* FIN-003: وصل صادق يذكر مصدر الدفعة — ما يقوله الوصل هو ما حدث فعلًا. */
  function paymentFeedbackText(amountMinor: number): string {
    if (!(amountMinor > 0)) return "تم الحفظ محليًا.";
    if (walletOptions.length === 0)
      return "تم حفظ الدفعة من الكاش غير الموزع — لا محافظ معلنة بعد؛ يمكن تغطيتها لاحقًا من مالي.";
    const walletName = walletOptions.find(wallet => wallet.id === paymentWalletId)?.name;
    return walletName
      ? `تم حفظ الدفعة من «${walletName}» — خُصمت من رصيدها مرة واحدة.`
      : "تم حفظ الدفعة من الكاش غير الموزع — وزّعها أو غطّها من محفظة لاحقًا من مالي.";
  }

  /* رحلة الاسترجاع (§31): إعادة قراءة الشراء الحالي عبر مسار القراءة المعتمد
   * نفسه — قيم المستخدم غير المحفوظة تبقى في الحقول كما هي، ولا يُعاد إرسال
   * القيم القديمة تلقائيًا؛ الحفظ الثاني قرار واعٍ بعد المراجعة. */
  async function reloadCurrentPurchase(): Promise<void> {
    if (!id || isNew) return;
    const result = await supplierPurchases.list();
    if (!result.ok) {
      setFeedback({ tone: "error", text: result.message, source: "payment" });
      return;
    }
    const found = result.value.find(item => item.id === id) ?? null;
    setStaleConflict(false);
    setPurchase(found);
    if (found) setFeedback({ tone: "info", text: STALE_RELOADED_NOTE, source: "payment" });
  }

  async function savePurchase(): Promise<boolean> {
    if (!validMoney || totalMinor <= 0 || initialPaidMinor < 0) {
      setFeedback({ tone: "error", text: "أدخل إجماليًا صالحًا بالأرقام 0–9.", source: "purchase" });
      return false;
    }
    if (initialPaidMinor > totalMinor) {
      setFeedback({
        tone: "error",
        text: "لا يمكن أن يتجاوز المدفوع الآن إجمالي الشراء.",
        source: "purchase",
      });
      return false;
    }
    /* FIN-003: مصدر الدفعة الأولية — إلزامي صريح عند تعدد المحافظ. */
    if (initialPaidMinor > 0 && walletOptions.length > 1 && paymentWalletId === UNSET_PAYMENT_SOURCE) {
      setFeedback({
        tone: "error",
        text: "اختر مصدر الصرف لهذه الدفعة: محفظة أو الكاش غير الموزع.",
        source: "purchase",
      });
      return false;
    }
    setSaving(true);
    setFeedback(null);
    const result = await supplierPurchases.recordPurchase({
      supplierName,
      note,
      purchasedOn,
      dueOn: dueOn || null,
      totalMinor,
      initialPaidMinor,
      idempotencyKey: idempotencyKey.current,
      /* المجموعة ٢ (عقد ٢٨): ربط المادة والكمية المتوقعة — اختياري. */
      materialId: materialId || null,
      expectedQuantityMilli: expectedQuantityMilli > 0 ? expectedQuantityMilli : null,
      /* FIN-003: مصدر الدفعة الأولية كما اختاره المالك. */
      initialPaymentWalletId:
        initialPaidMinor > 0 && paymentWalletId && paymentWalletId !== UNSET_PAYMENT_SOURCE
          ? paymentWalletId
          : null,
    });
    setSaving(false);
    if (!result.ok) {
      reportFailure(result, "purchase");
      return false;
    }
    notifyDataChanged();
    /* مراجعة 5-RV-C: المسودة تُحذف بعد نجاح الحفظ في الحالتين — إعادة الاستخدام
     * تعني أن السجل النهائي موجود أصلًا فبقاء المسودة يعرّض استعادتها لاحقًا
     * لإنشاء تكرار. */
    await purchaseDraft.clearFormDraft();
    setStaleConflict(false);
    setFeedback(
      result.reused
        ? { tone: "info", text: "هذا الشراء محفوظ سابقًا؛ لم نكرر أثره.", source: "purchase" }
        : {
            tone: "success",
            text: paymentFeedbackText(initialPaidMinor),
            source: "purchase",
          },
    );
    if (result.attributionNote) {
      setFeedback({ tone: "info", text: result.attributionNote, source: "purchase" });
    }
    /* EXE-011 (PUR-001 / AUD-NEW-08): حفظ شراء مرتبط بمادة متتبَّعة يعرض
     * استمرارًا واضحًا إلى الاستلام — الشراء نفسه لا يضيف مخزونًا، والجسر
     * هو الرحلة الصريحة. المادة غير المتتبَّعة تبقى على مسارها المعلن
     * (تفعيل المتابعة أولًا) فلا نعرض زر استلام مضللًا. */
    const linkedMaterialTracked =
      materialId &&
      (materialOptions.find(material => material.id === materialId)?.tracking?.status ?? "untracked") !==
        "untracked";
    if (!result.reused && result.value.materialId && linkedMaterialTracked) {
      setReceiptContinuation({ purchaseId: result.value.id });
      return true;
    }
    /* S1-07: الخروج بعد حفظ ناجح يعود للمصدر (?from) — عقد ٢٦ قاعدة ٣. */
    if (!result.reused) navigate(returnPath);
    return true;
  }
  async function savePayment(): Promise<boolean> {
    if (!purchase || !validMoney || paymentMinor <= 0) {
      setFeedback({ tone: "error", text: "أدخل دفعة صالحة بالأرقام 0–9.", source: "payment" });
      return false;
    }
    /* FIN-003: الاختيار إلزامي عند تعدد المحافظ — محفظة أو غير الموزع صراحةً. */
    if (walletOptions.length > 1 && paymentWalletId === UNSET_PAYMENT_SOURCE) {
      setFeedback({
        tone: "error",
        text: "اختر مصدر الصرف لهذه الدفعة: محفظة أو الكاش غير الموزع.",
        source: "payment",
      });
      return false;
    }
    setSaving(true);
    setFeedback(null);
    const result = await supplierPurchases.recordPayment({
      purchaseId: purchase.id,
      amountMinor: paymentMinor,
      occurredOn: purchasedOn,
      note: note || "دفعة مورد",
      idempotencyKey: idempotencyKey.current,
      /* FIN-003: مصدر الدفعة كما اختاره المالك — يُتحقق ويُخصم مرة واحدة. */
      walletId: paymentWalletId && paymentWalletId !== UNSET_PAYMENT_SOURCE ? paymentWalletId : null,
    });
    setSaving(false);
    if (!result.ok) {
      reportFailure(result, "payment");
      return false;
    }
    notifyDataChanged();
    setStaleConflict(false);
    setFeedback(
      result.reused
        ? { tone: "info", text: "هذه الدفعة محفوظة سابقًا؛ لم نكرر أثرها.", source: "payment" }
        : {
            tone: "success",
            text: paymentFeedbackText(paymentMinor),
            source: "payment",
          },
    );
    /* FIN-003: فشل النسبة المتأخر يُعلن قبل الخروج — لا حالة مضللة. */
    if (result.attributionNote) {
      setFeedback({ tone: "info", text: result.attributionNote, source: "payment" });
      return true;
    }
    /* S1-07: الخروج بعد حفظ ناجح يعود للمصدر (?from) — عقد ٢٦ قاعدة ٣. */
    if (!result.reused) navigate(returnPath);
    return true;
  }

  /* المجموعة ٢ (§10.4): التعديل الموثق — مراجعة + سبب + حفظ يمر بالخدمة. */
  async function saveEdit(): Promise<boolean> {
    if (!purchase || !validMoney || totalMinor <= 0 || initialPaidMinor < 0 || !quantityValid) {
      setFeedback({ tone: "error", text: "أدخل إجماليًا صالحًا بالأرقام 0–9.", source: "edit" });
      return false;
    }
    setSaving(true);
    setFeedback(null);
    const result = await supplierPurchases.editPurchase({
      purchaseId: purchase.id,
      supplierName,
      note,
      purchasedOn,
      dueOn: dueOn || null,
      totalMinor,
      initialPaidMinor,
      reason: editReason,
      idempotencyKey: editKeyRef.current,
      /* المجموعة ٢ (عقد ٢٨): ربط المادة والكمية المتوقعة — جزء المراجعة الموثقة. */
      materialId: materialId || null,
      expectedQuantityMilli: expectedQuantityMilli > 0 ? expectedQuantityMilli : null,
    });
    setSaving(false);
    if (!result.ok) {
      reportFailure(result, "edit");
      return false;
    }
    notifyDataChanged();
    setEditing(false);
    setEditReason("");
    editKeyRef.current = `supplier-edit-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
    setStaleConflict(false);
    setFeedback(
      result.reused
        ? { tone: "info", text: "هذا التعديل موثق سابقًا؛ لم نكرر أثره.", source: "edit" }
        : { tone: "success", text: "تم تعديل الشراء بمراجعة موثقة.", source: "edit" },
    );
    if (!result.reused) {
      setPurchase(result.value);
      setLoadedToken(token => token + 1);
    }
    return true;
  }

  async function savePaymentReversal(): Promise<boolean> {
    if (!purchase || !reversalTarget) return false;
    setSaving(true);
    setFeedback(null);
    const result = await supplierPurchases.reversePayment({
      purchaseId: purchase.id,
      paymentId: reversalTarget.id,
      reason: reversalReason,
      occurredOn: ammanDate(),
      idempotencyKey: reversalKeyRef.current,
    });
    setSaving(false);
    if (!result.ok) {
      reportFailure(result, "reversal");
      return false;
    }
    notifyDataChanged();
    setReversalTarget(null);
    setReversalReason("");
    reversalKeyRef.current = `payment-reversal-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
    setStaleConflict(false);
    setFeedback(
      result.reused
        ? { tone: "info", text: "هذا التراجع موثق سابقًا؛ لم نكرر أثره.", source: "reversal" }
        : { tone: "success", text: "تم التراجع عن الدفعة موثقًا.", source: "reversal" },
    );
    if (!result.reused) {
      setPurchase(result.value);
      setLoadedToken(token => token + 1);
    }
    return true;
  }

  /* معاينة تعديل الشراء: فروق الكاش/الذمة بين الأصل والقيم الجديدة.
   * G5-S6: حُرّك الـuseMemo فوق العوائد المبكرة (loading/غير موجود) — هوك بعد عائد
   * مبكر يغيّر عدد الهوكات بين الرندرات ويرمي React رقم 310 على مسار الدفعة/التعديل. */
  const editPreview = useMemo(() => {
    if (!purchase || mode !== "edit") return null;
    /* الإجمالي والدفع الأولي الجديدان يحددان المدفوع الجديد فوق الدفعات اللاحقة. */
    const laterPayments = purchase.payments
      .filter(payment => payment.id !== `${purchase.id}:initial`)
      .reduce((sum, payment) => sum + payment.amountMinor, 0);
    const reversed = (purchase.paymentReversals ?? []).reduce(
      (sum, reversal) => sum + reversal.amountMinor,
      0,
    );
    const paidAfter = initialPaidMinor + laterPayments - reversed;
    const payableComputed = totalMinor - paidAfter;
    return {
      payableBefore: purchase.payableMinor,
      payableAfter: payableComputed,
      cashBefore: purchase.paidMinor,
      cashAfter: paidAfter,
    };
  }, [purchase, mode, totalMinor, initialPaidMinor]);

  if (loading)
    return (
      <div className="micro-route-loading" role="status">
        جارٍ فتح شراء المورد…
      </div>
    );
  if (!isNew && !purchase)
    return (
      <section className="micro-page micro-not-found">
        <h1>شراء المواد غير موجود</h1>
        <p>قد يكون السجل حُذف من هذا الجهاز أو لم يعد متاحًا.</p>
        <Button
          action="secondary"

          onClick={() => navigate("/suppliers")}
        >
          مشتريات المواد
        </Button>
      </section>
    );

  const reversalPreview =
    reversalTarget && purchase
      ? {
          payment: reversalTarget,
          payableBefore: purchase.payableMinor,
          payableAfter: purchase.payableMinor + reversalTarget.amountMinor,
          paidBefore: purchase.paidMinor,
          paidAfter: purchase.paidMinor - reversalTarget.amountMinor,
        }
      : null;

  const paymentMode = mode === "payment";
  return (
    <section className="micro-page micro-finance-page">
      <button className="micro-back-button" type="button" onClick={() => requestNavigation(returnPath)}>
        <ArrowRight aria-hidden="true" /> مشتريات المواد
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">
          {paymentMode ? "دفعة مورد" : mode === "edit" ? "تفاصيل شراء وتصحيحه" : "شراء مواد"}
        </span>
        <h1>
          {paymentMode
            ? `دفعة إلى ${purchase?.supplierName ?? ""}`
            : mode === "edit"
              ? `شراء من ${purchase?.supplierName ?? ""}`
              : "سجّل شراء مواد"}
        </h1>
        <p>
          {paymentMode
            ? "الدفع يخفض ما بقي لهذا الشراء ولا يسجل مصروفًا مرة ثانية."
            : mode === "edit"
              ? "عدّل الشراء بتصحيح موثق يُعرض أثره قبل الحفظ؛ والدفعة الأولية تُصحح هنا لا بتراجع منفصل."
              : "سجّل واقع الشراء والدفع المتفق عليه. لن تحوله Micro إلى تكلفة بيع أو مخزون حتى المرحلة التالية."}
        </p>
      </div>
      {staleConflict ? (
        <section className="micro-cancel-panel" data-testid="stale-conflict-card">
          <p className="micro-warning-copy" role="alert">
            {STALE_CONFLICT_NOTE}
          </p>
          <div className="micro-form-actions micro-contextual-actions">
            <Button
              action="secondary"

              disabled={saving}
              onClick={() => {
                void reloadCurrentPurchase();
              }}
            >
              {STALE_RELOAD_ACTION_LABEL}
            </Button>
          </div>
        </section>
      ) : null}
      {isNew && purchaseDraft.state.phase === "restore-offer" ? (
        <FormDraftRestoreBanner
          savedAt={purchaseDraft.state.savedAt}
          onRestore={purchaseDraft.restoreDraft}
          onDiscard={purchaseDraft.discardDraft}
        />
      ) : null}
      {isNew && purchaseDraft.state.phase === "drafting" && purchaseDraft.state.saveFailed ? (
        <p className="micro-field-error" role="alert">
          تعذر حفظ المسودة محليًا — قيمك أمامك كما هي ولم يُسجّل أي شراء؛ أكمل الكتابة أو الحفظ النهائي.
        </p>
      ) : isNew && purchaseDraft.state.phase === "drafting" && purchaseDraft.state.lastSavedAt ? (
        <p className="micro-offline-truth" role="status">
          مسودتك محفوظة محليًا — آخر حفظ{" "}
          <bdi dir="ltr">{formatLocalDate(localDateInAmman(purchaseDraft.state.lastSavedAt))}</bdi>؛ لم يُسجّل
          شراء بعد.
        </p>
      ) : null}
      {mode === "edit" && purchase ? (
        <>
          <section className="micro-decision-card">
            <span>حقيقة هذا الشراء الآن (د.أ)</span>
            <strong>
              <MoneyValue minor={purchase.totalMinor} /> إجمالي · <MoneyValue minor={purchase.paidMinor} />{" "}
              مدفوع · <MoneyValue minor={purchase.payableMinor} /> متبقٍ
            </strong>
            <p>
              {purchase.note} · اشتري في <LocalDateValue value={purchase.purchasedOn} />
              {/* المجموعة ٦ (البند ٥): تاريخ الاستحقاق رقمي DD/MM/YYYY بجدار
                  ثنائي الاتجاه — لا نص ISO خام. */}
              {purchase.dueOn ? (
                <>
                  {" · يستحق في "}
                  <LocalDateValue value={purchase.dueOn} />
                </>
              ) : (
                ""
              )}
            </p>
            <p>تكلفة الشراء ليست مصروف بيع — تدخل النتيجة عند الاستهلاك مستقبلًا؛ أثره الآن كاش وذمة مورد.</p>
          </section>
          {/* المجموعة ٢ (عقد ٢٨ / TR-07): بطاقة جسر الاستلام — المستلم والمتبقي
              قبل الدفعات (تدفق البضاعة مقابل تدفق النقد)، والفعل نص واضح لا تحويل صامت. */}
          {receiptStatus ? (
            <section
              className="micro-inventory-inactive"
              aria-label="الاستلام في المخزون"
              data-testid="purchase-receipt-card"
            >
              <PackagePlus aria-hidden="true" />
              <div>
                <span className="micro-overline">الاستلام في المخزون</span>
                <p>
                  قيمة مستلمة:{" "}
                  <MoneyValue minor={receiptStatus.receivedValueMinor} className="micro-inline-number" /> من{" "}
                  <MoneyValue minor={receiptStatus.totalMinor} className="micro-inline-number" /> د.أ
                  {receiptStatus.remainingQuantityMilli !== null
                    ? ` · كمية مستلمة: ${formatQuantityMilli(receiptStatus.receivedQuantityMilli ?? 0)} من ${formatQuantityMilli(receiptStatus.expectedQuantityMilli ?? 0)} بوحدة المادة`
                    : " · لا كمية متوقعة مسجلة — الحد على القيمة فقط."}
                </p>
                {receiptStatus.receipts.length > 0 ? (
                  <details>
                    <summary>حركات استلام مسجلة ({receiptStatus.receipts.length})</summary>
                    {receiptStatus.receipts.map(receipt => (
                      <div key={receipt.id}>
                        <small>
                          <LocalDateValue value={receipt.occurredOn} /> ·{" "}
                          <QuantityValue valueMilli={receipt.quantityMilli} className="micro-inline-number" />{" "}
                          · <MoneyValue minor={receipt.valueMinor} className="micro-inline-number" />
                          {receipt.reversed ? " · مرتدة موثقًا" : ""}
                        </small>
                      </div>
                    ))}
                  </details>
                ) : null}
              </div>
              {receiptStatus.remainingValueMinor > 0 ? (
                materialOptions.find(material => material.id === (purchase.materialId ?? materialId))
                  ?.tracking?.status === "untracked" ? (
                  <small>للاستلام لاحقًا: فعّل متابعة المادة أولًا.</small>
                ) : inventoryEntryEnabled ? (
                  <Button
                    action="create"

                    onClick={() =>
                      navigate(
                        withReturnTo(
                          `/inventory/movement/receipt?purchase=${encodeURIComponent(purchase.id)}`,
                          `/suppliers/purchase/${encodeURIComponent(purchase.id)}`,
                        ),
                      )
                    }
                  >
                    <PackagePlus aria-hidden="true" /> استلم المواد في المخزون
                  </Button>
                ) : (
                  <small>إدخال المخزون متوقف من الإعدادات — استُلم الشراء قيمته دون حركة مخزون.</small>
                )
              ) : (
                <small>استُلمت قيمة هذا الشراء كاملة.</small>
              )}
            </section>
          ) : null}
          {/* الدفعات اللاحقة: التراجع الموثق من هنا (المجموعة ٢ §10.4). */}
          {purchase.payments.filter(payment => payment.id !== `${purchase.id}:initial`).length > 0 ? (
            <section className="micro-supplier-list" aria-label="دفعات مسجلة">
              <div className="micro-finance-event-heading">
                <span className="micro-overline">دفعات لاحقة مسجلة</span>
                <h2>تراجع موثق عند الحاجة</h2>
              </div>
              {purchase.payments
                .filter(payment => payment.id !== `${purchase.id}:initial`)
                .map(payment => {
                  const reversed = (purchase.paymentReversals ?? []).some(
                    reversal => reversal.paymentId === payment.id,
                  );
                  return (
                    <article key={payment.id}>
                      <div>
                        <strong>
                          <MoneyValue minor={payment.amountMinor} /> د.أ · {payment.note}
                        </strong>
                        <small>
                          <LocalDateValue value={payment.occurredOn} />
                          {/* FIN-003: مصدر الدفعة يظهر معها — والقديمة بلا مصدر تبقى «غير الموزع». */}
                          {payment.walletId
                            ? ` · من «${walletOptions.find(wallet => wallet.id === payment.walletId)?.name ?? "محفظة محذوفة"}»`
                            : " · من الكاش غير الموزع"}
                          {reversed ? " · مرتدة موثقًا" : ""}
                        </small>
                      </div>
                      {!reversed ? (
                        <Button
                          action="quiet"

                          onClick={() => {
                            setReversalTarget(payment);
                            setReversalReason("");
                          }}
                        >
                          <RotateCcw aria-hidden="true" /> تراجع موثق
                        </Button>
                      ) : null}
                    </article>
                  );
                })}
            </section>
          ) : null}
          {reversalPreview ? (
            <CorrectionPreview
              action="تراجع موثق عن دفعة مورد"
              originalLabel={`دفعة ${formatMoneyMinor(reversalPreview.payment.amountMinor)} د.أ لـ${purchase.supplierName}`}
              originalDetail={reversalPreview.payment.note}
              intro="الدفعة الأصلية تبقى في السجل وعلاقة التدقيق صريحة؛ التراجع يستعيد المتبقي للمورد ويرد أثر الكاش المدفوع."
              dimensions={[
                {
                  label: "الكاش المدفوع للمورد",
                  beforeMinor: reversalPreview.paidBefore,
                  afterMinor: reversalPreview.paidAfter,
                },
                {
                  label: "ذمة المورد",
                  beforeMinor: reversalPreview.payableBefore,
                  afterMinor: reversalPreview.payableAfter,
                },
                { label: "مصروف/نتيجة الفترة", beforeMinor: 0, afterMinor: 0 },
              ]}
              unchanged={["تكلفة الشراء لا تتغير — لا مصروف يُنشأ ولا يُلغى"]}
              resulting={[{ label: "المتبقي للمورد بعد التراجع", amountMinor: reversalPreview.payableAfter }]}
              reversibleNote="تراجع واحد لكل دفعة — لا يُنشأ تراجع ثانٍ لنفس الدفعة."
              reason={reversalReason}
              onReasonChange={setReversalReason}
              reasonPlaceholder="مثال: رُدّت الدفعة بالتحويل خطأً"
              error={feedback?.tone === "error" && feedback.source === "reversal" ? feedback.text : null}
              busy={saving}
              confirmLabel="أكّد التراجع الموثق"
              busyLabel="جارٍ توثيق التراجع…"
              onConfirm={() => void savePaymentReversal()}
              onCancel={() => {
                setReversalTarget(null);
                setReversalReason("");
              }}
            />
          ) : null}
          {!editing ? (
            <div className="micro-form-actions">
              <Button
                action="secondary"

                onClick={() => setEditing(true)}
              >
                <Undo2 aria-hidden="true" /> عدّل هذا الشراء
              </Button>
              <Button
                action="secondary"

                onClick={() =>
                  requestNavigation(`/suppliers/purchase/${encodeURIComponent(purchase.id)}/payment`)
                }
              >
                سجّل دفعة إضافية
              </Button>
            </div>
          ) : null}
          {editing ? (
            <section className="micro-form-card" aria-label="تعديل الشراء">
              <label className="micro-field">
                <span>اسم المورد</span>
                <input
                  value={supplierName}
                  onChange={event => setSupplierName(event.target.value)}
                  placeholder="مثال: مورد الخشب"
                />
              </label>
              <label className="micro-field">
                <span>ماذا اشتريت؟</span>
                <textarea value={note} onChange={event => setNote(event.target.value)} />
              </label>
              {/* المجموعة ٢ (عقد ٢٨): ربط المادة والكمية المتوقعة — تعبئة جسر الاستلام لاحقًا. */}
              <label className="micro-field">
                <span>
                  المادة المشتراة <small>اختيارية — لربط الاستلام لاحقًا</small>
                </span>
                <select value={materialId} onChange={event => setMaterialId(event.target.value)}>
                  <option value="">بلا ربط مادة</option>
                  {materialOptions.map(material => (
                    <option key={material.id} value={material.id}>
                      {material.name}
                      {material.tracking?.status === "untracked" ? " (للتكلفة فقط)" : ""}
                    </option>
                  ))}
                </select>
                {materialOptions.find(material => material.id === materialId)?.tracking?.status ===
                "untracked" ? (
                  <small>للاستلام لاحقًا: فعّل متابعة المادة أولًا.</small>
                ) : null}
              </label>
              {materialId ? (
                <label className="micro-field">
                  <span>
                    الكمية المتوقعة <small>اختيارية — تحدّد حد الاستلام من هذا الشراء</small>
                  </span>
                  <EnglishQuantityInput
                    valueMilli={expectedQuantityMilli}
                    onMilliChange={setExpectedQuantityMilli}
                    onTextValidityChange={setQuantityValid}
                    aria-label="الكمية المتوقعة"
                  />
                </label>
              ) : null}
              <LocalDateField
                label="تاريخ الشراء"
                value={purchasedOn}
                onChange={event => setPurchasedOn(event.target.value)}
              />
              <div className="micro-field-grid">
                <label className="micro-field">
                  <span>إجمالي الشراء (د.أ)</span>
                  <EnglishNumberInput
                    value={totalMinor}
                    kind="money"
                    onNumericChange={setTotalMinor}
                    onTextValidityChange={setValidMoney}
                    aria-label="إجمالي الشراء بالدينار الأردني"
                  />
                </label>
                <label className="micro-field">
                  <span>الدفع الأولي (د.أ)</span>
                  <EnglishNumberInput
                    value={initialPaidMinor}
                    kind="money"
                    onNumericChange={setInitialPaidMinor}
                    onTextValidityChange={setValidMoney}
                    aria-label="الدفع الأولي بالدينار الأردني"
                  />
                </label>
              </div>
              <LocalDateField
                label="تاريخ الاستحقاق إن عرفت"
                description="اتركه فارغًا إذا لم تتفق على موعد واضح."
                value={dueOn}
                onChange={event => setDueOn(event.target.value)}
              />
              {editPreview ? (
                <CorrectionPreview
                  action="تعديل موثق لسجل الشراء"
                  originalLabel={`شراء من ${purchase.supplierName} · ${formatMoneyMinor(purchase.totalMinor)} د.أ`}
                  originalDetail={`دفع أولي ${formatMoneyMinor(
                    purchase.payments.find(payment => payment.id === `${purchase.id}:initial`)?.amountMinor ??
                      0,
                  )} د.أ`}
                  intro="التعديل يُحفظ بمراجعة موثقة تحفظ القيم قبل التصحيح؛ الدفعات اللاحقة وتراجعاتها لا تُمس."
                  dimensions={[
                    {
                      label: "ذمة المورد",
                      beforeMinor: editPreview.payableBefore,
                      afterMinor: editPreview.payableAfter,
                    },
                    {
                      label: "الكاش المدفوع للمورد",
                      beforeMinor: editPreview.cashBefore,
                      afterMinor: editPreview.cashAfter,
                    },
                    { label: "مصروف/نتيجة الفترة", beforeMinor: 0, afterMinor: 0 },
                  ]}
                  unchanged={["الدفعات اللاحقة كما سُجّلت", "السجل الأصلي باقٍ في التاريخ"]}
                  resulting={[{ label: "المتبقي للمورد بعد التعديل", amountMinor: editPreview.payableAfter }]}
                  reversibleNote="يمكن تصحيح لاحق بتعديل موثق جديد؛ كل مراجعة تُحفظ بقيم ما قبلها."
                  reason={editReason}
                  onReasonChange={setEditReason}
                  reasonPlaceholder="مثال: فاتورة مصححة من المورد"
                  error={feedback?.tone === "error" && feedback.source === "edit" ? feedback.text : null}
                  busy={saving}
                  confirmLabel="أكّد تعديل الشراء"
                  busyLabel="جارٍ حفظ التعديل…"
                  onConfirm={() => void saveEdit()}
                  onCancel={() => {
                    setEditing(false);
                    setEditReason("");
                  }}
                />
              ) : null}
            </section>
          ) : null}
          {/* الأخطاء تظهر داخل CorrectionPreview المفتوح (role=alert) — لا
              تكرار مزدوج للرسالة نفسها بصفتين مختلفتين كما كان قبل المجموعة ٣. */}
          {feedback && feedback.tone !== "error" ? (
            <p className={feedback.tone === "info" ? "micro-local-truth" : "micro-save-note"} role="status">
              {feedback.text}
            </p>
          ) : null}
        </>
      ) : (
        <>
          {paymentMode ? (
            <section className="micro-decision-card">
              <span>المتبقي قبل هذه الدفعة (د.أ)</span>
              <strong>
                <MoneyValue minor={purchase?.payableMinor ?? 0} />
              </strong>
              <p>
                {purchase?.note} · اشتري في <LocalDateValue value={purchase?.purchasedOn ?? ""} />
              </p>
            </section>
          ) : (
            <section className="micro-decision-card">
              <span>حد الحقيقة</span>
              <strong>شراء المواد لا يساوي مصروف بيع</strong>
              <p>سيظهر أثره في الكاش أو ما عليك للمورد فقط، إلى أن نبني المخزون والاستهلاك.</p>
            </section>
          )}
          <section className="micro-form-card">
            {isNew ? (
              <>
                <label className="micro-field">
                  <span>اسم المورد</span>
                  <input
                    value={supplierName}
                    onChange={event => setSupplierName(event.target.value)}
                    placeholder="مثال: مورد الخشب"
                  />
                </label>
                <label className="micro-field">
                  <span>ماذا اشتريت؟</span>
                  <textarea
                    value={note}
                    onChange={event => setNote(event.target.value)}
                    placeholder="مثال: خامات لطلبات قادمة"
                  />
                </label>
                {/* المجموعة ٢ (عقد ٢٨): ربط المادة والكمية المتوقعة — تعبئة جسر الاستلام لاحقًا. */}
                <label className="micro-field">
                  <span>
                    المادة المشتراة <small>اختيارية — لربط الاستلام لاحقًا</small>
                  </span>
                  <select value={materialId} onChange={event => setMaterialId(event.target.value)}>
                    <option value="">بلا ربط مادة</option>
                    {materialOptions.map(material => (
                      <option key={material.id} value={material.id}>
                        {material.name}
                        {material.tracking?.status === "untracked" ? " (للتكلفة فقط)" : ""}
                      </option>
                    ))}
                  </select>
                  {materialOptions.find(material => material.id === materialId)?.tracking?.status ===
                  "untracked" ? (
                    <small>للاستلام لاحقًا: فعّل متابعة المادة أولًا.</small>
                  ) : null}
                </label>
                {materialId ? (
                  <label className="micro-field">
                    <span>
                      الكمية المتوقعة <small>اختيارية — تحدّد حد الاستلام من هذا الشراء</small>
                    </span>
                    <EnglishQuantityInput
                      valueMilli={expectedQuantityMilli}
                      onMilliChange={setExpectedQuantityMilli}
                      onTextValidityChange={setQuantityValid}
                      aria-label="الكمية المتوقعة"
                    />
                  </label>
                ) : null}
                <LocalDateField
                  label="تاريخ الشراء"
                  value={purchasedOn}
                  onChange={event => setPurchasedOn(event.target.value)}
                />
                <div className="micro-field-grid">
                  <label className="micro-field">
                    <span>إجمالي الشراء (د.أ)</span>
                    <EnglishNumberInput
                      value={totalMinor}
                      kind="money"
                      onNumericChange={setTotalMinor}
                      onTextValidityChange={setValidMoney}
                      aria-label="إجمالي الشراء بالدينار الأردني"
                    />
                  </label>
                  <label className="micro-field">
                    <span>ما دُفع الآن</span>
                    <EnglishNumberInput
                      value={initialPaidMinor}
                      kind="money"
                      onNumericChange={setInitialPaidMinor}
                      onTextValidityChange={setValidMoney}
                      aria-label="ما دُفع الآن"
                    />
                  </label>
                </div>
                {/* FIN-003: مصدر الدفعة الأولية — يُستعمل عند دفع مبلغ الآن. */}
                {initialPaidMinor > 0 && walletOptions.length > 0 ? (
                  <label className="micro-field">
                    <span>
                      مصدر الصرف <small>المحفظة تُغطى الدفعة من رصيدها مرة واحدة</small>
                    </span>
                    <select
                      value={paymentWalletId}
                      onChange={event => {
                        paymentSourceChosenRef.current = true;
                        setPaymentWalletId(event.target.value);
                      }}
                      aria-label="مصدر صرف الدفعة الأولية"
                    >
                      {walletOptions.length > 1 ? (
                        <option value={UNSET_PAYMENT_SOURCE} disabled>
                          اختر مصدر الصرف
                        </option>
                      ) : null}
                      <option value="">الكاش غير الموزع</option>
                      {walletOptions.map(wallet => (
                        <option key={wallet.id} value={wallet.id}>
                          {wallet.name} — تغطية من رصيدها
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {initialPaidMinor > 0 && walletOptions.length === 0 ? (
                  <p className="micro-offline-truth" role="status">
                    لا محافظ معلنة بعد — سيُسجَّل ما دُفع الآن من الكاش غير الموزع، ويمكن تغطيته من محفظة
                    لاحقًا من مالي.
                  </p>
                ) : null}
                <LocalDateField
                  label="تاريخ الاستحقاق إن عرفت"
                  description="اتركه فارغًا إذا لم تتفق على موعد واضح."
                  value={dueOn}
                  onChange={event => setDueOn(event.target.value)}
                />
              </>
            ) : (
              <>
                <label className="micro-field">
                  <span>مبلغ الدفعة (د.أ)</span>
                  <EnglishNumberInput
                    value={paymentMinor}
                    kind="money"
                    onNumericChange={setPaymentMinor}
                    onTextValidityChange={setValidMoney}
                    aria-label="مبلغ دفعة المورد"
                  />
                </label>
                {/* FIN-003: مصدر الدفعة اللاحقة — نفس مفردات «مصدر الصرف». */}
                {walletOptions.length > 0 ? (
                  <label className="micro-field">
                    <span>
                      مصدر الصرف <small>المحفظة تُغطى الدفعة من رصيدها مرة واحدة</small>
                    </span>
                    <select
                      value={paymentWalletId}
                      onChange={event => {
                        paymentSourceChosenRef.current = true;
                        setPaymentWalletId(event.target.value);
                      }}
                      aria-label="مصدر صرف دفعة المورد"
                    >
                      {walletOptions.length > 1 ? (
                        <option value={UNSET_PAYMENT_SOURCE} disabled>
                          اختر مصدر الصرف
                        </option>
                      ) : null}
                      <option value="">الكاش غير الموزع</option>
                      {walletOptions.map(wallet => (
                        <option key={wallet.id} value={wallet.id}>
                          {wallet.name} — تغطية من رصيدها
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="micro-offline-truth" role="status">
                    لا محافظ معلنة بعد — ستُسجَّل الدفعة من الكاش غير الموزع، ويمكن تغطيتها من محفظة لاحقًا من
                    مالي.
                  </p>
                )}
                <LocalDateField
                  label="تاريخ الدفعة"
                  value={purchasedOn}
                  onChange={event => setPurchasedOn(event.target.value)}
                />
                <label className="micro-field">
                  <span>وصف قصير للدفعة</span>
                  <textarea
                    value={note}
                    onChange={event => setNote(event.target.value)}
                    placeholder="مثال: دفعة ثانية للمورد"
                  />
                </label>
              </>
            )}
            {feedback ? (
              <p
                className={
                  feedback.tone === "error"
                    ? "micro-field-error"
                    : feedback.tone === "info"
                      ? "micro-local-truth"
                      : "micro-save-note"
                }
                role={feedback.tone === "error" ? "alert" : "status"}
              >
                {feedback.text}
              </p>
            ) : null}
            {receiptContinuation ? (
              /* EXE-011: استمرار الاستلام يحل مكان الحفظ اللصقي — لا حفظ ثانٍ
               * بعد النجاح، بل الخطوة التالية في الرحلة أو عودة صريحة للمصدر. */
              <div
                className="micro-form-actions micro-sticky-save"
                data-testid="purchase-receipt-continuation"
              >
                {/* G-004: المخزون متوقف — لا استمرار استلام (إنشاء حركة)؛
                 * الرجوع للمصدر وحده. */}
                {inventoryEntryEnabled ? (
                  <Button
                    action="create"
                    block

                    onClick={() =>
                      navigate(
                        withReturnTo(
                          `/inventory/movement/receipt?purchase=${encodeURIComponent(receiptContinuation.purchaseId)}`,
                          `/suppliers/purchase/${encodeURIComponent(receiptContinuation.purchaseId)}`,
                        ),
                      )
                    }
                  >
                    <PackagePlus aria-hidden="true" /> استلام المخزون
                  </Button>
                ) : null}
                <Button
                  action="quiet"

                  onClick={() => {
                    setReceiptContinuation(null);
                    navigate(returnPath);
                  }}
                >
                  عودة إلى المصدر
                </Button>
              </div>
            ) : (
              <div className="micro-form-actions micro-sticky-save">
                <Button
                  action="save"
                  block

                  disabled={saving}
                  onClick={paymentMode ? savePayment : savePurchase}
                >
                  <Save aria-hidden="true" />
                  {saving ? "جارٍ الحفظ…" : paymentMode ? "حفظ الدفعة" : "حفظ شراء المواد"}
                </Button>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
