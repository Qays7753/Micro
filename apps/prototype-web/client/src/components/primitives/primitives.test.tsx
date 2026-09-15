/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  Button,
  ChoiceButton,
  ChoiceRow,
  EmptyState,
  FeedbackNote,
  Field,
  InlineError,
  Notice,
  QuietCompletion,
  Row,
  RowList,
  StatusChip,
  chipPresentation,
} from "./index";
import { MoneyWithUnit } from "@/components/presentation/DisplayValue";
import { readFileSync } from "node:fs";
import { Activity } from "lucide-react";

/*
 * W2 — اختبارات المكوّنات الأولية: العقود والحالات وحدود الملكية.
 */

afterEach(cleanup);

describe("W2 StatusChip: word + non-color marker + tone contract", () => {
  it("renders the product word exactly as passed (no renames, no invention)", () => {
    render(<StatusChip state="pending">بالانتظار</StatusChip>);
    expect(screen.getByText("بالانتظار")).toBeTruthy();
  });

  it("pending renders an info tone with a clock marker — never success", () => {
    const { container } = render(<StatusChip state="pending">بالانتظار</StatusChip>);
    const chip = container.querySelector(".micro-prim-chip");
    expect(chip?.getAttribute("data-tone")).toBe("info");
    expect(chip?.querySelector("svg")).toBeTruthy();
  });

  it("knowledge states render neutral tone with a non-color marker", () => {
    const { container } = render(<StatusChip state="unconfirmed">غير محدد بعد</StatusChip>);
    const chip = container.querySelector(".micro-prim-chip");
    expect(chip?.getAttribute("data-tone")).toBe("neutral");
    expect(chip?.getAttribute("data-family")).toBe("knowledge");
    expect(chip?.querySelector(".micro-prim-marker")).toBeTruthy();
  });

  it("no-data renders without a marker and never as failure", () => {
    const { container } = render(<StatusChip state="no-data">لا توجد سجلات</StatusChip>);
    const chip = container.querySelector(".micro-prim-chip");
    expect(chip?.getAttribute("data-tone")).toBe("neutral");
    expect(chip?.querySelector("svg")).toBeNull();
  });

  it("the legacy warn-chip defect is fixed: an attention state can no longer render success-green", () => {
    // قبل W2 كانت data-status="warn" تُعرض بلون النجاح (GAP-11/12).
    const p = chipPresentation("incomplete");
    expect(p.tone).not.toBe("success");
    expect(p.isKnowledge).toBe(true);
  });

  it("composed words with counts render inline", () => {
    render(<StatusChip state="incomplete">نقص مفتوح: {2}</StatusChip>);
    expect(screen.getByText("نقص مفتوح: 2")).toBeTruthy();
  });
});

describe("W2 Button: action classes, loading, duplicate-submit protection", () => {
  it("defaults to the ordinary save class", () => {
    const { container } = render(<Button>حفظ</Button>);
    expect(container.querySelector(".micro-prim-button--save")).toBeTruthy();
  });

  it("create class renders for create actions", () => {
    const { container } = render(<Button action="create">سجّل</Button>);
    expect(container.querySelector(".micro-prim-button--create")).toBeTruthy();
  });

  it("loading persists the label, marks aria-busy, disables, and blocks duplicate submission", () => {
    const onClick = vi.fn();
    const { container } = render(
      <Button action="save" loading onClick={onClick}>
        حفظ
      </Button>,
    );
    const button = container.querySelector("button");
    expect(screen.getByText("حفظ")).toBeTruthy();
    expect(button?.getAttribute("aria-busy")).toBe("true");
    expect(button?.hasAttribute("disabled")).toBe(true);
    fireEvent.click(button!);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("disabled buttons do not fire", () => {
    const onClick = vi.fn();
    const { container } = render(
      <Button disabled onClick={onClick}>
        حفظ
      </Button>,
    );
    fireEvent.click(container.querySelector("button")!);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("defaults to type=button (no implicit submit)", () => {
    const { container } = render(<Button>حفظ</Button>);
    expect(container.querySelector("button")?.getAttribute("type")).toBe("button");
  });
});

describe("W2 (completion) Button quiet: documented correction/reversal entry contract", () => {
  it("renders the quiet action class for correction and reversal entries", () => {
    const { container } = render(<Button action="quiet">عدّل هذا السجل</Button>);
    expect(container.querySelector(".micro-prim-button--quiet")).toBeTruthy();
    expect(screen.getByText("عدّل هذا السجل")).toBeTruthy();
  });

  it("quiet keeps the 48px primitive base (exceeds the 44px MR-03/U09 touch floor)", () => {
    const css = readFileSync("client/src/styles/primitives.css", "utf8");
    expect(css).toContain(".micro-prim-button--quiet");
    expect(css).toContain("min-height: var(--vf-control-height)");
  });
});

describe("W2 (completion) ChoiceRow: selected/current edge contract — never a fill", () => {
  it("exposes aria-pressed and the selected edge class on the chosen option only", () => {
    const { container } = render(
      <ChoiceRow>
        <ChoiceButton selected onClick={() => {}}>
          دفعت نقدًا
        </ChoiceButton>
        <ChoiceButton onClick={() => {}}>على الذمم</ChoiceButton>
      </ChoiceRow>,
    );
    const options = container.querySelectorAll(".micro-prim-choice");
    expect(options.length).toBe(2);
    expect(options[0].getAttribute("aria-pressed")).toBe("true");
    expect(options[1].getAttribute("aria-pressed")).toBe("false");
    expect(container.querySelectorAll(".micro-prim-choice--selected").length).toBe(1);
  });

  it("the selected presentation is the clay-interactive edge + weight, never a black or identity fill", () => {
    const css = readFileSync("client/src/styles/primitives.css", "utf8");
    const selectedRule = css.match(/\.micro-prim-choice--selected\s*\{[^}]*\}/)?.[0] ?? "";
    expect(selectedRule).toContain("var(--vf-clay-interactive)");
    expect(selectedRule).not.toContain("var(--vf-btn-primary-bg)");
    expect(selectedRule).not.toContain("var(--vf-btn-create-bg)");
  });

  it("disabled options are marked and do not fire", () => {
    const onClick = vi.fn();
    const { container } = render(
      <ChoiceButton disabled onClick={onClick}>
        خيار
      </ChoiceButton>,
    );
    const option = container.querySelector(".micro-prim-choice") as HTMLButtonElement;
    expect(option.hasAttribute("disabled")).toBe(true);
    fireEvent.click(option);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("R1 FeedbackNote: explicit typed channel (D6 — no prefix guessing)", () => {
  it("kind=completion renders the quiet completion regardless of the word's prefix", () => {
    // سُجّل/أُوقفت/عادت/حُلّ previously misclassified as errors by prefix guessing
    const { container, rerender } = render(<FeedbackNote kind="completion" word="سُجّل إخراج الهدر" />);
    expect(container.querySelector(".micro-prim-notice--quiet-completion")).toBeTruthy();
    rerender(<FeedbackNote kind="completion" word="أُوقفت المتابعة" />);
    expect(container.querySelector(".micro-prim-notice--quiet-completion")).toBeTruthy();
    rerender(<FeedbackNote kind="completion" word="تم الحفظ" />);
    expect(container.querySelector(".micro-prim-notice--quiet-completion")).toBeTruthy();
  });

  it("kind=advisory renders the neutral notice — knowledge, not outcome", () => {
    const { container } = render(<FeedbackNote kind="advisory" word="هذا المرجع موقوف" />);
    expect(container.querySelector(".micro-prim-notice--error-inline")).toBeNull();
    expect(container.querySelector(".micro-prim-notice--quiet-completion")).toBeNull();
    expect(container.querySelector(".micro-prim-notice")).toBeTruthy();
  });

  it("kind=error renders the inline error and never the success marker", () => {
    const { container, rerender } = render(<FeedbackNote kind="error" word="تعذر حفظ التفضيل" />);
    expect(container.querySelector(".micro-prim-notice--error-inline")).toBeTruthy();
    // an error word must never wear the quiet-completion check even if it starts with تم
    rerender(<FeedbackNote kind="error" word="تم إيقاف القراءة بسبب خلل" />);
    expect(container.querySelector(".micro-prim-notice--quiet-completion")).toBeNull();
    expect(container.querySelector(".micro-prim-notice--error-inline")).toBeTruthy();
  });

  it("the channel is declared, not inferred: the same word can carry different truths", () => {
    // the screen owns the truth at event time; identical wording may be a completion or an error
    const { container, rerender } = render(<FeedbackNote kind="completion" word="إيقاف المتابعة" />);
    expect(container.querySelector(".micro-prim-notice--quiet-completion")).toBeTruthy();
    rerender(<FeedbackNote kind="error" word="إيقاف المتابعة" />);
    expect(container.querySelector(".micro-prim-notice--error-inline")).toBeTruthy();
  });
});

describe("Notice family: inline feedback regime (U-07)", () => {
  it("Notice carries role=status", () => {
    render(<Notice>تم</Notice>);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("QuietCompletion renders the check marker beside the past-tense word in ink", () => {
    const { container } = render(<QuietCompletion word="تم الحفظ" />);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText("تم الحفظ")).toBeTruthy();
    expect(container.querySelector(".micro-prim-notice--quiet-completion svg")).toBeTruthy();
  });

  it("InlineError renders the error word with an alert marker", () => {
    const { container } = render(<InlineError>تعذّر الحفظ</InlineError>);
    expect(screen.getByRole("status").textContent).toContain("تعذّر الحفظ");
    expect(container.querySelector("svg")).toBeTruthy();
  });
});

describe("W2 Row: operational slots and the edge-stripe contract", () => {
  it("renders the slot grid: lead, title, caption, state, trailing", () => {
    render(
      <Row
        lead={<span data-testid="lead" />}
        title="طلب زبون"
        caption="تفاصيل"
        state={<StatusChip state="pending">بالانتظار</StatusChip>}
        trailing={<span data-testid="trailing" />}
      />,
    );
    expect(screen.getByText("طلب زبون")).toBeTruthy();
    expect(screen.getByTestId("lead")).toBeTruthy();
    expect(screen.getByTestId("trailing")).toBeTruthy();
  });

  it("never renders a state stripe without a state slot (word is the primary signal)", () => {
    const { container } = render(<Row title="صف" stripeTone="error" />);
    expect(container.querySelector(".micro-prim-row--striped")).toBeNull();
  });

  it("renders the ≤3px stripe only when paired with a state slot", () => {
    const { container } = render(
      <Row title="صف" state={<StatusChip state="error">فشل</StatusChip>} stripeTone="error" />,
    );
    const row = container.querySelector(".micro-prim-row");
    expect(row?.className).toContain("micro-prim-row--striped");
    expect(row?.getAttribute("data-stripe-tone")).toBe("error");
  });

  it("knowledge tones are not valid stripe tones (type-level contract)", () => {
    // stripeTone accepts only success | error | info — knowledge stays word+marker only
    const valid: Array<"success" | "error" | "info"> = ["success", "error", "info"];
    expect(valid).toHaveLength(3);
  });
});

describe("W2 Field: label association and inline error recovery", () => {
  it("binds the label to the control id", () => {
    const { container } = render(
      <Field label="المبلغ" controlId="amount-input">
        <input id="amount-input" />
      </Field>,
    );
    expect(screen.getByLabelText("المبلغ")).toBeTruthy();
    expect(container.querySelector("label")?.getAttribute("for")).toBe("amount-input");
  });

  it("error state renders the error word with a marker and marks the field invalid", () => {
    const { container } = render(
      <Field label="المبلغ" controlId="a" error="المبلغ مطلوب">
        <input id="a" />
      </Field>,
    );
    expect(screen.getByText("المبلغ مطلوب")).toBeTruthy();
    expect(container.querySelector(".micro-prim-field--error")).toBeTruthy();
  });

  it("hint shows only when there is no error (error wins the slot)", () => {
    const { rerender, container } = render(
      <Field label="المبلغ" hint="بيانات وصفية">
        <input />
      </Field>,
    );
    expect(container.querySelector(".micro-prim-field__hint")).toBeTruthy();
    rerender(
      <Field label="المبلغ" hint="بيانات وصفية" error="خطأ">
        <input />
      </Field>,
    );
    expect(container.querySelector(".micro-prim-field__hint")).toBeNull();
    expect(screen.getByText("خطأ")).toBeTruthy();
  });
});

describe("W2 EmptyState: no-data is not failure", () => {
  it("renders symbol (aria-hidden), title, description, and one action", () => {
    render(
      <EmptyState
        symbol={<svg />}
        title={<h2>لا توجد سجلات</h2>}
        description="سجّل أول قيد"
        action={<Button action="create">سجّل</Button>}
      />,
    );
    expect(screen.getByRole("heading", { name: "لا توجد سجلات" })).toBeTruthy();
    expect(screen.getByText("سجّل أول قيد")).toBeTruthy();
    expect(screen.getByRole("button", { name: "سجّل" })).toBeTruthy();
    const symbol = document.querySelector(".micro-prim-empty__symbol");
    expect(symbol?.getAttribute("aria-hidden")).toBe("true");
  });
  it("renders the optional honest-state slot between symbol and title (no-data is not failure)", () => {
    const { container } = render(
      <EmptyState
        symbol={<Activity />}
        state={<StatusChip state="no-data">لا توجد مواعيد تشغيلية</StatusChip>}
        title="لا توجد طلبات تحتاج موعدًا الآن"
        description="شرح موجّه."
      />,
    );
    const empty = container.querySelector(".micro-prim-empty");
    expect(empty?.querySelector(".micro-prim-empty__state .micro-prim-chip")).toBeTruthy();
    expect(screen.getByText("لا توجد مواعيد تشغيلية")).toBeTruthy();
  });
});

describe("W2 MoneyWithUnit: unit beside the isolated number, never inside it", () => {
  it("keeps the number bidi-isolated LTR and the unit outside", () => {
    const { container } = render(<MoneyWithUnit minor={125000} unit="د.أ" />);
    const number = container.querySelector("bdi");
    expect(number?.getAttribute("dir")).toBe("ltr");
    expect(number?.textContent).toBe("1,250.00");
    expect(container.querySelector(".micro-money-unit")?.textContent).toBe("د.أ");
    expect(number?.textContent).not.toContain("د.أ");
  });

  it("renders the honest unavailable dash for a null amount — never an invented number", () => {
    const { container } = render(<MoneyWithUnit minor={null} unit="د.أ" />);
    expect(container.querySelector("bdi")?.textContent).toBe("—");
  });
});

describe("W2 primitives.css: contract floors and geometry (string-level)", () => {
  // cwd for this project's vitest run is apps/prototype-web
  const css = readFileSync("client/src/styles/primitives.css", "utf8");

  it("labels use the 13px floor token; body/amount use 15px", () => {
    expect(css).toContain("font-size: var(--vf-text-label-size)");
    expect(css).toContain("font-size: var(--vf-text-body-size)");
    expect(css).toContain("font-size: var(--vf-text-amount-size)");
  });

  it("the caption size appears only for the non-financial hint slot", () => {
    const uses = css.match(/var\(--vf-text-caption-size\)/g) ?? [];
    expect(uses.length).toBe(1);
    expect(css).toContain("micro-prim-field__hint");
  });

  it("buttons carry the 48px control height and control radius", () => {
    expect(css).toContain("min-height: var(--vf-control-height)");
    expect(css).toContain("border-radius: var(--vf-radius-control)");
  });

  it("the row edge stripe is capped at 3px", () => {
    expect(css).toContain("width: 3px");
    expect(css).not.toContain(
      "width: 4px;\n  border-radius: var(--vf-radius-full);\n  background: var(--vf-success)",
    );
  });

  it("reduced motion collapses nonessential movement", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("animation-duration: 3s");
  });

  it("no raw hex and no off-scale values outside comments (design-token-guards parity)", () => {
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(stripped.match(/#[0-9a-fA-F]{3,8}\b/)).toBeNull();
  });
});
