/**
 * S13 (CAL-C — أمر 2158b0fc §6): إثبات حالة جلسة اقتراح موعد التقويم —
 * تسجيل وقراءة بلا استهلاك، واستهلاك مرة واحدة عند خطوة الاتفاق، وإزالة
 * صريحة، ورفض التاريخ الطالح، وعزل المسودات — والأهم: صفر وصول لمفاتيح
 * تخزين المتصفح إطلاقًا (حارس R11 ARCH-010 فاشل-المغلق؛ هذا الاختبار
 * انحدار دائم يمنع عودة أي sessionStorage/localStorage إلى هذه الوحدة).
 */
/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearScheduleProposal,
  consumeScheduleProposal,
  readScheduleProposal,
  storeScheduleProposal,
} from "./scheduleProposal";

/* مفاتيح جلسة فريدة لكل اختبار — حالة الوحدة مشتركة داخل الملف. */
afterEach(() => {
  vi.restoreAllMocks();
});

describe("S13 — جلسة اقتراح موعد التقويم (CAL-C)", () => {
  it("تسجيل ثم قراءة بلا استهلاك — القراءة المتكررة تعيد الاقتراح نفسه", () => {
    storeScheduleProposal("draft-read", "2026-11-20");
    expect(readScheduleProposal("draft-read")).toBe("2026-11-20");
    expect(readScheduleProposal("draft-read")).toBe("2026-11-20");
  });

  it("استهلاك مرة واحدة عند خطوة الاتفاق — النداء الثاني يعود فارغًا", () => {
    storeScheduleProposal("draft-consume", "2026-11-21");
    expect(consumeScheduleProposal("draft-consume")).toBe("2026-11-21");
    expect(consumeScheduleProposal("draft-consume")).toBeNull();
    expect(readScheduleProposal("draft-consume")).toBeNull();
  });

  it("إزالة صريحة من محرر المسودة — قرار المالك يسقط الاقتراح كليًا", () => {
    storeScheduleProposal("draft-clear", "2026-11-22");
    clearScheduleProposal("draft-clear");
    expect(readScheduleProposal("draft-clear")).toBeNull();
    expect(consumeScheduleProposal("draft-clear")).toBeNull();
  });

  it("التاريخ الطالح يُرفض عند التسجيل — لا قيمة تُخزن أصلًا", () => {
    storeScheduleProposal("draft-invalid", "not-a-date");
    storeScheduleProposal("draft-invalid", "2026-13-45");
    storeScheduleProposal("draft-invalid", "");
    expect(readScheduleProposal("draft-invalid")).toBeNull();
  });

  it("المسودات معزولة — اقتراح مسودة لا يسرب لمسودة أخرى", () => {
    storeScheduleProposal("draft-a", "2026-11-23");
    storeScheduleProposal("draft-b", "2026-11-24");
    expect(readScheduleProposal("draft-a")).toBe("2026-11-23");
    expect(readScheduleProposal("draft-b")).toBe("2026-11-24");
    clearScheduleProposal("draft-a");
    expect(readScheduleProposal("draft-b")).toBe("2026-11-24");
    expect(readScheduleProposal("draft-a")).toBeNull();
  });

  it("صفر وصول لمفاتيح تخزين المتصفح — الجلسة داخلية لا مخزن متصفح (R11 ARCH-010)", () => {
    const sessionSet = vi.spyOn(window.sessionStorage, "setItem");
    const sessionGet = vi.spyOn(window.sessionStorage, "getItem");
    const sessionRemove = vi.spyOn(window.sessionStorage, "removeItem");
    const localSet = vi.spyOn(window.localStorage, "setItem");
    const localGet = vi.spyOn(window.localStorage, "getItem");
    storeScheduleProposal("draft-nostorage", "2026-11-25");
    expect(readScheduleProposal("draft-nostorage")).toBe("2026-11-25");
    expect(consumeScheduleProposal("draft-nostorage")).toBe("2026-11-25");
    clearScheduleProposal("draft-nostorage");
    expect(sessionSet).not.toHaveBeenCalled();
    expect(sessionGet).not.toHaveBeenCalled();
    expect(sessionRemove).not.toHaveBeenCalled();
    expect(localSet).not.toHaveBeenCalled();
    expect(localGet).not.toHaveBeenCalled();
  });
});
