/** @vitest-environment jsdom */
/*
 * R9-GA-F3.7 (WS-216/ARCH-007 — استمرار R9 الجذري): اختبار مباشر لآلة حالة
 * القراءة في محرر الموعد — كانت مرحلة الخطأ مدمجة مع «غير متاح محليًا»
 * ورسالة الخطأ الفعلية مهملة. الحدود المختبرة عبر الخدمة الحقيقية فوق
 * مخزن الذاكرة: عدم الوجود (not_found) يُعرض بسطحه القائم، وفشل القراءة
 * يُعرض برسالته الفعلية بصفة alert مع إعادة محاولة، والتحميل ينتهي
 * دائمًا.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { ScheduleService } from "@/application/scheduling/scheduleService";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import type { ScheduleEntry } from "@/storage/local/types";
import ScheduleEditor from "@/pages/ScheduleEditor";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
  getPrototypeLocalStore: () => currentStore,
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/",
  params: {} as Record<string, string>,
  search: "",
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => wouterMocks.search,
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-10-11T09:00:00.000Z";

let store: MemoryLocalStore;
let currentStore: MemoryLocalStore;
const bumpVersion = vi.fn();

/* فشل قراءة واحد ثم نجاح عند إعادة المحاولة — برسالة الخدمة الفعلية
 * نفسها («تعذر قراءة جدول المواعيد محلي.»)، والعلم داخل الاختبار وحده. */
class FailingScheduleReadStore extends MemoryLocalStore {
  failReads = true;
  override async listSchedules() {
    if (this.failReads)
      return { ok: false as const, code: "storage_error" as const, message: "تعذر قراءة الجدول." };
    return super.listSchedules();
  }
}

function services() {
  return {
    schedules: new ScheduleService(store, () => NOW),
    notifyDataChanged: bumpVersion,
    dataVersion: 0,
  };
}

function Harness() {
  return (
    <UnsavedChangesProvider navigate={wouterMocks.navigate}>
      <ScheduleEditor />
    </UnsavedChangesProvider>
  );
}

const seededSchedule: ScheduleEntry = {
  id: "f37-schedule",
  orderId: "order-1",
  kind: "delivery",
  scheduledFor: "2026-10-12",
  scheduledTime: "14:30",
  durationMinutes: 90,
  status: "scheduled",
  postponeReason: null,
  events: [
    {
      id: "f37-event",
      type: "created",
      idempotencyKey: "f37-created",
      createdAt: NOW,
      previousScheduledFor: null,
      scheduledFor: "2026-10-12",
      previousScheduledTime: null,
      scheduledTime: "14:30",
      previousDurationMinutes: null,
      durationMinutes: 90,
      reason: null,
    },
  ],
  recurrenceId: null,
  recurrenceIndex: null,
  createdAt: NOW,
  updatedAt: NOW,
};

beforeEach(() => {
  store = new MemoryLocalStore();
  currentStore = store;
  wouterMocks.search = "";
  wouterMocks.params = {};
  wouterMocks.navigate.mockReset();
  bumpVersion.mockReset();
  mockedUsePrototypeServices.mockReturnValue(
    services() as unknown as ReturnType<typeof usePrototypeServices>,
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ScheduleEditor — explicit read state machine (R9-GA-F3.7)", () => {
  it("an unknown schedule id renders the existing not-found surface and ends loading", async () => {
    wouterMocks.params = { id: "missing-schedule" };
    render(<Harness />);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "الموعد غير متاح محليًا" })).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
    expect(bumpVersion).not.toHaveBeenCalled();
  });

  it("a read failure renders its actual message with role=alert plus retry — not the not-found surface", async () => {
    const failStore = new FailingScheduleReadStore();
    store = failStore;
    currentStore = failStore;
    mockedUsePrototypeServices.mockReturnValue(
      services() as unknown as ReturnType<typeof usePrototypeServices>,
    );
    wouterMocks.params = { id: "any-schedule" };
    render(<Harness />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("تعذر قراءة جدول المواعيد المحلي.");
    expect(screen.queryByRole("heading", { name: "الموعد غير متاح محليًا" })).toBeNull();
    /* إعادة المحاولة بعد زوال الفشل تعود إلى سطح صادق (العدم للمجهول). */
    failStore.failReads = false;
    fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    expect(await screen.findByRole("heading", { name: "الموعد غير متاح محليًا" })).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  it("a stored schedule renders the ready editor with its heading and no announcement roles", async () => {
    const saved = await store.saveSchedule(seededSchedule);
    if (!saved.ok) throw new Error(saved.message);
    wouterMocks.params = { id: seededSchedule.id };
    render(<Harness />);
    expect(await screen.findByRole("heading", { name: "وقت ومدة الموعد" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByDisplayValue("2026-10-12")).toBeTruthy();
  });
});
