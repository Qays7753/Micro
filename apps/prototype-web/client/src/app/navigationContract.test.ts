/** عقد التنقل: فحص التحليل الدفاعي، الوصلات العميقة، والمصدر/الرجوع. */
import { describe, expect, it } from "vitest";
import {
  appendQueryParams,
  canonicalReturnFor,
  isSafeInternalPath,
  parseDeepLink,
  resolveReturnPath,
  withFrom,
} from "./navigationContract";

describe("parseDeepLink", () => {
  it("يقرأ المعاملات المعروفة كما هي", () => {
    const params = parseDeepLink(
      "?focus=capacity&from=/orders&event=evt_12&mode=cover&layer=events&to=/cash&purchase=pur_9&material=mat_3",
    );
    expect(params).toEqual({
      focus: "capacity",
      layer: "events",
      mode: "cover",
      event: "evt_12",
      from: "/orders",
      to: "/cash",
      purchase: "pur_9",
      material: "mat_3",
    });
  });
  it("يهمل القيم المجهولة والمشوهة بلا انفجار", () => {
    const params = parseDeepLink("?focus=evil-focus&layer=<script>&mode=side&from=javascript:alert(1)&event=bad id");
    expect(params.focus).toBeNull();
    expect(params.layer).toBeNull();
    expect(params.mode).toBeNull();
    expect(params.from).toBeNull();
    expect(params.event).toBeNull();
    expect(params.purchase).toBeNull();
    expect(params.material).toBeNull();
  });
  it("يقبل null أو سلسلة فارغة أو معطوبة", () => {
    expect(parseDeepLink(null).focus).toBeNull();
    expect(parseDeepLink("").to).toBeNull();
    expect(parseDeepLink("??not-a-query").event).toBeNull();
  });
  it("يرفض معرّف حدث بطول أو محارف غير آمنة", () => {
    expect(parseDeepLink("?event=" + "a".repeat(65)).event).toBeNull();
    expect(parseDeepLink("?event=has space").event).toBeNull();
  });
  it("يرفض مصدرًا خارجيًا أو مزدوج الشرطة ويقبل مسارًا داخليًا باستعلامه", () => {
    expect(parseDeepLink("?from=//evil.com").from).toBeNull();
    expect(parseDeepLink("?from=/finance?event=1").from).toBe("/finance?event=1");
  });
});

describe("appendQueryParams / withFrom", () => {
  it("يحفظ الاستعلام القائم ولا يكرر المعامل نفسه", () => {
    expect(appendQueryParams("/a?x=1", { y: "2" })).toBe("/a?x=1&y=2");
    expect(appendQueryParams("/a?x=1", { x: "1" })).toBe("/a?x=1");
    expect(appendQueryParams("/a", { x: null })).toBe("/a");
  });
  it("withFrom يضيف المصدر لمسار داخلي فقط", () => {
    expect(withFrom("/orders/1", "/")).toBe("/orders/1?from=%2F");
    expect(withFrom("/orders/1", "http://evil.com")).toBe("/orders/1");
  });
});

describe("resolveReturnPath", () => {
  it("يعود للمصدر الصالح عند وجوده", () => {
    expect(resolveReturnPath("?from=/orders", "/")).toBe("/orders");
  });
  it("يسقط للبديل القانوني عند غياب المصدر أو فساده", () => {
    expect(resolveReturnPath(null, "/orders")).toBe("/orders");
    expect(resolveReturnPath("?from=javascript:x", "/cash")).toBe("/cash");
  });
  it("يهمل مصدرًا يساوي المسار الحالي (لا دوران)", () => {
    expect(resolveReturnPath("?from=/orders/1", "/orders", "/orders/1")).toBe("/orders");
  });
});

describe("canonicalReturnFor", () => {
  it("يحل البدائل القانونية المعروفة", () => {
    expect(canonicalReturnFor("/orders/abc")).toBe("/orders");
    expect(canonicalReturnFor("/orders/draft/abc")).toBe("/orders");
    expect(canonicalReturnFor("/direct-sales/abc")).toBe("/orders");
    expect(canonicalReturnFor("/schedule/abc")).toBe("/schedule");
    expect(canonicalReturnFor("/finance/new/operating_expense_cash")).toBe("/finance");
    expect(canonicalReturnFor("/cash/wallet/abc/adjust")).toBe("/cash");
    expect(canonicalReturnFor("/inventory/movement/consume")).toBe("/inventory");
    expect(canonicalReturnFor("/suppliers/purchase/abc")).toBe("/suppliers");
    expect(canonicalReturnFor("/cash/count")).toBe("/cash");
    expect(canonicalReturnFor("/finance/withdraw")).toBe("/finance");
  });
  it("المسار المجهول يعود للرئيسية بأمان", () => {
    expect(canonicalReturnFor("/unknown-path")).toBe("/");
  });
});

describe("isSafeInternalPath", () => {
  it("يقبل المسارات الداخلية العادية", () => {
    expect(isSafeInternalPath("/")).toBe(true);
    expect(isSafeInternalPath("/orders/draft/abc?x=1")).toBe(true);
  });
  it("يرفض الخارجي والمعطوب", () => {
    expect(isSafeInternalPath("http://x.com")).toBe(false);
    expect(isSafeInternalPath("//x.com")).toBe(false);
    expect(isSafeInternalPath("/has space")).toBe(false);
    expect(isSafeInternalPath('"/injected"')).toBe(false);
  });
});
