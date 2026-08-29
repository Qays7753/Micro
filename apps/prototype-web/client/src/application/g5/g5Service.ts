import {
  convertQuantityMilli,
  type CatalogItem,
  type DirectConversion,
  type MeasurementUnit,
} from "@micro-domain/catalog/index.js";
import {
  calculateBreakEven,
  calculateShortCash,
  createShortCashDeclaration,
  createShortCashReversal,
  type BreakEvenResult,
  type G5ExpenseInput,
  type G5OrderInput,
  type ShortCashDeclaration,
  type ShortCashResult,
} from "@micro-domain/g5/index.js";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
import { activeSettlementsMinor, reversedEventIds } from "@micro-domain/financial-event/index.js";
import { isRegisteredCustomerDebt } from "@micro-domain/craft-order/index.js";
import type { SupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import type { PrototypeLocalStore, StoredCraftOrder } from "@/storage/local/types";
import type { ProjectFinancialService } from "@/application/finance/projectFinancialService";

export type G5Decision = {
  period: BreakEvenResult;
  shortCash: ShortCashResult;
  declarations: readonly ShortCashDeclaration[];
  truth: string;
};
export type G5LinkOption = { id: string; label: string; amountMinor: number };
export type G5LinkOptions = { orders: readonly G5LinkOption[]; payableEvents: readonly G5LinkOption[] };
export type G5DeclarationInput = {
  direction: "collection" | "commitment";
  amountMinor: number;
  dueOn: string;
  source: string;
  knowledge: "known" | "estimated" | "needs_review";
  note: string;
  relatedOrderId: string | null;
  relatedEventId: string | null;
  idempotencyKey: string;
};
export type G5Result<T> =
  | { ok: true; value: T; reused?: boolean }
  | { ok: false; code: "validation_error" | "storage_error" | "not_found"; message: string };

const id = () =>
  globalThis.crypto?.randomUUID?.() ?? `g5-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const inPeriod = (date: string, from: string, to: string) => date >= from && date <= to;

function deliveredOn(stored: StoredCraftOrder): string | null {
  const delivered = stored.order.events.find(
    event => event.type === "status_changed" && event.toStatus === "delivered",
  );
  if (!delivered) return null;
  const date = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Amman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(delivered.createdAt));
  const part = (type: string) => date.find(entry => entry.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function toQuantityMilli(quantity: number): number | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  const scaled = Math.round(quantity * 1000);
  if (!Number.isSafeInteger(scaled) || scaled <= 0 || Math.abs(quantity - scaled / 1000) > Number.EPSILON)
    return null;
  return scaled;
}

function normalizeQuantity(
  quantityMilli: number,
  sourceUnitId: string,
  targetUnitId: string,
  units: readonly MeasurementUnit[],
  conversions: readonly DirectConversion[],
): number | null {
  if (sourceUnitId === targetUnitId) return quantityMilli;
  const source = units.find(unit => unit.id === sourceUnitId);
  const target = units.find(unit => unit.id === targetUnitId);
  const conversion = conversions.find(
    candidate =>
      candidate.active && candidate.fromUnitId === sourceUnitId && candidate.toUnitId === targetUnitId,
  );
  if (
    !source ||
    !target ||
    source.dimension !== target.dimension ||
    !conversion ||
    conversion.dimension !== source.dimension
  )
    return null;
  try {
    return convertQuantityMilli(quantityMilli, conversion).quantityMilli;
  } catch {
    return null;
  }
}

function orderInputs(
  orders: readonly StoredCraftOrder[],
  catalogItems: readonly CatalogItem[],
  units: readonly MeasurementUnit[],
  conversions: readonly DirectConversion[],
  from: string,
  to: string,
): G5OrderInput[] {
  const periodOrders = orders.flatMap(({ order, catalogItemId }) => {
    const delivered = deliveredOn({
      id: order.id,
      order,
      catalogItemId,
      deliveryDate: "",
      agreementSource: null,
      createdAt: order.createdAt,
      updatedAt: order.createdAt,
    });
    if (!delivered || !inPeriod(delivered, from, to)) return [];
    return [{ order, catalogItemId, delivered }];
  });
  const organizedUnits = periodOrders
    .filter(({ order }) => order.resultStatus === "final")
    .map(({ catalogItemId }) =>
      catalogItemId ? (catalogItems.find(item => item.id === catalogItemId)?.unitId ?? null) : null,
    );
  const targetUnitId = organizedUnits.find((unitId): unitId is string => unitId !== null) ?? null;
  return periodOrders.map(({ order, catalogItemId, delivered }, index) => {
    const rawQuantityMilli = toQuantityMilli(order.quantity);
    const catalog = catalogItemId ? (catalogItems.find(item => item.id === catalogItemId) ?? null) : null;
    const sourceUnitId = catalog?.unitId ?? null;
    let quantityMilli = rawQuantityMilli;
    let unitKey: string | null = "legacy:recorded-mix";
    let unitLabel: string | null = "المزيج المسجل";
    let quantityIssue: G5OrderInput["quantityIssue"] = rawQuantityMilli === null ? "invalid" : null;
    if (catalogItemId) {
      unitKey = sourceUnitId;
      unitLabel =
        catalog?.unitLabel ??
        (sourceUnitId ? (units.find(unit => unit.id === sourceUnitId)?.nameAr ?? null) : null);
      if (!catalog || !sourceUnitId || !units.some(unit => unit.id === sourceUnitId)) {
        quantityMilli = null;
        quantityIssue = "needs_conversion";
      } else if (targetUnitId && sourceUnitId !== targetUnitId) {
        quantityMilli =
          rawQuantityMilli === null
            ? null
            : normalizeQuantity(rawQuantityMilli, sourceUnitId, targetUnitId, units, conversions);
        if (quantityMilli === null)
          quantityIssue = rawQuantityMilli === null ? "invalid" : "needs_conversion";
        else {
          unitKey = targetUnitId;
          unitLabel =
            catalogItems.find(item => item.unitId === targetUnitId)?.unitLabel ??
            units.find(unit => unit.id === targetUnitId)?.nameAr ??
            null;
        }
      }
    }
    return {
      id: order.id,
      itemName: order.itemName,
      deliveredOn: delivered,
      resultStatus: order.resultStatus,
      quantityMilli,
      unitKey,
      unitLabel,
      quantityIssue,
      recognizedRevenueMinor: order.recognizedRevenueMinor,
      recognizedCostMinor: order.recognizedCostMinor,
    };
  });
}

function expenseInputs(events: readonly FinancialEvent[], from: string, to: string): G5ExpenseInput[] {
  // Period-local netting, mirroring the G3 period reader (contract 14 §6): an expense whose live
  // reversal also falls inside the reading window leaves the reading entirely; a reversal in a later
  // window does not rewrite the window where the expense was recorded. Reversal records themselves
  // never enter: their negative deltas have no non-negative representation in a G5 expense input.
  const nettedInWindow = new Set(
    events
      .filter(
        event =>
          event.correctionType === "reverse" &&
          event.correctionOfEventId &&
          inPeriod(event.occurredOn, from, to),
      )
      .map(event => event.correctionOfEventId!),
  );
  return events
    .filter(
      event =>
        event.correctionType !== "reverse" &&
        !nettedInWindow.has(event.id) &&
        inPeriod(event.occurredOn, from, to) &&
        (event.operatingExpenseDeltaMinor > 0 ||
          event.expenseContext?.sharedProjectShare?.allocation === "unallocated"),
    )
    .map(event => {
      const share = event.expenseContext?.sharedProjectShare;
      const unallocatedShared = share?.allocation === "unallocated";
      return {
        id: event.id,
        amountMinor: unallocatedShared
          ? (share.totalAmountMinor ?? event.amountMinor)
          : event.operatingExpenseDeltaMinor,
        behavior: event.expenseContext?.behavior ?? "unknown",
        relationship: event.expenseContext?.relationship ?? "project",
        knowledge: event.expenseContext?.knowledge ?? "needs_review",
        sharedProjectShareBasis:
          event.expenseContext?.relationship === "shared" ? (share?.basis ?? null) : null,
        directlyLinked: false,
        source: event.note || event.id,
      };
    });
}

function receivables(orders: readonly StoredCraftOrder[]) {
  return orders
    .filter(({ order }) => isRegisteredCustomerDebt(order))
    .map(({ order }) => ({
      id: order.id,
      direction: "collection" as const,
      amountMinor: order.receivableMinor,
      dueOn: null,
      source: `دين عميل: ${order.customerName}`,
    }));
}

function payables(events: readonly FinancialEvent[], purchases: readonly SupplierPurchase[]) {
  const reversedIds = reversedEventIds(events);
  const eventPayables = events
    .filter(
      event =>
        event.type === "operating_expense_payable" &&
        event.payableDeltaMinor > 0 &&
        !reversedIds.has(event.id),
    )
    .flatMap(event => {
      const outstanding = event.amountMinor - activeSettlementsMinor(events, event.id);
      return outstanding > 0
        ? [
            {
              id: event.id,
              direction: "commitment" as const,
              amountMinor: outstanding,
              dueOn: null,
              source: `التزام: ${event.note || event.id}`,
            },
          ]
        : [];
    });
  const purchasePayables = purchases
    .filter(purchase => purchase.payableMinor > 0)
    .map(purchase => ({
      id: purchase.id,
      direction: "commitment" as const,
      amountMinor: purchase.payableMinor,
      dueOn: purchase.dueOn,
      source: `مشتريات مورد: ${purchase.supplierName}`,
    }));
  return [...eventPayables, ...purchasePayables];
}

export class G5Service {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly projectFinance: ProjectFinancialService,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async listDeclarations(): Promise<G5Result<readonly ShortCashDeclaration[]>> {
    const result = await this.store.listShortCashDeclarations();
    return result.ok
      ? { ok: true, value: result.value }
      : { ok: false, code: "storage_error", message: "تعذر قراءة المتوقعات المحلية." };
  }

  async listLinkOptions(): Promise<G5Result<G5LinkOptions>> {
    const [orders, events] = await Promise.all([this.store.listOrders(), this.store.listFinancialEvents()]);
    if (!orders.ok || !events.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة الأرصدة القابلة للربط." };
    const reversedIds = reversedEventIds(events.value);
    const payableEvents = events.value
      .filter(
        event =>
          event.type === "operating_expense_payable" &&
          event.payableDeltaMinor > 0 &&
          !reversedIds.has(event.id),
      )
      .flatMap(event => {
        const amountMinor = event.amountMinor - activeSettlementsMinor(events.value, event.id);
        return amountMinor > 0 ? [{ id: event.id, label: event.note || event.id, amountMinor }] : [];
      });
    return {
      ok: true,
      value: {
        orders: orders.value
          .filter(({ order }) => isRegisteredCustomerDebt(order))
          .map(({ order }) => ({
            id: order.id,
            label: `${order.customerName} · ${order.itemName}`,
            amountMinor: order.receivableMinor,
          })),
        payableEvents,
      },
    };
  }

  async readDecision(from: string, to: string): Promise<G5Result<G5Decision>> {
    const [position, orders, events, purchases, declarations, catalogItems, units, conversions] =
      await Promise.all([
        this.projectFinance.readPosition(),
        this.store.listOrders(),
        this.store.listFinancialEvents(),
        this.store.listSupplierPurchases(),
        this.store.listShortCashDeclarations(),
        this.store.listCatalogItems(),
        this.store.listMeasurementUnits(),
        this.store.listDirectConversions(),
      ]);
    if (
      !position.ok ||
      !orders.ok ||
      !events.ok ||
      !purchases.ok ||
      !declarations.ok ||
      !catalogItems.ok ||
      !units.ok ||
      !conversions.ok
    )
      return { ok: false, code: "storage_error", message: "تعذر قراءة المتوقعات المحلية." };
    const contributionOrders = orderInputs(
      orders.value,
      catalogItems.value,
      units.value,
      conversions.value,
      from,
      to,
    );
    const period = calculateBreakEven(from, to, contributionOrders, expenseInputs(events.value, from, to));
    const shortCash = calculateShortCash({
      from,
      to,
      recordedCashMinor: position.value.recordedCashMinor,
      receivables: receivables(orders.value),
      payables: payables(events.value, purchases.value),
      declarations: declarations.value,
    });
    return {
      ok: true,
      value: {
        period,
        shortCash,
        declarations: declarations.value,
        truth:
          "هذه قراءة مشتقة من السجل المحلي وما سجّلته من متوقعات. لا تحفظ نتيجة مالية جديدة، ولا تحول المتوقع إلى قبض أو دفع فعلي، ولا تقدم توصية ملزمة.",
      },
    };
  }

  async createDeclaration(input: G5DeclarationInput): Promise<G5Result<ShortCashDeclaration>> {
    const declarations = await this.store.listShortCashDeclarations();
    if (!declarations.ok)
      return { ok: false, code: "storage_error", message: "تعذر التحقق من المتوقعات المحلية." };
    const repeated = declarations.value.find(
      declaration =>
        declaration.kind === "declaration" && declaration.idempotencyKey === input.idempotencyKey,
    );
    if (repeated) return { ok: true, value: repeated, reused: true };
    const relatedValidation = await this.validateRelation(input, declarations.value);
    if (!relatedValidation.ok) return relatedValidation;
    try {
      const declaration = createShortCashDeclaration({ ...input, id: id(), createdAt: this.now() });
      const saved = await this.store.saveShortCashDeclaration(declaration);
      return saved.ok
        ? { ok: true, value: saved.value }
        : { ok: false, code: "storage_error", message: "تعذر حفظ السجل المتوقع محليًا." };
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "السجل المتوقع غير صالح.",
      };
    }
  }

  async reverseDeclaration(
    idToReverse: string,
    note: string,
    idempotencyKey: string,
  ): Promise<G5Result<ShortCashDeclaration>> {
    const declarations = await this.store.listShortCashDeclarations();
    if (!declarations.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة المتوقعات المحلية." };
    const original = declarations.value.find(declaration => declaration.id === idToReverse);
    if (!original)
      return { ok: false, code: "not_found", message: "السجل المتوقع المطلوب تصحيحه غير موجود." };
    if (original.kind !== "declaration")
      return { ok: false, code: "validation_error", message: "لا يمكن التراجع عن سجل تراجع آخر." };
    const repeated = declarations.value.find(
      declaration => declaration.kind === "reversal" && declaration.idempotencyKey === idempotencyKey,
    );
    if (repeated) return { ok: true, value: repeated, reused: true };
    if (
      declarations.value.some(
        declaration => declaration.kind === "reversal" && declaration.reversalOfId === original.id,
      )
    )
      return {
        ok: false,
        code: "validation_error",
        message: "تم التراجع عن هذا السجل المتوقع مسبقًا دون تعديل السجل القديم.",
      };
    try {
      const reversal = createShortCashReversal({
        id: id(),
        original,
        idempotencyKey,
        createdAt: this.now(),
        note,
      });
      const saved = await this.store.commitShortCashDeclarationReversal(original.id, reversal);
      return saved.ok
        ? { ok: true, value: saved.value, reused: saved.value.id !== reversal.id }
        : {
            ok: false,
            code: "storage_error",
            message: "تعذر حفظ تصحيح السجل المتوقع ذريًا؛ بقي الأصل محفوظًا.",
          };
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "تصحيح السجل المتوقع غير صالح.",
      };
    }
  }

  private async validateRelation(
    input: G5DeclarationInput,
    declarations: readonly ShortCashDeclaration[],
  ): Promise<G5Result<null>> {
    if (input.relatedOrderId) {
      if (input.direction !== "collection")
        return { ok: false, code: "validation_error", message: "ربط الطلب مخصص لتحصيلات العملاء فقط." };
      const order = await this.store.getOrder(input.relatedOrderId);
      if (!order.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة الطلب المرتبط." };
      if (!order.value) return { ok: false, code: "not_found", message: "الطلب المرتبط غير موجود." };
      if (!isRegisteredCustomerDebt(order.value.order))
        return { ok: false, code: "validation_error", message: "ربط الطلب مخصص لطلب له دين مسجل." };
      const alreadyDeclared = activeLinkedDeclarationTotal(declarations, input);
      if (alreadyDeclared + input.amountMinor > order.value.order.receivableMinor)
        return {
          ok: false,
          code: "validation_error",
          message: "لا يمكن أن يتجاوز مجموع متوقعات القبض الدين المسجل للطلب.",
        };
    }
    if (input.relatedEventId) {
      if (input.direction !== "commitment")
        return { ok: false, code: "validation_error", message: "ربط الحدث مخصص لالتزامات المصروف فقط." };
      const event = await this.store.getFinancialEvent(input.relatedEventId);
      if (!event.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة الحدث المرتبط." };
      if (!event.value || event.value.type !== "operating_expense_payable")
        return { ok: false, code: "not_found", message: "الحدث المرتبط ليس التزام مصروف صالحًا." };
      const events = await this.store.listFinancialEvents();
      if (!events.ok) return { ok: false, code: "storage_error", message: "تعذر التحقق من رصيد الالتزام." };
      if (
        event.value.correctionType === "reverse" ||
        reversedEventIds(events.value).has(event.value.id)
      )
        return { ok: false, code: "validation_error", message: "لا يمكن ربط توقع بالتزام مالي تم التراجع عنه." };
      const paid = activeSettlementsMinor(events.value, event.value!.id);
      const alreadyDeclared = activeLinkedDeclarationTotal(declarations, input);
      if (alreadyDeclared + input.amountMinor > event.value.amountMinor - paid)
        return {
          ok: false,
          code: "validation_error",
          message: "لا يمكن أن يتجاوز مجموع متوقعات الدفع الرصيد المسجل.",
        };
    }
    return { ok: true, value: null };
  }
}

function activeLinkedDeclarationTotal(
  declarations: readonly ShortCashDeclaration[],
  input: G5DeclarationInput,
): number {
  const reversedIds = new Set(
    declarations
      .filter(declaration => declaration.kind === "reversal" && declaration.reversalOfId)
      .map(declaration => declaration.reversalOfId),
  );
  return declarations
    .filter(
      declaration =>
        declaration.kind === "declaration" &&
        !reversedIds.has(declaration.id) &&
        declaration.direction === input.direction &&
        ((input.relatedOrderId !== null && declaration.relatedOrderId === input.relatedOrderId) ||
          (input.relatedEventId !== null && declaration.relatedEventId === input.relatedEventId)),
    )
    .reduce((sum, declaration) => sum + declaration.amountMinor, 0);
}
