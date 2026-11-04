/**
 * المجموعة ٤ (عقد ٢٩): خدمة الأصول — الكاتب الواحد لأحداث الأصول المالية.
 * الإنشاء (نقدي/ذمم) والتسليم والتصحيح والتخلص والشطب كلها معاملات ذرّية
 * عبر commitAssetRecord/commitAssetAcquisitionCorrection. الإهلاك المقترح
 * قراءة فقط لا تخصم شيئًا؛ تسجيله حدث صريح قابل للتراجع. لا صفحة تكتب
 * في IndexedDB مباشرة — كل شيء من هنا.
 */
import { localDateInAmman } from "@micro-domain/shared/index.js";
import {
  applyAssetDisposal,
  applyAssetWriteOff,
  assetEventSummary,
  assetPaymentStatusOf,
  createAssetRecord,
  planAssetDepreciation,
  prepareAssetDisposal,
  prepareAssetWriteOff,
  recordedDepreciationMinor,
  reviseAssetContract,
  type AssetPaymentStatus,
  type AssetRecord,
} from "@micro-domain/asset/index.js";
import {
  createFinancialEvent,
  createFinancialReversal,
  reversedEventIds,
  type FinancialEvent,
  type FinancialEventType,
} from "@micro-domain/financial-event/index.js";
import type { PrototypeLocalStore } from "@/storage/local/types";
import type { AssetStore } from "@/storage/local/capabilities/assetStore";
import type { FinancialEventStore } from "@/storage/local/capabilities/financialEventStore";

/** R3 (R3-SC-05): عدسة الخدمة — قدرة الأصول حصرًا مع قراءتَي الأحداث
 * المالية المستخدمتين بالضبط (عكس الحدث المرتبط عند تصحيح الاقتناء). */
export type AssetServiceStore = AssetStore &
  Pick<FinancialEventStore, "listFinancialEvents" | "commitFinancialEventCorrection"> &
  /* S08 (UNIT-034): التحقق الحي من طرف الاقتناء المحفوظ (نمط S05) عند
   * إنشائه — لقطة الاسم تُبنى من الطرف الحي لا من مدخل حر. */
  Pick<PrototypeLocalStore, "listCounterparties">;
import { systemClock, type Clock } from "@/application/time/clock";
import { FINANCIAL_EVENTS_READ_FAILED_MESSAGE, errorMessageOf } from "@/application/resultCodes";
import { storageFailureCode } from "@/storage/local/types";

/* STR-620/608 (Wave F — تكثيف الهامش): الحرفية نفسها كانت تتكرر في هذا الملف
 * عدّة مرات؛ ثابت واحد بلا أي تغيير رسالة. */
const ASSET_READ_FAILED_MESSAGE = "تعذر قراءة سجل الأصل المحلي.";
const ASSET_UNAVAILABLE_MESSAGE = "الأصل غير متاح محليًا.";

export type AssetSummaryRow = {
  asset: AssetRecord;
  statusLabel: string;
  bookValueMinor: number;
  accumulatedDepreciationMinor: number;
  monthlyMinor: number | null;
  hasUnknownLife: boolean;
  hasUnknownStart: boolean;
  unrecordedDepreciationMinor: number;
};

/* Wave 4.4 — P-4.4-1: التجميع الرسمي لقراءة الأصول يعيش في خدمة القراءة —
 * المعادلة نفسها التي كانت تُحسب داخل العرض (جمع bookValueMinor وجمع
 * unrecordedDepreciationMinor على الصفوف)؛ النقل لا يغيّر القيمة ولا
 * الدلالة، ويمنع تكرار المعادلة في أكثر من سطح (تماثل D7). */
export type AssetOverviewTotals = {
  bookValueMinor: number;
  unrecordedDepreciationMinor: number;
};

export type AssetOverviewRead = {
  rows: readonly AssetSummaryRow[];
  totals: AssetOverviewTotals;
};

export type AssetCreateInput = {
  name: string;
  categoryLabel?: string | null;
  acquisitionAmountMinor: number;
  acquisitionKind: "cash" | "payable";
  purchaseDate: string;
  lifeMonths?: number | null;
  depreciationStartOn?: string | null;
  /* عقد ٤٣ (WS-179 — Wave 7): القيمة المتبقية والملاحظة — اختياريان (متبقية = ٠)؛
   * الملاحظة تُخزَّن على السجل وتمر لحدث الاقتناء كما كانت. */
  residualValueMinor?: number | null;
  note?: string | null;
  /* S08 (UNIT-034): طرف الاقتناء المحفوظ (معرف طرف قائم — يُتحقق حيًّا)
   * والمدفوع لحظة الإنشاء للدفع الجزئي المعتمد (kind=payable فقط،
   * أصغر من القيمة) — كلاهما اختياري. */
  acquisitionPartyId?: string | null;
  paidAtCreationMinor?: number | null;
};

export type AssetContractRevisionInput = {
  lifeMonths: number | null;
  depreciationStartOn: string | null;
  /* عقد ٤٣ (WS-179 — Wave 7): undefined = دون تغيير؛ null = إرجاع إلى ٠/بلا ملاحظة. */
  residualValueMinor?: number | null;
  note?: string | null;
  reason: string;
};

export type AssetAcquisitionCorrectionInput = {
  acquisitionAmountMinor: number;
  acquisitionKind: "cash" | "payable";
  /* S08: المدفوع لحظة الإنشاء بعد التصحيح — يُطبق على البديل بنفس عقد
   * الدفع الجزئي (kind=payable وأصغر من القيمة الجديدة). */
  paidAtCreationMinor?: number | null;
  reason: string;
};

/* S08 (UNIT-034 / SDF-066): تسديد متبقي ذممة اقتناء أصل من مصدر الالتزام
 * نفسه — المبلغ داخل المتبقي الحي، والحتمية بمفتاح العملية. */
export type AssetPayableSettlementInput = {
  assetId: string;
  amountMinor: number;
  occurredOn: string;
  note: string;
  operationKey: string;
};

export type AssetDisposalInput = {
  on: string;
  proceedsMinor: number;
  reason: string;
};

export type AssetWriteOffInput = {
  on: string;
  reason: string;
};

export type AssetDepreciationInput = {
  asOf: string;
};

export type AssetResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      code: "storage_error" | "storage_stale" | "invalid_state" | "validation_error";
      message: string;
    };

function failure(
  code: "storage_error" | "storage_stale" | "invalid_state" | "validation_error",
  message: string,
) {
  return { ok: false as const, code, message };
}

const STATUS_LABELS: Record<AssetRecord["status"], string> = {
  active: "نشط",
  disposed: "متخلص منه",
  written_off: "مشطوب",
};

/* R10-B3/R10A-F-012 + R10B-NF-006 (2026-10-12): حارس السياق غير الآمن —
 * نمط السلسلة الاختيارية المعتمد في البيت (inventoryMaterialModel.ts:231
 * نفسه): randomUUID حرفيًا عند توفره، وبديل حتمي-آمن فريد خارجه؛ الإنشاء
 * على أصل غير آمن لا يرمي TypeError بعد اليوم. */
function newId(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

export class AssetService {
  constructor(
    private readonly store: AssetServiceStore,
    private readonly now: Clock = systemClock,
  ) {}

  async overview(): Promise<AssetResult<AssetOverviewRead>> {
    const [assetsResult, eventsResult] = await Promise.all([
      this.store.listAssets(),
      this.store.listFinancialEvents(),
    ]);
    if (!assetsResult.ok || !eventsResult.ok)
      return failure("storage_error", "تعذر قراءة سجل الأصول المحلي.");
    const asOf = localDateInAmman(this.now());
    const rows = assetsResult.value.map(asset => {
      const summary = assetEventSummary(asset.id, eventsResult.value);
      const proposal = planAssetDepreciation(asset, eventsResult.value, asOf);
      return {
        asset,
        statusLabel: STATUS_LABELS[asset.status],
        bookValueMinor: summary.bookValueMinor,
        accumulatedDepreciationMinor: summary.depreciationMinor,
        monthlyMinor: proposal.monthlyMinor,
        hasUnknownLife: asset.lifeMonths === null,
        hasUnknownStart: asset.depreciationStartOn === null,
        unrecordedDepreciationMinor: proposal.proposedMinor,
      };
    });
    /* P-4.4-1: نفس reduce العرض القديم حرفيًا — الآن في طبقة القراءة وحدها. */
    return {
      ok: true,
      value: {
        rows,
        totals: {
          bookValueMinor: rows.reduce((sum, row) => sum + row.bookValueMinor, 0),
          unrecordedDepreciationMinor: rows.reduce((sum, row) => sum + row.unrecordedDepreciationMinor, 0),
        },
      },
    };
  }

  async read(assetId: string): Promise<
    AssetResult<{
      asset: AssetRecord;
      summary: ReturnType<typeof assetEventSummary>;
      payments: AssetPaymentStatus;
      proposal: ReturnType<typeof planAssetDepreciation>;
      events: readonly FinancialEvent[];
    }>
  > {
    const [assetResult, eventsResult] = await Promise.all([
      this.store.getAsset(assetId),
      this.store.listFinancialEvents(),
    ]);
    if (!assetResult.ok || !eventsResult.ok) return failure("storage_error", ASSET_READ_FAILED_MESSAGE);
    const asset = assetResult.value;
    if (!asset) return failure("invalid_state", ASSET_UNAVAILABLE_MESSAGE);
    const reversed = reversedEventIds(eventsResult.value);
    const events = eventsResult.value
      .filter(event => event.assetContext?.assetId === assetId)
      .sort(
        (left, right) => right.recordedAt.localeCompare(left.recordedAt) || right.id.localeCompare(left.id),
      );
    return {
      ok: true,
      value: {
        asset,
        summary: assetEventSummary(assetId, eventsResult.value),
        /* S08: وضع السداد المشتق — المدفوع النقدي الفعلي والمتبقي الحي
         * من الأحداث، لا من حقول قابلة للتحرير المستقل. */
        payments: assetPaymentStatusOf(assetId, eventsResult.value),
        proposal: planAssetDepreciation(asset, eventsResult.value, localDateInAmman(this.now())),
        events: events.filter(event => event.correctionType !== "reverse" || !reversed.has(event.id)),
      },
    };
  }

  /* S08 (UNIT-034 / SDF-066): بناء أحداث الاقتناء — نقدي كامل (حدث واحد)
   * أو ذمم كاملة (حدث واحد) أو جزئي معتمد (حدث نقدي بالمدفوع + حدث ذمم
   * بالمتبقي؛ كل أثر مرة واحدة)؛ الطرف المحفوظ يُتحقق حيًّا بلقطة اسمه. */
  private buildAcquisitionEvents(input: {
    assetId: string;
    name: string;
    acquisitionAmountMinor: number;
    acquisitionKind: "cash" | "payable";
    purchaseDate: string;
    paidAtCreationMinor: number | null;
    note: string | null;
    createdAt: string;
    /* مفتاح الإبدال يمتد بطابع زمني عند التصحيح — لا يصطدم بمفتاح حدث
     * الاقتناء الأصلي القائم (يعكسه حدث مستقل بمعاملته). */
    keySuffix?: string;
  }): { events: FinancialEvent[]; payableEventId: string | null } {
    const events: FinancialEvent[] = [];
    const paid = input.paidAtCreationMinor;
    const note = input.note?.trim() || `اقتناء أصل: ${input.name}`;
    const build = (type: FinancialEventType, amountMinor: number, idempotencyKey: string) =>
      createFinancialEvent({
        id: newId("event"),
        type,
        amountMinor,
        occurredOn: input.purchaseDate,
        recordedAt: input.createdAt,
        idempotencyKey,
        note,
        counterparty: null,
        assetContext: { assetId: input.assetId, name: input.name },
      });
    const suffix = input.keySuffix ?? "";
    if (input.acquisitionKind === "cash") {
      events.push(
        build(
          "asset_purchase_cash",
          input.acquisitionAmountMinor,
          `${input.assetId}:acquisition:cash${suffix}`,
        ),
      );
      return { events, payableEventId: null };
    }
    if (paid !== null && paid > 0) {
      events.push(build("asset_purchase_cash", paid, `${input.assetId}:acquisition:cash${suffix}`));
      const payable = build(
        "asset_purchase_payable",
        input.acquisitionAmountMinor - paid,
        `${input.assetId}:acquisition:payable${suffix}`,
      );
      events.push(payable);
      return { events, payableEventId: payable.id };
    }
    const payable = build(
      "asset_purchase_payable",
      input.acquisitionAmountMinor,
      `${input.assetId}:acquisition:payable${suffix}`,
    );
    events.push(payable);
    return { events, payableEventId: payable.id };
  }

  async create(
    input: AssetCreateInput,
  ): Promise<AssetResult<{ asset: AssetRecord; events: readonly FinancialEvent[] }>> {
    try {
      /* S08: الطرف المحفوظ يُتحقق حيًّا — هوية مستقرة ولقطة اسم تاريخية
       * من الطرف القائم نفسه؛ لا دمج بالاسم ولا طرف مكرر لإنقاذ الحفظ. */
      let acquisitionParty: { partyId: string; labelSnapshot: string } | null = null;
      if (input.acquisitionPartyId?.trim()) {
        const partiesResult = await this.store.listCounterparties();
        if (!partiesResult.ok) return failure("storage_error", "تعذر قراءة الأطراف المحفوظة محليًا.");
        const party = partiesResult.value.find(
          candidate => candidate.id === input.acquisitionPartyId!.trim(),
        );
        if (!party)
          return failure(
            "validation_error",
            "اختر طرفًا محفوظًا قائمًا لاقتناء الأصل — أو اتركه فارغًا؛ لا يُخترع طرف بمعرف غير موجود.",
          );
        acquisitionParty = { partyId: party.id, labelSnapshot: party.label };
      }
      const assetId = newId("asset");
      const createdAt = this.now();
      const acquisition = this.buildAcquisitionEvents({
        assetId,
        name: input.name,
        acquisitionAmountMinor: input.acquisitionAmountMinor,
        acquisitionKind: input.acquisitionKind,
        purchaseDate: input.purchaseDate,
        paidAtCreationMinor: input.paidAtCreationMinor ?? null,
        note: input.note ?? null,
        createdAt,
      });
      const events = acquisition.events;
      /* رابط حدث الاقتناء على السجل: حدث الذمم إن وُجد (مصدر السداد
       * اللاحق) وإلا حدث النقد — عقد واحد واضح لا غموض. */
      const linkedEventId =
        events.find(event => event.type === "asset_purchase_payable")?.id ?? events[0]!.id;
      const asset = createAssetRecord({
        id: assetId,
        name: input.name,
        categoryLabel: input.categoryLabel ?? null,
        acquisitionAmountMinor: input.acquisitionAmountMinor,
        acquisitionKind: input.acquisitionKind,
        purchaseDate: input.purchaseDate,
        lifeMonths: input.lifeMonths ?? null,
        depreciationStartOn: input.depreciationStartOn ?? null,
        residualValueMinor: input.residualValueMinor ?? null,
        note: input.note ?? null,
        acquisitionParty,
        paidAtCreationMinor: input.paidAtCreationMinor ?? null,
        acquisitionEventId: linkedEventId,
        operationKey: `${assetId}:create`,
        createdAt,
      });
      const commit = await this.store.commitAssetAcquisition(asset, events);
      if (!commit.ok) return failure(storageFailureCode(commit.code), commit.message);
      return { ok: true, value: { asset: commit.value.record, events: commit.value.events } };
    } catch (error) {
      return failure("validation_error", errorMessageOf(error, "بيانات الأصل غير صالحة."));
    }
  }

  async reviseContract(
    assetId: string,
    input: AssetContractRevisionInput,
  ): Promise<AssetResult<{ asset: AssetRecord }>> {
    const asset = await this.loadAsset(assetId);
    if (!asset.ok) return asset;
    try {
      const revised = reviseAssetContract(asset.value, input, this.now());
      const commit = await this.store.commitAssetRecord(revised, null);
      if (!commit.ok) return failure("storage_error", commit.message);
      return { ok: true, value: { asset: commit.value.record } };
    } catch (error) {
      return failure("validation_error", errorMessageOf(error, "تعديل عقد الإهلاك غير صالح."));
    }
  }

  async correctAcquisition(
    assetId: string,
    input: AssetAcquisitionCorrectionInput,
  ): Promise<
    AssetResult<{
      asset: AssetRecord;
      reversals: readonly FinancialEvent[];
      replacements: readonly FinancialEvent[];
    }>
  > {
    const [assetResult, eventsResult] = await Promise.all([
      this.store.getAsset(assetId),
      this.store.listFinancialEvents(),
    ]);
    if (!assetResult.ok || !eventsResult.ok) return failure("storage_error", ASSET_READ_FAILED_MESSAGE);
    const asset = assetResult.value;
    if (!asset) return failure("invalid_state", ASSET_UNAVAILABLE_MESSAGE);
    /* عقد الأصول (فصل الإهلاك عن التخلص): الأصل المؤرشف — تخلص أو شطب — قيمته
     * الدفترية مثبتة عند الأرشفة؛ تصحيح اقتنائه بعدها يُحيي قيمة ملغاة. التصحيح
     * الموثق مسموح ما دام الأصل نشطًا. */
    if (asset.status !== "active")
      return failure(
        "invalid_state",
        "تعذّر تصحيح اقتناء أصل مؤرشف — قيمته الدفترية مثبتة عند التخلص أو الشطب. صحّح الخطأ والأصل نشط أولًا، أو سجّل الأثر الجديد كواقعة موثقة من مالي.",
      );
    /* S08: أحداث الاقتناء الحية للأصل — تُعكس كلها (حتى حدثين للجزئي). */
    const reversedIds = reversedEventIds(eventsResult.value);
    const acquisitionEvents = eventsResult.value.filter(
      event =>
        (event.type === "asset_purchase_cash" || event.type === "asset_purchase_payable") &&
        event.assetContext?.assetId === assetId &&
        event.correctionType !== "reverse" &&
        !reversedIds.has(event.id),
    );
    if (acquisitionEvents.length === 0)
      return failure("invalid_state", "أحداث الاقتناء الأصلية غير موجودة؛ راجع سجل التصحيحات.");
    /* تصحيح مراجعة 4-c: لا تصحيح بلا تغيير — الواجهة تحجبه والخدمة تحرسه. */
    if (
      input.acquisitionAmountMinor === asset.acquisitionAmountMinor &&
      input.acquisitionKind === asset.acquisitionKind &&
      (input.paidAtCreationMinor ?? null) === (asset.paidAtCreationMinor ?? null)
    )
      return failure("validation_error", "لا تغيير عن المسجّل — عدّل القيمة أو طريقة الدفع قبل التصحيح.");
    try {
      const now = this.now();
      const reversals = acquisitionEvents.map(source =>
        createFinancialReversal({
          id: newId("event"),
          sourceEvent: source,
          occurredOn: localDateInAmman(now),
          recordedAt: now,
          idempotencyKey: `${assetId}:acquisition-reversal:${source.id}:${now}`,
          reason: input.reason,
        }),
      );
      /* البديل يُبنى بعقد الدفع الجديد — جزئيًا كان أم كاملًا. */
      const replacementBuild = this.buildAcquisitionEvents({
        assetId,
        name: asset.name,
        acquisitionAmountMinor: input.acquisitionAmountMinor,
        acquisitionKind: input.acquisitionKind,
        purchaseDate: asset.purchaseDate,
        paidAtCreationMinor: input.paidAtCreationMinor ?? null,
        note: `تصحيح اقتناء: ${input.reason.trim()}`,
        createdAt: now,
        keySuffix: `:${now}`,
      });
      const linkedEventId =
        replacementBuild.events.find(event => event.type === "asset_purchase_payable")?.id ??
        replacementBuild.events[0]!.id;
      const correctedAsset: AssetRecord = {
        ...asset,
        acquisitionAmountMinor: input.acquisitionAmountMinor,
        acquisitionKind: input.acquisitionKind,
        paidAtCreationMinor: input.paidAtCreationMinor ?? null,
        acquisitionEventId: linkedEventId,
        updatedAt: now,
      };
      const commit = await this.store.commitAssetAcquisitionCorrection(
        correctedAsset,
        reversals,
        replacementBuild.events,
      );
      if (!commit.ok) return failure(storageFailureCode(commit.code), commit.message);
      return {
        ok: true,
        value: {
          asset: commit.value.record,
          reversals: commit.value.reversals,
          replacements: commit.value.replacements,
        },
      };
    } catch (error) {
      return failure("validation_error", errorMessageOf(error, "تصحيح الاقتناء غير صالح."));
    }
  }

  /* S08 (UNIT-034 / SDF-066): تسديد متبقي ذممة اقتناء الأصل — من مصدر
   * الالتزام نفسه، داخل المتبقي الحي، بلا مصروف جديد ولا دفع مكرر. */
  async payPayable(
    input: AssetPayableSettlementInput,
  ): Promise<AssetResult<FinancialEvent> & { reused?: boolean }> {
    const [assetResult, eventsResult] = await Promise.all([
      this.store.getAsset(input.assetId),
      this.store.listFinancialEvents(),
    ]);
    if (!assetResult.ok || !eventsResult.ok) return failure("storage_error", ASSET_READ_FAILED_MESSAGE);
    const asset = assetResult.value;
    if (!asset) return failure("invalid_state", ASSET_UNAVAILABLE_MESSAGE);
    const status = assetPaymentStatusOf(input.assetId, eventsResult.value);
    if (!status.hasPayable)
      return failure("validation_error", "لا متبقي على اقتناء هذا الأصل — لا تسديد فوق حق غير قائم.");
    if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0)
      return failure("validation_error", "أدخل مبلغ التسديد بالأرقام 0–9.");
    if (input.amountMinor > status.remainingPayableMinor)
      return failure(
        "validation_error",
        `لا يمكن أن يتجاوز التسديد المتبقي الحي (${status.remainingPayableMinor} وحدة صغرى) على اقتناء هذا الأصل.`,
      );
    try {
      /* المصدر: حدث ذمم الاقتناء الفعال — يُربط صراحةً فلا يتشعب الحق. */
      const reversedIds = reversedEventIds(eventsResult.value);
      const source = eventsResult.value.find(
        event =>
          event.type === "asset_purchase_payable" &&
          event.assetContext?.assetId === input.assetId &&
          event.correctionType !== "reverse" &&
          !reversedIds.has(event.id),
      );
      if (!source) return failure("invalid_state", "التزام اقتناء الأصل غير موجود أو معكوس سابقًا.");
      const now = this.now();
      const settlement = createFinancialEvent({
        id: newId("event"),
        type: "payable_settlement_cash",
        amountMinor: input.amountMinor,
        occurredOn: input.occurredOn,
        recordedAt: now,
        idempotencyKey: `${input.assetId}:settle:${input.operationKey}`,
        note: input.note?.trim() || `تسديد من متبقي اقتناء ${asset.name}`,
        counterparty: asset.acquisitionParty?.labelSnapshot ?? null,
        relatedEventId: source.id,
      });
      /* الحد الحي داخل المعاملة يحرس المتبقي مجددًا — الخدمة تحرسه أولًا
       * برسالة أهدأ والحد يمنع سباق النافذتين. */
      const commit = await this.store.commitAssetPayableSettlement(settlement);
      if (!commit.ok) return failure(storageFailureCode(commit.code), commit.message);
      /* إعادة الاستخدام الصادقة تصل مطبوعة — المُرسِل يعرف أن حدثه المخزّن
       * هو المعتمد ولم تُكتب نسخة ثانية. */
      return { ok: true, value: commit.value.settlement, reused: commit.value.reused };
    } catch (error) {
      return failure("validation_error", errorMessageOf(error, "تسديد الاقتناء غير صالح."));
    }
  }

  async recordDepreciation(
    assetId: string,
    input: AssetDepreciationInput,
  ): Promise<AssetResult<{ event: FinancialEvent }>> {
    const [assetResult, eventsResult] = await Promise.all([
      this.store.getAsset(assetId),
      this.store.listFinancialEvents(),
    ]);
    if (!assetResult.ok || !eventsResult.ok) return failure("storage_error", ASSET_READ_FAILED_MESSAGE);
    const asset = assetResult.value;
    if (!asset) return failure("invalid_state", ASSET_UNAVAILABLE_MESSAGE);
    const proposal = planAssetDepreciation(asset, eventsResult.value, input.asOf);
    if (proposal.proposedMinor <= 0)
      return failure(
        "validation_error",
        /* F-024 (W3-B): «مقترح» لا «مستحق» — نفس مفردة عقد ٤٣: لا التزام
         * نقديًا قبل تسجيل صريح. */
        proposal.readiness === "ready" ? "لا إهلاك مقترح جديد حتى هذا التاريخ." : proposal.note,
      );
    try {
      const now = this.now();
      const event = createFinancialEvent({
        id: newId("event"),
        type: "asset_depreciation",
        amountMinor: proposal.proposedMinor,
        occurredOn: input.asOf,
        recordedAt: now,
        idempotencyKey: `${assetId}:dep:${input.asOf}`,
        note: `إهلاك ${asset.name} حتى ${input.asOf}`,
        assetContext: { assetId, name: asset.name },
      });
      const commit = await this.store.commitAssetRecord(asset, event);
      if (!commit.ok) return failure("storage_error", commit.message);
      const stored = commit.value.event;
      if (!stored) return failure("invalid_state", "لم يُخزَّن حدث الإهلاك؛ راجع سلامة الأصول.");
      return { ok: true, value: { event: stored } };
    } catch (error) {
      return failure("validation_error", errorMessageOf(error, "تسجيل الإهلاك غير صالح."));
    }
  }

  async reverseDepreciation(
    eventId: string,
    reason: string,
  ): Promise<AssetResult<{ reversal: FinancialEvent }>> {
    const eventsResult = await this.store.listFinancialEvents();
    if (!eventsResult.ok) return failure("storage_error", FINANCIAL_EVENTS_READ_FAILED_MESSAGE);
    const source = eventsResult.value.find(event => event.id === eventId);
    if (!source || source.type !== "asset_depreciation")
      return failure("invalid_state", "حدث الإهلاك غير موجود.");
    /* عقد الأصول (فصل الإهلاك عن التخلص — AV-08): عكس إهلاك بعد التخلص أو الشطب
     * يُحيي قيمة دفترية ملغاة؛ الأصل المؤرشف مثبّت. عكس الخطأ الموثق يبقى متاحًا
     * ما دام الأصل نشطًا (تصحيح ما قبل الأرشفة). */
    const assetId = source.assetContext?.assetId;
    if (assetId) {
      const assetResult = await this.store.getAsset(assetId);
      if (assetResult.ok && assetResult.value && assetResult.value.status !== "active")
        return failure(
          "invalid_state",
          "تعذّر عكس إهلاك أصل مؤرشف — التخلص والشطب يثبّتان القيمة الدفترية نهائيًا، وعكس الإهلاك بعدهما يُحيي قيمة ملغاة. إن وجدت خطأ قبل الأرشفة فصحّحه والأصل نشط أولًا.",
        );
    }
    if (
      source.correctionType === "reverse" ||
      eventsResult.value.some(
        event => event.correctionType === "reverse" && event.correctionOfEventId === eventId,
      )
    )
      return failure("invalid_state", "هذا الإهلاك معكوس سابقًا.");
    try {
      const now = this.now();
      const reversal = createFinancialReversal({
        id: newId("event"),
        sourceEvent: source,
        occurredOn:
          /* R2 (M-05/D4): تاريخ الأعمال الكنوني بعمّان من الساعة المحقونة — كان قصّ UTC يزيح اليوم للتصحيحات المسائية (21:00Z–24:00Z) */ localDateInAmman(
            now,
          ),
        recordedAt: now,
        idempotencyKey: `${eventId}:reversal:${now}`,
        reason,
      });
      const commit = await this.store.commitFinancialEventCorrection(eventId, reversal);
      if (!commit.ok) return failure("storage_error", commit.message);
      return { ok: true, value: { reversal: commit.value } };
    } catch (error) {
      return failure("validation_error", errorMessageOf(error, "تراجع الإهلاك غير صالح."));
    }
  }

  async dispose(
    assetId: string,
    input: AssetDisposalInput,
  ): Promise<AssetResult<{ asset: AssetRecord; event: FinancialEvent }>> {
    const [assetResult, eventsResult] = await Promise.all([
      this.store.getAsset(assetId),
      this.store.listFinancialEvents(),
    ]);
    if (!assetResult.ok || !eventsResult.ok) return failure("storage_error", ASSET_READ_FAILED_MESSAGE);
    const asset = assetResult.value;
    if (!asset) return failure("invalid_state", ASSET_UNAVAILABLE_MESSAGE);
    try {
      const prepared = prepareAssetDisposal(asset, eventsResult.value, input);
      const now = this.now();
      const event = createFinancialEvent({
        id: newId("event"),
        type: "asset_disposal_cash",
        amountMinor: input.proceedsMinor,
        occurredOn: input.on,
        recordedAt: now,
        idempotencyKey: `${assetId}:disposal:${now}`,
        note: `تخلص من ${asset.name}: ${input.reason.trim()}`,
        assetContext: { assetId, name: asset.name, bookValueMinor: prepared.bookValueMinor },
      });
      const next = applyAssetDisposal(
        asset,
        {
          on: input.on,
          proceedsMinor: input.proceedsMinor,
          bookValueMinor: prepared.bookValueMinor,
          eventId: event.id,
          reason: input.reason.trim(),
        },
        now,
      );
      const commit = await this.store.commitAssetRecord(next, event);
      if (!commit.ok) return failure("storage_error", commit.message);
      const stored = commit.value.event;
      if (!stored) return failure("invalid_state", "لم يُخزَّن حدث التخلص؛ راجع سلامة الأصول.");
      return { ok: true, value: { asset: commit.value.record, event: stored } };
    } catch (error) {
      return failure("validation_error", errorMessageOf(error, "التخلص غير صالح."));
    }
  }

  async writeOff(
    assetId: string,
    input: AssetWriteOffInput,
  ): Promise<AssetResult<{ asset: AssetRecord; event: FinancialEvent }>> {
    const [assetResult, eventsResult] = await Promise.all([
      this.store.getAsset(assetId),
      this.store.listFinancialEvents(),
    ]);
    if (!assetResult.ok || !eventsResult.ok) return failure("storage_error", ASSET_READ_FAILED_MESSAGE);
    const asset = assetResult.value;
    if (!asset) return failure("invalid_state", ASSET_UNAVAILABLE_MESSAGE);
    try {
      const prepared = prepareAssetWriteOff(asset, eventsResult.value, input);
      const now = this.now();
      const event = createFinancialEvent({
        id: newId("event"),
        type: "asset_writeoff",
        amountMinor: prepared.bookValueMinor,
        occurredOn: input.on,
        recordedAt: now,
        idempotencyKey: `${assetId}:writeoff:${now}`,
        note: `شطب ${asset.name}: ${input.reason.trim()}`,
        assetContext: { assetId, name: asset.name },
      });
      const next = applyAssetWriteOff(
        asset,
        {
          on: input.on,
          bookValueMinor: prepared.bookValueMinor,
          eventId: event.id,
          reason: input.reason.trim(),
        },
        now,
      );
      const commit = await this.store.commitAssetRecord(next, event);
      if (!commit.ok) return failure("storage_error", commit.message);
      const stored = commit.value.event;
      if (!stored) return failure("invalid_state", "لم يُخزَّن حدث الشطب؛ راجع سلامة الأصول.");
      return { ok: true, value: { asset: commit.value.record, event: stored } };
    } catch (error) {
      return failure("validation_error", errorMessageOf(error, "الشطب غير صالح."));
    }
  }

  async recordedDepreciation(assetId: string): Promise<AssetResult<number>> {
    const eventsResult = await this.store.listFinancialEvents();
    if (!eventsResult.ok) return failure("storage_error", FINANCIAL_EVENTS_READ_FAILED_MESSAGE);
    return { ok: true, value: recordedDepreciationMinor(assetId, eventsResult.value) };
  }

  private async loadAsset(assetId: string): Promise<AssetResult<AssetRecord>> {
    const result = await this.store.getAsset(assetId);
    if (!result.ok) return failure("storage_error", ASSET_READ_FAILED_MESSAGE);
    if (!result.value) return failure("invalid_state", ASSET_UNAVAILABLE_MESSAGE);
    return { ok: true, value: result.value };
  }
}
