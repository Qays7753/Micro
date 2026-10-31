/**
 * S10 (UNIT-030/031/032 + SH-14 — أمر b56967d8): حسابات التخطيط النقية.
 *
 * العلاقة الحاكمة بالنواة الواحدة (لا محرك ثانٍ — ACD015/DUP-015):
 *  - جانب التكلفة في T01 يمر كلهًا بالنواة الواحدة `calculateCostSnapshot`
 *    (نواة S09/SH-13) بعد توسيع أساس المجموعات: مكونات الوحدة × تكرارها
 *    مرة واحدة قبل تقريب النواة للبند (SDF-034)، والمستويات على نطاق
 *    الحساب كله مرة واحدة (وقت/تغليف/هدر/توصيل المشروع).
 *  - وضع «الإجمالي للكمية كاملة» يمثل ببند واحد كمية 1 بسعر الإجمالي
 *    الدقيق فيدخل النواة بالمجموع الدقيق نفسه (SDF-002: إجمالي 10.00
 *    لكمية 3 يبقى 1000 minor — حصة الوحدة عرض مشتق لا يعاد ضربه).
 *  - الجوانب التخطيطية (سعر البيع الحر، الخصم/العمولة بأساس معلن،
 *    الإيرادات/المصاريف الإضافية، الربح المتوقع وهامشه) حسابات نقية هنا
 *    فوق ناتج النواة — لا تمس لقطة طلب ولا دفترًا ولا تعاد كتابة تاريخ.
 *  - T02–T05 نقية بالكامل؛ المجهول يظل مجهولًا والمقام الصفري أو المساهمة
 *    غير الموجبة نتيجة غير قابلة للحساب بصدق (لا صفر ولا نسبة ملفقة).
 */
import { calculateCostSnapshot, type CostSnapshot, type MaterialCostItem } from "../craft-order/index.js";
import { ceilRatio, localDateInAmman, quantityMilliExact, roundHalfUp } from "../shared/index.js";
import type {
  HourValueInput,
  HourValueResult,
  IdeaReviewAnswers,
  IdeaReviewResult,
  InvoiceShareInput,
  InvoiceShareResult,
  PlanningCalculationInput,
  PlanningCalculationResult,
  PlanningGroup,
  PlanningGroupResult,
  PricingAim,
  SalesQuantityInput,
  SalesQuantityResult,
} from "./types.js";

const JOD_CURRENCY = "JOD" as const;

function assertMinor(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`أدخل ${label} مبلغًا غير سالب.`);
  }
}

function assertPercentCenti(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > 10000) {
    throw new Error(`أدخل ${label} نسبة بين 0 و100.`);
  }
}

/** تقريب الكمية الصحيحة لأعلى للوحدة غير القابلة للتجزئة — عبر ceilRatio المشتركة (D-02/A-07). */
function ceilDivPositive(numerator: number, denominator: number): number {
  const ceiling = ceilRatio(numerator, denominator);
  if (ceiling === null) throw new Error("الكمية المطلوبة تتجاوز الدقة الآمنة؛ راجع المدخلات.");
  return ceiling;
}

function validateComponentShape(component: PlanningGroup["unitComponents"][number]): void {
  if (component.quantity !== undefined && (!Number.isFinite(component.quantity) || component.quantity < 0)) {
    throw new Error(`أدخل كمية ${component.name || "المكوّن"} رقمًا غير سالب.`);
  }
  if (component.unitPriceMinor !== undefined) {
    assertMinor(component.unitPriceMinor, `سعر وحدة ${component.name || "المكوّن"}`);
  }
}

function validateGroupIdentity(group: PlanningGroup): void {
  if (!group.id.trim()) throw new Error("أكمل هوية المجموعة قبل الحساب.");
  if (!group.label.trim()) throw new Error("أدخل اسمًا للمجموعة قبل الحساب.");
  if (!Number.isSafeInteger(group.repeatQuantity) || group.repeatQuantity < 1) {
    throw new Error("أدخل تكرار المجموعة رقمًا صحيحًا 1 أو أكثر.");
  }
  if (group.offeringType !== "product" && group.offeringType !== "service") {
    throw new Error("حدد نوع المجموعة: منتج أو خدمة.");
  }
  if (group.costMode !== "details" && group.costMode !== "total") {
    throw new Error("اختر طريقة تكلفة واحدة للمجموعة: تفصيل أو إجمالي.");
  }
}

function validateGroupShape(group: PlanningGroup): void {
  validateGroupIdentity(group);
  if (group.costMode === "total") {
    if (group.totalCostMinor !== null) assertMinor(group.totalCostMinor, "تكلفة الكمية الكاملة");
  } else {
    for (const component of group.unitComponents) validateComponentShape(component);
  }
  if (group.sellingPriceMinor !== null) assertMinor(group.sellingPriceMinor, "سعر بيع الوحدة");
}

/** تكلفة مجموعة واحدة الدقيقة — التفصيل يضرب قبل التقريب لكل بند، والإجمالي أصله المحفوظ. */
function groupCostMinorOf(group: PlanningGroup): number {
  if (group.costMode === "total") {
    /* الإجمالي المعروف هو المصدر نفسه — لا يعاد بناؤه من حصة وحدة معروضة. */
    return group.totalCostMinor ?? 0;
  }
  let total = 0;
  for (const component of group.unitComponents) {
    const name = component.name.trim();
    if (!name || !(component.unitPriceMinor > 0)) continue; /* مسمى بلا سعر: غير محدد بعد — مستبعد لا صفر */
    if (!component.unit.trim()) throw new Error(`أكمل وحدة المكوّن ${name} قبل الحساب.`);
    if (!Number.isFinite(component.quantity) || component.quantity <= 0) {
      throw new Error(`أدخل كمية المكوّن ${name} رقمًا أكبر من صفر.`);
    }
    const expandedMilli = quantityMilliExact(component.quantity * group.repeatQuantity);
    if (expandedMilli === null) {
      throw new Error(`كمية المكوّن ${name} بعد التكرار تتجاوز الدقة الآمنة؛ قلّل الكمية أو التكرار.`);
    }
    const itemCost = roundHalfUp(expandedMilli * component.unitPriceMinor, 1000);
    if (itemCost === null) {
      throw new Error(`تكلفة المكوّن ${name} تتجاوز الدقة الآمنة للأرقام الصحيحة.`);
    }
    total += itemCost;
  }
  return total;
}

/** توسيع المجموعات الفعالة إلى مدخل النواة: تفصيل → مكونات موسعة
 * (الضرب قبل التقريب للبند)، وإجمالي → بند واحد كمية 1 بسعر الإجمالي
 * الدقيق (يحفظ SDF-002 حرفيًا). المسمى بلا سعر يظل «غير محدد بعد» مستبعدًا. */
function expandPlanningGroups(
  activeGroups: readonly PlanningGroup[],
  priceDate: string,
): { materialItems: MaterialCostItem[]; excludedComponentNames: string[]; derivedQuantity: number } {
  const materialItems: MaterialCostItem[] = [];
  const excludedComponentNames: string[] = [];
  let derivedQuantity = 0;
  for (const group of activeGroups) {
    derivedQuantity += group.repeatQuantity;
    if (group.costMode === "total") {
      pushTotalModeItem(group, priceDate, materialItems);
      continue;
    }
    pushExpandedComponents(group, priceDate, materialItems, excludedComponentNames);
  }

  return { materialItems, excludedComponentNames, derivedQuantity };
}

/** وضع الإجمالي: بند واحد كمية 1 بسعر الإجمالي الدقيق — الأصل نفسه (SDF-002). */
function pushTotalModeItem(group: PlanningGroup, priceDate: string, materialItems: MaterialCostItem[]): void {
  if (group.totalCostMinor === null || group.totalCostMinor <= 0) return;
  materialItems.push({
    name: group.label.trim(),
    quantity: 1,
    unit: "الكمية الكاملة",
    unitPriceMinor: group.totalCostMinor,
    priceDate,
    source: "user_input",
    confidence: "known",
  });
}

/** وضع التفصيل: مكونات الوحدة تضرب في التكرار قبل التقريب للبند؛
 * والمسمى بلا سعر يظل «غير محدد بعد» مستبعدًا لا صفرًا. */
function pushExpandedComponents(
  group: PlanningGroup,
  priceDate: string,
  materialItems: MaterialCostItem[],
  excludedComponentNames: string[],
): void {
  for (const component of group.unitComponents) {
    const name = component.name.trim();
    if (!name) continue;
    if (!(component.unitPriceMinor > 0)) {
      excludedComponentNames.push(name);
      continue;
    }
    if (!component.unit.trim()) throw new Error(`أكمل وحدة المكوّن ${name} قبل الحساب.`);
    const expanded = component.quantity * group.repeatQuantity;
    if (!Number.isFinite(expanded) || expanded <= 0) {
      throw new Error(`كمية المكوّن ${name} بعد التكرار تتجاوز الدقة الآمنة؛ قلّل الكمية أو التكرار.`);
    }
    materialItems.push({
      name,
      quantity: expanded,
      unit: component.unit.trim(),
      unitPriceMinor: component.unitPriceMinor,
      priceDate,
      source: "user_input",
      confidence: component.confidence,
      ...(component.materialId !== undefined && component.materialId !== null
        ? { materialId: component.materialId }
        : {}),
    });
  }
}

/** خصم واحد اختياري على قيمة المنتجات — مبلغ لا يتجاوز الأصل أو نسبة معلنة. */
function discountMinorOf(
  discount: NonNullable<PlanningCalculationInput["discount"]>,
  sellingTotal: number | null,
): number {
  if (sellingTotal === null) {
    throw new Error("أدخل أسعار البيع قبل تجربة الخصم — لا خصم بلا قيمة منتجات.");
  }
  if (discount.mode === "amount") {
    assertMinor(discount.amountMinor, "الخصم");
    if (discount.amountMinor > sellingTotal) {
      throw new Error("الخصم أكبر من قيمة المنتجات — لا مبلغ أكبر من الأصل.");
    }
    return discount.amountMinor;
  }
  assertPercentCenti(discount.percentCenti, "الخصم");
  return roundHalfUp(sellingTotal * discount.percentCenti, 10000) ?? 0;
}

/** عمولة اختيارية بأساس صريح يختاره المستخدم — تكلفة مرة واحدة. */
function commissionMinorOf(
  commission: NonNullable<PlanningCalculationInput["commission"]>,
  sellingTotal: number | null,
  discountMinor: number,
  extrasRevenueMinor: number,
): number {
  if (commission.mode === "amount") {
    assertMinor(commission.amountMinor, "العمولة");
    return commission.amountMinor;
  }
  assertPercentCenti(commission.percentCenti, "العمولة");
  const productsAfterDiscount = sellingTotal === null ? null : sellingTotal - discountMinor;
  const basis =
    commission.basis === "products_after_discount"
      ? productsAfterDiscount
      : productsAfterDiscount === null
        ? null
        : productsAfterDiscount + extrasRevenueMinor;
  if (basis === null) {
    throw new Error("أدخل أسعار البيع قبل تجربة العمولة — لا عمولة بلا أساس معلن.");
  }
  return roundHalfUp(basis * commission.percentCenti, 10000) ?? 0;
}

/** نتائج المجموعات وقيمة البيع الكاملة — السعر غير المحدد يبقيها null لا صفرًا. */
function planningSellingOf(activeGroups: readonly PlanningGroup[]): {
  groupResults: PlanningGroupResult[];
  sellingTotal: number | null;
} {
  const groupResults: PlanningGroupResult[] = activeGroups.map(group => {
    const groupCost = groupCostMinorOf(group);
    const groupSelling =
      group.sellingPriceMinor === null ? null : group.sellingPriceMinor * group.repeatQuantity;
    return {
      groupId: group.id,
      repeatQuantity: group.repeatQuantity,
      groupCostMinor: groupCost,
      groupSellingMinor: groupSelling,
      groupProfitMinor: groupSelling === null ? null : groupSelling - groupCost,
    };
  });
  const pricesComplete =
    activeGroups.length > 0 && activeGroups.every(group => group.sellingPriceMinor !== null);
  const sellingTotal = pricesComplete
    ? activeGroups.reduce((total, group) => total + (group.sellingPriceMinor ?? 0) * group.repeatQuantity, 0)
    : null;
  return { groupResults, sellingTotal };
}

/** المجاميع النهائية: T = (SP − الخصم) + الإيرادات؛ CT = النواة + العمولة +
 * المصاريف؛ G = T − CT؛ الهامش = G÷T من سعر البيع (null عند T غير المحدد أو ≤0). */
function planningTotalsOf(
  sellingTotal: number | null,
  discountMinor: number,
  extrasRevenueMinor: number,
  extrasExpenseMinor: number,
  commissionMinor: number,
  snapshot: CostSnapshot,
): {
  productsSelling: number | null;
  expectedTotal: number | null;
  pricingCost: number;
  expectedProfit: number | null;
  marginPercentCenti: number | null;
} {
  const productsSelling = sellingTotal === null ? null : sellingTotal - discountMinor;
  const expectedTotal = productsSelling === null ? null : productsSelling + extrasRevenueMinor;
  const pricingCost = snapshot.plannedCostMinor + commissionMinor + extrasExpenseMinor;
  const expectedProfit = expectedTotal === null ? null : expectedTotal - pricingCost;
  const marginPercentCenti =
    expectedTotal === null || expectedTotal <= 0 || expectedProfit === null
      ? null
      : (roundHalfUp(expectedProfit * 10000, expectedTotal) as number);
  return { productsSelling, expectedTotal, pricingCost, expectedProfit, marginPercentCenti };
}

/**
 * T01 — حساب التخطيط الكامل عبر النواة الواحدة.
 *
 * المجاميع: T = (SP − الخصم) + الإيرادات الإضافية؛
 * CT = plannedCost(النواة: مواد+وقت+تغليف+توصيل+هدر) + العمولة + المصاريف الإضافية؛
 * G = T − CT؛ الهامش = G÷T من سعر البيع (percentCenti؛ null عند T غير المحدد أو ≤0).
 */
/** المجموعات الفعالة: الفارغة تمامًا «لم تُدخل بعد» فتُتخطى بمعرفة ناقصة
 * صادقة (B6: «أدخل التكلفة لحساب الربح») لا خطأ تحقق؛ التحقق الكامل يلزم
 * المجموعة ذات المحتوى فقط. */
function activePlanningGroups(groups: readonly PlanningGroup[]): readonly PlanningGroup[] {
  const isEmptyGroup = (group: PlanningGroup) =>
    !group.label.trim() &&
    !(group.totalCostMinor !== null && group.totalCostMinor > 0) &&
    !group.sellingPriceMinor &&
    group.unitComponents.every(component => !component.name.trim());
  const active = groups.filter(group => !isEmptyGroup(group));
  const seenGroupIds = new Set<string>();
  for (const group of active) {
    validateGroupShape(group);
    if (seenGroupIds.has(group.id)) throw new Error("هوية المجموعة مكررة — راجع المجموعات.");
    seenGroupIds.add(group.id);
  }
  return active;
}

function validatePlanningLevels(input: PlanningCalculationInput): void {
  assertMinor(input.packagingMinor, "التغليف");
  assertMinor(input.wasteMinor, "الهدر المتوقع");
  assertMinor(input.deliveryMinor, "توصيل المشروع");
  if (input.time === null) return;
  if (input.time.minutes !== null && (!Number.isFinite(input.time.minutes) || input.time.minutes < 0)) {
    throw new Error("أدخل دقائق الوقت رقمًا غير سالب.");
  }
  if (input.time.hourlyRateMinor !== null) {
    assertMinor(input.time.hourlyRateMinor, "أجر الساعة");
  }
}

/** النواة الواحدة — كل جانب التكلفة يمر بها حصرًا (لا محرك ثانٍ). */
function planningKernelSnapshot(
  id: string,
  input: PlanningCalculationInput,
  activeGroups: readonly PlanningGroup[],
  expansion: ReturnType<typeof expandPlanningGroups>,
): CostSnapshot {
  try {
    return calculateCostSnapshot(id, {
      currency: JOD_CURRENCY,
      materialItems: expansion.materialItems,
      time: input.time
        ? {
            minutes: input.time.minutes,
            hourlyRateMinor: input.time.hourlyRateMinor,
            confidence: input.time.confidence,
          }
        : null,
      packagingMinor: input.packagingMinor,
      deliveryMinor: input.deliveryMinor,
      wasteMinor: input.wasteMinor,
      safetyBufferMinor: 0,
      /* لا مجموعات فعالة ⇒ كمية محايدة 1 للعرض (معرفة ناقصة لا خطأ). */
      quantity: Math.max(1, expansion.derivedQuantity),
      createdAt: input.createdAt,
      source: "draft",
    });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "مدخلات الحساب غير صالحة.");
  }
}

export function calculatePlanningResult(
  id: string,
  input: PlanningCalculationInput,
): PlanningCalculationResult {
  if (!id.trim()) throw new Error("أكمل معرّف الحساب قبل التنفيذ.");
  if (input.groups.length === 0) {
    throw new Error("أضف مجموعة واحدة على الأقل قبل الحساب.");
  }
  const activeGroups = activePlanningGroups(input.groups);
  validatePlanningLevels(input);
  const expansion = expandPlanningGroups(activeGroups, localDateInAmman(input.createdAt));
  const snapshot = planningKernelSnapshot(id, input, activeGroups, expansion);
  const { excludedComponentNames } = expansion;

  /* الجوانب التخطيطية فوق ناتج النواة. */
  const { groupResults, sellingTotal } = planningSellingOf(activeGroups);
  const extrasRevenueMinor = sumExtras(input.otherRevenues);
  const extrasExpenseMinor = sumExtras(input.otherExpenses);

  const discountMinor = input.discount === null ? 0 : discountMinorOf(input.discount, sellingTotal);
  const commissionMinor =
    input.commission === null
      ? 0
      : commissionMinorOf(input.commission, sellingTotal, discountMinor, extrasRevenueMinor);

  const { productsSelling, expectedTotal, pricingCost, expectedProfit, marginPercentCenti } =
    planningTotalsOf(
      sellingTotal,
      discountMinor,
      extrasRevenueMinor,
      extrasExpenseMinor,
      commissionMinor,
      snapshot,
    );

  return {
    productsCostMinor: snapshot.materialCostMinor,
    productsSellingMinor: productsSelling,
    sellingTotalMinor: sellingTotal,
    discountMinor,
    commissionMinor,
    extrasRevenueMinor,
    extrasExpenseMinor,
    deliveryMinor: input.deliveryMinor,
    expectedTotalMinor: expectedTotal,
    pricingCostMinor: pricingCost,
    expectedProfitMinor: expectedProfit,
    marginPercentCenti,
    unitCostMinor: snapshot.unitCostMinor,
    knowledgeState: snapshot.knowledgeState,
    knowledgeGaps: snapshot.knowledgeGaps ?? [],
    excludedComponentNames,
    groupResults,
  };
}

function sumExtras(rows: readonly { amountMinor: number }[]): number {
  let total = 0;
  for (const row of rows) {
    assertMinor(row.amountMinor, "مبلغ الصف الإضافي");
    total += row.amountMinor;
  }
  return total;
}

/**
 * اقتراح سعر الوحدة الاختياري (مساعدة تسعير بأساس ظاهر لا توليد آلي):
 * مبلغ فوق التكلفة، أو هامش من سعر البيع (cost ÷ (1−m))، أو زيادة على
 * التكلفة (cost × (1+u)) — المقامان مختلفان ولا يخلطان (U031-AC11/AC12).
 */
export function suggestSellingPrice(unitCostMinor: number, aim: PricingAim): number {
  assertMinor(unitCostMinor, "تكلفة الوحدة");
  switch (aim.kind) {
    case "amount": {
      assertMinor(aim.amountMinor, "المبلغ فوق التكلفة");
      return unitCostMinor + aim.amountMinor;
    }
    case "margin": {
      assertPercentCenti(aim.marginPercentCenti, "هامش الربح من السعر");
      if (aim.marginPercentCenti >= 10000) {
        throw new Error("لا يمكن حساب سعر بهامش 100% أو أكثر — راجع النسبة.");
      }
      const denominator = 10000 - aim.marginPercentCenti;
      const suggested = roundHalfUp(unitCostMinor * 10000, denominator);
      if (suggested === null) {
        throw new Error("السعر المقترح يتجاوز الدقة الآمنة؛ قلّل النسبة.");
      }
      return suggested;
    }
    case "markup": {
      assertPercentCenti(aim.markupPercentCenti, "الزيادة على التكلفة");
      const suggested = roundHalfUp(unitCostMinor * (10000 + aim.markupPercentCenti), 10000);
      if (suggested === null) {
        throw new Error("السعر المقترح يتجاوز الدقة الآمنة؛ قلّل النسبة.");
      }
      return suggested;
    }
  }
}

/** T02 — قيمة ساعة العمل التقديرية: المقابل ÷ (الأيام × ساعات اليوم المنتجة). */
export function calculateHourValue(input: HourValueInput): HourValueResult {
  assertMinor(input.monthlyCompensationMinor, "مقابل عملك في الشهر");
  if (
    !Number.isSafeInteger(input.workDaysPerMonth) ||
    input.workDaysPerMonth < 1 ||
    input.workDaysPerMonth > 31
  ) {
    throw new Error("أدخل أيام العمل في الشهر رقمًا صحيحًا بين 1 و31.");
  }
  const hoursMilli = quantityMilliExact(input.productiveHoursPerDay);
  if (hoursMilli === null || hoursMilli <= 0 || input.productiveHoursPerDay > 24) {
    throw new Error("أدخل ساعات العمل المنتج اليومية رقمًا أكبر من صفر وحتى 24.");
  }
  const monthlyHoursMilli = hoursMilli * input.workDaysPerMonth;
  const hourValueMinor = roundHalfUp(input.monthlyCompensationMinor * 1000, monthlyHoursMilli);
  if (hourValueMinor === null) {
    throw new Error("قيمة الساعة تتجاوز الدقة الآمنة؛ راجع المدخلات.");
  }
  return {
    monthlyHours: input.workDaysPerMonth * input.productiveHoursPerDay,
    hourValueMinor,
  };
}

/** T03 — كمية البيع المطلوبة: مساهمة موجبة تقسم المصاريف الثابتة (+ الهدف) وتقرب لأعلى. */
export function calculateSalesQuantity(input: SalesQuantityInput): SalesQuantityResult {
  if (!input.periodLabel.trim()) throw new Error("حدد الفترة التي تخصها الأرقام.");
  if (!Number.isSafeInteger(input.unitSellingPriceMinor) || input.unitSellingPriceMinor <= 0) {
    throw new Error("أدخل سعر بيع الوحدة مبلغًا أكبر من صفر.");
  }
  assertMinor(input.unitVariableCostMinor, "تكلفة كل وحدة");
  assertMinor(input.fixedExpensesMinor, "مصاريف الفترة الثابتة");
  if (input.targetProfitMinor !== null) assertMinor(input.targetProfitMinor, "الربح الإضافي المستهدف");

  const contribution = input.unitSellingPriceMinor - input.unitVariableCostMinor;
  if (contribution <= 0) {
    return { computable: false, reason: "non_positive_contribution" };
  }
  const coverageQuantity =
    input.fixedExpensesMinor === 0 ? 0 : ceilDivPositive(input.fixedExpensesMinor, contribution);
  /* التقريب لأعلى فعلًا = القيمة المقربة تجاوزت الأصل (قسمة غير معدومة). */
  const coverageRoundedUp =
    input.fixedExpensesMinor > 0 && coverageQuantity * contribution > input.fixedExpensesMinor;
  let targetQuantity: number | null = null;
  let targetRoundedUp = false;
  if (input.targetProfitMinor !== null) {
    const goal = input.fixedExpensesMinor + input.targetProfitMinor;
    targetQuantity = goal === 0 ? 0 : ceilDivPositive(goal, contribution);
    targetRoundedUp = goal > 0 && targetQuantity * contribution > goal;
  }
  return {
    computable: true,
    unitContributionMinor: contribution,
    coverageQuantity,
    targetQuantity,
    coverageRoundedUp,
    targetRoundedUp,
  };
}

/** T04 — نصيب المشروع التقديري من فاتورة مشتركة بأساس صريح يختاره المستخدم. */
export function calculateInvoiceShare(input: InvoiceShareInput): InvoiceShareResult {
  assertMinor(input.billTotalMinor, "قيمة الفاتورة");
  if (input.method === "percent") {
    assertPercentCenti(input.percentCenti, "نسبة المشروع");
    const shareMinor = roundHalfUp(input.billTotalMinor * input.percentCenti, 10000) ?? 0;
    return {
      shareMinor,
      remainingMinor: input.billTotalMinor - shareMinor,
      basis: { kind: "percent", billTotalMinor: input.billTotalMinor, percentCenti: input.percentCenti },
    };
  }
  const totalUsageMilli = quantityMilliExact(input.totalUsage);
  if (totalUsageMilli === null || totalUsageMilli <= 0) {
    throw new Error("أدخل إجمالي الاستخدام رقمًا أكبر من صفر.");
  }
  const projectUsageMilli = quantityMilliExact(input.projectUsage);
  if (projectUsageMilli === null || projectUsageMilli < 0 || projectUsageMilli > totalUsageMilli) {
    throw new Error("أدخل استخدام المشروع بين صفر وإجمالي الاستخدام وبالوحدة نفسها.");
  }
  const shareMinor = roundHalfUp(input.billTotalMinor * projectUsageMilli, totalUsageMilli) ?? 0;
  return {
    shareMinor,
    remainingMinor: input.billTotalMinor - shareMinor,
    basis: {
      kind: "usage",
      billTotalMinor: input.billTotalMinor,
      projectUsage: input.projectUsage,
      totalUsage: input.totalUsage,
    },
  };
}

/** T05 — أسئلة فحص الفكرة الخمسة بالترتيب المعتمد. */
export const IDEA_REVIEW_QUESTIONS = {
  whatToSell: "ماذا ستبيع أو تقدم؟",
  whoBuys: "من سيشتري؟",
  costAndPrice: "كم تتوقع تكلفة الوحدة وسعرها؟",
  firstCustomerReach: "كيف ستصل لأول عميل؟",
  whatToVerify: "ما الذي تحتاج التأكد منه قبل البدء؟",
} as const;

/** T05 — مراجعة أولية بثلاثة أقسام: ما حددته / ما يحتاج توضيحًا / خطوتك التالية — بلا درجة ولا حكم جدوى. */
export function reviewIdea(answers: IdeaReviewAnswers): IdeaReviewResult {
  const entries: { key: keyof typeof IDEA_REVIEW_QUESTIONS; question: string; answer: string | null }[] = [
    { key: "whatToSell", question: IDEA_REVIEW_QUESTIONS.whatToSell, answer: answers.whatToSell },
    { key: "whoBuys", question: IDEA_REVIEW_QUESTIONS.whoBuys, answer: answers.whoBuys },
    { key: "costAndPrice", question: IDEA_REVIEW_QUESTIONS.costAndPrice, answer: answers.costAndPrice },
    {
      key: "firstCustomerReach",
      question: IDEA_REVIEW_QUESTIONS.firstCustomerReach,
      answer: answers.firstCustomerReach,
    },
    { key: "whatToVerify", question: IDEA_REVIEW_QUESTIONS.whatToVerify, answer: answers.whatToVerify },
  ];
  const defined = entries
    .filter(entry => typeof entry.answer === "string" && entry.answer.trim().length > 0)
    .map(entry => ({ question: entry.question, answer: (entry.answer as string).trim() }));
  const needsClarification = entries
    .filter(entry => !(typeof entry.answer === "string" && entry.answer.trim().length > 0))
    .map(entry => entry.question);

  let nextStep: string;
  if (defined.length === 0) {
    nextStep = `أجب عن سؤال واحد الآن — ابدأ بـ«${IDEA_REVIEW_QUESTIONS.whatToSell}»`;
  } else if (answers.whoBuys === null || answers.firstCustomerReach === null) {
    nextStep = "اسأل عميلًا محتملًا عن رأيه في ما تخطط لتقديمه";
  } else if (answers.costAndPrice === null) {
    nextStep = "احسب تكلفة أول نموذج بالأرقام في حاسبة التكلفة والتسعير";
  } else if (answers.whatToVerify === null) {
    nextStep = "حدد أصغر معلومة تحتاج التأكد منها قبل أول التزام مالي";
  } else {
    nextStep = "جرّب حساب تكلفة أول نسخة فعلية وقارنها بتقديرك الحالي";
  }
  return { defined, needsClarification, nextStep };
}
