/**
 * Manage Online migration path acceptance (EX-D23, wave M5) — real workerd
 * over the real PostgreSQL target, SYNTHETIC fixtures only (never executed
 * against the shared Neon project; the local export remains the recovery
 * source). Covers the full verification chain (integrity digest, live pair
 * only, counts, record-id structure, the §2-b double proof), idempotent
 * recovery (same export = the original receipt, one effect), the explicit
 * rollback boundary, full rollback, and exact-value + checksum evidence
 * recomputed from the database.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiGet, apiPost, rawDb, signInAs, startWorker, type WorkerInstance } from "./harness.ts";
import { sha256Hex } from "../crypto.ts";

let worker: WorkerInstance;
const PROOF = "manage-migration-proof-0123456789abcdef0123456789abcdef";

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

/** A synthetic export envelope in the live released shape (array families with
 * string ids, a singleton family, integrity digest, counts). */
async function syntheticEnvelope(
  overrides: {
    data?: Record<string, unknown>;
    version?: number;
    schemaVersion?: number;
    tamperDigest?: boolean;
    dropCounts?: boolean;
    wrongCounts?: boolean;
  } = {},
): Promise<Record<string, unknown>> {
  const data =
    overrides.data ??
    ({
      orders: [
        { id: "o-1", orderName: "طلب اصطناعي أ", depositMinor: 12500 },
        { id: "o-2", orderName: "طلب اصطناعي ب", depositMinor: 9007199254740991 },
      ],
      assets: [{ id: "w-1", name: "صندوق اصطناعي", openingMinor: 500000 }],
      profile: { activityName: "مشغل اصطناعي" },
    } as Record<string, unknown>);
  const digest = await sha256Hex(JSON.stringify(data));
  // Counts mirror the export chain's rule: one entry per ARRAY family with its
  // exact length (singletons are not counted — the local counters count arrays).
  const counts: Record<string, number> = {};
  for (const [family, value] of Object.entries(data)) {
    if (Array.isArray(value)) counts[family] = value.length;
  }
  return {
    format: "micro-prototype-local-export",
    version: overrides.version ?? 34,
    schemaVersion: overrides.schemaVersion ?? 41,
    exportedAt: "2026-11-14T10:00:00.000Z",
    data,
    integrity: { algorithm: "sha256", digest: overrides.tamperDigest ? "0".repeat(64) : digest },
    ...(overrides.dropCounts ? {} : { counts: overrides.wrongCounts ? { orders: 5, assets: 1 } : counts }),
    appVersion: "synthetic-test",
  };
}

function apply(worker: WorkerInstance, cookie: string, envelope: unknown, proof: string, key: string) {
  return apiPost(
    worker,
    cookie,
    "/api/manage/migrate/apply",
    { envelope, proofSecret: proof },
    { "idempotency-key": key },
  );
}

beforeAll(async () => {
  worker = await startWorker();
});

afterAll(async () => {
  await worker.close();
});

describe("manage migration (M5): verification chain", () => {
  it("rejects unauthenticated and unlinked callers (401/403)", async () => {
    const guest = await apiPost(worker, null, "/api/manage/migrate/apply", {
      envelope: {},
      proofSecret: "x",
    });
    expect(guest.status).toBe(401);
    const loner = await signInAs(worker, { sub: "sub-m5-loner", email: "m5-loner@example.test" });
    const refused = await apply(worker, loner.cookieHeader, await syntheticEnvelope(), PROOF, "m5-loner-1");
    expect(refused.status).toBe(403);
    expect((await apiGet(worker, loner.cookieHeader, "/api/manage/migrate/status")).status).toBe(403);
  });

  it("refuses a tampered export (digest mismatch) and applies NOTHING", async () => {
    const linked = await seedLinkedOwner(worker, "m5-tamper@example.test", "ws_m5_tamper");
    const envelope = await syntheticEnvelope({ tamperDigest: true });
    const response = await apply(worker, linked.cookieHeader, envelope, PROOF, "m5-tamper-1");
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { details: { reason: string } } };
    expect(body.error.details.reason).toBe("integrity_digest_mismatch");
    const db = await rawDb(worker);
    const rows = await db
      .prepare("SELECT COUNT(*) AS n FROM manage_record WHERE workspace_id = 'ws_m5_tamper'")
      .first<{ n: number }>();
    expect(rows!.n).toBe(0);
    const ledger = await db
      .prepare("SELECT COUNT(*) AS n FROM manage_migration WHERE workspace_id = 'ws_m5_tamper'")
      .first<{ n: number }>();
    expect(ledger!.n).toBe(0);
  });

  it("refuses non-live version pairs and missing/mismatching counts honestly", async () => {
    const linked = await seedLinkedOwner(worker, "m5-versions@example.test", "ws_m5_versions");
    const legacy = await apply(
      worker,
      linked.cookieHeader,
      await syntheticEnvelope({ version: 33, schemaVersion: 40 }),
      PROOF,
      "m5-v1",
    );
    expect(legacy.status).toBe(400);
    expect(((await legacy.json()) as { error: { details: { reason: string } } }).error.details.reason).toBe(
      "migration_requires_live_pair",
    );
    const noCounts = await apply(
      worker,
      linked.cookieHeader,
      await syntheticEnvelope({ dropCounts: true }),
      PROOF,
      "m5-v2",
    );
    expect(noCounts.status).toBe(400);
    const badCounts = await apply(
      worker,
      linked.cookieHeader,
      await syntheticEnvelope({ wrongCounts: true }),
      PROOF,
      "m5-v3",
    );
    expect(badCounts.status).toBe(400);
    expect(
      ((await badCounts.json()) as { error: { details: { reason: string } } }).error.details.reason,
    ).toBe("counts_mismatch");
  });

  it("refuses a record without a valid id (structure gate)", async () => {
    const linked = await seedLinkedOwner(worker, "m5-shape@example.test", "ws_m5_shape");
    const envelope = await syntheticEnvelope({
      data: { orders: [{ orderName: "بلا معرف" }] },
    });
    const response = await apply(worker, linked.cookieHeader, envelope, PROOF, "m5-shape-1");
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { details: { reason: string } } }).error.details.reason).toBe(
      "record_id_invalid",
    );
  });

  it("completes the §2-b double proof: a wrong secret is refused even with a valid export", async () => {
    const linked = await seedLinkedOwner(worker, "m5-proof@example.test", "ws_m5_proof");
    const response = await apply(
      worker,
      linked.cookieHeader,
      await syntheticEnvelope(),
      "wrong-secret-value",
      "m5-proof-1",
    );
    expect(response.status).toBe(403);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("manage_proof_invalid");
    const db = await rawDb(worker);
    const rows = await db
      .prepare("SELECT COUNT(*) AS n FROM manage_record WHERE workspace_id = 'ws_m5_proof'")
      .first<{ n: number }>();
    expect(rows!.n).toBe(0);
  });
});

describe("manage migration (M5): apply, idempotent recovery, rollback", () => {
  it("applies a valid synthetic export with exact values and verifiable evidence (MO-13)", async () => {
    const linked = await seedLinkedOwner(worker, "m5-apply@example.test", "ws_m5_apply");
    const envelope = await syntheticEnvelope();
    const response = await apply(worker, linked.cookieHeader, envelope, PROOF, "m5-apply-1");
    expect(response.status).toBe(200);
    const receipt = (await response.json()) as {
      applied: boolean;
      replayed: boolean;
      fingerprint: string;
      totalRecords: number;
      familyCounts: Record<string, number>;
      contentChecksum: string;
    };
    expect(receipt.applied).toBe(true);
    expect(receipt.replayed).toBe(false);
    expect(receipt.totalRecords).toBe(4); // 2 orders + 1 asset + 1 singleton profile
    expect(receipt.familyCounts).toEqual({ orders: 2, assets: 1, profile: 1 });
    // The fingerprint is the integrity digest itself.
    expect(receipt.fingerprint).toBe((envelope.integrity as { digest: string }).digest);

    const db = await rawDb(worker);
    // Exact money values survived literally (2^53-1 included).
    const order2 = await db
      .prepare(
        "SELECT data_json FROM manage_record WHERE workspace_id = 'ws_m5_apply' AND family = 'orders' AND record_id = 'o-2'",
      )
      .first<{ data_json: string }>();
    expect(JSON.parse(order2!.data_json)).toEqual({
      id: "o-2",
      orderName: "طلب اصطناعي ب",
      depositMinor: 9007199254740991,
    });
    // The singleton family is one record.
    const profile = await db
      .prepare(
        "SELECT data_json FROM manage_record WHERE workspace_id = 'ws_m5_apply' AND family = 'profile'",
      )
      .first<{ data_json: string }>();
    expect(JSON.parse(profile!.data_json)).toEqual({ activityName: "مشغل اصطناعي" });
    // The receipt's content checksum is recomputable from the database rows.
    const rows = await db
      .prepare("SELECT family, record_id, data_json FROM manage_record WHERE workspace_id = 'ws_m5_apply'")
      .all<{ family: string; record_id: string; data_json: string }>();
    const canonical = rows.results
      .map(r => `${r.family}\u0000${r.record_id}\u0000${r.data_json}`)
      .sort()
      .join("\u0001");
    expect(await sha256Hex(canonical)).toBe(receipt.contentChecksum);
    // Status exposes the applied ledger entry.
    const status = await apiGet(worker, linked.cookieHeader, "/api/manage/migrate/status");
    const statusBody = (await status.json()) as { migrations: { fingerprint: string; status: string }[] };
    expect(statusBody.migrations[0]!.fingerprint).toBe(receipt.fingerprint);
    expect(statusBody.migrations[0]!.status).toBe("applied");
  });

  it("re-applies the SAME export idempotently: the original receipt, one ledger row, no second effect", async () => {
    const linked = await seedLinkedOwner(worker, "m5-idem@example.test", "ws_m5_idem");
    const envelope = await syntheticEnvelope();
    const first = (await (await apply(worker, linked.cookieHeader, envelope, PROOF, "m5-idem-1")).json()) as {
      appliedAt: number;
      fingerprint: string;
    };
    // A different idempotency key still hits the ledger path: same receipt, replayed.
    const second = await apply(worker, linked.cookieHeader, envelope, PROOF, "m5-idem-2");
    const secondBody = (await second.json()) as { replayed: boolean; appliedAt: number; fingerprint: string };
    expect(second.status).toBe(200);
    expect(secondBody.replayed).toBe(true);
    expect(secondBody.appliedAt).toBe(first.appliedAt);
    const db = await rawDb(worker);
    const ledger = await db
      .prepare("SELECT COUNT(*) AS n FROM manage_migration WHERE workspace_id = 'ws_m5_idem'")
      .first<{ n: number }>();
    expect(ledger!.n).toBe(1);
    const records = await db
      .prepare("SELECT COUNT(*) AS n FROM manage_record WHERE workspace_id = 'ws_m5_idem'")
      .first<{ n: number }>();
    expect(records!.n).toBe(4);
  });

  it("refuses a DIFFERENT export while one is applied (the explicit rollback boundary)", async () => {
    const linked = await seedLinkedOwner(worker, "m5-boundary@example.test", "ws_m5_boundary");
    await apply(worker, linked.cookieHeader, await syntheticEnvelope(), PROOF, "m5-b-1");
    const other = await syntheticEnvelope({
      data: { orders: [{ id: "o-x", orderName: "تصدير مختلف" }] },
    });
    const response = await apply(worker, linked.cookieHeader, other, PROOF, "m5-b-2");
    expect(response.status).toBe(409);
    expect(((await response.json()) as { error: { details: { reason: string } } }).error.details.reason).toBe(
      "migration_already_applied_rollback_first",
    );
  });

  it("rolls back completely, and a re-apply after rollback is a fresh apply", async () => {
    const linked = await seedLinkedOwner(worker, "m5-rollback@example.test", "ws_m5_rollback");
    const applied = (await (
      await apply(worker, linked.cookieHeader, await syntheticEnvelope(), PROOF, "m5-r-1")
    ).json()) as {
      fingerprint: string;
    };
    const rollback = await apiPost(
      worker,
      linked.cookieHeader,
      "/api/manage/migrate/rollback",
      { fingerprint: applied.fingerprint },
      { "idempotency-key": "m5-r-2" },
    );
    expect(rollback.status).toBe(200);
    const db = await rawDb(worker);
    const records = await db
      .prepare("SELECT COUNT(*) AS n FROM manage_record WHERE workspace_id = 'ws_m5_rollback'")
      .first<{ n: number }>();
    expect(records!.n).toBe(0);
    const ledger = await db
      .prepare("SELECT status, rolled_back_at FROM manage_migration WHERE workspace_id = 'ws_m5_rollback'")
      .first<{ status: string; rolled_back_at: number }>();
    expect(ledger!.status).toBe("rolled_back");
    expect(ledger!.rolled_back_at).not.toBeNull();
    // Re-apply after rollback: a fresh apply (not a replay).
    const reapply = await apply(worker, linked.cookieHeader, await syntheticEnvelope(), PROOF, "m5-r-3");
    const reapplyBody = (await reapply.json()) as { replayed: boolean; applied: boolean };
    expect(reapply.status).toBe(200);
    expect(reapplyBody.applied).toBe(true);
    expect(reapplyBody.replayed).toBe(false);
    // Rollback of an unknown fingerprint is an honest 404.
    const unknown = await apiPost(
      worker,
      linked.cookieHeader,
      "/api/manage/migrate/rollback",
      { fingerprint: "0".repeat(64) },
      { "idempotency-key": "m5-r-4" },
    );
    expect(unknown.status).toBe(404);
  });
});
