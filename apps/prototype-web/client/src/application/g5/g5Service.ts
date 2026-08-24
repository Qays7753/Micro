import { calculateBreakEven, calculateShortCash, createShortCashDeclaration, createShortCashReversal, type BreakEvenResult, type G5ExpenseInput, type G5OrderInput, type ShortCashDeclaration, type ShortCashResult } from "@micro-domain/g5/index.js";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
import type { SupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import type { PrototypeLocalStore, StoredCraftOrder } from "@/storage/local/types";
import type { ProjectFinancialService } from "@/application/finance/projectFinancialService";

export type G5Decision = { period: BreakEvenResult; shortCash: ShortCashResult; declarations: readonly ShortCashDeclaration[]; truth: string };
export type G5DeclarationInput = { direction: "collection" | "commitment"; amountMinor: number; dueOn: string; source: string; knowledge: "known" | "estimated" | "needs_review"; note: string; relatedOrderId: string | null; relatedEventId: string | null; idempotencyKey: string };
export type G5Result<T> = { ok: true; value: T; reused?: boolean } | { ok: false; code: "validation_error" | "storage_error" | "not_found"; message: string };

const id = () => globalThis.crypto?.randomUUID?.() ?? `g5-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const inPeriod = (date: string, from: string, to: string) => date >= from && date <= to;

function deliveredOn(stored: StoredCraftOrder): string | null {
  const delivered = stored.order.events.find((event) => event.type === "status_changed" && event.toStatus === "delivered");
  if (!delivered) return null;
  const date = new Intl.DateTimeFormat("en", { timeZone: "Asia/Amman", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(delivered.createdAt));
  const part = (type: string) => date.find((entry) => entry.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function orderInputs(orders: readonly StoredCraftOrder[], from: string, to: string): G5OrderInput[] {
  return orders.flatMap(({ order }) => {
    const delivered = deliveredOn({ id: order.id, order, catalogItemId: null, deliveryDate: "", agreementSource: null, createdAt: order.createdAt, updatedAt: order.createdAt });
    if (!delivered || !inPeriod(delivered, from, to)) return [];
    return [{ id: order.id, itemName: order.itemName, deliveredOn: delivered, resultStatus: order.resultStatus, quantity: order.quantity, recognizedRevenueMinor: order.recognizedRevenueMinor, recognizedCostMinor: order.recognizedCostMinor }];
  });
}

function expenseInputs(events: readonly FinancialEvent[], from: string, to: string): G5ExpenseInput[] {
  return events.filter((event) => event.operatingExpenseDeltaMinor > 0 && inPeriod(event.occurredOn, from, to)).map((event) => ({
    id: event.id,
    amountMinor: event.operatingExpenseDeltaMinor,
    behavior: event.expenseContext?.behavior ?? "unknown",
    relationship: event.expenseContext?.relationship ?? "project",
    knowledge: event.expenseContext?.knowledge ?? "needs_review",
    sharedProjectShareBasis: event.expenseContext?.relationship === "shared" ? event.expenseContext.sharedProjectShare?.basis ?? null : null,
    directlyLinked: false,
    source: event.note || event.id,
  }));
}

function receivables(orders: readonly StoredCraftOrder[]) {
  return orders.filter(({ order }) => order.receivableMinor > 0).map(({ order }) => ({ id: order.id, direction: "collection" as const, amountMinor: order.receivableMinor, dueOn: null, source: `دين عميل: ${order.customerName}` }));
}

function payables(events: readonly FinancialEvent[], purchases: readonly SupplierPurchase[]) {
  const settlements = new Map<string, number>();
  for (const event of events) if (event.type === "payable_settlement_cash" && event.relatedEventId) settlements.set(event.relatedEventId, (settlements.get(event.relatedEventId) ?? 0) + event.amountMinor);
  const eventPayables = events.filter((event) => event.type === "operating_expense_payable" && event.payableDeltaMinor > 0).flatMap((event) => {
    const outstanding = event.amountMinor - (settlements.get(event.id) ?? 0);
    return outstanding > 0 ? [{ id: event.id, direction: "commitment" as const, amountMinor: outstanding, dueOn: null, source: `التزام: ${event.note || event.id}` }] : [];
  });
  const purchasePayables = purchases.filter((purchase) => purchase.payableMinor > 0).map((purchase) => ({ id: purchase.id, direction: "commitment" as const, amountMinor: purchase.payableMinor, dueOn: purchase.dueOn, source: `مشتريات مورد: ${purchase.supplierName}` }));
  return [...eventPayables, ...purchasePayables];
}

export class G5Service {
  constructor(private readonly store: PrototypeLocalStore, private readonly projectFinance: ProjectFinancialService, private readonly now: () => string = () => new Date().toISOString()) {}

  async listDeclarations(): Promise<G5Result<readonly ShortCashDeclaration[]>> {
    const result = await this.store.listShortCashDeclarations();
    return result.ok ? { ok: true, value: result.value } : { ok: false, code: "storage_error", message: "تعذر قراءة إعلانات السيولة المحلية." };
  }

  async readDecision(from: string, to: string): Promise<G5Result<G5Decision>> {
    const [position, orders, events, purchases, declarationResult] = await Promise.all([this.projectFinance.readPosition(), this.store.listOrders(), this.store.listFinancialEvents(), this.store.listSupplierPurchases(), this.store.listShortCashDeclarations()]);
    if (!position.ok || !orders.ok || !events.ok || !purchases.ok || !declarationResult.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة بيانات G5 المحلية." };
    const contributionOrders = orderInputs(orders.value, from, to);
    const period = calculateBreakEven(from, to, contributionOrders, expenseInputs(events.value, from, to));
    const shortCash = calculateShortCash({ from, to, recordedCashMinor: position.value.recordedCashMinor, receivables: receivables(orders.value), payables: payables(events.value, purchases.value), declarations: declarationResult.value });
    return { ok: true, value: { period, shortCash, declarations: declarationResult.value, truth: "هذه قراءة مشتقة من السجل المحلي وإعلانات المالك. لا تحفظ نتيجة مالية جديدة، ولا تحول الإعلان إلى قبض أو دفع فعلي، ولا تقدم توصية ملزمة." } };
  }

  async createDeclaration(input: G5DeclarationInput): Promise<G5Result<ShortCashDeclaration>> {
    const declarations = await this.store.listShortCashDeclarations();
    if (!declarations.ok) return { ok: false, code: "storage_error", message: "تعذر التحقق من إعلانات السيولة المحلية." };
    const repeated = declarations.value.find((declaration) => declaration.kind === "declaration" && declaration.idempotencyKey === input.idempotencyKey);
    if (repeated) return { ok: true, value: repeated, reused: true };
    const relatedValidation = await this.validateRelation(input);
    if (!relatedValidation.ok) return relatedValidation;
    try {
      const declaration = createShortCashDeclaration({ ...input, id: id(), createdAt: this.now() });
      const saved = await this.store.saveShortCashDeclaration(declaration);
      return saved.ok ? { ok: true, value: saved.value } : { ok: false, code: "storage_error", message: "تعذر حفظ إعلان السيولة محليًا." };
    } catch (error) {
      return { ok: false, code: "validation_error", message: error instanceof Error ? error.message : "إعلان السيولة غير صالح." };
    }
  }

  async reverseDeclaration(idToReverse: string, note: string, idempotencyKey: string): Promise<G5Result<ShortCashDeclaration>> {
    const declarations = await this.store.listShortCashDeclarations();
    if (!declarations.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة إعلانات السيولة المحلية." };
    const original = declarations.value.find((declaration) => declaration.id === idToReverse);
    if (!original) return { ok: false, code: "not_found", message: "إعلان السيولة المطلوب تصحيحه غير موجود." };
    if (original.kind !== "declaration") return { ok: false, code: "validation_error", message: "لا يمكن عكس سجل عكس آخر." };
    if (declarations.value.some((declaration) => declaration.kind === "reversal" && declaration.reversalOfId === original.id)) return { ok: false, code: "validation_error", message: "تم عكس هذا الإعلان مسبقًا دون تعديل السجل القديم." };
    const repeated = declarations.value.find((declaration) => declaration.kind === "reversal" && declaration.idempotencyKey === idempotencyKey);
    if (repeated) return { ok: true, value: repeated, reused: true };
    try {
      const reversal = createShortCashReversal({ id: id(), original, idempotencyKey, createdAt: this.now(), note });
      const saved = await this.store.saveShortCashDeclaration(reversal);
      return saved.ok ? { ok: true, value: saved.value } : { ok: false, code: "storage_error", message: "تعذر حفظ تصحيح إعلان السيولة محليًا." };
    } catch (error) {
      return { ok: false, code: "validation_error", message: error instanceof Error ? error.message : "تصحيح إعلان السيولة غير صالح." };
    }
  }

  private async validateRelation(input: G5DeclarationInput): Promise<G5Result<null>> {
    if (input.relatedOrderId) {
      if (input.direction !== "collection") return { ok: false, code: "validation_error", message: "ربط الطلب مخصص لتحصيلات العملاء فقط." };
      const order = await this.store.getOrder(input.relatedOrderId);
      if (!order.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة الطلب المرتبط." };
      if (!order.value) return { ok: false, code: "not_found", message: "الطلب المرتبط غير موجود." };
      if (input.amountMinor > order.value.order.receivableMinor) return { ok: false, code: "validation_error", message: "لا يمكن أن يتجاوز إعلان التحصيل الذمة المسجلة للطلب." };
    }
    if (input.relatedEventId) {
      if (input.direction !== "commitment") return { ok: false, code: "validation_error", message: "ربط الحدث مخصص للالتزامات فقط." };
      const event = await this.store.getFinancialEvent(input.relatedEventId);
      if (!event.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة الحدث المرتبط." };
      if (!event.value || event.value.type !== "operating_expense_payable") return { ok: false, code: "not_found", message: "الحدث المرتبط ليس التزام مصروف صالحًا." };
      const events = await this.store.listFinancialEvents();
      if (!events.ok) return { ok: false, code: "storage_error", message: "تعذر التحقق من رصيد الالتزام." };
      const paid = events.value.filter((candidate) => candidate.type === "payable_settlement_cash" && candidate.relatedEventId === event.value!.id).reduce((sum, candidate) => sum + candidate.amountMinor, 0);
      if (input.amountMinor > event.value.amountMinor - paid) return { ok: false, code: "validation_error", message: "لا يمكن أن يتجاوز إعلان الالتزام الرصيد المسجل." };
    }
    return { ok: true, value: null };
  }
}
