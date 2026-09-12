/** IndexedDB snapshot engine: the readSnapshot/replaceSnapshot transaction
 * orchestration, extracted verbatim from the adapter (Group 10, Phase 10-B,
 * aggregate-internals slice). This is the storage side of every export/import
 * round-trip: one multi-store readonly transaction for the read, one multi-store
 * readwrite transaction with explicit store clears for the replace. Store order,
 * normalization of optional snapshot fields, and failure mapping are unchanged.
 */
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
  type ActivityProfile,
  type CostEstimate,
  type InventoryActivation,
  type LocalPreferences,
  type LocalStoreSnapshot,
  type OrderDraft,
  type OwnerProfile,
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
  cashWalletStore,
  costEstimateStore,
  directConversionStore,
  directSaleStore,
  draftStore,
  financialEventStore,
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
  shortCashDeclarationStore,
  supplierPurchaseStore,
} from "./indexedDbStores";

export async function readIndexedDbSnapshot(): Promise<StorageResult<LocalStoreSnapshot>> {
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

export async function replaceIndexedDbSnapshot(
  snapshot: LocalStoreSnapshot,
): Promise<StorageResult<LocalStoreSnapshot>> {
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
