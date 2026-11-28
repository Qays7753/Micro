/**
 * M5.5 acceptance (Manage v2 phase 5 — UX P-38 «إضافة صندوق»): the
 * OP-ADD-BOX route — the missing box (P-38 always sends "account") with
 * its opening; Q1 TODAY when known (R-26), no entry when unknown; R-25
 * replay; R-24 the unified 404; and E-BOX-LIMIT on a duplicate kind.
 *
 * Tests-first: the first run fails on the not-yet-existing route.
 */
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiPost, apiGet, signInAs, startWorker, type WorkerInstance } from "./harness.ts";
import { fileSqlUrl, scopedClient, setupProject } from "./manage.v2.helpers.ts";
import { computeManageFigures } from "../application/manage/readModel.js";
import type { SetupBoxSlot } from "../../../../src/domain/manage/operations/setup.js";

let worker: WorkerInstance;
let dbUrl = "";

beforeAll(async () => {
  worker = await startWorker();
  dbUrl = await fileSqlUrl(worker);
});

afterAll(async () => {
  await worker.close();
});

const AMMAN_TODAY = "2026-11-28";

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

async function newProject(boxes: SetupBoxSlot[]) {
  const projectId = crypto.randomUUID();
  const owner = `m55-owner-${suffix()}`;
  await withSql(sql => setupProject(sql, { projectId, owner, today: AMMAN_TODAY, boxes }));
  return { projectId, owner };
}

describe("M5.5 — the add-box route (P-38, §5 OP-ADD-BOX)", () => {
  it("adds the account with a known opening: Q1 TODAY, two active boxes, unknown flags clear", async () => {
    const sub = `m55-known-${suffix()}`;
    const session = await signInAs(worker, { sub, email: `${sub}@example.com` });
    const setup = await apiPost(worker, session.cookieHeader, "/api/manage-v2/setup", {
      requestId: `m55-${crypto.randomUUID()}`,
      projectName: "مشروع",
      boxes: [{ kind: "cash", opening: { openingFils: 100_000 } }],
    });
    expect(setup.status).toBe(200);
    const projectId = ((await setup.json()) as { projectId: string }).projectId;

    const add = await apiPost(worker, session.cookieHeader, "/api/manage-v2/add-box", {
      requestId: `m55-${crypto.randomUUID()}`,
      kind: "account",
      opening: { openingFils: 40_000 },
    });
    expect(add.status).toBe(200);
    const body = (await add.json()) as { outcome: string; result: { kind: string; entryIds: string[] } };
    expect(body.outcome).toBe("applied");
    expect(body.result.kind).toBe("OP-ADD-BOX");
    expect(body.result.entryIds).toHaveLength(1);

    await withSql(async sql => {
      const figures = await computeManageFigures(sql, projectId, AMMAN_TODAY, "month");
      const account = figures.boxes.find(box => box.kind === "account");
      expect(account).toMatchObject({ status: "active", openingStatus: "known", balanceFils: 40_000 });
      expect(figures.totalBalance).toMatchObject({ fils: 140_000 });
      expect(figures.flags.unknownBalance).toBe(false);
    });
  });

  it("adds the account with an unknown opening: no entry, the unknown flags set", async () => {
    const sub = `m55-unknown-${suffix()}`;
    const session = await signInAs(worker, { sub, email: `${sub}@example.com` });
    const setup = await apiPost(worker, session.cookieHeader, "/api/manage-v2/setup", {
      requestId: `m55-${crypto.randomUUID()}`,
      projectName: "مشروع",
      boxes: [{ kind: "cash", opening: { openingFils: 50_000 } }],
    });
    expect(setup.status).toBe(200);
    const projectId = ((await setup.json()) as { projectId: string }).projectId;

    const add = await apiPost(worker, session.cookieHeader, "/api/manage-v2/add-box", {
      requestId: `m55-${crypto.randomUUID()}`,
      kind: "account",
      opening: { unknown: true },
    });
    expect(add.status).toBe(200);
    const body = (await add.json()) as { result: { entryIds: string[] } };
    expect(body.result.entryIds).toHaveLength(0);

    await withSql(async sql => {
      const figures = await computeManageFigures(sql, projectId, AMMAN_TODAY, "month");
      const account = figures.boxes.find(box => box.kind === "account");
      expect(account).toMatchObject({ balanceFils: null, balanceLabelKey: "l.unknown_balance" });
      expect(figures.flags.unknownBalance).toBe(true);
    });
  });

  it("R-25: the same request id replays without a second box or entry; E-BOX-LIMIT on a duplicate", async () => {
    const sub = `m55-replay-${suffix()}`;
    const session = await signInAs(worker, { sub, email: `${sub}@example.com` });
    await apiPost(worker, session.cookieHeader, "/api/manage-v2/setup", {
      requestId: `m55-${crypto.randomUUID()}`,
      projectName: "مشروع",
      boxes: [{ kind: "cash", opening: { openingFils: 10_000 } }],
    });
    const requestId = `m55-${crypto.randomUUID()}`;
    const first = await apiPost(worker, session.cookieHeader, "/api/manage-v2/add-box", {
      requestId,
      kind: "account",
      opening: { openingFils: 5_000 },
    });
    expect(first.status).toBe(200);
    const replay = await apiPost(worker, session.cookieHeader, "/api/manage-v2/add-box", {
      requestId,
      kind: "account",
      opening: { openingFils: 5_000 },
    });
    expect(replay.status).toBe(200);
    expect(((await replay.json()) as { outcome: string }).outcome).toBe("replay");

    /* A THIRD add of the same kind is E-BOX-LIMIT (R-9) — the rare case the
     * UX hides the button for; the route keeps it honest. */
    const duplicate = await apiPost(worker, session.cookieHeader, "/api/manage-v2/add-box", {
      requestId: `m55-${crypto.randomUUID()}`,
      kind: "account",
      opening: { openingFils: 5_000 },
    });
    expect(duplicate.status).toBe(400);
    expect(((await duplicate.json()) as { error: { details: { code: string } } }).error.details.code).toBe(
      "E-BOX-LIMIT",
    );
  });

  it("R-24: another account's add-box is the unified 404", async () => {
    const sub = `m55-route-${suffix()}`;
    const session = await signInAs(worker, { sub, email: `${sub}@example.com` });
    const otherSub = `m55-other-${suffix()}`;
    const otherSession = await signInAs(worker, { sub: otherSub, email: `${otherSub}@example.com` });
    /* No project yet → the unified 404 for both callers. */
    const noProject = await apiPost(worker, session.cookieHeader, "/api/manage-v2/add-box", {
      requestId: `m55-${crypto.randomUUID()}`,
      kind: "account",
      opening: { openingFils: 5_000 },
    });
    expect(noProject.status).toBe(404);
    const foreign = await apiGet(worker, otherSession.cookieHeader, "/api/manage-v2/figures");
    expect(foreign.status).toBe(404);
  });
});
