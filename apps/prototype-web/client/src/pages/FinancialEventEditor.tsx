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
import { withReturnTo } from "@/app/navigationContract";
import { useReturnPath } from "@/app/useReturnNavigation";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { useFormDirty } from "@/components/forms/useFormDirty";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import { EventEffectPreview } from "@/components/presentation/EventEffectPreview";
import { AllocationReviewCard } from "@/components/finance/AllocationReviewCard";
import { CrossModelDuplicateNotice } from "@/components/owner/CrossModelDuplicateNotice";
import {
  EXPENSE_NOTE_REQUIRED_MESSAGE,
  EXPENSE_SOURCE_UNSET as UNSET_EXPENSE_SOURCE,
  coverExpenseFromWallet,
  expenseSourceHint,
  expenseSourceRuleViolation,
} from "@/components/finance/expenseFormModel";
import { formatMoneyMinor } from "@/presentation/formatters";
import {
  deriveExpenseCategorySuggestions,
  normalizeCategoryLabelInput,
  matchesSharedBillOwnerPartConfirmation,
  sharedBillOwnerPartConfirmationOf,
  type SharedBillOwnerPartConfirmation,
} from "@/application/financial-records";
import type { SettleablePayable } from "@/application/finance";
import type { CrossModelOwnerDuplicate } from "@/application/owner-money";
/* R7/R6-F17-P03 (2026-10-10): قرار المحرر النقي (سياق المصروف المشترك/
 * أساس ومعرفة الحصة/بوابة صلاحية المبلغ/غرض المصروف/إكراه المسودة TR-11)
 * من بيته التطبيقي المالي — نفس بيت قناة الكتابة projectFinancialEventWrites. */
import {
  basisFromMode,
  coerceEditorDraft,
  defaultNextReminderDateForExpense,
  deriveExpenseContext,
  derivePrimaryAmountProblem,
  deriveRecurrenceProblem,
  deriveSharedExpenseIntent,
  deriveSharedPaidProblem,
  deriveOwnerPartMinor,
  deriveSharedPercentageBps,
  deriveSharedShareMinorPreview,
  knowledgeFromBasis,
  type EditorDraft,
  type SharedMode,
} from "@/application/finance/financialEventEditorModel";
import type {
  FinancialEvent,
  FinancialEventType,
  OperatingExpenseContext,
  SharedProjectShareBasis,
} from "@micro-domain/financial-event/index.js";

import { Button } from "@/components/primitives";
import { todayInAmman } from "@/application/time";
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
    title: "تسجيل هدر بلا خروج نقد",
    description: "خسارة مادية لم يرافقها دفع: بضاعة تلفت قبل تسجيلها في المخزون.",
    effect: "يخفض ربح الفترة كتكلفة ضائعة؛ لا يغيّر الكاش ولا الذمم.",
    counterparty: "اختياري: مصدر الخسارة",
  },
};
const types = new Set<GuidedFinancialEventType>(Object.keys(definition) as GuidedFinancialEventType[]);
const sourceDescription: Record<SharedProjectShareBasis, string> = {
  agreed_fixed_share: "أدخل حصة المشروع فقط؛ لا يحفظ النظام إجمالي فاتورة البيت.",
  agreed_percentage: "أدخل الإجمالي والنسبة الصريحة؛ يحسب النظام حصة المشروع بدقة ويحفظها في السجل.",
  owner_estimate: "تقديرك الحالي لحصة المشروع؛ تدخل مرة واحدة وتبقى الصورة ناقصة.",
  needs_review: "يحفظ إجمالي المصدر كغير موزّع؛ لا يصبح صفرًا ولا يخصم من النتيجة.",
};
/* المجموعة ١ (مسودة محفوظة — TR-11): مدخلات فقط لا سجلات؛ تُسترجع بفعل صريح
 * ولا تُحوّل حدثًا ماليًا أبدًا إلا بزر الحفظ. النوع والإكراه الدفاعي
 * (AV-09/M-04) عند بيتهما التطبيقي — R7/R6-F17-P03، 2026-10-10. */

export default function FinancialEventEditor() {
  const { type: rawType } = useParams<{ type: string }>();
  const [, navigate] = useLocation();
  /* المجموعة ١ (Scope A): الرجوع يعود للمصدر (?from) مع بديل قانوني موثّق. */
  const returnPath = useReturnPath();
  const {
    dataVersion,
    projectFinance,
    cashContinuity,
    notifyDataChanged,
    formDrafts,
    ownerEntitlement,
    recurringExpenses,
  } = usePrototypeServices();
  const type = types.has(rawType as GuidedFinancialEventType) ? (rawType as GuidedFinancialEventType) : null;
  const [amountMinor, setAmountMinor] = useState(0);
  const [validAmount, setValidAmount] = useState(true);
  const [sharedTotalAmountMinor, setSharedTotalAmountMinor] = useState(0);
  const [validSharedTotal, setValidSharedTotal] = useState(true);
  const [sharedPercentage, setSharedPercentage] = useState(0);
  const [validSharedPercentage, setValidSharedPercentage] = useState(true);
  /* S06 (CONS-DEC04 / SDF-064): المدفوع فعليًا من صندوق المشروع للفاتورة
   * المشتركة النقدية — فارغ = حصة المشروع فقط (السلوك القائم)؛ فوقها
   * يفتح سؤال «من تحمّل الباقي» بتأكيد صريح لا افتراض نظام. */
  const [sharedPaidAmountMinor, setSharedPaidAmountMinor] = useState(0);
  const [validSharedPaid, setValidSharedPaid] = useState(true);
  /* S06 (CONS-DEC04 / SDF-064): تأكيد «من تحمّل الباقي» — S07 (S06-MR-001):
   * مرتبط بقيمة الزوج الكنوني (الحصة + المدفوع) لحظة التأكيد لا boolean
   * بلا قيمة؛ تغيّر أي مدخل يغير القيمة يبطل التأكيد تلقائيًا عند
   * المطابقة (ownerPartConfirmedCurrent) فيُعاد الطلب قبل الحفظ. */
  const [ownerPartConfirmedFor, setOwnerPartConfirmedFor] = useState<SharedBillOwnerPartConfirmation | null>(
    null,
  );
  /* S06 (UNIT-019 / ORG-011): خيار «يتكرر» داخل المصروف — إعداد مختصر
   * (كل شهر + التذكير القادم) بقصد مترابط مع الحفظ (D07). */
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false);
  const [recurrenceNextDate, setRecurrenceNextDate] = useState("");
  /* S06 (D07): فشل إعداد التكرار بعد ثبوت المصروف — نتيجة جزئية صادقة
   * مع استئناف الناقص وحده بنية الإعداد نفسها. التاريخ المعروض أعلاه
   * هو مرجع الاستئناف (R3-F01) فتصحيحه ممكن لا جمود على تاريخ فاشل. */
  const [seriesSetupFailure, setSeriesSetupFailure] = useState<{
    seriesId: string;
    title: string;
    amountMinor: number;
    walletId: string | null;
    categoryLabel: string | null;
    message: string;
  } | null>(null);
  const seriesRetryInFlightRef = useRef(false);
  /* R3-F07: نوع الحدث الذي حفظ وبقيت صفحته قائمة (نتيجة جزئية لاحقًا أو
   * نجاح استئناف) — الزر الأساسي بعدها «ارجع إلى المالية» لا حفظ جديد؛
   * يحمل النوع لا رمزًا عامًا فتغيير معامل المسار على مكوّن مركّب (RV1)
   * لا يورّث حالة «محفوظ» لنموذج نوع آخر. */
  const [savedStandingType, setSavedStandingType] = useState<GuidedFinancialEventType | null>(null);
  const [date, setDate] = useState(() => todayInAmman());
  /* OPS-003 (عقد ٤١ §٨): مصروف يدوي في فترة تذكير غير معالجة — تحذير ظاهر
   * لا حظر صامت؛ التسجيل من هنا يبقى مشروعًا بقرار المستخدم الصريح. */
  const [recurringWarning, setRecurringWarning] = useState<string | null>(null);
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
  /* المجموعة ١ (الإدخال الموجّه): «من وين طلع المبلغ؟» — مصدر الصرف للمصروف المدفوع.
   * FIN-005 (قرار المالك ٢٠٢٦-٠٩-١٦): بلا محافظ = غير الموزع بتحذير معلن؛
   * محفظة واحدة = معيَّنة مسبقًا بشكل مرئي؛ محافظ متعددة = اختيار إلزامي
   * صريح (محفظة أو الكاش غير الموزع) — ولا تُذكر آخر محفظة اختيرت. */
  const [wallets, setWallets] = useState<readonly { id: string; name: string }[]>([]);
  const [walletId, setWalletId] = useState(UNSET_EXPENSE_SOURCE);
  const walletSourceChosenRef = useRef(false);
  /* EXE-009 (OWN-001): حارس التكرار التقاطعي لأحداث المالك — إيقاف بإفصاح
   * وتأكيد صريح قبل أي كتابة. */
  const [duplicateWarning, setDuplicateWarning] = useState<CrossModelOwnerDuplicate | null>(null);
  const confirmedDistinctRef = useRef(false);
  const [payableOptions, setPayableOptions] = useState<readonly SettleablePayable[]>([]);
  const [relatedEventId, setRelatedEventId] = useState("");
  /* R9-GA-F3.6b (استمرار R9 الجذري): نبرة الرسالة في الحالة لا بقراءة
   * بادئة النص — كانت رسالة النجاح نفسها («حُفظ الحدث المالي محليًا.»)
   * تُعرض بفئة الخطأ لأنها لا تبدأ بـ«تم »/«هذا ». الفصل الكنوني: خطأ ⇒
   * micro-field-error + alert، نجاح/معلومة ⇒ micro-save-note + status. */
  const [message, setMessage] = useState<{ text: string; tone: "error" | "success" | "info" } | null>(null);
  const [saving, setSaving] = useState(false);
  /* P0 (إعادة الدخول): حوار «احفظ واستمر» أو ضغطة ثانية أثناء حفظ جارٍ لا
   * تعيد نداء السجل نفسه — العهدة التزامنية كخط أول، وحتمية المخزن كخط ثانٍ. */
  const saveInFlightRef = useRef(false);
  /* المجموعة ١ (SA-5/3): عهدة حفظ ناجح — تُغيّر رمز إعادة لقطة الوسخ فيصفر
   * الوسخ بعد الحفظ، فلا يفتح حارس «تغييرات غير محفوظة» بعد نجاح مسجّل. */
  const [savedEpoch, setSavedEpoch] = useState(0);
  /* المجموعة ١ (صدق النسبة بعد الحفظ): المال محفوظ والنسبة فشلت — يبقى النص
   * ظاهرًا قبل أي انتقال مع وصلة للسجل، لا كذب ولا تجاهل (SA-3). */
  const [savedNote, setSavedNote] = useState<{
    eventId: string;
    message: string;
    /* S06 (CONS-DEC04): إعادة محاولة الجزء الشخصي وحدها بعد فشله —
     * بالمفتاح المشتق نفسه فلا يتكرر المصروف المحفوظ أبدًا. */
    ownerPartRetryMinor?: number;
    /* R1-F01 (مراجعة S06 القرائية ١): نية الفاتورة الفاشلة مجمّدة لحظة
     * الفشل — الإعادة تعيد النية نفسها لا قيم نموذج حية قد تعدّلت بعدها. */
    ownerPartRetryIntent?: {
      type: GuidedFinancialEventType;
      amountMinor?: number;
      occurredOn: string;
      note: string;
      counterparty: string | null;
      expenseContext: OperatingExpenseContext | null;
      sharedExpense: NonNullable<typeof sharedExpenseIntent>;
      /* S07 (S06-MR-001): تأكيد الزوج مجمّد مع النية لحظة الفشل — الإعادة
       * تمر بالقيم نفسها التي فُصلت بها النية، فيطابقها الحد كما طابقها
       * أول مرة؛ تعديل النموذج بعدها لا يغير السحب (R1-F01). */
      ownerPartConfirmation: SharedBillOwnerPartConfirmation;
      idempotencyKey: string;
      sourceWalletId: string | null;
    };
    /* R1-F02: فشل نسبة الحصة السابق لا يُبتلع بنجاح الجزء الشخصي، وفشل
     * نسبة الجزء الشخصي السابق كذلك (R3-F06) — تُحمل الملاحظتان وتُؤلّف
     * عند العرض لا تُسقط. */
    attributionNote?: string | null;
    ownerAttributionNote?: string | null;
  } | null>(null);
  const savedRef = useRef(false);
  /* المجموعة ٥: المسح يجي فقط بعد وسخ حقيقي ثم عودة إلى
   * النقاء — لا مسح عند الفتح (يحفظ المسودة لعرض الاسترجاع لا يمسحها) ولا سباق
   * لقراءة الفتح أو أي مسار تراثي متقاعد. */
  const wasDirtyRef = useRef(false);
  /* RV1 (جولة المراجعة ١ — 2026-10-16): النوع الذي تعبّر عنه الوسخ فعليًا —
   * المكوّن يبقى مركّبًا عند تغيّر معامل المسار (رجوع/تقدم المتصفح) فكان
   * وسخ النوع السابق قد يمسح سجل النوع الجديد قبل استقرار قراءته؛ المسح
   * الآن محصور بالنوع الذي توسّخ فعلًا وحده. */
  const dirtyTypeRef = useRef<GuidedFinancialEventType | null>(null);
  /* R11 ARCH-012-NF-002 (موجة المتابعة الموحدة 2026-10-16): حد الترطيب —
   * الاسترجاع ترطيب للقيم المحفوظة لا تعديل مستخدم؛ الحفظ التلقائي لا
   * يعمل أثناءه ولا بعده مباشرة، بل يستأنف فقط بعد تعديل حقيقي. كان
   * الاسترجاع يمسح السجل ثم يعيد حفظه بفعل الوسخ في نافذة مهام دقيقة
   * يفقد فيها الإغلاق المبكر أو فشل إعادة الحفظ المسودةَ الوحيدة. */
  const restoringRef = useRef(false);
  const idempotencyKey = useRef(`finance-ui-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);
  /* المجموعة ١ (مسودة محفوظة): عرض استرجاع عند الفتح فقط — وضع الإنشاء حصريًا. */
  const [draftOffer, setDraftOffer] = useState<EditorDraft | null>(null);
  /* المجموعة ٥ (التحصين الكامل): فشل حفظ المسودة ظاهر لا صامت — القيم تبقى
   * أمام المستخدم ولا أي أثر مالي يتغير. */
  const [draftSaveFailed, setDraftSaveFailed] = useState(false);

  useEffect(() => {
    projectFinance.listSettleablePayables().then(result => {
      /* W2 (completion — تدقيق الوكيل ٢، F4): فشل قراءة الخيارات لم يعد صامتًا. */
      if (result.ok) setPayableOptions(result.value);
      else setMessage({ text: result.message, tone: "error" });
    });
  }, [projectFinance, dataVersion]);
  /* F-006: رصيد الأمانات الحالي أمام العين قبل تسليم أي مبلغ — لا اكتشاف بعد الحفظ. */
  const [amanahHeldMinor, setAmanahHeldMinor] = useState<number | null>(null);
  useEffect(() => {
    if (type !== "amanah_released_cash") return;
    let active = true;
    projectFinance.readPosition().then(result => {
      if (!active) return;
      if (result.ok) setAmanahHeldMinor(result.value.amanahHeldMinor);
      else setMessage({ text: result.message, tone: "error" });
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
      if (!active) return;
      if (result.ok) setSuggestions(deriveExpenseCategorySuggestions(result.value));
      else setMessage({ text: result.message, tone: "error" });
    });
    return () => {
      active = false;
    };
  }, [projectFinance, type, dataVersion]);
  /* المجموعة ١: المحافظ لسؤال مصدر الصرف (المصروف المدفوع) ولوجهة/مصدر
   * الكاش لأحداث المالك (EXE-009: الاستثمار يحدد وجهة الكاش والسحب مصدره). */
  useEffect(() => {
    if (
      type !== "operating_expense_cash" &&
      type !== "owner_investment_cash" &&
      type !== "owner_withdrawal_cash"
    )
      return;
    let active = true;
    cashContinuity.overview().then(result => {
      if (!active) return;
      if (result.ok) setWallets(result.value.wallets.map(wallet => ({ id: wallet.id, name: wallet.name })));
      else setMessage({ text: result.message, tone: "error" });
    });
    return () => {
      active = false;
    };
  }, [cashContinuity, type, dataVersion]);
  /* FIN-005: قاعدة التعيين عند تغيّر المحافظ — ما لم يختر المالك صراحةً.
   * EXE-009: التعيين المسبق للمحفظة الوحيدة يخص المصروف فقط؛ أحداث المالك
   * وجهتها/مصدرها الافتراضي الصريح هو الكاش غير الموزع (سلوك الحدث الأصلي)
   * — لا تعيين صامت لمحفظة يغير معنى الاستثمار/السحب دون قرار. */
  useEffect(() => {
    if (type === "operating_expense_cash") {
      if (walletSourceChosenRef.current) return;
      if (wallets.length === 1) setWalletId(wallets[0]!.id);
      else if (wallets.length === 0) setWalletId("");
      else setWalletId(UNSET_EXPENSE_SOURCE);
      return;
    }
    setWalletId(current => (current === UNSET_EXPENSE_SOURCE ? "" : current));
  }, [wallets, type]);
  /* OPS-003 (عقد ٤١ §٨): فحص التزامن مع تذكير غير معالج عند تاريخ الحدث —
   * تحذير ظاهر فقط؛ الإدخال اليدوي المشروع يبقى ممكنًا بقرار المستخدم. */
  useEffect(() => {
    if (
      !recurringExpenses ||
      !type ||
      (type !== "operating_expense_cash" && type !== "operating_expense_payable")
    ) {
      setRecurringWarning(null);
      return;
    }
    let active = true;
    recurringExpenses.findUnhandledOccurrenceForDate(date).then(result => {
      if (!active) return;
      if (!result.ok || result.value === null) {
        setRecurringWarning(null);
        return;
      }
      setRecurringWarning(
        `لديك تذكير مصروف متكرر غير معالج لهذه الفترة: «${result.value.seriesTitle}» — سجّله من تفصيل التذكير إن شئت، أو تابع هنا بقرارك الصريح.`,
      );
    });
    return () => {
      active = false;
    };
  }, [recurringExpenses, type, date, dataVersion]);
  /* المجموعة ٥ (التحصين الكامل): القراءة عند الفتح من حد المسودات العابرة
   * الموحّد فقط — لا وصول مباشرًا لتخزين الصفحة في الكود الطبيعي.
   * R11 ARCH-012 (2026-10-15): ترحيل مفتاح الصفحة القديم تقاعد قبل
   * الإطلاق بقرار مالك موثق (r11-arch012-20261015) — القراءة الحية
   * وحدها تبقى هنا. */
  useEffect(() => {
    if (!type) return;
    let active = true;
    void (async () => {
      const result = await formDrafts.read("finance_event", type);
      if (!active || !result.ok || result.value === null) return;
      /* AV-09: الإكراه الدفاعي يبقى على القيم المقروءة كما كان — القيم غير
       * الصالحة لا تكسر النموذج ولا تصل إلى الحفظ. */
      const coerced = coerceEditorDraft(result.value.values);
      if (coerced) setDraftOffer(coerced);
    })();
    return () => {
      active = false;
    };
  }, [type, formDrafts]);

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
      sharedPaidAmountMinor,
      ownerPartConfirmedFor,
      recurrenceEnabled,
      recurrenceNextDate,
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
      /* FIN-005: التعيين المسبق بالقاعدة ليس وسخًا — الوسخ اختيار المالك
       * الصريح لمصدر غير المعيَّن. */
      walletSourceChosenRef.current ? walletId : "",
    ],
    `${type}:${savedEpoch}`,
  );
  const requestNavigation = useUnsavedChangesGuard({ isDirty, onSave: () => save() });
  /* المجموعة ١ (مسودة محفوطة): الكتابة عند الوسخ فقط — بعد تعريف الوسخ لا قبله؛
   * الحفظ الناجح يوقف الكتابة (savedRef) ويمسح المسودة في save().
   * المجموعة ٥ (التحصين الكامل): الكتابة عبر الحد الموحّد — فشل الحفظ يُعلن
   * والقيم تبقى في الذاكرة كما هي؛ التعارض يعني أن كتابة أحدث من هذه
   * النافذة هبطت قبلها فلا يُعرض كفشل. */
  useEffect(() => {
    if (!type || savedRef.current) return;
    /* NF-002: أثناء الترطيب (تطبيق قيم الاسترجاع) لا حفظ ولا مسح —
     * السجل يحمل هذه القيم سلفًا؛ الاستئناف بعد تعديل حقيقي فقط. */
    if (restoringRef.current) return;
    if (isDirty) {
      wasDirtyRef.current = true;
      dirtyTypeRef.current = type;
      void formDrafts
        .save("finance_event", type, {
          amountMinor,
          sharedTotalAmountMinor,
          sharedPercentage,
          sharedPaidAmountMinor,
          ownerPartConfirmedFor,
          recurrenceEnabled,
          recurrenceNextDate,
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
          /* FIN-005: «لم يُختر بعد» لا يُحفظ في المسودة — الفارغ يعني غير الموزع. */
          walletId: walletId === UNSET_EXPENSE_SOURCE ? "" : walletId,
        } satisfies EditorDraft)
        .then(result => {
          setDraftSaveFailed(result.ok === false && result.code !== "conflict");
        });
    } else if (wasDirtyRef.current) {
      wasDirtyRef.current = false;
      /* RV1: مسح العودة إلى النقاء لا يجوز أن يمسح إلا سجل النوع الذي توسّخ
       * فعلًا — سجل نوع آخر (كتغيّر مسار على مكوّن مركّب) لا يُمسح قبل
       * استقرار قراءته أبدًا. */
      if (dirtyTypeRef.current === type) {
        setDraftSaveFailed(false);
        void formDrafts.discard("finance_event", type);
      }
      dirtyTypeRef.current = null;
    }
  }, [
    type,
    isDirty,
    amountMinor,
    sharedTotalAmountMinor,
    sharedPercentage,
    sharedPaidAmountMinor,
    ownerPartConfirmedFor,
    recurrenceEnabled,
    recurrenceNextDate,
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
    formDrafts,
  ]);

  if (!type)
    return (
      <section className="micro-page micro-not-found">
        <h1>نوع الحدث غير متاح</h1>
        <p>ارجع إلى المالية واختر حدثًا واضحًا.</p>
        <Button
          action="secondary"

          onClick={() => navigate("/finance")}
        >
          المالية
        </Button>
      </section>
    );

  const content = definition[type];
  const isOperatingExpense = type === "operating_expense_cash" || type === "operating_expense_payable";
  const isShared = isOperatingExpense && relationship === "shared";
  const normalizedCategoryLabel = normalizeCategoryLabelInput(categoryLabel);
  /* R7/P03: اشتقاق سياق المصروف عند بيته التطبيقي. */
  const expenseContext = deriveExpenseContext({
    isOperatingExpense,
    relationship,
    behavior,
    purpose,
    knowledge,
    sharedMode,
    sharedNote,
    categoryLabel: normalizedCategoryLabel,
  });
  /* المجموعة ١١ (11-0 — سياسة القيم الدقيقة): تحويل النسبة إلى bps دقيقًا فقط؛
   * الدقة الأدق من منزلتين تُرفض (null) فيُمنع الحفظ برسالة آمنة وتعود
   * المعاينة للنص الثابت — لا تقريب صامت أبدًا. */
  const sharedPercentageBps = deriveSharedPercentageBps(isShared, sharedMode, sharedPercentage);
  /* R7/P03: بوابة صلاحية المبلغ الأساسي كودًا عند بيته التطبيقي. */
  const primaryAmountProblem = derivePrimaryAmountProblem({
    isShared,
    sharedMode,
    validSharedTotal,
    sharedTotalAmountMinor,
    validSharedPercentage,
    sharedPercentage,
    sharedPercentageBps,
    validAmount,
    amountMinor,
  });
  const primaryAmountValid = primaryAmountProblem === null;
  const selectedWallet = wallets.find(wallet => wallet.id === walletId) ?? null;
  /* S06 (CONS-DEC04 / SDF-064): الحصة المرجعية والمدفوع الفعلي والفارق
   * الشخصي — كلها مشتقة عند بيت النموذج التطبيقي لا في هذه الصفحة. */
  const sharedSharePreviewMinor = deriveSharedShareMinorPreview({
    isShared,
    sharedMode,
    amountMinor,
    sharedTotalAmountMinor,
    sharedPercentageBps,
  });
  /* سؤال «المدفوع فعليًا» للمصروف النقدي المشترك بكل أنماط الحصة المعلومة
   * (ثابتة/نسبة/تقديرية) — المؤجلة لا مدفوع لها. */
  const paidFieldApplies = type === "operating_expense_cash" && isShared && sharedMode !== "defer";
  const sharedPaidProblem = deriveSharedPaidProblem({
    paidAmountMinor: sharedPaidAmountMinor,
    validPaid: validSharedPaid,
    shareAmountMinor: sharedSharePreviewMinor,
  });
  const ownerPartMinor = deriveOwnerPartMinor({
    paidAmountMinor: sharedPaidAmountMinor,
    shareAmountMinor: sharedSharePreviewMinor,
    applies: type === "operating_expense_cash" && isShared && sharedMode !== "defer",
  });
  /* S07 (S06-MR-001): الزوج الكنوني الحالي للمطابقة — من المعاينة نفسها
   * (sharedSharePreviewMinor من الدوال النقية الكنسية) لا حساب موازٍ؛
   * التأكيد المخزن نافذ فقط إذا طابق هذا الزوج، فتغيّر الحصة أو المدفوع
   * (أو أي مدخل يغيرهما) يُظهر التأكيد غير معتمد ويُعاد طلبه قبل الحفظ. */
  const ownerPartConfirmation = sharedBillOwnerPartConfirmationOf(
    sharedSharePreviewMinor ?? 0,
    sharedPaidAmountMinor > 0 ? sharedPaidAmountMinor : null,
  );
  const ownerPartConfirmedCurrent = matchesSharedBillOwnerPartConfirmation(
    ownerPartConfirmedFor,
    ownerPartConfirmation,
  );
  /* S06 (UNIT-019): بوابة التذكير القادم لخيار «يتكرر».
   * R3-F01: المرجع اليوم الحقيقي لا تاريخ الحدث — نفس قاعدة الخدمة
   * الكنسية (setupFromExpense تقارن باليوم الحقيقي)، فلا يقترح المحرر
   * ولا يقبل تذكيرًا ترفضه الخدمة بعد ثبوت المصروف. */
  const recurrenceProblem = deriveRecurrenceProblem({
    enabled: recurrenceEnabled,
    nextDate: recurrenceNextDate,
    today: todayInAmman(),
  });
  const sharedExpenseIntent = deriveSharedExpenseIntent({
    isShared,
    sharedMode,
    sharedPercentageBps,
    sharedTotalAmountMinor,
    amountMinor,
    ...(sharedPaidAmountMinor > 0 && type === "operating_expense_cash" && isShared && sharedMode !== "defer"
      ? { paidAmountMinor: sharedPaidAmountMinor }
      : {}),
  });
  const walletNameForPreview = type === "operating_expense_cash" ? (selectedWallet?.name ?? null) : null;
  /* R7/P03: معرفة الحصة لقسم التصنيف — من الخريطة التطبيقية نفسها. */
  const sharedKnowledge = knowledgeFromBasis(basisFromMode(sharedMode));

  function clearDraft() {
    if (!type) return;
    void formDrafts.discard("finance_event", type);
  }
  function restoreDraft() {
    if (!draftOffer) return;
    setAmountMinor(draftOffer.amountMinor);
    setSharedTotalAmountMinor(draftOffer.sharedTotalAmountMinor);
    setSharedPercentage(draftOffer.sharedPercentage);
    setSharedPaidAmountMinor(draftOffer.sharedPaidAmountMinor);
    setOwnerPartConfirmedFor(draftOffer.ownerPartConfirmedFor);
    setRecurrenceEnabled(draftOffer.recurrenceEnabled);
    setRecurrenceNextDate(draftOffer.recurrenceNextDate);
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
    /* FIN-005: مسودة بمحفظة مختارة = اختيار صريح يُحترم؛ المسودة الفارغة
     * تتبع قاعدة عدد المحافظ عند التسجيل. */
    if (draftOffer.walletId) {
      walletSourceChosenRef.current = true;
      setWalletId(draftOffer.walletId);
    }
    setDraftOffer(null);
    /* NF-002 (موجة المتابعة الموحدة 2026-10-16): لا مسح هنا — السجل يحمل
     * القيم المسترجعة نفسها فلا نافذة «مسح ثم إعادة حفظ» بعد الآن؛
     * حد الترطيب يمنع أثر الوسخ من تصنيف الاسترجاع تعديلًا مستخدمًا،
     * ويُرفع بعد استقرار الالتزام فيستأنف الحفظ عند أول تعديل حقيقي. */
    restoringRef.current = true;
    globalThis.setTimeout(() => {
      restoringRef.current = false;
    }, 0);
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
    if (saveInFlightRef.current) return false;
    if (savedNote) {
      /* المال محفوظ والنص ظاهر: الخروج آمن — لا إعادة حفز مفتاح مستعمل. */
      leaveAfterSave();
      return true;
    }
    if (!primaryAmountValid) {
      /* R7/P03: كود المشكلة من البوابة التطبيقية — النص هنا (نسخة واجهة). */
      setMessage({
        tone: "error",
        text:
          primaryAmountProblem === "percentage_precision"
            ? "دقة النسبة أدق من المدعوم — أدخل نسبة بمنزلتين عشريتين كحد أقصى (خطوة 0.01%) ثم أعد الحفظ."
            : isShared && sharedMode === "percentage"
              ? "أدخل إجماليًا ونسبة صحيحة بين 0 و100 قبل الحفظ."
              : "أدخل مبلغًا صالحًا بالأرقام 0–9 قبل الحفظ.",
      });
      return false;
    }
    if (!note.trim()) {
      setMessage({ text: EXPENSE_NOTE_REQUIRED_MESSAGE, tone: "error" });
      return false;
    }
    /* FIN-005: محافظ متعددة — لا حفظ لمصروف نقدي بلا اختيار صريح لمصدره.
     * EXE-007: القاعدة من المواصفة الموحدة مع ورقة الإضافة السريعة. */
    if (selectedType === "operating_expense_cash") {
      const sourceViolation = expenseSourceRuleViolation(wallets.length, walletId);
      if (sourceViolation) {
        setMessage({ text: sourceViolation, tone: "error" });
        return false;
      }
    }
    /* S06 (CONS-DEC04 / SDF-064): بوابة المدفوع فعليًا — الحصة مرجعها
     * النموذج التطبيقي، والنص هنا نسخة واجهة. */
    if (paidFieldApplies && sharedPaidProblem) {
      setMessage({
        tone: "error",
        text:
          sharedPaidProblem === "paid_invalid"
            ? "أدخل المدفوع فعليًا مبلغًا صحيحًا بالأرقام 0–9، أو اتركه فارغًا إن دفعت حصة المشروع فقط."
            : "المدفوع فعليًا لا يمكن أن يقل عن حصة المشروع — إن لم يُدفع كاملها فسجّل المصروف مستحقًا.",
      });
      return false;
    }
    /* الفارق فوق الحصة لا يُفترض شخصيًا — تأكيد صريح من قرره (CONS-DEC04).
     * S07 (S06-MR-001): التأكيد يجب أن يطابق القيم الحالية — تأكيد قديم
     * لقيمة سابقة لا يجوز أن يوثّق سحبًا بقيم جديدة. */
    if (ownerPartMinor > 0 && !ownerPartConfirmedCurrent) {
      setMessage({
        tone: "error",
        text: `دفع المشروع فوق حصته بمقدار ${formatMoneyMinor(ownerPartMinor)} د.أ — أكّد أن المالك تحمّل الباقي ليُسجل سحبًا شخصيًا بنفس الحفظ، أو عدّل المدفوع.`,
      });
      return false;
    }
    /* S06 (UNIT-019): بوابة التذكير القادم — فترة لاحقة حصرًا. */
    if (recurrenceProblem) {
      setMessage({
        tone: "error",
        text:
          recurrenceProblem === "recurrence_date_invalid"
            ? "أدخل تاريخ التذكير القادم تاريخًا محليًا صحيحًا."
            : "التذكير القادم يجب أن يكون في شهر لاحق — مصروف هذه الفترة يُسجَّل الآن؛ أول تذكير جديد هو القادم.",
      });
      return false;
    }
    setMessage(null);
    /* EXE-009 (OWN-001): الحارس التقاطعي لأحداث المالك — إدخال/سحب بنفس
     * المبلغ والتاريخ موجود في نموذج حركة الدفتر؟ إيقاف بإفصاح وتأكيد صريح. */
    if (
      (selectedType === "owner_investment_cash" || selectedType === "owner_withdrawal_cash") &&
      !confirmedDistinctRef.current
    ) {
      const duplicate = await ownerEntitlement.findCrossModelOwnerDuplicate({
        direction: selectedType === "owner_investment_cash" ? "injection" : "withdrawal",
        amountMinor,
        occurredOn: date,
        writing: "event",
      });
      if (duplicate.ok && duplicate.value) {
        setDuplicateWarning(duplicate.value);
        return false;
      }
    }
    setDuplicateWarning(null);
    saveInFlightRef.current = true;
    setSaving(true);
    const sharedExpense = sharedExpenseIntent;
    /* S06 (CONS-DEC04 / SDF-064): فرع الفاتورة المشتركة فوق الحصة — نية
     * واحدة بحدثين عبر الكاتب الكنوني (مصروف الحصة + سحب المالك بالفارق
     * المؤكد)؛ الإعادة بنفس المفتاح تعيد القائم ولا تضاعف.
     * S07 (S06-MR-001): التأكيد النافذ هو المطابق للزوج الحالي فقط،
     * ويمرر مع النية فيطابقه الحد قبل أي كتابة. */
    const sharedBillApplies = ownerPartMinor > 0 && ownerPartConfirmedCurrent;
    let savedExpense: FinancialEvent | null = null;
    let ownerPartEvent: FinancialEvent | null = null;
    let ownerPartFailure: string | null = null;
    let reusedPlain = false;
    try {
      if (sharedBillApplies) {
        const bill = await projectFinance.recordSharedBill({
          type: selectedType,
          ...(sharedMode === "percentage" && isShared ? {} : { amountMinor }),
          occurredOn: date,
          note,
          counterparty: counterparty || null,
          relatedEventId: null,
          expenseContext,
          sharedExpense,
          /* S07 (S06-MR-001): زوج التأكيد النافذ يمر مع النية — الحد
           * يطابقه بالاشتقاق الحالي قبل أي كتابة. */
          ownerPartConfirmation: ownerPartConfirmedFor,
          idempotencyKey: idempotencyKey.current,
          sourceWalletId: walletId && walletId !== UNSET_EXPENSE_SOURCE ? walletId : null,
        });
        if (!bill.ok) {
          setSaving(false);
          setMessage({ text: bill.message, tone: "error" });
          return false;
        }
        savedExpense = bill.value.expense;
        ownerPartEvent = bill.value.ownerPart;
        ownerPartFailure = bill.value.ownerPartFailure;
      } else {
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
          /* G-006: محفظة مصدر سحب المالك تمر مع الحدث — فحص التغطية قبل أي
           * كتابة بالحرس الكنوني المشترك نفسه لمسار الدفتر. */
          sourceWalletId:
            selectedType === "owner_withdrawal_cash" && walletId && walletId !== UNSET_EXPENSE_SOURCE
              ? walletId
              : null,
        });
        if (!result.ok) {
          setSaving(false);
          setMessage({ text: result.message, tone: "error" });
          return false;
        }
        if (result.reused) {
          reusedPlain = true;
        }
        savedExpense = result.value;
      }
    } finally {
      saveInFlightRef.current = false;
    }
    if (reusedPlain) {
      setSaving(false);
      setMessage({
        tone: "info",
        text: "لم يُحفظ التعديل. هذا الحدث مسجل سابقًا بنفس المفتاح؛ للتصحيح تراجع عن الحدث الأصلي وسجّل حدثًا جديدًا.",
      });
      return false;
    }
    const result = { ok: true as const, value: savedExpense };
    /* المال محفوظ الآن — المسودة تُمسح قبل أي خطوة لاحقة مهما صار، والوسخ
     * يُصفر (عهدة الحفظ) فلا يعترض الحارس على خروج صاحب سجل محفوظ. */
    savedRef.current = true;
    setSavedEpoch(epoch => epoch + 1);
    clearDraft();
    let attributionFailed: string | null = null;
    /* R3-F06: كل فشل نسبة يُجمع بجواره لا يُبتلع — فشل تغطية الحصة وفشل
     * تغطية الجزء الشخصي قاعدتان مستقلتان وقد تقعان معًا (المحفظة نفسها
     * لا تكفي أحدهما أو كليهما)، فصيغة «الأول فقط» كانت تُسقط الحقيقة
     * الثانية عن المستخدم. */
    let ownerAttributionFailed: string | null = null;
    /* المجموعة ١ (وجهة الصرف): تغطية المحفظة المختارة بعد التسجيل — نفس توقيع
     * ورقة الإضافة (مفتاح مشتق من مفتاح السجل) فلا تخصيص مزدوج عند الإعادة.
     * فشل النسبة لا يمس الحدث: المال محفوظ غير موزع، والنص يظهر قبل الخروج.
     * EXE-009: الاستثمار يخصص إلى المحفظة (+) والسحب يغطي منها (−) — بنفس
     * الآلية ونوع مصدر owner_event الرابط بالحدث نفسه. */
    if (
      (selectedType === "operating_expense_cash" ||
        selectedType === "owner_investment_cash" ||
        selectedType === "owner_withdrawal_cash") &&
      walletId &&
      walletId !== UNSET_EXPENSE_SOURCE
    ) {
      /* EXE-007: فرع المصروف يمر بالتوقيع الموحد من المواصفة نفسها التي
       * تستعملها ورقة الإضافة السريعة — تغطية واحدة بتعريف واحد. */
      const attribution =
        selectedType === "operating_expense_cash"
          ? await coverExpenseFromWallet(projectFinance, {
              walletId,
              amountMinor: result.value.amountMinor,
              eventId: result.value.id,
              operationKey: idempotencyKey.current,
            })
          : await projectFinance.distributeUnallocated({
              walletId,
              deltaMinor:
                selectedType === "owner_investment_cash"
                  ? result.value.amountMinor
                  : -result.value.amountMinor,
              note:
                selectedType === "owner_investment_cash"
                  ? "توزيع استثمار مالك إلى المحفظة"
                  : "تغطية سحب شخصي من رصيد المحفظة",
              sourceRefId: result.value.id,
              sourceRefKind: "owner_event",
              operationKey: `${idempotencyKey.current}:attribute`,
            });
      if (!attribution.ok)
        attributionFailed =
          attribution.message ?? "تعذرت تغطية المحفظة بعد حفظ الحدث؛ المال محفوظ في الكاش غير الموزع.";
      /* S06 (CONS-DEC04): سحب الجزء الشخصي يغطى من المحفظة نفسها التي دفعت
       * الفاتورة، بمفتاحه المشتق المستقل — فشله لا يمس الحدثين المحفوظين. */
      if (ownerPartEvent) {
        const ownerAttribution = await projectFinance.distributeUnallocated({
          walletId,
          deltaMinor: -ownerPartEvent.amountMinor,
          note: "تغطية الجزء الشخصي من فاتورة مشتركة من رصيد المحفظة",
          sourceRefId: ownerPartEvent.id,
          sourceRefKind: "owner_event",
          operationKey: `${idempotencyKey.current}:owner-part:attribute`,
        });
        if (!ownerAttribution.ok)
          ownerAttributionFailed =
            ownerAttribution.message ?? "تعذرت تغطية الجزء الشخصي بعد حفظه؛ المال محفوظ في الكاش غير الموزع.";
      }
    }
    /* R3-F06: تأليف كل حقائق النسبة الفاشلة في جملة واحدة صادقة. */
    const failedAttributions = [
      attributionFailed ? `نسبة الحصة للمحفظة: ${attributionFailed}` : null,
      ownerAttributionFailed ? `تغطية الجزء الشخصي من المحفظة: ${ownerAttributionFailed}` : null,
    ].filter((part): part is string => part !== null);
    setSaving(false);
    /* FIN-004 (قرار المالك المعتمد ٢٠٢٦-٠٩-١٦): الإشعار بعد اكتمال كل
     * الكتابات (الحدث ثم تغطية المحفظة) — إبطال حالة واحدة بعد النجاح. */
    notifyDataChanged();
    /* S06 (D07 — UNIT-019): إعداد التكرار بعد ثبوت المصروف — مصروف واحد
     * وإعداد واحد بقصد مترابط؛ فشل الإعداد نتيجة جزئية صادقة تُستكمل
     * وحدها ولا تعيد المصروف أبدًا. */
    let setupFailed: string | null = null;
    if (recurrenceEnabled && recurringExpenses) {
      const setup = await recurringExpenses.setupFromExpense({
        seriesId: `recurring-${idempotencyKey.current}`,
        title: note.trim(),
        nextReminderDate: recurrenceNextDate,
        suggestedAmountMinor: result.value.amountMinor,
        suggestedWalletId: walletId && walletId !== UNSET_EXPENSE_SOURCE ? walletId : null,
        categoryLabel: normalizedCategoryLabel || null,
      });
      if (!setup.ok) {
        setupFailed = setup.message;
        /* R3-F01: التاريخ لا يُجمّد في نية الاستئناف — حقل «التذكير
         * القادم» أعلاه هو المرجع الحي للتصحيح، وبقية النية (المعرف
         * الحتمي والعنوان والمبلغ والمحفظة والتصنيف) مجمّدة كما هي. */
        setSeriesSetupFailure({
          seriesId: `recurring-${idempotencyKey.current}`,
          title: note.trim(),
          amountMinor: result.value.amountMinor,
          walletId: walletId && walletId !== UNSET_EXPENSE_SOURCE ? walletId : null,
          categoryLabel: normalizedCategoryLabel || null,
          message: setup.message,
        });
      }
    }
    if (ownerPartFailure) {
      setSavedNote({
        eventId: result.value.id,
        /* R3-F02: الرسالة مكتملة الصدق بذاتها — نسبة الحصة قد تكون نجحت
         * وفشل السحب الشخصي وحده، فلا إطار ثابت يدّعي فشل النسبة ولا
         * يحتكر الحقيقة؛ تأليف كل فشل نسبة لاحق هو المعروض (R3-F06). */
        message: `حُفظ مصروف الحصة (${formatMoneyMinor(result.value.amountMinor)} د.أ)، ولم يكتمل تسجيل الجزء الشخصي (${formatMoneyMinor(ownerPartMinor)} د.أ سحبًا على المالك): ${ownerPartFailure} — أعد المحاولة من هنا، فلن يتكرر المصروف.${
          failedAttributions.length > 0 ? ` كما تعذرت ${failedAttributions.join("، و")}.` : ""
        }`,
        ownerPartRetryMinor: ownerPartMinor,
        /* R1-F01: النية الفاشلة مجمّدة كما هي — الإعادة لا تقرأ النموذج الحي.
         * S07 (S06-MR-001): زوج التأكيد يُجمد مع النية — نفس القيم التي
         * وثّقت السحب أول مرة؛ تعديل النموذج بعدها لا يغير السحب. */
        ownerPartRetryIntent: {
          type: selectedType,
          ...(sharedMode === "percentage" && isShared ? {} : { amountMinor }),
          occurredOn: date,
          note,
          counterparty: counterparty || null,
          expenseContext,
          sharedExpense: sharedExpense as NonNullable<typeof sharedExpense>,
          ownerPartConfirmation: ownerPartConfirmedFor as SharedBillOwnerPartConfirmation,
          idempotencyKey: idempotencyKey.current,
          sourceWalletId: walletId && walletId !== UNSET_EXPENSE_SOURCE ? walletId : null,
        },
        attributionNote: attributionFailed,
        ownerAttributionNote: ownerAttributionFailed,
      });
      return true;
    }
    if (failedAttributions.length > 0) {
      /* R3-F02: الإطار الكامل للنسبة الفاشلة داخل الرسالة نفسها — البانر
       * يعرض الرسالة وحدها فلا يُضاف معنى فوق معناها؛ صيغة «نسبته للمحفظة
       * لم تتم» محفوظة لحالة فشل الحصة وحدها (عقد المجموعة ١)، والجزء
       * الشخصي يُفصح باسمه حين يفشل وحده أو معها (R3-F06). */
      const attributionFraming =
        attributionFailed && ownerAttributionFailed
          ? `نسبته للمحفظة لم تتم: ${attributionFailed}، كما تعذرت تغطية الجزء الشخصي من المحفظة: ${ownerAttributionFailed}`
          : attributionFailed
            ? `نسبته للمحفظة لم تتم: ${attributionFailed}`
            : `تعذرت تغطية الجزء الشخصي من المحفظة: ${ownerAttributionFailed ?? ""}`;
      setSavedNote({
        eventId: result.value.id,
        message: `حُفظ الحدث محليًا، لكن ${attributionFraming} — المال محفوظ ضمن الكاش غير الموزع حتى توزّعه بنفسك.`,
        attributionNote: attributionFailed,
        ownerAttributionNote: ownerAttributionFailed,
      });
      return true;
    }
    if (setupFailed) {
      /* R3-F07: المصروف محفوظ والصفحة قائمة بعد نتيجة جزئية — العودة
       * هي الفعل الأساسي لا حفظ جديد. */
      setSavedStandingType(selectedType);
      return true;
    }
    /* N-92 (إصلاح نصي 4.3): صيغة الماضي الموحدة «حُفظ…» كإخواتها (الملف:
     * «حُفظ ملفك محليًا») — بلا تغيير معنى. */
    setMessage({
      text: recurrenceEnabled
        ? `حُفظ الحدث المالي محليًا، وضُبط التذكير القادم ${recurrenceNextDate}.`
        : "حُفظ الحدث المالي محليًا.",
      tone: "success",
    });
    /* S1-07: الخروج بعد حفظ ناجح يعود للمصدر (?from) — عقد ٢٦ قاعدة ٣. */
    navigate(returnPath);
    return true;
  }

  /* S06 (CONS-DEC04): إعادة محاولة السحب الشخصي الناقص وحده — نفس نية
   * الحفظ ومفتاحها المشتق؛ المصروف المحفوظ يُعاد استخدامه لا تكراره. */
  async function retryOwnerPart(): Promise<void> {
    if (!type || !savedNote?.ownerPartRetryMinor || !savedNote.ownerPartRetryIntent) return;
    /* R1-F01: الإعادة بالنية المجمّدة لحظة الفشل — تعديل النموذج بعدها لا
     * يغيّر مبلغ السحب ولا يفكك زوج النية الواحدة. */
    const intent = savedNote.ownerPartRetryIntent;
    setSaving(true);
    try {
      const bill = await projectFinance.recordSharedBill({
        type: intent.type,
        ...(intent.amountMinor !== undefined ? { amountMinor: intent.amountMinor } : {}),
        occurredOn: intent.occurredOn,
        note: intent.note,
        counterparty: intent.counterparty,
        relatedEventId: null,
        expenseContext: intent.expenseContext,
        sharedExpense: intent.sharedExpense,
        /* S07 (S06-MR-001): زوج التأكيد المجمّد مع النية — الإعادة بنفس
         * القيم التي وثّقت السحب أول مرة، فيطابقها الحد كما طابقها أول
         * مرة؛ لا يُعاد طلب تأكيد من قيم نموذج حي بعد الفشل. */
        ownerPartConfirmation: intent.ownerPartConfirmation,
        idempotencyKey: intent.idempotencyKey,
        sourceWalletId: intent.sourceWalletId,
      });
      if (bill.ok && !bill.value.ownerPartFailure) {
        /* R3-F03: التغطية من محفظة النية المجمّدة لا من محفظة النموذج
         * الحي — السحب مُرصود على محفظة النية (intent.sourceWalletId)
         * وتغيير الاختيار بعد الفشل لا يجعل الخصم من محفظة أخرى. */
        if (bill.value.ownerPart && intent.sourceWalletId) {
          const ownerAttribution = await projectFinance.distributeUnallocated({
            walletId: intent.sourceWalletId,
            deltaMinor: -bill.value.ownerPart.amountMinor,
            note: "تغطية الجزء الشخصي من فاتورة مشتركة من رصيد المحفظة",
            sourceRefId: bill.value.ownerPart.id,
            sourceRefKind: "owner_event",
            operationKey: `${idempotencyKey.current}:owner-part:attribute`,
          });
          if (!ownerAttribution.ok) {
            /* R3-F06: ملاحظتا النسبة الفاشلتان تُؤلّفان معًا لا أولاهما. */
            const pendingNotes = [
              savedNote.attributionNote ? `نسبة الحصة للمحفظة: ${savedNote.attributionNote}` : null,
              `تغطية الجزء الشخصي من المحفظة: ${ownerAttribution.message ?? "المال محفوظ في الكاش غير الموزع."}`,
            ].filter((part): part is string => part !== null);
            setSavedNote({
              eventId: bill.value.expense.id,
              message: `حُفظ الجزء الشخصي، وتعذرت ${pendingNotes.join("، و")} — المال محفوظ ضمن الكاش غير الموزع حتى توزّعه بنفسك.`,
              attributionNote: savedNote.attributionNote ?? null,
              ownerAttributionNote: ownerAttribution.message ?? null,
            });
            return;
          }
        }
        /* R1-F02: فشل نسبة الحصة السابق لا يُبتلع بنجاح الجزء الشخصي، وفشل
         * نسبة الجزء الشخصي كذلك (R3-F06). */
        const remainingNotes = [
          savedNote.attributionNote ? `نسبة الحصة للمحفظة: ${savedNote.attributionNote}` : null,
          savedNote.ownerAttributionNote
            ? `تغطية الجزء الشخصي من المحفظة: ${savedNote.ownerAttributionNote}`
            : null,
        ].filter((part): part is string => part !== null);
        if (remainingNotes.length > 0) {
          setSavedNote({
            eventId: bill.value.expense.id,
            message: `حُفظ الجزء الشخصي سحبًا على المالك بنية الحفظ نفسها. كما تعذرت ${remainingNotes.join("، و")} — المال محفوظ ضمن الكاش غير الموزع حتى توزّعه بنفسك.`,
            attributionNote: savedNote.attributionNote,
            ownerAttributionNote: savedNote.ownerAttributionNote,
          });
        } else {
          setSavedNote(null);
        }
        /* R3-F07: الحدثان محفوظان والصفحة قائمة — العودة هي الفعل الأساسي. */
        setSavedStandingType(intent.type);
        notifyDataChanged();
        setMessage({ text: "حُفظ الجزء الشخصي سحبًا على المالك بنية الحفظ نفسها.", tone: "success" });
      } else if (bill.ok) {
        setSavedNote({
          eventId: bill.value.expense.id,
          message: `لم يكتمل تسجيل الجزء الشخصي: ${bill.value.ownerPartFailure}`,
          ownerPartRetryMinor: savedNote.ownerPartRetryMinor,
          ownerPartRetryIntent: intent,
          attributionNote: savedNote.attributionNote ?? null,
          ownerAttributionNote: savedNote.ownerAttributionNote ?? null,
        });
      } else {
        setSavedNote({
          eventId: savedNote.eventId,
          message: `لم يكتمل تسجيل الجزء الشخصي: ${bill.message}`,
          ownerPartRetryMinor: savedNote.ownerPartRetryMinor,
          ownerPartRetryIntent: intent,
          attributionNote: savedNote.attributionNote ?? null,
          ownerAttributionNote: savedNote.ownerAttributionNote ?? null,
        });
      }
    } finally {
      setSaving(false);
    }
  }

  /* S06 (D07): استئناف إعداد التكرار الناقص وحده — المعرف الحتمي نفسه
   * فلا تكرار للسلسلة ولا إعادة تسجيل للمصروف أبدًا. التاريخ المعروض في
   * حقل «التذكير القادم» أعلاه هو مرجع الاستئناف (R3-F01): المصروف مؤرّخ
   * سابقًا كان يجمّد الاستئناف على تاريخ ترفضه الخدمة حتميًا فلا نجاح
   * ممكن — التصحيح الحي للتكملة الناقصة، وبقية نية الإعداد مجمّدة. */
  async function retrySeriesSetup(): Promise<void> {
    if (!seriesSetupFailure || !recurringExpenses) return;
    /* R3-F04: عهدة أثناء التنفيذ — النقر المزدوج لا يطلق إعدادين
     * متزامنين بمفتاح واحد فتبتلع نتيجة بأخرى. */
    if (seriesRetryInFlightRef.current) return;
    const problem = deriveRecurrenceProblem({
      enabled: true,
      nextDate: recurrenceNextDate,
      today: todayInAmman(),
    });
    if (problem) {
      setSeriesSetupFailure({
        ...seriesSetupFailure,
        message:
          problem === "recurrence_date_invalid"
            ? "أدخل تاريخ التذكير القادم تاريخًا محليًا صحيحًا."
            : "التذكير القادم يجب أن يكون في شهر لاحق — مصروف هذه الفترة سُجل للتو؛ عدّل تاريخ التذكير القادم أعلاه.",
      });
      return;
    }
    seriesRetryInFlightRef.current = true;
    setSaving(true);
    try {
      const setup = await recurringExpenses.setupFromExpense({
        seriesId: seriesSetupFailure.seriesId,
        title: seriesSetupFailure.title,
        nextReminderDate: recurrenceNextDate,
        suggestedAmountMinor: seriesSetupFailure.amountMinor,
        suggestedWalletId: seriesSetupFailure.walletId,
        categoryLabel: seriesSetupFailure.categoryLabel,
      });
      if (setup.ok) {
        const confirmedDate = recurrenceNextDate;
        setSeriesSetupFailure(null);
        /* R3-F07: المصروف محفوظ والاستئناف اكتمل — العودة هي الفعل الأساسي. */
        setSavedStandingType(type);
        notifyDataChanged();
        setMessage({
          text: `ضُبط التذكير القادم ${confirmedDate}.`,
          tone: "success",
        });
      } else {
        setSeriesSetupFailure({ ...seriesSetupFailure, message: setup.message });
      }
    } finally {
      seriesRetryInFlightRef.current = false;
      setSaving(false);
    }
  }

  return (
    <section className="micro-page micro-finance-page">
      <button
        className="micro-back-button"
        type="button"
        onClick={() => (savedRef.current ? navigate(returnPath) : requestNavigation(returnPath))}
      >
        <ArrowRight aria-hidden="true" /> المالية
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
      {/* EXE-009 (OWN-001): حارس التكرار التقاطعي لأحداث المالك — يظهر مكان
       * الحفظ حتى الحسم بالتأكيد أو المراجعة. */}
      {(type === "owner_investment_cash" || type === "owner_withdrawal_cash") && duplicateWarning ? (
        <CrossModelDuplicateNotice
          duplicate={duplicateWarning}
          onReviewLedger={() => navigate(withReturnTo("/finance/owner-entitlement", returnPath))}
          onConfirmDistinct={() => {
            confirmedDistinctRef.current = true;
            setDuplicateWarning(null);
            void save();
          }}
        />
      ) : null}
      <section className="micro-form-card">
        {draftOffer ? (
          /* المجموعة ١ (مسودة محفوظة): استرجاع بفعل صريح — لا تحويل سجل تلقائي أبدًا. */
          <div className="micro-draft-banner" role="status">
            <p>عندك مسودة غير محفوظة من إدخال سابق — ترجّعها؟</p>
            <div className="micro-form-actions">
              <Button action="save" onClick={restoreDraft}>
                استرجع المسودة
              </Button>
              <Button action="secondary" onClick={discardDraft}>
                تجاهلها
              </Button>
            </div>
          </div>
        ) : null}
        {draftSaveFailed ? (
          <p className="micro-field-error" role="alert">
            تعذر حفظ المسودة محليًا — قيمك أمامك كما هي ولم يُسجّل أي شيء؛ أكمل الكتابة أو اضغط الحفظ.
          </p>
        ) : null}
        {savedNote ? (
          /* المجموعة ١ (صدق النسبة): الرسالة نفسها كاملة الصدق لكل نتيجة
           * جزئية (نسبة فاشلة، أو سحب شخصي ناقص، أو تركيبهما — R3-F02/R3-F06)
           * — لا إطار ثابت يضيف معنى لم يقع؛ النص والوصلة قبل الخروج، لا
           * كذب ولا تجاهل ولا إعادة حفز المفتاح. */
          <div className="micro-draft-banner" role="status">
            <p>{savedNote.message}</p>
            <div className="micro-form-actions">
              {savedNote.ownerPartRetryMinor ? (
                <Button action="save" onClick={() => void retryOwnerPart()} disabled={saving}>
                  أعد محاولة تسجيل الجزء الشخصي
                </Button>
              ) : null}
              <button
                className="micro-text-action"
                type="button"
                onClick={() =>
                  navigate(
                    withReturnTo(`/finance?event=${encodeURIComponent(savedNote.eventId)}`, returnPath),
                  )
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
        {paidFieldApplies ? (
          /* S06 (CONS-DEC04 المعتمدة / SDF-064): سؤال الفاتورة المشتركة —
           * قدّش دُفع فعلًا من صندوق المشروع؟ فوق الحصة يفتح «من تحمّل
           * الباقي» بتأكيد صريح؛ لا يُفترض تحمّل المالك بلا قرار. */
          <>
            <label className="micro-field">
              <span>المدفوع فعليًا من صندوق المشروع (د.أ)</span>
              <EnglishNumberInput
                value={sharedPaidAmountMinor}
                kind="money"
                onNumericChange={setSharedPaidAmountMinor}
                onTextValidityChange={setValidSharedPaid}
                aria-label="المدفوع فعليًا من صندوق المشروع"
              />
              <small>
                اتركه فارغًا إن دفعت حصة المشروع فقط؛ إن دفعت الفاتورة كاملة أو فوق حصتك فأدخل المبلغ الفعلي
                الذي خرج من صندوق المشروع.
              </small>
            </label>
            {ownerPartMinor > 0 ? (
              <label className="micro-checkbox">
                <input
                  type="checkbox"
                  /* S07 (S06-MR-001): المؤشر يتبع صلاحية التأكيد الحالية —
                   * بعد أي تغيير للحصة/المدفوع يظهر غير معتمد فيُعاد طلبه
                   * قبل الحفظ؛ لا يبقى مؤشرًا قائمًا لقيمة تغيّرت. */
                  checked={ownerPartConfirmedCurrent}
                  onChange={event => {
                    if (event.target.checked) {
                      setOwnerPartConfirmedFor(
                        sharedBillOwnerPartConfirmationOf(
                          sharedSharePreviewMinor ?? 0,
                          sharedPaidAmountMinor > 0 ? sharedPaidAmountMinor : null,
                        ),
                      );
                    } else {
                      setOwnerPartConfirmedFor(null);
                    }
                  }}
                />
                <span>
                  الفارق {formatMoneyMinor(ownerPartMinor)} د.أ فوق حصة المشروع على المالك — سجّله سحبًا
                  شخصيًا بنفس الحفظ (تحمّل المالك الباقي)
                </span>
              </label>
            ) : null}
          </>
        ) : null}
        {type === "operating_expense_cash" ||
        type === "owner_investment_cash" ||
        type === "owner_withdrawal_cash" ? (
          /* المجموعة ١ (الإدخال الموجّه): «من وين طلع المبلغ؟» — نفس مفردات ورقة
           * الإضافة (مصدر الصرف) حتى لا تتعدد مفردات المفهوم الواحد.
           * FIN-005: نفس قاعدة الورقة بعدد المحافظ — بلا تحويل صامت.
           * EXE-009: أحداث المالك — الاستثمار يسأل «وجهة الكاش» والسحب «مصدر
           * السحب»؛ الافتراضي الصريح الكاش غير الموزع (سلوك الحدث الأصلي). */
          wallets.length > 0 ? (
            <label className="micro-field">
              <span>
                {type === "owner_investment_cash"
                  ? "وجهة الكاش "
                  : type === "owner_withdrawal_cash"
                    ? "مصدر السحب "
                    : "مصدر الصرف "}
                <small>
                  {type === "operating_expense_cash"
                    ? expenseSourceHint(wallets.length)
                    : type === "owner_investment_cash"
                      ? "الكاش غير الموزع هو الافتراضي — اختر محفظة لتوزيع المال إليها"
                      : "الكاش غير الموزع هو الافتراضي — اختر محفظة لتغطية السحب من رصيدها"}
                </small>
              </span>
              <select
                value={walletId}
                onChange={event => {
                  walletSourceChosenRef.current = true;
                  setWalletId(event.target.value);
                }}
              >
                {type === "operating_expense_cash" && wallets.length > 1 ? (
                  <option value={UNSET_EXPENSE_SOURCE} disabled>
                    اختر مصدر الصرف
                  </option>
                ) : null}
                <option value="">الكاش غير الموزع</option>
                {wallets.map(wallet => (
                  <option key={wallet.id} value={wallet.id}>
                    {type === "owner_investment_cash"
                      ? `${wallet.name} — تخصيص إلى رصيدها`
                      : `${wallet.name} — تغطية من رصيدها`}
                  </option>
                ))}
              </select>
            </label>
          ) : type === "operating_expense_cash" ? (
            <p className="micro-offline-truth" role="status">
              لا محافظ معلنة بعد — سيُسجَّل المصروف من الكاش غير الموزع، ويمكن تغطيته من محفظة لاحقًا من مالي.
            </p>
          ) : null
        ) : null}
        <LocalDateField label="تاريخ الحدث" value={date} onChange={event => setDate(event.target.value)} />
        {recurringWarning ? (
          <p className="micro-offline-truth" role="status">
            {recurringWarning}
          </p>
        ) : null}
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
              onOpenSuppliers={() => navigate(withReturnTo("/suppliers", `/finance/new/${type}`))}
              onOpenAssets={() => navigate(withReturnTo("/assets", `/finance/new/${type}`))}
              onOpenLoans={() => navigate(withReturnTo("/loans", `/finance/new/${type}`))}
            />
          </details>
        ) : null}
        {isOperatingExpense && recurringExpenses ? (
          /* S06 (UNIT-019 / ORG-011): خيار «يتكرر» داخل المصروف — إعداد
           * مختصر لا نموذج تكرار مستقل؛ الموعد تذكير مراجعة لا دفعًا ولا
           * دينًا، وأول تذكير جديد هو القادم حصرًا. */
          <div className="micro-recurrence-option">
            <label className="micro-checkbox">
              <input
                type="checkbox"
                checked={recurrenceEnabled}
                onChange={event => {
                  setRecurrenceEnabled(event.target.checked);
                  /* R3-F01: الافتراضي من أحدث مرجع (تاريخ الحدث أو اليوم
                   * الحقيقي) — يرضي بوابة الخدمة الكنسية دائمًا. */
                  if (event.target.checked && !recurrenceNextDate)
                    setRecurrenceNextDate(defaultNextReminderDateForExpense(date, todayInAmman()));
                }}
              />
              <span>يتكرر — ذكّرني بهذا المصروف كل شهر</span>
            </label>
            {recurrenceEnabled ? (
              <LocalDateField
                label="التذكير القادم"
                value={recurrenceNextDate}
                onChange={event => setRecurrenceNextDate(event.target.value)}
              />
            ) : null}
            {recurrenceEnabled && !recurrenceProblem ? (
              <p className="micro-offline-truth" role="status">
                سيُحفظ المصروف الآن مرة واحدة، ويُضبط تذكير شهري بمبلغ مقترح{" "}
                {formatMoneyMinor(
                  sharedSharePreviewMinor !== null && sharedMode !== "defer"
                    ? sharedSharePreviewMinor
                    : amountMinor,
                )}{" "}
                د.أ — الموعد تذكير مراجعة، لا دفعًا تلقائيًا ولا دينًا.
              </p>
            ) : null}
          </div>
        ) : null}
        {seriesSetupFailure ? (
          /* S06 (D07): نتيجة جزئية صادقة — المصروف محفوظ والإعداد ناقص،
           * والاستئناف للناقص وحده؛ تاريخ «التذكير القادم» أعلاه هو مرجع
           * الاستئناف فيُصلح من هنا لا يُجمّد على الفاشل (R3-F01). */
          <div className="micro-draft-banner" role="status">
            <p>
              حُفظ المصروف، ولم يُحفظ التذكير: {seriesSetupFailure.message} — عدّل تاريخ «التذكير القادم»
              أعلاه إن لزم ثم استأنف الضبط من هنا، ولن يُسجّل المصروف مرة أخرى.
            </p>
            <div className="micro-form-actions">
              <Button action="save" onClick={() => void retrySeriesSetup()} disabled={saving}>
                أعد محاولة ضبط التذكير
              </Button>
              <Button action="secondary" onClick={() => setSeriesSetupFailure(null)}>
                تم
              </Button>
            </div>
          </div>
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
            className={message.tone === "error" ? "micro-field-error" : "micro-save-note"}
            role={message.tone === "error" ? "alert" : "status"}
          >
            {message.text}
          </p>
        ) : null}
        <div className="micro-form-actions micro-sticky-save">
          <Button
            action="save"
            block

            disabled={saving}
            /* R3-F07: بعد حفظ ثبت وبقيت الصفحة (نتيجة جزئية صُرفت أو
             * استئناف اكتمل) الفعل الأساسي عودة لا حفظ جديد — النية
             * المحفوظة تُحترم بمفتاحها ولا يُدعى الكاتب مرة أخرى. */
            onClick={() => (savedNote || savedStandingType === type ? leaveAfterSave() : void save())}
          >
            <Save aria-hidden="true" />
            {saving
              ? "جارٍ الحفظ…"
              : savedNote || savedStandingType === type
                ? "ارجع إلى المالية"
                : isOperatingExpense
                  ? "حفظ المصروف المصنف"
                  : "حفظ الحدث"}
          </Button>
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
  /* GAP-4.3-08: إحالة لبيتي الأصول والقروض القائمين. */
  onOpenAssets: () => void;
  onOpenLoans: () => void;
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
    onOpenAssets,
    onOpenLoans,
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
          تصنيفك للمصروف <small>اختياري — على ماذا أُنفق المصروف؟ بنزين، رواتب، إيجار…</small>
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
       * والأصول والقروض مساران منفذان لهما بيتاهما — GAP-4.3-08 (W4-NEW-01/
       * REV-005، Wave 4.3): إحالة صادقة للسطحين القائمين بدل وعد «لاحقًا»
       * لميزتين موجودتين؛ لا مسار مالي بديل يُخترع. */}
      <p className="micro-expense-route-note">
        <button className="micro-text-action" type="button" onClick={onOpenSuppliers}>
          شراء خامات ستبقى في المخزون؟ سجّله من الموردون والمشتريات — لا كمصروف عادي.
        </button>
      </p>
      <p className="micro-expense-route-note">
        <button className="micro-text-action" type="button" onClick={onOpenAssets}>
          شراء للاستخدام الطويل؟ سجّله من الأصول — لا كمصروف عادي.
        </button>{" "}
        ·{" "}
        <button className="micro-text-action" type="button" onClick={onOpenLoans}>
          أعطيت مالًا يُعاد؟ سجّله من القروض — ليس مصروفًا ولا مبيعًا.
        </button>
      </p>
    </section>
  );
}
