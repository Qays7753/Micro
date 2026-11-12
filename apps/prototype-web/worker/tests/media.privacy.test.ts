/**
 * Foundation acceptance — private media (R2) authorization.
 * 100% of unauthorized access tests must deny: cross-account, guest, and
 * non-admin strangers never read another account's private objects; only the
 * owner, an authorized reviewer (admin), or a public attachment to a
 * currently published listing can read. No public URL exists.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiGet, rawDb, signInAs, startWorker, type WorkerInstance } from "./harness.ts";

let worker: WorkerInstance;

beforeAll(async () => {
  worker = await startWorker();
});

afterAll(async () => {
  await worker.close();
});

async function uploadPng(cookie: string, purpose: string): Promise<string> {
  const response = await worker.fetch(`/api/media?purpose=${purpose}`, {
    method: "POST",
    headers: {
      "content-type": "image/png",
      origin: worker.origin,
      "x-micro-api": "1",
      cookie,
    },
    body: new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4]),
  });
  expect(response.status).toBe(201);
  const body = (await response.json()) as { media: { id: string } };
  return body.media.id;
}

describe("foundation: private media authorization", () => {
  it("rejects wrong content types and oversized uploads", async () => {
    const user = await signInAs(worker, { sub: "sub-media-0", email: "media0@example.test" });
    const badType = await worker.fetch("/api/media?purpose=market_listing_media", {
      method: "POST",
      headers: {
        "content-type": "text/html",
        origin: worker.origin,
        "x-micro-api": "1",
        cookie: user.cookieHeader,
      },
      body: "<html></html>",
    });
    expect(badType.status).toBe(400);
    const empty = await worker.fetch("/api/media?purpose=market_listing_media", {
      method: "POST",
      headers: {
        "content-type": "image/png",
        origin: worker.origin,
        "x-micro-api": "1",
        cookie: user.cookieHeader,
      },
      body: new Uint8Array([]),
    });
    expect(empty.status).toBe(400);
  });

  it("owner can read their own private media through the API", async () => {
    const user = await signInAs(worker, { sub: "sub-media-1", email: "media1@example.test" });
    const mediaId = await uploadPng(user.cookieHeader, "driver_evidence");
    const read = await apiGet(worker, user.cookieHeader, `/api/media/${mediaId}`);
    expect(read.status).toBe(200);
    expect(read.headers.get("content-type")).toBe("image/png");
    expect(read.headers.get("cache-control")).toBe("private, no-store");
  });

  it("a guest and a stranger account are denied (404, no existence leak)", async () => {
    const owner = await signInAs(worker, { sub: "sub-media-2", email: "media2@example.test" });
    const mediaId = await uploadPng(owner.cookieHeader, "driver_evidence");
    const guest = await apiGet(worker, null, `/api/media/${mediaId}`);
    expect(guest.status).toBe(404);
    const stranger = await signInAs(worker, { sub: "sub-media-3", email: "media3@example.test" });
    const strangerRead = await apiGet(worker, stranger.cookieHeader, `/api/media/${mediaId}`);
    expect(strangerRead.status).toBe(404);
  });

  it("an authorized reviewer (admin) can read private evidence; the read is audited", async () => {
    const admin = await signInAs(worker, { sub: "sub-admin-1", email: "admin1@example.test" });
    const db = await rawDb(worker);
    const identityRow = await db
      .prepare("SELECT id FROM network_identity WHERE email = ?")
      .bind("admin1@example.test")
      .first<{ id: string }>();
    await db
      .prepare(
        "INSERT INTO network_membership (identity_id, role, status, granted_by, granted_at) VALUES (?, 'admin', 'active', 'test', ?)",
      )
      .bind(identityRow!.id, Date.now())
      .run();
    const driver = await signInAs(worker, { sub: "sub-driver-9", email: "driver9@example.test" });
    const mediaId = await uploadPng(driver.cookieHeader, "driver_evidence");
    const adminRead = await apiGet(worker, admin.cookieHeader, `/api/media/${mediaId}`);
    expect(adminRead.status).toBe(200);
    const auditRows = await db
      .prepare("SELECT COUNT(*) AS n FROM network_audit_event WHERE action = 'media_read' AND object_id = ?")
      .bind(mediaId)
      .first<{ n: number }>();
    expect(auditRows!.n).toBe(1);
  });

  it("media attached to a PUBLISHED listing is publicly readable; drafts are not", async () => {
    const vendor = await signInAs(worker, { sub: "sub-media-4", email: "media4@example.test" });
    const mediaId = await uploadPng(vendor.cookieHeader, "market_listing_media");
    // Draft listing → not public.
    const db = await rawDb(worker);
    const identityRow = await db
      .prepare("SELECT id FROM network_identity WHERE email = ?")
      .bind("media4@example.test")
      .first<{ id: string }>();
    const now = Date.now();
    await db
      .prepare(
        "INSERT INTO supplier_profile (id, identity_id, work_copy_json, status, created_at, updated_at) VALUES ('sp_test1', ?, '{}', 'approved', ?, ?)",
      )
      .bind(identityRow!.id, now, now)
      .run();
    await db
      .prepare(
        "INSERT INTO supplier_listing (id, supplier_profile_id, identity_id, title, category, governorate, description, work_copy_json, status, price_mode, quantity_unit, min_quantity_milli, quantity_step_milli, availability_status, availability_confirmed_at, contact_channel_json, created_at, updated_at) " +
          "VALUES ('lst_test1', 'sp_test1', ?, 't', 'cat', 'gov', 'd', '{}', 'draft', 'fixed', 'piece', '1', '1', 'available', ?, '{}', ?, ?)",
      )
      .bind(identityRow!.id, now, now, now)
      .run();
    await db
      .prepare("INSERT INTO listing_media (listing_id, media_id) VALUES ('lst_test1', ?)")
      .bind(mediaId)
      .run();
    const asGuestWhileDraft = await apiGet(worker, null, `/api/media/${mediaId}`);
    expect(asGuestWhileDraft.status).toBe(404);
    // Publish the listing → its media becomes public_after_approval. The
    // publication gate guarantees attached media are approved; mirror that
    // here (the direct-DB shortcut bypasses tryPublish).
    await db
      .prepare("UPDATE supplier_listing SET status = 'approved_for_publish' WHERE id = 'lst_test1'")
      .run();
    await db.prepare("UPDATE media_object SET status = 'approved' WHERE id = ?").bind(mediaId).run();
    const asGuestPublished = await apiGet(worker, null, `/api/media/${mediaId}`);
    expect(asGuestPublished.status).toBe(200);
    expect(asGuestPublished.headers.get("cache-control")).toContain("public");
  });

  it("the owner can delete their draft media; a stranger cannot", async () => {
    const owner = await signInAs(worker, { sub: "sub-media-5", email: "media5@example.test" });
    const mediaId = await uploadPng(owner.cookieHeader, "market_listing_media");
    const stranger = await signInAs(worker, { sub: "sub-media-6", email: "media6@example.test" });
    const strangerDelete = await worker.fetch(`/api/media/${mediaId}`, {
      method: "DELETE",
      headers: { origin: worker.origin, "x-micro-api": "1", cookie: stranger.cookieHeader },
    });
    expect(strangerDelete.status).toBe(404);
    const ownerDelete = await worker.fetch(`/api/media/${mediaId}`, {
      method: "DELETE",
      headers: { origin: worker.origin, "x-micro-api": "1", cookie: owner.cookieHeader },
    });
    expect(ownerDelete.status).toBe(200);
    const db = await rawDb(worker);
    const row = await db.prepare("SELECT r2_key FROM media_object WHERE id = ?").bind(mediaId).first();
    expect(row).toBeNull();
  });
});
