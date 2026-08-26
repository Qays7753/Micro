/** Test adapter only. It mirrors the LocalStore port without making browser APIs part of application tests. */
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
import type { SupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import type { CashContinuityEntry, CashWallet } from "@micro-domain/cash-continuity/index.js";
import type { InventoryMovement, Material } from "@micro-domain/inventory-material/index.js";
import type { CatalogItem } from "@micro-domain/catalog/index.js";
import type { ActualTimeRecord } from "@micro-domain/actual-time/index.js";
import type { ShortCashDeclaration } from "@micro-domain/g5/index.js";
import type { OwnerEntitlementOpeningBalance, OwnerEntitlementPolicy, OwnerEntitlementRecord, OwnerMovement } from "@micro-domain/owner-entitlement/index.js";
import type { ActivityProfile, LocalPreferences, LocalStoreSnapshot, OrderDraft, PrototypeLocalStore, ScheduleEntry, ScheduleRecurrence, StorageResult, StoredCraftOrder } from "./types";

const clone = <T,>(value: T): T => structuredClone(value);

export class MemoryLocalStore implements PrototypeLocalStore {
  private profile: ActivityProfile | null = null;
  private preferences: LocalPreferences | null = null;
  private drafts = new Map<string, OrderDraft>();
  private orders = new Map<string, StoredCraftOrder>();
  private schedules = new Map<string, ScheduleEntry>();
  private recurrences = new Map<string, ScheduleRecurrence>();
  private financialEvents = new Map<string, FinancialEvent>();
  private supplierPurchases = new Map<string, SupplierPurchase>();
  private cashWallets = new Map<string, CashWallet>();
  private cashContinuityEntries = new Map<string, CashContinuityEntry>();
  private materials = new Map<string, Material>();
  private inventoryMovements = new Map<string, InventoryMovement>();
  private catalogItems = new Map<string, CatalogItem>();
  private actualTimeRecords = new Map<string, ActualTimeRecord>();
  private shortCashDeclarations = new Map<string, ShortCashDeclaration>();
  private ownerEntitlementPolicies = new Map<string, OwnerEntitlementPolicy>();
  private ownerEntitlementRecords = new Map<string, OwnerEntitlementRecord>();
  private ownerEntitlementOpeningBalances = new Map<string, OwnerEntitlementOpeningBalance>();
  private ownerMovements = new Map<string, OwnerMovement>();

  async getProfile(): Promise<StorageResult<ActivityProfile | null>> { return { ok: true, value: this.profile ? clone(this.profile) : null }; }
  async saveProfile(profile: ActivityProfile): Promise<StorageResult<ActivityProfile>> { this.profile = clone(profile); return { ok: true, value: clone(profile) }; }
  async getPreferences(): Promise<StorageResult<LocalPreferences | null>> { return { ok: true, value: this.preferences ? clone(this.preferences) : null }; }
  async savePreferences(preferences: LocalPreferences): Promise<StorageResult<LocalPreferences>> { this.preferences = clone(preferences); return { ok: true, value: clone(preferences) }; }
  async listDrafts(): Promise<StorageResult<readonly OrderDraft[]>> { return { ok: true, value: Array.from(this.drafts.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(clone) }; }
  async getDraft(id: string): Promise<StorageResult<OrderDraft | null>> { const draft = this.drafts.get(id); return { ok: true, value: draft ? clone(draft) : null }; }
  async saveDraft(draft: OrderDraft): Promise<StorageResult<OrderDraft>> { this.drafts.set(draft.id, clone(draft)); return { ok: true, value: clone(draft) }; }
  async listOrders(): Promise<StorageResult<readonly StoredCraftOrder[]>> { return { ok: true, value: Array.from(this.orders.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(clone) }; }
  async getOrder(id: string): Promise<StorageResult<StoredCraftOrder | null>> { const order = this.orders.get(id); return { ok: true, value: order ? clone(order) : null }; }
  async saveOrder(order: StoredCraftOrder): Promise<StorageResult<StoredCraftOrder>> { this.orders.set(order.id, clone(order)); return { ok: true, value: clone(order) }; }
  async listSchedules(): Promise<StorageResult<readonly ScheduleEntry[]>> { return { ok: true, value: Array.from(this.schedules.values()).sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor) || b.updatedAt.localeCompare(a.updatedAt)).map(clone) }; }
  async getSchedule(id: string): Promise<StorageResult<ScheduleEntry | null>> { const schedule = this.schedules.get(id); return { ok: true, value: schedule ? clone(schedule) : null }; }
  async saveSchedule(schedule: ScheduleEntry): Promise<StorageResult<ScheduleEntry>> { this.schedules.set(schedule.id, clone(schedule)); return { ok: true, value: clone(schedule) }; }
  async listRecurrences(): Promise<StorageResult<readonly ScheduleRecurrence[]>> { return { ok: true, value: Array.from(this.recurrences.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(clone) }; }
  async getRecurrence(id: string): Promise<StorageResult<ScheduleRecurrence | null>> { const recurrence = this.recurrences.get(id); return { ok: true, value: recurrence ? clone(recurrence) : null }; }
  async saveRecurrence(recurrence: ScheduleRecurrence): Promise<StorageResult<ScheduleRecurrence>> { this.recurrences.set(recurrence.id, clone(recurrence)); return { ok: true, value: clone(recurrence) }; }
  async commitRecurrence(recurrence: ScheduleRecurrence, schedules: readonly ScheduleEntry[]): Promise<StorageResult<{ recurrence: ScheduleRecurrence; schedules: readonly ScheduleEntry[] }>> { this.recurrences.set(recurrence.id, clone(recurrence)); schedules.forEach((schedule) => this.schedules.set(schedule.id, clone(schedule))); return { ok: true, value: { recurrence: clone(recurrence), schedules: schedules.map(clone) } }; }
  async listFinancialEvents(): Promise<StorageResult<readonly FinancialEvent[]>> { return { ok: true, value: Array.from(this.financialEvents.values()).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)).map(clone) }; }
  async getFinancialEvent(id: string): Promise<StorageResult<FinancialEvent | null>> { const event = this.financialEvents.get(id); return { ok: true, value: event ? clone(event) : null }; }
  async saveFinancialEvent(event: FinancialEvent): Promise<StorageResult<FinancialEvent>> { this.financialEvents.set(event.id, clone(event)); return { ok: true, value: clone(event) }; }
  async commitFinancialEventCorrection(sourceEventId: string, reversal: FinancialEvent): Promise<StorageResult<FinancialEvent>> {
    const source = this.financialEvents.get(sourceEventId);
    if (!source) return { ok: false, code: "storage_error", message: "لم يعد الحدث المصدر موجودًا؛ لم يُحفظ العكس." };
    const existing = Array.from(this.financialEvents.values()).find(event => event.correctionOfEventId === sourceEventId && event.correctionType === "reverse");
    if (existing) return existing.idempotencyKey === reversal.idempotencyKey ? { ok: true, value: clone(existing) } : { ok: false, code: "storage_error", message: "تعذر حفظ العكس لأن الواقعة عُكست سابقًا بمفتاح مختلف." };
    if (this.financialEvents.has(reversal.id)) return { ok: false, code: "storage_error", message: "تعذر حفظ العكس بسبب تعارض هوية محلية." };
    this.financialEvents.set(reversal.id, clone(reversal));
    return { ok: true, value: clone(reversal) };
  }
  async listSupplierPurchases(): Promise<StorageResult<readonly SupplierPurchase[]>> { return { ok: true, value: Array.from(this.supplierPurchases.values()).sort((a, b) => b.purchasedOn.localeCompare(a.purchasedOn) || b.updatedAt.localeCompare(a.updatedAt)).map(clone) }; }
  async getSupplierPurchase(id: string): Promise<StorageResult<SupplierPurchase | null>> { const purchase = this.supplierPurchases.get(id); return { ok: true, value: purchase ? clone(purchase) : null }; }
  async saveSupplierPurchase(purchase: SupplierPurchase): Promise<StorageResult<SupplierPurchase>> { this.supplierPurchases.set(purchase.id, clone(purchase)); return { ok: true, value: clone(purchase) }; }
  async listCashWallets(): Promise<StorageResult<readonly CashWallet[]>> { return { ok: true, value: Array.from(this.cashWallets.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(clone) }; }
  async listCashContinuityEntries(): Promise<StorageResult<readonly CashContinuityEntry[]>> { return { ok: true, value: Array.from(this.cashContinuityEntries.values()).sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.recordedAt.localeCompare(b.recordedAt)).map(clone) }; }
  async commitCashContinuity(wallet: CashWallet | null, entries: readonly CashContinuityEntry[]): Promise<StorageResult<{ wallet: CashWallet | null; entries: readonly CashContinuityEntry[] }>> { if (wallet) this.cashWallets.set(wallet.id, clone(wallet)); entries.forEach((entry) => this.cashContinuityEntries.set(entry.id, clone(entry))); return { ok: true, value: { wallet: wallet ? clone(wallet) : null, entries: entries.map(clone) } }; }
  async listMaterials(): Promise<StorageResult<readonly Material[]>> { return { ok: true, value: Array.from(this.materials.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(clone) }; }
  async listInventoryMovements(): Promise<StorageResult<readonly InventoryMovement[]>> { return { ok: true, value: Array.from(this.inventoryMovements.values()).sort((a, b) => b.occurredOn.localeCompare(a.occurredOn) || b.recordedAt.localeCompare(a.recordedAt)).map(clone) }; }
  async commitInventory(material: Material | null, movements: readonly InventoryMovement[]): Promise<StorageResult<{ material: Material | null; movements: readonly InventoryMovement[] }>> { if (material) this.materials.set(material.id, clone(material)); movements.forEach((movement) => this.inventoryMovements.set(movement.id, clone(movement))); return { ok: true, value: { material: material ? clone(material) : null, movements: movements.map(clone) } }; }
  async listCatalogItems(): Promise<StorageResult<readonly CatalogItem[]>> { return { ok: true, value: Array.from(this.catalogItems.values()).sort((a, b) => a.name.localeCompare(b.name) || a.createdAt.localeCompare(b.createdAt)).map(clone) }; }
  async getCatalogItem(id: string): Promise<StorageResult<CatalogItem | null>> { const item = this.catalogItems.get(id); return { ok: true, value: item ? clone(item) : null }; }
  async saveCatalogItem(item: CatalogItem): Promise<StorageResult<CatalogItem>> { this.catalogItems.set(item.id, clone(item)); return { ok: true, value: clone(item) }; }
  async listActualTimeRecords(): Promise<StorageResult<readonly ActualTimeRecord[]>> { return { ok: true, value: Array.from(this.actualTimeRecords.values()).sort((a, b) => b.recordedOn.localeCompare(a.recordedOn) || b.createdAt.localeCompare(a.createdAt)).map(clone) }; }
  async getActualTimeRecord(id: string): Promise<StorageResult<ActualTimeRecord | null>> { const record = this.actualTimeRecords.get(id); return { ok: true, value: record ? clone(record) : null }; }
  async saveActualTimeRecord(record: ActualTimeRecord): Promise<StorageResult<ActualTimeRecord>> { this.actualTimeRecords.set(record.id, clone(record)); return { ok: true, value: clone(record) }; }
  async listShortCashDeclarations(): Promise<StorageResult<readonly ShortCashDeclaration[]>> { return { ok: true, value: Array.from(this.shortCashDeclarations.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(clone) }; }
  async getShortCashDeclaration(id: string): Promise<StorageResult<ShortCashDeclaration | null>> { const declaration = this.shortCashDeclarations.get(id); return { ok: true, value: declaration ? clone(declaration) : null }; }
  async saveShortCashDeclaration(declaration: ShortCashDeclaration): Promise<StorageResult<ShortCashDeclaration>> { this.shortCashDeclarations.set(declaration.id, clone(declaration)); return { ok: true, value: clone(declaration) }; }
  async listOwnerEntitlementPolicies(): Promise<StorageResult<readonly OwnerEntitlementPolicy[]>> { return { ok: true, value: Array.from(this.ownerEntitlementPolicies.values()).sort((a, b) => b.startsOn.localeCompare(a.startsOn) || b.version - a.version).map(clone) }; }
  async getOwnerEntitlementPolicy(id: string): Promise<StorageResult<OwnerEntitlementPolicy | null>> { const policy = this.ownerEntitlementPolicies.get(id); return { ok: true, value: policy ? clone(policy) : null }; }
  async saveOwnerEntitlementPolicy(policy: OwnerEntitlementPolicy): Promise<StorageResult<OwnerEntitlementPolicy>> { this.ownerEntitlementPolicies.set(policy.id, clone(policy)); return { ok: true, value: clone(policy) }; }
  async listOwnerEntitlementRecords(): Promise<StorageResult<readonly OwnerEntitlementRecord[]>> { return { ok: true, value: Array.from(this.ownerEntitlementRecords.values()).sort((a, b) => b.occurredOn.localeCompare(a.occurredOn) || b.recordedAt.localeCompare(a.recordedAt)).map(clone) }; }
  async getOwnerEntitlementRecord(id: string): Promise<StorageResult<OwnerEntitlementRecord | null>> { const record = this.ownerEntitlementRecords.get(id); return { ok: true, value: record ? clone(record) : null }; }
  async saveOwnerEntitlementRecord(record: OwnerEntitlementRecord): Promise<StorageResult<OwnerEntitlementRecord>> { this.ownerEntitlementRecords.set(record.id, clone(record)); return { ok: true, value: clone(record) }; }
  async listOwnerEntitlementOpeningBalances(): Promise<StorageResult<readonly OwnerEntitlementOpeningBalance[]>> { return { ok: true, value: Array.from(this.ownerEntitlementOpeningBalances.values()).sort((a, b) => b.occurredOn.localeCompare(a.occurredOn) || b.recordedAt.localeCompare(a.recordedAt)).map(clone) }; }
  async saveOwnerEntitlementOpeningBalance(balance: OwnerEntitlementOpeningBalance): Promise<StorageResult<OwnerEntitlementOpeningBalance>> { this.ownerEntitlementOpeningBalances.set(balance.id, clone(balance)); return { ok: true, value: clone(balance) }; }
  async listOwnerMovements(): Promise<StorageResult<readonly OwnerMovement[]>> { return { ok: true, value: Array.from(this.ownerMovements.values()).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)).map(clone) }; }
  async getOwnerMovement(id: string): Promise<StorageResult<OwnerMovement | null>> { const movement = this.ownerMovements.get(id); return { ok: true, value: movement ? clone(movement) : null }; }
  async commitOwnerMovement(movement: OwnerMovement, cashEntry: CashContinuityEntry): Promise<StorageResult<{ movement: OwnerMovement; cashEntry: CashContinuityEntry }>> {
    const existing = Array.from(this.ownerMovements.values()).find((candidate) => candidate.idempotencyKey === movement.idempotencyKey);
    if (existing) { const existingCash = Array.from(this.cashContinuityEntries.values()).find((entry) => entry.operationKey === cashEntry.operationKey); if (!existingCash) return { ok: false, code: "storage_error", message: "وجدت حركة مالك بلا أثر كاش مطابق؛ لم يتغير السجل." }; return { ok: true, value: { movement: clone(existing), cashEntry: clone(existingCash) } }; }
    if (this.ownerMovements.has(movement.id) || this.cashContinuityEntries.has(cashEntry.id)) return { ok: false, code: "storage_error", message: "تعارض هوية محلية؛ لم تُحفظ حركة المالك." };
    this.ownerMovements.set(movement.id, clone(movement)); this.cashContinuityEntries.set(cashEntry.id, clone(cashEntry));
    return { ok: true, value: { movement: clone(movement), cashEntry: clone(cashEntry) } };
  }
  async commitOrderFromDraft(order: StoredCraftOrder, draft: OrderDraft, schedule?: ScheduleEntry): Promise<StorageResult<{ order: StoredCraftOrder; draft: OrderDraft; schedule: ScheduleEntry | null }>> { this.orders.set(order.id, clone(order)); this.drafts.set(draft.id, clone(draft)); if (schedule) this.schedules.set(schedule.id, clone(schedule)); return { ok: true, value: { order: clone(order), draft: clone(draft), schedule: schedule ? clone(schedule) : null } }; }
  async readSnapshot(): Promise<StorageResult<LocalStoreSnapshot>> { return { ok: true, value: { profile: this.profile ? clone(this.profile) : null, preferences: this.preferences ? clone(this.preferences) : null, drafts: Array.from(this.drafts.values()).map(clone), orders: Array.from(this.orders.values()).map(clone), schedules: Array.from(this.schedules.values()).map(clone), recurrences: Array.from(this.recurrences.values()).map(clone), financialEvents: Array.from(this.financialEvents.values()).map(clone), supplierPurchases: Array.from(this.supplierPurchases.values()).map(clone), cashWallets: Array.from(this.cashWallets.values()).map(clone), cashContinuityEntries: Array.from(this.cashContinuityEntries.values()).map(clone), materials: Array.from(this.materials.values()).map(clone), inventoryMovements: Array.from(this.inventoryMovements.values()).map(clone), catalogItems: Array.from(this.catalogItems.values()).map(clone), actualTimeRecords: Array.from(this.actualTimeRecords.values()).map(clone), shortCashDeclarations: Array.from(this.shortCashDeclarations.values()).map(clone), ownerEntitlementPolicies: Array.from(this.ownerEntitlementPolicies.values()).map(clone), ownerEntitlementRecords: Array.from(this.ownerEntitlementRecords.values()).map(clone), ownerEntitlementOpeningBalances: Array.from(this.ownerEntitlementOpeningBalances.values()).map(clone), ownerMovements: Array.from(this.ownerMovements.values()).map(clone) } }; }
  async replaceSnapshot(snapshot: LocalStoreSnapshot): Promise<StorageResult<LocalStoreSnapshot>> { const safe = clone({ ...snapshot, schedules: snapshot.schedules ?? [], recurrences: snapshot.recurrences ?? [], financialEvents: snapshot.financialEvents ?? [], supplierPurchases: snapshot.supplierPurchases ?? [], cashWallets: snapshot.cashWallets ?? [], cashContinuityEntries: snapshot.cashContinuityEntries ?? [], materials: snapshot.materials ?? [], inventoryMovements: snapshot.inventoryMovements ?? [], catalogItems: snapshot.catalogItems ?? [], actualTimeRecords: snapshot.actualTimeRecords ?? [], shortCashDeclarations: snapshot.shortCashDeclarations ?? [], ownerEntitlementPolicies: snapshot.ownerEntitlementPolicies ?? [], ownerEntitlementRecords: snapshot.ownerEntitlementRecords ?? [], ownerEntitlementOpeningBalances: snapshot.ownerEntitlementOpeningBalances ?? [], ownerMovements: snapshot.ownerMovements ?? [] }); this.profile = safe.profile; this.preferences = safe.preferences; this.drafts = new Map(safe.drafts.map(draft => [draft.id, draft])); this.orders = new Map(safe.orders.map(order => [order.id, order])); this.schedules = new Map(safe.schedules.map(schedule => [schedule.id, schedule])); this.recurrences = new Map((safe.recurrences ?? []).map(recurrence => [recurrence.id, recurrence])); this.financialEvents = new Map(safe.financialEvents.map(event => [event.id, event])); this.supplierPurchases = new Map(safe.supplierPurchases.map(purchase => [purchase.id, purchase])); this.cashWallets = new Map(safe.cashWallets.map(wallet => [wallet.id, wallet])); this.cashContinuityEntries = new Map(safe.cashContinuityEntries.map(entry => [entry.id, entry])); this.materials = new Map(safe.materials.map(material => [material.id, material])); this.inventoryMovements = new Map(safe.inventoryMovements.map(movement => [movement.id, movement])); this.catalogItems = new Map(safe.catalogItems.map(item => [item.id, item])); this.actualTimeRecords = new Map(safe.actualTimeRecords.map(record => [record.id, record])); this.shortCashDeclarations = new Map((safe.shortCashDeclarations ?? []).map(declaration => [declaration.id, declaration])); this.ownerEntitlementPolicies = new Map((safe.ownerEntitlementPolicies ?? []).map(policy => [policy.id, policy])); this.ownerEntitlementRecords = new Map((safe.ownerEntitlementRecords ?? []).map(record => [record.id, record])); this.ownerEntitlementOpeningBalances = new Map((safe.ownerEntitlementOpeningBalances ?? []).map(balance => [balance.id, balance])); this.ownerMovements = new Map((safe.ownerMovements ?? []).map(movement => [movement.id, movement])); return { ok: true, value: clone(safe) }; }
}
