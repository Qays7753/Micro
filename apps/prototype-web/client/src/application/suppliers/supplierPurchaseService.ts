/** Supplier/material purchase Application layer. Purchases alter cash and supplier payable, never operating expense or period result. */
import {
  createSupplierPurchase,
  recordSupplierPurchasePayment,
  reverseSupplierPurchasePayment,
  updateSupplierPurchase,
  type SupplierPurchase,
} from "@micro-domain/supplier-purchase/index.js";
import { createCashContinuityEntry, summarizeCashContinuity } from "@micro-domain/cash-continuity/index.js";
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
  /* FIN-003 (قرار المالك المعتمد ٢٠٢٦-٠٩-١٦): محفظة مصدر الدفعة الأولية —
   * تُتحقق وتُخصم مرة واحدة قبل إعلان النجاح؛ غيابها = الكاش غير الموزع. */
  initialPaymentWalletId?: string | null;
};
export type SupplierPurchasePaymentInput = {
  purchaseId: string;
  amountMinor: number;
  occurredOn: string;
  note: string;
  idempotencyKey: string;
  /* FIN-003: محفظة مصدر الدفعة — null = من الكاش غير الموزع. */
  walletId?: string | null;
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
  | { ok: true; value: T; reused?: boolean; attributionNote?: string | null }
  | { ok: false; code: "validation_error" | "storage_error" | "storage_stale"; message: string };

/* رقعة إغلاق المجموعة ٢ (مراجعة مستقلة): كود المحوّل المطبوع يُحفظ عبر طبقة
 * التطبيق — تعارض القراءة-التعديل-الكتابة يظهر storage_stale (أعد الفتح ثم
 * أعد المحاولة) والفشل التخزيني الحقيقي يبقى storage_error؛ المستدعون لا
 * يفسّرون النص العربي لمعرفة الصنف. التصنيف المشترك في طبقة التخزين
 * (`storageFailureCode`). */

const id = () =>
  globalThis.crypto?.randomUUID?.() ??
  `supplier-purchase-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const initialPaidPositive = (input: SupplierPurchaseInput): boolean =>
  Number.isInteger(input.initialPaidMinor) && input.initialPaidMinor > 0;

export class SupplierPurchaseService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  /* FIN-003 (قرار المالك المعتمد ٢٠٢٦-٠٩-١٦): فحص تغطية المحفظة قبل أي كتابة —
   * رصيد لا يغطي الدفعة يُرفض برسالة صريحة تُرجع صاحبها لاختيار محفظة أخرى
   * أو الكاش غير الموزع صراحةً؛ لا تحويل صامت ولا حفظ جزئي. */
  private async validateWalletCoverage(
    walletId: string,
    amountMinor: number,
  ): Promise<SupplierPurchaseResult<never> | { ok: true; value: { walletBalanceMinor: number } }> {
    const [walletsResult, entriesResult] = await Promise.all([
      this.store.listCashWallets(),
      this.store.listCashContinuityEntries(),
    ]);
    if (!walletsResult.ok || !entriesResult.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة المحافظ قبل تسجيل الدفعة." };
    const wallet = walletsResult.value.find(candidate => candidate.id === walletId);
    if (!wallet) return { ok: false, code: "validation_error", message: "اختر محفظة موجودة قبل حفظ الدفعة." };
    const walletBalanceMinor = summarizeCashContinuity(
      entriesResult.value.filter(entry => entry.walletId === wallet.id),
    );
    if (walletBalanceMinor < amountMinor)
      return {
        ok: false,
        code: "validation_error",
        message: "رصيد المحفظة لا يغطي هذه الدفعة — اختر محفظة أخرى أو اصرفها من الكاش غير الموزع صراحةً.",
      };
    return { ok: true, value: { walletBalanceMinor } };
  }

  /* FIN-003: نسبة دفعة مورد لمحفظتها بعد حفظها — تخصيص واحد سالب يغطي من رصيد
   * المحفظة ويرجع أثرها إلى «غير الموزع» فلا يصبح سالبًا مرتين، بمفتاح حتمية
   * مشتق (الإعادة لا تكرر) وربط مصدر «supplier_purchase» يصل دفتر المحفظة
   * بالشراء نفسه. الفشل المتأخر يُعلن في الوصل لا يُبتلع. */
  private async attributePaymentToWallet(input: {
    walletId: string;
    amountMinor: number;
    occurredOn: string;
    sourceRefId: string;
    operationKey: string;
  }): Promise<string | null> {
    try {
      const [walletsResult, entriesResult] = await Promise.all([
        this.store.listCashWallets(),
        this.store.listCashContinuityEntries(),
      ]);
      if (!walletsResult.ok || !entriesResult.ok)
        return "تعذّرت نسبة الدفعة للمحفظة — هي محفوظة الآن ضمن الكاش غير الموزع؛ راجعها من مالي.";
      const wallet = walletsResult.value.find(candidate => candidate.id === input.walletId);
      if (!wallet)
        return "المحفظة المختارة لم تُوجد بعد الحفظ — الدفعة محفوظة ضمن الكاش غير الموزع؛ راجعها من مالي.";
      if (entriesResult.value.some(entry => entry.operationKey === input.operationKey)) return null;
      const entry = createCashContinuityEntry({
        id: `supplier-payment-attr-${id()}`,
        walletId: wallet.id,
        type: "allocation",
        occurredOn: input.occurredOn,
        recordedAt: this.now(),
        cashDeltaMinor: -input.amountMinor,
        note: "تغطية دفعة مورد من رصيد المحفظة",
        operationKey: input.operationKey,
        sourceRefId: input.sourceRefId,
        sourceRefKind: "supplier_purchase",
      });
      const saved = await this.store.commitCashContinuity(wallet, [entry]);
      if (!saved.ok)
        return "تعذّرت نسبة الدفعة للمحفظة — هي محفوظة الآن ضمن الكاش غير الموزع؛ راجعها من مالي.";
      return null;
    } catch {
      return "تعذّرت نسبة الدفعة للمحفظة — هي محفوظة الآن ضمن الكاش غير الموزع؛ راجعها من مالي.";
    }
  }

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
    const initialPaymentWalletId = input.initialPaymentWalletId?.trim() || null;
    try {
      /* FIN-003: تحقق الرصيد قبل أي كتابة — الدفعة من محفظة لا تُحفظ أصلًا إن
       * كان رصيدها لا يغطيها؛ لا حالة نصف مكتملة مضللة. */
      const walletGuard =
        initialPaidPositive(input) && initialPaymentWalletId
          ? await this.validateWalletCoverage(initialPaymentWalletId, input.initialPaidMinor)
          : null;
      if (walletGuard && !walletGuard.ok) return walletGuard;
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
        /* FIN-003: مصدر الدفعة الأولية يُحفظ على الدفعة نفسها. */
        initialPaymentWalletId,
      });
      /* المجموعة ٢ (التحصين الكامل — HIGH-001): الالتزام الذرّي — مفتاح الحتمية
       * يُفحص داخل المعاملة (إعادة التشغيل تُعاد كما هي) ولا يُنشأ سجل فوق
       * مسار متزامن آخر. */
      const saved = await this.store.commitSupplierPurchase({
        kind: "create",
        purchase,
        idempotencyKey: input.idempotencyKey,
      });
      if (!saved.ok)
        return {
          ok: false,
          code: storageFailureCode(saved.code),
          message: saved.message ?? "تعذر حفظ شراء المواد محليًا — بياناتك كما هي؛ أعد المحاولة.",
        };
      /* FIN-003: بعد نجاح حفظ الشراء تُنسب الدفعة الأولية لمحفظتها بتخصيص
       * سالب واحد — لا خصم مزدوج ولا سالب غير موزع. فشل متأخر يُعلن صادقًا. */
      const attributionNote =
        !saved.value.reused && initialPaidPositive(input) && initialPaymentWalletId
          ? await this.attributePaymentToWallet({
              walletId: initialPaymentWalletId,
              amountMinor: input.initialPaidMinor,
              occurredOn: input.purchasedOn,
              sourceRefId: saved.value.purchase.id,
              operationKey: `${input.idempotencyKey}:initial-attribute`,
            })
          : null;
      return { ok: true, value: saved.value.purchase, reused: saved.value.reused, attributionNote };
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
    const walletId = input.walletId?.trim() || null;
    try {
      /* FIN-003: تحقق الرصيد قبل أي كتابة — رفض صريح بلا حفظ جزئي. */
      const walletGuard = walletId ? await this.validateWalletCoverage(walletId, input.amountMinor) : null;
      if (walletGuard && !walletGuard.ok) return walletGuard;
      const updated = recordSupplierPurchasePayment(existing.value, {
        id: id(),
        amountMinor: input.amountMinor,
        occurredOn: input.occurredOn,
        recordedAt: this.now(),
        idempotencyKey: input.idempotencyKey,
        note: input.note,
        /* FIN-003: مصدر الدفعة يُحفظ معها. */
        walletId,
      });
      /* المجموعة ٢ (التحصين الكامل — HIGH-001): دفعة واحدة بالضبط داخل معاملة
       * واحدة — مفتاح الحتمية يُفحص داخلها، والكتابة المتزامنة من مسار آخر
       * تُرفض بوضوح ولا تُسقط أثر أي طرف بصمت. */
      const saved = await this.store.commitSupplierPurchase({
        kind: "payment",
        purchase: updated,
        idempotencyKey: input.idempotencyKey,
      });
      if (!saved.ok)
        return {
          ok: false,
          code: storageFailureCode(saved.code),
          message: saved.message ?? "تعذر حفظ دفعة المورد محليًا — بياناتك كما هي؛ أعد المحاولة.",
        };
      /* FIN-003: نسبة الدفعة لمحفظتها بعد الحفظ الناجح — تخصيص واحد سالب
       * بمفتاح حتمية مشتق؛ الإعادة لا تخصم مرتين. */
      const attributionNote =
        !saved.value.reused && walletId
          ? await this.attributePaymentToWallet({
              walletId,
              amountMinor: input.amountMinor,
              occurredOn: input.occurredOn,
              sourceRefId: input.purchaseId,
              operationKey: `${input.idempotencyKey}:attribute`,
            })
          : null;
      return { ok: true, value: saved.value.purchase, reused: saved.value.reused, attributionNote };
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
