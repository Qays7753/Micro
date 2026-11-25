/** @vitest-environment jsdom */
/**
 * Ask Micro governance — the client-side rules (owner supplement §10.2-7,
 * 2026-11-22 — WS-251/DOC-041): the revocable consent UI, the honest daily
 * caps line, the local TEXT-ONLY history (≤21 days, no raw audio anywhere),
 * and the M1.3 cut (scope boundary / IMPACT S3, 2026-11-26): a served
 * manage-financial-event proposal renders no draft card and triggers no
 * write to the manage-records family until the path is redesigned on the
 * new system.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import AskMicro from "@/pages/AskMicro";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const locationState = { location: "/ask" as string };
vi.mock("wouter", () => ({
  useLocation: () => [locationState.location, vi.fn()],
  useSearch: () => "",
  Link: () => null,
}));

interface FetchCall {
  path: string;
  init?: RequestInit;
}

let posted: FetchCall[] = [];
const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const OWNER_SESSION = {
  authenticated: true,
  identity: { email: "owner@example.test", displayName: "المالك" },
  isAdmin: false,
  workspaces: [
    {
      id: "ws_1",
      displayName: "مشروع المالك",
      role: "owner",
      capabilities: { market: true, delivery: true },
    },
  ],
  vendor: null,
  driver: null,
};

function statusWith(governance: unknown): unknown {
  return {
    available: true,
    configured: true,
    governance,
    context: {
      principal: { displayName: "المالك", email: "owner@example.test" },
      roles: { owner: true, vendor: false, driver: false, admin: false },
      workspaces: OWNER_SESSION.workspaces,
      permittedRecordSummary: { ownerPendingDecisions: 0, vendorListings: 0, driverOpenTasks: 0 },
    },
  };
}

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

beforeEach(() => {
  posted = [];
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  /* الملحق §10.2-7-2: خدمة السجل المحلي عند منفذ التخزين — الكعب
   * مرجع ثابت لكل الاختبار (كما المفسر الحي الذي يميزن الخدمات ميد للوطاء لا يعيد التأثير مع كل رسم). */
  const askHistoryStub = {
    loadHistory: async () => [{ id: "ask-1", askedAt: 1, question: "سؤال سابق", answer: "جواب سابق" }],
    recordExchange: async (question: string, answer: string) => ({
      id: "ask-2",
      askedAt: 2,
      question,
      answer,
    }),
  };
  const servicesStub = {
    preferences: {
      load: async () => ({ ok: true, preference: { theme: "light" } }),
      save: async () => ({ ok: true }),
    },
    dataVersion: 0,
    askHistory: askHistoryStub,
  } as unknown as ReturnType<typeof usePrototypeServices>;
  mockedUsePrototypeServices.mockImplementation(() => servicesStub);
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("§10.2-7-1: the consent card (grant and immediate revoke)", () => {
  it("an ungranted consent shows the grant card; granting posts the consent and refetches the state", async () => {
    let consentState = "never";
    fetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/api/auth/session") return jsonResponse(OWNER_SESSION);
      if (path === "/api/ask/consent" && init?.method === "POST") {
        posted.push({ path, init });
        consentState = "granted";
        return jsonResponse({ ok: true, consent: "granted" }, 201);
      }
      if (path === "/api/ask/status") {
        return jsonResponse(
          statusWith({
            consent: consentState,
            daily: { questionsUsed: 0, questionCap: 20, neuronsUsed: 0, neuronsCap: 10000 },
          }),
        );
      }
      return jsonResponse({});
    });
    render(
      <ThemeProvider>
        <AskMicro />
      </ThemeProvider>,
    );
    const consentCard = await screen.findByTestId("ask-consent");
    expect(consentCard.textContent).toContain("السؤال يحتاج موافقتك أولًا");
    const grant = screen.getByRole("button", { name: "أوافق على سياسة المساعد" });
    fireEvent.click(grant);
    await waitFor(() => {
      expect(posted.some(call => call.path === "/api/ask/consent")).toBe(true);
    });
    // The refreshed state shows the granted copy with the revoke button.
    await waitFor(() => {
      expect(screen.getByTestId("ask-consent").textContent).toContain("موافقتك ممنوحة");
    });
    expect(screen.getByRole("button", { name: "سحب الموافقة (فوري)" })).toBeTruthy();
  });

  it("revoking posts the revoke endpoint and the card returns to the grant state", async () => {
    let consentState = "granted";
    fetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/api/auth/session") return jsonResponse(OWNER_SESSION);
      if (path === "/api/ask/consent/revoke" && init?.method === "POST") {
        posted.push({ path, init });
        consentState = "revoked";
        return jsonResponse({ ok: true, consent: "revoked" });
      }
      if (path === "/api/ask/status") {
        return jsonResponse(
          statusWith({
            consent: consentState,
            daily: { questionsUsed: 3, questionCap: 20, neuronsUsed: 120, neuronsCap: 10000 },
          }),
        );
      }
      return jsonResponse({});
    });
    render(
      <ThemeProvider>
        <AskMicro />
      </ThemeProvider>,
    );
    await screen.findByTestId("ask-consent");
    fireEvent.click(screen.getByRole("button", { name: "سحب الموافقة (فوري)" }));
    await waitFor(() => {
      expect(posted.some(call => call.path === "/api/ask/consent/revoke")).toBe(true);
    });
    await waitFor(() => {
      expect(screen.getByTestId("ask-consent").textContent).toContain("السؤال يحتاج موافقتك أولًا");
    });
  });
});

describe("§10.2-7-3/4: the honest daily caps line", () => {
  it("the caps render with the used/cap numbers and the no-paid-path note", async () => {
    fetchMock.mockImplementation(async (path: string) => {
      if (path === "/api/auth/session") return jsonResponse(OWNER_SESSION);
      if (path === "/api/ask/status") {
        return jsonResponse(
          statusWith({
            consent: "granted",
            daily: { questionsUsed: 7, questionCap: 20, neuronsUsed: 3200, neuronsCap: 10000 },
          }),
        );
      }
      return jsonResponse({});
    });
    render(
      <ThemeProvider>
        <AskMicro />
      </ThemeProvider>,
    );
    const caps = await screen.findByTestId("ask-caps");
    expect(caps.textContent).toContain("7 من 20");
    expect(caps.textContent).toContain("3200 من 10000");
    expect(caps.textContent).toContain("بلا مسار مدفوع");
  });
});

describe("M1.3 (IMPACT S3): the manage-financial-event proposal has no surface and no write", () => {
  const financialDraft = {
    kind: "manage-financial-event" as const,
    title: "مسودة حدث مالي",
    fields: [
      {
        name: "eventType",
        label: "نوع الحدث المالي",
        type: "enum" as const,
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
      { name: "amountJod", label: "المبلغ (دينار)", type: "decimal" as const, required: true, value: null },
      { name: "occurredOn", label: "تاريخ الوقوع", type: "date" as const, required: true, value: null },
      { name: "note", label: "البيان", type: "text" as const, required: true, value: null },
      { name: "counterparty", label: "الطرف", type: "text" as const, required: false, value: null },
    ],
  };

  it("a served financial-draft proposal renders the answer only — no card, no record write at all", async () => {
    fetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/api/auth/session") return jsonResponse(OWNER_SESSION);
      if (path === "/api/ask/status") {
        return jsonResponse(
          statusWith({
            consent: "granted",
            daily: { questionsUsed: 0, questionCap: 20, neuronsUsed: 0, neuronsCap: 10000 },
          }),
        );
      }
      if (path === "/api/ask" && init?.method === "POST") {
        posted.push({ path, init });
        return jsonResponse({ answer: "جاهز لتسجيل الحدث.", sources: [], draft: financialDraft });
      }
      if (path.startsWith("/api/manage/records/")) {
        posted.push({ path, init });
        return jsonResponse({ saved: true });
      }
      return jsonResponse({});
    });
    render(
      <ThemeProvider>
        <AskMicro />
      </ThemeProvider>,
    );
    const textarea = await screen.findByPlaceholderText("اكتب سؤالك عن أعمالك داخل سياقك…");
    fireEvent.change(textarea, { target: { value: "سجّل لي مصروف تشغيل نقدي" } });
    fireEvent.click(screen.getByRole("button", { name: "اسأل" }));
    const answer = await screen.findByTestId("ask-answer");
    expect(answer.textContent).toContain("جاهز لتسجيل الحدث.");
    await waitFor(() => expect(screen.queryByTestId("ask-draft-card")).toBeNull());
    expect(screen.queryByTestId("ask-draft-saved")).toBeNull();
    expect(screen.queryByRole("button", { name: /تسجيل الحدث/ })).toBeNull();
    /* عائلة سجلات مانج لم تُلمس إطلاقًا — السؤال وحده ذهب إلى الخادم. */
    expect(posted.filter(call => call.path.startsWith("/api/manage/records/"))).toHaveLength(0);
  });
});
