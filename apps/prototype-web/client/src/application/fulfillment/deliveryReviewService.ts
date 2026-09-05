/**
 * المجموعة ٣ (عقد D4): خدمة مراجعة التسليم وتنفيذه — المصدر الوحيد لمعاملة
 * التسليم الكاملة. قبل أي كتابة: مراجعة كاملة (سعر/مقبوض/عربون/متبقٍ/تكلفة
 * بحالتها/أثر مخزون مقترح). عند التنفيذ: الطلب المسلّم + حركات استهلاك المواد
 * + سجلات النقص + تخصيص الكاش المقبوض عند التسليم تُكتب في معاملة ذرّية
 * واحدة (commitOrderDelivery) — كل شيء أو لا شيء. إعادة المحاولة والنقر
 * المزدوج وإعادة التحميل آمنة بمفاتيح حتمية. عكس التسليم تصحيح موثق يحيّد
 * الإيراد ويعكس الحركات مرآةً ولا يمس الكاش المقبوض.
 * لا يُنشئ هذا المسار إيرادًا ثانيًا ولا قبضة مكررة ولا خصم مخزون خفيًا.
 */
import {
  collectRemaining,
  knowledgeGapsOf,
  noteDeliveryConsumption,
  reverseDelivery,
  reviseAgreedPrice,
  transitionOrder,
} from "@micro-domain/craft-order/index.js";
import {
  assertInventoryRemainsNonNegative,
  consumptionValueMinor,
  createInventoryMovement,
  createInventoryShortage,
  materialIsTracked,
  positionCostKnowledge,
  summarizeMaterialInventory,
  type InventoryMovement,
  type InventoryShortage,
} from "@micro-domain/inventory-material/index.js";
import { createCashContinuityEntry } from "@micro-domain/cash-continuity/index.js";
import type { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import type { ScheduleService } from "@/application/scheduling/scheduleService";
import { formatMoneyMinor, localDateInAmman } from "@/presentation/formatters";
import type { PrototypeLocalStore, StoredCraftOrder } from "@/storage/local/types";
import type { CashContinuityEntry, CashWallet } from "@micro-domain/cash-continuity/index.js";

export type DeliveryConsumptionAction = "consume" | "consume_with_shortage" | "record_shortage" | "skip";

export type DeliveryConsumptionRow = {
  materialId: string;
  materialName: string;
  unitLabel: string;
  tracked: boolean;
  plannedQuantityMilli: number;
  availableQuantityMilli: number;
  availableKnown: boolean;
  costKnowledge: "known" | "partial" | "unknown";
  shortageQuantityMilli: number;
  suggestedAction: DeliveryConsumptionAction;
  snapshotUnitPriceMinor: number;
  snapshotUnit: string;
};

export type DeliveryReview = {
  orderId: string;
  itemName: string;
  customerName: string;
  quantity: number;
  deliveryDate: string;
  money: {
    agreedPriceMinor: number;
    collectedMinor: number;
    depositCollectedMinor: number;
    receivableMinor: number;
    snapshotCostMinor: number;
    knowledgeState: string;
    knowledgeGaps: readonly { id: string; mandatory: boolean }[];
    resultPreview: "final" | "estimated" | "incomplete" | "review_required";
  };
  consumption: {
    hasLinkedMaterials: boolean;
    rows: readonly DeliveryConsumptionRow[];
    unlinkedItems: readonly { name: string; quantity: number; unit: string }[];
    /* المجموعة ٤ (عقد ٢٩): إعلان الخصم التلقائي من قالب المنتج — علم صريح
     * يقرأ من القالب النشط؛ لا يخصم بنفسه، بل يجعل الاقتراح جاهزًا عند
     * التأكيد داخل المعاملة الذرّية نفسها. */
    autoConsume: boolean;
  };
  warnings: readonly string[];
};

export type CommitDeliveryInput = {
  rows: readonly { materialId: string; quantityMilli: number; action: DeliveryConsumptionAction }[];
  finalPriceMinor?: number | null;
  priceRevisionReason?: string | null;
  collectNow?: { amountMinor: number; walletId: string | null } | null;
  operationKey: string;
};

export type DeliveryCommitResult =
  | {
      ok: true;
      value: {
        stored: StoredCraftOrder;
        movements: readonly InventoryMovement[];
        shortages: readonly InventoryShortage[];
        cashEntry: CashContinuityEntry | null;
        reused: boolean;
        notice: string | null;
      };
    }
  | { ok: false; code: "storage_error" | "invalid_state" | "validation_error"; message: string };

export type ReverseDeliveryResult =
  | {
      ok: true;
      value: { stored: StoredCraftOrder; reversalMovements: readonly InventoryMovement[]; reused: boolean };
    }
  | { ok: false; code: "storage_error" | "invalid_state"; message: string };

const UNIT_LABELS: Record<string, string> = {
  piece: "قطعة",
  meter: "متر",
  kilogram: "كيلوغرام",
  liter: "لتر",
  other: "وحدة أخرى",
};

function failure<C extends "storage_error" | "invalid_state" | "validation_error">(
  code: C,
  message: string,
): { ok: false; code: C; message: string } {
  return { ok: false, code, message };
}

/* مفتاح تسليم فريد لكل محاولة تسليم — إعادة التسليم بعد عكسٍ تسليمٌ جديد
 * بمفتاح جديد؛ إعادة محاولة التسليم نفسه تعيد استخدام مفتاحه فلا تكرار.
 * (حدّ النطاق: eventExists يعامل المفتاح+النوع كإعادة تشغيل، فلو تكرر مفتاح
 * التسليم الأول لعادت إعادة التسليم بعد العكس بلا أثر — عدّ المحاولات يجعل
 * كل تسليم عمليته الحتمية الخاصة.) */
function deliveryIdempotencyKey(orderId: string, deliveryEventCount: number): string {
  return deliveryEventCount === 0 ? `${orderId}:deliver` : `${orderId}:deliver-${deliveryEventCount + 1}`;
}

function reversalIdempotencyKey(orderId: string, reversalEventCount: number): string {
  return reversalEventCount === 0
    ? `${orderId}:reverse-delivery`
    : `${orderId}:reverse-delivery-${reversalEventCount + 1}`;
}

function quantityMilliOf(quantity: number): number {
  return Math.round(quantity * 1000);
}

export class DeliveryReviewService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly finance: ProjectFinancialService | null = null,
    private readonly schedules: ScheduleService | null = null,
  ) {}

  /* القراءة فقط: كل ما سيتغير عند التسليم قبل أي كتابة — المال والمخزون
   * والمعرفة، بلا أثر جانبي. */
  async buildReview(
    orderId: string,
  ): Promise<
    | { ok: true; value: DeliveryReview }
    | { ok: false; code: "storage_error" | "invalid_state"; message: string }
  > {
    const [ordersResult, materialsResult, movementsResult, templatesResult] = await Promise.all([
      this.store.getOrder(orderId),
      this.store.listMaterials(),
      this.store.listInventoryMovements(),
      this.store.listCatalogTemplates(),
    ]);
    if (!ordersResult.ok || !materialsResult.ok || !movementsResult.ok || !templatesResult.ok)
      return failure("storage_error", "تعذر قراءة بيانات التسليم المحلية.");
    const stored = ordersResult.value;
    if (!stored) return failure("invalid_state", "الطلب غير متاح محليًا.");
    const order = stored.order;
    const warnings: string[] = [];
    if (order.status !== "ready") {
      return failure(
        "invalid_state",
        order.status === "delivered" || order.status === "settled"
          ? "هذا الطلب مسلّم سابقًا — راجع تفاصيله أو اعكس التسليم إن لزم."
          : "مراجعة التسليم تتطلب طلبًا جاهزًا للتسليم.",
      );
    }

    const materials = materialsResult.value;
    const movements = movementsResult.value;
    const rows: DeliveryConsumptionRow[] = [];
    const unlinkedItems: { name: string; quantity: number; unit: string }[] = [];
    /* SA-5 R3: بنود التكلفة المرتبطة بالمادة نفسها تُجمع كمياتها — بندان للمادة
     * الواحدة استهلاك واحد بمجموعهما لا صفان يطغى أحدهما على الآخر. */
    const seenMaterialQuantities = new Map<
      string,
      { quantity: number; unitPriceMinor: number; unit: string }
    >();
    for (const item of order.costSnapshot.input.materialItems) {
      const materialId = (item as { materialId?: string | null }).materialId ?? null;
      if (!materialId) {
        unlinkedItems.push({ name: item.name, quantity: item.quantity, unit: item.unit });
        continue;
      }
      const previous = seenMaterialQuantities.get(materialId);
      if (previous) {
        previous.quantity += item.quantity;
        continue;
      }
      seenMaterialQuantities.set(materialId, {
        quantity: item.quantity,
        unitPriceMinor: item.unitPriceMinor,
        unit: item.unit,
      });
    }
    for (const [materialId, aggregate] of seenMaterialQuantities) {
      const item = {
        name: "",
        quantity: aggregate.quantity,
        unit: aggregate.unit,
        unitPriceMinor: aggregate.unitPriceMinor,
      };
      const material = materials.find(candidate => candidate.id === materialId);
      if (!material) {
        warnings.push(`مادة مربوطة بالتكلفة غير موجودة في المخزون بعد — ستبقى بلا حركة كمية.`);
        continue;
      }
      const planned = quantityMilliOf(item.quantity);
      if (!materialIsTracked(material)) {
        /* عقد ٢٨: المادة غير المتتبَّعة مرجع تكلفة فقط — لا حركة كمية أبدًا. */
        rows.push({
          materialId,
          materialName: material.name,
          unitLabel: UNIT_LABELS[material.unit] ?? "وحدة أخرى",
          tracked: false,
          plannedQuantityMilli: planned,
          availableQuantityMilli: 0,
          availableKnown: false,
          costKnowledge: "unknown",
          shortageQuantityMilli: 0,
          suggestedAction: "skip",
          snapshotUnitPriceMinor: item.unitPriceMinor,
          snapshotUnit: item.unit,
        });
        continue;
      }
      const position = summarizeMaterialInventory(materialId, movements);
      const costKnowledge = positionCostKnowledge(movements, materialId);
      const shortage = Math.max(planned - position.quantityMilli, 0);
      const suggestedAction: DeliveryConsumptionAction =
        shortage <= 0 ? "consume" : position.quantityMilli > 0 ? "consume_with_shortage" : "record_shortage";
      if (shortage > 0)
        warnings.push(
          `المادة «${material.name}»: المطلوب أكبر من المتاح — سيُسجَّل النقص صراحةً ولا يصير الرصيد سالبًا.`,
        );
      rows.push({
        materialId,
        materialName: material.name,
        unitLabel: UNIT_LABELS[material.unit] ?? "وحدة أخرى",
        tracked: true,
        plannedQuantityMilli: planned,
        availableQuantityMilli: position.quantityMilli,
        availableKnown: true,
        costKnowledge,
        shortageQuantityMilli: shortage,
        suggestedAction,
        snapshotUnitPriceMinor: item.unitPriceMinor,
        snapshotUnit: item.unit,
      });
    }

    /* المجموعة ٤ (عقد ٢٩): علم الخصم التلقائي من القالب النشط لمنتج هذا الطلب —
     * إعلانٌ يقرأ فقط؛ الحركات تبقى داخل التأكيد الصريح والمعاملة الذرّية. */
    const autoConsume =
      stored.catalogItemId !== null &&
      templatesResult.value.some(
        template =>
          template.active &&
          template.catalogItemId === stored.catalogItemId &&
          template.autoConsumeOnDelivery === true,
      );
    return {
      ok: true,
      value: {
        orderId,
        itemName: order.itemName,
        customerName: order.customerName,
        quantity: order.quantity,
        deliveryDate: stored.deliveryDate,
        money: {
          agreedPriceMinor: order.agreedPriceMinor,
          collectedMinor: order.collectedMinor,
          depositCollectedMinor: order.depositCollectedMinor,
          receivableMinor: order.receivableMinor,
          snapshotCostMinor: order.costSnapshot.plannedCostMinor,
          knowledgeState: order.costSnapshot.knowledgeState,
          knowledgeGaps: knowledgeGapsOf(order.costSnapshot).map(gap => ({
            id: gap.id,
            mandatory: gap.mandatory,
          })),
          resultPreview: order.resultStatus,
        },
        consumption: {
          hasLinkedMaterials: rows.some(row => row.tracked),
          rows,
          unlinkedItems,
          autoConsume,
        },
        warnings,
      },
    };
  }

  /* التنفيذ الذرّي: طلب + حركات + نقص + تخصيص كاش في معاملة واحدة. */
  async commitDelivery(orderId: string, input: CommitDeliveryInput): Promise<DeliveryCommitResult> {
    const current = await this.store.getOrder(orderId);
    if (!current.ok) return failure("storage_error", "تعذر قراءة الطلب المحلي.");
    const stored = current.value;
    if (!stored) return failure("invalid_state", "الطلب غير متاح محليًا.");
    if (
      ["delivered", "settled"].includes(stored.order.status) &&
      stored.order.events.some(event => event.type === "status_changed" && event.toStatus === "delivered")
    ) {
      /* إعادة استخدام صادقة: التسليم حاصل — لا تكرار إيراد ولا حركات. */
      return {
        ok: true,
        value: { stored, movements: [], shortages: [], cashEntry: null, reused: true, notice: null },
      };
    }
    if (stored.order.status !== "ready")
      return failure("invalid_state", "تسجيل التسليم يتطلب طلبًا جاهزًا للتسليم.");

    const [materialsResult, movementsResult, walletsResult] = await Promise.all([
      this.store.listMaterials(),
      this.store.listInventoryMovements(),
      this.store.listCashWallets(),
    ]);
    if (!materialsResult.ok || !movementsResult.ok || !walletsResult.ok)
      return failure("storage_error", "تعذر قراءة بيانات التسليم المحلية.");
    const materials = materialsResult.value;
    const existingMovements = movementsResult.value;
    const wallets = walletsResult.value;

    const timestamp = this.now();
    let order = stored.order;
    const deliveryAttempt = order.events.filter(
      event => event.type === "status_changed" && event.toStatus === "delivered",
    ).length;
    const deliverKey = deliveryIdempotencyKey(orderId, deliveryAttempt);
    const priceKey = `${orderId}:deliver-price${deliveryAttempt === 0 ? "" : `-${deliveryAttempt + 1}`}`;
    const collectKey = `${orderId}:deliver-collect${deliveryAttempt === 0 ? "" : `-${deliveryAttempt + 1}`}`;
    const consumedKey = `${orderId}:deliver-consumed${deliveryAttempt === 0 ? "" : `-${deliveryAttempt + 1}`}`;

    /* تصحيح السعر عند التسليم تصريحًا لا صمتًا — سبب إلزامي وفرق معلن. */
    if (input.finalPriceMinor != null && input.finalPriceMinor !== order.agreedPriceMinor) {
      if (!input.priceRevisionReason?.trim())
        return failure("validation_error", "أكمل سبب تعديل السعر عند التسليم قبل الحفظ.");
      try {
        order = reviseAgreedPrice(order, {
          newPriceMinor: input.finalPriceMinor,
          reason: input.priceRevisionReason.trim(),
          idempotencyKey: priceKey,
          createdAt: timestamp,
        });
      } catch (error) {
        return failure("invalid_state", error instanceof Error ? error.message : "تعذر تعديل السعر.");
      }
    }

    /* التسليم: إيراد يُعرف مرة واحدة هنا — لا قبضة ولا حركة قبل هذا الحدث. */
    try {
      order = transitionOrder(order, { to: "delivered", idempotencyKey: deliverKey, createdAt: timestamp });
    } catch (error) {
      return failure("invalid_state", error instanceof Error ? error.message : "تعذر تسجيل التسليم.");
    }
    const deliveryEvent = [...order.events]
      .reverse()
      .find(event => event.type === "status_changed" && event.toStatus === "delivered");
    if (!deliveryEvent) return failure("invalid_state", "تعذر توثيق حدث التسليم.");

    /* حركات الاستهلاك — عقد ٢٨ نفسه: قيمة من موضع المادة، تكلفة مجهولة تبقى
     * موسومة، النقص سجل صريح، والمادة غير المتتبَّعة لا تتحرك. */
    const newMovements: InventoryMovement[] = [];
    const newShortages: InventoryShortage[] = [];
    const consumedNotes: string[] = [];
    const seenRowMaterialIds = new Set<string>();
    for (const row of input.rows) {
      /* SA-5 R3: صف واحد لكل مادة — التكرار يرفض صريحًا لا يطغى بصمت. */
      if (seenRowMaterialIds.has(row.materialId))
        return failure("validation_error", "مادة واحدة لكل صف — لا تكرر المادة في استهلاك التسليم.");
      seenRowMaterialIds.add(row.materialId);
      const material = materials.find(candidate => candidate.id === row.materialId);
      if (!material) return failure("validation_error", "اختر مواد موجودة قبل تسجيل استهلاك التسليم.");
      if (!materialIsTracked(material) && row.action !== "skip")
        return failure(
          "validation_error",
          `المادة «${material.name}» غير متتبَّعة — تبقى مرجع تكلفة بلا حركة كمية.`,
        );
      if (row.quantityMilli <= 0 && row.action !== "skip" && row.action !== "record_shortage")
        return failure("validation_error", `أدخل كمية صحيحة للمادة «${material.name}».`);
      const operationKey = `${orderId}:deliver:${deliveryEvent.id}:${row.materialId}`;
      if (existingMovements.some(movement => movement.operationKey === operationKey)) continue;
      const position = summarizeMaterialInventory(row.materialId, existingMovements);
      const costUnknown = positionCostKnowledge(existingMovements, row.materialId) === "unknown";
      const consumeQuantity =
        row.action === "consume" || row.action === "consume_with_shortage"
          ? row.action === "consume"
            ? row.quantityMilli
            : Math.min(row.quantityMilli, position.quantityMilli)
          : 0;
      if (consumeQuantity > 0) {
        if (row.action === "consume" && consumeQuantity > position.quantityMilli)
          return failure(
            "validation_error",
            `المادة «${material.name}»: الكمية المطلوبة أكبر من المتاح — اختر مسار النقص الصريح.`,
          );
        try {
          const value = consumptionValueMinor(consumeQuantity, position, costUnknown);
          const movement = createInventoryMovement({
            id: `delivery-consume-${orderId}-${row.materialId}-${deliveryEvent.id}`,
            materialId: row.materialId,
            type: "consumption",
            occurredOn: localDateInAmman(timestamp),
            recordedAt: timestamp,
            quantityDeltaMilli: -consumeQuantity,
            valueDeltaMinor: -value || 0,
            note: `استهلاك تسليم الطلب: ${order.itemName}`,
            operationKey,
            orderId,
            costKnowledge: value === 0 ? "unknown" : "known",
          });
          assertInventoryRemainsNonNegative(row.materialId, [...existingMovements, movement]);
          newMovements.push(movement);
          consumedNotes.push(
            `${material.name} (${(consumeQuantity / 1000).toFixed(3).replace(/\.?0+$/, "") || "0"} ${UNIT_LABELS[material.unit] ?? ""})`.trim(),
          );
        } catch (error) {
          return failure(
            "validation_error",
            error instanceof Error ? error.message : "بيانات استهلاك التسليم غير صالحة.",
          );
        }
      }
      const shortageQuantity =
        row.action === "record_shortage"
          ? row.quantityMilli - position.quantityMilli
          : row.action === "consume_with_shortage"
            ? row.quantityMilli - position.quantityMilli
            : 0;
      if (shortageQuantity > 0) {
        try {
          const shortage = createInventoryShortage({
            id: `delivery-shortage-${orderId}-${row.materialId}-${deliveryEvent.id}`,
            materialId: row.materialId,
            requestedQuantityMilli: row.quantityMilli,
            availableQuantityMilli: position.quantityMilli,
            shortageQuantityMilli: shortageQuantity,
            occurredOn: localDateInAmman(timestamp),
            recordedAt: timestamp,
            note: `نقص عند تسليم الطلب: ${order.itemName}`,
            orderId,
            operationKey: `${operationKey}:shortage`,
          });
          newShortages.push(shortage);
        } catch (error) {
          return failure(
            "validation_error",
            error instanceof Error ? error.message : "بيانات نقص التسليم غير صالحة.",
          );
        }
      }
    }

    /* توثيق الاستهلاك في خط زمن الطلب — بيان بشري فوق الحركات المرجعية. */
    if (consumedNotes.length > 0) {
      try {
        order = noteDeliveryConsumption(order, {
          note: `مواد مستهلكة عند التسليم: ${consumedNotes.join("، ")}`,
          reversesEventId: deliveryEvent.id,
          idempotencyKey: consumedKey,
          createdAt: timestamp,
        });
      } catch (error) {
        return failure(
          "invalid_state",
          error instanceof Error ? error.message : "تعذر توثيق استهلاك التسليم.",
        );
      }
    }

    /* قبض عند التسليم (اختياري): يُسجَّل على الطلب داخل المعاملة نفسها —
     * تحصيل لا إيراد؛ الإيراد عُرِف مرة واحدة أعلاه. */
    let wallet: CashWallet | null = null;
    let cashEntry: CashContinuityEntry | null = null;
    const collectNow = input.collectNow && input.collectNow.amountMinor > 0 ? input.collectNow : null;
    if (collectNow) {
      if (collectNow.amountMinor > order.receivableMinor)
        return failure("validation_error", "المقبوض عند التسليم لا يمكن أن يتجاوز المتبقي على الطلب.");
      try {
        order = collectRemaining(order, collectNow.amountMinor, collectKey, timestamp);
      } catch (error) {
        return failure(
          "invalid_state",
          error instanceof Error ? error.message : "تعذر تسجيل القبض عند التسليم.",
        );
      }
      if (collectNow.walletId) {
        wallet = wallets.find(candidate => candidate.id === collectNow.walletId) ?? null;
        if (!wallet) return failure("validation_error", "اختر محفظة موجودة لقبض التسليم أو اتركه غير موزع.");
        /* القبض يدخل الكاش غير الموزع في المعاملة نفسها (registeredCollectionsMinor)
         * فتخصيص قدره بالضبط مغطى دائمًا؛ الحارس الصارم يبقى في مسار التوزيع الموحد. */
        cashEntry = createCashContinuityEntry({
          id: `delivery-cash-${orderId}-${deliveryEvent.id}`,
          walletId: wallet.id,
          type: "allocation",
          occurredOn: localDateInAmman(timestamp),
          recordedAt: timestamp,
          cashDeltaMinor: collectNow.amountMinor,
          note: `قبض عند تسليم الطلب: ${order.itemName} — ${formatMoneyMinor(order.agreedPriceMinor)} د.أ`,
          operationKey: `${orderId}:deliver-cash:${deliveryEvent.id}`,
          sourceRefId: orderId,
          sourceRefKind: "order",
          sourceRefLineId: deliveryEvent.id,
        });
      }
    }

    const nextStored: StoredCraftOrder = { ...stored, order, updatedAt: timestamp };
    const committed = await this.store.commitOrderDelivery(
      nextStored,
      newMovements,
      newShortages,
      wallet,
      cashEntry,
    );
    if (!committed.ok) return failure("storage_error", "تعذر حفظ التسليم؛ لم يتغير أي رصيد أو حالة.");

    /* مواءمة المواعيد غير حاجرة — نمط deliver() القائم. */
    let notice: string | null = null;
    if (this.schedules) {
      const reconciled = await this.schedules.reconcileDelivery(orderId);
      if (!reconciled.ok && reconciled.code === "storage_error")
        notice = "تم تسجيل التسليم، وتعذرت مواءمة المواعيد المرتبطة به.";
    }
    return {
      ok: true,
      value: {
        stored: committed.value.order,
        movements: committed.value.movements,
        shortages: committed.value.shortages,
        cashEntry: committed.value.cashEntry,
        reused: committed.value.reused,
        notice,
      },
    };
  }

  /* عكس التسليم: الإيراد يُحيَّد، حركات الاستهلاك تُعكس مرآةً، الكاش المقبوض
   * يبقى (له مسار التراجع الخاص)، والطلب ينتقل إلى مراجعة صريحة. */
  async reverseDelivery(
    orderId: string,
    input: { reason: string; operationKey?: string },
  ): Promise<ReverseDeliveryResult> {
    const current = await this.store.getOrder(orderId);
    if (!current.ok) return failure("storage_error", "تعذر قراءة الطلب المحلي.");
    const stored = current.value;
    if (!stored) return failure("invalid_state", "الطلب غير متاح محليًا.");
    if (!input.reason.trim()) return failure("invalid_state", "أكمل سبب عكس التسليم قبل الحفظ.");
    const timestamp = this.now();
    const reversalAttempt = stored.order.events.filter(event => event.type === "delivery_reversed").length;
    const operationKey = input.operationKey ?? reversalIdempotencyKey(orderId, reversalAttempt);
    if (
      stored.order.events.some(
        event => event.type === "delivery_reversed" && event.idempotencyKey === operationKey,
      )
    ) {
      return { ok: true, value: { stored, reversalMovements: [], reused: true } };
    }
    let order;
    try {
      order = reverseDelivery(stored.order, {
        reason: input.reason.trim(),
        idempotencyKey: operationKey,
        createdAt: timestamp,
      });
    } catch (error) {
      return failure("invalid_state", error instanceof Error ? error.message : "تعذر عكس التسليم.");
    }
    /* حركات مرآة لكل استهلاك تسليم غير معكوس — عقد ٢٨: المرآة تحمل معرفة
     * التكلفة الأصلية، وعملية التراجع لا تُكرر. */
    const movementsResult = await this.store.listInventoryMovements();
    if (!movementsResult.ok) return failure("storage_error", "تعذر قراءة حركات المخزون.");
    const reversedIds = new Set(
      movementsResult.value
        .filter(movement => movement.type === "reversal" && movement.reversesMovementId)
        .map(movement => movement.reversesMovementId as string),
    );
    const deliveryPrefix = `${orderId}:deliver:`;
    const reversalMovements: InventoryMovement[] = [];
    for (const movement of movementsResult.value) {
      if (
        movement.orderId !== orderId ||
        movement.type !== "consumption" ||
        !movement.operationKey.startsWith(deliveryPrefix) ||
        reversedIds.has(movement.id)
      )
        continue;
      try {
        const reversal = createInventoryMovement({
          id: `delivery-reversal-${movement.id}`,
          materialId: movement.materialId,
          type: "reversal",
          occurredOn: localDateInAmman(timestamp),
          recordedAt: timestamp,
          quantityDeltaMilli: -movement.quantityDeltaMilli,
          valueDeltaMinor: -movement.valueDeltaMinor,
          note: `عكس تسليم: ${movement.note}`,
          reason: input.reason.trim(),
          operationKey: `${movement.operationKey}:reversal`,
          reversesMovementId: movement.id,
          costKnowledge: movement.costKnowledge ?? "known",
        });
        assertInventoryRemainsNonNegative(movement.materialId, [...movementsResult.value, reversal]);
        reversalMovements.push(reversal);
      } catch (error) {
        return failure(
          "invalid_state",
          error instanceof Error ? error.message : "تعذر عكس حركات استهلاك التسليم.",
        );
      }
    }
    const nextStored: StoredCraftOrder = { ...stored, order, updatedAt: timestamp };
    const committed = await this.store.commitOrderDeliveryReversal(nextStored, reversalMovements);
    if (!committed.ok) return failure("storage_error", "تعذر حفظ عكس التسليم؛ لم يتغير أي رصيد.");
    return {
      ok: true,
      value: {
        stored: committed.value.order,
        reversalMovements: committed.value.reversalMovements,
        reused: committed.value.reused,
      },
    };
  }
}
