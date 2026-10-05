/**
 * Wave C (بطاقة ADR-015 مجموعة 2): مراسي تحقيق قدرة «الميزانيات» —
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
import type { ExpenseBudgetStore } from "./expenseBudgetStore";

/** يفشل فحص الأنواع إن لم يكن TImpl قابلًا للإسناد إلى TCapability. */
type AssertSatisfiesCapability<TCapability, TImpl extends TCapability> = true;

/** المحوّل الأول يحقق قدرة الميزانيات. */
export type IndexedDbLocalStoreSatisfiesExpenseBudget = AssertSatisfiesCapability<
  ExpenseBudgetStore,
  IndexedDbLocalStore
>;

/** المحوّل الثاني يحقق القدرة نفسها — لا انفصام بين بيئة الاختبار والحية. */
export type MemoryLocalStoreSatisfiesExpenseBudget = AssertSatisfiesCapability<
  ExpenseBudgetStore,
  MemoryLocalStore
>;

/** الواجهة التوافقية نفسها تحقق القدرة (القدرة عرضها المشتق). */
export type PrototypeLocalStoreSatisfiesExpenseBudget = AssertSatisfiesCapability<
  ExpenseBudgetStore,
  PrototypeLocalStore
>;
