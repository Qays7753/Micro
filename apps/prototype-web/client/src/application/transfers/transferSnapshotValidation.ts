/** Transfer snapshot relation validation: validateSnapshot moved verbatim
 * from localTransferService (Group 10, Phase 10-D). Orchestrates the family
 * validators and the relation/orphan rules - same checks, same order, same
 * acceptance decisions.
 */
import { isValidAllocationPolicy, type AllocationPolicy } from "@micro-domain/recurring-margin/index.js";
import {
  isValidOwnerEntitlementOpeningBalance,
  isValidOwnerEntitlementPolicy,
  isValidOwnerEntitlementRecord,
  isValidOwnerMovement,
  type OwnerEntitlementOpeningBalance,
  type OwnerEntitlementPolicy,
  type OwnerEntitlementRecord,
  type OwnerMovement,
} from "@micro-domain/owner-entitlement/index.js";
import { localInventoryActivationId, localProfileId, type LocalStoreSnapshot } from "@/storage/local/types";
import {
  validActualTimeRecord,
  validDomainCostSnapshot,
  type ActualTimeRecordLike,
  isAgreementSource,
  isDate,
  isDirectSale,
  isFollowUpDate,
  isFollowUpEvent,
  isFollowUpSummary,
  isMoney,
  isOrderStatus,
  isPositiveQuantity,
  isRecord,
  isRecurrence,
  isResultStatus,
  isScheduleDuration,
  isScheduleEvent,
  isScheduleStatus,
  isScheduleTime,
  isSettlement,
  isString,
  validEvent,
  validateOwnerProfile,
  rangesOverlap,
  validAssetRecord,
  validCashEntry,
  validCashWallet,
  validCatalogItem,
  validCatalogTemplate,
  validCostEstimate,
  validDirectConversion,
  validDraftCostSnapshot,
  validFinancialEvent,
  validInventoryMovement,
  validInventoryShortage,
  validLoanRecord,
  validMaterial,
  validMeasurementUnit,
  validShortCashDeclaration,
  validSupplierPurchase,
} from "./transferFamilyValidators";

export function validateSnapshot(data: unknown): data is LocalStoreSnapshot {
  if (
    !isRecord(data) ||
    !Array.isArray(data.drafts) ||
    !Array.isArray(data.orders) ||
    !Array.isArray(data.directSales) ||
    !Array.isArray(data.schedules) ||
    !Array.isArray(data.recurrences) ||
    !Array.isArray(data.financialEvents) ||
    !Array.isArray(data.supplierPurchases) ||
    !Array.isArray(data.cashWallets) ||
    !Array.isArray(data.cashContinuityEntries) ||
    !Array.isArray(data.materials) ||
    !Array.isArray(data.inventoryMovements) ||
    /* المجموعة ٢ (عقد ٢٨): سجلات النقص اختيارية في الملفات القديمة — المصفوفة إن وُجدت. */
    (data.inventoryShortages !== undefined &&
      data.inventoryShortages !== null &&
      !Array.isArray(data.inventoryShortages)) ||
    !Array.isArray(data.catalogItems) ||
    !Array.isArray(data.measurementUnits) ||
    !Array.isArray(data.directConversions) ||
    !Array.isArray(data.catalogTemplates) ||
    !Array.isArray(data.actualTimeRecords) ||
    !Array.isArray(data.shortCashDeclarations) ||
    !Array.isArray(data.allocationPolicies) ||
    !Array.isArray(data.costEstimates) ||
    /* المجموعة ٤ (عقد ٢٩): الأصول والقروض اختيارية في الملفات القديمة — المصفوفة إن وُجدت. */
    (data.assets !== undefined && data.assets !== null && !Array.isArray(data.assets)) ||
    (data.loans !== undefined && data.loans !== null && !Array.isArray(data.loans))
  )
    return false;
  if (
    data.profile !== null &&
    (!isRecord(data.profile) ||
      data.profile.id !== localProfileId ||
      !isString(data.profile.activityName) ||
      data.profile.currency !== "JOD" ||
      data.profile.activityType !== "custom_craft" ||
      !isDate(data.profile.createdAt) ||
      !isDate(data.profile.updatedAt))
  )
    return false;
  /* المجموعة ١: ملف المالك — غيابه مقبول (ملفات ٢١ وأقدم)؛ وجوده المعطوب يرفض. */
  if (!validateOwnerProfile(data.ownerProfile)) return false;
  if (
    data.preferences !== null &&
    (!isRecord(data.preferences) ||
      data.preferences.id !== "local-preferences" ||
      !(
        data.preferences.theme === "light" ||
        data.preferences.theme === "dark" ||
        data.preferences.theme === "system"
      ) ||
      !(
        data.preferences.dailyScheduleCapacityMinutes === null ||
        isScheduleDuration(data.preferences.dailyScheduleCapacityMinutes)
      ) ||
      !(
        data.preferences.lastVerifiedExportAt === undefined ||
        data.preferences.lastVerifiedExportAt === null ||
        isDate(data.preferences.lastVerifiedExportAt)
      ) ||
      /* O-001: مفتاح تذكير النسخة اختياري — غائب أو منطقي؛ لا تفسير آخر. */
      !(
        data.preferences.backupReminderEnabled === undefined ||
        typeof data.preferences.backupReminderEnabled === "boolean"
      ) ||
      !isDate(data.preferences.updatedAt))
  )
    return false;
  /* القرار ٩: سجل تفعيل المخزون سجل منفرد مؤرّخ — يُقبل غيابه ولا يُقبل معطوبًا. */
  if (
    data.inventoryActivation !== null &&
    data.inventoryActivation !== undefined &&
    (!isRecord(data.inventoryActivation) ||
      data.inventoryActivation.id !== localInventoryActivationId ||
      !isDate(data.inventoryActivation.activatedOn) ||
      !isDate(data.inventoryActivation.recordedAt) ||
      !isString(data.inventoryActivation.operationKey))
  )
    return false;
  const orderIds = new Set<string>();
  for (const stored of data.orders) {
    const orderContextValid =
      isRecord(stored) &&
      isString(stored.id) &&
      isDate(stored.createdAt) &&
      isDate(stored.updatedAt) &&
      isString(stored.deliveryDate) &&
      (stored.catalogItemId === null || isString(stored.catalogItemId)) &&
      isAgreementSource(stored.agreementSource) &&
      isFollowUpSummary(stored.followUpSummary) &&
      isFollowUpDate(stored.followUpDate) &&
      (stored.followUpReason === null ||
        (isString(stored.followUpReason) &&
          stored.followUpReason.trim().length >= 2 &&
          stored.followUpReason.trim().length <= 160)) &&
      (stored.followUpDate === null ? stored.followUpReason === null : stored.followUpReason !== null) &&
      Array.isArray(stored.followUpEvents) &&
      stored.followUpEvents.every(isFollowUpEvent) &&
      isRecord(stored.order);
    if (!orderContextValid || !isRecord(stored) || !isRecord(stored.order) || !isString(stored.id))
      return false;
    const order = stored.order;
    /* المجموعة ٢ (التحصين الكامل — LOW-002): تفرُّد الأحداث داخل الطلب على
     * زوج (المفتاح، النوع) — نفس عقد مسار الكتابة (appendEvent يُكرم بالمفتاح
     * والنوع معًا). نفس المفتاح بنوعين مختلفين مسموح (قبضة وتراجعها بمفتاح
     * العملية الواحد)، والمفتاح نفسه بالنوع نفسه مرتين = تلاعب يُرفض. */
    const orderEventKeyTypes = new Set<string>();
    const orderEventUniquenessValid =
      Array.isArray(order.events) &&
      order.events.every(event => {
        if (!isRecord(event) || !isString(event.idempotencyKey) || !isString(event.type)) return true;
        const key = `${event.type}:${event.idempotencyKey}`;
        if (orderEventKeyTypes.has(key)) return false;
        orderEventKeyTypes.add(key);
        return true;
      });
    if (!orderEventUniquenessValid) return false;
    const domainOrderValid =
      order.id === stored.id &&
      isString(order.customerName) &&
      isString(order.itemName) &&
      isString(order.specifications) &&
      isPositiveQuantity(order.quantity) &&
      order.currency === "JOD" &&
      isMoney(order.agreedPriceMinor) &&
      isMoney(order.depositCollectedMinor) &&
      isMoney(order.collectedMinor) &&
      isMoney(order.receivableMinor) &&
      isMoney(order.recognizedRevenueMinor) &&
      isMoney(order.recognizedCostMinor) &&
      (order.profitIndicatorMinor === null || isMoney(order.profitIndicatorMinor)) &&
      isOrderStatus(order.status) &&
      isSettlement(order.settlementStatus) &&
      isResultStatus(order.resultStatus) &&
      Array.isArray(order.events) &&
      order.events.every(validEvent) &&
      Array.isArray(order.costSnapshots) &&
      order.costSnapshots.every(validDomainCostSnapshot) &&
      validDomainCostSnapshot(order.costSnapshot);
    if (!domainOrderValid) return false;
    if (orderIds.has(stored.id)) return false;
    orderIds.add(stored.id);
  }
  const directSaleIds = new Set<string>();
  const directSaleKeys = new Set<string>();
  const directSaleRevisionKeys = new Set<string>();
  for (const sale of data.directSales) {
    if (
      !isDirectSale(sale) ||
      directSaleIds.has(sale.id) ||
      directSaleKeys.has(sale.idempotencyKey) ||
      directSaleRevisionKeys.has(sale.idempotencyKey) ||
      (sale.revisions ?? []).some(
        revision =>
          revision.idempotencyKey === sale.idempotencyKey ||
          directSaleRevisionKeys.has(revision.idempotencyKey) ||
          directSaleKeys.has(revision.idempotencyKey),
      )
    )
      return false;
    directSaleIds.add(sale.id);
    directSaleKeys.add(sale.idempotencyKey);
    for (const revision of sale.revisions ?? []) directSaleRevisionKeys.add(revision.idempotencyKey);
  }
  const actualTimeRecords = data.actualTimeRecords as unknown[];
  const actualTimeIds = new Set<string>();
  const actualTimeOperationKeys = new Set<string>();
  const reversedActualTimeIds = new Set<string>();
  for (const rawRecord of actualTimeRecords) {
    if (!validActualTimeRecord(rawRecord, orderIds)) return false;
    const record = rawRecord as ActualTimeRecordLike;
    if (actualTimeIds.has(record.id) || actualTimeOperationKeys.has(record.operationKey)) return false;
    if (record.reversalOfId !== null) {
      if (reversedActualTimeIds.has(record.reversalOfId)) return false;
      reversedActualTimeIds.add(record.reversalOfId);
    }
    actualTimeIds.add(record.id);
    actualTimeOperationKeys.add(record.operationKey);
  }
  for (const rawRecord of actualTimeRecords) {
    const record = rawRecord as ActualTimeRecordLike;
    if (record.reversalOfId === null) continue;
    const original = actualTimeRecords.find(
      candidate => isRecord(candidate) && candidate.id === record.reversalOfId,
    ) as ActualTimeRecordLike | undefined;
    if (
      !original ||
      original.reversalOfId !== null ||
      original.orderId !== record.orderId ||
      original.minutesDelta !== -record.minutesDelta ||
      original.minutesDelta <= 0
    )
      return false;
  }
  const draftIds = new Set<string>();
  for (const draft of data.drafts) {
    if (
      !isRecord(draft) ||
      !isString(draft.id) ||
      !(draft.intent === "customer_order" || draft.intent === "planned_design") ||
      !isString(draft.customerName) ||
      !isString(draft.itemName) ||
      !(draft.catalogItemId === null || isString(draft.catalogItemId)) ||
      !isString(draft.specifications) ||
      !isPositiveQuantity(draft.quantity) ||
      !Array.isArray(draft.costSnapshots) ||
      !draft.costSnapshots.every(validDraftCostSnapshot) ||
      !(draft.activeCostSnapshotId === null || isString(draft.activeCostSnapshotId)) ||
      !(draft.linkedOrderId === null || isString(draft.linkedOrderId)) ||
      /* U-004: مرجع التقدير المصدر اختياري — سلسلة أو غائب؛ بلا فحص مرجعي كي لا يُرفض
       * ملف صالح بعد حذف تقدير قديم. */
      !(
        draft.sourceEstimateId === undefined ||
        draft.sourceEstimateId === null ||
        isString(draft.sourceEstimateId)
      ) ||
      !isDate(draft.createdAt) ||
      !isDate(draft.updatedAt)
    )
      return false;
    if (draftIds.has(draft.id) || (isString(draft.linkedOrderId) && !orderIds.has(draft.linkedOrderId)))
      return false;
    draftIds.add(draft.id);
  }
  const scheduleIds = new Set<string>();
  for (const schedule of data.schedules) {
    if (
      !isRecord(schedule) ||
      !isString(schedule.id) ||
      !isString(schedule.orderId) ||
      schedule.kind !== "delivery" ||
      !isString(schedule.scheduledFor) ||
      !(schedule.scheduledTime === null || isScheduleTime(schedule.scheduledTime)) ||
      !(schedule.durationMinutes === null || isScheduleDuration(schedule.durationMinutes)) ||
      (schedule.scheduledTime === null) !== (schedule.durationMinutes === null) ||
      !(schedule.recurrenceId === null || isString(schedule.recurrenceId)) ||
      !(
        schedule.recurrenceIndex === null ||
        (typeof schedule.recurrenceIndex === "number" &&
          Number.isInteger(schedule.recurrenceIndex) &&
          schedule.recurrenceIndex >= 1 &&
          schedule.recurrenceIndex <= 12)
      ) ||
      (schedule.recurrenceId === null) !== (schedule.recurrenceIndex === null) ||
      !isScheduleStatus(schedule.status) ||
      !(schedule.postponeReason === null || isString(schedule.postponeReason)) ||
      !isDate(schedule.createdAt) ||
      !isDate(schedule.updatedAt) ||
      !Array.isArray(schedule.events) ||
      !schedule.events.every(isScheduleEvent) ||
      !orderIds.has(schedule.orderId) ||
      scheduleIds.has(schedule.id)
    )
      return false;
    scheduleIds.add(schedule.id);
  }
  const recurrenceIds = new Set<string>();
  const recurrenceKeys = new Set<string>();
  const appearanceKeys = new Set<string>();
  for (const recurrence of data.recurrences) {
    if (
      !isRecurrence(recurrence) ||
      recurrenceIds.has(recurrence.id) ||
      recurrenceKeys.has(recurrence.idempotencyKey) ||
      !scheduleIds.has(recurrence.sourceScheduleId) ||
      !orderIds.has(recurrence.orderId)
    )
      return false;
    const source = data.schedules.find(schedule => schedule.id === recurrence.sourceScheduleId);
    if (!source || source.orderId !== recurrence.orderId || source.recurrenceId !== null) return false;
    recurrenceIds.add(recurrence.id);
    recurrenceKeys.add(recurrence.idempotencyKey);
  }
  for (const schedule of data.schedules) {
    if (schedule.recurrenceId !== null) {
      if (
        !recurrenceIds.has(schedule.recurrenceId) ||
        appearanceKeys.has(`${schedule.recurrenceId}:${schedule.recurrenceIndex}`)
      )
        return false;
      appearanceKeys.add(`${schedule.recurrenceId}:${schedule.recurrenceIndex}`);
    }
  }
  const financialIds = new Set<string>();
  const financialKeys = new Set<string>();
  const reversedFinancialIds = new Set<string>();
  for (const event of data.financialEvents) {
    if (
      !validFinancialEvent(event) ||
      financialIds.has(event.id) ||
      financialKeys.has(`${event.type}:${event.idempotencyKey}`)
    )
      return false;
    /* المجموعة ٤ (تصحيح مراجعة 4-c): رابط الطلب في سياق تصنيف العربون يشير
     * إلى طلب موجود في الملف نفسه — سلسلة بلا مرجع تُرفض كما تُرفض سلسلة
     * الوقت الفعلي المرتبطة بطلب غائب. */
    if (
      event.depositContext &&
      typeof event.depositContext.orderId === "string" &&
      !orderIds.has(event.depositContext.orderId)
    )
      return false;
    financialIds.add(event.id);
    financialKeys.add(`${event.type}:${event.idempotencyKey}`);
    if (event.correctionType === "reverse") {
      if (reversedFinancialIds.has(event.correctionOfEventId)) return false;
      reversedFinancialIds.add(event.correctionOfEventId);
    }
  }
  for (const event of data.financialEvents) {
    if (event.correctionType !== "reverse") continue;
    const source = data.financialEvents.find(candidate => candidate.id === event.correctionOfEventId);
    if (
      !source ||
      source.correctionType === "reverse" ||
      source.id === event.id ||
      source.type !== event.type ||
      source.amountMinor !== event.amountMinor ||
      source.relatedEventId !== event.relatedEventId ||
      event.cashDeltaMinor !== -source.cashDeltaMinor ||
      event.payableDeltaMinor !== -source.payableDeltaMinor ||
      event.ownerCapitalDeltaMinor !== -source.ownerCapitalDeltaMinor ||
      event.operatingExpenseDeltaMinor !== -source.operatingExpenseDeltaMinor ||
      (event.amanahDeltaMinor ?? 0) !== -(source.amanahDeltaMinor ?? 0) ||
      /* المجموعة ٤ (تصحيح مراجعة 4-c): تراجع أنواع المجموعة ٤ ينفي أعمدتها
       * الثلاث ويحمل سياقه نفسه — التراجع المستورد يطابق ما ينتجه المسار الحي. */
      (event.assetDeltaMinor ?? 0) !== -(source.assetDeltaMinor ?? 0) ||
      (event.loanDeltaMinor ?? 0) !== -(source.loanDeltaMinor ?? 0) ||
      (event.revenueDeltaMinor ?? 0) !== -(source.revenueDeltaMinor ?? 0) ||
      (event.assetContext?.assetId ?? null) !== (source.assetContext?.assetId ?? null) ||
      (event.loanContext?.loanId ?? null) !== (source.loanContext?.loanId ?? null) ||
      (event.depositContext?.orderId ?? null) !== (source.depositContext?.orderId ?? null)
    )
      return false;
  }
  /* المجموعة ١ (فحص سلامة مالي — تعزيز الاستيراد): مجموع الأمانات لا ينزل تحت
   * الصفر إجمالًا — المسار الحي يحرس كل كتابة، والاستيراد اليدوي كان الثغرة.
   * المجموعة ٤ (تصحيح مراجعة 4-c): نفس السياج لأعمدة الأصول والقروض والإيراد —
   * دفتري سالب = إهلاك زائد، قرض سالب = سداد فوق القائم، وإيراد عربون لا يكون سالبًا. */
  if (
    data.financialEvents.reduce((sum, event) => sum + (event.amanahDeltaMinor ?? 0), 0) < 0 ||
    data.financialEvents.reduce((sum, event) => sum + (event.assetDeltaMinor ?? 0), 0) < 0 ||
    data.financialEvents.reduce((sum, event) => sum + (event.loanDeltaMinor ?? 0), 0) < 0 ||
    data.financialEvents.reduce((sum, event) => sum + (event.revenueDeltaMinor ?? 0), 0) < 0
  )
    return false;
  const purchaseIds = new Set<string>();
  const purchaseKeys = new Set<string>();
  for (const purchase of data.supplierPurchases ?? []) {
    if (
      !validSupplierPurchase(purchase) ||
      purchaseIds.has(purchase.id) ||
      purchaseKeys.has(purchase.idempotencyKey)
    )
      return false;
    purchaseIds.add(purchase.id);
    purchaseKeys.add(purchase.idempotencyKey);
  }
  const walletIds = new Set<string>();
  const walletOperationKeys = new Set<string>();
  for (const wallet of data.cashWallets ?? []) {
    if (
      !validCashWallet(wallet) ||
      walletIds.has(wallet.id) ||
      walletOperationKeys.has(wallet.createdOperationKey)
    )
      return false;
    walletIds.add(wallet.id);
    walletOperationKeys.add(wallet.createdOperationKey);
  }
  const entryIds = new Set<string>();
  const reversedIds = new Set<string>();
  const transferGroups = new Map<string, Record<string, unknown>[]>();
  /* المجموعة ١ (إصلاح عيب سابق): مفتاح العملية قد يكتب زوجًا مقترنًا واحدًا —
   * تحويل (خارج/داخل بمعرف تحويل واحد) أو عكس تحويل (تراجعان بمعرف واحد)؛
   * وحدة الإيداع واحدة والمفتاح واحد. التفرد يُطبق على الوحدات لا الأسطر:
   * أي تكرار خارج هذين الزوجين الموثقين = ملف غير صالح. */
  const entriesByOperationKey = new Map<string, Record<string, unknown>[]>();
  for (const entry of data.cashContinuityEntries ?? []) {
    if (!validCashEntry(entry) || entryIds.has(entry.id) || !walletIds.has(entry.walletId)) return false;
    entryIds.add(entry.id);
    entriesByOperationKey.set(entry.operationKey, [
      ...(entriesByOperationKey.get(entry.operationKey) ?? []),
      entry,
    ]);
    if (entry.type === "reversal") {
      if (reversedIds.has(entry.reversesEntryId)) return false;
      reversedIds.add(entry.reversesEntryId);
    }
    /* المجموعة ١ (إصلاح عيب سابق): عكس التحويل يحمل transferId خاصًّا به (زوج تراجع
     * لا نقل) — لا يدخل مجموعات التحويل وإلا فشل كل ملف فيه تحويل معكوس. */
    if (isString(entry.transferId) && entry.type !== "reversal")
      transferGroups.set(entry.transferId, [...(transferGroups.get(entry.transferId) ?? []), entry]);
  }
  for (const group of entriesByOperationKey.values()) {
    if (group.length === 1) continue;
    const sameTransfer =
      group.length === 2 &&
      group.every(
        entry =>
          isString(entry.transferId) &&
          entry.transferId === (group[0] as { transferId?: unknown }).transferId,
      );
    const isTransferPair =
      sameTransfer &&
      group.some(entry => entry.type === "transfer_out") &&
      group.some(entry => entry.type === "transfer_in");
    const isReversalPair = sameTransfer && group.every(entry => entry.type === "reversal");
    if (!isTransferPair && !isReversalPair) return false;
  }
  for (const entry of data.cashContinuityEntries ?? []) {
    if (entry.type === "reversal") {
      const original = (data.cashContinuityEntries ?? []).find(
        candidate => candidate.id === entry.reversesEntryId,
      );
      /* SA-5 (4): التراجع عن تراجع غير مشروع في المسار الحي — يُرفض هنا أيضًا؛
       * لا تُقبل أزواج مراجعة متبادلة مصنوعة يدويًا. */
      if (!original || original.type === "reversal" || entry.cashDeltaMinor !== -original.cashDeltaMinor)
        return false;
    }
  }
  for (const group of transferGroups.values()) {
    if (
      group.length !== 2 ||
      group.reduce((sum, entry) => sum + (entry.cashDeltaMinor as number), 0) !== 0 ||
      !group.some(entry => entry.type === "transfer_out") ||
      !group.some(entry => entry.type === "transfer_in") ||
      group.some(entry => entry.type === "transfer_out" && (entry.cashDeltaMinor as number) > 0) ||
      group.some(entry => entry.type === "transfer_in" && (entry.cashDeltaMinor as number) < 0)
    )
      return false;
  }
  const materialIds = new Set<string>();
  const materialKeys = new Set<string>();
  for (const material of data.materials) {
    if (
      !validMaterial(material) ||
      materialIds.has(material.id) ||
      materialKeys.has(material.createdOperationKey)
    )
      return false;
    materialIds.add(material.id);
    materialKeys.add(material.createdOperationKey);
  }
  const inventoryIds = new Set<string>();
  const inventoryKeys = new Set<string>();
  const reversedInventoryIds = new Set<string>();
  for (const movement of data.inventoryMovements) {
    if (
      !validInventoryMovement(movement) ||
      inventoryIds.has(movement.id) ||
      inventoryKeys.has(movement.operationKey) ||
      !materialIds.has(movement.materialId)
    )
      return false;
    if (movement.purchaseId !== null && !purchaseIds.has(movement.purchaseId)) return false;
    if (movement.orderId !== null && !orderIds.has(movement.orderId)) return false;
    if (movement.type === "reversal") {
      if (reversedInventoryIds.has(movement.reversesMovementId)) return false;
      reversedInventoryIds.add(movement.reversesMovementId);
    }
    inventoryIds.add(movement.id);
    inventoryKeys.add(movement.operationKey);
  }
  for (const movement of data.inventoryMovements) {
    if (movement.type === "reversal") {
      const target = data.inventoryMovements.find(candidate => candidate.id === movement.reversesMovementId);
      if (
        !target ||
        target.materialId !== movement.materialId ||
        target.quantityDeltaMilli !== -movement.quantityDeltaMilli ||
        target.valueDeltaMinor !== -movement.valueDeltaMinor
      )
        return false;
      /* المجموعة ٢ (عقد ٢٨): مرآة معرفة التكلفة — التراجع عن حركة موسومة «غير
       * معروفة» يحمل الوسم نفسه، وإلا فالملف غير صادق. */
      const targetKnowledge = (target as { costKnowledge?: string | null }).costKnowledge ?? "known";
      const reversalKnowledge = (movement as { costKnowledge?: string | null }).costKnowledge ?? "known";
      if (targetKnowledge !== reversalKnowledge) return false;
    }
  }
  /* المجموعة ٢ (عقد ٢٨): طيّ غير سالب لكل مادة — الاستيراد قوي كالكتابة لا أضعف.
   * (ثغرة سابقة: الكتابة تحرسها السياسة والاستيراد لم يكن يفحص الطيّ.) */
  for (const materialId of materialIds) {
    const fold = data.inventoryMovements.reduce(
      (sum, movement) => (movement.materialId === materialId ? sum + movement.quantityDeltaMilli : sum),
      0,
    );
    const valueFold = data.inventoryMovements.reduce(
      (sum, movement) => (movement.materialId === materialId ? sum + movement.valueDeltaMinor : sum),
      0,
    );
    if (fold < 0 || valueFold < 0) return false;
  }
  /* المجموعة ٢ (عقد ٢٨ / D-027): سجلات النقص — شكل + مفاتيح فريدة + مادة موجودة. */
  const shortageIds = new Set<string>();
  const shortageKeys = new Set<string>();
  for (const shortage of data.inventoryShortages ?? []) {
    if (
      !validInventoryShortage(shortage) ||
      shortageIds.has(shortage.id) ||
      shortageKeys.has(shortage.operationKey) ||
      !materialIds.has(shortage.materialId)
    )
      return false;
    if (shortage.orderId !== null && !orderIds.has(shortage.orderId)) return false;
    shortageIds.add(shortage.id);
    shortageKeys.add(shortage.operationKey);
  }
  /* المجموعة ٢ (عقد ٢٨): ربط الشراء بمادة — إن وُجد فالمادة موجودة فعلًا. */
  for (const purchase of data.supplierPurchases ?? []) {
    if (
      purchase.materialId !== null &&
      purchase.materialId !== undefined &&
      !materialIds.has(purchase.materialId)
    )
      return false;
  }
  const catalogIds = new Set<string>();
  const catalogKeys = new Set<string>();
  const activeCatalogNames = new Set<string>();
  for (const item of data.catalogItems) {
    if (!validCatalogItem(item) || catalogIds.has(item.id) || catalogKeys.has(item.createdOperationKey))
      return false;
    const key = `${item.kind}:${item.name.trim().replace(/\s+/g, " ").toLocaleLowerCase("ar-JO")}`;
    if (item.active && activeCatalogNames.has(key)) return false;
    catalogIds.add(item.id);
    catalogKeys.add(item.createdOperationKey);
    if (item.active) activeCatalogNames.add(key);
  }
  for (const stored of data.orders) {
    if (isString(stored.catalogItemId) && !catalogIds.has(stored.catalogItemId)) return false;
  }
  for (const draft of data.drafts) {
    if (isString(draft.catalogItemId) && !catalogIds.has(draft.catalogItemId)) return false;
  }
  const unitIds = new Set<string>();
  const unitKeys = new Set<string>();
  const activeUnitNames = new Set<string>();
  for (const unit of data.measurementUnits) {
    if (!validMeasurementUnit(unit) || unitIds.has(unit.id) || unitKeys.has(unit.createdOperationKey))
      return false;
    const nameKey = `${unit.dimension}:${unit.nameAr.trim().replace(/\s+/g, " ").toLocaleLowerCase("ar-JO")}`;
    if (unit.active && activeUnitNames.has(nameKey)) return false;
    unitIds.add(unit.id);
    unitKeys.add(unit.createdOperationKey);
    if (unit.active) activeUnitNames.add(nameKey);
  }
  for (const item of data.catalogItems) {
    if (isString(item.unitId) && !unitIds.has(item.unitId)) return false;
  }
  const conversionIds = new Set<string>();
  const conversionKeys = new Set<string>();
  const activeConversionPairs = new Set<string>();
  const conversionPairs = new Set<string>();
  for (const conversion of data.directConversions) {
    if (
      !validDirectConversion(conversion, unitIds, data.measurementUnits.filter(isRecord)) ||
      conversionIds.has(conversion.id) ||
      conversionKeys.has(conversion.createdOperationKey)
    )
      return false;
    const pair = `${conversion.fromUnitId}:${conversion.toUnitId}`;
    if (conversion.active && activeConversionPairs.has(pair)) return false;
    conversionIds.add(conversion.id);
    conversionKeys.add(conversion.createdOperationKey);
    conversionPairs.add(pair);
    if (conversion.active) activeConversionPairs.add(pair);
  }
  const templateIds = new Set<string>();
  const templateKeys = new Set<string>();
  const activeTemplateItems = new Set<string>();
  for (const template of data.catalogTemplates) {
    if (
      !validCatalogTemplate(template, catalogIds, unitIds) ||
      templateIds.has(template.id) ||
      templateKeys.has(template.createdOperationKey)
    )
      return false;
    templateIds.add(template.id);
    templateKeys.add(template.createdOperationKey);
  }
  for (const template of data.catalogTemplates) {
    if (template.active && activeTemplateItems.has(template.catalogItemId)) return false;
    if (template.sourceTemplateId !== null) {
      const source = data.catalogTemplates.find(
        candidate => isRecord(candidate) && candidate.id === template.sourceTemplateId,
      );
      if (
        !source ||
        source.catalogItemId !== template.catalogItemId ||
        source.revision + 1 !== template.revision ||
        source.active
      )
        return false;
    }
    if (template.active) activeTemplateItems.add(template.catalogItemId);
    const item = data.catalogItems.find(
      candidate => isRecord(candidate) && candidate.id === template.catalogItemId,
    );
    const itemUnit =
      item && isString(item.unitId)
        ? data.measurementUnits.find(candidate => isRecord(candidate) && candidate.id === item.unitId)
        : undefined;
    const outputUnit = template.yield
      ? data.measurementUnits.find(
          candidate => isRecord(candidate) && candidate.id === template.yield?.unitId,
        )
      : undefined;
    if (template.yield === null) {
      if (template.yieldReadiness !== "not_configured") return false;
    } else if (!itemUnit) {
      if (template.yieldReadiness !== "ready") return false;
    } else if (!outputUnit || itemUnit.dimension !== outputUnit.dimension) {
      return false;
    } else if (itemUnit.id === outputUnit.id) {
      if (template.yieldReadiness !== "ready") return false;
    } else if (
      template.yieldReadiness === "ready" &&
      !conversionPairs.has(`${outputUnit.id}:${itemUnit.id}`)
    ) {
      return false;
    }
  }
  for (const movement of data.inventoryMovements) {
    if (movement.type !== "waste" || !isRecord(movement.wasteContext)) continue;
    const context = movement.wasteContext;
    if (context.kind === "order" && !orderIds.has(context.orderId as string)) return false;
    if (context.kind === "catalog_item" && !catalogIds.has(context.catalogItemId as string)) return false;
    if (
      context.kind === "catalog_template" &&
      (!catalogIds.has(context.catalogItemId as string) || !templateIds.has(context.templateId as string))
    )
      return false;
    if (context.kind === "catalog_template") {
      const template = data.catalogTemplates.find(candidate => candidate.id === context.templateId);
      if (!template || template.catalogItemId !== context.catalogItemId) return false;
    }
  }
  const allocationPolicies = (data.allocationPolicies ?? []) as readonly AllocationPolicy[];
  const allocationIds = new Set<string>();
  const allocationKeys = new Set<string>();
  const allocationSuccessors = new Set<string>();
  for (const policy of allocationPolicies) {
    if (
      !isValidAllocationPolicy(policy) ||
      allocationIds.has(policy.id) ||
      allocationKeys.has(policy.idempotencyKey) ||
      !catalogIds.has(policy.catalogItemId) ||
      (policy.kind === "per_output_unit" && (!policy.unitId || !unitIds.has(policy.unitId)))
    )
      return false;
    allocationIds.add(policy.id);
    allocationKeys.add(policy.idempotencyKey);
  }
  for (const policy of allocationPolicies) {
    if (policy.successorOfPolicyId !== null) {
      const previous = allocationPolicies.find(candidate => candidate.id === policy.successorOfPolicyId);
      if (
        !previous ||
        previous.seriesId !== policy.seriesId ||
        previous.version + 1 !== policy.version ||
        previous.status !== "inactive" ||
        previous.endsOn === null ||
        previous.endsOn >= policy.startsOn ||
        allocationSuccessors.has(previous.id)
      )
        return false;
      allocationSuccessors.add(previous.id);
    }
  }
  const activeAllocationPolicies = allocationPolicies.filter(policy => policy.status === "active");
  for (let index = 0; index < activeAllocationPolicies.length; index += 1)
    for (let otherIndex = index + 1; otherIndex < activeAllocationPolicies.length; otherIndex += 1) {
      const left = activeAllocationPolicies[index]!;
      const right = activeAllocationPolicies[otherIndex]!;
      if (
        left.catalogItemId === right.catalogItemId &&
        rangesOverlap(left.periodFrom, left.periodTo, right.periodFrom, right.periodTo)
      )
        return false;
    }
  const declarationIds = new Set<string>();
  const declarationKeys = new Set<string>();
  const reversedDeclarationIds = new Set<string>();
  for (const declaration of data.shortCashDeclarations) {
    if (
      !validShortCashDeclaration(declaration) ||
      declarationIds.has(declaration.id) ||
      declarationKeys.has(`${declaration.kind}:${declaration.idempotencyKey}`)
    )
      return false;
    if (declaration.relatedOrderId !== null && !orderIds.has(declaration.relatedOrderId)) return false;
    if (declaration.relatedEventId !== null) {
      const related = data.financialEvents.find(candidate => candidate.id === declaration.relatedEventId);
      if (!related || related.type !== "operating_expense_payable") return false;
    }
    declarationIds.add(declaration.id);
    declarationKeys.add(`${declaration.kind}:${declaration.idempotencyKey}`);
    if (declaration.kind === "reversal") {
      if (reversedDeclarationIds.has(declaration.reversalOfId)) return false;
      reversedDeclarationIds.add(declaration.reversalOfId);
    }
  }
  for (const declaration of data.shortCashDeclarations) {
    if (declaration.kind === "reversal") {
      const original = data.shortCashDeclarations.find(
        candidate => candidate.id === declaration.reversalOfId,
      );
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
        return false;
    }
  }
  const ownerEntitlementPolicies = (
    Array.isArray(data.ownerEntitlementPolicies) ? data.ownerEntitlementPolicies : []
  ) as readonly OwnerEntitlementPolicy[];
  const ownerEntitlementRecords = (
    Array.isArray(data.ownerEntitlementRecords) ? data.ownerEntitlementRecords : []
  ) as readonly OwnerEntitlementRecord[];
  const ownerEntitlementOpeningBalances = (
    Array.isArray(data.ownerEntitlementOpeningBalances) ? data.ownerEntitlementOpeningBalances : []
  ) as readonly OwnerEntitlementOpeningBalance[];
  const ownerMovements = (
    Array.isArray(data.ownerMovements) ? data.ownerMovements : []
  ) as readonly OwnerMovement[];
  const policyIds = new Set<string>();
  const policyKeys = new Set<string>();
  const policyVersions = new Set<string>();
  const successorTargets = new Set<string>();
  for (const policy of ownerEntitlementPolicies) {
    if (
      !isValidOwnerEntitlementPolicy(policy) ||
      policyIds.has(policy.id) ||
      policyKeys.has(policy.idempotencyKey) ||
      policyVersions.has(`${policy.seriesId}:${policy.version}`)
    )
      return false;
    policyIds.add(policy.id);
    policyKeys.add(policy.idempotencyKey);
    policyVersions.add(`${policy.seriesId}:${policy.version}`);
  }
  for (const policy of ownerEntitlementPolicies) {
    if (policy.successorOfPolicyId !== null) {
      const previous = ownerEntitlementPolicies.find(
        candidate => candidate.id === policy.successorOfPolicyId,
      );
      if (
        !previous ||
        previous.id === policy.id ||
        previous.seriesId !== policy.seriesId ||
        previous.version + 1 !== policy.version ||
        previous.status !== "ended" ||
        previous.endsOn === null ||
        previous.endsOn >= policy.startsOn ||
        successorTargets.has(previous.id)
      )
        return false;
      successorTargets.add(previous.id);
    }
  }
  const activePolicies = ownerEntitlementPolicies.filter(policy => policy.status === "active");
  for (const left of activePolicies)
    for (const right of activePolicies)
      if (
        left.id !== right.id &&
        left.seriesId === right.seriesId &&
        rangesOverlap(left.startsOn, left.endsOn, right.startsOn, right.endsOn)
      )
        return false;
  const entitlementIds = new Set<string>();
  const entitlementKeys = new Set<string>();
  const reversedEntitlementIds = new Set<string>();
  for (const record of ownerEntitlementRecords) {
    if (
      !isValidOwnerEntitlementRecord(record) ||
      entitlementIds.has(record.id) ||
      entitlementKeys.has(record.idempotencyKey) ||
      !policyIds.has(record.policyId)
    )
      return false;
    const policy = ownerEntitlementPolicies.find(candidate => candidate.id === record.policyId);
    if (!policy || policy.version !== record.policyVersion) return false;
    if (record.reversalOfId !== null) {
      if (reversedEntitlementIds.has(record.reversalOfId)) return false;
      reversedEntitlementIds.add(record.reversalOfId);
    }
    entitlementIds.add(record.id);
    entitlementKeys.add(record.idempotencyKey);
  }
  for (const record of ownerEntitlementRecords) {
    if (record.reversalOfId !== null) {
      const source = ownerEntitlementRecords.find(candidate => candidate.id === record.reversalOfId);
      if (
        !source ||
        source.reversalOfId !== null ||
        source.policyId !== record.policyId ||
        source.policyVersion !== record.policyVersion ||
        source.amountMinor !== record.amountMinor ||
        source.periodFrom !== record.periodFrom ||
        source.periodTo !== record.periodTo ||
        source.calculationBasis !== record.calculationBasis ||
        source.baseMinor !== record.baseMinor ||
        source.quantity !== record.quantity ||
        source.sourceKeys.join("|") !== record.sourceKeys.join("|")
      )
        return false;
    }
  }
  const activeEntitlements = ownerEntitlementRecords.filter(
    record => record.reversalOfId === null && !reversedEntitlementIds.has(record.id),
  );
  for (let index = 0; index < activeEntitlements.length; index += 1)
    for (let otherIndex = index + 1; otherIndex < activeEntitlements.length; otherIndex += 1) {
      const left = activeEntitlements[index]!;
      const right = activeEntitlements[otherIndex]!;
      if (left.policyId !== right.policyId || left.policyVersion !== right.policyVersion) continue;
      const policy = ownerEntitlementPolicies.find(candidate => candidate.id === left.policyId);
      if (!policy) return false;
      if (
        left.sourceKeys.some(key => right.sourceKeys.includes(key)) ||
        (["monthly", "weekly", "daily", "fixed_period", "profit_share"].includes(policy.kind) &&
          rangesOverlap(left.periodFrom, left.periodTo, right.periodFrom, right.periodTo))
      )
        return false;
    }
  const openingIds = new Set<string>();
  const openingKeys = new Set<string>();
  const reversedOpeningIds = new Set<string>();
  for (const balance of ownerEntitlementOpeningBalances) {
    if (
      !isValidOwnerEntitlementOpeningBalance(balance) ||
      openingIds.has(balance.id) ||
      openingKeys.has(balance.idempotencyKey)
    )
      return false;
    if (balance.reversalOfId !== null) {
      if (reversedOpeningIds.has(balance.reversalOfId)) return false;
      reversedOpeningIds.add(balance.reversalOfId);
    }
    openingIds.add(balance.id);
    openingKeys.add(balance.idempotencyKey);
  }
  for (const balance of ownerEntitlementOpeningBalances) {
    if (balance.reversalOfId !== null) {
      const source = ownerEntitlementOpeningBalances.find(candidate => candidate.id === balance.reversalOfId);
      if (
        !source ||
        source.reversalOfId !== null ||
        source.amountMinor !== balance.amountMinor ||
        source.reason !== balance.reason
      )
        return false;
    }
  }
  if (
    ownerEntitlementOpeningBalances.filter(
      balance => balance.reversalOfId === null && !reversedOpeningIds.has(balance.id),
    ).length > 1
  )
    return false;
  const activeOpeningIds = new Set(
    ownerEntitlementOpeningBalances
      .filter(balance => balance.reversalOfId === null && !reversedOpeningIds.has(balance.id))
      .map(balance => balance.id),
  );
  const ownerMovementReferenceIds = new Set(ownerMovements.map(movement => movement.id));
  const ownerMovementIds = new Set<string>();
  const ownerMovementKeys = new Set<string>();
  const ownerReversalIds = new Set<string>();
  for (const movement of ownerMovements) {
    if (
      !isValidOwnerMovement(movement) ||
      ownerMovementIds.has(movement.id) ||
      ownerMovementKeys.has(movement.idempotencyKey) ||
      !walletIds.has(movement.walletId)
    )
      return false;
    if (
      movement.relatedEntitlementId !== null &&
      (!entitlementIds.has(movement.relatedEntitlementId) ||
        !activeEntitlements.some(record => record.id === movement.relatedEntitlementId))
    )
      return false;
    if (
      movement.relatedOpeningBalanceId !== null &&
      (!openingIds.has(movement.relatedOpeningBalanceId) ||
        !activeOpeningIds.has(movement.relatedOpeningBalanceId) ||
        movement.relatedEntitlementId !== null ||
        movement.relatedMovementId !== null)
    )
      return false;
    if (movement.relatedMovementId !== null) {
      const source = ownerMovements.find(candidate => candidate.id === movement.relatedMovementId);
      if (
        !source ||
        source.kind !== "draw" ||
        source.reversalOfId !== null ||
        ownerMovements.some(candidate => candidate.reversalOfId === source.id)
      )
        return false;
    }
    if (movement.reversalOfId !== null) {
      if (ownerReversalIds.has(movement.reversalOfId)) return false;
      ownerReversalIds.add(movement.reversalOfId);
    }
    const cashEntry = (data.cashContinuityEntries ?? []).find(
      entry => entry.operationKey === `owner-movement:${movement.idempotencyKey}`,
    );
    if (
      !cashEntry ||
      cashEntry.walletId !== movement.walletId ||
      cashEntry.cashDeltaMinor !== movement.cashDeltaMinor ||
      cashEntry.type !== "cash_adjustment"
    )
      return false;
    ownerMovementIds.add(movement.id);
    ownerMovementKeys.add(movement.idempotencyKey);
  }
  for (const movement of ownerMovements) {
    if (movement.reversalOfId !== null) {
      const source = ownerMovements.find(candidate => candidate.id === movement.reversalOfId);
      if (
        !source ||
        source.reversalOfId !== null ||
        source.kind !== movement.kind ||
        source.amountMinor !== movement.amountMinor ||
        source.walletId !== movement.walletId ||
        source.relatedEntitlementId !== movement.relatedEntitlementId ||
        source.relatedOpeningBalanceId !== movement.relatedOpeningBalanceId ||
        source.relatedMovementId !== movement.relatedMovementId ||
        movement.cashDeltaMinor !== -source.cashDeltaMinor ||
        movement.entitlementDeltaMinor !== -source.entitlementDeltaMinor ||
        movement.openingBalanceDeltaMinor !== -source.openingBalanceDeltaMinor ||
        movement.ownerCapitalDeltaMinor !== -source.ownerCapitalDeltaMinor
      )
        return false;
    }
  }
  for (const balance of ownerEntitlementOpeningBalances.filter(
    value => value.reversalOfId === null && !reversedOpeningIds.has(value.id),
  )) {
    const settled = ownerMovements
      .filter(movement => movement.relatedOpeningBalanceId === balance.id)
      .reduce((sum, movement) => sum + movement.openingBalanceDeltaMinor, 0);
    if (
      Math.abs(settled) > Math.abs(balance.amountMinor) ||
      (balance.amountMinor > 0 && settled > 0) ||
      (balance.amountMinor < 0 && settled < 0)
    )
      return false;
  }
  /* تقديرات التكلفة المستقلة: سجلات أدوات بلا أثر مالي — هوية فريدة وشكل سليم فقط. */
  const costEstimateIds = new Set<string>();
  for (const estimate of data.costEstimates ?? []) {
    if (!validCostEstimate(estimate) || costEstimateIds.has(estimate.id)) return false;
    costEstimateIds.add(estimate.id);
  }
  /* المجموعة ٤ (عقد ٢٩): الأصول والقروض — هوية فريدة وشكل سليم وربط أحداث
   * موجود فعلًا؛ سجل بلا حدثه المالي ملف مكسور يُرفض بصراحة لا يُستورد. */
  const eventIds = new Set(data.financialEvents.map(event => event.id));
  const assetIds = new Set<string>();
  for (const asset of data.assets ?? []) {
    if (!validAssetRecord(asset) || assetIds.has(asset.id)) return false;
    assetIds.add(asset.id);
    if (!eventIds.has(asset.acquisitionEventId)) return false;
    if (asset.disposal && !eventIds.has(asset.disposal.eventId)) return false;
    if (asset.writeOff && !eventIds.has(asset.writeOff.eventId)) return false;
  }
  const loanIds = new Set<string>();
  for (const loan of data.loans ?? []) {
    if (!validLoanRecord(loan) || loanIds.has(loan.id)) return false;
    loanIds.add(loan.id);
    if (!eventIds.has(loan.principalEventId)) return false;
    for (const repayment of loan.repayments) {
      if (!eventIds.has(repayment.eventId)) return false;
      if (repayment.reversal && !eventIds.has(repayment.reversal.reversalEventId)) return false;
    }
  }
  /* المجموعة ٦ (تدقيق A2 — AI-01): اكتمال عقد العائلة بالاتجاهين — حدث
   * بسياق أصل/قرض يشترط سجل مالكه في الملف نفسه، كما يشترط سياق عربون
   * الطلب طلبًا موجودًا (فحص 4-c أعلاه). الملف المعبوث به أو المدموج يدويًا
   * الذي يهرّب حدثًا يتيمًا كان يُستورد فيدخل دفاتره أثر لا سجل له، ولا
   * سبيل لتصحيحه لاحقًا (حارس العائلة يمنع التصحيح العام ووصلته تقود لصفحة
   * غير موجودة). الآن يُرفض قبل أي معاينة كما تُرفض البصمة المكسورة. */
  for (const event of data.financialEvents) {
    if (event.assetContext && !assetIds.has(event.assetContext.assetId)) return false;
    if (event.loanContext && !loanIds.has(event.loanContext.loanId)) return false;
  }
  return true;
}
