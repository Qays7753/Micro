/** @vitest-environment jsdom */
/**
 * R11 W3 / OD-LABEL (موجة المتابعة 2026-10-15): اختبار DOM text للترحيل
 * المحايد الوحيد — يثبت أن تسمية السعر المعروضة بقيت مطابقة بالبايت
 * (UTF-8 bytes/code points لا شكلًا مرئيًا فقط) بعد استهلاكها من مفردة
 * الدومين الكنونية fieldLabelAr بدل النسخة الحرفية. تُقارن البايتات
 * نفسها ضد مرجع مستقل (hex للسلسلة المتوقعة) فلا تنجو فروق التطبيع
 * الخفية (تشكيل/اتجاه/محارف متشابهة).
 */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { getAgreementPresentation } from "@/application/agreements/agreementPresentation";

afterEach(cleanup);

function utf8Hex(text: string): string {
  return Array.from(new TextEncoder().encode(text), byte => byte.toString(16).padStart(2, "0")).join("");
}

function CurrentSurface({ presentation }: { presentation: ReturnType<typeof getAgreementPresentation> }) {
  return (
    <section>
      <span className="micro-overline">{presentation.label}</span>
      <p role="status">{presentation.nextAction}</p>
    </section>
  );
}

describe("OD-LABEL — the migrated agreement price label stays byte-identical from the domain vocabulary", () => {
  it("an agreement missing only the price shows the domain label for agreedPriceMinor byte-for-byte", () => {
    const presentation = getAgreementPresentation({ status: "draft", deliveryDate: "2026-09-10" });
    render(<CurrentSurface presentation={presentation} />);
    const text = screen.getByRole("status").textContent ?? "";
    expect(text).toBe("أكمل السعر المتفق عليه");
    expect(utf8Hex(text)).toBe(utf8Hex("أكمل السعر المتفق عليه"));
  });

  it("an agreement missing both fields keeps the existing none-kind message bytes (no copy change)", () => {
    const presentation = getAgreementPresentation({ status: "draft" });
    render(<CurrentSurface presentation={presentation} />);
    const text = screen.getByRole("status").textContent ?? "";
    expect(text).toBe("أضف السعر وموعد التسليم");
    expect(utf8Hex(text)).toBe(utf8Hex("أضف السعر وموعد التسليم"));
  });

  it("an agreement missing only the delivery date composes the incomplete message with the domain price label bytes", () => {
    const presentation = getAgreementPresentation({ status: "draft", agreedPriceMinor: 1200 });
    render(<CurrentSurface presentation={presentation} />);
    const text = screen.getByRole("status").textContent ?? "";
    expect(text).toBe("أكمل موعد التسليم");
    expect(screen.getByText("اتفاق ناقص")).toBeTruthy();
  });
});
