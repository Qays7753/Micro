/**
 * Manage Online guarded mode acceptance (EX-D23, wave M6) — the online-only
 * cutover flag is DEFAULT OFF, has NO API to flip it (the operator's direct
 * database action after the owner's final gate), and reads honestly behind
 * the gate. The client guard (app/manageOnlineGuard) proves the honest
 * offline-write refusal when the mode is on and full pass-through when off.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiGet, apiPost, rawDb, signInAs, startWorker, type WorkerInstance } from "./harness.ts";

let worker: WorkerInstance;
const PROOF = "manage-mode-proof-0123456789abcdef0123456789abcdef";

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
  await apiPost(worker, cookieHeader, "/api/manage/link/confirm", { nonce: started.nonce });
  return { cookieHeader, workspaceId };
}

beforeAll(async () => {
  worker = await startWorker();
});

afterAll(async () => {
  await worker.close();
});

describe("manage mode (M6): guarded, default-off, operator-only", () => {
  it("rejects unauthenticated callers (401) and unlinked owners (403)", async () => {
    expect((await apiGet(worker, null, "/api/manage/mode")).status).toBe(401);
    const loner = await signInAs(worker, { sub: "sub-m6-loner", email: "m6-loner@example.test" });
    const refused = await apiGet(worker, loner.cookieHeader, "/api/manage/mode");
    expect(refused.status).toBe(403);
  });

  it("reads onlineOnly=false by default — the cutover flag is OFF for every workspace", async () => {
    const linked = await seedLinkedOwner(worker, "m6-default@example.test", "ws_m6_default");
    const mode = await apiGet(worker, linked.cookieHeader, "/api/manage/mode");
    expect(mode.status).toBe(200);
    expect(await mode.json()).toEqual({ workspaceId: "ws_m6_default", onlineOnly: false });
  });

  it("reflects the operator's direct database flip honestly (test-only; no API exists to flip it)", async () => {
    const linked = await seedLinkedOwner(worker, "m6-flip@example.test", "ws_m6_flip");
    const db = await rawDb(worker);
    await db.prepare("UPDATE workspace SET manage_online_only = 1 WHERE id = ?").bind("ws_m6_flip").run();
    const mode = await apiGet(worker, linked.cookieHeader, "/api/manage/mode");
    const body = (await mode.json()) as { onlineOnly: boolean };
    expect(body.onlineOnly).toBe(true);
    await db.prepare("UPDATE workspace SET manage_online_only = 0 WHERE id = ?").bind("ws_m6_flip").run();
    const back = await apiGet(worker, linked.cookieHeader, "/api/manage/mode");
    expect(((await back.json()) as { onlineOnly: boolean }).onlineOnly).toBe(false);
  });
});
