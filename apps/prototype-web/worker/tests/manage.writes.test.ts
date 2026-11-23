/**
 * Manage Online connected writes acceptance (EX-D23, wave M4) — real workerd
 * over the real PostgreSQL target. Proves: owner-only transactional upserts
 * with in-statement CAS (no last-writer-wins), idempotent replays that never
 * duplicate effects, exact money representation round-trips, honest conflicts,
 * and cross-workspace write isolation (the record key's workspace comes from
 * the gate, never from the client).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiGet, apiPost, rawDb, signInAs, startWorker, type WorkerInstance } from "./harness.ts";
import { readRawRecord } from "../api/manageWrites.ts";

let worker: WorkerInstance;
const PROOF = "manage-writes-proof-0123456789abcdef0123456789abcdef";

interface Linked {
  cookieHeader: string;
  workspaceId: string;
}

async function seedLinkedOwner(worker: WorkerInstance, email: string, workspaceId: string): Promise<Linked> {
  const cookieHeader = (await signInAs(worker, { sub: `sub-${workspaceId}`, email })).cookieHeader;
  const db = await rawDb(worker);
  const identity = await db
    .prepare("SELECT id FROM network_identity WHERE email = ?")
    .bind(email)
    .first<{ id: string }>();
  await db
    .prepare(
      "INSERT INTO workspace (id, display_name, created_by_identity_id, market_enabled, delivery_enabled, created_at, updated_at) VALUES (?, ?, ?, 1, 1, 1, 1)",
    )
    .bind(workspaceId, `مساحة ${workspaceId}`, identity!.id)
    .run();
  await db
    .prepare(
      "INSERT INTO workspace_member (workspace_id, identity_id, role, status, granted_by_identity_id, granted_at) VALUES (?, ?, 'owner', 'active', ?, 1)",
    )
    .bind(workspaceId, identity!.id, identity!.id)
    .run();
  await db.prepare("UPDATE workspace SET manage_enabled = 1 WHERE id = ?").bind(workspaceId).run();
  const start = await apiPost(worker, cookieHeader, "/api/manage/link/start", { proofSecret: PROOF });
  const started = (await start.json()) as { nonce: string };
  const confirm = await apiPost(worker, cookieHeader, "/api/manage/link/confirm", { nonce: started.nonce });
  expect(confirm.status).toBe(200);
  return { cookieHeader, workspaceId };
}

function put(
  worker: WorkerInstance,
  cookie: string,
  family: string,
  id: string,
  body: { data: unknown; expectedUpdatedAt?: number | null },
  headers: Record<string, string> = {},
): Promise<Response> {
  return worker.fetch(`/api/manage/records/${family}/${id}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      origin: worker.origin,
      "x-micro-api": "1",
      cookie,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  worker = await startWorker();
});

afterAll(async () => {
  await worker.close();
});

describe("manage writes (M4): authorization and shape", () => {
  it("rejects unauthenticated and unlinked callers (401/403, audited)", async () => {
    const guest = await put(worker, "", "assets", "w-1", { data: {} });
    expect(guest.status).toBe(401);
    const loner = await signInAs(worker, { sub: "sub-m4-loner", email: "m4-loner@example.test" });
    const refused = await put(worker, loner.cookieHeader, "assets", "w-1", { data: {} });
    expect(refused.status).toBe(403);
    expect(((await refused.json()) as { error: { code: string } }).error.code).toBe("workspace_missing");
    const db = await rawDb(worker);
    const audits = await db
      .prepare("SELECT result FROM network_audit_event WHERE action = 'manage.write.record'")
      .all<{ result: string }>();
    expect(audits.results.some(a => a.result === "denied")).toBe(true);
  });

  it("validates family/id/data shapes honestly (400)", async () => {
    const linked = await seedLinkedOwner(worker, "m4-shape@example.test", "ws_m4_shape");
    expect((await put(worker, linked.cookieHeader, "Bad_Family", "x", { data: {} })).status).toBe(400);
    expect((await put(worker, linked.cookieHeader, "assets", "x".repeat(300), { data: {} })).status).toBe(
      400,
    );
    expect((await put(worker, linked.cookieHeader, "assets", "w-1", { data: [1, 2] })).status).toBe(400);
    expect((await put(worker, linked.cookieHeader, "assets", "w-1", { data: null })).status).toBe(400);
  });
});

describe("manage writes (M4): transactional CAS upserts", () => {
  it("creates once, refuses a blind second create, updates on the exact basis, refuses a stale basis (MO-12)", async () => {
    const linked = await seedLinkedOwner(worker, "m4-cas@example.test", "ws_m4_cas");
    const first = await put(worker, linked.cookieHeader, "craft-orders", "o-1", {
      data: { orderName: "طلب أ", depositMinor: 12500 },
    });
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as { saved: boolean; updatedAt: number; created: boolean };
    expect(firstBody.saved).toBe(true);
    expect(firstBody.created).toBe(true);

    // A blind create over an existing record is an honest 409 — never an overwrite.
    const blindSecond = await put(worker, linked.cookieHeader, "craft-orders", "o-1", {
      data: { orderName: "متجاوز" },
    });
    expect(blindSecond.status).toBe(409);

    // Update on the exact basis succeeds.
    const update = await put(worker, linked.cookieHeader, "craft-orders", "o-1", {
      data: { orderName: "طلب أ المعدل", depositMinor: 13000 },
      expectedUpdatedAt: firstBody.updatedAt,
    });
    expect(update.status).toBe(200);
    const updateBody = (await update.json()) as { saved: boolean; created: boolean; updatedAt: number };
    expect(updateBody.created).toBe(false);

    // The stale basis is refused with the live value disclosed for the re-read.
    const stale = await put(worker, linked.cookieHeader, "craft-orders", "o-1", {
      data: { orderName: "قديم" },
      expectedUpdatedAt: firstBody.updatedAt,
    });
    expect(stale.status).toBe(409);
    const staleBody = (await stale.json()) as {
      error: { details: { reason: string; currentUpdatedAt: number } };
    };
    expect(staleBody.error.details.reason).toBe("manage_record_stale");
    expect(staleBody.error.details.currentUpdatedAt).toBe(updateBody.updatedAt);

    // An update against an absent record is an honest 404.
    const absent = await put(worker, linked.cookieHeader, "craft-orders", "o-missing", {
      data: { orderName: "غير موجود" },
      expectedUpdatedAt: 1,
    });
    expect(absent.status).toBe(404);

    // The final stored value is exactly the winner's — no merge, no lost update.
    const db = await rawDb(worker);
    expect(await readRawRecord(db, "ws_m4_cas", "craft-orders", "o-1")).toBe(
      JSON.stringify({ orderName: "طلب أ المعدل", depositMinor: 13000 }),
    );
  });

  it("preserves exact money values literally (integers stay integers — contract 25)", async () => {
    const linked = await seedLinkedOwner(worker, "m4-exact@example.test", "ws_m4_exact");
    const exact = 9007199254740991; // 2^53 - 1 — the largest exact JSON integer
    const created = await put(worker, linked.cookieHeader, "assets", "w-exact", {
      data: { openingMinor: exact, rate: 3, note: "قيمة دقيقة" },
    });
    expect(created.status).toBe(200);
    const read = await apiGet(worker, linked.cookieHeader, "/api/manage/records/assets/w-exact");
    const body = (await read.json()) as { data: { openingMinor: number; rate: number } };
    expect(body.data.openingMinor).toBe(exact);
    expect(Number.isInteger(body.data.openingMinor)).toBe(true);
  });

  it("replays an idempotent retry without a second effect (MO-11)", async () => {
    const linked = await seedLinkedOwner(worker, "m4-idem@example.test", "ws_m4_idem");
    const first = await put(
      worker,
      linked.cookieHeader,
      "craft-orders",
      "o-idem",
      { data: { orderName: "طلب حتمي", depositMinor: 500 } },
      { "idempotency-key": "m4-idem-key-1" },
    );
    expect(first.status).toBe(200);
    const replay = await put(
      worker,
      linked.cookieHeader,
      "craft-orders",
      "o-idem",
      { data: { orderName: "طلب حتمي", depositMinor: 500 } },
      { "idempotency-key": "m4-idem-key-1" },
    );
    expect(replay.status).toBe(200);
    expect(replay.headers.get("x-idempotent-replay")).toBe("1");
    const db = await rawDb(worker);
    const rows = await db
      .prepare("SELECT COUNT(*) AS n FROM manage_record WHERE workspace_id = 'ws_m4_idem'")
      .first<{ n: number }>();
    expect(rows!.n).toBe(1);
    const audits = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM network_audit_event WHERE action = 'manage.write.record' AND object_id = 'craft-orders/o-idem' AND result = 'success'",
      )
      .first<{ n: number }>();
    expect(audits!.n).toBe(1); // the replay never re-executed the effect
  });

  it("resolves a concurrent create race to exactly one winner and one row", async () => {
    const linked = await seedLinkedOwner(worker, "m4-race@example.test", "ws_m4_race");
    const [a, b] = await Promise.all([
      put(
        worker,
        linked.cookieHeader,
        "assets",
        "w-race",
        { data: { who: "أ" } },
        { "idempotency-key": "race-a" },
      ),
      put(
        worker,
        linked.cookieHeader,
        "assets",
        "w-race",
        { data: { who: "ب" } },
        { "idempotency-key": "race-b" },
      ),
    ]);
    const statuses = [a.status, b.status].sort();
    // One writer wins (200), the other gets the honest conflict (409).
    expect(statuses).toEqual([200, 409]);
    const db = await rawDb(worker);
    const rows = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM manage_record WHERE workspace_id = 'ws_m4_race' AND family = 'assets' AND record_id = 'w-race'",
      )
      .first<{ n: number }>();
    expect(rows!.n).toBe(1);
  });

  it("resolves a concurrent same-basis update race without last-writer-wins merging", async () => {
    const linked = await seedLinkedOwner(worker, "m4-race2@example.test", "ws_m4_race2");
    const created = await put(worker, linked.cookieHeader, "craft-orders", "o-race", { data: { v: 0 } });
    const { updatedAt } = (await created.json()) as { updatedAt: number };
    const [a, b] = await Promise.all([
      put(
        worker,
        linked.cookieHeader,
        "craft-orders",
        "o-race",
        { data: { v: 1 }, expectedUpdatedAt: updatedAt },
        { "idempotency-key": "upd-a" },
      ),
      put(
        worker,
        linked.cookieHeader,
        "craft-orders",
        "o-race",
        { data: { v: 2 }, expectedUpdatedAt: updatedAt },
        { "idempotency-key": "upd-b" },
      ),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]); // exactly one applies; the loser re-reads
    const read = await apiGet(worker, linked.cookieHeader, "/api/manage/records/craft-orders/o-race");
    const body = (await read.json()) as { data: { v: number } };
    expect([1, 2]).toContain(body.data.v); // the winner's value, unmerged
  });

  it("writes land ONLY in the caller's own workspace — another workspace's record is untouchable (MO-07)", async () => {
    const ownerA = await seedLinkedOwner(worker, "m4-iso-a@example.test", "ws_m4_iso_a");
    const ownerB = await seedLinkedOwner(worker, "m4-iso-b@example.test", "ws_m4_iso_b");
    // B writes a record with the SAME family and id as A's — the key includes
    // B's own workspace, so A's record is never addressed.
    await put(worker, ownerA.cookieHeader, "assets", "w-iso", { data: { owner: "أ" } });
    const bWrite = await put(worker, ownerB.cookieHeader, "assets", "w-iso", { data: { owner: "ب" } });
    expect(bWrite.status).toBe(200);
    const db = await rawDb(worker);
    expect(await readRawRecord(db, "ws_m4_iso_a", "assets", "w-iso")).toBe(JSON.stringify({ owner: "أ" }));
    expect(await readRawRecord(db, "ws_m4_iso_b", "assets", "w-iso")).toBe(JSON.stringify({ owner: "ب" }));
  });
});
