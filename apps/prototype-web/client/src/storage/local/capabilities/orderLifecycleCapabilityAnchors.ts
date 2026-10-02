/**
 * Wave 4C (بطاقة RC-7): مراسي تحقيق قدرة «دورة حياة الطلب» — إثبات نوعي
 * (بلا أي منطق) أن المحوّلين والواجهة التوافقية يحققون القدرة.
 *
 * - الملف غير اختباري فيدخله فحص أنواع الـapp القياسي (tsc --noEmit).
 * - وعقد الاختبار يعيد فرضه زمن التشغيل بتشغيل tsc على هذا الملف وحده
 *   (نمط مراسي Wave 3B — ملفات *.test.ts مستثناة من فحص الأنواع القياسي).
 * - كسر أي من هذه المراسي (تغيير توقيع في المحوّلين أو في الواجهة أو
 *  إسقاط implements) يفشل فحص الأ types فورًا — لا انفصام صامت بين
 *   الواجهة التوافقية وقدراتها.
 */
import type { IndexedDbLocalStore } from "../IndexedDbLocalStore";
import type { MemoryLocalStore } from "../MemoryLocalStore";
import type { PrototypeLocalStore } from "../types";
import type { OrderLifecycleStore } from "./orderLifecycleStore";

/** يفشل فحص الأنواع إن لم يكن TImpl قابلًا للإسناد إلى TCapability. */
type AssertSatisfiesCapability<TCapability, TImpl extends TCapability> = true;

/** المحوّل الأول يحقق قدرة دورة حياة الطلب. */
export type IndexedDbLocalStoreSatisfiesOrderLifecycle = AssertSatisfiesCapability<
  OrderLifecycleStore,
  IndexedDbLocalStore
>;

/** المحوّل الثاني يحقق القدرة نفسها — لا انفصام بين بيئة الاختبار والحية. */
export type MemoryLocalStoreSatisfiesOrderLifecycle = AssertSatisfiesCapability<
  OrderLifecycleStore,
  MemoryLocalStore
>;

/** الواجهة التوافقية نفسها تحقق القدرة: كل حامل للواجهة الكاملة يُمرَّر
 *  بأمان إلى أي مستهلك للقدرة الضيقة (علاقة الfacade المعتمدة في RC-7). */
export type PrototypeLocalStoreFacadeSatisfiesOrderLifecycle = AssertSatisfiesCapability<
  OrderLifecycleStore,
  PrototypeLocalStore
>;
