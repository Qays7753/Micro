/** عقد التنقل: فحص التحليل الدفاعي، الوصلات العميقة، ووجهة الرجوع.
 * EXE-016 (الموجة ٣ — NAV-003): `returnTo` هو الإنتاج القانوني لوجهة الرجوع
 * (مسار داخلي فقط — لا Open Redirect)، و`from` القديم يُقرأ توافقًا لا إنتاجًا،
 * والمعامل العام `to` تقاعد فلا يُقرأ ولا يُنتج، وقيم `export`/`today`/
 * `priority` الميتة حُذفت من المعجم. */
import { describe, expect, it } from "vitest";
import {
  appendQueryParams,
  canonicalReturnFor,
  isSafeInternalPath,
  parseDeepLink,
  referrerPath,
  resolveReturnPath,
  withReturnTo,
} from "./navigationContract";

describe("parseDeepLink", () => {
  it("يقرأ المعاملات المعروفة كما هي", () => {
    const params = parseDeepLink(
      "?focus=capacity&returnTo=/orders&event=evt_12&mode=cover&layer=events&purchase=pur_9&material=mat_3",
    );
    expect(params).toEqual({
      focus: "capacity",
      layer: "events",
      mode: "cover",
      event: "evt_12",
      returnTo: "/orders",
      from: null,
      purchase: "pur_9",
      material: "mat_3",
    });
  });
  it("يهمل القيم المجهولة والمشوهة بلا انفجار", () => {
    const params = parseDeepLink(
      "?focus=evil-focus&layer=<script>&mode=side&returnTo=javascript:alert(1)&event=bad id",
    );
    expect(params.focus).toBeNull();
    expect(params.layer).toBeNull();
    expect(params.mode).toBeNull();
    expect(params.returnTo).toBeNull();
    expect(params.event).toBeNull();
    expect(params.purchase).toBeNull();
    expect(params.material).toBeNull();
  });
  it("يقبل null أو سلسلة فارغة أو معطوبة", () => {
    expect(parseDeepLink(null).focus).toBeNull();
    expect(parseDeepLink("").returnTo).toBeNull();
    expect(parseDeepLink("??not-a-query").event).toBeNull();
  });
  it("يرفض معرّف حدث بطول أو محارف غير آمنة", () => {
    expect(parseDeepLink("?event=" + "a".repeat(65)).event).toBeNull();
    expect(parseDeepLink("?event=has space").event).toBeNull();
  });
  it("يرفض وجهة رجوع خارجية أو مزدوجة الشرطة ويقبل مسارًا داخليًا باستعلامه", () => {
    expect(parseDeepLink("?returnTo=//evil.com").returnTo).toBeNull();
    expect(parseDeepLink("?returnTo=/finance?event=1").returnTo).toBe("/finance?event=1");
    expect(parseDeepLink("?returnTo=https://evil.com").returnTo).toBeNull();
  });
  it("EXE-016: المعامل العام to تقاعد — لا يُقرأ أبدًا (الرابط القديم الغامض يُهمل بأمان)", () => {
    const params = parseDeepLink("?to=/cash");
    expect(params).not.toHaveProperty("to");
    /* لا يظهر كوجهة رجوع ولا كمصدر — مهما كانت قيمته. */
    expect(referrerPath("?to=/cash")).toBeNull();
    expect(resolveReturnPath("?to=/cash", "/orders")).toBe("/orders");
  });
  it("EXE-016: قيم focus الميتة (export/today/priority) حُذفت من المعجم", () => {
    expect(parseDeepLink("?focus=export").focus).toBeNull();
    expect(parseDeepLink("?focus=today").focus).toBeNull();
    expect(parseDeepLink("?focus=priority").focus).toBeNull();
    /* القيم الحية تبقى. */
    expect(parseDeepLink("?focus=capacity").focus).toBe("capacity");
    expect(parseDeepLink("?focus=recurrence").focus).toBe("recurrence");
    expect(parseDeepLink("?focus=guided-import").focus).toBe("guided-import");
  });
  it("EXE-016: from القديم يُقرأ توافقًا خلفيًا فقط — بنفس حراسة المسار الداخلي", () => {
    expect(parseDeepLink("?from=/orders").from).toBe("/orders");
    expect(parseDeepLink("?from=//evil.com").from).toBeNull();
    expect(parseDeepLink("?from=/finance?event=1").from).toBe("/finance?event=1");
  });
});

describe("appendQueryParams / withReturnTo", () => {
  it("يحفظ الاستعلام القائم ولا يكرر المعامل نفسه", () => {
    expect(appendQueryParams("/a?x=1", { y: "2" })).toBe("/a?x=1&y=2");
    expect(appendQueryParams("/a?x=1", { x: "1" })).toBe("/a?x=1");
    expect(appendQueryParams("/a", { x: null })).toBe("/a");
  });
  it("EXE-016: withReturnTo يُنتج returnTo حصرًا — لا from ولا to أبدًا", () => {
    expect(withReturnTo("/orders/1", "/")).toBe("/orders/1?returnTo=%2F");
    expect(withReturnTo("/orders/1", "http://evil.com")).toBe("/orders/1");
    expect(withReturnTo("/cash/distribute?mode=cover", "/finance")).toBe(
      "/cash/distribute?mode=cover&returnTo=%2Ffinance",
    );
    /* الإنتاج الجديد لا يديم الروابط القديمة. */
    const produced = withReturnTo("/x", "/y");
    expect(produced).not.toContain("from=");
    expect(produced).not.toContain("to=");
  });
});

describe("resolveReturnPath / referrerPath", () => {
  it("يعود لوجهة returnTo الصالحة عند وجودها", () => {
    expect(resolveReturnPath("?returnTo=/orders", "/")).toBe("/orders");
  });
  it("EXE-016: التوافق الخلفي — from القديم ما يزال يعيد لمصدره", () => {
    expect(resolveReturnPath("?from=/orders", "/")).toBe("/orders");
    expect(referrerPath("?from=/tools")).toBe("/tools");
  });
  it("EXE-016: returnTo القانوني يتقدم على from القديم عند اجتماعهما", () => {
    expect(resolveReturnPath("?returnTo=/tools&from=/orders", "/")).toBe("/tools");
    expect(referrerPath("?returnTo=/tools&from=/orders")).toBe("/tools");
  });
  it("يسقط للبديل القانوني عند غياب الوجهة أو فسادها", () => {
    expect(resolveReturnPath(null, "/orders")).toBe("/orders");
    expect(resolveReturnPath("?returnTo=javascript:x", "/cash")).toBe("/cash");
    expect(resolveReturnPath("?returnTo=//evil.com", "/cash")).toBe("/cash");
  });
  it("يهمل وجهة تساوي المسار الحالي (لا دوران)", () => {
    expect(resolveReturnPath("?returnTo=/orders/1", "/orders", "/orders/1")).toBe("/orders");
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
    /* المجموعة ٤ (تصحيح مراجعة 4-c): تفاصيل الأصل/القرض بلا مصدر تعود لقائمتها. */
    expect(canonicalReturnFor("/assets/asset-9")).toBe("/assets");
    expect(canonicalReturnFor("/loans/loan-9")).toBe("/loans");
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
