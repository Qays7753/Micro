/**
 * M5.4 (Manage v2 phase 5 — UX P-30 §10 «قسم الحركات»): آخر 5 حركات —
 * صفوف C-10 كما يحتاجها P-30 (السجل الكامل بفلاتره P-41 مهمة M5.6).
 *
 * الأرقام منسّقة هنا بثلاث منازل (R-1a/R-20) — العميل يعرض كما ورد؛ لا
 * معادلة ولا تحويل في الواجهة. حالة الطلب §6 من موديول القراءة الواحد
 * نفسه (لا تنفيذ ثانٍ — جدول الطلب لا يحملها أصلًا)؛ الأسماء: الطرف
 * المخزن على العملية، وإلا اسم عميل الطلب المرتبط، وإلا الملاحظة.
 */
import type postgres from "postgres";
import { computeManageFigures } from "./readModel.js";
import { jodTextFromFils } from "../../../../../src/domain/manage/money/index.js";

/** صف الحركة (C-10) كما يعرضه P-30. */
export interface ActivityRow {
  operationId: string;
  kind: string;
  effectiveOn: string;
  /** الاسم أو الوصف: الطرف المخزن، وإلا عميل الطلب، وإلا الملاحظة. */
  name: string | null;
  /** §3.7 amount_minor منسّقًا — null بلا مبلغ عرض. */
  amountText: string | null;
  /** «منها توصيل {amount}» N-16 — لمصروف فيه توصيل فقط. */
  deliveryCostText: string | null;
  boxKind: string | null;
  /** صحيح: نسخة استبدال (تعديل — OP-CORRECT). */
  corrected: boolean;
  /** صحيح: العملية ملغاة (معكوسة). */
  cancelled: boolean;
  /** معرف الطلب المرتبط (كبسة صف البيع ← P-21) — غيرها null. */
  saleId: string | null;
  /** حالة الطلب §6 لصفوف البيع (C-10: صف البيع يعرضها) — غيرها null. */
  saleStatus: string | null;
  /** تسمية جدول ج-١ الشرطية: اتجاه السابق/مصدر الإيداع/نوع السحب/
   *  تصنيف المصروف — من payload العملية (لا تخمين في العميل). */
  variant: string | null;
  category: string | null;
}

function money(fils: number): string {
  return `${jodTextFromFils(fils)} د`;
}

/** آخر حركات المشروع (الأحدث أولًا) — P-30 §10: حد 5 ثابت. */
export async function readRecentActivity(
  sql: postgres.Sql,
  projectId: string,
  today: string,
  limit = 5,
): Promise<ActivityRow[]> {
  /* حالة الطلب §6 المشخصة من موديول القراءة الواحد (مصدرها الوحيد). */
  const figures = await computeManageFigures(sql, projectId, today, "month");
  const saleStatus = new Map(figures.salesList.map(sale => [sale.id, sale.status]));

  const rows = (await sql`
    SELECT o.id, o.kind, o.effective_on::text AS effective_on, o.counterparty_name, o.note,
           o.amount_minor, o.delivery_cost_minor, o.category, o.payload,
           o.corrects_operation_id IS NOT NULL AS corrected, o.status, o.sale_id,
           (SELECT k.kind FROM ledger_entry e
            JOIN ledger_posting p ON p.entry_id = e.id
            JOIN box k ON k.id = p.ref_id AND k.project_id = e.project_id
            WHERE e.operation_id = o.id AND p.account = 'BOX' LIMIT 1) AS box_kind,
           s.customer_name AS sale_customer_name
    FROM operation o
    LEFT JOIN sale s ON s.id = o.sale_id AND s.project_id = o.project_id
    WHERE o.project_id = ${projectId}
    ORDER BY o.effective_on DESC, o.created_at DESC
    LIMIT ${limit}`) as Array<{
    id: string;
    kind: string;
    effective_on: string;
    counterparty_name: string | null;
    note: string | null;
    amount_minor: string | number | null;
    delivery_cost_minor: string | number | null;
    category: string | null;
    payload: Record<string, unknown> | string | null;
    corrected: boolean;
    status: string;
    sale_id: string | null;
    box_kind: string | null;
    sale_customer_name: string | null;
  }>;
  /* ج-١ الشرطية من payload المخزن (لا منطق عمل — قراءة حقل معلن). العملية
   * تُخزّن payload عبر JSON.stringify في عمود JSON (سابقة operationHandler)
   * فيصل نصًا؛ يُقرأ كما خُزّن، والشكل الفاشل يُعلن فارغًا لا بتخمين. */
  function payloadOf(raw: unknown): Record<string, unknown> | null {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === "string") {
      try {
        const parsed: unknown = JSON.parse(raw);
        return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
      } catch {
        return null;
      }
    }
    return typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  }
  function variantOf(kind: string, rawPayload: unknown): string | null {
    const payload = payloadOf(rawPayload);
    if (payload === null) return null;
    if (kind === "OP-ADD-PRIOR-BALANCE") {
      const direction = payload.direction;
      return direction === "to_me" || direction === "by_me" ? direction : null;
    }
    if (kind === "OP-OWNER-DEPOSIT") {
      const source = payload.source as { type?: unknown } | undefined;
      return source?.type === "borrowed" ? "borrowed" : "personal";
    }
    if (kind === "OP-OWNER-WITHDRAWAL") {
      const type = payload.type as { type?: unknown } | string | undefined;
      const kindOf = typeof type === "object" && type !== null ? type.type : type;
      return kindOf === "loan_given" ? "loan_given" : "personal";
    }
    return null;
  }
  return rows.map(o => ({
    operationId: String(o.id),
    kind: String(o.kind),
    effectiveOn: String(o.effective_on),
    name:
      o.counterparty_name !== null && o.counterparty_name.length > 0
        ? String(o.counterparty_name)
        : o.sale_customer_name !== null && o.sale_customer_name.length > 0
          ? String(o.sale_customer_name)
          : o.note !== null && o.note.length > 0
            ? String(o.note)
            : null,
    amountText: o.amount_minor === null ? null : money(Number(o.amount_minor)),
    /* C-10: «منها توصيل {amount}» — لمصروف فيه توصيل فقط (N-16). */
    deliveryCostText:
      o.delivery_cost_minor === null || Number(o.delivery_cost_minor) === 0
        ? null
        : money(Number(o.delivery_cost_minor)),
    boxKind: o.box_kind === null ? null : String(o.box_kind),
    corrected: Boolean(o.corrected),
    cancelled: String(o.status) === "reversed",
    saleId: o.sale_id === null ? null : String(o.sale_id),
    saleStatus: o.sale_id === null ? null : (saleStatus.get(String(o.sale_id)) ?? null),
    variant: variantOf(String(o.kind), o.payload),
    category: o.category === null ? null : String(o.category),
  }));
}
