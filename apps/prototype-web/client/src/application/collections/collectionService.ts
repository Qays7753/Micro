/**
 * المجموعة ٢ (§6 — Scope B): خدمة التحصيل — المصدر الواحد لكل عمليات التحصيل
 * من ورقة التحصيل. تقرأ الذمم القابلة للتحصيل من سجلاتها الأصلية (طلبات/مبيعات
 * مباشرة)، وتكتب التحصيل عبر المسار المملوك لنوع السجل نفسه (FulfillmentService
 * للطلبات، DirectSaleService للبيع المباشر)، ثم تُخصص الكاش المقبوض إلى المحفظة
 * المختارة عبر المسار الوحيد للتوزيع (distributeUnallocated) مع وصل المصدر.
 * التحصيل ليس إيرادًا ولا يُنشئ حدثًا ماليًا مستقلًا — الكاش والمتبقي فقط.
 */
import type { PrototypeLocalStore, StoredCraftOrder } from "@/storage/local/types";
import type { DirectSale } from "@micro-domain/direct-sale/index.js";
import type { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import type { DirectSaleService } from "@/application/direct-sales/directSaleService";
import type { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { formatMoneyWithUnit } from "@/presentation/formatters";
import { directSaleOutstandingMinor } from "@micro-domain/direct-sale/index.js";

export type ReceivableSourceKind = "order" | "direct_sale";

export type ReceivableSource = {
  id: string;
  kind: ReceivableSourceKind;
  personName: string;
  itemName: string;
  outstandingMinor: number;
  occurredOn: string;
  /** السجل المصدر الكامل — يفتح تفاصيله لا قائمة عامة. */
  sourceHref: string;
  /** حالة الدين كما تُعرض بهدوء: دين مسجل أو متبقٍ بعد التسليم أو دين بيع آجل. */
  qualifier: string;
};

export type CollectionInput = {
  sourceKind: ReceivableSourceKind;
  sourceId: string;
  amountMinor: number;
  /** وجهة الكاش: محفظة محددة أو «غير موزع» صريح. null = غير موزع بلا تخصيص. */
  walletId: string | null;
  note?: string | null;
  idempotencyKey: string;
};

export type CollectionOutcome = {
  collectedMinor: number;
  /** المتبقي على المصدر نفسه بعد هذه البوابة — صادق حتى لو صار صفرًا. */
  remainingAfterMinor: number;
  /** ما انتقل فعليًا إلى المحفظة (صفر عندما تكون الوجهة «غير الموزع»). */
  attributedToWalletMinor: number;
  walletName: string | null;
  /** (مجموعة ٤): سبب بقاء الكاش غير موزع رغم اختيار محفظة — يظهر في النتيجة لا كخطأ. */
  attributionNotice: string | null;
  /** وصلة السجل المصدر لـ«افتح السجل». */
  sourceHref: string;
  reused: boolean;
};

export type CollectionResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: "validation_error" | "storage_error" | "not_found"; message: string };

export class CollectionService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly fulfillment: FulfillmentService,
    private readonly directSales: DirectSaleService,
    private readonly projectFinance: ProjectFinancialService,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  /** الذمم القابلة للتحصيل: ديون الطلبات المسجلة + متبقي طلبات مسلّمة + ديون البيع الآجل. */
  async listReceivableSources(): Promise<CollectionResult<readonly ReceivableSource[]>> {
    const [ordersResult, salesResult] = await Promise.all([
      this.store.listOrders(),
      this.store.listDirectSales(),
    ]);
    if (!ordersResult.ok || !salesResult.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة سجلات الذمم المحلية." };

    const sources: ReceivableSource[] = [];
    for (const stored of ordersResult.value as readonly StoredCraftOrder[]) {
      const order = stored.order;
      if (order.status === "cancelled") continue;
      const isRegisteredDebt = order.settlementStatus === "debt" && order.receivableMinor > 0;
      const isDeliveredRemaining =
        order.status === "delivered" && order.receivableMinor > 0 && order.settlementStatus !== "debt";
      if (!isRegisteredDebt && !isDeliveredRemaining) continue;
      sources.push({
        id: stored.id,
        kind: "order",
        personName: order.customerName || "عميل بلا اسم",
        itemName: order.itemName || "طلب",
        outstandingMinor: order.receivableMinor,
        occurredOn: stored.updatedAt.slice(0, 10),
        sourceHref: `/orders/${stored.id}`,
        qualifier: isRegisteredDebt ? "دين مسجل بعد التسليم" : "متبقٍ بعد التسليم",
      });
    }
    for (const sale of salesResult.value as readonly DirectSale[]) {
      if ((sale.status ?? "active") !== "active") continue;
      if (sale.collectionStatus !== "partial_debt") continue;
      const outstanding = directSaleOutstandingMinor(sale);
      if (outstanding <= 0) continue;
      sources.push({
        id: sale.id,
        kind: "direct_sale",
        personName: sale.customerName?.trim() || "زبون بلا اسم",
        itemName: sale.itemName || "بيع",
        outstandingMinor: outstanding,
        occurredOn: sale.occurredOn,
        sourceHref: `/direct-sales/${sale.id}`,
        qualifier: "دين بيع آجل",
      });
    }
    sources.sort(
      (left, right) =>
        right.outstandingMinor - left.outstandingMinor ||
        left.personName.localeCompare(right.personName, "ar"),
    );
    return { ok: true, value: sources };
  }

  /** قراءة مصدر واحد مع مبلغه المستحق — لفتح الورقة من صف محدد. */
  async findSource(
    kind: ReceivableSourceKind,
    sourceId: string,
  ): Promise<CollectionResult<ReceivableSource>> {
    const list = await this.listReceivableSources();
    if (!list.ok) return list;
    const source = list.value.find(item => item.kind === kind && item.id === sourceId);
    if (!source)
      return {
        ok: false,
        code: "not_found",
        message: "لا توجد ذمة قابلة للتحصيل بهذا السجل — ربما حُصّلت كاملة أو أُلغيت.",
      };
    return { ok: true, value: source };
  }

  /** التحصيل عبر المسار المملوك للمصدر ثم تخصيص الكاش — كتابة واحدة موثقة لكل مسار. */
  async collect(input: CollectionInput): Promise<CollectionResult<CollectionOutcome>> {
    const source = await this.findSource(input.sourceKind, input.sourceId);
    if (!source.ok) return source;
    if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0)
      return { ok: false, code: "validation_error", message: "أدخل مبلغ التحصيل رقمًا صحيحًا موجبًا." };
    if (input.amountMinor > source.value.outstandingMinor)
      return {
        ok: false,
        code: "validation_error",
        message: `التحصيل يتجاوز المتبقي على ${source.value.personName} — المتبقي ${formatMoneyWithUnit(source.value.outstandingMinor)} والمطلوب ${formatMoneyWithUnit(input.amountMinor)}. حصّل المتبقي أو أقل منه.`,
      };

    let remainingAfterMinor: number;
    let reused = false;
    if (input.sourceKind === "order") {
      const result = await this.fulfillment.collectFromSheet(
        input.sourceId,
        input.amountMinor,
        input.idempotencyKey,
      );
      if (!result.ok)
        return { ok: false, code: "validation_error", message: result.message };
      remainingAfterMinor = result.stored.order.receivableMinor;
    } else {
      const saleResult = await this.directSales.get(input.sourceId);
      if (!saleResult.ok) return { ok: false, code: "storage_error", message: saleResult.message };
      const sale = saleResult.value;
      if (!sale) return { ok: false, code: "not_found", message: "بيع مباشر غير موجود." };
      const collectedMinor = sale.collectedMinor + input.amountMinor;
      /* التحصيل لا يمس بيانات البيع الأخرى: الزبون والكتالوج كما هما،
       * والتحديث يرفع المقبوض فقط ويعلن حالته الصادقة. */
      const update = await this.directSales.update(input.sourceId, {
        itemName: sale.itemName,
        quantity: sale.quantity,
        revenueMinor: sale.revenueMinor,
        collectedMinor,
        collectionStatus: collectedMinor >= sale.revenueMinor ? "collected_in_full" : "partial_debt",
        catalogItemId: sale.catalogItemId,
        customerName: sale.customerName ?? undefined,
        costMinor: sale.costMinor,
        occurredOn: sale.occurredOn,
        note: sale.note,
        idempotencyKey: input.idempotencyKey,
        expectedRevisionCount: sale.revisions?.length ?? 0,
      });
      if (!update.ok) return { ok: false, code: "validation_error", message: update.message };
      reused = update.reused ?? false;
      remainingAfterMinor = Math.max(update.value.revenueMinor - update.value.collectedMinor, 0);
    }

    /* وجهة الكاش صريحة: محفظة مختارة أو «غير موزع» — لا اختيار صامت أبدًا. */
    let attributedToWalletMinor = 0;
    let walletName: string | null = null;
    let attributionNotice: string | null = null;
    if (input.walletId) {
      const attribution = await this.projectFinance.distributeUnallocated({
        walletId: input.walletId,
        deltaMinor: input.amountMinor,
        note: input.note?.trim() || `تحصيل من ${source.value.personName} — ${source.value.itemName}`,
        operationKey: `${input.idempotencyKey}:attribute`,
        sourceRefId: input.sourceId,
        sourceRefKind: input.sourceKind === "order" ? "order" : "sale",
        /* المجموعة ٦ (S2-04أ): حدث القبضة المصدر — معرّف الحدث حتمي في النطاق
         * (orderId:idempotencyKey) فيُربط التخصيص بسطر التحصيل نفسه، ويصير
         * التراجع المزدوج «القبضة مع تخصيصها» قابلًا للمطابقة بلا تخمين. */
        sourceRefLineId:
          input.sourceKind === "order" ? `${input.sourceId}:${input.idempotencyKey}` : null,
      });
      if (attribution.ok) {
        reused = reused || (attribution.reused ?? false);
        attributedToWalletMinor = input.amountMinor;
        const wallets = await this.store.listCashWallets();
        walletName =
          wallets.ok ? wallets.value.find(wallet => wallet.id === input.walletId)?.name ?? null : null;
      } else {
        /* (إصلاح تكاملي — مجموعة ٤): التحصيل والقبض سُجّلا قبل النسبة — فشل التخصيص
         * لا يعلن فشل التحصيل كله (كان يعيد خطأً بعد كتابةٍ نفّذت فعلًا: دين نقص
         * وكاش هبط في غير الموزع والرسالة تقول «لن يُسجّل»). المال لا يُفقد — يبقى
         * غير موزع ويعرض السبب في النتيجة، بنفس معيار محرر البيع المباشر. */
        attributionNotice = attribution.message;
      }
    }

    return {
      ok: true,
      value: {
        collectedMinor: input.amountMinor,
        remainingAfterMinor,
        attributedToWalletMinor,
        walletName,
        attributionNotice,
        sourceHref: source.value.sourceHref,
        reused,
      },
    };
  }
}
