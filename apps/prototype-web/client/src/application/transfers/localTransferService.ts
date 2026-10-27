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
  type FormDraftEnvelope,
  type LocalExportCounts,
  type LocalExportFile,
  type LocalStoreSnapshot,
  type PrototypeLocalStore,
  type ReplacementCommandType,
  type RestoreRollbackRecord,
} from "@/storage/local/types";
import { syncSha256Hex } from "@/lib/syncSha256";
import { canonicalSnapshotDigest } from "@/storage/local/snapshotCanonicalization";
import {
  runProtectedReplacement,
  resolvePendingReplacementIntent,
  type ReplacementFailureCode,
  type VerifiedBackupBuilder,
} from "./replacementProtectionProtocol";
import { isDate, isRecord, normalizeImportedCategoryLabel } from "./transferFamilyValidators";
import { isCurrentPair, isReleasedLegacyPair, verifyTransferIntegrity } from "./transferEnvelope";
import { exportCountsOf, verifyTransferCounts } from "./transferCounters";
import { verifyTransferArrayFamilies } from "./transferArrayFamilyRoles";
import { migrateTransferSnapshot } from "./transferSnapshotMigrations";
import { validateSnapshot } from "./transferSnapshotValidation";
import {
  findUnknownTopLevelDataKey,
  W2B_UNKNOWN_TOP_LEVEL_DATA_KEY_MESSAGE,
} from "./transferTopLevelDataKeys";
import { STORAGE_ERROR, VALIDATION_ERROR, storageFailure } from "@/application/resultCodes";
import { systemClock, type Clock } from "@/application/time/clock";

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
  /* OPS-003 (عقد ٤١): عائلات المصروف المتكرر في ملخص النقل. */
  recurringExpenseSeries: number;
  recurringExpenseRevisions: number;
  recurringExpenseOccurrences: number;
  /* FIN-002 (عقد ٤٢): عائلة الميزانيات في ملخص النقل. */
  expenseBudgets: number;
  /* FIN-001 (WS-178 — Wave 6): عائلة القروض المستلمة في ملخص النقل. */
  receivedLoans: number;
  snapshots: number;
  events: number;
  exportedAt: string;
};
export type TransferPreview = { file: LocalExportFile; summary: TransferSummary };
/* S-2 (R11 W1b / D-10 — R10B-NF-012، قرار المالك OPAQUE_PREPARED_IMPORT):
 * عقد مصدر الاستيراد المُحضّر. `PreparedImport` نوع شفاف (phantom brand):
 * البصمة الرمزية معلنة ambient ولا وجود لها في زمن التشغيل إطلاقًا، والرمز
 * نفسه غير مصدّر فلا يستطيع مستهلك خارجي كتابتها في كائن حرفي. الكائن
 * يبقى `{ file, summary }` كما كان بالضبط؛ الفرق كله في زمن الترجمة:
 * `confirmImport` لا يقبل إلا قيمة خرجت من `prepareImport` — السكّة
 * الوحيدة التي تصبغ القيمة (cast واحد مُوثّق داخلها) — فيفشل تمرير كائن
 * عادي غير مُتحقق منه فشلَ ترجمة، وتُحفظ عقدود التحقق الأحادي والنسخة
 * الاحتياطية قبل الكتابة كما هي بلا أي تمرير تحقق ثانٍ. */
declare const preparedImportBrand: unique symbol;
export type PreparedImport = TransferPreview & { readonly [preparedImportBrand]: "minted-by-prepareImport" };
export type TransferResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: "validation_error" | "storage_error" | ReplacementFailureCode; message: string };
/* S02-A (SH-02 — عقد ٠٤٤ §16 والسجل المشترك §14): سياق نية الاستبدال المربوط
 * بالمراجعة — الجيل وبصمة الحالة الحية لحظة عرض المعاينة، وبصمة الحمولة
 * المُراجَعة نفسها؛ تغيّر أي منها قبل التأكيد يعيد المراجعة (stale_context)
 * ولا يستبدل عملًا أحدث أبدًا. `restoreFormDrafts` لمسار استرجاع النسخة
 * السابقة وحده: المسودات المعزولة تُعاد مع اللقطة القديمة داخل الحد. */
export type RestoreIntentContext = {
  commandType: ReplacementCommandType;
  expectedGeneration: number;
  expectedSnapshotDigest: string;
  payloadDigest: string;
  restoreFormDrafts?: readonly FormDraftEnvelope[];
};
/* الأمر المُراجَع المربوط — يُسكّ حصريًا داخل prepareRestore/prepareRollbackRestore
 * (بصمة السكّ نفسها تُنسخ بالبسط فلا حاجة لموضع سكّ جديد): confirmImport لا
 * يقبل سواه، فلا تأكيد بلا ربط مراجعة حي — فشل ترجمة لا فحص زمن تشغيل. */
export type BoundRestoreIntent = PreparedImport & { intent: RestoreIntentContext };
/* EXE-014 (DATA-001 / AUD-NEW-09): نتيجة الاستعادة الكاملة — الملخص نفسه
 * مع نسخة ما قبل الاستبدال القابلة للاسترجاع، مُنشأة بآلية التصدير المتحقق
 * نفسها قبل أي كتابة؛ تعذّرها يمنع التأكيد فلا يُوهم المستخدم بنجاح آمن. */
export type RestoreResult = TransferSummary & { backup: LocalExportFile };
const fail = <T>(message: string): TransferResult<T> => ({ ok: false, code: VALIDATION_ERROR, message });
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
    recurringExpenseSeries: file.data.recurringExpenseSeries?.length ?? 0,
    recurringExpenseRevisions: file.data.recurringExpenseRevisions?.length ?? 0,
    recurringExpenseOccurrences: file.data.recurringExpenseOccurrences?.length ?? 0,
    expenseBudgets: file.data.expenseBudgets?.length ?? 0,
    receivedLoans: file.data.receivedLoans?.length ?? 0,
    snapshots,
    events,
    exportedAt: file.exportedAt,
  };
}

const appVersion = appIdentity;

export class LocalTransferService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly now: Clock = systemClock,
  ) {}

  async createExport(): Promise<TransferResult<LocalExportFile>> {
    const snapshot = await this.store.readSnapshot();
    if (!snapshot.ok) return storageFailure("تعذر قراءة البيانات المحلية للتصدير. لم يُنشأ ملف.");
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

  prepareImport(text: string): TransferResult<PreparedImport> {
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
    /* R2 (M-03/D2، 2026-10-08): خط التحقق كله (بصمة/ترحيل/تحقق/عدادات)
     * محروس برمي مهيكل — أي رمي غير متوقع (مدقق على ملف مصنوع، فائض حسابي
     * في حصة المشروع المشتركة) يعود رفضًا صادقًا بقالب validation_error
     * بدل رسالة «تعذر قراءة الملف» المضللة من الالتقاط العام في الواجهة.
     * الرسالة الأصلية تُضمَّن للتشخيص لا للفرع التشغيلي (لا مستهلك يتفرع
     * على النص — مثبت بالجرد العدائي R2-MF-01 §7). */
    let migrated: unknown;
    try {
      const integrityError = verifyTransferIntegrity(candidate, isCurrent);
      if (integrityError !== null) return fail(integrityError);
      /* R10-B2/RC-1 (+NF-009): بوابة البنية الخام قبل الترحيل — الموجود من
       * كل عائلة مصفوفية يجب أن يكون مصفوفة (حاليًا وموروثًا)، وعائلات مال
       * المالك الأربع (والعائلات الصارمة) غيابها على الملف الحالي رفض. قبل
       * هذه البوابة كان الترحيل يسوّي كل قيمة معطوبة إلى [] فيمر الملف
       * المُعاد ختمه (بصمة وعدادات معاد حسابهما) وتُغسل العائلات المحذوفة
       * عند الاستبدال. الموروث يبقى اختياريًا-عند-الغياب كما كان. */
      const rawStructureError = verifyTransferArrayFamilies(candidate.data, isCurrent);
      if (rawStructureError !== null) return fail(rawStructureError);
      migrated = migrateTransferSnapshot(candidate.data, isCurrent);
      if (!validateSnapshot(migrated))
        return fail("الملف ناقص أو لا يطابق بنية Micro المطلوبة. بقيت بيانات هذا الجهاز دون تغيير.");
      const countsError = verifyTransferCounts(candidate, migrated, isCurrent);
      if (countsError !== null) return fail(countsError);
    } catch (error) {
      const detail = error instanceof Error ? ` (${error.message})` : "";
      return fail(
        `الملف لا يطابق بنية Micro المطلوبة فتعذر التحقق منه${detail}. بقيت بيانات هذا الجهاز دون تغيير.`,
      );
    }
    /* R11 W2b / OD-KEYS — W2-2 (تفعيل 2026-10-16 بالحمولة المعتمدة حرفيًا):
     * رفض مفاتيح data العلوية المجهولة للزوج الحالي وحده — الموضع بعد بوابة
     * العدادات حصرًا هو الموضع الوحيد الذي أثبت توصيف W2a أنه لا يعيد ترتيب
     * أي من الرفوضات السبع القائمة (مصفوفة الأعطال السبعة). الإرث (الأزواج
     * الـ24) لا يُفحص أصلًا؛ لا صدى لاسم المفتاح؛ والرفض قبل أي كتابة.
     * الحمولة: رمز validation_error (الثابت الكنوني عبر fail) + النص العربي
     * الدقيق في transferTopLevelDataKeys.ts (ملحق الاعتماد append-only). */
    if (isCurrent) {
      const unknownDataKey = findUnknownTopLevelDataKey(candidate.data);
      if (unknownDataKey !== null) return fail(W2B_UNKNOWN_TOP_LEVEL_DATA_KEY_MESSAGE);
    }
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
    /* السكّة الوحيدة للسكّ (S-2): هذا الـcast إلى النوع الموسوم هو نقطة الختم
     * الوحيدة في الإنتاج — ممنوع أي cast آخر إلى النوع نفسه خارج prepareImport
     * (يُحرس باختبار مسح المصدر في preparedImport.provenance.test.ts). */
    return { ok: true, value: { file, summary: summary(file) } as PreparedImport };
  }

  async confirmImport(preview: BoundRestoreIntent): Promise<TransferResult<RestoreResult>> {
    /* S02-A (SH-03): الاستبدال المحروس — النسخة الرجوع الدائمة المُتحقق منها
     * تُنشأ داخل البروتوكول قبل أي كتابة (لا قيمة في الذاكرة بعد اليوم)،
     * والنية والسياج والجيل والمآل والإيصال كلها داخل الحد نفسه. تعذّر
     * الحماية يمنع التأكيد ولا يُوهم المستخدم بنجاح آمن. */
    const outcome = await runProtectedReplacement(
      this.store,
      this.now,
      {
        commandType: preview.intent.commandType,
        payload: preview.file.data,
        payloadDigest: preview.intent.payloadDigest,
        summaryJson: JSON.stringify(preview.summary),
        binding: {
          kind: "prepared",
          expectedGeneration: preview.intent.expectedGeneration,
          expectedSnapshotDigest: preview.intent.expectedSnapshotDigest,
        },
        ...(preview.intent.restoreFormDrafts !== undefined
          ? { restoreFormDrafts: preview.intent.restoreFormDrafts }
          : {}),
      },
      LocalTransferService.verifiedBackupBuilder(this),
    );
    if (outcome.status === "replayed") {
      /* نفس الأمر والحمولة بعد إيصال ملتزم (أو نية حُسمت التزامًا) — نتيجة
       * الأصل تعاد بلا أثر ثانٍ (SDF-037/042). */
      let originalSummary: TransferSummary;
      try {
        originalSummary = JSON.parse(outcome.summaryJson) as TransferSummary;
      } catch {
        return {
          ok: false,
          code: "storage_error",
          message: "تعذر قراءة نتيجة الأمر الأصلية من سجل الحماية — لم يُكتب شيء؛ أعد المحاولة.",
        };
      }
      return { ok: true, value: { ...originalSummary, backup: outcome.backup } };
    }
    if (outcome.status === "committed") {
      return { ok: true, value: { ...preview.summary, backup: outcome.backup } };
    }
    return { ok: false, code: outcome.code, message: outcome.message };
  }

  /* S02-A: تجهيز استعادة مربوط بالمراجعة — المعاينة تُربط بالجيل وبصمة الحالة
   * الحية لحظة عرضها؛ التأكيد لا يقبل إلا أمرًا مربوطًا، وتغيّر البيانات
   * بعده يعيد المراجعة. أي نية قائمة من محاولة منهارة تُحسم هنا أولًا. */
  async prepareRestore(text: string): Promise<TransferResult<BoundRestoreIntent>> {
    const prepared = this.prepareImport(text);
    if (!prepared.ok) return prepared;
    return this.bindRestoreIntent(prepared.value, "restore");
  }

  /* S02-A (عقد ٠٤٤ B4.4): تجهيز استرجاع النسخة السابقة الدائمة — من قاعدة
   * الحماية نفسها لا من حالة واجهة، فيصمد بعد الإغلاق وإعادة التحميل؛
   * معاينته وتأكيده وحماية الحالي الذي سيُستبدل بنفس خدمة الاستعادة. */
  async prepareRollbackRestore(): Promise<TransferResult<BoundRestoreIntent>> {
    const protection = await this.store.readRestoreProtection();
    if (!protection.ok) return storageFailure(protection.message);
    if (protection.value.intent !== null) {
      const resolution = await resolvePendingReplacementIntent(this.store, this.now, protection.value);
      if (resolution.status === "error")
        return { ok: false, code: resolution.code, message: resolution.message };
      if (resolution.status === "unresolved")
        return { ok: false, code: "outcome_unknown", message: resolution.message };
    }
    const afterResolution = await this.store.readRestoreProtection();
    if (!afterResolution.ok) return storageFailure(afterResolution.message);
    const rollback = afterResolution.value.activeRollback;
    if (rollback === null)
      return {
        ok: false,
        code: "validation_error",
        message: "لا توجد نسخة سابقة محفوظة على هذا الجهاز بعد — لا ما يُسترجع.",
      };
    const prepared = this.prepareImport(JSON.stringify(rollback.file));
    if (!prepared.ok) return prepared;
    return this.bindRestoreIntent(prepared.value, "rollback-restore", rollback.drafts);
  }

  private async bindRestoreIntent(
    prepared: PreparedImport,
    commandType: ReplacementCommandType,
    restoreFormDrafts?: readonly FormDraftEnvelope[],
  ): Promise<TransferResult<BoundRestoreIntent>> {
    const live = await this.store.readSnapshot();
    if (!live.ok) return storageFailure(live.message);
    const protection = await this.store.readRestoreProtection();
    if (!protection.ok) return storageFailure(protection.message);
    return {
      ok: true,
      value: {
        ...prepared,
        intent: {
          commandType,
          expectedGeneration: protection.value.generation,
          expectedSnapshotDigest: canonicalSnapshotDigest(live.value),
          payloadDigest: canonicalSnapshotDigest(prepared.file.data),
          ...(restoreFormDrafts !== undefined ? { restoreFormDrafts } : {}),
        },
      },
    };
  }

  /* S02-A: حالة حماية الاستبدال للواجهة — النسخة السابقة الدائمة (تُقرأ من
   * القاعدة فتصمد بعد إعادة التحميل) وأي نية غير محسومة تُعرض بصدق. */
  async readRestoreStatus(): Promise<
    TransferResult<{ generation: number; rollbackCreatedAt: string | null; unresolvedIntent: boolean }>
  > {
    let protection = await this.store.readRestoreProtection();
    if (!protection.ok) return storageFailure(protection.message);
    if (protection.value.intent !== null) {
      const resolution = await resolvePendingReplacementIntent(this.store, this.now, protection.value);
      if (resolution.status === "error")
        return { ok: false, code: resolution.code, message: resolution.message };
      protection = await this.store.readRestoreProtection();
      if (!protection.ok) return storageFailure(protection.message);
    }
    return {
      ok: true,
      value: {
        generation: protection.value.generation,
        rollbackCreatedAt: protection.value.activeRollback?.createdAt ?? null,
        unresolvedIntent: protection.value.intent !== null,
      },
    };
  }

  /* S02-A: النسخة السابقة الدائمة نفسها (ملف + مسودات معزولة) — للتنزيل
   * اليدوي من الواجهة؛ قراءة خالصة بلا أي أثر. */
  async readActiveRollback(): Promise<TransferResult<RestoreRollbackRecord | null>> {
    const protection = await this.store.readRestoreProtection();
    if (!protection.ok) return storageFailure(protection.message);
    return { ok: true, value: protection.value.activeRollback };
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
        code: VALIDATION_ERROR,
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
      /* OPS-003 (عقد ٤١): لا سلاسل ولا مراجعات ولا فترات في اللقطة الفارغة. */
      recurringExpenseSeries: [],
      recurringExpenseRevisions: [],
      recurringExpenseOccurrences: [],
      /* FIN-002 (عقد ٤٢): لا ميزانيات في اللقطة الفارغة — «ابدأ من جديد» لا يخترع خطة. */
      expenseBudgets: [],
      /* FIN-001 (WS-178 — Wave 6): لا قروض مستلمة في اللقطة الفارغة — «ابدأ
       * من جديد» لا يخترع التزامًا ولا تاريخًا. */
      receivedLoans: [],
    };
  }

  /** «ابدأ من جديد»: استبدال ذرّي محروس بلقطة فارغة — النسخة الرجوع الدائمة
   * والنية والسياج والجيل كلها داخل حد البروتوكول نفسه؛ لا يمس أي بيانات
   * قبل نجاح المعاملة، ومسودات النماذج تُمسح في الحد ذاته لا بعده. */
  async resetAll(): Promise<TransferResult<null>> {
    const empty = LocalTransferService.emptySnapshot();
    const outcome = await runProtectedReplacement(
      this.store,
      this.now,
      {
        commandType: "reset",
        payload: empty,
        payloadDigest: canonicalSnapshotDigest(empty),
        summaryJson: JSON.stringify({ commandType: "reset" }),
        binding: { kind: "at-call" },
      },
      LocalTransferService.verifiedBackupBuilder(this),
    );
    if (outcome.status === "blocked") {
      /* رسالة التصفير الصادقة الخاصة به — المآل نفسه من البروتوكول. */
      const message =
        outcome.code === "storage_error"
          ? "تعذر بدء مشروع جديد؛ بياناتك الحالية كما هي دون تغيير."
          : outcome.message;
      return { ok: false, code: outcome.code, message };
    }
    return { ok: true, value: null };
  }

  /* S02-A: باني النسخة الرجوع المُتحقق منها — التحقق الدائري الكامل من أدوات
   * الخدمة نفسها؛ يُمرَّر للبروتوكول (وللإدخال الافتتاحي من جذر التركيب). */
  static verifiedBackupBuilder(service: LocalTransferService): VerifiedBackupBuilder {
    return async () => {
      const verified = await service.createVerifiedExport();
      if (!verified.ok) return { ok: false, code: verified.code, message: verified.message };
      return { ok: true, file: verified.value.file };
    };
  }
}

/* المجموعة ٥ (عقد ٣٩): عدادات مظروف النسخة ٢٧ — من اللقطة نفسها قبل أي ترحيل،
 * فتُقارن عند الاستيراد بعدد السجلات المهاجرة فتكشف تغيّرًا أو نقصًا صامتًا. */
