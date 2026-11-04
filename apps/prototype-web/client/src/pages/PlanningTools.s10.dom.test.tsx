/** @vitest-environment jsdom */
/* S10 (UNIT-030 — أمر b56967d8): رحلات DOM لوجهة أدوات المشروع والأدوات
 * T02–T05 — خمسة مداخل فقط لا سادس (SDF-059)، وقيمة الساعة (300÷(20×5)=3)،
 * وكمية البيع (10/6/200⇒50 وهدف 100⇒75 والمساهمة غير الموجبة صادقة)،
 * ونصيب الفاتورة (80×25٪=20 و2/8=20)، وفحص الفكرة (ثلاثة أقسام والإجابات
 * الفارغة دعوة لسؤال أول) — كلها بلا أي كتابة تخزين. */
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLocation } from "wouter";

const wouterMocks = vi.hoisted(() => ({ navigate: vi.fn(), location: "/tools" }));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useSearch: () => "",
  Redirect: () => null,
  Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
}));
vi.mock("@/app/useReturnNavigation", () => ({
  useReturnPath: () => "/tools",
}));

import Tools from "./Tools";
import HourValue from "./HourValue";
import SalesQuantity from "./SalesQuantity";
import InvoiceShare from "./InvoiceShare";
import IdeaReview from "./IdeaReview";

async function typeInto(label: string | RegExp, text: string) {
  const user = userEvent.setup();
  const field = await screen.findByLabelText(label);
  await user.clear(field);
  await user.type(field, text);
  fireEvent.blur(field);
}

describe("S10 Tools destination — five tools only (SDF-059)", () => {
  afterEach(() => {
    cleanup();
    wouterMocks.navigate.mockClear();
  });

  it("خمسة مداخل فقط: T01–T05 — لا أداة سادسة ولا مدخل تقديرات مستقل", () => {
    render(<Tools />);
    const entries = screen.getAllByTestId(/tool-entry-/);
    expect(entries).toHaveLength(5);
    expect(screen.getByTestId("tool-entry-t01").textContent).toContain("احسب التكلفة وحدد السعر");
    expect(screen.getByTestId("tool-entry-t02").textContent).toContain("قيمة ساعة عملك");
    expect(screen.getByTestId("tool-entry-t03").textContent).toContain("كم أحتاج أن أبيع");
    expect(screen.getByTestId("tool-entry-t04").textContent).toContain("نصيب المشروع من فاتورة");
    expect(screen.getByTestId("tool-entry-t05").textContent).toContain("راجع فكرتك");
    /* لا مدخل سادس بأي اسم ولا قسم «تقديراتي المحفوظة» مستقل (032 داخل الحاسبة). */
    expect(screen.queryByText(/تقديراتي المحفوظة/)).toBeNull();
    /* فتح T01 يذهب للحاسبة نفسها لا لصفحة مستقلة. */
    fireEvent.click(screen.getByTestId("tool-entry-t01").querySelector("button") as HTMLButtonElement);
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/tools/calculator?returnTo=%2Ftools");
  });
});

describe("S10 T02 — قيمة ساعة العمل", () => {
  afterEach(() => cleanup());

  it("300 على (20 يومًا × 5 ساعات) ⇒ 3 د.أ للساعة (U030-AC03)", async () => {
    render(<HourValue />);
    await typeInto("مقابل عملك في الشهر", "300");
    await typeInto("أيام العمل في الشهر", "20");
    await typeInto("ساعات العمل المنتجة يوميًا", "5");
    fireEvent.click(screen.getByRole("button", { name: "احسب قيمة الساعة" }));
    await screen.findByText(/قيمة ساعة عملك التقديرية/);
    expect(screen.getByText("3.00")).toBeTruthy();
    /* الملاحظة اللازمة: مقابل وقتك فقط — لا يشمل المواد والمصاريف. */
    expect(screen.getByText(/لا يشمل المواد والمصاريف الأخرى/)).toBeTruthy();
  });

  it("حقل فارغ يظل مجهولًا — رسالة واضحة لا قسمة صفر (U030-AC04)", async () => {
    render(<HourValue />);
    await typeInto("مقابل عملك في الشهر", "300");
    await typeInto("أيام العمل في الشهر", "20");
    fireEvent.click(screen.getByRole("button", { name: "احسب قيمة الساعة" }));
    const error = await screen.findByRole("alert");
    expect(error.textContent).toContain("الحقل الفارغ غير معروف");
  });
});

describe("S10 T03 — كمية البيع المطلوبة", () => {
  afterEach(() => cleanup());

  it("سعر 10 وتكلفة 6 وثابت 200 ⇒ 50 وحدة؛ وهدف 100 ⇒ 75 (U030-AC05)", async () => {
    render(<SalesQuantity />);
    await typeInto("الفترة", "شهر نوفمبر");
    await typeInto("سعر بيع الوحدة", "10");
    await typeInto("تكلفة كل وحدة", "6");
    await typeInto("مصاريف الفترة الثابتة", "200");
    /* تفعيل الهدف من صندوق الاختيار وإدخال 100. */
    fireEvent.change(screen.getByLabelText("هل تريد ربحًا إضافيًا فوق التغطية؟"), {
      target: { value: "yes" },
    });
    await typeInto(/الربح الإضافي المستهدف في الفترة/, "100");
    fireEvent.click(screen.getByRole("button", { name: "احسب الكمية المطلوبة" }));
    /* النتيجة: 50 للتغطية و75 للهدف في السطر القوي نفسه (الأرقام معزولة bdi). */
    const coverageLabel = await screen.findByText(/وحدة للتغطية/);
    const resultStrong = coverageLabel.closest("strong");
    expect(resultStrong?.textContent).toContain("50");
    expect(resultStrong?.textContent).toContain("75");
    expect(screen.getByText(/مساهمة كل وحدة/).textContent).toContain("4.00");
  });

  it("السعر ≤ التكلفة ⇒ رسالة صادقة لا عدد مضلل (U030-AC07)", async () => {
    render(<SalesQuantity />);
    await typeInto("الفترة", "شهر");
    await typeInto("سعر بيع الوحدة", "5");
    await typeInto("تكلفة كل وحدة", "6");
    await typeInto("مصاريف الفترة الثابتة", "200");
    fireEvent.click(screen.getByRole("button", { name: "احسب الكمية المطلوبة" }));
    const error = await screen.findByRole("alert");
    expect(error.textContent).toContain("لا يساهم في تغطية");
  });
});

describe("S10 T04 — نصيب المشروع من فاتورة مشتركة", () => {
  afterEach(() => cleanup());

  it("فاتورة 80 ونسبة 25٪ ⇒ نصيب 20 ومتبقي 60 بأساس ظاهر (U030-AC10)", async () => {
    render(<InvoiceShare />);
    await typeInto("قيمة الفاتورة", "80");
    await typeInto("نسبة المشروع من الفاتورة", "25");
    fireEvent.click(screen.getByRole("button", { name: "احسب نصيب المشروع" }));
    await screen.findAllByText(/نصيب المشروع التقديري/);
    expect(screen.getByText("20.00")).toBeTruthy();
    expect(screen.getByText(/الأساس:/).textContent).toContain("25٪ من فاتورة");
    expect(screen.getByText(/المتبقي/).textContent).toContain("60.00");
    expect(screen.getByText(/لا يُسجل منه أي مصروف/)).toBeTruthy();
  });

  it("أساس الاستخدام: جزء 2 من إجمالي 8 لفاتورة 80 ⇒ 20 (U030-AC11)", async () => {
    render(<InvoiceShare />);
    await typeInto("قيمة الفاتورة", "80");
    fireEvent.change(screen.getByLabelText("كيف تريد تقدير نصيب المشروع؟"), { target: { value: "usage" } });
    await typeInto("استخدام المشروع", "2");
    await typeInto("إجمالي الاستخدام", "8");
    fireEvent.click(screen.getByRole("button", { name: "احسب نصيب المشروع" }));
    expect(await screen.findByText("20.00")).toBeTruthy();
    expect(screen.getByText(/الأساس:/).textContent).toContain("2");
  });
});

describe("S10 T05 — فحص الفكرة الأولي", () => {
  afterEach(() => cleanup());

  it("إجابات ناقصة ⇒ ثلاثة أقسام وخطوة تحقق — بلا درجة (U030-AC14)", async () => {
    render(<IdeaReview />);
    await typeInto(/ماذا ستبيع أو تقدم/, "صناديق هدايا مخصصة");
    await typeInto(/كيف ستصل لأول عميل/, "إنستغرام");
    fireEvent.click(screen.getByRole("button", { name: "راجع الإجابات" }));
    expect(await screen.findByText("ما حددته")).toBeTruthy();
    expect(screen.getByText("ما يحتاج توضيحًا")).toBeTruthy();
    expect(screen.getByText("خطوتك التالية")).toBeTruthy();
    expect(screen.getByText(/اسأل عميلًا محتملًا/)).toBeTruthy();
    /* الناقص معروض بأسماء أسئلته لا بأرقام مخترعة — داخل قسم النتيجة نفسه. */
    const resultSection = screen.getByText("خطوتك التالية").closest("section");
    expect(resultSection?.textContent).toContain("من سيشتري؟");
    expect(resultSection?.textContent).toContain("كم تتوقع تكلفة الوحدة وسعرها؟");
  });

  it("كل الإجابات فارغة ⇒ دعوة لسؤال أول لا ملخص مصطنع (U030-AC15)", async () => {
    render(<IdeaReview />);
    fireEvent.click(screen.getByRole("button", { name: "راجع الإجابات" }));
    const nextStep = await screen.findByText(/أجب عن سؤال واحد الآن/);
    expect(nextStep.textContent).toContain("ماذا ستبيع أو تقدم؟");
    expect(screen.queryByText("ما حددته")).toBeNull();
  });
});
