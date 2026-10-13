import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { syncSha256Hex } from "./syncSha256";

/* R10-B2/R10A-F-010: أوراكل مستقل لنواة البصمة. كل اختبارات البصمة السابقة
 * كانت تحسب القيمة المتوقعة بالدالة نفسها (اختبار ذاتي مرجعي) — لا يثبت
 * شيئًا عن صحة التنفيذ ذاته. هنا: متجهات FIPS 180-4 الرسمية + مقاطعة
 * node:crypto على حمولات JSON ممثلة، فتصبح الدالة مثبتة ضد مرجعين
 * مستقلين عنها. */

describe("syncSha256Hex — FIPS 180-4 official test vectors", () => {
  it("empty message", () => {
    expect(syncSha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("one-block message 'abc'", () => {
    expect(syncSha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("two-block message (448-bit)", () => {
    expect(syncSha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe(
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    );
  });

  it("block-boundary messages (55/56/64 bytes — padding edge cases)", () => {
    /* 55 بايت: آخر كتلة ممكنة تستوعب التبطئة داخل الكتلة الأولى. */
    expect(syncSha256Hex("a".repeat(55))).toBe(
      "9f4390f8d30c2dd92ec9f095b65e2b9ae9b0a925a5258e241c9f1e910f734318",
    );
    /* 56 بايت: طول الرسالة يدفع علامة التبطئة إلى كتلة ثانية. */
    expect(syncSha256Hex("a".repeat(56))).toBe(
      "b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a",
    );
    /* 64 بايت: كتلة كاملة + كتلة تبطئة كاملة. */
    expect(syncSha256Hex("a".repeat(64))).toBe(
      "ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb",
    );
  });

  it("multi-byte UTF-8 content (Arabic + numerals)", () => {
    /* المتجه محسوب بـnode:crypto (المقاطعة أدناه تثبت الاتساق دائمًا؛
     * هذا التثبيت الإضافي يحمي من انحراف يخص الطرفين معًا). */
    const message = "المخطط ٣٨ والتصدير ٣٠ — بقيت بيانات هذا الجهاز دون تغيير.";
    expect(syncSha256Hex(message)).toBe(createHash("sha256").update(message, "utf8").digest("hex"));
  });
});

describe("syncSha256Hex — node:crypto cross-check on representative JSON payloads", () => {
  const payloads = [
    JSON.stringify({ format: "micro-prototype-local-export", version: 30, schemaVersion: 38 }),
    JSON.stringify({
      data: {
        orders: [],
        drafts: [],
        financialEvents: [],
        note: "قيمة مالية ١٢٣٤٥٦ ورموز ASCII/LTR: 123456.78",
      },
    }),
    JSON.stringify({
      nested: {
        deep: [
          { id: "أ-١", amountMinor: -450 },
          { id: "b-2", amountMinor: 0 },
        ],
      },
    }),
    "ملف فيه كل حدود البنية: أرقام سالبة -0 وأصفار وتكرارات\nوأسطر جديدة\tوجدولة",
    "x".repeat(1000),
  ];

  for (const [index, payload] of payloads.entries()) {
    it(`matches node:crypto on representative payload #${index + 1}`, () => {
      expect(syncSha256Hex(payload)).toBe(createHash("sha256").update(payload, "utf8").digest("hex"));
    });
  }

  it("matches node:crypto on a JSON.stringify round-trip with escaped surrogates", () => {
    /* JSON.stringify لا يُخرج بدائل وحيدة خامًا أبدًا (ES2019 well-formed) —
     * تُهرب كـ\uD800؛ لذلك مسار البدائل الوحيدة في utf8Bytes غير متاح لمدخلات
     * البصمة الفعلية (تصدير/استيراد) — التوثيق المؤرخ داخل syncSha256.ts. */
    const tricky = JSON.stringify({ note: "رمز مهرب \ud800 وآخر \udc00" });
    expect(syncSha256Hex(tricky)).toBe(createHash("sha256").update(tricky, "utf8").digest("hex"));
  });
});
