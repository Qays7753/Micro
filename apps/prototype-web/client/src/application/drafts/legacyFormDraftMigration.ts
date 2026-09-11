/**
 * المجموعة ٥ (التحصين الكامل — ترحيل مسودات الصفحة القديمة): مهاجئ ضيق
 * لمفاتيح localStorage القديمة (`micro.finance-draft.<type>.v1` و
 * `micro.setup-draft.v1`) إلى حد المسودات العابرة الموحّد.
 *
 * عقد الترحيل:
 * - لا كتابة مالية ولا حدث ولا رصيد أبدًا — المسودة تبقى مسودة.
 * - الترحيل يمر من حد الخدمة نفسه (الصفحات لا تلمس المخزن أبدًا) فيحمل كل
 *   مهاجر عقد القراءة/الكتابة/التحقق وحساب الإصدار وحد الحجم نفسه.
 * - القيمة القديمة لا تُحذف إلا بعد أن يُحفظ السجل الجديد ويُقرأ ويُتحقق منه
 *   (اكتب ← تحقق ← احذف)؛ فشل أي خطوة يُبقي القديمة لمحاولة لاحقة.
 * - الترحيل حتمي التكرار: المفتاح الغائب = لا شيء؛ والموجود مع سجل جديد
 *   قائم = بقايا ترحيل سابق تُنظف فقط.
 * - البيانات المعطوبة أو البنيفة أو فوق حد الحجم تُرفض بلا انفجار وتبقى
 *   في مكانها — لا حذف لما لا نستطيع قراءته، ولا تحويل صامت إلى أي شيء.
 */
import { formDraftValuesCharLength, MAX_FORM_DRAFT_VALUE_CHARS } from "./formDraftService";
import type { FormDraftService } from "./formDraftService";
import type { FormDraftEnvelope, FormDraftKind } from "@/storage/local/types";

/** واجهة التخزين القديم الضيقة — للإنتاج localStorage وللاختبار كعب محقون. */
export type LegacyFormDraftStorage = {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  /** للإنتاج localStorage الكامل؛ الكعب الاختباري قد يغفل التعداد. */
  readonly length?: number;
  key?(index: number): string | null;
};

/** بيئة الإنتاج تمرر نافذة التخزين نفسها (اختيارية إن غابت). */
export function browserLegacyFormDraftStorage(): LegacyFormDraftStorage | null {
  const storage = globalThis.localStorage;
  if (storage === undefined || storage === null) return null;
  return storage;
}

export type MigrateLegacyFormDraftResult =
  | { status: "none" }
  | { status: "migrated"; value: FormDraftEnvelope }
  | { status: "invalid" }
  | {
      status: "kept";
      code: "storage_error" | "write_failed" | "verify_failed" | "too_large" | "remove_failed";
    };

/** مفاتيح النظام القديم — معرفة هنا وحدها لكل المستدعين. */
export function legacyFinanceDraftKey(type: string): string {
  return `micro.finance-draft.${type}.v1`;
}
export const LEGACY_SETUP_DRAFT_KEY = "micro.setup-draft.v1";

/** مسح كل مفاتيح المسودات القديمة (بادئة المصروف + مفتاح الإعداد) — لسياسة
 * «ابدأ من جديد» المعلنة فقط؛ لا يستدعيها أي مسار آخر. */
export function clearLegacyFormDraftStorage(storage: LegacyFormDraftStorage): number {
  let removed = 0;
  try {
    const doomed: string[] = [];
    const total = typeof storage.length === "number" ? storage.length : 0;
    for (let index = 0; index < total; index += 1) {
      const key = storage.key?.(index);
      if (typeof key !== "string") continue;
      if (key === LEGACY_SETUP_DRAFT_KEY || key.startsWith("micro.finance-draft.")) doomed.push(key);
    }
    for (const key of doomed) {
      storage.removeItem(key);
      removed += 1;
    }
  } catch {
    /* تخزين غير متاح — ما أمكن مسحه مُسح والباقي يحاول لاحقًا. */
  }
  return removed;
}

export async function migrateLegacyFormDraft(params: {
  service: FormDraftService;
  storage: LegacyFormDraftStorage;
  legacyKey: string;
  formKind: FormDraftKind;
  scopeId: string | null;
  /** الإكراه الدفاعي الخاص بالعائلة نفسه كما كان في صفحتها (يرجع null = مرفوضة). */
  parse: (raw: unknown) => Record<string, unknown> | null;
}): Promise<MigrateLegacyFormDraftResult> {
  const { service, storage, legacyKey, formKind, scopeId, parse } = params;
  const raw = readLegacyRaw(storage, legacyKey);
  if (raw === "unavailable") return { status: "kept", code: "storage_error" };
  if (raw === null) return { status: "none" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    /* JSON تالف: يُرفض ويبقى في مكانه — لا انفجار ولا حذف لما لا يُقرأ. */
    return { status: "invalid" };
  }
  const values = parse(parsed);
  if (values === null) return { status: "invalid" };
  if (formDraftValuesCharLength(values) > MAX_FORM_DRAFT_VALUE_CHARS) {
    /* فوق الحد نفسه للسجلات الجديدة — تُرفض مصرّحة وتُترك في مكانها. */
    return { status: "kept", code: "too_large" };
  }
  const existing = await service.read(formKind, scopeId);
  if (!existing.ok) return { status: "kept", code: "storage_error" };
  if (existing.value !== null) {
    /* سجل جديد قائم والمفتاح القديم موجود = بقايا ترحيل قطع الكتابة وفشل
     * الحذف — السجل الجديد مصدر الحقيقة (متحقق بوجوده) فتُنظف البقايا فقط. */
    return removeLegacyKey(storage, legacyKey, existing.value);
  }
  const saved = await service.save(formKind, scopeId, values);
  if (!saved.ok) {
    /* الحد نفسه للسجلات الجديدة يُطبق هنا بلا حدّ موازٍ: تعليم مصرّح للسبب. */
    return { status: "kept", code: saved.code === "too_large" ? "too_large" : "write_failed" };
  }
  /* تحقق بالقراءة بعد الكتابة — الحذف لا يسبق التحقق أبدًا. */
  const verified = await service.read(formKind, scopeId);
  if (
    !verified.ok ||
    verified.value === null ||
    JSON.stringify(verified.value.values) !== JSON.stringify(values)
  ) {
    /* كُتب لكن لم يتحقق: القديم باقٍ؛ إعادة المحاولة ترى السجل قائمًا فتنظف. */
    return { status: "kept", code: "verify_failed" };
  }
  return removeLegacyKey(storage, legacyKey, verified.value);
}

function readLegacyRaw(storage: LegacyFormDraftStorage, legacyKey: string): string | "unavailable" | null {
  try {
    const raw = storage.getItem(legacyKey);
    if (raw === null || raw === "") return null;
    return raw;
  } catch {
    /* تخزين قديم غير متاح — لا شيء يمكن فعله بأمان. */
    return "unavailable";
  }
}

function removeLegacyKey(
  storage: LegacyFormDraftStorage,
  legacyKey: string,
  value: FormDraftEnvelope,
): MigrateLegacyFormDraftResult {
  try {
    storage.removeItem(legacyKey);
  } catch {
    /* السجل الجديد متحقق والمفتاح بقايا خاملة — تُعاد المحاولة عند الفتح التالي. */
    return { status: "kept", code: "remove_failed" };
  }
  return { status: "migrated", value };
}
