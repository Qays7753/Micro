/**
 * M5.1 (Manage v2 phase 5 — IMPACT §12 «Client API»): عميل كتابات مانج-في₂
 * — نداءات POST لعمليات §5 عبر منفذ الشبكة الواحد.
 *
 * العقد (ملزم لكل دالة هنا):
 *  - العميل **رفيع**: يرسل المدخلات (فلس صحيح من presentation) ومفتاح
 *    تكرار لكل كتابة (R-25/T55: إعادة المحاولة بالمفتاح نفسه لا تكرر
 *    العملية أبدًا) ويُرجع نتيجة الخادم كما هي — لا رياضيات ولا قرارات.
 *  - أنواع الاستجابة تعكس شكل الخادن حرفيًا (ManageOperationOutcome من
 *    معالج M2.4) لكنها معرّفة هنا محليًا: R10 يمنع استيراد العميل من مجال
 *    مانج ومن عامل الخادم معًا — هذا عقد العميل المستقل لقناة HTTP.
 *  - كل الأفعال متصلة (R-23): الفشل بالشبكة يظهر E-OFFLINE على السطح
 *    ولا يُحفظ شيء (T56) — قرار العرض عند الصفحة، لا هنا.
 */
import { apiFetch, newIdempotencyKey } from "@/application/network";

/** نتيجة العملية المحفوظة كما يرجعها معالج M2.4 (replay يرجعها حرفيًا). */
export interface ManageOperationResult {
  operationId: string;
  kind: string;
  effectiveOn: string;
  amountFils: number | null;
  entryIds: string[];
  data?: Record<string, unknown>;
}

/** مخرج العملية: applied أول حفظ، replay إعادة نداء بالمفتاح نفسه. */
export interface ManageWriteOutcome {
  outcome: "applied" | "replay";
  result: ManageOperationResult;
}

function manageWrite<T>(path: string, body: Record<string, unknown>, requestId: string): Promise<T> {
  return apiFetch<T>(path, { method: "POST", body: JSON.stringify(body) }, { idempotencyKey: requestId });
}

/** فتحة افتتاح صندوق OP-SETUP: {unknown:true} أو {openingFils} صحيح. */
export type SetupBoxOpening = { unknown: true } | { openingFils: number };

export interface SetupBoxSlot {
  kind: "cash" | "account";
  opening: SetupBoxOpening;
}

/** مفتاح طلب مولّد للكتابات غير المعملية بمعرف الطلب (R-25). */
function freshRequestId(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID() ?? Math.random()}`;
}

/** M5.2 — كشف الانقطاع (§7.2-1): على فتح التطبيق — كتابة مباشرة حتيمية
 *  بالحالة (ليست عملية؛ المفتوح يتمدد لا يتكرر). */
export function detectAbsence(): Promise<{ absence: unknown }> {
  return manageWrite("/api/manage-v2/absence-detect", {}, freshRequestId("absence"));
}

/** M5.2 — تعديل اسم المشروع (P-11، R-17: بلا أثر مالي). */
export function renameProject(name: string): Promise<{ projectId: string; name: string }> {
  return manageWrite("/api/manage-v2/project-name", { name }, freshRequestId("rename"));
}

/** M5.2 — OP-COLLECT (§5): تحصيل (P-13: كامل المتبقي فورًا بصندوق واحد). */
export function collectPayment(input: {
  requestId: string;
  amountFils: number;
  box: "cash" | "account";
  balanceLineId?: string;
  counterpartyName?: string;
  effectiveOn?: string;
  shortfall?: "keep_outstanding" | "write_off";
  priorBalance?: boolean;
}): Promise<ManageWriteOutcome> {
  return manageWrite("/api/manage-v2/collect", { ...input }, input.requestId);
}

/** M5.2 — OP-PAY (§5): سداد (P-13: كامل متبقيها فورًا). */
export function payDebt(input: {
  requestId: string;
  amountFils: number;
  box: "cash" | "account";
  balanceLineId?: string;
  counterpartyName?: string;
  effectiveOn?: string;
  priorBalance?: boolean;
}): Promise<ManageWriteOutcome> {
  return manageWrite("/api/manage-v2/pay", { ...input }, input.requestId);
}

/** M5.3 — إخفاء من المتتبّع (P-21: الحذف من هنا وحده؛ إخفاء بلا أثر مالي T31). */
export function hideSaleFromTracker(saleId: string): Promise<{ sale: unknown }> {
  return manageWrite("/api/manage-v2/tracker-hide", { saleId }, freshRequestId("hide"));
}

/** M5.3 — إضافة إلى المتتبّع (من الحركات: بيع غير ظاهر — بلا أثر مالي). */
export function addSaleToTracker(saleId: string): Promise<{ sale: unknown }> {
  return manageWrite("/api/manage-v2/tracker-add", { saleId }, freshRequestId("add"));
}

/** M5.3 — حفظ منتج (إنشاء/تحديث — P-23، تحديث مباشر نمط المنتجات). */
export function saveManageProduct(input: {
  productId: string;
  name: string;
  unitLabel?: string;
  unitPriceFils: number;
  components?: Array<{ name: string; costFils: number }>;
}): Promise<{
  product: {
    productId: string;
    name: string;
    unitLabel: string | null;
    unitPriceFils: number;
    unitCostFils: number | null;
    archived: boolean;
  };
}> {
  return manageWrite("/api/manage-v2/products", { ...input }, freshRequestId("product"));
}

/** M5.3 — أرشيفة/إلغاءها (P-24). */
export function archiveManageProduct(productId: string, archived: boolean): Promise<{ product: unknown }> {
  return manageWrite("/api/manage-v2/products/archive", { productId, archived }, freshRequestId("archive"));
}

/** M5.1 — OP-SETUP (§5): إنشاء المشروع وفتح الصناديك بقيود Q1. */
export function setupProject(input: {
  requestId: string;
  projectName: string;
  boxes: SetupBoxSlot[];
}): Promise<ManageWriteOutcome> {
  return manageWrite(
    "/api/manage-v2/setup",
    { requestId: input.requestId, projectName: input.projectName, boxes: input.boxes },
    input.requestId,
  );
}

/** M5.5 — OP-ADD-BOX (§5، P-38): إضافة الصندوق الناقص (الحساب دائمًا من
 *  الواجهة — النقد موجود من البداية) بافتتاحه: Q1 اليوم إذا معروف. */
export function addManageBox(input: {
  requestId: string;
  kind: "cash" | "account";
  opening: SetupBoxOpening;
}): Promise<ManageWriteOutcome> {
  return manageWrite(
    "/api/manage-v2/add-box",
    { requestId: input.requestId, kind: input.kind, opening: input.opening },
    input.requestId,
  );
}

/** M5.6 — OP-ADD-PRIOR-BALANCE (§5، P-46): تسجيل مبلغ من قبل للمتابعة
 *  فقط — Q2/Q3 بلا حركة فلوس (لا يربح ولا يخسر). */
export function addPriorBalance(input: {
  requestId: string;
  direction: "to_me" | "by_me";
  counterpartyName: string;
  amountFils: number;
  originOn?: string;
}): Promise<ManageWriteOutcome> {
  return manageWrite("/api/manage-v2/add-prior-balance", { ...input }, input.requestId);
}

/** M5.5 — OP-MERGE-BOXES (§5، P-39): دمج الصندوقين — Q14 يُصفّر الحساب
 *  إلى النقد ثم يُدمج صف الحساب. لا مدخلات. */
export function mergeManageBoxes(requestId: string): Promise<ManageWriteOutcome> {
  return manageWrite("/api/manage-v2/merge-boxes", { requestId }, requestId);
}

/** M5.5 — OP-SPLIT-BOXES (§5، P-40): فصل الصندوقين — إعادة تفعيل الحساب
 *  المدموج + مبلغ المستخدم قيدًا نقد→حساب (0 = تفعيل بلا قيد). */
export function splitManageBoxes(input: {
  requestId: string;
  amountFils: number;
}): Promise<ManageWriteOutcome> {
  return manageWrite(
    "/api/manage-v2/split-boxes",
    { requestId: input.requestId, amountFils: input.amountFils },
    input.requestId,
  );
}
