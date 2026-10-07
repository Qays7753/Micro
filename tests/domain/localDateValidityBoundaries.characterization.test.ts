import { describe, expect, it } from "vitest";
import { isValidLocalDate, localDateInAmman, ammanDateOrNull } from "../../src/domain/shared/index.js";
import { createDirectSale } from "../../src/domain/direct-sale/index.js";
import { createCashContinuityEntry } from "../../src/domain/cash-continuity/index.js";
import { createSupplierPurchase } from "../../src/domain/supplier-purchase/index.js";

/*
 * R2 (WS-216/ARCH-007 — المال/التنسيق/الإدخال/التاريخ/الرسائل):
 * توصيف حدود صلاحية التاريخ المحلي.
 *
 * تحديث مؤرخ 2026-10-08 (الإصلاح الجذري — M-01/M-04): هذا الملف كان يثبّت
 * السلوك القديم بعيوبه (رفض النواة للسنوات 0000–0099 صدفةً؛ قبول الصنف D
 * للدوران). بعد تنفيذ الجذر أصبح يثبّت العقد الكنوني الجديد: نطاق ISO
 * 0000–9999 (تقويم غريغوري استباقي؛ السنة 0 كبيسة) ورفض الدوران في كل
 * الأصناف. كل قلب موثق بموقعه تحت المانيفست R2-SEMANTIC-CHANGE-MANIFESTS
 * (M-01: سياسة السنوات؛ M-04: تشديد الأصناف الضعيفة).
 */

const directSaleInput = (occurredOn: string) => ({
  id: "sale-r2-char",
  itemName: "اختبار توصيف",
  quantity: 1,
  revenueMinor: 1000,
  collectedMinor: 1000,
  costMinor: null,
  occurredOn,
  recordedAt: "2026-10-07T10:00:00.000Z",
  idempotencyKey: "sale-r2-char-key",
  note: "توصيف",
});

const cashEntryInput = (occurredOn: string) => ({
  id: "cash-r2-char",
  walletId: "wallet-1",
  type: "opening_balance" as const,
  occurredOn,
  recordedAt: "2026-10-07T10:00:00.000Z",
  cashDeltaMinor: 500,
  note: "توصيف",
  operationKey: "cash-r2-char-op",
});

const supplierPurchaseInput = (purchasedOn: string) => ({
  id: "sp-r2-char",
  supplierName: "مورد التوصيف",
  note: "توصيف",
  purchasedOn,
  totalMinor: 10000,
  initialPaidMinor: 0,
  recordedAt: "2026-10-07T10:00:00.000Z",
  idempotencyKey: "sp-r2-char-key",
});

describe("R2 characterization — domain local-date validity kernel (Class A)", () => {
  it("accepts valid calendar dates including real leap days", () => {
    expect(isValidLocalDate("2026-01-05")).toBe(true);
    expect(isValidLocalDate("2024-02-29")).toBe(true);
    expect(isValidLocalDate("2000-02-29")).toBe(true);
    expect(isValidLocalDate("0100-01-01")).toBe(true);
    expect(isValidLocalDate("9999-12-31")).toBe(true);
  });

  it("rejects calendar rollover dates (the kernel strictness)", () => {
    expect(isValidLocalDate("2023-02-29")).toBe(false);
    expect(isValidLocalDate("2026-02-30")).toBe(false);
    expect(isValidLocalDate("2026-04-31")).toBe(false);
  });

  it("accepts years 0000–0099 under the explicit ISO policy (M-01 flip, 2026-10-08)", () => {
    /* قلب موثق (M-01): كانت النواة ترفضها صدفةً (Date.UTC يعيد 0–99 إلى 1900+) —
     * الآن سياسة صريحة: نطاق ISO 0000–9999، تقويم غريغوري استباقي (السنة 0 كبيسة). */
    expect(isValidLocalDate("0050-01-01")).toBe(true);
    expect(isValidLocalDate("0000-01-01")).toBe(true);
    expect(isValidLocalDate("0099-12-31")).toBe(true);
    /* بينما الصنف B (مدقق النقل) يقبلها — يُثبَّت التباعد في ملف توصيف التطبيق. */
  });

  it("rejects out-of-grammar and non-date shapes without throwing", () => {
    expect(isValidLocalDate("2026-13-01")).toBe(false);
    expect(isValidLocalDate("2026-00-10")).toBe(false);
    expect(isValidLocalDate("2026-01-00")).toBe(false);
    expect(isValidLocalDate("2026-01-32")).toBe(false);
    expect(isValidLocalDate("2026-1-5")).toBe(false);
    expect(isValidLocalDate("2026-01-05T10:00:00Z")).toBe(false);
    expect(isValidLocalDate("")).toBe(false);
  });

  it("the direct-sale validator delegates to the kernel (M-02 flip, 2026-10-08)", () => {
    expect(() => createDirectSale(directSaleInput("2024-02-29"))).not.toThrow();
    expect(() => createDirectSale(directSaleInput("2023-02-29"))).toThrow();
    expect(() =>
      createDirectSale(directSaleInput("0050-01-01")),
    ).not.toThrow(); /* كان يرمي — سياسة ISO (M-01) */
    expect(() => createDirectSale(directSaleInput("2026-13-01"))).toThrow();
  });
});

describe("R2 regression — every domain date class rejects rollover (M-04 flip, 2026-10-08)", () => {
  it("cash-continuity createCashContinuityEntry REJECTS rollover (was accepted, Class D)", () => {
    /* هذا عيب مثبت لا مواصفة: Date.parse("2023-02-29T12:00:00.000Z") يدور
     * إلى 2023-03-01 دون NaN فيمر الفحص. توحيده على صرامة النواة = قرار
     * مالك (R2-D3) لأنه يغيّر سلوك القبول. */
    expect(() => createCashContinuityEntry(cashEntryInput("2023-02-29"))).toThrow();
    expect(() => createCashContinuityEntry(cashEntryInput("2026-04-31"))).toThrow();
    /* خارج النحو يُرفض (regex): */
    expect(() => createCashContinuityEntry(cashEntryInput("2026-13-01"))).toThrow();
    expect(() => createCashContinuityEntry(cashEntryInput("0050-01-01"))).not.toThrow();
    /* السنوات 0000–0099 تمر في الصنف D أيضًا (المرساة ISO تقرؤها كما هي). */
  });

  it("supplier-purchase createSupplierPurchase REJECTS rollover dates (was accepted, Class D)", () => {
    expect(() => createSupplierPurchase(supplierPurchaseInput("2023-02-29"))).toThrow();
    expect(() => createSupplierPurchase(supplierPurchaseInput("2026-04-31"))).toThrow();
    expect(() => createSupplierPurchase(supplierPurchaseInput("2026-13-01"))).toThrow();
  });
});

describe("R2 characterization — businessTime kernel error identities (frozen contract)", () => {
  it("localDateInAmman throws 'Invalid instant' for invalid input; ammanDateOrNull returns null", () => {
    expect(() => localDateInAmman("ليس تاريخًا")).toThrow("Invalid instant");
    expect(ammanDateOrNull("ليس تاريخًا")).toBeNull();
    /* الهوية "Invalid instant" عقد مجمد (وحدة وقت الأعمال) — مثبتة أيضًا في
     * tests/domain/businessTime.test.ts وpresentation/businessTime.characterization.test.ts. */
  });

  it("localDateInAmman derives the Amman business date from an instant (UTC+3, fixed zone)", () => {
    /* 2026-10-07T21:30:00Z = 2026-10-08 00:30 بتوقيت عمّان — حد اليوم المحلي 21:00Z. */
    expect(localDateInAmman("2026-10-07T21:30:00.000Z")).toBe("2026-10-08");
    expect(localDateInAmman("2026-10-07T20:59:59.000Z")).toBe("2026-10-07");
  });
});
