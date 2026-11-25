/** @vitest-environment jsdom */

/* M1.3 (حدود النطاق / IMPACT S3 — أمر تنفيذ المرحلة ١، الموجة A): إزالة
 * المسودة المالية من «اسأل Micro» — الاختبار الدخاني على السلوك من جهة
 * الواجهة: اقتراح الخادم لمسودة «حدث مالي» لا يُنشئ أي سطح كتابة — لا
 * بطاقة مسودة ولا زر تسجيل ولا أي نداء إلى عائلة /api/manage/records.
 * مسح المصدر المقابل للقبول الحرفي في الملف الملاصق
 * AskMicro.noFinancialDraft.scan.test.ts. */
import React from "react";
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

/* مسودة حدث مالية كما يقترحها الخادم — البنية نفسها التي كانت تُعرض
 * بطاقتها قبل القطع؛ تبقى الإجابة ومصادرها، ويُهمل اقتراح المسودة. */
const FINANCIAL_DRAFT = {
  kind: "manage-financial-event" as const,
  title: "مسودة حدث مالي",
  fields: [
    {
      name: "eventType",
      label: "نوع الحدث المالي",
      type: "enum" as const,
      required: true,
      value: null,
      options: ["operating_expense_cash"],
    },
    { name: "amountJod", label: "المبلغ (دينار)", type: "decimal" as const, required: true, value: null },
    { name: "occurredOn", label: "تاريخ الوقوع", type: "date" as const, required: true, value: null },
    { name: "note", label: "البيان", type: "text" as const, required: true, value: null },
    { name: "counterparty", label: "الطرف", type: "text" as const, required: false, value: null },
  ],
};

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

beforeEach(() => {
  posted = [];
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
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

describe("M1.3 (IMPACT S3) — لا سطح مسودة مالية في «اسأل Micro»", () => {
  it("اقتراح مسودة حدث مالي لا يعرض أي بطاقة ولا يكتب شيئًا إلى عائلة السجلات المالية", async () => {
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
        return jsonResponse({ answer: "جاهز لتسجيل الحدث.", sources: [], draft: FINANCIAL_DRAFT });
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
    /* الإجابة تصل وتُعرض — اقتراح المسودة يُهمل ولا يُعرض منه شيء. */
    const answer = await screen.findByTestId("ask-answer");
    expect(answer.textContent).toContain("جاهز لتسجيل الحدث.");
    await waitFor(() => expect(screen.queryByTestId("ask-draft-card")).toBeNull());
    expect(screen.queryByTestId("ask-draft-saved")).toBeNull();
    expect(screen.queryByRole("button", { name: /تسجيل الحدث/ })).toBeNull();
    expect(posted.filter(call => call.path.startsWith("/api/manage/records/"))).toHaveLength(0);
  });
});
