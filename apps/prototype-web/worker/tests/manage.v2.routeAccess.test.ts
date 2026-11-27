/**
 * M2.5 correction (Manage v2 phase 2, wave G — R-24, R-25/T55, SRV-02):
 * the Manage v2 write surface must never trust a project id from the request
 * body (R-24: the project is resolved from the signed-in account ONLY), must
 * not persist anything before the operation's input is validated (an invalid
 * first setup must not strand the account), and must read its body through
 * the shared JSON reader (the SRV-02 256 KiB cap).
 *
 * Tests-first: this file was written while the routes still honored
 * `body.projectId` and created the project row before validation. Against
 * that code the authorization, stranding, replay, healing and body-cap cases
 * all failed.
 *
 * Posture: Miniflare over the per-file isolated PostgreSQL (migrations
 * 0001–0019); the HTTP surface is exercised end-to-end (signInAs + apiPost).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiPost, signInAs, startWorker, type WorkerInstance } from "./harness.ts";
import { accountTotal, fileSqlUrl, ledgerState, scopedClient } from "./manage.v2.helpers.ts";
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

function suffix(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** A fresh signed-in account + its network_identity id (the id projects use
 * as owner_account_id). */
async function signIn(prefix: string): Promise<{ cookieHeader: string; sub: string; identityId: string }> {
  const sub = `${prefix}-${suffix()}`;
  const session = await signInAs(worker, { sub, email: `${sub}@example.com` });
  const sql = scopedClient(dbUrl);
  try {
    const rows = await sql`SELECT id FROM network_identity WHERE google_sub = ${sub}`;
    return { cookieHeader: session.cookieHeader, sub, identityId: String(rows[0]!.id) };
  } finally {
    await sql.end();
  }
}

function setupBody(requestId: string): Record<string, unknown> {
  return {
    requestId,
    projectName: "مشروع الطريق",
    boxes: [{ kind: "cash", opening: { openingFils: 30_000 } }],
  };
}

interface SetupResponse {
  outcome: string;
  projectId: string;
  result: { operationId: string };
}

async function errorOf(response: Response): Promise<{ code: string; details: Record<string, unknown> }> {
  const body = (await response.json()) as { error: { code: string; details?: Record<string, unknown> } };
  return { code: body.error.code, details: body.error.details ?? {} };
}

async function projectCount(identityId: string): Promise<number> {
  const sql = scopedClient(dbUrl);
  try {
    const rows = await sql`SELECT count(*)::int AS n FROM project WHERE owner_account_id = ${identityId}`;
    return Number(rows[0]!.n);
  } finally {
    await sql.end();
  }
}

async function shapeOf(projectId: string): Promise<{ boxes: string[]; operations: number }> {
  const sql = scopedClient(dbUrl);
  try {
    const boxes = await sql`SELECT kind FROM box WHERE project_id = ${projectId} ORDER BY kind`;
    const ops = await sql`SELECT count(*)::int AS n FROM operation WHERE project_id = ${projectId}`;
    return { boxes: boxes.map(b => String(b.kind)), operations: Number(ops[0]!.n) };
  } finally {
    await sql.end();
  }
}

/* ── 1. R-24: the project comes from the session, never from the body ───── */

describe("M2.5 correction — R-24: the project is the caller's own or nothing", () => {
  it("refuses another account's projectId and writes nothing into it", async () => {
    const alice = await signIn("m25c-alice");
    const setup = await apiPost(
      worker,
      alice.cookieHeader,
      "/api/manage-v2/setup",
      setupBody(`req-${suffix()}`),
    );
    expect(setup.status).toBe(200);
    const aliceProjectId = ((await setup.json()) as SetupResponse).projectId;
    expect(aliceProjectId.length).toBeGreaterThan(0);

    // A different signed-in account names Alice's project explicitly.
    const mallory = await signIn("m25c-mallory");
    const addBox = await apiPost(worker, mallory.cookieHeader, "/api/manage-v2/add-box", {
      requestId: `req-${suffix()}`,
      projectId: aliceProjectId,
      kind: "account",
      opening: { openingFils: 5000 },
    });
    // Indistinguishable from "you have no project": no existence leak.
    expect(addBox.status).toBe(404);
    expect((await errorOf(addBox)).code).toBe("not_found");

    const prior = await apiPost(worker, mallory.cookieHeader, "/api/manage-v2/add-prior-balance", {
      requestId: `req-${suffix()}`,
      projectId: aliceProjectId,
      direction: "to_me",
      counterpartyName: "خالد",
      amountFils: 40_000,
    });
    expect(prior.status).toBe(404);

    const sql = scopedClient(dbUrl);
    try {
      expect(await shapeOf(aliceProjectId)).toEqual({ boxes: ["cash"], operations: 1 });
      expect(await accountTotal(sql, aliceProjectId, "AR")).toBe(0);
      assertLedgerCoreInvariants(await ledgerState(sql, aliceProjectId));
    } finally {
      await sql.end();
    }
  });

  it("still accepts the caller's OWN projectId in the body", async () => {
    const user = await signIn("m25c-own");
    const setup = await apiPost(
      worker,
      user.cookieHeader,
      "/api/manage-v2/setup",
      setupBody(`req-${suffix()}`),
    );
    const projectId = ((await setup.json()) as SetupResponse).projectId;

    const response = await apiPost(worker, user.cookieHeader, "/api/manage-v2/add-box", {
      requestId: `req-${suffix()}`,
      projectId,
      kind: "account",
      opening: { openingFils: 25_000 },
    });
    expect(response.status).toBe(200);
    expect(((await response.json()) as { outcome: string }).outcome).toBe("applied");
    expect(await shapeOf(projectId)).toEqual({ boxes: ["account", "cash"], operations: 2 });
  });

  it("refuses an unauthenticated write", async () => {
    const response = await apiPost(worker, null, "/api/manage-v2/setup", setupBody(`req-${suffix()}`));
    expect(response.status).toBe(401);
  });
});

/* ── 2. Nothing persists before the operation's input is validated ──────── */

describe("M2.5 correction — an invalid first setup must not strand the account", () => {
  it("leaves no project row behind, and the same account can then set up", async () => {
    const user = await signIn("m25c-invalid");
    const rejected = await apiPost(worker, user.cookieHeader, "/api/manage-v2/setup", {
      ...setupBody(`req-${suffix()}`),
      projectName: "   ",
    });
    expect(rejected.status).toBe(400);
    expect((await errorOf(rejected)).details).toMatchObject({ code: "E-NAME-REQUIRED" });
    expect(await projectCount(user.identityId)).toBe(0);

    const accepted = await apiPost(
      worker,
      user.cookieHeader,
      "/api/manage-v2/setup",
      setupBody(`req-${suffix()}`),
    );
    expect(accepted.status).toBe(200);
    expect(((await accepted.json()) as { outcome: string }).outcome).toBe("applied");
    expect(await projectCount(user.identityId)).toBe(1);
  });

  it("completes a project row left behind by an aborted first setup", async () => {
    const user = await signIn("m25c-aborted");
    const stranded = crypto.randomUUID();
    const sql = scopedClient(dbUrl);
    try {
      // What a crash between the project INSERT and the operation's commit
      // would leave: the R-24 row exists, nothing else does.
      await sql`INSERT INTO project (id, name, owner_account_id, created_at)
                VALUES (${stranded}, ${"مشروع"}, ${user.identityId}, now())`;
    } finally {
      await sql.end();
    }

    const response = await apiPost(
      worker,
      user.cookieHeader,
      "/api/manage-v2/setup",
      setupBody(`req-${suffix()}`),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as SetupResponse;
    expect(body.outcome).toBe("applied");
    expect(body.projectId).toBe(stranded);
    expect(await shapeOf(stranded)).toEqual({ boxes: ["cash"], operations: 1 });
  });
});

/* ── 3. T55 / R-25: one request id → one operation ──────────────────────── */

describe("M2.5 correction — setup retry and repeat", () => {
  it("replays the original operation on a retried setup (same request id, same body)", async () => {
    const user = await signIn("m25c-replay");
    const body = setupBody(`req-${suffix()}`);
    const first = await apiPost(worker, user.cookieHeader, "/api/manage-v2/setup", body);
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as SetupResponse;
    expect(firstBody.outcome).toBe("applied");

    const second = await apiPost(worker, user.cookieHeader, "/api/manage-v2/setup", body);
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as SetupResponse;
    expect(secondBody.outcome).toBe("replay");
    expect(secondBody.projectId).toBe(firstBody.projectId);
    expect(secondBody.result.operationId).toBe(firstBody.result.operationId);
    expect(await shapeOf(firstBody.projectId)).toEqual({ boxes: ["cash"], operations: 1 });
  });

  it("replays a retried add-box and add-prior-balance (plans that generate ids)", async () => {
    const user = await signIn("m25c-replay-ops");
    const setup = await apiPost(
      worker,
      user.cookieHeader,
      "/api/manage-v2/setup",
      setupBody(`req-${suffix()}`),
    );
    const projectId = ((await setup.json()) as SetupResponse).projectId;

    // The plan of each of these carries an id generated at planning time
    // (the new box, the new balance line): a retry plans again with a
    // fresh id and must still replay the committed operation.
    const addBox = { requestId: `req-${suffix()}`, kind: "account", opening: { openingFils: 25_000 } };
    const firstBox = (await (
      await apiPost(worker, user.cookieHeader, "/api/manage-v2/add-box", addBox)
    ).json()) as SetupResponse;
    expect(firstBox.outcome).toBe("applied");
    const againBox = (await (
      await apiPost(worker, user.cookieHeader, "/api/manage-v2/add-box", addBox)
    ).json()) as SetupResponse;
    expect(againBox.outcome).toBe("replay");
    expect(againBox.result.operationId).toBe(firstBox.result.operationId);

    const prior = {
      requestId: `req-${suffix()}`,
      direction: "to_me",
      counterpartyName: "خالد",
      amountFils: 40_000,
    };
    const firstPrior = (await (
      await apiPost(worker, user.cookieHeader, "/api/manage-v2/add-prior-balance", prior)
    ).json()) as SetupResponse;
    expect(firstPrior.outcome).toBe("applied");
    const againPrior = (await (
      await apiPost(worker, user.cookieHeader, "/api/manage-v2/add-prior-balance", prior)
    ).json()) as SetupResponse;
    expect(againPrior.outcome).toBe("replay");
    expect(againPrior.result.operationId).toBe(firstPrior.result.operationId);

    const sql = scopedClient(dbUrl);
    try {
      expect(await shapeOf(projectId)).toEqual({ boxes: ["account", "cash"], operations: 3 });
      expect(await accountTotal(sql, projectId, "AR")).toBe(40_000);
      const lines = await sql`SELECT count(*)::int AS n FROM balance_line WHERE project_id = ${projectId}`;
      expect(Number(lines[0]!.n)).toBe(1);
    } finally {
      await sql.end();
    }
  });

  it("answers a request id reused with a DIFFERENT body as 409, not a success", async () => {
    const user = await signIn("m25c-conflict");
    const requestId = `req-${suffix()}`;
    const first = await apiPost(worker, user.cookieHeader, "/api/manage-v2/setup", setupBody(requestId));
    expect(first.status).toBe(200);

    const reused = await apiPost(worker, user.cookieHeader, "/api/manage-v2/setup", {
      requestId,
      projectName: "مشروع آخر",
      boxes: [{ kind: "cash", opening: { openingFils: 99_000 } }],
    });
    expect(reused.status).toBe(409);
    expect(await errorOf(reused)).toMatchObject({
      code: "conflict",
      details: { code: "E-IDEMPOTENCY-CONFLICT" },
    });
  });

  it("rejects a setup on an initialized project with a NEW request id (E-BOX-LIMIT), changing nothing", async () => {
    const user = await signIn("m25c-twice");
    const first = await apiPost(
      worker,
      user.cookieHeader,
      "/api/manage-v2/setup",
      setupBody(`req-${suffix()}`),
    );
    const projectId = ((await first.json()) as SetupResponse).projectId;

    const again = await apiPost(worker, user.cookieHeader, "/api/manage-v2/setup", {
      requestId: `req-${suffix()}`,
      projectName: "مشروع الطريق",
      boxes: [{ kind: "account", opening: { openingFils: 10_000 } }],
    });
    expect(again.status).toBe(400);
    expect((await errorOf(again)).details).toMatchObject({ code: "E-BOX-LIMIT" });

    const sql = scopedClient(dbUrl);
    try {
      expect(await shapeOf(projectId)).toEqual({ boxes: ["cash"], operations: 1 });
      assertLedgerCoreInvariants(await ledgerState(sql, projectId));
    } finally {
      await sql.end();
    }
  });
});

/* ── 4. SRV-02: the shared body reader ──────────────────────────────────── */

describe("M2.5 correction — the SRV-02 body cap applies to the Manage v2 writes", () => {
  it("refuses an oversized body before anything is persisted", async () => {
    const user = await signIn("m25c-oversize");
    const response = await apiPost(worker, user.cookieHeader, "/api/manage-v2/setup", {
      ...setupBody(`req-${suffix()}`),
      filler: "x".repeat(300 * 1024),
    });
    expect(response.status).toBe(400);
    expect(await errorOf(response)).toMatchObject({
      code: "bad_request",
      details: { reason: "body_too_large" },
    });
    expect(await projectCount(user.identityId)).toBe(0);
  });

  it("refuses a malformed JSON body", async () => {
    const user = await signIn("m25c-malformed");
    const response = await worker.fetch("/api/manage-v2/setup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: worker.origin,
        "x-micro-api": "1",
        cookie: user.cookieHeader,
      },
      body: "{not json",
    });
    expect(response.status).toBe(400);
    expect(await errorOf(response)).toMatchObject({
      code: "bad_request",
      details: { reason: "invalid_json" },
    });
    expect(await projectCount(user.identityId)).toBe(0);
  });
});
