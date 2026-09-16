import { describe, expect, it } from "vitest";
import { PreferenceService } from "./preferenceService";
import { updateLocalPreferences } from "./updateLocalPreferences";
import { ActualTimeService } from "@/application/time/actualTimeService";
import { ScheduleService } from "@/application/scheduling/scheduleService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import type { LocalPreferences } from "@/storage/local/types";

/* EXE-002 (AUD-NEW-02 / SET-003): انحدار شامل لسلامة سجل التفضيلات — كل كاتب
 * تفضيلات في التطبيق (المظهر، التصدير المتحقق، تذكير النسخ، بطاقة التثبيت،
 * القدرات، طريقة العمل، سعة اليوم) يمر من بوابة merge الموحدة، فلا يُسقط
 * أي كاتب حقلًا قائمًا. العيب المكتشف: saveOperatingMode وsetDailyCapacity
 * كانا يعيدان بناء السجل يدويًا بلا disabledCapabilities فتعود القدرات
 * الموقوفة للتفعيل بصمت. الاختبار يمشي على الكتّاب السبعة كلهم لا الكاتبين
 * المكتشفين فقط، ويثبت بقاء كل حقل غير مستهدف بعد كل كتابة. */

const NOW = "2026-09-16T12:00:00.000Z";
const now = () => NOW;

type WriterCase = {
  name: string;
  run: () => Promise<unknown>;
  /** يحدّث القيم المتوقعة بعد كتابته — الكاتب يملك حروقه فقط. */
  mutateExpected: () => void;
};

describe("EXE-002 — preferences field preservation across every writer", () => {
  it("no writer drops disabledCapabilities or any other existing field", async () => {
    const store = new MemoryLocalStore();
    const preferences = new PreferenceService(store, now);
    const time = new ActualTimeService(store, now);
    const schedule = new ScheduleService(store, now);

    /* حالة بذرة مميزة القيم: كل حقل بقيمة يمكن التحقق منها. */
    const seededTheme = await preferences.save("dark");
    expect(seededTheme.ok).toBe(true);
    const seededCapabilities = await preferences.saveDisabledCapabilities(["orders", "inventory"]);
    expect(seededCapabilities.ok).toBe(true);
    const seededMode = await time.saveOperatingMode({
      workMode: "material_focused",
      actualTimeTrackingEnabled: true,
    });
    expect(seededMode.ok).toBe(true);
    const seededCapacity = await schedule.setDailyCapacity(120);
    expect(seededCapacity.ok).toBe(true);
    const seededReminder = await preferences.saveBackupReminderEnabled(false);
    expect(seededReminder.ok).toBe(true);
    const seededExport = await preferences.markVerifiedExport();
    expect(seededExport.ok).toBe(true);
    const seededBanner = await preferences.saveInstallBannerDismissal();
    expect(seededBanner.ok).toBe(true);

    const baseline = await store.getPreferences();
    if (!baseline.ok || !baseline.value) throw new Error("baseline preferences should read");
    expect(baseline.value.disabledCapabilities).toEqual(["orders", "inventory"]);

    /* كل كاتب يغيّر حرفه فقط — كل الحقول الأخرى تبقى كما بُذرت. */
    const writers: WriterCase[] = [
      {
        name: "theme (preferenceService.save)",
        run: () => preferences.save("light"),
        mutateExpected: () => {
          expected.theme = "light";
        },
      },
      {
        name: "verified export (preferenceService.markVerifiedExport)",
        run: () => preferences.markVerifiedExport(),
        mutateExpected: () => {
          /* طابع التصدير يتجدد للحظة نفسها — يبقى NOW في هذا الاختبار الثابت. */
        },
      },
      {
        name: "backup reminder (preferenceService.saveBackupReminderEnabled)",
        run: () => preferences.saveBackupReminderEnabled(true),
        mutateExpected: () => {
          expected.backupReminderEnabled = true;
        },
      },
      {
        name: "install banner (preferenceService.saveInstallBannerDismissal)",
        run: () => preferences.saveInstallBannerDismissal(),
        mutateExpected: () => {
          /* طابع الإخفاء يتجدد للحظة نفسها — يبقى NOW في هذا الاختبار الثابت. */
        },
      },
      {
        name: "operating mode (actualTimeService.saveOperatingMode)",
        run: () =>
          time.saveOperatingMode({ workMode: "time_focused", actualTimeTrackingEnabled: false }),
        mutateExpected: () => {
          expected.workMode = "time_focused";
          expected.actualTimeTrackingEnabled = false;
        },
      },
      {
        name: "daily capacity (scheduleService.setDailyCapacity)",
        run: () => schedule.setDailyCapacity(240),
        mutateExpected: () => {
          expected.dailyScheduleCapacityMinutes = 240;
        },
      },
    ];

    /* القيم المتوقعة تتتبع آخر كتابة مشروعة: كل كاتب يملك حقه ويحدّث المتوقع،
     * وكل ما عداه يجب أن يبقى كما هو بعد كتابته. */
    const expected: {
      theme: LocalPreferences["theme"];
      workMode: LocalPreferences["workMode"];
      actualTimeTrackingEnabled: boolean;
      dailyScheduleCapacityMinutes: number | null;
      backupReminderEnabled: boolean;
      lastVerifiedExportAt: string | null;
      installBannerDismissedAt: string | null;
      disabledCapabilities: string[];
    } = {
      theme: "dark",
      workMode: "material_focused",
      actualTimeTrackingEnabled: true,
      dailyScheduleCapacityMinutes: 120,
      backupReminderEnabled: false,
      lastVerifiedExportAt: NOW,
      installBannerDismissedAt: NOW,
      disabledCapabilities: ["orders", "inventory"],
    };

    for (const writer of writers) {
      const result = await writer.run();
      expect(result, writer.name).toMatchObject({ ok: true });
      writer.mutateExpected();
      const record = await store.getPreferences();
      if (!record.ok || !record.value) throw new Error(`${writer.name}: preferences should read`);
      /* كل حقل يساوي قيمته المتوقعة — لا كاتب يُسقط حقلًا أو يعيده للافتراض. */
      expect(record.value.disabledCapabilities, `${writer.name} kept disabledCapabilities`).toEqual(
        expected.disabledCapabilities,
      );
      expect(record.value.theme, `${writer.name} theme`).toBe(expected.theme);
      expect(record.value.workMode, `${writer.name} workMode`).toBe(expected.workMode);
      expect(record.value.actualTimeTrackingEnabled, `${writer.name} time flag`).toBe(
        expected.actualTimeTrackingEnabled,
      );
      expect(record.value.dailyScheduleCapacityMinutes, `${writer.name} capacity`).toBe(
        expected.dailyScheduleCapacityMinutes,
      );
      expect(record.value.backupReminderEnabled, `${writer.name} reminder`).toBe(expected.backupReminderEnabled);
      expect(record.value.lastVerifiedExportAt, `${writer.name} export stamp`).toBe(
        expected.lastVerifiedExportAt,
      );
      expect(record.value.installBannerDismissedAt, `${writer.name} banner stamp`).toBe(
        expected.installBannerDismissedAt,
      );
    }

    /* كاتب القدرات نفسه يغيّر حقه فقط ولا يمسّ بقية السجل (بقيم ما بعد الكتّاب). */
    const changed = await preferences.saveDisabledCapabilities(["loans"]);
    expect(changed.ok).toBe(true);
    const record = await store.getPreferences();
    if (!record.ok || !record.value) throw new Error("capabilities writer: preferences should read");
    expect(record.value.disabledCapabilities).toEqual(["loans"]);
    expect(record.value.theme).toBe(expected.theme);
    expect(record.value.workMode).toBe(expected.workMode);
    expect(record.value.actualTimeTrackingEnabled).toBe(expected.actualTimeTrackingEnabled);
    expect(record.value.dailyScheduleCapacityMinutes).toBe(expected.dailyScheduleCapacityMinutes);
    expect(record.value.backupReminderEnabled).toBe(expected.backupReminderEnabled);
    expect(record.value.lastVerifiedExportAt).toBe(expected.lastVerifiedExportAt);
  });

  it("a fresh device (no record) gets honest defaults and the first writer establishes the record", async () => {
    const store = new MemoryLocalStore();
    const update = await updateLocalPreferences(store, { theme: "dark" }, now);
    expect(update.ok).toBe(true);
    if (!update.ok) return;
    expect(update.value.theme).toBe("dark");
    expect(update.value.disabledCapabilities).toEqual([]);
    expect(update.value.backupReminderEnabled).toBe(true);
    expect(update.value.workMode).toBeNull();
    expect(update.value.dailyScheduleCapacityMinutes).toBeNull();
    expect(update.value.actualTimeTrackingEnabled).toBe(false);
    expect(update.value.installBannerDismissedAt).toBeNull();
    expect(update.value.lastVerifiedExportAt).toBeNull();
  });

  it("re-reading through a fresh service instance returns the same persisted record (reload stability)", async () => {
    const store = new MemoryLocalStore();
    const preferences = new PreferenceService(store, now);
    await preferences.saveDisabledCapabilities(["orders"]);
    const time = new ActualTimeService(store, now);
    const savedMode = await time.saveOperatingMode({
      workMode: "mixed",
      actualTimeTrackingEnabled: true,
    });
    expect(savedMode.ok).toBe(true);
    /* «إعادة تحميل»: مثيلات خدمات جديدة فوق المخزن نفسه تقرأ ما كُتب. */
    const reloaded = new PreferenceService(store, now);
    const capabilities = await reloaded.readDisabledCapabilities();
    expect(capabilities.ok && capabilities.disabled).toEqual(["orders"]);
    const reloadedTime = new ActualTimeService(store, now);
    const mode = await reloadedTime.readOperatingMode();
    expect(mode.ok && mode.value.workMode).toBe("mixed");
    expect(mode.ok && mode.value.actualTimeTrackingEnabled).toBe(true);
  });
});
