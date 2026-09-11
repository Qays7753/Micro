/** المجموعة ٥ (التحصين الكامل — هوية البناء): الإكراه الواحد للهوية —
 * الإنتاج يحمل SHA حقيقيًا قصيرًا، والبديل المحلي حتمي ومعلن كغير إنتاجي،
 * وكل ما عداهما (فارغ/طويل/نوع خاطئ) يسقط إلى البديل الصادق. */
import { describe, expect, it } from "vitest";
import { appIdentity, LOCAL_DEV_APP_IDENTITY, resolveAppIdentity } from "./buildIdentity";

const GITHUB_SHA = "6d81b89bceba342d1f2389625953efec5aea185f";

describe("build identity resolution (group 5 — real in production, honest locally)", () => {
  it("accepts a real commit SHA as the production identity", () => {
    expect(resolveAppIdentity(GITHUB_SHA)).toBe(GITHUB_SHA);
  });

  it("accepts an explicitly provided version string within the length bound", () => {
    expect(resolveAppIdentity("v2026.09.11-rc1")).toBe("v2026.09.11-rc1");
  });

  it("falls back to the deterministic local identity for absent, empty, overlong, or wrong-typed values", () => {
    expect(resolveAppIdentity(null)).toBe(LOCAL_DEV_APP_IDENTITY);
    expect(resolveAppIdentity(undefined)).toBe(LOCAL_DEV_APP_IDENTITY);
    expect(resolveAppIdentity(42)).toBe(LOCAL_DEV_APP_IDENTITY);
    expect(resolveAppIdentity("   ")).toBe(LOCAL_DEV_APP_IDENTITY);
    expect(resolveAppIdentity("x".repeat(65))).toBe(LOCAL_DEV_APP_IDENTITY);
  });

  it("the test environment resolves the local fallback — never a fake production identity", () => {
    /* vitest لا يعرّف الثابت المحقون (typeof-guard) — البديل الحتمي وحده. */
    expect(appIdentity).toBe(LOCAL_DEV_APP_IDENTITY);
  });
});
