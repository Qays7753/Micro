/**
 * المجموعة ٤ (عقد ٢٩): خدمة الأصول — الكاتب الواحد لأحداث الأصول المالية.
 * الإنشاء (نقدي/ذمم) والتسليم والتصحيح والتخلص والشطب كلها معاملات ذرّية
 * عبر commitAssetRecord/commitAssetAcquisitionCorrection. الإهلاك المقترح
 * قراءة فقط لا تخصم شيئًا؛ تسجيله حدث صريح قابل للتراجع. لا صفحة تكتب
 * في IndexedDB مباشرة — كل شيء من هنا.
 */
import {
  applyAssetDisposal,
  applyAssetWriteOff,
  assetEventSummary,
  createAssetRecord,
  planAssetDepreciation,
  prepareAssetDisposal,
  prepareAssetWriteOff,
  recordedDepreciationMinor,
  reviseAssetContract,
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

export type AssetCreateInput = {
  name: string;
  categoryLabel?: string | null;
  acquisitionAmountMinor: number;
  acquisitionKind: "cash" | "payable";
  purchaseDate: string;
  lifeMonths?: number | null;
  depreciationStartOn?: string | null;
  note?: string | null;
};

export type AssetContractRevisionInput = {
  lifeMonths: number | null;
  depreciationStartOn: string | null;
  reason: string;
};

export type AssetAcquisitionCorrectionInput = {
  acquisitionAmountMinor: number;
  acquisitionKind: "cash" | "payable";
  reason: string;
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
  | { ok: false; code: "storage_error" | "invalid_state" | "validation_error"; message: string };

function failure(code: "storage_error" | "invalid_state" | "validation_error", message: string) {
  return { ok: false as const, code, message };
}

const STATUS_LABELS: Record<AssetRecord["status"], string> = {
  active: "نشط",
  disposed: "متخلص منه",
  written_off: "مشطوب",
};

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export class AssetService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async overview(): Promise<AssetResult<readonly AssetSummaryRow[]>> {
    const [assetsResult, eventsResult] = await Promise.all([
      this.store.listAssets(),
      this.store.listFinancialEvents(),
    ]);
    if (!assetsResult.ok || !eventsResult.ok)
      return failure("storage_error", "تعذر قراءة سجل الأصول المحلي.");
    const asOf = this.now().slice(0, 10);
    return {
      ok: true,
      value: assetsResult.value.map(asset => {
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
      }),
    };
  }

  async read(assetId: string): Promise<
    AssetResult<{
      asset: AssetRecord;
      summary: ReturnType<typeof assetEventSummary>;
      proposal: ReturnType<typeof planAssetDepreciation>;
      events: readonly FinancialEvent[];
    }>
  > {
    const [assetResult, eventsResult] = await Promise.all([
      this.store.getAsset(assetId),
      this.store.listFinancialEvents(),
    ]);
    if (!assetResult.ok || !eventsResult.ok)
      return failure("storage_error", "تعذر قراءة سجل الأصل المحلي.");
    const asset = assetResult.value;
    if (!asset) return failure("invalid_state", "الأصل غير متاح محليًا.");
    const reversed = reversedEventIds(eventsResult.value);
    const events = eventsResult.value
      .filter(event => event.assetContext?.assetId === assetId)
      .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt) || right.id.localeCompare(left.id));
    return {
      ok: true,
      value: {
        asset,
        summary: assetEventSummary(assetId, eventsResult.value),
        proposal: planAssetDepreciation(asset, eventsResult.value, this.now().slice(0, 10)),
        events: events.filter(event => event.correctionType !== "reverse" || !reversed.has(event.id)),
      },
    };
  }

  async create(input: AssetCreateInput): Promise<AssetResult<{ asset: AssetRecord; event: FinancialEvent | null }>> {
    try {
      const assetId = newId("asset");
      const createdAt = this.now();
      const eventType: FinancialEventType =
        input.acquisitionKind === "cash" ? "asset_purchase_cash" : "asset_purchase_payable";
      const event = createFinancialEvent({
        id: newId("event"),
        type: eventType,
        amountMinor: input.acquisitionAmountMinor,
        occurredOn: input.purchaseDate,
        recordedAt: createdAt,
        idempotencyKey: `${assetId}:acquisition`,
        note: input.note?.trim() || `اقتناء أصل: ${input.name.trim()}`,
        counterparty: input.categoryLabel?.trim() || null,
        assetContext: { assetId, name: input.name.trim() },
      });
      const asset = createAssetRecord({
        id: assetId,
        name: input.name,
        categoryLabel: input.categoryLabel ?? null,
        acquisitionAmountMinor: input.acquisitionAmountMinor,
        acquisitionKind: input.acquisitionKind,
        purchaseDate: input.purchaseDate,
        lifeMonths: input.lifeMonths ?? null,
        depreciationStartOn: input.depreciationStartOn ?? null,
        acquisitionEventId: event.id,
        operationKey: `${assetId}:create`,
        createdAt,
      });
      const commit = await this.store.commitAssetRecord(asset, event);
      if (!commit.ok) return failure("storage_error", commit.message);
      return { ok: true, value: { asset: commit.value.record, event: commit.value.event } };
    } catch (error) {
      return failure(
        "validation_error",
        error instanceof Error ? error.message : "بيانات الأصل غير صالحة.",
      );
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
      return failure(
        "validation_error",
        error instanceof Error ? error.message : "تعديل عقد الإهلاك غير صالح.",
      );
    }
  }

  async correctAcquisition(
    assetId: string,
    input: AssetAcquisitionCorrectionInput,
  ): Promise<AssetResult<{ asset: AssetRecord; reversal: FinancialEvent; replacement: FinancialEvent }>> {
    const [assetResult, eventsResult] = await Promise.all([
      this.store.getAsset(assetId),
      this.store.listFinancialEvents(),
    ]);
    if (!assetResult.ok || !eventsResult.ok)
      return failure("storage_error", "تعذر قراءة سجل الأصل المحلي.");
    const asset = assetResult.value;
    if (!asset) return failure("invalid_state", "الأصل غير متاح محليًا.");
    const source = eventsResult.value.find(event => event.id === asset.acquisitionEventId);
    if (!source) return failure("invalid_state", "حدث الاقتناء الأصلي غير موجود.");
    if (source.correctionType === "reverse")
      return failure("invalid_state", "حدث الاقتناء معكوس سابقًا؛ راجع سجل التصحيحات.");
    /* تصحيح مراجعة 4-c: لا تصحيح بلا تغيير — الواجهة تحجبه والخدمة تحرسه. */
    if (
      input.acquisitionAmountMinor === asset.acquisitionAmountMinor &&
      input.acquisitionKind === asset.acquisitionKind
    )
      return failure("validation_error", "لا تغيير عن المسجّل — عدّل القيمة أو طريقة الدفع قبل التصحيح.");
    try {
      const now = this.now();
      const reversal = createFinancialReversal({
        id: newId("event"),
        sourceEvent: source,
        occurredOn: now.slice(0, 10),
        recordedAt: now,
        idempotencyKey: `${assetId}:acquisition-reversal:${now}`,
        reason: input.reason,
      });
      const replacement = createFinancialEvent({
        id: newId("event"),
        type: input.acquisitionKind === "cash" ? "asset_purchase_cash" : "asset_purchase_payable",
        amountMinor: input.acquisitionAmountMinor,
        occurredOn: asset.purchaseDate,
        recordedAt: now,
        idempotencyKey: `${assetId}:acquisition-replacement:${now}`,
        note: `تصحيح اقتناء: ${input.reason.trim()}`,
        counterparty: source.counterparty,
        assetContext: { assetId, name: asset.name },
      });
      const correctedAsset: AssetRecord = {
        ...asset,
        acquisitionAmountMinor: input.acquisitionAmountMinor,
        acquisitionKind: input.acquisitionKind,
        acquisitionEventId: replacement.id,
        updatedAt: now,
      };
      const commit = await this.store.commitAssetAcquisitionCorrection(correctedAsset, reversal, replacement);
      if (!commit.ok) return failure("storage_error", commit.message);
      return {
        ok: true,
        value: {
          asset: commit.value.record,
          reversal: commit.value.reversal,
          replacement: commit.value.replacement,
        },
      };
    } catch (error) {
      return failure("validation_error", error instanceof Error ? error.message : "تصحيح الاقتناء غير صالح.");
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
    if (!assetResult.ok || !eventsResult.ok)
      return failure("storage_error", "تعذر قراءة سجل الأصل المحلي.");
    const asset = assetResult.value;
    if (!asset) return failure("invalid_state", "الأصل غير متاح محليًا.");
    const proposal = planAssetDepreciation(asset, eventsResult.value, input.asOf);
    if (proposal.proposedMinor <= 0)
      return failure(
        "validation_error",
        proposal.readiness === "ready"
          ? "لا إهلاك مستحق جديد حتى هذا التاريخ."
          : proposal.note,
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
      return failure("validation_error", error instanceof Error ? error.message : "تسجيل الإهلاك غير صالح.");
    }
  }

  async reverseDepreciation(eventId: string, reason: string): Promise<AssetResult<{ reversal: FinancialEvent }>> {
    const eventsResult = await this.store.listFinancialEvents();
    if (!eventsResult.ok) return failure("storage_error", "تعذر قراءة سجل الأحداث المالية.");
    const source = eventsResult.value.find(event => event.id === eventId);
    if (!source || source.type !== "asset_depreciation")
      return failure("invalid_state", "حدث الإهلاك غير موجود.");
    if (source.correctionType === "reverse" || eventsResult.value.some(
        event => event.correctionType === "reverse" && event.correctionOfEventId === eventId,
      ))
      return failure("invalid_state", "هذا الإهلاك معكوس سابقًا.");
    try {
      const now = this.now();
      const reversal = createFinancialReversal({
        id: newId("event"),
        sourceEvent: source,
        occurredOn: now.slice(0, 10),
        recordedAt: now,
        idempotencyKey: `${eventId}:reversal:${now}`,
        reason,
      });
      const commit = await this.store.commitFinancialEventCorrection(eventId, reversal);
      if (!commit.ok) return failure("storage_error", commit.message);
      return { ok: true, value: { reversal: commit.value } };
    } catch (error) {
      return failure("validation_error", error instanceof Error ? error.message : "تراجع الإهلاك غير صالح.");
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
    if (!assetResult.ok || !eventsResult.ok)
      return failure("storage_error", "تعذر قراءة سجل الأصل المحلي.");
    const asset = assetResult.value;
    if (!asset) return failure("invalid_state", "الأصل غير متاح محليًا.");
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
      return failure("validation_error", error instanceof Error ? error.message : "التخلص غير صالح.");
    }
  }

  async writeOff(assetId: string, input: AssetWriteOffInput): Promise<AssetResult<{ asset: AssetRecord; event: FinancialEvent }>> {
    const [assetResult, eventsResult] = await Promise.all([
      this.store.getAsset(assetId),
      this.store.listFinancialEvents(),
    ]);
    if (!assetResult.ok || !eventsResult.ok)
      return failure("storage_error", "تعذر قراءة سجل الأصل المحلي.");
    const asset = assetResult.value;
    if (!asset) return failure("invalid_state", "الأصل غير متاح محليًا.");
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
        { on: input.on, bookValueMinor: prepared.bookValueMinor, eventId: event.id, reason: input.reason.trim() },
        now,
      );
      const commit = await this.store.commitAssetRecord(next, event);
      if (!commit.ok) return failure("storage_error", commit.message);
      const stored = commit.value.event;
      if (!stored) return failure("invalid_state", "لم يُخزَّن حدث الشطب؛ راجع سلامة الأصول.");
      return { ok: true, value: { asset: commit.value.record, event: stored } };
    } catch (error) {
      return failure("validation_error", error instanceof Error ? error.message : "الشطب غير صالح.");
    }
  }

  async recordedDepreciation(assetId: string): Promise<AssetResult<number>> {
    const eventsResult = await this.store.listFinancialEvents();
    if (!eventsResult.ok) return failure("storage_error", "تعذر قراءة سجل الأحداث المالية.");
    return { ok: true, value: recordedDepreciationMinor(assetId, eventsResult.value) };
  }

  private async loadAsset(assetId: string): Promise<AssetResult<AssetRecord>> {
    const result = await this.store.getAsset(assetId);
    if (!result.ok) return failure("storage_error", "تعذر قراءة سجل الأصل المحلي.");
    if (!result.value) return failure("invalid_state", "الأصل غير متاح محليًا.");
    return { ok: true, value: result.value };
  }
}
