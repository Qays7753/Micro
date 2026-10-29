/** @vitest-environment jsdom */
/*
 * R9-GA-F3.6-ERROR-ROLE-INVENTORY (WS-216/ARCH-007 — استمرار R9 الجذري):
 * اختبار انحداري لعائلة أدوار الإعلان الدلالية. الجزء الأول عقد مصدري:
 * كل سطح خطأ مؤكد يحمل role="alert"، وكل فصل نبرة مختلطة يحمل الدور
 * المشتق من الحالة لا من قراءة بادئة النص — أي انحدار مستقبلي للدور
 * يُفشل الاختبار. الجزء الثاني سلوكي عبر صفحة العدّ: الخطأ alert والنجاح/
 * المعلومة status بفئتين مختلفتين.
 */
import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { CashCountService } from "@/application/cash/cashCountService";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import CashCount from "@/pages/CashCount";

const CLIENT_SRC = resolve(__dirname, ".");

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
  getPrototypeLocalStore: () => currentStore,
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/",
  params: {} as Record<string, string>,
  search: "",
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => wouterMocks.search,
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-10-11T09:00:00.000Z";

let store: MemoryLocalStore;
let currentStore: MemoryLocalStore;
const bumpVersion = vi.fn();

function services() {
  return {
    cashContinuity: new CashContinuityService(store, () => NOW),
    cashCount: new CashCountService(store, () => NOW),
    notifyDataChanged: bumpVersion,
    dataVersion: 0,
  };
}

function Harness() {
  return (
    <UnsavedChangesProvider navigate={wouterMocks.navigate}>
      <CashCount />
    </UnsavedChangesProvider>
  );
}

beforeEach(() => {
  store = new MemoryLocalStore();
  currentStore = store;
  wouterMocks.search = "";
  wouterMocks.params = {};
  wouterMocks.navigate.mockReset();
  bumpVersion.mockReset();
  mockedUsePrototypeServices.mockReturnValue(
    services() as unknown as ReturnType<typeof usePrototypeServices>,
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/* ─── الجزء الأول: عقد المصدر لكل موقع أُصلح في هذه العائلة ─── */

describe("R9-GA-F3.6 — error-role source contract (regression guard)", () => {
  /* مواقع رسائل الأخطاء الصرفة: كانت role="status" وصارت alert. العقد
   * عير الموضع: كل عنصر micro-field-error في الملف يحمل alert ما عدا
   * المواقع المحفوظة الموثقة (تحذير الوصلة في محرر حركة المادة). */
  const ERROR_ONLY_FILES: readonly (readonly [string, number])[] = [
    ["InventoryMovementEditor.tsx", 1],
    ["DirectSaleEditor.tsx", 0],
    ["EstimateDetail.tsx", 0],
    ["MaterialEditor.tsx", 0],
    ["Tools.tsx", 0],
    ["ToolsIntegrity.tsx", 0],
    ["CashAdjustmentEditor.tsx", 0],
    ["CostCalculator.tsx", 0],
  ];
  const ERROR_ONLY_COMPONENTS: readonly (readonly [string, number])[] = [
    ["finance/CorrectionsLayer.tsx", 0],
    ["direct-sales/SaleCollectionReversalSection.tsx", 0],
  ];

  it("every confirmed error-only message surface announces with role=alert (was status)", () => {
    const targets = [
      ...ERROR_ONLY_FILES.map(([file, preserved]) => [`pages/${file}`, preserved] as const),
      ...ERROR_ONLY_COMPONENTS.map(([file, preserved]) => [`components/${file}`, preserved] as const),
    ];
    for (const [rel, preservedStatusCount] of targets) {
      const source = readFileSync(resolve(CLIENT_SRC, rel), "utf8");
      const roles = [
        ...source.matchAll(/className="micro-field-error"[\s\S]{0,220}?role="(alert|status)"/g),
      ].map(match => match[1]);
      expect.soft(roles.length, `${rel}: no role-carrying micro-field-error element`).toBeGreaterThan(0);
      const statusCount = roles.filter(role => role === "status").length;
      expect
        .soft(
          statusCount,
          `${rel}: ${statusCount} micro-field-error surface(s) still announce as status (expected only the ${preservedStatusCount} documented preserved site(s))`,
        )
        .toBe(preservedStatusCount);
    }
  });

  it("the mixed-tone splits derive the role from carried tone, not from sniffing message prefixes", () => {
    const sources = [
      "pages/CashCount.tsx",
      "pages/CashDistribution.tsx",
      "pages/CostCalculator.tsx",
      "pages/FinancialEventEditor.tsx",
      "pages/Profile.tsx",
      "pages/Schedule.tsx",
    ] as const;
    for (const rel of sources) {
      const source = readFileSync(resolve(CLIENT_SRC, rel), "utf8");
      expect
        .soft(
          source.includes('message.tone === "error" ? "alert" : "status"'),
          `${rel}: tone-driven role missing`,
        )
        .toBe(true);
    }
    const ownerEntitlement = readFileSync(resolve(CLIENT_SRC, "pages/OwnerEntitlement.tsx"), "utf8");
    expect.soft(ownerEntitlement.includes('notice.tone === "success" ? "status" : "alert"')).toBe(true);
    const panel = readFileSync(resolve(CLIENT_SRC, "components/order/AgreementContextPanel.tsx"), "utf8");
    expect.soft(panel.includes('saveState.kind === "ok" ? "status" : "alert"')).toBe(true);
    /* لا تبقى قراءة بادئة نص لاشتقاق النبرة في أي موقع مُصلح. */
    for (const rel of sources) {
      const source = readFileSync(resolve(CLIENT_SRC, rel), "utf8");
      expect
        .soft(
          /\.startsWith\("انسجّلت"\)|\.startsWith\("سُجّل"\)|\.startsWith\("حُفظ"\)|\.startsWith\("تم "\)/.test(
            source,
          ),
          `${rel}: prefix sniffing still present`,
        )
        .toBe(false);
    }
  });

  it("the preserved informational/warning surfaces keep role=status (not mislabeled as errors)", () => {
    /* linkIssue تحذير ما قبل الحفظ — يبقى status (لا يُرقى إلى alert). */
    const movement = readFileSync(resolve(CLIENT_SRC, "pages/InventoryMovementEditor.tsx"), "utf8");
    const linkIssueIndex = movement.indexOf('data-testid="movement-link-issue"');
    expect(linkIssueIndex).toBeGreaterThan(-1);
    const window = movement.slice(linkIssueIndex - 200, linkIssueIndex + 200);
    expect(window).toContain('role="status"');
    expect(window).not.toContain('role="alert"');
    /* إرشاد «أنشئ محفظة أولًا» معلوماتي — يبقى status. */
    const cashCount = readFileSync(resolve(CLIENT_SRC, "pages/CashCount.tsx"), "utf8");
    /* S04 (DOC-013 / UNIT-025): نص الفراغ الكنوني لأماكن النقد. */
    const emptyIndex = cashCount.indexOf("لا توجد أماكن نقد بعد");
    expect(emptyIndex).toBeGreaterThan(-1);
    const emptyWindow = cashCount.slice(emptyIndex - 250, emptyIndex + 100);
    expect(emptyWindow).toContain('role="status"');
  });

  it("read-error sections announce their message paragraphs with role=alert", () => {
    const sites: readonly [string, string][] = [
      ["Collect.tsx", "تعذر فتح ورقة التحصيل"],
      ["Finance.tsx", "تعذر قراءة الوضع المالي"],
      ["Orders.tsx", "تعذر تحميل الطلبات"],
      ["Parties.tsx", "تعذر قراءة العملاء والموردين"],
      ["Statement.tsx", "تعذر قراءة الكشف"],
      ["WalletLedger.tsx", "دفتر محفظة غير متاح"],
      ["Foundation.tsx", "تعذر قراءة الموقف"],
      ["OrderDetail.tsx", "تعذر قراءة الطلب"],
    ];
    for (const [file, heading] of sites) {
      const source = readFileSync(resolve(CLIENT_SRC, "pages", file), "utf8");
      const headingIndex = source.indexOf(`<h1>${heading}</h1>`);
      expect.soft(headingIndex, `${file}: heading not found`).toBeGreaterThan(-1);
      const window = source.slice(headingIndex, headingIndex + 400);
      expect
        .soft(window.includes('role="alert"'), `${file}: read-error paragraph lacks role=alert`)
        .toBe(true);
    }
  });

  /* R10-B4/F-017: الجرد يغطي الآن قناتي الإعلان الأوليتين أيضًا — InlineError
   * وفقرة خطأ Field كانتا خارج جرد R9 (status مهذبة ضد 125 موقع alert)
   * فصارتا alert حازمًا كالقاعدة الموحدة. */
  it("the primitive error channels (InlineError, Field error) announce assertively", () => {
    const notice = readFileSync(resolve(CLIENT_SRC, "components/primitives/Notice.tsx"), "utf8");
    const inlineIndex = notice.indexOf("micro-prim-notice--error-inline");
    expect.soft(inlineIndex).toBeGreaterThan(-1);
    const inlineWindow = notice.slice(Math.max(0, inlineIndex - 260), inlineIndex + 80);
    expect.soft(inlineWindow.includes('role="alert"'), "InlineError must announce as alert").toBe(true);
    expect.soft(inlineWindow.includes('role="status"')).toBe(false);

    const field = readFileSync(resolve(CLIENT_SRC, "components/primitives/Field.tsx"), "utf8");
    const fieldErrorIndex = field.indexOf("micro-prim-field__error");
    expect.soft(fieldErrorIndex).toBeGreaterThan(-1);
    const fieldWindow = field.slice(Math.max(0, fieldErrorIndex - 260), fieldErrorIndex + 80);
    expect
      .soft(fieldWindow.includes('role="alert"'), "Field error paragraph must announce as alert")
      .toBe(true);
    expect.soft(fieldWindow.includes('role="status"')).toBe(false);

    /* القنوات المهذبة الشرعية تبقى status: الإتمام الهادئ والإرشاد والتحميل. */
    expect.soft(notice.includes('role="status"')).toBe(true);
  });
});

/* ─── الجزء الثاني: السلوك عبر صفحة العدّ (خطأ ⇒ alert، معلومة ⇒ status) ─── */

describe("R9-GA-F3.6 — mixed-tone announcement behavior (CashCount journey)", () => {
  it("a validation failure announces as an alert with the error class", async () => {
    const cash = new CashContinuityService(store, () => NOW);
    const opened = await cash.openWallet({
      name: "درج العدّ",
      kind: "cash_drawer",
      openingMinor: 10_000,
      occurredOn: "2026-10-01",
      note: "بداية",
      operationKey: "f36-open",
    });
    if (!opened.ok) throw new Error(opened.message);
    wouterMocks.params = {};
    render(<Harness />);
    const walletSelect = await screen.findByRole("combobox");
    fireEvent.change(walletSelect, { target: { value: opened.value.wallet.id } });
    /* عدّ مطابق للرصيد ⇒ معلومة status بفئة الملاحظة لا الخطأ. */
    const counted = screen.getByLabelText("المبلغ الموجود");
    fireEvent.change(counted, { target: { value: "100" } });
    /* S04 (UNIT-025 R09/AC08): التطابق «تم» — معلومة status بفئة الملاحظة
     * لا الخطأ، ولا يُكتب شيء البتة. */
    const settle = screen.getByRole("button", { name: "تم" });
    fireEvent.click(settle);
    const info = await screen.findByRole("status");
    expect(info.className).toContain("micro-save-note");
    expect(info.textContent).toContain("المبلغ يطابق الرصيد المسجل");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
