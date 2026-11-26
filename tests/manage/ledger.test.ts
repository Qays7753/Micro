/**
 * M2.2 (§4 + §3.8/INV-10 + §9/INV-4 — مانج-في₂، الموجة E): اختبارات سجل أنواع
 * قيود الدفتر `Q1`–`Q20` ودالة بناء القيد ورفض الخطأ
 * (`src/domain/manage/ledger/`).
 *  - لكل نوع من الأنواع العشرين: القيود الحرفية التي ينتجها (الحساب، المرجع،
 *    category لـEXP وrev_kind لـREV، إشارة المقدار ومقداره بالفلس) + معادلة
 *    التوازن §3.8 تساوي صفرًا على قيوده.
 *  - اختبار جدولي يقود الأنواع العشرين كلها: كل قيد متوازن (INV-10).
 *  - اختبار رفض لكل قاعدة رفض: نوع مجهول، ترحيل إلى حساب غير مسموح للنوع،
 *    مجموع غير صافٍ (معادلة §3.8 ≠ 0)، عكسُ عكسٍ (Q20 على Q20 —
 *    E-REVERSE-REVERSAL)، وأشكال §3.8 (delta ≠ 0، category لـEXP حصرًا
 *    بتعداد R-10، rev_kind لـREV حصرًا، شكل ref_id حسب الحساب، قاعدة
 *    الإشارة لكل حساب، reverses_entry_id على Q20 حصرًا) وقواعد مدخلات §4.
 *  - القيم المتوقعة من أمثلة §13/السيناريوهات نفسها (S1/S3/S4/S6/S7/S9،
 *    T5/T8/T13/T15/T16/T22/T25/T30/T38/T52) حيث يقع لها نوع قيد.
 *  - فحص مصدر: لا معادلة §8 داخل موديول الدفتر (المهمة: هذا الموديول يكتب
 *    القيود الصحيحة فقط) — لا مفردات معادلة ولا `*100`/`/100`.
 *  - إثبات البند المؤجَّل من M2.1: القيد السيئ (مجموعه غير صافٍ) يُرفض في
 *    الموديول قبل أي وصول إلى القاعدة — الموديول صرف خالص بلا I/O (§14.1).
 */
import { describe, expect, it } from "vitest";
import {
  LEDGER_ENTRY_TYPES,
  LEDGER_ENTRY_TYPE_IDS,
  buildLedgerEntry,
  entryBalanceDifferenceFils,
  isLedgerEntryTypeId,
  validateLedgerEntry,
} from "../../src/domain/manage/index.js";
import type {
  ExpenseCategory,
  LedgerEntryBuildInput,
  LedgerEntryDirection,
  LedgerEntryTypeId,
  LedgerPosting,
  RevenueKind,
} from "../../src/domain/manage/index.js";

const ledgerSources: Record<string, string> = import.meta.glob("../../src/domain/manage/ledger/**/*", {
  query: "?raw",
  import: "default",
  eager: true,
});

/* معرفات مرجعية مغلقة (الموديال لا يفحص شكل UUID — المرجع معتم عند التمرير) */
const CASH = "box-cash";
const ACCOUNT_BOX = "box-account";
const LINE = "line-1";
const LINE_REFUND = "line-refund";
const LINE_REM = "line-remainder";
const LINE_SUPPLIER = "line-supplier";
const LINE_BORROWED = "line-borrowed";
const LINE_LOAN = "line-loan";
const SALE = "sale-1";

/* ─── جداول السجل (مستوى الوحدة — لا داخل دوال) ─── */

const NAMES: Record<LedgerEntryTypeId, string> = {
  Q1: "Opening box balance",
  Q2: "Prior receivable",
  Q3: "Prior payable",
  Q4: "Prepayment",
  Q5: "Delivery",
  Q6: "Collection",
  Q7: "Payment",
  Q8: "Paid expense",
  Q9: "Credit expense",
  Q10: "Owner deposit",
  Q11: "Borrow",
  Q12: "Owner withdrawal",
  Q13: "Lend",
  Q14: "Transfer",
  Q15: "Cancel sale with prepayments",
  Q16: "Return",
  Q17: "Write-off",
  Q18: "Overpayment kept",
  Q19: "Reconciliation adjustment",
  Q20: "Reversal",
};

const DIRECTIONS: Record<LedgerEntryTypeId, LedgerEntryDirection> = {
  Q1: "in",
  Q2: "none",
  Q3: "none",
  Q4: "in",
  Q5: "none",
  Q6: "in",
  Q7: "out",
  Q8: "out",
  Q9: "none",
  Q10: "in",
  Q11: "in",
  Q12: "out",
  Q13: "out",
  Q14: "mixed",
  Q15: "out",
  Q16: "out",
  Q17: "none",
  Q18: "in",
  Q19: "mixed",
  Q20: "mixed",
};

const SIGN_RULES: Record<LedgerEntryTypeId, Record<string, string>> = {
  Q1: { BOX: "positive", OPEN: "positive" },
  Q2: { AR: "positive", OPEN: "positive" },
  Q3: { AP: "positive", OPEN: "negative" },
  Q4: { BOX: "positive", PRE: "positive" },
  Q5: { REV: "positive", PRE: "negative", AR: "positive", AP: "positive" },
  Q6: { BOX: "positive", AR: "negative" },
  Q7: { BOX: "negative", AP: "negative" },
  Q8: { BOX: "negative", EXP: "positive" },
  Q9: { AP: "positive", EXP: "positive" },
  Q10: { BOX: "positive", OWN_IN: "positive" },
  Q11: { BOX: "positive", AP: "positive" },
  Q12: { BOX: "negative", OWN_OUT: "positive" },
  Q13: { BOX: "negative", AR: "positive" },
  Q14: { BOX: "either" },
  Q15: { PRE: "negative", REV: "positive", BOX: "negative", AP: "positive" },
  Q16: { REV: "negative", AR: "negative", BOX: "negative", AP: "positive" },
  Q17: { AR: "negative", REV: "negative", OPEN: "negative", OWN_OUT: "positive" },
  Q18: { BOX: "positive", REV: "positive" },
  Q19: { BOX: "either", UNEXP: "either" },
  Q20: {
    BOX: "either",
    AR: "either",
    AP: "either",
    PRE: "either",
    REV: "either",
    EXP: "either",
    OPEN: "either",
    OWN_IN: "either",
    OWN_OUT: "either",
    UNEXP: "either",
  },
};

/** ترحيلان متوازنان كافيان لكل فحوص رفض البنية (قيد Q6 سليم). */
const balancedQ6Postings: LedgerPosting[] = [
  { account: "BOX", refId: CASH, deltaFils: 22000 },
  { account: "AR", refId: LINE, deltaFils: -22000 },
];

/** قيد Q8 معكوس لاحقًا في فحوص العكس (T5: مصروف 50). */
const q8Postings: LedgerPosting[] = [
  { account: "BOX", refId: CASH, deltaFils: -50000 },
  { account: "EXP", category: "utilities", deltaFils: 50000 },
];

describe("M2.2 السجل: الأنواع العشرين ومعرّفاتها (§4)", () => {
  it("يحوي الأنواع العشرين بالضبط وبالترتيب Q1…Q20", () => {
    expect([...LEDGER_ENTRY_TYPE_IDS]).toEqual(Array.from({ length: 20 }, (_, i) => `Q${i + 1}`));
    expect(Object.keys(LEDGER_ENTRY_TYPES)).toEqual([...LEDGER_ENTRY_TYPE_IDS]);
  });

  it("isLedgerEntryTypeId يقبل الأنواع العشرين ويرفض غيرها", () => {
    for (const id of LEDGER_ENTRY_TYPE_IDS) expect(isLedgerEntryTypeId(id)).toBe(true);
    expect(isLedgerEntryTypeId("Q21")).toBe(false);
    expect(isLedgerEntryTypeId("q1")).toBe(false);
    expect(isLedgerEntryTypeId("")).toBe(false);
  });
});

describe("M2.2 السجل: الاسم والاتجاه وقابلية العكس (§4)", () => {
  it("لكل نوع: id وname من §4، ومفاتيح قواعد الإشارة = الحسابات المسموحة", () => {
    for (const id of LEDGER_ENTRY_TYPE_IDS) {
      const spec = LEDGER_ENTRY_TYPES[id];
      expect(spec.id, `${id}.id`).toBe(id);
      expect(spec.name, `${id}.name`).toBe(NAMES[id]);
      expect(Object.keys(spec.signRules).sort(), `${id} signRules keys`).toEqual(
        [...spec.allowedAccounts].sort(),
      );
    }
  });

  it("direction لكل نوع = أثره على أرصدة الصناديق من ترحيلات §4 نفسها", () => {
    for (const id of LEDGER_ENTRY_TYPE_IDS) {
      expect(LEDGER_ENTRY_TYPES[id].direction, `${id}.direction`).toBe(DIRECTIONS[id]);
    }
  });

  it("reversible: Q1–Q19 قابلة للعكس وQ20 وحدها غير قابلة (E-REVERSE-REVERSAL)", () => {
    for (const id of LEDGER_ENTRY_TYPE_IDS) {
      expect(LEDGER_ENTRY_TYPES[id].reversible, `${id}.reversible`).toBe(id !== "Q20");
    }
  });
});

describe("M2.2 السجل: قواعد الإشارة الحرفية (§4)", () => {
  it("لكل حساب يرحّل إليه النوع إشارته الحرفية من §4", () => {
    for (const id of LEDGER_ENTRY_TYPE_IDS) {
      expect(LEDGER_ENTRY_TYPES[id].signRules, `${id}.signRules`).toEqual(SIGN_RULES[id]);
    }
  });

  it("Q20 يرحّل إلى الحسابات العشرة كلها (عكس أي نوع قابل للعكس)", () => {
    expect([...LEDGER_ENTRY_TYPES.Q20.allowedAccounts].sort()).toEqual(
      ["BOX", "AR", "AP", "PRE", "REV", "EXP", "OPEN", "OWN_IN", "OWN_OUT", "UNEXP"].sort(),
    );
  });
});

describe("M2.2 بناء Q1–Q2 (§4)", () => {
  it("Q1 — افتتاح صندوق (S1: 200 نقد): BOX +a وOPEN +a", () => {
    const entry = buildLedgerEntry({
      type: "Q1",
      effectiveOn: "2026-11-01",
      boxId: CASH,
      amountFils: 200000,
    });
    expect(entry.entryType).toBe("Q1");
    expect(entry.effectiveOn).toBe("2026-11-01");
    expect(entry.reversesEntryId).toBeUndefined();
    expect(entry.postings).toEqual([
      { account: "BOX", refId: CASH, deltaFils: 200000 },
      { account: "OPEN", deltaFils: 200000 },
    ]);
    expect(entryBalanceDifferenceFils(entry.postings)).toBe(0);
  });

  it("Q1 — a = 0 مسموح (§4: a ≥ 0): لا ترحيلات (الترحيل الصفري ممنوع بـ§3.8)", () => {
    const entry = buildLedgerEntry({
      type: "Q1",
      effectiveOn: "2026-11-01",
      boxId: CASH,
      amountFils: 0,
    });
    expect(entry.postings).toEqual([]);
    expect(entryBalanceDifferenceFils(entry.postings)).toBe(0);
  });

  it("Q2 — مستحق سابق (T38: 40): AR[L] +a وOPEN +a", () => {
    const entry = buildLedgerEntry({
      type: "Q2",
      effectiveOn: "2026-11-02",
      lineId: LINE,
      amountFils: 40000,
    });
    expect(entry.postings).toEqual([
      { account: "AR", refId: LINE, deltaFils: 40000 },
      { account: "OPEN", deltaFils: 40000 },
    ]);
    expect(entryBalanceDifferenceFils(entry.postings)).toBe(0);
  });
});

describe("M2.2 بناء Q3–Q4 (§4)", () => {
  it("Q3 — التزام سابق (T13: 70): AP[L] +a وOPEN −a", () => {
    const entry = buildLedgerEntry({
      type: "Q3",
      effectiveOn: "2026-11-02",
      lineId: LINE,
      amountFils: 70000,
    });
    expect(entry.postings).toEqual([
      { account: "AP", refId: LINE, deltaFils: 70000 },
      { account: "OPEN", deltaFils: -70000 },
    ]);
    expect(entryBalanceDifferenceFils(entry.postings)).toBe(0);
  });

  it("Q4 — عربون (S1: 50): BOX[k] +a وPRE[s] +a", () => {
    const entry = buildLedgerEntry({
      type: "Q4",
      effectiveOn: "2026-11-03",
      boxId: CASH,
      saleId: SALE,
      amountFils: 50000,
    });
    expect(entry.postings).toEqual([
      { account: "BOX", refId: CASH, deltaFils: 50000 },
      { account: "PRE", refId: SALE, deltaFils: 50000 },
    ]);
    expect(entryBalanceDifferenceFils(entry.postings)).toBe(0);
  });
});

describe("M2.2 بناء Q5 — التسليم والعربون (§4)", () => {
  it("السعر أكبر من العربون (S1: عربون 50، سعر 250): REV +P ثم PRE −p ثم AR[L] +(P−p)", () => {
    const entry = buildLedgerEntry({
      type: "Q5",
      effectiveOn: "2026-11-05",
      saleId: SALE,
      priceFils: 250000,
      prepaymentFils: 50000,
      remainderLineId: LINE_REM,
    });
    expect(entry.postings).toEqual([
      { account: "REV", refId: SALE, revKind: "delivery", deltaFils: 250000 },
      { account: "PRE", refId: SALE, deltaFils: -50000 },
      { account: "AR", refId: LINE_REM, deltaFils: 200000 },
    ]);
    expect(entryBalanceDifferenceFils(entry.postings)).toBe(0);
  });

  it("العربون أكبر من السعر (p > P): PRE −p وAP[L] +(p−P)", () => {
    const entry = buildLedgerEntry({
      type: "Q5",
      effectiveOn: "2026-11-05",
      saleId: SALE,
      priceFils: 50000,
      prepaymentFils: 120000,
      refundLineId: LINE_REFUND,
    });
    expect(entry.postings).toEqual([
      { account: "REV", refId: SALE, revKind: "delivery", deltaFils: 50000 },
      { account: "PRE", refId: SALE, deltaFils: -120000 },
      { account: "AP", refId: LINE_REFUND, deltaFils: 70000 },
    ]);
    expect(entryBalanceDifferenceFils(entry.postings)).toBe(0);
  });
});

describe("M2.2 بناء Q5 — حالات الحد (§4)", () => {
  it("بلا عربون (p = 0): REV +P وAR[L] +P فقط", () => {
    const entry = buildLedgerEntry({
      type: "Q5",
      effectiveOn: "2026-11-05",
      saleId: SALE,
      priceFils: 250000,
      prepaymentFils: 0,
      remainderLineId: LINE_REM,
    });
    expect(entry.postings).toEqual([
      { account: "REV", refId: SALE, revKind: "delivery", deltaFils: 250000 },
      { account: "AR", refId: LINE_REM, deltaFils: 250000 },
    ]);
    expect(entryBalanceDifferenceFils(entry.postings)).toBe(0);
  });

  it("العربون يساوي السعر (p = P): REV +P وPRE −p بلا سطر جديد", () => {
    const entry = buildLedgerEntry({
      type: "Q5",
      effectiveOn: "2026-11-05",
      saleId: SALE,
      priceFils: 250000,
      prepaymentFils: 250000,
    });
    expect(entry.postings).toEqual([
      { account: "REV", refId: SALE, revKind: "delivery", deltaFils: 250000 },
      { account: "PRE", refId: SALE, deltaFils: -250000 },
    ]);
    expect(entryBalanceDifferenceFils(entry.postings)).toBe(0);
  });
});

describe("M2.2 بناء Q6–Q9 (§4)", () => {
  it("Q6 — تحصيل (T52: 22): BOX[k] +a وAR[L] −a", () => {
    const entry = buildLedgerEntry({
      type: "Q6",
      effectiveOn: "2026-11-06",
      boxId: CASH,
      lineId: LINE,
      amountFils: 22000,
    });
    expect(entry.postings).toEqual([
      { account: "BOX", refId: CASH, deltaFils: 22000 },
      { account: "AR", refId: LINE, deltaFils: -22000 },
    ]);
    expect(entryBalanceDifferenceFils(entry.postings)).toBe(0);
  });

  it("Q7 — سداد (T13: التزام سابق 70): BOX[k] −a وAP[L] −a", () => {
    const entry = buildLedgerEntry({
      type: "Q7",
      effectiveOn: "2026-11-06",
      boxId: CASH,
      lineId: LINE,
      amountFils: 70000,
    });
    expect(entry.postings).toEqual([
      { account: "BOX", refId: CASH, deltaFils: -70000 },
      { account: "AP", refId: LINE, deltaFils: -70000 },
    ]);
    expect(entryBalanceDifferenceFils(entry.postings)).toBe(0);
  });

  it("Q8 — مصروف مدفوع (T30: مواد 12 + توصيل 2 = 14): BOX[k] −t وEXP[materials_packaging] +t", () => {
    const entry = buildLedgerEntry({
      type: "Q8",
      effectiveOn: "2026-11-07",
      boxId: CASH,
      category: "materials_packaging",
      amountFils: 14000,
    });
    expect(entry.postings).toEqual([
      { account: "BOX", refId: CASH, deltaFils: -14000 },
      { account: "EXP", category: "materials_packaging", deltaFils: 14000 },
    ]);
    expect(entryBalanceDifferenceFils(entry.postings)).toBe(0);
  });

  it("Q9 — مصروف بالأجل (T16: مواد 120): AP[L] +t وEXP[materials_packaging] +t", () => {
    const entry = buildLedgerEntry({
      type: "Q9",
      effectiveOn: "2026-11-07",
      lineId: LINE_SUPPLIER,
      category: "materials_packaging",
      amountFils: 120000,
    });
    expect(entry.postings).toEqual([
      { account: "AP", refId: LINE_SUPPLIER, deltaFils: 120000 },
      { account: "EXP", category: "materials_packaging", deltaFils: 120000 },
    ]);
    expect(entryBalanceDifferenceFils(entry.postings)).toBe(0);
  });
});

describe("M2.2 بناء Q10–Q12 (§4)", () => {
  it("Q10 — إيداع مالك (R-18/T15: بنزين 15 من مال شخصي): BOX[k] +a وOWN_IN +a", () => {
    const entry = buildLedgerEntry({
      type: "Q10",
      effectiveOn: "2026-11-08",
      boxId: CASH,
      amountFils: 15000,
    });
    expect(entry.postings).toEqual([
      { account: "BOX", refId: CASH, deltaFils: 15000 },
      { account: "OWN_IN", deltaFils: 15000 },
    ]);
    expect(entryBalanceDifferenceFils(entry.postings)).toBe(0);
  });

  it("Q11 — اقتراض (S6: 50): BOX[k] +a وAP[L] +a", () => {
    const entry = buildLedgerEntry({
      type: "Q11",
      effectiveOn: "2026-11-08",
      boxId: CASH,
      lineId: LINE_BORROWED,
      amountFils: 50000,
    });
    expect(entry.postings).toEqual([
      { account: "BOX", refId: CASH, deltaFils: 50000 },
      { account: "AP", refId: LINE_BORROWED, deltaFils: 50000 },
    ]);
    expect(entryBalanceDifferenceFils(entry.postings)).toBe(0);
  });

  it("Q12 — سحب مالك (S9: 200): BOX[k] −a وOWN_OUT +a", () => {
    const entry = buildLedgerEntry({
      type: "Q12",
      effectiveOn: "2026-11-08",
      boxId: CASH,
      amountFils: 200000,
    });
    expect(entry.postings).toEqual([
      { account: "BOX", refId: CASH, deltaFils: -200000 },
      { account: "OWN_OUT", deltaFils: 200000 },
    ]);
    expect(entryBalanceDifferenceFils(entry.postings)).toBe(0);
  });
});

describe("M2.2 بناء Q13–Q14 (§4)", () => {
  it("Q13 — إقراض (T25: 50): BOX[k] −a وAR[L] +a", () => {
    const entry = buildLedgerEntry({
      type: "Q13",
      effectiveOn: "2026-11-08",
      boxId: CASH,
      lineId: LINE_LOAN,
      amountFils: 50000,
    });
    expect(entry.postings).toEqual([
      { account: "BOX", refId: CASH, deltaFils: -50000 },
      { account: "AR", refId: LINE_LOAN, deltaFils: 50000 },
    ]);
    expect(entryBalanceDifferenceFils(entry.postings)).toBe(0);
  });

  it("Q14 — تحويل بين صندوقين (60): BOX[k1] −a وBOX[k2] +a", () => {
    const entry = buildLedgerEntry({
      type: "Q14",
      effectiveOn: "2026-11-09",
      fromBoxId: CASH,
      toBoxId: ACCOUNT_BOX,
      amountFils: 60000,
    });
    expect(entry.postings).toEqual([
      { account: "BOX", refId: CASH, deltaFils: -60000 },
      { account: "BOX", refId: ACCOUNT_BOX, deltaFils: 60000 },
    ]);
    expect(entryBalanceDifferenceFils(entry.postings)).toBe(0);
  });
});

describe("M2.2 بناء Q15 — الإلغاء مع دفعات مقدمة: الحدّان (§4، S3)", () => {
  it("S3أ — الاحتفاظ كاملًا (عربون 30): PRE −m وREV +m فقط", () => {
    const entry = buildLedgerEntry({
      type: "Q15",
      effectiveOn: "2026-11-10",
      saleId: SALE,
      prepaymentFils: 30000,
      keptFils: 30000,
      refund: { mode: "none" },
    });
    expect(entry.postings).toEqual([
      { account: "PRE", refId: SALE, deltaFils: -30000 },
      { account: "REV", refId: SALE, revKind: "kept_prepayment", deltaFils: 30000 },
    ]);
    expect(entryBalanceDifferenceFils(entry.postings)).toBe(0);
  });

  it("S3ب — إرجاع فوري كامل (عربون 30): BOX −p وPRE −p", () => {
    const entry = buildLedgerEntry({
      type: "Q15",
      effectiveOn: "2026-11-10",
      saleId: SALE,
      prepaymentFils: 30000,
      keptFils: 0,
      refund: { mode: "now", boxId: CASH },
    });
    expect(entry.postings).toEqual([
      { account: "BOX", refId: CASH, deltaFils: -30000 },
      { account: "PRE", refId: SALE, deltaFils: -30000 },
    ]);
    expect(entryBalanceDifferenceFils(entry.postings)).toBe(0);
  });
});

describe("M2.2 بناء Q15 — الاحتفاظ الجزئي (p=50، m=30) (§4)", () => {
  it("إرجاع فوري للباقي: PRE −m وREV +m ثم BOX −r وPRE −r", () => {
    const entry = buildLedgerEntry({
      type: "Q15",
      effectiveOn: "2026-11-10",
      saleId: SALE,
      prepaymentFils: 50000,
      keptFils: 30000,
      refund: { mode: "now", boxId: CASH },
    });
    expect(entry.postings).toEqual([
      { account: "PRE", refId: SALE, deltaFils: -30000 },
      { account: "REV", refId: SALE, revKind: "kept_prepayment", deltaFils: 30000 },
      { account: "BOX", refId: CASH, deltaFils: -20000 },
      { account: "PRE", refId: SALE, deltaFils: -20000 },
    ]);
    expect(entryBalanceDifferenceFils(entry.postings)).toBe(0);
  });

  it("إرجاع لاحق للباقي: PRE −m وREV +m ثم PRE −r وAP[L] +r", () => {
    const entry = buildLedgerEntry({
      type: "Q15",
      effectiveOn: "2026-11-10",
      saleId: SALE,
      prepaymentFils: 50000,
      keptFils: 30000,
      refund: { mode: "later", lineId: LINE_REFUND },
    });
    expect(entry.postings).toEqual([
      { account: "PRE", refId: SALE, deltaFils: -30000 },
      { account: "REV", refId: SALE, revKind: "kept_prepayment", deltaFils: 30000 },
      { account: "PRE", refId: SALE, deltaFils: -20000 },
      { account: "AP", refId: LINE_REFUND, deltaFils: 20000 },
    ]);
    expect(entryBalanceDifferenceFils(entry.postings)).toBe(0);
  });
});

describe("M2.2 بناء Q16 — الإرجاع (§4)", () => {
  it("S4 — إرجاع كامل لبيع مباشر مقبوض (80، لا مستحق): REV −r وBOX −r", () => {
    const entry = buildLedgerEntry({
      type: "Q16",
      effectiveOn: "2026-11-11",
      saleId: SALE,
      returnFils: 80000,
      remainderOutstandingFils: 0,
      refund: { mode: "now", boxId: CASH },
    });
    expect(entry.postings).toEqual([
      { account: "REV", refId: SALE, revKind: "return", deltaFils: -80000 },
      { account: "BOX", refId: CASH, deltaFils: -80000 },
    ]);
    expect(entryBalanceDifferenceFils(entry.postings)).toBe(0);
  });

  it("إرجاع جزئي مع مستحق (r=8، x=5) واسترداد فوري: REV −r وAR[L_rem] −x ثم BOX −y", () => {
    const entry = buildLedgerEntry({
      type: "Q16",
      effectiveOn: "2026-11-11",
      saleId: SALE,
      returnFils: 8000,
      remainderLineId: LINE_REM,
      remainderOutstandingFils: 5000,
      refund: { mode: "now", boxId: CASH },
    });
    expect(entry.postings).toEqual([
      { account: "REV", refId: SALE, revKind: "return", deltaFils: -8000 },
      { account: "AR", refId: LINE_REM, deltaFils: -5000 },
      { account: "BOX", refId: CASH, deltaFils: -3000 },
    ]);
    expect(entryBalanceDifferenceFils(entry.postings)).toBe(0);
  });
});

describe("M2.2 بناء Q16 — الاسترداد اللاحق والإكمال (§4)", () => {
  it("استرداد لاحق (y > 0): REV −r وAR[L_rem] −x ثم AP[L] +y", () => {
    const entry = buildLedgerEntry({
      type: "Q16",
      effectiveOn: "2026-11-11",
      saleId: SALE,
      returnFils: 8000,
      remainderLineId: LINE_REM,
      remainderOutstandingFils: 5000,
      refund: { mode: "later", lineId: LINE_REFUND },
    });
    expect(entry.postings).toEqual([
      { account: "REV", refId: SALE, revKind: "return", deltaFils: -8000 },
      { account: "AR", refId: LINE_REM, deltaFils: -5000 },
      { account: "AP", refId: LINE_REFUND, deltaFils: 3000 },
    ]);
    expect(entryBalanceDifferenceFils(entry.postings)).toBe(0);
  });

  it("الإرجاع يساوي المستحق كاملًا (x = r): REV −r وAR[L_rem] −r بلا استرداد", () => {
    const entry = buildLedgerEntry({
      type: "Q16",
      effectiveOn: "2026-11-11",
      saleId: SALE,
      returnFils: 8000,
      remainderLineId: LINE_REM,
      remainderOutstandingFils: 8000,
      refund: { mode: "none" },
    });
    expect(entry.postings).toEqual([
      { account: "REV", refId: SALE, revKind: "return", deltaFils: -8000 },
      { account: "AR", refId: LINE_REM, deltaFils: -8000 },
    ]);
    expect(entryBalanceDifferenceFils(entry.postings)).toBe(0);
  });
});

describe("M2.2 بناء Q17 — الشطب حسب نوع السطر (§4)", () => {
  it("باقي بيع (T22: 3): AR[L] −a وREV[s] −a بrev_kind=write_off", () => {
    const entry = buildLedgerEntry({
      type: "Q17",
      effectiveOn: "2026-11-12",
      lineId: LINE_REM,
      lineKind: "sale_remainder",
      saleId: SALE,
      amountFils: 3000,
    });
    expect(entry.postings).toEqual([
      { account: "AR", refId: LINE_REM, deltaFils: -3000 },
      { account: "REV", refId: SALE, revKind: "write_off", deltaFils: -3000 },
    ]);
    expect(entryBalanceDifferenceFils(entry.postings)).toBe(0);
  });

  it("مستحق سابق: AR[L] −a وOPEN −a", () => {
    const entry = buildLedgerEntry({
      type: "Q17",
      effectiveOn: "2026-11-12",
      lineId: LINE,
      lineKind: "prior_receivable",
      amountFils: 10000,
    });
    expect(entry.postings).toEqual([
      { account: "AR", refId: LINE, deltaFils: -10000 },
      { account: "OPEN", deltaFils: -10000 },
    ]);
    expect(entryBalanceDifferenceFils(entry.postings)).toBe(0);
  });

  it("قرض (T25: 50): AR[L] −a وOWN_OUT +a", () => {
    const entry = buildLedgerEntry({
      type: "Q17",
      effectiveOn: "2026-11-12",
      lineId: LINE_LOAN,
      lineKind: "loan_given",
      amountFils: 50000,
    });
    expect(entry.postings).toEqual([
      { account: "AR", refId: LINE_LOAN, deltaFils: -50000 },
      { account: "OWN_OUT", deltaFils: 50000 },
    ]);
    expect(entryBalanceDifferenceFils(entry.postings)).toBe(0);
  });
});

describe("M2.2 بناء Q18–Q19 (§4)", () => {
  it("Q18 — الاحتفاظ بالزيادة (e=5): BOX[k] +e وREV[s] +e بrev_kind=overpayment", () => {
    const entry = buildLedgerEntry({
      type: "Q18",
      effectiveOn: "2026-11-12",
      boxId: CASH,
      saleId: SALE,
      excessFils: 5000,
    });
    expect(entry.postings).toEqual([
      { account: "BOX", refId: CASH, deltaFils: 5000 },
      { account: "REV", refId: SALE, revKind: "overpayment", deltaFils: 5000 },
    ]);
    expect(entryBalanceDifferenceFils(entry.postings)).toBe(0);
  });

  it("Q19 — تسوية سالبة (S7: مسجّل 340، معدود 300): BOX[k] +diff وUNEXP +diff", () => {
    const entry = buildLedgerEntry({
      type: "Q19",
      effectiveOn: "2026-11-13",
      boxId: CASH,
      differenceFils: -40000,
    });
    expect(entry.postings).toEqual([
      { account: "BOX", refId: CASH, deltaFils: -40000 },
      { account: "UNEXP", deltaFils: -40000 },
    ]);
    expect(entryBalanceDifferenceFils(entry.postings)).toBe(0);
  });

  it("Q19 — تسوية موجبة (+7): BOX[k] +diff وUNEXP +diff", () => {
    const entry = buildLedgerEntry({
      type: "Q19",
      effectiveOn: "2026-11-13",
      boxId: CASH,
      differenceFils: 7000,
    });
    expect(entry.postings).toEqual([
      { account: "BOX", refId: CASH, deltaFils: 7000 },
      { account: "UNEXP", deltaFils: 7000 },
    ]);
    expect(entryBalanceDifferenceFils(entry.postings)).toBe(0);
  });
});

describe("M2.2 بناء Q20 — العكس (§4، T52)", () => {
  it("عكس تحصيل (Q6 بقيمة 22): كل ترحيلات q بإشارة معكوسة، بتاريخ q وreverses_entry_id = q.id", () => {
    const q6 = buildLedgerEntry({
      type: "Q6",
      effectiveOn: "2026-11-06",
      boxId: CASH,
      lineId: LINE,
      amountFils: 22000,
    });
    const reversal = buildLedgerEntry({
      type: "Q20",
      reversed: { id: "entry-q6-1", entryType: "Q6", effectiveOn: q6.effectiveOn, postings: q6.postings },
    });
    expect(reversal.entryType).toBe("Q20");
    expect(reversal.effectiveOn).toBe(q6.effectiveOn);
    expect(reversal.reversesEntryId).toBe("entry-q6-1");
    expect(reversal.postings).toEqual([
      { account: "BOX", refId: CASH, deltaFils: -22000 },
      { account: "AR", refId: LINE, deltaFils: 22000 },
    ]);
    expect(entryBalanceDifferenceFils(reversal.postings)).toBe(0);
    /* INV-4: القيد وعكسه يتصفّيان على كل حساب */
    const net = new Map<string, number>();
    for (const posting of [...q6.postings, ...reversal.postings]) {
      net.set(posting.account, (net.get(posting.account) ?? 0) + posting.deltaFils);
    }
    for (const sum of net.values()) expect(sum).toBe(0);
  });

  it("عكس مصروف بفئة (T5: مصروف أكتوبر 50): BOX +a وEXP[c] −a بتاريخ q", () => {
    const reversal = buildLedgerEntry({
      type: "Q20",
      reversed: { id: "entry-q8-1", entryType: "Q8", effectiveOn: "2026-10-14", postings: q8Postings },
    });
    expect(reversal.effectiveOn).toBe("2026-10-14");
    expect(reversal.postings).toEqual([
      { account: "BOX", refId: CASH, deltaFils: 50000 },
      { account: "EXP", category: "utilities", deltaFils: -50000 },
    ]);
    expect(entryBalanceDifferenceFils(reversal.postings)).toBe(0);
  });
});

/* ─── الجدول الشامل: حالة لكل نوع (وأخرى لفروع المركّبة) — مستوى الوحدة ─── */

const balancedCases: ReadonlyArray<[string, LedgerEntryBuildInput]> = [
  ["Q1", { type: "Q1", effectiveOn: "2026-11-01", boxId: CASH, amountFils: 200000 }],
  ["Q2", { type: "Q2", effectiveOn: "2026-11-02", lineId: LINE, amountFils: 40000 }],
  ["Q3", { type: "Q3", effectiveOn: "2026-11-02", lineId: LINE, amountFils: 70000 }],
  ["Q4", { type: "Q4", effectiveOn: "2026-11-03", boxId: CASH, saleId: SALE, amountFils: 50000 }],
  [
    "Q5",
    {
      type: "Q5",
      effectiveOn: "2026-11-05",
      saleId: SALE,
      priceFils: 250000,
      prepaymentFils: 50000,
      remainderLineId: LINE_REM,
    },
  ],
  ["Q6", { type: "Q6", effectiveOn: "2026-11-06", boxId: CASH, lineId: LINE, amountFils: 22000 }],
  ["Q7", { type: "Q7", effectiveOn: "2026-11-06", boxId: CASH, lineId: LINE, amountFils: 70000 }],
  ["Q8", { type: "Q8", effectiveOn: "2026-11-07", boxId: CASH, category: "gas", amountFils: 15000 }],
  [
    "Q9",
    {
      type: "Q9",
      effectiveOn: "2026-11-07",
      lineId: LINE_SUPPLIER,
      category: "materials_packaging",
      amountFils: 120000,
    },
  ],
  ["Q10", { type: "Q10", effectiveOn: "2026-11-08", boxId: CASH, amountFils: 15000 }],
  ["Q11", { type: "Q11", effectiveOn: "2026-11-08", boxId: CASH, lineId: LINE_BORROWED, amountFils: 50000 }],
  ["Q12", { type: "Q12", effectiveOn: "2026-11-08", boxId: CASH, amountFils: 200000 }],
  ["Q13", { type: "Q13", effectiveOn: "2026-11-08", boxId: CASH, lineId: LINE_LOAN, amountFils: 50000 }],
  [
    "Q14",
    { type: "Q14", effectiveOn: "2026-11-09", fromBoxId: CASH, toBoxId: ACCOUNT_BOX, amountFils: 60000 },
  ],
  [
    "Q15 الآن",
    {
      type: "Q15",
      effectiveOn: "2026-11-10",
      saleId: SALE,
      prepaymentFils: 50000,
      keptFils: 30000,
      refund: { mode: "now", boxId: CASH },
    },
  ],
  [
    "Q15 لاحقًا",
    {
      type: "Q15",
      effectiveOn: "2026-11-10",
      saleId: SALE,
      prepaymentFils: 50000,
      keptFils: 30000,
      refund: { mode: "later", lineId: LINE_REFUND },
    },
  ],
  [
    "Q16",
    {
      type: "Q16",
      effectiveOn: "2026-11-11",
      saleId: SALE,
      returnFils: 8000,
      remainderLineId: LINE_REM,
      remainderOutstandingFils: 5000,
      refund: { mode: "later", lineId: LINE_REFUND },
    },
  ],
  [
    "Q17",
    {
      type: "Q17",
      effectiveOn: "2026-11-12",
      lineId: LINE_REM,
      lineKind: "sale_remainder",
      saleId: SALE,
      amountFils: 3000,
    },
  ],
  ["Q18", { type: "Q18", effectiveOn: "2026-11-12", boxId: CASH, saleId: SALE, excessFils: 5000 }],
  ["Q19", { type: "Q19", effectiveOn: "2026-11-13", boxId: CASH, differenceFils: -40000 }],
  [
    "Q20",
    {
      type: "Q20",
      reversed: { id: "entry-q8-1", entryType: "Q8", effectiveOn: "2026-10-14", postings: q8Postings },
    },
  ],
];

describe("M2.2 الجدول الشامل: كل ما ينتجه الباني متوازن (§3.8/INV-10)", () => {
  it("كل حالة جدولية تنتج قيدًا معادلة §3.8 عليه صفر", () => {
    for (const [label, input] of balancedCases) {
      const entry = buildLedgerEntry(input);
      expect(entryBalanceDifferenceFils(entry.postings), `${label} — معادلة §3.8`).toBe(0);
    }
  });

  it("الأنواع العشرون كلها ممثلة في الجدول (كل نوع مرة على الأقل)", () => {
    const covered = new Set(balancedCases.map(([, input]) => input.type));
    for (const id of LEDGER_ENTRY_TYPE_IDS) expect(covered.has(id)).toBe(true);
  });
});

describe("M2.2 الرفض: النوع المجهول والتاريخ (§4/§3.8)", () => {
  it("يرفض نوع القيد المجهول خارج Q1–Q20", () => {
    expect(() =>
      validateLedgerEntry({ entryType: "Q21", effectiveOn: "2026-11-26", postings: balancedQ6Postings }),
    ).toThrow(/Q21/);
    expect(() => validateLedgerEntry({ entryType: "q1", effectiveOn: "2026-11-26", postings: [] })).toThrow(
      /q1/,
    );
    expect(() => validateLedgerEntry({ entryType: "", effectiveOn: "2026-11-26", postings: [] })).toThrow();
    /* الحرس التشغيلي في الباني نفسه (مدخل غير مُدقَّق الأنواع وقت التشغيل) */
    expect(() => buildLedgerEntry({ type: "Q99" } as unknown as LedgerEntryBuildInput)).toThrow(/Q99/);
  });

  it("يرفض التاريخ الفارغ للقيد (§3.8: effective_on NOT NULL)", () => {
    for (const effectiveOn of ["", "   "]) {
      expect(() =>
        validateLedgerEntry({ entryType: "Q6", effectiveOn, postings: balancedQ6Postings }),
      ).toThrow();
    }
  });
});

describe("M2.2 الرفض: الحساب غير المسموح والإشارة المخالفة (§4)", () => {
  it("يرفض الترحيل إلى حساب لا يسمح به النوع", () => {
    expect(() =>
      validateLedgerEntry({
        entryType: "Q6",
        effectiveOn: "2026-11-06",
        postings: [
          { account: "BOX", refId: CASH, deltaFils: 22000 },
          { account: "AR", refId: LINE, deltaFils: -22000 },
          { account: "EXP", category: "gas", deltaFils: 5000 },
        ],
      }),
    ).toThrow(/EXP/);
    expect(() =>
      validateLedgerEntry({
        entryType: "Q2",
        effectiveOn: "2026-11-02",
        postings: [
          { account: "AR", refId: LINE, deltaFils: 40000 },
          { account: "OPEN", deltaFils: 40000 },
          { account: "BOX", refId: CASH, deltaFils: 1000 },
        ],
      }),
    ).toThrow(/BOX/);
  });

  it("يرفض مخالفة قاعدة إشارة النوع (قيد متوازن بإشارة معكوسة على Q6)", () => {
    expect(() =>
      validateLedgerEntry({
        entryType: "Q6",
        effectiveOn: "2026-11-06",
        postings: [
          { account: "BOX", refId: CASH, deltaFils: -22000 },
          { account: "AR", refId: LINE, deltaFils: 22000 },
        ],
      }),
    ).toThrow();
  });
});

describe("M2.2 الرفض: مقدار الترحيل (§3.8)", () => {
  it("يرفض المقدار الصفري", () => {
    expect(() =>
      validateLedgerEntry({
        entryType: "Q6",
        effectiveOn: "2026-11-06",
        postings: [
          { account: "BOX", refId: CASH, deltaFils: 0 },
          { account: "AR", refId: LINE, deltaFils: 0 },
        ],
      }),
    ).toThrow();
  });

  it("يرفض المقدار غير العدد الصحيح الآمن (فلس صحيح آمن حصرًا)", () => {
    expect(() =>
      validateLedgerEntry({
        entryType: "Q6",
        effectiveOn: "2026-11-06",
        postings: [
          { account: "BOX", refId: CASH, deltaFils: 22.5 },
          { account: "AR", refId: LINE, deltaFils: -22.5 },
        ],
      }),
    ).toThrow();
  });
});

describe("M2.2 الرفض: فئة المصروف (§3.8/R-10)", () => {
  it("يرفض EXP بلا فئة أو بفئة خارج تعداد R-10، وفئةً على حساب ليس EXP", () => {
    expect(() =>
      validateLedgerEntry({
        entryType: "Q8",
        effectiveOn: "2026-11-07",
        postings: [
          { account: "BOX", refId: CASH, deltaFils: -14000 },
          { account: "EXP", deltaFils: 14000 },
        ],
      }),
    ).toThrow();
    expect(() =>
      validateLedgerEntry({
        entryType: "Q8",
        effectiveOn: "2026-11-07",
        postings: [
          { account: "BOX", refId: CASH, deltaFils: -14000 },
          { account: "EXP", category: "food" as ExpenseCategory, deltaFils: 14000 },
        ],
      }),
    ).toThrow();
    expect(() =>
      validateLedgerEntry({
        entryType: "Q6",
        effectiveOn: "2026-11-06",
        postings: [
          { account: "BOX", refId: CASH, category: "gas", deltaFils: 22000 },
          { account: "AR", refId: LINE, deltaFils: -22000 },
        ],
      }),
    ).toThrow();
  });
});

describe("M2.2 الرفض: نوع الإيراد (§3.8)", () => {
  it("يرفض REV بلا rev_kind أو بقيمة خارج تعداده، وrev_kind على حساب ليس REV", () => {
    expect(() =>
      validateLedgerEntry({
        entryType: "Q18",
        effectiveOn: "2026-11-12",
        postings: [
          { account: "BOX", refId: CASH, deltaFils: 5000 },
          { account: "REV", refId: SALE, deltaFils: 5000 },
        ],
      }),
    ).toThrow();
    expect(() =>
      validateLedgerEntry({
        entryType: "Q18",
        effectiveOn: "2026-11-12",
        postings: [
          { account: "BOX", refId: CASH, deltaFils: 5000 },
          { account: "REV", refId: SALE, revKind: "bonus" as RevenueKind, deltaFils: 5000 },
        ],
      }),
    ).toThrow();
    expect(() =>
      validateLedgerEntry({
        entryType: "Q6",
        effectiveOn: "2026-11-06",
        postings: [
          { account: "BOX", refId: CASH, deltaFils: 22000 },
          { account: "AR", refId: LINE, revKind: "delivery", deltaFils: -22000 },
        ],
      }),
    ).toThrow();
  });
});

describe("M2.2 الرفض: شكل المرجع حسب الحساب (§3.8)", () => {
  it("يرفض ref_id الناقص لحساب يوجبه وref_id الزائد لحساب يمنعه", () => {
    expect(() =>
      validateLedgerEntry({
        entryType: "Q6",
        effectiveOn: "2026-11-06",
        postings: [
          { account: "BOX", deltaFils: 22000 },
          { account: "AR", refId: LINE, deltaFils: -22000 },
        ],
      }),
    ).toThrow();
    expect(() =>
      validateLedgerEntry({
        entryType: "Q1",
        effectiveOn: "2026-11-01",
        postings: [
          { account: "BOX", refId: CASH, deltaFils: 200000 },
          { account: "OPEN", refId: CASH, deltaFils: 200000 },
        ],
      }),
    ).toThrow();
  });
});

describe("M2.2 الرفض: معادلة التوازن (§3.8/INV-10 — البند المؤجَّل من M2.1)", () => {
  it("يرفض القيد الذي لا يتصفّى على المعادلة قبل أي وصول إلى القاعدة", () => {
    /* افتتاح مبتور: LHS=200000 مقابل RHS=100000 */
    expect(() =>
      validateLedgerEntry({
        entryType: "Q1",
        effectiveOn: "2026-11-01",
        postings: [
          { account: "BOX", refId: CASH, deltaFils: 200000 },
          { account: "OPEN", deltaFils: 100000 },
        ],
      }),
    ).toThrow();
    /* عربون مبتور: LHS=25000 مقابل RHS=0 */
    expect(() =>
      validateLedgerEntry({
        entryType: "Q4",
        effectiveOn: "2026-11-03",
        postings: [
          { account: "BOX", refId: CASH, deltaFils: 50000 },
          { account: "PRE", refId: SALE, deltaFils: 25000 },
        ],
      }),
    ).toThrow();
  });
});

describe("M2.2 الرفض: عكس العكس (§5)", () => {
  it("يرفض Q20 على قيد هو نفسه Q20 (E-REVERSE-REVERSAL)", () => {
    const q20Postings: LedgerPosting[] = [
      { account: "BOX", refId: CASH, deltaFils: -22000 },
      { account: "AR", refId: LINE, deltaFils: 22000 },
    ];
    expect(() =>
      buildLedgerEntry({
        type: "Q20",
        reversed: { id: "entry-q20-1", entryType: "Q20", effectiveOn: "2026-11-06", postings: q20Postings },
      }),
    ).toThrow(/E-REVERSE-REVERSAL/);
    expect(() =>
      validateLedgerEntry({
        entryType: "Q20",
        effectiveOn: "2026-11-06",
        reversesEntryId: "entry-q20-1",
        reversedEntryType: "Q20",
        postings: q20Postings,
      }),
    ).toThrow(/E-REVERSE-REVERSAL/);
  });
});

describe("M2.2 الرفض: شكل العكس والمعكوس المفسد (§3.8)", () => {
  it("يرفض Q20 بلا هدف معروف وبلا reverses_entry_id، وغير Q20 وفيه عمود العكس", () => {
    expect(() =>
      validateLedgerEntry({
        entryType: "Q20",
        effectiveOn: "2026-11-06",
        reversesEntryId: "entry-q6-1",
        postings: balancedQ6Postings,
      }),
    ).toThrow();
    expect(() =>
      validateLedgerEntry({
        entryType: "Q20",
        effectiveOn: "2026-11-06",
        reversedEntryType: "Q6",
        postings: balancedQ6Postings,
      }),
    ).toThrow();
    expect(() =>
      validateLedgerEntry({
        entryType: "Q20",
        effectiveOn: "2026-11-06",
        reversesEntryId: "entry-q6-1",
        reversedEntryType: "Q21",
        postings: balancedQ6Postings,
      }),
    ).toThrow();
    expect(() =>
      validateLedgerEntry({
        entryType: "Q6",
        effectiveOn: "2026-11-06",
        reversesEntryId: "entry-q6-1",
        postings: balancedQ6Postings,
      }),
    ).toThrow();
  });

  it("يرفض عكس قيد مفسد (ترحيلات المعكوس تُعاد فحوصها فشلًا مغلقًا)", () => {
    expect(() =>
      buildLedgerEntry({
        type: "Q20",
        reversed: {
          id: "entry-q6-1",
          entryType: "Q6",
          effectiveOn: "2026-11-06",
          postings: [{ account: "BOX", refId: CASH, deltaFils: 1 }],
        },
      }),
    ).toThrow();
  });
});

describe("M2.2 الرفض: مقادير §4 غير الموجبة (الأنواع البسيطة)", () => {
  it("يرفض الصفري والسالب حيث يوجب §4 مقدارًا موجبًا، والسالب حيث يسمح a ≥ 0 (Q1)", () => {
    const refused: ReadonlyArray<[string, LedgerEntryBuildInput]> = [
      ["Q2 صفر", { type: "Q2", effectiveOn: "2026-11-02", lineId: LINE, amountFils: 0 }],
      ["Q3 سالب", { type: "Q3", effectiveOn: "2026-11-02", lineId: LINE, amountFils: -1 }],
      ["Q4 صفر", { type: "Q4", effectiveOn: "2026-11-03", boxId: CASH, saleId: SALE, amountFils: 0 }],
      ["Q6 صفر", { type: "Q6", effectiveOn: "2026-11-06", boxId: CASH, lineId: LINE, amountFils: 0 }],
      ["Q6 سالب", { type: "Q6", effectiveOn: "2026-11-06", boxId: CASH, lineId: LINE, amountFils: -5000 }],
      ["Q7 صفر", { type: "Q7", effectiveOn: "2026-11-06", boxId: CASH, lineId: LINE, amountFils: 0 }],
      ["Q8 سالب", { type: "Q8", effectiveOn: "2026-11-07", boxId: CASH, category: "gas", amountFils: -5 }],
      [
        "Q9 صفر",
        {
          type: "Q9",
          effectiveOn: "2026-11-07",
          lineId: LINE_SUPPLIER,
          category: "materials_packaging",
          amountFils: 0,
        },
      ],
      ["Q10 صفر", { type: "Q10", effectiveOn: "2026-11-08", boxId: CASH, amountFils: 0 }],
      [
        "Q11 سالب",
        { type: "Q11", effectiveOn: "2026-11-08", boxId: CASH, lineId: LINE_BORROWED, amountFils: -1 },
      ],
      ["Q12 صفر", { type: "Q12", effectiveOn: "2026-11-08", boxId: CASH, amountFils: 0 }],
      ["Q13 صفر", { type: "Q13", effectiveOn: "2026-11-08", boxId: CASH, lineId: LINE_LOAN, amountFils: 0 }],
      [
        "Q14 صفر",
        { type: "Q14", effectiveOn: "2026-11-09", fromBoxId: CASH, toBoxId: ACCOUNT_BOX, amountFils: 0 },
      ],
      [
        "Q17 صفر",
        {
          type: "Q17",
          effectiveOn: "2026-11-12",
          lineId: LINE,
          lineKind: "prior_receivable",
          amountFils: 0,
        },
      ],
      ["Q18 صفر", { type: "Q18", effectiveOn: "2026-11-12", boxId: CASH, saleId: SALE, excessFils: 0 }],
      ["Q1 سالب (a ≥ 0)", { type: "Q1", effectiveOn: "2026-11-01", boxId: CASH, amountFils: -1 }],
    ];
    for (const [label, input] of refused) {
      expect(() => buildLedgerEntry(input), label).toThrow();
    }
  });
});

describe("M2.2 الرفض: مدخلات Q5 (§4)", () => {
  it("يرفض السعر غير الموجب والعربون السالب", () => {
    expect(() =>
      buildLedgerEntry({
        type: "Q5",
        effectiveOn: "2026-11-05",
        saleId: SALE,
        priceFils: 0,
        prepaymentFils: 0,
        remainderLineId: LINE_REM,
      }),
    ).toThrow();
    expect(() =>
      buildLedgerEntry({
        type: "Q5",
        effectiveOn: "2026-11-05",
        saleId: SALE,
        priceFils: 250000,
        prepaymentFils: -1,
        remainderLineId: LINE_REM,
      }),
    ).toThrow();
  });

  it("يرفض سطر الباقي/الاسترداد الناقص عند لزومه (P > p وp > P)", () => {
    expect(() =>
      buildLedgerEntry({
        type: "Q5",
        effectiveOn: "2026-11-05",
        saleId: SALE,
        priceFils: 250000,
        prepaymentFils: 50000,
      }),
    ).toThrow();
    expect(() =>
      buildLedgerEntry({
        type: "Q5",
        effectiveOn: "2026-11-05",
        saleId: SALE,
        priceFils: 50000,
        prepaymentFils: 120000,
      }),
    ).toThrow();
  });
});

describe("M2.2 الرفض: حدود m في Q15 (§4)", () => {
  it("يرفض m خارج 0 ≤ m ≤ p والعربون السالب", () => {
    expect(() =>
      buildLedgerEntry({
        type: "Q15",
        effectiveOn: "2026-11-10",
        saleId: SALE,
        prepaymentFils: 30000,
        keptFils: 40000,
        refund: { mode: "none" },
      }),
    ).toThrow();
    expect(() =>
      buildLedgerEntry({
        type: "Q15",
        effectiveOn: "2026-11-10",
        saleId: SALE,
        prepaymentFils: 30000,
        keptFils: -1,
        refund: { mode: "now", boxId: CASH },
      }),
    ).toThrow();
  });
});

describe("M2.2 الرفض: اختيار استرداد Q15 (§4)", () => {
  it("يرفض اختيار استرداد لا يطابق الباقي أو ينقصه مرجعه", () => {
    /* r = 20000 متبقٍ ولا اختيار استرداد */
    expect(() =>
      buildLedgerEntry({
        type: "Q15",
        effectiveOn: "2026-11-10",
        saleId: SALE,
        prepaymentFils: 50000,
        keptFils: 30000,
        refund: { mode: "none" },
      }),
    ).toThrow();
    /* r = 0 والاختيار «الآن» — لا شيء يُسترد */
    expect(() =>
      buildLedgerEntry({
        type: "Q15",
        effectiveOn: "2026-11-10",
        saleId: SALE,
        prepaymentFils: 30000,
        keptFils: 30000,
        refund: { mode: "now", boxId: CASH },
      }),
    ).toThrow();
    /* مرجع فارغ */
    expect(() =>
      buildLedgerEntry({
        type: "Q15",
        effectiveOn: "2026-11-10",
        saleId: SALE,
        prepaymentFils: 50000,
        keptFils: 30000,
        refund: { mode: "now", boxId: "" },
      }),
    ).toThrow();
    expect(() =>
      buildLedgerEntry({
        type: "Q15",
        effectiveOn: "2026-11-10",
        saleId: SALE,
        prepaymentFils: 50000,
        keptFils: 30000,
        refund: { mode: "later", lineId: "" },
      }),
    ).toThrow();
  });
});

describe("M2.2 الرفض: مدخلات Q16 (§4)", () => {
  it("يرفض r غير الموجب والمستحق السالب وسطر الباقي الناقص عند لزومه", () => {
    expect(() =>
      buildLedgerEntry({
        type: "Q16",
        effectiveOn: "2026-11-11",
        saleId: SALE,
        returnFils: 0,
        remainderOutstandingFils: 0,
        refund: { mode: "none" },
      }),
    ).toThrow();
    expect(() =>
      buildLedgerEntry({
        type: "Q16",
        effectiveOn: "2026-11-11",
        saleId: SALE,
        returnFils: 8000,
        remainderOutstandingFils: -1,
        refund: { mode: "none" },
      }),
    ).toThrow();
    expect(() =>
      buildLedgerEntry({
        type: "Q16",
        effectiveOn: "2026-11-11",
        saleId: SALE,
        returnFils: 8000,
        remainderOutstandingFils: 5000,
        refund: { mode: "now", boxId: CASH },
      }),
    ).toThrow();
  });

  it("يرفض اختيار استرداد لا يطابق y (الباقي بعد خصم السطر)", () => {
    /* y = 3 > 0 والاختيار none */
    expect(() =>
      buildLedgerEntry({
        type: "Q16",
        effectiveOn: "2026-11-11",
        saleId: SALE,
        returnFils: 8000,
        remainderLineId: LINE_REM,
        remainderOutstandingFils: 5000,
        refund: { mode: "none" },
      }),
    ).toThrow();
    /* y = 0 والاختيار now — لا شيء يُسترد */
    expect(() =>
      buildLedgerEntry({
        type: "Q16",
        effectiveOn: "2026-11-11",
        saleId: SALE,
        returnFils: 8000,
        remainderLineId: LINE_REM,
        remainderOutstandingFils: 8000,
        refund: { mode: "now", boxId: CASH },
      }),
    ).toThrow();
  });
});

describe("M2.2 الرفض: مدخلات Q17 وQ19 (§4/§3.6)", () => {
  it("يرفض saleId الذي لا يطابق نوع سطر الشطب والنوع المجهول للسطر", () => {
    /* sale_remainder بلا sale */
    expect(() =>
      buildLedgerEntry({
        type: "Q17",
        effectiveOn: "2026-11-12",
        lineId: LINE_REM,
        lineKind: "sale_remainder",
        amountFils: 3000,
      }),
    ).toThrow();
    /* prior_receivable ومعه sale */
    expect(() =>
      buildLedgerEntry({
        type: "Q17",
        effectiveOn: "2026-11-12",
        lineId: LINE,
        lineKind: "prior_receivable",
        saleId: SALE,
        amountFils: 3000,
      }),
    ).toThrow();
    /* نوع سطر من by_me لا يُشطب (مدخل غير مُدقَّق) */
    expect(() =>
      buildLedgerEntry({
        type: "Q17",
        effectiveOn: "2026-11-12",
        lineId: LINE,
        lineKind: "supplier" as never,
        amountFils: 3000,
      }),
    ).toThrow();
  });

  it("يرفض Q19 بالفرق الصفري (§4: diff ≠ 0)", () => {
    expect(() =>
      buildLedgerEntry({
        type: "Q19",
        effectiveOn: "2026-11-13",
        boxId: CASH,
        differenceFils: 0,
      }),
    ).toThrow();
  });
});

describe("M2.2 نقاء الموديول: لا معادلة §8 داخل موديول الدفتر (فحص مصدر)", () => {
  it("لا مفردات معادلات §8/§8.2 ولا تحويل وحدة (*100//100) داخل ledger/**", () => {
    expect(Object.keys(ledgerSources).length).toBeGreaterThan(0);
    const forbiddenFigures =
      /(net[_-]?profit|net[_-]?sales|per[_-]?10|biggest[_-]?expense|materials[_-]?alert|net[_-]?worth|owner[_-]?entitlement|expected[_-]?profit|top[_-]?sell|top[_-]?profit|profit[_-]?bar)/i;
    const forbiddenUnitMath = /(\*\s*100\b|\/\s*100\b)/;
    for (const [file, source] of Object.entries(ledgerSources)) {
      expect(forbiddenFigures.test(source), `معادلة §8 داخل ${file}`).toBe(false);
      expect(forbiddenUnitMath.test(source), `تحويل وحدة داخل ${file}`).toBe(false);
    }
  });
});
