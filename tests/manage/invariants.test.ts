/**
 * M2.3 (§9 — مانج-في₂، الموجة E): اختبارات الثوابت INV-1…INV-10 العشرة
 * (`src/domain/manage/invariants/`) — فحوص صرفة فوق حالة دفتر.
 *  - عنوان المتتبّع القديم «I1–I9» اختصار مهترئ: §9 تعرّف عشرة ثوابت
 *    (INV-1…INV-10)، والتفسير المُلزم رقم 1 في أمر المرحلة 2 يقضي بتنفيذها
 *    عشرة كاملة — وهذا ما تختبره الملفات هنا.
 *  - لكل ثابت: حالة سليمة وحالة مفسدة مقصودة يثبت الفحص كشفها — لا ثابت
 *    يعيد النجاح دومًا (معيار الرفض في قائمة مراجعة المرحلة 2).
 *  - الحالات السليمة مبنية على أرقام `FIXTURES.md` الحرفية (S1/S7/S8/S9 —
 *    محسوبة من §8 ومتحقَّق منها بمعادلة INV-1 في الملف نفسه)، ولا يُعاد
 *    حساب «الرقم الصحيح» يدويًا في الاختبارات.
 *  - الثوابت الانتقالية الثلاثة (INV-7/INV-8/INV-9) فحوص (قبل، بعد):
 *    تعديل منتج لا يمس لقطة بند ولا الدفتر؛ تصحيح لا يغيّر إلا فترات
 *    التواريخ المتأثرة؛ تاريخا التسجيل والتسليم المخطط بلا أثر مالي.
 *  - التأكيد المفرد `assertLedgerCoreInvariants` (INV-1 + INV-2 معًا) هو
 *    ما تختم به كل اختبارات القبول من هنا فصاعدًا (نص المهمة + §13:
 *    «كل اختبار ينتهي بـassert INV-1 وassert INV-2»).
 */
import { describe, expect, it } from "vitest";
import {
  LEDGER_ENTRY_TYPE_IDS,
  assertLedgerCoreInvariants,
  checkInv1,
  checkInv10,
  checkInv2,
  checkInv3,
  checkInv4,
  checkInv5,
  checkInv6,
  checkInv7,
  checkInv8,
  checkInv9,
} from "../../src/domain/manage/index.js";
import type {
  InvariantBalanceLine,
  InvariantBox,
  InvariantEntry,
  InvariantOperation,
  InvariantPosting,
  InvariantSale,
  InvariantSaleLine,
  LedgerCheckState,
} from "../../src/domain/manage/index.js";

/* ─── معرفات مرجعية مغلقة (الفحوص لا تفحص شكل UUID — مراجع معتمّة عند التمرير) ─── */
const CASH = "box-cash";
const ACCOUNT_BOX = "box-account";
const LINE_REM = "line-remainder";
const LINE_REFUND = "line-refund";
const SALE = "sale-1";
const SALE2 = "sale-2";

/* ─── بانيات الحالة (كما هي في §3 — إسقاط الصفوف التي تحتاجها الفحوص) ─── */
type PostingInit = { refId?: string; category?: string; revKind?: string };

function posting(account: string, deltaFils: number, init: PostingInit = {}): InvariantPosting {
  return { account, deltaFils, ...init };
}

function entry(init: {
  id: string;
  operationId: string;
  entryType: string;
  effectiveOn: string;
  postings: InvariantPosting[];
  reversesEntryId?: string;
}): InvariantEntry {
  return { ...init };
}

function boxRow(id: string, openingStatus: "known" | "unknown" = "known"): InvariantBox {
  return { id, status: "active", openingStatus };
}

function lineRow(id: string, direction: "to_me" | "by_me"): InvariantBalanceLine {
  return { id, direction };
}

function saleRow(id: string, registeredOn = "2026-10-01", plannedDeliveryOn = "2026-10-10"): InvariantSale {
  return { id, registeredOn, plannedDeliveryOn };
}

function opRow(
  id: string,
  kind: string,
  init: { status?: "active" | "reversed"; correctsOperationId?: string; reversedByOperationId?: string } = {},
): InvariantOperation {
  return { id, kind, status: "active", ...init };
}

/* وصول فاشل-مغلقًا بالمعرّف (noUncheckedIndexedAccess — لا فهارس مجردة) */
function entryOf(state: LedgerCheckState, id: string): InvariantEntry {
  const found = state.entries.find(e => e.id === id);
  if (found === undefined) {
    throw new Error(`اختبار: القيد «${id}» غير موجود في الحالة`);
  }
  return found;
}

function saleLineOf(state: LedgerCheckState, id: string): InvariantSaleLine {
  const found = state.saleLines.find(line => line.id === id);
  if (found === undefined) {
    throw new Error(`اختبار: بند البيع «${id}» غير موجود في الحالة`);
  }
  return found;
}

function state(init: Partial<LedgerCheckState> = {}): LedgerCheckState {
  return {
    boxes: [],
    balanceLines: [],
    sales: [],
    saleLines: [],
    operations: [],
    entries: [],
    ...init,
  };
}

/* ─── الحالات السليمة من FIXTURES.md (الأرقام بالفلس كما هي في الملف) ─── */

/** S1 (الافتتاح): قيدَا Q1 (نقد 200 وحساب 100) وعربون 50 (FIXTURES — BOX 300000 وOPEN 300000 وPRE 50000). */
function s1OpeningEntries(): InvariantEntry[] {
  return [
    entry({
      id: "e-q1-cash",
      operationId: "op-q1-cash",
      entryType: "Q1",
      effectiveOn: "2026-10-01",
      postings: [posting("BOX", 200000, { refId: CASH }), posting("OPEN", 200000)],
    }),
    entry({
      id: "e-q1-account",
      operationId: "op-q1-account",
      entryType: "Q1",
      effectiveOn: "2026-10-01",
      postings: [posting("BOX", 100000, { refId: ACCOUNT_BOX }), posting("OPEN", 100000)],
    }),
    entry({
      id: "e-q4",
      operationId: "op-q4",
      entryType: "Q4",
      effectiveOn: "2026-10-02",
      postings: [posting("BOX", 50000, { refId: CASH }), posting("PRE", 50000, { refId: SALE })],
    }),
  ];
}

/** S1 (التشغيل): مصروف 170 + توصيل 5، تسليم 250، تحصيل 150 حساب (FIXTURES — EXP 175000 وREV 250000 وAR 50000). */
function s1TradingEntries(): InvariantEntry[] {
  return [
    entry({
      id: "e-q8a",
      operationId: "op-q8a",
      entryType: "Q8",
      effectiveOn: "2026-10-03",
      postings: [
        posting("BOX", -170000, { refId: CASH }),
        posting("EXP", 170000, { category: "materials_packaging" }),
      ],
    }),
    entry({
      id: "e-q8b",
      operationId: "op-q8b",
      entryType: "Q8",
      effectiveOn: "2026-10-03",
      postings: [posting("BOX", -5000, { refId: CASH }), posting("EXP", 5000, { category: "sale_delivery" })],
    }),
    entry({
      id: "e-q5",
      operationId: "op-q5",
      entryType: "Q5",
      effectiveOn: "2026-10-10",
      postings: [
        posting("REV", 250000, { refId: SALE, revKind: "delivery" }),
        posting("PRE", -50000, { refId: SALE }),
        posting("AR", 200000, { refId: LINE_REM }),
      ],
    }),
    entry({
      id: "e-q6",
      operationId: "op-q6",
      entryType: "Q6",
      effectiveOn: "2026-10-11",
      postings: [posting("BOX", 150000, { refId: ACCOUNT_BOX }), posting("AR", -150000, { refId: LINE_REM })],
    }),
  ];
}

/** S1: افتتاح 200 نقد + 100 حساب؛ عربون 50؛ مصروف 170 + توصيل 5؛ تسليم 250؛ تحصيل 150 حساب. */
function s1State(): LedgerCheckState {
  return state({
    boxes: [boxRow(CASH), boxRow(ACCOUNT_BOX)],
    sales: [saleRow(SALE)],
    balanceLines: [lineRow(LINE_REM, "to_me")],
    saleLines: [
      {
        id: "sl-1",
        saleId: SALE,
        position: 1,
        productId: "product-1",
        description: "صحن ملفوف",
        quantityMilli: 1000,
        unitPriceFils: 250000,
        unitCostFils: 120000,
      },
    ],
    operations: [
      opRow("op-q1-cash", "setup"),
      opRow("op-q1-account", "add-box"),
      opRow("op-q4", "prepayment"),
      opRow("op-q8a", "expense"),
      opRow("op-q8b", "expense"),
      opRow("op-q5", "deliver"),
      opRow("op-q6", "collect"),
    ],
    entries: [...s1OpeningEntries(), ...s1TradingEntries()],
  });
}

/** S7: مسجّل 340، معدود 300؛ كهرباء 25، سحب 10 — الربح −25 والفرق غير المفسَّر −5. */
function s7State(): LedgerCheckState {
  return state({
    boxes: [boxRow(CASH)],
    operations: [
      opRow("op-q1", "setup"),
      opRow("op-q8", "expense"),
      opRow("op-q12", "withdraw"),
      opRow("op-q19", "reconcile"),
    ],
    entries: [
      entry({
        id: "e-q1",
        operationId: "op-q1",
        entryType: "Q1",
        effectiveOn: "2026-10-01",
        postings: [posting("BOX", 340000, { refId: CASH }), posting("OPEN", 340000)],
      }),
      entry({
        id: "e-q8",
        operationId: "op-q8",
        entryType: "Q8",
        effectiveOn: "2026-10-02",
        postings: [posting("BOX", -25000, { refId: CASH }), posting("EXP", 25000, { category: "utilities" })],
      }),
      entry({
        id: "e-q12",
        operationId: "op-q12",
        entryType: "Q12",
        effectiveOn: "2026-10-03",
        postings: [posting("BOX", -10000, { refId: CASH }), posting("OWN_OUT", 10000)],
      }),
      entry({
        id: "e-q19",
        operationId: "op-q19",
        entryType: "Q19",
        effectiveOn: "2026-10-04",
        postings: [posting("BOX", -5000, { refId: CASH }), posting("UNEXP", -5000)],
      }),
    ],
  });
}

/** S8: نقد 200/حساب 100، تحويل 50 من النقد إلى الحساب — 150 + 150 بلا فرق غير مفسر. */
function s8State(): LedgerCheckState {
  return state({
    boxes: [boxRow(CASH), boxRow(ACCOUNT_BOX)],
    operations: [opRow("op-q1a", "setup"), opRow("op-q1b", "add-box"), opRow("op-q14", "transfer")],
    entries: [
      entry({
        id: "e-q1a",
        operationId: "op-q1a",
        entryType: "Q1",
        effectiveOn: "2026-10-01",
        postings: [posting("BOX", 200000, { refId: CASH }), posting("OPEN", 200000)],
      }),
      entry({
        id: "e-q1b",
        operationId: "op-q1b",
        entryType: "Q1",
        effectiveOn: "2026-10-01",
        postings: [posting("BOX", 100000, { refId: ACCOUNT_BOX }), posting("OPEN", 100000)],
      }),
      entry({
        id: "e-q14",
        operationId: "op-q14",
        entryType: "Q14",
        effectiveOn: "2026-10-02",
        postings: [posting("BOX", -50000, { refId: CASH }), posting("BOX", 50000, { refId: ACCOUNT_BOX })],
      }),
    ],
  });
}

/** S9: سحب مالك 200 من صندوق صفري — صافي ثروة سالب −200 ومتوازن مع مصادره. */
function s9State(): LedgerCheckState {
  return state({
    boxes: [boxRow(CASH)],
    operations: [opRow("op-q12", "withdraw")],
    entries: [
      entry({
        id: "e-q12",
        operationId: "op-q12",
        entryType: "Q12",
        effectiveOn: "2026-10-01",
        postings: [posting("BOX", -200000, { refId: CASH }), posting("OWN_OUT", 200000)],
      }),
    ],
  });
}

/** T4-النمط: صندوق نقد بفتح مجهول قبل أول مطابقة — الطرفان «مجهولان» (التفسير المُلزم 6). */
function unknownOpeningState(): LedgerCheckState {
  return state({
    boxes: [boxRow(CASH, "unknown")],
    sales: [saleRow(SALE)],
    operations: [opRow("op-q8", "expense")],
    entries: [
      entry({
        id: "e-q8",
        operationId: "op-q8",
        entryType: "Q8",
        effectiveOn: "2026-10-02",
        postings: [posting("BOX", -50000, { refId: CASH }), posting("EXP", 50000, { category: "gas" })],
      }),
    ],
  });
}

/** S3أ-النمط: إلغاء مع الاحتفاظ — عربون 30، احتُفظ بـ10 وأُرجع 20 لاحقًا (الجزء المسترد لا يمسّ الربح). */
function q15RefundLaterState(): LedgerCheckState {
  return state({
    boxes: [boxRow(CASH)],
    sales: [saleRow(SALE2)],
    balanceLines: [lineRow(LINE_REFUND, "by_me")],
    operations: [opRow("op-q4", "prepayment"), opRow("op-q15", "cancel-sale")],
    entries: [
      entry({
        id: "e-q4",
        operationId: "op-q4",
        entryType: "Q4",
        effectiveOn: "2026-10-01",
        postings: [posting("BOX", 30000, { refId: CASH }), posting("PRE", 30000, { refId: SALE2 })],
      }),
      entry({
        id: "e-q15",
        operationId: "op-q15",
        entryType: "Q15",
        effectiveOn: "2026-10-05",
        postings: [
          posting("PRE", -10000, { refId: SALE2 }),
          posting("REV", 10000, { refId: SALE2, revKind: "kept_prepayment" }),
          posting("PRE", -20000, { refId: SALE2 }),
          posting("AP", 20000, { refId: LINE_REFUND }),
        ],
      }),
    ],
  });
}

/** حالة سليمة تجمع سيناريوهات FIXTURES معًا (لكل فحص أن يعمل فوقها). */
const healthyStates: Array<[string, LedgerCheckState]> = [
  ["S1", s1State()],
  ["S7", s7State()],
  ["S8", s8State()],
  ["S9", s9State()],
  ["Q15-refund-later", q15RefundLaterState()],
];

/* ─── INV-1: صافي الثروة = مصادر صافي الثروة في كل لحظة ─── */
describe("INV-1 — صافي الثروة = مصادره", () => {
  it("S1 سليمة: الطرفان 375000 (أرقام FIXTURES)", () => {
    expect(checkInv1(s1State())).toEqual({ invariantId: "INV-1", outcome: "pass" });
  });

  it("S7 سليمة: UNEXP سالب −5000 وOWN_OUT 10000 والطرفان 300000", () => {
    expect(checkInv1(s7State())).toEqual({ invariantId: "INV-1", outcome: "pass" });
  });

  it("S8 سليمة: صندوقان 150+150 بعد تحويل Q14", () => {
    expect(checkInv1(s8State())).toEqual({ invariantId: "INV-1", outcome: "pass" });
  });

  it("S9 سليمة: صافي ثروة سالب −200000 متوازن مع مصادره", () => {
    expect(checkInv1(s9State())).toEqual({ invariantId: "INV-1", outcome: "pass" });
  });

  it("فتح مجهول (T4): النتيجة unknown — الطرفان مجهولان (التفسير المُلزم 6)", () => {
    const result = checkInv1(unknownOpeningState());
    expect(result.invariantId).toBe("INV-1");
    expect(result.outcome).toBe("unknown");
    if (result.outcome === "unknown") {
      expect(result.reason).toContain(CASH);
    }
  });

  it("مفسدة: قيد غير متوازن يكسر المعادلة الكونية (BOX +200000 مع OPEN +50000)", () => {
    const corrupted = s1State();
    entryOf(corrupted, "e-q1-cash").postings[1] = posting("OPEN", 50000);
    const result = checkInv1(corrupted);
    expect(result.outcome).toBe("violation");
    if (result.outcome === "violation") {
      // الضلعان والفرق فقط (عزو القيد المكسور شأن INV-10 لا INV-1 الكونية)
      expect(result.violations.some(v => v.includes("375000") && v.includes("225000"))).toBe(true);
      expect(result.violations.some(v => v.includes("150000"))).toBe(true);
    }
  });

  it("مفسدة: حساب مجهول في ترحيل — رفض مغلق لا صمت", () => {
    const corrupted = s1State();
    entryOf(corrupted, "e-q1-cash").postings[1] = { account: "EXPECTED", deltaFils: 200000 };
    const result = checkInv1(corrupted);
    expect(result.outcome).toBe("violation");
  });

  it("مفسدة: مقدار غير عدد صحيح آمن — رفض مغلق", () => {
    const corrupted = s1State();
    entryOf(corrupted, "e-q1-cash").postings[0] = posting("BOX", 0.5, { refId: CASH });
    const result = checkInv1(corrupted);
    expect(result.outcome).toBe("violation");
  });
});

/* ─── INV-2: كل مستحق قائم ≥ 0 وكل دفعة مقدمة ≥ 0 ─── */
describe("INV-2 — السليم", () => {
  it("S1 سليمة: مستحق L1 قائمه 50000 وPRE[البيع] = 0", () => {
    expect(checkInv2(s1State())).toEqual({ invariantId: "INV-2", outcome: "pass" });
  });

  it("كل الحالات السليمة تجتاز الفحص", () => {
    for (const [name, healthy] of healthyStates) {
      expect(checkInv2(healthy), name).toEqual({ invariantId: "INV-2", outcome: "pass" });
    }
  });
});

describe("INV-2 — المفسد الإشاري", () => {
  it("مفسدة: دفع زائد T7-النمط — تحصيل 80 من مستحق 50 يجعل القائم −30000", () => {
    const corrupted = s1State();
    corrupted.entries.push(
      entry({
        id: "e-q6-over",
        operationId: "op-q6",
        entryType: "Q6",
        effectiveOn: "2026-10-12",
        postings: [posting("BOX", 80000, { refId: ACCOUNT_BOX }), posting("AR", -80000, { refId: LINE_REM })],
      }),
    );
    const result = checkInv2(corrupted);
    expect(result.outcome).toBe("violation");
    if (result.outcome === "violation") {
      expect(result.violations.some(v => v.includes(LINE_REM) && v.includes("-30000"))).toBe(true);
    }
  });

  it("مفسدة: دفعة مقدمة سالبة PRE[s] = −30000", () => {
    const corrupted = q15RefundLaterState();
    corrupted.entries.push(
      entry({
        id: "e-pre-neg",
        operationId: "op-q4",
        entryType: "Q4",
        effectiveOn: "2026-10-06",
        postings: [posting("PRE", -30000, { refId: SALE2 })],
      }),
    );
    const result = checkInv2(corrupted);
    expect(result.outcome).toBe("violation");
    if (result.outcome === "violation") {
      expect(result.violations.some(v => v.includes(SALE2))).toBe(true);
    }
  });
});

describe("INV-2 — المفسد المرجعي", () => {
  it("مفسدة: ترحيل AR على سطر by_me (اتجاه متقاطع)", () => {
    const corrupted = q15RefundLaterState();
    corrupted.entries.push(
      entry({
        id: "e-cross",
        operationId: "op-q6",
        entryType: "Q6",
        effectiveOn: "2026-10-06",
        postings: [posting("BOX", 5000, { refId: CASH }), posting("AR", -5000, { refId: LINE_REFUND })],
      }),
    );
    const result = checkInv2(corrupted);
    expect(result.outcome).toBe("violation");
    if (result.outcome === "violation") {
      expect(result.violations.some(v => v.includes(LINE_REFUND))).toBe(true);
    }
  });

  it("مفسدة: ترحيل PRE يشير إلى بيع غير موجود — رفض مغلق", () => {
    const corrupted = s1State();
    corrupted.entries.push(
      entry({
        id: "e-pre-unknown",
        operationId: "op-q4",
        entryType: "Q4",
        effectiveOn: "2026-10-06",
        postings: [posting("BOX", 5000, { refId: CASH }), posting("PRE", 5000, { refId: "sale-ghost" })],
      }),
    );
    const result = checkInv2(corrupted);
    expect(result.outcome).toBe("violation");
  });

  it("مفسدة: ترحيل AR بلا مرجع سطر — رفض مغلق", () => {
    const corrupted = s1State();
    entryOf(corrupted, "e-q5").postings[2] = posting("AR", 200000);
    expect(checkInv2(corrupted).outcome).toBe("violation");
  });
});

/* ─── INV-3: كل شكل مخزّن يساوي إعادة حسابه من الترحيلات ─── */
describe("INV-3 — الكاش يساوي إعادة الحساب من الترحيلات", () => {
  it("سليمة: لا كاش أصلًا (التخزين المؤقت اختياري — §3.11)", () => {
    expect(checkInv3(s1State())).toEqual({ invariantId: "INV-3", outcome: "pass" });
  });

  it("سليمة: كاش مطابق — أرصدة الصناديق 75000/250000 والمستحق 50000 والعربون 0", () => {
    const cached = {
      ...s1State(),
      cachedFigures: {
        boxBalances: { [CASH]: 75000, [ACCOUNT_BOX]: 250000 },
        lineOutstanding: { [LINE_REM]: 50000 },
        salePrepayments: { [SALE]: 0 },
      },
    };
    expect(checkInv3(cached)).toEqual({ invariantId: "INV-3", outcome: "pass" });
  });

  it("مفسدة: رصيد صندوق مخزّن 76000 والمحسوب 75000", () => {
    const cached = { ...s1State(), cachedFigures: { boxBalances: { [CASH]: 76000 } } };
    const result = checkInv3(cached);
    expect(result.outcome).toBe("violation");
    if (result.outcome === "violation") {
      expect(
        result.violations.some(v => v.includes(CASH) && v.includes("75000") && v.includes("76000")),
      ).toBe(true);
    }
  });

  it("مفسدة: كاش لصندوق غير موجود في الحالة — رفض مغلق", () => {
    const cached = { ...s1State(), cachedFigures: { boxBalances: { "box-ghost": 0 } } };
    expect(checkInv3(cached).outcome).toBe("violation");
  });

  it("مفسدة: مستحق مخزّن 40000 والمحسوب 50000", () => {
    const cached = { ...s1State(), cachedFigures: { lineOutstanding: { [LINE_REM]: 40000 } } };
    const result = checkInv3(cached);
    expect(result.outcome).toBe("violation");
    if (result.outcome === "violation") {
      expect(result.violations.some(v => v.includes(LINE_REM))).toBe(true);
    }
  });

  it("مفسدة: دفعة مقدمة مخزّنة 5000 والمحسوبة 0", () => {
    const cached = { ...s1State(), cachedFigures: { salePrepayments: { [SALE]: 5000 } } };
    expect(checkInv3(cached).outcome).toBe("violation");
  });

  it("مفسدة: قيمة كاش غير عدد صحيح آمن — رفض مغلق", () => {
    const cached = { ...s1State(), cachedFigures: { boxBalances: { [CASH]: 0.5 } } };
    expect(checkInv3(cached).outcome).toBe("violation");
  });
});

/* ─── INV-4: الدفتر append-only والقيد مع عكسه يتصفّيان على كل حساب ─── */
/** تحصيل وعكسه: BOX +150000/AR −150000 ثم مرآتهما السالبة. */
function collectAndReversal(): LedgerCheckState {
  const base = s1State();
  base.entries.push(
    entry({
      id: "e-q20",
      operationId: "op-q6",
      entryType: "Q20",
      effectiveOn: "2026-10-11",
      reversesEntryId: "e-q6",
      postings: [posting("BOX", -150000, { refId: ACCOUNT_BOX }), posting("AR", 150000, { refId: LINE_REM })],
    }),
  );
  return base;
}

describe("INV-4 — السليم", () => {
  it("سليمة: Q20 مرآة معكوسة بالضبط — مجموعهما صفر على كل حساب", () => {
    expect(checkInv4(collectAndReversal())).toEqual({ invariantId: "INV-4", outcome: "pass" });
  });

  it("سليمة: لا عكس في الحالة — الفحص يعبر دون سلبية كاذبة", () => {
    expect(checkInv4(s1State())).toEqual({ invariantId: "INV-4", outcome: "pass" });
  });
});

describe("INV-4 — المفسد المرآتي", () => {
  it("مفسدة: Q20 لا يعكس ترحيلات المعكوس بالضبط (مقدار مختلف)", () => {
    const corrupted = collectAndReversal();
    entryOf(corrupted, "e-q20").postings[0] = posting("BOX", -100000, { refId: ACCOUNT_BOX });
    const result = checkInv4(corrupted);
    expect(result.outcome).toBe("violation");
    if (result.outcome === "violation") {
      expect(result.violations.some(v => v.includes("e-q20"))).toBe(true);
    }
  });

  it("مفسدة: مجموع القيد وعكسه لا يتصفّى — حساب مفقود من المرآة", () => {
    const corrupted = collectAndReversal();
    entryOf(corrupted, "e-q20").postings = [posting("BOX", -150000, { refId: ACCOUNT_BOX })];
    expect(checkInv4(corrupted).outcome).toBe("violation");
  });

  it("مفسدة: Q20 يعكس قيدًا غير موجود", () => {
    const corrupted = collectAndReversal();
    entryOf(corrupted, "e-q20").reversesEntryId = "e-ghost";
    expect(checkInv4(corrupted).outcome).toBe("violation");
  });
});

describe("INV-4 — المفسد العقدي", () => {
  it("مفسدة: عكس العكس — Q20 على Q20 (E-REVERSE-REVERSAL)", () => {
    const corrupted = collectAndReversal();
    corrupted.entries.push(
      entry({
        id: "e-q20-2",
        operationId: "op-q6",
        entryType: "Q20",
        effectiveOn: "2026-10-11",
        reversesEntryId: "e-q20",
        postings: [
          posting("BOX", 150000, { refId: ACCOUNT_BOX }),
          posting("AR", -150000, { refId: LINE_REM }),
        ],
      }),
    );
    const result = checkInv4(corrupted);
    expect(result.outcome).toBe("violation");
    if (result.outcome === "violation") {
      expect(result.violations.some(v => v.includes("E-REVERSE-REVERSAL"))).toBe(true);
    }
  });

  it("مفسدة: القيد نفسه معكوس مرتين", () => {
    const corrupted = collectAndReversal();
    corrupted.entries.push(
      entry({
        id: "e-q20-dup",
        operationId: "op-q6",
        entryType: "Q20",
        effectiveOn: "2026-10-12",
        reversesEntryId: "e-q6",
        postings: [
          posting("BOX", -150000, { refId: ACCOUNT_BOX }),
          posting("AR", 150000, { refId: LINE_REM }),
        ],
      }),
    );
    const result = checkInv4(corrupted);
    expect(result.outcome).toBe("violation");
    if (result.outcome === "violation") {
      expect(result.violations.some(v => v.includes("e-q6"))).toBe(true);
    }
  });
});

/* ─── INV-5: الأنواع المحايدة وجزء الاسترداد في Q15 لا تغيّر صافي الربح ─── */
describe("INV-5 — السليم والسجل المغلق", () => {
  it("كل الحالات السليمة تجتاز الفحص (S1 يشمل Q14/Q19 وQ15 يشمل جزء الاسترداد)", () => {
    for (const [name, healthy] of healthyStates) {
      expect(checkInv5(healthy), name).toEqual({ invariantId: "INV-5", outcome: "pass" });
    }
  });

  it("السجل مغلق: عشرون نوعًا بالضبط ولا نوع لتعديل منتج أو متتبّع", () => {
    expect(LEDGER_ENTRY_TYPE_IDS).toHaveLength(20);
    expect(LEDGER_ENTRY_TYPE_IDS.every(id => /^Q([1-9]|1[0-9]|20)$/.test(id))).toBe(true);
  });
});

describe("INV-5 — المفسد الحسابي", () => {
  it("مفسدة: Q1 يرحّل إلى EXP", () => {
    const corrupted = s1State();
    entryOf(corrupted, "e-q1-cash").postings = [
      posting("BOX", 100000, { refId: CASH }),
      posting("EXP", 100000, { category: "gas" }),
    ];
    const result = checkInv5(corrupted);
    expect(result.outcome).toBe("violation");
    if (result.outcome === "violation") {
      expect(result.violations.some(v => v.includes("e-q1-cash"))).toBe(true);
    }
  });

  it("مفسدة: Q14 يرحّل إلى REV", () => {
    const corrupted = s8State();
    entryOf(corrupted, "e-q14").postings.push(posting("REV", 50000, { revKind: "delivery" }));
    expect(checkInv5(corrupted).outcome).toBe("violation");
  });

  it("مفسدة: Q15 يرحّل إلى EXP (حتى من جزء الاسترداد)", () => {
    const corrupted = q15RefundLaterState();
    entryOf(corrupted, "e-q15").postings.push(posting("EXP", 20000, { category: "other" }));
    // أعِد توازن القيد كي يكون الفشل من INV-5 وحدها لا من المعادلة
    entryOf(corrupted, "e-q15").postings.push(posting("UNEXP", -20000));
    expect(checkInv5(corrupted).outcome).toBe("violation");
  });

  it("مفسدة: REV في Q15 بنوع غير kept_prepayment (جزء الاسترداد لا يرحّل REV)", () => {
    const corrupted = q15RefundLaterState();
    entryOf(corrupted, "e-q15").postings[1] = posting("REV", 10000, { refId: SALE2, revKind: "delivery" });
    expect(checkInv5(corrupted).outcome).toBe("violation");
  });
});

describe("INV-5 — المفسد النوعي والعكسي", () => {
  it("مفسدة: Q20 عاكس لنوع محايد يرحّل REV", () => {
    const corrupted = s1State();
    corrupted.entries.push(
      entry({
        id: "e-q20-q6",
        operationId: "op-q6",
        entryType: "Q20",
        effectiveOn: "2026-10-11",
        reversesEntryId: "e-q6",
        postings: [
          posting("BOX", -150000, { refId: ACCOUNT_BOX }),
          posting("AR", 150000, { refId: LINE_REM }),
          posting("REV", 1000, { revKind: "delivery" }),
          posting("UNEXP", -1000),
        ],
      }),
    );
    const result = checkInv5(corrupted);
    expect(result.outcome).toBe("violation");
    if (result.outcome === "violation") {
      expect(result.violations.some(v => v.includes("e-q20-q6"))).toBe(true);
    }
  });

  it("مفسدة: نوع مجهول (تعديل منتج/متتبّع لا نوع له في السجل)", () => {
    const corrupted = s1State();
    corrupted.entries.push(
      entry({
        id: "e-product-edit",
        operationId: "op-ghost",
        entryType: "PRODUCT_EDIT",
        effectiveOn: "2026-10-06",
        postings: [posting("EXP", 1000, { category: "gas" }), posting("UNEXP", -1000)],
      }),
    );
    const result = checkInv5(corrupted);
    expect(result.outcome).toBe("violation");
    if (result.outcome === "violation") {
      expect(result.violations.some(v => v.includes("e-product-edit"))).toBe(true);
    }
  });
});

/* ─── INV-6: الكلفة/الربح المتوقعان لا يُرحَّلان إلى REV/EXP ─── */
describe("INV-6 — المتوقَّع لا يُرحَّل إلى REV/EXP", () => {
  it("سليمة: S1 — REV بتسليم حقيقي وEXP بفئات R-10 حقيقية", () => {
    expect(checkInv6(s1State())).toEqual({ invariantId: "INV-6", outcome: "pass" });
  });

  it("كل الحالات السليمة تجتاز الفحص", () => {
    for (const [name, healthy] of healthyStates) {
      expect(checkInv6(healthy), name).toEqual({ invariantId: "INV-6", outcome: "pass" });
    }
  });

  it("مفسدة: فئة مصروف زائفة expected_cost (كلفة متوقعة)", () => {
    const corrupted = s1State();
    entryOf(corrupted, "e-q8a").postings[1] = posting("EXP", 170000, { category: "expected_cost" });
    const result = checkInv6(corrupted);
    expect(result.outcome).toBe("violation");
    if (result.outcome === "violation") {
      expect(result.violations.some(v => v.includes("expected_cost"))).toBe(true);
    }
  });

  it("مفسدة: نوع إيراد زائف expected (ربح متوقع)", () => {
    const corrupted = s1State();
    entryOf(corrupted, "e-q5").postings[0] = posting("REV", 250000, { refId: SALE, revKind: "expected" });
    expect(checkInv6(corrupted).outcome).toBe("violation");
  });

  it("مفسدة: EXP من نوع لا يحقق مصروفًا (Q4 العربون)", () => {
    const corrupted = s1State();
    entryOf(corrupted, "e-q4").postings = [
      posting("BOX", 50000, { refId: CASH }),
      posting("EXP", 50000, { category: "gas" }),
    ];
    expect(checkInv6(corrupted).outcome).toBe("violation");
  });

  it("مفسدة: REV من نوع محايد (Q19 تسوية المطابقة)", () => {
    const corrupted = s7State();
    entryOf(corrupted, "e-q19").postings = [
      posting("BOX", -5000, { refId: CASH }),
      posting("REV", 5000, { revKind: "delivery" }),
      posting("UNEXP", -5000),
    ];
    expect(checkInv6(corrupted).outcome).toBe("violation");
  });

  it("سليمة: Q20 عاكس لـQ8 يرحّل EXP بمرآة سالبة — مسموح (عكس مصروف محقق)", () => {
    const reversed = s7State();
    reversed.entries.push(
      entry({
        id: "e-q20-q8",
        operationId: "op-q8",
        entryType: "Q20",
        effectiveOn: "2026-10-02",
        reversesEntryId: "e-q8",
        postings: [posting("BOX", 25000, { refId: CASH }), posting("EXP", -25000, { category: "utilities" })],
      }),
    );
    expect(checkInv6(reversed)).toEqual({ invariantId: "INV-6", outcome: "pass" });
  });
});

/* ─── INV-7: تعديل منتج لا يغيّر بند بيع قائمًا ─── */
describe("INV-7 — تعديل المنتج لا يمسّ لقطة البند", () => {
  it("سليمة: تعديل منتج لا يغيّر شيئًا في حالة الدفتر (اللقطة بند مستقل)", () => {
    const before = s1State();
    const after = structuredClone(before);
    expect(checkInv7(before, after)).toEqual({ invariantId: "INV-7", outcome: "pass" });
  });

  it("مفسدة: سعر البند تغيّر بعد تعديل المنتج", () => {
    const before = s1State();
    const after = structuredClone(before);
    saleLineOf(after, "sl-1").unitPriceFils = 300000;
    const result = checkInv7(before, after);
    expect(result.outcome).toBe("violation");
    if (result.outcome === "violation") {
      expect(result.violations.some(v => v.includes("sl-1"))).toBe(true);
    }
  });

  it("مفسدة: كلفة البند تغيّرت بعد تعديل منتج (الكلفة تتبع المنتج الحي)", () => {
    const before = s1State();
    const after = structuredClone(before);
    saleLineOf(after, "sl-1").unitCostFils = 150000;
    expect(checkInv7(before, after).outcome).toBe("violation");
  });

  it("مفسدة: تعديل المنتج أضاف قيدًا إلى الدفتر", () => {
    const before = s1State();
    const after = structuredClone(before);
    after.entries.push(
      entry({
        id: "e-rogue",
        operationId: "op-ghost",
        entryType: "Q8",
        effectiveOn: "2026-10-06",
        postings: [posting("BOX", -1000, { refId: CASH }), posting("EXP", 1000, { category: "gas" })],
      }),
    );
    expect(checkInv7(before, after).outcome).toBe("violation");
  });

  it("مفسدة: حُذف بند بيع في «بعد»", () => {
    const before = s1State();
    const after = structuredClone(before);
    after.saleLines = [];
    expect(checkInv7(before, after).outcome).toBe("violation");
  });
});

/* ─── INV-8: التصحيح يغيّر فترات التواريخ المتأثرة فقط ─── */
/** T5-النمط: مصروف أكتوبر 50 صُحّح إلى 5؛ مصروف نوفمبر 30 في الحالتين. */
function t5BeforeState(): LedgerCheckState {
  return state({
    boxes: [boxRow(CASH)],
    operations: [opRow("op-oct", "expense"), opRow("op-nov", "expense")],
    entries: [
      entry({
        id: "e-oct",
        operationId: "op-oct",
        entryType: "Q8",
        effectiveOn: "2026-10-10",
        postings: [posting("BOX", -50000, { refId: CASH }), posting("EXP", 50000, { category: "gas" })],
      }),
      entry({
        id: "e-nov",
        operationId: "op-nov",
        entryType: "Q8",
        effectiveOn: "2026-11-05",
        postings: [posting("BOX", -30000, { refId: CASH }), posting("EXP", 30000, { category: "utilities" })],
      }),
    ],
  });
}

/** بعد التصحيح: Q20 عاكس أكتوبر + البديل المصحِّح 5 في أكتوبر نفسها (op-fix يعكّس/يصحّح op-oct). */
function t5AfterState(): LedgerCheckState {
  const after = t5BeforeState();
  after.operations = [
    opRow("op-oct", "expense", { status: "reversed", reversedByOperationId: "op-fix" }),
    opRow("op-nov", "expense"),
    opRow("op-fix", "expense", { correctsOperationId: "op-oct" }),
  ];
  after.entries.push(
    entry({
      id: "e-q20-oct",
      operationId: "op-fix",
      entryType: "Q20",
      effectiveOn: "2026-10-10",
      reversesEntryId: "e-oct",
      postings: [posting("BOX", 50000, { refId: CASH }), posting("EXP", -50000, { category: "gas" })],
    }),
    entry({
      id: "e-oct-fixed",
      operationId: "op-fix",
      entryType: "Q8",
      effectiveOn: "2026-10-10",
      postings: [posting("BOX", -5000, { refId: CASH }), posting("EXP", 5000, { category: "gas" })],
    }),
  );
  return after;
}

describe("INV-8 — السليم", () => {
  it("سليمة: تصحيح T5 — أكتوبر وحدها تتغير ونوفمبر كما هي", () => {
    expect(checkInv8(t5BeforeState(), t5AfterState())).toEqual({ invariantId: "INV-8", outcome: "pass" });
  });

  it("سليمة: تصحيح يغيّر التاريخ نفسه (أكتوبر → نوفمبر) — الفترتان المتأثرتان وحدهما", () => {
    const before = t5BeforeState();
    const after = t5AfterState();
    entryOf(after, "e-oct-fixed").effectiveOn = "2026-11-20";
    // e-oct-fixed تاريخها الجديد متأثر (تصحيح التاريخ قرار المستخدم — §5 OP-CORRECT)
    expect(checkInv8(before, after)).toEqual({ invariantId: "INV-8", outcome: "pass" });
  });
});

describe("INV-8 — المفسد", () => {
  it("مفسدة: التصحيح عدّل قيد نوفمبر القائم (قيد سابق لم يُمسّ)", () => {
    const before = t5BeforeState();
    const after = t5AfterState();
    entryOf(after, "e-nov").postings[1] = posting("EXP", 20000, { category: "utilities" });
    const result = checkInv8(before, after);
    expect(result.outcome).toBe("violation");
    if (result.outcome === "violation") {
      expect(result.violations.some(v => v.includes("e-nov"))).toBe(true);
    }
  });

  it("مفسدة: التصحيح أضاف قيدًا دخيلًا في ديسمبر تحت عملية خارج نطاق التصحيح", () => {
    const before = t5BeforeState();
    const after = t5AfterState();
    after.operations.push(opRow("op-rogue", "expense"));
    after.entries.push(
      entry({
        id: "e-rogue-dec",
        operationId: "op-rogue",
        entryType: "Q8",
        effectiveOn: "2026-12-01",
        postings: [posting("BOX", -7000, { refId: CASH }), posting("EXP", 7000, { category: "gas" })],
      }),
    );
    const result = checkInv8(before, after);
    expect(result.outcome).toBe("violation");
    if (result.outcome === "violation") {
      expect(result.violations.some(v => v.includes("2026-12-01") || v.includes("e-rogue-dec"))).toBe(true);
    }
  });

  it("مفسدة: قيد سابق حُذف في «بعد» (لا حذف في دفتر append-only)", () => {
    const before = t5BeforeState();
    const after = t5AfterState();
    after.entries = after.entries.filter(e => e.id !== "e-nov");
    expect(checkInv8(before, after).outcome).toBe("violation");
  });
});

/* ─── INV-9: تاريخا التسجيل والتسليم المخطط بلا أثر مالي ─── */
describe("INV-9 — التاريخان الإداريان بلا أثر مالي", () => {
  it("سليمة: تغيير registered_on وplanned_delivery_on لا يمسّ الدفتر", () => {
    const before = s1State();
    const after = structuredClone(before);
    after.sales[0] = saleRow(SALE, "2026-10-03", "2026-10-25");
    expect(checkInv9(before, after)).toEqual({ invariantId: "INV-9", outcome: "pass" });
  });

  it("مفسدة: تغيير التاريخين أضاف قيد إيراد", () => {
    const before = s1State();
    const after = structuredClone(before);
    after.sales[0] = saleRow(SALE, "2026-10-03", "2026-10-25");
    after.entries.push(
      entry({
        id: "e-rogue-rev",
        operationId: "op-ghost",
        entryType: "Q5",
        effectiveOn: "2026-10-25",
        postings: [posting("REV", 5000, { revKind: "delivery" }), posting("AR", 5000, { refId: LINE_REM })],
      }),
    );
    expect(checkInv9(before, after).outcome).toBe("violation");
  });

  it("مفسدة: تغيير التاريخين عدّل مقدار ترحيل قائم", () => {
    const before = s1State();
    const after = structuredClone(before);
    after.sales[0] = saleRow(SALE, "2026-10-03", "2026-10-25");
    entryOf(after, "e-q1-cash").postings[0] = posting("BOX", 300000, { refId: CASH });
    expect(checkInv9(before, after).outcome).toBe("violation");
  });
});

/* ─── INV-10: كل قيد يحقق معادلة التوازن §3.8 ─── */
describe("INV-10 — معادلة §3.8 لكل قيد على حدة", () => {
  it("كل الحالات السليمة: كل قيودها متوازنة (S1 سبعة قيود)", () => {
    for (const [name, healthy] of healthyStates) {
      expect(checkInv10(healthy), name).toEqual({ invariantId: "INV-10", outcome: "pass" });
    }
  });

  it("مفسدة: قيد غير متوازن (BOX +100000 مع OPEN +50000 — الفرق 50000)", () => {
    const corrupted = s1State();
    entryOf(corrupted, "e-q1-cash").postings = [
      posting("BOX", 100000, { refId: CASH }),
      posting("OPEN", 50000),
    ];
    const result = checkInv10(corrupted);
    expect(result.outcome).toBe("violation");
    if (result.outcome === "violation") {
      expect(result.violations.some(v => v.includes("e-q1-cash") && v.includes("50000"))).toBe(true);
    }
  });

  it("مفسدة: قيد بحساب مجهول — رفض مغلق", () => {
    const corrupted = s1State();
    entryOf(corrupted, "e-q1-cash").postings = [
      posting("BOX", 100000, { refId: CASH }),
      posting("OPEN", 100000),
      posting("EXPECTED", 50000),
      posting("UNEXP", -50000),
    ];
    expect(checkInv10(corrupted).outcome).toBe("violation");
  });

  it("مفسدة: قيد بمقدار غير عدد صحيح آمن — رفض مغلق", () => {
    const corrupted = s1State();
    entryOf(corrupted, "e-q1-cash").postings = [
      posting("BOX", 100000, { refId: CASH }),
      posting("OPEN", 100000.5),
    ];
    expect(checkInv10(corrupted).outcome).toBe("violation");
  });
});

/* ─── التأكيد المفرد: INV-1 + INV-2 في تأكيد واحد (§13) ─── */
describe("التأكيد المفرد assertLedgerCoreInvariants", () => {
  it("حالة سليمة: يعيد النتيجتين دون رمي (S1)", () => {
    const results = assertLedgerCoreInvariants(s1State());
    expect(results.inv1).toEqual({ invariantId: "INV-1", outcome: "pass" });
    expect(results.inv2).toEqual({ invariantId: "INV-2", outcome: "pass" });
  });

  it("فتح مجهول: لا رمي — INV-1 unknown حالة مشروعة قبل أول مطابقة (T4)", () => {
    const results = assertLedgerCoreInvariants(unknownOpeningState());
    expect(results.inv1.outcome).toBe("unknown");
    expect(results.inv2.outcome).toBe("pass");
  });

  it("كسر INV-2 (دفع زائد): يرمي برسالة تحمل INV-2", () => {
    const corrupted = s1State();
    corrupted.entries.push(
      entry({
        id: "e-q6-over",
        operationId: "op-q6",
        entryType: "Q6",
        effectiveOn: "2026-10-12",
        postings: [posting("BOX", 80000, { refId: ACCOUNT_BOX }), posting("AR", -80000, { refId: LINE_REM })],
      }),
    );
    expect(() => assertLedgerCoreInvariants(corrupted)).toThrowError(/INV-2/);
  });

  it("كسر INV-1 (معادلة كونية): يرمي برسالة تحمل INV-1", () => {
    const corrupted = s1State();
    entryOf(corrupted, "e-q1-cash").postings[1] = posting("OPEN", 50000);
    expect(() => assertLedgerCoreInvariants(corrupted)).toThrowError(/INV-1/);
  });
});

/* ─── مسح شامل: العشرة ثوابت على الحالات السليمة (الانتقالية بهوية قبل=بعد) ─── */
describe("المسح الشامل — العشرة على الحالات السليمة", () => {
  it("كل فحص من العشرة يعيد pass على كل حالة سليمة", () => {
    const checks = [
      checkInv1,
      checkInv2,
      checkInv3,
      checkInv4,
      checkInv5,
      checkInv6,
      checkInv7,
      checkInv8,
      checkInv9,
      checkInv10,
    ];
    for (const [name, healthy] of healthyStates) {
      for (const check of checks) {
        expect(check(healthy, healthy), `${name} × ${check.name}`).toEqual({
          invariantId: expect.any(String),
          outcome: "pass",
        });
      }
    }
  });
});
