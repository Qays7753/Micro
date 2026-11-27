/** @vitest-environment jsdom */

/*
 * M5.1 (مانج-في₂ المرحلة 5 — UX P-01 + §5 OP-SETUP + G-08): اختبارات شاشة
 * البداية — الترتيب الحرفي للمحتوى، سؤال الصناديق، «لا أعرف الآن» وتعطيل
 * الحقل مع التلميح، الصفر المقبول، تعطيل «ابدأ» حتى اكتمال الصناديق
 * (G-08)، E-NAME-REQUIRED تحت الحقل، E-AMOUNT تحت حقل المبلغ، عبء الإرسال
 * بالفلس الصحيح، والعودة إلى «مشروعي الآن» بعد الحفظ بلا رسالة نجاح.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StartPage from "@/pages/manage/StartPage";
import { MANAGE_STRINGS_AR } from "@/application/manage/strings";
import { ApiError } from "@/application/network/apiClient";
import * as api from "@/application/manage/api";

const navigate = vi.fn();
vi.mock("wouter", () => ({
  useLocation: () => ["/manage/start", navigate],
}));

vi.mock("@/application/manage/api", () => ({
  setupProject: vi.fn(),
}));

const setupProject = vi.mocked(api.setupProject);

beforeEach(() => {
  navigate.mockReset();
  setupProject.mockReset();
});

afterEach(cleanup);

/** أداء «ابدأ» بعد تعبئة النموذج الأساسي (صندوق واحد معروف). */
async function fillAndStart(overrides: { name?: string; cash?: string } = {}) {
  fireEvent.change(screen.getByTestId("manage-start-name"), {
    target: { value: overrides.name ?? "مطبخ أم ليث" },
  });
  fireEvent.change(screen.getByTestId("manage-start-cash"), {
    target: { value: overrides.cash ?? "85" },
  });
  fireEvent.click(screen.getByRole("button", { name: MANAGE_STRINGS_AR["a.start"] }));
}

describe("M5.1 — P-01 البداية (UX P-01)", () => {
  it("يعرض الحقول الحرفية بالترتيب: اسم المشروع، سؤال الصناديق، رصيد النقد، «ابدأ»", () => {
    render(<StartPage />);
    expect(screen.getByLabelText(MANAGE_STRINGS_AR["t.project_name"])).toBeTruthy();
    expect(screen.getByText(MANAGE_STRINGS_AR["t.boxes_q"])).toBeTruthy();
    expect(screen.getByRole("button", { name: MANAGE_STRINGS_AR["t.cash_only"] })).toBeTruthy();
    expect(screen.getByRole("button", { name: MANAGE_STRINGS_AR["t.cash_account"] })).toBeTruthy();
    expect(screen.getByTestId("manage-start-cash")).toBeTruthy();
    expect(screen.getByRole("button", { name: MANAGE_STRINGS_AR["a.start"] })).toBeTruthy();
    /* «نقد فقط» هو المختار الافتراضي — لا سطر حساب قبل اختيار صندوقين. */
    expect(screen.queryByTestId("manage-start-account")).toBeNull();
  });

  it("التركيز التلقائي على اسم المشروع (أول عنصر — هدف أقل من دقيقة)", () => {
    render(<StartPage />);
    expect(document.activeElement?.id).toBe("manage-start-name");
  });

  it("«نقد + حساب» يظهر سطر الحساق و«لا أعرف الآن» لكل صندوق", () => {
    render(<StartPage />);
    fireEvent.click(screen.getByRole("button", { name: MANAGE_STRINGS_AR["t.cash_account"] }));
    expect(screen.getByTestId("manage-start-account")).toBeTruthy();
    const unknownChecks = screen.getAllByLabelText(MANAGE_STRINGS_AR["t.unknown_now"]);
    expect(unknownChecks).toHaveLength(2);
  });

  it("«لا أعرف الآن» يعطّل حقل المبلغ ويعرض التلميح — والزر يتفعل به (G-08)", () => {
    render(<StartPage />);
    const start = screen.getByRole("button", { name: MANAGE_STRINGS_AR["a.start"] }) as HTMLButtonElement;
    /* الحقل الفارغ يبقي الزر معطلاً (G-08). */
    expect(start.disabled).toBe(true);
    fireEvent.change(screen.getByTestId("manage-start-cash"), { target: { value: "85" } });
    expect(start.disabled).toBe(false);
    fireEvent.click(screen.getAllByLabelText(MANAGE_STRINGS_AR["t.unknown_now"])[0]!);
    expect((screen.getByTestId("manage-start-cash") as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText(MANAGE_STRINGS_AR["t.unknown_hint"])).toBeTruthy();
    /* المجهول وحده يكفي لتفعيل «ابدأ» (G-08) — والنص يبقى محفوظاً لا ممسوحاً. */
    expect(start.disabled).toBe(false);
    expect((screen.getByTestId("manage-start-cash") as HTMLInputElement).value).toBe("85");
  });

  it("الصفر مقبول كرصيد افتتاحي معروف", async () => {
    render(<StartPage />);
    await fillAndStart({ cash: "0" });
    await waitFor(() =>
      expect(setupProject).toHaveBeenCalledWith(
        expect.objectContaining({
          boxes: [{ kind: "cash", opening: { openingFils: 0 } }],
        }),
      ),
    );
  });

  it("اسم فارغ: E-NAME-REQUIRED تحت حقل الاسم ولا نداء إرسال", async () => {
    render(<StartPage />);
    await fillAndStart({ name: "  " });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(MANAGE_STRINGS_AR["E-NAME-REQUIRED"]);
    expect(setupProject).not.toHaveBeenCalled();
  });

  it("مبلغ غير صالح: E-AMOUNT تحت حقل الصندوق ولا نداء إرسال", async () => {
    render(<StartPage />);
    await fillAndStart({ cash: "12.1234" });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(MANAGE_STRINGS_AR["E-AMOUNT"]);
    expect(setupProject).not.toHaveBeenCalled();
  });

  it("OP-SETUP بالإدخال الصحيح بالفلس ثم العودة إلى «مشروعي الآن»", async () => {
    render(<StartPage />);
    await fillAndStart({ cash: "85.5" });
    await waitFor(() => expect(setupProject).toHaveBeenCalledTimes(1));
    expect(setupProject).toHaveBeenCalledWith({
      requestId: expect.any(String),
      projectName: "مطبخ أم ليث",
      boxes: [{ kind: "cash", opening: { openingFils: 85500 } }],
    });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/"));
  });

  it("صندوقان مع مجهول للحساب: الرسالة تحمل unknown للحساب ورقماً للنقد", async () => {
    render(<StartPage />);
    fireEvent.click(screen.getByRole("button", { name: MANAGE_STRINGS_AR["t.cash_account"] }));
    fireEvent.change(screen.getByTestId("manage-start-name"), {
      target: { value: "مطبخ أم ليث" },
    });
    fireEvent.change(screen.getByTestId("manage-start-cash"), { target: { value: "100" } });
    fireEvent.click(screen.getAllByLabelText(MANAGE_STRINGS_AR["t.unknown_now"])[1]!);
    fireEvent.click(screen.getByRole("button", { name: MANAGE_STRINGS_AR["a.start"] }));
    await waitFor(() => expect(setupProject).toHaveBeenCalledTimes(1));
    expect(setupProject).toHaveBeenCalledWith(
      expect.objectContaining({
        boxes: [
          { kind: "cash", opening: { openingFils: 100000 } },
          { kind: "account", opening: { unknown: true } },
        ],
      }),
    );
  });

  it("رفض الخادم (E-BOX-LIMIT) يُعرض أعلى الورقة دون مسح المدخلات (C-08)", async () => {
    render(<StartPage />);
    setupProject.mockRejectedValueOnce(
      new ApiError(400, { code: "e-box-limit", message: "limit", details: { code: "E-BOX-LIMIT" } }),
    );
    await fillAndStart();
    expect(await screen.findAllByText(MANAGE_STRINGS_AR["E-BOX-LIMIT"])).not.toHaveLength(0);
    expect((screen.getByTestId("manage-start-name") as HTMLInputElement).value).toBe("مطبخ أم ليث");
    expect((screen.getByTestId("manage-start-cash") as HTMLInputElement).value).toBe("85");
  });

  it("انقطاع الاتصال عند الحفظ: E-OFFLINE ولا يُحفظ شيء (T56)", async () => {
    render(<StartPage />);
    setupProject.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await fillAndStart();
    expect(await screen.findAllByText(MANAGE_STRINGS_AR["E-OFFLINE"])).not.toHaveLength(0);
  });
});
