/** Micro G3 UI: phone-first RTL form; one financial action, explicit knowledge, and no hidden allocation. */
/* مبدأ Micro: يشرح الحدث المالي أثره المحلي بوضوح، ولا يختلط عرضه مع نتيجة الطلب أو الربح. */
/* المجموعة ١ (الإدخال المالي الموجّه): تسلسل أسئلة المالك — شو صار؟ قدّش؟ من وين
 * طلع المبلغ؟ على شو؟ طبيعته؟ بخص المشروع ولا مشترك؟ شو راح يتغير بعد الحفظ؟ —
 * مع تصنيف اختياري، ومراجعة توزيع، ومعاينة أثر مشتقة من نية الالتزام نفسها،
 * ومسودة محفوظة لا تُحوَّل سجلًا إلا بفعل صريح. */
import { ArrowRight, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { useLocation, useParams } from "wouter";
import { withFrom } from "@/app/navigationContract";
import { useReturnPath } from "@/app/useReturnNavigation";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { useFormDirty } from "@/components/forms/useFormDirty";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import { EventEffectPreview } from "@/components/presentation/EventEffectPreview";
import { AllocationReviewCard } from "@/components/finance/AllocationReviewCard";
import { formatMoneyMinor, localDateInAmman } from "@/presentation/formatters";
import {
  deriveExpenseCategorySuggestions,
  normalizeCategoryLabelInput,
} from "@/application/finance/expenseCategorySuggestions";
import type { SettleablePayable } from "@/application/finance/projectFinancialService";
import type {
  FinancialEventType,
  OperatingExpenseContext,
  SharedProjectShareBasis,
} from "@micro-domain/financial-event/index.js";

type SharedMode = "fixed" | "percentage" | "estimate" | "defer";
/* المجموعة ٤ (عقد ٢٩): أحداث الأصول والقروض وتصنيف العربون تُنشأ من أسطحها
 * المخصصة لأنها تتطلب ربط سجل مصدر (أصل/قرض/طلب) — المحرر العام يبقى
 * للأفعال المالية المستقلة الثمانية الأصلية فقط. */
type GuidedFinancialEventType = Extract<
  FinancialEventType,
  | "owner_investment_cash"
  | "owner_withdrawal_cash"
  | "operating_expense_cash"
  | "operating_expense_payable"
  | "payable_settlement_cash"
  | "amanah_held_cash"
  | "amanah_released_cash"
  | "loss_non_cash"
>;
const definition: Record<
  GuidedFinancialEventType,
  { title: string; description: string; effect: string; counterparty: string }
> = {
  owner_investment_cash: {
    title: "تسجيل استثمار المالك",
    description: "مال أُدخل للمشروع. ليس مبيعات ولا ربحًا.",
    effect: "يزيد الكاش المسجل ومال المالك فقط.",
    counterparty: "اختياري: مصدر المال",
  },
  owner_withdrawal_cash: {
    title: "تسجيل سحب شخصي",
    description: "مال أخذه المالك من المشروع لاستعمال شخصي.",
    effect: "ينقص الكاش ومال المالك؛ لا يسجل مصروف تشغيل.",
    counterparty: "اختياري: ملاحظة السحب",
  },
  operating_expense_cash: {
    title: "تسجيل مصروف مدفوع",
    description: "خروج كاش فعلي لمصروف تشغيلي معروف.",
    effect: "ينقص الكاش ويسجل مصروفًا، لكنه لا يحمّل تلقائيًا على طلب.",
    counterparty: "الجهة المدفوع لها",
  },
  operating_expense_payable: {
    title: "تسجيل مصروف مستحق",
    description: "مصروف أو فاتورة للمشروع لم تُدفع بعد.",
    effect: "يزيد ما عليك للمورد ويسجل مصروفًا، من دون تغيير الكاش.",
    counterparty: "المورد أو الجهة المستحقة",
  },
  payable_settlement_cash: {
    title: "تسديد التزام",
    description: "دفع كاش مقابل التزام سجلته سابقًا لمورد.",
    effect: "ينقص الكاش وما عليك، ولا يسجل المصروف مرة ثانية.",
    counterparty: "المورد أو الجهة المستحقة",
  },
  /* المبدأ الثالث عشر: المال الذي بحوزتك ليس بالضرورة مالك. */
  amanah_held_cash: {
    title: "تسجيل أمانة قُبضت",
    description: "مال مرّ عبر يدك وليس لك: ثمن طرود لمندوب، مال يحفظ لغيرك.",
    effect: "يزيد الكاش ويرفع رصيد الأمانات؛ لا يمس الإيراد ولا المصروف ولا الربح إطلاقًا.",
    counterparty: "صاحب الأمانة",
  },
  amanah_released_cash: {
    title: "تسجيل أمانة سُلّمت",
    description: "سلّمت لصاحبها أمانة كانت بحوزتك.",
    effect: "ينقص الكاش ورصيد الأمانات معًا؛ لا أثر على الربح.",
    counterparty: "صاحب الأمانة",
  },
  loss_non_cash: {
    title: "تسجيل هالك أو تلف بلا خروج نقد",
    description: "خسارة مادية لم يرافقها دفع: بضاعة تلفت قبل تسجيلها في المخزون.",
    effect: "يخفض ربح الفترة كتكلفة ضائعة؛ لا يغيّر الكاش ولا الذمم.",
    counterparty: "اختياري: مصدر الخسارة",
  },
};
const types = new Set<GuidedFinancialEventType>(Object.keys(definition) as GuidedFinancialEventType[]);
const ammanDate = () => localDateInAmman();
const basisFromMode = (mode: SharedMode): SharedProjectShareBasis =>
  mode === "percentage"
    ? "agreed_percentage"
    : mode === "estimate"
      ? "owner_estimate"
      : mode === "defer"
        ? "needs_review"
        : "agreed_fixed_share";
const knowledgeFromBasis = (basis: SharedProjectShareBasis): OperatingExpenseContext["knowledge"] =>
  basis === "agreed_fixed_share" || basis === "agreed_percentage"
    ? "known"
    : basis === "owner_estimate"
      ? "estimated"
      : "needs_review";
const sourceDescription: Record<SharedProjectShareBasis, string> = {
  agreed_fixed_share: "أدخل حصة المشروع فقط؛ لا يحفظ النظام إجمالي فاتورة البيت.",
  agreed_percentage: "أدخل الإجمالي والنسبة الصريحة؛ يحسب النظام حصة المشروع بدقة ويحفظها في السجل.",
  owner_estimate: "تقديرك الحالي لحصة المشروع؛ تدخل مرة واحدة وتبقى الصورة ناقصة.",
  needs_review: "يحفظ إجمالي المصدر كغير موزّع؛ لا يصبح صفرًا ولا يخصم من النتيجة.",
};
/* المجموعة ١ (مسودة محفوظة — TR-11): مدخلات فقط لا سجلات؛ تُسترجع بفعل صريح
 * ولا تُحوَّل حدثًا ماليًا أبدًا إلا بزر الحفظ. المفتاح لكل نوع على حدة. */
type EditorDraft = {
  amountMinor: number;
  sharedTotalAmountMinor: number;
  sharedPercentage: number;
  date: string;
  note: string;
  counterparty: string;
  relationship: OperatingExpenseContext["relationship"];
  behavior: OperatingExpenseContext["behavior"];
  purpose: OperatingExpenseContext["purpose"];
  knowledge: OperatingExpenseContext["knowledge"];
  sharedMode: SharedMode;
  sharedNote: string;
  categoryLabel: string;
  relatedEventId: string;
  walletId: string;
};
const draftKeyFor = (type: GuidedFinancialEventType): string => `micro.finance-draft.${type}.v1`;
const isEditorDraft = (value: unknown): value is EditorDraft =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as EditorDraft).amountMinor === "number" &&
  typeof (value as EditorDraft).note === "string";

export default function FinancialEventEditor() {
  const { type: rawType } = useParams<{ type: string }>();
  const [, navigate] = useLocation();
  /* المجموعة ١ (Scope A): الرجوع يعود للمصدر (?from) مع بديل قانوني موثّق. */
  const returnPath = useReturnPath();
  const { dataVersion, projectFinance, cashContinuity, notifyDataChanged } = usePrototypeServices();
  const type = types.has(rawType as GuidedFinancialEventType) ? (rawType as GuidedFinancialEventType) : null;
  const [amountMinor, setAmountMinor] = useState(0);
  const [validAmount, setValidAmount] = useState(true);
  const [sharedTotalAmountMinor, setSharedTotalAmountMinor] = useState(0);
  const [validSharedTotal, setValidSharedTotal] = useState(true);
  const [sharedPercentage, setSharedPercentage] = useState(0);
  const [validSharedPercentage, setValidSharedPercentage] = useState(true);
  const [date, setDate] = useState(() => ammanDate());
  const [note, setNote] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [relationship, setRelationship] = useState<OperatingExpenseContext["relationship"]>("project");
  const [behavior, setBehavior] = useState<OperatingExpenseContext["behavior"]>("unknown");
  const [purpose, setPurpose] = useState<OperatingExpenseContext["purpose"]>("project_general");
  const [knowledge, setKnowledge] = useState<OperatingExpenseContext["knowledge"]>("known");
  const [sharedMode, setSharedMode] = useState<SharedMode>("fixed");
  const [sharedNote, setSharedNote] = useState("");
  /* المجموعة ١ (تصنيفي للمصاريف): وسم اختياري حر مع مقترحات مشتقة. */
  const [categoryLabel, setCategoryLabel] = useState("");
  const [suggestions, setSuggestions] = useState<readonly string[]>([]);
  /* المجموعة ١ (الإدخال الموجّه): «من وين طلع المبلغ؟» — وجهة الصرف للمصروف المدفوع. */
  const [wallets, setWallets] = useState<readonly { id: string; name: string }[]>([]);
  const [walletId, setWalletId] = useState("");
  const [payableOptions, setPayableOptions] = useState<readonly SettleablePayable[]>([]);
  const [relatedEventId, setRelatedEventId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /* المجموعة ١ (SA-5/3): عهدة حفظ ناجح — تُغيّر رمز إعادة لقطة الوسخ فيصفر
   * الوسخ بعد الحفظ، فلا يفتح حارس «تغييرات غير محفوظة» بعد نجاح مسجّل. */
  const [savedEpoch, setSavedEpoch] = useState(0);
  /* المجموعة ١ (صدق النسبة بعد الحفظ): المال محفوظ والنسبة فشلت — يبقى النص
   * ظاهرًا قبل أي انتقال مع وصلة للسجل، لا كذب ولا تجاهل (SA-3). */
  const [savedNote, setSavedNote] = useState<{ eventId: string; message: string } | null>(null);
  const savedRef = useRef(false);
  const idempotencyKey = useRef(`finance-ui-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);
  /* المجموعة ١ (مسودة محفوظة): عرض استرجاع عند الفتح فقط — وضع الإنشاء حصريًا. */
  const [draftOffer, setDraftOffer] = useState<EditorDraft | null>(null);

  useEffect(() => {
    projectFinance.listSettleablePayables().then(result => {
      if (result.ok) setPayableOptions(result.value);
    });
  }, [projectFinance, dataVersion]);
  /* F-006: رصيد الأمانات الحالي أمام العين قبل تسليم أي مبلغ — لا اكتشاف بعد الحفظ. */
  const [amanahHeldMinor, setAmanahHeldMinor] = useState<number | null>(null);
  useEffect(() => {
    if (type !== "amanah_released_cash") return;
    let active = true;
    projectFinance.readPosition().then(result => {
      if (active && result.ok) setAmanahHeldMinor(result.value.amanahHeldMinor);
    });
    return () => {
      active = false;
    };
  }, [projectFinance, type, dataVersion]);
  /* المجموعة ١: المقترحات مشتقة من الاستعمال — قراءة فقط فوق سجل الأحداث. */
  useEffect(() => {
    if (type !== "operating_expense_cash" && type !== "operating_expense_payable") return;
    let active = true;
    projectFinance.listEvents().then(result => {
      if (active && result.ok) setSuggestions(deriveExpenseCategorySuggestions(result.value));
    });
    return () => {
      active = false;
    };
  }, [projectFinance, type, dataVersion]);
  /* المجموعة ١: المحافظ لسؤال وجهة الصرف (المصروف المدفوع فقط). */
  useEffect(() => {
    if (type !== "operating_expense_cash") return;
    let active = true;
    cashContinuity.overview().then(result => {
      if (active && result.ok)
        setWallets(result.value.wallets.map(wallet => ({ id: wallet.id, name: wallet.name })));
    });
    return () => {
      active = false;
    };
  }, [cashContinuity, type, dataVersion]);
  /* المجموعة ١ (مسودة محفوظة): العرض عند الفتح، والكتابة عند الوسخ فقط. */
  useEffect(() => {
    if (!type) return;
    const key = draftKeyFor(type);
    try {
      const raw = globalThis.localStorage?.getItem(key);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (isEditorDraft(parsed)) setDraftOffer(parsed);
      }
    } catch {
      /* وضع خاص أو ملف تالف: تُتجاهل المسودة بصمت. */
    }
  }, [type]);

  /* U-005 (دورة التدقيق النهائي): حماية المدخلات غير المحفوظة في محرر الأحداث —
   * الرجوع يمر بالحارس: «ابقَ / احفظ ثم اخرج / اخرج بلا حفظ».
   * G5-S6: حُرّك الهوكان فوق العائد المبكر (!type) — هوك بعد عائد مبكر يغيّر
   * عدد الهوكات بين الرندرات ويرمي React رقم 310 عند تنقل النوع على نفس السطح.
   * المجموعة ١ (إصلاح وصحي): تمرير رمز مستقر (type) يثبّت لقطة الوسخ عند أول
   * رندر — بلا رمز كانت اللقطة تُعاد كل رندر فيبقى الوسخ كاذبًا سلبيًا دائمًا،
   * فيعطل الحارس والمسودة معًا. */
  const isDirty = useFormDirty(
    [
      amountMinor,
      validAmount,
      sharedTotalAmountMinor,
      sharedPercentage,
      date,
      note,
      counterparty,
      relationship,
      behavior,
      purpose,
      knowledge,
      sharedMode,
      sharedNote,
      categoryLabel,
      relatedEventId,
      walletId,
    ],
    `${type}:${savedEpoch}`,
  );
  const requestNavigation = useUnsavedChangesGuard({ isDirty, onSave: () => save() });

  /* المجموعة ١ (مسودة محفوظة): الكتابة عند الوسخ فقط — بعد تعريف الوسخ لا قبله.
   * الحفظ الناجح يوقف الكتابة (savedRef) ويمسح المفتاح في save(). */
  useEffect(() => {
    if (!type || savedRef.current) return;
    const key = draftKeyFor(type);
    try {
      if (isDirty) {
        globalThis.localStorage?.setItem(
          key,
          JSON.stringify({
            amountMinor,
            sharedTotalAmountMinor,
            sharedPercentage,
            date,
            note,
            counterparty,
            relationship,
            behavior,
            purpose,
            knowledge,
            sharedMode,
            sharedNote,
            categoryLabel,
            relatedEventId,
            walletId,
          } satisfies EditorDraft),
        );
      } else {
        globalThis.localStorage?.removeItem(key);
      }
    } catch {
      /* وضع خاص أو حصة ممتلئة: المسودة رفاهية لا عقبة أمام الحفظ. */
    }
  }, [
    type,
    isDirty,
    amountMinor,
    sharedTotalAmountMinor,
    sharedPercentage,
    date,
    note,
    counterparty,
    relationship,
    behavior,
    purpose,
    knowledge,
    sharedMode,
    sharedNote,
    categoryLabel,
    relatedEventId,
    walletId,
  ]);

  if (!type)
    return (
      <section className="micro-page micro-not-found">
        <h1>نوع الحدث غير متاح</h1>
        <p>ارجع إلى الوضع المالي واختر حدثًا واضحًا.</p>
        <button
          className="micro-button micro-button-primary"
          type="button"
          onClick={() => navigate("/finance")}
        >
          الوضع المالي
        </button>
      </section>
    );

  const content = definition[type];
  const isOperatingExpense = type === "operating_expense_cash" || type === "operating_expense_payable";
  const isShared = isOperatingExpense && relationship === "shared";
  const sharedBasis = basisFromMode(sharedMode);
  const sharedKnowledge = knowledgeFromBasis(sharedBasis);
  const normalizedCategoryLabel = normalizeCategoryLabelInput(categoryLabel);
  const expenseContext: OperatingExpenseContext | null = !isOperatingExpense
    ? null
    : relationship === "shared"
      ? {
          relationship,
          behavior,
          purpose,
          knowledge: sharedKnowledge,
          sharedProjectShare: { basis: sharedBasis, note: sharedNote.trim() || null },
          categoryLabel: normalizedCategoryLabel,
        }
      : {
          relationship,
          behavior,
          purpose,
          knowledge,
          sharedProjectShare: null,
          categoryLabel: normalizedCategoryLabel,
        };
  const primaryAmountValid =
    isShared && sharedMode === "percentage"
      ? validSharedTotal &&
        sharedTotalAmountMinor > 0 &&
        validSharedPercentage &&
        sharedPercentage > 0 &&
        sharedPercentage <= 100
      : validAmount && amountMinor > 0;
  const selectedWallet = wallets.find(wallet => wallet.id === walletId) ?? null;
  const sharedExpenseIntent = isShared
    ? sharedMode === "percentage"
      ? {
          mode: "percentage" as const,
          sharedTotalAmountMinor,
          sharedPercentageBps: Math.round(sharedPercentage * 100),
        }
      : sharedMode === "defer"
        ? { mode: "defer" as const, sharedTotalAmountMinor: amountMinor }
        : { mode: sharedMode, amountMinor }
    : undefined;
  const walletNameForPreview = type === "operating_expense_cash" ? (selectedWallet?.name ?? null) : null;

  function clearDraft() {
    if (!type) return;
    try {
      globalThis.localStorage?.removeItem(draftKeyFor(type));
    } catch {
      /* تجاهل — المسودة رفاهية. */
    }
  }
  function restoreDraft() {
    if (!draftOffer) return;
    setAmountMinor(draftOffer.amountMinor);
    setSharedTotalAmountMinor(draftOffer.sharedTotalAmountMinor);
    setSharedPercentage(draftOffer.sharedPercentage);
    setDate(draftOffer.date);
    setNote(draftOffer.note);
    setCounterparty(draftOffer.counterparty);
    setRelationship(draftOffer.relationship);
    setBehavior(draftOffer.behavior);
    setPurpose(draftOffer.purpose);
    setKnowledge(draftOffer.knowledge);
    setSharedMode(draftOffer.sharedMode);
    setSharedNote(draftOffer.sharedNote);
    setCategoryLabel(draftOffer.categoryLabel);
    setRelatedEventId(draftOffer.relatedEventId);
    setWalletId(draftOffer.walletId);
    setDraftOffer(null);
    clearDraft();
  }
  function discardDraft() {
    setDraftOffer(null);
    clearDraft();
  }
  function leaveAfterSave() {
    savedRef.current = true;
    navigate(returnPath);
  }

  async function save(): Promise<boolean> {
    const selectedType = type;
    if (!selectedType) return false;
    if (savedNote) {
      /* المال محفوظ والنص ظاهر: الخروج آمن — لا إعادة حفز مفتاح مستعمل. */
      leaveAfterSave();
      return true;
    }
    if (!primaryAmountValid) {
      setMessage(
        isShared && sharedMode === "percentage"
          ? "أدخل إجماليًا ونسبة صحيحة بين 0 و100 قبل الحفظ."
          : "أدخل مبلغًا صالحًا بالأرقام 0–9 قبل الحفظ.",
      );
      return false;
    }
    if (!note.trim()) {
      setMessage("اكتب ما حدث قبل الحفظ؛ الوصف جزء من السجل المالي.");
      return false;
    }
    setMessage(null);
    setSaving(true);
    const sharedExpense = sharedExpenseIntent;
    const result = await projectFinance.record({
      type: selectedType,
      ...(sharedMode === "percentage" && isShared ? {} : { amountMinor }),
      occurredOn: date,
      note,
      counterparty: counterparty || null,
      relatedEventId: selectedType === "payable_settlement_cash" ? relatedEventId || null : null,
      expenseContext,
      sharedExpense,
      idempotencyKey: idempotencyKey.current,
    });
    if (!result.ok) {
      setSaving(false);
      setMessage(result.message);
      return false;
    }
    notifyDataChanged();
    if (result.reused) {
      setSaving(false);
      setMessage(
        "لم يُحفظ التعديل. هذا الحدث مسجل سابقًا بنفس المفتاح؛ للتصحيح تراجع عن الحدث الأصلي وسجّل حدثًا جديدًا.",
      );
      return false;
    }
    /* المال محفوظ الآن — المسودة تُمسح قبل أي خطوة لاحقة مهما صار، والوسخ
     * يُصفر (عهدة الحفظ) فلا يعترض الحارس على خروج صاحب سجل محفوظ. */
    savedRef.current = true;
    setSavedEpoch(epoch => epoch + 1);
    clearDraft();
    /* المجموعة ١ (وجهة الصرف): تغطية المحفظة المختارة بعد التسجيل — نفس توقيع
     * ورقة الإضافة (مفتاح مشتق من مفتاح السجل) فلا تخصيص مزدوج عند الإعادة.
     * فشل النسبة لا يمس الحدث: المال محفوظ غير موزع، والنص يظهر قبل الخروج. */
    if (selectedType === "operating_expense_cash" && walletId) {
      const attribution = await projectFinance.distributeUnallocated({
        walletId,
        deltaMinor: -result.value.amountMinor,
        note: "تغطية مصروف من رصيد المحفظة",
        sourceRefId: result.value.id,
        sourceRefKind: "expense",
        operationKey: `${idempotencyKey.current}:attribute`,
      });
      setSaving(false);
      if (!attribution.ok) {
        setSavedNote({ eventId: result.value.id, message: attribution.message });
        return true;
      }
    } else {
      setSaving(false);
    }
    setMessage("تم حفظ الحدث المالي محليًا.");
    /* S1-07: الخروج بعد حفظ ناجح يعود للمصدر (?from) — عقد ٢٦ قاعدة ٣. */
    navigate(returnPath);
    return true;
  }

  return (
    <section className="micro-page micro-finance-page">
      <button
        className="micro-back-button"
        type="button"
        onClick={() => (savedRef.current ? navigate(returnPath) : requestNavigation(returnPath))}
      >
        <ArrowRight aria-hidden="true" /> الوضع المالي
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">حدث مالي محلي</span>
        <h1>{content.title}</h1>
        <p>{content.description}</p>
      </div>
      <section className="micro-decision-card">
        <span>الأثر المعروف</span>
        {/* المجموعة ١ (معاينة الأثر): منطقة ارتفاع محجوز — لا اهتزاز فوق حقول
         * الإدخال؛ المعاينة مشتقة من توسيع الحفظ نفسه، والناقص يعود للنص الثابت. */}
        <EventEffectPreview
          intent={{
            type,
            amountMinor: isShared && sharedMode === "percentage" ? undefined : amountMinor,
            occurredOn: date,
            relatedEventId: type === "payable_settlement_cash" ? relatedEventId || null : null,
            expenseContext,
            sharedExpense: sharedExpenseIntent,
          }}
          walletName={walletNameForPreview}
          fallbackText={content.effect}
        />
        <p>لا يغيّر هذا الحدث نتيجة طلب قائم أو صافي ربح المشروع تلقائيًا.</p>
        {type === "amanah_released_cash" ? (
          <p role="status">
            رصيد الأمانات بحوزتك الآن:{" "}
            {amanahHeldMinor === null ? (
              "يُقرأ…"
            ) : (
              <MoneyValue minor={amanahHeldMinor} className="micro-inline-number" />
            )}{" "}
            — لا يمكنك تسليم أكثر منه؛ إن كان صفرًا فسجّل قبض الأمانة أولًا.
          </p>
        ) : null}
      </section>
      <section className="micro-form-card">
        {draftOffer ? (
          /* المجموعة ١ (مسودة محفوظة): استرجاع بفعل صريح — لا تحويل سجل تلقائي أبدًا. */
          <div className="micro-draft-banner" role="status">
            <p>عندك مسودة غير محفوظة من إدخال سابق — ترجّعها؟</p>
            <div className="micro-form-actions">
              <button className="micro-button micro-button-primary" type="button" onClick={restoreDraft}>
                استرجع المسودة
              </button>
              <button className="micro-button micro-button-secondary" type="button" onClick={discardDraft}>
                تجاهلها
              </button>
            </div>
          </div>
        ) : null}
        {savedNote ? (
          /* المجموعة ١ (صدق النسبة): الحدث محفوظ والمال غير موزع — النص والوصلة
           * قبل الخروج، لا كذب ولا تجاهل ولا إعادة حفز المفتاح. */
          <div className="micro-draft-banner" role="status">
            <p>
              حُفظ الحدث محليًا، لكن نسبته للمحفظة لم تتم: {savedNote.message} — المال محفوظ ضمن الكاش غير
              الموزع حتى توزّعه بنفسك.
            </p>
            <div className="micro-form-actions">
              <button
                className="micro-text-action"
                type="button"
                onClick={() =>
                  navigate(withFrom(`/finance?event=${encodeURIComponent(savedNote.eventId)}`, returnPath))
                }
              >
                افتح السجل المحفوظ
              </button>
            </div>
          </div>
        ) : null}
        {isShared && sharedMode === "percentage" ? (
          <>
            <label className="micro-field">
              <span>إجمالي المصروف المشترك</span>
              <EnglishNumberInput
                value={sharedTotalAmountMinor}
                kind="money"
                onNumericChange={setSharedTotalAmountMinor}
                onTextValidityChange={setValidSharedTotal}
                aria-label="إجمالي المصروف المشترك"
              />
              <small>هذا هو إجمالي الفاتورة أو المصدر، وليس الحصة التي ستدخل النتيجة.</small>
            </label>
            <label className="micro-field">
              <span>نسبة حصة المشروع (%)</span>
              <EnglishNumberInput
                value={sharedPercentage}
                kind="decimal"
                onNumericChange={setSharedPercentage}
                onTextValidityChange={setValidSharedPercentage}
                aria-label="نسبة حصة المشروع"
              />
              <small>أدخل نسبة صريحة بين 0 و100؛ يحفظ النظام النسبة والحصة المحسوبة بالتقريب الثابت.</small>
            </label>
          </>
        ) : (
          <label className="micro-field">
            <span>
              {isShared && sharedMode === "defer"
                ? "إجمالي المصروف المصدر"
                : isShared
                  ? "حصة المشروع بالدينار الأردني"
                  : "المبلغ بالدينار الأردني"}
            </span>
            <EnglishNumberInput
              value={amountMinor}
              kind="money"
              onNumericChange={setAmountMinor}
              onTextValidityChange={setValidAmount}
              aria-label="المبلغ بالدينار الأردني"
            />
            <small>
              {isShared && sharedMode === "defer"
                ? "سيبقى هذا الإجمالي غير موزّع حتى تحدد حصة المشروع."
                : null}
            </small>
          </label>
        )}
        {type === "operating_expense_cash" ? (
          /* المجموعة ١ (الإدخال الموجّه): «من وين طلع المبلغ؟» — نفس مفردات ورقة
           * الإضافة (وجهة الصرف) حتى لا تتعدد مفردات المفهوم الواحد. */
          <label className="micro-field">
            <span>
              وجهة الصرف <small>من وين طلع المبلغ؟ غير الموزع افتراضيًا؛ المحفظة تغطي من رصيدها.</small>
            </span>
            <select value={walletId} onChange={event => setWalletId(event.target.value)}>
              <option value="">من الكاش غير الموزع</option>
              {wallets.map(wallet => (
                <option key={wallet.id} value={wallet.id}>
                  {wallet.name} — تغطية من رصيدها
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <LocalDateField label="تاريخ الحدث" value={date} onChange={event => setDate(event.target.value)} />
        <label className="micro-field">
          <span>{content.counterparty}</span>
          <input
            value={counterparty}
            onChange={event => setCounterparty(event.target.value)}
            placeholder="اختياري"
          />
        </label>
        {isOperatingExpense ? (
          <details className="micro-decision-layer micro-expense-details">
            <summary className="micro-decision-layer-summary">
              <span>
                <b>أضف سياقًا للمصروف</b>
                <small>التصنيف والمعرفة وحصة المشروع عند الحاجة.</small>
              </span>
              <strong>افتح التفاصيل</strong>
            </summary>
            <ExpenseClassification
              relationship={relationship}
              setRelationship={setRelationship}
              behavior={behavior}
              setBehavior={setBehavior}
              purpose={purpose}
              setPurpose={setPurpose}
              knowledge={knowledge}
              setKnowledge={setKnowledge}
              sharedMode={sharedMode}
              setSharedMode={setSharedMode}
              sharedNote={sharedNote}
              setSharedNote={setSharedNote}
              sharedKnowledge={sharedKnowledge}
              categoryLabel={categoryLabel}
              setCategoryLabel={setCategoryLabel}
              suggestions={suggestions}
              amountMinor={amountMinor}
              sharedTotalAmountMinor={sharedTotalAmountMinor}
              sharedPercentage={sharedPercentage}
              sharedValid={
                validSharedTotal &&
                sharedTotalAmountMinor > 0 &&
                sharedPercentage > 0 &&
                sharedPercentage <= 100
              }
              onOpenSuppliers={() => navigate(withFrom("/suppliers", `/finance/new/${type}`))}
            />
          </details>
        ) : null}
        {type === "payable_settlement_cash" ? (
          <label className="micro-field">
            <span>الالتزام الذي تسدده (المبالغ د.أ)</span>
            <select value={relatedEventId} onChange={event => setRelatedEventId(event.target.value)}>
              <option value="">اختر التزامًا مسجلًا</option>
              {payableOptions.map(({ event, remainingMinor }) => (
                <option key={event.id} value={event.id}>
                  {event.note} · المتبقي {formatMoneyOption(remainingMinor)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="micro-field">
          <span>ما الذي حدث؟ (مطلوب)</span>
          <textarea
            value={note}
            onChange={event => setNote(event.target.value)}
            placeholder="مثال: دفعت توصيل الطلبات للأسبوع"
          />
        </label>
        {message ? (
          <p
            className={
              message.startsWith("تم ") || message.startsWith("هذا ")
                ? "micro-save-note"
                : "micro-field-error"
            }
            role="status"
          >
            {message}
          </p>
        ) : null}
        <div className="micro-form-actions micro-sticky-save">
          <button
            className="micro-button micro-button-primary micro-save-cost"
            type="button"
            disabled={saving}
            onClick={() => void save()}
          >
            <Save aria-hidden="true" />
            {saving
              ? "جارٍ الحفظ…"
              : savedNote
                ? "ارجع إلى الوضع المالي"
                : isOperatingExpense
                  ? "حفظ المصروف المصنف"
                  : "حفظ الحدث"}
          </button>
        </div>
      </section>
    </section>
  );
}

type ExpenseClassificationProps = {
  relationship: OperatingExpenseContext["relationship"];
  setRelationship: (value: OperatingExpenseContext["relationship"]) => void;
  behavior: OperatingExpenseContext["behavior"];
  setBehavior: (value: OperatingExpenseContext["behavior"]) => void;
  purpose: OperatingExpenseContext["purpose"];
  setPurpose: (value: OperatingExpenseContext["purpose"]) => void;
  knowledge: OperatingExpenseContext["knowledge"];
  setKnowledge: (value: OperatingExpenseContext["knowledge"]) => void;
  sharedMode: SharedMode;
  setSharedMode: (value: SharedMode) => void;
  sharedNote: string;
  setSharedNote: (value: string) => void;
  sharedKnowledge: OperatingExpenseContext["knowledge"];
  /* المجموعة ١ (تصنيفي للمصاريف): وسم اختياري + مقترحات مشتقة. */
  categoryLabel: string;
  setCategoryLabel: (value: string) => void;
  suggestions: readonly string[];
  amountMinor: number;
  sharedTotalAmountMinor: number;
  sharedPercentage: number;
  sharedValid: boolean;
  onOpenSuppliers: () => void;
};

function formatMoneyOption(minor: number) {
  return formatMoneyMinor(minor);
}

function ExpenseClassification(props: ExpenseClassificationProps) {
  const {
    relationship,
    setRelationship,
    behavior,
    setBehavior,
    purpose,
    setPurpose,
    knowledge,
    setKnowledge,
    sharedMode,
    setSharedMode,
    sharedNote,
    setSharedNote,
    sharedKnowledge,
    categoryLabel,
    setCategoryLabel,
    suggestions,
    amountMinor,
    sharedTotalAmountMinor,
    sharedPercentage,
    sharedValid,
    onOpenSuppliers,
  } = props;
  const sharedBasis = basisFromMode(sharedMode);
  const normalizedLabel = normalizeCategoryLabelInput(categoryLabel);
  return (
    <section className="micro-expense-classification" aria-labelledby="expense-classification-title">
      <div>
        <span className="micro-overline">افهم الأثر قبل الحفظ</span>
        <h2 id="expense-classification-title">كيف يخدم هذا المصروف المشروع؟</h2>
        <p>التصنيف لا يحمّل المصروف على طلب تلقائيًا؛ هو يوضح سياقه ودرجة معرفتك به.</p>
      </div>
      {/* المجموعة ١ (تصنيفي للمصاريف): أول أسئلة الطبقة — «على شو اندفعت
       * المصاري؟»؛ وسم حر اختياري لا يغير أي دلتا (اختبار التوائم يحرسه). */}
      <label className="micro-field">
        <span>
          تصنيفك للمصروف <small>اختياري — على شو اندفعت المصاري؟ بنزين، رواتب، إيجار…</small>
        </span>
        <input
          value={categoryLabel}
          onChange={event => setCategoryLabel(event.target.value)}
          maxLength={80}
          placeholder="مثال: بنزين"
        />
      </label>
      {suggestions.length > 0 ? (
        <div className="micro-chip-list" role="group" aria-label="مقترحات التصنيف">
          {suggestions.map(suggestion => (
            <button
              key={suggestion}
              type="button"
              className="micro-suggest-chip"
              aria-pressed={normalizedLabel === suggestion}
              title={suggestion}
              onClick={() => setCategoryLabel(normalizedLabel === suggestion ? "" : suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
      <div className="micro-field-grid">
        <label className="micro-field">
          <span>طبيعته: ثابت ولا بتغير؟</span>
          <select
            value={behavior}
            onChange={event => setBehavior(event.target.value as OperatingExpenseContext["behavior"])}
          >
            <option value="fixed">ثابت غالبًا</option>
            <option value="variable">يتغير مع العمل</option>
            <option value="mixed">مختلط</option>
            <option value="unknown">غير متأكد</option>
          </select>
        </label>
        <label className="micro-field">
          <span>ما الذي يخدمه؟</span>
          <select
            value={purpose}
            onChange={event => setPurpose(event.target.value as OperatingExpenseContext["purpose"])}
          >
            <option value="project_general">المشروع عمومًا</option>
            <option value="period">فترة محددة</option>
            <option value="order">طلب محدد</option>
            <option value="product">منتج محدد</option>
            <option value="campaign">حملة</option>
            <option value="unallocated">لا أوزعه الآن</option>
          </select>
        </label>
      </div>
      <label className="micro-field">
        <span>علاقة المبلغ بالمشروع</span>
        <select
          value={relationship}
          onChange={event => setRelationship(event.target.value as OperatingExpenseContext["relationship"])}
        >
          <option value="project">للمشروع بالكامل</option>
          <option value="shared">مصروف مشترك مع البيت أو نشاط آخر</option>
        </select>
        <small>
          {relationship === "shared"
            ? "لن يوزّع النظام إجمالي فاتورة مشتركة على الربح إلا إذا حددت الحصة أو أبقيتها غير موزّعة بوضوح."
            : "هذا المبلغ يخدم المشروع بالكامل كما هو مسجل."}
        </small>
      </label>
      {relationship === "shared" ? (
        <>
          <label className="micro-field">
            <span>كيف تريد تسجيل حصة المشروع؟</span>
            <select value={sharedMode} onChange={event => setSharedMode(event.target.value as SharedMode)}>
              <option value="fixed">مبلغ حصة معروف</option>
              <option value="percentage">نسبة من إجمالي معلوم</option>
              <option value="estimate">تقدير المالك</option>
              <option value="defer">أؤجل تحديد الحصة</option>
            </select>
            <small>{sourceDescription[sharedBasis]}</small>
          </label>
          <label className="micro-field">
            <span>ملاحظة عن المصدر</span>
            <input
              value={sharedNote}
              onChange={event => setSharedNote(event.target.value)}
              placeholder="اختياري: مثال، نسبة متفق عليها مع البيت"
            />
          </label>
          {/* المجموعة ١ (مراجعة التوزيع): صفوف «تسمية: قيمة» قبل الحفظ — الحصة
           * مشتقة بالدالة نفسها التي يحفظ بها السجل؛ المتبقي مرئي لا معدوم. */}
          <AllocationReviewCard
            mode={sharedMode}
            amountMinor={amountMinor}
            sharedTotalAmountMinor={sharedTotalAmountMinor}
            sharedPercentage={sharedPercentage}
            valid={sharedValid}
          />
          <p className="micro-expense-route-note">
            حالة الرقم:{" "}
            {sharedKnowledge === "known"
              ? "مؤكد"
              : sharedKnowledge === "estimated"
                ? "تقديري"
                : "يحتاج مراجعة"}
            . تدخل الحصة الموزّعة في نتيجة الفترة مرة واحدة، أما المؤجل فيظهر كغير موزّع ولا يساوي صفرًا.
          </p>
        </>
      ) : (
        <label className="micro-field">
          <span>حالة الرقم</span>
          <select
            value={knowledge}
            onChange={event => setKnowledge(event.target.value as OperatingExpenseContext["knowledge"])}
          >
            <option value="known">مؤكد</option>
            <option value="estimated">تقديري</option>
            <option value="needs_review">يحتاج مراجعة</option>
          </select>
          <small>
            {knowledge === "known"
              ? "تؤكد أن المبلغ المسجل يمثل مصروف المشروع كما تعرفه الآن."
              : "سيبقى المصروف مسجلًا، لكن نتيجة الفترة ستصرح بأنه يحتاج مراجعة أو تقديرًا."}
          </small>
        </label>
      )}
      {/* المجموعة ١ (تمييز المسار): شراء المخزون مساره الموردون (فعل حقيقي)،
       * والأصول والقروض مسارات قادمة تُعلن بصدق — لا مسار مالي بديل يُخترع. */}
      <p className="micro-expense-route-note">
        <button className="micro-text-action" type="button" onClick={onOpenSuppliers}>
          شراء خامات ستبقى في المخزون؟ سجّله من الموردون والمشتريات — لا كمصروف عادي.
        </button>
      </p>
      <p className="micro-expense-route-note">
        الأصول طويلة الاستخدام والقروض الشخصية لا تُسجَّل من هنا — مساراتها قادمة لاحقًا.
      </p>
    </section>
  );
}
