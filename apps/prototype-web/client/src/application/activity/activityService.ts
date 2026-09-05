/**
 * المجموعة ٥ (عقد ٣٠ — القارئ الموحّد «آخر ما حدث»): قراءة واحدة لكل نشاط
 * مسجّل في النظام — البيوع والطلبات والتسليم والمصاريف والشراء والقروض والأصول
 * والإهلاك والعربون والتحصيل وتحويل المحافظ وحركات المخزون والهدر والتصحيح.
 *
 * عقد القارئ:
 * - قراءة فقط: لا يكتب شيئًا ولا يُنشئ أي حدث؛ كل التعديلات تمر بخدماتها.
 * - لا محرك حساب ثانٍ: لا يجمع ولا يلخّص؛ أي إجمالي يعرضه المستخدم يأتي من
 *   statement.read()/readRecordedPeriodResult() وحدها (قفل MIC-1).
 * - المجهول يبقى مجهولًا: amountMinor = null يعني «لا رقم صادق» — لا يصير صفرًا.
 * - الأمانات ومال المالك والقروض والأصول والعربون لا تُسمّى ربحًا أبدًا؛
 *   التصنيف (effect) يتبع دلتا الحدث نفسها لا الاسم.
 * - التراجع صفٌّ قائم بنفسه، والأصل المتراجع عنه يظهر بحالة «متراجع» ولا
 *   يختفي من التاريخ.
 */
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
import type { OrderEvent, OrderEventType } from "@micro-domain/craft-order/index.js";
import type { CashContinuityEntry } from "@micro-domain/cash-continuity/index.js";
import type { InventoryMovement, Material } from "@micro-domain/inventory-material/index.js";
import type { DirectSale } from "@micro-domain/direct-sale/index.js";
import type { SupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import type { PrototypeLocalStore, StorageResult, StoredCraftOrder } from "@/storage/local/types";
import { localDateInAmman } from "@/presentation/formatters";

export type ActivityEffectClass =
  "cash_in" | "cash_out" | "non_cash" | "payable" | "owner_money" | "trust" | "pending" | "informational";

export type ActivityFamily =
  | "sale"
  | "order"
  | "delivery"
  | "expense"
  | "purchase_payment"
  | "loan"
  | "asset"
  | "depreciation"
  | "deposit"
  | "collection"
  | "wallet_transfer"
  | "inventory_receipt"
  | "inventory_consumption"
  | "waste"
  | "correction";

export type ActivityStatus = "active" | "reversed" | "cancelled" | "pending";

export type ActivityRecord = {
  /** `${sourceStore}:${recordId}` — هوية صف مستقرة داخل القارئ. */
  id: string;
  family: ActivityFamily;
  /** تفاصيل صفّية: الزبون/المادة/المورد/السبب — أو null. */
  detail: string | null;
  occurredOn: string | null;
  recordedAt: string;
  amountMinor: number | null;
  quantityMilli?: number | null;
  effect: ActivityEffectClass;
  status: ActivityStatus;
  /** هوية الصف الأصلي الذي يصحّحه هذا الصف (بنفس نظام هويات القارئ). */
  reversalOfId: string | null;
  /** رابط المصدر العميق بلا سياق رجوع — الصفحة تضيف ?from بنفسها. */
  sourceHref: string;
  sourceStore: string;
};

export type ActivityReadInput = {
  limit?: number;
  perFamilyLimit?: number;
  from?: string | null;
  to?: string | null;
  families?: readonly ActivityFamily[] | null;
};

const FAMILY_STORE_PREFIX = "financial-events";
const SALE_STORE_PREFIX = "direct-sales";
const ORDER_STORE_PREFIX = "craft-orders";
const PURCHASE_STORE_PREFIX = "supplier-purchases";
const CASH_STORE_PREFIX = "cash-continuity";
const MOVEMENT_STORE_PREFIX = "inventory-movements";

function familyForEventType(type: FinancialEvent["type"]): ActivityFamily {
  switch (type) {
    case "asset_depreciation":
      return "depreciation";
    case "asset_purchase_cash":
    case "asset_purchase_payable":
    case "asset_disposal_cash":
    case "asset_writeoff":
      return "asset";
    case "loan_outgoing_cash":
    case "loan_repayment_cash":
      return "loan";
    case "deposit_retained_revenue":
    case "deposit_retained_owner":
      return "deposit";
    default:
      return "expense";
  }
}

/* التصنيف يتبع دلتا الحدث نفسها (جدول السياسات) لا الاسم — الأمانات ومال
 * المالك تصنيفان صريحان لأن الكاش ليس ربحًا، والمعلّق لا يُختزل إلى رقم. */
function effectForEvent(event: FinancialEvent): ActivityEffectClass {
  if (event.type === "deposit_retained_owner") return "owner_money";
  if (event.type === "deposit_retained_revenue") return "non_cash";
  if (event.type === "owner_investment_cash" || event.type === "owner_withdrawal_cash") return "owner_money";
  if (event.type === "amanah_held_cash" || event.type === "amanah_released_cash") return "trust";
  if (event.type === "operating_expense_payable" || event.type === "asset_purchase_payable") return "payable";
  if (event.cashDeltaMinor > 0) return "cash_in";
  if (event.cashDeltaMinor < 0) return "cash_out";
  if (event.payableDeltaMinor !== 0) return "payable";
  return "non_cash";
}

function hrefForEvent(event: FinancialEvent): string {
  if (event.assetContext?.assetId) return `/assets/${event.assetContext.assetId}`;
  if (event.loanContext?.loanId) return `/loans/${event.loanContext.loanId}`;
  if (event.depositContext?.orderId) return `/orders/${event.depositContext.orderId}`;
  return `/finance?event=${encodeURIComponent(event.id)}`;
}

function statusForEvent(event: FinancialEvent, reversedIds: Set<string>): ActivityStatus {
  if (event.correctionType === "reverse") return "active";
  if (reversedIds.has(event.id)) return "reversed";
  return "active";
}

/** أحداث الطلب: العائلة والأثر بحسب نوع الحدث — القبض كاش، التسليم اعتراف إيراد
 * غير نقدي، الدين ذمم، والتصحيحات عائلتها المستقلة. */
function familyForOrderEvent(type: OrderEventType): ActivityFamily {
  switch (type) {
    case "deposit_collected":
    case "deposit_refunded":
    case "deposit_retained":
    case "deposit_classified":
      return "deposit";
    case "collection_recorded":
      return "collection";
    case "collection_reversed":
    case "price_revised":
    case "delivery_reversed":
      return "correction";
    case "delivery_consumed":
    case "status_changed":
      return "delivery";
    default:
      return "order";
  }
}

function effectForOrderEvent(event: OrderEvent): ActivityEffectClass {
  switch (event.type) {
    case "deposit_collected":
    case "collection_recorded":
      return "cash_in";
    case "deposit_refunded":
      return "cash_out";
    /* مراجعة 5-RV-A: تراجع القبض يُرجع الكاش للزبون — حركة نقد خارجة،
     * لا «توثيقًا فقط»؛ محرك الحقيقة (كشف الفترة) يخصمها فالقارئ يطابقه. */
    case "collection_reversed":
      return "cash_out";
    case "debt_registered":
      return "payable";
    case "deposit_retained":
    case "deposit_classified":
      return "pending";
    default:
      return "informational";
  }
}

function familyForMovement(type: InventoryMovement["type"]): ActivityFamily {
  switch (type) {
    case "consumption":
      return "inventory_consumption";
    case "waste":
      return "waste";
    case "reversal":
      return "correction";
    default:
      return "inventory_receipt";
  }
}

export class ActivityService {
  constructor(private readonly store: PrototypeLocalStore) {}

  async read(input: ActivityReadInput = {}): Promise<StorageResult<readonly ActivityRecord[]>> {
    const limit = input.limit ?? 8;
    const perFamilyLimit = input.perFamilyLimit ?? 5;
    const familyFilter = input.families ? new Set(input.families) : null;
    const inWindow = (occurredOn: string | null): boolean => {
      if (occurredOn === null) return true;
      if (input.from && occurredOn < input.from) return false;
      if (input.to && occurredOn > input.to) return false;
      return true;
    };

    const [
      eventsResult,
      salesResult,
      ordersResult,
      purchasesResult,
      cashResult,
      movementsResult,
      materialsResult,
    ] = await Promise.all([
      this.store.listFinancialEvents(),
      this.store.listDirectSales(),
      this.store.listOrders(),
      this.store.listSupplierPurchases(),
      this.store.listCashContinuityEntries(),
      this.store.listInventoryMovements(),
      this.store.listMaterials(),
    ]);
    if (!eventsResult.ok) return eventsResult;
    if (!salesResult.ok) return salesResult;
    if (!ordersResult.ok) return ordersResult;
    if (!purchasesResult.ok) return purchasesResult;
    if (!cashResult.ok) return cashResult;
    if (!movementsResult.ok) return movementsResult;
    if (!materialsResult.ok) return materialsResult;

    const materialNames = new Map<string, string>(materialsResult.value.map(m => [m.id, m.name]));
    const rows: ActivityRecord[] = [];
    const perFamilyCounts = new Map<ActivityFamily, number>();

    const accept = (record: ActivityRecord): boolean => {
      if (familyFilter && !familyFilter.has(record.family)) return false;
      if (!inWindow(record.occurredOn)) return false;
      const count = perFamilyCounts.get(record.family) ?? 0;
      if (count >= perFamilyLimit) return false;
      perFamilyCounts.set(record.family, count + 1);
      return true;
    };

    this.collectFinancialEvents(rows, eventsResult.value, accept);
    this.collectDirectSales(rows, salesResult.value, accept);
    this.collectOrderEvents(rows, ordersResult.value, accept);
    this.collectPurchasePayments(rows, purchasesResult.value, accept);
    this.collectCashEntries(rows, cashResult.value, accept);
    this.collectMovements(rows, movementsResult.value, materialNames, accept);

    rows.sort((left, right) => {
      const time = right.recordedAt.localeCompare(left.recordedAt);
      return time !== 0 ? time : right.id.localeCompare(left.id);
    });
    return { ok: true, value: rows.slice(0, limit) };
  }

  private collectFinancialEvents(
    rows: ActivityRecord[],
    events: readonly FinancialEvent[],
    accept: (record: ActivityRecord) => boolean,
  ): void {
    const reversedIds = new Set(
      events
        .filter(event => event.correctionType === "reverse")
        .map(event => event.correctionOfEventId ?? ""),
    );
    for (const event of events) {
      const isCorrection = event.correctionType === "reverse";
      const record: ActivityRecord = {
        id: `${FAMILY_STORE_PREFIX}:${event.id}`,
        family: isCorrection ? "correction" : familyForEventType(event.type),
        detail:
          event.correctionReason ??
          event.note ??
          event.counterparty ??
          event.assetContext?.name ??
          event.loanContext?.borrower ??
          null,
        occurredOn: event.occurredOn,
        recordedAt: event.recordedAt,
        amountMinor: event.amountMinor,
        effect: effectForEvent(event),
        status: statusForEvent(event, reversedIds),
        reversalOfId: isCorrection ? `${FAMILY_STORE_PREFIX}:${event.correctionOfEventId ?? ""}` : null,
        sourceHref:
          isCorrection && event.correctionOfEventId
            ? `/finance?event=${encodeURIComponent(event.correctionOfEventId)}`
            : hrefForEvent(event),
        sourceStore: FAMILY_STORE_PREFIX,
      };
      if (accept(record)) rows.push(record);
    }
  }

  private collectDirectSales(
    rows: ActivityRecord[],
    sales: readonly DirectSale[],
    accept: (record: ActivityRecord) => boolean,
  ): void {
    for (const sale of sales) {
      const cancelled = (sale.status ?? "active") === "cancelled";
      const fullyCollected = sale.collectedMinor >= sale.revenueMinor;
      const record: ActivityRecord = {
        id: `${SALE_STORE_PREFIX}:${sale.id}`,
        family: "sale",
        detail: sale.customerName ? `${sale.itemName} — ${sale.customerName}` : sale.itemName,
        occurredOn: sale.occurredOn,
        recordedAt: sale.recordedAt,
        amountMinor: sale.revenueMinor,
        effect: cancelled ? "informational" : fullyCollected ? "cash_in" : "pending",
        status: cancelled ? "cancelled" : "active",
        reversalOfId: null,
        sourceHref: `/direct-sales/${sale.id}`,
        sourceStore: SALE_STORE_PREFIX,
      };
      if (accept(record)) rows.push(record);
      for (const revision of sale.revisions ?? []) {
        const revisionRecord: ActivityRecord = {
          id: `${SALE_STORE_PREFIX}:${sale.id}:revision:${revision.idempotencyKey}`,
          family: "correction",
          detail: revision.reason,
          /* مراجعة 5-RV-A: تاريخ أثر فعلي (بتحويل عمان) لا null — فيحترم
           * نافذة الفترة بدل الظهور في كل النطاقات. */
          occurredOn: localDateInAmman(revision.createdAt),
          recordedAt: revision.createdAt,
          amountMinor: revision.beforeRevenueMinor ?? null,
          effect: "informational",
          status: "active",
          reversalOfId: `${SALE_STORE_PREFIX}:${sale.id}`,
          sourceHref: `/direct-sales/${sale.id}`,
          sourceStore: SALE_STORE_PREFIX,
        };
        if (accept(revisionRecord)) rows.push(revisionRecord);
      }
    }
  }

  private collectOrderEvents(
    rows: ActivityRecord[],
    orders: readonly StoredCraftOrder[],
    accept: (record: ActivityRecord) => boolean,
  ): void {
    for (const stored of orders) {
      /* مراجعة 5-RV-A: الأحداث المتراجع عنها (قبض/تسليم) تُوسَم بدورها
       * «متراجع موثقًا» كما في أحداث المال وحركات المخزون — لا يبقى الأصل
       * «نشطًا» فوق تراجعه. */
      const reversedOrderEventIds = new Set(
        stored.order.events
          .filter(
            event =>
              (event.type === "collection_reversed" || event.type === "delivery_reversed") &&
              event.reversesEventId,
          )
          .map(event => event.reversesEventId as string),
      );
      for (const event of stored.order.events) {
        const occurredOn = localDateInAmman(event.createdAt);
        const record: ActivityRecord = {
          id: `${ORDER_STORE_PREFIX}:${stored.id}:${event.id}`,
          family: familyForOrderEvent(event.type),
          detail: event.note ?? `${stored.order.customerName} — ${stored.order.itemName}`,
          occurredOn,
          recordedAt: event.createdAt,
          amountMinor: event.amountMinor ?? null,
          effect: effectForOrderEvent(event),
          status: reversedOrderEventIds.has(event.id) ? "reversed" : "active",
          reversalOfId:
            (event.type === "collection_reversed" || event.type === "delivery_reversed") &&
            event.reversesEventId
              ? `${ORDER_STORE_PREFIX}:${stored.id}:${event.reversesEventId}`
              : null,
          sourceHref: `/orders/${stored.id}`,
          sourceStore: ORDER_STORE_PREFIX,
        };
        if (accept(record)) rows.push(record);
      }
    }
  }

  private collectPurchasePayments(
    rows: ActivityRecord[],
    purchases: readonly SupplierPurchase[],
    accept: (record: ActivityRecord) => boolean,
  ): void {
    for (const purchase of purchases) {
      /* مراجعة 5-RV-A: الدفعة المتراجع عنها تُوسَم «متراجع موثقًا»، والتراجع
       * يحمل تاريخ أثره الحقيقي (occurredOn) لا null — فيحترم نافذة الفترة
       * بدل الظهور في كل النطاقات بتاريخ «—». */
      const reversedPaymentIds = new Set(
        (purchase.paymentReversals ?? []).map(reversal => reversal.paymentId),
      );
      for (const payment of purchase.payments) {
        const record: ActivityRecord = {
          id: `${PURCHASE_STORE_PREFIX}:${purchase.id}:payment:${payment.id}`,
          family: "purchase_payment",
          detail: `شراء — ${purchase.supplierName}`,
          occurredOn: payment.occurredOn,
          recordedAt: payment.recordedAt,
          amountMinor: payment.amountMinor,
          effect: "cash_out",
          status: reversedPaymentIds.has(payment.id) ? "reversed" : "active",
          reversalOfId: null,
          sourceHref: `/suppliers/purchase/${purchase.id}`,
          sourceStore: PURCHASE_STORE_PREFIX,
        };
        if (accept(record)) rows.push(record);
      }
      for (const reversal of purchase.paymentReversals ?? []) {
        const record: ActivityRecord = {
          id: `${PURCHASE_STORE_PREFIX}:${purchase.id}:payment-reversal:${reversal.id}`,
          family: "correction",
          detail: reversal.reason,
          occurredOn: reversal.occurredOn,
          recordedAt: reversal.recordedAt,
          amountMinor: reversal.amountMinor,
          effect: "cash_in",
          status: "active",
          reversalOfId: `${PURCHASE_STORE_PREFIX}:${purchase.id}:payment:${reversal.paymentId}`,
          sourceHref: `/suppliers/purchase/${purchase.id}`,
          sourceStore: PURCHASE_STORE_PREFIX,
        };
        if (accept(record)) rows.push(record);
      }
    }
  }

  /* تحويلات المحافظ: الساقان سجلان يجمعهما transferId — صف واحد يمثّل التحويل
   * كاملًا (المبلغ موجب والنوع «بين محافظك») فلا يظهر التحويل مرتين ولا يُحسب
   * حركة كاش للنشاط. التعديلات والتراجعات صفوف مستقلة صادقة. */
  private collectCashEntries(
    rows: ActivityRecord[],
    entries: readonly CashContinuityEntry[],
    accept: (record: ActivityRecord) => boolean,
  ): void {
    const seenTransfers = new Set<string>();
    /* مراجعة 5-RV-A: الأصل المتراجع عنه (سطر أو ساق تحويل) يُوسَم «متراجع
     * موثقًا» — بما فيه صف التحويل المجمّع إن عكس أحد ساقيه. */
    const reversedEntryIds = new Set(
      entries
        .filter(entry => entry.type === "reversal" && entry.reversesEntryId)
        .map(entry => entry.reversesEntryId as string),
    );
    const reversedTransferIds = new Set(
      entries
        .filter(
          entry =>
            entry.type === "reversal" &&
            entry.reversesEntryId &&
            !reversedEntryIds.has(entry.id) &&
            (entry.transferId ?? null) !== null &&
            entries.some(
              original =>
                original.transferId === entry.transferId &&
                (original.type === "transfer_out" || original.type === "transfer_in") &&
                original.id === entry.reversesEntryId,
            ),
        )
        .map(entry => entry.transferId as string),
    );
    for (const entry of entries) {
      if ((entry.type === "transfer_out" || entry.type === "transfer_in") && entry.transferId) {
        if (seenTransfers.has(entry.transferId)) continue;
        seenTransfers.add(entry.transferId);
        const record: ActivityRecord = {
          id: `${CASH_STORE_PREFIX}:transfer:${entry.transferId}`,
          family: "wallet_transfer",
          detail: entry.note || null,
          occurredOn: entry.occurredOn,
          recordedAt: entry.recordedAt,
          amountMinor: Math.abs(entry.cashDeltaMinor),
          effect: "informational",
          status: reversedTransferIds.has(entry.transferId) ? "reversed" : "active",
          reversalOfId: null,
          sourceHref: `/cash/wallet/${entry.walletId}`,
          sourceStore: CASH_STORE_PREFIX,
        };
        if (accept(record)) rows.push(record);
        continue;
      }
      if (entry.type === "reversal") {
        const record: ActivityRecord = {
          id: `${CASH_STORE_PREFIX}:${entry.id}`,
          family: "correction",
          detail: entry.reason ?? entry.note,
          occurredOn: entry.occurredOn,
          recordedAt: entry.recordedAt,
          amountMinor: Math.abs(entry.cashDeltaMinor),
          effect: entry.cashDeltaMinor > 0 ? "cash_in" : "cash_out",
          status: "active",
          reversalOfId: entry.reversesEntryId ? `${CASH_STORE_PREFIX}:${entry.reversesEntryId}` : null,
          sourceHref: `/cash/wallet/${entry.walletId}`,
          sourceStore: CASH_STORE_PREFIX,
        };
        if (accept(record)) rows.push(record);
        continue;
      }
      if (entry.type === "cash_adjustment") {
        const record: ActivityRecord = {
          id: `${CASH_STORE_PREFIX}:${entry.id}`,
          family: "wallet_transfer",
          detail: entry.note,
          occurredOn: entry.occurredOn,
          recordedAt: entry.recordedAt,
          amountMinor: Math.abs(entry.cashDeltaMinor),
          effect: entry.cashDeltaMinor > 0 ? "cash_in" : "cash_out",
          status: reversedEntryIds.has(entry.id) ? "reversed" : "active",
          reversalOfId: null,
          sourceHref: `/cash/wallet/${entry.walletId}`,
          sourceStore: CASH_STORE_PREFIX,
        };
        if (accept(record)) rows.push(record);
      }
    }
  }

  private collectMovements(
    rows: ActivityRecord[],
    movements: readonly InventoryMovement[],
    materialNames: Map<string, string>,
    accept: (record: ActivityRecord) => boolean,
  ): void {
    const reversedMovementIds = new Set(
      movements
        .filter(m => m.type === "reversal" && m.reversesMovementId)
        .map(m => m.reversesMovementId ?? ""),
    );
    for (const movement of movements) {
      const materialName = materialNames.get(movement.materialId) ?? null;
      const unknownCost = (movement.costKnowledge ?? "known") === "unknown" && movement.valueDeltaMinor === 0;
      const record: ActivityRecord = {
        id: `${MOVEMENT_STORE_PREFIX}:${movement.id}`,
        family: familyForMovement(movement.type),
        detail: materialName ? `${materialName}${movement.note ? ` — ${movement.note}` : ""}` : movement.note,
        occurredOn: movement.occurredOn,
        recordedAt: movement.recordedAt,
        amountMinor: unknownCost ? null : Math.abs(movement.valueDeltaMinor),
        quantityMilli: Math.abs(movement.quantityDeltaMilli),
        effect: movement.type === "consumption" || movement.type === "waste" ? "non_cash" : "informational",
        status: reversedMovementIds.has(movement.id) ? "reversed" : "active",
        reversalOfId:
          movement.type === "reversal" && movement.reversesMovementId
            ? `${MOVEMENT_STORE_PREFIX}:${movement.reversesMovementId}`
            : null,
        sourceHref: movement.orderId
          ? `/orders/${movement.orderId}`
          : movement.purchaseId
            ? `/suppliers/purchase/${movement.purchaseId}`
            : "/inventory",
        sourceStore: MOVEMENT_STORE_PREFIX,
      };
      if (accept(record)) rows.push(record);
    }
  }
}
