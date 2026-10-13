/** @vitest-environment jsdom */
/** OD-14 = D1 (2026-10-13) — حامل هوية البناء في index.html: قراءة وسم meta
 * المحروسة تعمل في بيئة DOM، والقيمة تُقرأ مرة واحدة عند تحميل الوحدة،
 * وغياب/فراغ/تلف الوسم يسقط إلى البديل المحلي الصادق — لا انتحال إنتاج
 * ولا رمي في أي حالة. فك تهريب السمة يعيد القيمة الأصلية حرفيًا. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { APP_IDENTITY_META_NAME, LOCAL_DEV_APP_IDENTITY } from "./buildIdentity";

const GITHUB_SHA = "4c7fbbdf07cb89e3a786070a17baad0530c2c562";

/** وحدة جديدة لكل قراءة — الثابت يُقيّم عند التحميل فحسب (قراءة واحدة). */
async function loadIdentityModule() {
  vi.resetModules();
  return await import("./buildIdentity");
}

function setCarrier(rawHtml: string | null) {
  document.querySelector(`meta[name="${APP_IDENTITY_META_NAME}"]`)?.remove();
  if (rawHtml !== null) document.head.insertAdjacentHTML("beforeend", rawHtml);
}

describe("build identity HTML carrier (OD-14/D1 — meta tag in index.html)", () => {
  beforeEach(() => {
    setCarrier(null);
  });

  it("resolves the production identity from the index.html meta carrier", async () => {
    setCarrier(`<meta name="${APP_IDENTITY_META_NAME}" content="${GITHUB_SHA}" />`);
    const { appIdentity } = await loadIdentityModule();
    expect(appIdentity).toBe(GITHUB_SHA);
  });

  it("reads the carrier exactly once at module load — later DOM changes do not alter the resolved identity", async () => {
    setCarrier(`<meta name="${APP_IDENTITY_META_NAME}" content="v2026.10.13-rc1" />`);
    const first = await loadIdentityModule();
    setCarrier(`<meta name="${APP_IDENTITY_META_NAME}" content="mutated-after-load" />`);
    expect(first.appIdentity).toBe("v2026.10.13-rc1");
  });

  it("falls back to the honest local identity when the carrier is absent, empty, or whitespace", async () => {
    const absent = await loadIdentityModule();
    expect(absent.appIdentity).toBe(LOCAL_DEV_APP_IDENTITY);

    setCarrier(`<meta name="${APP_IDENTITY_META_NAME}" content="" />`);
    expect((await loadIdentityModule()).appIdentity).toBe(LOCAL_DEV_APP_IDENTITY);

    setCarrier(`<meta name="${APP_IDENTITY_META_NAME}" content="   " />`);
    expect((await loadIdentityModule()).appIdentity).toBe(LOCAL_DEV_APP_IDENTITY);
  });

  it("rejects an overlong carrier value through the same coercion contract (fallback, never a fake production identity)", async () => {
    setCarrier(`<meta name="${APP_IDENTITY_META_NAME}" content="${"x".repeat(65)}" />`);
    const { appIdentity } = await loadIdentityModule();
    expect(appIdentity).toBe(LOCAL_DEV_APP_IDENTITY);
  });

  it("trims surrounding whitespace from the carrier value", async () => {
    setCarrier(`<meta name="${APP_IDENTITY_META_NAME}" content="  v2026.10.13  " />`);
    const { appIdentity } = await loadIdentityModule();
    expect(appIdentity).toBe("v2026.10.13");
  });

  it("decodes HTML-escaped attribute values back to the exact identity (escape round-trip)", async () => {
    /* الإدخال الوقتَ-البنائي يهرّب المحارف الخمسة؛ getAttribute يفك التهريب —
     * القيمة المدركة تطابق الأصل حرفيًا حتى مع & < > " ' */
    setCarrier(`<meta name="${APP_IDENTITY_META_NAME}" content="a&amp;b&lt;c&gt;d&quot;e&#39;f" />`);
    const { appIdentity } = await loadIdentityModule();
    expect(appIdentity).toBe("a&b<c>d\"e'f");
  });

  it("a wrong-typed carrier content attribute still falls back safely (no throw)", async () => {
    const el = document.createElement("meta");
    el.setAttribute("name", APP_IDENTITY_META_NAME);
    document.head.append(el);
    const { appIdentity } = await loadIdentityModule();
    expect(appIdentity).toBe(LOCAL_DEV_APP_IDENTITY);
  });
});
