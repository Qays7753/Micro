/**
 * Delivery mutual consent acceptance (contract 21 §3.2-3, OD10 — continuation
 * 2026-11-12): retry/holding/return after a declared undeliverable outcome
 * become effective ONLY on the other party's explicit in-app acceptance. The
 * single-party driver declaration path is closed (400), silence and rejection
 * leave a clear pending state and trigger nothing automatic, the proposer
 * never decides his own proposal, unrelated identities see nothing, and the
 * requester instructions out of `awaiting_instructions` are recorded by the
 * project owner (the contract's actor), not the driver.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiGet, apiPost, rawDb, signInAs, startWorker, type WorkerInstance } from "./harness.ts";
import { createApprovedDriver, type WorkerRefs, setupExecutionPair } from "./delivery.helpers.ts";

let worker: WorkerInstance;
let adminCookie: string;
let ownerCookie: string;
let driverCookie: string;
let otherDriverCookie: string;
let plainUserCookie: string;
let driverProfileId: string;

beforeAll(async () => {
  worker = await startWorker();
  adminCookie = (await signInAs(worker, { sub: "cn-admin", email: "cn-admin@example.test" })).cookieHeader;
  const db = await rawDb(worker);
  const adminIdentity = await db
    .prepare("SELECT id FROM network_identity WHERE email = ?")
    .bind("cn-admin@example.test")
    .first<{ id: string }>();
  await db
    .prepare(
      "INSERT INTO network_membership (identity_id, role, status, granted_by, granted_at) VALUES (?, 'admin', 'active', 'test', 1)",
    )
    .bind(adminIdentity!.id)
    .run();
  ownerCookie = (await signInAs(worker, { sub: "cn-owner", email: "cn-owner@example.test" })).cookieHeader;
  const refs: WorkerRefs = { worker, adminCookie };
  const driver = await createApprovedDriver(refs, "cn-driver@example.test", "cn-driver-sub");
  driverCookie = driver.cookie;
  driverProfileId = driver.driverProfileId;
  const other = await createApprovedDriver(refs, "cn-driver2@example.test", "cn-driver2-sub");
  otherDriverCookie = other.cookie;
  plainUserCookie = (await signInAs(worker, { sub: "cn-user", email: "cn-user@example.test" })).cookieHeader;
});

afterAll(async () => {
  await worker.close();
});

async function atUndeliverable(): Promise<string> {
  const requestId = await setupExecutionPair(worker, ownerCookie, driverCookie, driverProfileId);
  await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, { kind: "start" });
  await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, { kind: "arrive" });
  await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, {
    kind: "contact_attempt_no_answer",
  });
  const failed = await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, {
    kind: "pickup_failed",
    reason: "لا أحد في العنوان",
  });
  expect(failed.status).toBe(200);
  return requestId;
}

async function executionOf(requestId: string): Promise<{ execution: string; confirmation: string }> {
  const detail = (await (
    await apiGet(worker, ownerCookie, `/api/delivery/requests/${requestId}`)
  ).json()) as {
    execution: { execution: string; confirmation: string };
  };
  return detail.execution;
}

/** The worker error body nests reasons under `error.details`. */
async function reasonOf(response: Response): Promise<string | undefined> {
  const body = (await response.json()) as { error?: { details?: { reason?: string } } };
  return body.error?.details?.reason;
}

describe("delivery mutual consent (OD10 — §17-4 closure)", () => {
  it("the old single-party driver declaration path is closed (400 unknown kind)", async () => {
    const requestId = await atUndeliverable();
    for (const kind of ["retry_agreed", "holding_agreed", "return_agreed"]) {
      const response = await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, {
        kind,
      });
      expect(response.status).toBe(400);
    }
  });

  it("driver proposes; it stays PENDING and the state never moves (silence)", async () => {
    const requestId = await atUndeliverable();
    const propose = await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/propose-consent`, {
      kind: "retry",
      terms: { attempts: 2, priceMinor: "150" },
    });
    expect(propose.status).toBe(201);
    const proposal = (await propose.json()) as { proposal: { id: string } };
    // State unchanged after the proposal (no auto action, ever).
    const before = await executionOf(requestId);
    expect(before.execution).toBe("undeliverable_declared");
    // The requester sees the pending proposal in the shared detail.
    const detail = (await (
      await apiGet(worker, ownerCookie, `/api/delivery/requests/${requestId}`)
    ).json()) as {
      consentProposals: { id: string; kind: string; status: string }[];
      events: { axis: string; type: string }[];
    };
    expect(detail.consentProposals.some(p => p.id === proposal.proposal.id && p.status === "pending")).toBe(
      true,
    );
    expect(detail.events.some(e => e.axis === "agreement" && e.type === "consent_proposed")).toBe(true);
    // The in-app notification reached the requester (contract 19 §9).
    const notifications = (await (await apiGet(worker, ownerCookie, "/api/notifications")).json()) as {
      notifications: { type: string; targetPath: string }[];
    };
    expect(
      notifications.notifications.some(
        n => n.type === "consent_proposed" && n.targetPath === `/delivery/booking/${requestId}`,
      ),
    ).toBe(true);
    // Still pending a moment later — silence changes nothing.
    const after = await executionOf(requestId);
    expect(after.execution).toBe("undeliverable_declared");
    return proposal.proposal.id;
  });

  it("the proposer can never decide his own proposal (negative authorization)", async () => {
    const requestId = await atUndeliverable();
    const propose = await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/propose-consent`, {
      kind: "holding",
      terms: { durationText: "ليلة واحدة" },
    });
    const { proposal } = (await propose.json()) as { proposal: { id: string } };
    const driverDecides = await apiPost(
      worker,
      driverCookie,
      `/api/delivery/requests/${requestId}/consent/decide`,
      {
        proposalId: proposal.id,
        decision: "accept",
      },
    );
    expect(driverDecides.status).toBe(403);
    expect(await reasonOf(driverDecides)).toBe("other_party_decision_required");
    // Unrelated identities see nothing at all (404 detail, 404 decide).
    const outsiderDetail = await apiGet(worker, plainUserCookie, `/api/delivery/requests/${requestId}`);
    expect(outsiderDetail.status).toBe(404);
    const outsiderDecide = await apiPost(
      worker,
      plainUserCookie,
      `/api/delivery/requests/${requestId}/consent/decide`,
      { proposalId: proposal.id, decision: "accept" },
    );
    expect(outsiderDecide.status).toBe(404);
    const otherDriverDecide = await apiPost(
      worker,
      otherDriverCookie,
      `/api/delivery/requests/${requestId}/consent/decide`,
      { proposalId: proposal.id, decision: "accept" },
    );
    expect(otherDriverDecide.status).toBe(404);
    // Still pending after all the denied attempts.
    const state = await executionOf(requestId);
    expect(state.execution).toBe("undeliverable_declared");
    return proposal.id;
  });

  it("requester rejection leaves everything unchanged and explicit", async () => {
    const requestId = await atUndeliverable();
    const propose = await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/propose-consent`, {
      kind: "return",
      terms: { destination: "requester", costMinor: "200" },
    });
    const { proposal } = (await propose.json()) as { proposal: { id: string } };
    const reject = await apiPost(worker, ownerCookie, `/api/delivery/requests/${requestId}/consent/decide`, {
      proposalId: proposal.id,
      decision: "reject",
      note: "سنرتب الأمر بأنفسنا",
    });
    expect(reject.status).toBe(200);
    const state = await executionOf(requestId);
    expect(state.execution).toBe("undeliverable_declared");
    const detail = (await (
      await apiGet(worker, ownerCookie, `/api/delivery/requests/${requestId}`)
    ).json()) as {
      consentProposals: { id: string; status: string }[];
      events: { axis: string; type: string }[];
    };
    expect(detail.consentProposals.find(p => p.id === proposal.id)?.status).toBe("rejected");
    expect(detail.events.some(e => e.axis === "agreement" && e.type === "consent_rejected")).toBe(true);
    // A decided proposal cannot be decided again.
    const again = await apiPost(worker, ownerCookie, `/api/delivery/requests/${requestId}/consent/decide`, {
      proposalId: proposal.id,
      decision: "accept",
    });
    expect(again.status).toBe(409);
  });

  it("requester acceptance applies the transition exactly once, with actor and history", async () => {
    const requestId = await atUndeliverable();
    const propose = await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/propose-consent`, {
      kind: "retry",
      terms: { attempts: 1, priceMinor: "100" },
    });
    const { proposal } = (await propose.json()) as { proposal: { id: string } };
    const accept = await apiPost(worker, ownerCookie, `/api/delivery/requests/${requestId}/consent/decide`, {
      proposalId: proposal.id,
      decision: "accept",
    });
    expect(accept.status).toBe(200);
    const body = (await accept.json()) as { execution: string | null };
    expect(body.execution).toBe("retry_scheduled");
    const detail = (await (
      await apiGet(worker, ownerCookie, `/api/delivery/requests/${requestId}`)
    ).json()) as {
      execution: { execution: string };
      events: { axis: string; type: string }[];
      consentProposals: { id: string; status: string; appliedExecution: string | null }[];
    };
    expect(detail.execution.execution).toBe("retry_scheduled");
    expect(detail.events.some(e => e.axis === "execution" && e.type === "retry_agreed")).toBe(true);
    expect(detail.events.some(e => e.axis === "agreement" && e.type === "consent_accepted")).toBe(true);
    expect(detail.consentProposals.find(p => p.id === proposal.id)?.appliedExecution).toBe("retry_scheduled");
    // Double decide is refused honestly.
    const again = await apiPost(worker, ownerCookie, `/api/delivery/requests/${requestId}/consent/decide`, {
      proposalId: proposal.id,
      decision: "accept",
    });
    expect(again.status).toBe(409);
  });

  it("one pending proposal at a time; withdrawal is explicit and changes nothing", async () => {
    const requestId = await atUndeliverable();
    const first = await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/propose-consent`, {
      kind: "holding",
      terms: { durationText: "يوم" },
    });
    expect(first.status).toBe(201);
    const second = await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/propose-consent`, {
      kind: "return",
      terms: { destination: "requester" },
    });
    expect(second.status).toBe(409);
    expect(await reasonOf(second)).toBe("consent_proposal_already_pending");
    const { proposal } = (await first.json()) as { proposal: { id: string } };
    // The requester cannot withdraw the driver's proposal.
    const ownerWithdraw = await apiPost(
      worker,
      ownerCookie,
      `/api/driver/requests/${requestId}/propose-consent/withdraw`,
      { proposalId: proposal.id },
    );
    expect(ownerWithdraw.status).toBe(404);
    const withdraw = await apiPost(
      worker,
      driverCookie,
      `/api/driver/requests/${requestId}/propose-consent/withdraw`,
      { proposalId: proposal.id },
    );
    expect(withdraw.status).toBe(200);
    const state = await executionOf(requestId);
    expect(state.execution).toBe("undeliverable_declared");
    // A fresh proposal is allowed after the withdrawal.
    const third = await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/propose-consent`, {
      kind: "return",
      terms: { destination: "original_supplier", costMinor: "0" },
    });
    expect(third.status).toBe(201);
  });

  it("terms are validated per kind (honest 400s, never silent)", async () => {
    const requestId = await atUndeliverable();
    const badAttempts = await apiPost(
      worker,
      driverCookie,
      `/api/driver/requests/${requestId}/propose-consent`,
      {
        kind: "retry",
        terms: { attempts: 0 },
      },
    );
    expect(badAttempts.status).toBe(400);
    const badHolding = await apiPost(
      worker,
      driverCookie,
      `/api/driver/requests/${requestId}/propose-consent`,
      {
        kind: "holding",
        terms: { durationText: "ي" },
      },
    );
    expect(badHolding.status).toBe(400);
    const badReturn = await apiPost(
      worker,
      driverCookie,
      `/api/driver/requests/${requestId}/propose-consent`,
      {
        kind: "return",
        terms: { destination: "somewhere_else" },
      },
    );
    expect(badReturn.status).toBe(400);
    const badKind = await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/propose-consent`, {
      kind: "teleport",
      terms: {},
    });
    expect(badKind.status).toBe(400);
    // Proposing from a non-undeliverable state is refused.
    const freshId = await setupExecutionPair(worker, ownerCookie, driverCookie, driverProfileId);
    const wrongState = await apiPost(
      worker,
      driverCookie,
      `/api/driver/requests/${freshId}/propose-consent`,
      {
        kind: "retry",
        terms: { attempts: 1 },
      },
    );
    expect(wrongState.status).toBe(409);
  });

  it("accepted holding then later moves stay driver declarations on the agreed path", async () => {
    const requestId = await atUndeliverable();
    const propose = await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/propose-consent`, {
      kind: "holding",
      terms: { durationText: "حتى الغد", place: "مستودع السائق" },
    });
    const { proposal } = (await propose.json()) as { proposal: { id: string } };
    await apiPost(worker, ownerCookie, `/api/delivery/requests/${requestId}/consent/decide`, {
      proposalId: proposal.id,
      decision: "accept",
    });
    const state = await executionOf(requestId);
    expect(state.execution).toBe("holding_agreed");
    // The follow-up resumption is a legal driver declaration from the agreed state.
    const resumed = await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, {
      kind: "transit_resumed",
    });
    expect(resumed.status).toBe(200);
    const after = await executionOf(requestId);
    expect(after.execution).toBe("in_transit");
  });
});

describe("requester instructions out of awaiting_instructions (contract 21 §3.2-3 actor)", () => {
  async function atAwaitingInstructions(): Promise<string> {
    const requestId = await setupExecutionPair(worker, ownerCookie, driverCookie, driverProfileId);
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, { kind: "start" });
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, { kind: "arrive" });
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, {
      kind: "pickup_declared",
    });
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, {
      kind: "transit_started",
    });
    const waiting = await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, {
      kind: "awaiting_instructions",
    });
    expect(waiting.status).toBe(200);
    return requestId;
  }

  it("the driver can no longer record instructions (single-party path closed)", async () => {
    const requestId = await atAwaitingInstructions();
    // The old driver-declared instruction kinds are gone from the driver API.
    for (const kind of ["instructions_transit", "instructions_return", "instructions_holding"]) {
      const response = await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, {
        kind,
      });
      expect(response.status).toBe(400);
    }
    // And the requester instructions endpoint refuses the driver.
    const driverAttempts = await apiPost(
      worker,
      driverCookie,
      `/api/delivery/requests/${requestId}/instructions`,
      {
        instruction: "transit",
      },
    );
    expect(driverAttempts.status).toBe(404);
    return requestId;
  });

  it("the requester records instructions; each instruction lands on its legal state", async () => {
    const transitRequest = await atAwaitingInstructions();
    const transit = await apiPost(
      worker,
      ownerCookie,
      `/api/delivery/requests/${transitRequest}/instructions`,
      {
        instruction: "transit",
        note: "تابع بعد ساعة",
      },
    );
    expect(transit.status).toBe(200);
    expect(((await transit.json()) as { execution: string }).execution).toBe("in_transit");

    const holdingRequest = await atAwaitingInstructions();
    const holding = await apiPost(
      worker,
      ownerCookie,
      `/api/delivery/requests/${holdingRequest}/instructions`,
      {
        instruction: "holding",
      },
    );
    expect(holding.status).toBe(200);
    expect(((await holding.json()) as { execution: string }).execution).toBe("holding_agreed");

    const returnRequest = await atAwaitingInstructions();
    const returning = await apiPost(
      worker,
      ownerCookie,
      `/api/delivery/requests/${returnRequest}/instructions`,
      {
        instruction: "return",
      },
    );
    expect(returning.status).toBe(200);
    expect(((await returning.json()) as { execution: string }).execution).toBe("returning");

    // An unrelated identity cannot send instructions.
    const outsider = await apiPost(
      worker,
      plainUserCookie,
      `/api/delivery/requests/${returnRequest}/instructions`,
      {
        instruction: "return",
      },
    );
    expect(outsider.status).toBe(404);
    // An invalid instruction VALUE on a still-waiting booking is an honest 400.
    const invalidCase = await atAwaitingInstructions();
    const invalid = await apiPost(worker, ownerCookie, `/api/delivery/requests/${invalidCase}/instructions`, {
      instruction: "teleport",
    });
    expect(invalid.status).toBe(400);
  });
});
