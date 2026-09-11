/** @vitest-environment jsdom */

/* المجموعة ٨ (المعالجة الرباعية — اختبار STR-007): مفاتيح عمليات الكتالوج
 * تعمل في السياقات غير الآمنة أيضًا — المسار الآمن كما كان بايتًا ببايت
 * (نفس ناتج randomUUID حرفيًا)، والمسار غير الآمن يعطي بديلًا حتميًا-آمنًا
 * فريدًا لا مفتاحًا معلقًا ولا قيمة فارغة، وتركيب مفتاح العملية
 * (بادئة:قيمة) لا يتغير. */
import { afterEach, describe, expect, it } from "vitest";
import { catalogOperationUuid, operationKey } from "./Catalog";

type CryptoLike = typeof globalThis.crypto;

const originalCrypto: CryptoLike | undefined = globalThis.crypto;

function restoreCrypto() {
  if (originalCrypto === undefined) {
    delete (globalThis as { crypto?: CryptoLike }).crypto;
    return;
  }
  Object.defineProperty(globalThis, "crypto", {
    value: originalCrypto,
    configurable: true,
    writable: true,
  });
}

afterEach(restoreCrypto);

describe("catalog operation keys degrade safely outside secure contexts (Group 8, STR-007)", () => {
  it("returns the secure-context randomUUID result verbatim when crypto is available", () => {
    const sentinel = "0f0e0d0c-1b2a-3c4d-5e6f-0a1b2c3d4e5f";
    Object.defineProperty(globalThis, "crypto", {
      value: { randomUUID: () => sentinel },
      configurable: true,
      writable: true,
    });
    expect(catalogOperationUuid()).toBe(sentinel);
  });

  it("falls back deterministically-safely when crypto is absent (non-secure context)", () => {
    delete (globalThis as { crypto?: CryptoLike }).crypto;
    const first = catalogOperationUuid();
    expect(first).toMatch(/^catalog-\d+-[0-9a-z]+$/);
    expect(first.length).toBeGreaterThan("catalog-".length);
  });

  it("falls back when randomUUID is not a function (older embedded webviews)", () => {
    Object.defineProperty(globalThis, "crypto", {
      value: { getRandomValues: () => new Uint8Array(4) },
      configurable: true,
      writable: true,
    });
    expect(catalogOperationUuid()).toMatch(/^catalog-\d+-[0-9a-z]+$/);
  });

  it("fallback keys stay collision-free across rapid successive calls", () => {
    delete (globalThis as { crypto?: CryptoLike }).crypto;
    const generated = new Set<string>();
    for (let index = 0; index < 500; index += 1) {
      generated.add(catalogOperationUuid());
    }
    expect(generated.size).toBe(500);
  });

  it("operationKey keeps its prefix:value composition and never renames its semantics", () => {
    const sentinel = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    Object.defineProperty(globalThis, "crypto", {
      value: { randomUUID: () => sentinel },
      configurable: true,
      writable: true,
    });
    expect(operationKey("unit")).toBe(`unit:${sentinel}`);
    delete (globalThis as { crypto?: CryptoLike }).crypto;
    expect(operationKey("template")).toMatch(/^template:catalog-\d+-[0-9a-z]+$/);
  });
});
