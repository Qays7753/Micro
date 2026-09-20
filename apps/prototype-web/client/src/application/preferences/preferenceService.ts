/** UI preferences are local Prototype data, but never carry financial meaning. */
import {
  persistentStorageCopy,
  readPersistentStorageState,
  type PersistentStorageState,
} from "@/storage/local/persistentStorage";
import type { LocalPreferences, PrototypeLocalStore } from "@/storage/local/types";
import { updateLocalPreferences } from "@/application/preferences/updateLocalPreferences";

export type ThemePreference = LocalPreferences["theme"];
export type PreferenceResult =
  { ok: true; preference: ThemePreference } | { ok: false; code: "storage_error"; message: string };
export type InstallBannerDismissalResult =
  { ok: true; dismissedAt: string | null } | { ok: false; code: "storage_error"; message: string };
export type BackupReminderResult =
  { ok: true; enabled: boolean } | { ok: false; code: "storage_error"; message: string };
/* SET-003: قراءة/حفظ قائمة القدرات المتوقفة عن الإدخال. */
export type DisabledCapabilitiesResult =
  { ok: true; disabled: readonly string[] } | { ok: false; code: "storage_error"; message: string };
/* Stage 2 — OPS-002: قراءة/حفظ حدود تنبيه انخفاض المخزون لكل مادة (بالملي).
 * سياسة تنبيه قراءة-فقط لا معنى ماليًا؛ الغياب = لا سياسة = لا تنبيه. */
export type LowStockThresholdsResult =
  | { ok: true; thresholds: ReadonlyMap<string, number> }
  | { ok: false; code: "storage_error"; message: string };
export type LowStockThresholdSaveResult =
  | { ok: true; thresholds: ReadonlyMap<string, number> }
  | { ok: false; code: "validation_error" | "storage_error"; message: string };

export class PreferenceService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}
  /** P-01 layer 0 read, exposed here so pages never import the storage layer directly. */
  async readBrowserPersistence(): Promise<BrowserPersistenceReading> {
    return readBrowserPersistence();
  }
  async load(): Promise<PreferenceResult> {
    const result = await this.store.getPreferences();
    return result.ok
      ? { ok: true, preference: result.value?.theme ?? "system" }
      : { ok: false, code: "storage_error", message: "تعذر قراءة تفضيل المظهر المحلي." };
  }
  async save(theme: ThemePreference): Promise<PreferenceResult> {
    /* EXE-002: تحديث merge — الحقول القائمة تُنقل كلها ولا يُمسّ غير المظهر. */
    const result = await updateLocalPreferences(this.store, { theme }, this.now);
    return result.ok
      ? { ok: true, preference: result.value.theme }
      : { ok: false, code: "storage_error", message: "تعذر حفظ تفضيل المظهر المحلي." };
  }
  async readInstallBannerDismissal(): Promise<InstallBannerDismissalResult> {
    const result = await this.store.getPreferences();
    return result.ok
      ? { ok: true, dismissedAt: result.value?.installBannerDismissedAt ?? null }
      : { ok: false, code: "storage_error", message: "تعذر قراءة حالة بطاقة التثبيت." };
  }
  /** P-01 طبقة ١: تسجيل آخر تصدير مُتحقق منه — أساس تذكير النسخ الاحتياطي. */
  async markVerifiedExport(): Promise<PreferenceResult> {
    const exportedAt = this.now();
    /* EXE-002: merge — طابع التحديث يطابق لحظة التصدير كما في السلوك القائم. */
    const result = await updateLocalPreferences(
      this.store,
      { lastVerifiedExportAt: exportedAt },
      () => exportedAt,
    );
    return result.ok
      ? { ok: true, preference: result.value.theme }
      : { ok: false, code: "storage_error", message: "تعذر حفظ تاريخ النسخة الاحتياطية." };
  }
  /* O-001: تذكير النسخة الدوري اختياري — إطفاؤه يخفي السطر من الرئيسية فقط. */
  async saveBackupReminderEnabled(enabled: boolean): Promise<BackupReminderResult> {
    /* EXE-002: merge — لا يُمسّ غير مفتاح التذكير. */
    const result = await updateLocalPreferences(this.store, { backupReminderEnabled: enabled }, this.now);
    return result.ok
      ? { ok: true, enabled: result.value.backupReminderEnabled ?? true }
      : { ok: false, code: "storage_error", message: "تعذر حفظ تفضيل تذكير النسخة." };
  }
  async readBackupReminderEnabled(): Promise<BackupReminderResult> {
    const result = await this.store.getPreferences();
    return result.ok
      ? { ok: true, enabled: result.value?.backupReminderEnabled ?? true }
      : { ok: false, code: "storage_error", message: "تعذر قراءة تفضيل تذكير النسخة." };
  }
  async readLastVerifiedExport(): Promise<
    { ok: true; exportedAt: string | null } | { ok: false; code: "storage_error"; message: string }
  > {
    const result = await this.store.getPreferences();
    return result.ok
      ? { ok: true, exportedAt: result.value?.lastVerifiedExportAt ?? null }
      : { ok: false, code: "storage_error", message: "تعذر قراءة تاريخ النسخة الاحتياطية." };
  }
  async saveInstallBannerDismissal(): Promise<InstallBannerDismissalResult> {
    const dismissedAt = this.now();
    /* EXE-002: merge — طابع التحديث يطابق لحظة الإخفاء كما في السلوك القائم. */
    const result = await updateLocalPreferences(
      this.store,
      { installBannerDismissedAt: dismissedAt },
      () => dismissedAt,
    );
    return result.ok
      ? { ok: true, dismissedAt: result.value.installBannerDismissedAt }
      : { ok: false, code: "storage_error", message: "تعذر حفظ حالة بطاقة التثبيت." };
  }
  /* ── SET-003: قدرات المشروع — الإيقاف يخفي مداخل الإدخال اليومية فقط؛
   * السجلات والديون والالتزامات القائمة تبقى ظاهرة قابلة للتدقيق دائمًا. ── */

  async readDisabledCapabilities(): Promise<DisabledCapabilitiesResult> {
    const result = await this.store.getPreferences();
    return result.ok
      ? { ok: true, disabled: result.value?.disabledCapabilities ?? [] }
      : { ok: false, code: "storage_error", message: "تعذر قراءة تفضيلات القدرات المحلية." };
  }

  async saveDisabledCapabilities(disabled: readonly string[]): Promise<DisabledCapabilitiesResult> {
    /* EXE-002: merge — لا يُمسّ غير قائمة القدرات نفسها. */
    const result = await updateLocalPreferences(
      this.store,
      { disabledCapabilities: [...disabled] },
      this.now,
    );
    return result.ok
      ? { ok: true, disabled: result.value.disabledCapabilities ?? [] }
      : { ok: false, code: "storage_error", message: "تعذر حفظ تفضيلات القدرات." };
  }
  async readLowStockThresholds(): Promise<LowStockThresholdsResult> {
    const result = await this.store.getPreferences();
    return result.ok
      ? { ok: true, thresholds: new Map(Object.entries(result.value?.lowStockThresholdsMilli ?? {})) }
      : { ok: false, code: "storage_error", message: "تعذر قراءة حدود التنبيه المحلية." };
  }
  async saveLowStockThreshold(
    materialId: string,
    thresholdMilli: number | null,
  ): Promise<LowStockThresholdSaveResult> {
    /* تحقق الحدود نفسها التي يفرضها الدومين على أي كمية معلنة — لا مسار ثانٍ. */
    if (thresholdMilli !== null && (!Number.isSafeInteger(thresholdMilli) || thresholdMilli <= 0))
      return {
        ok: false,
        code: "validation_error",
        message: "أدخل حدًا موجبًا صحيحًا بوحدة المادة، أو أزل الحد.",
      };
    const current = await this.readLowStockThresholds();
    if (!current.ok) return { ok: false, code: "storage_error", message: current.message };
    const next = new Map(current.thresholds);
    if (thresholdMilli === null) next.delete(materialId);
    else next.set(materialId, thresholdMilli);
    /* EXE-002: merge — لا يُسقط أي كاتب آخر حقولًا قائمة. */
    const result = await updateLocalPreferences(
      this.store,
      { lowStockThresholdsMilli: Object.fromEntries(next) },
      this.now,
    );
    return result.ok
      ? { ok: true, thresholds: new Map(Object.entries(result.value.lowStockThresholdsMilli ?? {})) }
      : { ok: false, code: "storage_error", message: "تعذر حفظ حد التنبيه." };
  }
}

export type BrowserPersistenceReading = { state: PersistentStorageState; title: string; text: string };

/** P-01 layer 0 read, exposed here so pages never import the storage layer directly. */
export async function readBrowserPersistence(): Promise<BrowserPersistenceReading> {
  const state = await readPersistentStorageState();
  return { state, ...persistentStorageCopy(state) };
}
