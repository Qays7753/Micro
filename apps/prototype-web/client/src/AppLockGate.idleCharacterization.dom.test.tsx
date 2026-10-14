/** @vitest-environment jsdom */
/**
 * R11 W1b-4 / D-12 (OD-TIME — lock-idle characterization only):
 * مصفوفة توصيف بوابة القفل على مستوى المكوّن — الإخفاء/الظهور، نبض الثلاثين
 * ثانية، الفتح بالرمز، مسار الاسترداد المعفى، وفشل قراءة التخزين.
 *
 * ⚠️ توصيف لا إصلاح: تسجيل السلوك القائم كما هو؛ النتائج المصنفة
 * FAIL_OPEN تُسجَّل findings جديدة بقرار مالك (لا ترقيع داخل W1b).
 *
 * المنضبط: ساعة زمنية واحدة وهمية (vi.useFakeTimers على Date وsetInterval)
 * تحرك معًا ساعة الخدمة المحقونة ونبض المكوّن وقياس خمول الإدخال؛ الخدمة
 * حقيقية (LocalLockService + MemoryLocalStore + PBKDF2 الفعلي)؛ لا كتابة إنتاج.
 */
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { LocalLockService } from "@/application/security/localLockService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { AppLockGate } from "@/components/security/AppLockGate";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));
const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW_MS = Date.parse("2026-09-05T09:00:00.000Z");
let mockLocation = "/finance";

vi.mock("wouter", () => ({
  useLocation: () => [mockLocation, vi.fn()],
}));

function setVisibility(value: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { value, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

function lockOverlayPresent() {
  return screen.queryByRole("dialog", { name: "قفل Micro" }) !== null;
}

describe("lock-idle characterization — AppLockGate component level (R11 W1b-4; توصيف لا إصلاح)", () => {
  let store: MemoryLocalStore;
  let service: LocalLockService;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(NOW_MS);
    mockLocation = "/finance";
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    store = new MemoryLocalStore();
    /* الساعة المحقونة تقرأ التاريخ الوهمي نفسه: ضبط واحد يحكم الخدمة والنبض. */
    service = new LocalLockService(store, () => new Date().toISOString());
    const enabled = await service.enable("4179", 1);
    if (!enabled.ok) throw new Error(enabled.message);
    vi.setSystemTime(NOW_MS); /* التفعيل حدّث آخر نشاط الآن؛ نبدأ من اللحظة نفسها. */
    mockedUsePrototypeServices.mockReturnValue({ localLock: service } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("FORWARD عبر الإخفاء/الظهور (تصنيف): FAIL_CLOSED — إخفاء ثم زمن حقيقي فوق العتبة ثم ظهور يقفل", async () => {
    render(
      <AppLockGate>
        <div>المحتوى</div>
      </AppLockGate>,
    );
    await act(async () => {});
    expect(lockOverlayPresent()).toBe(false);
    act(() => {
      setVisibility("hidden"); /* الإخفاء يعلّم النشاط (نمط عقد ٣٧). */
    });
    await act(async () => {});
    act(() => {
      vi.setSystemTime(NOW_MS + 10 * 60_000); /* «تعليق» ١٠ دقائق والعتبة دقيقة. */
      setVisibility("visible");
    });
    await act(async () => {});
    expect(lockOverlayPresent()).toBe(true);
  });

  it("SUSPEND/RESUME قصير: إخفاء ثم ظهور دون بلوغ العتبة يبقى مفتوحًا", async () => {
    render(
      <AppLockGate>
        <div>المحتوى</div>
      </AppLockGate>,
    );
    await act(async () => {});
    act(() => {
      setVisibility("hidden");
    });
    await act(async () => {});
    act(() => {
      vi.setSystemTime(NOW_MS + 20_000); /* ٢٠ ثانية فقط — دون دقيقة. */
      setVisibility("visible");
    });
    await act(async () => {});
    expect(lockOverlayPresent()).toBe(false);
  });

  it("HEARTBEAT: إدخال حديث عند نبض الثلاثين ثانية يبقي الجلسة حية عبر العتبة الزمنية للساعة الوهمية", async () => {
    const touchSpy = vi.spyOn(service, "touchActivity");
    render(
      <AppLockGate>
        <div>المحتوى</div>
      </AppLockGate>,
    );
    await act(async () => {});
    /* الاستخدام المتواصل: كل ٢٥ ثانية لمس ثم نبض — العتبة دقيقة لكن النبض يجدد النشاط. */
    for (let round = 0; round < 4; round += 1) {
      await act(async () => {
        vi.setSystemTime(NOW_MS + round * 25_000);
        fireEvent.pointerDown(document);
        vi.advanceTimersByTime(30_000); /* النبض التالي يرى إدخالًا حديثًا (≤٣٠ ثانية). */
      });
    }
    expect(touchSpy.mock.calls.length).toBeGreaterThan(0);
    expect(lockOverlayPresent()).toBe(false); /* لم يقفل رغم مرور ١٠٠+ ثانية وهمية. */
  });

  it("HEARTBEAT KEEP-ALIVE (تصنيف): AS_DESIGNED — التطبيق الظاهر بلا إدخال لا يقفل أبدًا؛ النبض يقيّم ثم يلمس فيجدد الخمول كل ٣٠ ثانية", async () => {
    render(
      <AppLockGate>
        <div>المحتوى</div>
      </AppLockGate>,
    );
    await act(async () => {});
    /* زمن حقيقي متدرج: كل جولة ٣١ ثانية عبر advanceTimersByTime وحدها
     * (تقدّم المؤقت والتاريخ الوهمي معًا بلا مضاعفة)؛ النبض يرى خمول إدخال
     * > ٣٠ ثانية فيقيّم، ودون العتبة (دقيقة) يلمس النشاط فيصفّر ساعة الخمول
     * — الحلقة تجدد نفسها إلى أجل غير مسمى والغطاء لا يظهر. هذا هو التصميم
     * الموثق («نبض ٣٠ ثانية أثناء الظهور يمنع قفلًا أثناء الاستخدام المتواصل»). */
    for (let round = 0; round < 8; round += 1) {
      await act(async () => {
        vi.advanceTimersByTime(31_000);
      });
    }
    expect(lockOverlayPresent()).toBe(false); /* ٤+ دقائق «وهمية متدرجة» بلا إدخال: مفتوح */
  });

  it("HEARTBEAT TIME JUMP (تصنيف): FAIL_CLOSED — قفزة زمنية كبيرة فوق العتبة بين نبضين تقفل عند النبض التالي (مسار اللحاق الطارئ)", async () => {
    render(
      <AppLockGate>
        <div>المحتوى</div>
      </AppLockGate>,
    );
    await act(async () => {});
    await act(async () => {
      vi.setSystemTime(NOW_MS + 5 * 60_000); /* قفزة واحدة (نوم الجهاز/تصحيح ساعة). */
      vi.advanceTimersByTime(30_000); /* النبض الأول بعد القفزة: الخمول > ٣٠ ث → تقييم → قفل. */
    });
    expect(lockOverlayPresent()).toBe(true);
  });

  it("UNLOCK: الرمز الصحيح يفتح الغطاء والمحتوى يظل محمّلًا تحته (لا فقدان حالة)", async () => {
    render(
      <AppLockGate>
        <div>المحتوى</div>
      </AppLockGate>,
    );
    await act(async () => {});
    act(() => {
      setVisibility("hidden");
    });
    await act(async () => {});
    act(() => {
      vi.setSystemTime(NOW_MS + 10 * 60_000);
      setVisibility("visible");
    });
    await act(async () => {});
    expect(lockOverlayPresent()).toBe(true);
    const pinInput = screen.getByLabelText("رمز القفل");
    fireEvent.change(pinInput, { target: { value: "4179" } });
    await act(async () => {
      fireEvent.submit(pinInput.closest("form")!);
      /* PBKDF2 الفعلي (١٢٠ ألف دورة) عمل حقيقي غير مؤقّت — نمنحه زمنًا
       * حقيقيًا داخل act ثم تُصفّى تحديثات الحالة (setTimeout غير مُوهم هنا). */
      await new Promise(resolve => setTimeout(resolve, 400));
    });
    expect(lockOverlayPresent()).toBe(false);
  });

  it("UNLOCK: الرمز الخاطئ يُبقي الغطاء ويعرض العدّاد الصادق", async () => {
    render(
      <AppLockGate>
        <div>المحتوى</div>
      </AppLockGate>,
    );
    await act(async () => {});
    act(() => {
      vi.setSystemTime(NOW_MS + 10 * 60_000);
      vi.advanceTimersByTime(30_000);
    });
    await act(async () => {});
    expect(lockOverlayPresent()).toBe(true);
    const pinInput = screen.getByLabelText("رمز القفل");
    fireEvent.change(pinInput, { target: { value: "0000" } });
    await act(async () => {
      fireEvent.submit(pinInput.closest("form")!);
      await new Promise(resolve => setTimeout(resolve, 400));
    });
    expect(lockOverlayPresent()).toBe(true);
    /* محاولة واحدة: الوقفة صفر فتظهر الصيغة المجرّدة بلا عدّاد (سلوك قائم). */
    expect(screen.getByRole("alert").textContent).toContain("الرمز غير صحيح");
  });

  it("RECOVERY ROUTE (تصنيف): AS_DESIGNED — مسار الاسترداد العام معفى من الغطاء حتى فوق العتبة", async () => {
    mockLocation = "/settings";
    render(
      <AppLockGate>
        <div>المحتوى</div>
      </AppLockGate>,
    );
    await act(async () => {});
    act(() => {
      vi.setSystemTime(NOW_MS + 30 * 60_000);
      setVisibility("visible");
    });
    await act(async () => {});
    /* العقد: الطوارئ لا تُقفل — لكن مسارات البيانات الحساسة تظل محكومة
     * ببوابة الرمز داخل الإعدادات نفسها (يغطيها Settings.lockGate.dom). */
    expect(lockOverlayPresent()).toBe(false);
  });

  it("STORAGE READ FAILURE (تصنيف): FAIL_OPEN — فشل قراءة سجل القفل يفتح البوابة بلا غطاء", async () => {
    const failing = new LocalLockService(
      {
        getLocalSecurity: async () => ({ ok: false, message: "boom" }),
        saveLocalSecurity: async () => ({ ok: false, message: "boom" }),
        deleteLocalSecurity: async () => ({ ok: false, message: "boom" }),
      } as never,
      () => new Date().toISOString(),
    );
    mockedUsePrototypeServices.mockReturnValue({ localLock: failing } as never);
    render(
      <AppLockGate>
        <div>المحتوى</div>
      </AppLockGate>,
    );
    await act(async () => {});
    act(() => {
      vi.setSystemTime(NOW_MS + 10 * 60_000);
      setVisibility("visible");
    });
    await act(async () => {});
    /* السلوك القائم: status غير ناجح → فتح مباشر. توصيف صادق: finding
     * مسجل (R11-W1B4-NF-003) — قرار مالك، لا ترقيع داخل W1b. */
    expect(lockOverlayPresent()).toBe(false);
  });
});
