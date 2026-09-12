/** IndexedDB schema upgrade ("migrations"): store creation plus version-gated record
 * normalization, extracted verbatim from the adapter (Group 10, Phase 10-B). Ordering,
 * oldVersion gates, idempotency, and record transformations are unchanged; the upgrade
 * error bookkeeping (StorageOpenError/upgradeErrors/guardUpgradeCursor) lives here so
 * the lifecycle module can import it without a cycle.
 */
import { localSchemaVersion, type OrderDraft, type ScheduleEntry, type StorageFailureCode } from "./types";
import {
  actualTimeStore,
  allocationPolicyStore,
  assetStore,
  catalogItemStore,
  catalogTemplateStore,
  cashContinuityEntryStore,
  cashWalletStore,
  costEstimateStore,
  directConversionStore,
  directSaleStore,
  draftStore,
  financialEventStore,
  formDraftStore,
  inventoryActivationStore,
  inventoryMovementStore,
  inventoryShortageStore,
  loanStore,
  materialStore,
  measurementUnitStore,
  orderStore,
  ownerEntitlementOpeningBalanceStore,
  ownerEntitlementPolicyStore,
  ownerEntitlementRecordStore,
  ownerMovementStore,
  ownerProfileStore,
  preferencesStore,
  profileStore,
  recurrenceStore,
  scheduleStore,
  securityStore,
  shortCashDeclarationStore,
  supplierPurchaseStore,
} from "./indexedDbStores";

export class StorageOpenError extends Error {
  constructor(
    readonly code: Extract<
      StorageFailureCode,
      "storage_upgrade_failed" | "storage_blocked" | "storage_stale"
    >,
    message: string,
  ) {
    super(message);
    this.name = "StorageOpenError";
  }
}

export const staleConnections = new WeakSet<IDBDatabase>();
export const upgradeErrors = new WeakMap<IDBOpenDBRequest, StorageOpenError>();

function guardUpgradeCursor(
  cursor: IDBRequest<IDBCursorWithValue | null>,
  request: IDBOpenDBRequest,
  label: string,
): IDBRequest<IDBCursorWithValue | null> {
  cursor.onerror = () => {
    let cause = "سبب غير معروف";
    try {
      const cursorError = cursor.error;
      if (cursorError) cause = cursorError.message;
    } catch {
      // Some test doubles expose the error only while the request is active.
    }
    upgradeErrors.set(
      request,
      new StorageOpenError(
        "storage_upgrade_failed",
        `تعذر ترقية التخزين المحلي أثناء ترحيل ${label}: ${cause}. أغلق النسخ الأخرى ثم أعد المحاولة.`,
      ),
    );
    try {
      request.transaction?.abort();
    } catch {
      // The upgrade transaction may already be aborting.
    }
  };
  return cursor;
}

export function applySchemaUpgrade(request: IDBOpenDBRequest, event: IDBVersionChangeEvent): void {
  const database = request.result;
  if (!database.objectStoreNames.contains(profileStore))
    database.createObjectStore(profileStore, { keyPath: "id" });
  if (!database.objectStoreNames.contains(ownerProfileStore))
    database.createObjectStore(ownerProfileStore, { keyPath: "id" });
  if (!database.objectStoreNames.contains(preferencesStore))
    database.createObjectStore(preferencesStore, { keyPath: "id" });
  if (!database.objectStoreNames.contains(draftStore)) {
    const drafts = database.createObjectStore(draftStore, { keyPath: "id" });
    drafts.createIndex("updatedAt", "updatedAt");
  }
  if (!database.objectStoreNames.contains(orderStore)) {
    const orders = database.createObjectStore(orderStore, { keyPath: "id" });
    orders.createIndex("updatedAt", "updatedAt");
  }
  if (!database.objectStoreNames.contains(directSaleStore)) {
    const sales = database.createObjectStore(directSaleStore, { keyPath: "id" });
    sales.createIndex("occurredOn", "occurredOn");
    sales.createIndex("recordedAt", "recordedAt");
    sales.createIndex("idempotencyKey", "idempotencyKey", { unique: true });
  }
  if (!database.objectStoreNames.contains(scheduleStore)) {
    const schedules = database.createObjectStore(scheduleStore, { keyPath: "id" });
    schedules.createIndex("scheduledFor", "scheduledFor");
    schedules.createIndex("orderId", "orderId");
  }
  if (!database.objectStoreNames.contains(recurrenceStore)) {
    const recurrences = database.createObjectStore(recurrenceStore, { keyPath: "id" });
    recurrences.createIndex("sourceScheduleId", "sourceScheduleId");
    recurrences.createIndex("orderId", "orderId");
    recurrences.createIndex("status", "status");
    recurrences.createIndex("createdAt", "createdAt");
  }
  if (!database.objectStoreNames.contains(financialEventStore)) {
    const events = database.createObjectStore(financialEventStore, { keyPath: "id" });
    events.createIndex("recordedAt", "recordedAt");
    events.createIndex("occurredOn", "occurredOn");
  }
  if (!database.objectStoreNames.contains(supplierPurchaseStore)) {
    const purchases = database.createObjectStore(supplierPurchaseStore, { keyPath: "id" });
    purchases.createIndex("purchasedOn", "purchasedOn");
    purchases.createIndex("supplierName", "supplierName");
  }
  if (!database.objectStoreNames.contains(cashWalletStore))
    database.createObjectStore(cashWalletStore, { keyPath: "id" });
  if (!database.objectStoreNames.contains(cashContinuityEntryStore)) {
    const entries = database.createObjectStore(cashContinuityEntryStore, { keyPath: "id" });
    entries.createIndex("walletId", "walletId");
    entries.createIndex("occurredOn", "occurredOn");
    entries.createIndex("operationKey", "operationKey");
    entries.createIndex("transferId", "transferId");
  }
  if (!database.objectStoreNames.contains(materialStore))
    database.createObjectStore(materialStore, { keyPath: "id" });
  if (!database.objectStoreNames.contains(inventoryMovementStore)) {
    const movements = database.createObjectStore(inventoryMovementStore, { keyPath: "id" });
    movements.createIndex("materialId", "materialId");
    movements.createIndex("occurredOn", "occurredOn");
    movements.createIndex("operationKey", "operationKey");
    movements.createIndex("purchaseId", "purchaseId");
    movements.createIndex("orderId", "orderId");
  }
  if (!database.objectStoreNames.contains(inventoryActivationStore))
    database.createObjectStore(inventoryActivationStore, { keyPath: "id" });
  /* المجموعة ٢ (عقد ٢٨ / D-027): سجلات النقص — محمية بفحص وجود فلا تعاد إنشاؤها. */
  if (!database.objectStoreNames.contains(inventoryShortageStore)) {
    const shortages = database.createObjectStore(inventoryShortageStore, { keyPath: "id" });
    shortages.createIndex("materialId", "materialId");
    shortages.createIndex("operationKey", "operationKey");
    shortages.createIndex("status", "status");
  }
  if (!database.objectStoreNames.contains(catalogItemStore)) {
    const catalogItems = database.createObjectStore(catalogItemStore, { keyPath: "id" });
    catalogItems.createIndex("active", "active");
    catalogItems.createIndex("createdOperationKey", "createdOperationKey");
  }
  if (!database.objectStoreNames.contains(measurementUnitStore)) {
    const units = database.createObjectStore(measurementUnitStore, { keyPath: "id" });
    units.createIndex("dimension", "dimension");
    units.createIndex("active", "active");
    units.createIndex("createdOperationKey", "createdOperationKey");
  }
  if (!database.objectStoreNames.contains(directConversionStore)) {
    const conversions = database.createObjectStore(directConversionStore, { keyPath: "id" });
    conversions.createIndex("fromUnitId", "fromUnitId");
    conversions.createIndex("toUnitId", "toUnitId");
    conversions.createIndex("active", "active");
    conversions.createIndex("createdOperationKey", "createdOperationKey");
  }
  if (!database.objectStoreNames.contains(catalogTemplateStore)) {
    const templates = database.createObjectStore(catalogTemplateStore, { keyPath: "id" });
    templates.createIndex("catalogItemId", "catalogItemId");
    templates.createIndex("active", "active");
    templates.createIndex("createdOperationKey", "createdOperationKey");
  }
  if (!database.objectStoreNames.contains(actualTimeStore)) {
    const records = database.createObjectStore(actualTimeStore, { keyPath: "id" });
    records.createIndex("orderId", "orderId");
    records.createIndex("recordedOn", "recordedOn");
    records.createIndex("operationKey", "operationKey");
    records.createIndex("reversalOfId", "reversalOfId");
  }
  if (!database.objectStoreNames.contains(shortCashDeclarationStore)) {
    const declarations = database.createObjectStore(shortCashDeclarationStore, { keyPath: "id" });
    declarations.createIndex("dueOn", "dueOn");
    declarations.createIndex("createdAt", "createdAt");
    declarations.createIndex("idempotencyKey", "idempotencyKey");
    declarations.createIndex("reversalOfId", "reversalOfId");
  }
  if (!database.objectStoreNames.contains(ownerEntitlementPolicyStore)) {
    const policies = database.createObjectStore(ownerEntitlementPolicyStore, { keyPath: "id" });
    policies.createIndex("startsOn", "startsOn");
    policies.createIndex("status", "status");
    policies.createIndex("idempotencyKey", "idempotencyKey");
  }
  if (!database.objectStoreNames.contains(ownerEntitlementRecordStore)) {
    const records = database.createObjectStore(ownerEntitlementRecordStore, { keyPath: "id" });
    records.createIndex("occurredOn", "occurredOn");
    records.createIndex("policyId", "policyId");
    records.createIndex("idempotencyKey", "idempotencyKey");
  }
  if (!database.objectStoreNames.contains(ownerEntitlementOpeningBalanceStore)) {
    const balances = database.createObjectStore(ownerEntitlementOpeningBalanceStore, { keyPath: "id" });
    balances.createIndex("occurredOn", "occurredOn");
    balances.createIndex("idempotencyKey", "idempotencyKey");
  }
  if (!database.objectStoreNames.contains(ownerMovementStore)) {
    const movements = database.createObjectStore(ownerMovementStore, { keyPath: "id" });
    movements.createIndex("occurredOn", "occurredOn");
    movements.createIndex("walletId", "walletId");
    movements.createIndex("idempotencyKey", "idempotencyKey");
    movements.createIndex("relatedEntitlementId", "relatedEntitlementId");
    movements.createIndex("relatedMovementId", "relatedMovementId");
    movements.createIndex("reversalOfId", "reversalOfId");
  }
  if (!database.objectStoreNames.contains(allocationPolicyStore)) {
    const policies = database.createObjectStore(allocationPolicyStore, { keyPath: "id" });
    policies.createIndex("catalogItemId", "catalogItemId");
    policies.createIndex("startsOn", "startsOn");
    policies.createIndex("status", "status");
    policies.createIndex("idempotencyKey", "idempotencyKey");
    policies.createIndex("seriesId", "seriesId");
  }
  /* مخزن ٢٩: تقديرات التكلفة المستقلة — أدوات تفكير بلا أثر مالي. */
  if (!database.objectStoreNames.contains(costEstimateStore)) {
    const costEstimates = database.createObjectStore(costEstimateStore, { keyPath: "id" });
    costEstimates.createIndex("updatedAt", "updatedAt");
  }
  /* المجموعة ٤ (عقد ٢٩): سجلات الأصول والقروض — إنشاء محروس للترقية من
   * المخطط ٣٣؛ القديم يفتح بلا سجلين ولا يفقد شيئًا. */
  if (!database.objectStoreNames.contains(assetStore)) {
    const assets = database.createObjectStore(assetStore, { keyPath: "id" });
    assets.createIndex("updatedAt", "updatedAt");
  }
  if (!database.objectStoreNames.contains(loanStore)) {
    const loans = database.createObjectStore(loanStore, { keyPath: "id" });
    loans.createIndex("updatedAt", "updatedAt");
  }
  /* المجموعة ٥ (المخطط ٣٥): مخزنا المسودات النصية والقفل — إنشاء محروس
   * للترقية من ٣٤؛ لا ترحيل بيانات ولا حقول جديدة على سجلات قائمة. */
  if (!database.objectStoreNames.contains(formDraftStore)) {
    const formDrafts = database.createObjectStore(formDraftStore, { keyPath: "id" });
    formDrafts.createIndex("updatedAt", "updatedAt");
    formDrafts.createIndex("formKind", "formKind");
  }
  if (!database.objectStoreNames.contains(securityStore))
    database.createObjectStore(securityStore, { keyPath: "id" });
  const policyStore = request.transaction?.objectStore(ownerEntitlementPolicyStore);
  if (policyStore && !policyStore.indexNames.contains("seriesId"))
    policyStore.createIndex("seriesId", "seriesId");
  if (policyStore && !policyStore.indexNames.contains("successorOfPolicyId"))
    policyStore.createIndex("successorOfPolicyId", "successorOfPolicyId");
  const recordStore = request.transaction?.objectStore(ownerEntitlementRecordStore);
  if (recordStore && !recordStore.indexNames.contains("reversalOfId"))
    recordStore.createIndex("reversalOfId", "reversalOfId");
  const openingStore = request.transaction?.objectStore(ownerEntitlementOpeningBalanceStore);
  if (openingStore && !openingStore.indexNames.contains("reversalOfId"))
    openingStore.createIndex("reversalOfId", "reversalOfId");
  const movementStore = request.transaction?.objectStore(ownerMovementStore);
  if (movementStore && !movementStore.indexNames.contains("relatedOpeningBalanceId"))
    movementStore.createIndex("relatedOpeningBalanceId", "relatedOpeningBalanceId");
  if (event.oldVersion < 23) {
    if (policyStore) {
      const cursor = guardUpgradeCursor(policyStore.openCursor(), request, "سياسات حق المالك");
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        const value = current.value as Record<string, unknown>;
        current.update({
          ...value,
          seriesId: typeof value.seriesId === "string" && value.seriesId ? value.seriesId : value.id,
          successorOfPolicyId:
            typeof value.successorOfPolicyId === "string" ? value.successorOfPolicyId : null,
        });
        current.continue();
      };
    }
    if (recordStore) {
      const cursor = guardUpgradeCursor(recordStore.openCursor(), request, "سجلات حق المالك");
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        const value = current.value as Record<string, unknown>;
        current.update({
          ...value,
          sourceKeys:
            Array.isArray(value.sourceKeys) && value.sourceKeys.length > 0
              ? value.sourceKeys
              : [`legacy:record:${value.id}`],
          reversalOfId: typeof value.reversalOfId === "string" ? value.reversalOfId : null,
          reversalReason: typeof value.reversalReason === "string" ? value.reversalReason : null,
        });
        current.continue();
      };
    }
    if (openingStore) {
      const cursor = guardUpgradeCursor(openingStore.openCursor(), request, "أرصدة افتتاح حق المالك");
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        const value = current.value as Record<string, unknown>;
        current.update({
          ...value,
          reversalOfId: typeof value.reversalOfId === "string" ? value.reversalOfId : null,
          reversalReason: typeof value.reversalReason === "string" ? value.reversalReason : null,
        });
        current.continue();
      };
    }
    if (movementStore) {
      const cursor = guardUpgradeCursor(movementStore.openCursor(), request, "حركات المالك");
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        const value = current.value as Record<string, unknown>;
        current.update({
          ...value,
          relatedOpeningBalanceId:
            typeof value.relatedOpeningBalanceId === "string" ? value.relatedOpeningBalanceId : null,
          openingBalanceDeltaMinor:
            typeof value.openingBalanceDeltaMinor === "number" ? value.openingBalanceDeltaMinor : 0,
          reversalOfId: typeof value.reversalOfId === "string" ? value.reversalOfId : null,
          reversalReason: typeof value.reversalReason === "string" ? value.reversalReason : null,
        });
        current.continue();
      };
    }
  }
  if (event.oldVersion < 25) {
    const movements = request.transaction?.objectStore(inventoryMovementStore);
    if (movements) {
      const cursor = guardUpgradeCursor(movements.openCursor(), request, "حركات المخزون");
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        const legacy = current.value as Record<string, unknown>;
        current.update({
          ...legacy,
          wasteContext: legacy.type === "waste" ? (legacy.wasteContext ?? { kind: "general_project" }) : null,
        });
        current.continue();
      };
    }
  }
  if (event.oldVersion < 26) {
    const allocationPolicies = request.transaction?.objectStore(allocationPolicyStore);
    if (allocationPolicies) {
      const cursor = guardUpgradeCursor(allocationPolicies.openCursor(), request, "سياسات التوزيع");
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        const legacy = current.value as Record<string, unknown>;
        const isPerOutputUnit = legacy.kind === "per_output_unit";
        current.update({
          ...legacy,
          rateMinorPerWholeUnit: isPerOutputUnit
            ? typeof legacy.rateMinorPerWholeUnit === "number"
              ? legacy.rateMinorPerWholeUnit
              : typeof legacy.rateMinor === "number"
                ? legacy.rateMinor
                : null
            : null,
          rateMinor: isPerOutputUnit ? null : typeof legacy.rateMinor === "number" ? legacy.rateMinor : null,
        });
        current.continue();
      };
    }
  }
  if (event.oldVersion < 24) {
    const catalogItems = request.transaction?.objectStore(catalogItemStore);
    if (catalogItems) {
      const cursor = guardUpgradeCursor(catalogItems.openCursor(), request, "عناصر الكتالوج");
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        const legacy = current.value as Record<string, unknown>;
        current.update({
          ...legacy,
          unitId: typeof legacy.unitId === "string" && legacy.unitId ? legacy.unitId : null,
        });
        current.continue();
      };
    }
  }
  if (event.oldVersion < 17) {
    const drafts = request.transaction?.objectStore(draftStore);
    if (drafts) {
      const cursor = guardUpgradeCursor(drafts.openCursor(), request, "المسودات");
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        const legacy = current.value as Partial<OrderDraft>;
        current.update({
          ...legacy,
          ...(event.oldVersion < 4
            ? {
                costSnapshots: Array.isArray(legacy.costSnapshots) ? legacy.costSnapshots : [],
                activeCostSnapshotId: legacy.activeCostSnapshotId ?? null,
                linkedOrderId: legacy.linkedOrderId ?? null,
              }
            : {}),
          ...(event.oldVersion < 17 ? { catalogItemId: legacy.catalogItemId ?? null } : {}),
        });
        current.continue();
      };
    }
  }
  if (event.oldVersion < 8) {
    const transaction = request.transaction;
    const schedules = transaction?.objectStore(scheduleStore);
    if (schedules) {
      const cursor = guardUpgradeCursor(schedules.openCursor(), request, "المواعيد");
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        const legacy = current.value as Partial<ScheduleEntry>;
        current.update({
          ...legacy,
          scheduledTime: legacy.scheduledTime ?? null,
          durationMinutes: legacy.durationMinutes ?? null,
          events: Array.isArray(legacy.events)
            ? legacy.events.map(entry => ({
                ...entry,
                previousScheduledTime: entry.previousScheduledTime ?? null,
                scheduledTime: entry.scheduledTime ?? null,
                previousDurationMinutes: entry.previousDurationMinutes ?? null,
                durationMinutes: entry.durationMinutes ?? null,
              }))
            : [],
        });
        current.continue();
      };
    }
  }
  if (event.oldVersion < 17) {
    const orders = request.transaction?.objectStore(orderStore);
    if (orders) {
      const cursor = guardUpgradeCursor(orders.openCursor(), request, "الطلبات");
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        current.update({ ...current.value, catalogItemId: current.value.catalogItemId ?? null });
        current.continue();
      };
    }
  }
  if (event.oldVersion < 20) {
    const schedules = request.transaction?.objectStore(scheduleStore);
    if (schedules) {
      const cursor = guardUpgradeCursor(schedules.openCursor(), request, "المواعيد");
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        current.update({
          ...current.value,
          scheduledTime: current.value.scheduledTime ?? null,
          durationMinutes: current.value.durationMinutes ?? null,
          events: Array.isArray(current.value.events)
            ? current.value.events.map((entry: Record<string, unknown>) => ({
                ...entry,
                previousScheduledTime: entry.previousScheduledTime ?? null,
                scheduledTime: entry.scheduledTime ?? null,
                previousDurationMinutes: entry.previousDurationMinutes ?? null,
                durationMinutes: entry.durationMinutes ?? null,
              }))
            : [],
          recurrenceId: current.value.recurrenceId ?? null,
          recurrenceIndex: current.value.recurrenceIndex ?? null,
        });
        current.continue();
      };
    }
    const orders = request.transaction?.objectStore(orderStore);
    if (orders) {
      const cursor = guardUpgradeCursor(orders.openCursor(), request, "الطلبات");
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        current.update({
          ...current.value,
          catalogItemId: current.value.catalogItemId ?? null,
          followUpSummary: current.value.followUpSummary ?? null,
          followUpDate: current.value.followUpDate ?? null,
          followUpReason: current.value.followUpReason ?? null,
          followUpEvents: Array.isArray(current.value.followUpEvents) ? current.value.followUpEvents : [],
        });
        current.continue();
      };
    }
  }
  if (event.oldVersion < 18) {
    const preferences = request.transaction?.objectStore(preferencesStore);
    if (preferences) {
      const cursor = guardUpgradeCursor(preferences.openCursor(), request, "التفضيلات");
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        current.update({
          ...current.value,
          ...(event.oldVersion < 8
            ? { dailyScheduleCapacityMinutes: current.value.dailyScheduleCapacityMinutes ?? null }
            : {}),
          ...(event.oldVersion < 18
            ? {
                workMode: current.value.workMode ?? null,
                actualTimeTrackingEnabled: current.value.actualTimeTrackingEnabled ?? false,
              }
            : {}),
        });
        current.continue();
      };
    }
  }
}
