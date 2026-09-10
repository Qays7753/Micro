/** @vitest-environment jsdom */

/* التحصين الكامل (المجموعة ٣): فشل الحفظ داخل حوار التغييرات غير المحفوظة
 * لا يعود صامتًا — الحوار يبقى مفتوحًا مع إعلان role=alert يوجه المستخدم
 * إلى رسالة الخطأ في الصفحة. المسودة لا تُحذف والقرار يبقى بيد المستخدم. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  UnsavedChangesProvider,
  useUnsavedChangesGuard,
  useUnsavedChangesNavigation,
} from "@/components/forms/UnsavedChangesGuard";

const navigate = vi.fn();

function DirtyPage({ onSave }: { onSave: () => Promise<boolean> }) {
  useUnsavedChangesGuard({ isDirty: true, onSave });
  const requestNavigation = useUnsavedChangesNavigation();
  return (
    <main>
      <h1>صفحة فيها عمل غير محفوظ</h1>
      <button type="button" onClick={() => requestNavigation("/target")}>
        اذهب
      </button>
      <p className="micro-field-error" role="alert">
        تعذر الحفظ محليًا — لم يتغير أي سجل.
      </p>
    </main>
  );
}

describe("UnsavedChangesGuard — in-dialog save failure is announced, never silent", () => {
  beforeEach(() => {
    navigate.mockReset();
    window.history.replaceState(null, "");
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("a failing save keeps the dialog open and shows the in-dialog alert", async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    render(
      <UnsavedChangesProvider navigate={navigate}>
        <DirtyPage onSave={onSave} />
      </UnsavedChangesProvider>,
    );
    /* حارس مسجل وقذر: طلب التنقل يفتح الحوار ثلاثي الخيارات. */
    fireEvent.click(screen.getByRole("button", { name: "اذهب" }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "احفظ واستمر" }));

    await waitFor(() => {
      const failureNote = screen.getByTestId("guard-save-failure");
      expect(failureNote.getAttribute("role")).toBe("alert");
      expect(failureNote.textContent).toContain("تعذر الحفظ");
    });
    /* الحوار لم يُغلق والتنقل لم يحدث — العمل غير المحفوظ محمي. */
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("a successful save still navigates after closing the dialog — no regression", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(
      <UnsavedChangesProvider navigate={navigate}>
        <DirtyPage onSave={onSave} />
      </UnsavedChangesProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "اذهب" }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "احفظ واستمر" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByTestId("guard-save-failure")).toBeNull();
  });
});
