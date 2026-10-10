/** @vitest-environment jsdom */
/* R7 / R6-F17-P06 (2026-10-10): رحلات صفحة الجدول فوق سطح الاستعلام
 * المستخرج — القراءة الثلاثية الحقيقية (نظرة اليوم/لوحة الشهر/التكرارات)
 * عبر الخدمتين الكنسيتين فوق مخزن الذاكرة: الجاهزية بعد التحميل (لا نص
 * تحميل باقٍ)، بنية أسبوع العمل الأحد→السبت في لوحة الشهر، والفشل الصادق
 * برسالة إعادة المحاولة عند تعذر القراءة — لا فراغًا صامتًا. */
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { ScheduleService } from "@/application/scheduling/scheduleService";
import { ScheduleRecurrenceService } from "@/application/scheduling/recurrenceService";
import Schedule from "@/pages/Schedule";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/",
  search: "",
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useSearch: () => wouterMocks.search,
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-20T09:00:00.000Z"; // الأحد 2026-09-20 بتوقيت عمّان
let store: MemoryLocalStore;

function Harness({ fail }: { fail?: boolean }) {
  const [version, setVersion] = React.useState(0);
  /* خدمات ثابتة الهوية خارج العرض — إعادة بنائها في كل عرض تُسقط
   * اعتماديات التأثير وتُبقي الصفحة في تحميل دائم. */
  const servicesRef = React.useRef<Record<string, unknown> | null>(null);
  if (servicesRef.current === null) {
    servicesRef.current = {
      schedules: fail
        ? ({
            overview: async () => ({ ok: false, message: "تعذر قراءة جدول المواعيد المحلي." }),
            monthOverview: async () => ({ ok: false, message: "تعذر قراءة جدول المواعيد المحلي." }),
          } as unknown as ScheduleService)
        : new ScheduleService(store, () => NOW),
      recurrences: new ScheduleRecurrenceService(store),
    };
  }
  const context = {
    ...servicesRef.current,
    dataVersion: version,
    notifyDataChanged: () => setVersion(current => current + 1),
  };
  mockedUsePrototypeServices.mockImplementation(
    () => context as unknown as ReturnType<typeof usePrototypeServices>,
  );
  return (
    <UnsavedChangesProvider navigate={wouterMocks.navigate}>
      <Schedule />
    </UnsavedChangesProvider>
  );
}

describe("R7/P06 — رحلات صفحة الجدول فوق سطح الاستعلام المستخرج", () => {
  beforeEach(() => {
    store = new MemoryLocalStore();
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("القراءة الفارغة الحقيقية: الصفحة جاهزة بلا وميض وبأسبوع عمل الأحد→السبت", async () => {
    render(<Harness />);
    await waitFor(() => {
      expect(screen.getByText("المواعيد")).toBeTruthy();
    });
    /* لوحة الشهر تعرض أيام أسبوع العمل الكاملة (بنية weekBounds الكنسية). */
    for (const day of ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]) {
      expect(screen.getAllByText(day).length).toBeGreaterThan(0);
    }
    /* لا يبقى نص التحميل بعد الجاهزية. */
    await waitFor(() => {
      expect(screen.queryByText(/جارٍ/)).not.toBeTruthy();
    });
  });

  it("تعذر القراءة يعرض الفشل الصادق برسالة إعادة المحاولة — لا فراغًا صامتًا", async () => {
    render(<Harness fail />);
    await waitFor(() => {
      expect(screen.getByText(/تعذر قراءة جدول المواعيد المحلي/)).toBeTruthy();
    });
    expect(screen.getByText("تعذر تحميل المواعيد")).toBeTruthy();
  });
});
