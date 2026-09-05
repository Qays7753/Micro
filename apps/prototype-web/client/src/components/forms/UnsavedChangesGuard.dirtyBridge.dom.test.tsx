/** @vitest-environment jsdom */

/* المجموعة ٥ (إصلاح عقد ٣٨): جسر سجل القذارة — الحارس كان يستورد setDirtyForms
 * بلا استدعائه فبقى السجل صفرًا أبدًا: إعادة التحميل التلقائية للـPWA وزر
 * «حدّث الآن» لم يريا نموذجًا قذرًا قط فيُدمَّر العمل غير المحفوظ. هذا
 * الاختبار يقفل الجسر: التسجيل يُزامن السجل، والفك يصفّره. */
import { act, render } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { hasDirtyForms, setDirtyForms } from "@/pwa/dirtyRegistry";
import { UnsavedChangesProvider, useUnsavedChangesGuard } from "./UnsavedChangesGuard";

function GuardProbe({ isDirty }: { isDirty: boolean }) {
  useUnsavedChangesGuard({ isDirty, onSave: async () => true });
  return <p data-testid="probe">{isDirty ? "dirty" : "clean"}</p>;
}

describe("dirty registry bridge (المجموعة ٥ — إصلاح عقد ٣٨)", () => {
  afterEach(() => {
    setDirtyForms(0);
  });

  it("guard registration syncs the module-level dirty registry", () => {
    const rendered = render(
      <UnsavedChangesProvider navigate={() => undefined}>
        <GuardProbe isDirty={false} />
      </UnsavedChangesProvider>,
    );
    expect(hasDirtyForms()).toBe(false);

    rendered.rerender(
      <UnsavedChangesProvider navigate={() => undefined}>
        <GuardProbe isDirty={true} />
      </UnsavedChangesProvider>,
    );
    expect(hasDirtyForms()).toBe(true);

    rendered.rerender(
      <UnsavedChangesProvider navigate={() => undefined}>
        <GuardProbe isDirty={false} />
      </UnsavedChangesProvider>,
    );
    expect(hasDirtyForms()).toBe(false);
    rendered.unmount();
  });

  it("unmounting the guarded form clears the registry", () => {
    const rendered = render(
      <UnsavedChangesProvider navigate={() => undefined}>
        <GuardProbe isDirty={true} />
      </UnsavedChangesProvider>,
    );
    expect(hasDirtyForms()).toBe(true);
    act(() => {
      rendered.unmount();
    });
    expect(hasDirtyForms()).toBe(false);
  });
});
