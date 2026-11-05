/** @vitest-environment jsdom */

/*
 * UXR-02 (أمر UXR-W01 — F-008): «تكرار تعريف الوجهة» — العنوان الواحد
 * الواضح بلا تمهيد معماري فوقه (SOP-02). سطح NotFound ملك UXR-02 (خريطة
 * الملفات 05) — أُزيلت الـoverline («مسار غير متاح») فوق H1، وبقيت الرسالة
 * القصيرة والرجوع الآمن كما هما (عقد RET/SHELL). باقي مستهلكي النمط
 * (المالية/الإعدادات/الرئيسية...) ملك دفعاتهم الموثقة في جرد تقرير W01.
 */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NotFound from "@/pages/NotFound";

const navigate = vi.fn();
vi.mock("wouter", () => ({
  useLocation: () => ["/", navigate],
}));

describe("NotFound — UXR-02 one clear page destination (W01, F-008)", () => {
  afterEach(() => cleanup());

  it("renders a single clear heading without the architectural overline and with one safe escape", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { name: "هذه الصفحة ليست جزءًا من هذا الإصدار" })).toBeTruthy();
    expect(screen.queryByText("مسار غير متاح")).not.toBeTruthy();
    expect(screen.queryByText("ارجع إلى الرئيسية لمتابعة المسار المحلي الأساسي.")).toBeTruthy();
    const escape = screen.getByRole("button", { name: "العودة إلى الرئيسية" });
    expect(escape).toBeTruthy();
    escape.click();
    expect(navigate).toHaveBeenCalledWith("/");
  });
});
