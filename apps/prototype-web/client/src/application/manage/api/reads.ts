/**
 * M5.1 (Manage v2 phase 5 — IMPACT §12 «Client API»): عميل قراءات مانج-في₂ —
 * نداءات GET لموديولات القراءة الخادمية (§8 الأشكال، المنتجات، سجل
 * المطابقة). العميل يستهلك الاستجابة كما هي: كل رقم مالي يصل نصًا جاهزًا.
 */
import { apiFetch } from "@/application/network";

import type {
  ManagePeriod,
  Figure,
  UnknownFigure,
  ManageFiguresResponse,
  ProjectStateResponse,
  ReconciliationLogResponse,
  SaleRow,
  SaleDetailsResponse,
  ProductItem,
  ActivityRow,
  ActivityCompoundRow,
  ActivityLogFilters,
  OperationVersion,
  BalanceLineDetails,
  ReconcileBoxDiff,
  ReconcileDiffResponse,
} from "./shapes.js";

export type {
  ManagePeriod,
  Figure,
  UnknownFigure,
  ManageFiguresResponse,
  ProjectStateResponse,
  ReconciliationLogResponse,
  SaleRow,
  SaleDetailsResponse,
  ProductItem,
  ActivityRow,
  ActivityCompoundRow,
  ActivityLogFilters,
  OperationVersion,
  BalanceLineDetails,
  ReconcileBoxDiff,
  ReconcileDiffResponse,
} from "./shapes.js";

/** M5.1 — موديول القراءة الواحد (§8/§8.2): كل رقم معروض مصدره هنا. */
export function fetchManageFigures(period: ManagePeriod = "month"): Promise<ManageFiguresResponse> {
  return apiFetch<ManageFiguresResponse>(`/api/manage-v2/figures?period=${period}`);
}

/** M5.2 — حالة المشروع: الاسم + بطاقة العودة (§7.2). */
export function fetchManageProject(): Promise<ProjectStateResponse> {
  return apiFetch<ProjectStateResponse>("/api/manage-v2/project");
}

/** M5.2 — سجل المطابقة وعلامة R-8 (تذكير P-10). */
export function fetchReconciliationLog(): Promise<ReconciliationLogResponse> {
  return apiFetch<ReconciliationLogResponse>("/api/manage-v2/reconciliations");
}

/** M5.2 — صفوف الطلب (P-10/P-12/P-20). */
export function fetchManageSaleRows(): Promise<{ sales: SaleRow[] }> {
  return apiFetch<{ sales: SaleRow[] }>("/api/manage-v2/sale-rows");
}

/** M5.4 — آخر 5 حركات (P-30 §10): صفوف C-10 بنصوص الخادم. */
export function fetchRecentActivity(): Promise<{ activity: ActivityRow[] }> {
  return apiFetch<{ activity: ActivityRow[] }>("/api/manage-v2/recent-activity");
}

/** صف السجل (M5.6 — P-41): مفرد أو مجمّع (R-28). */
export type ActivityLogRow = (ActivityRow & { compound: false }) | ActivityCompoundRow;

/** M5.6 — السجل الكامل (P-41): التجميع والفلاتر في الخادم. */
export function fetchActivityLog(filters: ActivityLogFilters = {}): Promise<{ rows: ActivityLogRow[] }> {
  const params = new URLSearchParams();
  if (filters.search !== undefined && filters.search.length > 0) params.set("search", filters.search);
  if (filters.type !== undefined) params.set("type", filters.type);
  if (filters.period !== undefined) params.set("period", filters.period);
  const query = params.toString();
  return apiFetch<{ rows: ActivityLogRow[] }>(
    `/api/manage-v2/activity${query.length > 0 ? `?${query}` : ""}`,
  );
}

/** M5.6 — تفاصيل حركة (P-42) + نسخها السابقة (P-43). */
export function fetchOperationDetails(
  operationId: string,
): Promise<OperationVersion & { previousVersions: OperationVersion[] }> {
  return apiFetch<OperationVersion & { previousVersions: OperationVersion[] }>(
    `/api/manage-v2/activity/${encodeURIComponent(operationId)}`,
  );
}

/** M5.6 — تفاصيل المستحق أو الالتزام (P-45). */
export function fetchBalanceLine(lineId: string): Promise<BalanceLineDetails> {
  return apiFetch<BalanceLineDetails>(`/api/manage-v2/line/${encodeURIComponent(lineId)}`);
}

/** فروق المطابقة واقتراح التحويل (M5.7 — P-50/P-51). */
export function fetchReconcileDiff(
  counted: Array<{ boxId: string; countedFils: number }>,
): Promise<ReconcileDiffResponse> {
  return apiFetch("/api/manage-v2/reconcile-diff", {
    method: "POST",
    body: JSON.stringify({ boxes: counted }),
  });
}

/** M5.3 — تفاصيل الطلب (P-21). */
export function fetchSaleDetails(saleId: string): Promise<SaleDetailsResponse> {
  return apiFetch<SaleDetailsResponse>(`/api/manage-v2/sale/${encodeURIComponent(saleId)}`);
}

/** M5.3 — قائمة المنتجات (P-22): النشطة والمؤرشفة (شكل الخادم حرفيًا:
 *  { active, archived } — كل منهما ProductItem[]). */
export function fetchManageProducts(): Promise<{ active: ProductItem[]; archived: ProductItem[] }> {
  return apiFetch<{ active: ProductItem[]; archived: ProductItem[] }>("/api/manage-v2/products");
}
