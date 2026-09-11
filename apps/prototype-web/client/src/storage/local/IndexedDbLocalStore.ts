/** Browser persistence adapter. React never imports this module and financial policy lives above it. */
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
import type { SupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import type { CashContinuityEntry, CashWallet } from "@micro-domain/cash-continuity/index.js";
import type {
  InventoryMovement,
  InventoryShortage,
  Material,
} from "@micro-domain/inventory-material/index.js";
import type {
  CatalogItem,
  CatalogTemplate,
  DirectConversion,
  MeasurementUnit,
} from "@micro-domain/catalog/index.js";
import type { ActualTimeRecord } from "@micro-domain/actual-time/index.js";
import type { ShortCashDeclaration } from "@micro-domain/g5/index.js";
import type {
  OwnerEntitlementOpeningBalance,
  OwnerEntitlementPolicy,
  OwnerEntitlementRecord,
  OwnerMovement,
} from "@micro-domain/owner-entitlement/index.js";
import type { AllocationPolicy } from "@micro-domain/recurring-margin/index.js";
import type { DirectSale } from "@micro-domain/direct-sale/index.js";
import type { AssetRecord } from "@micro-domain/asset/index.js";
import type { LoanRecord } from "@micro-domain/loan/index.js";
import {
  localInventoryActivationId,
  localOwnerProfileId,
  localSchemaVersion,
  localSecurityId,
  type ActivityProfile,
  type CostEstimate,
  type FormDraftEnvelope,
  type InventoryActivation,
  type LocalPreferences,
  type LocalSecurityRecord,
  type LocalStoreSnapshot,
  type OrderDraft,
  type OwnerProfile,
  type PrototypeLocalStore,
  type ScheduleEntry,
  type ScheduleRecurrence,
  type StorageFailure,
  type StorageFailureCode,
  type StorageResult,
  type StoredCraftOrder,
} from "./types";
import { findLoanEventByKey, validateLoanCommitRelation } from "./loanCommitGuard";
import {
  committedReversalMovements,
  storedReversalMovementsFor,
  validateDeliveryReversalCommit,
  validateDeliveryReversalMovements,
} from "./deliveryReversalCommitGuard";
import {
  validateScheduleCreate,
  validateScheduleUpdate,
  validateSupplierPurchaseCommit,
  type SupplierPurchaseCommit,
} from "./supplierScheduleCommitGuard";

const databaseName = "micro-prototype-local";
const profileStore = "activity-profile";
/* مخزن ٣٠ (المجموعة ١): هوية المالك المحلية — سجل واحد بلا فهارس. */
const ownerProfileStore = "owner-profile";
const preferencesStore = "local-preferences";
const draftStore = "order-drafts";
const orderStore = "craft-orders";
const directSaleStore = "direct-sales";
const scheduleStore = "schedule-entries";
const recurrenceStore = "schedule-recurrences";
const financialEventStore = "financial-events";
const supplierPurchaseStore = "supplier-purchases";

/* المجموعة ٢ (التحصين الكامل — HIGH-001): رسالة تعارض قالب التكرار — مسار آخر
 * كتب بين قراءة الخدمة والتزامها؛ لا يُكتب شيء ويُعاد المحاولة. */
const RECURRENCE_STALE_MESSAGE =
  "قالب التكرار أو مواعده تغيّرت من مسار آخر بعد فتحك لها — لم يُسجَّل شيء؛ أعد المحاولة.";
const cashWalletStore = "cash-wallets";
const cashContinuityEntryStore = "cash-continuity-entries";
const materialStore = "materials";
const inventoryMovementStore = "inventory-movements";
/* القرار ٩: سجل تفعيل المخزون المؤرّخ — مستودع منفرد بلا فهارس. */
const inventoryActivationStore = "inventory-activations";
/* المجموعة ٢ (عقد ٢٨ / D-027): سجلات نقص المخزون — تعيين موثّق بدل رصيد سالب. */
const inventoryShortageStore = "inventory-shortages";
const catalogItemStore = "catalog-items";
const measurementUnitStore = "measurement-units";
const directConversionStore = "direct-conversions";
const catalogTemplateStore = "catalog-templates";
const actualTimeStore = "actual-time-records";
const shortCashDeclarationStore = "short-cash-declarations";
const ownerEntitlementPolicyStore = "owner-entitlement-policies";
const ownerEntitlementRecordStore = "owner-entitlement-records";
const ownerEntitlementOpeningBalanceStore = "owner-entitlement-opening-balances";
const ownerMovementStore = "owner-movements";
const allocationPolicyStore = "allocation-policies";
const costEstimateStore = "cost-estimates";
/* المجموعة ٤ (عقد ٢٩): سجلات الأصول والقروض — سجلان تشغيليان فوق أحداثهما المالية. */
const assetStore = "assets";
const loanStore = "loans";
/* المجموعة ٥ (الاستمرارية): مسودات النماذج الطويلة وسجل القفل المحلي — مخزنان
 * خارج اللقطة عمدًا (مسودة عابرة/سر محلي)؛ المُنشئ محروس فيُفتح القديم بلا فقدان. */
const formDraftStore = "form-drafts";
const securityStore = "local-security";

class StorageOpenError extends Error {
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

const staleConnections = new WeakSet<IDBDatabase>();
const upgradeErrors = new WeakMap<IDBOpenDBRequest, StorageOpenError>();

/* S5-07 (المجموعة ٦ — البند ٦): اتصال واحد مُخزَّن على مستوى الوحدة. الفتح لكل
 * عملية كان يدفع مصافحة open كاملة لكل قراءة/كتابة (قياس ٥٣ فتحًا لتحميل
 * «مالي» واحد). الاتصال يُقال من الذاكرة عند versionchange (نافذة أخرى رقّت
 * النسخة) فلا يحجب ترقيةً أبدًا، وفشل الفتح لا يدنس الذاكرة — المحاولة
 * التالية تفتح من جديد. VersionError بعد إقالة الاتصال يُعلن storage_stale
 * بصدق (G6-P4-2) — لا إعادة محاولة تلقائية تخفي قدم البيانات. */
let cachedConnection: Promise<IDBDatabase> | null = null;

function connection(): Promise<IDBDatabase> {
  if (cachedConnection === null) {
    const promise = openDatabase();
    promise.catch(() => {
      if (cachedConnection === promise) cachedConnection = null;
    });
    cachedConnection = promise;
  }
  return cachedConnection;
}

function failure(error: unknown, database?: IDBDatabase): StorageFailure {
  if (database && staleConnections.has(database)) {
    return {
      ok: false,
      code: "storage_stale",
      message: "هذه النسخة قديمة. أعد تحميل Micro قبل إدخال بيانات جديدة.",
    };
  }
  if (error instanceof StorageOpenError) return { ok: false, code: error.code, message: error.message };
  /* G6-P4-2 (المجموعة ٦): إقالة الاتصال بعد ترقية في نافذة أخرى تجعل
   * المعاملات التالية VersionError — ذلك قدمٌ معلن لا «خطأ تخزين» عام. */
  if (error instanceof Error && error.name === "VersionError") {
    return {
      ok: false,
      code: "storage_stale",
      message: "هذه النسخة قديمة. أعد تحميل Micro قبل إدخال بيانات جديدة.",
    };
  }
  return {
    ok: false,
    code: typeof indexedDB === "undefined" ? "storage_unavailable" : "storage_error",
    message: error instanceof Error ? error.message : "تعذر الوصول إلى التخزين المحلي.",
  };
}

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

function attachVersionChangeRecovery(database: IDBDatabase): IDBDatabase {
  database.onversionchange = () => {
    staleConnections.add(database);
    /* S5-07: الإقالة الفورية للاتصال المخزَّن — ترقية نافذة أخرى لا تُحجب
     * أبدًا، والعملية التالية هنا تفتح نسخة جديدة أو تعلن قدمها بصدق. */
    cachedConnection = null;
    database.close();
  };
  return database;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("التخزين المحلي غير مدعوم في هذا المتصفح."));
      return;
    }
    const request = indexedDB.open(databaseName, localSchemaVersion);
    let settled = false;
    request.onerror = () => {
      if (settled) return;
      settled = true;
      reject(upgradeErrors.get(request) ?? request.error ?? new Error("تعذر فتح التخزين المحلي."));
    };
    request.onblocked = () => {
      if (settled) return;
      settled = true;
      reject(
        new StorageOpenError(
          "storage_blocked",
          "Micro مفتوح في نافذة أخرى. أغلق النوافذ الأخرى ثم أعد المحاولة.",
        ),
      );
      /* المجموعة ٢ (التحصين الكامل — RISK-003): النجاح المتأخر بعد الرفض
       * يعالجه معالج onsuccess النهائي أسفل الدالة — يغلق الاتصال اليتيم. */
    };
    request.onupgradeneeded = event => {
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
              wasteContext:
                legacy.type === "waste" ? (legacy.wasteContext ?? { kind: "general_project" }) : null,
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
              rateMinor: isPerOutputUnit
                ? null
                : typeof legacy.rateMinor === "number"
                  ? legacy.rateMinor
                  : null,
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
    };
    request.onsuccess = () => {
      if (settled) {
        /* المجموعة ٢ (التحصين الكامل — RISK-003): نجاح متأخر بعد رفض
         * onblocked — وعد الرفض حُسم فلا مالك لهذا الاتصال؛ يُغلق فورًا
         * كي لا يبقى مفتوحًا يحجب ترقيات المستقبل ولا وعد معلق بلا حسم. */
        try {
          request.result.close();
        } catch {
          /* الاتصال قد يكون مغلقًا سلفًا — لا شيء للتصحيح. */
        }
        return;
      }
      settled = true;
      resolve(attachVersionChangeRecovery(request.result));
    };
  });
}

/** @internal Test seam for exercising the adapter’s versionchange recovery with fake-indexeddb. */
export function __openDatabaseForTesting(): Promise<IDBDatabase> {
  return openDatabase();
}

/** @internal S5-07: إعادة الاتصال المخزَّن لحالة الاختبار (يفحص أن ذاكرة الاتصال تُقال). */
export function __cachedConnectionForTesting(): Promise<IDBDatabase> | null {
  return cachedConnection;
}

async function readOne<T>(storeName: string, key: string): Promise<StorageResult<T | null>> {
  try {
    const database = await connection();
    return await new Promise(resolve => {
      const transaction = database.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).get(key);
      request.onerror = () => resolve(failure(request.error, database));
      request.onsuccess = () => resolve({ ok: true, value: (request.result as T | undefined) ?? null });
      transaction.oncomplete = () => {};
    });
  } catch (error) {
    return failure(error);
  }
}

async function writeOne<T>(storeName: string, value: T): Promise<StorageResult<T>> {
  try {
    const database = await connection();
    return await new Promise(resolve => {
      const transaction = database.transaction(storeName, "readwrite");
      const request = transaction.objectStore(storeName).put(value);
      request.onerror = () => resolve(failure(request.error, database));
      transaction.onabort = () => resolve(failure(transaction.error, database));
      transaction.oncomplete = () => {
        resolve({ ok: true, value });
      };
    });
  } catch (error) {
    return failure(error);
  }
}

/* حتمية داخل المعاملة (إصلاح P0 — الإرسال المتزامن المزدوج): الفحص خارج
 * المعاملة (قراءة ثم كتابة) يسمح لنداءين متزامنين بمفتاح واحد بالمرور معًا
 * فيُخزَّن السجل مرتين ويُقترن المحفظة مرتين. هنا يُفحص المفتاح داخل معاملة
 * الكتابة نفسها: إن وُجد سجل سابق بنفس المفتاح يُعاد كما هو دون كتابة ثانية —
 * نفس عقد commitOrderDelivery/commitFinancialEventCorrection لا مسار ثانٍ. */
async function writeOneIdempotent<T>(
  storeName: string,
  value: T,
  isDuplicate: (existing: T) => boolean,
): Promise<StorageResult<T>> {
  try {
    const database = await connection();
    return await new Promise(resolve => {
      const transaction = database.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      const scanRequest = store.getAll();
      scanRequest.onerror = () => resolve(failure(scanRequest.error, database));
      scanRequest.onsuccess = () => {
        const existing = (scanRequest.result as T[]).find(isDuplicate);
        if (existing) {
          resolve({ ok: true, value: existing });
          return;
        }
        const putRequest = store.put(value);
        putRequest.onerror = () => resolve(failure(putRequest.error, database));
      };
      transaction.onabort = () => resolve(failure(transaction.error, database));
      transaction.onerror = () => resolve(failure(transaction.error, database));
      transaction.oncomplete = () => {
        resolve({ ok: true, value });
      };
    });
  } catch (error) {
    return failure(error);
  }
}

/* القرار ٢١: حذف المسودة غير المرتبطة — حذف سجل بلا أثر مالي؛ لا يمس أحداث طلب. */
async function deleteOne(storeName: string, key: string): Promise<StorageResult<null>> {
  try {
    const database = await connection();
    return await new Promise(resolve => {
      const transaction = database.transaction(storeName, "readwrite");
      const request = transaction.objectStore(storeName).delete(key);
      request.onerror = () => resolve(failure(request.error, database));
      transaction.onabort = () => resolve(failure(transaction.error, database));
      transaction.oncomplete = () => {
        resolve({ ok: true, value: null });
      };
    });
  } catch (error) {
    return failure(error);
  }
}

async function listAll<T>(
  storeName: string,
  sort: (left: T, right: T) => number,
): Promise<StorageResult<readonly T[]>> {
  try {
    const database = await connection();
    return await new Promise(resolve => {
      const transaction = database.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).getAll();
      request.onerror = () => resolve(failure(request.error, database));
      request.onsuccess = () => resolve({ ok: true, value: (request.result as T[]).sort(sort) });
      transaction.oncomplete = () => {};
    });
  } catch (error) {
    return failure(error);
  }
}

export class IndexedDbLocalStore implements PrototypeLocalStore {
  getProfile() {
    return readOne<ActivityProfile>(profileStore, "local-profile");
  }
  saveProfile(profile: ActivityProfile) {
    return writeOne(profileStore, profile);
  }
  getOwnerProfile() {
    return readOne<OwnerProfile>(ownerProfileStore, localOwnerProfileId);
  }
  saveOwnerProfile(profile: OwnerProfile) {
    return writeOne(ownerProfileStore, profile);
  }
  getPreferences() {
    return readOne<LocalPreferences>(preferencesStore, "local-preferences");
  }
  savePreferences(preferences: LocalPreferences) {
    return writeOne(preferencesStore, preferences);
  }
  /* المجموعة ٥: مسودات النماذج وسجل القفل — عمليات سجل واحد كالتفضيلات؛
   * لا مس لهما داخل readSnapshot/replaceSnapshot فتبقى عند الاستعادة. */
  getFormDraft(id: string) {
    return readOne<FormDraftEnvelope>(formDraftStore, id);
  }
  saveFormDraft(draft: FormDraftEnvelope) {
    return writeOne(formDraftStore, draft);
  }
  deleteFormDraft(id: string) {
    return deleteOne(formDraftStore, id);
  }
  /* المجموعة ٥ (التحصين الكامل): تعداد المسودات العابرة (الأحدث أولًا) ومسحها
   * كاملًا في معاملة واحدة ذرّية — سياسة إعادة التعيين المعلنة. */
  listFormDrafts() {
    return listAll<FormDraftEnvelope>(formDraftStore, (left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
  }
  async clearFormDrafts(): Promise<StorageResult<null>> {
    try {
      const database = await connection();
      return await new Promise(resolve => {
        const transaction = database.transaction(formDraftStore, "readwrite");
        const request = transaction.objectStore(formDraftStore).clear();
        request.onerror = () => resolve(failure(request.error, database));
        transaction.onabort = () => resolve(failure(transaction.error, database));
        transaction.oncomplete = () => {
          resolve({ ok: true, value: null });
        };
      });
    } catch (error) {
      return failure(error);
    }
  }
  getLocalSecurity() {
    return readOne<LocalSecurityRecord>(securityStore, localSecurityId);
  }
  saveLocalSecurity(security: LocalSecurityRecord) {
    return writeOne(securityStore, security);
  }
  deleteLocalSecurity() {
    return deleteOne(securityStore, localSecurityId);
  }
  listDrafts() {
    return listAll<OrderDraft>(draftStore, (left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }
  getDraft(id: string) {
    return readOne<OrderDraft>(draftStore, id);
  }
  saveDraft(draft: OrderDraft) {
    return writeOne(draftStore, draft);
  }
  deleteDraft(id: string) {
    return deleteOne(draftStore, id);
  }
  listOrders() {
    return listAll<StoredCraftOrder>(orderStore, (left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
  }
  getOrder(id: string) {
    return readOne<StoredCraftOrder>(orderStore, id);
  }
  saveOrder(order: StoredCraftOrder) {
    return writeOne(orderStore, order);
  }
  /* المجموعة ٦ (S2-04أ): تراجع القبضة والتخصيص في معاملة IndexedDB واحدة —
   * الطلب وأثر الكاش معًا أو لا شيء. فحص الهوية داخل المعاملة (نمط حركة المالك):
   * حدث التراجع موجود سلفًا → مسار إعادة استخدام مع أثر الكاش المطابق أو رفض
   * الحالة النصفية؛ أثر تراجع سابق لنفس التخصيص → رفض؛ وإلا كتابة الحالتين. */
  async commitDepositRefundSettlement(
    order: StoredCraftOrder,
    allocationReversals: readonly CashContinuityEntry[],
    refundEventKey: string,
  ): Promise<
    StorageResult<{ order: StoredCraftOrder; cashEntries: readonly CashContinuityEntry[]; reused: boolean }>
  > {
    /* Conflict E (FC-06): رد العربون وأثر فك التخصيصات في معاملة واحدة —
     * نفس بروتوكول تراجع القبضة: فحص داخل المعاملة، إحباط عند أي تعارض،
     * وإعادة استخدام صادقة عند تكرار المفتاح. */
    try {
      const database = await connection();
      return await new Promise(resolve => {
        const transaction = database.transaction([orderStore, cashContinuityEntryStore], "readwrite");
        const orders = transaction.objectStore(orderStore);
        const cashEntries = transaction.objectStore(cashContinuityEntryStore);
        let pending: StorageResult<{
          order: StoredCraftOrder;
          cashEntries: readonly CashContinuityEntry[];
          reused: boolean;
        }> | null = null;
        const finish = (
          result: StorageResult<{
            order: StoredCraftOrder;
            cashEntries: readonly CashContinuityEntry[];
            reused: boolean;
          }>,
        ) => {
          resolve(result);
        };
        const orderRequest = orders.get(order.id);
        orderRequest.onerror = () => {
          pending = failure(orderRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        orderRequest.onsuccess = () => {
          const existing = orderRequest.result as StoredCraftOrder | undefined;
          if (!existing) {
            pending = {
              ok: false,
              code: "storage_error",
              message: "لم نجد الطلب المحلي لرد العربون.",
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          const alreadyRefunded = existing.order.events.some(
            event => event.type === "deposit_refunded" && event.idempotencyKey === refundEventKey,
          );
          if (alreadyRefunded) {
            const cashRequest = cashEntries.getAll();
            cashRequest.onerror = () => {
              pending = failure(cashRequest.error, database);
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            };
            cashRequest.onsuccess = () => {
              const operationKeys = new Set(allocationReversals.map(entry => entry.operationKey));
              const matching = (cashRequest.result as CashContinuityEntry[]).filter(entry =>
                operationKeys.has(entry.operationKey),
              );
              pending = {
                ok: true,
                value: { order: existing, cashEntries: matching, reused: true },
              };
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            };
            return;
          }
          const cashRequest = cashEntries.getAll();
          cashRequest.onerror = () => {
            pending = failure(cashRequest.error, database);
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
          };
          cashRequest.onsuccess = () => {
            const all = cashRequest.result as CashContinuityEntry[];
            /* فك جزئي متكرر مسموح ما دام المجموع لا يتجاوز التخصيص الأصلي. */
            const originalById = new Map(all.map(entry => [entry.id, entry] as const));
            const reversedPerEntry = new Map<string, number>();
            for (const entry of all) {
              if (entry.type === "reversal" && entry.reversesEntryId) {
                reversedPerEntry.set(
                  entry.reversesEntryId,
                  (reversedPerEntry.get(entry.reversesEntryId) ?? 0) - entry.cashDeltaMinor,
                );
              }
            }
            let conflict = allocationReversals.some(reversal => all.some(entry => entry.id === reversal.id));
            if (!conflict) {
              for (const reversal of allocationReversals) {
                if (!reversal.reversesEntryId) continue;
                const original = originalById.get(reversal.reversesEntryId);
                const reversedSoFar = reversedPerEntry.get(reversal.reversesEntryId) ?? 0;
                const additional = -reversal.cashDeltaMinor;
                const cap = original ? original.cashDeltaMinor : Number.POSITIVE_INFINITY;
                if (reversedSoFar + additional > cap) {
                  conflict = true;
                  break;
                }
                reversedPerEntry.set(reversal.reversesEntryId, reversedSoFar + additional);
              }
            }
            if (conflict) {
              pending = {
                ok: false,
                code: "storage_error",
                message: "فك التخصيص يتجاوز مبلغ التخصيص الأصلي؛ لم يتغير السجل.",
              };
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
              return;
            }
            orders.put(order);
            for (const reversal of allocationReversals) cashEntries.put(reversal);
          };
        };
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () =>
          finish({ ok: true, value: { order, cashEntries: allocationReversals, reused: false } });
      });
    } catch (error) {
      return failure(error);
    }
  }

  async commitOrderCollectionReversal(
    order: StoredCraftOrder,
    allocationReversal: CashContinuityEntry | null,
    reversalEventKey: string,
  ): Promise<
    StorageResult<{ order: StoredCraftOrder; cashEntry: CashContinuityEntry | null; reused: boolean }>
  > {
    try {
      const database = await connection();
      return await new Promise(resolve => {
        const transaction = database.transaction([orderStore, cashContinuityEntryStore], "readwrite");
        const orders = transaction.objectStore(orderStore);
        const cashEntries = transaction.objectStore(cashContinuityEntryStore);
        let pending: StorageResult<{
          order: StoredCraftOrder;
          cashEntry: CashContinuityEntry | null;
          reused: boolean;
        }> | null = null;
        const finish = (
          result: StorageResult<{
            order: StoredCraftOrder;
            cashEntry: CashContinuityEntry | null;
            reused: boolean;
          }>,
        ) => {
          resolve(result);
        };
        const orderRequest = orders.get(order.id);
        orderRequest.onerror = () => {
          pending = failure(orderRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        orderRequest.onsuccess = () => {
          const existing = orderRequest.result as StoredCraftOrder | undefined;
          if (!existing) {
            pending = {
              ok: false,
              code: "storage_error",
              message: "لم نجد الطلب المحلي لتراجع القبضة.",
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          const alreadyReversed = existing.order.events.some(
            event => event.type === "collection_reversed" && event.idempotencyKey === reversalEventKey,
          );
          if (alreadyReversed) {
            if (!allocationReversal) {
              pending = { ok: true, value: { order: existing, cashEntry: null, reused: true } };
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
              return;
            }
            const cashRequest = cashEntries.getAll();
            cashRequest.onerror = () => {
              pending = failure(cashRequest.error, database);
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            };
            cashRequest.onsuccess = () => {
              const matching = (cashRequest.result as CashContinuityEntry[]).find(
                entry => entry.operationKey === allocationReversal.operationKey,
              );
              if (!matching) {
                pending = {
                  ok: false,
                  code: "storage_error",
                  message: "وجدت تراجع قبضة بلا أثر تخصيص مطابق؛ لم يتغير السجل.",
                };
              } else {
                pending = {
                  ok: true,
                  value: { order: existing, cashEntry: matching, reused: true },
                };
              }
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            };
            return;
          }
          if (allocationReversal) {
            const cashRequest = cashEntries.getAll();
            cashRequest.onerror = () => {
              pending = failure(cashRequest.error, database);
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            };
            cashRequest.onsuccess = () => {
              const conflict = (cashRequest.result as CashContinuityEntry[]).some(
                entry => entry.reversesEntryId === allocationReversal.reversesEntryId,
              );
              if (conflict) {
                pending = {
                  ok: false,
                  code: "storage_error",
                  message: "تم التراجع عن تخصيص هذه القبضة سابقًا؛ لم يتغير السجل.",
                };
                try {
                  transaction.abort();
                } catch {
                  if (pending) finish(pending);
                }
                return;
              }
              orders.put(order);
              cashEntries.put(allocationReversal);
            };
            return;
          }
          orders.put(order);
        };
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () =>
          finish({ ok: true, value: { order, cashEntry: allocationReversal, reused: false } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  /* المجموعة ٣ (عقد D4): معاملة تسليم ذرّية — الطلب وحركات الاستهلاك وسجلات
   * النقص وتخصيص الكاش معًا أو لا شيء. مسار إعادة الاستخدام يقرأ الحالة القائمة
   * ويكمل ما نقص فقط (مفاتيح عمليات حتمية) فلا تكرار عند إعادة المحاولة. */
  async commitOrderDelivery(
    order: StoredCraftOrder,
    movements: readonly InventoryMovement[],
    shortages: readonly InventoryShortage[],
    wallet: CashWallet | null,
    cashEntry: CashContinuityEntry | null,
  ): Promise<
    StorageResult<{
      order: StoredCraftOrder;
      movements: readonly InventoryMovement[];
      shortages: readonly InventoryShortage[];
      cashEntry: CashContinuityEntry | null;
      reused: boolean;
    }>
  > {
    try {
      const database = await connection();
      return await new Promise(resolve => {
        const transaction = database.transaction(
          [
            orderStore,
            inventoryMovementStore,
            inventoryShortageStore,
            cashWalletStore,
            cashContinuityEntryStore,
          ],
          "readwrite",
        );
        const orders = transaction.objectStore(orderStore);
        const movementStore = transaction.objectStore(inventoryMovementStore);
        const shortageStore = transaction.objectStore(inventoryShortageStore);
        const wallets = transaction.objectStore(cashWalletStore);
        const cashEntries = transaction.objectStore(cashContinuityEntryStore);
        let pending: StorageResult<{
          order: StoredCraftOrder;
          movements: readonly InventoryMovement[];
          shortages: readonly InventoryShortage[];
          cashEntry: CashContinuityEntry | null;
          reused: boolean;
        }> | null = null;
        const finish = (
          result: StorageResult<{
            order: StoredCraftOrder;
            movements: readonly InventoryMovement[];
            shortages: readonly InventoryShortage[];
            cashEntry: CashContinuityEntry | null;
            reused: boolean;
          }>,
        ) => resolve(result);
        let deliveryReused = false;
        const orderRequest = orders.get(order.id);
        orderRequest.onerror = () => {
          pending = failure(orderRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        orderRequest.onsuccess = () => {
          const existing = orderRequest.result as StoredCraftOrder | undefined;
          if (!existing) {
            pending = {
              ok: false,
              code: "storage_error",
              message: "لم نجد الطلب المحلي لتسجيل التسليم.",
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          /* حدث التسليم حاضر سلفًا → إعادة استخدام: لا نعيد كتابة الطلب، ونكمل
           * فقط حركات/نقص/تخصيصًا نقص من مفاتيح حتمية (حالة نصفية بعد انقطاع). */
          /* المجموعة ٣: المقارنة على مفتاح آخر حدث تسليم في الطلب الوارد —
           * إعادة التسليم بعد عكسٍ كتابة جديدة لا إعادة تشغيل. */
          const lastDeliveryKey = [...order.order.events]
            .reverse()
            .find(event => event.type === "status_changed" && event.toStatus === "delivered")?.idempotencyKey;
          const alreadyDelivered =
            lastDeliveryKey !== undefined &&
            existing.order.events.some(
              event =>
                event.type === "status_changed" &&
                event.toStatus === "delivered" &&
                event.idempotencyKey === lastDeliveryKey,
            );
          deliveryReused = alreadyDelivered;
          const movementRequest = movementStore.getAll();
          movementRequest.onerror = () => {
            pending = failure(movementRequest.error, database);
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
          };
          movementRequest.onsuccess = () => {
            const storedMovements = movementRequest.result as InventoryMovement[];
            const storedKeys = new Set(storedMovements.map(movement => movement.operationKey));
            const movementsToWrite = movements.filter(movement => !storedKeys.has(movement.operationKey));
            const shortageRequest = shortageStore.getAll();
            shortageRequest.onerror = () => {
              pending = failure(shortageRequest.error, database);
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            };
            shortageRequest.onsuccess = () => {
              const storedShortages = shortageRequest.result as InventoryShortage[];
              const shortageKeys = new Set(storedShortages.map(shortage => shortage.operationKey));
              const shortagesToWrite = shortages.filter(shortage => !shortageKeys.has(shortage.operationKey));
              const writeAll = () => {
                if (!alreadyDelivered) orders.put(order);
                movementsToWrite.forEach(movement => movementStore.put(movement));
                shortagesToWrite.forEach(shortage => shortageStore.put(shortage));
                if (cashEntry) {
                  const cashRequest = cashEntries.getAll();
                  cashRequest.onerror = () => {
                    pending = failure(cashRequest.error, database);
                    try {
                      transaction.abort();
                    } catch {
                      if (pending) finish(pending);
                    }
                  };
                  cashRequest.onsuccess = () => {
                    const cashKeys = new Set(
                      (cashRequest.result as CashContinuityEntry[]).map(entry => entry.operationKey),
                    );
                    if (!cashKeys.has(cashEntry.operationKey)) {
                      cashEntries.put(cashEntry);
                      if (wallet) wallets.put(wallet);
                    }
                  };
                } else if (wallet) {
                  wallets.put(wallet);
                }
              };
              writeAll();
            };
          };
        };
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () =>
          finish({
            ok: true,
            value: { order, movements, shortages, cashEntry, reused: deliveryReused },
          });
      });
    } catch (error) {
      return failure(error);
    }
  }
  /* المجموعة ٣ (عقد D4) + رقعة إغلاق المجموعة ٣ (D-031، مراجعة مستقلة):
   * عكس التسليم ذرّيًا داخل معاملة واحدة — لا كتابة عمياء فوق السجل الحي.
   * الحارس يقرأ الطلب والحركات الحية داخل المعاملة نفسها (تسلسل معاملات
   * IndexedDB يمنع أي تداخل بين القراءة والكتابة): إعادة التشغيل بالمفتاح
   * نفسه تُعاد كما هي، وعلاقة التصحيح نفسها (نفس حدث التسليم) بمفتاح آخر
   * إعادة استخدام صادقة بلا كتابة، وأي تغيّر متزامن يُرفض بـ storage_stale
   * ولا يُكتب شيء — الطلب وحركاته يُكتبان معًا أو لا يُكتبان. حركات المرآة
   * تُتحقق ضد الاستهلاك الحي قبل أي put. التحقق كله متزامن داخل استدعاءات
   * الطلب فلا يفلت استثناء ولا يُختم نجاحًا كاذبًا. */
  async commitOrderDeliveryReversal(
    order: StoredCraftOrder,
    reversalMovements: readonly InventoryMovement[],
  ): Promise<
    StorageResult<{
      order: StoredCraftOrder;
      reversalMovements: readonly InventoryMovement[];
      reused: boolean;
    }>
  > {
    try {
      const database = await connection();
      return await new Promise(resolve => {
        const transaction = database.transaction([orderStore, inventoryMovementStore], "readwrite");
        const orders = transaction.objectStore(orderStore);
        const movementStore = transaction.objectStore(inventoryMovementStore);
        let committedMovements: readonly InventoryMovement[] = reversalMovements;
        let pending: StorageResult<{
          order: StoredCraftOrder;
          reversalMovements: readonly InventoryMovement[];
          reused: boolean;
        }> | null = null;
        const finish = (
          result: StorageResult<{
            order: StoredCraftOrder;
            reversalMovements: readonly InventoryMovement[];
            reused: boolean;
          }>,
        ) => resolve(result);
        const abortWith = (
          result: StorageResult<{
            order: StoredCraftOrder;
            reversalMovements: readonly InventoryMovement[];
            reused: boolean;
          }>,
        ) => {
          pending = result;
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        const orderRequest = orders.get(order.id);
        orderRequest.onerror = () => {
          pending = failure(orderRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        orderRequest.onsuccess = () => {
          const existing = orderRequest.result as StoredCraftOrder | undefined;
          if (!existing) {
            abortWith({ ok: false, code: "storage_error", message: "لم نجد الطلب المحلي لعكس تسليمه." });
            return;
          }
          const guard = validateDeliveryReversalCommit(existing, order);
          if (!guard.ok) {
            abortWith({ ok: false, code: "storage_stale", message: guard.message });
            return;
          }
          const movementRequest = movementStore.getAll();
          movementRequest.onerror = () => {
            pending = failure(movementRequest.error, database);
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
          };
          movementRequest.onsuccess = () => {
            const storedMovements = movementRequest.result as InventoryMovement[];
            if (guard.reused) {
              /* إعادة الاستخدام لا تكتب شيئًا قط — تُقرأ الحركات المخزّنة قبل
               * الإجهاد ثم تُعاد المطابقة منها لا الواردة. */
              const matching = storedReversalMovementsFor(reversalMovements, storedMovements);
              abortWith({ ok: true, value: { order: existing, reversalMovements: matching, reused: true } });
              return;
            }
            const movementGuard = validateDeliveryReversalMovements(
              order.id,
              guard.deliveryEventId,
              reversalMovements,
              storedMovements,
            );
            if (!movementGuard.ok) {
              abortWith({ ok: false, code: "storage_stale", message: movementGuard.message });
              return;
            }
            orders.put(order);
            const storedKeys = new Set(storedMovements.map(movement => movement.operationKey));
            reversalMovements
              .filter(movement => !storedKeys.has(movement.operationKey))
              .forEach(movement => movementStore.put(movement));
            committedMovements = committedReversalMovements(reversalMovements, storedMovements);
          };
        };
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () =>
          finish({ ok: true, value: { order, reversalMovements: committedMovements, reused: false } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  listDirectSales() {
    return listAll<DirectSale>(
      directSaleStore,
      (left, right) =>
        right.occurredOn.localeCompare(left.occurredOn) || right.recordedAt.localeCompare(left.recordedAt),
    );
  }
  /* P0 (إرسال متزامن): مفتاح الحتمية يُفحص داخل المعاملة — بيع بنفس المفتاح
   * محفوظ سلفًا يُعاد كما هو فلا يتكرر السجل ولا يتضاعف الكاش. */
  saveDirectSale(sale: DirectSale) {
    return writeOneIdempotent(
      directSaleStore,
      sale,
      existing => existing.id !== sale.id && existing.idempotencyKey === sale.idempotencyKey,
    );
  }
  listSchedules() {
    return listAll<ScheduleEntry>(
      scheduleStore,
      (left, right) =>
        left.scheduledFor.localeCompare(right.scheduledFor) || right.updatedAt.localeCompare(left.updatedAt),
    );
  }
  getSchedule(id: string) {
    return readOne<ScheduleEntry>(scheduleStore, id);
  }
  saveSchedule(schedule: ScheduleEntry) {
    return writeOne(scheduleStore, schedule);
  }
  /* المجموعة ٢ (التحصين الكامل — HIGH-001): إنشاء موعد داخل معاملة واحدة —
   * القراءة والكتابة معًا فلا يُنشأ فوق موعد موجود (المحتوى الحتمي يتقارب)،
   * وإعادة التشغيل تعيد المخزّن كما هو. */
  async commitScheduleCreate(
    schedule: ScheduleEntry,
  ): Promise<StorageResult<{ schedule: ScheduleEntry; reused: boolean }>> {
    try {
      const database = await connection();
      return await new Promise(resolve => {
        const transaction = database.transaction([scheduleStore], "readwrite");
        const schedules = transaction.objectStore(scheduleStore);
        let pending: StorageResult<{ schedule: ScheduleEntry; reused: boolean }> | null = null;
        const finish = (result: StorageResult<{ schedule: ScheduleEntry; reused: boolean }>) => {
          resolve(result);
        };
        const storedRequest = schedules.get(schedule.id);
        storedRequest.onerror = () => {
          pending = failure(storedRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        storedRequest.onsuccess = () => {
          const stored = storedRequest.result as ScheduleEntry | undefined;
          const guard = validateScheduleCreate(stored);
          if (!guard.ok) {
            pending = { ok: false, code: "storage_stale", message: guard.message };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          if (guard.reused) {
            pending = { ok: true, value: { schedule: stored!, reused: true } };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          schedules.put(schedule);
        };
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { schedule, reused: false } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  /* المجموعة ٢ (التحصين الكامل — HIGH-001): تحديث موعد داخل معاملة واحدة —
   * العلاقة تُفحص على الحالة الحية داخل المعاملة (حدث واحد جديد بالضبط
   * والأحداث السابقة حرفية وحقول «قبل» مطابقة)؛ التعارض storage_stale بلا
   * كتابة، وإعادة التشغيل بالمفتاح نفسه تعيد المخزّن. */
  async commitScheduleUpdate(
    schedule: ScheduleEntry,
  ): Promise<StorageResult<{ schedule: ScheduleEntry; reused: boolean }>> {
    try {
      const database = await connection();
      return await new Promise(resolve => {
        const transaction = database.transaction([scheduleStore], "readwrite");
        const schedules = transaction.objectStore(scheduleStore);
        let pending: StorageResult<{ schedule: ScheduleEntry; reused: boolean }> | null = null;
        const finish = (result: StorageResult<{ schedule: ScheduleEntry; reused: boolean }>) => {
          resolve(result);
        };
        const storedRequest = schedules.get(schedule.id);
        storedRequest.onerror = () => {
          pending = failure(storedRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        storedRequest.onsuccess = () => {
          const stored = storedRequest.result as ScheduleEntry | undefined;
          const guard = validateScheduleUpdate(stored, schedule);
          if (!guard.ok) {
            pending = { ok: false, code: "storage_stale", message: guard.message };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          if (guard.reused) {
            pending = { ok: true, value: { schedule: stored!, reused: true } };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          schedules.put(schedule);
        };
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { schedule, reused: false } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  listRecurrences() {
    return listAll<ScheduleRecurrence>(recurrenceStore, (left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    );
  }
  getRecurrence(id: string) {
    return readOne<ScheduleRecurrence>(recurrenceStore, id);
  }
  saveRecurrence(recurrence: ScheduleRecurrence) {
    return writeOne(recurrenceStore, recurrence);
  }
  /* المجموعة ٢ (التحصين الكامل — HIGH-001): التزامن الذرّي لقالب التكرار
   * ومواعيده — الحارس يقرأ الحالة الحية داخل المعاملة نفسها: إنشاء القالب
   * كتابة أولى فقط (إعادة تشغيل تُعاد كما هي)، والإيقاف يمر بقالب نشط ويضيف
   * لكل موعد متأثر حدث «إلغاء» واحدًا بالضبط بمفتاح حتمي. أي تعارض مع مسار
   * متزامن (موعد تأجل أو أُكمل بعد قراءة الخدمة) يُرفض بـ storage_stale
   * ولا يُكتب شيء — لا إعادة كتابة الجدول كاملًا فوق كتابات الآخرين. */
  async commitRecurrence(
    recurrence: ScheduleRecurrence,
    schedules: readonly ScheduleEntry[],
  ): Promise<StorageResult<{ recurrence: ScheduleRecurrence; schedules: readonly ScheduleEntry[] }>> {
    const result: { recurrence: ScheduleRecurrence; schedules: readonly ScheduleEntry[] } = {
      recurrence,
      schedules: [],
    };
    try {
      const database = await connection();
      const settled = await new Promise<StorageResult<null>>(resolve => {
        const transaction = database.transaction([recurrenceStore, scheduleStore], "readwrite");
        const recurrences = transaction.objectStore(recurrenceStore);
        const scheduleObjects = transaction.objectStore(scheduleStore);
        let pending: StorageResult<null> | null = null;
        const finish = (value: StorageResult<null>) => resolve(value);
        const abortWith = (value: StorageResult<null>) => {
          pending = value;
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        /* كل موعد مُمرَّر: غائب يُنشأ (إنشاء أول)، حاضر بمفتاح حدثه الأخير
         * يُعاد كما هو، وحاضر بمحتوى مختلف يمر بعلاقة «حدث واحد جديد» —
         * وإلا تعارض لا كتابة. */
        const writeSchedule = (schedule: ScheduleEntry) => {
          const newEventKey = schedule.events[schedule.events.length - 1]?.idempotencyKey ?? "";
          const storedRequest = scheduleObjects.get(schedule.id);
          storedRequest.onerror = () => {
            if (!pending) pending = failure(storedRequest.error, database);
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
          };
          storedRequest.onsuccess = () => {
            const stored = storedRequest.result as ScheduleEntry | undefined;
            if (stored === undefined) {
              scheduleObjects.put(schedule);
              result.schedules = [...result.schedules, schedule];
              return;
            }
            if (stored.events.some(event => event.idempotencyKey === newEventKey)) {
              result.schedules = [...result.schedules, stored];
              return;
            }
            const guard = validateScheduleUpdate(stored, schedule);
            if (!guard.ok) {
              abortWith({ ok: false, code: "storage_stale", message: guard.message });
              return;
            }
            if (guard.reused) {
              result.schedules = [...result.schedules, stored];
              return;
            }
            scheduleObjects.put(schedule);
            result.schedules = [...result.schedules, schedule];
          };
        };
        const storedRecurrenceRequest = recurrences.get(recurrence.id);
        storedRecurrenceRequest.onerror = () => {
          pending = failure(storedRecurrenceRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        storedRecurrenceRequest.onsuccess = () => {
          const storedRecurrence = storedRecurrenceRequest.result as ScheduleRecurrence | undefined;
          if (storedRecurrence === undefined) {
            /* إنشاء أول: القالب يجب أن يكون جديدًا بنشاط — إعادة تشغيل بمفتاح
             * مختلف أو قالب قائم تعني مسارًا آخر سبقنا. */
            if (recurrence.status !== "active") {
              abortWith({ ok: false, code: "storage_stale", message: RECURRENCE_STALE_MESSAGE });
              return;
            }
            recurrences.put(recurrence);
            result.recurrence = recurrence;
            schedules.forEach(writeSchedule);
            return;
          }
          /* القالب قائم: إعادة استخدام صادقة عند تطابق المفتاح (إنشاء مُعاد
           * أو إيقاف مُعاد)، ورفض تعارضي عند اختلافه. */
          if (storedRecurrence.idempotencyKey !== recurrence.idempotencyKey) {
            abortWith({ ok: false, code: "storage_stale", message: RECURRENCE_STALE_MESSAGE });
            return;
          }
          if (storedRecurrence.status === recurrence.status) {
            result.recurrence = storedRecurrence;
            schedules.forEach(writeSchedule);
            return;
          }
          if (storedRecurrence.status !== "active" || recurrence.status !== "cancelled") {
            abortWith({ ok: false, code: "storage_stale", message: RECURRENCE_STALE_MESSAGE });
            return;
          }
          recurrences.put(recurrence);
          result.recurrence = recurrence;
          schedules.forEach(writeSchedule);
        };
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => {
          if (pending) {
            resolve(pending);
            return;
          }
          resolve(failure(transaction.error, database));
        };
        transaction.oncomplete = () => resolve({ ok: true, value: null });
      });
      if (!settled.ok) return { ok: false, code: settled.code, message: settled.message };
      return { ok: true, value: result };
    } catch (error) {
      return failure(error);
    }
  }
  listFinancialEvents() {
    return listAll<FinancialEvent>(financialEventStore, (left, right) =>
      right.recordedAt.localeCompare(left.recordedAt),
    );
  }
  getFinancialEvent(id: string) {
    return readOne<FinancialEvent>(financialEventStore, id);
  }
  /* P0 (إرسال متزامن): حدث مالي بنفس مفتاح الحتمية محفوظ سلفًا يُعاد كما هو —
   * المفاتيح المتضاربة مرفوضة أصلًا في الخدمة، فلا مسار شرعي لتكرار المفتاح. */
  saveFinancialEvent(event: FinancialEvent) {
    return writeOneIdempotent(
      financialEventStore,
      event,
      existing => existing.id !== event.id && existing.idempotencyKey === event.idempotencyKey,
    );
  }
  async commitFinancialEventCorrection(
    sourceEventId: string,
    reversal: FinancialEvent,
  ): Promise<StorageResult<FinancialEvent>> {
    try {
      const database = await connection();
      return await new Promise(resolve => {
        const transaction = database.transaction(financialEventStore, "readwrite");
        const store = transaction.objectStore(financialEventStore);
        let settled = false;
        let pendingAbortResult: StorageResult<FinancialEvent> | null = null;
        const finish = (result: StorageResult<FinancialEvent>) => {
          if (settled) return;
          settled = true;
          resolve(result);
        };
        const abortWith = (result: StorageResult<FinancialEvent>) => {
          pendingAbortResult = result;
          try {
            transaction.abort();
          } catch {
            finish(result);
          }
        };
        const request = store.getAll();
        request.onerror = () => abortWith(failure(request.error, database));
        request.onsuccess = () => {
          const events = request.result as FinancialEvent[];
          const source = events.find(event => event.id === sourceEventId);
          if (!source) {
            abortWith({
              ok: false,
              code: "storage_error",
              message: "لم يعد الحدث المصدر موجودًا؛ لم يُحفظ التراجع.",
            });
            return;
          }
          if (source.correctionType === "reverse" || source.correctionOfEventId) {
            abortWith({ ok: false, code: "storage_error", message: "لا يمكن التراجع عن حدث تراجع سابق." });
            return;
          }
          const existing = events.find(
            event => event.correctionOfEventId === sourceEventId && event.correctionType === "reverse",
          );
          if (existing) {
            abortWith(
              existing.idempotencyKey === reversal.idempotencyKey
                ? { ok: true, value: existing }
                : {
                    ok: false,
                    code: "storage_error",
                    message: "تعذر حفظ التراجع لأن هذا الحدث تم التراجع عنه سابقًا بمفتاح مختلف.",
                  },
            );
            return;
          }
          if (events.some(event => event.id === reversal.id)) {
            abortWith({
              ok: false,
              code: "storage_error",
              message: "تعذر حفظ التراجع بسبب تعارض هوية محلية.",
            });
            return;
          }
          if (
            reversal.correctionType !== "reverse" ||
            reversal.correctionOfEventId !== source.id ||
            reversal.type !== source.type ||
            reversal.amountMinor !== source.amountMinor ||
            reversal.relatedEventId !== source.relatedEventId ||
            reversal.cashDeltaMinor !== -source.cashDeltaMinor ||
            reversal.payableDeltaMinor !== -source.payableDeltaMinor ||
            reversal.ownerCapitalDeltaMinor !== -source.ownerCapitalDeltaMinor ||
            reversal.operatingExpenseDeltaMinor !== -source.operatingExpenseDeltaMinor
          ) {
            abortWith({
              ok: false,
              code: "storage_error",
              message: "بيانات التراجع لا تطابق الحدث الأصلي؛ لم يتغير السجل.",
            });
            return;
          }
          store.put(reversal);
        };
        transaction.onerror = () => {
          if (!pendingAbortResult) pendingAbortResult = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pendingAbortResult ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: reversal });
      });
    } catch (error) {
      return failure(error);
    }
  }
  /** تعديل موثق ذرّي: التراجع والبديل في معاملة IndexedDB واحدة — لا حالة بينية أبدًا. */
  async commitFinancialEventReplacement(
    sourceEventId: string,
    reversal: FinancialEvent,
    replacement: FinancialEvent,
  ): Promise<StorageResult<{ reversal: FinancialEvent; replacement: FinancialEvent }>> {
    try {
      const database = await connection();
      return await new Promise(resolve => {
        const transaction = database.transaction(financialEventStore, "readwrite");
        const store = transaction.objectStore(financialEventStore);
        let settled = false;
        let pendingAbortResult: StorageResult<{
          reversal: FinancialEvent;
          replacement: FinancialEvent;
        }> | null = null;
        const finish = (result: StorageResult<{ reversal: FinancialEvent; replacement: FinancialEvent }>) => {
          if (settled) return;
          settled = true;
          resolve(result);
        };
        const abortWith = (
          result: StorageResult<{ reversal: FinancialEvent; replacement: FinancialEvent }>,
        ) => {
          pendingAbortResult = result;
          try {
            transaction.abort();
          } catch {
            finish(result);
          }
        };
        const request = store.getAll();
        request.onerror = () => abortWith(failure(request.error, database));
        request.onsuccess = () => {
          const events = request.result as FinancialEvent[];
          const source = events.find(event => event.id === sourceEventId);
          if (!source) {
            abortWith({
              ok: false,
              code: "storage_error",
              message: "لم يعد الحدث الأصلي موجودًا؛ لم يتغير السجل.",
            });
            return;
          }
          if (source.correctionType === "reverse" || source.correctionOfEventId) {
            abortWith({ ok: false, code: "storage_error", message: "لا يمكن التراجع عن حدث تراجع سابق." });
            return;
          }
          const existing = events.find(
            event => event.correctionOfEventId === sourceEventId && event.correctionType === "reverse",
          );
          if (existing) {
            abortWith(
              existing.idempotencyKey === reversal.idempotencyKey
                ? { ok: true, value: { reversal: existing, replacement } }
                : {
                    ok: false,
                    code: "storage_error",
                    message: "تعذر حفظ التعديل لأن هذا الحدث عُدّل سابقًا بمفتاح مختلف.",
                  },
            );
            return;
          }
          if (events.some(event => event.id === reversal.id || event.id === replacement.id)) {
            abortWith({
              ok: false,
              code: "storage_error",
              message: "تعذر حفظ التعديل بسبب تعارض هوية محلية.",
            });
            return;
          }
          if (
            reversal.correctionType !== "reverse" ||
            reversal.correctionOfEventId !== source.id ||
            reversal.type !== source.type ||
            reversal.amountMinor !== source.amountMinor ||
            reversal.cashDeltaMinor !== -source.cashDeltaMinor ||
            reversal.payableDeltaMinor !== -source.payableDeltaMinor ||
            reversal.ownerCapitalDeltaMinor !== -source.ownerCapitalDeltaMinor ||
            reversal.operatingExpenseDeltaMinor !== -source.operatingExpenseDeltaMinor
          ) {
            abortWith({
              ok: false,
              code: "storage_error",
              message: "بيانات التراجع لا تطابق الحدث الأصلي؛ لم يتغير السجل.",
            });
            return;
          }
          store.put(reversal);
          store.put(replacement);
        };
        transaction.onerror = () => {
          if (!pendingAbortResult)
            pendingAbortResult = failure(transaction.error, database) as StorageResult<{
              reversal: FinancialEvent;
              replacement: FinancialEvent;
            }>;
        };
        transaction.onabort = () => finish(pendingAbortResult ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { reversal, replacement } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  listSupplierPurchases() {
    return listAll<SupplierPurchase>(
      supplierPurchaseStore,
      (left, right) =>
        right.purchasedOn.localeCompare(left.purchasedOn) || right.updatedAt.localeCompare(left.updatedAt),
    );
  }
  getSupplierPurchase(id: string) {
    return readOne<SupplierPurchase>(supplierPurchaseStore, id);
  }
  saveSupplierPurchase(purchase: SupplierPurchase) {
    return writeOne(supplierPurchaseStore, purchase);
  }
  /* المجموعة ٢ (التحصين الكامل — HIGH-001): كتابة ذرّية مُحروسة لسجل الشراء —
   * فحص مفتاح الحتمية داخل المعاملة ثم علاقة «عملية مجال واحدة بالضبط» بين
   * المخزّن والوارد؛ التعارض يُرفض بـ storage_stale ولا يُكتب شيء، وإعادة
   * التشغيل بنفس المفتاح تعيد السجل الحالي كما هو. الإنشاء يفحص المفتاح على
   * مستوى المتجر كله (مفتاح الشراء فريد عالميًا في مسار الكتابة). */
  async commitSupplierPurchase(
    commit: SupplierPurchaseCommit,
  ): Promise<StorageResult<{ purchase: SupplierPurchase; reused: boolean }>> {
    try {
      const database = await connection();
      return await new Promise(resolve => {
        const transaction = database.transaction([supplierPurchaseStore], "readwrite");
        const purchases = transaction.objectStore(supplierPurchaseStore);
        let pending: StorageResult<{ purchase: SupplierPurchase; reused: boolean }> | null = null;
        const finish = (result: StorageResult<{ purchase: SupplierPurchase; reused: boolean }>) => {
          resolve(result);
        };
        const settleGuard = (stored: SupplierPurchase | undefined) => {
          const guard = validateSupplierPurchaseCommit(stored, commit);
          if (!guard.ok) {
            pending = { ok: false, code: "storage_stale", message: guard.message };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          if (guard.reused) {
            pending = { ok: true, value: { purchase: stored ?? commit.purchase, reused: true } };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          purchases.put(commit.purchase);
        };
        const storedRequest = purchases.get(commit.purchase.id);
        storedRequest.onerror = () => {
          pending = failure(storedRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        storedRequest.onsuccess = () => {
          const stored = storedRequest.result as SupplierPurchase | undefined;
          if (commit.kind !== "create") {
            settleGuard(stored);
            return;
          }
          /* الإنشاء: مسح المتجر داخل المعاملة — شراء قائم بمفتاح العملية
           * نفسه إعادة تشغيل تُعاد كما هي؛ لا يُبعث سجل ثانٍ بنفس الهوية. */
          const scanRequest = purchases.getAll();
          scanRequest.onerror = () => {
            pending = failure(scanRequest.error, database);
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
          };
          scanRequest.onsuccess = () => {
            const replay = (scanRequest.result as SupplierPurchase[]).find(
              candidate =>
                candidate.idempotencyKey === commit.idempotencyKey && candidate.id !== commit.purchase.id,
            );
            if (replay) {
              pending = { ok: true, value: { purchase: replay, reused: true } };
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
              return;
            }
            settleGuard(stored);
          };
        };
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () =>
          finish({ ok: true, value: { purchase: commit.purchase, reused: false } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  listCashWallets() {
    return listAll<CashWallet>(cashWalletStore, (left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    );
  }
  listCashContinuityEntries() {
    return listAll<CashContinuityEntry>(
      cashContinuityEntryStore,
      (left, right) =>
        left.occurredOn.localeCompare(right.occurredOn) || left.recordedAt.localeCompare(right.recordedAt),
    );
  }
  async commitCashContinuity(
    wallet: CashWallet | null,
    entries: readonly CashContinuityEntry[],
  ): Promise<StorageResult<{ wallet: CashWallet | null; entries: readonly CashContinuityEntry[] }>> {
    try {
      const database = await connection();
      return await new Promise(resolve => {
        const transaction = database.transaction([cashWalletStore, cashContinuityEntryStore], "readwrite");
        const entriesStore = transaction.objectStore(cashContinuityEntryStore);
        /* P0 (إرسال متزامن): مفتاح العملية يُفحص داخل المعاملة — القيد المكرر
         * يُتخطى والمحفظة لا تُكتب إلا مع قيد جديد فعلي (أو تحديث محفظة خالص
         * بلا قيود كإنشاء محفظة). إعادة إرسال نفس العملية لا تضاعف الرصيد
         * ولا تجعل غير الموزع سالبًا. */
        const scanRequest = entriesStore.getAll();
        scanRequest.onerror = () => resolve(failure(scanRequest.error, database));
        scanRequest.onsuccess = () => {
          const existingKeys = new Set(
            (scanRequest.result as CashContinuityEntry[]).map(entry => entry.operationKey),
          );
          const newEntries = entries.filter(entry => !existingKeys.has(entry.operationKey));
          newEntries.forEach(entry => entriesStore.put(entry));
          if (wallet && (newEntries.length > 0 || entries.length === 0)) {
            transaction.objectStore(cashWalletStore).put(wallet);
          }
        };
        transaction.onerror = () => resolve(failure(transaction.error, database));
        transaction.onabort = () => resolve(failure(transaction.error, database));
        transaction.oncomplete = () => {
          resolve({ ok: true, value: { wallet, entries } });
        };
      });
    } catch (error) {
      return failure(error);
    }
  }
  listMaterials() {
    return listAll<Material>(materialStore, (left, right) => left.createdAt.localeCompare(right.createdAt));
  }
  getInventoryActivation() {
    return readOne<InventoryActivation>(inventoryActivationStore, localInventoryActivationId);
  }
  saveInventoryActivation(activation: InventoryActivation) {
    return writeOne(inventoryActivationStore, activation);
  }
  listInventoryMovements() {
    return listAll<InventoryMovement>(
      inventoryMovementStore,
      (left, right) =>
        right.occurredOn.localeCompare(left.occurredOn) || right.recordedAt.localeCompare(left.recordedAt),
    );
  }
  async commitInventory(
    material: Material | null,
    movements: readonly InventoryMovement[],
  ): Promise<StorageResult<{ material: Material | null; movements: readonly InventoryMovement[] }>> {
    try {
      const database = await connection();
      return await new Promise(resolve => {
        const transaction = database.transaction([materialStore, inventoryMovementStore], "readwrite");
        if (material) transaction.objectStore(materialStore).put(material);
        movements.forEach(movement => transaction.objectStore(inventoryMovementStore).put(movement));
        transaction.onerror = () => resolve(failure(transaction.error, database));
        transaction.onabort = () => resolve(failure(transaction.error, database));
        transaction.oncomplete = () => {
          resolve({ ok: true, value: { material, movements } });
        };
      });
    } catch (error) {
      return failure(error);
    }
  }
  listInventoryShortages() {
    return listAll<InventoryShortage>(
      inventoryShortageStore,
      (left, right) =>
        right.occurredOn.localeCompare(left.occurredOn) || right.recordedAt.localeCompare(left.recordedAt),
    );
  }
  /* المجموعة ٢ (عقد ٢٨ / D-027): معاملة ذرّية واحدة على المتاجر الثلاثة —
   * المادة وحركاتها وسجل النقص معًا أو لا شيء. */
  async commitInventoryWithShortage(
    material: Material | null,
    movements: readonly InventoryMovement[],
    shortage: InventoryShortage | null,
  ): Promise<
    StorageResult<{
      material: Material | null;
      movements: readonly InventoryMovement[];
      shortage: InventoryShortage | null;
    }>
  > {
    try {
      const database = await connection();
      return await new Promise(resolve => {
        const transaction = database.transaction(
          [materialStore, inventoryMovementStore, inventoryShortageStore],
          "readwrite",
        );
        if (material) transaction.objectStore(materialStore).put(material);
        movements.forEach(movement => transaction.objectStore(inventoryMovementStore).put(movement));
        if (shortage) transaction.objectStore(inventoryShortageStore).put(shortage);
        transaction.onerror = () => resolve(failure(transaction.error, database));
        transaction.onabort = () => resolve(failure(transaction.error, database));
        transaction.oncomplete = () => {
          resolve({ ok: true, value: { material, movements, shortage } });
        };
      });
    } catch (error) {
      return failure(error);
    }
  }
  /* عقد الإغلاق العميق (العقد ١ — الهدر): حركة مخزون وحدث مالي في معاملة
   * واحدة ذرّية — الحركة وحدث خسارة الهدر غير النقدية معًا أو لا شيء،
   * والتراجع يعكس الاثنين معًا. الحتمية داخل المعاملة بمفتاحي العملية،
   * والمخزّن سلفًا يُعاد كما هو (reused). */
  async commitInventoryWithEvents(
    material: Material | null,
    movements: readonly InventoryMovement[],
    events: readonly FinancialEvent[],
  ): Promise<
    StorageResult<{
      material: Material | null;
      movements: readonly InventoryMovement[];
      events: readonly FinancialEvent[];
      reused: boolean;
    }>
  > {
    try {
      const database = await connection();
      return await new Promise(resolve => {
        const transaction = database.transaction(
          [materialStore, inventoryMovementStore, financialEventStore],
          "readwrite",
        );
        const movementStore = transaction.objectStore(inventoryMovementStore);
        const eventStore = transaction.objectStore(financialEventStore);
        let reused = false;
        let resultMovements: readonly InventoryMovement[] = movements;
        let resultEvents: readonly FinancialEvent[] = events;
        const movementScan = movementStore.getAll();
        movementScan.onerror = () => resolve(failure(movementScan.error, database));
        movementScan.onsuccess = () => {
          const storedMovements = movementScan.result as InventoryMovement[];
          const movementByKey = new Map(
            storedMovements.map(movement => [movement.operationKey, movement] as const),
          );
          resultMovements = movements.map(movement => movementByKey.get(movement.operationKey) ?? movement);
          const newMovements = movements.filter(movement => !movementByKey.has(movement.operationKey));
          const eventScan = eventStore.getAll();
          eventScan.onerror = () => resolve(failure(eventScan.error, database));
          eventScan.onsuccess = () => {
            const storedEvents = eventScan.result as FinancialEvent[];
            const eventByKey = new Map(storedEvents.map(event => [event.idempotencyKey, event] as const));
            resultEvents = events.map(event => eventByKey.get(event.idempotencyKey) ?? event);
            const newEvents = events.filter(event => !eventByKey.has(event.idempotencyKey));
            reused = newMovements.length < movements.length || newEvents.length < events.length;
            if (material) transaction.objectStore(materialStore).put(material);
            newMovements.forEach(movement => movementStore.put(movement));
            newEvents.forEach(event => eventStore.put(event));
          };
        };
        transaction.onerror = () => resolve(failure(transaction.error, database));
        transaction.onabort = () => resolve(failure(transaction.error, database));
        transaction.oncomplete = () => {
          resolve({
            ok: true,
            value: { material, movements: resultMovements, events: resultEvents, reused },
          });
        };
      });
    } catch (error) {
      return failure(error);
    }
  }
  listCatalogItems() {
    return listAll<CatalogItem>(
      catalogItemStore,
      (left, right) => left.name.localeCompare(right.name) || left.createdAt.localeCompare(right.createdAt),
    );
  }
  getCatalogItem(id: string) {
    return readOne<CatalogItem>(catalogItemStore, id);
  }
  saveCatalogItem(item: CatalogItem) {
    return writeOne(catalogItemStore, item);
  }
  listMeasurementUnits() {
    return listAll<MeasurementUnit>(measurementUnitStore, (left, right) =>
      left.nameAr.localeCompare(right.nameAr),
    );
  }
  getMeasurementUnit(id: string) {
    return readOne<MeasurementUnit>(measurementUnitStore, id);
  }
  saveMeasurementUnit(unit: MeasurementUnit) {
    return writeOne(measurementUnitStore, unit);
  }
  listDirectConversions() {
    return listAll<DirectConversion>(directConversionStore, (left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    );
  }
  getDirectConversion(id: string) {
    return readOne<DirectConversion>(directConversionStore, id);
  }
  saveDirectConversion(conversion: DirectConversion) {
    return writeOne(directConversionStore, conversion);
  }
  async listCatalogTemplates(catalogItemId?: string): Promise<StorageResult<readonly CatalogTemplate[]>> {
    const result = await listAll<CatalogTemplate>(
      catalogTemplateStore,
      (left, right) =>
        left.catalogItemId.localeCompare(right.catalogItemId) || right.revision - left.revision,
    );
    return result.ok
      ? {
          ok: true,
          value: result.value.filter(template => !catalogItemId || template.catalogItemId === catalogItemId),
        }
      : result;
  }
  getCatalogTemplate(id: string) {
    return readOne<CatalogTemplate>(catalogTemplateStore, id);
  }
  saveCatalogTemplate(template: CatalogTemplate) {
    return writeOne(catalogTemplateStore, template);
  }
  async commitCatalogTemplateRevision(
    previous: CatalogTemplate,
    next: CatalogTemplate,
  ): Promise<StorageResult<{ previous: CatalogTemplate; next: CatalogTemplate }>> {
    try {
      const database = await connection();
      return await new Promise(resolve => {
        const transaction = database.transaction(catalogTemplateStore, "readwrite");
        const store = transaction.objectStore(catalogTemplateStore);
        let pending: StorageResult<{ previous: CatalogTemplate; next: CatalogTemplate }> | null = null;
        const finish = (result: StorageResult<{ previous: CatalogTemplate; next: CatalogTemplate }>) => {
          resolve(result);
        };
        const request = store.getAll();
        request.onerror = () => {
          pending = failure(request.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        request.onsuccess = () => {
          const templates = request.result as CatalogTemplate[];
          const current = templates.find(template => template.id === previous.id);
          const repeated = templates.find(
            template => template.createdOperationKey === next.createdOperationKey,
          );
          if (repeated) {
            pending = { ok: true, value: { previous: current ?? previous, next: repeated } };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          if (!current || !current.active) {
            pending = {
              ok: false,
              code: "storage_error",
              message: "لم يعد القالب السابق فعالًا؛ لم تُحفظ النسخة الجديدة.",
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          if (templates.some(template => template.id === next.id)) {
            pending = {
              ok: false,
              code: "storage_error",
              message: "تعارض هوية نسخة القالب؛ لم تتغير البيانات.",
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          store.put(previous);
          store.put(next);
        };
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { previous, next } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  listActualTimeRecords() {
    return listAll<ActualTimeRecord>(
      actualTimeStore,
      (left, right) =>
        right.recordedOn.localeCompare(left.recordedOn) || right.createdAt.localeCompare(left.createdAt),
    );
  }
  getActualTimeRecord(id: string) {
    return readOne<ActualTimeRecord>(actualTimeStore, id);
  }
  saveActualTimeRecord(record: ActualTimeRecord) {
    return writeOne(actualTimeStore, record);
  }
  listShortCashDeclarations() {
    return listAll<ShortCashDeclaration>(shortCashDeclarationStore, (left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  }
  async listAllocationPolicies(catalogItemId?: string): Promise<StorageResult<readonly AllocationPolicy[]>> {
    const result = await listAll<AllocationPolicy>(
      allocationPolicyStore,
      (left, right) => right.startsOn.localeCompare(left.startsOn) || right.version - left.version,
    );
    return result.ok
      ? {
          ok: true,
          value: result.value.filter(policy => !catalogItemId || policy.catalogItemId === catalogItemId),
        }
      : result;
  }
  getAllocationPolicy(id: string) {
    return readOne<AllocationPolicy>(allocationPolicyStore, id);
  }
  saveAllocationPolicy(policy: AllocationPolicy) {
    return writeOne(allocationPolicyStore, policy);
  }
  listCostEstimates() {
    return listAll<CostEstimate>(
      costEstimateStore,
      (left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id),
    );
  }
  getCostEstimate(id: string) {
    return readOne<CostEstimate>(costEstimateStore, id);
  }
  saveCostEstimate(estimate: CostEstimate) {
    return writeOne(costEstimateStore, estimate);
  }
  deleteCostEstimate(id: string) {
    return deleteOne(costEstimateStore, id);
  }
  async commitAllocationPolicySuccessor(
    previous: AllocationPolicy,
    successor: AllocationPolicy,
  ): Promise<StorageResult<{ previous: AllocationPolicy; successor: AllocationPolicy }>> {
    try {
      const database = await connection();
      return await new Promise(resolve => {
        const transaction = database.transaction(allocationPolicyStore, "readwrite");
        const store = transaction.objectStore(allocationPolicyStore);
        let pending: StorageResult<{ previous: AllocationPolicy; successor: AllocationPolicy }> | null = null;
        const finish = (
          result: StorageResult<{ previous: AllocationPolicy; successor: AllocationPolicy }>,
        ) => {
          resolve(result);
        };
        const request = store.getAll();
        request.onerror = () => {
          pending = failure(request.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        request.onsuccess = () => {
          const policies = request.result as AllocationPolicy[];
          const repeated = policies.find(policy => policy.idempotencyKey === successor.idempotencyKey);
          if (repeated) {
            pending = {
              ok: true,
              value: {
                previous: policies.find(policy => policy.id === previous.id) ?? previous,
                successor: repeated,
              },
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          const current = policies.find(policy => policy.id === previous.id);
          if (!current || current.status !== "active") {
            pending = {
              ok: false,
              code: "storage_error",
              message: "لم تعد سياسة التوزيع الأصلية فعالة؛ لم يتغير أي شيء.",
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          if (policies.some(policy => policy.id === successor.id)) {
            pending = {
              ok: false,
              code: "storage_error",
              message: "تعارض هوية نسخة سياسة التوزيع؛ لم تتغير البيانات.",
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          store.put(previous);
          store.put(successor);
        };
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { previous, successor } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  getShortCashDeclaration(id: string) {
    return readOne<ShortCashDeclaration>(shortCashDeclarationStore, id);
  }
  saveShortCashDeclaration(declaration: ShortCashDeclaration) {
    return writeOne(shortCashDeclarationStore, declaration);
  }
  async commitShortCashDeclarationReversal(
    sourceId: string,
    reversal: ShortCashDeclaration,
  ): Promise<StorageResult<ShortCashDeclaration>> {
    try {
      const database = await connection();
      return await new Promise(resolve => {
        const transaction = database.transaction(shortCashDeclarationStore, "readwrite");
        const store = transaction.objectStore(shortCashDeclarationStore);
        let pending: StorageResult<ShortCashDeclaration> | null = null;
        const finish = (result: StorageResult<ShortCashDeclaration>) => {
          resolve(result);
        };
        const request = store.getAll();
        request.onerror = () => {
          pending = failure(request.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        request.onsuccess = () => {
          const declarations = request.result as ShortCashDeclaration[];
          const source = declarations.find(
            candidate => candidate.id === sourceId && candidate.kind === "declaration",
          );
          if (!source) {
            pending = {
              ok: false,
              code: "storage_error",
              message: "لم يعد السجل الأصلي موجودًا؛ لم يُحفظ التراجع.",
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          const existing = declarations.find(
            candidate => candidate.kind === "reversal" && candidate.reversalOfId === sourceId,
          );
          if (existing) {
            pending =
              existing.idempotencyKey === reversal.idempotencyKey
                ? { ok: true, value: existing }
                : {
                    ok: false,
                    code: "storage_error",
                    message: "تم التراجع عن هذا السجل المتوقع سابقًا بمفتاح مختلف؛ لم يتغير السجل.",
                  };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          const repeated = declarations.find(
            candidate =>
              candidate.kind === "reversal" && candidate.idempotencyKey === reversal.idempotencyKey,
          );
          if (repeated) {
            pending = { ok: true, value: repeated };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          if (declarations.some(candidate => candidate.id === reversal.id)) {
            pending = {
              ok: false,
              code: "storage_error",
              message: "تعارض هوية التراجع عن السجل المتوقع؛ لم يتغير السجل.",
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          store.put(reversal);
        };
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: reversal });
      });
    } catch (error) {
      return failure(error);
    }
  }
  listOwnerEntitlementPolicies() {
    return listAll<OwnerEntitlementPolicy>(
      ownerEntitlementPolicyStore,
      (left, right) => right.startsOn.localeCompare(left.startsOn) || right.version - left.version,
    );
  }
  getOwnerEntitlementPolicy(id: string) {
    return readOne<OwnerEntitlementPolicy>(ownerEntitlementPolicyStore, id);
  }
  saveOwnerEntitlementPolicy(policy: OwnerEntitlementPolicy) {
    return writeOne(ownerEntitlementPolicyStore, policy);
  }
  async commitOwnerEntitlementPolicySuccessor(
    previous: OwnerEntitlementPolicy,
    successor: OwnerEntitlementPolicy,
  ): Promise<StorageResult<{ previous: OwnerEntitlementPolicy; successor: OwnerEntitlementPolicy }>> {
    try {
      const database = await connection();
      return await new Promise(resolve => {
        const transaction = database.transaction(ownerEntitlementPolicyStore, "readwrite");
        const store = transaction.objectStore(ownerEntitlementPolicyStore);
        let pending: StorageResult<{
          previous: OwnerEntitlementPolicy;
          successor: OwnerEntitlementPolicy;
        }> | null = null;
        const finish = (
          result: StorageResult<{ previous: OwnerEntitlementPolicy; successor: OwnerEntitlementPolicy }>,
        ) => {
          resolve(result);
        };
        const request = store.getAll();
        request.onerror = () => {
          pending = failure(request.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        request.onsuccess = () => {
          const policies = request.result as OwnerEntitlementPolicy[];
          const repeated = policies.find(policy => policy.idempotencyKey === successor.idempotencyKey);
          if (repeated) {
            const current = policies.find(policy => policy.id === previous.id) ?? previous;
            pending = { ok: true, value: { previous: current, successor: repeated } };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          const current = policies.find(policy => policy.id === previous.id);
          if (!current || current.status !== "active") {
            pending = {
              ok: false,
              code: "storage_error",
              message: "لم تعد السياسة الأصلية فعالة؛ لم تُحفظ النسخة الجديدة.",
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          if (policies.some(policy => policy.id === successor.id)) {
            pending = {
              ok: false,
              code: "storage_error",
              message: "تعارض هوية النسخة الجديدة من السياسة؛ لم يتغير أي شيء.",
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          store.put(previous);
          store.put(successor);
        };
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { previous, successor } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  listOwnerEntitlementRecords() {
    return listAll<OwnerEntitlementRecord>(
      ownerEntitlementRecordStore,
      (left, right) =>
        right.occurredOn.localeCompare(left.occurredOn) || right.recordedAt.localeCompare(left.recordedAt),
    );
  }
  getOwnerEntitlementRecord(id: string) {
    return readOne<OwnerEntitlementRecord>(ownerEntitlementRecordStore, id);
  }
  saveOwnerEntitlementRecord(record: OwnerEntitlementRecord) {
    return writeOne(ownerEntitlementRecordStore, record);
  }
  async commitOwnerEntitlementRecordReversal(
    sourceId: string,
    reversal: OwnerEntitlementRecord,
  ): Promise<StorageResult<OwnerEntitlementRecord>> {
    try {
      const database = await connection();
      return await new Promise(resolve => {
        const transaction = database.transaction(ownerEntitlementRecordStore, "readwrite");
        const store = transaction.objectStore(ownerEntitlementRecordStore);
        let pending: StorageResult<OwnerEntitlementRecord> | null = null;
        const finish = (result: StorageResult<OwnerEntitlementRecord>) => {
          resolve(result);
        };
        const request = store.getAll();
        request.onerror = () => {
          pending = failure(request.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        request.onsuccess = () => {
          const records = request.result as OwnerEntitlementRecord[];
          const source = records.find(record => record.id === sourceId);
          if (!source) {
            pending = {
              ok: false,
              code: "storage_error",
              message: "لم يعد سجل الحق المصدر موجودًا؛ لم يُحفظ التراجع.",
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          const existing = records.find(record => record.reversalOfId === sourceId);
          if (existing) {
            pending =
              existing.idempotencyKey === reversal.idempotencyKey
                ? { ok: true, value: existing }
                : {
                    ok: false,
                    code: "storage_error",
                    message: "التراجع عن الحق موجود بمفتاح مختلف؛ لم تتغير البيانات.",
                  };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          if (records.some(record => record.id === reversal.id)) {
            pending = {
              ok: false,
              code: "storage_error",
              message: "تعارض هوية التراجع عن الحق؛ لم تتغير البيانات.",
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          store.put(reversal);
        };
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: reversal });
      });
    } catch (error) {
      return failure(error);
    }
  }
  listOwnerEntitlementOpeningBalances() {
    return listAll<OwnerEntitlementOpeningBalance>(
      ownerEntitlementOpeningBalanceStore,
      (left, right) =>
        right.occurredOn.localeCompare(left.occurredOn) || right.recordedAt.localeCompare(left.recordedAt),
    );
  }
  saveOwnerEntitlementOpeningBalance(balance: OwnerEntitlementOpeningBalance) {
    return writeOne(ownerEntitlementOpeningBalanceStore, balance);
  }
  async commitOwnerEntitlementOpeningBalanceReversal(
    sourceId: string,
    reversal: OwnerEntitlementOpeningBalance,
  ): Promise<StorageResult<OwnerEntitlementOpeningBalance>> {
    try {
      const database = await connection();
      return await new Promise(resolve => {
        const transaction = database.transaction(ownerEntitlementOpeningBalanceStore, "readwrite");
        const store = transaction.objectStore(ownerEntitlementOpeningBalanceStore);
        let pending: StorageResult<OwnerEntitlementOpeningBalance> | null = null;
        const finish = (result: StorageResult<OwnerEntitlementOpeningBalance>) => {
          resolve(result);
        };
        const request = store.getAll();
        request.onerror = () => {
          pending = failure(request.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        request.onsuccess = () => {
          const balances = request.result as OwnerEntitlementOpeningBalance[];
          const source = balances.find(balance => balance.id === sourceId);
          if (!source) {
            pending = {
              ok: false,
              code: "storage_error",
              message: "لم يعد الرصيد الافتتاحي المصدر موجودًا؛ لم يُحفظ التراجع.",
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          const existing = balances.find(balance => balance.reversalOfId === sourceId);
          if (existing) {
            pending =
              existing.idempotencyKey === reversal.idempotencyKey
                ? { ok: true, value: existing }
                : {
                    ok: false,
                    code: "storage_error",
                    message: "التراجع عن الرصيد الافتتاحي موجود بمفتاح مختلف؛ لم تتغير البيانات.",
                  };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          if (balances.some(balance => balance.id === reversal.id)) {
            pending = {
              ok: false,
              code: "storage_error",
              message: "تعارض هوية التراجع عن الرصيد الافتتاحي؛ لم تتغير البيانات.",
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          store.put(reversal);
        };
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: reversal });
      });
    } catch (error) {
      return failure(error);
    }
  }
  listOwnerMovements() {
    return listAll<OwnerMovement>(ownerMovementStore, (left, right) =>
      right.recordedAt.localeCompare(left.recordedAt),
    );
  }
  getOwnerMovement(id: string) {
    return readOne<OwnerMovement>(ownerMovementStore, id);
  }
  async commitOwnerMovement(
    movement: OwnerMovement,
    cashEntry: CashContinuityEntry,
  ): Promise<StorageResult<{ movement: OwnerMovement; cashEntry: CashContinuityEntry }>> {
    try {
      const database = await connection();
      return await new Promise(resolve => {
        const transaction = database.transaction([ownerMovementStore, cashContinuityEntryStore], "readwrite");
        const movements = transaction.objectStore(ownerMovementStore);
        const cashEntries = transaction.objectStore(cashContinuityEntryStore);
        const existingRequest = movements.getAll();
        let pending: StorageResult<{ movement: OwnerMovement; cashEntry: CashContinuityEntry }> | null = null;
        const finish = (
          result: StorageResult<{ movement: OwnerMovement; cashEntry: CashContinuityEntry }>,
        ) => {
          resolve(result);
        };
        existingRequest.onerror = () => {
          pending = failure(existingRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        existingRequest.onsuccess = () => {
          const existing = (existingRequest.result as OwnerMovement[]).find(
            candidate => candidate.idempotencyKey === movement.idempotencyKey,
          );
          if (existing) {
            const cashRequest = cashEntries.getAll();
            cashRequest.onerror = () => {
              pending = failure(cashRequest.error, database);
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            };
            cashRequest.onsuccess = () => {
              const matching = (cashRequest.result as CashContinuityEntry[]).find(
                entry => entry.operationKey === cashEntry.operationKey,
              );
              if (!matching) {
                pending = {
                  ok: false,
                  code: "storage_error",
                  message: "وجدت حركة مالك بلا أثر كاش مطابق؛ لم يتغير السجل.",
                };
                try {
                  transaction.abort();
                } catch {
                  if (pending) finish(pending);
                }
              } else {
                pending = { ok: true, value: { movement: existing, cashEntry: matching } };
                try {
                  transaction.abort();
                } catch {
                  if (pending) finish(pending);
                }
              }
            };
            return;
          }
          movements.put(movement);
          cashEntries.put(cashEntry);
        };
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { movement, cashEntry } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  async commitOrderFromDraft(
    order: StoredCraftOrder,
    draft: OrderDraft,
    schedule?: ScheduleEntry,
  ): Promise<StorageResult<{ order: StoredCraftOrder; draft: OrderDraft; schedule: ScheduleEntry | null }>> {
    try {
      const database = await connection();
      return await new Promise(resolve => {
        const stores = schedule ? [orderStore, draftStore, scheduleStore] : [orderStore, draftStore];
        const transaction = database.transaction(stores, "readwrite");
        transaction.objectStore(orderStore).put(order);
        transaction.objectStore(draftStore).put(draft);
        if (schedule) transaction.objectStore(scheduleStore).put(schedule);
        transaction.onabort = () => resolve(failure(transaction.error, database));
        transaction.onerror = () => resolve(failure(transaction.error, database));
        transaction.oncomplete = () => {
          resolve({ ok: true, value: { order, draft, schedule: schedule ?? null } });
        };
      });
    } catch (error) {
      return failure(error);
    }
  }
  async readSnapshot(): Promise<StorageResult<LocalStoreSnapshot>> {
    try {
      const database = await connection();
      return await new Promise(resolve => {
        const transaction = database.transaction(
          [
            profileStore,
            ownerProfileStore,
            preferencesStore,
            draftStore,
            orderStore,
            directSaleStore,
            scheduleStore,
            recurrenceStore,
            financialEventStore,
            supplierPurchaseStore,
            cashWalletStore,
            cashContinuityEntryStore,
            materialStore,
            inventoryMovementStore,
            inventoryShortageStore,
            inventoryActivationStore,
            catalogItemStore,
            measurementUnitStore,
            directConversionStore,
            catalogTemplateStore,
            actualTimeStore,
            shortCashDeclarationStore,
            ownerEntitlementPolicyStore,
            ownerEntitlementRecordStore,
            ownerEntitlementOpeningBalanceStore,
            ownerMovementStore,
            allocationPolicyStore,
            costEstimateStore,
            assetStore,
            loanStore,
          ],
          "readonly",
        );
        const profile = transaction.objectStore(profileStore).get("local-profile");
        const ownerProfile = transaction.objectStore(ownerProfileStore).get(localOwnerProfileId);
        const preferences = transaction.objectStore(preferencesStore).get("local-preferences");
        const drafts = transaction.objectStore(draftStore).getAll();
        const orders = transaction.objectStore(orderStore).getAll();
        const directSales = transaction.objectStore(directSaleStore).getAll();
        const schedules = transaction.objectStore(scheduleStore).getAll();
        const recurrences = transaction.objectStore(recurrenceStore).getAll();
        const financialEvents = transaction.objectStore(financialEventStore).getAll();
        const supplierPurchases = transaction.objectStore(supplierPurchaseStore).getAll();
        const cashWallets = transaction.objectStore(cashWalletStore).getAll();
        const cashContinuityEntries = transaction.objectStore(cashContinuityEntryStore).getAll();
        const materials = transaction.objectStore(materialStore).getAll();
        const inventoryMovements = transaction.objectStore(inventoryMovementStore).getAll();
        /* المجموعة ٢ (عقد ٢٨): سجلات النقص جزء من اللقطة — إسقاطها يفقد البيانات عند التصدير. */
        const inventoryShortages = transaction.objectStore(inventoryShortageStore).getAll();
        const inventoryActivation = transaction
          .objectStore(inventoryActivationStore)
          .get(localInventoryActivationId);
        const catalogItems = transaction.objectStore(catalogItemStore).getAll();
        const measurementUnits = transaction.objectStore(measurementUnitStore).getAll();
        const directConversions = transaction.objectStore(directConversionStore).getAll();
        const catalogTemplates = transaction.objectStore(catalogTemplateStore).getAll();
        const actualTimeRecords = transaction.objectStore(actualTimeStore).getAll();
        const shortCashDeclarations = transaction.objectStore(shortCashDeclarationStore).getAll();
        const ownerEntitlementPolicies = transaction.objectStore(ownerEntitlementPolicyStore).getAll();
        const ownerEntitlementRecords = transaction.objectStore(ownerEntitlementRecordStore).getAll();
        const ownerEntitlementOpeningBalances = transaction
          .objectStore(ownerEntitlementOpeningBalanceStore)
          .getAll();
        const ownerMovements = transaction.objectStore(ownerMovementStore).getAll();
        const allocationPolicies = transaction.objectStore(allocationPolicyStore).getAll();
        const costEstimates = transaction.objectStore(costEstimateStore).getAll();
        const assets = transaction.objectStore(assetStore).getAll();
        const loans = transaction.objectStore(loanStore).getAll();
        transaction.onerror = () => resolve(failure(transaction.error, database));
        transaction.onabort = () => resolve(failure(transaction.error, database));
        transaction.oncomplete = () => {
          resolve({
            ok: true,
            value: {
              profile: (profile.result as ActivityProfile | undefined) ?? null,
              ownerProfile: (ownerProfile.result as OwnerProfile | undefined) ?? null,
              preferences: (preferences.result as LocalPreferences | undefined) ?? null,
              drafts: drafts.result as OrderDraft[],
              orders: orders.result as StoredCraftOrder[],
              directSales: directSales.result as DirectSale[],
              schedules: schedules.result as ScheduleEntry[],
              recurrences: recurrences.result as ScheduleRecurrence[],
              financialEvents: financialEvents.result as FinancialEvent[],
              supplierPurchases: supplierPurchases.result as SupplierPurchase[],
              cashWallets: cashWallets.result as CashWallet[],
              cashContinuityEntries: cashContinuityEntries.result as CashContinuityEntry[],
              materials: materials.result as Material[],
              inventoryMovements: inventoryMovements.result as InventoryMovement[],
              inventoryShortages: inventoryShortages.result as InventoryShortage[],
              inventoryActivation: (inventoryActivation.result as InventoryActivation | undefined) ?? null,
              catalogItems: catalogItems.result as CatalogItem[],
              measurementUnits: measurementUnits.result as MeasurementUnit[],
              directConversions: directConversions.result as DirectConversion[],
              catalogTemplates: catalogTemplates.result as CatalogTemplate[],
              actualTimeRecords: actualTimeRecords.result as ActualTimeRecord[],
              shortCashDeclarations: shortCashDeclarations.result as ShortCashDeclaration[],
              ownerEntitlementPolicies: ownerEntitlementPolicies.result as OwnerEntitlementPolicy[],
              ownerEntitlementRecords: ownerEntitlementRecords.result as OwnerEntitlementRecord[],
              ownerEntitlementOpeningBalances:
                ownerEntitlementOpeningBalances.result as OwnerEntitlementOpeningBalance[],
              ownerMovements: ownerMovements.result as OwnerMovement[],
              allocationPolicies: allocationPolicies.result as AllocationPolicy[],
              costEstimates: costEstimates.result as CostEstimate[],
              assets: assets.result as AssetRecord[],
              loans: loans.result as LoanRecord[],
            },
          });
        };
      });
    } catch (error) {
      return failure(error);
    }
  }
  async replaceSnapshot(snapshot: LocalStoreSnapshot): Promise<StorageResult<LocalStoreSnapshot>> {
    try {
      const database = await connection();
      const normalized: LocalStoreSnapshot = {
        ...snapshot,
        ownerProfile: snapshot.ownerProfile ?? null,
        schedules: snapshot.schedules ?? [],
        directSales: snapshot.directSales ?? [],
        recurrences: snapshot.recurrences ?? [],
        financialEvents: snapshot.financialEvents ?? [],
        supplierPurchases: snapshot.supplierPurchases ?? [],
        cashWallets: snapshot.cashWallets ?? [],
        cashContinuityEntries: snapshot.cashContinuityEntries ?? [],
        materials: snapshot.materials ?? [],
        inventoryMovements: snapshot.inventoryMovements ?? [],
        inventoryShortages: snapshot.inventoryShortages ?? [],
        inventoryActivation: snapshot.inventoryActivation ?? null,
        catalogItems: snapshot.catalogItems ?? [],
        measurementUnits: snapshot.measurementUnits ?? [],
        directConversions: snapshot.directConversions ?? [],
        catalogTemplates: snapshot.catalogTemplates ?? [],
        actualTimeRecords: snapshot.actualTimeRecords ?? [],
        shortCashDeclarations: snapshot.shortCashDeclarations ?? [],
        ownerEntitlementPolicies: snapshot.ownerEntitlementPolicies ?? [],
        ownerEntitlementRecords: snapshot.ownerEntitlementRecords ?? [],
        ownerEntitlementOpeningBalances: snapshot.ownerEntitlementOpeningBalances ?? [],
        ownerMovements: snapshot.ownerMovements ?? [],
        allocationPolicies: snapshot.allocationPolicies ?? [],
        costEstimates: snapshot.costEstimates ?? [],
        assets: snapshot.assets ?? [],
        loans: snapshot.loans ?? [],
      };
      return await new Promise(resolve => {
        const transaction = database.transaction(
          [
            profileStore,
            ownerProfileStore,
            preferencesStore,
            draftStore,
            orderStore,
            directSaleStore,
            scheduleStore,
            recurrenceStore,
            financialEventStore,
            supplierPurchaseStore,
            cashWalletStore,
            cashContinuityEntryStore,
            materialStore,
            inventoryMovementStore,
            inventoryActivationStore,
            inventoryShortageStore,
            catalogItemStore,
            measurementUnitStore,
            directConversionStore,
            catalogTemplateStore,
            actualTimeStore,
            shortCashDeclarationStore,
            ownerEntitlementPolicyStore,
            ownerEntitlementRecordStore,
            ownerEntitlementOpeningBalanceStore,
            ownerMovementStore,
            allocationPolicyStore,
            costEstimateStore,
            assetStore,
            loanStore,
          ],
          "readwrite",
        );
        const profiles = transaction.objectStore(profileStore);
        const ownerProfiles = transaction.objectStore(ownerProfileStore);
        const preferences = transaction.objectStore(preferencesStore);
        const drafts = transaction.objectStore(draftStore);
        const orders = transaction.objectStore(orderStore);
        const directSales = transaction.objectStore(directSaleStore);
        const schedules = transaction.objectStore(scheduleStore);
        const recurrences = transaction.objectStore(recurrenceStore);
        const financialEvents = transaction.objectStore(financialEventStore);
        const supplierPurchases = transaction.objectStore(supplierPurchaseStore);
        const cashWallets = transaction.objectStore(cashWalletStore);
        const cashContinuityEntries = transaction.objectStore(cashContinuityEntryStore);
        const materials = transaction.objectStore(materialStore);
        const inventoryMovements = transaction.objectStore(inventoryMovementStore);
        const inventoryShortages = transaction.objectStore(inventoryShortageStore);
        const inventoryActivation = transaction.objectStore(inventoryActivationStore);
        const catalogItems = transaction.objectStore(catalogItemStore);
        const measurementUnits = transaction.objectStore(measurementUnitStore);
        const directConversions = transaction.objectStore(directConversionStore);
        const catalogTemplates = transaction.objectStore(catalogTemplateStore);
        const actualTimeRecords = transaction.objectStore(actualTimeStore);
        const shortCashDeclarations = transaction.objectStore(shortCashDeclarationStore);
        const ownerEntitlementPolicies = transaction.objectStore(ownerEntitlementPolicyStore);
        const ownerEntitlementRecords = transaction.objectStore(ownerEntitlementRecordStore);
        const ownerEntitlementOpeningBalances = transaction.objectStore(ownerEntitlementOpeningBalanceStore);
        const ownerMovements = transaction.objectStore(ownerMovementStore);
        const allocationPolicies = transaction.objectStore(allocationPolicyStore);
        const costEstimates = transaction.objectStore(costEstimateStore);
        const assets = transaction.objectStore(assetStore);
        const loans = transaction.objectStore(loanStore);
        profiles.clear();
        ownerProfiles.clear();
        preferences.clear();
        drafts.clear();
        orders.clear();
        directSales.clear();
        schedules.clear();
        recurrences.clear();
        financialEvents.clear();
        supplierPurchases.clear();
        cashWallets.clear();
        cashContinuityEntries.clear();
        materials.clear();
        inventoryMovements.clear();
        inventoryShortages.clear();
        inventoryActivation.clear();
        catalogItems.clear();
        measurementUnits.clear();
        directConversions.clear();
        catalogTemplates.clear();
        actualTimeRecords.clear();
        shortCashDeclarations.clear();
        ownerEntitlementPolicies.clear();
        ownerEntitlementRecords.clear();
        ownerEntitlementOpeningBalances.clear();
        ownerMovements.clear();
        allocationPolicies.clear();
        costEstimates.clear();
        assets.clear();
        loans.clear();
        if (normalized.profile) profiles.put(normalized.profile);
        if (normalized.ownerProfile) ownerProfiles.put(normalized.ownerProfile);
        if (normalized.preferences) preferences.put(normalized.preferences);
        normalized.drafts.forEach(draft => drafts.put(draft));
        normalized.orders.forEach(order => orders.put(order));
        normalized.directSales?.forEach(sale => directSales.put(sale));
        normalized.schedules.forEach(schedule => schedules.put(schedule));
        normalized.recurrences?.forEach(recurrence => recurrences.put(recurrence));
        normalized.financialEvents.forEach(event => financialEvents.put(event));
        normalized.supplierPurchases?.forEach(purchase => supplierPurchases.put(purchase));
        normalized.cashWallets?.forEach(wallet => cashWallets.put(wallet));
        normalized.cashContinuityEntries?.forEach(entry => cashContinuityEntries.put(entry));
        normalized.materials?.forEach(material => materials.put(material));
        normalized.inventoryMovements?.forEach(movement => inventoryMovements.put(movement));
        /* المجموعة ٢ (عقد ٢٨): تنظيف وكتابة سجلات النقص — «ابدأ من جديد» لا يترك نقصًا قديمًا. */
        normalized.inventoryShortages?.forEach(shortage => inventoryShortages.put(shortage));
        if (normalized.inventoryActivation) inventoryActivation.put(normalized.inventoryActivation);
        normalized.catalogItems?.forEach(item => catalogItems.put(item));
        normalized.measurementUnits?.forEach(unit => measurementUnits.put(unit));
        normalized.directConversions?.forEach(conversion => directConversions.put(conversion));
        normalized.catalogTemplates?.forEach(template => catalogTemplates.put(template));
        normalized.actualTimeRecords?.forEach(record => actualTimeRecords.put(record));
        normalized.shortCashDeclarations?.forEach(declaration => shortCashDeclarations.put(declaration));
        normalized.ownerEntitlementPolicies?.forEach(policy => ownerEntitlementPolicies.put(policy));
        normalized.ownerEntitlementRecords?.forEach(record => ownerEntitlementRecords.put(record));
        normalized.ownerEntitlementOpeningBalances?.forEach(balance =>
          ownerEntitlementOpeningBalances.put(balance),
        );
        normalized.ownerMovements?.forEach(movement => ownerMovements.put(movement));
        normalized.allocationPolicies?.forEach(policy => allocationPolicies.put(policy));
        normalized.costEstimates?.forEach(estimate => costEstimates.put(estimate));
        normalized.assets?.forEach(asset => assets.put(asset));
        normalized.loans?.forEach(loan => loans.put(loan));
        transaction.onerror = () => resolve(failure(transaction.error, database));
        transaction.onabort = () => resolve(failure(transaction.error, database));
        transaction.oncomplete = () => {
          resolve({ ok: true, value: normalized });
        };
      });
    } catch (error) {
      return failure(error);
    }
  }
  /* المجموعة ٤ (عقد ٢٩ — الأصول): قراءة سجل الأصول. */
  listAssets() {
    return listAll<AssetRecord>(
      assetStore,
      (left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
    );
  }
  getAsset(id: string) {
    return readOne<AssetRecord>(assetStore, id);
  }
  /* كتابة ذرّية: سجل الأصل مع حدثه المالي أو بلا حدث (مراجعة عقد) — فحص
   * الهوية داخل المعاملة: الحدث موجود سلفًا أو المراجعة محفوظة → إعادة
   * استخدام صادقة؛ سجل مختلف بمعرف مشغول → رفض لا كتابة فوقه. */
  async commitAssetRecord(
    record: AssetRecord,
    event: FinancialEvent | null,
  ): Promise<StorageResult<{ record: AssetRecord; event: FinancialEvent | null; reused: boolean }>> {
    try {
      const database = await connection();
      return await new Promise(resolve => {
        const transaction = database.transaction([assetStore, financialEventStore], "readwrite");
        const assets = transaction.objectStore(assetStore);
        const events = transaction.objectStore(financialEventStore);
        let pending: StorageResult<{
          record: AssetRecord;
          event: FinancialEvent | null;
          reused: boolean;
        }> | null = null;
        const finish = (
          result: StorageResult<{ record: AssetRecord; event: FinancialEvent | null; reused: boolean }>,
        ) => {
          resolve(result);
        };
        const assetRequest = assets.get(record.id);
        assetRequest.onerror = () => {
          pending = failure(assetRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        assetRequest.onsuccess = () => {
          const existing = assetRequest.result as AssetRecord | undefined;
          const eventCheck = event ? events.get(event.id) : null;
          const proceed = () => {
            if (event) {
              const request = eventCheck!;
              request.onsuccess = () => {
                if (request.result) {
                  pending = {
                    ok: true,
                    value: {
                      record: existing ?? record,
                      event: request.result as FinancialEvent,
                      reused: true,
                    },
                  };
                  try {
                    transaction.abort();
                  } catch {
                    if (pending) finish(pending);
                  }
                  return;
                }
                assets.put(record);
                events.put(event);
              };
              request.onerror = () => {
                pending = failure(request.error, database);
                try {
                  transaction.abort();
                } catch {
                  if (pending) finish(pending);
                }
              };
              return;
            }
            /* مراجعة عقد بلا حدث: المراجعة نفسها محفوظة → إعادة استخدام. */
            if (
              existing &&
              existing.contractRevisions.length >= record.contractRevisions.length &&
              record.contractRevisions.length > 0
            ) {
              pending = { ok: true, value: { record: existing, event: null, reused: true } };
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
              return;
            }
            assets.put(record);
          };
          if (existing && existing.operationKey !== record.operationKey) {
            pending = {
              ok: false,
              code: "storage_error",
              message: "سجل أصل مختلف يحمل هذا المعرف؛ لم يتغير شيء.",
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          proceed();
        };
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { record, event, reused: false } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  /* تصحيح اقتناء أصل: التراجع والبديل والسجل في معاملة واحدة. */
  async commitAssetAcquisitionCorrection(
    record: AssetRecord,
    reversal: FinancialEvent,
    replacement: FinancialEvent,
  ): Promise<
    StorageResult<{
      record: AssetRecord;
      reversal: FinancialEvent;
      replacement: FinancialEvent;
      reused: boolean;
    }>
  > {
    try {
      const database = await connection();
      return await new Promise(resolve => {
        const transaction = database.transaction([assetStore, financialEventStore], "readwrite");
        const assets = transaction.objectStore(assetStore);
        const events = transaction.objectStore(financialEventStore);
        let pending: StorageResult<{
          record: AssetRecord;
          reversal: FinancialEvent;
          replacement: FinancialEvent;
          reused: boolean;
        }> | null = null;
        const finish = (
          result: StorageResult<{
            record: AssetRecord;
            reversal: FinancialEvent;
            replacement: FinancialEvent;
            reused: boolean;
          }>,
        ) => {
          resolve(result);
        };
        const reversalRequest = events.get(reversal.id);
        reversalRequest.onerror = () => {
          pending = failure(reversalRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        reversalRequest.onsuccess = () => {
          if (reversalRequest.result) {
            const replacementRequest = events.get(replacement.id);
            replacementRequest.onsuccess = () => {
              pending = {
                ok: true,
                value: {
                  record,
                  reversal: reversalRequest.result as FinancialEvent,
                  replacement: (replacementRequest.result as FinancialEvent | undefined) ?? replacement,
                  reused: true,
                },
              };
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            };
            replacementRequest.onerror = () => {
              pending = failure(replacementRequest.error, database);
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            };
            return;
          }
          assets.put(record);
          events.put(reversal);
          events.put(replacement);
        };
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () =>
          finish({ ok: true, value: { record, reversal, replacement, reused: false } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  /* المجموعة ٤ (عقد ٢٩ — القروض): قراءة سجل القروض. */
  listLoans() {
    return listAll<LoanRecord>(
      loanStore,
      (left, right) => left.loanDate.localeCompare(right.loanDate) || left.id.localeCompare(right.id),
    );
  }
  getLoan(id: string) {
    return readOne<LoanRecord>(loanStore, id);
  }
  /* كتابة ذرّية: سجل القرض مع حدثه (إنشاء/سداد/تراجع سداد) — الحدث موجود
   * سلفًا أو مفتاحه مستعمل → إعادة استخدام؛ العلاقة بين السجل المخزّن
   * والوارد يجب أن تطابق عملية مجال واحدة (AV-02: تزامن الدفعات)، وإلا
   * يُرفض الالتزام ويبقى السجل والأحداث متسقين. */
  async commitLoanRecord(
    record: LoanRecord,
    event: FinancialEvent,
  ): Promise<StorageResult<{ record: LoanRecord; event: FinancialEvent; reused: boolean }>> {
    try {
      const database = await connection();
      return await new Promise(resolve => {
        const transaction = database.transaction([loanStore, financialEventStore], "readwrite");
        const loans = transaction.objectStore(loanStore);
        const events = transaction.objectStore(financialEventStore);
        let pending: StorageResult<{ record: LoanRecord; event: FinancialEvent; reused: boolean }> | null =
          null;
        const finish = (
          result: StorageResult<{ record: LoanRecord; event: FinancialEvent; reused: boolean }>,
        ) => {
          resolve(result);
        };
        const eventRequest = events.get(event.id);
        eventRequest.onerror = () => {
          pending = failure(eventRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        eventRequest.onsuccess = () => {
          const existingEvent = eventRequest.result as FinancialEvent | undefined;
          if (existingEvent) {
            const loanRequest = loans.get(record.id);
            loanRequest.onsuccess = () => {
              const existingLoan = loanRequest.result as LoanRecord | undefined;
              pending = {
                ok: true,
                value: { record: existingLoan ?? record, event: existingEvent, reused: true },
              };
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            };
            loanRequest.onerror = () => {
              pending = failure(loanRequest.error, database);
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            };
            return;
          }
          /* AV-02 + حتمية المفتاح: مسح الأحداث داخل المعاملة — حدث سابق بنفس
           * مفتاح الحتمية (إعادة تشغيل تراجع/إنشاء بعد نجاح) يُعاد كما هو. */
          const keyScanRequest = events.getAll();
          keyScanRequest.onerror = () => {
            pending = failure(keyScanRequest.error, database);
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
          };
          keyScanRequest.onsuccess = () => {
            const keyReplay = findLoanEventByKey(
              keyScanRequest.result as FinancialEvent[],
              event.idempotencyKey,
              event.id,
            );
            if (keyReplay) {
              const loanRequest = loans.get(record.id);
              loanRequest.onsuccess = () => {
                const existingLoan = loanRequest.result as LoanRecord | undefined;
                pending = {
                  ok: true,
                  value: { record: existingLoan ?? record, event: keyReplay, reused: true },
                };
                try {
                  transaction.abort();
                } catch {
                  if (pending) finish(pending);
                }
              };
              loanRequest.onerror = () => {
                pending = failure(loanRequest.error, database);
                try {
                  transaction.abort();
                } catch {
                  if (pending) finish(pending);
                }
              };
              return;
            }
            /* AV-02: العلاقة بين السجل المخزّن والوارد تُفحص داخل المعاملة —
             * دفعة متزامنة سبقت هذه الكتابة تكسر علاقة «دفعة واحدة بالضبط»
             * فيُرفض الالتزام ويبقى السجل متسقًا مع أحداثه. */
            const loanRequest = loans.get(record.id);
            loanRequest.onsuccess = () => {
              const storedLoan = loanRequest.result as LoanRecord | undefined;
              const relation = validateLoanCommitRelation(storedLoan, record, event);
              if (!relation.ok) {
                pending = { ok: false, code: "storage_stale", message: relation.message };
                try {
                  transaction.abort();
                } catch {
                  if (pending) finish(pending);
                }
                return;
              }
              loans.put(record);
              events.put(event);
            };
            loanRequest.onerror = () => {
              pending = failure(loanRequest.error, database);
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            };
          };
        };
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { record, event, reused: false } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  /* تصحيح قرض: التراجع والبديل والسجل في معاملة واحدة. */
  async commitLoanCorrection(
    record: LoanRecord,
    reversal: FinancialEvent,
    replacement: FinancialEvent,
  ): Promise<
    StorageResult<{
      record: LoanRecord;
      reversal: FinancialEvent;
      replacement: FinancialEvent;
      reused: boolean;
    }>
  > {
    try {
      const database = await connection();
      return await new Promise(resolve => {
        const transaction = database.transaction([loanStore, financialEventStore], "readwrite");
        const loans = transaction.objectStore(loanStore);
        const events = transaction.objectStore(financialEventStore);
        let pending: StorageResult<{
          record: LoanRecord;
          reversal: FinancialEvent;
          replacement: FinancialEvent;
          reused: boolean;
        }> | null = null;
        const finish = (
          result: StorageResult<{
            record: LoanRecord;
            reversal: FinancialEvent;
            replacement: FinancialEvent;
            reused: boolean;
          }>,
        ) => {
          resolve(result);
        };
        const reversalRequest = events.get(reversal.id);
        reversalRequest.onerror = () => {
          pending = failure(reversalRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        reversalRequest.onsuccess = () => {
          if (reversalRequest.result) {
            const replacementRequest = events.get(replacement.id);
            replacementRequest.onsuccess = () => {
              pending = {
                ok: true,
                value: {
                  record,
                  reversal: reversalRequest.result as FinancialEvent,
                  replacement: (replacementRequest.result as FinancialEvent | undefined) ?? replacement,
                  reused: true,
                },
              };
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            };
            replacementRequest.onerror = () => {
              pending = failure(replacementRequest.error, database);
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            };
            return;
          }
          loans.put(record);
          events.put(reversal);
          events.put(replacement);
        };
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () =>
          finish({ ok: true, value: { record, reversal, replacement, reused: false } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  /* المجموعة ٤ (عقد ٢٩ — العربون المحتفظ): تصنيف الطلب وحدثه المالي معًا. */
  async commitDepositClassification(
    order: StoredCraftOrder,
    event: FinancialEvent,
  ): Promise<StorageResult<{ order: StoredCraftOrder; event: FinancialEvent; reused: boolean }>> {
    try {
      const database = await connection();
      return await new Promise(resolve => {
        const transaction = database.transaction([orderStore, financialEventStore], "readwrite");
        const orders = transaction.objectStore(orderStore);
        const events = transaction.objectStore(financialEventStore);
        let pending: StorageResult<{
          order: StoredCraftOrder;
          event: FinancialEvent;
          reused: boolean;
        }> | null = null;
        const finish = (
          result: StorageResult<{ order: StoredCraftOrder; event: FinancialEvent; reused: boolean }>,
        ) => {
          resolve(result);
        };
        const eventRequest = events.get(event.id);
        eventRequest.onerror = () => {
          pending = failure(eventRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        eventRequest.onsuccess = () => {
          const existingEvent = eventRequest.result as FinancialEvent | undefined;
          if (existingEvent) {
            const orderRequest = orders.get(order.id);
            orderRequest.onsuccess = () => {
              const existingOrder = orderRequest.result as StoredCraftOrder | undefined;
              pending = {
                ok: true,
                value: { order: existingOrder ?? order, event: existingEvent, reused: true },
              };
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            };
            orderRequest.onerror = () => {
              pending = failure(orderRequest.error, database);
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            };
            return;
          }
          orders.put(order);
          events.put(event);
        };
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { order, event, reused: false } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  /* تصحيح تصنيف عربون: تراجع الحدث القائم وبديله والطلب معًا. */
  async commitDepositClassificationCorrection(
    order: StoredCraftOrder,
    reversal: FinancialEvent,
    replacement: FinancialEvent,
  ): Promise<
    StorageResult<{
      order: StoredCraftOrder;
      reversal: FinancialEvent;
      replacement: FinancialEvent;
      reused: boolean;
    }>
  > {
    try {
      const database = await connection();
      return await new Promise(resolve => {
        const transaction = database.transaction([orderStore, financialEventStore], "readwrite");
        const orders = transaction.objectStore(orderStore);
        const events = transaction.objectStore(financialEventStore);
        let pending: StorageResult<{
          order: StoredCraftOrder;
          reversal: FinancialEvent;
          replacement: FinancialEvent;
          reused: boolean;
        }> | null = null;
        const finish = (
          result: StorageResult<{
            order: StoredCraftOrder;
            reversal: FinancialEvent;
            replacement: FinancialEvent;
            reused: boolean;
          }>,
        ) => {
          resolve(result);
        };
        const reversalRequest = events.get(reversal.id);
        reversalRequest.onerror = () => {
          pending = failure(reversalRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        reversalRequest.onsuccess = () => {
          if (reversalRequest.result) {
            const replacementRequest = events.get(replacement.id);
            replacementRequest.onsuccess = () => {
              pending = {
                ok: true,
                value: {
                  order,
                  reversal: reversalRequest.result as FinancialEvent,
                  replacement: (replacementRequest.result as FinancialEvent | undefined) ?? replacement,
                  reused: true,
                },
              };
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            };
            replacementRequest.onerror = () => {
              pending = failure(replacementRequest.error, database);
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            };
            return;
          }
          orders.put(order);
          events.put(reversal);
          events.put(replacement);
        };
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () =>
          finish({ ok: true, value: { order, reversal, replacement, reused: false } });
      });
    } catch (error) {
      return failure(error);
    }
  }
}
