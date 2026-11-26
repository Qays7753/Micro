/**
 * M1.7 (§9 R-1/R-1a/R-2 + R-20…R-22 / IMPACT §4 / قرار المالك D-4): اختبارات
 * وحدة فلس مانج الجديدة `src/domain/manage/money/` (الفلس = 1/1000 دينار،
 * عدد صحيح، تقريب نصف لأعلى مرة واحدة لكل ضرب/قسمة).
 *  - التحليل (filsFromJodText): صارم — بحد أقصى ٣ منازل عشرية، يرفض أكثر من
 *    ٣ منازل وغير الرقمي، ويقبل الصيغة القانونية R-20 بفواصل الآلاف
 *    («1,250.000») والصيغة المجردة («12.350»/«12.35»).
 *  - التنسيق (jodTextFromFils): ٣ منازل دائمًا + فواصل آلاف + «.» عشري.
 *  - الجمع/الطرح: أعداد صحيحة آمنة فقط، والناتج غير الآمن يُرفض بالرمي.
 *  - الضرب بكمية بالملي والقسمة: تقريب نصف لأعلى مرة واحدة بالضبط (نحو
 *    الأعلى «لأعلى» حرفيًا عند كسر 0.5 — مطابق لسلوك المواصفة على كل
 *    مقاديرها الموجبة، وموثَّق كامتداد متماثل للسالب).
 *  - فحص مصدر: لا «/100» ولا «*100» في الموديول، ولا أي اعتماد على دوال
 *    المال المشتركة القديمة (كل الاستيرادات نسبية داخل الشجرة حصرًا)، ولا
 *    Math.round/floor (المحظورة في المجال — الحساب صحيح خالص/BigInt).
 */
import { describe, expect, it } from "vitest";
import {
  FILS_PER_JOD,
  addFils,
  divFils,
  filsFromJodText,
  jodTextFromFils,
  mulFilsByQuantityMilli,
  subFils,
} from "../../src/domain/manage/index.js";

const manageSources: Record<string, string> = import.meta.glob("../../src/domain/manage/**/*", {
  query: "?raw",
  import: "default",
  eager: true,
});

/* ─── جداول التحليل: المقبول (نص → فلس) ─── */
const parseAccepted: ReadonlyArray<[string, number]> = [
  ["12.350", 12350],
  ["12.35", 12350],
  ["12.3", 12300],
  ["12", 12000],
  ["0", 0],
  ["0.000", 0],
  ["0.001", 1],
  ["1250.000", 1250000],
  ["1,250.000", 1250000],
  ["1,250", 1250000],
  ["1,000,000.500", 1000000500],
  ["999,999.999", 999999999],
  ["12,350", 12350000],
  ["9007199254740.991", 9007199254740991],
];

/* ─── جداول التحليل: المرفوض (غير رقمي/أكثر من ٣ منازل/إشارة/أرقام هندية…) ─── */
const parseRejected: readonly string[] = [
  "12.3456",
  "12.3500",
  "",
  " ",
  "abc",
  "12a.350",
  "-12.350",
  "+12.350",
  "١٢.٣٥٠",
  " 12.350",
  "12.350 ",
  ".350",
  "12.",
  "1.250.000",
  "1,25.000",
  "123,4.000",
  "12,,350",
  "12,3",
  "1,234,56.000",
  "9007199254741.000",
  "99999999999999999",
];

/* ─── جداول التنسيق: فلس → نص ─── */
const formatCases: ReadonlyArray<[number, string]> = [
  [0, "0.000"],
  [1, "0.001"],
  [5, "0.005"],
  [999, "0.999"],
  [1000, "1.000"],
  [12350, "12.350"],
  [1250000, "1,250.000"],
  [123456789, "123,456.789"],
  [1000000000, "1,000,000.000"],
  [9007199254740991, "9,007,199,254,740.991"],
  [-200000, "-200.000"],
  [-5, "-0.005"],
  [-123456789, "-123,456.789"],
];

const formatRejected: readonly number[] = [1.5, -1.5, Number.NaN, Number.POSITIVE_INFINITY, 9007199254740992, -9007199254740992];

/* ─── تقريب نصف لأعلى: الضرب بالملي (فلس × كمّ بالملي ÷ ١٠٠٠) ─── */
const mulCases: ReadonlyArray<[number, number, number]> = [
  [12350, 1500, 18525],
  [1250, 2500, 3125],
  [5, 100, 1],
  [5, 300, 2],
  [5, 1000, 5],
  [15, 100, 2],
  [25, 100, 3],
  [1, 1, 0],
  [0, 999, 0],
  [500, 1, 1],
  [-5, 100, 0],
  [9007199254740991, 1000, 9007199254740991],
];

/* ─── تقريب نصف لأعلى: القسمة ─── */
const divCases: ReadonlyArray<[number, number, number]> = [
  [5, 2, 3],
  [100, 3, 33],
  [101, 3, 34],
  [10, 2, 5],
  [0, 7, 0],
  [7, 3, 2],
  [9, 4, 2],
  [-5, 2, -2],
  [9007199254740991, 1, 9007199254740991],
];

describe("M1.7 (§9/IMPACT §4/D-4) — filsFromJodText", () => {
  it.each(parseAccepted)("accepts %s → %d fils", (text, expected) => {
    expect(filsFromJodText(text)).toBe(expected);
  });

  it.each(parseRejected)("rejects %j", (text) => {
    expect(() => filsFromJodText(text)).toThrow();
  });
});

describe("M1.7 (R-1a/R-20/R-22) — jodTextFromFils", () => {
  it.each(formatCases)("formats %d → %s", (fils, expected) => {
    expect(jodTextFromFils(fils)).toBe(expected);
  });

  it.each(formatRejected)("rejects non-safe-integer %d", (fils) => {
    expect(() => jodTextFromFils(fils)).toThrow();
  });

  it("round-trips non-negative values: parse(format(x)) === x (negatives are computed, never parsed)", () => {
    const nonNegative = formatCases.filter(([fils]) => fils >= 0);
    expect(nonNegative.length).toBeGreaterThan(0);
    for (const [fils] of nonNegative) {
      expect(filsFromJodText(jodTextFromFils(fils))).toBe(fils);
    }
  });
});

describe("M1.7 (§9/IMPACT §4/D-4) — addFils / subFils", () => {
  it("adds and subtracts exact integer fils", () => {
    expect(addFils(12350, 1)).toBe(12351);
    expect(addFils(0, 0)).toBe(0);
    expect(addFils(-200000, 150000)).toBe(-50000);
    expect(subFils(12350, 12350)).toBe(0);
    expect(subFils(0, 5)).toBe(-5);
    expect(addFils(9007199254740991, -1)).toBe(9007199254740990);
  });

  it("throws on unsafe inputs and unsafe results", () => {
    expect(() => addFils(9007199254740991, 1)).toThrow();
    expect(() => subFils(-9007199254740991, 1)).toThrow();
    expect(() => addFils(1.5, 1)).toThrow();
    expect(() => addFils(Number.NaN, 0)).toThrow();
    expect(() => subFils(0, Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe("M1.7 (R-2) — mulFilsByQuantityMilli (round half up, once)", () => {
  it.each(mulCases)("%d fils × %d milli → %d", (fils, milli, expected) => {
    expect(mulFilsByQuantityMilli(fils, milli)).toBe(expected);
  });

  it("throws on unsafe inputs and unsafe results", () => {
    expect(() => mulFilsByQuantityMilli(9007199254740991, 2000)).toThrow();
    expect(() => mulFilsByQuantityMilli(1.5, 100)).toThrow();
    expect(() => mulFilsByQuantityMilli(100, 1.5)).toThrow();
    expect(() => mulFilsByQuantityMilli(Number.NaN, 1)).toThrow();
  });
});

describe("M1.7 (R-2) — divFils (round half up, once)", () => {
  it.each(divCases)("%d ÷ %d → %d", (fils, divisor, expected) => {
    expect(divFils(fils, divisor)).toBe(expected);
  });

  it("throws on non-positive or non-integer divisors", () => {
    expect(() => divFils(5, 0)).toThrow();
    expect(() => divFils(5, -2)).toThrow();
    expect(() => divFils(5, 2.5)).toThrow();
    expect(() => divFils(5, Number.NaN)).toThrow();
  });
});

describe("M1.7 — module constants", () => {
  it("FILS_PER_JOD is 1000 (ISO 4217 JOD minor unit)", () => {
    expect(FILS_PER_JOD).toBe(1000);
  });
});

describe("M1.7 — source scans (module self-containment)", () => {
  it("src/domain/manage has files and every import is relative (no external/shared dependency)", () => {
    expect(Object.keys(manageSources).length).toBeGreaterThan(0);
    const edges = Object.entries(manageSources).flatMap(([file, source]) =>
      [...source.matchAll(/from\s*["']([^"']+)["']/g)].map((match) => `${file} → ${match[1] ?? ""}`),
    );
    const nonRelative = edges.filter((edge) => {
      const specifier = edge.split(" → ")[1] ?? "";
      return !specifier.startsWith(".");
    });
    expect(nonRelative).toEqual([]);
  });

  it("no /100 or *100 anywhere in the module (fils only, never qirsh)", () => {
    const hits = Object.entries(manageSources)
      .filter(([, source]) => /\/100(?![0-9])|\*100(?![0-9])/.test(source))
      .map(([file]) => file);
    expect(hits).toEqual([]);
  });

  it("no legacy shared-money naming and no Math.round/floor in the module", () => {
    const hits = Object.entries(manageSources)
      .filter(([, source]) => /Minor\b|Math\.round|Math\.floor/.test(source))
      .map(([file]) => file);
    expect(hits).toEqual([]);
  });
});
