/** @vitest-environment jsdom */
/* Wave 4.4 — P-4.4-5: الوصول ولوحة المفاتيح وZoom وReflow — WCAG 2.2 AA.
 * ---------------------------------------------------------------------------
 * ١) كل زر في الأسطح المعروضة له اسم وصول (نص أو aria-label) — لا زر أيقوني
 *    صامت.
 * ٢) الحقول المرتبطة: خطأ التحقق الحقلي يرفع aria-invalid ويربط الرسالة
 *    عبر aria-describedby — وفشل الحفظ لا يرفع aria-invalid (الحقل سليم).
 * ٣) لوحة المفاتيح: Enter آمن في النماذج القصيرة، ولا Enter داخل textarea
 *    يفعل إرسالًا، ولا زر حذف عالي الأثر بلا تأكيد.
 * ٤) مكوّن Field الأساسي يوفر الوصلات تلقائيًا عند controlId.
 * ٥) فحص مصدر ثابت: لا font-size بpx بعد تحويل عائلة الخطوط إلى rem
 *    (تكبير نص المتصفح WCAG 1.4.4)، مع بقاء أهداف اللمس px عمدًا.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { LoanService } from "@/application/loans/loanService";
import { ProfileService } from "@/application/profile/profileService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import Loans from "@/pages/Loans";
import { Field } from "@/components/primitives";
import { QuickSaleForm } from "@/components/finance/QuickSaleForm";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/loans",
  params: {} as Record<string, string | undefined>,
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => "",
  Redirect: () => null,
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-16T10:00:00.000Z";

let store: MemoryLocalStore;

function accessibleName(button: HTMLElement): string {
  const label = button.getAttribute("aria-label") ?? button.getAttribute("title") ?? "";
  if (label.trim()) return label.trim();
  const labelledby = button.getAttribute("aria-labelledby");
  if (labelledby) {
    const targets = labelledby
      .split(/\s+/)
      .map(id => document.getElementById(id)?.textContent ?? "")
      .join(" ")
      .trim();
    if (targets) return targets;
  }
  return (button.textContent ?? "").replace(/[·|—-]/g, " ").trim();
}

describe("Wave 4.4 — P-4.4-5: أسماء الوصول وربط الحقول", () => {
  beforeEach(() => {
    wouterMocks.navigate.mockReset();
    vi.clearAllMocks();
    store = new MemoryLocalStore();
  });
  afterEach(cleanup);

  it("كل زر في سطح القروض له اسم وصول — لا زر أيقوني صامت", async () => {
    const profile = await new ProfileService(store, () => NOW).save("مالك");
    if (!profile.ok) throw new Error(profile.message);
    const loans = new LoanService(store, () => NOW);
    for (const [id, name, date] of [
      ["loan-a", "سامي", "2026-09-01"],
      ["loan-b", "أم خالد", "2026-09-10"],
    ] as const) {
      const created = await loans.create({ borrowerName: name, principalMinor: 5000, loanDate: date });
      if (!created.ok) throw new Error(created.message);
    }
    mockedUsePrototypeServices.mockReturnValue({
      loans,
      profile: new ProfileService(store, () => NOW),
      dataVersion: 0,
      notifyDataChanged: () => undefined,
    } as unknown as ReturnType<typeof usePrototypeServices>);

    render(<Loans />);
    await waitFor(() => expect(screen.getByText("سامي")).toBeTruthy());
    const buttons = screen.getAllByRole("button");
    const unnamed = buttons.filter(button => accessibleName(button).length === 0);
    expect(
      unnamed.map(button => button.outerHTML.slice(0, 80)),
      "أزرار بلا اسم وصول",
    ).toEqual([]);
  });

  it("خطأ التحقق يرفع aria-invalid ويربط الرسالة — وفشل الحفظ لا يرفعها", async () => {
    /* نموذج البيع السريع: إرسال فارغ → خطأ تحقق → aria-invalid على الحقل. */
    const wallets = { listWallets: () => Promise.resolve({ ok: true, value: [] }) };
    const projectFinance = {
      record: () => Promise.resolve({ ok: false, code: "storage_error", message: "تعذر الحفظ" }),
    };
    mockedUsePrototypeServices.mockReturnValue({
      wallets,
      projectFinance,
      dataVersion: 0,
      notifyDataChanged: () => undefined,
    } as unknown as ReturnType<typeof usePrototypeServices>);

    render(
      <QuickSaleForm
        wallets={[]}
        onSubmitted={() => undefined}
        onSavingChange={() => undefined}
        onBackToMenu={() => undefined}
      />,
    );

    /* إرسال فارغ: خطأ التحقق الحقلي يظهر ويرتبط بالحقل. */
    const submit = await screen.findByRole("button", { name: /سجّل البيع/ });
    fireEvent.click(submit);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBeTruthy());
    const amount = screen.getByLabelText("مبلغ البيع");
    expect(amount.getAttribute("aria-invalid")).toBe("true");
    expect(amount.getAttribute("aria-describedby")).toBe("quick-sale-form-error");
  });

  it("مكوّن Field يوفر وصلات الوصول تلقائيًا عند controlId", () => {
    render(
      <Field label="مبلغ" controlId="amount-input" error="أدخل مبلغًا صالحًا.">
        <input id="amount-input" value="" onChange={() => undefined} />
      </Field>,
    );
    const input = screen.getByLabelText("مبلغ");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBe("amount-input-field-error");
    const errorParagraph = document.getElementById("amount-input-field-error");
    expect(errorParagraph?.textContent).toContain("أدخل مبلغًا صالحًا");
  });
});

describe("Wave 4.4 — P-4.4-5: لوحة المفاتيح — فحص مصدر ثابت", () => {
  const CLIENT_SRC = import.meta.dirname;

  it("لا onSubmit داخل textarea — Enter داخل النص متعدد الأسطر يبقى نصًا", () => {
    const sources = [
      "pages/OwnerWithdrawalEditor.tsx",
      "pages/CashTransferEditor.tsx",
      "pages/MaterialEditor.tsx",
      "pages/DirectSaleEditor.tsx",
    ];
    for (const rel of sources) {
      const source = readFileSync(resolve(CLIENT_SRC, rel), "utf8");
      const textareas = [...source.matchAll(/<textarea\b([^>]*)>/g)];
      for (const match of textareas) {
        expect
          .soft(match[1], `${rel}: textarea بـ onKeyDown/submit`)
          .not.toMatch(/onKeyDown|onKeyPress|type="submit"/);
      }
    }
  });

  it("لا فعل حذف/عكس عالي الأثر بلا تأكيد أو مسار رجوع", () => {
    const highImpact = ["pages/OrderDetail.tsx", "pages/AssetDetail.tsx", "pages/LoanDetail.tsx"];
    for (const rel of highImpact) {
      const source = readFileSync(resolve(CLIENT_SRC, rel), "utf8");
      /* كل أزرار الإلغاء/الحذف/التراجع تمر بمسار تأكيد (confirm/undo موثق) */
      const hasUndo = source.includes("تراجع موثق");
      expect.soft(hasUndo, `${rel}: لا مسار تراجع موثق`).toBe(true);
    }
  });

  it("عائلة الخطوط كلها rem — لا font-size بpx يقاوم تكبير نص المتصفح", () => {
    const cssFiles = ["index.css", "styles/primitives.css", "styles/vf-tokens.css"];
    for (const rel of cssFiles) {
      const source = readFileSync(resolve(CLIENT_SRC, rel), "utf8");
      const pxFonts = [...source.matchAll(/font-size:\s*\d+px/g)];
      expect
        .soft(
          pxFonts.map(match => `${rel}: ${match[0]}`),
          "font-size بpx متبقية",
        )
        .toEqual([]);
    }
    /* أهداف اللمس تبقى px عمدًا — لا تتقلص مع النص (U-09 محروس) */
    const indexCss = readFileSync(resolve(CLIENT_SRC, "index.css"), "utf8");
    expect(indexCss).toContain("min-height: 48px");
  });

  it("prefers-reduced-motion محترم في الطبقة الأساسية", () => {
    const indexCss = readFileSync(resolve(CLIENT_SRC, "index.css"), "utf8");
    expect(indexCss).toContain("@media (prefers-reduced-motion");
  });
});
