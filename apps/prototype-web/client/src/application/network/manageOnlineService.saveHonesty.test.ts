/** @vitest-environment jsdom */
/**
 * EX-D23 (M4): صدق كتابة السجل المتصل من جهة العميل — «محفوظ» لا تعود إلا
 * بعد تأكيد الخادم (200)؛ أي فشل خادم/شبكة يرمى ولا يُدَّعى نجاح؛ ومفتاح
 * الحتمية يرسل كما مرره المستدعي كي تعيد المحاولة نفسها المفتاح نفسه.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, saveManageRecord } from "@/application/network";

function stubFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  const spy = vi.fn(handler);
  vi.stubGlobal("fetch", spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("saveManageRecord honesty (M4)", () => {
  it("returns saved ONLY after the server acknowledges (200)", async () => {
    const spy = stubFetch(
      async () =>
        new Response(
          JSON.stringify({ saved: true, family: "assets", id: "w-1", updatedAt: 42, created: true }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
    );
    const result = await saveManageRecord("assets", "w-1", { openingMinor: 500 }, null, "idem-key-1");
    expect(result.saved).toBe(true);
    expect(result.updatedAt).toBe(42);
    const init = spy.mock.calls[0]![1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("idempotency-key")).toBe("idem-key-1");
    expect(headers.get("x-micro-api")).toBe("1");
    expect(init.method).toBe("PUT");
  });

  it("throws the server's honest error on a conflict — never a fake success (MO-12 client side)", async () => {
    stubFetch(
      async () =>
        new Response(
          JSON.stringify({
            error: { code: "conflict", message: "الواقع تغير — أعد المحاولة من الحالة الحالية." },
          }),
          { status: 409, headers: { "content-type": "application/json" } },
        ),
    );
    const attempt = saveManageRecord("assets", "w-1", { openingMinor: 500 }, 7, "idem-key-2");
    await expect(attempt).rejects.toBeInstanceOf(ApiError);
    await expect(attempt).rejects.toMatchObject({ status: 409, code: "conflict" });
  });

  it("throws on network failure (offline) — no success is ever fabricated (MO-10 client side)", async () => {
    stubFetch(async () => {
      throw new TypeError("fetch failed");
    });
    const attempt = saveManageRecord("assets", "w-1", { openingMinor: 500 }, null, "idem-key-3");
    await expect(attempt).rejects.toThrow();
  });
});
