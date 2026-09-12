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

/* المجموعة ٢ (التحصين الكامل — HIGH-002): سجل أزواج الإصدار التي صدرت فعلًا
 * (نسخة التصدير/مخطط التخزين) — مصدر وحيد لبوابة القبول. أزواج المخطط ٢١–٢٥
 * وأزواج ما قبل ٦/١٤ صدرت قبل حد القبول الحالي فتبقى مرفوضة عمدًا. الزوج
 * ٨/١۷ صدر مع الالتزام 570eba1 في 2026-08-23 ويُقبل منذ هذه المجموعة بمفاتيحه
 * الحرفية. أسباب الأزواج موثقة في تاريخ المستودع (تصعيد المخطط مع كل موجة). */
const RELEASED_LEGACY_EXPORT_PAIRS: ReadonlySet<string> = new Set([
  "26/34", // المجموعة ٤ كما صدرت فعلًا (بلا مظروف التكامل)
  "25/33", // المجموعة ٤ قبل الأصول والقروض
  "24/32", // ربط المنتج بالبيع
  "23/31", // مخزون انتقائي
  "22/30", // تصنيفي للمصاريف
  "21/29", // ملف المالك — سابقًا
  "20/28", // موجة إعادة التدفق
  "19/27", // القرار ٩: بلا سجل تفعيل المخزون
  "18/27", // S5-05: حملت مخطط ٢٧ حرفيًا (زوج صدر فعلًا)
  "17/26", // تصعيد الكتالوج الأساسي (دمج G3–G5)
  "16/25", // توسيع G4b
  "15/24", // الجسر
  "14/23", // نواة الكتالوج (O1)
  "13/22", // O1 — أرصدة حق المالك
  "12/21", // O1 — سياسات حق المالك
  "11/20", // G3
  "10/19", // G5 — التصريحات
  "9/18", // G4 — الوقت الفعلي
  "8/17", // D-1: زوج الالتزام 570eba1 — محتمل الاستخدام الميداني
  "7/15", // G3 الحالي — إرث
  "6/14", // G3 إرث
]);

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
    const isCurrent =
      candidate.version === localExportVersion && candidate.schemaVersion === localSchemaVersion;
    /* المجموعة ٢ (التحصين الكامل — HIGH-002): مصدر واحد للحقيقة لأزواج الإصدار
     * التي صدرت فعلًا — الزوج (نسخة التصدير/مخطط التخزين) يُقبل بمفاتيحه
     * الحرفية لا بمقارنة الثابت الحي (S5-05)، وكل زوج هنا موثق بإصداره الذي
     * صدر معه. زوج ٨/١٧ صدر مع الالتزام 570eba1 (2026-08-23) ويُعامل كمحتمل
     * الاستخدام الميداني (D-1): يُقبل بمفاتيحه الحرفية، والحجب الوحيد يبقى
     * للتحقق الصارم نفسه الذي يمر به كل زوج — لا تخفيف لأجل القبول. */
    const isReleasedLegacyPair =
      typeof candidate.version === "number" &&
      typeof candidate.schemaVersion === "number" &&
      /* المفتاح بدمج نصي لا قالب محرف — أدوات قياس الكثافة تُقرأ القوالب
       * المفروقة عبر مَثْلَب داخل الاستيفاء فتنزاح المطابقة؛ الدمج أبسط
       * وأصدق هنا ولا يغير الدلالة شيئًا. */
      RELEASED_LEGACY_EXPORT_PAIRS.has(candidate.version + "/" + candidate.schemaVersion);
    if (!isCurrent && !isReleasedLegacyPair)
      return fail("إصدار الملف غير مدعوم في هذا الإصدار من التطبيق؛ بقيت بيانات هذا الجهاز دون تغيير.");
    if (!isDate(candidate.exportedAt) || !isRecord(candidate.data))
      return fail("الملف ناقص أو لا يطابق بنية Micro المطلوبة. بقيت بيانات هذا الجهاز دون تغيير.");
    /* المجموعة ٥ (عقد ٣٩): تحقق التكامل عند وجود البصمة — تلاعب الملف بعد
     * إنشائه يُرفض قبل أي معاينة؛ غياب البصمة (ملف قديم) يعني المسار القائم.
     * المجموعة ٦ (تدقيق A1 — DP-09): البصمة الحاضرة لكن معطوبة البنية (خوارزمية
     * مجهولة أو قيمة غير سلسلة) تُرفض بدل تجاهلها صامتًا — ملف الإصدار الحالي
     * يُنشأ دائمًا ببصمة سليمة فلا مسار مشروع لبصمة معطوبة. */
    if (isRecord(candidate.integrity)) {
      const algorithm = candidate.integrity["algorithm"];
      const digest = candidate.integrity["digest"];
      if (algorithm !== "sha256" || typeof digest !== "string")
        return fail(
          "كتلة التكامل في الملف معطوبة (خوارزمية أو بصمة غير صالحة)؛ لا يمكن الاعتماد عليه. بقيت بيانات هذا الجهاز دون تغيير.",
        );
      if (syncSha256Hex(JSON.stringify(candidate.data)) !== digest)
        return fail(
          "تُغيّر الملف بعد إنشائه فبصمة التكامل لا تطابقه؛ لا تعتمد عليه. بقيت بيانات هذا الجهاز دون تغيير.",
        );
    } else if (isCurrent) {
      /* عقد الإغلاق العميق (AV-04 — تلاعب المظروف): ملف الإصدار الحالي يُنشأ
       * دومًا ببصمة تكامل وعدادات — حذفهما من ملف حالٍ تلاعبٌ يتخطى الفحصين؛ يُرفض كما تُرفض البصمة المعطوبة. الملفات القديمة (قبل
       * المظروف) على مسارها الموروث. */
      return fail(
        "ملف الإصدار الحالي بلا بصمة تكامل — يبدو أن الملف فُتح وعُدّل وحُذف مظروف التحقق منه؛ لا يعتمد عليه. بقيت بيانات هذا الجهاز دون تغيير.",
      );
    }
    const raw = candidate.data;
    const migrated: LocalStoreSnapshot = {
      ...raw,
      ownerProfile: raw.ownerProfile ?? null,
      drafts: Array.isArray(raw.drafts)
        ? raw.drafts.map(draft =>
            isRecord(draft) ? { ...draft, catalogItemId: draft.catalogItemId ?? null } : draft,
          )
        : [],
      orders: Array.isArray(raw.orders)
        ? raw.orders.map(order =>
            isRecord(order)
              ? {
                  ...order,
                  catalogItemId: order.catalogItemId ?? null,
                  followUpSummary: order.followUpSummary ?? null,
                  followUpDate: order.followUpDate ?? null,
                  followUpReason: order.followUpReason ?? null,
                  followUpEvents: Array.isArray(order.followUpEvents) ? order.followUpEvents : [],
                }
              : order,
          )
        : [],
      directSales: Array.isArray(raw.directSales)
        ? raw.directSales.map(sale =>
            isRecord(sale)
              ? {
                  ...sale,
                  status: sale.status ?? "active",
                  cancelledAt: sale.cancelledAt ?? null,
                  cancellationReason: sale.cancellationReason ?? null,
                  revisions: Array.isArray(sale.revisions) ? sale.revisions : [],
                }
              : sale,
          )
        : [],
      schedules: Array.isArray(raw.schedules)
        ? raw.schedules.map(schedule =>
            isRecord(schedule)
              ? {
                  ...schedule,
                  recurrenceId: schedule.recurrenceId ?? null,
                  recurrenceIndex: schedule.recurrenceIndex ?? null,
                }
              : schedule,
          )
        : [],
      recurrences: Array.isArray(raw.recurrences) ? raw.recurrences : [],
      financialEvents: Array.isArray(raw.financialEvents)
        ? raw.financialEvents.map(event =>
            isRecord(event)
              ? {
                  ...event,
                  amanahDeltaMinor: event.amanahDeltaMinor ?? 0,
                  /* المجموعة ٤ (عقد ٢٩): أعمدة الطبقات الجديدة — القديم يقرأ صفرًا
                   * كسابقة الأمانات؛ لا اختراع أصول ولا قروض ولا إيراد عربون. */
                  assetDeltaMinor: event.assetDeltaMinor ?? 0,
                  loanDeltaMinor: event.loanDeltaMinor ?? 0,
                  revenueDeltaMinor: event.revenueDeltaMinor ?? 0,
                  /* المجموعة ١ (تصنيفي للمصاريف): تطبيع الوسم داخل سياق المصروف عند
                   * الاستيراد — القصّ والدمج والفارغ→null، كسابقة amanahDeltaMinor ?? 0؛
                   * لا اختراع تصنيف للتاريخ ولا وسم على أحداث بلا سياق. */
                  expenseContext: isRecord(event.expenseContext)
                    ? {
                        ...event.expenseContext,
                        categoryLabel: normalizeImportedCategoryLabel(
                          (event.expenseContext as Record<string, unknown>).categoryLabel,
                        ),
                      }
                    : event.expenseContext,
                }
              : event,
          )
        : [],
      preferences: isRecord(raw.preferences)
        ? { ...raw.preferences, lastVerifiedExportAt: raw.preferences.lastVerifiedExportAt ?? null }
        : raw.preferences,
      supplierPurchases: Array.isArray(raw.supplierPurchases)
        ? raw.supplierPurchases.map(purchase =>
            isRecord(purchase)
              ? {
                  ...purchase,
                  /* المجموعة ٢ (عقد ٢٨): ربط المادة والكمية المتوقعة — غياب = null (لا صفر). */
                  materialId: purchase.materialId ?? null,
                  expectedQuantityMilli: purchase.expectedQuantityMilli ?? null,
                  revisions: Array.isArray(purchase.revisions)
                    ? purchase.revisions.map(revision =>
                        isRecord(revision)
                          ? {
                              ...revision,
                              beforeMaterialId: revision.beforeMaterialId ?? null,
                              beforeExpectedQuantityMilli: revision.beforeExpectedQuantityMilli ?? null,
                            }
                          : revision,
                      )
                    : purchase.revisions,
                }
              : purchase,
          )
        : [],
      cashWallets: Array.isArray(raw.cashWallets) ? raw.cashWallets : [],
      cashContinuityEntries: Array.isArray(raw.cashContinuityEntries) ? raw.cashContinuityEntries : [],
      /* المجموعة ٢ (عقد ٢٨): قرار المتابعة ومعرفة البداية — غياب = null (إرث متوافق). */
      materials: Array.isArray(raw.materials)
        ? raw.materials.map(material =>
            isRecord(material)
              ? { ...material, tracking: material.tracking ?? null, opening: material.opening ?? null }
              : material,
          )
        : [],
      inventoryActivation: isRecord(raw.inventoryActivation) ? raw.inventoryActivation : null,
      inventoryMovements: Array.isArray(raw.inventoryMovements)
        ? raw.inventoryMovements.map(movement =>
            isRecord(movement)
              ? {
                  ...movement,
                  wasteContext:
                    movement.type === "waste" ? (movement.wasteContext ?? { kind: "general_project" }) : null,
                  /* المجموعة ٢ (عقد ٢٨): معرفة التكلفة — غياب = known (إرث متوافق). */
                  costKnowledge: movement.costKnowledge ?? "known",
                  /* المجموعة ٣ (عقد D6): ربط البيع المباشر — غياب = null (لا مرجع مفترض). */
                  saleId: movement.saleId ?? null,
                }
              : movement,
          )
        : [],
      /* المجموعة ٢ (عقد ٢٨ / D-027): سجلات النقص — غياب = [] (لا نقص مفترض). */
      inventoryShortages: Array.isArray(raw.inventoryShortages) ? raw.inventoryShortages : [],
      catalogItems: Array.isArray(raw.catalogItems)
        ? raw.catalogItems.map(item => (isRecord(item) ? { ...item, unitId: item.unitId ?? null } : item))
        : [],
      measurementUnits: Array.isArray(raw.measurementUnits) ? raw.measurementUnits : [],
      directConversions: Array.isArray(raw.directConversions) ? raw.directConversions : [],
      catalogTemplates: Array.isArray(raw.catalogTemplates)
        ? raw.catalogTemplates.map(template =>
            isRecord(template)
              ? {
                  ...template,
                  /* المجموعة ٣ (عقد D5): ربط هوية المادة بالمكوّن وبنود القالب الاختيارية —
                   * غياب = null بلا اختراع رابط ولا بنود. */
                  components: Array.isArray(template.components)
                    ? template.components.map(component =>
                        isRecord(component)
                          ? { ...component, materialId: component.materialId ?? null }
                          : component,
                      )
                    : template.components,
                  extras: template.extras ?? null,
                  /* المجموعة ٤ (عقد ٢٩): علم الخصم التلقائي — غياب = غير معلن. */
                  autoConsumeOnDelivery: template.autoConsumeOnDelivery === true ? true : null,
                }
              : template,
          )
        : [],
      actualTimeRecords: Array.isArray(raw.actualTimeRecords)
        ? raw.actualTimeRecords
        : isCurrent
          ? undefined
          : [],
      shortCashDeclarations: Array.isArray(raw.shortCashDeclarations) ? raw.shortCashDeclarations : [],
      ownerEntitlementPolicies: Array.isArray(raw.ownerEntitlementPolicies)
        ? raw.ownerEntitlementPolicies.map(policy =>
            isRecord(policy)
              ? {
                  ...policy,
                  seriesId: policy.seriesId ?? policy.id,
                  successorOfPolicyId: policy.successorOfPolicyId ?? null,
                }
              : policy,
          )
        : [],
      ownerEntitlementRecords: Array.isArray(raw.ownerEntitlementRecords)
        ? raw.ownerEntitlementRecords.map(record =>
            isRecord(record)
              ? {
                  ...record,
                  sourceKeys:
                    Array.isArray(record.sourceKeys) && record.sourceKeys.length > 0
                      ? record.sourceKeys
                      : [`legacy:record:${record.id}`],
                  reversalOfId: record.reversalOfId ?? null,
                  reversalReason: record.reversalReason ?? null,
                }
              : record,
          )
        : [],
      ownerEntitlementOpeningBalances: Array.isArray(raw.ownerEntitlementOpeningBalances)
        ? raw.ownerEntitlementOpeningBalances.map(balance =>
            isRecord(balance)
              ? {
                  ...balance,
                  reversalOfId: balance.reversalOfId ?? null,
                  reversalReason: balance.reversalReason ?? null,
                }
              : balance,
          )
        : [],
      ownerMovements: Array.isArray(raw.ownerMovements)
        ? raw.ownerMovements.map(movement =>
            isRecord(movement)
              ? {
                  ...movement,
                  relatedOpeningBalanceId: movement.relatedOpeningBalanceId ?? null,
                  openingBalanceDeltaMinor: movement.openingBalanceDeltaMinor ?? 0,
                  reversalOfId: movement.reversalOfId ?? null,
                  reversalReason: movement.reversalReason ?? null,
                }
              : movement,
          )
        : [],
      allocationPolicies: Array.isArray(raw.allocationPolicies)
        ? raw.allocationPolicies.map(policy =>
            isRecord(policy)
              ? {
                  ...policy,
                  rateMinorPerWholeUnit:
                    policy.kind === "per_output_unit"
                      ? (policy.rateMinorPerWholeUnit ?? policy.rateMinor ?? null)
                      : null,
                  rateMinor: policy.kind === "per_output_unit" ? null : (policy.rateMinor ?? null),
                }
              : policy,
          )
        : [],
      costEstimates: Array.isArray(raw.costEstimates) ? raw.costEstimates : [],
      /* المجموعة ٤ (عقد ٢٩): سجلات الأصول والقروض — غياب = [] بلا اختراع؛
       * حقولها الاختيارية تُطبع بقيم فارغة آمنة (مراجعات/دفعات/تصحيحات). */
      assets: Array.isArray(raw.assets)
        ? raw.assets.map(asset =>
            isRecord(asset)
              ? {
                  ...asset,
                  categoryLabel: asset.categoryLabel ?? null,
                  lifeMonths: asset.lifeMonths ?? null,
                  depreciationStartOn: asset.depreciationStartOn ?? null,
                  disposal: asset.disposal ?? null,
                  writeOff: asset.writeOff ?? null,
                  contractRevisions: Array.isArray(asset.contractRevisions) ? asset.contractRevisions : [],
                }
              : asset,
          )
        : [],
      loans: Array.isArray(raw.loans)
        ? raw.loans.map(loan =>
            isRecord(loan)
              ? {
                  ...loan,
                  purposeNote: loan.purposeNote ?? null,
                  sourceWalletId: loan.sourceWalletId ?? null,
                  repayments: Array.isArray(loan.repayments)
                    ? loan.repayments.map((repayment: Record<string, unknown>) =>
                        isRecord(repayment)
                          ? { ...repayment, reversal: repayment.reversal ?? null }
                          : repayment,
                      )
                    : [],
                  corrections: Array.isArray(loan.corrections) ? loan.corrections : [],
                }
              : loan,
          )
        : [],
    } as unknown as LocalStoreSnapshot;
    if (!validateSnapshot(migrated))
      return fail("الملف ناقص أو لا يطابق بنية Micro المطلوبة. بقيت بيانات هذا الجهاز دون تغيير.");
    /* المجموعة ٥ (عقد ٣٩ — إصلاح الجولة الكاملة): الحقول الاختيارية للمظروف ٢٧
     * كانت تُتجاهل عند إعادة بناء الملف هنا فخرج تصدير «مُتحقق منه» بلا بصمة
     * ولا عدادات ولا إصدار تطبيق — فيُفقد تحقق التكامل لملفات هذا الإصدار نفسه.
     * الآن تُحمل مع الملف: البصمة تُعاد على البيانات بعد الترحيل فتبقى صادقة
     * على الملف الخارج نفسه، والملفات القديمة بلا بصمة تبقى على مسارها القائم. */
    /* المجموعة ٦ (تدقيق A1 — DP-01): العدادات المضمّنة كانت تُعاد حسابًا وتُستبدل
     * بلا مقارنة — تعليق التصميم يَعِد «تُقارن عند الاستيراد بعدد السجلات المهاجرة
     * فتكشف تغيّرًا أو نقصًا صامتًا» ولم يكن يحدث. الآن: ملف الإصدار الحالي (٢٧)
     * بعدادات لا تطابق البيانات المُرحَّلة يُرفض — النقص أو التغيّر الصامت بعد
     * التلاعب أو القطع يُكشف. الملفات القديمة (بلا عدادات أصلًا) على مسارها. */
    if (isCurrent && !isRecord(candidate.counts))
      return fail(
        "ملف الإصدار الحالي بلا عدادات تحقق — يبدو أن الملف فُتح وعُدّل وحُذف مظروف التحقق منه؛ لا يعتمد عليه. بقيت بيانات هذا الجهاز دون تغيير.",
      );
    /* المجموعة ٢ (التحصين الكامل — MED-002): العدادات صارمة للملف الحالي —
     * كل مفتاح من مفاتيح العد المعروفة يجب أن يكون حاضرًا عددًا صحيحًا غير
     * سالب يطابق البيانات المُرحَّلة، وأي مفتاح غريب إضافي علامة تلاعب؛ الغائب
     * وغير الصحيح والسالب والمتضارب كلها تُرفض قبل أي استبدال. الملفات
     * القديمة (بلا عدادات أصلًا) على مسارها الموروث. */
    if (isRecord(candidate.counts) && isCurrent) {
      const incomingCounts: Record<string, unknown> = candidate.counts;
      const migratedCounts = exportCountsOf(migrated);
      const expectedKeys = Object.keys(migratedCounts) as Array<keyof LocalExportCounts>;
      const extraKeys = Object.keys(incomingCounts).filter(key => !(key in migratedCounts));
      const invalid = expectedKeys.some(key => {
        const incoming = incomingCounts[key];
        return (
          typeof incoming !== "number" ||
          !Number.isInteger(incoming) ||
          incoming < 0 ||
          incoming !== migratedCounts[key]
        );
      });
      if (extraKeys.length > 0 || invalid)
        return fail(
          "عدادات الملف لا تطابق بياناته بعد الترحيل — يبدو أن الملف تغيّر أو نقص بعد إنشائه؛ لا يعتمد عليه. بقيت بيانات هذا الجهاز دون تغيير.",
        );
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
function exportCountsOf(snapshot: LocalStoreSnapshot): LocalExportCounts {
  return {
    orders: snapshot.orders?.length ?? 0,
    directSales: snapshot.directSales?.length ?? 0,
    financialEvents: snapshot.financialEvents?.length ?? 0,
    supplierPurchases: snapshot.supplierPurchases?.length ?? 0,
    cashWallets: snapshot.cashWallets?.length ?? 0,
    cashContinuityEntries: snapshot.cashContinuityEntries?.length ?? 0,
    materials: snapshot.materials?.length ?? 0,
    inventoryMovements: snapshot.inventoryMovements?.length ?? 0,
    inventoryShortages: snapshot.inventoryShortages?.length ?? 0,
    assets: snapshot.assets?.length ?? 0,
    loans: snapshot.loans?.length ?? 0,
    schedules: snapshot.schedules?.length ?? 0,
    drafts: snapshot.drafts?.length ?? 0,
  };
}
