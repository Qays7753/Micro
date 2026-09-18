/** @vitest-environment jsdom */
/* Wave 4.4 — P-4.4-2: عقد التاريخ والوقت والمنطقة الزمنية والمبالغ.
 * ---------------------------------------------------------------------------
 * الاختبارات الحتمية عبر المناطق: كل نداء لحظي يمرر منطقة صريحة؛ نداء
 * المكوّنات في الإنتاج بلا معامل فيتبع توقيت الجهاز (سياسة الموجة).
 *
 * ١) التاريخ: منتصف الليل وحدوده، نهاية الشهر والسنة، الكبيسة، مناطق
 *    موجبة وسالبة، Date-only لا يتconvert أبدًا، الفارغ والفاسد يعلنان
 *    غياب المعرفة (null) لا صفرًا ولا تاريخًا مفبركًا.
 * ٢) الوقت: 12 ساعة بفترة ص/م وصفر بادئ؛ التخزين HH:MM 24 يبقى كما هو.
 * ٣) اللحظة الكاملة: DD/MM/YYYY، HH:MM ص/م بفاصلة عربية على توقيت الجهاز
 *    الممرر صراحة في الاختبار.
 * ٤) تاريخ الأعمال من لحظة (businessDateFromTimestamp): بتوقيت عمّان
 *    الكنوني من عقد المجموعة ٩ — لا قصّ UTC الذي يزيح اليوم بعد 21:00Z.
 * ٥) المال: منزلتان دائمًا، مجهول ≠ صفر، لا تقريب مزدوج، الوحدة د.أ
 *    خارج العزل الاتجاهي للرقم، والإشارة السالبة لا تنفصل في RTL.
 */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  businessDateFromTimestamp,
  formatLocalDate,
  formatLocalDateTime,
  formatMoneyMinor,
  formatMoneyWithUnit,
  formatTime,
} from "./formatters";
import { DateTimeValue, MoneyValue, TimeValue } from "@/components/presentation/DisplayValue";

afterEach(cleanup);

describe("P-4.4-2 — عقد التاريخ والوقت والمنطقة الزمنية", () => {
  it("التاريخ مع الوقت: DD/MM/YYYY، فاصلة عربية، 12 ساعة بص/م، وصفر بادئ — على توقيت الجهاز (منطقة صريحة)", () => {
    expect(formatLocalDateTime("2026-09-16T00:30:00.000Z", "Asia/Amman")).toBe("16/09/2026، 03:30 ص");
    expect(formatLocalDateTime("2026-09-16T12:30:00.000Z", "Asia/Amman")).toBe("16/09/2026، 03:30 م");
    /* صفر بادئ للساعة أحادية المنزلة */
    expect(formatLocalDateTime("2026-09-16T22:05:00.000Z", "Asia/Amman")).toBe("17/09/2026، 01:05 ص");
    /* منتصف الليل = 12:00 ص لا 00:00 ولا 24:00 */
    expect(formatLocalDateTime("2026-09-16T21:00:00.000Z", "Asia/Amman")).toBe("17/09/2026، 12:00 ص");
    expect(formatLocalDateTime("2026-09-16T09:00:00.000Z", "Asia/Amman")).toBe("16/09/2026، 12:00 م");
  });

  it("مناطق موجبة وسالبة: نفس اللحظة تُعرض بتوقيت كل جهاز — لا منطقة مثبتة في العرض", () => {
    const instant = "2026-06-15T12:00:00.000Z";
    expect(formatLocalDateTime(instant, "Asia/Amman")).toBe("15/06/2026، 03:00 م");
    expect(formatLocalDateTime(instant, "America/New_York")).toBe("15/06/2026، 08:00 ص");
    expect(formatLocalDateTime(instant, "Pacific/Kiritimati")).toBe("16/06/2026، 02:00 ص");
    expect(formatLocalDateTime(instant, "Pacific/Pago_Pago")).toBe("15/06/2026، 01:00 ص");
    /* جهاز بتوقيت UTC — نفس اللحظة 12:00 م */
    expect(formatLocalDateTime(instant, "UTC")).toBe("15/06/2026، 12:00 م");
  });

  it("حدود منتصف الليل: قبل الحد يوم، بعده اليوم التالي — بنفس المنطقة", () => {
    expect(formatLocalDateTime("2026-08-23T20:59:00.000Z", "Asia/Amman")).toBe("23/08/2026، 11:59 م");
    expect(formatLocalDateTime("2026-08-23T21:00:00.000Z", "Asia/Amman")).toBe("24/08/2026، 12:00 ص");
  });

  it("نهاية الشهر ونهاية السنة تعبر الحدود كاملة", () => {
    expect(formatLocalDateTime("2026-01-31T21:00:00.000Z", "Asia/Amman")).toBe("01/02/2026، 12:00 ص");
    expect(formatLocalDateTime("2025-12-31T21:59:00.000Z", "Asia/Amman")).toBe("01/01/2026، 12:59 ص");
    /* 2028 كبيسة: 28/29 فبراير موجودة */
    expect(formatLocalDateTime("2028-02-28T21:00:00.000Z", "Asia/Amman")).toBe("29/02/2028، 12:00 ص");
  });

  it("السنة الكبيسة في Date-only: 29/02/2024 مقبولة و29/02/2026 مرفوضة", () => {
    expect(formatLocalDate("2024-02-29")).toBe("29/02/2024");
    expect(formatLocalDate("2026-02-29")).toBeNull();
    expect(formatLocalDate("2028-02-29")).toBe("29/02/2028");
  });

  it("Date-only ليس لحظة: يُعرض تاريخًا صرفًا في كل المناطق — لا انزياح يوم أبدًا", () => {
    expect(formatLocalDateTime("2026-09-16", "Asia/Amman")).toBe("16/09/2026");
    expect(formatLocalDateTime("2026-09-16", "Pacific/Kiritimati")).toBe("16/09/2026");
    expect(formatLocalDateTime("2026-09-16", "Pacific/Pago_Pago")).toBe("16/09/2026");
    expect(formatLocalDateTime("2026-09-16", "UTC")).toBe("16/09/2026");
  });

  it("القيمة الناقصة والفاسدة تعلنان غياب المعرفة — لا صفر ولا تاريخ مفبرك", () => {
    expect(formatLocalDateTime(null)).toBeNull();
    expect(formatLocalDateTime(undefined)).toBeNull();
    expect(formatLocalDateTime("")).toBeNull();
    expect(formatLocalDateTime("not-a-timestamp")).toBeNull();
    expect(formatLocalDate(null)).toBeNull();
    expect(formatLocalDate("2026-13-45")).toBeNull();
    expect(formatTime(null)).toBeNull();
  });

  it("تاريخ الأعمال من لحظة: عقد المجموعة ٩ (عمّان) لا قصّ UTC — الحدود عند 21:00Z", () => {
    /* قبل حد اليوم: نفس اليوم */
    expect(businessDateFromTimestamp("2026-08-23T20:59:59.999Z")).toBe("2026-08-23");
    /* بعد حد اليوم (00:00 عمّان): اليوم التالي — كان قصّ UTC يثبّت اليوم السابق */
    expect(businessDateFromTimestamp("2026-08-23T21:00:00.000Z")).toBe("2026-08-24");
    expect(businessDateFromTimestamp("2026-08-23T22:30:00.000Z")).toBe("2026-08-24");
    /* Date-only الكنوني يمر كما هو */
    expect(businessDateFromTimestamp("2026-08-23")).toBe("2026-08-23");
    /* الفاسد يعلن الغياب */
    expect(businessDateFromTimestamp("not-a-timestamp")).toBeNull();
    expect(businessDateFromTimestamp(null)).toBeNull();
  });

  it("منطقة جهاز مختلفة عن منطقة التخزين: القيمة المخزنة UTC لا تتغير والعرض يتبع الجهاز", () => {
    /* التخزين بصيغة UTC الموحدة — العرض تحويل عرضي فقط */
    const stored = "2026-09-16T00:30:00.000Z";
    const amman = formatLocalDateTime(stored, "Asia/Amman");
    const newYork = formatLocalDateTime(stored, "America/New_York");
    expect(amman).toBe("16/09/2026، 03:30 ص");
    expect(newYork).toBe("15/09/2026، 08:30 م");
    /* كل عرض يمثل نفس اللحظة: التعديل لا يعيد كتابة المخزن */
    expect(stored).toBe("2026-09-16T00:30:00.000Z");
  });
});

describe("P-4.4-2 — الوقت المستقل: 12 ساعة بفترة عربية وصفر بادئ", () => {
  it("الحدود الكاملة للنهار: منتصف الليل والظهر وآخر الدقيقة", () => {
    expect(formatTime("00:00")).toBe("12:00 ص");
    expect(formatTime("00:30")).toBe("12:30 ص");
    expect(formatTime("03:30")).toBe("03:30 ص");
    expect(formatTime("11:59")).toBe("11:59 ص");
    expect(formatTime("12:00")).toBe("12:00 م");
    expect(formatTime("12:01")).toBe("12:01 م");
    expect(formatTime("15:30")).toBe("03:30 م");
    expect(formatTime("23:59")).toBe("11:59 م");
  });

  it("الصفر البادئ للساعة والدقيقة محفوظ", () => {
    expect(formatTime("09:05")).toBe("09:05 ص");
    expect(formatTime("21:05")).toBe("09:05 م");
  });

  it("الصيغة المخزنة HH:MM بنظام 24 لا تتغير بعرض 12 ساعة", () => {
    /* العرض دالة صرفة: لا تعيد كتابة المدخل */
    const stored = "23:45";
    expect(formatTime(stored)).toBe("11:45 م");
    expect(stored).toBe("23:45");
  });

  it("القيم المستحيلة ترفض — لا تخمين ولا تصحيح صامت", () => {
    expect(formatTime("24:00")).toBeNull();
    expect(formatTime("12:60")).toBeNull();
    expect(formatTime("3:30")).toBeNull();
    expect(formatTime("0330")).toBeNull();
    expect(formatTime("")).toBeNull();
  });
});

describe("P-4.4-2 — عقد المبالغ", () => {
  it("منزلتان دائمًا: صفر حقيقي وموجب وسالب وكبير وكسور", () => {
    expect(formatMoneyMinor(0)).toBe("0.00");
    expect(formatMoneyMinor(1)).toBe("0.01");
    expect(formatMoneyMinor(2500)).toBe("25.00");
    expect(formatMoneyMinor(-1525)).toBe("-15.25");
    expect(formatMoneyMinor(123450)).toBe("1,234.50");
    expect(formatMoneyMinor(99999999999)).toBe("999,999,999.99");
  });

  it("المجهول ليس صفرًا: الفارغ وغير المحدد وغير المنتهي تعلن «—» لا 0.00", () => {
    expect(formatMoneyMinor(null)).toBe("—");
    expect(formatMoneyMinor(undefined)).toBe("—");
    expect(formatMoneyMinor(Number.NaN)).toBe("—");
    expect(formatMoneyMinor(Number.POSITIVE_INFINITY)).toBe("—");
    expect(formatMoneyMinor(null)).not.toBe("0.00");
    expect(formatMoneyWithUnit(null)).toBe("—");
  });

  it("الوحدة د.أ تُضم بالعرض مع المسافة — للقيمة المعروفة فقط", () => {
    expect(formatMoneyWithUnit(2500)).toBe("25.00 د.أ");
    expect(formatMoneyWithUnit(-1525)).toBe("-15.25 د.أ");
    expect(formatMoneyWithUnit(123450)).toBe("1,234.50 د.أ");
    expect(formatMoneyWithUnit(0)).toBe("0.00 د.أ");
  });

  it("لا تقريب مزدوج: القيمة الصحيحة Minor تعود كاملة بعد إعادة التحليل", () => {
    /* التنسيق تمثيل لا حساب: minor/100 ثم min/max 2 منزلتين — الدورة
     * الكاملة تسترجع نفس القيمة الصحيحة للفئة المالية الواقعية. */
    for (const minor of [0, 1, 5, 9, 10, 99, 100, 199, 1234, 99999, 123456789, -1525]) {
      const rendered = formatMoneyMinor(minor);
      const reparsed = Number.parseFloat(rendered.replace(/,/g, ""));
      expect(Math.round(reparsed * 100)).toBe(minor);
    }
    /* الكسور الحساسة: 0.005 د.أ (نصف فلس) لا تظهر أبدًا كقيمة مخترعة */
    expect(formatMoneyMinor(0.5)).toBe("0.01");
    expect(formatMoneyMinor(1.5)).toBe("0.02");
  });

  it("العرض لا يغيّر المدخل المخزن — دالة صرفة على Minor", () => {
    const stored = 123456;
    expect(formatMoneyMinor(stored)).toBe("1,234.56");
    expect(stored).toBe(123456);
  });
});

describe("P-4.4-2 — مكوّنات العرض: العزل الاتجاهي للنص العربي المختلط", () => {
  it("DateTimeValue: bdi بلا فرض LTR — النص العربي المختلط يتبع auto", () => {
    const { container } = render(<DateTimeValue value="2026-09-16" />);
    const bdi = container.querySelector("bdi");
    expect(bdi).not.toBeNull();
    expect(bdi?.getAttribute("dir")).toBeNull();
    expect(bdi?.textContent).toBe("16/09/2026");
  });

  it("TimeValue: الوقت بفترة عربية داخل bdi بلا فرض LTR", () => {
    const { container } = render(<TimeValue value="15:30" />);
    const bdi = container.querySelector("bdi");
    expect(bdi?.getAttribute("dir")).toBeNull();
    expect(bdi?.textContent).toBe("03:30 م");
  });

  it("TimeValue الفارغ يعرض الشرطة الطويلة لا وقتًا مفبركًا", () => {
    render(<TimeValue value={null} />);
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("MoneyValue: الرقم يبقى معزولًا LTR والإشارة السالبة معلنة بلا لون", () => {
    const { container, rerender } = render(<MoneyValue minor={-1525} />);
    const bdi = container.querySelector("bdi");
    expect(bdi?.getAttribute("dir")).toBe("ltr");
    expect(bdi?.textContent).toBe("-15.25");
    /* إشارة غير لونية للسالب — data-negative */
    expect(bdi?.getAttribute("data-negative")).toBe("true");

    rerender(<MoneyValue minor={2500} />);
    expect(container.querySelector("bdi")?.getAttribute("data-negative")).toBe("false");

    rerender(<MoneyValue minor={null} />);
    expect(container.querySelector("bdi")?.textContent).toBe("—");
    expect(container.querySelector("bdi")?.getAttribute("data-negative")).toBe("false");
  });

  it("MoneyValue بالإشارة الموجبة الاختيارية: + للإيداع لا للفراغ ولا للصفر", () => {
    const { container, rerender } = render(<MoneyValue minor={500} showPlus />);
    expect(container.querySelector("bdi")?.textContent).toBe("+5.00");
    rerender(<MoneyValue minor={0} showPlus />);
    expect(container.querySelector("bdi")?.textContent).toBe("0.00");
    rerender(<MoneyValue minor={-500} showPlus />);
    expect(container.querySelector("bdi")?.textContent).toBe("-5.00");
  });
});
