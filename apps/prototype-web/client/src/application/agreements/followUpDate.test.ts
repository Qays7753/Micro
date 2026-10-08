import { describe, expect, it } from "vitest";
import { classifyFollowUpDate, formatLocalDate } from "./followUpDate";
/* R2 (M-11/D13، 2026-10-08): إعادة تصدير localDateInAmman من باب الاتفاقات
 * أُسقطت بعد هجرة مستهلكها الأخير — الاختبار يستورد الدالة المجالية من
 * برميلها مباشرة. */
import { localDateInAmman } from "@micro-domain/shared/index.js";

describe("follow-up local dates", () => {
  const today = "2026-08-24";

  it("keeps no date distinct from invalid, overdue, today, and upcoming", () => {
    expect(classifyFollowUpDate(null, today)).toBe("none");
    expect(classifyFollowUpDate("2026-08-23", today)).toBe("overdue");
    expect(classifyFollowUpDate(today, today)).toBe("today");
    expect(classifyFollowUpDate("2026-08-25", today)).toBe("upcoming");
    expect(classifyFollowUpDate("2026-02-30", today)).toBe("invalid");
  });

  it("derives the local Amman day from an instant rather than the UTC date string", () => {
    expect(localDateInAmman("2026-08-23T22:30:00.000Z")).toBe("2026-08-24");
  });

  it("formats a valid stored ISO date for display without changing the stored value", () => {
    expect(formatLocalDate("2026-08-24")).toBe("24/08/2026");
    expect(formatLocalDate(null)).toBeNull();
    expect(formatLocalDate("2026-02-30")).toBeNull();
  });
});
