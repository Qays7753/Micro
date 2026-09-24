/** @vitest-environment jsdom */

/*
 * R2 — عقد لوحة المفاتيح والتركيز (keyboard/focus).
 * ---------------------------------------------------------------------------
 * ١) Escape يغلق ورقة الإضافة النظيفة (مسار vaul → onOpenChange → requestClose).
 * ٢) Escape مع نموذج وسخ يطرح سؤال التخلص الهادئ — لا إغلاق صامت ولا فقد بيانات.
 * ٣) كل العناصر التفاعلية في الصفحة أزرار/روابط أصلية — التشغيل بلوحة المفاتيح
 *    حق مبني لا محسّن؛ Tab يصل إلى زر الإنشاء (FAB) ضمن دورة التركيز.
 * ٤) حلقة التركيز المرئية مرتبطة بتوكن الجسر --vf-focus (دور المعلومات V2،
 *    وللداكن إعادة ربطه الخاصة في theme-dark.css) لا بقيمة محلية (اختبار CSS).
 *    UX-001 V2 (WS-182, 2026-09-24): إعادة تأسيس مجمدة مصرح بها — كان التوكن
 *    --color-accent-text قبل توحيد دور التركيز على Information role.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";
import { QuickActionSheet } from "@/components/layout/QuickActionSheet";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

if (typeof Element !== "undefined" && !Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}

function mockSheetServices() {
  return {
    directSales: {
      record: vi.fn().mockResolvedValue({ ok: true, value: { id: "sale-1" } }),
    },
    projectFinance: {
      readPosition: vi.fn().mockResolvedValue({ ok: true, value: { recordedCashMinor: 2500 } }),
      distributeUnallocated: vi.fn().mockResolvedValue({ ok: true, value: {} }),
      listEvents: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    },
    cashContinuity: {
      overview: vi.fn().mockResolvedValue({ ok: true, value: { wallets: [] } }),
    },
    notifyDataChanged: vi.fn(),
    dataVersion: 0,
  } as unknown as ReturnType<typeof usePrototypeServices>;
}

const css = readFileSync("client/src/index.css", "utf8");

describe("R2 keyboard/focus contract", () => {
  describe("QuickActionSheet escape behavior", () => {
    afterEach(() => cleanup());

    it("Escape closes a clean menu sheet without any discard question", async () => {
      const onOpenChange = vi.fn();
      mockedUsePrototypeServices.mockReturnValue(mockSheetServices());
      render(<QuickActionSheet open onOpenChange={onOpenChange} onAction={vi.fn()} />);

      await screen.findByRole("button", { name: /سجّل بيعًا/ });
      fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
      expect(screen.queryByText(/تخلي عن المدخلات/)).toBeNull();
    });

    it("Escape with a dirty sale form asks the two-choice question — no silent loss", async () => {
      const onOpenChange = vi.fn();
      mockedUsePrototypeServices.mockReturnValue(mockSheetServices());
      render(<QuickActionSheet open onOpenChange={onOpenChange} onAction={vi.fn()} />);

      fireEvent.click(screen.getByRole("button", { name: /سجّل بيعًا/ }));
      fireEvent.change(await screen.findByLabelText(/ما الذي بعته؟/), { target: { value: "كوب قهوة" } });
      fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
      await waitFor(() => expect(screen.getByText(/تسجّله أو تتجاهله/)).toBeTruthy());
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });
  });

  describe("focus ring is token-bound, not page-local", () => {
    it("the global focus-visible outline uses the V2 focus token (Information role, dark-safe)", () => {
      const block = css.match(/button:focus-visible,\s*a:focus-visible\s*\{[^}]*\}/)?.[0] ?? "";
      /* UX-001 V2 (WS-182): global focus unified with field focus on --vf-focus. */
      expect(block).toContain("outline: 2px solid var(--vf-focus)");
      expect(block).toContain("outline-offset: 2px");
    });
  });
});
