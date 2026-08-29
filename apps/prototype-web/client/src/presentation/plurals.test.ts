import { describe, expect, it } from "vitest";
import {
  cashWalletCountLabel,
  savedImpactCountLabel,
  savedMovementCountLabel,
  templateComponentCountLabel,
} from "./plurals";

describe("page count labels render Arabic plurals (L-18)", () => {
  it("counts cash wallets — «محفظتا كاش» at two", () => {
    expect(cashWalletCountLabel(1)).toBe("محفظة كاش واحدة");
    expect(cashWalletCountLabel(2)).toBe("محفظتا كاش");
    expect(cashWalletCountLabel(3)).toBe("3 محافظ كاش");
    expect(cashWalletCountLabel(11)).toBe("11 محفظة كاش");
  });

  it("counts a wallet's saved impacts — «أثران محفوظان» at two", () => {
    expect(savedImpactCountLabel(1)).toBe("أثر محفوظ واحد");
    expect(savedImpactCountLabel(2)).toBe("أثران محفوظان");
    expect(savedImpactCountLabel(5)).toBe("5 آثار محفوظة");
    expect(savedImpactCountLabel(12)).toBe("12 أثرًا محفوظًا");
  });

  it("counts a material's saved movements — «حركتان محفوظتان» at two", () => {
    expect(savedMovementCountLabel(1)).toBe("حركة محفوظة واحدة");
    expect(savedMovementCountLabel(2)).toBe("حركتان محفوظتان");
    expect(savedMovementCountLabel(4)).toBe("4 حركات محفوظة");
    expect(savedMovementCountLabel(21)).toBe("21 حركة محفوظة");
  });

  it("counts template components — «مكوّنان» at two", () => {
    expect(templateComponentCountLabel(1)).toBe("مكوّن واحد");
    expect(templateComponentCountLabel(2)).toBe("مكوّنان");
    expect(templateComponentCountLabel(6)).toBe("6 مكونات");
    expect(templateComponentCountLabel(30)).toBe("30 مكوّنًا");
  });
});
