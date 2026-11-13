/**
 * Workspace layer (EX-D19) + Ask Micro boundary (EX-D21) — Phase B coverage.
 *
 * Workspace: personal workspace auto-creation on first business action (no
 * module choice at registration), capability flags fail closed, membership
 * list in the session payload, cross-workspace denial stays enforced, and a
 * multi-workspace identity sees exactly its own contexts.
 *
 * Ask Micro: the entry context is available to every signed-in role including
 * the driver, the permitted-record summary is scoped to the caller's own
 * records, asking without an approved provider returns an honest 501 (no
 * fabricated answers), and no financial/operational write ever happens.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { apiGet, apiPost, rawDb, signInAs, startWorker, type WorkerInstance } from "./harness.ts";
import { createApprovedDriver, type WorkerRefs } from "./delivery.helpers.ts";

let worker: WorkerInstance;
let adminCookie: string;

beforeEach(async () => {
  worker = await startWorker();
  const admin = await signInAs(worker, { sub: "ws-admin", email: "ws-admin@example.test" });
  const db = await rawDb(worker);
  await db
    .prepare(
      "INSERT INTO network_membership (identity_id, role, status, granted_by, granted_at) " +
        "SELECT id, 'admin', 'active', 'test', 1 FROM network_identity WHERE email = ?",
    )
    .bind("ws-admin@example.test")
    .run();
  adminCookie = admin.cookieHeader;
});

afterEach(async () => {
  await worker.close();
});

describe("workspace: personal workspace and capability enforcement", () => {
  it("first vendor action auto-creates ONE personal workspace (no module choice at registration)", async () => {
    const vendor = await signInAs(worker, { sub: "ws-v1", email: "ws-v1@example.test" });
    const save = await apiPost(worker, vendor.cookieHeader, "/api/market/vendor/profile", {
      displayName: "مورد المساحة",
      contactPhone: "+962790000001",
      governorate: "عمان",
    });
    expect(save.status).toBe(201);
    const db = await rawDb(worker);
    const workspaces = (
      await db
        .prepare("SELECT w.id, w.market_enabled, w.delivery_enabled FROM workspace w")
        .all<{ id: string; market_enabled: number; delivery_enabled: number }>()
    ).results;
    expect(workspaces).toHaveLength(1);
    expect(workspaces[0].market_enabled).toBe(1);
    expect(workspaces[0].delivery_enabled).toBe(1);
    const members = (
      await db
        .prepare("SELECT role, status FROM workspace_member WHERE workspace_id = ?")
        .bind(workspaces[0].id)
        .all<{ role: string; status: string }>()
    ).results;
    expect(members).toHaveLength(1);
    expect(members[0].role).toBe("owner");
    expect(members[0].status).toBe("active");
    const profile = (
      await db.prepare("SELECT workspace_id FROM supplier_profile").all<{ workspace_id: string }>()
    ).results;
    expect(profile).toHaveLength(1);
    expect(profile[0].workspace_id).toBe(workspaces[0].id);
  });

  it("the session payload lists the active workspace memberships (server-derived)", async () => {
    const vendor = await signInAs(worker, { sub: "ws-v2", email: "ws-v2@example.test" });
    await apiPost(worker, vendor.cookieHeader, "/api/market/vendor/profile", {
      displayName: "مورد الجلسة",
      contactPhone: "+962790000002",
      governorate: "عمان",
    });
    const session = (await (await apiGet(worker, vendor.cookieHeader, "/api/auth/session")).json()) as {
      authenticated: boolean;
      workspaces: Array<{ id: string; role: string; capabilities: { market: boolean; delivery: boolean } }>;
    };
    expect(session.authenticated).toBe(true);
    expect(session.workspaces).toHaveLength(1);
    expect(session.workspaces[0].role).toBe("owner");
    expect(session.workspaces[0].capabilities.market).toBe(true);
    expect(session.workspaces[0].capabilities.delivery).toBe(true);
  });

  it("a disabled market capability fails closed for vendor actions (EX-D19: business actions only — entry points stay)", async () => {
    const vendor = await signInAs(worker, { sub: "ws-v3", email: "ws-v3@example.test" });
    await apiPost(worker, vendor.cookieHeader, "/api/market/vendor/profile", {
      displayName: "مورد معطل",
      contactPhone: "+962790000003",
      governorate: "عمان",
    });
    const db = await rawDb(worker);
    await db.prepare("UPDATE workspace SET market_enabled = 0").run();
    const second = await apiPost(worker, vendor.cookieHeader, "/api/market/vendor/profile", {
      displayName: "مورد معطل",
      contactPhone: "+962790000004",
      governorate: "عمان",
    });
    expect(second.status).toBe(403);
    const body = (await second.json()) as { error: { code: string } };
    expect(body.error.code).toBe("workspace_capability_disabled");
  });

  it("a disabled delivery capability fails closed for booking creation", async () => {
    const refs: WorkerRefs = { worker, adminCookie };
    const driver = await createApprovedDriver(refs, "ws-driver-1@example.test", "ws-driver-1");
    const owner = await signInAs(worker, { sub: "ws-o1", email: "ws-o1@example.test" });
    const first = await apiPost(worker, owner.cookieHeader, "/api/delivery/requests", {
      driverProfileId: driver.driverProfileId,
      needType: "deliver_to_customer",
      pricingMode: "prepriced",
      offeredFareMinor: "300",
      payload: {
        pickup: {
          governorate: "عمان",
          area: "تلاع العلي",
          name: "ورشة",
          phone: "+962795555001",
          address: "شارع 1",
        },
        dropoff: {
          governorate: "الزرقاء",
          area: "هاشمي الشمالي",
          name: "زبون",
          phone: "+962795555002",
          address: "شارع 2",
        },
      },
    });
    expect(first.status).toBe(201);
    const db = await rawDb(worker);
    await db.prepare("UPDATE workspace SET delivery_enabled = 0").run();
    const create = await apiPost(worker, owner.cookieHeader, "/api/delivery/requests", {
      driverProfileId: driver.driverProfileId,
      needType: "deliver_to_customer",
      pricingMode: "prepriced",
      offeredFareMinor: "300",
      payload: {
        pickup: {
          governorate: "عمان",
          area: "تلاع العلي",
          name: "ورشة",
          phone: "+962795555001",
          address: "شارع 1",
        },
        dropoff: {
          governorate: "الزرقاء",
          area: "هاشمي الشمالي",
          name: "زبون",
          phone: "+962795555002",
          address: "شارع 2",
        },
      },
    });
    expect(create.status).toBe(403);
    const body = (await create.json()) as { error: { code: string } };
    expect(body.error.code).toBe("workspace_capability_disabled");
  });

  it("records of another workspace are never visible to a non-member (cross-workspace denial)", async () => {
    const vendorA = await signInAs(worker, { sub: "ws-a", email: "ws-a@example.test" });
    const vendorB = await signInAs(worker, { sub: "ws-b", email: "ws-b@example.test" });
    await apiPost(worker, vendorA.cookieHeader, "/api/market/vendor/profile", {
      displayName: "مورد أ",
      contactPhone: "+962790000005",
      governorate: "عمان",
    });
    await apiPost(worker, vendorB.cookieHeader, "/api/market/vendor/profile", {
      displayName: "مورد ب",
      contactPhone: "+962790000006",
      governorate: "عمان",
    });
    const db = await rawDb(worker);
    const identityA = await identityIdOf(db, "ws-a@example.test");
    const identityB = await identityIdOf(db, "ws-b@example.test");
    const rows = (
      await db
        .prepare(
          "SELECT p.id, p.workspace_id, m.identity_id FROM supplier_profile p " +
            "JOIN workspace_member m ON m.workspace_id = p.workspace_id",
        )
        .all<{ id: string; workspace_id: string; identity_id: string }>()
    ).results;
    expect(rows).toHaveLength(2);
    const distinctWorkspaces = new Set(rows.map(r => r.workspace_id));
    expect(distinctWorkspaces.size).toBe(2);
    // Vendor B's own overview only ever contains B's profile (ownership +
    // workspace scoping) — A's data stays invisible to B.
    const overviewB = (await (
      await apiGet(worker, vendorB.cookieHeader, "/api/market/vendor/overview")
    ).json()) as { vendor?: { supplierProfileId?: string } };
    const profileA = rows.find(r => r.identity_id === identityA)!;
    const profileB = rows.find(r => r.identity_id === identityB)!;
    expect(overviewB.vendor?.supplierProfileId).toBe(profileB.id);
    expect(overviewB.vendor?.supplierProfileId).not.toBe(profileA.id);
  });

  it("a multi-workspace identity sees exactly its memberships in context (no privilege merge)", async () => {
    const user = await signInAs(worker, { sub: "ws-multi", email: "ws-multi@example.test" });
    await apiPost(worker, user.cookieHeader, "/api/market/vendor/profile", {
      displayName: "متعدد المساحات",
      contactPhone: "+962790000007",
      governorate: "عمان",
    });
    const db = await rawDb(worker);
    const identity = await identityIdOf(db, "ws-multi@example.test");
    // A second workspace (another business) grants this person a supplier seat.
    await db
      .prepare(
        "INSERT INTO workspace (id, display_name, created_by_identity_id, market_enabled, delivery_enabled, created_at, updated_at) " +
          "VALUES ('ws_other', 'عمل آخر', ?, 1, 0, 1, 1)",
      )
      .bind(identity)
      .run();
    await db
      .prepare(
        "INSERT INTO workspace_member (workspace_id, identity_id, role, status, granted_at) " +
          "VALUES ('ws_other', ?, 'supplier', 'active', 1)",
      )
      .bind(identity)
      .run();
    const session = (await (await apiGet(worker, user.cookieHeader, "/api/auth/session")).json()) as {
      workspaces: Array<{ id: string; role: string; capabilities: { market: boolean; delivery: boolean } }>;
    };
    expect(session.workspaces).toHaveLength(2);
    const other = session.workspaces.find(w => w.id === "ws_other");
    expect(other?.role).toBe("supplier");
    expect(other?.capabilities.market).toBe(true);
    expect(other?.capabilities.delivery).toBe(false);
  });
});

describe("ask micro: universal permission-scoped boundary (EX-D21)", () => {
  it("unauthenticated callers get an honest unavailable state (entry exists, sign-in required)", async () => {
    const response = await apiGet(worker, null, "/api/ask/status");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { available: boolean; configured: boolean };
    expect(body.available).toBe(false);
    expect(body.configured).toBe(false);
  });

  it("a signed-in OWNER gets a context scoped to their own records and workspaces", async () => {
    const owner = await signInAs(worker, { sub: "ask-o", email: "ask-o@example.test" });
    const response = await apiGet(worker, owner.cookieHeader, "/api/ask/status");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      available: boolean;
      configured: boolean;
      context: {
        roles: { owner: boolean; vendor: boolean; driver: boolean; admin: boolean };
        workspaces: Array<{ role: string }>;
        permittedRecordSummary: {
          ownerPendingDecisions: number;
          vendorListings: number;
          driverOpenTasks: number;
        };
      };
    };
    expect(body.available).toBe(true);
    expect(body.configured).toBe(false);
    expect(body.context.roles.owner).toBe(true);
    expect(body.context.roles.driver).toBe(false);
    expect(body.context.permittedRecordSummary.ownerPendingDecisions).toBe(0);
  });

  it("a DRIVER gets the entry with driver-scoped context only — no owner/market data leaks", async () => {
    const refs: WorkerRefs = { worker, adminCookie };
    const driver = await createApprovedDriver(refs, "ask-driver@example.test", "ask-driver");
    const response = await apiGet(worker, driver.cookie, "/api/ask/status");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      available: boolean;
      context: {
        roles: { owner: boolean; vendor: boolean; driver: boolean };
        permittedRecordSummary: {
          ownerPendingDecisions: number;
          vendorListings: number;
          driverOpenTasks: number;
        };
      };
    };
    expect(body.available).toBe(true);
    expect(body.context.roles.driver).toBe(true);
    // The driver's account may hold other roles (OD18) — but the permitted
    // RECORD summary must stay empty of owner/vendor data: this driver has
    // no bookings-in-progress, no listings, and no pending owner decisions.
    expect(body.context.roles.vendor).toBe(false);
    expect(body.context.permittedRecordSummary.driverOpenTasks).toBe(0);
    expect(body.context.permittedRecordSummary.vendorListings).toBe(0);
    expect(body.context.permittedRecordSummary.ownerPendingDecisions).toBe(0);
  });

  it("a SUPPLIER (vendor) gets the entry with vendor-scoped context — their own listings only (Phase E)", async () => {
    const vendor = await signInAs(worker, { sub: "ask-supplier", email: "ask-supplier@example.test" });
    await apiPost(worker, vendor.cookieHeader, "/api/market/vendor/profile", {
      displayName: "مورد السياق",
      contactPhone: "+962790000020",
      governorate: "عمان",
    });
    const response = await apiGet(worker, vendor.cookieHeader, "/api/ask/status");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      available: boolean;
      context: {
        roles: { owner: boolean; vendor: boolean; driver: boolean; admin: boolean };
        workspaces: Array<{ role: string }>;
        permittedRecordSummary: { vendorListings: number };
      };
    };
    expect(body.available).toBe(true);
    expect(body.context.roles.vendor).toBe(true);
    expect(body.context.roles.admin).toBe(false);
    expect(body.context.workspaces).toHaveLength(1);
    expect(body.context.permittedRecordSummary.vendorListings).toBe(0);
  });

  it("a REVIEWER/ADMIN gets the entry with the admin role in context (Phase E)", async () => {
    const response = await apiGet(worker, adminCookie, "/api/ask/status");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      available: boolean;
      context: {
        roles: { owner: boolean; vendor: boolean; driver: boolean; admin: boolean };
      };
    };
    expect(body.available).toBe(true);
    expect(body.context.roles.admin).toBe(true);
    expect(body.context.roles.vendor).toBe(false);
  });

  it("asking without an approved provider returns an honest 501 — no fabricated answers", async () => {
    const owner = await signInAs(worker, { sub: "ask-q", email: "ask-q@example.test" });
    const response = await apiPost(worker, owner.cookieHeader, "/api/ask", {
      question: "كم لديّ من طلبات قيد التأكيد؟",
    });
    expect(response.status).toBe(501);
    const body = (await response.json()) as { error: { code: string; details?: { message?: string } } };
    expect(body.error.code).toBe("ask_not_configured");
    expect(body.error.details?.message).toContain("غير مهيأة");
  });

  it("asking requires sign-in and a meaningful question", async () => {
    const anonymous = await apiPost(worker, null, "/api/ask", { question: "سؤال" });
    expect(anonymous.status).toBe(401);
    const owner = await signInAs(worker, { sub: "ask-v", email: "ask-v@example.test" });
    const tooShort = await apiPost(worker, owner.cookieHeader, "/api/ask", { question: "؟" });
    expect(tooShort.status).toBe(400);
  });

  it("the ask boundary never writes product state (no new network events/audit rows)", async () => {
    const owner = await signInAs(worker, { sub: "ask-w", email: "ask-w@example.test" });
    const db = await rawDb(worker);
    const before = (await db.prepare("SELECT COUNT(*) AS n FROM delivery_event").first<{ n: number }>())?.n;
    await apiGet(worker, owner.cookieHeader, "/api/ask/status");
    await apiPost(worker, owner.cookieHeader, "/api/ask", { question: "سؤال اختبار الحدود" });
    const after = (await db.prepare("SELECT COUNT(*) AS n FROM delivery_event").first<{ n: number }>())?.n;
    expect(after).toBe(before);
  });
});

async function identityIdOf(db: Awaited<ReturnType<typeof rawDb>>, email: string): Promise<string> {
  const row = await db
    .prepare("SELECT id FROM network_identity WHERE email = ?")
    .bind(email)
    .first<{ id: string }>();
  if (!row) throw new Error(`identity ${email} missing`);
  return row.id;
}
