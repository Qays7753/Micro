/**
 * M2.8 acceptance (Manage v2 phase 2, wave H — spec §5 OP-COLLECT / OP-PAY,
 * §4 Q2/Q3/Q6/Q7/Q17/Q18, R-12, R-14, R-26; tests S5, S6 pay half, T6, T7,
 * T13, T22 numbers, T23 mechanism, T27, T36, T51, T55): collection and
 * payment with allocation by name, oldest-first, the «يبقى مستحقاً» choice,
 * the prior-balance options («مستحق سابق» / «التزام سابق») and every
 * rejection the spec names (E-OVERPAY, E-NO-OPEN-BALANCE,
 * E-NAME-REQUIRED-FOR-DEBT).
 *
 * Tests-first: this file was written before the operations existed and fails
 * with "Cannot find module … operations/collect.js".
 *
 * Given-state seeding: sale_remainder lines belong to delivered sales, and
 * the sale operations (OP-SALE-CREATE / OP-DELIVER) are phase 3 (M3.x). The
 * §13 GIVEN clauses that need them (T6's unnamed same-day sale, T27's three
 * remainders, T22/T23's sales) are seeded directly in the database — the
 * sale row, its sale_remainder line and the delivery's Q5 entry + postings,
 * exactly the rows OP-DELIVER will write (M2.5 already established this
 * pattern for the project row). The operation under test (OP-COLLECT /
 * OP-PAY) still goes exclusively through the real composition (runPlan /
 * the route); only the GIVEN state is seeded.
 *
 * Posture: Miniflare over the per-file isolated PostgreSQL (migrations
 * 0001–0019). Money is integer fils: "100" in the spec's table is 100_000
 * fils. Every acceptance path ends with assertLedgerCoreInvariants
 * (INV-1 + INV-2).
 */
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiPost, signInAs, startWorker, type WorkerInstance } from "./harness.ts";
import {
  accountTotal,
  boxBalance,
  boxIdOf,
  fileSqlUrl,
  ledgerState,
  linesWithOutstanding,
  operationRows,
  resultOf,
  runPlan,
  scopedClient,
  setupProject,
} from "./manage.v2.helpers.ts";
import { planCollect, type CollectInput } from "../../../../src/domain/manage/operations/collect.js";
import { planPay, type PayInput } from "../../../../src/domain/manage/operations/pay.js";
import type { SetupBoxSlot } from "../../../../src/domain/manage/operations/setup.js";
import type { OperationPlan } from "../../../../src/domain/manage/operations/support.js";
import { planOwnerDeposit } from "../../../../src/domain/manage/operations/ownerMoney.js";
import { planAddPriorBalance } from "../../../../src/domain/manage/operations/addPriorBalance.js";
import { assertLedgerCoreInvariants } from "../../../../src/domain/manage/invariants/index.js";

let worker: WorkerInstance;
let dbUrl = "";

beforeAll(async () => {
  worker = await startWorker();
  dbUrl = await fileSqlUrl(worker);
});

afterAll(async () => {
  await worker.close();
});

const AMMAN_TODAY = "2026-11-27";

function suffix(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** A request-scoped single-connection client, always released. */
async function withSql<T>(run: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const sql = scopedClient(dbUrl);
  try {
    return await run(sql);
  } finally {
    await sql.end();
  }
}

/** A project set up through the real composition. Default: one cash box
 * with a KNOWN opening of 0 (the §13 default). */
async function newProject(boxes: SetupBoxSlot[] = [{ kind: "cash", opening: { openingFils: 0 } }]) {
  const projectId = crypto.randomUUID();
  const owner = `m28-owner-${suffix()}`;
  await withSql(sql => setupProject(sql, { projectId, owner, today: AMMAN_TODAY, boxes }));
  return { projectId, owner };
}

/* ── Given-state seeding: a delivered sale with its sale_remainder line ─── */

interface SeededSale {
  saleId: string;
  lineId: string;
}

/** Seed a DELIVERED sale with an open sale_remainder: the sale row, its
 * line, and the delivery's Q5 entry + postings — exactly the rows OP-DELIVER
 * (M3.4) will write. `deliveredOn` is both the delivery date and the line's
 * origin_on; the sale is same-day iff deliveredOn === registeredOn. */
async function seedDeliveredSale(
  sql: postgres.Sql,
  projectId: string,
  input: {
    customerName: string | null;
    registeredOn: string;
    deliveredOn: string;
    priceFils: number;
    /** Origin operation created_at (allocation tiebreak) — default 12:00. */
    createdAt?: string;
  },
): Promise<SeededSale> {
  const saleId = crypto.randomUUID();
  const lineId = crypto.randomUUID();
  const operationId = crypto.randomUUID();
  const entryId = crypto.randomUUID();
  const createdAt = input.createdAt ?? `${input.registeredOn}T12:00:00.000Z`;
  await sql`INSERT INTO sale (id, project_id, customer_name, registered_on, planned_delivery_on,
                              final_price_minor, tracked, hidden_from_tracker, created_at, updated_at)
            VALUES (${saleId}, ${projectId}, ${input.customerName}, ${input.registeredOn},
                    ${input.deliveredOn}, ${input.priceFils}, ${false}, ${false},
                    ${createdAt}, ${createdAt})`;
  await sql`INSERT INTO operation (id, project_id, kind, effective_on, status, sale_id, balance_line_id,
                                   amount_minor, payload, created_by_account_id, created_at)
            VALUES (${operationId}, ${projectId}, ${"OP-DELIVER"}, ${input.deliveredOn}, ${"active"},
                    ${saleId}, ${lineId}, ${input.priceFils}, ${"{}"}, ${"seed"}, ${createdAt})`;
  await sql`INSERT INTO balance_line (id, project_id, direction, kind, counterparty_name, origin_on,
                                      sale_id, origin_operation_id)
            VALUES (${lineId}, ${projectId}, ${"to_me"}, ${"sale_remainder"}, ${null},
                    ${input.deliveredOn}, ${saleId}, ${operationId})`;
  await sql`INSERT INTO ledger_entry (id, project_id, operation_id, entry_type, effective_on, created_at)
            VALUES (${entryId}, ${projectId}, ${operationId}, ${"Q5"}, ${input.deliveredOn}, ${createdAt})`;
  await sql`INSERT INTO ledger_posting (id, project_id, entry_id, account, ref_id, rev_kind, delta_minor)
            VALUES (${crypto.randomUUID()}, ${projectId}, ${entryId}, ${"REV"}, ${saleId}, ${"delivery"}, ${input.priceFils}),
                   (${crypto.randomUUID()}, ${projectId}, ${entryId}, ${"AR"}, ${lineId}, ${null}, ${input.priceFils})`;
  return { saleId, lineId };
}

/* ── Planner input builders (exactly as the routes build them) ─────────── */

type CollectCase = {
  amountFils: number;
  box?: string;
  balanceLineId?: string;
  counterpartyName?: string;
  effectiveOn?: string;
  shortfall?: string;
  priorBalance?: boolean;
};

type PayCase = CollectCase;

function collectInput(
  ctx: { projectId: string; owner: string },
  requestId: string,
  input: CollectCase,
): CollectInput {
  return {
    projectId: ctx.projectId,
    createdByAccountId: ctx.owner,
    requestId,
    today: AMMAN_TODAY,
    amountFils: input.amountFils,
    ...(input.box === undefined ? {} : { box: input.box }),
    ...(input.balanceLineId === undefined ? {} : { balanceLineId: input.balanceLineId }),
    ...(input.counterpartyName === undefined ? {} : { counterpartyName: input.counterpartyName }),
    ...(input.effectiveOn === undefined ? {} : { effectiveOn: input.effectiveOn }),
    ...(input.shortfall === undefined ? {} : { shortfall: input.shortfall }),
    ...(input.priorBalance === undefined ? {} : { priorBalance: input.priorBalance }),
  };
}

function payInput(ctx: { projectId: string; owner: string }, requestId: string, input: PayCase): PayInput {
  return collectInput(ctx, requestId, input) as PayInput;
}

const collectPlan = (ctx: { projectId: string; owner: string }, requestId: string, input: CollectCase) =>
  planCollect(collectInput(ctx, requestId, input));

const payPlan = (ctx: { projectId: string; owner: string }, requestId: string, input: PayCase) =>
  planPay(payInput(ctx, requestId, input));

interface PostingRow {
  account: string;
  refId: string | null;
  category: string | null;
  deltaFils: number;
}

interface EntryRow {
  type: string;
  effectiveOn: string;
  postings: PostingRow[];
}

function byAccount(a: PostingRow, b: PostingRow): number {
  return a.account.localeCompare(b.account) || a.deltaFils - b.deltaFils;
}

/** The operation's entries in the order the handler wrote them
 * (result.entryIds); an entry's postings sorted by account. */
async function entriesInOrder(sql: postgres.Sql, projectId: string, entryIds: string[]): Promise<EntryRow[]> {
  const entries =
    await sql`SELECT id, entry_type, effective_on::text AS effective_on FROM ledger_entry WHERE project_id = ${projectId}`;
  const postings =
    await sql`SELECT entry_id, account, ref_id, category, rev_kind, delta_minor FROM ledger_posting WHERE project_id = ${projectId}`;
  return entryIds.map(id => {
    const entry = entries.find(e => e.id === id);
    if (entry === undefined) throw new Error(`entry ${id} not found`);
    return {
      type: String(entry.entry_type),
      effectiveOn: String(entry.effective_on),
      postings: postings
        .filter(p => p.entry_id === id)
        .map(p => ({
          account: String(p.account),
          refId: p.ref_id === null ? null : String(p.ref_id),
          category: p.category === null ? null : String(p.category),
          deltaFils: Number(p.delta_minor),
        }))
        .sort(byAccount),
    };
  });
}

/** The project's OP-COLLECT/OP-PAY rows with their sale_id (the shared
 * operationRows helper maps no saleId). */
interface CollectPayRow {
  kind: string;
  boxId: string | null;
  balanceLineId: string | null;
  saleId: string | null;
  counterpartyName: string | null;
  amountMinor: number | null;
}

async function collectPayRows(sql: postgres.Sql, projectId: string): Promise<CollectPayRow[]> {
  const rows = await sql`
    SELECT kind, box_id, balance_line_id, sale_id, counterparty_name, amount_minor
    FROM operation WHERE project_id = ${projectId}
      AND kind IN ('OP-COLLECT', 'OP-PAY') ORDER BY created_at, id`;
  return rows.map(r => ({
    kind: String(r.kind),
    boxId: r.box_id === null ? null : String(r.box_id),
    balanceLineId: r.balance_line_id === null ? null : String(r.balance_line_id),
    saleId: r.sale_id === null ? null : String(r.sale_id),
    counterpartyName: r.counterparty_name === null ? null : String(r.counterparty_name),
    amountMinor: r.amount_minor === null ? null : Number(r.amount_minor),
  }));
}

/** Rows a refused plan must leave behind: none (R-12). */
async function persistedWriteCount(sql: postgres.Sql, projectId: string): Promise<number> {
  const operations = await sql`SELECT count(*)::int AS n FROM operation
    WHERE project_id = ${projectId} AND kind IN ('OP-COLLECT', 'OP-PAY')`;
  const reservations =
    await sql`SELECT count(*)::int AS n FROM manage_v2_idempotency WHERE project_id = ${projectId} AND request_id LIKE ${ATTEMPT_PREFIX + "%"}`;
  return Number(operations[0]!.n) + Number(reservations[0]!.n);
}

/** The request-id prefix of the operations UNDER TEST (the given-state
 * operations — addPrior, seeded deliveries — use `req-`, and their
 * idempotency reservations must not count as leftover writes). */
const ATTEMPT_PREFIX = "attempt-";

async function expectRejected(
  ctx: { projectId: string; owner: string },
  make: (requestId: string) => OperationPlan,
  code: RegExp,
): Promise<void> {
  await withSql(sql =>
    expect(runPlan(sql, () => make(`${ATTEMPT_PREFIX}${suffix()}`))).rejects.toThrow(code),
  );
}

/** Record a prior receivable/payable through the real composition (the
 * OP-ADD-PRIOR-BALANCE operation from M2.5) — the given state of T7/T13/T36. */
async function addPrior(
  sql: postgres.Sql,
  ctx: { projectId: string; owner: string },
  input: { direction: "to_me" | "by_me"; counterpartyName: string; amountFils: number; originOn?: string },
): Promise<void> {
  await runPlan(sql, () =>
    planAddPriorBalance({
      projectId: ctx.projectId,
      createdByAccountId: ctx.owner,
      requestId: `req-${suffix()}`,
      today: AMMAN_TODAY,
      direction: input.direction,
      counterpartyName: input.counterpartyName,
      amountFils: input.amountFils,
      ...(input.originOn === undefined ? {} : { originOn: input.originOn }),
    }),
  );
}

/* ── 1. S5: the «مستحق سابق» prior-receivable collection ───────────────── */

describe("M2.8 S5 — collect 100 from محمد as a prior receivable", () => {
  it("opens a prior_receivable line (Q2, origin today) then collects it (Q6): cash +100, OPEN +100, profit 0", async () => {
    const ctx = await newProject();
    const result = resultOf(
      await withSql(sql =>
        runPlan(sql, () =>
          collectPlan(ctx, `req-${suffix()}`, {
            box: "cash",
            amountFils: 100_000,
            counterpartyName: "محمد",
            priorBalance: true,
          }),
        ),
      ),
      "applied",
    );
    expect(result.kind).toBe("OP-COLLECT");
    expect(result.amountFils).toBe(100_000);
    await withSql(async sql => {
      const cashId = await boxIdOf(sql, ctx.projectId, "cash");
      const lines = await linesWithOutstanding(sql, ctx.projectId);
      expect(lines).toHaveLength(1);
      const line = lines[0]!;
      expect(line).toMatchObject({
        direction: "to_me",
        kind: "prior_receivable",
        counterpartyName: "محمد",
        originOn: AMMAN_TODAY,
        outstanding: 0,
      });
      // FIXTURES S5: box 100,000 · open 100,000 · profit 0.
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(100_000);
      expect(await accountTotal(sql, ctx.projectId, "OPEN")).toBe(100_000);
      expect(await accountTotal(sql, ctx.projectId, "AR")).toBe(0);
      expect(await accountTotal(sql, ctx.projectId, "REV")).toBe(0);
      expect(await accountTotal(sql, ctx.projectId, "EXP")).toBe(0);
      expect(await entriesInOrder(sql, ctx.projectId, result.entryIds)).toEqual([
        {
          type: "Q2",
          effectiveOn: AMMAN_TODAY,
          postings: [
            { account: "AR", refId: line.id, category: null, deltaFils: 100_000 },
            { account: "OPEN", refId: null, category: null, deltaFils: 100_000 },
          ],
        },
        {
          type: "Q6",
          effectiveOn: AMMAN_TODAY,
          postings: [
            { account: "AR", refId: line.id, category: null, deltaFils: -100_000 },
            { account: "BOX", refId: cashId, category: null, deltaFils: 100_000 },
          ],
        },
      ]);
      const rows = await collectPayRows(sql, ctx.projectId);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        kind: "OP-COLLECT",
        boxId: cashId,
        balanceLineId: line.id,
        counterpartyName: "محمد",
        amountMinor: 100_000,
      });
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 2. T27: allocation by name, oldest first, no shortfall question ────── */

describe("M2.8 T27 — محمد remainders 30, 40, 50; collect 100 by name", () => {
  it("allocates 30, 40, 30 in that order and leaves 20 on the third — no shortfall question", async () => {
    const ctx = await newProject();
    const seeded = await withSql(async sql => {
      const first = await seedDeliveredSale(sql, ctx.projectId, {
        customerName: "محمد",
        registeredOn: "2026-11-20",
        deliveredOn: "2026-11-20",
        priceFils: 30_000,
        createdAt: "2026-11-20T10:00:00.000Z",
      });
      const second = await seedDeliveredSale(sql, ctx.projectId, {
        customerName: "محمد",
        registeredOn: "2026-11-22",
        deliveredOn: "2026-11-22",
        priceFils: 40_000,
        createdAt: "2026-11-22T10:00:00.000Z",
      });
      const third = await seedDeliveredSale(sql, ctx.projectId, {
        customerName: "محمد",
        registeredOn: "2026-11-24",
        deliveredOn: "2026-11-24",
        priceFils: 50_000,
        createdAt: "2026-11-24T10:00:00.000Z",
      });
      return { first, second, third };
    });
    const result = resultOf(
      await withSql(sql =>
        runPlan(sql, () =>
          collectPlan(ctx, `req-${suffix()}`, { box: "cash", amountFils: 100_000, counterpartyName: "محمد" }),
        ),
      ),
      "applied",
    );
    expect(result.amountFils).toBe(100_000);
    await withSql(async sql => {
      const cashId = await boxIdOf(sql, ctx.projectId, "cash");
      // The allocation order is asserted, not assumed (oldest first).
      expect(await entriesInOrder(sql, ctx.projectId, result.entryIds)).toEqual([
        {
          type: "Q6",
          effectiveOn: AMMAN_TODAY,
          postings: [
            { account: "AR", refId: seeded.first.lineId, category: null, deltaFils: -30_000 },
            { account: "BOX", refId: cashId, category: null, deltaFils: 30_000 },
          ],
        },
        {
          type: "Q6",
          effectiveOn: AMMAN_TODAY,
          postings: [
            { account: "AR", refId: seeded.second.lineId, category: null, deltaFils: -40_000 },
            { account: "BOX", refId: cashId, category: null, deltaFils: 40_000 },
          ],
        },
        {
          type: "Q6",
          effectiveOn: AMMAN_TODAY,
          postings: [
            { account: "AR", refId: seeded.third.lineId, category: null, deltaFils: -30_000 },
            { account: "BOX", refId: cashId, category: null, deltaFils: 30_000 },
          ],
        },
      ]);
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(100_000);
      const lines = await linesWithOutstanding(sql, ctx.projectId);
      expect(lines.find(l => l.id === seeded.first.lineId)?.outstanding).toBe(0);
      expect(lines.find(l => l.id === seeded.second.lineId)?.outstanding).toBe(0);
      expect(lines.find(l => l.id === seeded.third.lineId)?.outstanding).toBe(20_000);
      const rows = await collectPayRows(sql, ctx.projectId);
      expect(rows[0]).toMatchObject({ kind: "OP-COLLECT", balanceLineId: null, counterpartyName: "محمد" });
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 3. T36: the «يبقى مستحقاً» choice on a single line ─────────────────── */

describe("M2.8 T36 — collect 20 of 25, keep outstanding", () => {
  it("posts one Q6 of 20; remainder 5; no revenue change", async () => {
    const ctx = await newProject();
    // A prior receivable of 25 for سامي (single open line by name).
    await withSql(sql =>
      addPrior(sql, ctx, { direction: "to_me", counterpartyName: "سامي", amountFils: 25_000 }),
    );
    const result = resultOf(
      await withSql(sql =>
        runPlan(sql, () =>
          collectPlan(ctx, `req-${suffix()}`, {
            box: "cash",
            amountFils: 20_000,
            counterpartyName: "سامي",
            shortfall: "keep_outstanding",
          }),
        ),
      ),
      "applied",
    );
    await withSql(async sql => {
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(20_000);
      expect(await accountTotal(sql, ctx.projectId, "REV")).toBe(0);
      expect(await accountTotal(sql, ctx.projectId, "OPEN")).toBe(25_000);
      const lines = await linesWithOutstanding(sql, ctx.projectId);
      const open = lines.filter(l => l.outstanding > 0);
      expect(open).toHaveLength(1);
      expect(open[0]).toMatchObject({
        kind: "prior_receivable",
        counterpartyName: "سامي",
        outstanding: 5_000,
      });
      expect(result.entryIds).toHaveLength(1);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("defaults to keeping the outstanding when no choice is sent (the conservative answer)", async () => {
    const ctx = await newProject();
    await withSql(sql =>
      addPrior(sql, ctx, { direction: "to_me", counterpartyName: "سامي", amountFils: 25_000 }),
    );
    await withSql(sql =>
      runPlan(sql, () =>
        collectPlan(ctx, `req-${suffix()}`, { box: "cash", amountFils: 20_000, counterpartyName: "سامي" }),
      ),
    );
    await withSql(async sql => {
      const lines = await linesWithOutstanding(sql, ctx.projectId);
      expect(lines.filter(l => l.outstanding > 0)[0]).toMatchObject({ outstanding: 5_000 });
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("write_off posts Q17 for the rest (T22's numbers on a named sale): collect 22 + write off 3 of 25", async () => {
    const ctx = await newProject();
    const seeded = await withSql(sql =>
      seedDeliveredSale(sql, ctx.projectId, {
        customerName: "ليلى",
        registeredOn: "2026-11-25",
        deliveredOn: "2026-11-25",
        priceFils: 25_000,
      }),
    );
    const result = resultOf(
      await withSql(sql =>
        runPlan(sql, () =>
          collectPlan(ctx, `req-${suffix()}`, {
            box: "cash",
            amountFils: 22_000,
            balanceLineId: seeded.lineId,
            shortfall: "write_off",
          }),
        ),
      ),
      "applied",
    );
    await withSql(async sql => {
      const cashId = await boxIdOf(sql, ctx.projectId, "cash");
      // T22: cash +22; Sales 25, Returns & discounts 3, net 22; remainder 0.
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(22_000);
      expect(await accountTotal(sql, ctx.projectId, "REV")).toBe(22_000);
      const lines = await linesWithOutstanding(sql, ctx.projectId);
      expect(lines.find(l => l.id === seeded.lineId)?.outstanding).toBe(0);
      expect(await entriesInOrder(sql, ctx.projectId, result.entryIds)).toEqual([
        {
          type: "Q6",
          effectiveOn: AMMAN_TODAY,
          postings: [
            { account: "AR", refId: seeded.lineId, category: null, deltaFils: -22_000 },
            { account: "BOX", refId: cashId, category: null, deltaFils: 22_000 },
          ],
        },
        {
          type: "Q17",
          effectiveOn: AMMAN_TODAY,
          postings: [
            { account: "AR", refId: seeded.lineId, category: null, deltaFils: -3_000 },
            { account: "REV", refId: seeded.saleId, category: null, deltaFils: -3_000 },
          ],
        },
      ]);
      const rows = await collectPayRows(sql, ctx.projectId);
      expect(rows[0]).toMatchObject({
        kind: "OP-COLLECT",
        saleId: seeded.saleId,
        balanceLineId: seeded.lineId,
      });
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 4. T23 mechanism: the Q18 overpayment-kept excess ─────────────────── */

describe("M2.8 T23 mechanism — collect 55 on a 50 sale remainder", () => {
  it("posts Q6 50 + Q18 5 on the sale and returns the S-OVERPAY-KEPT message", async () => {
    const ctx = await newProject();
    const seeded = await withSql(sql =>
      seedDeliveredSale(sql, ctx.projectId, {
        customerName: "ليلى",
        registeredOn: "2026-11-25",
        deliveredOn: "2026-11-25",
        priceFils: 50_000,
      }),
    );
    const result = resultOf(
      await withSql(sql =>
        runPlan(sql, () =>
          collectPlan(ctx, `req-${suffix()}`, {
            box: "cash",
            amountFils: 55_000,
            balanceLineId: seeded.lineId,
          }),
        ),
      ),
      "applied",
    );
    expect(result.data).toEqual({ messages: ["S-OVERPAY-KEPT"] });
    await withSql(async sql => {
      const cashId = await boxIdOf(sql, ctx.projectId, "cash");
      // T23: Q6 50 + Q18 5; REV 55.
      expect(await accountTotal(sql, ctx.projectId, "REV")).toBe(55_000);
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(55_000);
      expect(await entriesInOrder(sql, ctx.projectId, result.entryIds)).toEqual([
        {
          type: "Q6",
          effectiveOn: AMMAN_TODAY,
          postings: [
            { account: "AR", refId: seeded.lineId, category: null, deltaFils: -50_000 },
            { account: "BOX", refId: cashId, category: null, deltaFils: 50_000 },
          ],
        },
        {
          type: "Q18",
          effectiveOn: AMMAN_TODAY,
          postings: [
            { account: "BOX", refId: cashId, category: null, deltaFils: 5_000 },
            { account: "REV", refId: seeded.saleId, category: null, deltaFils: 5_000 },
          ],
        },
      ]);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 5. T6: the unnamed same-day sale must be collected in full ─────────── */

describe("M2.8 T6 — same-day sale 30 without a name; collect 20", () => {
  it("is rejected with E-NAME-REQUIRED-FOR-DEBT and nothing persists", async () => {
    const ctx = await newProject();
    const seeded = await withSql(sql =>
      seedDeliveredSale(sql, ctx.projectId, {
        customerName: null,
        registeredOn: AMMAN_TODAY,
        deliveredOn: AMMAN_TODAY,
        priceFils: 30_000,
      }),
    );
    await expectRejected(
      ctx,
      id => collectPlan(ctx, id, { box: "cash", amountFils: 20_000, balanceLineId: seeded.lineId }),
      /E-NAME-REQUIRED-FOR-DEBT/,
    );
    // The write_off choice does not bypass the name requirement either.
    await expectRejected(
      ctx,
      id =>
        collectPlan(ctx, id, {
          box: "cash",
          amountFils: 20_000,
          balanceLineId: seeded.lineId,
          shortfall: "write_off",
        }),
      /E-NAME-REQUIRED-FOR-DEBT/,
    );
    await withSql(async sql => {
      expect(await persistedWriteCount(sql, ctx.projectId)).toBe(0);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("accepts the FULL remaining collection of an unnamed same-day sale (T60's money half)", async () => {
    const ctx = await newProject();
    const seeded = await withSql(sql =>
      seedDeliveredSale(sql, ctx.projectId, {
        customerName: null,
        registeredOn: AMMAN_TODAY,
        deliveredOn: AMMAN_TODAY,
        priceFils: 30_000,
      }),
    );
    const result = resultOf(
      await withSql(sql =>
        runPlan(sql, () =>
          collectPlan(ctx, `req-${suffix()}`, {
            box: "cash",
            amountFils: 30_000,
            balanceLineId: seeded.lineId,
          }),
        ),
      ),
      "applied",
    );
    await withSql(async sql => {
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(30_000);
      expect(result.entryIds).toHaveLength(1);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 6. T7 / T51: the rejections ───────────────────────────────────────── */

describe("M2.8 T7 / T51 — E-OVERPAY and E-NO-OPEN-BALANCE", () => {
  it("T7 — collect 80 on a prior_receivable with outstanding 50: E-OVERPAY", async () => {
    const ctx = await newProject();
    await withSql(sql =>
      addPrior(sql, ctx, { direction: "to_me", counterpartyName: "محمد", amountFils: 50_000 }),
    );
    await expectRejected(
      ctx,
      id => collectPlan(ctx, id, { box: "cash", amountFils: 80_000, counterpartyName: "محمد" }),
      /E-OVERPAY/,
    );
    await withSql(async sql => {
      expect(await persistedWriteCount(sql, ctx.projectId)).toBe(0);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("T51 — collect from a name with no open lines, not marked prior: E-NO-OPEN-BALANCE (before the overpay rule)", async () => {
    const ctx = await newProject();
    await expectRejected(
      ctx,
      id => collectPlan(ctx, id, { box: "cash", amountFils: 10_000, counterpartyName: "سامي" }),
      /E-NO-OPEN-BALANCE/,
    );
    // E-NO-OPEN-BALANCE is checked BEFORE the overpayment rule: a huge
    // amount from a nameless history is still E-NO-OPEN-BALANCE.
    await expectRejected(
      ctx,
      id => collectPlan(ctx, id, { box: "cash", amountFils: 1_000_000, counterpartyName: "سامي" }),
      /E-NO-OPEN-BALANCE/,
    );
    await withSql(async sql => {
      expect(await persistedWriteCount(sql, ctx.projectId)).toBe(0);
    });
  });

  it("rejects an excess whose last allocated line is not a sale_remainder: E-OVERPAY (multi-line)", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      await addPrior(sql, ctx, {
        direction: "to_me",
        counterpartyName: "محمد",
        amountFils: 30_000,
        originOn: "2026-11-20",
      });
      await addPrior(sql, ctx, { direction: "to_me", counterpartyName: "محمد", amountFils: 40_000 });
    });
    await expectRejected(
      ctx,
      id => collectPlan(ctx, id, { box: "cash", amountFils: 80_000, counterpartyName: "محمد" }),
      /E-OVERPAY/,
    );
    await withSql(async sql => {
      expect(await persistedWriteCount(sql, ctx.projectId)).toBe(0);
    });
  });
});

/* ── 7. T13 + S6 pay half: OP-PAY ──────────────────────────────────────── */

describe("M2.8 T13 — prior payable 70, paid", () => {
  it("posts Q7: cash −70, payable 0, OPEN −70, profit 0", async () => {
    const ctx = await newProject();
    await withSql(sql =>
      addPrior(sql, ctx, { direction: "by_me", counterpartyName: "مؤسسة الكهرباء", amountFils: 70_000 }),
    );
    const result = resultOf(
      await withSql(sql =>
        runPlan(sql, () =>
          payPlan(ctx, `req-${suffix()}`, {
            box: "cash",
            amountFils: 70_000,
            counterpartyName: "مؤسسة الكهرباء",
          }),
        ),
      ),
      "applied",
    );
    expect(result.kind).toBe("OP-PAY");
    await withSql(async sql => {
      const cashId = await boxIdOf(sql, ctx.projectId, "cash");
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(-70_000);
      expect(await accountTotal(sql, ctx.projectId, "AP")).toBe(0);
      expect(await accountTotal(sql, ctx.projectId, "OPEN")).toBe(-70_000);
      expect(await accountTotal(sql, ctx.projectId, "REV")).toBe(0);
      expect(await entriesInOrder(sql, ctx.projectId, result.entryIds)).toEqual([
        {
          type: "Q7",
          effectiveOn: AMMAN_TODAY,
          postings: [
            { account: "AP", refId: expect.any(String), category: null, deltaFils: -70_000 },
            { account: "BOX", refId: cashId, category: null, deltaFils: -70_000 },
          ],
        },
      ]);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("S6 pay half — borrow 50 then pay 50: cash 0, payable 0, profit 0 (FIXTURES S6 final)", async () => {
    const ctx = await newProject();
    await withSql(sql =>
      runPlan(sql, () =>
        planOwnerDeposit({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `req-${suffix()}`,
          today: AMMAN_TODAY,
          amountFils: 50_000,
          box: "cash",
          source: { type: "borrowed", name: "أخي" },
        }),
      ),
    );
    const result = resultOf(
      await withSql(sql =>
        runPlan(sql, () =>
          payPlan(ctx, `req-${suffix()}`, { box: "cash", amountFils: 50_000, counterpartyName: "أخي" }),
        ),
      ),
      "applied",
    );
    await withSql(async sql => {
      // FIXTURES S6 (final, after borrow + pay): all zeros.
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(0);
      expect(await accountTotal(sql, ctx.projectId, "AP")).toBe(0);
      expect(await accountTotal(sql, ctx.projectId, "OPEN")).toBe(0);
      expect(await accountTotal(sql, ctx.projectId, "REV")).toBe(0);
      expect(await accountTotal(sql, ctx.projectId, "EXP")).toBe(0);
      expect(await accountTotal(sql, ctx.projectId, "OWN_IN")).toBe(0);
      expect(await accountTotal(sql, ctx.projectId, "OWN_OUT")).toBe(0);
      expect((await linesWithOutstanding(sql, ctx.projectId)).every(l => l.outstanding === 0)).toBe(true);
      expect(result.entryIds).toHaveLength(1);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("pays the «التزام سابق» prior payable inline (Q3 then Q7) and warns on the negative box", async () => {
    const ctx = await newProject();
    const result = resultOf(
      await withSql(sql =>
        runPlan(sql, () =>
          payPlan(ctx, `req-${suffix()}`, {
            box: "cash",
            amountFils: 30_000,
            counterpartyName: "مؤسسة المياه",
            priorBalance: true,
          }),
        ),
      ),
      "applied",
    );
    expect(result.data).toEqual({ warnings: ["w.negative_box"] });
    await withSql(async sql => {
      const lines = await linesWithOutstanding(sql, ctx.projectId);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatchObject({
        direction: "by_me",
        kind: "prior_payable",
        counterpartyName: "مؤسسة المياه",
        originOn: AMMAN_TODAY,
        outstanding: 0,
      });
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(-30_000);
      expect(await accountTotal(sql, ctx.projectId, "OPEN")).toBe(-30_000);
      expect(await accountTotal(sql, ctx.projectId, "AP")).toBe(0);
      expect(await entriesInOrder(sql, ctx.projectId, result.entryIds)).toHaveLength(2);
      expect((await entriesInOrder(sql, ctx.projectId, result.entryIds))[0]).toMatchObject({ type: "Q3" });
      expect((await entriesInOrder(sql, ctx.projectId, result.entryIds))[1]).toMatchObject({ type: "Q7" });
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("OP-PAY rejects an excess with E-OVERPAY (no Q18 for payments) and a nameless history with E-NO-OPEN-BALANCE", async () => {
    const ctx = await newProject();
    await withSql(sql =>
      addPrior(sql, ctx, { direction: "by_me", counterpartyName: "مؤسسة الكهرباء", amountFils: 70_000 }),
    );
    await expectRejected(
      ctx,
      id => payPlan(ctx, id, { box: "cash", amountFils: 80_000, counterpartyName: "مؤسسة الكهرباء" }),
      /E-OVERPAY/,
    );
    await expectRejected(
      ctx,
      id => payPlan(ctx, id, { box: "cash", amountFils: 10_000, counterpartyName: "لا أحد" }),
      /E-NO-OPEN-BALANCE/,
    );
    await withSql(async sql => {
      expect(await persistedWriteCount(sql, ctx.projectId)).toBe(0);
    });
  });
});

/* ── 8. Validation ─────────────────────────────────────────────────────── */

describe("M2.8 — input validation", () => {
  it("rejects malformed amounts, targets and boxes with E-AMOUNT; future dates with E-FUTURE-DATE; missing boxes with E-BOX-STATE", async () => {
    const ctx = await newProject([
      { kind: "cash", opening: { openingFils: 500_000 } },
      { kind: "account", opening: { openingFils: 0 } },
    ]);
    const seeded = await withSql(sql =>
      seedDeliveredSale(sql, ctx.projectId, {
        customerName: "ليلى",
        registeredOn: "2026-11-25",
        deliveredOn: "2026-11-25",
        priceFils: 50_000,
      }),
    );
    // amount
    await expectRejected(
      ctx,
      id => collectPlan(ctx, id, { box: "cash", amountFils: 0, counterpartyName: "ليلى" }),
      /E-AMOUNT/,
    );
    await expectRejected(
      ctx,
      id => payPlan(ctx, id, { box: "cash", amountFils: -5, counterpartyName: "ليلى" }),
      /E-AMOUNT/,
    );
    // target: exactly one of line id | name
    await expectRejected(
      ctx,
      id =>
        collectPlan(ctx, id, {
          box: "cash",
          amountFils: 5_000,
          balanceLineId: seeded.lineId,
          counterpartyName: "ليلى",
        }),
      /E-AMOUNT/,
    );
    await expectRejected(ctx, id => collectPlan(ctx, id, { box: "cash", amountFils: 5_000 }), /E-AMOUNT/);
    // box required and known
    await expectRejected(
      ctx,
      id => collectPlan(ctx, id, { amountFils: 5_000, counterpartyName: "ليلى", box: "wallet" }),
      /E-AMOUNT/,
    );
    await expectRejected(
      ctx,
      id => payPlan(ctx, id, { amountFils: 5_000, counterpartyName: "ليلى", box: "credit" }),
      /E-AMOUNT/,
    );
    // prior only with a name target
    await expectRejected(
      ctx,
      id =>
        collectPlan(ctx, id, {
          box: "cash",
          amountFils: 5_000,
          balanceLineId: seeded.lineId,
          priorBalance: true,
        }),
      /E-AMOUNT/,
    );
    // shortfall choice vocabulary
    await expectRejected(
      ctx,
      id =>
        collectPlan(ctx, id, {
          box: "cash",
          amountFils: 5_000,
          counterpartyName: "ليلى",
          shortfall: "whatever",
        }),
      /E-AMOUNT/,
    );
    // future date
    await expectRejected(
      ctx,
      id =>
        collectPlan(ctx, id, {
          box: "cash",
          amountFils: 5_000,
          counterpartyName: "ليلى",
          effectiveOn: "2026-11-28",
        }),
      /E-FUTURE-DATE/,
    );
    await expectRejected(
      ctx,
      id =>
        payPlan(ctx, id, {
          box: "cash",
          amountFils: 5_000,
          counterpartyName: "ليلى",
          effectiveOn: "2026-11-28",
        }),
      /E-FUTURE-DATE/,
    );
    // a nonexistent line id is not an open balance
    await expectRejected(
      ctx,
      id => collectPlan(ctx, id, { box: "cash", amountFils: 5_000, balanceLineId: crypto.randomUUID() }),
      /E-NO-OPEN-BALANCE/,
    );
    await withSql(async sql => {
      expect(await persistedWriteCount(sql, ctx.projectId)).toBe(0);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("trims the counterparty name before matching (R-14) and matches exactly", async () => {
    const ctx = await newProject();
    await withSql(sql =>
      addPrior(sql, ctx, { direction: "to_me", counterpartyName: "محمد", amountFils: 50_000 }),
    );
    const result = resultOf(
      await withSql(sql =>
        runPlan(sql, () =>
          collectPlan(ctx, `req-${suffix()}`, {
            box: "cash",
            amountFils: 20_000,
            counterpartyName: "  محمد  ",
          }),
        ),
      ),
      "applied",
    );
    await withSql(async sql => {
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(20_000);
      expect(result.entryIds).toHaveLength(1);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 9. T55: one request id → one operation ────────────────────────────── */

describe("M2.8 T55 — retried collections and payments", () => {
  it("replays a prior-marked collect (fresh line id per planning) and answers a different body with a conflict", async () => {
    const ctx = await newProject();
    const requestId = `req-${suffix()}`;
    const input = { amountFils: 100_000, box: "cash", counterpartyName: "محمد", priorBalance: true };
    const first = resultOf(
      await withSql(sql => runPlan(sql, () => collectPlan(ctx, requestId, input))),
      "applied",
    );
    const again = resultOf(
      await withSql(sql => runPlan(sql, () => collectPlan(ctx, requestId, input))),
      "replay",
    );
    expect(again).toEqual(first);
    const conflict = await withSql(sql =>
      runPlan(sql, () => collectPlan(ctx, requestId, { ...input, amountFils: 90_000 })),
    );
    expect(conflict).toEqual({ outcome: "conflict", reason: "E-IDEMPOTENCY-CONFLICT" });
    await withSql(async sql => {
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(100_000);
      expect((await collectPayRows(sql, ctx.projectId)).filter(r => r.kind === "OP-COLLECT")).toHaveLength(1);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 10. The routes ────────────────────────────────────────────────────── */

interface RouteResponse {
  outcome: string;
  result: { operationId: string; kind: string; amountFils: number; data?: unknown };
}

async function errorOf(response: Response): Promise<{ code: string; details: Record<string, unknown> }> {
  const body = (await response.json()) as { error: { code: string; details?: Record<string, unknown> } };
  return { code: body.error.code, details: body.error.details ?? {} };
}

describe("M2.8 — routes collect / pay", () => {
  it("apply, replay a retry and map §11 rejections end-to-end", async () => {
    const sub = `m28-route-${suffix()}`;
    const session = await signInAs(worker, { sub, email: `${sub}@example.com` });
    const setup = await apiPost(worker, session.cookieHeader, "/api/manage-v2/setup", {
      requestId: `route-${suffix()}`,
      projectName: "مشروع الطريق",
      boxes: [{ kind: "cash", opening: { openingFils: 0 } }],
    });
    expect(setup.status).toBe(200);
    const projectId = ((await setup.json()) as { projectId: string }).projectId;

    // S5 through the route: a prior-marked collection.
    const body = {
      requestId: `route-${suffix()}`,
      projectId,
      amountFils: 100_000,
      box: "cash",
      counterpartyName: "محمد",
      priorBalance: true,
    };
    const first = await apiPost(worker, session.cookieHeader, "/api/manage-v2/collect", body);
    expect(first.status).toBe(200);
    const firstJson = (await first.json()) as RouteResponse;
    expect(firstJson.outcome).toBe("applied");
    expect(firstJson.result).toMatchObject({ kind: "OP-COLLECT", amountFils: 100_000 });

    const retry = await apiPost(worker, session.cookieHeader, "/api/manage-v2/collect", body);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({ outcome: "replay", result: firstJson.result });

    // A pay through the route on the prior payable.
    const payable = await apiPost(worker, session.cookieHeader, "/api/manage-v2/add-prior-balance", {
      requestId: `route-${suffix()}`,
      projectId,
      direction: "by_me",
      counterpartyName: "مؤسسة الكهرباء",
      amountFils: 25_000,
    });
    expect(payable.status).toBe(200);
    const pay = await apiPost(worker, session.cookieHeader, "/api/manage-v2/pay", {
      requestId: `route-${suffix()}`,
      projectId,
      amountFils: 25_000,
      box: "cash",
      counterpartyName: "مؤسسة الكهرباء",
    });
    expect(pay.status).toBe(200);
    expect(await pay.json()).toMatchObject({
      outcome: "applied",
      result: { kind: "OP-PAY", amountFils: 25_000 },
    });

    // §11 rejections end-to-end.
    const noBalance = await apiPost(worker, session.cookieHeader, "/api/manage-v2/collect", {
      requestId: `route-${suffix()}`,
      projectId,
      amountFils: 10_000,
      box: "cash",
      counterpartyName: "غير موجود",
    });
    expect(noBalance.status).toBe(400);
    expect((await errorOf(noBalance)).details).toMatchObject({ code: "E-NO-OPEN-BALANCE" });

    const bigPrior = await apiPost(worker, session.cookieHeader, "/api/manage-v2/collect", {
      requestId: `route-${suffix()}`,
      projectId,
      amountFils: 500_000,
      box: "cash",
      counterpartyName: "محمد",
      priorBalance: true,
    });
    expect(bigPrior.status).toBe(200);

    const invalid = await apiPost(worker, session.cookieHeader, "/api/manage-v2/pay", {
      requestId: `route-${suffix()}`,
      projectId,
      amountFils: 0,
      box: "cash",
      counterpartyName: "محمد",
    });
    expect(invalid.status).toBe(400);
    expect((await errorOf(invalid)).details).toMatchObject({ code: "E-AMOUNT" });

    // R-24 + anonymous.
    const otherSub = `m28-other-${suffix()}`;
    const other = await signInAs(worker, { sub: otherSub, email: `${otherSub}@example.com` });
    const foreign = await apiPost(worker, other.cookieHeader, "/api/manage-v2/collect", {
      requestId: `route-${suffix()}`,
      projectId,
      amountFils: 5_000,
      box: "cash",
      counterpartyName: "محمد",
    });
    expect(foreign.status).toBe(404);
    const anonymous = await apiPost(worker, null, "/api/manage-v2/pay", {
      requestId: `route-${suffix()}`,
      amountFils: 5_000,
      box: "cash",
      counterpartyName: "محمد",
    });
    expect(anonymous.status).toBe(401);

    await withSql(async sql => {
      // 100_000 (S5 collect) − 25_000 (pay) + 500_000 (prior collect) = 575_000.
      expect(await boxBalance(sql, projectId, "cash")).toBe(575_000);
      expect(await accountTotal(sql, projectId, "OPEN")).toBe(575_000);
      expect((await collectPayRows(sql, projectId)).length).toBe(3);
      assertLedgerCoreInvariants(await ledgerState(sql, projectId));
    });
  });
});
