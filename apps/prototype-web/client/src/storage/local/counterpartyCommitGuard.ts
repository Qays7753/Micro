/**
 * S05 (DOC-014 / UNIT-037 B3/B4 + العقد المشترك §14): حارس التزام الطرف
 * المحفوظ — نواة قرار نقية واحدة يستهلكها المهايئان معًا (ذاكرة وIndexedDB)
 * فتطابقهما الدلالي بنيويّ لا بالترجمة (نمط decideCashObservationCommit).
 *
 * عقد الحد: القراءة والفحص والكتابة داخل معاملة واحدة (IndexedDB) أو خطوة
 * متزامنة واحدة (الذاكرة):
 *  1. العهدة — إعادة الأمر نفسه (operationKey) إعادةُ استخدام صادقة بلا
 *     كتابة ثانية: سجل حي يحمل المفتاح نفسه يُعاد كما هو (SDF-041: إعادة
 *     محاولة حفظ الطرف بعد نجاح البيع لا تكرر أثرًا ولا تنشئ طرفًا ثانيًا،
 *     حتى لو ولّدت المحاولة معرّفًا عشوائيًا جديدًا).
 *  2. الإنشاء فوق سجل قائم بمعرّف مختلف ومفتاح مختلف تعارض صادق — لا كتابة
 *     فوق مسار آخر ولا دمج صامت.
 *  3. التعديل (تسمية/أرشفة) CAS حي على updatedAt: النسخة التي قرأها
 *     المستخدم (baseUpdatedAt) يجب أن تطابق السجل الحي داخل الحد، وإلا
 *     حُبط بلا كتابة — نافذتان تعدلان الطرف نفسه لا تسحق إحداهما الأخرى
 *     (U037-AC22).
 */
import type { SavedParty } from "@micro-domain/party/index.js";
import { COUNTERPARTY_CONFLICT_MESSAGE, COUNTERPARTY_STALE_MESSAGE } from "./indexedDbStores";
import { STORAGE_STALE } from "./resultCodes";

/** زوج كتابة الطرف المحروس — النتيجة المرادة ونسخة القراءة المتوقعة. */
export type CounterpartyWriteCommit = {
  kind: "create" | "rename" | "archive";
  /** null للإنشاء؛ للتعديل updatedAt الذي رآه المستخدم (CAS حي). */
  baseUpdatedAt: string | null;
  next: SavedParty;
  operationKey: string;
};

export type CounterpartyCommitDecision =
  | { kind: "reject"; code: typeof STORAGE_STALE; message: string }
  | { kind: "reuse"; party: SavedParty }
  | { kind: "commit" };

export function decideCounterpartyCommit(
  liveById: SavedParty | null,
  liveByOperationKey: SavedParty | null,
  commit: CounterpartyWriteCommit,
): CounterpartyCommitDecision {
  /* ١) العهدة: مفتاح العملية نفسه مسجل آخر مرة — إعادة استخدام بلا كتابة،
   * أيًا كان معرّف المحاولة (المعرف العشوائي الجديد لا ينشئ طرفًا ثانيًا). */
  if (liveByOperationKey) return { kind: "reuse", party: liveByOperationKey };
  if (commit.baseUpdatedAt === null) {
    /* ٢) الإنشاء: المعرف مشغول بمفتاح آخر = كاتب آخر سبق الحد — تعارض صادق. */
    if (liveById) return { kind: "reject", code: STORAGE_STALE, message: COUNTERPARTY_CONFLICT_MESSAGE };
    return { kind: "commit" };
  }
  /* ٣) التعديل: السجل الحي غائب أو تقدّم على نسخة المستخدم — لا كتابة فوق
   * واقع متغير. */
  if (!liveById) return { kind: "reject", code: STORAGE_STALE, message: COUNTERPARTY_STALE_MESSAGE };
  if (liveById.updatedAt !== commit.baseUpdatedAt)
    return { kind: "reject", code: STORAGE_STALE, message: COUNTERPARTY_STALE_MESSAGE };
  return { kind: "commit" };
}
