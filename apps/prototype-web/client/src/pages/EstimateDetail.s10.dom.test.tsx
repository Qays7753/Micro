/** @vitest-environment jsdom */
/* S10 (UNIT-032 — أمر b56967d8؛ استكمال R5): انحدار إحالة الرابط القديم
 * /tools/estimate/:id — الوجهة الحاسبة بهوية صالحة، والرجوع يُحفظ كما دخل:
 * ‏?returnTo القانوني أولًا ثم الوصلة التراثية ?from= بديلًا عند غيابه
 * (U032-ACD06: عودة سليمة — لا يفقد مرجع القارئ القديم وجهته). */
import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const redirectTargets: string[] = [];
const searchState = vi.hoisted(() => ({ search: "" }));
const locationState = vi.hoisted(() => ({ location: "/tools/estimate/estimate-1" }));

vi.mock("wouter", () => ({
  useLocation: () => [locationState.location, vi.fn()],
  useSearch: () => searchState.search,
  Redirect: ({ to }: { to: string }) => {
    redirectTargets.push(to);
    return null;
  },
}));

import EstimateDetail from "./EstimateDetail";

describe("S10 legacy estimate link redirect (EstimateDetail)", () => {
  afterEach(() => {
    cleanup();
    redirectTargets.length = 0;
    vi.clearAllMocks();
  });

  it("الوصلة التراثية ?from= تُكرم رجوعًا عند غياب returnTo", () => {
    searchState.search = "?from=%2Ftools";
    locationState.location = "/tools/estimate/estimate-1";
    render(<EstimateDetail />);
    expect(redirectTargets).toEqual(["/tools/calculator?estimate=estimate-1&returnTo=%2Ftools"]);
  });

  it("?returnTo القانوني يتقدم على الوصلة التراثية ?from=", () => {
    searchState.search = "?returnTo=%2Ffinance&from=%2Ftools";
    locationState.location = "/tools/estimate/estimate-1";
    render(<EstimateDetail />);
    expect(redirectTargets).toEqual(["/tools/calculator?estimate=estimate-1&returnTo=%2Ffinance"]);
  });

  it("بلا معامل رجوع صالح — الإحالة إلى الحاسبة بالهوية وحدها", () => {
    searchState.search = "";
    locationState.location = "/tools/estimate/estimate-2";
    render(<EstimateDetail />);
    expect(redirectTargets).toEqual(["/tools/calculator?estimate=estimate-2"]);
  });
});
