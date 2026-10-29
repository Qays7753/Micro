/** Supplier/material purchase Application layer. Purchases alter cash and supplier payable, never operating expense or period result. */
import {
  createSupplierPurchase,
  recordSupplierPurchasePayment,
  reverseSupplierPurchasePayment,
  updateSupplierPurchase,
  type SupplierPurchase,
  type SupplierPurchaseLine,
} from "@micro-domain/supplier-purchase/index.js";
import { materialIsTracked } from "@micro-domain/inventory-material/index.js";
import {
  createCashContinuityEntry,
  summarizeCashContinuity,
  type CashContinuityEntry,
} from "@micro-domain/cash-continuity/index.js";
import type { PrototypeLocalStore } from "@/storage/local/types";
import type { SupplierPurchaseStore } from "@/storage/local/capabilities/supplierPurchaseStore";

/** R3 (R3-SC-03): عدسة الخدمة — قدرة مشتريات المورّد حصرًا مع القنوات
 * المستخدمة بالضبط (السيولة النقدية للقراءة، وحركات المخزون للربط). */
export type SupplierPurchaseServiceStore = SupplierPurchaseStore &
  Pick<
    PrototypeLocalStore,
    "listCashWallets" | "listCashContinuityEntries" | "listInventoryMovements" | "listMaterials"
  >;
import { storageFailureCode } from "@/storage/local/types";
import type { SupplierPurchaseCommit } from "@/storage/local/supplierScheduleCommitGuard";
import {
  STORAGE_ERROR,
  VALIDATION_ERROR,
  errorMessageOf,
  storageFailure,
  validationFailure,
} from "@/application/resultCodes";
import { systemClock, type Clock } from "@/application/time/clock";
import { formatMoneyWithUnit } from "@/application/formatting/formatters";

export type SupplierPurchaseInput = {
  /* S05 (DOC-014 / UNIT-037 AC02): null = شراء مدفوع كاملًا بلا مورد مسجل. */
  supplierName: string | null;
  supplierPartyId?: string | null;
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
  /* S07 (UNIT-027 D01): بنود اختيارية بمعالجة معلنة — الغياب = شراء بلا بنود
   * (المسار القائم)؛ والتطابق مع حالة تتبع المادة الحية شرط عند الكتابة. */
  lines?: readonly SupplierPurchaseLine[] | null;
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
  /* S05 (DOC-014 / UNIT-037): null = بلا مورد مسجل (مسموح ما دام مسددًا كاملًا). */
  supplierName: string | null;
  supplierPartyId?: string | null;
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
  /* S07 (UNIT-027): البنود بعد التعديل — استبدال معلن؛ الإرث بلا بنود يبقى
   * بلا بنود إن لم تُعط. */
  lines?: readonly SupplierPurchaseLine[] | null;
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
    private readonly store: SupplierPurchaseServiceStore,
    private readonly now: Clock = systemClock,
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
    if (!walletsResult.ok || !entriesResult.ok) return storageFailure("تعذر قراءة المحافظ قبل تسجيل الدفعة.");
    const wallet = walletsResult.value.find(candidate => candidate.id === walletId);
    if (!wallet) return validationFailure("اختر محفظة موجودة قبل حفظ الدفعة.");
    const walletBalanceMinor = summarizeCashContinuity(
      entriesResult.value.filter(entry => entry.walletId === wallet.id),
    );
    if (walletBalanceMinor < amountMinor)
      return validationFailure(
        "رصيد المحفظة لا يغطي هذه الدفعة — اختر محفظة أخرى أو اصرفها من الكاش غير الموزع صراحةً.",
      );
    return { ok: true, value: { walletBalanceMinor } };
  }

  /* S07 (UNIT-027): فحص تطابق بنود الشراء مع حالة تتبع المادة الحية داخل حد
   * الكتابة — بند tracked_material يوجب مادة قائمة متتبعة فعلاً (وإلا لا
   * جسر استلام فوقه أبدًا)، وبند period_material بمادة متتبعة ازدواج اعتراف
   * (فترة عند الشراء + عند الاستعمال) فيُرفض، وبند بمادة غير موجودة يُرفض
   * كربط الرأس نفسه. بلا بنود = لا فحص (المسار القائم). */
  private async validatePurchaseLinesAgainstMaterials(
    lines: readonly SupplierPurchaseLine[] | null,
  ): Promise<SupplierPurchaseResult<never> | { ok: true; value: null }> {
    if (lines === null || lines === undefined || lines.length === 0) return { ok: true, value: null };
    const materialsResult = await this.store.listMaterials();
    if (!materialsResult.ok) return storageFailure("تعذر قراءة المواد قبل حفظ الشراء.");
    const materials = materialsResult.value;
    for (const line of lines) {
      const materialId = line.materialId ?? null;
      if (materialId === null) {
        if (line.treatment === "tracked_material")
          return validationFailure("بند المواد المتتبعة يوجب مادة مرتبطة — لا تتبع بلا مادة.");
        continue;
      }
      const material = materials.find(candidate => candidate.id === materialId);
      if (!material) return validationFailure("اربط بند الشراء بمادة موجودة أو اتركه بلا مادة.");
      const tracked = materialIsTracked(material);
      if (line.treatment === "tracked_material" && !tracked)
        return validationFailure(
          "المادة غير متتبَّعة — سجّل بندها مواد فترة، أو فعّل متابعة المادة أولًا ثم اربطه متتبعًا.",
        );
      if (line.treatment === "period_material" && tracked)
        return validationFailure(
          "المادة متتبَّعة — تكلفة بندها تُعرف عند الاستعمال لا عند الشراء؛ سجّله بند مواد متتبعة أو أوقف متابعة المادة أولًا.",
        );
    }
    return { ok: true, value: null };
  }

  /* FIN-003: نسبة دفعة مورد لمحفظتها — تُبنى قبل الالتزام وتُكتب معه في
   * معاملة واحدة (G-002): تخصيص واحد سالب يغطي من رصيد المحفظة ويرجع أثرها
   * إلى «غير الموزع» فلا يصبح سالبًا مرتين، بمفتاح حتمية مشتق (الإعادة لا
   * تكرر) وربط مصدر «supplier_purchase» يصل دفتر المحفظة بالشراء نفسه.
   * إعادة الإرسال بعد فشل/انقطاع تشفي التخصيص الناقص داخل المعاملة نفسها
   * من الحقيقة المخزّنة — لا حالة نصفية دائمة. */
  private buildAttributionEntry(input: {
    walletId: string;
    amountMinor: number;
    occurredOn: string;
    sourceRefId: string;
    operationKey: string;
  }): CashContinuityEntry {
    return createCashContinuityEntry({
      id: `supplier-payment-attr-${id()}`,
      walletId: input.walletId,
      type: "allocation",
      occurredOn: input.occurredOn,
      recordedAt: this.now(),
      cashDeltaMinor: -input.amountMinor,
      note: "تغطية دفعة مورد من رصيد المحفظة",
      operationKey: input.operationKey,
      sourceRefId: input.sourceRefId,
      sourceRefKind: "supplier_purchase",
    });
  }

  async list(): Promise<SupplierPurchaseResult<readonly SupplierPurchase[]>> {
    const purchases = await this.store.listSupplierPurchases();
    return purchases.ok
      ? { ok: true, value: purchases.value }
      : storageFailure("تعذر قراءة مشتريات الموردين المحلية.");
  }

  async readSummary(): Promise<SupplierPurchaseResult<SupplierPurchaseSummary>> {
    const purchases = await this.store.listSupplierPurchases();
    if (!purchases.ok) return storageFailure("تعذر قراءة مشتريات الموردين المحلية.");
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
          "شراء المواد يغيّر الكاش أو ذمة المورد فقط؛ وتكلفته تُعرف من بنوده: مواد الفترة بلا متابعة تُحمل مرة على فترة الشراء، والمتتبعة عند استعمالها.",
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
      /* S07 (UNIT-027): تطابق معالجة البنود مع حالة تتبع المادة الحية داخل
       * حد الكتابة نفسه — بند متتبع يوجب مادة متتبعة قائمة (وإلا لا جسر
       * استلام فوقه)، وبند فترة بمادة متتبعة يعترف الفترة ويستعمل معًا
       * (ازدواج) فلا يقبل؛ وبند فترة بمادة غير موجودة يُرفض كربط الرأس
       * نفسه. الشكل الذاتي للبند تحرسه السياسة النقية (assertPurchaseLines). */
      const linesGuard = await this.validatePurchaseLinesAgainstMaterials(input.lines ?? null);
      if (!linesGuard.ok) return linesGuard;
      const purchase = createSupplierPurchase({
        id: id(),
        supplierName: input.supplierName,
        supplierPartyId: input.supplierPartyId ?? null,
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
        /* S07 (UNIT-027): البنود كما دخلت بعد فحص التطابق أعلاه — التطبيع
         * والحدود الذاتية عند السياسة النقية. */
        lines: input.lines ?? null,
        /* FIN-003: مصدر الدفعة الأولية يُحفظ على الدفعة نفسها. */
        initialPaymentWalletId,
      });
      /* G-002 (تدقيق الإدارة المالية المتدرجة 2026-09-19): الالتزام الذرّي
       * الواحد — الشراء والدفع الأولي وتخصيص محفظته معًا أو لا شيء؛ إعادة
       * الإرسال بعد فشل تشفي التخصيص من الحقيقة المخزّنة داخل المعاملة. */
      const attribution =
        initialPaidPositive(input) && initialPaymentWalletId
          ? this.buildAttributionEntry({
              walletId: initialPaymentWalletId,
              amountMinor: input.initialPaidMinor,
              occurredOn: input.purchasedOn,
              sourceRefId: purchase.id,
              operationKey: `${input.idempotencyKey}:initial-attribute`,
            })
          : null;
      const saved = await this.store.commitSupplierPurchaseWithAttribution(
        {
          kind: "create",
          purchase,
          idempotencyKey: input.idempotencyKey,
        },
        attribution,
      );
      if (!saved.ok)
        return {
          ok: false,
          code: storageFailureCode(saved.code),
          message: saved.message ?? "تعذر حفظ شراء المواد محليًا — بياناتك كما هي؛ أعد المحاولة.",
        };
      return { ok: true, value: saved.value.purchase, reused: saved.value.reused, attributionNote: null };
    } catch (error) {
      return validationFailure(errorMessageOf(error, "بيانات الشراء غير صالحة."));
    }
  }

  async recordPayment(
    input: SupplierPurchasePaymentInput,
  ): Promise<SupplierPurchaseResult<SupplierPurchase>> {
    const existing = await this.store.getSupplierPurchase(input.purchaseId);
    if (!existing.ok) return storageFailure("تعذر قراءة شراء المورد.");
    if (!existing.value) return validationFailure("اختر شراء مواد مسجلًا قبل تسجيل الدفعة.");
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
      /* G-002: الالتزام الذرّي الواحد — الدفعة وتخصيص محفظتها معًا أو لا شيء؛
       * إعادة الإرسال بعد فشل تشفي التخصيص من الحقيقة المخزّنة داخل المعاملة
       * نفسها فلا يُتخطى التخصيص لأن الدفعة «reused». */
      const attribution = walletId
        ? this.buildAttributionEntry({
            walletId,
            amountMinor: input.amountMinor,
            occurredOn: input.occurredOn,
            sourceRefId: input.purchaseId,
            operationKey: `${input.idempotencyKey}:attribute`,
          })
        : null;
      const saved = await this.store.commitSupplierPurchaseWithAttribution(
        {
          kind: "payment",
          purchase: updated,
          idempotencyKey: input.idempotencyKey,
        },
        attribution,
      );
      if (!saved.ok)
        return {
          ok: false,
          code: storageFailureCode(saved.code),
          message: saved.message ?? "تعذر حفظ دفعة المورد محليًا — بياناتك كما هي؛ أعد المحاولة.",
        };
      return { ok: true, value: saved.value.purchase, reused: saved.value.reused, attributionNote: null };
    } catch (error) {
      return validationFailure(errorMessageOf(error, "بيانات الدفعة غير صالحة."));
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
    if (!existing.ok || !movements.ok) return storageFailure("تعذر قراءة شراء المورد.");
    if (!existing.value) return validationFailure("اختر شراء مواد مسجلًا قبل تعديله.");
    if (!input.reason.trim()) return validationFailure("اكتب سبب التعديل قبل الحفظ.");
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
        code: VALIDATION_ERROR,
        /* R2 (M-07/D10، 2026-10-08): المعيّن الكنوني للمال بوحدته — كانت
         * قسمة خام بلا منزلتين ولا فواصل («10.5»)؛ تغيير نص رسالة مقصود
         * (message-only؛ لا مستهلك تشغيلي يتفرع على النص — جرد R2-MF-01 §7). */
        message: `الإجمالي الجديد أقل من قيمة مستلمة موثقة (${formatMoneyWithUnit(receivedValueMinor)}) — راجع إيصالات الاستلام أولًا.`,
      };
    /* SA-5 (F3): الربط لا يُبدَّل ولا يُفرَّغ وإيصالات قائمة عليه — وحدات
     * الإيصالات القديمة تبقى على المادة القديمة فيلوّث الحساب لو سُمح. */
    const currentMaterialId = existing.value.materialId ?? null;
    const nextMaterialId = input.materialId ?? null;
    if (activeReceipts.length > 0 && nextMaterialId !== currentMaterialId)
      return {
        ok: false,
        code: VALIDATION_ERROR,
        message:
          "لا يمكن تغيير ربط المادة مع إيصالات استلام قائمة على الربط الحالي — راجع إيصالات الاستلام أولًا.",
      };
    if (input.expectedQuantityMilli !== null && input.expectedQuantityMilli !== undefined) {
      const receivedQuantityMilli = activeReceipts.reduce(
        (sum, movement) => sum + movement.quantityDeltaMilli,
        0,
      );
      if (input.expectedQuantityMilli < receivedQuantityMilli)
        return validationFailure(
          "الكمية المتوقعة الجديدة أقل من الكمية المستلمة الموثقة — راجع إيصالات الاستلام أولًا.",
        );
    }
    /* S07 (UNIT-027 / SDF-071): البنود بعد التعديل تفحص توابعها — إيصالات
     * قائمة مقيدة ببند حي تجعل تغيير البنود/إزالتها غير مؤهل؛ يُراجع
     * الاستلام عند مالكه أولًا (عكس موثق) ثم يُعدّل. تطابق المعالجة مع
     * حالة تتبع المادة الحية كالإنشاء تمامًا. */
    const currentLines = existing.value.lines ?? null;
    const nextLines = input.lines ?? null;
    if (activeReceipts.length > 0 && nextLines !== null) {
      const currentLineList = currentLines ?? [];
      const nextLineList = nextLines;
      const linesChanged =
        currentLineList.length !== nextLineList.length ||
        !nextLineList.every((line, index) => {
          const before = currentLineList[index];
          return (
            before !== undefined &&
            before.lineId === line.lineId &&
            (before.materialId ?? null) === (line.materialId ?? null) &&
            (before.expectedQuantityMilli ?? null) === (line.expectedQuantityMilli ?? null) &&
            (before.valueMinor ?? null) === (line.valueMinor ?? null) &&
            before.costKnowledge === line.costKnowledge &&
            before.treatment === line.treatment
          );
        });
      if (linesChanged)
        return validationFailure(
          "لا يمكن تغيير بنود الشراء مع إيصالات استلام قائمة عليها — راجع إيصالات الاستلام أولًا.",
        );
    }
    const linesGuard = await this.validatePurchaseLinesAgainstMaterials(nextLines);
    if (!linesGuard.ok) return linesGuard;
    try {
      const updated = updateSupplierPurchase(existing.value, {
        supplierName: input.supplierName,
        supplierPartyId: input.supplierPartyId ?? null,
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
        /* S07 (UNIT-027): البنود بعد التعديل — استبدال معلن بقيم «قبل»
         * موثقة في المراجعة (beforeLines). */
        lines: input.lines ?? null,
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
      return validationFailure(errorMessageOf(error, "بيانات تعديل الشراء غير صالحة."));
    }
  }

  /* المجموعة ٢ (§10.4): تراجع موثق عن دفعة لاحقة — يستعيد المتبقي للمورد
   * ويُرجع أثر الكاش المدفوع؛ الدفعة الأصلية تبقى وعلاقة التدقيق صريحة. */
  async reversePayment(
    input: SupplierPaymentReversalInput,
  ): Promise<SupplierPurchaseResult<SupplierPurchase>> {
    const existing = await this.store.getSupplierPurchase(input.purchaseId);
    if (!existing.ok) return storageFailure("تعذر قراءة شراء المورد.");
    if (!existing.value) return validationFailure("اختر شراء مواد مسجلًا قبل التراجع عن دفعته.");
    if (!input.reason.trim()) return validationFailure("اكتب سبب التراجع قبل الحفظ.");
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
      return validationFailure(errorMessageOf(error, "بيانات التراجع غير صالحة."));
    }
  }
}
