/** Supplier/material purchase Application layer. Purchases alter cash and supplier payable, never operating expense or period result. */
import {
  createSupplierPurchase,
  recordSupplierPurchasePayment,
  reverseSupplierPurchasePayment,
  updateSupplierPurchase,
  type SupplierPurchase,
} from "@micro-domain/supplier-purchase/index.js";
import type { PrototypeLocalStore } from "@/storage/local/types";

export type SupplierPurchaseInput = {
  supplierName: string;
  note: string;
  purchasedOn: string;
  dueOn: string | null;
  totalMinor: number;
  initialPaidMinor: number;
  idempotencyKey: string;
};
export type SupplierPurchasePaymentInput = {
  purchaseId: string;
  amountMinor: number;
  occurredOn: string;
  note: string;
  idempotencyKey: string;
};
/* المجموعة ٢ (§10.4): تعديل موثق لسجل الشراء — يعرض الأثر قبل التنفيذ من الواجهة. */
export type SupplierPurchaseEditInput = {
  purchaseId: string;
  supplierName: string;
  note: string;
  purchasedOn: string;
  dueOn: string | null;
  totalMinor: number;
  initialPaidMinor: number;
  reason: string;
  idempotencyKey: string;
};
export type SupplierPaymentReversalInput = {
  purchaseId: string;
  paymentId: string;
  reason: string;
  occurredOn: string;
  idempotencyKey: string;
};
export type SupplierPurchaseSummary = {
  purchaseCount: number;
  openPurchaseCount: number;
  supplierPayablesMinor: number;
  recordedCashPaidMinor: number;
  truth: string;
};
export type SupplierPurchaseResult<T> =
  | { ok: true; value: T; reused?: boolean }
  | { ok: false; code: "validation_error" | "storage_error"; message: string };

const id = () =>
  globalThis.crypto?.randomUUID?.() ??
  `supplier-purchase-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export class SupplierPurchaseService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async list(): Promise<SupplierPurchaseResult<readonly SupplierPurchase[]>> {
    const purchases = await this.store.listSupplierPurchases();
    return purchases.ok
      ? { ok: true, value: purchases.value }
      : { ok: false, code: "storage_error", message: "تعذر قراءة مشتريات الموردين المحلية." };
  }

  async readSummary(): Promise<SupplierPurchaseResult<SupplierPurchaseSummary>> {
    const purchases = await this.store.listSupplierPurchases();
    if (!purchases.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة مشتريات الموردين المحلية." };
    const supplierPayablesMinor = purchases.value.reduce((sum, purchase) => sum + purchase.payableMinor, 0);
    const recordedCashPaidMinor = purchases.value.reduce((sum, purchase) => sum + purchase.paidMinor, 0);
    const openPurchaseCount = purchases.value.filter(purchase => purchase.payableMinor > 0).length;
    return {
      ok: true,
      value: {
        purchaseCount: purchases.value.length,
        openPurchaseCount,
        supplierPayablesMinor,
        recordedCashPaidMinor,
        truth:
          "شراء المواد هنا يغيّر الكاش أو ذمة المورد فقط. لا يصبح مصروفًا أو تكلفة بيع حتى تضيف Micro المخزون والاستهلاك.",
      },
    };
  }

  async recordPurchase(input: SupplierPurchaseInput): Promise<SupplierPurchaseResult<SupplierPurchase>> {
    const existing = await this.store.listSupplierPurchases();
    if (!existing.ok)
      return { ok: false, code: "storage_error", message: "تعذر التحقق من مشتريات الموردين." };
    const repeated = existing.value.find(purchase => purchase.idempotencyKey === input.idempotencyKey);
    if (repeated) return { ok: true, value: repeated, reused: true };
    try {
      const purchase = createSupplierPurchase({
        id: id(),
        supplierName: input.supplierName,
        note: input.note,
        purchasedOn: input.purchasedOn,
        dueOn: input.dueOn,
        totalMinor: input.totalMinor,
        initialPaidMinor: input.initialPaidMinor,
        recordedAt: this.now(),
        idempotencyKey: input.idempotencyKey,
      });
      const saved = await this.store.saveSupplierPurchase(purchase);
      return saved.ok
        ? { ok: true, value: saved.value }
        : {
            ok: false,
            code: "storage_error",
            message: "تعذر حفظ شراء المواد محليًا. لم يتم تأكيد نجاح العملية.",
          };
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات الشراء غير صالحة.",
      };
    }
  }

  async recordPayment(
    input: SupplierPurchasePaymentInput,
  ): Promise<SupplierPurchaseResult<SupplierPurchase>> {
    const existing = await this.store.getSupplierPurchase(input.purchaseId);
    if (!existing.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة شراء المورد." };
    if (!existing.value)
      return { ok: false, code: "validation_error", message: "اختر شراء مواد مسجلًا قبل تسجيل الدفعة." };
    const repeated = existing.value.payments.some(payment => payment.idempotencyKey === input.idempotencyKey);
    if (repeated) return { ok: true, value: existing.value, reused: true };
    try {
      const updated = recordSupplierPurchasePayment(existing.value, {
        id: id(),
        amountMinor: input.amountMinor,
        occurredOn: input.occurredOn,
        recordedAt: this.now(),
        idempotencyKey: input.idempotencyKey,
        note: input.note,
      });
      const saved = await this.store.saveSupplierPurchase(updated);
      return saved.ok
        ? { ok: true, value: saved.value }
        : {
            ok: false,
            code: "storage_error",
            message: "تعذر حفظ دفعة المورد محليًا. لم يتم تأكيد نجاح العملية.",
          };
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات الدفعة غير صالحة.",
      };
    }
  }

  /* المجموعة ٢ (§10.4): تعديل موثق — التصحيح يعدّل الكاش/الذمة بحسب فرق الدفع
   * الأولي والإجمالي، ويحفظ مراجعة بالقيم قبل التصحيح. لا يُحذف الأصل أبدًا. */
  async editPurchase(
    input: SupplierPurchaseEditInput,
  ): Promise<SupplierPurchaseResult<SupplierPurchase>> {
    const existing = await this.store.getSupplierPurchase(input.purchaseId);
    if (!existing.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة شراء المورد." };
    if (!existing.value)
      return { ok: false, code: "validation_error", message: "اختر شراء مواد مسجلًا قبل تعديله." };
    const repeated = existing.value.revisions?.some(
      revision => revision.idempotencyKey === input.idempotencyKey,
    );
    if (repeated) return { ok: true, value: existing.value, reused: true };
    if (!input.reason.trim())
      return { ok: false, code: "validation_error", message: "اكتب سبب التعديل قبل الحفظ." };
    try {
      const updated = updateSupplierPurchase(existing.value, {
        supplierName: input.supplierName,
        note: input.note,
        purchasedOn: input.purchasedOn,
        dueOn: input.dueOn,
        totalMinor: input.totalMinor,
        initialPaidMinor: input.initialPaidMinor,
        recordedAt: this.now(),
        idempotencyKey: input.idempotencyKey,
        reason: input.reason,
      });
      const saved = await this.store.saveSupplierPurchase(updated);
      return saved.ok
        ? { ok: true, value: saved.value }
        : {
            ok: false,
            code: "storage_error",
            message: "تعذر حفظ تعديل الشراء محليًا. بقي الأصل دون تغيير.",
          };
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات تعديل الشراء غير صالحة.",
      };
    }
  }

  /* المجموعة ٢ (§10.4): تراجع موثق عن دفعة لاحقة — يستعيد المتبقي للمورد
   * ويُرجع أثر الكاش المدفوع؛ الدفعة الأصلية تبقى وعلاقة التدقيق صريحة. */
  async reversePayment(
    input: SupplierPaymentReversalInput,
  ): Promise<SupplierPurchaseResult<SupplierPurchase>> {
    const existing = await this.store.getSupplierPurchase(input.purchaseId);
    if (!existing.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة شراء المورد." };
    if (!existing.value)
      return { ok: false, code: "validation_error", message: "اختر شراء مواد مسجلًا قبل التراجع عن دفعته." };
    const repeated = existing.value.paymentReversals?.some(
      reversal => reversal.idempotencyKey === input.idempotencyKey,
    );
    if (repeated) return { ok: true, value: existing.value, reused: true };
    if (!input.reason.trim())
      return { ok: false, code: "validation_error", message: "اكتب سبب التراجع قبل الحفظ." };
    try {
      const updated = reverseSupplierPurchasePayment(existing.value, {
        id: id(),
        paymentId: input.paymentId,
        reason: input.reason,
        occurredOn: input.occurredOn,
        recordedAt: this.now(),
        idempotencyKey: input.idempotencyKey,
      });
      const saved = await this.store.saveSupplierPurchase(updated);
      return saved.ok
        ? { ok: true, value: saved.value }
        : {
            ok: false,
            code: "storage_error",
            message: "تعذر حفظ التراجع محليًا. بقي الدفع دون تغيير.",
          };
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات التراجع غير صالحة.",
      };
    }
  }
}
