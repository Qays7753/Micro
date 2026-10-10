/** R7 / R6-F17-P11 (2026-10-10): عقد سطح استعلام البيان — الفصل ونصوص
 * الرسائل وحدود الأسبوع وضلع المقارنة. */
import { describe, expect, it } from "vitest";
import { readStatementBlock, resolveComparisonSideB, weekBounds } from "./statementViewModel";
import type { StatementService } from "./statementService";

describe("R7/P11 — قراءة الكشف", () => {
  it("النجاح والفشل بنفس الفصل ونص الرسالة", async () => {
    const good = await readStatementBlock(
      {
        statement: {
          read: async () => ({ ok: true, value: { marker: "reading" } }),
        } as unknown as StatementService,
      },
      "2026-09-01",
      "2026-09-30",
    );
    expect(good.phase).toBe("ready");
    const bad = await readStatementBlock(
      {
        statement: {
          read: async () => ({ ok: false, message: "رسالة الفشل" }),
        } as unknown as StatementService,
      },
      "2026-09-01",
      "2026-09-30",
    );
    expect(bad).toEqual({ phase: "error", message: "رسالة الفشل" });
  });
});

describe("R7/P11 — ضلع المقارنة", () => {
  it("«السابقة» تمر بالاختصار الكنوني؛ «المخصص» بنطاق المستخدم كما هو", () => {
    const previous = resolveComparisonSideB(
      "previous",
      { from: "2026-09-01", to: "2026-09-30" },
      { from: "x", to: "y" },
    );
    expect(previous.from).not.toBe("x");
    const custom = resolveComparisonSideB(
      "custom",
      { from: "2026-09-01", to: "2026-09-30" },
      { from: "2026-08-01", to: "2026-08-31" },
    );
    expect(custom).toEqual({ from: "2026-08-01", to: "2026-08-31" });
  });
});

describe("R7/P11 — حدود الأسبوع (الأحد→السبت)", () => {
  it("أسبوع يبدأ الأحد وينتهي السبت بغض النظر عن يوم الدخول", () => {
    expect(weekBounds("2026-09-20")).toEqual({ from: "2026-09-20", to: "2026-09-26" });
    expect(weekBounds("2026-09-23")).toEqual({ from: "2026-09-20", to: "2026-09-26" });
    expect(weekBounds("2026-09-26")).toEqual({ from: "2026-09-20", to: "2026-09-26" });
    expect(weekBounds("2026-09-27")).toEqual({ from: "2026-09-27", to: "2026-10-03" });
  });
});
