/** رقعة إغلاق المجموعة ٢ (مراجعة مستقلة): اختبارات عدائية لعلاقة حدث الموعد
 * الكاملة. الحارس لا يكتفي بمطابقة حقول «قبل» مع المخزّن — يجب أن تطابق
 * حقول الموعد العليا الحقول «الجديدة» التي يصرّح بها الحدث الأخير نفسه،
 * وأن تحترم كل نوع حدث ما يسمح به منشئوه الفعليون في الخدمات. سجل مزوّر
 * قصته متسقة مع المخزّن وحقوله تخالف حدثه يُرفض — مهما كان مفتاحه صالحًا.
 * هذه دوال نقية: عدم الكتابة يُثبت على مستوى المحوّلات في ملف المطابقة. */
import { describe, expect, it } from "vitest";
import { validateScheduleUpdate } from "./supplierScheduleCommitGuard";
import type { ScheduleEntry, ScheduleEvent } from "./types";

const TS = "2026-09-08T09:00:00.000Z";

function storedSchedule(): ScheduleEntry {
  return {
    id: "schedule-1",
    orderId: "order-1",
    kind: "delivery",
    scheduledFor: "2026-09-10",
    scheduledTime: null,
    durationMinutes: null,
    status: "scheduled",
    postponeReason: null,
    events: [
      {
        id: "order-1:schedule-created",
        type: "created",
        idempotencyKey: "order-1:schedule-created",
        createdAt: TS,
        previousScheduledFor: null,
        scheduledFor: "2026-09-10",
        previousScheduledTime: null,
        scheduledTime: null,
        previousDurationMinutes: null,
        durationMinutes: null,
        reason: null,
      },
    ],
    recurrenceId: null,
    recurrenceIndex: null,
    createdAt: TS,
    updatedAt: TS,
  };
}

/* منشئات الأحداث تحاكي الخدمات الفعلية حرفيًا (updateTiming/reconciled/
 * recurrenceService.cancel) — لا حقول مختلقة خارج العقد. */
function postponedEntry(base: ScheduleEntry, to: string, key: string, reason: string): ScheduleEntry {
  const event: ScheduleEvent = {
    id: `${base.id}:postponed:${base.events.length + 1}`,
    type: "postponed",
    idempotencyKey: key,
    createdAt: TS,
    previousScheduledFor: base.scheduledFor,
    scheduledFor: to,
    previousScheduledTime: base.scheduledTime,
    scheduledTime: base.scheduledTime,
    previousDurationMinutes: base.durationMinutes,
    durationMinutes: base.durationMinutes,
    reason,
  };
  return {
    ...base,
    scheduledFor: to,
    status: "postponed",
    postponeReason: reason,
    updatedAt: TS,
    events: [...base.events, event],
  };
}

function timingChangedEntry(
  base: ScheduleEntry,
  time: string | null,
  duration: number | null,
  key: string,
): ScheduleEntry {
  const event: ScheduleEvent = {
    id: `${base.id}:timing_changed:${base.events.length + 1}`,
    type: "timing_changed",
    idempotencyKey: key,
    createdAt: TS,
    previousScheduledFor: base.scheduledFor,
    scheduledFor: base.scheduledFor,
    previousScheduledTime: base.scheduledTime,
    scheduledTime: time,
    previousDurationMinutes: base.durationMinutes,
    durationMinutes: duration,
    reason: null,
  };
  return {
    ...base,
    scheduledTime: time,
    durationMinutes: duration,
    updatedAt: TS,
    events: [...base.events, event],
  };
}

function completedEntry(base: ScheduleEntry, key: string): ScheduleEntry {
  const event: ScheduleEvent = {
    id: `${base.id}:completed:${base.events.length + 1}`,
    type: "completed",
    idempotencyKey: key,
    createdAt: TS,
    previousScheduledFor: base.scheduledFor,
    scheduledFor: base.scheduledFor,
    previousScheduledTime: base.scheduledTime,
    scheduledTime: base.scheduledTime,
    previousDurationMinutes: base.durationMinutes,
    durationMinutes: base.durationMinutes,
    reason: "اكتمل عند تسجيل التسليم",
  };
  return { ...base, status: "completed", updatedAt: TS, events: [...base.events, event] };
}

function cancelledEntry(base: ScheduleEntry, key: string, reason: string): ScheduleEntry {
  const event: ScheduleEvent = {
    id: `${base.id}:cancelled:${base.events.length + 1}`,
    type: "cancelled",
    idempotencyKey: key,
    createdAt: TS,
    previousScheduledFor: base.scheduledFor,
    scheduledFor: base.scheduledFor,
    previousScheduledTime: base.scheduledTime,
    scheduledTime: base.scheduledTime,
    previousDurationMinutes: base.durationMinutes,
    durationMinutes: base.durationMinutes,
    reason: `إلغاء قالب التكرار: ${reason}`,
  };
  return {
    ...base,
    status: "cancelled",
    postponeReason: reason,
    updatedAt: TS,
    events: [...base.events, event],
  };
}

describe("schedule commit relation guard — closure patch (forward + previous relation)", () => {
  it("accepts a valid postponed entry built by the real service constructor", () => {
    const result = validateScheduleUpdate(
      storedSchedule(),
      postponedEntry(storedSchedule(), "2026-09-15", "post-1", "تأجيل"),
    );
    expect(result).toEqual({ ok: true, reused: false });
  });

  it("accepts a valid timing_changed entry built by the real service constructor", () => {
    const base = { ...storedSchedule(), scheduledTime: "10:00", durationMinutes: 60 } as ScheduleEntry;
    const result = validateScheduleUpdate(base, timingChangedEntry(base, "13:00", 90, "time-1"));
    expect(result).toEqual({ ok: true, reused: false });
  });

  it("accepts a valid auto-completion entry built by the real service constructor", () => {
    const result = validateScheduleUpdate(storedSchedule(), completedEntry(storedSchedule(), "comp-1"));
    expect(result).toEqual({ ok: true, reused: false });
  });

  it("accepts a valid recurrence cancellation entry built by the real service constructor", () => {
    const result = validateScheduleUpdate(
      storedSchedule(),
      cancelledEntry(storedSchedule(), "cancel-1", "توقف"),
    );
    expect(result).toEqual({ ok: true, reused: false });
  });

  it("replays a same-key event as reuse even when the incoming content differs", () => {
    /* المفتاح نفسه في المخزّن = إعادة تشغيل العملية نفسها: يُعاد المخزّن كما
     * هو ولا تُقبل قصة مختلفة بنفس المفتاح ككتابة جديدة. */
    const stored = postponedEntry(storedSchedule(), "2026-09-15", "post-1", "تأجيل");
    const replay = postponedEntry(storedSchedule(), "2026-09-16", "post-1", "تأجيل");
    const result = validateScheduleUpdate(stored, replay);
    expect(result).toEqual({ ok: true, reused: true });
  });

  it("rejects a missing stored schedule", () => {
    const result = validateScheduleUpdate(
      undefined,
      postponedEntry(storedSchedule(), "2026-09-15", "post-1", "تأجيل"),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects an entry with no events", () => {
    const result = validateScheduleUpdate(storedSchedule(), { ...storedSchedule(), events: [] });
    expect(result.ok).toBe(false);
  });

  it("rejects a previousScheduledFor that disagrees with the stored schedule", () => {
    const base = storedSchedule();
    const entry = postponedEntry(base, "2026-09-15", "post-1", "تأجيل");
    const forged = {
      ...entry,
      events: [...base.events, { ...entry.events[1]!, previousScheduledFor: "2026-09-09" }],
    };
    expect(validateScheduleUpdate(base, forged).ok).toBe(false);
  });

  it("rejects a previousScheduledTime that disagrees with the stored schedule", () => {
    const base = { ...storedSchedule(), scheduledTime: "10:00", durationMinutes: 60 } as ScheduleEntry;
    const entry = timingChangedEntry(base, "13:00", 90, "time-1");
    const forged = {
      ...entry,
      events: [...base.events, { ...entry.events[1]!, previousScheduledTime: "09:00" }],
    };
    expect(validateScheduleUpdate(base, forged).ok).toBe(false);
  });

  it("rejects a previousDurationMinutes that disagrees with the stored schedule", () => {
    const base = { ...storedSchedule(), scheduledTime: "10:00", durationMinutes: 60 } as ScheduleEntry;
    const entry = timingChangedEntry(base, "13:00", 90, "time-1");
    const forged = {
      ...entry,
      events: [...base.events, { ...entry.events[1]!, previousDurationMinutes: 45 }],
    };
    expect(validateScheduleUpdate(base, forged).ok).toBe(false);
  });
});

describe("schedule guard rejects forged forward fields (رقعة الإغلاق)", () => {
  it("rejects a postponed entry whose top-level date contradicts its event's new date", () => {
    const base = storedSchedule();
    const entry = postponedEntry(base, "2026-09-15", "post-1", "تأجيل");
    const forged = { ...entry, scheduledFor: "2026-09-13" };
    expect(validateScheduleUpdate(base, forged).ok).toBe(false);
  });

  it("rejects a postponed entry whose top-level time contradicts its event's new time", () => {
    const base = { ...storedSchedule(), scheduledTime: "10:00", durationMinutes: 60 } as ScheduleEntry;
    const entry = postponedEntry(base, "2026-09-15", "post-1", "تأجيل");
    const forged = { ...entry, scheduledTime: "12:00", durationMinutes: 75 };
    expect(validateScheduleUpdate(base, forged).ok).toBe(false);
  });

  it("rejects a postponed entry whose postponeReason contradicts the event reason", () => {
    const base = storedSchedule();
    const entry = postponedEntry(base, "2026-09-15", "post-1", "تأجيل");
    const forged = { ...entry, postponeReason: "سبب آخر مختلف" };
    expect(validateScheduleUpdate(base, forged).ok).toBe(false);
  });

  it("rejects a postponed event that leaves the schedule not postponed", () => {
    const base = storedSchedule();
    const entry = postponedEntry(base, "2026-09-15", "post-1", "تأجيل");
    const forged = { ...entry, status: "scheduled" as const };
    expect(validateScheduleUpdate(base, forged).ok).toBe(false);
  });

  it("rejects a postponed event that does not move the date", () => {
    const base = storedSchedule();
    const forged = postponedEntry(base, base.scheduledFor, "post-1", "تأجيل");
    expect(validateScheduleUpdate(base, forged).ok).toBe(false);
  });

  it("rejects a timing_changed entry whose top-level time contradicts its event's new time", () => {
    const base = { ...storedSchedule(), scheduledTime: "10:00", durationMinutes: 60 } as ScheduleEntry;
    const entry = timingChangedEntry(base, "13:00", 90, "time-1");
    const forged = { ...entry, scheduledTime: "14:00" };
    expect(validateScheduleUpdate(base, forged).ok).toBe(false);
  });

  it("rejects a timing_changed entry whose top-level duration contradicts its event's new duration", () => {
    const base = { ...storedSchedule(), scheduledTime: "10:00", durationMinutes: 60 } as ScheduleEntry;
    const entry = timingChangedEntry(base, "13:00", 90, "time-1");
    const forged = { ...entry, durationMinutes: 120 };
    expect(validateScheduleUpdate(base, forged).ok).toBe(false);
  });

  it("rejects a timing_changed entry that moves the date", () => {
    const base = { ...storedSchedule(), scheduledTime: "10:00", durationMinutes: 60 } as ScheduleEntry;
    const entry = timingChangedEntry(base, "13:00", 90, "time-1");
    const forged = { ...entry, scheduledFor: "2026-09-12" };
    expect(validateScheduleUpdate(base, forged).ok).toBe(false);
  });

  it("rejects a completed entry that moves the timing", () => {
    const base = { ...storedSchedule(), scheduledTime: "10:00", durationMinutes: 60 } as ScheduleEntry;
    const entry = completedEntry(base, "comp-1");
    const forged = { ...entry, scheduledTime: "12:00" };
    expect(validateScheduleUpdate(base, forged).ok).toBe(false);
  });

  it("rejects a completed entry whose status is not completed", () => {
    const base = storedSchedule();
    const entry = completedEntry(base, "comp-1");
    const forged = { ...entry, status: "scheduled" as const };
    expect(validateScheduleUpdate(base, forged).ok).toBe(false);
  });

  it("rejects a cancelled entry that moves the date", () => {
    const base = storedSchedule();
    const entry = cancelledEntry(base, "cancel-1", "توقف");
    const forged = { ...entry, scheduledFor: "2026-09-12" };
    expect(validateScheduleUpdate(base, forged).ok).toBe(false);
  });

  it("rejects a cancelled entry that moves the time or duration", () => {
    const base = { ...storedSchedule(), scheduledTime: "10:00", durationMinutes: 60 } as ScheduleEntry;
    const entry = cancelledEntry(base, "cancel-1", "توقف");
    const movedTime = { ...entry, scheduledTime: "12:00" };
    expect(validateScheduleUpdate(base, movedTime).ok).toBe(false);
    const movedDuration = { ...entry, durationMinutes: 120 };
    expect(validateScheduleUpdate(base, movedDuration).ok).toBe(false);
  });

  it("rejects a cancelled entry whose status is not cancelled", () => {
    const base = storedSchedule();
    const entry = cancelledEntry(base, "cancel-1", "توقف");
    const forged = { ...entry, status: "postponed" as const };
    expect(validateScheduleUpdate(base, forged).ok).toBe(false);
  });

  it("rejects an appended created event on an existing schedule", () => {
    const base = storedSchedule();
    const event: ScheduleEvent = {
      id: `${base.id}:created:2`,
      type: "created",
      idempotencyKey: "created-2",
      createdAt: TS,
      previousScheduledFor: null,
      scheduledFor: base.scheduledFor,
      previousScheduledTime: null,
      scheduledTime: base.scheduledTime,
      previousDurationMinutes: null,
      durationMinutes: base.durationMinutes,
      reason: null,
    };
    const forged = { ...base, events: [...base.events, event] };
    expect(validateScheduleUpdate(base, forged).ok).toBe(false);
  });

  it("rejects an appended unknown event type", () => {
    const base = storedSchedule();
    const entry = postponedEntry(base, "2026-09-15", "post-1", "تأجيل");
    const forged = {
      ...entry,
      events: [
        ...base.events,
        { ...entry.events[1]!, type: "rescheduled" as unknown as ScheduleEvent["type"] },
      ],
    };
    expect(validateScheduleUpdate(base, forged).ok).toBe(false);
  });
});
