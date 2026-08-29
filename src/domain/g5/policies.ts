import type {
  BreakEvenResult,
  ContributionMarginResult,
  CreateShortCashDeclarationInput,
  CreateShortCashReversalInput,
  G5ExpenseInput,
  G5Knowledge,
  G5MixItem,
  G5OrderInput,
  ShortCashDeclaration,
  ShortCashInput,
  ShortCashResult,
} from "./types.js";
import {
  addSafe,
  assertId,
  assertPositiveMinor,
  ceilRatio,
  fieldLabelAr,
  isValidLocalDate,
  isValidTimestamp,
  quantityMilliExact,
  roundHalfUp,
} from "../shared/index.js";

const KNOWLEDGE: readonly G5Knowledge[] = ["known", "estimated", "needs_review"];
const DIRECTIONS = ["collection", "commitment"] as const;
const ORDER_RESULTS = ["final", "estimated", "incomplete", "review_required"] as const;
const EXPENSE_BEHAVIORS = ["fixed", "variable", "mixed", "unknown"] as const;
const EXPENSE_RELATIONSHIPS = ["project", "shared"] as const;
const SHARE_BASES = ["agreed_fixed_share", "agreed_percentage", "owner_estimate", "needs_review"] as const;

function assertDate(value: string, field: string): void {
  if (!isValidLocalDate(value)) throw new Error(`أدخل ${fieldLabelAr(field)} تاريخًا محليًا صحيحًا.`);
}

function assertKnowledge(value: G5Knowledge): void {
  if (!KNOWLEDGE.includes(value)) throw new Error("درجة المعرفة غير صالحة.");
}

export function createShortCashDeclaration(input: CreateShortCashDeclarationInput): ShortCashDeclaration {
  assertId(input.id, "id");
  if (!DIRECTIONS.includes(input.direction)) throw new Error("اتجاه السجل المتوقع غير صالح.");
  assertPositiveMinor(input.amountMinor, "amountMinor");
  assertDate(input.dueOn, "dueOn");
  assertId(input.source, "source");
  assertId(input.note, "note");
  assertId(input.idempotencyKey, "idempotencyKey");
  assertKnowledge(input.knowledge);
  if (input.relatedOrderId && input.relatedEventId)
    throw new Error("لا يمكن ربط السجل المتوقع بطلب والتزام مالي معًا.");
  if (input.relatedOrderId && input.direction !== "collection")
    throw new Error("ربط الطلب يخص القبض المتوقع فقط.");
  if (input.relatedEventId && input.direction !== "commitment")
    throw new Error("ربط الالتزام يخص الدفع المتوقع فقط.");
  if (input.relatedOrderId !== null && input.relatedOrderId !== undefined)
    assertId(input.relatedOrderId, "relatedOrderId");
  if (input.relatedEventId !== null && input.relatedEventId !== undefined)
    assertId(input.relatedEventId, "relatedEventId");
  if (!isValidTimestamp(input.createdAt)) throw new Error("أدخل وقت الإنشاء وقتًا صحيحًا.");
  return Object.freeze({
    id: input.id.trim(),
    kind: "declaration",
    direction: input.direction,
    amountMinor: input.amountMinor,
    dueOn: input.dueOn,
    source: input.source.trim(),
    knowledge: input.knowledge,
    note: input.note.trim(),
    relatedOrderId: input.relatedOrderId?.trim() || null,
    relatedEventId: input.relatedEventId?.trim() || null,
    idempotencyKey: input.idempotencyKey.trim(),
    reversalOfId: null,
    createdAt: input.createdAt,
  });
}

export function createShortCashReversal(input: CreateShortCashReversalInput): ShortCashDeclaration {
  assertId(input.id, "id");
  assertId(input.idempotencyKey, "idempotencyKey");
  assertId(input.note, "note");
  if (input.original.kind !== "declaration") throw new Error("التراجع يخص سجلًا متوقعًا فعالًا فقط.");
  if (!isValidTimestamp(input.createdAt)) throw new Error("أدخل وقت الإنشاء وقتًا صحيحًا.");
  return Object.freeze({
    ...input.original,
    id: input.id.trim(),
    kind: "reversal",
    idempotencyKey: input.idempotencyKey.trim(),
    reversalOfId: input.original.id,
    note: input.note.trim(),
    createdAt: input.createdAt,
  });
}

function invalidContribution(from: string, to: string, reason: string): ContributionMarginResult {
  return {
    status: "invalid",
    from,
    to,
    totalRevenueMinor: 0,
    totalVariableCostMinor: 0,
    contributionMarginMinor: 0,
    contributionMarginPerUnitMinor: null,
    totalQuantityMilli: null,
    quantityUnitKey: null,
    quantityUnitLabel: null,
    fixedExpenseMinor: 0,
    finalOrderCount: 0,
    excludedOrderCount: 0,
    mix: [],
    sources: [],
    excluded: [],
    assumptions: [],
    reasons: [reason],
    nextAction: "راجع الفترة أو البيانات المؤثرة قبل الاعتماد على الحساب.",
  };
}

/* مبدأ Micro: الجمل التي تصل للمستخدم تذكر الطلب باسمه وحالته بالعربية، لا بمعرّف داخلي. */
function orderDisplayName(order: G5OrderInput): string {
  return order.itemName.trim() || "طلب بلا وصف";
}

function orderResultStatusAr(status: G5OrderInput["resultStatus"]): string {
  switch (status) {
    case "final":
      return "نهائية";
    case "estimated":
      return "تقديرية";
    case "incomplete":
      return "غير مكتملة";
    default:
      return "تحتاج مراجعة";
  }
}

function validateOrder(order: G5OrderInput): string | null {
  if (!order.id.trim() || !order.itemName.trim()) return "يوجد طلب بلا معرف أو اسم عمل.";
  if (!isValidLocalDate(order.deliveredOn)) return `تاريخ تسليم الطلب ${order.id} غير صالح.`;
  if (!ORDER_RESULTS.includes(order.resultStatus)) return `حالة نتيجة الطلب ${order.id} غير صالحة.`;
  if (
    !Number.isSafeInteger(order.recognizedRevenueMinor) ||
    order.recognizedRevenueMinor < 0 ||
    !Number.isSafeInteger(order.recognizedCostMinor) ||
    order.recognizedCostMinor < 0
  )
    return `مقادير الطلب ${order.id} غير صالحة.`;
  if (
    order.quantityMilli !== null &&
    (!Number.isSafeInteger(order.quantityMilli) || order.quantityMilli <= 0)
  )
    return `كمية الطلب ${order.id} غير صالحة.`;
  if (
    order.quantityIssue !== null &&
    order.quantityIssue !== undefined &&
    order.quantityIssue !== "needs_conversion" &&
    order.quantityIssue !== "invalid"
  )
    return `سبب كمية الطلب ${order.id} غير صالح.`;
  if (order.quantityMilli !== null && order.unitKey !== null && !order.unitKey.trim())
    return `وحدة الطلب ${order.id} غير صالحة.`;
  return null;
}

function validateExpense(expense: G5ExpenseInput): string | null {
  if (!expense.id.trim() || !expense.source.trim()) return "يوجد مصروف بلا مصدر قراءة.";
  if (!Number.isSafeInteger(expense.amountMinor) || expense.amountMinor < 0)
    return `مبلغ المصروف ${expense.id} غير صالح.`;
  if (!EXPENSE_BEHAVIORS.includes(expense.behavior)) return `سلوك المصروف ${expense.id} غير صالح.`;
  if (!EXPENSE_RELATIONSHIPS.includes(expense.relationship)) return `علاقة المصروف ${expense.id} غير صالحة.`;
  if (expense.sharedProjectShareBasis !== null && !SHARE_BASES.includes(expense.sharedProjectShareBasis))
    return `أساس حصة المصروف ${expense.id} غير صالح.`;
  if (expense.relationship !== "shared" && expense.sharedProjectShareBasis !== null)
    return `مصروف المشروع ${expense.id} يحمل أساس حصة غير مسموح.`;
  return null;
}

export function calculateContributionMargin(
  from: string,
  to: string,
  orders: readonly G5OrderInput[],
  expenses: readonly G5ExpenseInput[],
): ContributionMarginResult {
  if (!isValidLocalDate(from) || !isValidLocalDate(to) || from > to)
    return invalidContribution(from, to, "الفترة المحلية غير صالحة.");
  const reasons: string[] = [];
  const excluded: string[] = [];
  const assumptions: string[] = [];
  const sources: string[] = [];
  const mix = new Map<string, G5MixItem>();
  let totalRevenueMinor = 0;
  let totalVariableCostMinor = 0;
  let finalOrderCount = 0;
  let excludedOrderCount = 0;
  let fixedExpenseMinor = 0;
  let invalid = false;
  let incomplete = false;
  let needsReview = false;
  let classificationGap = false;
  let totalQuantityMilli: number | null = 0;
  let quantityUnitKey: string | null = null;
  let quantityUnitLabel: string | null = null;
  let quantityUnitEstablished = false;

  for (const order of orders) {
    const validation = validateOrder(order);
    if (validation) {
      invalid = true;
      reasons.push(validation);
      continue;
    }
    if (order.deliveredOn < from || order.deliveredOn > to) continue;
    sources.push(`طلب مسلّم مسجل: ${orderDisplayName(order)}`);
    if (order.resultStatus !== "final") {
      excludedOrderCount += 1;
      excluded.push(
        `الطلب «${orderDisplayName(order)}» مستبعد لأن نتيجته ${orderResultStatusAr(order.resultStatus)}.`,
      );
      continue;
    }
    finalOrderCount += 1;
    const nextRevenue = addSafe(totalRevenueMinor, order.recognizedRevenueMinor);
    const nextCost = addSafe(totalVariableCostMinor, order.recognizedCostMinor);
    if (nextRevenue === null || nextCost === null) {
      invalid = true;
      reasons.push(`مجموع إيراد أو تكلفة الطلبات يتجاوز الدقة الآمنة.`);
    } else {
      totalRevenueMinor = nextRevenue;
      totalVariableCostMinor = nextCost;
    }

    const hasQuantity = order.quantityMilli !== null && order.quantityMilli > 0;
    if (!hasQuantity) {
      totalQuantityMilli = null;
      if (order.quantityIssue === "invalid") {
        invalid = true;
        reasons.push(`كمية الطلب «${orderDisplayName(order)}» غير صالحة؛ لا تحوّل إلى صفر.`);
      } else {
        incomplete = true;
        reasons.push(
          `كمية الطلب «${orderDisplayName(order)}» غير قابلة للتوحيد؛ أكمل وحدة أو تحويلًا صريحًا.`,
        );
      }
    } else {
      const unitKey = order.unitKey?.trim() || "legacy:recorded-mix";
      const unitLabel =
        order.unitLabel?.trim() || (unitKey === "legacy:recorded-mix" ? "المزيج المسجل" : null);
      if (!quantityUnitEstablished) {
        quantityUnitKey = unitKey;
        quantityUnitLabel = unitLabel;
        quantityUnitEstablished = true;
      } else if (quantityUnitKey !== unitKey) {
        totalQuantityMilli = null;
        incomplete = true;
        reasons.push(
          "توجد وحدات أو مراجع كمية غير متوافقة؛ لا تجمعها كناتج واحد دون تحويل G4-A صريح داخل البعد نفسه.",
        );
      }
      if (totalQuantityMilli !== null) {
        const nextQuantity = addSafe(totalQuantityMilli, order.quantityMilli!);
        if (nextQuantity === null) {
          totalQuantityMilli = null;
          invalid = true;
          reasons.push("مجموع الكمية يتجاوز الدقة الآمنة.");
        } else totalQuantityMilli = nextQuantity;
      }
    }

    const mixKey = `${order.itemName.trim()}::${order.unitKey?.trim() || "legacy:recorded-mix"}`;
    const existing = mix.get(mixKey);
    const current = existing ?? {
      itemName: order.itemName.trim(),
      orderCount: 0,
      quantityMilli: null,
      unitKey: order.unitKey?.trim() || "legacy:recorded-mix",
      unitLabel: order.unitLabel?.trim() || (order.unitKey ? null : "المزيج المسجل"),
      revenueMinor: 0,
      variableCostMinor: 0,
      contributionMarginMinor: 0,
    };
    const nextMixRevenue = addSafe(current.revenueMinor, order.recognizedRevenueMinor);
    const nextMixCost = addSafe(current.variableCostMinor, order.recognizedCostMinor);
    const nextMixMargin =
      nextMixRevenue === null || nextMixCost === null ? null : addSafe(nextMixRevenue, -nextMixCost);
    const nextMixQuantity =
      existing === undefined
        ? order.quantityMilli
        : current.quantityMilli === null || order.quantityMilli === null
          ? null
          : addSafe(current.quantityMilli, order.quantityMilli);
    if (
      nextMixRevenue === null ||
      nextMixCost === null ||
      nextMixMargin === null ||
      (existing !== undefined &&
        current.quantityMilli !== null &&
        order.quantityMilli !== null &&
        nextMixQuantity === null)
    ) {
      invalid = true;
      reasons.push(`تعذر تجميع قراءة المزيج للعمل ${order.itemName}.`);
    } else {
      mix.set(mixKey, {
        ...current,
        orderCount: current.orderCount + 1,
        quantityMilli: nextMixQuantity,
        revenueMinor: nextMixRevenue,
        variableCostMinor: nextMixCost,
        contributionMarginMinor: nextMixMargin,
      });
    }
  }

  for (const expense of expenses) {
    const validation = validateExpense(expense);
    if (validation) {
      invalid = true;
      reasons.push(validation);
      continue;
    }
    if (expense.amountMinor === 0) continue;
    sources.push(`مصروف الفترة: ${expense.source}`);
    if (expense.relationship === "shared" && expense.sharedProjectShareBasis === null) {
      classificationGap = true;
      incomplete = true;
      reasons.push(`الحصة المشتركة ${expense.source} بلا أساس معلن؛ لم تدخل كمصروف ثابت معروف.`);
      excluded.push(`المصروف ${expense.source} غير موزّع لغياب مصدر الحصة.`);
      continue;
    }
    if (expense.relationship === "shared" && expense.sharedProjectShareBasis === "needs_review") {
      classificationGap = true;
      incomplete = true;
      reasons.push(`مصدر حصة المصروف المشترك ${expense.source} يحتاج مراجعة.`);
      continue;
    }
    if (expense.behavior === "fixed") {
      const nextFixed = addSafe(fixedExpenseMinor, expense.amountMinor);
      if (nextFixed === null) {
        invalid = true;
        reasons.push("مجموع التكاليف الثابتة يتجاوز الدقة الآمنة.");
      } else fixedExpenseMinor = nextFixed;
      if (expense.knowledge === "estimated") {
        needsReview = true;
        assumptions.push(`مبلغ ثابت ${expense.source} تقديري معلن.`);
      } else if (expense.knowledge === "needs_review") {
        needsReview = true;
        assumptions.push(`مبلغ ثابت ${expense.source} يحتاج مراجعة.`);
      }
      continue;
    }
    if (expense.behavior === "variable" && expense.directlyLinked) {
      const nextVariable = addSafe(totalVariableCostMinor, expense.amountMinor);
      if (nextVariable === null) {
        invalid = true;
        reasons.push("مجموع التكلفة المتغيرة يتجاوز الدقة الآمنة.");
      } else totalVariableCostMinor = nextVariable;
      if (expense.knowledge !== "known") {
        needsReview = true;
        assumptions.push(
          `تكلفة متغيرة مرتبطة ${expense.source} ${expense.knowledge === "estimated" ? "تقديرية" : "تحتاج مراجعة"}.`,
        );
      }
      continue;
    } else if (expense.behavior === "variable") {
      classificationGap = true;
      incomplete = true;
      reasons.push(`المصروف المتغير ${expense.source} غير مرتبط مباشرة بهامش الوحدات؛ لم يوزع تلقائيًا.`);
    } else if (expense.behavior === "mixed") {
      classificationGap = true;
      incomplete = true;
      reasons.push(`المصروف المختلط ${expense.source} لم يُفصل بين ثابت ومتغير.`);
    } else if (expense.behavior === "unknown") {
      classificationGap = true;
      incomplete = true;
      reasons.push(`سلوك المصروف ${expense.source} غير معروف؛ لم يحول إلى صفر.`);
    }
  }

  const contributionMarginMinor = addSafe(totalRevenueMinor, -totalVariableCostMinor);
  if (contributionMarginMinor === null) {
    invalid = true;
    reasons.push("هامش المساهمة يتجاوز الدقة الآمنة.");
  }
  if (excludedOrderCount > 0) {
    incomplete = true;
    reasons.push("توجد طلبات مسلّمة مستبعدة من الهامش بسبب النتيجة غير النهائية.");
  }
  if (finalOrderCount === 0) {
    if (excludedOrderCount > 0 || classificationGap) incomplete = true;
    else invalid = true;
    reasons.push("لا توجد طلبات نهائية موجبة تكفي لحساب هامش المساهمة.");
  }
  if (totalQuantityMilli === null || totalQuantityMilli <= 0) {
    if (finalOrderCount > 0 && !reasons.some(reason => reason.includes("كمية")))
      reasons.push("لا توجد كمية نهائية موحدة موجبة تكفي لحساب هامش الوحدة.");
    incomplete = true;
  }
  if (fixedExpenseMinor <= 0) {
    if (classificationGap) incomplete = true;
    else invalid = true;
    reasons.push("لا توجد تكاليف ثابتة موجبة قابلة للتطبيق في الفترة.");
  }
  if ((contributionMarginMinor ?? 0) <= 0 && finalOrderCount > 0) {
    invalid = true;
    reasons.push("هامش المساهمة المسجل غير موجب.");
  }
  const contributionMarginPerUnitMinor =
    contributionMarginMinor !== null &&
    totalQuantityMilli !== null &&
    totalQuantityMilli > 0 &&
    contributionMarginMinor >= 0 &&
    contributionMarginMinor <= Number.MAX_SAFE_INTEGER / 1000
      ? roundHalfUp(contributionMarginMinor * 1000, totalQuantityMilli)
      : null;
  if (invalid)
    return {
      ...invalidContribution(from, to, reasons.join(" ") || "بيانات G5 غير صالحة."),
      totalRevenueMinor,
      totalVariableCostMinor,
      contributionMarginMinor: contributionMarginMinor ?? 0,
      totalQuantityMilli,
      quantityUnitKey,
      quantityUnitLabel,
      fixedExpenseMinor,
      finalOrderCount,
      excludedOrderCount,
      mix: [...mix.values()],
      sources,
      excluded,
      assumptions,
      reasons,
    };
  const status = incomplete ? "incomplete" : needsReview ? "needs_review" : "available";
  return {
    status,
    from,
    to,
    totalRevenueMinor,
    totalVariableCostMinor,
    contributionMarginMinor: contributionMarginMinor!,
    contributionMarginPerUnitMinor,
    totalQuantityMilli,
    quantityUnitKey,
    quantityUnitLabel,
    fixedExpenseMinor,
    finalOrderCount,
    excludedOrderCount,
    mix: [...mix.values()].sort(
      (left, right) =>
        right.contributionMarginMinor - left.contributionMarginMinor ||
        left.itemName.localeCompare(right.itemName, "ar"),
    ),
    sources,
    excluded,
    assumptions,
    reasons,
    nextAction:
      status === "available" || status === "needs_review"
        ? "راجع السعر والتكلفة إذا تغير المزيج أو الافتراض المعلن."
        : "سجّل الكمية أو الوحدة أو التصنيف أو التاريخ الناقص قبل الاعتماد على رقم التعادل.",
  };
}

export function calculateBreakEven(
  from: string,
  to: string,
  orders: readonly G5OrderInput[],
  expenses: readonly G5ExpenseInput[],
): BreakEvenResult {
  const contribution = calculateContributionMargin(from, to, orders, expenses);
  const denominator =
    contribution.contributionMarginMinor > 0 &&
    contribution.contributionMarginMinor <= Number.MAX_SAFE_INTEGER / 1000
      ? contribution.contributionMarginMinor * 1000
      : null;
  const numerator =
    denominator !== null &&
    contribution.totalQuantityMilli !== null &&
    contribution.fixedExpenseMinor <= Number.MAX_SAFE_INTEGER / Math.max(contribution.totalQuantityMilli, 1)
      ? contribution.fixedExpenseMinor * contribution.totalQuantityMilli
      : null;
  const breakEvenUnits =
    (contribution.status === "available" || contribution.status === "needs_review") &&
    numerator !== null &&
    denominator !== null
      ? ceilRatio(numerator, denominator)
      : null;
  if (
    (contribution.status === "available" || contribution.status === "needs_review") &&
    breakEvenUnits === null
  ) {
    return {
      ...contribution,
      status: "invalid",
      breakEvenUnits: null,
      reasons: [...contribution.reasons, "تعذر حساب وحدات التعادل ضمن الدقة الآمنة."],
      nextAction: "راجع حجم الفترة والكمية والهامش قبل الاعتماد على رقم التعادل.",
    };
  }
  return { ...contribution, breakEvenUnits };
}

/** Break-even units from period aggregates, carrying the same safe-integer honesty as the full reader; null refuses. */
export function calculateBreakEvenUnits(
  fixedExpenseMinor: number,
  deliveredQuantityUnits: number,
  directMarginMinor: number,
): number | null {
  if (
    !Number.isSafeInteger(fixedExpenseMinor) ||
    fixedExpenseMinor < 0 ||
    !Number.isSafeInteger(directMarginMinor) ||
    directMarginMinor <= 0
  )
    return null;
  const quantityMilli = quantityMilliExact(deliveredQuantityUnits);
  if (quantityMilli === null) return null;
  const denominator =
    directMarginMinor > 0 && directMarginMinor <= Number.MAX_SAFE_INTEGER / 1000
      ? directMarginMinor * 1000
      : null;
  const numerator =
    denominator !== null &&
    fixedExpenseMinor <= Number.MAX_SAFE_INTEGER / Math.max(quantityMilli, 1)
      ? fixedExpenseMinor * quantityMilli
      : null;
  if (numerator === null || denominator === null) return null;
  return ceilRatio(numerator, denominator);
}

function validateBalanceItem(item: ShortCashInput["receivables"][number]): string | null {
  if (!item.id.trim() || !item.source.trim()) return "يوجد رصيد قصير بلا مصدر.";
  if (!Number.isSafeInteger(item.amountMinor) || item.amountMinor < 0)
    return `الرصيد ${item.source} غير صالح.`;
  if (item.dueOn !== null && !isValidLocalDate(item.dueOn)) return `تاريخ الرصيد ${item.source} غير صالح.`;
  if (item.direction !== "collection" && item.direction !== "commitment")
    return `اتجاه الرصيد ${item.source} غير صالح.`;
  return null;
}

function validateDeclaration(declaration: ShortCashDeclaration): string | null {
  if (!declaration.id.trim() || !["declaration", "reversal"].includes(declaration.kind))
    return "يوجد سجل متوقع بلا معرف أو نوع صالح.";
  if (!DIRECTIONS.includes(declaration.direction)) return "اتجاه السجل المتوقع غير صالح.";
  if (!Number.isSafeInteger(declaration.amountMinor) || declaration.amountMinor <= 0)
    return "مبلغ السجل المتوقع غير صالح.";
  if (!isValidLocalDate(declaration.dueOn)) return "تاريخ السجل المتوقع غير صالح.";
  if (
    !declaration.source.trim() ||
    !declaration.note.trim() ||
    !declaration.idempotencyKey.trim() ||
    !isValidTimestamp(declaration.createdAt)
  )
    return "السجل المتوقع ناقص المصدر أو الملاحظة أو المفتاح أو وقت الإنشاء.";
  if (!KNOWLEDGE.includes(declaration.knowledge)) return "درجة معرفة السجل المتوقع غير صالحة.";
  if (declaration.relatedOrderId && declaration.relatedEventId)
    return "لا يجوز ربط السجل المتوقع بطلب وحدث معًا.";
  if (declaration.relatedOrderId && declaration.direction !== "collection")
    return "ربط الطلب مخصص لتحصيلات العملاء فقط.";
  if (declaration.relatedEventId && declaration.direction !== "commitment")
    return "ربط الحدث مخصص لالتزامات المصروف فقط.";
  if (declaration.kind === "declaration" && declaration.reversalOfId !== null)
    return "السجل الأصلي لا يحمل رابط تراجع.";
  if (declaration.kind === "reversal" && !declaration.reversalOfId?.trim())
    return "التراجع يحتاج رابطًا إلى سجل متوقع أصلي.";
  return null;
}

function activeDeclarations(declarations: readonly ShortCashDeclaration[]): {
  active: ShortCashDeclaration[];
  invalidReason: string | null;
} {
  const byId = new Map<string, ShortCashDeclaration>();
  const reversedIds = new Set<string>();
  const active: ShortCashDeclaration[] = [];
  const keys = new Set<string>();
  for (const declaration of declarations) {
    const validation = validateDeclaration(declaration);
    if (validation) return { active: [], invalidReason: validation };
    if (byId.has(declaration.id)) return { active: [], invalidReason: "يوجد تكرار في معرف السجل المتوقع." };
    if (keys.has(`${declaration.kind}:${declaration.idempotencyKey}`))
      return { active: [], invalidReason: "يوجد تكرار في مفتاح السجل المتوقع." };
    byId.set(declaration.id, declaration);
    keys.add(`${declaration.kind}:${declaration.idempotencyKey}`);
    if (declaration.kind === "declaration") active.push(declaration);
  }
  for (const declaration of declarations) {
    if (declaration.kind !== "reversal") continue;
    if (!declaration.reversalOfId || reversedIds.has(declaration.reversalOfId))
      return { active: [], invalidReason: "يوجد تراجع مكرر أو بلا سجل أصلي." };
    const original = byId.get(declaration.reversalOfId);
    if (
      !original ||
      original.kind !== "declaration" ||
      original.amountMinor !== declaration.amountMinor ||
      original.direction !== declaration.direction ||
      original.dueOn !== declaration.dueOn ||
      original.source !== declaration.source ||
      original.relatedOrderId !== declaration.relatedOrderId ||
      original.relatedEventId !== declaration.relatedEventId
    )
      return { active: [], invalidReason: "التراجع عن السجل المتوقع لا يطابق أصله." };
    reversedIds.add(declaration.reversalOfId);
  }
  return { active: active.filter(declaration => !reversedIds.has(declaration.id)), invalidReason: null };
}

export function calculateShortCash(input: ShortCashInput): ShortCashResult {
  const base = {
    from: input.from,
    to: input.to,
    recordedCashMinor: input.recordedCashMinor,
    declaredCollectionsMinor: 0,
    declaredCommitmentsMinor: 0,
    undatedReceivablesMinor: 0,
    undatedPayablesMinor: 0,
    projectedCashMinor: null,
    activeDeclarationCount: 0,
    sources: [] as string[],
    assumptions: [] as string[],
    reasons: [] as string[],
    nextAction: "سجّل مصدرًا وتاريخًا لأي تحصيل أو التزام مؤثر قبل الاعتماد على توقع.",
  };
  if (
    !isValidLocalDate(input.from) ||
    !isValidLocalDate(input.to) ||
    input.from > input.to ||
    !Number.isSafeInteger(input.recordedCashMinor)
  )
    return {
      ...base,
      status: "invalid",
      reasons: ["الفترة أو الكاش المسجل غير صالح."],
      nextAction: "راجع الفترة أو الكاش المسجل قبل القراءة.",
    };
  const balanceErrors = [...input.receivables, ...input.payables]
    .map(validateBalanceItem)
    .filter((reason): reason is string => reason !== null);
  if (balanceErrors.length > 0)
    return {
      ...base,
      status: "invalid",
      reasons: balanceErrors,
      nextAction: "صحح الرصيد أو تاريخه قبل قراءة السيولة.",
    };
  const declarationState = activeDeclarations(input.declarations);
  if (declarationState.invalidReason)
    return {
      ...base,
      status: "invalid",
      reasons: [declarationState.invalidReason],
      nextAction: "راجع السجل المتوقع أو التراجع عنه دون تعديل السجل القديم.",
    };
  const active = declarationState.active;
  const allBalances = [...input.receivables, ...input.payables];
  let declaredCollectionsMinor = 0;
  let declaredCommitmentsMinor = 0;
  let undatedReceivablesMinor = 0;
  let undatedPayablesMinor = 0;
  let needsReview = false;
  let incomplete = false;
  const sources: string[] = [];
  const assumptions: string[] = [];
  const reasons: string[] = [];
  let invalid = false;
  let hasWindowEvidence = false;

  for (const balance of allBalances) {
    const linked = active.filter(
      declaration =>
        (declaration.relatedOrderId ?? declaration.relatedEventId) === balance.id &&
        declaration.direction === balance.direction,
    );
    const linkedAmount = linked.reduce((sum, declaration) => sum + declaration.amountMinor, 0);
    if (!Number.isSafeInteger(linkedAmount) || linkedAmount > balance.amountMinor) {
      invalid = true;
      reasons.push(`متوقعات ${balance.source} يتجاوز مجموعها الرصيد المسجل.`);
      continue;
    }
    if (balance.dueOn !== null) {
      if (linked.length > 0) {
        invalid = true;
        reasons.push(`السجل المتوقع المرتبط بـ${balance.source} يكرر رصيدًا له تاريخ مسجل مسبقًا.`);
        continue;
      }
      if (balance.dueOn >= input.from && balance.dueOn <= input.to) {
        hasWindowEvidence = true;
        sources.push(`رصيد مؤرخ: ${balance.source} في ${balance.dueOn}`);
        if (balance.direction === "collection") declaredCollectionsMinor += balance.amountMinor;
        else declaredCommitmentsMinor += balance.amountMinor;
      }
    } else if (linkedAmount < balance.amountMinor) {
      const remaining = balance.amountMinor - linkedAmount;
      if (balance.direction === "collection") undatedReceivablesMinor += remaining;
      else undatedPayablesMinor += remaining;
      incomplete = true;
      reasons.push(
        `${balance.direction === "collection" ? "دين" : "التزام"} بلا تاريخ كافٍ: ${balance.source}.`,
      );
    }
  }

  for (const declaration of active) {
    const isInWindow = declaration.dueOn >= input.from && declaration.dueOn <= input.to;
    if (!isInWindow) continue;
    hasWindowEvidence = true;
    const balanceId = declaration.relatedOrderId ?? declaration.relatedEventId;
    if (balanceId) {
      const balance = allBalances.find(
        item => item.id === balanceId && item.direction === declaration.direction,
      );
      if (!balance) {
        invalid = true;
        reasons.push(`السجل المتوقع ${declaration.source} مرتبط برصيد غير موجود.`);
        continue;
      }
      if (balance.dueOn !== null) continue;
      const linkedAmount = active
        .filter(
          candidate =>
            (candidate.relatedOrderId ?? candidate.relatedEventId) === balanceId &&
            candidate.direction === declaration.direction,
        )
        .reduce((sum, candidate) => sum + candidate.amountMinor, 0);
      if (linkedAmount > balance.amountMinor) {
        invalid = true;
        reasons.push(`السجل المتوقع ${declaration.source} يتجاوز الرصيد المسجل.`);
        continue;
      }
    }
    if (declaration.direction === "collection") declaredCollectionsMinor += declaration.amountMinor;
    else declaredCommitmentsMinor += declaration.amountMinor;
    sources.push(
      `${declaration.direction === "collection" ? "قبض" : "دفع"} متوقع: ${declaration.source} في ${declaration.dueOn}`,
    );
    if (declaration.knowledge !== "known") {
      needsReview = true;
      assumptions.push(
        `${declaration.source}: ${declaration.knowledge === "estimated" ? "تقدير معلن" : "يحتاج مراجعة"}.`,
      );
    }
  }

  if (undatedReceivablesMinor > 0 || undatedPayablesMinor > 0) incomplete = true;
  if (!hasWindowEvidence) {
    incomplete = true;
    reasons.push("لا يوجد أساس كافٍ لأفق قصير مؤرخ؛ غياب المتوقع لا يعني أن الأفق آمن.");
  }
  if (invalid)
    return {
      ...base,
      status: "invalid",
      declaredCollectionsMinor,
      declaredCommitmentsMinor,
      undatedReceivablesMinor,
      undatedPayablesMinor,
      activeDeclarationCount: active.length,
      sources,
      assumptions,
      reasons,
      nextAction: "صحح مبلغ السجل المتوقع أو تاريخه أو ربطه قبل الاعتماد على قراءة السيولة.",
    };
  const status = incomplete ? "incomplete" : needsReview ? "needs_review" : "available";
  return {
    ...base,
    status,
    declaredCollectionsMinor,
    declaredCommitmentsMinor,
    undatedReceivablesMinor,
    undatedPayablesMinor,
    projectedCashMinor:
      status === "incomplete"
        ? null
        : input.recordedCashMinor + declaredCollectionsMinor - declaredCommitmentsMinor,
    activeDeclarationCount: active.length,
    sources,
    assumptions,
    reasons,
    nextAction:
      status === "available" || status === "needs_review"
        ? "راجع مواعيد التحصيل والالتزامات إذا تغيرت الوقائع؛ هذا توقع معلن وليس كاشًا حاليًا."
        : "حدّث تاريخ التحصيل أو الالتزام المفقود قبل الاعتماد على توقع قصير.",
  };
}
