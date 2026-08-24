import { createCashContinuityEntry, createCashWallet, type CashWalletKind } from "@micro-domain/cash-continuity/index.js";
import { createInventoryMovement, createMaterial, type MaterialUnit } from "@micro-domain/inventory-material/index.js";
import { localProfileId, type ActivityProfile, type LocalStoreSnapshot, type PrototypeLocalStore } from "@/storage/local/types";

export const guidedOpeningImportFormat = "micro-guided-opening-import" as const;
export const guidedOpeningImportVersion = 1 as const;

type Knowledge = "known" | "estimated";
type Source = { source: string; knowledge: Knowledge; occurredOn: string; note: string };
export type GuidedOpeningImportFile = {
  format: typeof guidedOpeningImportFormat;
  version: typeof guidedOpeningImportVersion;
  importId: string;
  profile: Source & { activityName: string; currency: "JOD"; activityType: "custom_craft" };
  cashWallets: Array<Source & { id: string; name: string; kind: CashWalletKind; openingMinor: number }>;
  materials: Array<Source & { id: string; name: string; unit: MaterialUnit; openingQuantityMilli: number; openingValueMinor: number }>;
  openingNotes?: string;
};

export type GuidedOpeningImportSummary = { importId: string; acceptedWallets: number; acceptedMaterials: number; acceptedCashMinor: number; acceptedMaterialQuantityMilli: number; estimatedRecords: number; warnings: readonly string[] };
export type GuidedOpeningImportPreview = { file: GuidedOpeningImportFile; summary: GuidedOpeningImportSummary; snapshot: LocalStoreSnapshot };
export type GuidedOpeningImportResult<T> = { ok: true; value: T; reused?: boolean } | { ok: false; code: "validation_error" | "non_empty_store" | "storage_error"; message: string };

type GuidedOpeningImportErrorCode = "validation_error" | "non_empty_store" | "storage_error";
const fail = <T>(code: GuidedOpeningImportErrorCode, message: string): GuidedOpeningImportResult<T> => ({ ok: false, code, message });
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00.000Z`));
const isText = (value: unknown, min = 1, max = 240): value is string => typeof value === "string" && value.trim().length >= min && value.trim().length <= max;
const isInteger = (value: unknown, minimum = 0): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= minimum;
const walletKinds = new Set<CashWalletKind>(["cash_drawer", "bank_account", "digital_wallet", "other"]);
const materialUnits = new Set<MaterialUnit>(["piece", "meter", "kilogram", "liter", "other"]);

function isSource(value: unknown): boolean {
  return isRecord(value) && isText(value.source, 1, 120) && (value.knowledge === "known" || value.knowledge === "estimated") && isDate(value.occurredOn) && isText(value.note, 2, 240);
}

function parseFile(text: string, now: string): GuidedOpeningImportResult<GuidedOpeningImportFile> {
  let candidate: unknown;
  try { candidate = JSON.parse(text); } catch { return fail("validation_error", "الملف تالف أو ليس JSON صالحًا. بقيت بيانات هذا الجهاز دون تغيير."); }
  if (!isRecord(candidate) || candidate.format !== guidedOpeningImportFormat || candidate.version !== guidedOpeningImportVersion) return fail("validation_error", "نسخة الاستيراد الافتتاحي غير مدعومة. بقيت بيانات هذا الجهاز دون تغيير.");
  if (!isText(candidate.importId, 6, 120)) return fail("validation_error", "ينقص الملف معرّف استيراد واضح. بقيت بيانات هذا الجهاز دون تغيير.");
  const profile = candidate.profile;
  if (!isRecord(profile) || !isSource(profile) || !isText(profile.activityName, 2, 120) || profile.currency !== "JOD" || profile.activityType !== "custom_craft") return fail("validation_error", "بيانات النشاط الافتتاحية ناقصة أو غير مدعومة. بقيت بيانات هذا الجهاز دون تغيير.");
  if (!Array.isArray(candidate.cashWallets) || !Array.isArray(candidate.materials)) return fail("validation_error", "ينقص الملف قسم المحافظ أو المواد. بقيت بيانات هذا الجهاز دون تغيير.");
  const profileRecord = profile as Record<string, unknown>;
  const walletIds = new Set<string>();
  const cashWallets = candidate.cashWallets.map((value): GuidedOpeningImportFile["cashWallets"][number] => {
    const item = value as Record<string, unknown>;
    if (!isRecord(item) || !isSource(item) || !isText(item.id, 2, 120) || walletIds.has(item.id) || !isText(item.name, 2, 120) || !walletKinds.has(item.kind as CashWalletKind) || !isInteger(item.openingMinor)) throw new Error("بيانات محفظة الكاش الافتتاحية غير صالحة.");
    walletIds.add(item.id);
    return { ...item, id: item.id, name: item.name, kind: item.kind as CashWalletKind, openingMinor: item.openingMinor } as GuidedOpeningImportFile["cashWallets"][number];
  });
  const materialIds = new Set<string>();
  const materials = candidate.materials.map((value): GuidedOpeningImportFile["materials"][number] => {
    const item = value as Record<string, unknown>;
    if (!isRecord(item) || !isSource(item) || !isText(item.id, 2, 120) || materialIds.has(item.id) || !isText(item.name, 2, 120) || !materialUnits.has(item.unit as MaterialUnit) || !isInteger(item.openingQuantityMilli) || !isInteger(item.openingValueMinor) || ((item.openingQuantityMilli === 0) !== (item.openingValueMinor === 0))) throw new Error("بيانات المادة الافتتاحية تحتاج كمية وقيمة موجبتين معًا، أو صفرًا معًا.");
    materialIds.add(item.id);
    return { ...item, id: item.id, name: item.name, unit: item.unit as MaterialUnit, openingQuantityMilli: item.openingQuantityMilli, openingValueMinor: item.openingValueMinor } as GuidedOpeningImportFile["materials"][number];
  });
  if (cashWallets.length === 0 && materials.length === 0) return fail("validation_error", "يجب أن يحتوي الملف على موقف افتتاحي واحد على الأقل. بقيت بيانات هذا الجهاز دون تغيير.");
  if (candidate.openingNotes !== undefined && !isText(candidate.openingNotes, 2, 500)) return fail("validation_error", "ملاحظة المصدر الافتتاحي غير صالحة. بقيت بيانات هذا الجهاز دون تغيير.");
  void now;
  return { ok: true, value: { format: guidedOpeningImportFormat, version: guidedOpeningImportVersion, importId: candidate.importId, profile: profileRecord as GuidedOpeningImportFile["profile"], cashWallets, materials, ...(candidate.openingNotes === undefined ? {} : { openingNotes: candidate.openingNotes as string }) } };
}

const emptySnapshot = (snapshot: LocalStoreSnapshot): boolean => snapshot.profile === null && snapshot.drafts.length === 0 && snapshot.orders.length === 0 && snapshot.schedules.length === 0 && (snapshot.recurrences?.length ?? 0) === 0 && snapshot.financialEvents.length === 0 && (snapshot.supplierPurchases?.length ?? 0) === 0 && (snapshot.cashWallets?.length ?? 0) === 0 && (snapshot.cashContinuityEntries?.length ?? 0) === 0 && (snapshot.materials?.length ?? 0) === 0 && (snapshot.inventoryMovements?.length ?? 0) === 0 && (snapshot.catalogItems?.length ?? 0) === 0 && (snapshot.actualTimeRecords?.length ?? 0) === 0 && (snapshot.shortCashDeclarations?.length ?? 0) === 0;

export class GuidedOpeningImportService {
  constructor(private readonly store: PrototypeLocalStore, private readonly now: () => string = () => new Date().toISOString()) {}

  async prepare(text: string): Promise<GuidedOpeningImportResult<GuidedOpeningImportPreview>> {
    const current = await this.store.readSnapshot();
    if (!current.ok) return fail("storage_error", "تعذر قراءة الحالة المحلية للتحقق قبل الاستيراد.");
    const parsed = parseFile(text, this.now());
    if (!parsed.ok) return parsed;
    const file = parsed.value;
    const expectedKey = (kind: string, id: string) => `guided-opening:${file.importId}:${kind}:${id}`;
    const existingWallets = current.value.cashWallets ?? [];
    const existingMaterials = current.value.materials ?? [];
    const alreadyImported = existingWallets.some(wallet => wallet.createdOperationKey === expectedKey("wallet", file.cashWallets[0]?.id ?? "none")) || existingMaterials.some(material => material.createdOperationKey === expectedKey("material", file.materials[0]?.id ?? "none"));
    if (!emptySnapshot(current.value) && !alreadyImported) return fail("non_empty_store", "هذا الجهاز يحتوي بيانات محلية. صدّرها أولًا؛ لا يدمج الاستيراد الافتتاحي فوق سجل قائم.");
    if (alreadyImported) return { ok: true, value: { file, summary: this.summary(file), snapshot: current.value }, reused: true };
    try {
      const createdAt = this.now();
      const profile: ActivityProfile = { id: localProfileId, activityName: file.profile.activityName.trim(), currency: "JOD", activityType: "custom_craft", createdAt, updatedAt: createdAt };
      const cashWallets = file.cashWallets.map(input => createCashWallet({ id: `guided-${file.importId}-wallet-${input.id}`, name: input.name.trim(), kind: input.kind, createdAt, createdOperationKey: expectedKey("wallet", input.id) }));
      const cashContinuityEntries = file.cashWallets.filter(input => input.openingMinor > 0).map(input => createCashContinuityEntry({ id: `guided-${file.importId}-cash-${input.id}`, walletId: `guided-${file.importId}-wallet-${input.id}`, type: "opening_balance", occurredOn: input.occurredOn, recordedAt: createdAt, cashDeltaMinor: input.openingMinor, note: `${input.note.trim()} — المصدر: ${input.source.trim()} (${input.knowledge})`, operationKey: expectedKey("cash", input.id) }));
      const materials = file.materials.map(input => createMaterial({ id: `guided-${file.importId}-material-${input.id}`, name: input.name.trim(), unit: input.unit, createdAt, createdOperationKey: expectedKey("material", input.id) }));
      const inventoryMovements = file.materials.filter(input => input.openingQuantityMilli > 0).map(input => createInventoryMovement({ id: `guided-${file.importId}-inventory-${input.id}`, materialId: `guided-${file.importId}-material-${input.id}`, type: "opening", occurredOn: input.occurredOn, recordedAt: createdAt, quantityDeltaMilli: input.openingQuantityMilli, valueDeltaMinor: input.openingValueMinor, note: `${input.note.trim()} — المصدر: ${input.source.trim()} (${input.knowledge})`, operationKey: expectedKey("inventory", input.id) }));
      const snapshot: LocalStoreSnapshot = { profile, preferences: null, drafts: [], orders: [], schedules: [], recurrences: [], financialEvents: [], supplierPurchases: [], cashWallets, cashContinuityEntries, materials, inventoryMovements, catalogItems: [], actualTimeRecords: [], shortCashDeclarations: [] };
      return { ok: true, value: { file, summary: this.summary(file), snapshot } };
    } catch (error) { return fail("validation_error", error instanceof Error ? error.message : "بيانات الاستيراد الافتتاحي غير صالحة."); }
  }

  async confirm(preview: GuidedOpeningImportPreview): Promise<GuidedOpeningImportResult<GuidedOpeningImportSummary>> {
    const current = await this.store.readSnapshot();
    if (!current.ok) return fail("storage_error", "تعذر قراءة الحالة المحلية قبل تأكيد الاستيراد.");
    const alreadyImported = (current.value.cashWallets ?? []).some(wallet => wallet.createdOperationKey.includes(`guided-opening:${preview.file.importId}:`)) || (current.value.materials ?? []).some(material => material.createdOperationKey.includes(`guided-opening:${preview.file.importId}:`));
    if (alreadyImported) return { ok: true, value: preview.summary, reused: true };
    if (!emptySnapshot(current.value)) return fail("non_empty_store", "تغيرت الحالة المحلية منذ المعاينة. لم يُكتب شيء؛ صدّر البيانات أو أعد المعاينة على جهاز فارغ.");
    const saved = await this.store.replaceSnapshot(preview.snapshot);
    return saved.ok ? { ok: true, value: preview.summary } : fail("storage_error", "تعذر حفظ الاستيراد الافتتاحي كوحدة واحدة. بقيت بيانات هذا الجهاز دون تغيير.");
  }

  private summary(file: GuidedOpeningImportFile): GuidedOpeningImportSummary { return { importId: file.importId, acceptedWallets: file.cashWallets.length, acceptedMaterials: file.materials.length, acceptedCashMinor: file.cashWallets.reduce((sum, wallet) => sum + wallet.openingMinor, 0), acceptedMaterialQuantityMilli: file.materials.reduce((sum, material) => sum + material.openingQuantityMilli, 0), estimatedRecords: [...file.cashWallets, ...file.materials].filter(item => item.knowledge === "estimated").length, warnings: ["الاستيراد يثبت موقفًا افتتاحيًا فقط؛ لا يحول الكاش أو المخزون إلى مبيعات أو ربح أو تاريخ سابق."] }; }
}
