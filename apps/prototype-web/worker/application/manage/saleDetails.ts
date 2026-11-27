/**
 * M5.3 (Manage v2 phase 5 — UX P-21 «تفاصيل الطلب»): قراءة تفاصيل الطلب —
 * كل ما تحتاجه شاشة P-21: الطلب بحالته §6 ومؤشراته §8.2 (من موديول القراءة
 * الواحد — لا تنفيذ ثانٍ)، والبنود بلقطها §3.5، وحركات التوصيل المرتبطة،
 * والسجل المالي (كل عملية مرتبطة كصف C-10 بمبلغها المنسّق ووسومها).
 *
 * الوحدة تُنمّي الأشكال (computeManageFigures) لكل أرقام §8/§8.2 وتضيف
 * حقول العرض وحدها (البنود، التوصيل، السجل، الملاحظة). كل نص مالي يُنسّق
 * هنا بثلاث منازل (R-1a/R-20) — العميل يعرض كما ورد.
 */
import type postgres from "postgres";
import { computeManageFigures } from "./readModel.js";
import { jodTextFromFils } from "../../../../../src/domain/manage/money/index.js";
import { ammanDateString } from "../../clock.ts";

/** بند الطلب (لقطة §3.5) + وحدة عرض المنتج الحالية (لا تحملها اللقطة). */
export interface SaleLineView {
  id: string;
  productId: string | null;
  description: string;
  quantityMilli: number;
  unitPriceFils: number | null;
  unitLabel: string | null;
}

/** حركة توصيل مرتبطة (OP-SALE-DELIVERY-COST). */
export interface SaleDeliveryCostView {
  operationId: string;
  amountFils: number;
  amountText: string;
  source: string;
  effectiveOn: string;
}

/** صف السجل المالي (C-10) لعملية مرتبطة بالطلب. */
export interface SaleOperationRow {
  operationId: string;
  kind: string;
  effectiveOn: string;
  /** مبلغ العرض (§3.7 amount_minor) منسّقًا — null بلا مبلغ عرض. */
  amountFils: number | null;
  amountText: string | null;
  status: string;
  /** صحيح: هذه نسخة استبدال (تعديل — OP-CORRECT). */
  corrected: boolean;
  boxKind: string | null;
  category: string | null;
}

/** استجابة تفاصيل الطلب (P-21). */
export interface SaleDetailsResponse {
  sale: {
    id: string;
    status: string;
    customerName: string | null;
    registeredOn: string;
    plannedDeliveryOn: string;
    deliveredOn: string | null;
    finalPriceFils: number | null;
    finalPriceText: string | null;
    tracked: boolean;
    hiddenFromTracker: boolean;
    note: string | null;
    prepaymentFils: number;
    expectedProfitFils: number | null;
    netSaleRevenueFils: number;
    fullAmountFils: number | null;
    paidFils: number;
    paidOfFils: number | null;
    /** متبقي خط «رد لعميل» مفتوح إن وُجد (S-REFUND-DUE). */
    customerRefundDueFils: number | null;
    customerRefundDueText: string | null;
    /** M5.3 (P-21 §4): «آخر تعديل {date}» — تاريخ آخر تعديل حقول غير مالية
     *  على الطلب (sale.updated_at الأحدث من الإنشاء — R-17/D-14: تحديث حقل
     *  مباشر بلا عملية) بتاريخ عمّان؛ null إذا لم يُعدّل قط (السطر يسقط). */
    lastEditOn: string | null;
  };
  /** M5.3 (P-21 «الحالات»): عدد الصناديق النشطة — صفوف السجل تعرض الصندوق
   *  مع صندوقين فقط (C-10). */
  boxesCount: number;
  lines: SaleLineView[];
  deliveryCosts: SaleDeliveryCostView[];
  history: SaleOperationRow[];
}

/** خطأ «طلب غير موجود» — المسار يحوّله إلى 404 الموحد (R-24). */
export class SaleDetailsNotFound extends Error {
  constructor() {
    super("sale not found");
  }
}

function money(fils: number): string {
  return `${jodTextFromFils(fils)} د`;
}

/** تفاصيل الطلب — الأرقام من موديول القراءة الواحد وحقول العرض فوقها. */
export async function readSaleDetails(
  sql: postgres.Sql,
  projectId: string,
  saleId: string,
  today: string,
): Promise<SaleDetailsResponse> {
  const figures = await computeManageFigures(sql, projectId, today, "month");
  const saleFigure = figures.salesList.find(s => s.id === saleId);
  if (saleFigure === undefined) {
    throw new SaleDetailsNotFound();
  }

  const saleRow = (await sql`
    SELECT customer_name, note, hidden_from_tracker, created_at, updated_at FROM sale
    WHERE id = ${saleId} AND project_id = ${projectId}`) as Array<{
    customer_name: string | null;
    note: string | null;
    hidden_from_tracker: boolean;
    created_at: Date | string;
    updated_at: Date | string;
  }>;
  /* الإنشاء نفسه يضبط updated_at (now() عند الإدراج) — «آخر تعديل» هو
   * التعديل اللاحق للإنشاء فقط: updated_at الأحدث من created_at بمعاملة
   * صارمة (كل تعديل معاملة مستقلة لا تحدث في اللحظة نفسها). */
  const lastEditDate =
    saleRow[0] === undefined ||
    new Date(saleRow[0].updated_at).getTime() <= new Date(saleRow[0].created_at).getTime()
      ? null
      : ammanDateString(new Date(saleRow[0].updated_at).getTime());

  const lineRows = (await sql`
    SELECT l.id, l.product_id, l.description, l.quantity_milli, l.unit_price_minor,
           p.unit_label
    FROM sale_line l
    LEFT JOIN product p ON p.id = l.product_id AND p.project_id = l.project_id
    WHERE l.sale_id = ${saleId} AND l.project_id = ${projectId}
    ORDER BY l.position`) as Array<{
    id: string;
    product_id: string | null;
    description: string;
    quantity_milli: number;
    unit_price_minor: string | number | null;
    unit_label: string | null;
  }>;
  const lines: SaleLineView[] = lineRows.map(l => ({
    id: String(l.id),
    productId: l.product_id === null ? null : String(l.product_id),
    description: String(l.description),
    quantityMilli: Number(l.quantity_milli),
    unitPriceFils: l.unit_price_minor === null ? null : Number(l.unit_price_minor),
    unitLabel: l.unit_label === null ? null : String(l.unit_label),
  }));

  // حركات التوصيل المرتبطة (مصدر كل وحدة: ترحيلات BOX أو «شخصي»).
  const deliveryRows = (await sql`
    SELECT o.id, o.effective_on::text AS effective_on, o.amount_minor,
           CASE WHEN EXISTS (
             SELECT 1 FROM ledger_entry e2 JOIN ledger_posting p2 ON p2.entry_id = e2.id
             WHERE e2.operation_id = o.id AND p2.account = 'BOX'
           ) THEN
             (SELECT k.kind FROM ledger_entry e3
              JOIN ledger_posting p3 ON p3.entry_id = e3.id
              JOIN box k ON k.id = p3.ref_id AND k.project_id = e3.project_id
              WHERE e3.operation_id = o.id AND p3.account = 'BOX' LIMIT 1)
           ELSE 'personal' END AS source
    FROM operation o
    WHERE o.sale_id = ${saleId} AND o.project_id = ${projectId}
      AND o.kind = 'OP-SALE-DELIVERY-COST' AND o.status = 'active'
    ORDER BY o.effective_on, o.created_at`) as Array<{
    id: string;
    effective_on: string;
    amount_minor: string | number | null;
    source: string | null;
  }>;
  const deliveryCosts: SaleDeliveryCostView[] = deliveryRows.map(d => ({
    operationId: String(d.id),
    amountFils: d.amount_minor === null ? 0 : Number(d.amount_minor),
    amountText: money(d.amount_minor === null ? 0 : Number(d.amount_minor)),
    source: d.source ?? "personal",
    effectiveOn: String(d.effective_on),
  }));

  // السجل المالي: كل عملية مرتبطة بالطلب (الأحدث أولًا) بوسومها.
  const historyRows = (await sql`
    SELECT o.id, o.kind, o.effective_on::text AS effective_on, o.amount_minor, o.status,
           o.corrects_operation_id IS NOT NULL AS corrected, o.category,
           (SELECT k.kind FROM ledger_entry e
            JOIN ledger_posting p ON p.entry_id = e.id
            JOIN box k ON k.id = p.ref_id AND k.project_id = e.project_id
            WHERE e.operation_id = o.id AND p.account = 'BOX' LIMIT 1) AS box_kind
    FROM operation o
    WHERE o.sale_id = ${saleId} AND o.project_id = ${projectId}
    ORDER BY o.effective_on DESC, o.created_at DESC`) as Array<{
    id: string;
    kind: string;
    effective_on: string;
    amount_minor: string | number | null;
    status: string;
    corrected: boolean;
    category: string | null;
    box_kind: string | null;
  }>;
  const history: SaleOperationRow[] = historyRows.map(o => ({
    operationId: String(o.id),
    kind: String(o.kind),
    effectiveOn: String(o.effective_on),
    amountFils: o.amount_minor === null ? null : Number(o.amount_minor),
    amountText: o.amount_minor === null ? null : money(Number(o.amount_minor)),
    status: String(o.status),
    corrected: Boolean(o.corrected),
    boxKind: o.box_kind === null ? null : String(o.box_kind),
    category: o.category === null ? null : String(o.category),
  }));

  // متبقي خط «رد لعميل» مفتوح على هذا الطلب (S-REFUND-DUE) — §3.6: الخط
  // مرتبط بالطلب عبر sale_id؛ المتبقي مجموع ترحيلاته (كما في موديول القراءة).
  const openRefundRow = (await sql`
    SELECT l.id,
           COALESCE((SELECT SUM(p.delta_minor) FROM ledger_posting p
                     JOIN ledger_entry e ON e.id = p.entry_id
                     WHERE p.account = 'AP' AND p.ref_id = l.id), 0) AS outstanding
    FROM balance_line l
    WHERE l.sale_id = ${saleId} AND l.project_id = ${projectId}
      AND l.direction = 'by_me' AND l.kind = 'customer_refund'
    ORDER BY l.origin_on LIMIT 1`) as Array<{ id: string; outstanding: string | number }>;
  const openRefundFils =
    openRefundRow.length === 0 ? null : Math.max(Number(openRefundRow[0]!.outstanding), 0);
  const openRefund =
    openRefundFils === null || openRefundFils === 0
      ? undefined
      : { outstandingFils: openRefundFils, text: money(openRefundFils) };

  // M5.3 (P-21 «الحالات»): عدد الصناديق النشطة — الصندوق بصفوف السجل مع
  // صندوقين فقط (C-10: «الصندوق (مع صندوقين بس)»). قراءة عدّ خالصة.
  const boxRows = (await sql`
    SELECT COUNT(*)::int AS n FROM box
    WHERE project_id = ${projectId} AND status = 'active'`) as Array<{ n: number }>;

  return {
    sale: {
      id: saleFigure.id,
      status: saleFigure.status,
      customerName: saleFigure.customerName,
      registeredOn: saleFigure.registeredOn,
      plannedDeliveryOn: saleFigure.plannedDeliveryOn,
      deliveredOn: saleFigure.deliveredOn,
      finalPriceFils: saleFigure.finalPriceFils,
      finalPriceText: saleFigure.finalPriceFils === null ? null : money(saleFigure.finalPriceFils),
      tracked: saleFigure.tracked,
      hiddenFromTracker: saleFigure.hiddenFromTracker,
      note: saleRow[0]?.note ?? null,
      prepaymentFils: saleFigure.prepaymentFils,
      expectedProfitFils: saleFigure.expectedProfitFils,
      netSaleRevenueFils: saleFigure.netSaleRevenueFils,
      fullAmountFils: saleFigure.fullAmountFils,
      paidFils: saleFigure.paid.paidFils,
      paidOfFils: saleFigure.paid.ofFils,
      customerRefundDueFils: openRefund === undefined ? null : openRefund.outstandingFils,
      customerRefundDueText: openRefund === undefined ? null : openRefund.text,
      /* P-21 §4: آخر تعديل حقول غير مالية (updated_at) بتاريخ عمّان؛
       * لم يُعدّل قط ← null والسطر يسقط من الشاشة. */
      lastEditOn: lastEditDate,
    },
    boxesCount: boxRows[0] === undefined ? 0 : Number(boxRows[0].n),
    lines,
    deliveryCosts,
    history,
  };
}
