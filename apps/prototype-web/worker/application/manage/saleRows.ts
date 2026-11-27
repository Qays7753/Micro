/**
 * M5.2 (Manage v2 phase 5 — UX §2.0 C-09 «صف الطلب»): قراءة صفوف الطلب —
 * كل ما يحتاجه صف P-10 وP-12 وP-20 من حقول C-09: الاسم (أو لnull
 * «بدون اسم») ووصف أول بند والحالة §6 ونص «المدفوع…» الخام (فلس §8.2).
 *
 * الأرقام كلها من موديول القراءة الواحد (computeManageFigures — لا تنفيذ
 * ثانٍ لأرقام §8/§8.2 أبدًا): هذه الوحدة تضيف حقول العرض وحدها (وصف أول
 * بند من sale_line) وتعيد استخدام أشكال الموديول كما هي. M5.3 تمدّها
 * بتفاصيل الطلب (P-21) من المصدر نفسه.
 */
import type postgres from "postgres";
import { computeManageFigures } from "./readModel.js";

/** صف C-09: حقول العرض + أرقام §8.2 الخام من موديول القراءة. */
export interface SaleRow {
  id: string;
  status: string;
  customerName: string | null;
  firstLineDescription: string;
  plannedDeliveryOn: string;
  deliveredOn: string | null;
  tracked: boolean;
  hiddenFromTracker: boolean;
  /** §6/§8.2: المدفوع ومنه — قبل التسليم بلا سعر نهائي: ofFils null. */
  paidFils: number;
  ofFils: number | null;
  /** «المبلغ كاملاً» = السعر النهائي − الدفعات (null بلا سعر نهائي). */
  fullAmountFils: number | null;
}

/** صفوف الطلب كلها بأشكال §8.2 + وصف أول بند. */
export async function readSaleRows(sql: postgres.Sql, projectId: string, today: string): Promise<SaleRow[]> {
  const figures = await computeManageFigures(sql, projectId, today, "month");

  // وصف أول بند لكل طلب (ترتيب الإنشاء) — قراءة عرض خالصة فوق الأشكال.
  const lines = (await sql`
    SELECT DISTINCT ON (sale_id) sale_id, description
    FROM sale_line
    WHERE project_id = ${projectId}
    ORDER BY sale_id, position`) as Array<{ sale_id: string; description: string }>;
  const firstLine = new Map(lines.map(l => [String(l.sale_id), String(l.description)]));

  return figures.salesList.map(sale => ({
    id: sale.id,
    status: sale.status,
    customerName: sale.customerName,
    firstLineDescription: firstLine.get(sale.id) ?? "",
    plannedDeliveryOn: sale.plannedDeliveryOn,
    deliveredOn: sale.deliveredOn,
    tracked: sale.tracked,
    hiddenFromTracker: sale.hiddenFromTracker,
    paidFils: sale.paid.paidFils,
    ofFils: sale.paid.ofFils,
    fullAmountFils: sale.fullAmountFils,
  }));
}
