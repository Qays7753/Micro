/**
 * M2.9 acceptance (Manage v2 phase 2, wave H — spec §5 OP-WRITE-OFF, §4 Q17,
 * R-12, R-26; tests T22, T25, T39): the standalone write-off on any open
 * `to_me` line — full or partial — with the owner-withdrawal treatment for
 * a loan given (Q17: loan_given → OWN_OUT +a) and the overpay rejection.
 *
 * Tests-first: this file was written before the operation existed and fails
 * with "Cannot find module … operations/writeOff.js".
 *
 * Scope notes (mirroring the M2.7/M2.8 precedents, documented in the
 * report): T22's collect+«لن يُحصَّل» shortfall answer is OP-COLLECT's
 * contract and was delivered with it (M2.8); what M2.9 owns is the
 * STANDALONE form — write off the remaining 3 AFTER a kept-outstanding
 * collection of 22, reaching T22's exact end state (remainder 0, sales 25,
 * returns & discounts 3, net 22 — and the §6 `completed` condition:
 * outstanding(sale_remainder) = 0). T25's lend half is M2.7's; its
 * write-off half completes here. «status completed» itself is a §6 derived
 * read (M2.11 / phase 3) — the test asserts its condition.
 *
 * Given-state seeding: the delivered sale of T22 is seeded exactly like
 * M2.8's (the rows OP-DELIVER will write in M3.4); the collect before the
 * write-off goes through the real composition.
 *
 * Posture: Miniflare over the per-file isolated PostgreSQL. Money is
 * integer fils. Every acceptance path ends with assertLedgerCoreInvariants
 * (INV-1 + INV-2).
 */
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiPost, signInAs, startWorker, type WorkerInstance } from "./harness.ts";
import {
  accountTotal,
  boxBalance,
  fileSqlUrl,
  ledgerState,
  linesWithOutstanding,
  resultOf,
  runPlan,
  scopedClient,
  setupProject,
} from "./manage.v2.helpers.ts";
import { planWriteOff, type WriteOffInput } from "../../../../src/domain/manage/operations/writeOff.js";
import { planCollect } from "../../../../src/domain/manage/operations/collect.js";
import { planOwnerWithdrawal } from "../../../../src/domain/manage/operations/ownerMoney.js";
import { planAddPriorBalance } from "../../../../src/domain/manage/operations/addPriorBalance.js";
import type { SetupBoxSlot } from "../../../../src/domain/manage/operations/setup.js";
import type { OperationPlan } from "../../../../src/domain/manage/operations/support.js";
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

async function withSql<T>(run: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const sql = scopedClient(dbUrl);
  try {
    return await run(sql);
  } finally {
    await sql.end();
  }
}

async function newProject(boxes: SetupBoxSlot[] = [{ kind: "cash", opening: { openingFils: 0 } }]) {
  const projectId = crypto.randomUUID();
  const owner = `m29-owner-${suffix()}`;
  await withSql(sql => setupProject(sql, { projectId, owner, today: AMMAN_TODAY, boxes }));
  return { projectId, owner };
}

/** Seed a DELIVERED sale with an open sale_remainder — the rows OP-DELIVER
 * (M3.4) will write (same posture as M2.8's tests). */
async function seedDeliveredSale(
  sql: postgres.Sql,
  projectId: string,
  input: { customerName: string | null; registeredOn: string; deliveredOn: string; priceFils: number },
): Promise<{ saleId: string; lineId: string }> {
  const saleId = crypto.randomUUID();
  const lineId = crypto.randomUUID();
  const operationId = crypto.randomUUID();
  const entryId = crypto.randomUUID();
  const createdAt = `${input.registeredOn}T12:00:00.000Z`;
  await sql`INSERT INTO sale (id, project_id, customer_name, registered_on, planned_delivery_on,
                              final_price_minor, tracked, hidden_from_tracker, created_at, updated_at)
            VALUES (${saleId}, ${projectId}, ${input.customerName}, ${input.registeredOn},
                    ${input.deliveredOn}, ${input.priceFils}, ${false}, ${false}, ${createdAt}, ${createdAt})`;
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

/** A prior receivable/payable through the real composition (M2.5). */
async function addPrior(
  sql: postgres.Sql,
  ctx: { projectId: string; owner: string },
  input: { direction: "to_me" | "by_me"; counterpartyName: string; amountFils: number },
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
    }),
  );
}

function writeOffPlan(
  ctx: { projectId: string; owner: string },
  requestId: string,
  input: { balanceLineId: string; amountFils?: number; effectiveOn?: string },
): OperationPlan {
  return planWriteOff({
    projectId: ctx.projectId,
    createdByAccountId: ctx.owner,
    requestId,
    today: AMMAN_TODAY,
    balanceLineId: input.balanceLineId,
    ...(input.amountFils === undefined ? {} : { amountFils: input.amountFils }),
    ...(input.effectiveOn === undefined ? {} : { effectiveOn: input.effectiveOn }),
  } as WriteOffInput);
}

/** Rows a refused plan must leave behind: none (R-12). */
async function persistedWriteCount(sql: postgres.Sql, projectId: string): Promise<number> {
  const operations =
    await sql`SELECT count(*)::int AS n FROM operation WHERE project_id = ${projectId} AND kind = 'OP-WRITE-OFF'`;
  const reservations = await sql`SELECT count(*)::int AS n FROM manage_v2_idempotency
    WHERE project_id = ${projectId} AND request_id LIKE 'attempt-%'`;
  return Number(operations[0]!.n) + Number(reservations[0]!.n);
}

async function expectRejected(
  ctx: { projectId: string; owner: string },
  make: (requestId: string) => OperationPlan,
  code: RegExp,
): Promise<void> {
  await withSql(sql => expect(runPlan(sql, () => make(`attempt-${suffix()}`))).rejects.toThrow(code));
}

/* ── 1. T22: the standalone write-off after a kept-outstanding collect ──── */

describe("M2.9 T22 — deliver 25, collect 22, then write off 3", () => {
  it("posts Q17 (AR −3, REV −3 write_off): remainder 0, sales 25, returns & discounts 3, net 22", async () => {
    const ctx = await newProject();
    const seeded = await withSql(sql =>
      seedDeliveredSale(sql, ctx.projectId, {
        customerName: "ليلى",
        registeredOn: "2026-11-25",
        deliveredOn: "2026-11-25",
        priceFils: 25_000,
      }),
    );
    // The collect of 22 keeps the 3 outstanding (M2.8's keep_outstanding).
    await withSql(sql =>
      runPlan(sql, () =>
        planCollect({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `req-${suffix()}`,
          today: AMMAN_TODAY,
          amountFils: 22_000,
          box: "cash",
          balanceLineId: seeded.lineId,
          shortfall: "keep_outstanding",
        }),
      ),
    );
    const result = resultOf(
      await withSql(sql =>
        runPlan(sql, () =>
          writeOffPlan(ctx, `attempt-${suffix()}`, { balanceLineId: seeded.lineId, amountFils: 3_000 }),
        ),
      ),
      "applied",
    );
    expect(result.kind).toBe("OP-WRITE-OFF");
    expect(result.amountFils).toBe(3_000);
    await withSql(async sql => {
      // T22 end state: cash +22; Sales 25, Returns & discounts 3, net 22;
      // remainder 0 — the §6 `completed` condition.
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(22_000);
      expect(await accountTotal(sql, ctx.projectId, "REV")).toBe(22_000);
      expect(
        (await linesWithOutstanding(sql, ctx.projectId)).find(l => l.id === seeded.lineId)?.outstanding,
      ).toBe(0);
      expect(result.entryIds).toHaveLength(1);
      const entry =
        (await sql`SELECT e.entry_type, e.effective_on::text AS effective_on, p.account, p.ref_id, p.rev_kind, p.delta_minor
        FROM ledger_entry e JOIN ledger_posting p ON p.entry_id = e.id
        WHERE e.project_id = ${ctx.projectId} AND e.id = ${result.entryIds[0]!}`) as Array<{
          entry_type: string;
          effective_on: string;
          account: string;
          ref_id: string | null;
          rev_kind: string | null;
          delta_minor: string;
        }>;
      expect(entry).toEqual([
        {
          entry_type: "Q17",
          effective_on: AMMAN_TODAY,
          account: "AR",
          ref_id: seeded.lineId,
          rev_kind: null,
          delta_minor: "-3000",
        },
        {
          entry_type: "Q17",
          effective_on: AMMAN_TODAY,
          account: "REV",
          ref_id: seeded.saleId,
          rev_kind: "write_off",
          delta_minor: "-3000",
        },
      ]);
      const op = (await sql`SELECT sale_id, balance_line_id, box_id, amount_minor FROM operation
        WHERE project_id = ${ctx.projectId} AND kind = 'OP-WRITE-OFF'`) as Array<{
        sale_id: string | null;
        balance_line_id: string | null;
        box_id: string | null;
        amount_minor: string;
      }>;
      expect(op).toHaveLength(1);
      expect(op[0]).toEqual({
        sale_id: seeded.saleId,
        balance_line_id: seeded.lineId,
        box_id: null,
        amount_minor: "3000",
      });
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("defaults the amount to the FULL outstanding when none is sent", async () => {
    const ctx = await newProject();
    const seeded = await withSql(sql =>
      seedDeliveredSale(sql, ctx.projectId, {
        customerName: "ليلى",
        registeredOn: "2026-11-25",
        deliveredOn: "2026-11-25",
        priceFils: 25_000,
      }),
    );
    await withSql(sql =>
      runPlan(sql, () =>
        planCollect({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `req-${suffix()}`,
          today: AMMAN_TODAY,
          amountFils: 20_000,
          box: "cash",
          balanceLineId: seeded.lineId,
          shortfall: "keep_outstanding",
        }),
      ),
    );
    const result = resultOf(
      await withSql(sql =>
        runPlan(sql, () => writeOffPlan(ctx, `attempt-${suffix()}`, { balanceLineId: seeded.lineId })),
      ),
      "applied",
    );
    expect(result.amountFils).toBe(5_000);
    await withSql(async sql => {
      expect(await accountTotal(sql, ctx.projectId, "REV")).toBe(20_000);
      expect(
        (await linesWithOutstanding(sql, ctx.projectId)).find(l => l.id === seeded.lineId)?.outstanding,
      ).toBe(0);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 2. T25: the write-off half of the loan given ──────────────────────── */

describe("M2.9 T25 — lend 50 to أخت, then write off", () => {
  it("posts Q17 (AR −50, OWN_OUT +50): receivable 0, withdrawals +50, profit unchanged", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 500_000 } }]);
    // The lend (M2.7): cash −50, receivable 50, withdrawals unchanged.
    await withSql(sql =>
      runPlan(sql, () =>
        planOwnerWithdrawal({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `req-${suffix()}`,
          today: AMMAN_TODAY,
          amountFils: 50_000,
          box: "cash",
          type: { type: "loan_given", name: "أخت" },
        }),
      ),
    );
    const lines = await withSql(sql => linesWithOutstanding(sql, ctx.projectId));
    const loanLine = lines.find(l => l.kind === "loan_given")!;
    const result = resultOf(
      await withSql(sql =>
        runPlan(sql, () =>
          writeOffPlan(ctx, `attempt-${suffix()}`, { balanceLineId: loanLine.id, amountFils: 50_000 }),
        ),
      ),
      "applied",
    );
    await withSql(async sql => {
      // T25 end state: receivable 0, withdrawals +50, profit unchanged, cash
      // unchanged by the write-off (it moves no money).
      expect(await accountTotal(sql, ctx.projectId, "AR")).toBe(0);
      expect(await accountTotal(sql, ctx.projectId, "OWN_OUT")).toBe(50_000);
      expect(await accountTotal(sql, ctx.projectId, "REV")).toBe(0);
      expect(await accountTotal(sql, ctx.projectId, "EXP")).toBe(0);
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(450_000);
      expect((await linesWithOutstanding(sql, ctx.projectId)).every(l => l.outstanding === 0)).toBe(true);
      expect(result.entryIds).toHaveLength(1);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 3. T39 + validation: the overpay rejection and the input contract ─── */

describe("M2.9 T39 — write off 30 on a line with outstanding 20", () => {
  it("is rejected with E-OVERPAY and nothing persists", async () => {
    const ctx = await newProject();
    await withSql(sql =>
      addPrior(sql, ctx, { direction: "to_me", counterpartyName: "سامي", amountFils: 20_000 }),
    );
    const line = (await withSql(sql => linesWithOutstanding(sql, ctx.projectId)))[0]!;
    await expectRejected(
      ctx,
      id => writeOffPlan(ctx, id, { balanceLineId: line.id, amountFils: 30_000 }),
      /E-OVERPAY/,
    );
    await withSql(async sql => {
      expect(await persistedWriteCount(sql, ctx.projectId)).toBe(0);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

describe("M2.9 — the §5 contract and §11 rejections", () => {
  it("allows a PARTIAL write-off on a prior_receivable (0 < amount ≤ outstanding)", async () => {
    const ctx = await newProject();
    await withSql(sql =>
      addPrior(sql, ctx, { direction: "to_me", counterpartyName: "سامي", amountFils: 20_000 }),
    );
    const line = (await withSql(sql => linesWithOutstanding(sql, ctx.projectId)))[0]!;
    const result = resultOf(
      await withSql(sql =>
        runPlan(sql, () =>
          writeOffPlan(ctx, `attempt-${suffix()}`, { balanceLineId: line.id, amountFils: 7_000 }),
        ),
      ),
      "applied",
    );
    await withSql(async sql => {
      // Q17 on a prior_receivable: AR −7, OPEN −7; profit never moves.
      expect(await accountTotal(sql, ctx.projectId, "OPEN")).toBe(13_000);
      expect((await linesWithOutstanding(sql, ctx.projectId))[0]).toMatchObject({ outstanding: 13_000 });
      expect(await accountTotal(sql, ctx.projectId, "REV")).toBe(0);
      expect(result.entryIds).toHaveLength(1);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("rejects a malformed amount (E-AMOUNT), a future date (E-FUTURE-DATE) and a non-open/non-to_me line (E-NO-OPEN-BALANCE)", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      await addPrior(sql, ctx, { direction: "to_me", counterpartyName: "سامي", amountFils: 20_000 });
      await addPrior(sql, ctx, {
        direction: "by_me",
        counterpartyName: "مؤسسة الكهرباء",
        amountFils: 30_000,
      });
    });
    const lines = await withSql(sql => linesWithOutstanding(sql, ctx.projectId));
    const toMe = lines.find(l => l.direction === "to_me")!;
    const byMe = lines.find(l => l.direction === "by_me")!;
    await expectRejected(
      ctx,
      id => writeOffPlan(ctx, id, { balanceLineId: toMe.id, amountFils: 0 }),
      /E-AMOUNT/,
    );
    await expectRejected(
      ctx,
      id => writeOffPlan(ctx, id, { balanceLineId: toMe.id, amountFils: -5_000 }),
      /E-AMOUNT/,
    );
    await expectRejected(
      ctx,
      id => writeOffPlan(ctx, id, { balanceLineId: toMe.id, amountFils: 12.5 }),
      /E-AMOUNT/,
    );
    await expectRejected(
      ctx,
      id => writeOffPlan(ctx, id, { balanceLineId: toMe.id, effectiveOn: "2026-11-28" }),
      /E-FUTURE-DATE/,
    );
    // A by_me line is not writable off (§5: open to_me lines only).
    await expectRejected(
      ctx,
      id => writeOffPlan(ctx, id, { balanceLineId: byMe.id, amountFils: 5_000 }),
      /E-NO-OPEN-BALANCE/,
    );
    // A nonexistent line is not an open balance.
    await expectRejected(
      ctx,
      id => writeOffPlan(ctx, id, { balanceLineId: crypto.randomUUID() }),
      /E-NO-OPEN-BALANCE/,
    );
    // A fully collected line is closed.
    await withSql(sql =>
      runPlan(sql, () =>
        planCollect({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `req-${suffix()}`,
          today: AMMAN_TODAY,
          amountFils: 20_000,
          box: "cash",
          counterpartyName: "سامي",
        }),
      ),
    );
    await expectRejected(
      ctx,
      id => writeOffPlan(ctx, id, { balanceLineId: toMe.id, amountFils: 1_000 }),
      /E-NO-OPEN-BALANCE/,
    );
    await withSql(async sql => {
      expect(await persistedWriteCount(sql, ctx.projectId)).toBe(0);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 4. T55: one request id → one operation ────────────────────────────── */

describe("M2.9 T55 — a retried write-off", () => {
  it("replays the write-off and answers a different body with a conflict", async () => {
    const ctx = await newProject();
    await withSql(sql =>
      addPrior(sql, ctx, { direction: "to_me", counterpartyName: "سامي", amountFils: 20_000 }),
    );
    const line = (await withSql(sql => linesWithOutstanding(sql, ctx.projectId)))[0]!;
    const requestId = `attempt-${suffix()}`;
    const input = { balanceLineId: line.id, amountFils: 20_000 };
    const first = resultOf(
      await withSql(sql => runPlan(sql, () => writeOffPlan(ctx, requestId, input))),
      "applied",
    );
    const again = resultOf(
      await withSql(sql => runPlan(sql, () => writeOffPlan(ctx, requestId, input))),
      "replay",
    );
    expect(again).toEqual(first);
    const conflict = await withSql(sql =>
      runPlan(sql, () => writeOffPlan(ctx, requestId, { balanceLineId: line.id, amountFils: 10_000 })),
    );
    expect(conflict).toEqual({ outcome: "conflict", reason: "E-IDEMPOTENCY-CONFLICT" });
    await withSql(async sql => {
      expect(await accountTotal(sql, ctx.projectId, "AR")).toBe(0);
      const ops =
        await sql`SELECT count(*)::int AS n FROM operation WHERE project_id = ${ctx.projectId} AND kind = 'OP-WRITE-OFF'`;
      expect(Number(ops[0]!.n)).toBe(1);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 5. The route ──────────────────────────────────────────────────────── */

interface RouteResponse {
  outcome: string;
  result: { operationId: string; kind: string; amountFils: number };
}

async function errorOf(response: Response): Promise<{ code: string; details: Record<string, unknown> }> {
  const body = (await response.json()) as { error: { code: string; details?: Record<string, unknown> } };
  return { code: body.error.code, details: body.error.details ?? {} };
}

describe("M2.9 — route POST /api/manage-v2/write-off", () => {
  it("applies, replays a retry and maps §11 rejections end-to-end", async () => {
    const sub = `m29-route-${suffix()}`;
    const session = await signInAs(worker, { sub, email: `${sub}@example.com` });
    const setup = await apiPost(worker, session.cookieHeader, "/api/manage-v2/setup", {
      requestId: `route-${suffix()}`,
      projectName: "مشروع الطريق",
      boxes: [{ kind: "cash", opening: { openingFils: 0 } }],
    });
    expect(setup.status).toBe(200);
    const projectId = ((await setup.json()) as { projectId: string }).projectId;

    // A prior receivable to write off, through the real surface.
    const prior = await apiPost(worker, session.cookieHeader, "/api/manage-v2/add-prior-balance", {
      requestId: `route-${suffix()}`,
      projectId,
      direction: "to_me",
      counterpartyName: "سامي",
      amountFils: 20_000,
    });
    expect(prior.status).toBe(200);

    const sql0 = scopedClient(dbUrl);
    const lineId = String(
      (
        await sql0`SELECT id FROM balance_line WHERE project_id = ${projectId} AND direction = 'to_me' LIMIT 1`
      )[0]!.id,
    );
    await sql0.end();

    const body = { requestId: `route-${suffix()}`, projectId, balanceLineId: lineId, amountFils: 20_000 };
    const first = await apiPost(worker, session.cookieHeader, "/api/manage-v2/write-off", body);
    expect(first.status).toBe(200);
    const firstJson = (await first.json()) as RouteResponse;
    expect(firstJson.outcome).toBe("applied");
    expect(firstJson.result).toMatchObject({ kind: "OP-WRITE-OFF", amountFils: 20_000 });

    const retry = await apiPost(worker, session.cookieHeader, "/api/manage-v2/write-off", body);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({ outcome: "replay", result: firstJson.result });

    // §11 rejections end-to-end.
    const overpay = await apiPost(worker, session.cookieHeader, "/api/manage-v2/write-off", {
      requestId: `route-${suffix()}`,
      projectId,
      balanceLineId: lineId,
      amountFils: 5_000,
    });
    expect(overpay.status).toBe(400);
    expect((await errorOf(overpay)).details).toMatchObject({ code: "E-NO-OPEN-BALANCE" });

    const invalid = await apiPost(worker, session.cookieHeader, "/api/manage-v2/write-off", {
      requestId: `route-${suffix()}`,
      projectId,
      balanceLineId: lineId,
      amountFils: 0,
    });
    expect(invalid.status).toBe(400);
    expect((await errorOf(invalid)).details).toMatchObject({ code: "E-AMOUNT" });

    // R-24 + anonymous.
    const otherSub = `m29-other-${suffix()}`;
    const other = await signInAs(worker, { sub: otherSub, email: `${otherSub}@example.com` });
    const foreign = await apiPost(worker, other.cookieHeader, "/api/manage-v2/write-off", {
      requestId: `route-${suffix()}`,
      projectId,
      balanceLineId: lineId,
      amountFils: 1_000,
    });
    expect(foreign.status).toBe(404);
    const anonymous = await apiPost(worker, null, "/api/manage-v2/write-off", body);
    expect(anonymous.status).toBe(401);

    await withSql(async sql => {
      expect(await accountTotal(sql, projectId, "OPEN")).toBe(0);
      expect(await accountTotal(sql, projectId, "AR")).toBe(0);
      assertLedgerCoreInvariants(await ledgerState(sql, projectId));
    });
  });
});
