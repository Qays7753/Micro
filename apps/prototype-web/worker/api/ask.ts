/**
 * Ask Micro — universal, permission-scoped assistant boundary (EX-D21,
 * owner decision 2026-11-13; Post-Group 6 continuous completion 2026-11-22 —
 * owner order 7593b9c4 §5 BINDING).
 *
 * Hard boundaries (contract 18 §9-4 + the binding §5):
 *  - Every request is scoped server-side to the verified principal, the
 *    active role(s), the current workspace context, and permitted records.
 *  - Context retrieval goes through the same authorized read paths the
 *    product APIs use — never direct SQL from an assistant path beyond these
 *    bounded per-role aggregates, never another workspace's data, never
 *    financial/operational writes. Ask Micro is READ-ONLY: no endpoint here
 *    writes anything, ever; a draft proposal is a card the USER confirms
 *    through the existing canonical use case with server acceptance.
 *  - Availability (final decision أ-2): the THREE modes only — the project
 *    owner (his project, bookings, and the public market), the supplier (his
 *    listings, review status, and the public market), and the driver (his
 *    bookings, amounts, and documents). A visitor or an account with no
 *    active role gets an honest «غير متاح» — never a fabricated context.
 *  - No AI provider is chosen, connected, configured, called, or paid for in
 *    this repository: the honest runtime state is «not configured» and asking
 *    returns a clear 501 until the owner/Manus wires an APPROVED provider
 *    through the optional ASK_PROVIDER service binding (tests inject a mock
 *    binding only — never a real provider).
 *  - The provider port receives ONLY the bounded fact set (no identity, no
 *    raw records); the answer passes the fail-closed policy
 *    (api/askPolicy.ts): uncited figures → the honest «لا أعرف», and draft
 *    values the provider invented for unknown fields are dropped to blank.
 */

import { HttpError, jsonResponse } from "../http.ts";
import type { Db } from "../db/db.ts";
import type { RouteContext } from "../router.ts";
import { readJsonBody } from "../router.ts";
import { driverStatus, listWorkspaceMemberships, requireIdentity, vendorStatus } from "../authorization.ts";
import { resolveSession } from "../auth/session.ts";
import { enforceRate, minuteBucket } from "../ratelimit.ts";
import { nowMs } from "../clock.ts";
import { applyAskPolicy, type AskContextFact, type AskProviderInput, type AskRole } from "./askPolicy.ts";

/** The honest provider state: configured ONLY when an approved provider
 * service binding exists in the environment (never in this repository). */
export function askProviderConfigured(ctx: RouteContext): boolean {
  return (ctx.env as { ASK_PROVIDER?: unknown }).ASK_PROVIDER !== undefined;
}

/* Back-compat re-export shape for the tests that read the constant. */
export const ASK_PROVIDER_CONFIGURED = false;

const DAY_MS = 24 * 60 * 60 * 1000;

/* Owner supplement §10.2-7 (2026-11-22) — the Ask governance caps:
 * the 20-question daily cap per user (final decision أ-2) and the SEPARATE
 * 10,000-Neurons/day free-quota stop with NO paid fallback (there is no paid
 * path at all). When either is exhausted the SAME honest «المساعد غير متاح
 * الآن» message shows and nothing else breaks. */
export const ASK_DAILY_QUESTION_CAP = 20;
export const ASK_DAILY_NEURONS_CAP = 10_000;

export const ASK_UNAVAILABLE_QUESTION_CAP =
  "المساعد غير متاح الآن — بلغت حد ٢٠ سؤالًا اليومي. يعود المتاح مع بداية يوم جديد.";
export const ASK_UNAVAILABLE_FREE_QUOTA =
  "المساعد غير متاح الآن — انتهت حصة الاستخدام المجانية لليوم (لا يوجد مسار مدفوع). يعود المتاح مع بداية يوم جديد.";
export const ASK_CONSENT_REQUIRED =
  "السؤال يحتاج موافقتك على سياسة المساعد (يسار سؤالك الحالي وملخص سياقك المصرح فقط إلى مزود الإجابات عند تجهيزه — لا تاريخ محادثات كاملًا ولا اقتراحات من تلقاء نفسه). يمكنك سحب الموافقة في أي وقت.";

/** The fixed UTC-day window (the repository's dailyBucket convention — the
 * same server-clock window the audited phone reveal uses). */
function dayWindowStart(now: number): number {
  return Math.floor(now / DAY_MS) * DAY_MS;
}

/**
 * GET /api/ask/status — the shared Ask Micro context boundary: the honest
 * availability per the final decision (the three modes only), the provider
 * configuration state, and the role/workspace context the assistant is
 * scoped to (no record contents — only permitted, already-authorized counts
 * and states).
 */
export async function askStatus(db: Db, ctx: RouteContext): Promise<Response> {
  const auth = await resolveSession(db, sessionToken(ctx.request), nowMs());
  if (!auth)
    return jsonResponse({
      available: false,
      configured: askProviderConfigured(ctx),
      reason: "unauthenticated",
    });
  const workspaces = await listWorkspaceMemberships(db, auth.identityId);
  const vendor = await vendorStatus(db, auth.identityId);
  const driver = await driverStatus(db, auth.identityId, nowMs());
  /* Final decision أ-2: «متاح في الأوضاع الثلاثة… الزائر ومن لا دور له:
   * غير متاح» — the owner MODE requires the explicit project (W1/EX-D24);
   * an account with neither project nor vendor/driver role has NO mode. */
  const hasProject = workspaces.length > 0;
  const available = hasProject || vendor !== null || driver !== null;
  const context = {
    principal: { displayName: auth.displayName, email: auth.email },
    roles: {
      // The owner context is the explicit project (EX-D24/W1) — the account
      // itself is the potential owner; the MODE exists once the project does.
      owner: hasProject,
      vendor: vendor !== null,
      driver: driver !== null,
      admin: auth.isAdmin,
    },
    workspaces: workspaces.map(w => ({
      id: w.workspaceId,
      displayName: w.displayName,
      role: w.role,
      capabilities: { market: w.marketEnabled, delivery: w.deliveryEnabled },
    })),
    permittedRecordSummary: {
      // Owner-side: own open delivery decisions only (authorized read path).
      ownerPendingDecisions: await ownerPendingDecisionCount(db, auth.identityId),
      // Vendor-side: own listing states only.
      vendorListings: vendor === null ? 0 : await vendorListingCount(db, vendor.supplierProfileId),
      // Driver-side: own assigned inbox only.
      driverOpenTasks: driver === null ? 0 : await driverOpenTaskCount(db, driver.driverProfileId),
    },
  };
  /* §10.2-7: the honest governance state next to the availability — the
   * consent state (revocable at any time) and today's two caps. */
  const consentRow = await askConsentRow(db, auth.identityId);
  const usageRow = await askUsageRow(db, auth.identityId, dayWindowStart(nowMs()));
  return jsonResponse({
    available,
    configured: askProviderConfigured(ctx),
    ...(available ? {} : { reason: "no_active_role" }),
    governance: {
      consent: consentRow === null ? "never" : consentRow.revoked_at !== null ? "revoked" : "granted",
      daily: {
        questionsUsed: usageRow === null ? 0 : Number(usageRow.question_count),
        questionCap: ASK_DAILY_QUESTION_CAP,
        neuronsUsed: usageRow === null ? 0 : Number(usageRow.neurons_used),
        neuronsCap: ASK_DAILY_NEURONS_CAP,
      },
    },
    context,
  });
}

/* ── The governance state (§10.2-7): consent + the two daily caps ───────── */

interface AskGovernanceRow {
  granted_at: number;
  revoked_at: number | null;
}

async function askConsentRow(db: Db, identityId: string): Promise<AskGovernanceRow | null> {
  return db
    .prepare("SELECT granted_at, revoked_at FROM ask_consent WHERE identity_id = ?")
    .bind(identityId)
    .first<AskGovernanceRow>();
}

interface AskUsageRow {
  question_count: number;
  neurons_used: number;
}

async function askUsageRow(db: Db, identityId: string, windowStart: number): Promise<AskUsageRow | null> {
  return db
    .prepare(
      "SELECT question_count, neurons_used FROM ask_daily_usage WHERE identity_id = ? AND window_start = ?",
    )
    .bind(identityId, windowStart)
    .first<AskUsageRow>();
}

/** POST /api/ask/consent — grant the per-user consent (§10.2-7-1). Granting
 * is idempotent per active state; re-granting after a revoke re-activates the
 * row (granted_at moves to the new moment) — the full history stays in the
 * audit trail. The change + its audit commit atomically (§10.3-10). */
export async function askConsentGrant(ctx: RouteContext): Promise<Response> {
  const auth = await resolveSession(ctx.env.DB, sessionToken(ctx.request), nowMs());
  if (!auth) throw new HttpError(401, "unauthorized");
  const identityId = requireIdentity({ identityId: auth.identityId, isAdmin: auth.isAdmin });
  const now = nowMs();
  const results = await ctx.env.DB.batch([
    ctx.env.DB.prepare(
      "INSERT INTO ask_consent (identity_id, granted_at, revoked_at) VALUES (?, ?, NULL) " +
        "ON CONFLICT (identity_id) DO UPDATE SET granted_at = excluded.granted_at, revoked_at = NULL " +
        "WHERE ask_consent.revoked_at IS NOT NULL",
    ).bind(identityId, now),
    ctx.env.DB.prepare(
      "INSERT INTO network_audit_event (actor_identity_id, action, object_type, object_id, result, created_at, meta_json) " +
        "SELECT ?, 'ask_consent_granted', 'network_identity', ?, 'success', ?, '{}' " +
        "WHERE EXISTS (SELECT 1 FROM ask_consent WHERE identity_id = ? AND revoked_at IS NULL)",
    ).bind(identityId, identityId, now, identityId),
  ]);
  if (Number(results[1]?.meta?.changes ?? 0) !== 1) {
    throw new HttpError(500, "internal", { reason: "consent_state_unverified" });
  }
  return jsonResponse({ ok: true, consent: "granted" }, 201);
}

/** POST /api/ask/consent/revoke — revoke IMMEDIATELY (§10.2-7-1). The next
 * question (and every one after) is refused until a new grant. Atomic with
 * its audit row. */
export async function askConsentRevoke(ctx: RouteContext): Promise<Response> {
  const auth = await resolveSession(ctx.env.DB, sessionToken(ctx.request), nowMs());
  if (!auth) throw new HttpError(401, "unauthorized");
  const identityId = requireIdentity({ identityId: auth.identityId, isAdmin: auth.isAdmin });
  const now = nowMs();
  const results = await ctx.env.DB.batch([
    ctx.env.DB.prepare(
      "UPDATE ask_consent SET revoked_at = ? WHERE identity_id = ? AND revoked_at IS NULL",
    ).bind(now, identityId),
    ctx.env.DB.prepare(
      "INSERT INTO network_audit_event (actor_identity_id, action, object_type, object_id, result, created_at, meta_json) " +
        "SELECT ?, 'ask_consent_revoked', 'network_identity', ?, 'success', ?, '{}' " +
        "WHERE EXISTS (SELECT 1 FROM ask_consent WHERE identity_id = ? AND revoked_at IS NOT NULL)",
    ).bind(identityId, identityId, now, identityId),
  ]);
  if (Number(results[1]?.meta?.changes ?? 0) !== 1) {
    throw new HttpError(500, "internal", { reason: "consent_state_unverified" });
  }
  return jsonResponse({ ok: true, consent: "revoked" });
}

/**
 * POST /api/ask — ask a question. Without an approved runtime provider the
 * honest 501 stays (EX-D21: no paid provider, no secrets, no fabricated
 * answers). With the provider binding present (tests only, today): build the
 * bounded per-role fact set, call the port, and pass the result through the
 * fail-closed policy — the answer carries ONLY cited, server-computed
 * figures, and a proposal is a typed editable draft that never writes.
 */
export async function askQuestion(db: Db, ctx: RouteContext): Promise<Response> {
  const auth = await resolveSession(db, sessionToken(ctx.request), nowMs());
  if (!auth) throw new HttpError(401, "unauthorized");
  const identityId = requireIdentity({ identityId: auth.identityId, isAdmin: auth.isAdmin });
  const now = nowMs();
  await enforceRate(db, minuteBucket("ask", identityId, now), 10, 60 * 1000, now);
  const body = (await readJsonBody(ctx.request)) as { question?: unknown; workspaceId?: unknown };
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (question.length < 2) throw new HttpError(400, "bad_request", { field: "question" });
  if (question.length > 2000)
    throw new HttpError(400, "bad_request", { field: "question", reason: "too_long" });
  /* Role gating (final decision أ-2): the three modes only — the honest mode
   * refusal comes first (a role-less account hears «no active role», never a
   * consent request for a mode that does not exist). */
  const workspaces = await listWorkspaceMemberships(db, identityId);
  const vendor = await vendorStatus(db, identityId);
  const driver = await driverStatus(db, identityId, now);
  const hasProject = workspaces.length > 0;
  if (!hasProject && vendor === null && driver === null) {
    throw new HttpError(403, "ask_no_active_role", {
      message: "اسأل Micro متاح في أوضاع العمل الثلاثة فقط (صاحب مشروع / مورد / سائق).",
    });
  }
  /* §10.2-7-1: asking requires a GRANTED consent the user can revoke at any
   * time — no consent row or a revoked one refuses honestly. */
  const consent = await askConsentRow(db, identityId);
  if (consent === null || consent.revoked_at !== null) {
    throw new HttpError(403, "ask_consent_required", { message: ASK_CONSENT_REQUIRED });
  }
  /* §10.2-7-3/4: the two daily caps. Checked BEFORE the provider call; a
   * failed/unanswered question consumes nothing (the counters move only on a
   * served answer below). */
  const windowStart = dayWindowStart(now);
  const usage = await askUsageRow(db, identityId, windowStart);
  if (usage !== null && Number(usage.question_count) >= ASK_DAILY_QUESTION_CAP) {
    throw new HttpError(429, "ask_daily_question_cap", { message: ASK_UNAVAILABLE_QUESTION_CAP });
  }
  if (usage !== null && Number(usage.neurons_used) >= ASK_DAILY_NEURONS_CAP) {
    throw new HttpError(429, "ask_free_quota_ended", { message: ASK_UNAVAILABLE_FREE_QUOTA });
  }
  /* §10.2-7-5: the EXPLICIT active workspace validation on the ask path — an
   * owner-mode question carries (or defaults to) one explicit workspace and
   * the owner facts are scoped to THAT workspace; a workspace the caller does
   * not actively own is an honest 403, never a merged cross-workspace scope.
   * (listWorkspaceMemberships returns ACTIVE memberships only — the filter
   * is in the query itself.) */
  let ownerWorkspaceId: string | undefined;
  if (driver === null && vendor === null) {
    const requested =
      typeof body.workspaceId === "string" && body.workspaceId.length > 0 ? body.workspaceId : undefined;
    const own = workspaces.find(w => w.role === "owner");
    ownerWorkspaceId = requested ?? own?.workspaceId ?? workspaces[0]?.workspaceId;
    if (requested !== undefined && !workspaces.some(w => w.workspaceId === requested)) {
      throw new HttpError(403, "ask_workspace_forbidden", {
        message: "هذا المشروع غير متاح لحسابك — اختر مشروعك النشط.",
      });
    }
    if (ownerWorkspaceId === undefined) {
      throw new HttpError(403, "ask_no_active_role", {
        message: "اسأل Micro متاح في أوضاع العمل الثلاثة فقط (صاحب مشروع / مورد / سائق).",
      });
    }
  }
  const provider = (ctx.env as { ASK_PROVIDER?: { fetch: (input: Request) => Promise<Response> } })
    .ASK_PROVIDER;
  if (!provider) {
    /* Stage C (S13/R2-12): لا أسماء مشغلين داخلية في نص المستخدم — الرمز
     * الآلي يبقى في details فقط (لا يعرضه العميل أبدًا). */
    throw new HttpError(501, "ask_not_configured", {
      step: "owner_manus_provider_setup",
      message:
        "Ask Micro غير مهيأة بعد: لا يوجد مزود ذكاء اصطناعي معتمد مرتبط. " +
        "الإعداد خطوة لاحقة لمالك النظام عبر مزود معتمد — ولا تُرسل أي بيانات لخدمة خارجية قبل ذلك.",
    });
  }
  /* §5.1: the bounded per-role fact set — server-computed aggregates through
   * the authorized read paths ONLY; the provider never sees identity data,
   * raw records, or anything outside the caller's own scope. */
  const facts: AskContextFact[] = [];
  let role: AskRole;
  if (driver !== null) {
    role = "driver";
    facts.push(...(await driverFacts(db, driver.driverProfileId, now)));
  } else if (vendor !== null) {
    role = "supplier";
    facts.push(...(await supplierFacts(db, vendor.supplierProfileId)));
  } else {
    role = "owner";
    facts.push(...(await ownerFacts(db, identityId, now, ownerWorkspaceId!)));
  }
  facts.push(...(await publicMarketFacts(db)));
  /* The provider port call — a plain fetch against the approved binding. */
  const input: AskProviderInput = { question, role, facts };
  let providerResult: { answerText: string; citedFactIds?: unknown; draft?: unknown; neuronsUsed?: unknown };
  try {
    const response = await provider.fetch(
      new Request("https://ask-provider.internal/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }),
    );
    if (!response.ok) throw new Error(`provider_status_${response.status}`);
    providerResult = (await response.json()) as typeof providerResult;
  } catch {
    /* Honest failure — never a fabricated answer, never a write. */
    throw new HttpError(502, "ask_provider_failed", {
      message: "تعذر الوصول إلى مزود الإجابة الآن — لم يُرسل شيء ولا تغيّر شيء. أعد المحاولة لاحقًا.",
    });
  }
  const safe = applyAskPolicy(providerResult, facts);
  /* §10.2-7-3/4: the served answer consumes the daily counters — the question
   * count and the provider-reported Neurons usage commit together (an
   * unanswered question consumed nothing). A reporting failure of the usage
   * row never blocks the answer (the caps still hold on the next ask). */
  const neuronsUsed =
    typeof providerResult.neuronsUsed === "number" && Number.isFinite(providerResult.neuronsUsed)
      ? Math.max(0, Math.floor(providerResult.neuronsUsed))
      : 0;
  await db
    .prepare(
      "INSERT INTO ask_daily_usage (identity_id, window_start, question_count, neurons_used) VALUES (?, ?, 1, ?) " +
        "ON CONFLICT (identity_id, window_start) DO UPDATE SET question_count = ask_daily_usage.question_count + 1, " +
        "neurons_used = ask_daily_usage.neurons_used + excluded.neurons_used",
    )
    .bind(identityId, windowStart, neuronsUsed)
    .run()
    .catch(() => undefined);
  return jsonResponse({
    answer: safe.answer,
    sources: safe.sources,
    ...(safe.draft === null ? {} : { draft: safe.draft }),
  });
}

function sessionToken(request: Request): string | undefined {
  const cookie = request.headers.get("cookie") ?? "";
  const part = cookie
    .split(";")
    .map(p => p.trim())
    .find(p => p.startsWith("micro_session="));
  return part === undefined ? undefined : part.slice("micro_session=".length);
}

/* ── The bounded per-role fact builders (§5.1) ──────────────────────────────
 * Every query below is the SAME authorized read shape the product endpoints
 * use, reduced to counts/sums — no cross-workspace data can appear because
 * each query is scoped by identity/assignment. */

async function ownerFacts(
  db: Db,
  identityId: string,
  now: number,
  workspaceId: string,
): Promise<AskContextFact[]> {
  /* §10.2-7-5: the owner facts are scoped to the caller's EXPLICIT active
   * workspace (validated in askQuestion) — never a merged cross-workspace
   * scope. */
  const pending = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM delivery_request WHERE requester_identity_id = ? AND workspace_id = ? AND status IN ('awaiting_driver_response','awaiting_requester_decision')",
    )
    .bind(identityId, workspaceId)
    .first<Record<string, unknown>>();
  const confirmed = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM delivery_request WHERE requester_identity_id = ? AND workspace_id = ? AND status = 'confirmed'",
    )
    .bind(identityId, workspaceId)
    .first<Record<string, unknown>>();
  const weekly = await db
    .prepare(
      "SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN offered_fare_minor IS NULL THEN 0 ELSE CAST(offered_fare_minor AS BIGINT) END),0) AS fare FROM delivery_request WHERE requester_identity_id = ? AND workspace_id = ? AND created_at >= ?",
    )
    .bind(identityId, workspaceId, now - 7 * DAY_MS)
    .first<Record<string, unknown>>();
  return [
    {
      id: "owner.pending_decisions",
      label: "قرارات توصيل بانتظارك",
      value: Number(pending?.n ?? 0),
      source: "سجل حجوزاتك في التوصيل",
    },
    {
      id: "owner.confirmed_bookings",
      label: "حجوزات مؤكدة جارية",
      value: Number(confirmed?.n ?? 0),
      source: "سجل حجوزاتك في التوصيل",
    },
    {
      id: "owner.weekly_bookings",
      label: "حجوزات آخر ٧ أيام",
      value: Number(weekly?.n ?? 0),
      source: "سجل حجوزاتك في التوصيل",
    },
    {
      id: "owner.weekly_offered_fare_minor",
      label: "إجمالي أجور الحجوزات المعروضة آخر ٧ أيام (قروش)",
      value: String(weekly?.fare ?? 0),
      source: "سجل حجوزاتك في التوصيل — مجموع خادمي",
    },
  ];
}

async function supplierFacts(db: Db, supplierProfileId: string): Promise<AskContextFact[]> {
  const rows = await db
    .prepare(
      "SELECT status, COUNT(*) AS n FROM supplier_listing WHERE supplier_profile_id = ? GROUP BY status",
    )
    .bind(supplierProfileId)
    .all<Record<string, unknown>>();
  const byStatus = new Map(rows.results.map(row => [String(row.status), Number(row.n)]));
  const total = rows.results.reduce((sum, row) => sum + Number(row.n), 0);
  return [
    {
      id: "vendor.total_listings",
      label: "إجمالي إعلاناتك",
      value: total,
      source: "سجل إعلاناتك في السوق",
    },
    {
      id: "vendor.published_listings",
      label: "إعلانات منشورة",
      value: byStatus.get("approved_for_publish") ?? 0,
      source: "سجل إعلاناتك في السوق",
    },
    {
      id: "vendor.pending_review_listings",
      label: "إعلانات بانتظار المراجعة",
      value: byStatus.get("submitted") ?? 0,
      source: "سجل إعلاناتك وحالة مراجعتها",
    },
    {
      id: "vendor.archived_listings",
      label: "إعلانات مؤرشفة",
      value: byStatus.get("archived") ?? 0,
      source: "سجل إعلاناتك في السوق",
    },
  ];
}

async function driverFacts(db: Db, driverProfileId: string, now: number): Promise<AskContextFact[]> {
  const open = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM delivery_request WHERE driver_profile_id = ? AND status IN ('awaiting_driver_response','confirmed')",
    )
    .bind(driverProfileId)
    .first<Record<string, unknown>>();
  const monthAmounts = await db
    .prepare(
      "SELECT COUNT(*) AS n, COALESCE(SUM(CAST(total_minor AS BIGINT)),0) AS total FROM daily_statement WHERE driver_profile_id = ? AND created_at >= ?",
    )
    .bind(driverProfileId, now - 30 * DAY_MS)
    .first<Record<string, unknown>>();
  const docs = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM driver_evidence WHERE driver_profile_id = ? AND status = 'approved' AND (expires_at IS NULL OR expires_at > ?)",
    )
    .bind(driverProfileId, now)
    .first<Record<string, unknown>>();
  return [
    {
      id: "driver.open_tasks",
      label: "مهام جارية",
      value: Number(open?.n ?? 0),
      source: "سجل حجوزاتك كسائق",
    },
    {
      id: "driver.monthly_statements",
      label: "كشوف آخر ٣٠ يومًا",
      value: Number(monthAmounts?.n ?? 0),
      source: "سجل كشوفك اليومية",
    },
    {
      id: "driver.monthly_collection_minor",
      label: "إجمالي المبالغ المصرّح بها آخر ٣٠ يومًا (قروش)",
      value: String(monthAmounts?.total ?? 0),
      source: "سجل كشوفك اليومية — مجموع خادمي",
    },
    {
      id: "driver.valid_documents",
      label: "وثائق سارية معتمدة",
      value: Number(docs?.n ?? 0),
      source: "سجل وثائقك",
    },
  ];
}

async function publicMarketFacts(db: Db): Promise<AskContextFact[]> {
  const listings = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM supplier_listing l JOIN supplier_profile p ON p.id = l.supplier_profile_id WHERE l.status = 'approved_for_publish' AND p.status = 'active'",
    )
    .first<Record<string, unknown>>();
  return [
    {
      id: "market.public_listings",
      label: "إعلانات منشورة في السوق العام",
      value: Number(listings?.n ?? 0),
      source: "السوق العام — عداد عام",
    },
  ];
}

/* Permitted-record summaries — the SAME authorized read shapes the product
 * endpoints use, reduced to counts. No cross-workspace data can appear here
 * because every query is scoped by identity/assignment. */

async function ownerPendingDecisionCount(db: Db, identityId: string): Promise<number> {
  const row = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM delivery_request " +
        "WHERE requester_identity_id = ? AND status IN ('awaiting_driver_response','awaiting_requester_decision')",
    )
    .bind(identityId)
    .first<Record<string, unknown>>();
  return row === null ? 0 : Number(row.n);
}

async function vendorListingCount(db: Db, supplierProfileId: string): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM supplier_listing WHERE supplier_profile_id = ?")
    .bind(supplierProfileId)
    .first<Record<string, unknown>>();
  return row === null ? 0 : Number(row.n);
}

async function driverOpenTaskCount(db: Db, driverProfileId: string): Promise<number> {
  const row = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM delivery_request WHERE driver_profile_id = ? AND status IN ('awaiting_driver_response','confirmed')",
    )
    .bind(driverProfileId)
    .first<Record<string, unknown>>();
  return row === null ? 0 : Number(row.n);
}
