/** Slice 5 transfer boundary: parse and validate first; only an explicit confirmation may replace local IndexedDB state. */
import { calculateSharedProjectShareMinor } from "@micro-domain/financial-event/index.js";
import { appIdentity } from "@/application/identity/buildIdentity";
import { isValidAllocationPolicy, type AllocationPolicy } from "@micro-domain/recurring-margin/index.js";
/* المجموعة ٩ (STR-030): محقق سياق الهدر من مالكه الكنسي (صاحب حركة
 * الهدر) — الاستيراد كان عبر recurring-margin لإعادة التصدير فقط. */
import { isValidWasteContext } from "@micro-domain/inventory-material/index.js";
import {
  isValidOwnerEntitlementOpeningBalance,
  isValidOwnerEntitlementPolicy,
  isValidOwnerEntitlementRecord,
  isValidOwnerMovement,
  type OwnerEntitlementOpeningBalance,
  type OwnerEntitlementPolicy,
  type OwnerEntitlementRecord,
  type OwnerMovement,
} from "@micro-domain/owner-entitlement/index.js";
import type { DirectSale } from "@micro-domain/direct-sale/index.js";
import {
  localExportFormat,
  localExportVersion,
  localInventoryActivationId,
  localOwnerProfileId,
  localProfileId,
  localSchemaVersion,
  type LocalExportCounts,
  type LocalExportFile,
  type LocalStoreSnapshot,
  type PrototypeLocalStore,
} from "@/storage/local/types";
import { syncSha256Hex } from "@/lib/syncSha256";
import { isDate, isRecord, normalizeImportedCategoryLabel } from "./transferFamilyValidators";
import { isCurrentPair, isReleasedLegacyPair, verifyTransferIntegrity } from "./transferEnvelope";
import { exportCountsOf, verifyTransferCounts } from "./transferCounters";
import { migrateTransferSnapshot } from "./transferSnapshotMigrations";
import { validateSnapshot } from "./transferSnapshotValidation";

export type TransferSummary = {
  profile: boolean;
  ownerProfile: boolean;
  preferences: boolean;
  drafts: number;
  orders: number;
  directSales: number;
  schedules: number;
  recurrences: number;
  financialEvents: number;
  supplierPurchases: number;
  cashWallets: number;
  cashContinuityEntries: number;
  materials: number;
  inventoryMovements: number;
  /* المجموعة ٢ (عقد ٢٨): سجلات النقص جزء الملخص — كشف لا يُسقط. */
  inventoryShortages: number;
  catalogItems: number;
  measurementUnits: number;
  directConversions: number;
  catalogTemplates: number;
  actualTimeRecords: number;
  shortCashDeclarations: number;
  ownerEntitlementPolicies: number;
  ownerEntitlementRecords: number;
  ownerEntitlementOpeningBalances: number;
  ownerMovements: number;
  allocationPolicies: number;
  costEstimates: number;
  /* المجموعة ٤ (عقد ٢٩): سجلات الأصول والقروض في ملخص النقل. */
  assets: number;
  loans: number;
  snapshots: number;
  events: number;
  exportedAt: string;
};
export type TransferPreview = { file: LocalExportFile; summary: TransferSummary };
export type TransferResult<T> =
  { ok: true; value: T } | { ok: false; code: "validation_error" | "storage_error"; message: string };
const fail = <T>(message: string): TransferResult<T> => ({ ok: false, code: "validation_error", message });
function summary(file: LocalExportFile): TransferSummary {
  const snapshots =
    file.data.drafts.reduce((count, draft) => count + draft.costSnapshots.length, 0) +
    file.data.orders.reduce((count, stored) => count + stored.order.costSnapshots.length, 0);
  const events = file.data.orders.reduce((count, stored) => count + stored.order.events.length, 0);
  return {
    profile: file.data.profile !== null,
    ownerProfile: file.data.ownerProfile != null,
    preferences: file.data.preferences !== null,
    drafts: file.data.drafts.length,
    orders: file.data.orders.length,
    directSales: file.data.directSales?.length ?? 0,
    schedules: file.data.schedules.length,
    recurrences: file.data.recurrences?.length ?? 0,
    financialEvents: file.data.financialEvents.length,
    supplierPurchases: file.data.supplierPurchases?.length ?? 0,
    cashWallets: file.data.cashWallets?.length ?? 0,
    cashContinuityEntries: file.data.cashContinuityEntries?.length ?? 0,
    materials: file.data.materials?.length ?? 0,
    inventoryMovements: file.data.inventoryMovements?.length ?? 0,
    inventoryShortages: file.data.inventoryShortages?.length ?? 0,
    catalogItems: file.data.catalogItems?.length ?? 0,
    measurementUnits: file.data.measurementUnits?.length ?? 0,
    directConversions: file.data.directConversions?.length ?? 0,
    catalogTemplates: file.data.catalogTemplates?.length ?? 0,
    actualTimeRecords: file.data.actualTimeRecords?.length ?? 0,
    shortCashDeclarations: file.data.shortCashDeclarations?.length ?? 0,
    ownerEntitlementPolicies: file.data.ownerEntitlementPolicies?.length ?? 0,
    ownerEntitlementRecords: file.data.ownerEntitlementRecords?.length ?? 0,
    ownerEntitlementOpeningBalances: file.data.ownerEntitlementOpeningBalances?.length ?? 0,
    ownerMovements: file.data.ownerMovements?.length ?? 0,
    allocationPolicies: file.data.allocationPolicies?.length ?? 0,
    costEstimates: file.data.costEstimates?.length ?? 0,
    assets: file.data.assets?.length ?? 0,
    loans: file.data.loans?.length ?? 0,
    snapshots,
    events,
    exportedAt: file.exportedAt,
  };
}

const appVersion = appIdentity;

export class LocalTransferService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async createExport(): Promise<TransferResult<LocalExportFile>> {
    const snapshot = await this.store.readSnapshot();
    if (!snapshot.ok)
      return {
        ok: false,
        code: "storage_error",
        message: "تعذر قراءة البيانات المحلية للتصدير. لم يُنشأ ملف.",
      };
    /* المجموعة ٥ (عقد ٣٩ — مظروف النسخة ٢٧): بصمة تكامل وعدادات مضمّنة
     * وإصدار تطبيق — كلها اختيارية للقارئ فتبقى الملفات القديمة مقبولة. */
    return {
      ok: true,
      value: {
        format: localExportFormat,
        version: localExportVersion,
        schemaVersion: localSchemaVersion,
        exportedAt: this.now(),
        data: snapshot.value,
        integrity: {
          algorithm: "sha256" as const,
          digest: syncSha256Hex(JSON.stringify(snapshot.value)),
        },
        counts: exportCountsOf(snapshot.value),
        /* المجموعة ٥ (التحصين الكامل): هوية بناء حقيقية من المصدر
         * المشترك (بايئة التشخيص وبيانات التصدير) — لا ثابت إنشائي بعد
         * اليوم؛ والبائع القديم يعثر في الاختبارات والتطوير المحلي. */
        appVersion,
      },
    };
  }

  prepareImport(text: string): TransferResult<TransferPreview> {
    let candidate: unknown;
    try {
      candidate = JSON.parse(text);
    } catch {
      return fail("الملف ليس ملف نسخة صالحًا. بقيت بيانات هذا الجهاز دون تغيير.");
    }
    if (!isRecord(candidate) || candidate.format !== localExportFormat)
      return fail("هذا ليس ملف تصدير Micro المحلي. بقيت بيانات هذا الجهاز دون تغيير.");
    /* المجموعة ١٠ (المرحلة 10-د): بوابات المظروف والعدادات والترحيل في
     * وحداتها الداخلية — نفس المفاتيح والرسائل وترتيب الرفض، بلا أي تغيير. */
    const isCurrent = isCurrentPair(candidate);
    const isLegacyPair = isReleasedLegacyPair(candidate);
    if (!isCurrent && !isLegacyPair)
      return fail("إصدار الملف غير مدعوم في هذا الإصدار من التطبيق؛ بقيت بيانات هذا الجهاز دون تغيير.");
    if (!isDate(candidate.exportedAt) || !isRecord(candidate.data))
      return fail("الملف ناقص أو لا يطابق بنية Micro المطلوبة. بقيت بيانات هذا الجهاز دون تغيير.");
    const integrityError = verifyTransferIntegrity(candidate, isCurrent);
    if (integrityError !== null) return fail(integrityError);
    const migrated = migrateTransferSnapshot(candidate.data, isCurrent);
    if (!validateSnapshot(migrated))
      return fail("الملف ناقص أو لا يطابق بنية Micro المطلوبة. بقيت بيانات هذا الجهاز دون تغيير.");
    const countsError = verifyTransferCounts(candidate, migrated, isCurrent);
    if (countsError !== null) return fail(countsError);
    const file: LocalExportFile = {
      format: localExportFormat,
      version: localExportVersion,
      schemaVersion: localSchemaVersion,
      exportedAt: candidate.exportedAt,
      data: migrated,
      ...(isRecord(candidate.integrity)
        ? { integrity: { algorithm: "sha256" as const, digest: syncSha256Hex(JSON.stringify(migrated)) } }
        : {}),
      /* العدادات تُعاد من البيانات المُرحَّلة نفسها — مطابقة النوع دومًا
       * وصادقة على الملف الخارج مهما كان مصدر الملف الداخل. */
      ...(isRecord(candidate.counts) ? { counts: exportCountsOf(migrated) } : {}),
      ...(typeof candidate.appVersion === "string" ? { appVersion: candidate.appVersion } : {}),
    };
    return { ok: true, value: { file, summary: summary(file) } };
  }

  async confirmImport(preview: TransferPreview): Promise<TransferResult<TransferSummary>> {
    const replacement = await this.store.replaceSnapshot(preview.file.data);
    if (!replacement.ok)
      return {
        ok: false,
        code: "storage_error",
        message: "تعذر استبدال البيانات المحلية. لم يتم تأكيد نجاح الاستيراد.",
      };
    return { ok: true, value: preview.summary };
  }

  /** نسخة مُتحقق منها (P-01): يُعاد تحليل الملف دورة كاملة قبل إعلان جهوزيته. */
  async createVerifiedExport(): Promise<TransferResult<{ file: LocalExportFile; summary: TransferSummary }>> {
    const created = await this.createExport();
    if (!created.ok) return created;
    const serialized = JSON.stringify(created.value, null, 2);
    const roundTrip = this.prepareImport(serialized);
    if (!roundTrip.ok)
      return {
        ok: false,
        code: "validation_error",
        message:
          "أنشئ الملف لكن التحقق منه فشل؛ لا تعتمد عليه نسخة احتياطية. أنشئ نسخة جديدة قبل أي خطوة مدمّرة.",
      };
    return { ok: true, value: { file: roundTrip.value.file, summary: roundTrip.value.summary } };
  }

  /** لقطة فارغة معلنة — تُستخدم حصرًا من بوابة «ابدأ من جديد» بعد نسخة مُتحقق منها. */
  static emptySnapshot(): LocalStoreSnapshot {
    return {
      profile: null,
      ownerProfile: null,
      preferences: null,
      drafts: [],
      orders: [],
      directSales: [],
      schedules: [],
      recurrences: [],
      financialEvents: [],
      supplierPurchases: [],
      cashWallets: [],
      cashContinuityEntries: [],
      materials: [],
      inventoryMovements: [],
      /* المجموعة ٢ (عقد ٢٨): لقطة فارغة شاملة — لا نقص قديم ينجو من «ابدأ من جديد». */
      inventoryShortages: [],
      inventoryActivation: null,
      catalogItems: [],
      measurementUnits: [],
      directConversions: [],
      catalogTemplates: [],
      actualTimeRecords: [],
      shortCashDeclarations: [],
      ownerEntitlementPolicies: [],
      ownerEntitlementRecords: [],
      ownerEntitlementOpeningBalances: [],
      ownerMovements: [],
      allocationPolicies: [],
      costEstimates: [],
      /* المجموعة ٤ (عقد ٢٩): لا أصول ولا قروض في اللقطة الفارغة. */
      assets: [],
      loans: [],
    };
  }

  /** «ابدأ من جديد»: استبدال ذرّي بلقطة فارغة — لا يمس أي بيانات قبل نجاح المعاملة. */
  async resetAll(): Promise<TransferResult<null>> {
    const replacement = await this.store.replaceSnapshot(LocalTransferService.emptySnapshot());
    if (!replacement.ok)
      return {
        ok: false,
        code: "storage_error",
        message: "تعذر بدء مشروع جديد؛ بياناتك الحالية كما هي دون تغيير.",
      };
    return { ok: true, value: null };
  }
}

/* المجموعة ٥ (عقد ٣٩): عدادات مظروف النسخة ٢٧ — من اللقطة نفسها قبل أي ترحيل،
 * فتُقارن عند الاستيراد بعدد السجلات المهاجرة فتكشف تغيّرًا أو نقصًا صامتًا. */
