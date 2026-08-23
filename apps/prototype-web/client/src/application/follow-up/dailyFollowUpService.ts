/**
 * Daily follow-up: converts existing local orders and drafts into one honest next action.
 * It never derives project cash or profit; debt remains a recorded receivable after delivery.
 */
import type { CraftOrder } from "@micro-domain/craft-order/index.js";
import type { OrderDraft, PrototypeLocalStore, StoredCraftOrder } from "@/storage/local/types";

type FollowUpOrder = Pick<StoredCraftOrder, "id" | "deliveryDate"> & {
  order: Pick<CraftOrder, "itemName" | "nextAction" | "receivableMinor" | "settlementStatus" | "status">;
};
type FollowUpDraft = Pick<OrderDraft, "id" | "itemName" | "linkedOrderId">;

export type DailyFollowUp = {
  kind: "active_order" | "recorded_debt" | "draft" | "history" | "empty";
  title: string;
  truth: string;
  nextAction: string;
  href: string;
  actionLabel: string;
};

export type DailyFollowUpReadResult =
  | { ok: true; followUp: DailyFollowUp; drafts: readonly OrderDraft[]; orders: readonly StoredCraftOrder[] }
  | { ok: false; code: "storage_error"; message: string };

const isActive = (stored: FollowUpOrder) => stored.order.status !== "settled" && stored.order.status !== "cancelled";
const hasRecordedDebt = (stored: FollowUpOrder) => stored.order.settlementStatus === "debt" && stored.order.receivableMinor > 0;

export function deriveDailyFollowUp(orders: readonly FollowUpOrder[], drafts: readonly FollowUpDraft[]): DailyFollowUp {
  const activeOrder = orders.find(isActive);
  if (activeOrder) {
    return {
      kind: "active_order",
      title: activeOrder.order.itemName,
      truth: activeOrder.order.nextAction,
      nextAction: "افتح الطلب وأكمل خطوته الحالية.",
      href: `/orders/${activeOrder.id}`,
      actionLabel: "فتح الطلب",
    };
  }

  const debtOrder = orders.find(hasRecordedDebt);
  if (debtOrder) {
    return {
      kind: "recorded_debt",
      title: "تابع دينًا مسجلًا",
      truth: `${debtOrder.order.itemName}: دين مسجل بعد التسليم، وليس كاشًا محصلًا.`,
      nextAction: "افتح الطلب وراجع متابعة التحصيل المسجلة.",
      href: `/orders/${debtOrder.id}`,
      actionLabel: "فتح طلب الدين",
    };
  }

  const draft = drafts.find((candidate) => !candidate.linkedOrderId);
  if (draft) {
    return {
      kind: "draft",
      title: draft.itemName || "مسودة تحتاج وصفًا",
      truth: "هناك مسودة محلية لم تتحول إلى اتفاق بعد.",
      nextAction: "أكمل الوصف والكمية ثم احفظ ما تعرفه الآن.",
      href: `/orders/draft/${draft.id}`,
      actionLabel: "استئناف المسودة",
    };
  }

  if (orders.length > 0) {
    return {
      kind: "history",
      title: "لا توجد طلبات نشطة",
      truth: `يوجد ${orders.length} طلبات محفوظة يمكن مراجعة سجلها عند الحاجة.`,
      nextAction: "راجع سجل الطلبات أو ابدأ مسودة جديدة.",
      href: "/orders",
      actionLabel: "فتح سجل الطلبات",
    };
  }

  return {
    kind: "empty",
    title: "لا توجد طلبات بعد",
    truth: "لم تحفظ طلبًا أو مسودة محلية حتى الآن.",
    nextAction: "ابدأ بطلب مخصص واحد تعرف قصته.",
    href: "/orders/new",
    actionLabel: "بدء طلب",
  };
}

export class DailyFollowUpService {
  constructor(private readonly store: PrototypeLocalStore) {}

  async read(): Promise<DailyFollowUpReadResult> {
    const [drafts, orders] = await Promise.all([this.store.listDrafts(), this.store.listOrders()]);
    if (!drafts.ok || !orders.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة المتابعة اليومية المحلية." };
    const openDrafts = drafts.value.filter((draft) => !draft.linkedOrderId);
    return { ok: true, followUp: deriveDailyFollowUp(orders.value, openDrafts), drafts: openDrafts, orders: orders.value };
  }
}
