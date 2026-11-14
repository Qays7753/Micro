/**
 * Manage Online connected reads acceptance (EX-D23, wave M3) — real workerd
 * over the real PostgreSQL target. Every read is owner-scoped behind
 * requireManageOwner; denials are audited without content; absent data is an
 * honest empty state, never a fabrication; another workspace's records are
 * never visible to a non-owner (MO-07/MO-09).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiGet, apiPost, rawDb, signInAs, startWorker, type WorkerInstance } from "./harness.ts";

let worker: WorkerInstance;
const PROOF = "manage-reads-proof-0123456789abcdef0123456789abcdef";

interface Linked {
  cookieHeader: string;
  workspaceId: string;
  identityId: string;
}

/** Seed a workspace + owner membership, enable the capability, complete the verified link. */
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
  expect(start.status).toBe(200);
  const started = (await start.json()) as { nonce: string };
  const confirm = await apiPost(worker, cookieHeader, "/api/manage/link/confirm", { nonce: started.nonce });
  expect(confirm.status).toBe(200);
  return { cookieHeader, workspaceId, identityId: identity!.id };
}

async function seedRecord(
  worker: WorkerInstance,
  workspaceId: string,
  family: string,
  recordId: string,
  data: unknown,
): Promise<void> {
  const db = await rawDb(worker);
  await db
    .prepare(
      "INSERT INTO manage_record (workspace_id, family, record_id, data_json, updated_at) VALUES (?, ?, ?, ?, 1)",
    )
    .bind(workspaceId, family, recordId, JSON.stringify(data))
    .run();
}

beforeAll(async () => {
  worker = await startWorker();
});

afterAll(async () => {
  await worker.close();
});

describe("manage reads (M3): authorization and honest states", () => {
  it("rejects unauthenticated callers on every read route (MO-01)", async () => {
    expect((await apiGet(worker, null, "/api/manage/families")).status).toBe(401);
    expect((await apiGet(worker, null, "/api/manage/records/craft-orders")).status).toBe(401);
    expect((await apiGet(worker, null, "/api/manage/records/craft-orders/o-1")).status).toBe(401);
  });

  it("refuses and AUDITS an unlinked owner without leaking content (MO-02)", async () => {
    const cookieHeader = (
      await signInAs(worker, { sub: "sub-m3-unlinked", email: "m3-unlinked@example.test" })
    ).cookieHeader;
    const db = await rawDb(worker);
    const identity = await db
      .prepare("SELECT id FROM network_identity WHERE email = ?")
      .bind("m3-unlinked@example.test")
      .first<{ id: string }>();
    await db
      .prepare(
        "INSERT INTO workspace (id, display_name, created_by_identity_id, market_enabled, delivery_enabled, created_at, updated_at) VALUES ('ws_m3_unlinked', 'مساحة غير مربوطة', ?, 1, 1, 1, 1)",
      )
      .bind(identity!.id)
      .run();
    await db
      .prepare(
        "INSERT INTO workspace_member (workspace_id, identity_id, role, status, granted_by_identity_id, granted_at) VALUES ('ws_m3_unlinked', ?, 'owner', 'active', ?, 1)",
      )
      .bind(identity!.id, identity!.id)
      .run();
    await db.prepare("UPDATE workspace SET manage_enabled = 1 WHERE id = 'ws_m3_unlinked'").run();
    const families = await apiGet(worker, cookieHeader, "/api/manage/families");
    expect(families.status).toBe(403);
    expect(((await families.json()) as { error: { code: string } }).error.code).toBe("manage_not_linked");
    const audits = await db
      .prepare(
        "SELECT action, result, object_id FROM network_audit_event WHERE action = 'manage.read.families' AND actor_identity_id = ?",
      )
      .bind(identity!.id)
      .all<{ action: string; result: string; object_id: string | null }>();
    expect(audits.results.length).toBe(1);
    expect(audits.results[0]!.result).toBe("denied");
    expect(audits.results[0]!.object_id).toBeNull();
  });

  it("refuses an owner while the capability is disabled (MO-08)", async () => {
    const cookieHeader = (
      await signInAs(worker, { sub: "sub-m3-disabled", email: "m3-disabled@example.test" })
    ).cookieHeader;
    const db = await rawDb(worker);
    const identity = await db
      .prepare("SELECT id FROM network_identity WHERE email = ?")
      .bind("m3-disabled@example.test")
      .first<{ id: string }>();
    await db
      .prepare(
        "INSERT INTO workspace (id, display_name, created_by_identity_id, market_enabled, delivery_enabled, created_at, updated_at) VALUES ('ws_m3_disabled', 'مساحة معطلة', ?, 1, 1, 1, 1)",
      )
      .bind(identity!.id)
      .run();
    await db
      .prepare(
        "INSERT INTO workspace_member (workspace_id, identity_id, role, status, granted_by_identity_id, granted_at) VALUES ('ws_m3_disabled', ?, 'owner', 'active', ?, 1)",
      )
      .bind(identity!.id, identity!.id)
      .run();
    const families = await apiGet(worker, cookieHeader, "/api/manage/families");
    expect(families.status).toBe(403);
    expect(((await families.json()) as { error: { code: string } }).error.code).toBe(
      "manage_capability_disabled",
    );
  });

  it("returns the honest empty state for a linked owner with no migrated data (MO-09)", async () => {
    const linked = await seedLinkedOwner(worker, "m3-empty@example.test", "ws_m3_empty");
    const families = await apiGet(worker, linked.cookieHeader, "/api/manage/families");
    expect(families.status).toBe(200);
    expect(await families.json()).toEqual({ workspaceId: "ws_m3_empty", families: [], totalRecords: 0 });
  });
});

describe("manage reads (M3): owner-scoped record serving", () => {
  it("serves the linked owner's families and records with exact values, ordered and paginated (MO-09)", async () => {
    const linked = await seedLinkedOwner(worker, "m3-data@example.test", "ws_m3_data");
    await seedRecord(worker, "ws_m3_data", "craft-orders", "o-2", {
      orderName: "طلب ب",
      depositMinor: 7500,
    });
    await seedRecord(worker, "ws_m3_data", "craft-orders", "o-1", {
      orderName: "طلب أ",
      depositMinor: 12500,
    });
    await seedRecord(worker, "ws_m3_data", "assets", "w-1", { name: "صندوق", openingMinor: 500000 });

    const families = await apiGet(worker, linked.cookieHeader, "/api/manage/families");
    const familiesBody = (await families.json()) as {
      families: { family: string; count: number }[];
      totalRecords: number;
    };
    expect(familiesBody.totalRecords).toBe(3);
    expect(familiesBody.families).toEqual([
      { family: "assets", count: 1 },
      { family: "craft-orders", count: 2 },
    ]);

    const list = await apiGet(worker, linked.cookieHeader, "/api/manage/records/craft-orders?limit=1");
    const listBody = (await list.json()) as {
      records: { id: string; data: { depositMinor: number } }[];
      nextCursor: string | null;
    };
    expect(listBody.records.map(r => r.id)).toEqual(["o-1"]);
    expect(listBody.nextCursor).toBe("o-1");
    // Exact money representation: the integer survived the round-trip literally
    // (contract 25 dated note — integers stay integers, no computation).
    expect(listBody.records[0]!.data.depositMinor).toBe(12500);

    const page2 = await apiGet(
      worker,
      linked.cookieHeader,
      `/api/manage/records/craft-orders?limit=1&cursor=${listBody.nextCursor}`,
    );
    const page2Body = (await page2.json()) as { records: { id: string }[]; nextCursor: string | null };
    expect(page2Body.records.map(r => r.id)).toEqual(["o-2"]);
    expect(page2Body.nextCursor).toBeNull();

    const single = await apiGet(worker, linked.cookieHeader, "/api/manage/records/craft-orders/o-2");
    expect(single.status).toBe(200);
    const singleBody = (await single.json()) as { data: { depositMinor: number } };
    expect(singleBody.data.depositMinor).toBe(7500);
  });

  it("never serves another workspace's records, and hides record existence (MO-07)", async () => {
    const ownerA = await seedLinkedOwner(worker, "m3-a@example.test", "ws_m3_a");
    await seedRecord(worker, "ws_m3_a", "craft-orders", "o-a", { secret: "قيم مالك أ" });
    const ownerB = await seedLinkedOwner(worker, "m3-b@example.test", "ws_m3_b");
    await seedRecord(worker, "ws_m3_b", "assets", "w-b", { name: "محفظة ب" });

    // Owner B sees ONLY their own workspace's data.
    const familiesB = await apiGet(worker, ownerB.cookieHeader, "/api/manage/families");
    const familiesBBody = (await familiesB.json()) as { workspaceId: string; totalRecords: number };
    expect(familiesBBody.workspaceId).toBe("ws_m3_b");
    expect(familiesBBody.totalRecords).toBe(1);

    // Owner B asking for owner A's family gets their OWN (empty) view — never
    // A's records; and a record id that exists only in A's workspace is an
    // honest 404 for B (existence is not disclosed).
    const listB = await apiGet(worker, ownerB.cookieHeader, "/api/manage/records/craft-orders");
    const listBBody = (await listB.json()) as { records: unknown[] };
    expect(listBBody.records).toEqual([]);
    const foreignRecord = await apiGet(worker, ownerB.cookieHeader, "/api/manage/records/craft-orders/o-a");
    expect(foreignRecord.status).toBe(404);
    void ownerA;
  });

  it("validates family and id shapes honestly (400), and absent records are 404", async () => {
    const linked = await seedLinkedOwner(worker, "m3-shapes@example.test", "ws_m3_shapes");
    expect((await apiGet(worker, linked.cookieHeader, "/api/manage/records/Not_A_Family")).status).toBe(400);
    expect(
      (await apiGet(worker, linked.cookieHeader, "/api/manage/records/craft-orders/missing")).status,
    ).toBe(404);
  });
});
