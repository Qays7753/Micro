import type {
  SupplierPurchase,
  SupplierPurchasePayment,
  SupplierPurchasePaymentReversal,
  SupplierPurchaseRevision,
} from "@micro-domain/supplier-purchase/index.js";
import type { ScheduleEntry, ScheduleEvent } from "./types";

/* المجموعة ٢ (عقد التحصين الكامل — HIGH-001): الكتابة العمياء لسجل الشراء أو
 * الموعد (آخر كاتب يفوز) تسمح لمسارين متزامنين بإسقاط أثر أحدهما بصمت — دفعة
 * تختفي أو حدث موعد يُمحى. هذا الحارس النقي يُستدعى داخل معاملة الكتابة نفسها:
 * فحص مفتاح الحتمية أولًا (إعادة التشغيل تُعاد كما هي)، ثم يجب أن تطابق العلاقة
 * بين السجل المخزّن والسجل الوارد عملية مجال واحدة بالضبط. أي علاقة أخرى تعني
 * أن مسارًا آخر كتب بين قراءة المستخدم وكتابته — يُرفض الالتزام بـ storage_stale
 * ولا يُكتب شيء، فلا انفصام بين السجل وأحداثه ولا دمج صامت لعمليتين. */

export type SupplierPurchaseCommitKind = "create" | "payment" | "payment_reversal" | "revision";

export type SupplierPurchaseCommit = {
  kind: SupplierPurchaseCommitKind;
  /** السجل الكامل الجاهز للكتابة كما بنته دالة النطاق. */
  purchase: SupplierPurchase;
  /** مفتاح الحتمية للعملية نفسها (إنشاء/دفعة/تراجع/مراجعة). */
  idempotencyKey: string;
};

export type CommitGuardResult = { ok: true; reused: boolean } | { ok: false; message: string };

const STALE_MESSAGE = "سجل الشراء تغيّر من مسار آخر بعد فتحك له — لم يُسجَّل شيء؛ أعد المحاولة.";
const MISSING_MESSAGE = "سجل الشراء لم يعد موجودًا محليًا؛ لم يُسجَّل شيء.";

const samePayment = (a: SupplierPurchasePayment, b: SupplierPurchasePayment) =>
  a.id === b.id &&
  a.amountMinor === b.amountMinor &&
  a.occurredOn === b.occurredOn &&
  a.recordedAt === b.recordedAt &&
  a.idempotencyKey === b.idempotencyKey &&
  a.note === b.note;

const sameReversal = (a: SupplierPurchasePaymentReversal, b: SupplierPurchasePaymentReversal) =>
  a.id === b.id &&
  a.paymentId === b.paymentId &&
  a.amountMinor === b.amountMinor &&
  a.reason === b.reason &&
  a.occurredOn === b.occurredOn &&
  a.recordedAt === b.recordedAt &&
  a.idempotencyKey === b.idempotencyKey;

const sameRevision = (a: SupplierPurchaseRevision, b: SupplierPurchaseRevision) =>
  a.kind === b.kind &&
  a.idempotencyKey === b.idempotencyKey &&
  a.createdAt === b.createdAt &&
  a.reason === b.reason &&
  a.beforeTotalMinor === b.beforeTotalMinor &&
  a.beforeInitialPaidMinor === b.beforeInitialPaidMinor &&
  a.beforeSupplierName === b.beforeSupplierName &&
  a.beforeNote === b.beforeNote &&
  a.beforePurchasedOn === b.beforePurchasedOn &&
  a.beforeDueOn === b.beforeDueOn &&
  (a.beforeMaterialId ?? null) === (b.beforeMaterialId ?? null) &&
  (a.beforeExpectedQuantityMilli ?? null) === (b.beforeExpectedQuantityMilli ?? null);

/* المدفوع الفعلي واشتقاقات الحالة — نفس معيّنات النطاق، تُفحص هنا داخل المعاملة
 * فلا يمر سجل معطوب الاشتقاق حتى لو تطابقت العلاقة الهيكلية. */
const totalPaidOf = (payments: readonly SupplierPurchasePayment[]) =>
  payments.reduce((sum, payment) => sum + payment.amountMinor, 0);
const totalReversedOf = (reversals: readonly SupplierPurchasePaymentReversal[] | undefined) =>
  (reversals ?? []).reduce((sum, reversal) => sum + reversal.amountMinor, 0);
const statusFor = (totalMinor: number, paidMinor: number) =>
  paidMinor <= 0 ? "unpaid" : paidMinor >= totalMinor ? "paid" : "partially_paid";

function derivedFieldsConsistent(purchase: SupplierPurchase): boolean {
  const paidMinor = totalPaidOf(purchase.payments) - totalReversedOf(purchase.paymentReversals);
  return (
    purchase.paidMinor === paidMinor &&
    purchase.payableMinor === purchase.totalMinor - paidMinor &&
    purchase.status === statusFor(purchase.totalMinor, paidMinor) &&
    paidMinor >= 0 &&
    paidMinor <= purchase.totalMinor
  );
}

/* الحقول الثابتة خارج أثر العملية — أي تغيّر فيها يعني عملية أخرى تزامنت. */
function headerIdentical(stored: SupplierPurchase, incoming: SupplierPurchase): boolean {
  return (
    stored.id === incoming.id &&
    stored.idempotencyKey === incoming.idempotencyKey &&
    stored.supplierName === incoming.supplierName &&
    stored.note === incoming.note &&
    stored.purchasedOn === incoming.purchasedOn &&
    stored.dueOn === incoming.dueOn &&
    stored.totalMinor === incoming.totalMinor &&
    (stored.materialId ?? null) === (incoming.materialId ?? null) &&
    (stored.expectedQuantityMilli ?? null) === (incoming.expectedQuantityMilli ?? null) &&
    stored.createdAt === incoming.createdAt
  );
}

function paymentsIdentical(stored: SupplierPurchase, incoming: SupplierPurchase): boolean {
  return (
    stored.payments.length === incoming.payments.length &&
    stored.payments.every((payment, index) => samePayment(payment, incoming.payments[index]!))
  );
}

function reversalsIdentical(stored: SupplierPurchase, incoming: SupplierPurchase): boolean {
  const storedReversals = stored.paymentReversals ?? [];
  const incomingReversals = incoming.paymentReversals ?? [];
  return (
    storedReversals.length === incomingReversals.length &&
    storedReversals.every((reversal, index) => sameReversal(reversal, incomingReversals[index]!))
  );
}

function revisionsAppendable(
  stored: SupplierPurchase,
  incoming: SupplierPurchase,
): SupplierPurchaseRevision | null {
  const storedRevisions = stored.revisions ?? [];
  const incomingRevisions = incoming.revisions ?? [];
  if (incomingRevisions.length !== storedRevisions.length + 1) return null;
  if (!storedRevisions.every((revision, index) => sameRevision(revision, incomingRevisions[index]!)))
    return null;
  return incomingRevisions[incomingRevisions.length - 1]!;
}

/** فحص علاقة الالتزام لسجل شراء مورد: إعادة الاستخدام بالمفتاح أولًا، ثم
 * علاقة «عملية مجال واحدة بالضبط» بين المخزّن والوارد، وإلا رفض صريح. */
export function validateSupplierPurchaseCommit(
  stored: SupplierPurchase | undefined,
  commit: SupplierPurchaseCommit,
): CommitGuardResult {
  const { kind, purchase, idempotencyKey } = commit;
  if (kind === "create") {
    if (stored === undefined) return { ok: true, reused: false };
    /* إعادة تشغيل الإنشاء: السجل موجود بمفتاح العملية نفسه — إعادة استخدام
     * صادقة للسجل الحالي لا كتابة جديدة ولا إسقاط لما تراكم عليه. */
    if (stored.idempotencyKey === idempotencyKey) return { ok: true, reused: true };
    return { ok: false, message: STALE_MESSAGE };
  }
  if (stored === undefined) return { ok: false, message: MISSING_MESSAGE };
  if (!derivedFieldsConsistent(purchase)) return { ok: false, message: STALE_MESSAGE };
  if (kind === "payment") {
    if (stored.payments.some(payment => payment.idempotencyKey === idempotencyKey))
      return { ok: true, reused: true };
    /* دفعة واحدة جديدة بالضبط تحمل مفتاح هذه العملية، وكل دفعة قائمة تبقى
     * كما هي حرفيًا — أي انحراف يعني مسارًا متزامنًا كتب بين القراءة والكتابة. */
    if (purchase.payments.length !== stored.payments.length + 1) return { ok: false, message: STALE_MESSAGE };
    const incomingById = new Map(purchase.payments.map(payment => [payment.id, payment]));
    if (incomingById.size !== purchase.payments.length) return { ok: false, message: STALE_MESSAGE };
    const added = purchase.payments.filter(
      payment => !stored.payments.some(candidate => candidate.id === payment.id),
    );
    if (
      added.length !== 1 ||
      added[0]!.idempotencyKey !== idempotencyKey ||
      !stored.payments.every(payment => {
        const counterpart = incomingById.get(payment.id);
        return counterpart !== undefined && samePayment(payment, counterpart);
      })
    )
      return { ok: false, message: STALE_MESSAGE };
    if (!reversalsIdentical(stored, purchase)) return { ok: false, message: STALE_MESSAGE };
    if ((purchase.revisions ?? []).length !== (stored.revisions ?? []).length)
      return { ok: false, message: STALE_MESSAGE };
    if (!headerIdentical(stored, purchase)) return { ok: false, message: STALE_MESSAGE };
    return { ok: true, reused: false };
  }
  if (kind === "payment_reversal") {
    if ((stored.paymentReversals ?? []).some(reversal => reversal.idempotencyKey === idempotencyKey))
      return { ok: true, reused: true };
    const storedReversals = stored.paymentReversals ?? [];
    const incomingReversals = purchase.paymentReversals ?? [];
    if (incomingReversals.length !== storedReversals.length + 1) return { ok: false, message: STALE_MESSAGE };
    const newReversal = incomingReversals[incomingReversals.length - 1]!;
    if (newReversal.idempotencyKey !== idempotencyKey) return { ok: false, message: STALE_MESSAGE };
    /* فشل مغلق داخل المعاملة: الدفعة موجودة فعلًا في المخزّن، ليست الأولية،
     * ولا تراجع سابق عليها — مطابقة لشروط النطاق لكن على الحالة الحية. */
    const targetPayment = stored.payments.find(payment => payment.id === newReversal.paymentId);
    if (
      !targetPayment ||
      targetPayment.id === `${stored.id}:initial` ||
      storedReversals.some(reversal => reversal.paymentId === newReversal.paymentId) ||
      newReversal.amountMinor !== targetPayment.amountMinor
    )
      return { ok: false, message: STALE_MESSAGE };
    if (!paymentsIdentical(stored, purchase)) return { ok: false, message: STALE_MESSAGE };
    if (!storedReversals.every((reversal, index) => sameReversal(reversal, incomingReversals[index]!)))
      return { ok: false, message: STALE_MESSAGE };
    if ((purchase.revisions ?? []).length !== (stored.revisions ?? []).length)
      return { ok: false, message: STALE_MESSAGE };
    if (!headerIdentical(stored, purchase)) return { ok: false, message: STALE_MESSAGE };
    return { ok: true, reused: false };
  }
  /* revision — تعديل موثق واحد بالضبط: مراجعة جديدة تحفظ قيم المخزّن الحالي
   * في before*، والدفعات اللاحقة وتراجعاتها لا تُمس، والدفع الأولي وحده يُعاد
   * بناءه بمعرّفه القديم. */
  if ((stored.revisions ?? []).some(revision => revision.idempotencyKey === idempotencyKey))
    return { ok: true, reused: true };
  const newRevision = revisionsAppendable(stored, purchase);
  if (!newRevision || newRevision.idempotencyKey !== idempotencyKey)
    return { ok: false, message: STALE_MESSAGE };
  const initialPayment = stored.payments.find(payment => payment.id === `${stored.id}:initial`);
  if (
    newRevision.beforeTotalMinor !== stored.totalMinor ||
    newRevision.beforeInitialPaidMinor !== (initialPayment?.amountMinor ?? 0) ||
    newRevision.beforeSupplierName !== stored.supplierName ||
    newRevision.beforeNote !== stored.note ||
    newRevision.beforePurchasedOn !== stored.purchasedOn ||
    newRevision.beforeDueOn !== stored.dueOn ||
    (newRevision.beforeMaterialId ?? null) !== (stored.materialId ?? null) ||
    (newRevision.beforeExpectedQuantityMilli ?? null) !== (stored.expectedQuantityMilli ?? null)
  )
    return { ok: false, message: STALE_MESSAGE };
  const storedLater = stored.payments.filter(payment => payment.id !== `${stored.id}:initial`);
  const incomingLater = purchase.payments.filter(payment => payment.id !== `${stored.id}:initial`);
  if (
    incomingLater.length !== storedLater.length ||
    !incomingLater.every((payment, index) => samePayment(payment, storedLater[index]!))
  )
    return { ok: false, message: STALE_MESSAGE };
  /* الدفع الأولي وحده يُعاد بناؤه بمعرّفه القديم (المفتاح محفوظ أو مفتاح
   * المراجعة نفسه عند نشأته) — حذفه مسموح فقط حين يصفر الدفع الأولي الجديد
   * ويتحقق النطاق بالقيم؛ الحارس يكفيه أن الدفعات اللاحقة لم تتغير. */
  const incomingInitial = purchase.payments.find(payment => payment.id === `${stored.id}:initial`);
  const expectedInitialKey = initialPayment?.idempotencyKey ?? `${idempotencyKey}:initial`;
  if (incomingInitial && incomingInitial.idempotencyKey !== expectedInitialKey)
    return { ok: false, message: STALE_MESSAGE };
  if (!reversalsIdentical(stored, purchase)) return { ok: false, message: STALE_MESSAGE };
  if (
    stored.id !== purchase.id ||
    stored.idempotencyKey !== purchase.idempotencyKey ||
    stored.createdAt !== purchase.createdAt
  )
    return { ok: false, message: STALE_MESSAGE };
  return { ok: true, reused: false };
}

/* ─── عقد التزام الموعد ─── */

export type ScheduleCommitGuardResult = CommitGuardResult;

const sameScheduleEvent = (a: ScheduleEvent, b: ScheduleEvent) =>
  a.id === b.id &&
  a.type === b.type &&
  a.idempotencyKey === b.idempotencyKey &&
  a.createdAt === b.createdAt &&
  a.previousScheduledFor === b.previousScheduledFor &&
  a.scheduledFor === b.scheduledFor &&
  a.previousScheduledTime === b.previousScheduledTime &&
  a.scheduledTime === b.scheduledTime &&
  a.previousDurationMinutes === b.previousDurationMinutes &&
  a.durationMinutes === b.durationMinutes &&
  a.reason === b.reason;

const SCHEDULE_STALE_MESSAGE = "الموعد تغيّر من مسار آخر بعد فتحك له — لم يُسجَّل شيء؛ أعد المحاولة.";
const SCHEDULE_MISSING_MESSAGE = "الموعد لم يعد موجودًا محليًا؛ لم يُسجَّل شيء.";

/** إنشاء موعد: كتابة أولى فقط — وجوده سلفًا إعادة استخدام متقاربة لا كتابة فوق
 * مسار آخر (محتوى الإنشاء حتمي بمعرّفه ومفتاحه). */
export function validateScheduleCreate(stored: ScheduleEntry | undefined): ScheduleCommitGuardResult {
  return stored === undefined ? { ok: true, reused: false } : { ok: true, reused: true };
}

/** تحديث موعد: حدث واحد جديد بالضبط في نهاية الأحداث، كل الأحداث السابقة كما
 * هي حرفيًا، وحقول «قبل» في الحدث الجديد تطابق حالة المخزّن الحية — هذا جوهر
 * التزامن المتفائل. إعادة التشغيل بالمفتاح نفسه تُعاد كما هي (نجاح بلا كتابة).
 * رقعة إغلاق المجموعة ٢ (مراجعة مستقلة): العلاقة لا تكتمل بـ«قبل» وحدها —
 * يجب أن تطابق حقول الموعد الواردة الحقول «الجديدة» التي يصرّح بها الحدث
 * نفسه (scheduledFor/scheduledTime/durationMinutes)، فلا يمر سجل مزوّر
 * تتفق قصته مع المخزّن وتخالف حقوله العليا حدثه الأخير، مهما كان مفتاح
 * الحدث صالحًا. القيود النوعية مشتقة من منشئات الأحداث الفعلية في الخدمات:
 * التأجيل يغيّر اليوم والسبب والحالة إلى postponed، وتغيير التوقيت لا يحرك
 * اليوم ولا السبب، والإكمال يحرك الحالة فقط، والإلغاء لا يحرك أي توقيت. */
export function validateScheduleUpdate(
  stored: ScheduleEntry | undefined,
  incoming: ScheduleEntry,
): ScheduleCommitGuardResult {
  if (stored === undefined) return { ok: false, message: SCHEDULE_MISSING_MESSAGE };
  if (incoming.events.length < 1) return { ok: false, message: SCHEDULE_STALE_MESSAGE };
  const newEvent = incoming.events[incoming.events.length - 1]!;
  if (stored.events.some(event => event.idempotencyKey === newEvent.idempotencyKey))
    return { ok: true, reused: true };
  if (incoming.events.length !== stored.events.length + 1)
    return { ok: false, message: SCHEDULE_STALE_MESSAGE };
  if (!stored.events.every((event, index) => sameScheduleEvent(event, incoming.events[index]!)))
    return { ok: false, message: SCHEDULE_STALE_MESSAGE };
  if (
    stored.id !== incoming.id ||
    stored.orderId !== incoming.orderId ||
    stored.kind !== incoming.kind ||
    stored.createdAt !== incoming.createdAt ||
    (stored.recurrenceId ?? null) !== (incoming.recurrenceId ?? null) ||
    (stored.recurrenceIndex ?? null) !== (incoming.recurrenceIndex ?? null)
  )
    return { ok: false, message: SCHEDULE_STALE_MESSAGE };
  if (
    newEvent.previousScheduledFor !== stored.scheduledFor ||
    newEvent.previousScheduledTime !== stored.scheduledTime ||
    newEvent.previousDurationMinutes !== stored.durationMinutes
  )
    return { ok: false, message: SCHEDULE_STALE_MESSAGE };
  /* العلاقة الأمامية الموحدة: حقول الموعد الواردة = الحقول الجديدة المصرّح
   * بها في الحدث الأخير — أي انحراف يعني سجلًا منفصلًا عن أحداثه. */
  if (
    incoming.scheduledFor !== newEvent.scheduledFor ||
    incoming.scheduledTime !== newEvent.scheduledTime ||
    incoming.durationMinutes !== newEvent.durationMinutes
  )
    return { ok: false, message: SCHEDULE_STALE_MESSAGE };
  /* القيود النوعية: كل نوع حدث يسمح بتغيير ما يقابله من حقول الموعد فقط —
   * الاكتمال لا يحرك التاريخ، والتوقيت لا يحرك اليوم، والإلغاء لا يحرك أي
   * توقيت، والتأجيل يوثّق حالته وسببه في الحدث نفسه. */
  if (newEvent.type === "completed") {
    if (
      incoming.status !== "completed" ||
      incoming.scheduledFor !== stored.scheduledFor ||
      incoming.scheduledTime !== stored.scheduledTime ||
      incoming.durationMinutes !== stored.durationMinutes ||
      incoming.postponeReason !== stored.postponeReason
    )
      return { ok: false, message: SCHEDULE_STALE_MESSAGE };
    return { ok: true, reused: false };
  }
  if (newEvent.type === "cancelled") {
    if (
      incoming.status !== "cancelled" ||
      incoming.scheduledFor !== stored.scheduledFor ||
      incoming.scheduledTime !== stored.scheduledTime ||
      incoming.durationMinutes !== stored.durationMinutes
    )
      return { ok: false, message: SCHEDULE_STALE_MESSAGE };
    /* سبب الإلغاء حر: المنشئ يضع في الحقل سبب الإيقاف المختصر بينما واقعة
     * الحدث تحمل العبارة الكاملة «إلغاء قالب التكرار: …» — فلا يُقيد الحقل
     * بقيمة الحدث، بل تبقى القيود البنيوية (الحالة والتوقيت) وحدها. */
    return { ok: true, reused: false };
  }
  if (newEvent.type === "postponed") {
    if (
      incoming.status !== "postponed" ||
      incoming.scheduledFor === stored.scheduledFor ||
      incoming.postponeReason !== newEvent.reason
    )
      return { ok: false, message: SCHEDULE_STALE_MESSAGE };
    return { ok: true, reused: false };
  }
  if (newEvent.type === "timing_changed") {
    if (
      incoming.status !== stored.status ||
      incoming.scheduledFor !== stored.scheduledFor ||
      incoming.postponeReason !== stored.postponeReason
    )
      return { ok: false, message: SCHEDULE_STALE_MESSAGE };
    return { ok: true, reused: false };
  }
  return { ok: false, message: SCHEDULE_STALE_MESSAGE };
}
