/**
 * Project export-before-deletion lifecycle (owner supplement §10.1-3,
 * 2026-11-22 — WS-251/DOC-041): the owner-confirmed flow for a project's
 * data end-of-life.
 *
 * The order is EXPLICIT and enforced: EXPORT FIRST (only data the owner owns
 * or may access — settings, financial records, bookings, file metadata),
 * then — after the export is recorded and the user EXPLICITLY confirms — the
 * deletion of the PRIVATE project data and the unshared drafts. The
 * completed shared counterparty records stay exactly as they are with the
 * owner masked «مستخدم سابق» on the counterparty's view (the tombstone
 * drives the mask — the same honest pattern the removed-driver lifecycle
 * uses), plus the minimal audit/security records. An ONGOING booking blocks
 * the deletion honestly (the same protection the owner set for role
 * removal: never auto-cancel; finish or resolve first).
 *
 * Boundaries: NO live user data is ever deleted by Z AI — this endpoint is
 * exercised ONLY on synthetic fixtures in disposable local tests. Backups
 * follow the existing declared retention policy (repository-declared only;
 * no live backup job is configured or run here). Every state change commits
 * atomically with its audit row (§10.3-10).
 */
import { nowMs } from "../clock.ts";
import { randomToken } from "../crypto.ts";
import { newId, type Db } from "../db/db.ts";
import { HttpError, jsonResponse } from "../http.ts";
import { readJsonBody, type RouteContext } from "../router.ts";
import type { AuthenticatedContext } from "../auth/session.ts";

function db(ctx: RouteContext): Db {
  return ctx.env.DB;
}

export const PROJECT_EXPORT_FORMAT = "micro-project-export";
export const PROJECT_EXPORT_VERSION = 1;

/** The explicit confirmation token the deletion requires (no accidental
 * confirmations — the user types the word the UI shows). */
export const PROJECT_DELETE_CONFIRM_TOKEN = "حذف";

interface WorkspaceRow {
  id: string;
  display_name: string;
  market_enabled: number;
  delivery_enabled: number;
  created_at: number;
  deleted_at: number | null;
}

/** The account-owner gate for the project lifecycle: the caller must hold
 * the ACTIVE owner membership of the named workspace. Fails closed with the
 * honest codes (a stranger or a non-owner gets 403/404 — never data). */
async function requireProjectOwner(ctx: RouteContext, auth: AuthenticatedContext): Promise<WorkspaceRow> {
  const workspaceId = ctx.params.id!;
  const row = await db(ctx)
    .prepare(
      "SELECT w.id, w.display_name, w.market_enabled, w.delivery_enabled, w.created_at, w.deleted_at " +
        "FROM workspace w JOIN workspace_member m ON m.workspace_id = w.id " +
        "WHERE w.id = ? AND m.identity_id = ? AND m.role = 'owner' AND m.status = 'active' LIMIT 1",
    )
    .bind(workspaceId, auth.identityId)
    .first<WorkspaceRow>();
  if (row === null) {
    throw new HttpError(404, "not_found", { reason: "project_not_found" });
  }
  return row;
}

/**
 * GET /api/account/projects/:id/export — build and record the export bundle
 * (ONLY the data the owner owns or may access): the workspace settings, the
 * connected financial records (every manage_record family), his delivery
 * bookings in this workspace, and the file metadata he owns. The export row
 * + its audit commit atomically; the response carries the bundle with its
 * record count and content digest.
 */
export async function exportProject(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const workspace = await requireProjectOwner(ctx, auth);
  if (workspace.deleted_at !== null) {
    throw new HttpError(409, "conflict", { reason: "project_already_deleted" });
  }
  const now = nowMs();
  /* The financial records: every family of this workspace, in the canonical
   * (family, record_id) ordering with a content digest over the same
   * ordering (the migration envelope's proven pattern). */
  const records = await db(ctx)
    .prepare(
      "SELECT family, record_id, data_json FROM manage_record WHERE workspace_id = ? ORDER BY family, record_id",
    )
    .bind(workspace.id)
    .all<{ family: string; record_id: string; data_json: string }>();
  const families: Record<string, { count: number; records: { id: string; data: unknown }[] }> = {};
  for (const row of records.results) {
    const family = (families[row.family] ??= { count: 0, records: [] });
    family.count += 1;
    family.records.push({ id: row.record_id, data: JSON.parse(row.data_json) });
  }
  /* The owner's bookings in this workspace (his own data — the delivery
   * requests he created here). */
  const bookings = await db(ctx)
    .prepare(
      "SELECT id, status, need_type, pricing_mode, offered_fare_minor, collection_minor, collection_content, created_at " +
        "FROM delivery_request WHERE workspace_id = ? AND requester_identity_id = ? ORDER BY created_at, id",
    )
    .bind(workspace.id, auth.identityId)
    .all<Record<string, unknown>>();
  /* The file metadata he owns (the binaries stay in object storage under the
   * declared retention policy — the export carries the references). */
  const files = await db(ctx)
    .prepare(
      "SELECT id, r2_key, purpose, content_type, size_bytes, status, created_at FROM media_object " +
        "WHERE owner_identity_id = ? ORDER BY created_at, id",
    )
    .bind(auth.identityId)
    .all<Record<string, unknown>>();
  const recordCount = records.results.length + bookings.results.length + files.results.length;
  const digestInput =
    records.results.map(r => `${r.family}\u0000${r.record_id}\u0000${r.data_json}`).join("\u0001") +
    "\u0002" +
    bookings.results.map(b => `${b.id}\u0000${String(b.status)}`).join("\u0001") +
    "\u0002" +
    files.results.map(f => `${f.id}\u0000${f.r2_key}`).join("\u0001");
  /* A stable, dependency-free digest (FNV-1a 64-bit over the canonical
   * ordering — deterministic across runs for identical content). */
  let hash1 = 0x811c9dc5;
  let hash2 = 0x01000193;
  for (let i = 0; i < digestInput.length; i += 1) {
    const code = digestInput.charCodeAt(i);
    hash1 = Math.imul(hash1 ^ code, 0x01000193) >>> 0;
    hash2 = Math.imul(hash2 ^ ((code + i) & 0xff), 0x85ebca6b) >>> 0;
  }
  const digest = `${hash1.toString(16)}${hash2.toString(16)}`;
  const exportId = newId("exp", randomToken);
  /* Atomic (§10.3-10): the export row + its audit commit together. */
  const results = await db(ctx).batch([
    db(ctx)
      .prepare(
        "INSERT INTO project_export (id, workspace_id, requested_by, requested_at, record_count, digest) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(exportId, workspace.id, auth.identityId, now, recordCount, digest),
    db(ctx)
      .prepare(
        "INSERT INTO network_audit_event (actor_identity_id, action, object_type, object_id, result, created_at, meta_json) " +
          "SELECT ?, 'project_exported', 'workspace', ?, 'success', ?, ? " +
          "WHERE EXISTS (SELECT 1 FROM project_export WHERE id = ?)",
      )
      .bind(auth.identityId, workspace.id, now, JSON.stringify({ recordCount, digest }), exportId),
  ]);
  if (Number(results[1]?.meta?.changes ?? 0) !== 1) {
    throw new HttpError(500, "internal", { reason: "export_evidence_missing" });
  }
  return jsonResponse(
    {
      export: {
        id: exportId,
        format: PROJECT_EXPORT_FORMAT,
        version: PROJECT_EXPORT_VERSION,
        exportedAt: now,
        recordCount,
        digest,
      },
      workspace: {
        displayName: workspace.display_name,
        settings: {
          marketEnabled: Number(workspace.market_enabled) === 1,
          deliveryEnabled: Number(workspace.delivery_enabled) === 1,
          createdAt: Number(workspace.created_at),
        },
      },
      families,
      deliveries: bookings.results.map(row => ({
        id: String(row.id),
        status: String(row.status),
        needType: String(row.need_type),
        pricingMode: String(row.pricing_mode),
        offeredFareMinor: row.offered_fare_minor === null ? null : String(row.offered_fare_minor),
        collectionMinor: row.collection_minor === null ? null : String(row.collection_minor),
        collectionContent: row.collection_content === null ? null : String(row.collection_content),
        createdAt: Number(row.created_at),
      })),
      files: files.results.map(row => ({
        id: String(row.id),
        key: String(row.r2_key),
        purpose: String(row.purpose),
        contentType: String(row.content_type),
        sizeBytes: Number(row.size_bytes),
        status: String(row.status),
        createdAt: Number(row.created_at),
      })),
      /* الحذف يتبع التصدير — والنسخ الاحتياطية تتبع سياسة الاحتفاظ
       * المعلنة في المستودع (لا مهمة نسخ حية هنا). */
      retentionNote:
        "هذا التصدير بياناتك أنت. حذف المشروع لا يبدأ إلا بعد تأكيدك الصريح، والسجلات المشتركة المكتملة تبقى للطرف الآخر باسم «مستخدم سابق»، والنسخ الاحتياطية تتبع سياسة الاحتفاظ المعلنة.",
    },
    201,
  );
}

/**
 * POST /api/account/projects/:id/delete — the explicit, export-first
 * deletion. Requires: a prior recorded export of THIS workspace, the exact
 * confirmation token, and NO ongoing booking (an honest 409 with the Arabic
 * reason — the deletion never auto-cancels anything). Deletes the PRIVATE
 * project data (the connected financial records, the unshared drafts) and
 * the membership; retains the completed shared counterparty records (the
 * tombstone masks the owner «مستخدم سابق» on the counterparty's view) and
 * the minimal audit/security records. Everything commits atomically.
 */
export async function deleteProject(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const workspace = await requireProjectOwner(ctx, auth);
  if (workspace.deleted_at !== null) {
    throw new HttpError(409, "conflict", { reason: "project_already_deleted" });
  }
  const body = (await readJsonBody(ctx.request)) as { exportId?: unknown; confirm?: unknown };
  const exportId = typeof body.exportId === "string" ? body.exportId : "";
  if (exportId === "") throw new HttpError(400, "bad_request", { field: "exportId" });
  if (body.confirm !== PROJECT_DELETE_CONFIRM_TOKEN) {
    throw new HttpError(400, "bad_request", {
      field: "confirm",
      reason: "confirmation_token_required",
      message: "التأكيد يحتاج كتابة كلمة «حذف» نفسها — لا حذف بالخطأ أبدًا.",
    });
  }
  /* Export FIRST: a recorded export of this workspace must exist (the
   * deletion's evidence trail — never a deletion without an export). */
  const exportRow = await db(ctx)
    .prepare("SELECT id, requested_at, record_count FROM project_export WHERE id = ? AND workspace_id = ?")
    .bind(exportId, workspace.id)
    .first<Record<string, unknown>>();
  if (exportRow === null) {
    throw new HttpError(409, "conflict", {
      reason: "export_required",
      message: "صدّر بيانات مشروعك أولًا ثم أكّد الحذف — لا حذف بلا تصدير مسبق.",
    });
  }
  /* An ONGOING booking blocks the deletion honestly (the owner's own
   * protection: never auto-cancel; finish or resolve first). */
  const ongoing = await db(ctx)
    .prepare(
      "SELECT COUNT(*) AS n FROM delivery_request WHERE workspace_id = ? AND status IN ('awaiting_driver_response','awaiting_requester_decision','confirmed')",
    )
    .bind(workspace.id)
    .first<{ n: number }>();
  if (Number(ongoing?.n ?? 0) > 0) {
    throw new HttpError(409, "conflict", {
      reason: "ongoing_booking_blocks_deletion",
      message:
        "لا يمكن حذف المشروع الآن — لديك حجز جارٍ. أكمله أو صُفِّه أولًا؛ الحذف لا يلغي حجزًا تلقائيًا أبدًا.",
    });
  }
  const now = nowMs();
  /* The deletion itself — ONE atomic transaction (§10.3-10): the tombstone
   * + the private-data deletions + the membership removal + the audit row.
   * The completed shared records (submitted+ deliveries, statements,
   * events, notifications, audit history, the export evidence) are NOT
   * touched — they stay for the counterparties with the mask. */
  const results = await db(ctx).batch([
    db(ctx)
      .prepare("UPDATE workspace SET deleted_at = ?, deleted_by = ? WHERE id = ? AND deleted_at IS NULL")
      .bind(now, auth.identityId, workspace.id),
    db(ctx).prepare("DELETE FROM manage_record WHERE workspace_id = ?").bind(workspace.id),
    db(ctx)
      .prepare("DELETE FROM delivery_request WHERE workspace_id = ? AND status = 'draft'")
      .bind(workspace.id),
    db(ctx).prepare("DELETE FROM workspace_member WHERE workspace_id = ?").bind(workspace.id),
    db(ctx)
      .prepare(
        "INSERT INTO network_audit_event (actor_identity_id, action, object_type, object_id, result, created_at, meta_json) " +
          "SELECT ?, 'project_deleted', 'workspace', ?, 'success', ?, ? " +
          "WHERE EXISTS (SELECT 1 FROM workspace WHERE id = ? AND deleted_at IS NOT NULL)",
      )
      .bind(
        auth.identityId,
        workspace.id,
        now,
        JSON.stringify({ exportId, reason: "owner_confirmed_export_first" }),
        workspace.id,
      ),
  ]);
  if (Number(results[0]?.meta?.changes ?? 0) !== 1) {
    throw new HttpError(409, "conflict", { reason: "project_already_deleted" });
  }
  if (Number(results[4]?.meta?.changes ?? 0) !== 1) {
    throw new HttpError(500, "internal", { reason: "deletion_evidence_missing" });
  }
  /* The honest report: what was deleted, what was retained and why. */
  const retainedShared = await db(ctx)
    .prepare("SELECT COUNT(*) AS n FROM delivery_request WHERE workspace_id = ? AND status <> 'draft'")
    .bind(workspace.id)
    .first<{ n: number }>();
  return jsonResponse({
    ok: true,
    deleted: {
      workspaceId: workspace.id,
      manageRecords: Number(results[1]?.meta?.changes ?? 0),
      unsharedDrafts: Number(results[2]?.meta?.changes ?? 0),
      membership: Number(results[3]?.meta?.changes ?? 0),
    },
    retained: {
      sharedCounterpartyRecords: Number(retainedShared?.n ?? 0),
      ownerMaskedAs: "مستخدم سابق",
      auditHistory: true,
      exportEvidence: exportId,
      backups: "النسخ الاحتياطية تتبع سياسة الاحتفاظ المعلنة في المستودع",
    },
    deletedAt: now,
  });
}
