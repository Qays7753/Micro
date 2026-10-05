/* المجموعة ٤ (عقد ٢٩): فحوص الأصول والقروض والعربون المحتفظ وربط استهلاك
 * التسليم — MIC-10/MIC-11/MIC-12/MIC-13. انتقلت حرفيًا من integrityCheckService.ts
 * في Wave F (ADR-013 — تقسيم مسؤولية داخلي)؛ الفحص قراءة فقط عبر السياق
 * المشترك ولا يكتب ولا يصلح شيئًا تلقائيًا أبدًا. */
import { activeRetainedDepositSumsByOrder, reversedEventIds } from "@micro-domain/financial-event/index.js";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
import { formatMoneyWithUnit } from "@/application/formatting/formatters";
import {
  INTEGRITY_TITLES,
  fail,
  type IntegrityCheckContext,
  type IntegrityCheckResult,
  unavailable,
} from "./integrityCheckModel";

/* ─── MIC-10 (المجموعة ٤): الأصول — الاقتناء مقابل الكاش/الذمم، والإهلاك
 * مقابل الدفتري، والتخلص/الشطب مقابل حالة السجل. كل عدم تطابق خلل صريح. */
export async function checkAssetIntegrity(
  ctx: IntegrityCheckContext,
  events: readonly FinancialEvent[],
): Promise<IntegrityCheckResult> {
  const assetsResult = await ctx.store.listAssets();
  if (!assetsResult.ok) return unavailable("MIC-10", "تعذر قراءة سجل الأصول — أعد المحاولة.");
  const assets = assetsResult.value;
  const reversed = reversedEventIds(events);
  const offenders: string[] = [];
  const warnOffenders: string[] = [];
  /* المجموعة ٦ (تدقيق A2 — AI-01): مكنسة الاتجاه المعاكس — حدث مالي يحمل
   * سياق أصل لا سجل له في المتجر فساد صريح (تلاعب يدوي أو تسريب مستقبلي)،
   * والأثر يدخل الدفاتر بلا مالك قابل للتصحيح. الرفض عند الاستيراد هو الخط
   * الأول؛ هذا المسح خط الدفاع الثاني على البيانات القائمة. */
  const knownAssetIds = new Set(assets.map(asset => asset.id));
  for (const event of events) {
    if (event.assetContext && !knownAssetIds.has(event.assetContext.assetId))
      offenders.push(`حدث-أصل-بلا-سجل:${event.id}`);
  }
  for (const asset of assets) {
    const acquisition = events.find(event => event.id === asset.acquisitionEventId);
    if (!acquisition || acquisition.assetContext?.assetId !== asset.id) {
      offenders.push(`أصل-بلا-اقتناء:${asset.id}`);
      continue;
    }
    const acquisitionActive = acquisition.correctionType !== "reverse" && !reversed.has(acquisition.id);
    /* جولة الاستئناف (F-2b): الاسترجاع يعيد القيم الأصلية حدثًا جديدًا — حين
     * يوجد حدث استرجاع فعّال لنفس الاقتناء (مفتاح restore: الحتمي) فأثر
     * الاقتناء قائم وإن بقي رابط سجل الأصل يشير إلى الحدث المعكوس. الفحص
     * يقرأ الأثر الفعلي لا الرابط التاريخي. */
    const restoredAcquisition = acquisitionActive
      ? null
      : (events.find(
          event =>
            event.idempotencyKey === `restore:${asset.acquisitionEventId}` &&
            event.assetContext?.assetId === asset.id &&
            event.type === acquisition.type &&
            event.correctionType !== "reverse" &&
            !reversed.has(event.id),
        ) ?? null);
    const effectiveAcquisition = acquisitionActive ? acquisition : restoredAcquisition;
    if (!effectiveAcquisition) offenders.push(`اقتناء-معكوس:${asset.id}`);
    else if (
      effectiveAcquisition.amountMinor !== asset.acquisitionAmountMinor ||
      effectiveAcquisition.type !==
        (asset.acquisitionKind === "cash" ? "asset_purchase_cash" : "asset_purchase_payable")
    )
      offenders.push(`اقتناء-لا-يطابق:${asset.id}`);
    const active = events.filter(
      event =>
        event.assetContext?.assetId === asset.id &&
        event.correctionType !== "reverse" &&
        !reversed.has(event.id),
    );
    let bookValue = 0;
    for (const event of active) bookValue += event.assetDeltaMinor ?? 0;
    if (bookValue < 0) offenders.push(`دفتري-سالب:${asset.id}`);
    const depreciation = active
      .filter(event => event.type === "asset_depreciation")
      .reduce((sum, event) => sum + event.amountMinor, 0);
    if (effectiveAcquisition && depreciation > asset.acquisitionAmountMinor)
      offenders.push(`إهلاك-فوق-القيمة:${asset.id}`);
    if (asset.status === "disposed" && !active.some(event => event.type === "asset_disposal_cash"))
      offenders.push(`تخلص-بلا-حدث:${asset.id}`);
    if (asset.status === "written_off" && !active.some(event => event.type === "asset_writeoff"))
      offenders.push(`شطب-بلا-حدث:${asset.id}`);
    if (asset.status === "active" && (asset.disposal || asset.writeOff))
      offenders.push(`حالة-متناقضة:${asset.id}`);
    if (
      asset.disposal &&
      active.some(event => event.id === asset.disposal!.eventId && event.correctionType === "reverse")
    )
      warnOffenders.push(`تخلص-معكوس:${asset.id}`);
    /* تحذير: مستحق غير مسجّل — اقتراح ظاهر لا يخصم نفسه. */
    if (asset.status === "active" && asset.lifeMonths === null) warnOffenders.push(`عمر-مجهول:${asset.id}`);
  }
  if (offenders.length > 0)
    return fail(
      "MIC-10",
      `سلامة الأصول مكسورة في ${offenders.length} موضعًا — راجع الأصل وحدثه قبل أي تصحيح.`,
      offenders,
      null,
      "/assets",
    );
  if (warnOffenders.length > 0)
    return {
      id: "MIC-10",
      titleAr: INTEGRITY_TITLES["MIC-10"],
      status: "WARN",
      detailAr: `أصول بحاجة انتباه: ${warnOffenders.length} — منها أصول بعمر نافع مجهول لا يُهلك منها شيء حتى تُحدده، وأصول معكوس تخلصها. كلها حالات معلنة لا أرقام مخفية.`,
      offenderCount: warnOffenders.length,
      offenderSampleIds: warnOffenders.slice(0, 5),
      deepLink: "/assets",
    };
  return {
    id: "MIC-10",
    titleAr: INTEGRITY_TITLES["MIC-10"],
    status: "PASS",
    detailAr:
      assets.length === 0
        ? "لا أصول مسجلة بعد — سجل أول أصل من «مالي ← الأصول»."
        : "الأصول سليمة: كل اقتناء بحادثه، والإهلاك ضمن قيمة الشراء، والحالة تطابق الأحداث.",
  };
}

/* ─── MIC-11 (المجموعة ٤): القروض — الأصل مقابل الكاش والرصيد القائم،
 * والسداد مقابل الكاش والدفعات، وتراجع الدفعات مقابل علاماتها.
 * FIN-001 (WS-178 — Wave 6): البيتان معًا — الصادر والتزام الاقتراض؛
 * عقد الفحص نفسه (النوع/المبلغ/الحالة/التراجع)، وسياق القرض يوجَّه
 * لبيته الصحيح فلا يمر حدث مستلم على سجل صادر ولا العكس. */
export async function checkLoanIntegrity(
  ctx: IntegrityCheckContext,
  events: readonly FinancialEvent[],
): Promise<IntegrityCheckResult> {
  const [loansResult, receivedLoansResult] = await Promise.all([
    ctx.store.listLoans(),
    ctx.store.listReceivedLoans(),
  ]);
  if (!loansResult.ok || !receivedLoansResult.ok)
    return unavailable("MIC-11", "تعذر قراءة سجل القروض — أعد المحاولة.");
  const loans = loansResult.value;
  const receivedLoans = receivedLoansResult.value;
  const reversed = reversedEventIds(events);
  const offenders: string[] = [];
  /* المجموعة ٦ (تدقيق A2 — AI-01): مكنسة الاتجاه المعاكس لسياق القروض —
   * نفس منطق MIC-10: حدث يتيم بلا سجل قرض فساد يُعلن لا يُسكَت عنه. */
  const outgoingLoanIds = new Set(loans.map(loan => loan.id));
  const receivedLoanIds = new Set(receivedLoans.map(loan => loan.id));
  for (const event of events) {
    const context = event.loanContext;
    if (!context) continue;
    const receivedKind = event.type === "loan_received_cash" || event.type === "loan_received_repayment_cash";
    const homeKnown = receivedKind
      ? receivedLoanIds.has(context.loanId)
      : outgoingLoanIds.has(context.loanId);
    if (!homeKnown) offenders.push(`حدث-قرض-بلا-سجل:${event.id}`);
  }
  for (const loan of loans) {
    const principal = events.find(event => event.id === loan.principalEventId);
    if (!principal || principal.loanContext?.loanId !== loan.id) {
      offenders.push(`قرض-بلا-أصل:${loan.id}`);
      continue;
    }
    const principalActive = principal.correctionType !== "reverse" && !reversed.has(principal.id);
    /* المجموعة ٦ (تدقيق A1 — FT-03): الاسترجاع يعيد القيم الأصلية حدثًا جديدًا —
     * حين يوجد استرجاع فعّال لنفس أصل القرض (مفتاح restore: الحتمي) فأثر الأصل
     * قائم وإن بقي رابط سجل القرض يشير إلى الحدث المعكوس؛ نفس منطق MIC-10 (F-2b)
     * — قبل ذلك كان MIC-11 يفشل للأبد بعد أي استرجاع عام. */
    const restoredPrincipal = principalActive
      ? null
      : (events.find(
          event =>
            event.idempotencyKey === `restore:${loan.principalEventId}` &&
            event.loanContext?.loanId === loan.id &&
            event.type === principal.type &&
            event.correctionType !== "reverse" &&
            !reversed.has(event.id),
        ) ?? null);
    const effectivePrincipal = principalActive ? principal : restoredPrincipal;
    if (!effectivePrincipal) offenders.push(`أصل-معكوس:${loan.id}`);
    else if (effectivePrincipal.amountMinor !== loan.principalMinor)
      offenders.push(`أصل-لا-يطابق:${loan.id}`);
    for (const repayment of loan.repayments) {
      const event = events.find(candidate => candidate.id === repayment.eventId);
      if (!event || event.loanContext?.loanId !== loan.id) {
        offenders.push(`دفعة-بلا-حدث:${repayment.id}`);
        continue;
      }
      const active = event.correctionType !== "reverse" && !reversed.has(event.id);
      const markedReversed = repayment.reversal !== null;
      if (active !== !markedReversed) offenders.push(`دفعة-حالة-متناقضة:${repayment.id}`);
      if (active && event.amountMinor !== repayment.amountMinor)
        offenders.push(`دفعة-لا-تطابق:${repayment.id}`);
      if (markedReversed) {
        const reversalExists = events.some(candidate => candidate.id === repayment.reversal!.reversalEventId);
        if (!reversalExists) offenders.push(`تراجع-بلا-حدث:${repayment.id}`);
      }
    }
    const repaidActive = loan.repayments
      .filter(repayment => repayment.reversal === null)
      .reduce((sum, repayment) => sum + repayment.amountMinor, 0);
    if (repaidActive > loan.principalMinor) offenders.push(`سداد-فوق-الأصل:${loan.id}`);
  }
  /* FIN-001 (WS-178 — Wave 6): بيت الاقتراض — نفس عقد الفحص: الأصل بحادثه
   * من نوعه الصحيح وبمبلغه، وكل دفعة بحادثها وحالة تراجعها، والسداد فوق
   * الأصل فساد معلن. */
  for (const loan of receivedLoans) {
    const principal = events.find(event => event.id === loan.principalEventId);
    if (!principal || principal.loanContext?.loanId !== loan.id || principal.type !== "loan_received_cash") {
      offenders.push(`قرض-مستلم-بلا-أصل:${loan.id}`);
      continue;
    }
    const principalActive = principal.correctionType !== "reverse" && !reversed.has(principal.id);
    if (!principalActive) offenders.push(`أصل-مستلم-معكوس:${loan.id}`);
    else if (principal.amountMinor !== loan.principalMinor) offenders.push(`أصل-مستلم-لا-يطابق:${loan.id}`);
    for (const repayment of loan.repayments) {
      const event = events.find(candidate => candidate.id === repayment.eventId);
      if (!event || event.loanContext?.loanId !== loan.id || event.type !== "loan_received_repayment_cash") {
        offenders.push(`دفعة-مستلمة-بلا-حدث:${repayment.id}`);
        continue;
      }
      const active = event.correctionType !== "reverse" && !reversed.has(event.id);
      const markedReversed = repayment.reversal !== null;
      if (active !== !markedReversed) offenders.push(`دفعة-مستلمة-حالة-متناقضة:${repayment.id}`);
      if (active && event.amountMinor !== repayment.amountMinor)
        offenders.push(`دفعة-مستلمة-لا-تطابق:${repayment.id}`);
      if (markedReversed) {
        const reversalExists = events.some(candidate => candidate.id === repayment.reversal!.reversalEventId);
        if (!reversalExists) offenders.push(`تراجع-مستلم-بلا-حدث:${repayment.id}`);
      }
    }
    const repaidActive = loan.repayments
      .filter(repayment => repayment.reversal === null)
      .reduce((sum, repayment) => sum + repayment.amountMinor, 0);
    if (repaidActive > loan.principalMinor) offenders.push(`سداد-فوق-الأصل:${loan.id}`);
  }
  if (offenders.length > 0)
    return fail(
      "MIC-11",
      `سلامة القروض مكسورة في ${offenders.length} موضعًا — راجع القرض ودفعاته قبل أي تصحيح.`,
      offenders,
      null,
      "/loans",
    );
  return {
    id: "MIC-11",
    titleAr: INTEGRITY_TITLES["MIC-11"],
    status: "PASS",
    detailAr:
      loans.length === 0 && receivedLoans.length === 0
        ? "لا قروض صادرة أو مستلمة مسجلة بعد — سجلها من «مالي ← القروض»."
        : "القروض سليمة: كل أصل بحادثه، وكل دفعة بحادثها، والمتبقي مشتق بلا رصيد مخزن.",
  };
}

/* ─── MIC-12 (المجموعة ٤): تصنيف العربون المحتفظ — القرار مقابل الحدث،
 * ولا تصنيف مزدوج ولا إيراد معترف مرتين. المعلق تحذير ظاهر لا خلل. */
export async function checkRetainedDepositIntegrity(
  ctx: IntegrityCheckContext,
  events: readonly FinancialEvent[],
): Promise<IntegrityCheckResult> {
  const ordersResult = await ctx.store.listOrders();
  if (!ordersResult.ok) return unavailable("MIC-12", "تعذر قراءة الطلبات المحلية — أعد المحاولة.");
  const offenders: string[] = [];
  let pendingCount = 0;
  let pendingMinor = 0;
  let partialCount = 0;
  let partialMinor = 0;
  /* Conflict E: الأحداث المالية النشطة هي الحقيقة — مجموعها لكل معنى يقارن
   * بالمحتفظ به، والعدّادات/المعنى مرآة يجب أن تطابقها. F-049 (Group 1):
   * الاشتقاق من مصدر الدومين الواحد — نفس مساعد خدمة التصنيف، لا مرآة ثانية. */
  const activeClassificationSums = activeRetainedDepositSumsByOrder(events);
  const activeClassificationEventIds = new Set(activeClassificationSums.keys());
  const activeClassificationSum = (orderId: string) =>
    activeClassificationSums.get(orderId) ?? { totalMinor: 0, ownerMinor: 0, revenueMinor: 0 };
  for (const stored of ordersResult.value) {
    const order = stored.order;
    if (order.status !== "cancelled") continue;
    if (order.depositSettlement === "retain_deposit") {
      const hasActiveEvent = activeClassificationEventIds.has(stored.id);
      const meaning = order.retainedMeaning ?? null;
      const retainedMinor = order.depositRetainedMinor ?? order.depositCollectedMinor;
      const sums = activeClassificationSum(stored.id);
      if (sums.totalMinor > retainedMinor) offenders.push(`تصنيف-فوق-الاحتفاظ:${stored.id}`);
      if (meaning !== null && sums.totalMinor === 0) offenders.push(`تصنيف-بلا-حدث:${stored.id}`);
      if (sums.totalMinor > 0) {
        const mixed = sums.ownerMinor > 0 && sums.revenueMinor > 0;
        if (meaning !== (mixed ? "mixed" : sums.ownerMinor > 0 ? "owner" : "revenue"))
          offenders.push(`تصنيف-لا-يطابق-الأحداث:${stored.id}`);
        if (sums.totalMinor < retainedMinor) {
          /* تصنيف جزئي موثق — تحذير ظاهر لا خلل: المتبقي بانتظار القرار. */
          partialCount += 1;
          partialMinor += retainedMinor - sums.totalMinor;
        }
      } else if (meaning === null) {
        pendingCount += 1;
        pendingMinor += retainedMinor;
      }
    } else if (activeClassificationEventIds.has(stored.id)) {
      offenders.push(`تصنيف-بلا-احتفاظ:${stored.id}`);
    }
  }
  for (const orderId of activeClassificationEventIds) {
    if (orderId.startsWith("بلا-طلب")) offenders.push(orderId);
  }
  if (offenders.length > 0)
    return fail(
      "MIC-12",
      `سلامة تصنيف العربون مكسورة في ${offenders.length} موضعًا — راجع طلب الإلغاء وقراره قبل أي تصحيح.`,
      offenders,
      null,
      "/finance",
    );
  if (pendingCount > 0 || partialCount > 0)
    return {
      id: "MIC-12",
      titleAr: INTEGRITY_TITLES["MIC-12"],
      status: "WARN",
      detailAr:
        `عربونات محتفظة بانتظار قرارك: ${pendingCount} بقيمة ${formatMoneyWithUnit(pendingMinor)} — الكاش محتفظ به بلا معنى حتى تصنّفه (مال مالك أو إيراد مشروع) من صفحة الطلب.` +
        (partialCount > 0
          ? ` وفي ${partialCount} عربونًا تصنيف جزئي موثق — بقيمة ${formatMoneyWithUnit(partialMinor)} بانتظار تكملة القرار.`
          : ""),
      offenderCount: pendingCount + partialCount,
      driftMinor: pendingMinor + partialMinor,
      deepLink: "/finance",
    };
  return {
    id: "MIC-12",
    titleAr: INTEGRITY_TITLES["MIC-12"],
    status: "PASS",
    detailAr: "تصنيف العربون المحتفظ سليم: كل قرار بحادثه، ولا إيراد مزدوج ولا كاش جديد.",
  };
}

/* ─── MIC-13 (المجموعة ٤): استهلاك التسليم مقابل مصدره — كل حركة استهلاك
 * بمفتاح تسليم تخص حدث تسليم فعلًا، وكل تسليم معكوس جرى عكس حركاته.
 * تصحيح مراجعة 4-c: الاستخراج القديم split(":")[2] كان يعيد معرف الطلب لا
 * معرف حدث التسليم (المعرف نفسه يحوي فواصل) فلم يتحقق الربط أبدًا، وفرع
 * المرآة الأول كان ميتًا لا يفعل شيئًا — هنا يتحققان فعليًا. */
export async function checkDeliveryConsumptionIntegrity(
  ctx: IntegrityCheckContext,
): Promise<IntegrityCheckResult> {
  const [ordersResult, movementsResult] = await Promise.all([
    ctx.store.listOrders(),
    ctx.store.listInventoryMovements(),
  ]);
  if (!ordersResult.ok || !movementsResult.ok)
    return unavailable("MIC-13", "تعذر قراءة بيانات استهلاك التسليم — أعد المحاولة.");
  const movements = movementsResult.value;
  const offenders: string[] = [];
  for (const stored of ordersResult.value) {
    const order = stored.order;
    const deliveryEvents = order.events.filter(
      event => event.type === "status_changed" && event.toStatus === "delivered",
    );
    const reversedDeliveryEventIds = new Set(
      order.events
        .filter(event => event.type === "delivery_reversed")
        .map(event => (event as { reversesEventId?: string }).reversesEventId)
        .filter((id): id is string => typeof id === "string"),
    );
    const prefix = `${stored.id}:deliver:`;
    const deliveryLinked = movements.filter(
      movement =>
        movement.orderId === stored.id &&
        movement.type === "consumption" &&
        movement.operationKey.startsWith(prefix),
    );
    for (const movement of deliveryLinked) {
      /* معرف حدث التسليم مضمّن بين البادئة الحتمية وآخر فاصل قبل المادة. */
      const withoutPrefix = movement.operationKey.slice(prefix.length);
      const lastColon = withoutPrefix.lastIndexOf(":");
      const deliveryEventId = lastColon > 0 ? withoutPrefix.slice(0, lastColon) : null;
      const knownDelivery =
        deliveryEventId !== null && deliveryEvents.some(event => event.id === deliveryEventId);
      if (!knownDelivery) {
        offenders.push(`حركة-بلا-تسليم:${movement.id}`);
        continue;
      }
      /* تسليم معكوس: كل حركة استهلاك مرتبطة به تستلزم مرآة عكسها. */
      if (deliveryEventId !== null && reversedDeliveryEventIds.has(deliveryEventId)) {
        const mirrored = movements.some(
          candidate =>
            candidate.type === "reversal" &&
            candidate.reversesMovementId === movement.id &&
            candidate.operationKey === `${movement.operationKey}:reversal`,
        );
        if (!mirrored) offenders.push(`عكس-ناقص-مرآة:${movement.id}`);
      }
    }
  }
  if (offenders.length > 0)
    return fail(
      "MIC-13",
      `ربط استهلاك التسليم بمصدره مكسور في ${offenders.length} موضعًا — راجع الطلب وحركات المواد قبل أي تصحيح.`,
      offenders,
      null,
      "/orders",
    );
  return {
    id: "MIC-13",
    titleAr: INTEGRITY_TITLES["MIC-13"],
    status: "PASS",
    detailAr: "استهلاك التسليم مربوط بمصدره: كل حركة بمفتاح حتمي، وكل عكس بمرآته.",
  };
}
