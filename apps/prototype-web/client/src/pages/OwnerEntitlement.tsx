/* مبدأ Micro: أظهر ملخص حق المالك أولًا، وأجّل إنشاء السياسة والحركة والسجل إلى مداخل مستقلة. */
import { ArrowRight, CircleDollarSign, HandCoins, RotateCcw, Save, WalletCards } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { withFrom } from "@/app/navigationContract";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { percentToBpsExact } from "@/application/input/englishNumeric";
import { OwnerPolicyFormsSection } from "@/components/owner/OwnerPolicyFormsSection";
import { OwnerLedgerFormsSection } from "@/components/owner/OwnerLedgerFormsSection";
import {
  amountPolicyKinds,
  movementReasonLabels,
  ownerMovementReasonsForKind,
  percentagePolicyKinds,
  policyFamilyLabels,
  policyLabels,
  successorPolicyFormRequirements,
  supportedOwnerEntitlementPolicyKinds,
} from "@/presentation/ownerEntitlementPresentation";
import { formatLocalDate, formatMoneyMinor, localDateInAmman } from "@/presentation/formatters";
import type {
  OwnerEntitlementOverview,
  OwnerMoneyOverview,
} from "@/application/finance/ownerEntitlementService";
import {
  ownerEntitlementPolicyFamilyForKind,
  type OwnerEntitlementPolicy,
  type OwnerMovementReason,
} from "@micro-domain/owner-entitlement/index.js";

type Notice = { tone: "success" | "error"; text: string } | null;
const monthStart = () => `${localDateInAmman().slice(0, 7)}-01`;
const idempotency = (prefix: string) => `${prefix}:${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;

export default function OwnerEntitlement() {
  const [, navigate] = useLocation();
  /* G6-U2-4 (المجموعة ٦ — عقد ٢٦): الرجوع للمصدر (?from) مع بديل قانوني،
   * لا مسار ثابت يتجاهل من أين فُتح الدفتر. */
  const returnPath = useReturnPath();
  const { ownerEntitlement, dataVersion, notifyDataChanged } = usePrototypeServices();
  const [overview, setOverview] = useState<OwnerEntitlementOverview | null>(null);
  /* المجموعة ٦ (البند ٢): القراءة الموحدة لمال المالك فوق المصدرين. */
  const [ownerMoney, setOwnerMoney] = useState<OwnerMoneyOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [policyKind, setPolicyKind] = useState<OwnerEntitlementPolicy["kind"]>("monthly");
  const [policyAmount, setPolicyAmount] = useState(0);
  const [policyAmountValid, setPolicyAmountValid] = useState(true);
  const [policyPercentage, setPolicyPercentage] = useState(0);
  const [policyPercentageValid, setPolicyPercentageValid] = useState(true);
  const [policyStartsOn, setPolicyStartsOn] = useState(monthStart);
  const [policyEndsOn, setPolicyEndsOn] = useState("");
  const [policySource, setPolicySource] = useState("");
  const [policyNote, setPolicyNote] = useState("");
  const [selectedPolicyId, setSelectedPolicyId] = useState("");
  const [successorPolicyId, setSuccessorPolicyId] = useState("");
  const [successorStartsOn, setSuccessorStartsOn] = useState(localDateInAmman);
  const [successorKind, setSuccessorKind] = useState<OwnerEntitlementPolicy["kind"]>("monthly");
  const [successorAmount, setSuccessorAmount] = useState(0);
  const [successorAmountValid, setSuccessorAmountValid] = useState(true);
  const [successorPercentage, setSuccessorPercentage] = useState(0);
  const [successorPercentageValid, setSuccessorPercentageValid] = useState(true);
  const [successorUnitLabel, setSuccessorUnitLabel] = useState("");
  const [successorEndsOn, setSuccessorEndsOn] = useState("");
  const [successorSource, setSuccessorSource] = useState("");
  const [successorNote, setSuccessorNote] = useState("");
  const [selectedEntitlementId, setSelectedEntitlementId] = useState("");
  const [periodFrom, setPeriodFrom] = useState(monthStart);
  const [periodTo, setPeriodTo] = useState(
    () =>
      `${localDateInAmman().slice(0, 7)}-${new Date(Date.UTC(Number(localDateInAmman().slice(0, 4)), Number(localDateInAmman().slice(5, 7)), 0)).getUTCDate()}`,
  );
  const [entitlementDate, setEntitlementDate] = useState(localDateInAmman);
  const [entitlementNote, setEntitlementNote] = useState("");
  const [calculation, setCalculation] = useState<{
    amountMinor: number | null;
    knowledge: string;
    nextAction: string;
  } | null>(null);
  const [openingAmount, setOpeningAmount] = useState<number | null>(null);
  const [openingAmountValid, setOpeningAmountValid] = useState(true);
  const [openingDate, setOpeningDate] = useState(localDateInAmman);
  const [openingReason, setOpeningReason] = useState("");
  const [openingNote, setOpeningNote] = useState("");
  const [movementKind, setMovementKind] = useState<"draw" | "return">("draw");
  const [movementReason, setMovementReason] = useState<OwnerMovementReason>("entitlement_settlement");
  const [movementAmount, setMovementAmount] = useState(0);
  const [movementAmountValid, setMovementAmountValid] = useState(true);
  const [movementWalletId, setMovementWalletId] = useState("");
  const [movementDate, setMovementDate] = useState(localDateInAmman);
  const [movementNote, setMovementNote] = useState("");
  const [relatedEntitlementId, setRelatedEntitlementId] = useState("");
  const [relatedOpeningBalanceId, setRelatedOpeningBalanceId] = useState("");
  const [relatedMovementId, setRelatedMovementId] = useState("");
  const [reversalTarget, setReversalTarget] = useState<{
    kind: "movement" | "entitlement" | "opening";
    id: string;
  } | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [saving, setSaving] = useState(false);
  const policyOperation = useRef(idempotency("owner-policy"));
  const successorOperation = useRef(idempotency("owner-successor"));
  const entitlementOperation = useRef(idempotency("owner-entitlement"));
  const openingOperation = useRef(idempotency("owner-opening"));
  const movementOperation = useRef(idempotency("owner-movement"));

  useEffect(() => {
    let active = true;
    setLoading(true);
    ownerEntitlement.readOverview().then(result => {
      if (!active) return;
      if (!result.ok) {
        setError(result.message);
        setLoading(false);
        return;
      }
      setOverview(result.value);
      setMovementWalletId(current => current || result.value.walletBalances[0]?.id || "");
      setSelectedPolicyId(current => current || result.value.activePolicies[0]?.id || "");
      setSuccessorPolicyId(current => current || result.value.activePolicies[0]?.id || "");
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [ownerEntitlement, dataVersion]);
  /* المجموعة ٦ (البند ٢): الدفتر الموحد يُقرأ مع كل تحديث بيانات. */
  useEffect(() => {
    let active = true;
    ownerEntitlement.readOwnerMoneyOverview().then(result => {
      if (active && result.ok) setOwnerMoney(result.value);
    });
    return () => {
      active = false;
    };
  }, [ownerEntitlement, dataVersion]);

  const selectedPolicy = useMemo(
    () => overview?.policies.find(policy => policy.id === selectedPolicyId) ?? null,
    [overview, selectedPolicyId],
  );
  const successorPolicy = useMemo(
    () => overview?.policies.find(policy => policy.id === successorPolicyId) ?? null,
    [overview, successorPolicyId],
  );
  const reversedEntitlementIds = new Set(
    (overview?.entitlements ?? [])
      .filter(record => record.reversalOfId !== null)
      .map(record => record.reversalOfId),
  );
  const reversedOpeningIds = new Set(
    (overview?.openingBalances ?? [])
      .filter(balance => balance.reversalOfId !== null)
      .map(balance => balance.reversalOfId),
  );
  const reversedMovementIds = new Set(
    (overview?.movements ?? [])
      .filter(movement => movement.reversalOfId !== null)
      .map(movement => movement.reversalOfId),
  );
  const activeEntitlements =
    overview?.entitlements.filter(
      record => record.reversalOfId === null && !reversedEntitlementIds.has(record.id),
    ) ?? [];
  const activeOpeningBalances =
    overview?.openingBalances.filter(
      balance => balance.reversalOfId === null && !reversedOpeningIds.has(balance.id),
    ) ?? [];
  const priorDraws =
    overview?.movements.filter(
      movement =>
        movement.kind === "draw" &&
        movement.reversalOfId === null &&
        !reversedMovementIds.has(movement.id) &&
        movement.reason !== "entitlement_settlement" &&
        movement.reason !== "opening_balance_settlement",
    ) ?? [];
  const reasonOptions = ownerMovementReasonsForKind(movementKind);
  const successorRequirements = successorPolicyFormRequirements(successorKind);

  useEffect(() => {
    if (!reasonOptions.includes(movementReason as never)) setMovementReason(reasonOptions[0]);
  }, [movementKind]);
  useEffect(() => {
    if (!successorPolicy) return;
    setSuccessorKind(successorPolicy.kind);
    setSuccessorAmount(successorPolicy.amountMinor ?? 0);
    setSuccessorPercentage((successorPolicy.percentageBps ?? 0) / 100);
    setSuccessorUnitLabel(successorPolicy.unitLabel ?? "");
    setSuccessorEndsOn(successorPolicy.kind === "fixed_period" ? (successorPolicy.endsOn ?? "") : "");
  }, [successorPolicy?.id]);
  useEffect(() => {
    if (!selectedPolicy) {
      setCalculation(null);
      return;
    }
    ownerEntitlement
      .calculate(selectedPolicy.id, periodFrom, periodTo)
      .then(result =>
        setCalculation(
          result.ok
            ? result.value
            : { amountMinor: null, knowledge: "incomplete", nextAction: result.message },
        ),
      );
  }, [ownerEntitlement, selectedPolicy, periodFrom, periodTo, dataVersion]);

  if (loading)
    return (
      <div className="micro-route-loading" role="status">
        جارٍ قراءة دفتر حق المالك…
      </div>
    );
  if (error || !overview)
    return (
      <section className="micro-page micro-not-found">
        <h1>تعذر قراءة دفتر المالك</h1>
        <p>{error ?? "لم تتوفر بيانات محلية."}</p>
        <button
          className="micro-button micro-button-primary"
          type="button"
          onClick={() => navigate("/finance")}
        >
          الوضع المالي
        </button>
      </section>
    );

  async function savePolicy() {
    const fixedPeriodIncomplete = policyKind === "fixed_period" && !policyEndsOn;
    /* المجموعة ١١ (11-0 — سياسة القيم الدقيقة): النسبة تُحوّل إلى bps تحويلًا
     * دقيقًا فقط؛ الدقة الأدق من منزلتين تُرفض برسالة آمنة — لا تقريب صامت. */
    const policyPercentageBps = percentagePolicyKinds.has(policyKind)
      ? percentToBpsExact(policyPercentage)
      : null;
    if (
      !policySource.trim() ||
      !policyNote.trim() ||
      (amountPolicyKinds.has(policyKind) && (!policyAmountValid || policyAmount <= 0)) ||
      (percentagePolicyKinds.has(policyKind) &&
        (!policyPercentageValid || policyPercentage <= 0 || policyPercentage > 100)) ||
      (percentagePolicyKinds.has(policyKind) && policyPercentageBps === null) ||
      fixedPeriodIncomplete
    ) {
      setNotice({
        tone: "error",
        text: fixedPeriodIncomplete
          ? "المبلغ الثابت يحتاج تاريخ نهاية معلنًا."
          : percentagePolicyKinds.has(policyKind) &&
              policyPercentageValid &&
              policyPercentage > 0 &&
              policyPercentage <= 100 &&
              policyPercentageBps === null
            ? "دقة النسبة أدق من المدعوم — أدخل نسبة بمنزلتين عشريتين كحد أقصى (خطوة 0.01%)."
            : "أكمل مصدر السياسة وملاحظتها وأدخل مبلغًا أو نسبة صحيحة.",
      });
      return;
    }
    setSaving(true);
    const result = await ownerEntitlement.createPolicy({
      id: idempotency("policy-id"),
      version: 1,
      family: ownerEntitlementPolicyFamilyForKind(policyKind),
      kind: policyKind,
      amountMinor: amountPolicyKinds.has(policyKind) ? policyAmount : null,
      percentageBps: percentagePolicyKinds.has(policyKind) ? policyPercentageBps : null,
      unitLabel: policyKind === "per_unit" || policyKind === "per_completed_work" ? "وحدة/عمل" : null,
      startsOn: policyStartsOn,
      endsOn: policyEndsOn || null,
      source: policySource,
      note: policyNote,
      status: "active",
      idempotencyKey: policyOperation.current,
    });
    setSaving(false);
    if (!result.ok) {
      setNotice({ tone: "error", text: result.message });
      return;
    }
    setNotice({
      tone: "success",
      text: result.reused
        ? "السياسة محفوظة سابقًا؛ لم تتكرر."
        : "تم حفظ السياسة كإصدار أول. أنشئ نسخة جديدة تبدأ من تاريخ لأي تعديل مؤرخ.",
    });
    policyOperation.current = idempotency("owner-policy");
    setPolicySource("");
    setPolicyNote("");
    notifyDataChanged();
  }

  async function saveSuccessor() {
    /* المجموعة ١١ (11-0 — سياسة القيم الدقيقة): نفس عقد الدقة للنسبة هنا. */
    const successorPercentageBps =
      successorRequirements.valueKind === "percentage" ? percentToBpsExact(successorPercentage) : null;
    const invalidValue =
      successorRequirements.valueKind === "amount"
        ? !successorAmountValid || successorAmount <= 0
        : !successorPercentageValid || successorPercentage <= 0 || successorPercentage > 100;
    const precisionRejected =
      successorRequirements.valueKind === "percentage" &&
      successorPercentageValid &&
      successorPercentage > 0 &&
      successorPercentage <= 100 &&
      successorPercentageBps === null;
    const missingUnit = successorRequirements.requiresUnit && !successorUnitLabel.trim();
    const missingEnd = successorRequirements.requiresEndDate && !successorEndsOn;
    if (!successorPolicy || !successorSource.trim() || !successorNote.trim() || !successorStartsOn) {
      setNotice({
        tone: "error",
        text: "اختر سياسة فعالة وحدد تاريخ بدء النسخة الجديدة واكتب سببًا وملاحظة للتعديل.",
      });
      return;
    }
    if (!successorRequirements.supported || successorKind === "fixed_shift") {
      setNotice({
        tone: "error",
        text: "هذا النوع غير متاح في هذا الإصدار لغياب الدليل التشغيلي؛ اختر نوعًا مدعومًا.",
      });
      return;
    }
    if (invalidValue) {
      setNotice({
        tone: "error",
        text:
          successorRequirements.valueKind === "amount"
            ? "أدخل مبلغ النسخة الجديدة موجبًا بوحدة الدينار الأردني."
            : "أدخل نسبة النسخة الجديدة بين 0.01% و100%.",
      });
      return;
    }
    if (precisionRejected) {
      setNotice({
        tone: "error",
        text: "دقة النسبة أدق من المدعوم — أدخل نسبة بمنزلتين عشريتين كحد أقصى (خطوة 0.01%).",
      });
      return;
    }
    if (missingUnit) {
      setNotice({ tone: "error", text: "أدخل اسم الوحدة أو العمل صراحة؛ لا نخفي معنى الوحدة بقيمة ثابتة." });
      return;
    }
    if (missingEnd) {
      setNotice({ tone: "error", text: "النسخة الجديدة من نوع مبلغ ثابت للفترة تحتاج تاريخ نهاية معلنًا." });
      return;
    }
    setSaving(true);
    const result = await ownerEntitlement.createPolicySuccessor(successorPolicy.id, {
      kind: successorKind,
      amountMinor: successorRequirements.valueKind === "amount" ? successorAmount : null,
      percentageBps: successorRequirements.valueKind === "percentage" ? successorPercentageBps : null,
      unitLabel: successorRequirements.requiresUnit ? successorUnitLabel : null,
      endsOn: successorRequirements.requiresEndDate ? successorEndsOn : null,
      startsOn: successorStartsOn,
      source: successorSource,
      note: successorNote,
      idempotencyKey: successorOperation.current,
    });
    setSaving(false);
    if (!result.ok) {
      setNotice({ tone: "error", text: result.message });
      return;
    }
    setNotice({
      tone: "success",
      text: result.reused
        ? "نسخة السياسة الجديدة محفوظة سابقًا؛ لم يتكرر التعديل."
        : "تم حفظ إعدادات النسخة الجديدة وإنهاء النسخة السابقة؛ لا تتغير الحقوق المسجلة سابقًا.",
    });
    successorOperation.current = idempotency("owner-successor");
    setSuccessorSource("");
    setSuccessorNote("");
    notifyDataChanged();
  }

  async function saveEntitlement() {
    if (!selectedPolicy || !calculation || calculation.amountMinor === null || !entitlementNote.trim()) {
      setNotice({
        tone: "error",
        text: calculation?.nextAction ?? "اختر سياسة مؤهلة واكتب ملاحظة قبل تسجيل الحق.",
      });
      return;
    }
    setSaving(true);
    const result = await ownerEntitlement.recordEntitlement({
      policyId: selectedPolicy.id,
      periodFrom,
      periodTo,
      occurredOn: entitlementDate,
      note: entitlementNote,
      idempotencyKey: entitlementOperation.current,
    });
    setSaving(false);
    if (!result.ok) {
      setNotice({ tone: "error", text: result.message });
      return;
    }
    setNotice({
      tone: "success",
      text: result.reused ? "الحق محفوظ سابقًا؛ لم يتكرر." : "تم تسجيل الحق. لم يتغير كاش المشروع.",
    });
    entitlementOperation.current = idempotency("owner-entitlement");
    setEntitlementNote("");
    notifyDataChanged();
  }

  async function saveOpeningBalance() {
    const amount = openingAmount;
    if (
      !openingAmountValid ||
      !Number.isInteger(amount) ||
      amount === null ||
      amount === 0 ||
      !openingReason.trim() ||
      !openingNote.trim()
    ) {
      setNotice({ tone: "error", text: "أدخل رصيدًا افتتاحيًا غير صفري، وسببًا وملاحظة إلزاميين." });
      return;
    }
    setSaving(true);
    const result = await ownerEntitlement.setOpeningBalance({
      id: idempotency("opening-id"),
      amountMinor: amount,
      occurredOn: openingDate,
      reason: openingReason,
      note: openingNote,
      idempotencyKey: openingOperation.current,
    });
    setSaving(false);
    if (!result.ok) {
      setNotice({ tone: "error", text: result.message });
      return;
    }
    setNotice({
      tone: "success",
      text: result.reused
        ? "الرصيد الافتتاحي محفوظ سابقًا؛ لا أحداث ماضية وهمية."
        : "تم حفظ الرصيد الافتتاحي كمصدر مستقل قابل للتسوية والتراجع.",
    });
    openingOperation.current = idempotency("owner-opening");
    setOpeningAmount(null);
    setOpeningAmountValid(true);
    setOpeningReason("");
    setOpeningNote("");
    notifyDataChanged();
  }

  async function saveMovement() {
    if (!movementAmountValid || movementAmount <= 0 || !movementWalletId || !movementNote.trim()) {
      setNotice({ tone: "error", text: "أدخل مبلغًا ومحفظة وسببًا وملاحظة قبل حفظ الحركة." });
      return;
    }
    if (movementReason === "entitlement_settlement" && !relatedEntitlementId) {
      setNotice({ tone: "error", text: "اختر الحق الذي تسويه؛ لا نخمن سبب السحب." });
      return;
    }
    if (movementReason === "opening_balance_settlement" && !relatedOpeningBalanceId) {
      setNotice({ tone: "error", text: "اختر الرصيد الافتتاحي الذي تسويه؛ لا نخمن مصدر الحركة." });
      return;
    }
    if (movementReason === "settlement_of_prior_draw" && !relatedMovementId) {
      setNotice({ tone: "error", text: "اختر السحب السابق الذي تعيده؛ لا نسجل إرجاعًا بلا أصل." });
      return;
    }
    setSaving(true);
    const result = await ownerEntitlement.recordMovement({
      kind: movementKind,
      amountMinor: movementAmount,
      walletId: movementWalletId,
      occurredOn: movementDate,
      reason: movementReason,
      note: movementNote,
      idempotencyKey: movementOperation.current,
      relatedEntitlementId: movementReason === "entitlement_settlement" ? relatedEntitlementId : null,
      relatedOpeningBalanceId:
        movementReason === "opening_balance_settlement" ? relatedOpeningBalanceId : null,
      relatedMovementId: movementReason === "settlement_of_prior_draw" ? relatedMovementId : null,
    });
    setSaving(false);
    if (!result.ok) {
      setNotice({ tone: "error", text: result.message });
      return;
    }
    setNotice({
      tone: "success",
      text: result.reused
        ? "الحركة محفوظة سابقًا؛ لم يتكرر الكاش."
        : "تم تسجيل الحركة وأثرها على محفظة الكاش.",
    });
    movementOperation.current = idempotency("owner-movement");
    setMovementNote("");
    setRelatedEntitlementId("");
    setRelatedOpeningBalanceId("");
    setRelatedMovementId("");
    notifyDataChanged();
  }

  async function reverseMovement() {
    if (!reversalTarget || reversalTarget.kind !== "movement" || !reversalReason.trim()) {
      setNotice({ tone: "error", text: "اكتب سببًا غير فارغ قبل التراجع عن الحركة." });
      return;
    }
    setSaving(true);
    const result = await ownerEntitlement.reverseMovement({
      movementId: reversalTarget.id,
      occurredOn: localDateInAmman(),
      reason: reversalReason,
      idempotencyKey: idempotency(`owner-reversal:${reversalTarget.id}`),
    });
    setSaving(false);
    if (!result.ok) {
      setNotice({ tone: "error", text: result.message });
      return;
    }
    setNotice({
      tone: "success",
      text: result.reused
        ? "التراجع محفوظ سابقًا؛ لم يتكرر."
        : "تم تسجيل تراجع كامل. الأصل محفوظ ولم يُعدّل.",
    });
    setReversalTarget(null);
    setReversalReason("");
    notifyDataChanged();
  }

  async function reverseEntitlement() {
    if (!reversalTarget || reversalTarget.kind !== "entitlement" || !reversalReason.trim()) {
      setNotice({ tone: "error", text: "اكتب سببًا غير فارغ قبل التراجع عن الحق." });
      return;
    }
    setSaving(true);
    const result = await ownerEntitlement.reverseEntitlement({
      recordId: reversalTarget.id,
      occurredOn: localDateInAmman(),
      reason: reversalReason,
      idempotencyKey: idempotency(`entitlement-reversal:${reversalTarget.id}`),
    });
    setSaving(false);
    if (!result.ok) {
      setNotice({ tone: "error", text: result.message });
      return;
    }
    setNotice({
      tone: "success",
      text: result.reused
        ? "التراجع عن الحق محفوظ سابقًا؛ لم يتكرر."
        : "تم التراجع عن الحق كاملًا. الأصل محفوظ ويمكنك تسجيل حق جديد صحيح بعد التراجع.",
    });
    setReversalTarget(null);
    setReversalReason("");
    notifyDataChanged();
  }

  async function reverseOpening() {
    if (!reversalTarget || reversalTarget.kind !== "opening" || !reversalReason.trim()) {
      setNotice({ tone: "error", text: "اكتب سببًا غير فارغ قبل التراجع عن الرصيد الافتتاحي." });
      return;
    }
    setSaving(true);
    const result = await ownerEntitlement.reverseOpeningBalance({
      balanceId: reversalTarget.id,
      occurredOn: localDateInAmman(),
      reason: reversalReason,
      idempotencyKey: idempotency(`opening-reversal:${reversalTarget.id}`),
    });
    setSaving(false);
    if (!result.ok) {
      setNotice({ tone: "error", text: result.message });
      return;
    }
    setNotice({
      tone: "success",
      text: result.reused
        ? "التراجع عن الرصيد الافتتاحي محفوظ سابقًا؛ لم يتكرر."
        : "تم التراجع عن الرصيد الافتتاحي كاملًا. الأصل محفوظ ويمكن تصحيحه بسجل جديد.",
    });
    setReversalTarget(null);
    setReversalReason("");
    notifyDataChanged();
  }

  return (
    <section className="micro-page micro-finance-page micro-owner-page">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        <ArrowRight aria-hidden="true" /> {returnPath === "/finance" ? "الوضع المالي" : "رجوع"}
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">دفتر واحد · المبالغ (د.أ)</span>
        <h1>مال المالك</h1>
      </div>
      {notice ? (
        <p className={notice.tone === "success" ? "micro-save-note" : "micro-field-error"} role="status">
          {notice.text}
        </p>
      ) : null}
      <section className="micro-owner-balance-card" data-balance={overview.balanceState}>
        <div className="micro-owner-balance-head">
          <CircleDollarSign aria-hidden="true" />
          <div>
            <span className="micro-overline">الدفتر الموحد لمالك واحد</span>
            <h2>
              {overview.balanceState === "positive"
                ? "المشروع ما زال مدينًا لك"
                : overview.balanceState === "negative"
                  ? "سحبت أكثر مما سُجل لك حتى الآن"
                  : "الرصيد مسوّى"}
            </h2>
          </div>
        </div>
        <strong className="micro-owner-balance-value">
          <bdi dir="ltr">{formatMoneyMinor(overview.remainingEntitlementBalanceMinor)}</bdi>{" "}
          <small>د.أ</small>
        </strong>
        <div className="micro-owner-stat-grid">
          <Metric label="رأس مالك في المشروع" value={ownerMoney?.ownerCapitalRecordedMinor ?? 0} />
          <Metric label="حق مسجل متبقٍ" value={overview.remainingEntitlementBalanceMinor} />
          <Metric label="الافتتاح المتبقي" value={overview.openingBalanceRemainingMinor} />
          <Metric label="إرجاع سحب سابق" value={overview.returnedForPriorDrawMinor} />
        </div>
      </section>
      <div className="micro-form-actions micro-contextual-actions">
        <button
          className="micro-button micro-button-primary"
          type="button"
          onClick={() =>
            navigate(withFrom("/finance/new/owner_investment_cash", "/finance/owner-entitlement"))
          }
        >
          <HandCoins aria-hidden="true" /> أدخل مالًا للمشروع
        </button>
        <button
          className="micro-button micro-button-secondary"
          type="button"
          onClick={() => navigate(withFrom("/finance/withdraw", "/finance/owner-entitlement"))}
        >
          <ArrowRight aria-hidden="true" /> اسحب لنفسك
        </button>
      </div>
      <details className="micro-owner-layer">
        <summary className="micro-owner-layer-summary">
          <span>
            <b>حركات مالك</b>
            <small>الأصل والتصحيح معًا — الصافي هو الظاهر</small>
          </span>
          <strong>افتح السجل</strong>
        </summary>
        <section className="micro-owner-ledger">
          {ownerMoney && ownerMoney.rows.length > 0 ? (
            <div className="micro-owner-list">
              {ownerMoney.rows.map(row => (
                <article key={row.id} className="micro-owner-list-row">
                  <div>
                    <strong>{row.source === "event" ? "حدث عام" : "دفتر المالك"}</strong>
                    <small>
                      <bdi dir="ltr">{formatLocalDate(row.occurredOn)}</bdi> · {row.effectLabel}
                      {row.cashPoolLabel ? ` · ${row.cashPoolLabel}` : ""}
                    </small>
                    <small>{row.note}</small>
                    {row.reversalLabel ? <small>{row.reversalLabel}</small> : null}
                  </div>
                  <b>
                    <bdi dir="ltr">{formatMoneyMinor(row.amountMinor)}</bdi> د.أ
                  </b>
                  {row.deepLink ? (
                    <button
                      className="micro-button micro-button-quiet"
                      type="button"
                      onClick={() => navigate(withFrom(row.deepLink!, "/finance/owner-entitlement"))}
                    >
                      افتح الأصل
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="micro-empty-state">لا توجد حركة مالك بعد — أدخل مالًا أو اسحب ليبدأ السجل.</p>
          )}
        </section>
      </details>
      <details className="micro-owner-layer">
        <summary className="micro-owner-layer-summary">
          <span>
            <b>حدود مال المالك</b>
            <small>رأس المال والسحب والحق بمعزل عن الربح</small>
          </span>
          <strong>اقرأ الحد</strong>
        </summary>
        <p className="micro-local-truth">
          رأس المال والسحب والحق ما بدخلوا نتيجة الفترة ولا الربح. الأمانات مال غيرك، والكاش يظهر بمحافظه.
        </p>
      </details>
      <details className="micro-owner-layer">
        <summary className="micro-owner-layer-summary">
          <span>
            <b>حق المالك وسياسته</b>
            <small>طبقة لا تغير الربح أو الكاش</small>
          </span>
          <strong>افتح الدفتر</strong>
        </summary>
        <div className="micro-owner-layer-body">
          <section className="micro-owner-ledger">
            <div className="micro-section-heading">
              <div>
                <span className="micro-overline">طبقة لا تغير الربح أو الكاش</span>
                <h2>سياسات حق المالك</h2>
              </div>
              <span className="micro-g5-count">{overview.policies.length}</span>
            </div>
            {overview.policies.length === 0 ? (
              <p className="micro-empty-state">لا توجد سياسة بعد. أضف أقل سياسة تحتاجها فقط.</p>
            ) : (
              <div className="micro-owner-list">
                {overview.policies.map(policy => (
                  <article key={policy.id} className="micro-owner-list-row">
                    <div>
                      <strong>{policyLabels[policy.kind]}</strong>
                      <small>
                        {policyFamilyLabels[policy.family]} · إصدار <bdi dir="ltr">{policy.version}</bdi> ·
                        تبدأ{" "}
                        <bdi dir="ltr">
                          <bdi dir="ltr">{formatLocalDate(policy.startsOn)}</bdi>
                        </bdi>
                        {policy.endsOn ? ` · تنتهي ${formatLocalDate(policy.endsOn)}` : " · بلا تاريخ إيقاف"}
                      </small>
                      <small>
                        المصدر: {policy.source} · {policy.status === "active" ? "فعالة" : "منتهية"}
                      </small>
                    </div>
                    <b>
                      {policy.amountMinor === null
                        ? `${(policy.percentageBps ?? 0) / 100}%`
                        : `${formatMoneyMinor(policy.amountMinor)} د.أ`}
                    </b>
                  </article>
                ))}
              </div>
            )}
          </section>
          <OwnerPolicyFormsSection
            overview={overview}
            calculation={calculation}
            saving={saving}
            policyKind={policyKind}
            setPolicyKind={setPolicyKind}
            policyAmount={policyAmount}
            setPolicyAmount={setPolicyAmount}
            policyAmountValid={policyAmountValid}
            setPolicyAmountValid={setPolicyAmountValid}
            policyPercentage={policyPercentage}
            setPolicyPercentage={setPolicyPercentage}
            policyPercentageValid={policyPercentageValid}
            setPolicyPercentageValid={setPolicyPercentageValid}
            policyStartsOn={policyStartsOn}
            setPolicyStartsOn={setPolicyStartsOn}
            policyEndsOn={policyEndsOn}
            setPolicyEndsOn={setPolicyEndsOn}
            policySource={policySource}
            setPolicySource={setPolicySource}
            policyNote={policyNote}
            setPolicyNote={setPolicyNote}
            successorPolicyId={successorPolicyId}
            setSuccessorPolicyId={setSuccessorPolicyId}
            successorKind={successorKind}
            setSuccessorKind={setSuccessorKind}
            successorAmount={successorAmount}
            setSuccessorAmount={setSuccessorAmount}
            successorAmountValid={successorAmountValid}
            setSuccessorAmountValid={setSuccessorAmountValid}
            successorPercentage={successorPercentage}
            setSuccessorPercentage={setSuccessorPercentage}
            successorPercentageValid={successorPercentageValid}
            setSuccessorPercentageValid={setSuccessorPercentageValid}
            successorUnitLabel={successorUnitLabel}
            setSuccessorUnitLabel={setSuccessorUnitLabel}
            successorStartsOn={successorStartsOn}
            setSuccessorStartsOn={setSuccessorStartsOn}
            successorEndsOn={successorEndsOn}
            setSuccessorEndsOn={setSuccessorEndsOn}
            successorSource={successorSource}
            setSuccessorSource={setSuccessorSource}
            successorNote={successorNote}
            setSuccessorNote={setSuccessorNote}
            successorRequirements={successorRequirements}
            successorPolicy={successorPolicy}
            savePolicy={savePolicy}
            saveSuccessor={saveSuccessor}
          />

          <OwnerLedgerFormsSection
            overview={overview}
            calculation={calculation}
            saving={saving}
            selectedPolicyId={selectedPolicyId}
            setSelectedPolicyId={setSelectedPolicyId}
            periodFrom={periodFrom}
            setPeriodFrom={setPeriodFrom}
            periodTo={periodTo}
            setPeriodTo={setPeriodTo}
            entitlementDate={entitlementDate}
            setEntitlementDate={setEntitlementDate}
            entitlementNote={entitlementNote}
            setEntitlementNote={setEntitlementNote}
            openingAmount={openingAmount}
            setOpeningAmount={setOpeningAmount}
            openingAmountValid={openingAmountValid}
            setOpeningAmountValid={setOpeningAmountValid}
            openingDate={openingDate}
            setOpeningDate={setOpeningDate}
            openingReason={openingReason}
            setOpeningReason={setOpeningReason}
            openingNote={openingNote}
            setOpeningNote={setOpeningNote}
            movementKind={movementKind}
            setMovementKind={setMovementKind}
            movementReason={movementReason}
            setMovementReason={setMovementReason}
            movementAmount={movementAmount}
            setMovementAmount={setMovementAmount}
            movementAmountValid={movementAmountValid}
            setMovementAmountValid={setMovementAmountValid}
            movementWalletId={movementWalletId}
            setMovementWalletId={setMovementWalletId}
            movementDate={movementDate}
            setMovementDate={setMovementDate}
            movementNote={movementNote}
            setMovementNote={setMovementNote}
            activeEntitlements={activeEntitlements}
            relatedEntitlementId={relatedEntitlementId}
            setRelatedEntitlementId={setRelatedEntitlementId}
            relatedMovementId={relatedMovementId}
            setRelatedMovementId={setRelatedMovementId}
            relatedOpeningBalanceId={relatedOpeningBalanceId}
            setRelatedOpeningBalanceId={setRelatedOpeningBalanceId}
            activeOpeningBalances={activeOpeningBalances}
            priorDraws={priorDraws}
            reasonOptions={reasonOptions}
            saveEntitlement={saveEntitlement}
            saveOpeningBalance={saveOpeningBalance}
            saveMovement={saveMovement}
          />

          <details className="micro-owner-layer">
            <summary className="micro-owner-layer-summary">
              <span>
                <b>السجل والأثر</b>
                <small>الحقوق والأرصدة والحركات مع التراجع الموثق</small>
              </span>
              <strong>افتح السجل</strong>
            </summary>
            <section className="micro-owner-ledger">
              <div className="micro-section-heading">
                <div>
                  <span className="micro-overline">أثر غير قابل للمحو</span>
                  <h2>الحقوق والأرصدة والحركات</h2>
                </div>
              </div>
              {overview.entitlements.length === 0 &&
              overview.openingBalances.length === 0 &&
              overview.movements.length === 0 ? (
                <p className="micro-empty-state">لا توجد حقوق أو أرصدة أو حركات مالك بعد.</p>
              ) : (
                <div className="micro-owner-list">
                  {overview.entitlements.map(record => (
                    <article className="micro-owner-list-row" key={record.id}>
                      <div>
                        <strong>
                          حق · <bdi dir="ltr">{formatLocalDate(record.occurredOn)}</bdi>
                          {record.reversalOfId ? " · تراجع كامل" : ""}
                        </strong>
                        <small>
                          <bdi dir="ltr">
                            {formatLocalDate(record.periodFrom)} → {formatLocalDate(record.periodTo)}
                          </bdi>{" "}
                          · {record.knowledge === "known" ? "معروف" : "جزئي"} · {record.note}
                        </small>
                        <small>
                          المصدر: {record.sourceKeys.join(", ") || "فترة معلنة"}
                          {record.reversalOfId
                            ? ` · الأصل محفوظ كما هو · السبب: ${record.reversalReason}`
                            : ""}
                        </small>
                      </div>
                      <div className="micro-owner-list-actions">
                        <b>
                          <bdi dir="ltr">{formatMoneyMinor(record.amountMinor)}</bdi> د.أ
                        </b>
                        {!record.reversalOfId && !reversedEntitlementIds.has(record.id) ? (
                          <button
                            className="micro-text-action"
                            type="button"
                            onClick={() => {
                              setReversalTarget({ kind: "entitlement", id: record.id });
                              setReversalReason("");
                            }}
                          >
                            <RotateCcw aria-hidden="true" /> تراجع كامل
                          </button>
                        ) : null}
                      </div>
                      {reversalTarget?.kind === "entitlement" && reversalTarget.id === record.id ? (
                        <ReversalBox
                          label="سبب التراجع عن الحق"
                          value={reversalReason}
                          onChange={setReversalReason}
                          onConfirm={() => void reverseEntitlement()}
                          onCancel={() => setReversalTarget(null)}
                          saving={saving}
                        />
                      ) : null}
                    </article>
                  ))}
                  {overview.openingBalances.map(balance => (
                    <article className="micro-owner-list-row" key={balance.id}>
                      <div>
                        <strong>
                          رصيد افتتاحي · <bdi dir="ltr">{formatLocalDate(balance.occurredOn)}</bdi>
                          {balance.reversalOfId ? " · تراجع كامل" : ""}
                        </strong>
                        <small>
                          <bdi dir="ltr">{formatMoneyMinor(balance.amountMinor)}</bdi> د.أ · {balance.reason}{" "}
                          · {balance.note}
                        </small>
                        {balance.reversalOfId ? (
                          <small>الأصل محفوظ كما هو · السبب: {balance.reversalReason}</small>
                        ) : (
                          <small>
                            المتبقي بعد التسويات:{" "}
                            <bdi dir="ltr">
                              {formatMoneyMinor(
                                balance.amountMinor +
                                  overview.movements
                                    .filter(movement => movement.relatedOpeningBalanceId === balance.id)
                                    .reduce((sum, movement) => sum + movement.openingBalanceDeltaMinor, 0),
                              )}
                            </bdi>{" "}
                            د.أ
                          </small>
                        )}
                      </div>
                      <div className="micro-owner-list-actions">
                        <b>
                          <bdi dir="ltr">{formatMoneyMinor(balance.amountMinor)}</bdi> د.أ
                        </b>
                        {!balance.reversalOfId && !reversedOpeningIds.has(balance.id) ? (
                          <button
                            className="micro-text-action"
                            type="button"
                            onClick={() => {
                              setReversalTarget({ kind: "opening", id: balance.id });
                              setReversalReason("");
                            }}
                          >
                            <RotateCcw aria-hidden="true" /> تراجع كامل
                          </button>
                        ) : null}
                      </div>
                      {reversalTarget?.kind === "opening" && reversalTarget.id === balance.id ? (
                        <ReversalBox
                          label="سبب التراجع عن الرصيد الافتتاحي"
                          value={reversalReason}
                          onChange={setReversalReason}
                          onConfirm={() => void reverseOpening()}
                          onCancel={() => setReversalTarget(null)}
                          saving={saving}
                        />
                      ) : null}
                    </article>
                  ))}
                  {overview.movements.map(movement => (
                    <article
                      className="micro-owner-list-row"
                      data-movement={movement.reversalOfId ? "reversal" : movement.kind}
                      key={movement.id}
                    >
                      <div>
                        <strong>
                          {movement.kind === "draw" ? "سحب فعلي" : "إرجاع فعلي"}
                          {movement.reversalOfId ? " · تراجع كامل" : ""}
                        </strong>
                        <small>
                          {formatLocalDate(movement.occurredOn)} · {movementReasonLabels[movement.reason]} ·{" "}
                          {movement.note}
                        </small>
                        <small>
                          المحفظة:{" "}
                          {overview.walletBalances.find(wallet => wallet.id === movement.walletId)?.name ??
                            movement.walletId}{" "}
                          · أثر الكاش: <bdi dir="ltr">{formatMoneyMinor(movement.cashDeltaMinor)}</bdi> د.أ
                        </small>
                        {movement.reversalOfId ? (
                          <small>الأصل محفوظ كما هو · السبب: {movement.reversalReason}</small>
                        ) : null}
                      </div>
                      <div className="micro-owner-list-actions">
                        <b>
                          <bdi dir="ltr">{formatMoneyMinor(movement.amountMinor)}</bdi> د.أ
                        </b>
                        {!movement.reversalOfId && !reversedMovementIds.has(movement.id) ? (
                          <button
                            className="micro-text-action"
                            type="button"
                            onClick={() => {
                              setReversalTarget({ kind: "movement", id: movement.id });
                              setReversalReason("");
                            }}
                          >
                            <RotateCcw aria-hidden="true" /> تراجع كامل
                          </button>
                        ) : null}
                      </div>
                      {reversalTarget?.kind === "movement" && reversalTarget.id === movement.id ? (
                        <ReversalBox
                          label="سبب التراجع"
                          value={reversalReason}
                          onChange={setReversalReason}
                          onConfirm={() => void reverseMovement()}
                          onCancel={() => setReversalTarget(null)}
                          saving={saving}
                        />
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </details>
        </div>
      </details>
    </section>
  );
}

function ReversalBox({
  label,
  value,
  onChange,
  onConfirm,
  onCancel,
  saving,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="micro-owner-reversal">
      <label className="micro-field">
        <span>
          {label} <small>مطلوب</small>
        </span>
        <textarea
          value={value}
          onChange={event => onChange(event.target.value)}
          autoFocus
          placeholder="مثال: سجلت السجل بالخطأ"
        />
      </label>
      <div className="micro-form-actions">
        <button
          className="micro-button micro-button-primary"
          type="button"
          disabled={saving}
          onClick={onConfirm}
        >
          تأكيد التراجع الموثق
        </button>
        <button
          className="micro-button micro-button-secondary"
          type="button"
          disabled={saving}
          onClick={onCancel}
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>
        <bdi dir="ltr">{formatMoneyMinor(value)}</bdi>
      </strong>
    </div>
  );
}
