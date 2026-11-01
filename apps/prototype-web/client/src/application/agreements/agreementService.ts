/**
 * Financial boundary for Slice 3. The service creates one CraftOrder from one
 * draft only after a saved cost snapshot exists — or, since S12 (UNIT-009 /
 * J002-DEC01), after the owner explicitly chooses an unknown-cost agreement;
 * React never changes money state.
 */
import {
  calculateCostSnapshot,
  collectDeposit,
  createCraftOrder,
  recordDeliveryTerms,
  transitionOrder,
  type CraftOrder,
} from "@micro-domain/craft-order/index.js";
import type { CostService } from "@/application/cost/costService";
import type { AgreementSource, OrderDraft, ScheduleEntry, StoredCraftOrder } from "@/storage/local/types";
import type { OrderLifecycleStore } from "@/storage/local/capabilities/orderLifecycleStore";
import {
  ORDERS_READ_FAILED_MESSAGE,
  ORDER_READ_FAILED_MESSAGE,
  ORDER_UNAVAILABLE_MESSAGE,
  STORAGE_ERROR,
  VALIDATION_ERROR,
  errorMessageOf,
  storageFailure,
} from "@/application/resultCodes";
import { systemClock, type Clock } from "@/application/time/clock";
import { isValidLocalDate, JOD } from "@micro-domain/shared/index.js";
import { AGREEMENT_SOURCE_ACCEPTANCE } from "@/application/transfers/transferCompatibilityValues";

/* S12 (UNIT-009 P3.1/P3.3 + العقد المشترك OrderExtras — أمر 2e645802): نموذج
 * الإنشاء الجديد لشروط النقل — «لا يوجد توصيل» صريحًا أو توصيل يتحمله
 * المشروع وحده مرة على الطلب؛ لا رسوم زبون ولا تقاسم في الإنشاء الجديد
 * (سجلات القديم ذات المعنى تُقرأ بسياستها ولا تُحذف). */
export type AgreementDeliveryTerms = {
  responsibility: "none" | "project_pays";
  feeIncludedInPrice: boolean;
  costIncludedInProductCost: boolean;
  feeChargedMinor: number | null;
  costPaidMinor: number | null;
  projectShareMinor: number | null;
  customerShareMinor: number | null;
};

export type AgreementInput = {
  agreedPriceMinor: number;
  /* S12 (UNIT-009 A2/س4 + B3-F04 — J002-DEC02): موعد التسليم قد يكون مجهولًا
   * صراحة — null = «لم يُحدد بعد» (لا جدول ولا تاريخ صوري)؛ القيمة النصية
   * تاريخ محلي صحيح. */
  deliveryDate: string | null;
  depositMinor: number;
  agreementSource: AgreementSource | "conversation" | "call" | "in_person" | string | null;
  /* ORD-003: اختيارية تمامًا — غيابها = لا شروط نقل مسجلة (سلوك رجدي). */
  deliveryTerms?: AgreementDeliveryTerms | null;
  /* S12 (UNIT-009 A2/س6 + B3-F17 — J002-DEC01): اختيار صريح «التكلفة غير
   * معروفة الآن» — يُنشئ عند التحويل مرجع تكلفة مجهولًا موثقًا (نواة
   * calculateCostSnapshot بعلم no_cost_components الإلزامي) لا تكلفة 0. */
  costUnknown?: boolean;
};
export type AgreementResult =
  | { ok: true; stored: StoredCraftOrder; reused?: boolean }
  | {
      ok: false;
      code: "validation_error" | "storage_error" | "storage_stale" | "missing_cost" | "inconsistent_state";
      message: string;
    };
/* R4-S8/F1 (تدقيق عدائي، 2026-10-08): الطاقم الثالث المتبقي لمصادر الاتفاق
 * (8 قيم) — كان حرفية محلية غير محروسة خارج سجل STR-623؛ يُستهلك الآن من
 * السجل الكنوني نفسه الذي وحد الموقعين الآخرين (R4-B2). */
const allowedAgreementSources = new Set<string>(AGREEMENT_SOURCE_ACCEPTANCE);
const agreementSourceIsValid = (value: string | null) => value === null || allowedAgreementSources.has(value);
/* R2 (M-02/X1، 2026-10-08): صلاحية موعد التسليم من نواة المجال الكنسية —
 * كانت مرساة ظهر مكررة (تقبل السنوات 0000–0099 وتكرر الملكية). */
const dateIsValid = (value: string) => isValidLocalDate(value);

function validation(message: string): Extract<AgreementResult, { ok: false }> {
  return { ok: false, code: VALIDATION_ERROR, message };
}

export class AgreementService {
  constructor(
    private readonly store: OrderLifecycleStore,
    private readonly costs: CostService,
    private readonly now: Clock = systemClock,
  ) {}

  async list(): Promise<
    { ok: true; orders: readonly StoredCraftOrder[] } | Extract<AgreementResult, { ok: false }>
  > {
    const result = await this.store.listOrders();
    return result.ok ? { ok: true, orders: result.value } : storageFailure(ORDERS_READ_FAILED_MESSAGE);
  }

  async get(
    id: string,
  ): Promise<{ ok: true; stored: StoredCraftOrder | null } | Extract<AgreementResult, { ok: false }>> {
    const result = await this.store.getOrder(id);
    return result.ok ? { ok: true, stored: result.value } : storageFailure(ORDER_READ_FAILED_MESSAGE);
  }

  async createFromDraft(draft: OrderDraft, input: AgreementInput): Promise<AgreementResult> {
    if (draft.linkedOrderId) {
      const current = await this.store.getOrder(draft.linkedOrderId);
      if (!current.ok) return storageFailure("تعذر التحقق من الاتفاق المحفوظ.");
      if (!current.value)
        return {
          ok: false,
          code: "inconsistent_state",
          message: "توجد إشارة لاتفاق محلي غير متاح. لا تنشئ اتفاقًا جديدًا قبل المراجعة.",
        };
      return { ok: true, stored: current.value };
    }
    /* Conflict B: الجهة اختيارية — الطلب النقدي لا يُحجب؛ الاسم الفارغ يعني
     * «زبون بلا اسم» ويمكن تسميته لاحقًا من صفحة الطلب (تعبئة باتجاه واحد). */
    if (!agreementSourceIsValid(input.agreementSource))
      return validation("اختر مصدر اتفاق من القائمة أو اتركه غير محدد.");
    if (!draft.itemName.trim() || !draft.specifications.trim())
      return validation("أكمل وصف القطعة وملاحظات التخصيص قبل تسجيل الاتفاق.");
    if (!Number.isInteger(input.agreedPriceMinor) || input.agreedPriceMinor <= 0)
      return validation("أدخل سعرًا متفقًا عليه أكبر من صفر.");
    if (!Number.isInteger(input.depositMinor) || input.depositMinor < 0)
      return validation("العربون يجب أن يكون صفرًا أو مبلغًا صحيحًا.");
    /* S12 (UNIT-009 P3.3 — النموذج الجديد): إنشاء الاتفاق لا يحمل أجرة
     * زبون أصلًا (لا يوجد توصيل أو توصيل على المشروع) — سقف العربون هو
     * السعر المتفق عليه وحده بلا أجرة مُخترعة. */
    if (
      input.deliveryTerms &&
      input.deliveryTerms.responsibility !== "none" &&
      input.deliveryTerms.responsibility !== "project_pays"
    )
      return validation(
        "شروط النقل في إنشاء الاتفاق الجديد: «لا يوجد توصيل» أو «المشروع يدفع للناقل» فقط — لا رسوم زبون ولا تقاسم.",
      );
    if (input.deliveryTerms?.responsibility === "none") {
      const terms = input.deliveryTerms;
      if (
        terms.feeChargedMinor !== null ||
        terms.costPaidMinor !== null ||
        terms.projectShareMinor !== null ||
        terms.customerShareMinor !== null
      )
        return validation("«لا يوجد توصيل» لا يحمل أي مبلغ — لا أجرة ولا كلفة ولا حصص.");
    }
    if (input.depositMinor > input.agreedPriceMinor)
      return validation("لا يمكن أن يتجاوز العربون قيمة الطلب المتفق عليها.");
    /* S12 (UNIT-009 — J002-DEC02): المجهول الصريح مقبول — لا جدول ولا تاريخ
     * صوري؛ والقيمة النصية إن وجدت تاريخ محلي صحيح. */
    if (input.deliveryDate !== null && !dateIsValid(input.deliveryDate))
      return validation("أدخل موعد تسليم صحيحًا — أو اختر «لم يُحدد بعد» صراحةً.");
    const active = draft.costSnapshots.find(snapshot => snapshot.id === draft.activeCostSnapshotId);
    /* S12 (UNIT-009 — J002-DEC01): الاتفاق بتكلفة غير معروفة صراحة — مرجع
     * مجهول موثق عند التحويل؛ لا يُقبل المجهول مع مرجع صالح قائم (الصريح
     * الحقيقي يستعمل مرجعه، والمجهول لا يطمس مرجعًا أفضل بصمت). */
    let costSnapshot;
    if (input.costUnknown === true) {
      if (active)
        return validation(
          "لهذه المسودة نسخة تكلفة قائمة — استعملها أو راجعها في التكلفة؛ المجهول الصريح لمن لا مرجع له.",
        );
      try {
        costSnapshot = calculateCostSnapshot(`${draft.id}:unknown-cost`, {
          currency: JOD,
          materialItems: [],
          time: null,
          packagingMinor: 0,
          deliveryMinor: 0,
          wasteMinor: 0,
          safetyBufferMinor: 0,
          quantity: draft.quantity,
          createdAt: this.now(),
          source: "order_confirmation",
        });
      } catch (error) {
        return validation(errorMessageOf(error, "تعذر بناء مرجع التكلفة المجهول."));
      }
    } else {
      if (!active)
        return {
          ok: false,
          code: "missing_cost",
          message: "احفظ نسخة التكلفة أولًا قبل تسجيل الاتفاق — أو اختر «التكلفة غير معروفة الآن» صراحةً.",
        };
      const cost = this.costs.previewStored(active);
      if (!cost.ok)
        return {
          ok: false,
          code: "missing_cost",
          message: "نسخة التكلفة غير صالحة؛ راجع التكلفة — أو اختر «التكلفة غير معروفة الآن» صراحةً.",
        };
      costSnapshot = cost.snapshot;
    }
    const timestamp = this.now();
    const id = `order-${draft.id}`;
    try {
      let order: CraftOrder = createCraftOrder({
        id,
        customerName: draft.customerName,
        orderName: draft.orderName ?? null,
        itemName: draft.itemName,
        specifications: draft.specifications,
        quantity: draft.quantity,
        agreedPriceMinor: input.agreedPriceMinor,
        costSnapshot,
        createdAt: timestamp,
      });
      /* ORD-003/S12: شروط النقل تُسجّل قبل القبض — وفي النموذج الجديد لا أجرة
       * زبون عند الإنشاء أصلًا فسقف القبض هو السعر وحده. */
      if (input.deliveryTerms) {
        order = recordDeliveryTerms(order, {
          ...input.deliveryTerms,
          feeChargedMinor: null,
          projectShareMinor: null,
          customerShareMinor: null,
          idempotencyKey: `${id}:initial-delivery-terms`,
          createdAt: timestamp,
        });
      }
      order = transitionOrder(order, {
        to: "provisional_agreement",
        idempotencyKey: `${id}:provisional-agreement`,
        createdAt: timestamp,
        note: "agreement recorded locally",
      });
      if (input.depositMinor > 0)
        order = collectDeposit(order, input.depositMinor, `${id}:initial-deposit`, timestamp);
      const stored: StoredCraftOrder = {
        id,
        order,
        catalogItemId: draft.catalogItemId,
        deliveryDate: input.deliveryDate,
        agreementSource: input.agreementSource?.trim() || null,
        followUpSummary: null,
        followUpDate: null,
        followUpReason: null,
        followUpEvents: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      const linkedDraft: OrderDraft = { ...draft, linkedOrderId: id, updatedAt: timestamp };
      /* S12 (UNIT-009 — J002-DEC02): غياب الموعد لا يكتب جدولًا — موعد الطلب
       * المجهول (null) بلا ScheduleEntry؛ يُنشأ موعده حين يحدده المالك
       * لاحقًا من صاحبه (012)، وتحديده لا يعيد إنشاء الاتفاق. */
      const schedule: ScheduleEntry | null =
        input.deliveryDate === null
          ? null
          : {
              id: `schedule-${id}`,
              orderId: id,
              kind: "delivery",
              scheduledFor: input.deliveryDate,
              scheduledTime: null,
              durationMinutes: null,
              status: "scheduled",
              postponeReason: null,
              events: [
                {
                  id: `${id}:schedule-created`,
                  type: "created",
                  idempotencyKey: `${id}:schedule-created`,
                  createdAt: timestamp,
                  previousScheduledFor: null,
                  scheduledFor: input.deliveryDate,
                  previousScheduledTime: null,
                  scheduledTime: null,
                  previousDurationMinutes: null,
                  durationMinutes: null,
                  reason: null,
                },
              ],
              recurrenceId: null,
              recurrenceIndex: null,
              createdAt: timestamp,
              updatedAt: timestamp,
            };
      const commit = await this.store.commitOrderFromDraft(stored, linkedDraft, schedule ?? undefined);
      return commit.ok
        ? { ok: true, stored: commit.value.order }
        : storageFailure("تعذر حفظ الاتفاق محليًا — بياناتك كما هي؛ أعد المحاولة.");
    } catch (error) {
      return validation(errorMessageOf(error, "تعذر بناء الاتفاق."));
    }
  }

  async startExecution(id: string): Promise<AgreementResult> {
    const existing = await this.store.getOrder(id);
    if (!existing.ok) return storageFailure(ORDER_READ_FAILED_MESSAGE);
    if (!existing.value) return { ok: false, code: "inconsistent_state", message: ORDER_UNAVAILABLE_MESSAGE };
    if (existing.value.order.status === "in_progress") return { ok: true, stored: existing.value };
    if (existing.value.order.status !== "provisional_agreement")
      return { ok: false, code: "inconsistent_state", message: "لا يمكن بدء التنفيذ من هذه الحالة." };
    try {
      const timestamp = this.now();
      const confirmed = transitionOrder(existing.value.order, {
        to: "confirmed",
        idempotencyKey: `${id}:confirm`,
        createdAt: timestamp,
      });
      const executing = transitionOrder(confirmed, {
        to: "in_progress",
        idempotencyKey: `${id}:start-execution`,
        createdAt: timestamp,
      });
      const stored = { ...existing.value, order: executing, updatedAt: timestamp };
      /* G-003: الالتزام المحروس — الحالة الحية تُتحقق داخل حد الكتابة؛
       * إعادة تشغيل العملية نفسها بمفاتيحها إعادة استخدام صادقة، والتعارض
       * storage_stale بلا كتابة (عقد §31). */
      const saved = await this.store.commitOrderUpdate(existing.value, stored, [
        `${id}:confirm`,
        `${id}:start-execution`,
      ]);
      if (saved.ok)
        return saved.value.reused
          ? { ok: true, stored: saved.value.order, reused: true }
          : { ok: true, stored: saved.value.order };
      if (saved.code === "storage_stale") return { ok: false, code: "storage_stale", message: saved.message };
      return storageFailure("تعذر حفظ حالة التنفيذ — بياناتك كما هي؛ أعد المحاولة.");
    } catch (error) {
      return validation(errorMessageOf(error, "تعذر بدء التنفيذ."));
    }
  }
}
