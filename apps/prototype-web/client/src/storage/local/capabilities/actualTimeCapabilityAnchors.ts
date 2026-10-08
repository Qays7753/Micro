/**
 * R3 (بطاقة R3-SC-10): مراسي تحقيق قدرة «الوقت الفعلي» —
 * إثبات نوعي (بلا أي منطق) أن المحوّلين والواجهة التوافقية يحققون القدرة.
 *
 * - الملف غير اختباري فيدخله فحص أنواع الـapp القياسي (tsc --noEmit).
 * - وعقد الاختبار يعيد فرضه زمن التشغيل بتشغيل tsc على هذا الملف وحده
 *   (نمط مراسي Wave 3B/4C — ملفات *.test.ts مستثناة من فحص الأنواع القياسي).
 * - كسر أي من هذه المراسي (تغيير توقيع في المحوّلين أو في الواجهة أو
 *   إسقاط implements) يفشل فحص الأنواع فورًا — لا انفصام صامت بين
 *   الواجهة التوافقية وقدراتها.
 */
import type { IndexedDbLocalStore } from "../IndexedDbLocalStore";
import type { MemoryLocalStore } from "../MemoryLocalStore";
import type { PrototypeLocalStore } from "../types";
import type { ActualTimeStore } from "./actualTimeStore";

/** يفشل فحص الأنواع إن لم يكن TImpl قابلًا للإسناد إلى TCapability. */
type AssertSatisfiesCapability<TCapability, TImpl extends TCapability> = true;

/** المحوّل الأول يحقق قدرة الوقت الفعلي. */
export type IndexedDbLocalStoreSatisfiesActualTime = AssertSatisfiesCapability<ActualTimeStore, IndexedDbLocalStore>;

/** المحوّل الثاني يحقق القدرة نفسها — لا انفصام بين بيئة الاختبار والحية. */
export type MemoryLocalStoreSatisfiesActualTime = AssertSatisfiesCapability<ActualTimeStore, MemoryLocalStore>;

/** الواجهة التوافقية نفسها تحقق القدرة (القدرة عرضها المشتق). */
export type PrototypeLocalStoreSatisfiesActualTime = AssertSatisfiesCapability<ActualTimeStore, PrototypeLocalStore>;
