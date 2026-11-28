/**
 * M5.6 (Manage v2 phase 5 — UX P-41 «الحركات» + §8/§3.10 + R-28): السجل
 * الكامل — كل العمليات صفوف C-10 جاهزة، مجمّعة عرضيًا حسب R-28 (بيع
 * اليوم نفسه · طلب جديد بدفعة · تسليم مع تحصيل)، مع البحث بالاسم وفلتر
 * النوع (مجموعات جدول ج-١) وفلترة الفترة — كلها في الخادم (العميل يعرض
 * الاستجابة كما هي).
 *
 * التجميع عرضي صرف (R-28: "display only") — لا يمس الدومين: البنود
 * الحالية تشارك (النسخ المستبدلة تظهر نسختها الحالية، والملغاة تبقى
 * بوسمها)، والمجمَّع يطابق فلتر أي جزء من أجزائه ومبلغه حسب R-28.
 */
import type postgres from "postgres";
import { periodRangeOf } from "../../../../../src/domain/manage/figures/index.js";
import { jodTextFromFils } from "../../../../../src/domain/manage/money/index.js";
import { computeManageFigures } from "./readModel.js";
import type { ActivityRow } from "./activityRows.js";

/** فلتر النوع: «الكل» أو مجموعة جدول ج-١ (مفاتيح الكتالوج). */
export type ActivityTypeFilter =
  | "all"
  | "rep.opening"
  | "op.sale"
  | "op.collect"
  | "op.pay"
  | "op.expense"
  | "op.deposit"
  | "op.withdraw"
  | "op.transfer"
  | "op.reconcile";

/** خريطة ج-١: النوع ← مجموعة الفلتر (بما فيها الشرطية). */
const KIND_GROUPS: Readonly<Record<string, ActivityTypeFilter>> = {
  "OP-SETUP": "rep.opening",
  "OP-ADD-BOX": "rep.opening",
  "OP-ADD-PRIOR-BALANCE": "rep.opening",
  "OP-SALE-CREATE": "op.sale",
  "OP-PREPAYMENT": "op.sale",
  "OP-DELIVER": "op.sale",
  "OP-CANCEL-SALE": "op.sale",
  "OP-RETURN": "op.sale",
  "OP-PRICE-CORRECTION": "op.sale",
  "OP-UNDO-DELIVERY": "op.sale",
  "OP-COLLECT": "op.collect",
  "OP-WRITE-OFF": "op.collect",
  "OP-PAY": "op.pay",
  "OP-EXPENSE": "op.expense",
  "OP-SALE-DELIVERY-COST": "op.expense",
  "OP-OWNER-DEPOSIT": "op.deposit",
  "OP-OWNER-WITHDRAWAL": "op.withdraw",
  "OP-TRANSFER": "op.transfer",
  "OP-MERGE-BOXES": "op.transfer",
  "OP-SPLIT-BOXES": "op.transfer",
  "OP-RECONCILE": "op.reconcile",
};

/** عمود التجميع R-28 — عرض فقط. */
export interface ActivityCompoundRow {
  compound: true;
  /** معرف المجمّع: saleId@day (فريد داخل البيع). */
  groupId: string;
  /** تسمية الصف: op.sale (مجموعتا البيع) أو op.deliver (تسليم مع تحصيل). */
  labelKey: "op.sale" | "op.deliver";
  effectiveOn: string;
  name: string | null;
  /** مبلغ R-28: السعر النهائي (أو null للمجموعة الثانية بلا سعر). */
  amountText: string | null;
  saleId: string;
  saleStatus: string | null;
  corrected: boolean;
  cancelled: boolean;
  /** أجزاء المجموعة — كبسة أي منها تفتح تفاصيلها P-42. */
  members: Array<Pick<ActivityRow, "operationId" | "kind" | "amountText" | "corrected" | "cancelled">>;
}

/** صف السجل: مفرد أو مجمّع (R-28). */
export type ActivityLogRow = (ActivityRow & { compound: false }) | ActivityCompoundRow;

/** الفلاتر: بحث بالاسم + النوع + الفترة (C-06). */
export interface ActivityLogFilters {
  search?: string;
  type?: ActivityTypeFilter;
  period?: "week" | "month" | "year" | "since_start";
}

interface RawOperation {
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

function money(fils: number): string {
  return `${jodTextFromFils(fils)} د`;
}

/** السجل الكامل بعد التجميع والفلاتر — الأحدث أولًا. */
export async function readActivityLog(
  sql: postgres.Sql,
  projectId: string,
  today: string,
  filters: ActivityLogFilters = {},
): Promise<{ rows: ActivityLogRow[] }> {
  /* حالة الطلب §6 من موديول القراءة الواحد (مصدرها الوحيد). */
  const figures = await computeManageFigures(sql, projectId, today, "month");
  const saleStatus = new Map(figures.salesList.map(sale => [sale.id, sale.status]));
  const salePrice = new Map(figures.salesList.map(sale => [sale.id, sale.finalPriceFils]));

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
    ORDER BY o.effective_on DESC, o.created_at DESC`) as unknown as RawOperation[];

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
  function nameOf(o: RawOperation): string | null {
    if (o.counterparty_name !== null && o.counterparty_name.length > 0) return String(o.counterparty_name);
    if (o.sale_customer_name !== null && o.sale_customer_name.length > 0) return String(o.sale_customer_name);
    if (o.note !== null && o.note.length > 0) return String(o.note);
    return null;
  }
  function baseRow(o: RawOperation): ActivityRow & { compound: false } {
    return {
      compound: false,
      operationId: String(o.id),
      kind: String(o.kind),
      effectiveOn: String(o.effective_on),
      name: nameOf(o),
      amountText: o.amount_minor === null ? null : money(Number(o.amount_minor)),
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
    };
  }
  function groupOf(row: ActivityRow): ActivityTypeFilter {
    return KIND_GROUPS[row.kind] ?? "all";
  }
  function matchesSearch(row: ActivityLogRow): boolean {
    const search = filters.search?.trim();
    if (search === undefined || search.length === 0) return true;
    return (row.name ?? "").includes(search);
  }
  const range = filters.period === undefined ? null : periodRangeOf(filters.period, today);

  const singles = new Map<string, ActivityRow & { compound: false }>();
  for (const o of rows) singles.set(String(o.id), baseRow(o));

  /* ── تجميع R-28 (عرض فقط): لكل طلب، بحسب اليوم ──────────────────────── */
  const groupedIds = new Set<string>();
  const compounds: ActivityCompoundRow[] = [];
  const bySale = new Map<string, RawOperation[]>();
  for (const o of rows) {
    if (o.sale_id === null) continue;
    const key = String(o.sale_id);
    const bucket = bySale.get(key) ?? [];
    bucket.push(o);
    bySale.set(key, bucket);
  }
  for (const [saleId, ops] of bySale) {
    const create = ops.find(o => o.kind === "OP-SALE-CREATE");
    const delivers = ops.filter(o => o.kind === "OP-DELIVER" && o.status === "active");
    if (create === undefined) continue;
    const createDay = String(create.effective_on);
    /* المجموعة ١: بيع اليوم نفسه (CREATE+DELIVER بنفس اليوم + تحصيلات
     * اليوم + توصيل + شطب/زيادة) — أو المجموعة ٢: طلب جديد بدفعة. */
    const sameDayDeliver = delivers.find(o => String(o.effective_on) === createDay);
    const dayOps = (day: string) =>
      ops.filter(
        o =>
          String(o.effective_on) === day &&
          o.kind !== "OP-SALE-CREATE" &&
          o.kind !== "OP-DELIVER" &&
          ["OP-PREPAYMENT", "OP-COLLECT", "OP-SALE-DELIVERY-COST", "OP-WRITE-OFF", "OP-RETURN"].includes(
            o.kind,
          ),
      );
    if (sameDayDeliver !== undefined) {
      const members = [create, sameDayDeliver, ...dayOps(createDay)];
      const ids = members.map(o => String(o.id));
      ids.forEach(id => groupedIds.add(id));
      compounds.push({
        compound: true,
        groupId: `${saleId}@${createDay}`,
        labelKey: "op.sale",
        effectiveOn: createDay,
        name: nameOf(create),
        amountText: (() => {
          const price = salePrice.get(saleId) ?? null;
          return price === null ? null : money(price);
        })(),
        saleId,
        saleStatus: saleStatus.get(saleId) ?? null,
        corrected: members.some(o => Boolean(o.corrected)),
        cancelled: false,
        members: members.map(o => {
          const row = singles.get(String(o.id))!;
          return {
            operationId: row.operationId,
            kind: row.kind,
            amountText: row.amountText,
            corrected: row.corrected,
            cancelled: row.cancelled,
          };
        }),
      });
    } else if (dayOps(createDay).some(o => o.kind === "OP-PREPAYMENT")) {
      const members = [create, ...dayOps(createDay)];
      const ids = members.map(o => String(o.id));
      ids.forEach(id => groupedIds.add(id));
      compounds.push({
        compound: true,
        groupId: `${saleId}@${createDay}`,
        labelKey: "op.sale",
        effectiveOn: createDay,
        name: nameOf(create),
        amountText: (() => {
          const price = salePrice.get(saleId) ?? null;
          return price === null ? null : money(price);
        })(),
        saleId,
        saleStatus: saleStatus.get(saleId) ?? null,
        corrected: members.some(o => Boolean(o.corrected)),
        cancelled: false,
        members: members.map(o => {
          const row = singles.get(String(o.id))!;
          return {
            operationId: row.operationId,
            kind: row.kind,
            amountText: row.amountText,
            corrected: row.corrected,
            cancelled: row.cancelled,
          };
        }),
      });
    }
    /* المجموعة ٣: تسليم مع تحصيل في يوم لاحق (DELIVER + تحصيلات اليوم +
     * شطب/زيادة) — بلا CREATE. */
    for (const deliver of delivers) {
      const day = String(deliver.effective_on);
      if (day === createDay) continue; // عالجتها المجموعة ١
      const riders = dayOps(day);
      if (riders.length === 0) continue;
      const members = [deliver, ...riders];
      const ids = members.map(o => String(o.id));
      ids.forEach(id => groupedIds.add(id));
      compounds.push({
        compound: true,
        groupId: `${saleId}@${day}`,
        labelKey: "op.deliver",
        effectiveOn: day,
        name: nameOf(deliver),
        amountText: (() => {
          const price = salePrice.get(saleId) ?? null;
          return price === null ? null : money(price);
        })(),
        saleId,
        saleStatus: saleStatus.get(saleId) ?? null,
        corrected: members.some(o => Boolean(o.corrected)),
        cancelled: false,
        members: members.map(o => {
          const row = singles.get(String(o.id))!;
          return {
            operationId: row.operationId,
            kind: row.kind,
            amountText: row.amountText,
            corrected: row.corrected,
            cancelled: row.cancelled,
          };
        }),
      });
    }
  }

  /* القائمة النهائية: المفردة غير المجمّعة + المجمّعات، الأحدث أولًا،
   * ثم الفلاتر (المجمّع يطابق فلتر أي جزء من أجزائه — R-28). */
  const list: ActivityLogRow[] = [];
  for (const row of singles.values()) {
    if (groupedIds.has(row.operationId)) continue;
    list.push(row);
  }
  list.push(...compounds);
  list.sort(
    (a, b) =>
      b.effectiveOn.localeCompare(a.effectiveOn) ||
      (b.compound ? b.groupId : b.operationId).localeCompare(a.compound ? a.groupId : a.operationId),
  );
  const filtered = list.filter(row => {
    if (!matchesSearch(row)) return false;
    if (filters.type !== undefined && filters.type !== "all") {
      const groups = row.compound
        ? row.members.map(member => KIND_GROUPS[member.kind] ?? "all")
        : [groupOf(row)];
      if (!groups.includes(filters.type)) return false;
    }
    if (range !== null) {
      if (row.effectiveOn < range.from || row.effectiveOn > range.to) return false;
    }
    return true;
  });
  return { rows: filtered };
}
