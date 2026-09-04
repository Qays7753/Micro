import {
  assertId,
  assertNonNegativeInteger,
  assertPositiveMinor,
  fieldLabelAr,
  floorRatio,
  isValidLocalDate,
} from "../shared/index.js";
import { reversedEventIds, type FinancialEvent } from "../financial-event/index.js";
import type {
  AssetContractRevision,
  AssetDepreciationProposal,
  AssetDisposalRecord,
  AssetEventSummary,
  AssetRecord,
  AssetWriteOffRecord,
  CreateAssetRecordInput,
  ReviseAssetContractInput,
} from "./types.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function assertLocalDate(value: string, field: string) {
  if (!DATE_PATTERN.test(value) || !isValidLocalDate(value))
    throw new Error(`أدخل ${fieldLabelAr(field)} تاريخًا محليًا صحيحًا.`);
}

function assertName(value: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error("أكمل اسم الأصل قبل الحفظ.");
  if (normalized.length > 200) throw new Error("اسم الأصل يتجاوز ٢٠٠ حرف؛ اختصره.");
}

function normalizeCategoryLabel(value: string | null | undefined): string | null {
  const normalized = value?.trim().replace(/\s+/gu, " ") ?? null;
  if (!normalized) return null;
  if (normalized.length > 80) throw new Error("تصنيف الأصل يتجاوز ٨٠ حرفًا؛ اختصره أو اتركه فارغًا.");
  return normalized;
}

function assertLifeMonths(value: number | null | undefined) {
  if (value === null || value === undefined) return;
  if (!Number.isInteger(value) || value < 1 || value > 600)
    throw new Error("أدخل العمر النافع عددًا صحيحًا بين ١ و٦٠٠ شهرًا، أو اتركه «مجهولًا».");
}

/** الأحداث النشطة المرتبطة بأصل: لا تراجعات ولا معكوسات — الحقيقة الجارية. */
export function activeAssetEvents(events: readonly FinancialEvent[]): readonly FinancialEvent[] {
  const reversed = reversedEventIds(events);
  return events.filter(
    event =>
      event.correctionType !== "reverse" &&
      !reversed.has(event.id) &&
      event.assetContext?.assetId !== undefined &&
      event.assetContext !== null,
  );
}

function eventsForAsset(events: readonly FinancialEvent[], assetId: string): readonly FinancialEvent[] {
  const reversed = reversedEventIds(events);
  return events.filter(
    event =>
      event.correctionType !== "reverse" &&
      !reversed.has(event.id) &&
      event.assetContext?.assetId === assetId,
  );
}

export function createAssetRecord(input: CreateAssetRecordInput): AssetRecord {
  assertId(input.id, "id");
  assertName(input.name);
  assertPositiveMinor(input.acquisitionAmountMinor, "acquisitionAmountMinor");
  if (input.acquisitionKind !== "cash" && input.acquisitionKind !== "payable")
    throw new Error("طريقة اقتناء الأصل غير صالحة.");
  assertLocalDate(input.purchaseDate, "purchaseDate");
  assertLifeMonths(input.lifeMonths ?? null);
  if (input.depreciationStartOn) assertLocalDate(input.depreciationStartOn, "depreciationStartOn");
  if (input.depreciationStartOn && input.depreciationStartOn < input.purchaseDate)
    throw new Error("بداية الاستخدام لا يمكن أن تسبق تاريخ الشراء.");
  if (!input.operationKey.trim()) throw new Error("مفتاح عملية الأصل مطلوب.");
  if (Number.isNaN(Date.parse(input.createdAt))) throw new Error("أدخل وقت إنشاء الأصل وقتًا صحيحًا.");
  return Object.freeze({
    id: input.id,
    name: input.name.trim(),
    categoryLabel: normalizeCategoryLabel(input.categoryLabel),
    acquisitionAmountMinor: input.acquisitionAmountMinor,
    acquisitionKind: input.acquisitionKind,
    purchaseDate: input.purchaseDate,
    lifeMonths: input.lifeMonths ?? null,
    depreciationStartOn: input.depreciationStartOn ?? null,
    status: "active",
    acquisitionEventId: input.acquisitionEventId,
    disposal: null,
    writeOff: null,
    contractRevisions: [],
    operationKey: input.operationKey,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  });
}

/** تعديل عقد الأصل (العمر/البداية): مراجعة موثقة تُلحق بالتاريخ — الإهلاك المسجّل سابقًا لا يُمسّ. */
export function reviseAssetContract(
  asset: AssetRecord,
  input: ReviseAssetContractInput,
  changedAt: string,
): AssetRecord {
  assertLifeMonths(input.lifeMonths);
  if (input.depreciationStartOn) assertLocalDate(input.depreciationStartOn, "depreciationStartOn");
  if (input.depreciationStartOn && input.depreciationStartOn < asset.purchaseDate)
    throw new Error("بداية الاستخدام لا يمكن أن تسبق تاريخ الشراء.");
  if (!input.reason.trim()) throw new Error("أكمل سبب تعديل عقد الإهلاك قبل الحفظ.");
  if (asset.status !== "active")
    throw new Error("تعديل عقد الإهلاك يتطلب أصلًا نشطًا؛ الأصل المتخلص منه أو المشطوب أرشيف.");
  const revision: AssetContractRevision = Object.freeze({
    revision: asset.contractRevisions.length + 1,
    lifeMonths: input.lifeMonths,
    depreciationStartOn: input.depreciationStartOn,
    reason: input.reason.trim(),
    changedAt,
  });
  return Object.freeze({
    ...asset,
    lifeMonths: input.lifeMonths,
    depreciationStartOn: input.depreciationStartOn,
    contractRevisions: [...asset.contractRevisions, revision],
    updatedAt: changedAt,
  });
}

/** الإهلاك الشهري الأساسي: تقريب أرضي عبر floorRatio المشترَك حتى لا يتجاوز
 * التراكمي قيمة الشراء أبدًا (اتجاه الأرضية آمن ماليًا في الإهلاك). */
export function monthlyDepreciationMinor(asset: AssetRecord): number | null {
  if (asset.lifeMonths === null || asset.lifeMonths < 1) return null;
  return floorRatio(asset.acquisitionAmountMinor, asset.lifeMonths) ?? 0;
}

/** الأشهر الكاملة المنقضية بين تاريخين محليين — تُحسب باليوم لا بالشهر التقويمي فقط. */
export function fullMonthsElapsed(startOn: string, dateOn: string): number {
  const [startYear, startMonth, startDay] = startOn.split("-").map(Number);
  const [dateYear, dateMonth, dateDay] = dateOn.split("-").map(Number);
  let elapsed = (dateYear! - startYear!) * 12 + (dateMonth! - startMonth!);
  if (dateDay! < startDay!) elapsed -= 1;
  return Math.max(0, elapsed);
}

function monthKeyOf(dateOn: string): string {
  return dateOn.slice(0, 7);
}

/** أول شهر يكتمل فيه شهر إهلاك كامل (شهر البداية + شهر واحد). */
export function firstChargeMonth(asset: AssetRecord): string | null {
  if (!asset.depreciationStartOn) return null;
  const [year, month] = asset.depreciationStartOn.split("-").map(Number);
  const total = year! * 12 + (month! - 1) + 1;
  /* قسمة شهور لا مال: trunc يكفي ولا يمر بمساعدات المال (D-02). */
  const chargeYear = Math.trunc(total / 12);
  const chargeMonth = (total % 12) + 1;
  return `${chargeYear}-${String(chargeMonth).padStart(2, "0")}`;
}

/** تراكمي الجدول حتى تاريخه: الأشهر الكاملة × الشهري، والشهر الأخير يجمع الباقي ليصل التراكمي لقيمة الشراء بالضبط. */
export function scheduledAccumulatedMinor(asset: AssetRecord, asOf: string): number | null {
  const monthly = monthlyDepreciationMinor(asset);
  if (monthly === null || !asset.depreciationStartOn) return null;
  const elapsed = fullMonthsElapsed(asset.depreciationStartOn, asOf);
  if (asset.lifeMonths === null) return null;
  if (elapsed >= asset.lifeMonths) return asset.acquisitionAmountMinor;
  return elapsed * monthly;
}

/** الإهلاك المسجّل النشط: أحداث إهلاك قائمة غير معكوسة مرتبطة بالأصل. */
export function recordedDepreciationMinor(assetId: string, events: readonly FinancialEvent[]): number {
  return eventsForAsset(events, assetId)
    .filter(event => event.type === "asset_depreciation")
    .reduce((sum, event) => sum + event.amountMinor, 0);
}

/** ملخص أحداث الأصل النشطة: اقتناء وإهلاك وتخلص وشطب، والدفتري قراءة مشتقة. */
export function assetEventSummary(assetId: string, events: readonly FinancialEvent[]): AssetEventSummary {
  const active = eventsForAsset(events, assetId);
  let acquisitionMinor = 0;
  let depreciationMinor = 0;
  let disposalBookValueMinor = 0;
  let writeOffBookValueMinor = 0;
  for (const event of active) {
    if (event.type === "asset_purchase_cash" || event.type === "asset_purchase_payable")
      acquisitionMinor += event.amountMinor;
    else if (event.type === "asset_depreciation") depreciationMinor += event.amountMinor;
    else if (event.type === "asset_disposal_cash")
      disposalBookValueMinor += event.assetContext?.bookValueMinor ?? 0;
    else if (event.type === "asset_writeoff") writeOffBookValueMinor += event.amountMinor;
  }
  return {
    acquisitionMinor,
    depreciationMinor,
    disposalBookValueMinor,
    writeOffBookValueMinor,
    bookValueMinor: acquisitionMinor - depreciationMinor - disposalBookValueMinor - writeOffBookValueMinor,
  };
}

/** عرض الإهلاك المقترح حتى تاريخه: الجدول ناقص المسجّل — لا يُخصم شيء إلا بتسجيل صريح. */
export function planAssetDepreciation(
  asset: AssetRecord,
  events: readonly FinancialEvent[],
  asOf: string,
): AssetDepreciationProposal {
  assertLocalDate(asOf, "asOf");
  const recorded = recordedDepreciationMinor(asset.id, events);
  const monthly = monthlyDepreciationMinor(asset);
  const base = {
    assetId: asset.id,
    monthlyMinor: monthly,
    proposedMinor: 0,
    recordedMinor: recorded,
    scheduledMinor: 0,
    firstChargeMonth: firstChargeMonth(asset),
    remainingMonths: null as number | null,
    note: "",
  };
  if (asset.status !== "active")
    return { ...base, readiness: "retired", note: "أصل متخلص منه أو مشطوب — لا إهلاك بعده." };
  if (asset.lifeMonths === null)
    return {
      ...base,
      readiness: "unknown_life",
      note: "العمر النافع مجهول — لا جدول إهلاك حتى تُحدده بمراجعة موثقة.",
    };
  if (!asset.depreciationStartOn)
    return {
      ...base,
      readiness: "unknown_start",
      note: "بداية الاستخدام غير محددة — لا إهلاك حتى تُحدد بمراجعة موثقة.",
    };
  const scheduled = scheduledAccumulatedMinor(asset, asOf)!;
  const elapsed = fullMonthsElapsed(asset.depreciationStartOn, asOf);
  const remaining = Math.max(0, asset.lifeMonths - elapsed);
  if (scheduled <= recorded)
    return {
      ...base,
      scheduledMinor: scheduled,
      remainingMonths: remaining,
      readiness: "fully_depreciated",
      note:
        remaining === 0
          ? "استُهلك الجدول كاملًا — الدفتري صفر بمقتضى العقد."
          : "الإهلاك المسجل يغطي الجدول حتى تاريخه — لا مستحق جديد.",
    };
  return {
    ...base,
    readiness: "ready",
    scheduledMinor: scheduled,
    proposedMinor: scheduled - recorded,
    remainingMonths: remaining,
    note: "المستحق جدولةً لا يدخل الربح إلا بتسجيل صريح منك.",
  };
}

/** التخلص من أصل: يجب أن يكون نشطًا، والدفتري يُجمَّد لحظة الحدث. الفرق مقابل الدفتري ربح أو خسارة معلنة. */
export function prepareAssetDisposal(
  asset: AssetRecord,
  events: readonly FinancialEvent[],
  input: { on: string; proceedsMinor: number; reason: string },
): { bookValueMinor: number; gainLossMinor: number } {
  assertLocalDate(input.on, "on");
  assertPositiveMinor(input.proceedsMinor, "proceedsMinor");
  if (!input.reason.trim()) throw new Error("أكمل سبب التخلص من الأصل قبل الحفظ.");
  if (asset.status !== "active")
    throw new Error("التخلص يتطلب أصلًا نشطًا؛ هذا الأصل مؤرشف بتخلص أو شطب سابق.");
  const summary = assetEventSummary(asset.id, events);
  if (summary.bookValueMinor < 0) throw new Error("الرصيد الدفتري سالب — راجع سلامة الأصول قبل التخلص.");
  return {
    bookValueMinor: summary.bookValueMinor,
    gainLossMinor: input.proceedsMinor - summary.bookValueMinor,
  };
}

export function applyAssetDisposal(
  asset: AssetRecord,
  disposal: AssetDisposalRecord,
  updatedAt: string,
): AssetRecord {
  if (asset.status !== "active")
    throw new Error("التخلص يتطلب أصلًا نشطًا؛ هذا الأصل مؤرشف بتخلص أو شطب سابق.");
  assertNonNegativeInteger(disposal.bookValueMinor, "bookValueMinor");
  return Object.freeze({
    ...asset,
    status: "disposed",
    disposal: Object.freeze({ ...disposal }),
    updatedAt,
  });
}

/** الشطب: خسارة غير نقدية بالمبلغ الدفتري — لا كاش يدخل ولا يخرج. */
export function prepareAssetWriteOff(
  asset: AssetRecord,
  events: readonly FinancialEvent[],
  input: { on: string; reason: string },
): { bookValueMinor: number } {
  assertLocalDate(input.on, "on");
  if (!input.reason.trim()) throw new Error("أكمل سبب شطب الأصل قبل الحفظ.");
  if (asset.status !== "active")
    throw new Error("الشطب يتطلب أصلًا نشطًا؛ هذا الأصل مؤرشف بتخلص أو شطب سابق.");
  const summary = assetEventSummary(asset.id, events);
  if (summary.bookValueMinor <= 0) throw new Error("لا رصيد دفتري يُشطب — الأصل مستهلك دفتريًا بالكامل.");
  return { bookValueMinor: summary.bookValueMinor };
}

export function applyAssetWriteOff(
  asset: AssetRecord,
  writeOff: AssetWriteOffRecord,
  updatedAt: string,
): AssetRecord {
  if (asset.status !== "active")
    throw new Error("الشطب يتطلب أصلًا نشطًا؛ هذا الأصل مؤرشف بتخلص أو شطب سابق.");
  assertNonNegativeInteger(writeOff.bookValueMinor, "bookValueMinor");
  return Object.freeze({
    ...asset,
    status: "written_off",
    writeOff: Object.freeze({ ...writeOff }),
    updatedAt,
  });
}
