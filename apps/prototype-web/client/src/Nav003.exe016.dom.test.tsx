/** @vitest-environment jsdom */
/* EXE-016 (NAV-003) — عقود الروابط العميقة على التطبيق الحقيقي (نمط R2):
 * المسار المجهول يفشل بأمان صادق، والرابط القديم الواضح (/review) يمر عبر
 * تحويله المحدود، و?destinationWalletId يفتح المحفظة الصحيحة من البداية
 * الباردة وبعد التحديث، والمعرّف غير الصالح لا يختر أول محفظة ولا يسقط
 * بصمت بل يُخلي الاختيار بإشعار صادق، والمعامل العام ?to المتقاعد يُهمل
 * بأمان، و?mode=cover يفتح اتجاه التغطية. */
import "fake-indexeddb/auto";
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { createBrowserLocalStore } from "@/storage/local/createBrowserLocalStore";
import { ProfileService } from "@/application/profile/profileService";
import { PreferenceService } from "@/application/preferences/preferenceService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";

/* jsdom يفتقر إلى matchMedia (يستخدمه ThemeContext ومطابقة التقليل الحركي). */
beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
});

const NOW = "2026-09-16T10:00:00.000Z";
let store: ReturnType<typeof createBrowserLocalStore>;
let walletIds: string[] = [];
let walletNames = new Map<string, string>();

async function seedSession() {
  store = createBrowserLocalStore();
  const profiles = new ProfileService(store);
  const preferences = new PreferenceService(store);
  const saved = await profiles.save("ورشة الروابط");
  if (!saved.ok) throw new Error("profile save failed: " + saved.message);
  const themed = await preferences.save("light");
  if (!themed.ok) throw new Error("theme preference failed: " + themed.message);
  const cash = new CashContinuityService(store, () => NOW);
  for (const [name, opening] of [
    ["محفظة الدرج", 5000],
    ["محفظة المشروع", 9000],
  ] as const) {
    const opened = await cash.openWallet({
      name,
      kind: "cash_drawer",
      openingMinor: opening,
      occurredOn: "2026-09-01",
      note: "افتتاح اختبار الروابط",
      operationKey: `nav003-open-${name}`,
    });
    if (!opened.ok) throw new Error(opened.message);
  }
  /* ترتيب القائمة كما يقرؤه التطبيق نفسه (overview) — لا ترتيب الإدراج —
   * فاختبار «أول محفظة» حتمي مهما رتّب المخزن الداخلي. */
  const overview = await cash.overview();
  if (!overview.ok) throw new Error(overview.message);
  walletIds = overview.value.wallets.map(wallet => wallet.id);
  walletNames = new Map(overview.value.wallets.map(wallet => [wallet.id, wallet.name] as const));
  if (walletIds.length !== 2) throw new Error(`expected 2 wallets, got ${walletIds.length}`);
}

function navigateTo(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

async function mountApp() {
  const utils = render(<App />);
  await waitFor(
    () => {
      expect(screen.queryByText("جارٍ فتح مشروعك المحلي…")).toBeNull();
    },
    { timeout: 4000 },
  );
  return utils;
}

/** انتظار جاهزية نموذج التوزيع ثم استخراج عنصري الاختيار. */
async function distributionControls() {
  await screen.findByRole("heading", { level: 1, name: "وزّع الكاش غير الموزع" });
  const direction = screen.getByLabelText("الاتجاه") as HTMLSelectElement;
  const wallet = screen.getByLabelText("المحفظة") as HTMLSelectElement;
  return { direction, wallet };
}

beforeEach(async () => {
  vi.clearAllMocks();
  await seedSession();
});
afterEach(() => {
  cleanup();
  window.history.pushState({}, "", "/");
});
afterAll(() => {
  window.history.pushState({}, "", "/");
});

describe("EXE-016 — عقود الروابط العميقة على التطبيق الحقيقي", () => {
  it("المسار المجهول يفشل بأمان: NotFound بلا انفجار مع مخرج واحد واضح", async () => {
    navigateTo("/nope-not-a-route");
    await mountApp();
    expect(await screen.findByRole("heading", { name: "هذه الصفحة ليست جزءًا من هذا الإصدار" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "العودة إلى مشروعي الآن" })).toBeTruthy();
  });

  it("الرابط القديم الواضح /review يمر عبر توافقه المحدود إلى مالي", async () => {
    navigateTo("/review");
    await mountApp();
    expect(await screen.findByRole("heading", { level: 1, name: "مالي" })).toBeTruthy();
    expect(window.location.pathname).toBe("/finance");
  });

  it("?destinationWalletId يفتح المحفظة المحددة من البداية الباردة", async () => {
    navigateTo(`/cash/distribute?destinationWalletId=${walletIds[1]}`);
    await mountApp();
    const { wallet } = await distributionControls();
    expect(wallet.value).toBe(walletIds[1]);
    expect(wallet.selectedOptions[0]?.textContent).toContain(walletNames.get(walletIds[1]) ?? "");
  });

  it("?destinationWalletId يفتح المحفظة نفسها بعد التحديث (النية في الـURL)", async () => {
    navigateTo(`/cash/distribute?destinationWalletId=${walletIds[1]}`);
    const first = await mountApp();
    const before = (await distributionControls()).wallet.value;
    expect(before).toBe(walletIds[1]);
    /* التحديث: إعادة تركيب كاملة على الرابط نفسه. */
    first.unmount();
    cleanup();
    await mountApp();
    const after = (await distributionControls()).wallet.value;
    expect(after).toBe(walletIds[1]);
  });

  it("معرّف محفظة غير صالح لا يختر أول محفظة ولا يسقط بصمت — إشعار صادق واختيار فارغ", async () => {
    navigateTo("/cash/distribute?destinationWalletId=ghost-wallet");
    await mountApp();
    const { wallet } = await distributionControls();
    expect(wallet.value).toBe("");
    expect(wallet.selectedOptions[0]?.textContent).toContain("اختر محفظة");
    expect(
      await screen.findByText("الرابط طلب محفظة غير موجودة أو محذوفة — اختر محفظة بنفسك قبل التوزيع."),
    ).toBeTruthy();
  });

  it("المعامل العام ?to المتقاعد يُهمل بأمان — لا يختار محفظته عشوائيًا", async () => {
    navigateTo(`/cash/distribute?to=${walletIds[1]}`);
    await mountApp();
    const { wallet } = await distributionControls();
    /* السلوك كما لو لا معامل: المحفظة الأولى المعلنة — لا قيمة to الغامضة. */
    expect(wallet.value).toBe(walletIds[0]);
    expect(wallet.value).not.toBe(walletIds[1]);
  });

  it("?mode=cover يفتح التوزيع جاهزًا لاتجاه التغطية", async () => {
    navigateTo("/cash/distribute?mode=cover");
    await mountApp();
    const { direction } = await distributionControls();
    expect(direction.value).toBe("cover_payment");
  });

  it("بلا معاملات: الافتراضي القانوني — أول محفظة واتجاه التوزيع", async () => {
    navigateTo("/cash/distribute");
    await mountApp();
    const { direction, wallet } = await distributionControls();
    expect(wallet.value).toBe(walletIds[0]);
    expect(direction.value).toBe("into_wallet");
  });
});
