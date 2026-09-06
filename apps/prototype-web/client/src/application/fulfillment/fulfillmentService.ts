/** Slice 4 financial boundary: delivery, collection, and debt are three distinct Domain operations. */
import {
  assignOrderCustomerName,
  cancelOrder,
  collectDeposit,
  collectRegisteredDebt,
  collectRemaining,
  registerDebt,
  reviseAgreedPrice,
  reverseOrderCollection,
  settleDepositRefund,
  settleDepositRetain,
  transitionOrder,
} from "@micro-domain/craft-order/index.js";
import { ScheduleService } from "@/application/scheduling/scheduleService";
import type { StoredCraftOrder, PrototypeLocalStore } from "@/storage/local/types";
import { createCashContinuityEntry, type CashContinuityEntry } from "@micro-domain/cash-continuity/index.js";
import { localDateInAmman } from "@/presentation/formatters";

export type FulfillmentResult =
  | { ok: true; stored: StoredCraftOrder; notice?: string }
  | { ok: false; code: "storage_error" | "invalid_state"; message: string };
export type DepositRow = {
  orderId: string;
  itemName: string;
  customerName: string;
  depositCollectedMinor: number;
  settlementStatus: StoredCraftOrder["order"]["settlementStatus"];
  depositSettlement: StoredCraftOrder["order"]["depositSettlement"];
  /* عقد الإغلاق العميق (FC-05 — العقد ٣): بطاقة العربون الكاملة — المطبَّق
   * من العربون على قيمة الطلب عند التسليم، والمردود، والمحتفظ به ومعناه،
   * والمحفظة المرتبطة بتحصيله، ووصف أثر الربح الصادق لكل حالة. */
  appliedToSaleMinor: number;
  refundedMinor: number;
  retainedMinor: number;
  retainedMeaning: StoredCraftOrder["order"]["retainedMeaning"];
  walletName: string | null;
  profitEffectLabel: string;
};
export type DepositOverview = {
  deposits: readonly DepositRow[];
  collectedTotalMinor: number;
  awaitingSettlementCount: number;
};
const success = (stored: StoredCraftOrder): FulfillmentResult => ({ ok: true, stored });
const failure = (
  code: Extract<FulfillmentResult, { ok: false }>["code"],
  message: string,
): FulfillmentResult => ({ ok: false, code, message });

export class FulfillmentService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly schedules: ScheduleService = new ScheduleService(store, now),
  ) {}

  private async load(id: string): Promise<FulfillmentResult> {
    const result = await this.store.getOrder(id);
    if (!result.ok) return failure("storage_error", "تعذر قراءة الطلب المحلي.");
    if (!result.value) return failure("invalid_state", "الطلب غير متاح محليًا.");
    return success(result.value);
  }

  private async persist(stored: StoredCraftOrder): Promise<FulfillmentResult> {
    const result = await this.store.saveOrder(stored);
    return result.ok
      ? success(result.value)
      : failure("storage_error", "تعذر حفظ التغيير — بياناتك كما هي؛ أعد المحاولة.");
  }

  async markReady(id: string): Promise<FulfillmentResult> {
    const current = await this.load(id);
    if (!current.ok) return current;
    if (["ready", "delivered", "settled"].includes(current.stored.order.status)) return current;
    if (current.stored.order.status !== "in_progress")
      return failure("invalid_state", "لا يمكن تسجيل الجاهزية من حالة الطلب الحالية.");
    try {
      const timestamp = this.now();
      /* المجموعة ٣ (عقد D4): مفتاح لكل جاهزية — إعادة التنفيذ بعد عكس التسليم
       * جاهزية جديدة بمفتاح جديد لا إعادة تشغيل صامتة للجاهزية الأولى. */
      const readyAttempt = current.stored.order.events.filter(
        event => event.type === "status_changed" && event.toStatus === "ready",
      ).length;
      const order = transitionOrder(current.stored.order, {
        to: "ready",
        idempotencyKey: readyAttempt === 0 ? `${id}:mark-ready` : `${id}:mark-ready-${readyAttempt + 1}`,
        createdAt: timestamp,
      });
      return this.persist({ ...current.stored, order, updatedAt: timestamp });
    } catch (error) {
      return failure("invalid_state", error instanceof Error ? error.message : "تعذر تسجيل الجاهزية.");
    }
  }

  /* المجموعة ٣ (عقد D4): استئناف التنفيذ بعد مراجعة موثقة (كما بعد عكس التسليم)
   * — مراجعة ← مؤكد ← قيد التنفيذ بانتقالات النطاق نفسها؛ لا مسار خاص بالعكس
   * ولا تخطٍ لقفل «الطلب المسلّم لا يخرج من المراجعة إلا بعكس موثق». */
  async resumeAfterReview(id: string): Promise<FulfillmentResult> {
    const current = await this.load(id);
    if (!current.ok) return current;
    if (current.stored.order.status === "in_progress") return current;
    if (current.stored.order.status !== "needs_review")
      return failure("invalid_state", "الاستئناف يتطلب طلبًا يحتاج مراجعة.");
    try {
      const timestamp = this.now();
      const confirmedAttempt = current.stored.order.events.filter(
        event => event.type === "status_changed" && event.toStatus === "confirmed",
      ).length;
      const confirmed = transitionOrder(current.stored.order, {
        to: "confirmed",
        idempotencyKey:
          confirmedAttempt === 0 ? `${id}:reconfirm` : `${id}:reconfirm-${confirmedAttempt + 1}`,
        createdAt: timestamp,
        note: "استئناف بعد مراجعة موثقة",
      });
      const executingAttempt = confirmed.events.filter(
        event => event.type === "status_changed" && event.toStatus === "in_progress",
      ).length;
      const executing = transitionOrder(confirmed, {
        to: "in_progress",
        idempotencyKey:
          executingAttempt === 0
            ? `${id}:resume-execution`
            : `${id}:resume-execution-${executingAttempt + 1}`,
        createdAt: timestamp,
      });
      return this.persist({ ...current.stored, order: executing, updatedAt: timestamp });
    } catch (error) {
      return failure(
        "invalid_state",
        error instanceof Error ? error.message : "تعذر استئناف التنفيذ بعد المراجعة.",
      );
    }
  }

  async deliver(id: string): Promise<FulfillmentResult> {
    const current = await this.load(id);
    if (!current.ok) return current;
    if (
      ["delivered", "settled"].includes(current.stored.order.status) &&
      current.stored.order.events.some(
        event => event.type === "status_changed" && event.toStatus === "delivered",
      )
    )
      return current;
    if (current.stored.order.status !== "ready")
      return failure("invalid_state", "لا يمكن تسجيل التسليم قبل أن يصبح الطلب جاهزًا.");
    try {
      const timestamp = this.now();
      /* المجموعة ٣ (عقد D4): مفتاح لكل محاولة تسليم — إعادة التسليم بعد عكسٍ
       * تسليمٌ جديد بمفتاح جديد لا إعادة تشغيل صامتة للمفتاح القديم. */
      const attempt = current.stored.order.events.filter(
        event => event.type === "status_changed" && event.toStatus === "delivered",
      ).length;
      const order = transitionOrder(current.stored.order, {
        to: "delivered",
        idempotencyKey: attempt === 0 ? `${id}:deliver` : `${id}:deliver-${attempt + 1}`,
        createdAt: timestamp,
      });
      const saved = await this.persist({ ...current.stored, order, updatedAt: timestamp });
      /* S2-10: فشل مواءمة الجدول بعد التسليم لا يُخفى ولا يُفشل التسليم نفسه —
       * إشعار غير حاجر بنمط إشعار نسبة المحفظة نفسه (المجموعة ٤). غياب موعد
       * مرتبط (not_found) حالة سليمة لا تستحق إشعارًا. */
      if (saved.ok) {
        const reconciled = await this.schedules.reconcileDelivery(id);
        if (!reconciled.ok && reconciled.code === "storage_error")
          return { ...saved, notice: "تم تسجيل التسليم، وتعذرت مواءمة المواعيد المرتبطة به." };
      }
      return saved;
    } catch (error) {
      return failure("invalid_state", error instanceof Error ? error.message : "تعذر تسجيل التسليم.");
    }
  }

  async collectFullRemaining(id: string): Promise<FulfillmentResult> {
    const current = await this.load(id);
    if (!current.ok) return current;
    if (current.stored.order.status === "settled" && current.stored.order.settlementStatus === "paid")
      return current;
    if (current.stored.order.status !== "delivered")
      return failure("invalid_state", "التحصيل المتبقي يتطلب تسجيل التسليم أولًا.");
    if (current.stored.order.receivableMinor <= 0)
      return failure("invalid_state", "لا يوجد مبلغ متبقٍ لتحصيله.");
    try {
      const timestamp = this.now();
      const amount = current.stored.order.receivableMinor;
      const order = collectRemaining(current.stored.order, amount, `${id}:collect-full-${amount}`, timestamp);
      return this.persist({ ...current.stored, order, updatedAt: timestamp });
    } catch (error) {
      return failure("invalid_state", error instanceof Error ? error.message : "تعذر تسجيل التحصيل.");
    }
  }

  /* §٥-١٦ (المرحلة أ — رحلة ٢): الدين المسجل قابل للتحصيل لاحقًا. المبلغ هو
   * الحقل الوحيد؛ التحصيل يقلل الدين ولا يعيد فتح الطلب.
   * S2-02: مفتاح العملية يُمرَّر من ورقة التحصيل كما في فرع المتبقي — إعادة
   * المحاولة بمفتاح واحد لا تسجّل تحصيلًا ثانيًا؛ مسار النموذج يبقى بطابعه
   * الزمني مع حماية single-flight في الواجهة. */
  async collectDebt(id: string, amountMinor: number, operationKey?: string): Promise<FulfillmentResult> {
    const current = await this.load(id);
    if (!current.ok) return current;
    if (current.stored.order.settlementStatus !== "debt" || current.stored.order.receivableMinor <= 0)
      return current; // لا دين مسجل: لا شيء يُفعل
    if (current.stored.order.status === "cancelled") return current;
    try {
      const timestamp = this.now();
      const order = collectRegisteredDebt(
        current.stored.order,
        amountMinor,
        operationKey ?? `${id}:debt-collect-${amountMinor}-${timestamp}`,
        timestamp,
      );
      return this.persist({ ...current.stored, order, updatedAt: timestamp });
    } catch (error) {
      return failure("invalid_state", error instanceof Error ? error.message : "تعذر تسجيل تحصيل الدين.");
    }
  }

  /* المجموعة ٢ (§6.1): ورقة التحصيل تستدعي هذا المسار الواحد — يختار دالة النطاق
   * الصحيحة بحسب حالة الطلب (دين مسجل أو متبقٍ بعد التسليم) ويكتب تحصيلًا واحدًا
   * موثقًا. لا يُنشئ إيرادًا ولا يلمس النتيجة — التحصيل كاش ومتبقٍ فقط. */
  async collectFromSheet(id: string, amountMinor: number, operationKey: string): Promise<FulfillmentResult> {
    const current = await this.load(id);
    if (!current.ok) return current;
    const order = current.stored.order;
    if (order.status === "cancelled") return failure("invalid_state", "طلب ملغى لا يُحصّل منه.");
    if (order.settlementStatus === "debt" && order.receivableMinor > 0)
      /* S2-02: مفتاح العملية يُمرَّر كما يُمرَّر في فرع المتبقي — إعادة المحاولة
       * بعد انقطاع لا تدفع الدين مرتين. */
      return this.collectDebt(id, amountMinor, operationKey);
    if (order.status === "delivered") {
      if (order.receivableMinor <= 0)
        return failure("invalid_state", "لا يوجد مبلغ متبقٍ لتحصيله على هذا الطلب.");
      if (amountMinor > order.receivableMinor)
        return failure("invalid_state", "التحصيل لا يمكن أن يتجاوز المتبقي على الطلب.");
      try {
        const timestamp = this.now();
        const next = collectRemaining(order, amountMinor, `${operationKey}`, timestamp);
        return this.persist({ ...current.stored, order: next, updatedAt: timestamp });
      } catch (error) {
        return failure("invalid_state", error instanceof Error ? error.message : "تعذر تسجيل التحصيل.");
      }
    }
    return failure(
      "invalid_state",
      "تحصيل الطلب يتطلب دينًا مسجلًا أو طلبًا مسلّمًا بمتبقٍ؛ المتبقي قبل التسليم يُسجّل عربونًا.",
    );
  }

  /* عقد الإغلاق العميق (WF-01/FC-04): عربون إضافي أثناء الرحلة قبل التسليم —
   * الدومين يقبله للاتفاق المؤقت/المؤكد/قيد التنفيذ/الجاهز، ومفتاح العملية
   * من المستدعي يجعل إعادة المحاولة آمنة (eventExists). العربون يرفع الكاش
   * المقبوض لا الإيراد — الإيراد يُعرف مرة واحدة عند التسليم. */
  async collectDeposit(
    id: string,
    input: { amountMinor: number; operationKey: string },
  ): Promise<FulfillmentResult> {
    const current = await this.load(id);
    if (!current.ok) return current;
    try {
      const timestamp = this.now();
      const order = collectDeposit(current.stored.order, input.amountMinor, input.operationKey, timestamp);
      return this.persist({ ...current.stored, order, updatedAt: timestamp });
    } catch (error) {
      return failure("invalid_state", error instanceof Error ? error.message : "تعذر تسجيل العربون.");
    }
  }

  /* المجموعة ٢ (§10.3): التراجع الموثق عن قبضة مسجلة من تفاصيل الطلب. */
  async reverseCollection(
    id: string,
    input: { collectionEventId: string; amountMinor: number; reason: string; operationKey?: string },
  ): Promise<FulfillmentResult> {
    const current = await this.load(id);
    if (!current.ok) return current;
    if (!input.reason.trim()) return failure("invalid_state", "أكمل سبب التراجع قبل الحفظ.");
    try {
      const timestamp = this.now();
      /* G6-F1-2: مفتاح جذر من المستدعي يجعل إعادة المحاولة قابلة للكشف بـeventExists —
       * مفتاح الطابع الزمني السابق جعل كل محاولة فريدة فرُحّ تكرر التراجع الجزئي. */
      const order = reverseOrderCollection(current.stored.order, {
        collectionEventId: input.collectionEventId,
        amountMinor: input.amountMinor,
        reason: input.reason,
        idempotencyKey:
          input.operationKey ??
          `${id}:reverse-collection-${input.collectionEventId}-${input.amountMinor}-${timestamp}`,
        createdAt: timestamp,
      });
      return this.persist({ ...current.stored, order, updatedAt: timestamp });
    } catch (error) {
      return failure("invalid_state", error instanceof Error ? error.message : "تعذر التراجع عن القبض.");
    }
  }

  /* المجموعة ٢ (§10.5): تعديل السعر بعد الاتفاق من تفاصيل الطلب — تصحيح موثق
   * داخل الطلب، لا إلغاء ولا إعادة إنشاء. */
  async revisePrice(
    id: string,
    input: { newPriceMinor: number; reason: string },
  ): Promise<FulfillmentResult> {
    const current = await this.load(id);
    if (!current.ok) return current;
    if (!input.reason.trim()) return failure("invalid_state", "أكمل سبب تعديل السعر قبل الحفظ.");
    try {
      const timestamp = this.now();
      const order = reviseAgreedPrice(current.stored.order, {
        newPriceMinor: input.newPriceMinor,
        reason: input.reason,
        idempotencyKey: `${id}:revise-price-${input.newPriceMinor}-${timestamp}`,
        createdAt: timestamp,
      });
      return this.persist({ ...current.stored, order, updatedAt: timestamp });
    } catch (error) {
      return failure("invalid_state", error instanceof Error ? error.message : "تعذر تعديل السعر.");
    }
  }

  async registerRemainingDebt(id: string): Promise<FulfillmentResult> {
    const current = await this.load(id);
    if (!current.ok) return current;
    if (current.stored.order.status === "settled" && current.stored.order.settlementStatus === "debt")
      return current;
    if (current.stored.order.status !== "delivered")
      return failure("invalid_state", "تسجيل الدين يتطلب تسجيل التسليم أولًا.");
    if (current.stored.order.receivableMinor <= 0)
      return failure("invalid_state", "لا يوجد مبلغ متبقٍ لتسجيله كدين.");
    try {
      const timestamp = this.now();
      const amount = current.stored.order.receivableMinor;
      const order = registerDebt(current.stored.order, `${id}:register-debt-${amount}`, timestamp);
      return this.persist({ ...current.stored, order, updatedAt: timestamp });
    } catch (error) {
      return failure("invalid_state", error instanceof Error ? error.message : "تعذر تسجيل الدين.");
    }
  }

  /* القرار ١٩: الإلغاء عبر cancelOrder وحدها (عقد ٠٢) — السبب اختياري في الواجهة،
   * والمسار الموثق يفرض نصًا غير فارغ؛ التخطي يسجل «بدون سبب محدد» بصدق.
   * العربون يبقى «يحتاج مراجعة» خيارًا صالحًا لا خطأً. */
  async cancel(id: string, reason: string): Promise<FulfillmentResult> {
    const current = await this.load(id);
    if (!current.ok) return current;
    if (current.stored.order.status === "cancelled") return current;
    const trimmed = reason.trim() || "إلغاء بدون سبب محدد";
    try {
      const timestamp = this.now();
      const order = cancelOrder(current.stored.order, trimmed, `${id}:cancel`, timestamp);
      return this.persist({ ...current.stored, order, updatedAt: timestamp });
    } catch (error) {
      return failure("invalid_state", error instanceof Error ? error.message : "تعذر إلغاء الطلب.");
    }
  }

  /* Conflict E (FC-06): رد العربون من محفظة المصدر — المبلغ صريح (الافتراضي
   * كامل المتبقي غير المحسوم)، والرد يفك تخصيصات العربون المسجلة من محافظها
   * الفعلية بمقدار الرد تمامًا: المدار يتراجع من المحفظة، وما لم يُخصص يخرج
   * من غير الموزع. الكتابة واحدة ذرّية: الطلب وأثر المحافظ أو لا شيء. */
  /* Conflict B: تسمية جهة طلب بلا اسم — تعبئة باتجاه واحد من الطلب نفسه؛
   * إعادة تسمية اسم قائم تُرفض (تصحيح موثق لا تعديل صامت). */
  async assignCustomerName(id: string, name: string): Promise<FulfillmentResult> {
    const current = await this.load(id);
    if (!current.ok) return current;
    try {
      const timestamp = this.now();
      const order = assignOrderCustomerName(current.stored.order, name, `${id}:assign-name:${name.trim()}`);
      return this.persist({ ...current.stored, order, updatedAt: timestamp });
    } catch (error) {
      return failure("invalid_state", error instanceof Error ? error.message : "تعذر تسمية الجهة.");
    }
  }

  async refundDeposit(id: string, reason: string, amountMinor?: number): Promise<FulfillmentResult> {
    const current = await this.load(id);
    if (!current.ok) return current;
    const order = current.stored.order;
    const pendingMinor = order.depositCollectedMinor - (order.depositRetainedMinor ?? 0);
    const amount = amountMinor ?? pendingMinor;
    if (amount <= 0) return failure("invalid_state", "لا عربون معلّق قابل للرد — راجع قرار التسوية.");
    const refundEventKey = `${id}:refund-deposit:${amount}:${reason.trim().length}:${this.now().slice(0, 13)}`;
    try {
      const timestamp = this.now();
      const next = settleDepositRefund(current.stored.order, amount, reason, refundEventKey, timestamp);
      /* فك تخصيصات العربون بمقدار الرد — من محفظة المصدر الفعلية، وبما لم
       * يُخصص يبقى في غير الموزع (المعادلة تنعدم عبر collectedMinor). */
      const reversals = await this.buildDepositAllocationReversals(
        current.stored,
        amount,
        reason,
        refundEventKey,
        timestamp,
      );
      if (reversals.ok) {
        const committed = await this.store.commitDepositRefundSettlement(
          { ...current.stored, order: next, updatedAt: timestamp },
          reversals.value,
          refundEventKey,
        );
        if (!committed.ok)
          return failure("storage_error", committed.message ?? "تعذر رد العربون ذرّيًا؛ لم يتغير السجل.");
        return { ok: true, stored: committed.value.order };
      }
      /* تعذر بناء فك التخصيص (تخصيص مُفكوك جزئيًا سابقًا مثلًا) — الرد نفسه
       * لا يعلّق: يُكتب على الطلب ويبقى أثر المحفظة بيد المالك من دفترها. */
      return this.persist({ ...current.stored, order: next, updatedAt: timestamp });
    } catch (error) {
      return failure("invalid_state", error instanceof Error ? error.message : "تعذر رد العربون.");
    }
  }

  /* بناء عكس مطابق لتخصيصات العربون حتى تغطية مبلغ الرد: تخصيصات كاملة
   * تُفك كاملة، والأخيرة تُفك جزئيًا إن لزم — تخصيص واحد لا يُفك مرتين. */
  private async buildDepositAllocationReversals(
    stored: StoredCraftOrder,
    refundMinor: number,
    reason: string,
    refundEventKey: string,
    timestamp: string,
  ): Promise<{ ok: true; value: readonly CashContinuityEntry[] } | { ok: false; message: string }> {
    const [entriesResult, walletsResult] = await Promise.all([
      this.store.listCashContinuityEntries(),
      this.store.listCashWallets(),
    ]);
    if (!entriesResult.ok || !walletsResult.ok)
      return { ok: false, message: "تعذر قراءة تخصيصات الكاش المحلية." };
    const entries = entriesResult.value;
    const depositEventKeys = new Set(
      stored.order.events
        .filter(event => event.type === "deposit_collected")
        .map(event => event.idempotencyKey),
    );
    /* المفكوك حتى الآن لكل تخصيص — يسمح بفك جزئي متكرر بمجموع لا يتجاوز
     * التخصيص الأصلي (رد جزئي ثم إكمال يفكان من المحفظة نفسها). */
    const reversedPerEntry = new Map<string, number>();
    for (const entry of entries) {
      if (entry.type === "reversal" && entry.reversesEntryId) {
        reversedPerEntry.set(
          entry.reversesEntryId,
          (reversedPerEntry.get(entry.reversesEntryId) ?? 0) - entry.cashDeltaMinor,
        );
      }
    }
    const wallets = new Map(walletsResult.value.map(wallet => [wallet.id, wallet.name] as const));
    /* تخصيصات العربون ذات فائض قابل للفك — بترتيب تسجيلها، من محفظتها الفعلية. */
    const depositAllocations = entries
      .filter(
        entry =>
          entry.type === "allocation" &&
          entry.cashDeltaMinor > 0 &&
          entry.sourceRefId === stored.id &&
          entry.sourceRefKind === "order" &&
          entry.operationKey !== null &&
          depositEventKeys.has(entry.operationKey.replace(/:attribute$/, "")),
      )
      .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt));
    const reversals: CashContinuityEntry[] = [];
    let remaining = refundMinor;
    for (const entry of depositAllocations) {
      if (remaining <= 0) break;
      const reversibleMinor = entry.cashDeltaMinor - (reversedPerEntry.get(entry.id) ?? 0);
      if (reversibleMinor <= 0) continue;
      const reversalMinor = Math.min(reversibleMinor, remaining);
      remaining -= reversalMinor;
      reversals.push(
        createCashContinuityEntry({
          id: `refund-${refundEventKey}-${entry.id}`,
          walletId: entry.walletId,
          type: "reversal",
          occurredOn: localDateInAmman(timestamp),
          recordedAt: timestamp,
          cashDeltaMinor: -reversalMinor,
          note: `رد عربون من «${wallets.get(entry.walletId) ?? "محفظة"}»: ${reason.trim()}`,
          reason: reason.trim(),
          operationKey: `${refundEventKey}:unattribute:${entry.id}`,
          reversesEntryId: entry.id,
        }),
      );
    }
    /* تخصيص مُفكوك جزئيًا سابقًا يمنع التكرار لا التخمين — إن بقيت بقية
     * بعد آخر تخصيص متاح فمن غير الموزع (حالة معلنة صادقة، لا خطأ). */
    return { ok: true, value: reversals };
  }

  async retainDeposit(id: string, reason: string, amountMinor?: number): Promise<FulfillmentResult> {
    const current = await this.load(id);
    if (!current.ok) return current;
    const order = current.stored.order;
    const pendingMinor = order.depositCollectedMinor - (order.depositRetainedMinor ?? 0);
    const amount = amountMinor ?? pendingMinor;
    if (amount <= 0) return failure("invalid_state", "لا عربون معلّق قابل للاحتفاظ — راجع قرار التسوية.");
    try {
      const timestamp = this.now();
      const next = settleDepositRetain(
        current.stored.order,
        amount,
        reason,
        `${id}:retain-deposit-${amount}-${timestamp}`,
        timestamp,
      );
      return this.persist({ ...current.stored, order: next, updatedAt: timestamp });
    } catch (error) {
      return failure("invalid_state", error instanceof Error ? error.message : "تعذر تسوية العربون.");
    }
  }

  /* إضافة المالك (القرار ١٩): قسم يجمع العربونات — كم عربونًا مقبوضًا، على أي
   * طلبات، وأيها ينتظر تسوية. قراءة فقط؛ لا تحصيل ولا تسوية من هنا.
   * عقد الإغلاق العميق (FC-05): البطاقة تعرض الحقول المعتمدة — المطبَّق والمردود
   * والمحتفظ به والمحفظة وأثر الربح — لا رقمًا واحدًا يُقرأ مرتين. */
  async listDepositOverview(): Promise<
    { ok: true; value: DepositOverview } | Extract<FulfillmentResult, { ok: false }>
  > {
    const [result, entriesResult, walletsResult] = await Promise.all([
      this.store.listOrders(),
      this.store.listCashContinuityEntries(),
      this.store.listCashWallets(),
    ]);
    if (!result.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة الطلبات المحلية." };
    if (!entriesResult.ok || !walletsResult.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة تخصيصات الكاش المحلية." };
    const walletsById = new Map(walletsResult.value.map(wallet => [wallet.id, wallet.name] as const));
    const entries = entriesResult.value.filter(
      entry => entry.type === "allocation" && entry.sourceRefKind === "order",
    );
    const rows = result.value
      .filter(stored => stored.order.depositCollectedMinor > 0)
      .map(stored => {
        const order = stored.order;
        /* FC-05/FC-06: القاعدة الموحدة لمطابقة تخصيص العربون — جذر مفتاح
         * العملية `${مفتاح حدث العربون}:attribute` (المساران: عربون الاتفاق
         * وعربون الرحلة يستخدمانها)، فيظهر الأثر ومحفظته للاثنين معًا. */
        const depositAttributeRoots = new Set(
          order.events
            .filter(event => event.type === "deposit_collected")
            .map(event => `${event.idempotencyKey}:attribute`),
        );
        const attributedMinor = entries
          .filter(
            entry =>
              entry.sourceRefId === stored.id &&
              entry.operationKey !== null &&
              depositAttributeRoots.has(entry.operationKey),
          )
          .reduce((sum, entry) => sum + entry.cashDeltaMinor, 0);
        const attributedWalletId =
          entries.find(
            entry =>
              entry.sourceRefId === stored.id &&
              entry.operationKey !== null &&
              depositAttributeRoots.has(entry.operationKey) &&
              entry.cashDeltaMinor > 0,
          )?.walletId ?? null;
        const delivered = order.status === "delivered" || order.status === "settled";
        const refunded = order.depositSettlement === "refund_deposit";
        const retained = order.depositSettlement === "retain_deposit";
        const appliedToSaleMinor = delivered && !refunded ? order.depositCollectedMinor : 0;
        const profitEffectLabel = refunded
          ? "مردود للعميل — لا إيراد ولا أثر في النتيجة."
          : retained
            ? order.retainedMeaning === "owner"
              ? "محتفظ به كمال مالك — ليس ربحًا؛ يخرج بقرار سحب صريح."
              : order.retainedMeaning === "revenue"
                ? "محتفظ به كإيراد مشروع — دخل واحدًا في نتيجته."
                : "محتفظ به بانتظار تصنيفك — إيراد مشروع أو مال مالك."
            : delivered
              ? "مطبَّق على إيراد الطلب المسلَّم — ضمن قيمة البيع مرة واحدة."
              : "ليس إيرانًا ولا ربحًا — يُطبَّق على قيمة الطلب عند التسليم مرة واحدة.";
        return {
          orderId: stored.id,
          itemName: order.itemName,
          customerName: order.customerName,
          depositCollectedMinor: order.depositCollectedMinor,
          settlementStatus: order.settlementStatus,
          depositSettlement: order.depositSettlement,
          appliedToSaleMinor,
          refundedMinor: refunded ? order.depositCollectedMinor : 0,
          retainedMinor: retained ? order.depositCollectedMinor : 0,
          retainedMeaning: order.retainedMeaning,
          walletName:
            attributedMinor > 0 && attributedWalletId ? (walletsById.get(attributedWalletId) ?? null) : null,
          profitEffectLabel,
        };
      })
      .sort((left, right) => left.orderId.localeCompare(right.orderId));
    return {
      ok: true,
      value: {
        deposits: rows,
        collectedTotalMinor: rows.reduce((total, row) => total + row.depositCollectedMinor, 0),
        awaitingSettlementCount: rows.filter(row => row.depositSettlement === "needs_review").length,
      },
    };
  }
}
