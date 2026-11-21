/**
 * Ask Micro provider-neutral pipeline (Post-Group 6 continuous completion —
 * WS-251/DOC-041, owner order 7593b9c4 §5 BINDING): the mock provider (the
 * askProvider harness option — NEVER a real provider; production has no
 * binding and stays honestly «not configured») proves every §5.5 property
 * over real workerd+PostgreSQL:
 *
 *   1. authorized read scope ONLY — the provider receives the caller's own
 *      bounded facts, never another identity's data (§5.1);
 *   2. no answer from unauthorized data — uncited/foreign citations drop;
 *   3. no guessed financial values — an unbacked figure fails the whole
 *      answer closed to the honest «لا أعرف» (§5.2);
 *   4. no write before explicit confirmation — the ask endpoints write
 *      NOTHING (row counts prove it); a draft is a typed card only (§5.3);
 *   5. no write on cancellation/rejection/timeout/server failure — a failing
 *      provider is an honest 502, never a fabricated answer or a write;
 *   6. a successful write can occur ONLY via the existing canonical use case
 *      after server acceptance — the draft carries no record id and no saved
 *      flag; the confirm path is the normal application flow (client-side,
 *      proven in the DOM tests).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  apiGet,
  apiPost,
  createWorkspace,
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
  const admin = await signInAs(worker, { sub: "askp-admin", email: "askp-admin@example.test" });
  const db = await rawDb(worker);
  await db
    .prepare(
      "INSERT INTO network_membership (identity_id, role, status, granted_by, granted_at) " +
        "SELECT id, 'admin', 'active', 'test', 1 FROM network_identity WHERE email = ?",
    )
    .bind("askp-admin@example.test")
    .run();
  adminCookie = admin.cookieHeader;
  refs = { worker, adminCookie };
});

afterEach(async () => {
  await worker.close();
});

describe("§5.1 + أ-2: availability and the bounded authorized scope", () => {
  it("a role-less account is honestly refused (the three modes only)", async () => {
    const user = await signInAs(worker, { sub: "askp-none", email: "askp-none@example.test" });
    const status = (await (await apiGet(worker, user.cookieHeader, "/api/ask/status")).json()) as {
      available: boolean;
      reason?: string;
    };
    expect(status.available).toBe(false);
    expect(status.reason).toBe("no_active_role");
    const ask = await apiPost(worker, user.cookieHeader, "/api/ask", { question: "كم عندي من حجوزات؟" });
    expect(ask.status).toBe(403);
  });

  it("the provider receives ONLY the owner's own bounded facts — never another identity's data", async () => {
    const owner = await signInAs(worker, { sub: "askp-owner", email: "askp-owner@example.test" });
    const ownerWorkspaceId = await createWorkspace(worker, owner.cookieHeader, "مشروع مالك السؤال");
    const driver = await createApprovedDriver(refs, "askp-driver2@example.test", "askp-driver2");
    await setupExecutionPair(
      worker,
      owner.cookieHeader,
      driver.cookie,
      driver.driverProfileId,
      ownerWorkspaceId,
    );
    const otherOwner = await signInAs(worker, { sub: "askp-other", email: "askp-other@example.test" });
    const otherWorkspaceId = await createWorkspace(worker, otherOwner.cookieHeader, "مشروع مالك آخر");
    await setupExecutionPair(
      worker,
      otherOwner.cookieHeader,
      driver.cookie,
      driver.driverProfileId,
      otherWorkspaceId,
    );
    askMock.nextResult = { answerText: "لديك حجز مؤكد واحد.", citedFactIds: ["owner.confirmed_bookings"] };
    const response = await apiPost(worker, owner.cookieHeader, "/api/ask", {
      question: "كم حجزًا مؤكدًا عندي؟",
    });
    expect(response.status).toBe(200);
    // The provider saw exactly ONE call scoped to the asker's own facts.
    expect(askMock.received).toHaveLength(1);
    const input = askMock.received[0]!;
    expect(input.role).toBe("owner");
    const ids = input.facts.map(fact => fact.id);
    expect(ids).toContain("owner.confirmed_bookings");
    expect(ids).toContain("owner.pending_decisions");
    expect(ids).toContain("owner.weekly_bookings");
    expect(ids).toContain("owner.weekly_offered_fare_minor");
    expect(ids).toContain("market.public_listings");
    // The OWN facts count only the asker's booking (1) — not the other owner's.
    const confirmed = input.facts.find(fact => fact.id === "owner.confirmed_bookings")!;
    expect(confirmed.value).toBe(1);
    // No identity material ever reaches the provider.
    expect(JSON.stringify(input)).not.toContain("askp-owner@example.test");
    expect(JSON.stringify(input)).not.toContain("askp-other@example.test");
  });

  it("a driver's facts are driver-scoped only (his bookings/amounts/documents — أ-2)", async () => {
    const driver = await createApprovedDriver(refs, "askp-drv@example.test", "askp-drv");
    askMock.nextResult = { answerText: "لا مهام جارية الآن.", citedFactIds: ["driver.open_tasks"] };
    const response = await apiPost(worker, driver.cookie, "/api/ask", { question: "كم مهمة عندي؟" });
    expect(response.status).toBe(200);
    const input = askMock.received[0]!;
    expect(input.role).toBe("driver");
    const ids = input.facts.map(fact => fact.id);
    expect(ids).toContain("driver.open_tasks");
    expect(ids).toContain("driver.monthly_collection_minor");
    expect(ids).toContain("driver.valid_documents");
    // No owner/vendor facts leak into the driver scope.
    expect(ids.find(id => id.startsWith("owner."))).toBeUndefined();
    expect(ids.find(id => id.startsWith("vendor."))).toBeUndefined();
  });

  it("a supplier's facts are listing/review scoped only (أ-2)", async () => {
    const vendor = await signInAs(worker, { sub: "askp-sup", email: "askp-sup@example.test" });
    const workspaceId = await createWorkspace(worker, vendor.cookieHeader, "مشروع مورد السؤال");
    await apiPost(worker, vendor.cookieHeader, "/api/market/vendor/profile", {
      displayName: "مورد السؤال",
      contactPhone: "+962790600001",
      governorate: "عمان",
      supplierType: "manufacturer",
      deliveryOption: "delivery",
      termsAccepted: true,
      workspaceId,
    });
    askMock.nextResult = { answerText: "لا إعلانات بعد.", citedFactIds: ["vendor.total_listings"] };
    const response = await apiPost(worker, vendor.cookieHeader, "/api/ask", { question: "كم إعلانًا عندي؟" });
    expect(response.status).toBe(200);
    const input = askMock.received[0]!;
    expect(input.role).toBe("supplier");
    const ids = input.facts.map(fact => fact.id);
    expect(ids).toContain("vendor.total_listings");
    expect(ids.find(id => id.startsWith("owner."))).toBeUndefined();
  });
});

describe("§5.2: financial figures come from the trusted server results only", () => {
  it("a CITED server-computed figure passes and is rendered with its source", async () => {
    const owner = await signInAs(worker, { sub: "askp-fig", email: "askp-fig@example.test" });
    const workspaceId = await createWorkspace(worker, owner.cookieHeader, "مشروع الرقم الموثق");
    const driver = await createApprovedDriver(refs, "askp-fig-drv@example.test", "askp-fig-drv");
    await setupExecutionPair(worker, owner.cookieHeader, driver.cookie, driver.driverProfileId, workspaceId);
    askMock.nextResult = {
      answerText: "لديك حجز مؤكد واحد ينتظر التنفيذ.",
      citedFactIds: ["owner.confirmed_bookings"],
    };
    const response = await apiPost(worker, owner.cookieHeader, "/api/ask", { question: "كم حجزًا مؤكدًا؟" });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { answer: string; sources: { id: string; source: string }[] };
    expect(body.answer).toContain("حجز مؤكد واحد");
    expect(body.sources).toHaveLength(1);
    expect(body.sources[0]!.id).toBe("owner.confirmed_bookings");
    expect(body.sources[0]!.source).toContain("سجل حجوزاتك");
  });

  it("an INVENTED figure (not in any cited fact) fails the WHOLE answer closed to «لا أعرف»", async () => {
    const owner = await signInAs(worker, { sub: "askp-lie", email: "askp-lie@example.test" });
    await createWorkspace(worker, owner.cookieHeader, "مشروع الرقم المخترع");
    askMock.nextResult = {
      answerText: "ربحك هذا الشهر 1570 دينارًا تقريبًا.",
      citedFactIds: ["owner.weekly_bookings"],
    };
    const response = await apiPost(worker, owner.cookieHeader, "/api/ask", { question: "كم ربحي؟" });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { answer: string; sources: unknown[] };
    expect(body.answer).toContain("لا أعرف");
    expect(body.answer).not.toContain("1570");
  });

  it("a citation of a fact OUTSIDE the provided scope is dropped (no answer from unauthorized data)", async () => {
    const owner = await signInAs(worker, { sub: "askp-foreign", email: "askp-foreign@example.test" });
    await createWorkspace(worker, owner.cookieHeader, "مشروع الاستشهاد الأجنبي");
    askMock.nextResult = {
      answerText: "لديك إعلان منشور.",
      citedFactIds: ["vendor.published_listings", "market.public_listings"],
    };
    const response = await apiPost(worker, owner.cookieHeader, "/api/ask", {
      question: "كم إعلاني المنشور؟",
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { answer: string; sources: { id: string }[] };
    // The owner scope has no vendor fact — the foreign citation is dropped.
    expect(body.sources.map(source => source.id)).toEqual(["market.public_listings"]);
  });
});

describe("§5.3: typed editable draft proposals — never a saved transaction", () => {
  it("a valid draft passes with unknown required values visibly blank and provider-invented values stripped", async () => {
    const owner = await signInAs(worker, { sub: "askp-draft", email: "askp-draft@example.test" });
    await createWorkspace(worker, owner.cookieHeader, "مشروع المسودة");
    askMock.nextResult = {
      answerText: "أستطيع تجهيز مسودة حجز توصيل لك — أكمل التفاصيل بنفسك.",
      citedFactIds: [],
      draft: {
        kind: "delivery-booking",
        title: "مسودة حجز توصيل",
        fields: [
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
            /* A value the provider INVENTED for a field the user never stated
             * — must be stripped to blank (the user decides, §5.3). */
            value: "الزرقاء",
          },
          {
            name: "needType",
            label: "نوع الطلب",
            type: "enum",
            required: true,
            value: null,
            options: ["deliver_to_customer", "fetch_ready_goods"],
          },
          { name: "scheduleDate", label: "تاريخ التنفيذ", type: "date", required: true, value: null },
          {
            name: "offeredFareJod",
            label: "الأجر المعروض (دينار)",
            type: "decimal",
            required: true,
            value: null,
          },
          { name: "notes", label: "ملاحظات", type: "text", required: false, value: null },
        ],
      },
    };
    const response = await apiPost(worker, owner.cookieHeader, "/api/ask", {
      question: "سجّل لي حجز توصيلة للزبون غدًا",
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      draft: { kind: string; fields: { name: string; value: string | number | null }[] };
    };
    expect(body.draft.kind).toBe("delivery-booking");
    const dropoff = body.draft.fields.find(field => field.name === "dropoffGovernorate")!;
    expect(dropoff.value).toBeNull();
    for (const field of body.draft.fields) {
      expect(field.value).toBeNull();
    }
  });

  it("an UNKNOWN draft kind is refused entirely (the closed registry)", async () => {
    const owner = await signInAs(worker, { sub: "askp-badkind", email: "askp-badkind@example.test" });
    await createWorkspace(worker, owner.cookieHeader, "مشروع نوع مرفوض");
    askMock.nextResult = {
      answerText: "جاهز لتسجيل مصروف.",
      citedFactIds: [],
      draft: {
        kind: "manage-financial-event",
        title: "مسودة مصروف",
        fields: [{ name: "amount", label: "المبلغ", type: "decimal", required: true, value: null }],
      },
    };
    const response = await apiPost(worker, owner.cookieHeader, "/api/ask", { question: "سجّل لي مصروفًا" });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { draft?: unknown };
    expect(body.draft).toBeUndefined();
  });
});

describe("§5.4/§5.5: no write before confirmation, none on failure — the ask surface never writes", () => {
  it("a successful ask writes NOTHING anywhere (every table count unchanged)", async () => {
    const owner = await signInAs(worker, { sub: "askp-nowrite", email: "askp-nowrite@example.test" });
    await createWorkspace(worker, owner.cookieHeader, "مشروع بلا كتابة");
    askMock.nextResult = { answerText: "لا حجوزات هذا الأسبوع.", citedFactIds: ["owner.weekly_bookings"] };
    const db = await rawDb(worker);
    const tables = [
      "delivery_request",
      "delivery_event",
      "supplier_listing",
      "manage_record",
      "network_audit_event",
      "network_notification",
    ];
    const before: Record<string, number> = {};
    for (const table of tables) {
      const row = await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>();
      before[table] = Number(row!.n);
    }
    const response = await apiPost(worker, owner.cookieHeader, "/api/ask", {
      question: "كم حجزت هذا الأسبوع؟",
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { draft?: unknown };
    expect(body.draft).toBeUndefined();
    for (const table of tables) {
      const row = await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>();
      expect(Number(row!.n)).toBe(before[table]);
    }
  });

  it("a failing provider (timeout/5xx) is an honest 502 — no fabricated answer, no write", async () => {
    const owner = await signInAs(worker, { sub: "askp-fail", email: "askp-fail@example.test" });
    await createWorkspace(worker, owner.cookieHeader, "مشروع فشل المزود");
    askMock.failWithStatus = 503;
    const response = await apiPost(worker, owner.cookieHeader, "/api/ask", {
      question: "سؤال في زمن تعطل المزود",
    });
    expect(response.status).toBe(502);
    const body = (await response.json()) as { error: { code: string; details?: { message?: string } } };
    expect(body.error.code).toBe("ask_provider_failed");
    expect(body.error.details?.message).toContain("لم يُرسل شيء ولا تغيّر شيء");
    const db = await rawDb(worker);
    const requests = await db.prepare("SELECT COUNT(*) AS n FROM delivery_request").first<{ n: number }>();
    expect(Number(requests!.n)).toBe(0);
  });

  it("an empty provider answer is the honest «لا أعرف» — never a fabricated one", async () => {
    const owner = await signInAs(worker, { sub: "askp-empty", email: "askp-empty@example.test" });
    await createWorkspace(worker, owner.cookieHeader, "مشروع الجواب الفارغ");
    askMock.nextResult = { answerText: "", citedFactIds: [] };
    const response = await apiPost(worker, owner.cookieHeader, "/api/ask", { question: "سؤال بلا جواب" });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { answer: string };
    expect(body.answer).toContain("لا أعرف");
  });
});
