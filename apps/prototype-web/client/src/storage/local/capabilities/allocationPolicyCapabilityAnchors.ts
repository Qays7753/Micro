/**
 * Wave C (بطاقة ADR-015 مجموعة 4): مراسي تحقيق قدرة «سياسات التوزيع» —
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
import type { AllocationPolicyStore } from "./allocationPolicyStore";

/** يفشل فحص الأنواع إن لم يكن TImpl قابلًا للإسناد إلى TCapability. */
type AssertSatisfiesCapability<TCapability, TImpl extends TCapability> = true;

/** المحوّل الأول يحقق قدرة سياسات التوزيع. */
export type IndexedDbLocalStoreSatisfiesAllocationPolicy = AssertSatisfiesCapability<
  AllocationPolicyStore,
  IndexedDbLocalStore
>;

/** المحوّل الثاني يحقق القدرة نفسها — لا انفصام بين بيئة الاختبار والحية. */
export type MemoryLocalStoreSatisfiesAllocationPolicy = AssertSatisfiesCapability<
  AllocationPolicyStore,
  MemoryLocalStore
>;

/** الواجهة التوافقية نفسها تحقق القدرة (القدرة عرضها المشتق). */
export type PrototypeLocalStoreSatisfiesAllocationPolicy = AssertSatisfiesCapability<
  AllocationPolicyStore,
  PrototypeLocalStore
>;
