/**
 * M5.6 (Manage v2 phase 5 — UX P-42 «تفاصيل الحركة» + P-43 «النسخ
 * السابقة» + P-45 «تفاصيل المستحق أو الالتزام» + §3.7): قراءات تفصيلية —
 * الحركة بحقول عرضها (المبلغ والصندوق أو «من مالي الشخصي» والاسم أو
 * التصنيف والملاحظة والطلب المرتبط) وسلسلة نسخها السابقة، وخط الرصيد
 * بحركاته صفوف C-10. كل رقم من موديول القراءة الواحد أو من صف العملية
 * نفسه (§3.7) — لا تنفيذ ثانٍ.
 */
import type postgres from "postgres";
import { computeManageFigures } from "./readModel.js";
import { jodTextFromFils } from "../../../../../src/domain/manage/money/index.js";
import type { ActivityRow } from "./activityRows.js";

function money(fils: number): string {
  return `${jodTextFromFils(fils)} د`;
}

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

function variantOf(kind: string, payload: Record<string, unknown> | null): string | null {
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

/** تفاصيل الحركة (P-42) — نسخة واحدة بمحتواها وأزرارها. */
export interface OperationVersion {
  operationId: string;
  kind: string;
  effectiveOn: string;
  amountText: string | null;
  deliveryCostText: string | null;
  boxKind: string | null;
  /** «من مالي الشخصي» — مصروف دفع من المال الشخصي (payload.source). */
  personalMoney: boolean;
  name: string | null;
  category: string | null;
  note: string | null;
  saleId: string | null;
  saleStatus: string | null;
  corrected: boolean;
  cancelled: boolean;
  variant: string | null;
}

export interface OperationDetails extends OperationVersion {
  /** سلسلة النسخ السابقة (P-43): من الأحدث إلى الأقدم — كل نسخة كما سُجلت. */
  previousVersions: OperationVersion[];
}

/** Not found — R-24's unified 404 shape for the route. */
export class OperationNotFound extends Error {}
export class LineNotFound extends Error {}

interface RawRow {
  id: string;
  kind: string;
  effective_on: string;
  counterparty_name: string | null;
  note: string | null;
  amount_minor: string | number | null;
  delivery_cost_minor: string | number | null;
  category: string | null;
  payload: unknown;
  corrected: boolean;
  status: string;
  sale_id: string | null;
  box_kind: string | null;
  sale_customer_name: string | null;
}

function toVersion(o: RawRow, saleStatus: Map<string, string>): OperationVersion {
  const payload = payloadOf(o.payload);
  return {
    operationId: String(o.id),
    kind: String(o.kind),
    effectiveOn: String(o.effective_on),
    amountText: o.amount_minor === null ? null : money(Number(o.amount_minor)),
    deliveryCostText:
      o.delivery_cost_minor === null || Number(o.delivery_cost_minor) === 0
        ? null
        : money(Number(o.delivery_cost_minor)),
    boxKind: o.box_kind === null ? null : String(o.box_kind),
    personalMoney:
      String(o.kind) === "OP-EXPENSE" &&
      payload !== null &&
      (payload as { source?: unknown }).source === "personal",
    name:
      o.counterparty_name !== null && o.counterparty_name.length > 0
        ? String(o.counterparty_name)
        : o.sale_customer_name !== null && o.sale_customer_name.length > 0
          ? String(o.sale_customer_name)
          : o.note !== null && o.note.length > 0
            ? String(o.note)
            : null,
    category: o.category === null ? null : String(o.category),
    note: o.note === null || o.note.length === 0 ? null : String(o.note),
    saleId: o.sale_id === null ? null : String(o.sale_id),
    saleStatus: o.sale_id === null ? null : (saleStatus.get(String(o.sale_id)) ?? null),
    corrected: Boolean(o.corrected),
    cancelled: String(o.status) === "reversed",
    variant: variantOf(String(o.kind), payload),
  };
}

/** تفاصيل حركة واحدة + سلسلة نسخها السابقة (P-42/P-43).
 *
 * سلسلة النسخ: البديل يحمل corrects_operation_id = هوية المستبدَل —
 * فتُتبَّع من الحالية إلى الأقدم (كل حلقة سؤال واحد). */
export async function readOperationDetails(
  sql: postgres.Sql,
  projectId: string,
  operationId: string,
  today: string,
): Promise<OperationDetails> {
  const figures = await computeManageFigures(sql, projectId, today, "month");
  const saleStatus = new Map(figures.salesList.map(sale => [sale.id, sale.status]));
  const found = (await sql`
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
    WHERE o.project_id = ${projectId} AND o.id = ${operationId} LIMIT 1`) as unknown as RawRow[];
  if (found.length === 0) throw new OperationNotFound();
  const current = toVersion(found[0]!, saleStatus);

  const previousVersions: OperationVersion[] = [];
  const seen = new Set<string>([current.operationId]);
  let frontier = current.operationId;
  while (true) {
    const older = (await sql`
      SELECT o.id, o.kind, o.effective_on::text AS effective_on, o.counterparty_name, o.note,
             o.amount_minor, o.delivery_cost_minor, o.category, o.payload,
             o.corrects_operation_id IS NOT NULL AS corrected, o.status, o.sale_id,
             NULL::text AS box_kind,
             s.customer_name AS sale_customer_name
      FROM operation o
      LEFT JOIN sale s ON s.id = o.sale_id AND s.project_id = o.project_id
      WHERE o.project_id = ${projectId} AND o.id = (
        SELECT c.corrects_operation_id FROM operation c
        WHERE c.project_id = ${projectId} AND c.id = ${frontier} AND c.corrects_operation_id IS NOT NULL
      ) LIMIT 1`) as unknown as RawRow[];
    if (older.length === 0) break;
    const row = older[0]!;
    if (seen.has(String(row.id))) break;
    seen.add(String(row.id));
    previousVersions.push(toVersion(row, saleStatus));
    frontier = String(row.id);
  }
  return { ...current, previousVersions };
}

/** خط الرصيد (P-45): الخط + حركاته صفوف C-10 (الباقي من موديول القراءة). */
export interface BalanceLineDetails {
  line: {
    id: string;
    direction: string;
    kind: string;
    counterpartyName: string | null;
    originOn: string;
    outstandingFils: number;
    outstandingText: string;
    overdue: boolean;
    saleId: string | null;
  };
  movements: ActivityRow[];
}

/** تفاصيل خط رصيد وحركاته (P-45) — الحركات من قيود الخط. */
export async function readBalanceLineDetails(
  sql: postgres.Sql,
  projectId: string,
  lineId: string,
  today: string,
): Promise<BalanceLineDetails> {
  const figures = await computeManageFigures(sql, projectId, today, "month");
  const saleStatus = new Map(figures.salesList.map(sale => [sale.id, sale.status]));
  const line = figures.balanceLines.find(l => l.id === lineId);
  if (line === undefined) throw new LineNotFound();
  const saleOfLine = (await sql`
    SELECT sale_id::text AS sale_id FROM balance_line WHERE project_id = ${projectId} AND id = ${lineId}`) as Array<{
    sale_id: string | null;
  }>;
  const movementRows = (await sql`
    SELECT DISTINCT ON (o.id) o.id, o.kind, o.effective_on::text AS effective_on, o.counterparty_name, o.note,
           o.amount_minor, o.delivery_cost_minor, o.category, o.payload,
           o.corrects_operation_id IS NOT NULL AS corrected, o.status, o.sale_id,
           (SELECT k.kind FROM ledger_entry e
            JOIN ledger_posting p ON p.entry_id = e.id
            JOIN box k ON k.id = p.ref_id AND k.project_id = e.project_id
            WHERE e.operation_id = o.id AND p.account = 'BOX' LIMIT 1) AS box_kind,
           NULL::text AS sale_customer_name
    FROM operation o
    JOIN ledger_entry e ON e.operation_id = o.id AND e.project_id = o.project_id
    JOIN ledger_posting p ON p.entry_id = e.id
    WHERE o.project_id = ${projectId} AND p.ref_id = ${lineId}
    ORDER BY o.id, o.effective_on DESC, o.created_at DESC`) as unknown as RawRow[];
  const movements = movementRows
    .slice()
    .sort((a, b) => String(b.effective_on).localeCompare(String(a.effective_on)));
  return {
    line: {
      id: line.id,
      direction: line.direction,
      kind: line.kind,
      counterpartyName: line.counterpartyName,
      originOn: line.originOn,
      outstandingFils: line.outstandingFils,
      outstandingText: line.text,
      overdue: line.overdue,
      saleId: saleOfLine[0]?.sale_id ?? null,
    },
    movements: movements.map(o => ({
      operationId: String(o.id),
      kind: String(o.kind),
      effectiveOn: String(o.effective_on),
      name:
        o.counterparty_name !== null && o.counterparty_name.length > 0
          ? String(o.counterparty_name)
          : o.note !== null && o.note.length > 0
            ? String(o.note)
            : null,
      amountText: o.amount_minor === null ? null : money(Number(o.amount_minor)),
      deliveryCostText: null,
      boxKind: o.box_kind === null ? null : String(o.box_kind),
      corrected: Boolean(o.corrected),
      cancelled: String(o.status) === "reversed",
      saleId: o.sale_id === null ? null : String(o.sale_id),
      saleStatus: o.sale_id === null ? null : (saleStatus.get(String(o.sale_id)) ?? null),
      variant: variantOf(String(o.kind), payloadOf(o.payload)),
      category: o.category === null ? null : String(o.category),
    })),
  };
}
