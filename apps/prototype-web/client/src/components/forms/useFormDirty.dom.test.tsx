/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { useFormDirty } from "./useFormDirty";

/* المجموعة ٥ (إصلاح استمرارية المسودة): اختبار مباشر للخطاف — الخلل القديم
 * أعاد التقاط اللقطة كل إعادة رسم لمن لا يمرّر resetToken فصار «الوسخ»
 * false دومًا (لا مسودة ولا حارس) — وهنا نقفل السلوك الصحيح بالاختبار. */

function DirtyProbe({ values, resetToken }: { values: readonly unknown[]; resetToken?: unknown }) {
  const isDirty = useFormDirty(values, resetToken);
  return <p data-testid="dirty">{isDirty ? "dirty" : "clean"}</p>;
}

/* محاكاة محرر بسيط: حالة داخلية + إعادة رسم عبر الأحداث. */
function TokenlessEditorHarness({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [note, setNote] = useState("");
  const isDirty = useFormDirty([name, note]);
  return (
    <div>
      <input aria-label="الاسم" value={name} onChange={event => setName(event.target.value)} />
      <input aria-label="ملاحظة" value={note} onChange={event => setNote(event.target.value)} />
      <p data-testid="dirty">{isDirty ? "dirty" : "clean"}</p>
    </div>
  );
}

describe("useFormDirty (المجموعة ٥ — إصلاح استمرارية المسودة)", () => {
  afterEach(() => cleanup());

  it("tokenless: clean at mount, dirty after first input, clean again when values return to initial", () => {
    const rendered = render(<TokenlessEditorHarness initialName="" />);
    expect(rendered.getByTestId("dirty").textContent).toBe("clean");

    const nameInput = rendered.getByLabelText("الاسم");
    act(() => {
      fireEvent.change(nameInput, { target: { value: "مكينة خياطة" } });
    });
    expect(rendered.getByTestId("dirty").textContent).toBe("dirty");

    act(() => {
      fireEvent.change(nameInput, { target: { value: "" } });
    });
    expect(rendered.getByTestId("dirty").textContent).toBe("clean");
  });

  it("tokenless: a second field's input flips dirty too (multi-field arrays)", () => {
    const rendered = render(<TokenlessEditorHarness initialName="ثلاجة" />);
    expect(rendered.getByTestId("dirty").textContent).toBe("clean");
    const noteInput = rendered.getByLabelText("ملاحظة");
    act(() => {
      fireEvent.change(noteInput, { target: { value: "ضمان سنة" } });
    });
    expect(rendered.getByTestId("dirty").textContent).toBe("dirty");
  });

  it("token: snapshot follows token changes (loaded-record reset), not every render", () => {
    const first = render(<DirtyProbe values={["قيمة محمّلة", 100]} resetToken="record-a" />);
    expect(first.getByTestId("dirty").textContent).toBe("clean");
    first.rerender(<DirtyProbe values={["قيمة محمّلة", 100]} resetToken="record-a" />);
    expect(first.getByTestId("dirty").textContent).toBe("clean");
    first.rerender(<DirtyProbe values={["قيمة معدّلة", 100]} resetToken="record-a" />);
    expect(first.getByTestId("dirty").textContent).toBe("dirty");
    /* تحميل سجل آخر (رمز جديد) يعيد اللقطة إلى القيم الجديدة — نظيف مجددًا. */
    first.rerender(<DirtyProbe values={["طلب آخر", 0]} resetToken="record-b" />);
    expect(first.getByTestId("dirty").textContent).toBe("clean");
    first.unmount();
  });

  it("token transition from undefined to defined re-snapshots (async load path)", () => {
    const wrapper = render(<DirtyProbe values={["", 0]} />);
    expect(wrapper.getByTestId("dirty").textContent).toBe("clean");
    wrapper.rerender(<DirtyProbe values={["سجل وصل", 0]} />);
    expect(wrapper.getByTestId("dirty").textContent).toBe("dirty");
    wrapper.rerender(<DirtyProbe values={["سجل وصل", 0]} resetToken="record-loaded" />);
    expect(wrapper.getByTestId("dirty").textContent).toBe("clean");
    wrapper.unmount();
  });
});
