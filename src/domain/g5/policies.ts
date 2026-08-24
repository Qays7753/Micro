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

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const KNOWLEDGE: readonly G5Knowledge[] = ["known", "estimated", "needs_review"];

function isValidLocalDate(value: string): boolean {
  if (!LOCAL_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
}

function assertId(value: string, field: string): void {
  if (!value.trim()) throw new Error(`${field} is required`);
}

function assertDate(value: string, field: string): void {
  if (!isValidLocalDate(value)) throw new Error(`${field} must be a valid local date`);
}

function assertPositiveMinor(value: number, field: string): void {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${field} must be a positive integer`);
}

function assertNonNegativeMinor(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${field} must be a non-negative integer`);
}

function assertKnowledge(value: G5Knowledge): void {
  if (!KNOWLEDGE.includes(value)) throw new Error("knowledge is invalid");
}

export function createShortCashDeclaration(input: CreateShortCashDeclarationInput): ShortCashDeclaration {
  assertId(input.id, "id");
  assertPositiveMinor(input.amountMinor, "amountMinor");
  assertDate(input.dueOn, "dueOn");
  assertId(input.source, "source");
  assertId(input.note, "note");
  assertId(input.idempotencyKey, "idempotencyKey");
  assertKnowledge(input.knowledge);
  if (input.relatedOrderId && input.relatedEventId) throw new Error("a declaration cannot link to both an order and an event");
  if (input.relatedOrderId !== null && input.relatedOrderId !== undefined) assertId(input.relatedOrderId, "relatedOrderId");
  if (input.relatedEventId !== null && input.relatedEventId !== undefined) assertId(input.relatedEventId, "relatedEventId");
  if (Number.isNaN(Date.parse(input.createdAt))) throw new Error("createdAt must be ISO-8601");
  return Object.freeze({
    id: input.id,
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
  if (input.original.kind !== "declaration") throw new Error("only an active declaration can be reversed");
  if (Number.isNaN(Date.parse(input.createdAt))) throw new Error("createdAt must be ISO-8601");
  return Object.freeze({
    ...input.original,
    id: input.id,
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

function validateOrder(order: G5OrderInput): string | null {
  if (!order.id.trim() || !order.itemName.trim()) return "يوجد طلب بلا معرف أو اسم عمل.";
  if (!isValidLocalDate(order.deliveredOn)) return `تاريخ تسليم الطلب ${order.id} غير صالح.`;
  if (!Number.isFinite(order.quantity) || order.quantity <= 0) return `كمية الطلب ${order.id} غير صالحة.`;
  if (!Number.isInteger(order.recognizedRevenueMinor) || order.recognizedRevenueMinor < 0 || !Number.isInteger(order.recognizedCostMinor) || order.recognizedCostMinor < 0) return `مقادير الطلب ${order.id} غير صالحة.`;
  return null;
}

function validateExpense(expense: G5ExpenseInput): string | null {
  if (!expense.id.trim() || !expense.source.trim()) return "يوجد مصروف بلا مصدر قراءة.";
  if (!Number.isInteger(expense.amountMinor) || expense.amountMinor < 0) return `مبلغ المصروف ${expense.id} غير صالح.`;
  if (expense.relationship === "shared" && expense.sharedProjectShareBasis === null) return `حصة المصروف المشترك ${expense.id} بلا أساس معلن.`;
  if (expense.relationship !== "shared" && expense.sharedProjectShareBasis !== null) return `مصروف المشروع ${expense.id} يحمل أساس حصة غير مسموح.`;
  if (expense.behavior === "unknown") return `سلوك المصروف ${expense.id} غير معروف.`;
  return null;
}

export function calculateContributionMargin(
  from: string,
  to: string,
  orders: readonly G5OrderInput[],
  expenses: readonly G5ExpenseInput[],
): ContributionMarginResult {
  if (!isValidLocalDate(from) || !isValidLocalDate(to) || from > to) return invalidContribution(from, to, "الفترة المحلية غير صالحة.");
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
  let needsReview = false;

  for (const order of orders) {
    const validation = validateOrder(order);
    if (validation) {
      invalid = true;
      reasons.push(validation);
      continue;
    }
    if (order.deliveredOn < from || order.deliveredOn > to) continue;
    sources.push(`طلب نهائي/مسجل: ${order.id}`);
    if (order.resultStatus !== "final") {
      excludedOrderCount += 1;
      excluded.push(`الطلب ${order.id} مستبعد لأن نتيجته ${order.resultStatus}.`);
      continue;
    }
    finalOrderCount += 1;
    totalRevenueMinor += order.recognizedRevenueMinor;
    totalVariableCostMinor += order.recognizedCostMinor;
    const current = mix.get(order.itemName) ?? { itemName: order.itemName, orderCount: 0, quantity: 0, revenueMinor: 0, variableCostMinor: 0, contributionMarginMinor: 0 };
    mix.set(order.itemName, {
      ...current,
      orderCount: current.orderCount + 1,
      quantity: current.quantity + order.quantity,
      revenueMinor: current.revenueMinor + order.recognizedRevenueMinor,
      variableCostMinor: current.variableCostMinor + order.recognizedCostMinor,
      contributionMarginMinor: current.contributionMarginMinor + order.recognizedRevenueMinor - order.recognizedCostMinor,
    });
  }

  for (const expense of expenses) {
    const validation = validateExpense(expense);
    if (validation) {
      reasons.push(validation);
      if (expense.relationship === "shared" && expense.sharedProjectShareBasis === null) {
        excluded.push(`المصروف ${expense.id} خارج التصنيف القابل للحساب.`);
      }
      continue;
    }
    if (expense.amountMinor === 0) continue;
    sources.push(`مصروف الفترة: ${expense.source}`);
    if (expense.behavior === "fixed") {
      fixedExpenseMinor += expense.amountMinor;
      if (expense.knowledge !== "known") {
        needsReview = true;
        assumptions.push(`مبلغ ثابت ${expense.source} ${expense.knowledge === "estimated" ? "تقديري" : "يحتاج مراجعة"}.`);
      }
      continue;
    }
    if (expense.behavior === "variable" && expense.directlyLinked) {
      totalVariableCostMinor += expense.amountMinor;
      if (expense.knowledge !== "known") {
        needsReview = true;
        assumptions.push(`تكلفة متغيرة مرتبطة ${expense.source} ${expense.knowledge === "estimated" ? "تقديرية" : "تحتاج مراجعة"}.`);
      }
      continue;
    }
    if (expense.behavior === "variable") {
      reasons.push(`المصروف المتغير ${expense.source} غير مرتبط مباشرة بهامش الوحدات.`);
    } else if (expense.behavior === "mixed") {
      reasons.push(`المصروف المختلط ${expense.source} لم يُوزع تلقائيًا بين ثابت ومتغير.`);
    }
  }

  const totalQuantity = [...mix.values()].reduce((total, item) => total + item.quantity, 0);
  const contributionMarginMinor = totalRevenueMinor - totalVariableCostMinor;
  const contributionMarginPerUnitMinor = totalQuantity > 0 ? contributionMarginMinor / totalQuantity : null;
  if (excludedOrderCount > 0) reasons.push("توجد طلبات مسلّمة خارج الهامش بسبب درجة المعرفة أو المراجعة.");
  if (finalOrderCount === 0 || totalQuantity <= 0) reasons.push("لا توجد كمية نهائية موجبة تكفي لحساب هامش المساهمة.");
  if (fixedExpenseMinor <= 0) reasons.push("لا توجد تكاليف ثابتة موجبة مسجلة في الفترة.");
  if (contributionMarginMinor <= 0 && finalOrderCount > 0) reasons.push("هامش المساهمة المسجل غير موجب.");
  if (invalid) return { ...invalidContribution(from, to, reasons.join(" ") || "بيانات G5 غير صالحة."), reasons };
  const incomplete = reasons.length > 0;
  const status = contributionMarginMinor <= 0 && finalOrderCount > 0 ? "invalid" : incomplete ? "incomplete" : needsReview ? "needs_review" : "available";
  return {
    status,
    from,
    to,
    totalRevenueMinor,
    totalVariableCostMinor,
    contributionMarginMinor,
    contributionMarginPerUnitMinor,
    fixedExpenseMinor,
    finalOrderCount,
    excludedOrderCount,
    mix: [...mix.values()].sort((left, right) => right.contributionMarginMinor - left.contributionMarginMinor || left.itemName.localeCompare(right.itemName, "ar")),
    sources,
    excluded,
    assumptions,
    reasons,
    nextAction: status === "available" || status === "needs_review" ? "راجع السعر والتكلفة إذا تغير المزيج أو الافتراض المعلن." : "سجّل التكلفة أو التصنيف أو التاريخ الناقص قبل الاعتماد على رقم تغطية.",
  };
}

export function calculateBreakEven(
  from: string,
  to: string,
  orders: readonly G5OrderInput[],
  expenses: readonly G5ExpenseInput[],
): BreakEvenResult {
  const contribution = calculateContributionMargin(from, to, orders, expenses);
  const breakEvenUnits = contribution.status === "available" || contribution.status === "needs_review"
    ? Math.ceil((contribution.fixedExpenseMinor * (contribution.mix.reduce((total, item) => total + item.quantity, 0))) / contribution.contributionMarginMinor)
    : null;
  return { ...contribution, breakEvenUnits };
}

function validateBalanceItem(item: ShortCashInput["receivables"][number]): string | null {
  if (!item.id.trim() || !item.source.trim()) return "يوجد رصيد قصير بلا مصدر.";
  if (!Number.isInteger(item.amountMinor) || item.amountMinor < 0) return `الرصيد ${item.source} غير صالح.`;
  if (item.dueOn !== null && !isValidLocalDate(item.dueOn)) return `تاريخ الرصيد ${item.source} غير صالح.`;
  return null;
}

function activeDeclarations(declarations: readonly ShortCashDeclaration[]): { active: ShortCashDeclaration[]; invalidReason: string | null } {
  const byId = new Map(declarations.map((declaration) => [declaration.id, declaration]));
  const reversedIds = new Set<string>();
  const active: ShortCashDeclaration[] = [];
  const keys = new Set<string>();
  for (const declaration of declarations) {
    if (!declaration.id.trim() || !Number.isInteger(declaration.amountMinor) || declaration.amountMinor <= 0 || !isValidLocalDate(declaration.dueOn) || !declaration.source.trim() || !declaration.note.trim() || !declaration.idempotencyKey.trim() || !KNOWLEDGE.includes(declaration.knowledge)) return { active: [], invalidReason: "يوجد إعلان سيولة ناقص أو غير صالح." };
    if (keys.has(`${declaration.kind}:${declaration.idempotencyKey}`)) return { active: [], invalidReason: "يوجد تكرار في مفتاح إعلان السيولة." };
    keys.add(`${declaration.kind}:${declaration.idempotencyKey}`);
    if (declaration.kind === "reversal") {
      if (!declaration.reversalOfId || reversedIds.has(declaration.reversalOfId)) return { active: [], invalidReason: "يوجد عكس مكرر أو بلا إعلان أصلي." };
      const original = byId.get(declaration.reversalOfId);
      if (!original || original.kind !== "declaration" || original.amountMinor !== declaration.amountMinor || original.direction !== declaration.direction || original.relatedOrderId !== declaration.relatedOrderId || original.relatedEventId !== declaration.relatedEventId) return { active: [], invalidReason: "عكس إعلان السيولة لا يطابق أصله." };
      reversedIds.add(declaration.reversalOfId);
    } else {
      active.push(declaration);
    }
  }
  return { active: active.filter((declaration) => !reversedIds.has(declaration.id)), invalidReason: null };
}

export function calculateShortCash(input: ShortCashInput): ShortCashResult {
  const base = { from: input.from, to: input.to, recordedCashMinor: input.recordedCashMinor, declaredCollectionsMinor: 0, declaredCommitmentsMinor: 0, undatedReceivablesMinor: 0, undatedPayablesMinor: 0, projectedCashMinor: null, activeDeclarationCount: 0, sources: [] as string[], assumptions: [] as string[], reasons: [] as string[], nextAction: "سجّل مصدرًا وتاريخًا لأي تحصيل أو التزام مؤثر قبل الاعتماد على توقع." };
  if (!isValidLocalDate(input.from) || !isValidLocalDate(input.to) || input.from > input.to || !Number.isInteger(input.recordedCashMinor)) return { ...base, status: "invalid", reasons: ["الفترة أو الكاش المسجل غير صالح."], nextAction: "راجع الفترة أو الكاش المسجل قبل القراءة." };
  const balanceErrors = [...input.receivables, ...input.payables].map(validateBalanceItem).filter((reason): reason is string => reason !== null);
  if (balanceErrors.length > 0) return { ...base, status: "invalid", reasons: balanceErrors, nextAction: "صحح الرصيد أو تاريخه قبل قراءة السيولة." };
  const declarationState = activeDeclarations(input.declarations);
  if (declarationState.invalidReason) return { ...base, status: "invalid", reasons: [declarationState.invalidReason], nextAction: "راجع إعلان السيولة أو عكسه دون تعديل السجل القديم." };
  const active = declarationState.active;
  const allBalances = [...input.receivables, ...input.payables];
  const referencedBalanceIds = new Set<string>();
  let declaredCollectionsMinor = 0;
  let declaredCommitmentsMinor = 0;
  let undatedReceivablesMinor = 0;
  let undatedPayablesMinor = 0;
  let needsReview = false;
  const sources: string[] = [];
  const assumptions: string[] = [];
  const reasons: string[] = [];

  for (const declaration of active) {
    const isInWindow = declaration.dueOn >= input.from && declaration.dueOn <= input.to;
    if (!isInWindow) continue;
    const balanceId = declaration.relatedOrderId ?? declaration.relatedEventId;
    if (balanceId) {
      const balance = allBalances.find((item) => item.id === balanceId && item.direction === declaration.direction);
      if (!balance) {
        reasons.push(`الإعلان ${declaration.source} مرتبط برصيد غير موجود.`);
        continue;
      }
      if (balance.dueOn !== null) {
        reasons.push(`الإعلان ${declaration.source} يكرر رصيدًا له تاريخ مسجل مسبقًا.`);
        continue;
      }
      const alreadyDeclared = active.filter((candidate) => (candidate.relatedOrderId ?? candidate.relatedEventId) === balanceId && candidate.direction === declaration.direction).filter((candidate) => candidate.dueOn >= input.from && candidate.dueOn <= input.to).reduce((sum, candidate) => sum + candidate.amountMinor, 0);
      if (alreadyDeclared > balance.amountMinor) {
        reasons.push(`إعلانات ${declaration.source} تتجاوز الرصيد المسجل.`);
        continue;
      }
      referencedBalanceIds.add(balanceId);
    }
    if (declaration.direction === "collection") declaredCollectionsMinor += declaration.amountMinor;
    else declaredCommitmentsMinor += declaration.amountMinor;
    sources.push(`إعلان ${declaration.direction === "collection" ? "تحصيل" : "التزام"}: ${declaration.source} في ${declaration.dueOn}`);
    if (declaration.knowledge !== "known") {
      needsReview = true;
      assumptions.push(`${declaration.source}: ${declaration.knowledge === "estimated" ? "تقدير معلن" : "يحتاج مراجعة"}.`);
    }
  }

  for (const balance of allBalances) {
    const linked = active.filter((declaration) => (declaration.relatedOrderId ?? declaration.relatedEventId) === balance.id && declaration.direction === balance.direction);
    const linkedAmount = linked.reduce((sum, declaration) => sum + declaration.amountMinor, 0);
    if (balance.dueOn !== null) {
      if (balance.dueOn >= input.from && balance.dueOn <= input.to) {
        sources.push(`رصيد مؤرخ: ${balance.source} في ${balance.dueOn}`);
        if (balance.direction === "collection") declaredCollectionsMinor += balance.amountMinor;
        else declaredCommitmentsMinor += balance.amountMinor;
      }
    } else if (linkedAmount < balance.amountMinor) {
      const remaining = balance.amountMinor - linkedAmount;
      if (balance.direction === "collection") undatedReceivablesMinor += remaining;
      else undatedPayablesMinor += remaining;
      reasons.push(`${balance.direction === "collection" ? "ذمة" : "التزام"} بلا تاريخ كافٍ: ${balance.source}.`);
    }
  }

  const hasAnyFlow = declaredCollectionsMinor > 0 || declaredCommitmentsMinor > 0 || allBalances.length > 0;
  const status = reasons.length > 0 ? "incomplete" : !hasAnyFlow ? "incomplete" : needsReview ? "needs_review" : "available";
  return {
    ...base,
    status,
    declaredCollectionsMinor,
    declaredCommitmentsMinor,
    undatedReceivablesMinor,
    undatedPayablesMinor,
    projectedCashMinor: status === "incomplete" ? null : input.recordedCashMinor + declaredCollectionsMinor - declaredCommitmentsMinor,
    activeDeclarationCount: active.length,
    sources,
    assumptions,
    reasons,
    nextAction: status === "available" || status === "needs_review" ? "راجع مواعيد التحصيل والالتزامات إذا تغيرت الوقائع؛ هذا توقع معلن وليس كاشًا حاليًا." : "حدّث تاريخ التحصيل أو الالتزام المفقود قبل الاعتماد على توقع قصير.",
  };
}
