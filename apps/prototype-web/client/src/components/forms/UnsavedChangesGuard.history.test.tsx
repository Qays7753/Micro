/** @vitest-environment jsdom */

import React, { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { UnsavedChangesProvider, useUnsavedChangesGuard } from "./UnsavedChangesGuard";

// jsdom has no pointer capture; vaul's drawer calls it on every press.
beforeAll(() => {
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
});

function HistoryForm({ label }: { label: string }) {
  const [text, setText] = useState("");
  useUnsavedChangesGuard({
    isDirty: text.trim().length > 0,
    onSave: async () => true,
  });
  return (
    <label>
      {label}
      <input aria-label={label} value={text} onChange={event => setText(event.target.value)} />
    </label>
  );
}

function back() {
  window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
}

describe("unsaved changes guard against browser back (U-01)", () => {
  afterEach(() => {
    cleanup();
  });
  it("arms a sentinel history entry when the form turns dirty", async () => {
    const user = userEvent.setup();
    render(
      <UnsavedChangesProvider navigate={vi.fn()}>
        <HistoryForm label="ملاحظة التكلفة" />
      </UnsavedChangesProvider>,
    );
    expect(history.state?.microGuard).toBeUndefined();
    await user.type(screen.getByLabelText("ملاحظة التكلفة"), "خشب زان");
    expect(history.state?.microGuard).toBe(true);
  });

  it("opens the three-choice drawer on popstate and keeps the dirty form mounted with its value", async () => {
    const user = userEvent.setup();
    render(
      <UnsavedChangesProvider navigate={vi.fn()}>
        <HistoryForm label="ملاحظة التكلفة" />
      </UnsavedChangesProvider>,
    );
    const field = screen.getByLabelText("ملاحظة التكلفة");
    await user.type(field, "2 متر بـ 3.50");
    expect(history.state?.microGuard).toBe(true);

    back();

    expect(await screen.findByTestId("unsaved-changes-drawer")).toBeTruthy();
    /* §3.11: الحوار الجديد — البقاء أولًا */
    expect(screen.getByText("تعديلات غير محفوظة")).toBeTruthy();
    const survived = screen.getByLabelText("ملاحظة التكلفة");
    expect(survived).toBe(field);
    expect((survived as HTMLInputElement).value).toBe("2 متر بـ 3.50");
    expect(history.state?.microGuard).toBe(true);
  });

  it("cancel keeps the user on the form after a back attempt", async () => {
    const user = userEvent.setup();
    render(
      <UnsavedChangesProvider navigate={vi.fn()}>
        <HistoryForm label="ملاحظة التكلفة" />
      </UnsavedChangesProvider>,
    );
    await user.type(screen.getByLabelText("ملاحظة التكلفة"), "وقت 90 دقيقة");
    back();
    // A plain click reaches the button's onClick without vaul's drag handlers, which jsdom cannot run.
    fireEvent.click(await screen.findByRole("button", { name: "ابقَ في الصفحة" }));
    expect((screen.getByLabelText("ملاحظة التكلفة") as HTMLInputElement).value).toBe("وقت 90 دقيقة");
  });

  it("asks before the tab closes while a form is dirty", async () => {
    const user = userEvent.setup();
    render(
      <UnsavedChangesProvider navigate={vi.fn()}>
        <HistoryForm label="ملاحظة التكلفة" />
      </UnsavedChangesProvider>,
    );
    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    await user.type(screen.getByLabelText("ملاحظة التكلفة"), "مبلغ غير محفوظ");
    const dirty = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });

  it("states the honest close caveat instead of promising protection it does not provide", async () => {
    const user = userEvent.setup();
    render(
      <UnsavedChangesProvider navigate={vi.fn()}>
        <HistoryForm label="ملاحظة التكلفة" />
      </UnsavedChangesProvider>,
    );
    await user.type(screen.getByLabelText("ملاحظة التكلفة"), "نص");
    back();
    expect(await screen.findByText(/إذا أغلقت الصفحة أو التطبيق قبل الحفظ يفقد ما لم تحفظه/)).toBeTruthy();
    expect(screen.queryByText(/لن يُفقد عملك ما لم تختر الخروج/)).toBeNull();
  });
});
