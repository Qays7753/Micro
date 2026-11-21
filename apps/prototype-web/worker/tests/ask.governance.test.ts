/**
 * Ask Micro governance (owner supplement §10.2-7, 2026-11-22 — WS-251/DOC-041):
 * the focused regression tests for each governance rule the owner confirmed —
 *   1. revocable per-user consent (grant → ask works; revoke → immediate refusal),
 *   2. the local text-history cap lives on the CLIENT (≤21 days, no raw audio)
 *      — pinned in the DOM tests; here the server never receives or stores any
 *      audio/history payload at all (the ask body is the question only),
 *   3. the 20-question daily cap with the honest «المساعد غير متاح الآن»,
 *   4. the separate 10,000-Neurons/day free-quota stop with NO paid fallback
 *      (the same honest unavailable message, no upgrade prompt anywhere),
 *   5. explicit active role/workspace validation on the ask path,
 *   6. strict per-type draft fields (each kind carries EXACTLY its typed set),
 *   7. truthful failure/workspace copy (the pinned honest messages).
 * Plus §10.2-5: the manage-financial-event draft — the canonical Manage
 * financial input the owner resolved (through the existing single-record
 * connected write path, never a new schema).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  apiGet,
  apiPost,
  createWorkspace,
  grantAskConsent,
  rawDb,
  signInAs,
  startWorker,
  type AskProviderMock,
  type WorkerInstance,
} from "./harness.ts";
import { createApprovedDriver, setupExecutionPair, type WorkerRefs } from "./delivery.helpers.ts";

let worker: WorkerInstance;
let adminCookie: string;
let askMock: AskProviderMock;
let refs: WorkerRefs;

beforeEach(async () => {
  askMock = { nextResult: null, received: [] };
  worker = await startWorker({ askProvider: askMock });
  const admin = await signInAs(worker, { sub: "agov-admin", email: "agov-admin@example.test" });
  const db = await rawDb(worker);
  await db
    .prepare(
      "INSERT INTO network_membership (identity_id, role, status, granted_by, granted_at) " +
        "SELECT id, 'admin', 'active', 'test', 1 FROM network_identity WHERE email = ?",
    )
    .bind("agov-admin@example.test")
    .run();
  adminCookie = admin.cookieHeader;
  refs = { worker, adminCookie };
});

afterEach(async () => {
  await worker.close();
});

async function identityIdOf(email: string): Promise<string> {
  const db = await rawDb(worker);
  const row = await db
    .prepare("SELECT id FROM network_identity WHERE email = ?")
    .bind(email)
    .first<{ id: string }>();
  if (!row) throw new Error(`identity ${email} missing`);
  return row.id;
}

describe("§10.2-7-1: revocable per-user consent", () => {
  it("asking without a consent is an honest 403; granting opens asking; revoking is IMMEDIATE", async () => {
    const owner = await signInAs(worker, { sub: "agov-c", email: "agov-c@example.test" });
    const workspaceId = await createWorkspace(worker, owner.cookieHeader, "مشروع الموافقة");
    askMock.nextResult = { answerText: "لا حجوزات.", citedFactIds: [] };
    // No consent yet — the honest refusal with the truthful copy.
    const refused = await apiPost(worker, owner.cookieHeader, "/api/ask", { question: "كم حجزي؟" });
    expect(refused.status).toBe(403);
    const refusedBody = (await refused.json()) as { error: { code: string; details: { message: string } } };
    expect(refusedBody.error.code).toBe("ask_consent_required");
    expect(refusedBody.error.details.message).toContain("سحب الموافقة في أي وقت");
    // The status reports the honest consent state at every step.
    const before = (await (await apiGet(worker, owner.cookieHeader, "/api/ask/status")).json()) as {
      governance: { consent: string };
    };
    expect(before.governance.consent).toBe("never");
    // Grant → asking works.
    await grantAskConsent(worker, owner.cookieHeader);
    const granted = (await (await apiGet(worker, owner.cookieHeader, "/api/ask/status")).json()) as {
      governance: { consent: string };
    };
    expect(granted.governance.consent).toBe("granted");
    const ok = await apiPost(worker, owner.cookieHeader, "/api/ask", { question: "كم حجزي؟" });
    expect(ok.status).toBe(200);
    // Revoke → the VERY NEXT question is refused (immediate, no grace).
    const revoke = await apiPost(worker, owner.cookieHeader, "/api/ask/consent/revoke", {});
    expect(revoke.status).toBe(200);
    const revoked = (await (await apiGet(worker, owner.cookieHeader, "/api/ask/status")).json()) as {
      governance: { consent: string };
    };
    expect(revoked.governance.consent).toBe("revoked");
    const blocked = await apiPost(worker, owner.cookieHeader, "/api/ask", { question: "كم حجزي الآن؟" });
    expect(blocked.status).toBe(403);
    // The provider was called exactly ONCE (the consented question only).
    expect(askMock.received).toHaveLength(1);
    // The consent decisions are audited (grant + revoke).
    const db = await rawDb(worker);
    const ownerIdentityId = await identityIdOf("agov-c@example.test");
    const audit = await db
      .prepare(
        "SELECT action FROM network_audit_event WHERE actor_identity_id = ? AND action LIKE 'ask_consent%' ORDER BY created_at",
      )
      .bind(ownerIdentityId)
      .all<{ action: string }>();
    expect(audit.results.map(row => row.action)).toEqual(["ask_consent_granted", "ask_consent_revoked"]);
    void workspaceId;
  });
});

describe("§10.2-7-3: the 20-question daily cap", () => {
  it("the 21st question of the day gets the honest «المساعد غير متاح الآن» — nothing else breaks", async () => {
    const owner = await signInAs(worker, { sub: "agov-cap", email: "agov-cap@example.test" });
    await createWorkspace(worker, owner.cookieHeader, "مشروع الحد اليومي");
    await grantAskConsent(worker, owner.cookieHeader);
    // Seed today's window with 20 served questions (the fixed UTC-day window
    // the server uses — the cap logic is what this test pins, not 21 HTTP
    // round-trips against the separate per-minute rate limit).
    const db = await rawDb(worker);
    const ownerIdentityId = await identityIdOf("agov-cap@example.test");
    const windowStart = Math.floor(Date.now() / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000);
    await db
      .prepare(
        "INSERT INTO ask_daily_usage (identity_id, window_start, question_count, neurons_used) VALUES (?, ?, 20, 0)",
      )
      .bind(ownerIdentityId, windowStart)
      .run();
    askMock.nextResult = { answerText: "جواب.", citedFactIds: [] };
    const response = await apiPost(worker, owner.cookieHeader, "/api/ask", {
      question: "سؤال جديد بعد الحد",
    });
    expect(response.status).toBe(429);
    const body = (await response.json()) as { error: { code: string; details: { message: string } } };
    expect(body.error.code).toBe("ask_daily_question_cap");
    expect(body.error.details.message).toContain("المساعد غير متاح الآن");
    expect(body.error.details.message).toContain("٢٠ سؤالًا");
    // Nothing else breaks: the provider was NOT called, the status stays
    // available, and the cap state is reported honestly.
    expect(askMock.received).toHaveLength(0);
    const status = (await (await apiGet(worker, owner.cookieHeader, "/api/ask/status")).json()) as {
      available: boolean;
      governance: { daily: { questionsUsed: number; questionCap: number } };
    };
    expect(status.available).toBe(true);
    expect(status.governance.daily.questionsUsed).toBe(20);
    expect(status.governance.daily.questionCap).toBe(20);
    // A NEW day's window starts empty (the counter is per-window).
    const rows = await db
      .prepare("SELECT COUNT(*) AS n FROM ask_daily_usage WHERE identity_id = ? AND window_start <> ?")
      .bind(ownerIdentityId, windowStart)
      .first<{ n: number }>();
    expect(Number(rows!.n)).toBe(0);
  });
});

describe("§10.2-7-4: the separate 10,000-Neurons/day free-quota stop (no paid fallback)", () => {
  it("an exhausted free quota is the same honest unavailable message — no paid path anywhere", async () => {
    const owner = await signInAs(worker, { sub: "agov-neu", email: "agov-neu@example.test" });
    await createWorkspace(worker, owner.cookieHeader, "مشروع حصة النيورونات");
    await grantAskConsent(worker, owner.cookieHeader);
    const db = await rawDb(worker);
    const ownerIdentityId = await identityIdOf("agov-neu@example.test");
    const windowStart = Math.floor(Date.now() / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000);
    await db
      .prepare(
        "INSERT INTO ask_daily_usage (identity_id, window_start, question_count, neurons_used) VALUES (?, ?, 3, 10000)",
      )
      .bind(ownerIdentityId, windowStart)
      .run();
    askMock.nextResult = { answerText: "جواب.", citedFactIds: [] };
    const response = await apiPost(worker, owner.cookieHeader, "/api/ask", {
      question: "سؤال بعد نفاد الحصة",
    });
    expect(response.status).toBe(429);
    const body = (await response.json()) as { error: { code: string; details: { message: string } } };
    expect(body.error.code).toBe("ask_free_quota_ended");
    expect(body.error.details.message).toContain("المساعد غير متاح الآن");
    expect(body.error.details.message).toContain("لا يوجد مسار مدفوع");
    // No paid fallback exists: the response carries no upgrade/payment prompt.
    const raw = JSON.stringify(body);
    expect(raw).not.toContain("ترقية");
    expect(raw).not.toContain("اشتراك");
    expect(raw).not.toContain("دفع");
    // The provider was not called and the status reports the quota honestly.
    expect(askMock.received).toHaveLength(0);
    const status = (await (await apiGet(worker, owner.cookieHeader, "/api/ask/status")).json()) as {
      governance: { daily: { neuronsUsed: number; neuronsCap: number } };
    };
    expect(status.governance.daily.neuronsUsed).toBe(10000);
    expect(status.governance.daily.neuronsCap).toBe(10000);
  });

  it("a served answer records the provider-reported Neurons usage on the daily counter", async () => {
    const owner = await signInAs(worker, { sub: "agov-neu2", email: "agov-neu2@example.test" });
    await createWorkspace(worker, owner.cookieHeader, "مشروع عدّ النيورونات");
    await grantAskConsent(worker, owner.cookieHeader);
    askMock.nextResult = { answerText: "جواب موثق.", citedFactIds: [], neuronsUsed: 137 };
    const response = await apiPost(worker, owner.cookieHeader, "/api/ask", { question: "سؤال عدّ" });
    expect(response.status).toBe(200);
    const db = await rawDb(worker);
    const ownerIdentityId = await identityIdOf("agov-neu2@example.test");
    const windowStart = Math.floor(Date.now() / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000);
    const row = await db
      .prepare(
        "SELECT question_count, neurons_used FROM ask_daily_usage WHERE identity_id = ? AND window_start = ?",
      )
      .bind(ownerIdentityId, windowStart)
      .first<{ question_count: number; neurons_used: number }>();
    expect(Number(row!.question_count)).toBe(1);
    expect(Number(row!.neurons_used)).toBe(137);
  });
});

describe("§10.2-7-5: explicit active role/workspace validation on the ask path", () => {
  it("an owner's facts are scoped to the EXPLICIT workspace; another workspace is an honest 403", async () => {
    const owner = await signInAs(worker, { sub: "agov-ws", email: "agov-ws@example.test" });
    await grantAskConsent(worker, owner.cookieHeader);
    const firstWorkspaceId = await createWorkspace(worker, owner.cookieHeader, "المشروع الأول");
    /* The ONE-project rule (W1/EX-D24) means a second workspace arrives as a
     * granted seat (the established test pattern) — a supplier seat in another
     * business's workspace. */
    const db = await rawDb(worker);
    const ownerIdentityId = await identityIdOf("agov-ws@example.test");
    await db
      .prepare(
        "INSERT INTO workspace (id, display_name, created_by_identity_id, market_enabled, delivery_enabled, created_at, updated_at) " +
          "VALUES ('ws_agov_second', 'المشروع الثاني', ?, 1, 1, 1, 1)",
      )
      .bind(ownerIdentityId)
      .run();
    await db
      .prepare(
        "INSERT INTO workspace_member (workspace_id, identity_id, role, status, granted_at) " +
          "VALUES ('ws_agov_second', ?, 'supplier', 'active', 1)",
      )
      .bind(ownerIdentityId)
      .run();
    const driver = await createApprovedDriver(refs, "agov-ws-drv@example.test", "agov-ws-drv");
    // One CONFIRMED booking in the FIRST workspace only (the established
    // execution-pair helper — the same authorized path the product uses).
    const bookingId = await setupExecutionPair(
      worker,
      owner.cookieHeader,
      driver.cookie,
      driver.driverProfileId,
      firstWorkspaceId,
    );
    void bookingId;
    // Ask with the SECOND workspace context: the confirmed-bookings fact is 0
    // (the booking belongs to the first workspace — no merged scope).
    askMock.nextResult = { answerText: "لا حجوزات مؤكدة.", citedFactIds: [] };
    const second = await apiPost(worker, owner.cookieHeader, "/api/ask", {
      question: "كم حجزًا مؤكدًا في مشروعي؟",
      workspaceId: "ws_agov_second",
    });
    expect(second.status).toBe(200);
    const secondInput = askMock.received[0]!;
    const secondFact = secondInput.facts.find(fact => fact.id === "owner.confirmed_bookings")!;
    expect(secondFact.value).toBe(0);
    // Ask with the FIRST workspace context: the fact is 1 — the scoping is
    // explicit, not merged.
    const first = await apiPost(worker, owner.cookieHeader, "/api/ask", {
      question: "كم حجزًا مؤكدًا في مشروعي؟",
      workspaceId: firstWorkspaceId,
    });
    expect(first.status).toBe(200);
    const firstInput = askMock.received[1]!;
    const firstFact = firstInput.facts.find(fact => fact.id === "owner.confirmed_bookings")!;
    expect(firstFact.value).toBe(1);
    // A workspace the caller has NO membership in is an honest 403.
    const stranger = await signInAs(worker, { sub: "agov-str", email: "agov-str@example.test" });
    await grantAskConsent(worker, stranger.cookieHeader);
    await createWorkspace(worker, stranger.cookieHeader, "مشروع الغريب");
    const foreign = await apiPost(worker, stranger.cookieHeader, "/api/ask", {
      question: "كم حجزًا عنده؟",
      workspaceId: firstWorkspaceId,
    });
    expect(foreign.status).toBe(403);
    const foreignBody = (await foreign.json()) as { error: { code: string } };
    expect(foreignBody.error.code).toBe("ask_workspace_forbidden");
  });
});

describe("§10.2-7-6: strict per-type draft fields (anything else fails closed)", () => {
  it("a delivery-booking draft with a field OUTSIDE the canonical set is dropped entirely", async () => {
    const owner = await signInAs(worker, { sub: "agov-strict1", email: "agov-strict1@example.test" });
    await grantAskConsent(worker, owner.cookieHeader);
    await createWorkspace(worker, owner.cookieHeader, "مشروع الصرامة ١");
    askMock.nextResult = {
      answerText: "جاهز لتجهيز مسودة الحجز.",
      citedFactIds: [],
      draft: {
        kind: "delivery-booking",
        title: "مسودة بحقل دخيل",
        fields: [
          {
            name: "needType",
            label: "نوع الطلب",
            type: "enum",
            required: true,
            value: null,
            options: ["deliver_to_customer", "fetch_ready_goods"],
          },
          {
            name: "pickupGovernorate",
            label: "محافظة الاستلام",
            type: "governorate",
            required: true,
            value: null,
          },
          {
            name: "dropoffGovernorate",
            label: "محافظة التسليم",
            type: "governorate",
            required: true,
            value: null,
          },
          {
            name: "pricingMode",
            label: "نمط التسعير",
            type: "enum",
            required: true,
            value: null,
            options: ["prepriced", "quote_request"],
          },
          /* A field the canonical confirm path does not know — the whole
           * draft fails closed (never a card carrying an unknown field). */
          { name: "secretNote", label: "حقل دخيل", type: "text", required: false, value: null },
        ],
      },
    };
    const response = await apiPost(worker, owner.cookieHeader, "/api/ask", { question: "سجّل لي حجزًا" });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { draft?: unknown };
    expect(body.draft).toBeUndefined();
  });

  it("a delivery-booking draft MISSING a required field is dropped entirely", async () => {
    const owner = await signInAs(worker, { sub: "agov-strict2", email: "agov-strict2@example.test" });
    await grantAskConsent(worker, owner.cookieHeader);
    await createWorkspace(worker, owner.cookieHeader, "مشروع الصرامة ٢");
    askMock.nextResult = {
      answerText: "جاهز لتجهيز مسودة الحجز.",
      citedFactIds: [],
      draft: {
        kind: "delivery-booking",
        title: "مسودة ناقصة",
        fields: [
          {
            name: "needType",
            label: "نوع الطلب",
            type: "enum",
            required: true,
            value: null,
            options: ["deliver_to_customer", "fetch_ready_goods"],
          },
          /* pricingMode + governorates missing — a required field is absent. */
        ],
      },
    };
    const response = await apiPost(worker, owner.cookieHeader, "/api/ask", { question: "سجّل لي حجزًا" });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { draft?: unknown };
    expect(body.draft).toBeUndefined();
  });

  it("a draft field with the WRONG type or non-canonical enum options is dropped entirely", async () => {
    const owner = await signInAs(worker, { sub: "agov-strict3", email: "agov-strict3@example.test" });
    await grantAskConsent(worker, owner.cookieHeader);
    await createWorkspace(worker, owner.cookieHeader, "مشروع الصرامة ٣");
    // (a) wrong type: pieceCount declared as text.
    askMock.nextResult = {
      answerText: "جاهز.",
      citedFactIds: [],
      draft: {
        kind: "delivery-booking",
        title: "نوع خاطئ",
        fields: [
          {
            name: "needType",
            label: "نوع الطلب",
            type: "enum",
            required: true,
            value: null,
            options: ["deliver_to_customer", "fetch_ready_goods"],
          },
          {
            name: "pickupGovernorate",
            label: "محافظة الاستلام",
            type: "governorate",
            required: true,
            value: null,
          },
          {
            name: "dropoffGovernorate",
            label: "محافظة التسليم",
            type: "governorate",
            required: true,
            value: null,
          },
          {
            name: "pricingMode",
            label: "نمط التسعير",
            type: "enum",
            required: true,
            value: null,
            options: ["prepriced", "quote_request"],
          },
          { name: "pieceCount", label: "عدد القطع", type: "text", required: false, value: null },
        ],
      },
    };
    const wrongType = await apiPost(worker, owner.cookieHeader, "/api/ask", { question: "سجّل لي حجزًا" });
    expect(wrongType.status).toBe(200);
    expect(((await wrongType.json()) as { draft?: unknown }).draft).toBeUndefined();
    // (b) non-canonical enum options on needType.
    askMock.nextResult = {
      answerText: "جاهز.",
      citedFactIds: [],
      draft: {
        kind: "delivery-booking",
        title: "خيارات دخيلة",
        fields: [
          {
            name: "needType",
            label: "نوع الطلب",
            type: "enum",
            required: true,
            value: null,
            options: ["teleport"],
          },
          {
            name: "pickupGovernorate",
            label: "محافظة الاستلام",
            type: "governorate",
            required: true,
            value: null,
          },
          {
            name: "dropoffGovernorate",
            label: "محافظة التسليم",
            type: "governorate",
            required: true,
            value: null,
          },
          {
            name: "pricingMode",
            label: "نمط التسعير",
            type: "enum",
            required: true,
            value: null,
            options: ["prepriced", "quote_request"],
          },
        ],
      },
    };
    const wrongOptions = await apiPost(worker, owner.cookieHeader, "/api/ask", {
      question: "سجّل لي حجزًا آخر",
    });
    expect(wrongOptions.status).toBe(200);
    expect(((await wrongOptions.json()) as { draft?: unknown }).draft).toBeUndefined();
  });
});

describe("§10.2-5: the manage-financial-event draft — the canonical Manage financial input", () => {
  it("the exact typed field set passes; unknown/compound financial types stay deferred and fail closed", async () => {
    const owner = await signInAs(worker, { sub: "agov-fin", email: "agov-fin@example.test" });
    await grantAskConsent(worker, owner.cookieHeader);
    await createWorkspace(worker, owner.cookieHeader, "مشروع المسودة المالية");
    const canonicalFields = [
      {
        name: "eventType",
        label: "نوع الحدث المالي",
        type: "enum",
        required: true,
        value: null,
        options: [
          "owner_investment_cash",
          "owner_withdrawal_cash",
          "operating_expense_cash",
          "operating_expense_payable",
          "amanah_held_cash",
          "amanah_released_cash",
          "loss_non_cash",
        ],
      },
      { name: "amountJod", label: "المبلغ (دينار)", type: "decimal", required: true, value: null },
      { name: "occurredOn", label: "تاريخ الوقوع", type: "date", required: true, value: null },
      { name: "note", label: "البيان", type: "text", required: true, value: null },
      { name: "counterparty", label: "الطرف", type: "text", required: false, value: null },
    ];
    askMock.nextResult = {
      answerText: "جاهز لتسجيل الحدث المالي — أكمل القيم بنفسك.",
      citedFactIds: [],
      draft: { kind: "manage-financial-event", title: "مسودة حدث مالي", fields: canonicalFields },
    };
    const ok = await apiPost(worker, owner.cookieHeader, "/api/ask", {
      question: "سجّل لي مصروف تشغيل نقدي",
    });
    expect(ok.status).toBe(200);
    const okBody = (await ok.json()) as { draft?: { kind: string; fields: { name: string }[] } };
    expect(okBody.draft?.kind).toBe("manage-financial-event");
    expect(okBody.draft?.fields.map(field => field.name).sort()).toEqual([
      "amountJod",
      "counterparty",
      "eventType",
      "note",
      "occurredOn",
    ]);
    // A DEFERRED compound type (payable settlement needs a linked obligation)
    // presented as a draftable enum option fails the whole draft closed — the
    // deferral list is enforced by the strict enum options, not advisory.
    askMock.nextResult = {
      answerText: "جاهز.",
      citedFactIds: [],
      draft: {
        kind: "manage-financial-event",
        title: "مسودة تسديد التزام",
        fields: [
          { ...canonicalFields[0]!, options: [...canonicalFields[0]!.options!, "payable_settlement_cash"] },
          ...canonicalFields.slice(1),
        ],
      },
    };
    const deferred = await apiPost(worker, owner.cookieHeader, "/api/ask", {
      question: "سجّد لي التزامًا",
    });
    expect(deferred.status).toBe(200);
    const deferredBody = (await deferred.json()) as { draft?: unknown };
    expect(deferredBody.draft).toBeUndefined();
    // The ask itself wrote nothing — the draft is a card, not a record (the
    // manage_record store stays byte-identical until the user's OWN explicit
    // confirm through the canonical write).
    const db = await rawDb(worker);
    const records = await db.prepare("SELECT COUNT(*) AS n FROM manage_record").first<{ n: number }>();
    expect(Number(records!.n)).toBe(0);
  });
});

describe("§10.2-7-7 + §10.2-6: truthful copy and the no-history/no-proactive boundary", () => {
  it("the ask port carries ONLY the current question and the bounded facts — never a chat history", async () => {
    const owner = await signInAs(worker, { sub: "agov-copy", email: "agov-copy@example.test" });
    await grantAskConsent(worker, owner.cookieHeader);
    await createWorkspace(worker, owner.cookieHeader, "مشروع النسخ الصادقة");
    askMock.nextResult = { answerText: "جواب أول.", citedFactIds: [] };
    await apiPost(worker, owner.cookieHeader, "/api/ask", { question: "سؤالي الأول عن الحجوزات" });
    askMock.nextResult = { answerText: "جواب ثانٍ.", citedFactIds: [] };
    await apiPost(worker, owner.cookieHeader, "/api/ask", { question: "سؤالي الثاني عن الكشوف" });
    // The second call's payload contains ONLY the current question + facts —
    // the first question never travels along (no auto-sent history).
    const second = askMock.received[1]!;
    expect(second.question).toBe("سؤالي الثاني عن الكشوف");
    expect(JSON.stringify(second)).not.toContain("سؤالي الأول");
    // The input shape is exactly { question, role, facts } — no other keys.
    expect(Object.keys(second).sort()).toEqual(["facts", "question", "role"]);
  });

  it("the pinned honest messages stay exact (no stale or false context text)", async () => {
    const owner = await signInAs(worker, { sub: "agov-msg", email: "agov-msg@example.test" });
    await grantAskConsent(worker, owner.cookieHeader);
    await createWorkspace(worker, owner.cookieHeader, "مشروع الرسائل");
    askMock.nextResult = { answerText: "جواب.", citedFactIds: [] };
    // The provider failure message (§5.5).
    askMock.failWithStatus = 500;
    const failed = await apiPost(worker, owner.cookieHeader, "/api/ask", { question: "سؤال وقت التعطل" });
    expect(failed.status).toBe(502);
    const failedBody = (await failed.json()) as { error: { code: string; details: { message: string } } };
    expect(failedBody.error.code).toBe("ask_provider_failed");
    expect(failedBody.error.details.message).toBe(
      "تعذر الوصول إلى مزود الإجابة الآن — لم يُرسل شيء ولا تغيّر شيء. أعد المحاولة لاحقًا.",
    );
  });
});
