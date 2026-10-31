/** IndexedDB snapshot engine: the readSnapshot/replaceSnapshot transaction
 * orchestration, extracted verbatim from the adapter (Group 10, Phase 10-B,
 * aggregate-internals slice). This is the storage side of every export/import
 * round-trip: one multi-store readonly transaction for the read, one multi-store
 * readwrite transaction with explicit store clears for the replace. Store order,
 * normalization of optional snapshot fields, and failure mapping are unchanged.
 *
 * S02-A (SH-03 — عقد ٠٤٤ §16.4/§16.5): الاستبدال صار محروسًا داخل حد الكتابة
 * نفسه: (١) مخزن مسودات النماذج (form-drafts) يدخل معاملة الاستبدال فتُمسح
 * المسودات العابرة في الحد الذرّي نفسه مع اللقطة — لا مسح منفصل بعده يمكن
 * أن يفشل وحده؛ (٢) سياج البصمة: عند وجود guard تُقرأ كل المخازن داخل
 * المعاملة نفسها وتُقارن بصمة الحالة الحية بالبصمة المرجوة قبل أي مسح —
 * اختلافها يعني كاتبًا آخر سبق المعاملة فتُحبط المعاملة كاملة بلا أي
 * كتابة (replacement_context_stale)؛ هذا ضمان مخزني داخل الحد لا تعطيل
 * أزرار في الواجهة؛ (٣) قائمة restoreFormDrafts (مسار استرجاع النسخة
 * السابقة وحده) تعيد المسودات المعزولة مع اللقطة القديمة في الحد نفسه.
 */
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
import type { SupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import type {
  CashContinuityEntry,
  CashObservation,
  CashWallet,
} from "@micro-domain/cash-continuity/index.js";
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
import type { ShortCashDeclaration } from "@micro-domain/financial-analysis/index.js";
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
import type { ReceivedLoanRecord } from "@micro-domain/received-loan/index.js";
import type { SavedParty } from "@micro-domain/party/index.js";
import type {
  RecurringExpenseOccurrence,
  RecurringExpenseRuleRevision,
  RecurringExpenseSeries,
} from "@micro-domain/recurring-expense/index.js";
import type { ExpenseBudgetRecord } from "@micro-domain/budget/index.js";
import {
  localInventoryActivationId,
  localOwnerProfileId,
  type ActivityProfile,
  type CostEstimate,
  type FormDraftEnvelope,
  type InventoryActivation,
  type LocalPreferences,
  type LocalStoreSnapshot,
  type OrderDraft,
  type OwnerProfile,
  type ReplacementGuard,
  type ScheduleEntry,
  type ScheduleRecurrence,
  type StorageResult,
  type StoredCraftOrder,
} from "./types";
import { connection, failure } from "./indexedDbLifecycle";
import {
  actualTimeStore,
  allocationPolicyStore,
  assetStore,
  catalogItemStore,
  catalogTemplateStore,
  cashContinuityEntryStore,
  balanceObservationStore,
  counterpartyStore,
  cashWalletStore,
  costEstimateStore,
  directConversionStore,
  directSaleStore,
  draftStore,
  expenseBudgetStore,
  financialEventStore,
  formDraftStore,
  inventoryActivationStore,
  inventoryMovementStore,
  inventoryShortageStore,
  loanStore,
  receivedLoanStore,
  recurringExpenseOccurrenceStore,
  recurringExpenseRevisionStore,
  recurringExpenseSeriesStore,
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
  shortCashDeclarationStore,
  supplierPurchaseStore,
} from "./indexedDbStores";
import { normalizeSnapshotForReplacement } from "./snapshotNormalization";

/** مخازن اللقطة الخمسة والثلاثون بترتيب ثابت — مصدر واحد لقراءة اللقطة
 * ومعاملة الاستبدال كي لا يفترق الترتيب بين المسارين أبدًا. */
const SNAPSHOT_STORES = [
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
  balanceObservationStore,
  counterpartyStore,
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
  receivedLoanStore,
  recurringExpenseSeriesStore,
  recurringExpenseRevisionStore,
  recurringExpenseOccurrenceStore,
  expenseBudgetStore,
] as const;

/** S02-A: معاملات الاستبدال تشمل مخزن المسودات العابرة في الحد نفسه —
 * قفل الكتابة يشمله فلا تكتب نافذة أخرى مسودة فوق استبدال جارٍ. */
const REPLACEMENT_STORES = [...SNAPSHOT_STORES, formDraftStore] as const;

/** إصدار طلبات قراءة اللقطة على معاملة قائمة — الطلب نفسه المستخدم في
 * readSnapshot وفي سياج الاستبدال داخل المعاملة فلا انحراف شكل بين
 * القراءتين أبدًا (البصمة تُقارن فوق الشكل نفسه بالضبط). */
function issueSnapshotReadRequests(transaction: IDBTransaction) {
  return {
    profile: transaction.objectStore(profileStore).get("local-profile"),
    ownerProfile: transaction.objectStore(ownerProfileStore).get(localOwnerProfileId),
    preferences: transaction.objectStore(preferencesStore).get("local-preferences"),
    drafts: transaction.objectStore(draftStore).getAll(),
    orders: transaction.objectStore(orderStore).getAll(),
    directSales: transaction.objectStore(directSaleStore).getAll(),
    schedules: transaction.objectStore(scheduleStore).getAll(),
    recurrences: transaction.objectStore(recurrenceStore).getAll(),
    financialEvents: transaction.objectStore(financialEventStore).getAll(),
    supplierPurchases: transaction.objectStore(supplierPurchaseStore).getAll(),
    cashWallets: transaction.objectStore(cashWalletStore).getAll(),
    cashContinuityEntries: transaction.objectStore(cashContinuityEntryStore).getAll(),
    materials: transaction.objectStore(materialStore).getAll(),
    inventoryMovements: transaction.objectStore(inventoryMovementStore).getAll(),
    /* المجموعة ٢ (عقد ٢٨): سجلات النقص جزء من اللقطة — إسقاطها يفقد البيانات عند التصدير. */
    inventoryShortages: transaction.objectStore(inventoryShortageStore).getAll(),
    inventoryActivation: transaction.objectStore(inventoryActivationStore).get(localInventoryActivationId),
    catalogItems: transaction.objectStore(catalogItemStore).getAll(),
    measurementUnits: transaction.objectStore(measurementUnitStore).getAll(),
    directConversions: transaction.objectStore(directConversionStore).getAll(),
    catalogTemplates: transaction.objectStore(catalogTemplateStore).getAll(),
    actualTimeRecords: transaction.objectStore(actualTimeStore).getAll(),
    shortCashDeclarations: transaction.objectStore(shortCashDeclarationStore).getAll(),
    ownerEntitlementPolicies: transaction.objectStore(ownerEntitlementPolicyStore).getAll(),
    ownerEntitlementRecords: transaction.objectStore(ownerEntitlementRecordStore).getAll(),
    ownerEntitlementOpeningBalances: transaction.objectStore(ownerEntitlementOpeningBalanceStore).getAll(),
    ownerMovements: transaction.objectStore(ownerMovementStore).getAll(),
    allocationPolicies: transaction.objectStore(allocationPolicyStore).getAll(),
    costEstimates: transaction.objectStore(costEstimateStore).getAll(),
    assets: transaction.objectStore(assetStore).getAll(),
    loans: transaction.objectStore(loanStore).getAll(),
    /* FIN-001 (WS-178 — Wave 6): عائلة القروض المستلمة جزء من اللقطة —
     * إسقاطها يفقد الالتزام عند التصدير. */
    receivedLoans: transaction.objectStore(receivedLoanStore).getAll(),
    /* S04 (DOC-013 / UNIT-025): عائلة رصد الأرصدة جزء من اللقطة — إسقاطها
     * يفقد القياس ونطاقه وقطعه عند التصدير. */
    balanceObservations: transaction.objectStore(balanceObservationStore).getAll(),
    /* S05 (DOC-014 / UNIT-037): عائلة الأطراف المحفوظة جزء من اللقطة —
     * إسقاطها يفقد هوية الطرف وروابط المصادر المرتبطة بمعرفه عند التصدير. */
    counterparties: transaction.objectStore(counterpartyStore).getAll(),
    recurringExpenseSeries: transaction.objectStore(recurringExpenseSeriesStore).getAll(),
    recurringExpenseRevisions: transaction.objectStore(recurringExpenseRevisionStore).getAll(),
    recurringExpenseOccurrences: transaction.objectStore(recurringExpenseOccurrenceStore).getAll(),
    /* FIN-002 (عقد ٤٢): عائلة الميزانيات جزء من اللقطة — إسقاطها يفقد الخطة عند التصدير. */
    expenseBudgets: transaction.objectStore(expenseBudgetStore).getAll(),
  };
}

function snapshotFromRequests(requests: ReturnType<typeof issueSnapshotReadRequests>): LocalStoreSnapshot {
  return {
    profile: (requests.profile.result as ActivityProfile | undefined) ?? null,
    ownerProfile: (requests.ownerProfile.result as OwnerProfile | undefined) ?? null,
    preferences: (requests.preferences.result as LocalPreferences | undefined) ?? null,
    drafts: requests.drafts.result as OrderDraft[],
    orders: requests.orders.result as StoredCraftOrder[],
    directSales: requests.directSales.result as DirectSale[],
    schedules: requests.schedules.result as ScheduleEntry[],
    recurrences: requests.recurrences.result as ScheduleRecurrence[],
    financialEvents: requests.financialEvents.result as FinancialEvent[],
    supplierPurchases: requests.supplierPurchases.result as SupplierPurchase[],
    cashWallets: requests.cashWallets.result as CashWallet[],
    cashContinuityEntries: requests.cashContinuityEntries.result as CashContinuityEntry[],
    materials: requests.materials.result as Material[],
    inventoryMovements: requests.inventoryMovements.result as InventoryMovement[],
    inventoryShortages: requests.inventoryShortages.result as InventoryShortage[],
    inventoryActivation: (requests.inventoryActivation.result as InventoryActivation | undefined) ?? null,
    catalogItems: requests.catalogItems.result as CatalogItem[],
    measurementUnits: requests.measurementUnits.result as MeasurementUnit[],
    directConversions: requests.directConversions.result as DirectConversion[],
    catalogTemplates: requests.catalogTemplates.result as CatalogTemplate[],
    actualTimeRecords: requests.actualTimeRecords.result as ActualTimeRecord[],
    shortCashDeclarations: requests.shortCashDeclarations.result as ShortCashDeclaration[],
    ownerEntitlementPolicies: requests.ownerEntitlementPolicies.result as OwnerEntitlementPolicy[],
    ownerEntitlementRecords: requests.ownerEntitlementRecords.result as OwnerEntitlementRecord[],
    ownerEntitlementOpeningBalances: requests.ownerEntitlementOpeningBalances
      .result as OwnerEntitlementOpeningBalance[],
    ownerMovements: requests.ownerMovements.result as OwnerMovement[],
    allocationPolicies: requests.allocationPolicies.result as AllocationPolicy[],
    costEstimates: requests.costEstimates.result as CostEstimate[],
    assets: requests.assets.result as AssetRecord[],
    loans: requests.loans.result as LoanRecord[],
    receivedLoans: requests.receivedLoans.result as ReceivedLoanRecord[],
    balanceObservations: requests.balanceObservations.result as CashObservation[],
    counterparties: requests.counterparties.result as SavedParty[],
    recurringExpenseSeries: requests.recurringExpenseSeries.result as RecurringExpenseSeries[],
    recurringExpenseRevisions: requests.recurringExpenseRevisions.result as RecurringExpenseRuleRevision[],
    recurringExpenseOccurrences: requests.recurringExpenseOccurrences.result as RecurringExpenseOccurrence[],
    expenseBudgets: requests.expenseBudgets.result as ExpenseBudgetRecord[],
  };
}

export async function readIndexedDbSnapshot(): Promise<StorageResult<LocalStoreSnapshot>> {
  try {
    const database = await connection();
    return await new Promise(resolve => {
      const transaction = database.transaction(SNAPSHOT_STORES, "readonly");
      const requests = issueSnapshotReadRequests(transaction);
      transaction.onerror = () => resolve(failure(transaction.error, database));
      transaction.onabort = () => resolve(failure(transaction.error, database));
      transaction.oncomplete = () => {
        resolve({ ok: true, value: snapshotFromRequests(requests) });
      };
    });
  } catch (error) {
    return failure(error);
  }
}

/** سياج الاستبدال داخل المعاملة: كل طلبات القراءة تُصدر تزامنيًا عند بدء
 * المعاملة، وكل رد يخفض العداد؛ عند اكتمال الأخير تُحسب بصمة الحالة الحية
 * وتُقارن بالمرجوة — فالكتابات تُصدر من داخل رد الطلب نفسه (سلسلة تزامنية
 * واحدة) فلا تلتزم المعاملة قبل الحسم، والإحباط يدرج كل شيء في التراجع.
 * onFenceRejected يُستدعى قبل الإحباط ليميز المُنفّذ الخارجي رفض السياج عن
 * فشل تخزيني عادي في رسالة الكود الصادقة. */
function fenceThenWrite(
  transaction: IDBTransaction,
  requests: ReturnType<typeof issueSnapshotReadRequests>,
  guard: ReplacementGuard,
  issueWrites: () => void,
  onFenceRejected: () => void,
): void {
  const keys = Object.keys(requests) as Array<keyof typeof requests>;
  let remaining = keys.length;
  let rejected = false;
  for (const key of keys) {
    requests[key].onsuccess = () => {
      if (rejected) return;
      remaining -= 1;
      if (remaining > 0) return;
      const current = snapshotFromRequests(requests);
      /* S02-A: دالة البصمة تصل عبر السياج من البروتوكول (الشظية الكسولة) —
       * لا استيراد ثابت هنا فتبقى كومة الإقلاع نظيفة. */
      if (guard.digestOf(current) === guard.expectedSnapshotDigest) {
        issueWrites();
      } else {
        rejected = true;
        onFenceRejected();
        try {
          transaction.abort();
        } catch {
          /* المعاملة انتهت فعلًا — لا شيء يُحبَط؛ العلامة تكفي للحسم. */
        }
      }
    };
  }
}

export async function replaceIndexedDbSnapshot(
  snapshot: LocalStoreSnapshot,
  guard?: ReplacementGuard,
): Promise<StorageResult<LocalStoreSnapshot>> {
  try {
    const database = await connection();
    const normalized = normalizeSnapshotForReplacement(snapshot);
    return await new Promise(resolve => {
      const transaction = database.transaction(REPLACEMENT_STORES, "readwrite");
      /* R9-W2 (R9-GA-F1 — جذر عيب عدم-الذرية): أي رمي متزامن أثناء ترتيب
       * الطلبات (clear/put — مثل DataCloneError من استنساخ سجل غير قابل
       * للنسخ) كان يفلت من المُنفّذ قبل تركيب معالجات onerror/onabort،
       * فيُرجِع الوعد فشلًا صادقًا بينما تُكمل المعاملة المُرتّبة إلزامها
       * وتُدمّر الحالة السابقة. العلاج الجذري: إحباط المعاملة صراحةً قبل
       * إعادة رمي الخطأ الأصلي — الإحباط المُحرس يُدرج كل الطلبات
       * المرتّبة في سجل التراجع، والرمي الأصلي يمر كما هو إلى الالتقاط
       * الخارجي فيبقى عقد الفشل (الكود/الرسالة) مطابقًا لسلوك اليوم. */
      let fenceRejected = false;
      try {
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
        const receivedLoans = transaction.objectStore(receivedLoanStore);
        const balanceObservations = transaction.objectStore(balanceObservationStore);
        const counterparties = transaction.objectStore(counterpartyStore);
        const recurringSeries = transaction.objectStore(recurringExpenseSeriesStore);
        const recurringRevisions = transaction.objectStore(recurringExpenseRevisionStore);
        const recurringOccurrences = transaction.objectStore(recurringExpenseOccurrenceStore);
        const expenseBudgets = transaction.objectStore(expenseBudgetStore);
        /* S02-A: مخزن المسودات العابرة داخل الحد — مسح في المعاملة نفسها
         * وإعادة المسودات المعزولة (مسار استرجاع النسخة السابقة وحده). */
        const formDrafts = transaction.objectStore(formDraftStore);
        const issueWrites = () => {
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
          balanceObservations.clear();
          counterparties.clear();
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
          receivedLoans.clear();
          recurringSeries.clear();
          recurringRevisions.clear();
          recurringOccurrences.clear();
          /* FIN-002 (عقد ٤٢): تنظيف وكتابة الميزانيات — الاستبدال لا يترك خطة قديمة. */
          expenseBudgets.clear();
          /* S02-A (عقد ٠٤٤ §16.5): مسح المسودات العابرة داخل الحد الذرّي نفسه
           * — لم يعد مسحًا منفصلًا يمكن أن يفشل وحده بعد نجاح الاستبدال. */
          formDrafts.clear();
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
          normalized.receivedLoans?.forEach(loan => receivedLoans.put(loan));
          normalized.balanceObservations?.forEach(observation => balanceObservations.put(observation));
          /* S05 (DOC-014 / UNIT-037): كتابة الأطراف المحفوظة — الغياب في ملف
           * قديم = لا كتابة طرف (قائمة فارغة) بلا اختراع هوية. */
          normalized.counterparties?.forEach(party => counterparties.put(party));
          normalized.recurringExpenseSeries?.forEach(series => recurringSeries.put(series));
          normalized.recurringExpenseRevisions?.forEach(revision => recurringRevisions.put(revision));
          normalized.recurringExpenseOccurrences?.forEach(occurrence => recurringOccurrences.put(occurrence));
          normalized.expenseBudgets?.forEach(budget => expenseBudgets.put(budget));
          /* S02-A: إعادة المسودات المعزولة مع اللقطة القديمة داخل الحد نفسه —
           * مسار استرجاع النسخة السابقة وحده يمررها (عقد ٠٤٤ B4/B6). */
          guard?.restoreFormDrafts?.forEach(draft => formDrafts.put(draft));
        };
        if (guard) {
          const requests = issueSnapshotReadRequests(transaction);
          fenceThenWrite(transaction, requests, guard, issueWrites, () => {
            fenceRejected = true;
          });
        } else {
          issueWrites();
        }
        transaction.onerror = () => resolve(failure(transaction.error, database));
        transaction.onabort = () => {
          if (fenceRejected)
            resolve({
              ok: false,
              code: "replacement_context_stale",
              message:
                "تغيّرت بيانات هذا الجهاز من مسار آخر بعد مراجعتك — أُلغي الاستبدال ولم يُكتب شيء؛ راجع النسخة مجددًا.",
            });
          else resolve(failure(transaction.error, database));
        };
        transaction.oncomplete = () => {
          resolve({ ok: true, value: normalized });
        };
      } catch (error) {
        /* R9-W2 (R9-GA-F1): الإحباط المحرس — إن كانت المعاملة ما تزال نشطة
         * (لم تكتمل/لم تُحبَط بعد) فإحباطها يُدرج الطلبات المرتّبة في
         * التراجع ويمنع الإلزام الصامت؛ ثم يُعاد رمي الخطأ الأصلي ليصل
         * إلى الالتقاط الخارجي بحمولته الدقيقة (لا نحل محله بخطأ الإحباط). */
        try {
          transaction.abort();
        } catch {
          /* المعاملة انتهت فعلًا — لا شيء يُحبَط ولا شيء يُرتّب. */
        }
        throw error;
      }
    });
  } catch (error) {
    return failure(error);
  }
}
