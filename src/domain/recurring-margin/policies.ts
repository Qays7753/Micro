import {
  allocationPolicyKinds,
  type AllocationEvidence,
  type AllocationKnowledge,
  type AllocationPolicy,
  type AllocationPolicyKind,
  type AllocationCalculation,
  type CreateAllocationPolicyInput,
  type AllocationPolicyTerms,
  type WasteContext,
} from "./types.js";
import { roundHalfUp } from "../shared/index.js";

const required = (value: string, message: string) => {
  if (!value.trim()) throw new Error(message);
  return value.trim();
};
const localDate = (value: string, label: string) => {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(new Date(`${value}T12:00:00.000Z`).getTime()) ||
    new Date(`${value}T12:00:00.000Z`).toISOString().slice(0, 10) !== value
  )
    throw new Error(`${label} غير صالح.`);
  return value;
};
const positiveMinor = (value: number | null, label: string) => {
  if (!Number.isSafeInteger(value) || value === null || value <= 0)
    throw new Error(`${label} يجب أن يكون مبلغًا موجبًا بوحدة JOD minor.`);
  return value;
};
const positiveInteger = (value: number | null, label: string) => {
  if (!Number.isSafeInteger(value) || value === null || value <= 0)
    throw new Error(`${label} يجب أن يكون عددًا صحيحًا موجبًا.`);
  return value;
};
const percentage = (value: number | null) => {
  if (!Number.isSafeInteger(value) || value === null || value < 1 || value > 10_000)
    throw new Error("النسبة يجب أن تكون بين 0.01% و100% بوحدة basis points.");
  return value;
};
const validKind = (value: AllocationPolicyKind) => {
  if (!allocationPolicyKinds.includes(value)) throw new Error("أساس التحميل غير مدعوم.");
  return value;
};
const dateBefore = (left: string, right: string) => left <= right;
const dayAfter = (value: string) => {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

export function createAllocationPolicy(input: CreateAllocationPolicyInput): AllocationPolicy {
  const kind = validKind(input.kind);
  const catalogItemId = required(input.catalogItemId, "مرجع العمل مطلوب لسياسة التحميل.");
  const periodFrom = localDate(input.periodFrom, "بداية نطاق السياسة");
  const periodTo = localDate(input.periodTo, "نهاية نطاق السياسة");
  const startsOn = localDate(input.startsOn, "تاريخ نفاذ السياسة");
  const endsOn = input.endsOn === null ? null : localDate(input.endsOn, "تاريخ نهاية السياسة");
  if (!dateBefore(periodFrom, periodTo) || !dateBefore(startsOn, endsOn ?? "9999-12-31"))
    throw new Error("نطاق السياسة أو تاريخ نفاذها غير مرتب.");
  if (endsOn !== null && endsOn < periodFrom) throw new Error("نهاية السياسة تسبق نطاق العمل المقصود.");
  if (startsOn > periodTo) throw new Error("تاريخ نفاذ السياسة يأتي بعد نطاق العمل المقصود.");
  const amountMinor = kind === "manual_amount" ? positiveMinor(input.amountMinor, "المبلغ اليدوي") : null;
  const rateMinorPerWholeUnit =
    kind === "per_output_unit"
      ? positiveMinor(input.rateMinorPerWholeUnit ?? input.rateMinor, "معدل التحميل لكل 1.000 وحدة كاملة")
      : null;
  const rateMinor =
    kind === "actual_time" ? positiveMinor(input.rateMinor, "معدل التحميل لكل دقيقة فعلية") : null;
  const percentageBps = kind === "completed_revenue_percentage" ? percentage(input.percentageBps) : null;
  const unitId =
    kind === "per_output_unit"
      ? required(input.unitId ?? "", "سياسة التحميل لكل وحدة تحتاج وحدة منظمة.")
      : null;
  if (
    !required(input.source, "مصدر سياسة التحميل مطلوب.") ||
    !required(input.reason, "سبب سياسة التحميل مطلوب.") ||
    !required(input.note, "ملاحظة سياسة التحميل مطلوبة.")
  )
    throw new Error("مصدر وسبب وملاحظة سياسة التحميل مطلوبة.");
  if (
    !required(input.id, "معرف سياسة التحميل مطلوب.") ||
    !required(input.seriesId, "سلسلة سياسة التحميل مطلوبة.") ||
    !required(input.idempotencyKey, "مفتاح سياسة التحميل مطلوب.")
  )
    throw new Error("معرف ومفتاح سياسة التحميل مطلوبان.");
  if (input.version < 1 || !Number.isSafeInteger(input.version))
    throw new Error("إصدار سياسة التحميل غير صالح.");
  return {
    id: input.id.trim(),
    seriesId: input.seriesId.trim(),
    successorOfPolicyId: input.successorOfPolicyId,
    version: input.version,
    catalogItemId,
    kind,
    amountMinor,
    rateMinorPerWholeUnit,
    rateMinor,
    percentageBps,
    unitId,
    periodFrom,
    periodTo,
    startsOn,
    endsOn,
    source: input.source.trim(),
    reason: input.reason.trim(),
    note: input.note.trim(),
    status: input.status,
    idempotencyKey: input.idempotencyKey.trim(),
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

export function createAllocationPolicySuccessor(
  previous: AllocationPolicy,
  terms: AllocationPolicyTerms & {
    id: string;
    seriesId: string;
    successorOfPolicyId: string;
    version: number;
    status: "active";
    idempotencyKey: string;
    createdAt: string;
    updatedAt: string;
  },
): AllocationPolicy {
  if (previous.status !== "active") throw new Error("لا يمكن إنشاء خليفة لسياسة تحميل غير فعالة.");
  if (
    terms.seriesId !== previous.seriesId ||
    terms.successorOfPolicyId !== previous.id ||
    terms.version !== previous.version + 1
  )
    throw new Error("سلسلة مراجعة سياسة التحميل غير متصلة.");
  if (
    terms.startsOn <= previous.startsOn ||
    (previous.endsOn !== null && terms.startsOn !== dayAfter(previous.endsOn))
  )
    throw new Error("تاريخ نفاذ خليفة سياسة التحميل يجب أن يتبع نهاية النسخة السابقة مباشرة.");
  return createAllocationPolicy(terms);
}

export function isAllocationPolicyEffective(
  policy: AllocationPolicy,
  catalogItemId: string,
  from: string,
  to: string,
): boolean {
  return (
    policy.status === "active" &&
    policy.catalogItemId === catalogItemId &&
    policy.startsOn <= to &&
    (policy.endsOn === null || policy.endsOn >= from) &&
    policy.periodFrom <= from &&
    policy.periodTo >= to
  );
}

const incomplete = (
  policy: AllocationPolicy,
  evidence: AllocationEvidence,
  reasons: readonly string[],
  nextAction: string,
): AllocationCalculation => ({
  policyId: policy.id,
  catalogItemId: policy.catalogItemId,
  kind: policy.kind,
  periodFrom: evidence.periodFrom,
  periodTo: evidence.periodTo,
  status: reasons.some(reason => reason.includes("مراجعة")) ? "needs_review" : "incomplete",
  amountMinor: null,
  resultMinor: null,
  directMarginMinor: evidence.directMarginMinor,
  source: policy.source,
  reason: policy.reason,
  note: policy.note,
  evidence,
  excluded: [],
  reasons,
  nextAction,
  truth:
    "لا يمكن عرض الربح بعد التحميل كرقم كامل قبل اكتمال أساس السياسة والأدلة الداخلة؛ لم يتحول النقص إلى صفر.",
  calculationNote: "التحميل غير محسوب لأن دليل السياسة غير مكتمل.",
});

/** One implementation of the per-output-unit allocation arithmetic, shared by the catalog preview and the period reader. */
export type PerOutputUnitAmount = { amountMinor: number } | { problem: "missing_input" | "unsafe_range" | "overflow" };

export function perOutputUnitAmountMinor(
  quantityMilli: number | null,
  rateMinorPerWholeUnit: number | null,
): PerOutputUnitAmount {
  if (quantityMilli === null || rateMinorPerWholeUnit === null) return { problem: "missing_input" };
  if (
    !Number.isSafeInteger(quantityMilli) ||
    quantityMilli <= 0 ||
    !Number.isSafeInteger(rateMinorPerWholeUnit) ||
    rateMinorPerWholeUnit <= 0 ||
    rateMinorPerWholeUnit > Number.MAX_SAFE_INTEGER / quantityMilli
  )
    return { problem: "unsafe_range" };
  const rawMinor = rateMinorPerWholeUnit * quantityMilli;
  if (!Number.isSafeInteger(rawMinor) || rawMinor > Number.MAX_SAFE_INTEGER - 500) return { problem: "overflow" };
  const amountMinor = roundHalfUp(rawMinor, 1_000);
  if (amountMinor === null) return { problem: "overflow" };
  return { amountMinor };
}

export function calculateAllocationPolicy(
  policy: AllocationPolicy,
  evidence: AllocationEvidence,
): AllocationCalculation {
  if (
    policy.catalogItemId !== evidence.catalogItemId ||
    policy.periodFrom > evidence.periodFrom ||
    policy.periodTo < evidence.periodTo
  )
    return incomplete(
      policy,
      evidence,
      ["نطاق السياسة لا يغطي الفترة أو مرجع العمل المطلوب."],
      "أنشئ أو راجع سياسة مؤرخة تغطي مرجع العمل والفترة كاملة.",
    );
  if (evidence.finalOrderIds.length === 0)
    return incomplete(
      policy,
      evidence,
      ["لا توجد طلبات final مرتبطة صراحة بهذا المرجع في الفترة."],
      "سجل الطلبات النهائية المرتبطة أو راجع نطاق الفترة قبل قراءة التحميل.",
    );
  let amountMinor: number | null = null;
  const reasons: string[] = [];
  const excluded: string[] = [...evidence.excludedOrderIds];
  if (policy.kind === "manual_amount") amountMinor = policy.amountMinor;
  if (policy.kind === "per_output_unit") {
    if (
      policy.unitId === null ||
      evidence.outputQuantityMilli === null ||
      evidence.outputQuantityMilli <= 0 ||
      evidence.outputUnitId === null ||
      policy.unitId !== evidence.outputUnitId
    ) {
      reasons.push("أكمل كمية الناتج بوحدة منظمة متوافقة مع سياسة التحميل لكل وحدة؛ لا نحول أو نخمن yield.");
    } else {
      const allocation = perOutputUnitAmountMinor(evidence.outputQuantityMilli, policy.rateMinorPerWholeUnit);
      if ("problem" in allocation)
        reasons.push(
          allocation.problem === "overflow"
            ? "مجموع معدل الوحدة والكمية يتجاوز الدقة الآمنة قبل التقريب."
            : "معدل الوحدة أو كمية الناتج يتجاوزان الدقة الآمنة؛ راجع النطاق قبل الحساب.",
        );
      else amountMinor = allocation.amountMinor;
    }
  }
  if (policy.kind === "actual_time") {
    if (
      policy.rateMinor === null ||
      evidence.actualTimeMinutes === null ||
      evidence.missingTimeOrderIds.length > 0
    )
      reasons.push("أكمل تسجيل وقت فعلي صالح لكل الطلبات الداخلة قبل الاعتماد على التحميل.");
    else {
      const calculated = policy.rateMinor * evidence.actualTimeMinutes;
      if (!Number.isSafeInteger(calculated) || calculated <= 0)
        reasons.push("معدل أو دقائق الوقت تتجاوز الدقة الآمنة.");
      else amountMinor = calculated;
    }
  }
  if (policy.kind === "completed_revenue_percentage") {
    if (
      policy.percentageBps === null ||
      evidence.recognizedRevenueMinor === null ||
      evidence.missingRevenueOrderIds.length > 0
    )
      reasons.push(
        "أكمل الإيراد final/المعترف به للطلبات الداخلة قبل تطبيق نسبة التحميل؛ توجد مبيعات ناقصة أو غير مكتملة.",
      );
    else {
      const calculated = roundHalfUp(evidence.recognizedRevenueMinor * policy.percentageBps, 10_000);
      if (calculated === null || calculated <= 0)
        reasons.push("النسبة المعلنة لم تنتج مبلغ تحميل موجبًا من الإيراد المكتمل.");
      else amountMinor = calculated;
    }
  }
  if (amountMinor === null || reasons.length > 0)
    return incomplete(
      policy,
      evidence,
      reasons,
      reasons[0] ?? "أكمل دليل أساس سياسة التحميل قبل الاعتماد على القراءة.",
    );
  const calculationNote =
    policy.kind === "per_output_unit"
      ? `إجمالي الناتج ${((evidence.outputQuantityMilli ?? 0) / 1000).toFixed(3)} وحدة كاملة؛ ` +
        `المعدل ${((policy.rateMinorPerWholeUnit ?? 0) / 100).toFixed(2)} د.أ لكل 1.000 وحدة؛ ` +
        `قُرّب مجموع الفترة مرة واحدة إلى أقرب قرش${amountMinor === 0 ? "؛ الصفر نتيجة حسابية معلنة وليس غياب بيانات." : "."}`
      : policy.kind === "actual_time"
        ? `المعدل ${((policy.rateMinor ?? 0) / 100).toFixed(2)} د.أ لكل دقيقة فعلية.`
        : policy.kind === "completed_revenue_percentage"
          ? `النسبة ${((policy.percentageBps ?? 0) / 100).toFixed(2)}% من الإيراد المكتمل/المعترف به.`
          : "مبلغ يدوي معلن للفترة.";
  return {
    policyId: policy.id,
    catalogItemId: policy.catalogItemId,
    kind: policy.kind,
    periodFrom: evidence.periodFrom,
    periodTo: evidence.periodTo,
    status: "known",
    amountMinor,
    resultMinor: evidence.directMarginMinor - amountMinor,
    directMarginMinor: evidence.directMarginMinor,
    source: policy.source,
    reason: policy.reason,
    note: policy.note,
    evidence,
    excluded,
    reasons:
      amountMinor === 0
        ? ["الناتج صفر minor بعد تقريب مجموع الفترة؛ هذه نتيجة حسابية معلنة وليست نقص معرفة."]
        : [],
    nextAction:
      "راجع السياسة والمصادر الداخلة قبل اتخاذ قرار جديد؛ هذا الرقم ليس صافي ربح نهائيًا أو توصية سعر.",
    truth: "هذا الربح بعد التحميل حسب سياستك، وليس صافي ربح نهائيًا أو توصية سعر.",
    calculationNote,
  };
}

export function isValidAllocationPolicy(value: unknown): value is AllocationPolicy {
  if (!value || typeof value !== "object") return false;
  const policy = value as Partial<AllocationPolicy>;
  try {
    createAllocationPolicy({
      ...policy,
      id: policy.id ?? "",
      seriesId: policy.seriesId ?? "",
      successorOfPolicyId: policy.successorOfPolicyId ?? null,
      version: policy.version ?? 0,
      catalogItemId: policy.catalogItemId ?? "",
      kind: policy.kind ?? "manual_amount",
      amountMinor: policy.amountMinor ?? null,
      rateMinorPerWholeUnit: policy.rateMinorPerWholeUnit ?? policy.rateMinor ?? null,
      rateMinor: policy.rateMinor ?? null,
      percentageBps: policy.percentageBps ?? null,
      unitId: policy.unitId ?? null,
      periodFrom: policy.periodFrom ?? "",
      periodTo: policy.periodTo ?? "",
      startsOn: policy.startsOn ?? "",
      endsOn: policy.endsOn ?? null,
      source: policy.source ?? "",
      reason: policy.reason ?? "",
      note: policy.note ?? "",
      status: policy.status ?? "inactive",
      idempotencyKey: policy.idempotencyKey ?? "",
      createdAt: policy.createdAt ?? "",
      updatedAt: policy.updatedAt ?? "",
    });
    return policy.status === "active" || policy.status === "inactive";
  } catch {
    return false;
  }
}

export function isValidWasteContext(value: unknown): value is WasteContext {
  if (!value || typeof value !== "object") return false;
  const context = value as Record<string, unknown>;
  if (context.kind === "order" || context.kind === "catalog_item")
    return (
      typeof context[context.kind === "order" ? "orderId" : "catalogItemId"] === "string" &&
      String(context[context.kind === "order" ? "orderId" : "catalogItemId"]).trim().length > 0
    );
  if (context.kind === "catalog_template")
    return (
      typeof context.catalogItemId === "string" &&
      context.catalogItemId.trim().length > 0 &&
      typeof context.templateId === "string" &&
      context.templateId.trim().length > 0
    );
  if (context.kind === "general_project") return true;
  return (
    context.kind === "unallocated" &&
    (context.allocationNote === null || typeof context.allocationNote === "string") &&
    (context.allocationNote === null || context.allocationNote.trim().length > 0)
  );
}
