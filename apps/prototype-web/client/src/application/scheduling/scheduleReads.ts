/**
 * S13 (DOC-022 / UNIT-006 + UNIT-012 + SH-17 — أمر 2158b0fc §6): القراءة
 * النقية لمجتمع المواعيد — قارئ أساسي خالص بلا أي كتابة إطلاقًا (U012-R16/
 * U018-AC01/U012-ACD030): لا إنشاء مواعيد مفقودة عند القراءة (تُعرض بصدق
 * «يحتاج جدولة» وإصلاحها فعل صريح عند مالكها)، ولا مواءمة كتابية للتسليم
 * (اكتمال الموعد يُشتق عند القراءة من حالة الطلب نفسها بلا حدث مكتوب)،
 * ولا قراءة تفضيلات ولا سعة (السعة طبقة عرض اختيارية عند مالكها وحده).
 *
 * الاستهلاك: وجهة الطلبات (قائمة/تقويم) والمتابعة الموحدة (012/018) — نفس
 * المصدر الواحد؛ محرر 012 وأوامر الإنشاء/الإصلاح/المواءمة تبقى عند
 * مالكها في scheduleService بقواعدها المحروسة كما هي.
 */
import { localDatePlusDays, daysInMonthOf, isValidLocalDate } from "@micro-domain/shared/index.js";
import type { PrototypeLocalStore, ScheduleEntry, StoredCraftOrder } from "@/storage/local/types";

/** عدسة القراءة النقية — قائمتان مخزنيتان فقط، بلا أي التزام كتابة. */
export type ScheduleReadStore = Pick<PrototypeLocalStore, "listSchedules" | "listOrders">;

export type DerivedScheduleStatus = ScheduleEntry["status"];

/** موعد نشط بنيّة قراءة فقط — الاشتقاق من حالة الطلب الحية لا كتابة. */
export type ScheduleCommunityEntry = {
  schedule: ScheduleEntry;
  order: StoredCraftOrder;
  /** الحالة المعروضة: الحالة المخزنة، أو «مكتمل» مشتقًا من طلب مسلّم/مقفل. */
  derivedStatus: DerivedScheduleStatus;
};

export type ScheduleCommunity = {
  entries: readonly ScheduleCommunityEntry[];
  /** مواعيد مكتملة/ملغاة (قراءة تاريخية) — عدد فقط للعرض الصادق. */
  completedOrClosedCount: number;
  /** طلبات حية موعدها معلوم بلا موعد مخزن — تُعرض «تحتاج جدولة» بصدق. */
  datedUnscheduled: readonly StoredCraftOrder[];
  /** طلبات حية بلا موعد معلن — مدخلها الواضح في القائمة والتقويم. */
  noDateOrders: readonly StoredCraftOrder[];
  orders: readonly StoredCraftOrder[];
};

export type ScheduleReadResult =
  { ok: true; value: ScheduleCommunity } | { ok: false; code: "storage_error"; message: string };

const activeScheduleStatus = (status: DerivedScheduleStatus) =>
  status === "scheduled" || status === "postponed";
const orderLive = (stored: StoredCraftOrder) =>
  !["delivered", "settled", "cancelled"].includes(stored.order.status);

/** قراءة المجتمع كله — نقية، لا تكتب ولا تُنشئ شيئًا أبدًا. */
export async function readScheduleCommunity(store: ScheduleReadStore): Promise<ScheduleReadResult> {
  const [schedulesResult, ordersResult] = await Promise.all([store.listSchedules(), store.listOrders()]);
  if (!schedulesResult.ok) return { ok: false, code: "storage_error", message: schedulesResult.message };
  if (!ordersResult.ok) return { ok: false, code: "storage_error", message: ordersResult.message };
  const orders = ordersResult.value;
  const byId = new Map(orders.map(order => [order.id, order]));
  const entries: ScheduleCommunityEntry[] = [];
  let completedOrClosedCount = 0;
  for (const schedule of schedulesResult.value) {
    const order = byId.get(schedule.orderId);
    if (!order) continue;
    /* الاشتقاق القرائي لقاعدة الإكمال نفسها التي يطبقها المالك عند المواءمة
     * (U012-R18/R19: مرتبطة بحدث التسليم القائم) — هنا عرضًا فقط بلا حدث. */
    const closed = ["delivered", "settled"].includes(order.order.status);
    const derivedStatus: DerivedScheduleStatus =
      closed && activeScheduleStatus(schedule.status) ? "completed" : schedule.status;
    if (!activeScheduleStatus(derivedStatus) || !orderLive(order)) {
      completedOrClosedCount += 1;
      continue;
    }
    entries.push({ schedule, order, derivedStatus });
  }
  /* الطلبات الحية بلا موعد مخزن: المعلن موعده يظهر «تحتاج جدولة» (إصلاح
   * صريح عند 012)؛ والمجهول موعده (null) مدخله الواضح — لا تاريخ اليوم
   * ولا 00:00 ولا تصنيف الفشل كغياب. */
  const scheduledOrderIds = new Set(
    entries
      .map(entry => entry.schedule.orderId)
      .concat(schedulesResult.value.map(schedule => schedule.orderId)),
  );
  const datedUnscheduled: StoredCraftOrder[] = [];
  const noDateOrders: StoredCraftOrder[] = [];
  for (const order of orders) {
    if (!orderLive(order)) continue;
    if (scheduledOrderIds.has(order.id)) continue;
    if (order.deliveryDate === null) noDateOrders.push(order);
    else if (isValidLocalDate(order.deliveryDate)) datedUnscheduled.push(order);
    else noDateOrders.push(order);
  }
  return { ok: true, value: { entries, completedOrClosedCount, datedUnscheduled, noDateOrders, orders } };
}

/** موعد قراءة صالح للعرض النشط — الحالة المشتقة نشطة والطلب حي. */
export const entryIsActive = (entry: ScheduleCommunityEntry) =>
  activeScheduleStatus(entry.derivedStatus) && orderLive(entry.order);

/** المواعيد النشطة لدورة/شهر/يوم — نفس المجتمع، نوافذ عرض فقط. */
export function activeEntries(community: ScheduleCommunity): readonly ScheduleCommunityEntry[] {
  return community.entries.filter(entryIsActive);
}

export function entriesForDate(
  community: ScheduleCommunity,
  date: string,
): readonly ScheduleCommunityEntry[] {
  return activeEntries(community)
    .filter(entry => entry.schedule.scheduledFor === date)
    .sort(compareEntries);
}

/** ترتيب قراءة ثابت: التاريخ ثم الوقت المعلوم ثم الهوية (U018-R14). */
export function compareEntries(left: ScheduleCommunityEntry, right: ScheduleCommunityEntry): number {
  const date = left.schedule.scheduledFor.localeCompare(right.schedule.scheduledFor);
  if (date !== 0) return date;
  const leftTime = left.schedule.scheduledTime ?? "9999";
  const rightTime = right.schedule.scheduledTime ?? "9999";
  const time = leftTime.localeCompare(rightTime);
  if (time !== 0) return time;
  return left.schedule.id.localeCompare(right.schedule.id);
}

export type ScheduleWindow = {
  /** التواريخ الفعلية للنافذة (يوم واحد، أو 7 أيام، أو أيام الشهر). */
  dates: readonly string[];
  byDate: ReadonlyMap<string, readonly ScheduleCommunityEntry[]>;
};

/** نافذة عرض شهر/أسبوع/يوم من المجتمع نفسه — عرض لا مصدر ثانٍ. */
export function windowOf(
  community: ScheduleCommunity,
  anchorDate: string,
  mode: "month" | "week" | "day",
): ScheduleWindow {
  const dates: string[] = [];
  if (mode === "day") {
    dates.push(anchorDate);
  } else if (mode === "week") {
    for (let offset = 0; offset < 7; offset += 1)
      dates.push(localDatePlusDays(anchorDate, offset) ?? anchorDate);
  } else {
    const [year, month] = anchorDate.split("-").map(Number);
    const total = daysInMonthOf(year!, month!);
    for (let day = 1; day <= total; day += 1)
      dates.push(`${anchorDate.slice(0, 8)}${String(day).padStart(2, "0")}`);
  }
  const byDate = new Map<string, readonly ScheduleCommunityEntry[]>();
  for (const date of dates) byDate.set(date, entriesForDate(community, date));
  return { dates, byDate };
}

/** تصنيف متأخر/اليوم/قادم للعرض — تنظيم لا يكتب مالًا ولا موعدًا (SDF-013). */
export function bucketOfDate(date: string, today: string): "overdue" | "today" | "upcoming" {
  if (date < today) return "overdue";
  if (date === today) return "today";
  return "upcoming";
}

/* ─── S13 (UNIT-018 B3 — عدسة قراءة بنيوية للمتابعة الموحدة) ───
 * «قراءة أساسية خالصة تحفظ schedule.id وorder.id والموعد الحالي؛ لا استدعاء
 * الكاتب ولا جعل السعة شرطًا» — إسقاط محايد للتسليمات النشطة فقط يركّبه
 * المستدعي فوق المخزن الحي؛ القارئ الموحد (018) يستقبله بنيويًا فلا زوج
 * بيوت بين المتابعة والجدولة (حدود OD-10)، والصفحة تركّب العدسة من باب
 * البيت هذا (STR-615). لا كتابة إطلاقًا — عرض مشتق لا مصدر حقيقة ثانٍ. */

/** صف تسليم نشط للقراءة الموحدة — حقول محايدة بلا أنواع بيت الجدولة. */
export type ActiveDeliveryRow = {
  scheduleId: string;
  orderId: string;
  itemName: string;
  customerName: string | null;
  scheduledFor: string;
  scheduledTime: string | null;
};

/** عدسة التسليمات النشطة — promise مستقل اللفظ بلا كتابة أبدًا. */
export function activeDeliveryLens(store: ScheduleReadStore): {
  listActiveDeliveries: () => Promise<
    { ok: true; value: readonly ActiveDeliveryRow[] } | { ok: false; message: string }
  >;
} {
  return {
    async listActiveDeliveries() {
      const community = await readScheduleCommunity(store);
      if (!community.ok) return { ok: false as const, message: community.message };
      return {
        ok: true as const,
        value: community.value.entries
          .filter(entry => entryIsActive(entry) && entry.schedule.kind === "delivery")
          .map(entry => ({
            scheduleId: entry.schedule.id,
            orderId: entry.order.id,
            itemName: entry.order.order.itemName,
            customerName: entry.order.order.customerName || null,
            scheduledFor: entry.schedule.scheduledFor,
            scheduledTime: entry.schedule.scheduledTime,
          })),
      };
    },
  };
}
