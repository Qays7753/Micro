/** UI preferences are local Prototype data, but never carry financial meaning. */
import {
  persistentStorageCopy,
  readPersistentStorageState,
  type PersistentStorageState,
} from "@/storage/local/persistentStorage";
import { localPreferencesId, type LocalPreferences, type PrototypeLocalStore } from "@/storage/local/types";

export type ThemePreference = LocalPreferences["theme"];
export type PreferenceResult =
  { ok: true; preference: ThemePreference } | { ok: false; code: "storage_error"; message: string };
export type InstallBannerDismissalResult =
  { ok: true; dismissedAt: string | null } | { ok: false; code: "storage_error"; message: string };

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
    const current = await this.store.getPreferences();
    if (!current.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة تفضيل المظهر المحلي." };
    const result = await this.store.savePreferences({
      id: localPreferencesId,
      theme,
      dailyScheduleCapacityMinutes: current.value?.dailyScheduleCapacityMinutes ?? null,
      workMode: current.value?.workMode ?? null,
      actualTimeTrackingEnabled: current.value?.actualTimeTrackingEnabled ?? false,
      installBannerDismissedAt: current.value?.installBannerDismissedAt ?? null,
      updatedAt: this.now(),
    });
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
    const current = await this.store.getPreferences();
    if (!current.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة التفضيل المحلي." };
    const exportedAt = this.now();
    const result = await this.store.savePreferences({
      id: localPreferencesId,
      theme: current.value?.theme ?? "system",
      dailyScheduleCapacityMinutes: current.value?.dailyScheduleCapacityMinutes ?? null,
      workMode: current.value?.workMode ?? null,
      actualTimeTrackingEnabled: current.value?.actualTimeTrackingEnabled ?? false,
      installBannerDismissedAt: current.value?.installBannerDismissedAt ?? null,
      lastVerifiedExportAt: exportedAt,
      updatedAt: exportedAt,
    });
    return result.ok
      ? { ok: true, preference: result.value.theme }
      : { ok: false, code: "storage_error", message: "تعذر حفظ تاريخ النسخة الاحتياطية." };
  }
  async readLastVerifiedExport(): Promise<{ ok: true; exportedAt: string | null } | { ok: false; code: "storage_error"; message: string }> {
    const result = await this.store.getPreferences();
    return result.ok
      ? { ok: true, exportedAt: result.value?.lastVerifiedExportAt ?? null }
      : { ok: false, code: "storage_error", message: "تعذر قراءة تاريخ النسخة الاحتياطية." };
  }
  async saveInstallBannerDismissal(): Promise<InstallBannerDismissalResult> {
    const current = await this.store.getPreferences();
    if (!current.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة حالة بطاقة التثبيت." };
    const dismissedAt = this.now();
    const result = await this.store.savePreferences({
      id: localPreferencesId,
      theme: current.value?.theme ?? "system",
      dailyScheduleCapacityMinutes: current.value?.dailyScheduleCapacityMinutes ?? null,
      workMode: current.value?.workMode ?? null,
      actualTimeTrackingEnabled: current.value?.actualTimeTrackingEnabled ?? false,
      installBannerDismissedAt: dismissedAt,
      updatedAt: dismissedAt,
    });
    return result.ok
      ? { ok: true, dismissedAt: result.value.installBannerDismissedAt }
      : { ok: false, code: "storage_error", message: "تعذر حفظ حالة بطاقة التثبيت." };
  }
}

export type BrowserPersistenceReading = { state: PersistentStorageState; title: string; text: string };

/** P-01 layer 0 read, exposed here so pages never import the storage layer directly. */
export async function readBrowserPersistence(): Promise<BrowserPersistenceReading> {
  const state = await readPersistentStorageState();
  return { state, ...persistentStorageCopy(state) };
}
