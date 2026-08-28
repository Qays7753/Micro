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
      updatedAt: this.now(),
    });
    return result.ok
      ? { ok: true, preference: result.value.theme }
      : { ok: false, code: "storage_error", message: "تعذر حفظ تفضيل المظهر المحلي." };
  }
}

export type BrowserPersistenceReading = { state: PersistentStorageState; title: string; text: string };

/** P-01 layer 0 read, exposed here so pages never import the storage layer directly. */
export async function readBrowserPersistence(): Promise<BrowserPersistenceReading> {
  const state = await readPersistentStorageState();
  return { state, ...persistentStorageCopy(state) };
}
