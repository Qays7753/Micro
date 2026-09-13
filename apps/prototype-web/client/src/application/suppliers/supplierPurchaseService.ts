/** Supplier/material purchase Application layer. Purchases alter cash and supplier payable, never operating expense or period result. */
import {
  createSupplierPurchase,
  recordSupplierPurchasePayment,
  reverseSupplierPurchasePayment,
  updateSupplierPurchase,
  type SupplierPurchase,
} from "@micro-domain/supplier-purchase/index.js";
import type { PrototypeLocalStore } from "@/storage/local/types";
import { storageFailureCode } from "@/storage/local/types";
import type { SupplierPurchaseCommit } from "@/storage/local/supplierScheduleCommitGuard";

export type SupplierPurchaseInput = {
  supplierName: string;
  note: string;
  purchasedOn: string;
  dueOn: string | null;
  totalMinor: number;
  initialPaidMinor: number;
  idempotencyKey: string;
  /* المجموعة ٢ (عقد ٢٨ / TR-07): ربط مادة اختياري — يغذي جسر الاستلام بالمادة
   * والكمية المتوقعة والقيمة المتبقية. null = غير معروف (لا صفر). */
  materialId?: string | null;
  expectedQuantityMilli?: number | null;
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
  /* المجموعة ٢ (عقد ٢٨): ربط المادة والكمية المتوقعة — جزء التعديل الموثق. */
  materialId: string | null;
  expectedQuantityMilli: number | null;
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
  | { ok: false; code: "validation_error" | "storage_error" | "storage_stale"; message: string };

/* رقعة إغلاق المجموعة ٢ (مراجعة مستقلة): كود المحوّل المطبوع يُحفظ عبر طبقة
 * التطبيق — تعارض القراءة-التعديل-الكتابة يظهر storage_stale (أعد الفتح ثم
 * أعد المحاولة) والفشل التخزيني الحقيقي يبقى storage_error؛ المستدعون لا
 * يفسّرون النص العربي لمعرفة الصنف. التصنيف المشترك في طبقة التخزين
 * (`storageFailureCode`). */

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
        /* المجموعة ٢ (عقد ٢٨): ربط المادة والكمية المتوقعة — اختياري، null = غير معروف. */
        materialId: input.materialId ?? null,
        expectedQuantityMilli: input.expectedQuantityMilli ?? null,
      });
      /* المجموعة ٢ (التحصين الكامل — HIGH-001): الالتزام الذرّي — مفتاح الحتمية
       * يُفحص داخل المعاملة (إعادة التشغيل تُعاد كما هي) ولا يُنشأ سجل فوق
       * مسار متزامن آخر. */
      const saved = await this.store.commitSupplierPurchase({
        kind: "create",
        purchase,
        idempotencyKey: input.idempotencyKey,
      });
      return saved.ok
        ? { ok: true, value: saved.value.purchase, reused: saved.value.reused }
        : {
            ok: false,
            code: storageFailureCode(saved.code),
            message: saved.message ?? "تعذر حفظ شراء المواد محليًا — بياناتك كما هي؛ أعد المحاولة.",
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
    try {
      const updated = recordSupplierPurchasePayment(existing.value, {
        id: id(),
        amountMinor: input.amountMinor,
        occurredOn: input.occurredOn,
        recordedAt: this.now(),
        idempotencyKey: input.idempotencyKey,
        note: input.note,
      });
      /* المجموعة ٢ (التحصين الكامل — HIGH-001): دفعة واحدة بالضبط داخل معاملة
       * واحدة — مفتاح الحتمية يُفحص داخلها، والكتابة المتزامنة من مسار آخر
       * تُرفض بوضوح ولا تُسقط أثر أي طرف بصمت. */
      const saved = await this.store.commitSupplierPurchase({
        kind: "payment",
        purchase: updated,
        idempotencyKey: input.idempotencyKey,
      });
      return saved.ok
        ? { ok: true, value: saved.value.purchase, reused: saved.value.reused }
        : {
            ok: false,
            code: storageFailureCode(saved.code),
            message: saved.message ?? "تعذر حفظ دفعة المورد محليًا — بياناتك كما هي؛ أعد المحاولة.",
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
   * الأولي والإجمالي، ويحفظ مراجعة بالقيم قبل التصحيح. لا يُحذف الأصل أبدًا.
   * المجموعة ٢ (عقد ٢٨): حارس الاستلام — التعديل لا يجعل الإجمالي/المتوقع أقل
   * من المستلم الموثّق فعلًا (الإيصالات حركات لا تُعاد بمجرد تعديل الشراء). */
  async editPurchase(input: SupplierPurchaseEditInput): Promise<SupplierPurchaseResult<SupplierPurchase>> {
    const [existing, movements] = await Promise.all([
      this.store.getSupplierPurchase(input.purchaseId),
      this.store.listInventoryMovements(),
    ]);
    if (!existing.ok || !movements.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة شراء المورد." };
    if (!existing.value)
      return { ok: false, code: "validation_error", message: "اختر شراء مواد مسجلًا قبل تعديله." };
    if (!input.reason.trim())
      return { ok: false, code: "validation_error", message: "اكتب سبب التعديل قبل الحفظ." };
    const reversedMovementIds = new Set(
      movements.value
        .filter(movement => movement.type === "reversal" && movement.reversesMovementId)
        .map(movement => movement.reversesMovementId),
    );
    const activeReceipts = movements.value.filter(
      movement =>
        movement.type === "purchase_receipt" &&
        movement.purchaseId === input.purchaseId &&
        !reversedMovementIds.has(movement.id),
    );
    const receivedValueMinor = activeReceipts.reduce((sum, movement) => sum + movement.valueDeltaMinor, 0);
    if (input.totalMinor < receivedValueMinor)
      return {
        ok: false,
        code: "validation_error",
        message: `الإجمالي الجديد أقل من قيمة مستلمة موثقة (${receivedValueMinor / 100} د.أ) — راجع إيصالات الاستلام أولًا.`,
      };
    /* SA-5 (F3): الربط لا يُبدَّل ولا يُفرَّغ وإيصالات قائمة عليه — وحدات
     * الإيصالات القديمة تبقى على المادة القديمة فيلوّث الحساب لو سُمح. */
    const currentMaterialId = existing.value.materialId ?? null;
    const nextMaterialId = input.materialId ?? null;
    if (activeReceipts.length > 0 && nextMaterialId !== currentMaterialId)
      return {
        ok: false,
        code: "validation_error",
        message:
          "لا يمكن تغيير ربط المادة مع إيصالات استلام قائمة على الربط الحالي — راجع إيصالات الاستلام أولًا.",
      };
    if (input.expectedQuantityMilli !== null && input.expectedQuantityMilli !== undefined) {
      const receivedQuantityMilli = activeReceipts.reduce(
        (sum, movement) => sum + movement.quantityDeltaMilli,
        0,
      );
      if (input.expectedQuantityMilli < receivedQuantityMilli)
        return {
          ok: false,
          code: "validation_error",
          message: "الكمية المتوقعة الجديدة أقل من الكمية المستلمة الموثقة — راجع إيصالات الاستلام أولًا.",
        };
    }
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
        materialId: input.materialId,
        expectedQuantityMilli: input.expectedQuantityMilli,
      });
      /* المجموعة ٢ (التحصين الكامل — HIGH-001): مراجعة واحدة بالضبط داخل
       * معاملة واحدة — قيم «قبل التصحيح» تُطابق الحالة الحية داخلها، فتعديل
       * بني على قراءة قديمة يُرفض ولا يمس الدفعات الموازية. */
      const saved = await this.store.commitSupplierPurchase({
        kind: "revision",
        purchase: updated,
        idempotencyKey: input.idempotencyKey,
      });
      return saved.ok
        ? { ok: true, value: saved.value.purchase, reused: saved.value.reused }
        : {
            ok: false,
            code: storageFailureCode(saved.code),
            message: saved.message ?? "تعذر حفظ تعديل الشراء محليًا — بقي الأصل دون تغيير؛ أعد المحاولة.",
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
      /* المجموعة ٢ (التحصين الكامل — HIGH-001): تراجع واحد بالضبط داخل معاملة
       * واحدة — الدفعة لم تُتراجَع سابقًا في الحالة الحية داخلها؛ أي مسار
       * متزامن يُرفض بوضوح ولا يُكرر الأثر المالي. */
      const saved = await this.store.commitSupplierPurchase({
        kind: "payment_reversal",
        purchase: updated,
        idempotencyKey: input.idempotencyKey,
      });
      return saved.ok
        ? { ok: true, value: saved.value.purchase, reused: saved.value.reused }
        : {
            ok: false,
            code: storageFailureCode(saved.code),
            message: saved.message ?? "تعذر حفظ التراجع محليًا. بقي الدفع دون تغيير.",
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
