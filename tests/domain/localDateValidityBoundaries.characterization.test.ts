import { describe, expect, it } from "vitest";
import { isValidLocalDate, localDateInAmman, ammanDateOrNull } from "../../src/domain/shared/index.js";
import { createDirectSale } from "../../src/domain/direct-sale/index.js";
import { createCashContinuityEntry } from "../../src/domain/cash-continuity/index.js";
import { createSupplierPurchase } from "../../src/domain/supplier-purchase/index.js";

/*
 * R2 (WS-216/ARCH-007 — المال/التنسيق/الإدخال/التاريخ/الرسائل): توصيف حدود
 * صلاحية التاريخ المحلي كما هي اليوم — لا مواصفة.
 *
 * هذا التوصيف يثبّت السلوك الحي لكل أصناف فحص التاريخ داخل المجال (جرد R2-MF-01 §5):
 * الصنف A (النواة `isValidLocalDate` + نسخها الحرفية عبر منشئات المجال) والصنف D
 * (regex+NaN الضعيف في cash-continuity/supplier-purchase) عند الحدود الحرجة:
 * السنوات 0000–0099 (النواة ترفضها: Date.UTC يعيد 0–99 إلى 1900+)، وتواريخ
 * الدوران (2023-02-29، 2026-04-31) التي يقبلها الصنف D وترفضها النواة.
 *
 * أي تغيير مستقبلي في هذه الحدود هو تغيير سلوك رفض/قبول محمي يتطلب قرار
 * مالك صريحًا عبر SEMANTIC_CHANGE_MANIFEST (قرارات R2-D1..D8 في بطاقات R2)
 * ويكسر هذه الاختبارات بوعي — لا صمتًا.
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

  it("rejects years 0000–0099 (Date.UTC remaps them to 1900+) — the R2-D1 divergence", () => {
    /* مثبت تشغيلًا في الجرد: Date.UTC(50, 0, 1).getUTCFullYear() === 1950 —
     * فالنواة ترفض كل السنوات ذات الخانتين الصفريتين الأوليين. */
    expect(isValidLocalDate("0050-01-01")).toBe(false);
    expect(isValidLocalDate("0000-01-01")).toBe(false);
    expect(isValidLocalDate("0099-12-31")).toBe(false);
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

  it("the verbatim Class-A copy in direct-sale createDirectSale matches the kernel", () => {
    expect(() => createDirectSale(directSaleInput("2024-02-29"))).not.toThrow();
    expect(() => createDirectSale(directSaleInput("2023-02-29"))).toThrow();
    expect(() => createDirectSale(directSaleInput("0050-01-01"))).toThrow();
    expect(() => createDirectSale(directSaleInput("2026-13-01"))).toThrow();
  });
});

describe("R2 characterization — weak Class D date checks accept rollover (the R2-D3 divergence)", () => {
  it("cash-continuity createCashContinuityEntry ACCEPTS 2023-02-29 (regex+NaN only)", () => {
    /* هذا عيب مثبت لا مواصفة: Date.parse("2023-02-29T12:00:00.000Z") يدور
     * إلى 2023-03-01 دون NaN فيمر الفحص. توحيده على صرامة النواة = قرار
     * مالك (R2-D3) لأنه يغيّر سلوك القبول. */
    expect(() => createCashContinuityEntry(cashEntryInput("2023-02-29"))).not.toThrow();
    expect(() => createCashContinuityEntry(cashEntryInput("2026-04-31"))).not.toThrow();
    /* خارج النحو يُرفض (regex): */
    expect(() => createCashContinuityEntry(cashEntryInput("2026-13-01"))).toThrow();
    expect(() => createCashContinuityEntry(cashEntryInput("0050-01-01"))).not.toThrow();
    /* السنوات 0000–0099 تمر في الصنف D أيضًا (المرساة ISO تقرؤها كما هي). */
  });

  it("supplier-purchase createSupplierPurchase ACCEPTS rollover dates (Class D)", () => {
    expect(() => createSupplierPurchase(supplierPurchaseInput("2023-02-29"))).not.toThrow();
    expect(() => createSupplierPurchase(supplierPurchaseInput("2026-04-31"))).not.toThrow();
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
