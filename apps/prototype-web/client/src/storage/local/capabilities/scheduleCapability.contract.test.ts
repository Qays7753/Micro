/**
 * R3 (بطاقة R3-SC-08): عقد قدرة «الجداول والتكرارات». ثلاث طبقات إثبات، بلا أي تعديل إنتاج:
 * عضوية المحوّلين، السلوك عبر العدسة الضيقة (الذاكرة وIndexedDB/fake-indexeddb)،
 * ومراسي الأنواع زمن التشغيل (نمط Wave 3B/4C).
 */
import "fake-indexeddb/auto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { IndexedDbLocalStore } from "../IndexedDbLocalStore";
import { MemoryLocalStore } from "../MemoryLocalStore";
import type { ScheduleEntry, ScheduleRecurrence } from "../types";
import { scheduleStoreMethods, type ScheduleStore } from "./scheduleStore";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../../../../../../");
const ANCHORS_FILE = path.join(HERE, "scheduleCapabilityAnchors.ts");
const APP_TSCONFIG = path.join(REPO_ROOT, "apps", "prototype-web", "tsconfig.json");

const databaseName = "micro-prototype-local";
function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

const TS = "2026-10-08T09:00:00.000Z";

function scheduleFixture(id: string, orderId: string, scheduledFor: string): ScheduleEntry {
  return {
    id,
    orderId,
    kind: "delivery",
    scheduledFor,
    scheduledTime: null,
    durationMinutes: null,
    status: "scheduled",
    postponeReason: null,
    events: [
      {
        id: `${id}:created`,
        type: "created",
        idempotencyKey: `${id}:created`,
        createdAt: TS,
        previousScheduledFor: null,
        scheduledFor,
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

function postponedSchedule(base: ScheduleEntry, to: string, key: string): ScheduleEntry {
  const event = {
    id: `${base.id}:postponed:${base.events.length + 1}`,
    type: "postponed" as const,
    idempotencyKey: key,
    createdAt: TS,
    previousScheduledFor: base.scheduledFor,
    scheduledFor: to,
    previousScheduledTime: base.scheduledTime,
    scheduledTime: base.scheduledTime,
    previousDurationMinutes: base.durationMinutes,
    durationMinutes: base.durationMinutes,
    reason: "تأجيل",
  };
  return {
    ...base,
    scheduledFor: to,
    status: "postponed",
    postponeReason: "تأجيل",
    updatedAt: TS,
    events: [...base.events, event],
  };
}

function recurrenceFixture(
  id: string,
  sourceScheduleId: string,
  orderId: string,
  key: string,
): ScheduleRecurrence {
  return {
    id,
    sourceScheduleId,
    orderId,
    frequency: "weekly",
    occurrenceCount: 4,
    status: "active",
    idempotencyKey: key,
    cancelledAt: null,
    cancellationReason: null,
    createdAt: TS,
    updatedAt: TS,
  };
}
/** السيناريو يستقبل النوع الضيق حصرًا — عدسة مستهلك القدرة لا أوسع. */
async function runCapabilityScenario(store: ScheduleStore) {
  /* ١) إنشاء موعد كتابةً أولى فقط (HIGH-001): إعادة الإرسال إعادة استخدام. */
  const schedule = scheduleFixture("sched-cap-1", "order-cap-1", "2026-10-10");
  const created = await store.commitScheduleCreate(schedule);
  expect(created.ok).toBe(true);
  if (!created.ok) throw new Error(created.message);
  expect(created.value.reused).toBe(false);
  const replayed = await store.commitScheduleCreate(schedule);
  expect(replayed.ok && replayed.value.reused).toBe(true);

  /* ٢) القراءة كما كُتبت: القائمة والمفردة، والمفقود null. */
  const listed = await store.listSchedules();
  expect(listed.ok && listed.value.map(s => s.id)).toEqual(["sched-cap-1"]);
  const single = await store.getSchedule("sched-cap-1");
  expect(single.ok && single.value?.status).toBe("scheduled");
  const missing = await store.getSchedule("sched-cap-none");
  expect(missing.ok && missing.value).toBeNull();

  /* ٣) التحديث بحدث واحد جديد بالضبط: الحقول «قبل» تطابق المخزّن الحي؛
   *    وإعادة الإرسال إعادة استخدام. */
  const stored = single.ok ? single.value : schedule;
  const postponed = postponedSchedule(stored, "2026-10-12", "op-sched-cap-postpone-1");
  const updated = await store.commitScheduleUpdate(postponed);
  expect(updated.ok).toBe(true);
  if (!updated.ok) throw new Error(updated.message);
  const updatedReplay = await store.commitScheduleUpdate(postponed);
  expect(updatedReplay.ok && updatedReplay.value.reused).toBe(true);
  const afterUpdate = await store.getSchedule("sched-cap-1");
  expect(afterUpdate.ok && afterUpdate.value?.scheduledFor).toBe("2026-10-12");
  expect(afterUpdate.ok && afterUpdate.value?.events).toHaveLength(2);

  /* ٤) التكرار: الحفظ والقراءة والالتزام الذرّي مع جدولاته. */
  const recurrence = recurrenceFixture("rec-cap-1", "sched-cap-1", "order-cap-1", "op-rec-cap-1");
  const savedRecurrence = await store.saveRecurrence(recurrence);
  expect(savedRecurrence.ok && savedRecurrence.value.frequency).toBe("weekly");
  const recurrenceList = await store.listRecurrences();
  expect(recurrenceList.ok && recurrenceList.value.map(r => r.id)).toEqual(["rec-cap-1"]);
  const singleRecurrence = await store.getRecurrence("rec-cap-1");
  expect(singleRecurrence.ok && singleRecurrence.value?.occurrenceCount).toBe(4);
  const missingRecurrence = await store.getRecurrence("rec-none");
  expect(missingRecurrence.ok && missingRecurrence.value).toBeNull();
  const occurrence = scheduleFixture("sched-cap-occ-1", "order-cap-1", "2026-10-17");
  const withOccurrence = { ...occurrence, recurrenceId: "rec-cap-1", recurrenceIndex: 1 };
  const committedRecurrence = await store.commitRecurrence(recurrence, [withOccurrence]);
  expect(committedRecurrence.ok).toBe(true);
  if (!committedRecurrence.ok) throw new Error(committedRecurrence.message);
  const occurrences = await store.listSchedules();
  expect(occurrences.ok && occurrences.value.map(s => s.id).sort()).toEqual([
    "sched-cap-1",
    "sched-cap-occ-1",
  ]);
}
describe("R3 — قدرة الجداول والتكرارات (بطاقة R3-SC-08): العضوية", () => {
  it("قائمة الطرق هي نطاق المجموعة بالضبط: 9 أسماء فريدة", () => {
    expect(scheduleStoreMethods).toHaveLength(9);
    expect(new Set(scheduleStoreMethods).size).toBe(9);
  });

  describe.each([
    ["MemoryLocalStore", () => new MemoryLocalStore()],
    ["IndexedDbLocalStore", () => new IndexedDbLocalStore()],
  ] as const)("%s يكشف كل طريقة قدرة كدالة", (_label, makeStore) => {
    it("العضوية كاملة", () => {
      const store = makeStore();
      for (const method of scheduleStoreMethods) {
        expect(typeof (store as unknown as ScheduleStore)[method]).toBe("function");
      }
    });
  });
});

describe("R3 — قدرة الجداول والتكرارات: العقود السلوكية عبر العدسة الضيقة", () => {
  afterEach(async () => {
    await clearDatabase();
  });

  it("الذاكرة: عقد القدرة كاملًا", async () => {
    await runCapabilityScenario(new MemoryLocalStore());
  });

  it("IndexedDB (fake-indexeddb): عقد القدرة نفسه", async () => {
    await clearDatabase();
    try {
      await runCapabilityScenario(new IndexedDbLocalStore());
    } finally {
      await clearDatabase();
    }
  });
});

describe("R3 — قدرة الجداول والتكرارات: طبقة الأنواع", () => {
  it(
    "المحوّلان والواجهة التوافقية ما زالوا يحققون القدرة (tsc على ملف المراسي)",
    { timeout: 120_000 },
    () => {
      const tmp = mkdtempSync(path.join(tmpdir(), "micro-schedule-capability-"));
      try {
        const tmpConfig = path.join(tmp, "tsconfig.capability.json");
        writeFileSync(
          tmpConfig,
          JSON.stringify({
            extends: APP_TSCONFIG,
            include: [ANCHORS_FILE],
            exclude: [],
            compilerOptions: { types: [] },
          }),
          "utf8",
        );
        const tscEntry = path.join(REPO_ROOT, "node_modules", "typescript", "bin", "tsc");
        execFileSync(process.execPath, [tscEntry, "--noEmit", "--project", tmpConfig], {
          cwd: REPO_ROOT,
          encoding: "utf-8",
          stdio: ["ignore", "pipe", "pipe"],
        });
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
      expect(true).toBe(true);
    },
  );
});
