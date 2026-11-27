/**
 * M5.1 (مانج-في₂ المرحلة 5): اختبارات وحدة العميل — محلل إدخال المال
 * (R-1a/R-20: عقد الدومين نفسه لكن null بدل الرمي)، نص حقل التعبئة
 * (٣ منازل دائمًا)، تنسيق R-21، العمر R-19 بكل صناديقه، الاستيفاء، وخرائط
 * الأخطاء (رمز §11 من التفاصيل + T56 الشبكي → E-OFFLINE).
 */
import { describe, expect, it } from "vitest";
import {
  parseJodInputToFils,
  jodInputText,
  formatDateR21,
  formatMonthR21,
  ageTextR19,
  fill,
  manageErrorText,
} from "@/application/manage/presentation";
import { ApiError } from "@/application/network/apiClient";
import { MANAGE_STRINGS_AR } from "@/application/manage/strings";

describe("M5.1 — parseJodInputToFils (R-1a/R-20)", () => {
  it("يقبل الصيغ القانونية: صحيح، كسر ١–٣ منازل، وتجميع الآلاف", () => {
    expect(parseJodInputToFils("12")).toBe(12000);
    expect(parseJodInputToFils("12.5")).toBe(12500);
    expect(parseJodInputToFils("12.35")).toBe(12350);
    expect(parseJodInputToFils("12.350")).toBe(12350);
    expect(parseJodInputToFils("1,250.000")).toBe(1250000);
    expect(parseJodInputToFils("0")).toBe(0);
  });
  it("يرفض كل ما عداه بnull (فشل مغلق بلا رمي): أكثر من ٣ منازل، إشارة، فراغ، هندي، فارغ", () => {
    expect(parseJodInputToFils("12.1234")).toBeNull();
    expect(parseJodInputToFils("-5")).toBeNull();
    expect(parseJodInputToFils("12 ")).toBeNull();
    expect(parseJodInputToFils("١٢")).toBeNull();
    expect(parseJodInputToFils("")).toBeNull();
    expect(parseJodInputToFils("1,25.000")).toBeNull();
  });
});

describe("M5.1 — jodInputText (تعبئة C-01 من فلس الخادم)", () => {
  it("٣ منازل دائمًا بلا رمز عملة — 1250000 → «1,250.000»", () => {
    expect(jodInputText(1250000)).toBe("1,250.000");
    expect(jodInputText(0)).toBe("0.000");
    expect(jodInputText(85500)).toBe("85.500");
  });
  it("دوران ذاتي: parse(format(x)) === x لكل قيمة آمنة", () => {
    for (const fils of [0, 1, 999, 1000, 85500, 1250000, 999999999]) {
      expect(parseJodInputToFils(jodInputText(fils))).toBe(fils);
    }
  });
});

describe("M5.1 — التنسيق R-21 والعمر R-19", () => {
  it("formatDateR21: 2026-11-25 → 25/11/2026 (وغير الصالح كما ورد)", () => {
    expect(formatDateR21("2026-11-25")).toBe("25/11/2026");
    expect(formatDateR21("not-a-date")).toBe("not-a-date");
  });
  it("formatMonthR21: رأس الشهر 11/2026", () => {
    expect(formatMonthR21("2026-11-08")).toBe("11/2026");
  });
  it("ageTextR19 بكل صناديق R-19 الحرفية (الأسابيع 14–55 يومًا والأشهر ≥56)", () => {
    const origin = "2026-11-01";
    expect(ageTextR19(origin, "2026-11-01")).toBe(MANAGE_STRINGS_AR["a.today"]);
    expect(ageTextR19(origin, "2026-11-02")).toBe(MANAGE_STRINGS_AR["l.age_day1"]);
    expect(ageTextR19(origin, "2026-11-03")).toBe(MANAGE_STRINGS_AR["l.age_day2"]);
    expect(ageTextR19(origin, "2026-11-06")).toBe(MANAGE_STRINGS_AR["l.age_days"].replace("{n}", "5"));
    expect(ageTextR19(origin, "2026-11-13")).toBe(MANAGE_STRINGS_AR["l.age_days_many"].replace("{n}", "12"));
    expect(ageTextR19(origin, "2026-11-15")).toBe(MANAGE_STRINGS_AR["l.age_week2"]);
    expect(ageTextR19(origin, "2026-11-22")).toBe(MANAGE_STRINGS_AR["l.age_weeks"].replace("{n}", "3"));
    /* 30 يومًا ما تزال في نطاق الأسابيع (14–55) — الأشهر تبدأ من 56. */
    expect(ageTextR19(origin, "2026-12-01")).toBe(MANAGE_STRINGS_AR["l.age_weeks"].replace("{n}", "4"));
    expect(ageTextR19(origin, "2026-12-27")).toBe(MANAGE_STRINGS_AR["l.age_month1"]);
    expect(ageTextR19(origin, "2027-01-15")).toBe(MANAGE_STRINGS_AR["l.age_month2"]);
    expect(ageTextR19(origin, "2027-02-01")).toBe(MANAGE_STRINGS_AR["l.age_months"].replace("{n}", "3"));
    expect(ageTextR19(origin, "2028-02-01")).toBe(
      MANAGE_STRINGS_AR["l.age_months_many"].replace("{n}", "15"),
    );
  });
});

describe("M5.1 — fill الاستيفاء وخرائط الأخطاء", () => {
  it("fill يستبدل العناصر النائبة حرفيًا", () => {
    expect(fill("s.balance", { amount: "85" })).toBe(
      MANAGE_STRINGS_AR["s.balance"].replace("{amount}", "85"),
    );
    expect(fill("l.paid_of", { X: "10", Y: "36" })).toBe(
      MANAGE_STRINGS_AR["l.paid_of"].replace("{X}", "10").replace("{Y}", "36"),
    );
  });
  it("manageErrorText: رمز §11 من التفاصيل → نص الكتالوج", () => {
    const error = new ApiError(400, {
      code: "e-amount",
      message: "server text",
      details: { code: "E-AMOUNT" },
    });
    expect(manageErrorText(error)).toBe(MANAGE_STRINGS_AR["E-AMOUNT"]);
  });
  it("manageErrorText: T56 — فشل الشبكة → E-OFFLINE (لا يُحفظ شيء)", () => {
    expect(manageErrorText(new TypeError("Failed to fetch"))).toBe(MANAGE_STRINGS_AR["E-OFFLINE"]);
  });
  it("manageErrorText: رسالة الخادم العربية لما ليس له رمز موصوف", () => {
    const error = new ApiError(500, { code: "internal_error", message: "حدث خطأ غير متوقع" });
    expect(manageErrorText(error)).toBe("حدث خطأ غير متوقع");
  });
});
