import { describe, expect, it } from "vitest";
import {
  createActualTimeRecord,
  reverseActualTimeRecord,
  summarizeActualTime,
} from "../../src/domain/actual-time/index.js";

describe("actual time domain", () => {
  it("creates a positive local time record and derives an explicit planned-versus-recorded comparison", () => {
    const record = createActualTimeRecord({
      id: "time-1",
      orderId: "order-1",
      minutesDelta: 75,
      recordedOn: "2026-08-23",
      createdAt: "2026-08-23T09:00:00.000Z",
      note: "تنفيذ وتغليف",
      operationKey: "time-1",
    });
    expect(summarizeActualTime("order-1", 60, [record], "known")).toEqual({
      status: "recorded",
      plannedMinutes: 60,
      actualMinutes: 75,
      varianceMinutes: 15,
      recordCount: 1,
      reversedRecordCount: 0,
    });
  });

  it("reverses a time record once with an explicit reason and restores the absence-of-record state", () => {
    const record = createActualTimeRecord({
      id: "time-1",
      orderId: "order-1",
      minutesDelta: 45,
      recordedOn: "2026-08-23",
      createdAt: "2026-08-23T09:00:00.000Z",
      note: null,
      operationKey: "time-1",
    });
    const reversal = reverseActualTimeRecord({
      id: "time-reverse",
      target: record,
      recordedOn: "2026-08-23",
      createdAt: "2026-08-23T10:00:00.000Z",
      reason: "دقائق مكررة",
      operationKey: "time-reverse",
    });
    expect(reversal).toMatchObject({
      minutesDelta: -45,
      reversalOfId: record.id,
      reversalReason: "دقائق مكررة",
    });
    expect(summarizeActualTime("order-1", 60, [record, reversal], "known")).toEqual({
      status: "not_recorded",
      plannedMinutes: 60,
      actualMinutes: null,
      varianceMinutes: null,
      recordCount: 0,
      reversedRecordCount: 1,
    });
    expect(() =>
      reverseActualTimeRecord(
        {
          id: "time-reverse-2",
          target: record,
          recordedOn: "2026-08-23",
          createdAt: "2026-08-23T11:00:00.000Z",
          reason: "محاولة ثانية",
          operationKey: "time-reverse-2",
        },
        [reversal],
      ),
    ).toThrow("تم التراجع عن سجل الوقت هذا سابقًا");
  });

  it("keeps missing planned time unknown instead of treating it as zero", () => {
    const record = createActualTimeRecord({
      id: "time-missing-plan",
      orderId: "order-1",
      minutesDelta: 75,
      recordedOn: "2026-08-23",
      createdAt: "2026-08-23T09:00:00.000Z",
      note: null,
      operationKey: "time-missing-plan",
    });
    expect(summarizeActualTime("order-1", null, [record], "needs_review")).toEqual({
      status: "needs_review",
      plannedMinutes: null,
      actualMinutes: 75,
      varianceMinutes: null,
      recordCount: 1,
      reversedRecordCount: 0,
    });
    expect(summarizeActualTime("order-1", null, [], "needs_review")).toEqual({
      status: "not_recorded",
      plannedMinutes: null,
      actualMinutes: null,
      varianceMinutes: null,
      recordCount: 0,
      reversedRecordCount: 0,
    });
  });

  it("rejects zero or fractional minutes and a reversal without its reason", () => {
    expect(() =>
      createActualTimeRecord({
        id: "bad",
        orderId: "order-1",
        minutesDelta: 0,
        recordedOn: "2026-08-23",
        createdAt: "2026-08-23T09:00:00.000Z",
        note: null,
        operationKey: "bad",
      }),
    ).toThrow("دقائق موجبة صحيحة");
    const record = createActualTimeRecord({
      id: "time-1",
      orderId: "order-1",
      minutesDelta: 15,
      recordedOn: "2026-08-23",
      createdAt: "2026-08-23T09:00:00.000Z",
      note: null,
      operationKey: "time-1",
    });
    expect(() =>
      reverseActualTimeRecord({
        id: "bad-reverse",
        target: record,
        recordedOn: "2026-08-23",
        createdAt: "2026-08-23T10:00:00.000Z",
        reason: "",
        operationKey: "bad-reverse",
      }),
    ).toThrow("سببًا واضحًا");
  });
});
