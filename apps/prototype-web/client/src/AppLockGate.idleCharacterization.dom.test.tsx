/** @vitest-environment jsdom */
/**
 * R11 W1b-4 (التوصيف الأصلي) ← R11 Lock Remediation (الإصلاح الفاشل-المغلق —
 * OD-LOCK-STORAGE=A وOD-LOCK-SEMANTICS=A): مصفوفة بوابة القفل على مستوى
 * المكوّن — الإخفاء/الظهور، نبض الثلاثين ثانية بالإدخال الفعلي، حالة
 * checking الخاملة، فشل قراءة التخزين (unreadable)، الفتح بالرمز، مسار
 * الاسترداد المعفى، وإعادة التحميل.
 *
 * تحديث موجة الإصلاح (2026-10-15): النتائج القديمة المصنفة FAIL_OPEN
 * (R11-W1B4-NF-003) وAS_DESIGNED القديمة للنبض (NF-004) صارت FAIL_CLOSED
 * بموجب قرارات المالك. التوصيف التاريخي الكامل محفوظ حرفيًا في دليل W1b-4؛
 * هذا الملف الآن يثبت العقد المنفذ لا السلوك المتقادم.
 *
 * المنضبط: ساعة زمنية واحدة وهمية (vi.useFakeTimers على Date وsetInterval)
 * تحرك معًا ساعة الخدمة المحقونة ونبض المكوّن وقياس خمول الإدخال؛ الخدمة
 * حقيقية (LocalLockService + MemoryLocalStore + PBKDF2 الفعلي).
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

function unreadableOverlayPresent() {
  return screen.queryByRole("dialog", { name: "تعذر التحقق من قفل Micro" }) !== null;
}

describe("lock-idle — AppLockGate component level (R11 W1b-4 characterization → R11 Lock Remediation fail-closed)", () => {
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

  it("HEARTBEAT WITHOUT INPUT (تصنيف): FAIL_CLOSED — التطبيق الظاهر بلا إدخال فعلي يقفل بعد العتبة (OD-LOCK-SEMANTICS=A / R11-W1B4-NF-004)", async () => {
    render(
      <AppLockGate>
        <div>المحتوى</div>
      </AppLockGate>,
    );
    await act(async () => {});
    /* زمن حقيقي متدرج بلا أي إدخال (٨ جولات × ٣١ ث): النبض يقيّم فقط ولا
     * يجدد النشاط — العتبة دقيقة فالغطاء يجب أن يظهر. السلوك القديم
     * («الظاهر للأبد بلا إدخال»: كل تقييم يلمس النشاط فيجدد الخمول) صار
     * مخالفًا للعقد المنفذ ومرفوضًا هنا. */
    for (let round = 0; round < 8; round += 1) {
      await act(async () => {
        vi.advanceTimersByTime(31_000);
      });
    }
    expect(lockOverlayPresent()).toBe(true);
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

  it("STORAGE READ FAILURE (تصنيف): FAIL_CLOSED — فشل قراءة سجل القفل يبقي المحتوى محجوبًا خاملًا بلا أي كتابة (OD-LOCK-STORAGE=A / R11-W1B4-NF-003)", async () => {
    const saveSpy = vi.fn(async () => ({ ok: true as const, value: null as never }));
    const failing = new LocalLockService(
      {
        getLocalSecurity: async () => ({ ok: false, message: "boom" }),
        saveLocalSecurity: saveSpy as never,
        deleteLocalSecurity: async () => ({ ok: true as const, value: null as never }),
      } as never,
      () => new Date().toISOString(),
    );
    mockedUsePrototypeServices.mockReturnValue({ localLock: failing } as never);
    render(
      <AppLockGate>
        <button type="button">زر محمي</button>
      </AppLockGate>,
    );
    await act(async () => {});
    act(() => {
      vi.setSystemTime(NOW_MS + 10 * 60_000);
      setVisibility("visible");
    });
    await act(async () => {});
    /* الإصلاح الفاشل-المغلق: لا فتح — غطاء خطأ صادق قادر على إعادة المحاولة،
     * الأبناء خاملون غير قابلين للتفاعل أو التركيز، ولا أي كتابة بيانات.
     * المحرِّر الذي يعيد فتح البوابة عند !status.ok يفشل هنا بالضبط. */
    expect(unreadableOverlayPresent()).toBe(true);
    expect(lockOverlayPresent()).toBe(false);
    expect(screen.getByText("زر محمي").parentElement?.hasAttribute("inert")).toBe(true);
    expect(saveSpy.mock.calls.length).toBe(0);
    expect(screen.getByRole("button", { name: "أعد المحاولة" })).toBeTruthy();
  });

  it("CHECKING PHASE: الحالة الابتدائية تخمل المحتوى المحمي (inert) حتى تكتمل القراءة الأولى (عقد §7.2)", async () => {
    let releaseStatus: ((value: { ok: true; value: null }) => void) | null = null;
    const deferred = new LocalLockService(
      {
        getLocalSecurity: () =>
          new Promise(resolve => {
            releaseStatus = resolve;
          }),
        saveLocalSecurity: async () => ({ ok: true as const, value: null as never }),
        deleteLocalSecurity: async () => ({ ok: true as const, value: null as never }),
      } as never,
      () => new Date().toISOString(),
    );
    mockedUsePrototypeServices.mockReturnValue({ localLock: deferred } as never);
    const { container } = render(
      <AppLockGate>
        <button type="button">زر محمي</button>
      </AppLockGate>,
    );
    /* أثناء checking: الأبناء خاملون غير قابلين للتفاعل أو التركيز. */
    const checkingWrapper = screen.getByText("زر محمي").parentElement;
    expect(checkingWrapper?.hasAttribute("inert")).toBe(true);
    await act(async () => {
      releaseStatus?.({ ok: true, value: null });
      await Promise.resolve();
    });
    await act(async () => {});
    expect(lockOverlayPresent()).toBe(false);
    expect(unreadableOverlayPresent()).toBe(false);
    expect(screen.getByText("زر محمي").parentElement?.hasAttribute("inert")).toBe(false);
  });

  it("NO-LOCK READ: قراءة ناجحة بلا قفل مضبوط تفتح طبيعيًا بلا غطاء (OD-LOCK-STORAGE=A)", async () => {
    const unlocked = new LocalLockService(new MemoryLocalStore(), () => new Date().toISOString());
    mockedUsePrototypeServices.mockReturnValue({ localLock: unlocked } as never);
    render(
      <AppLockGate>
        <div>المحتوى</div>
      </AppLockGate>,
    );
    await act(async () => {});
    expect(lockOverlayPresent()).toBe(false);
    expect(unreadableOverlayPresent()).toBe(false);
    expect(screen.getByText("المحتوى").parentElement?.hasAttribute("inert")).toBe(false);
  });

  it("RELOAD/SESSION: تركيب جديد (نمط إعادة التحميل) بعد خمول فوق العتبة يقفل عند أول تقييم", async () => {
    vi.setSystemTime(NOW_MS + 10 * 60_000); /* العتبة دقيقة وقد مضى ١٠ دقائق بلا جلسة */
    render(
      <AppLockGate>
        <div>المحتوى</div>
      </AppLockGate>,
    );
    await act(async () => {});
    expect(lockOverlayPresent()).toBe(true);
  });

  it("OVERLAY KEEPS FORM STATE: نموذج مفتوح تحت الغطاء يحفظ قيمته عبر القفل والفتح (غطاء لا إعادة تركيب)", async () => {
    render(
      <AppLockGate>
        <input defaultValue="" aria-label="حقل مسودة" onChange={() => {}} />
      </AppLockGate>,
    );
    await act(async () => {});
    const field = screen.getByLabelText("حقل مسودة") as HTMLInputElement;
    fireEvent.change(field, { target: { value: "قيمة غير محفوظة" } });
    expect(field.value).toBe("قيمة غير محفوظة");
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
    /* الحقل ما زال موجودًا تحت الغطاء بقيمته — لا إعادة تركيب ولا فقدان. */
    expect((screen.getByLabelText("حقل مسودة") as HTMLInputElement).value).toBe("قيمة غير محفوظة");
    const pinInput = screen.getByLabelText("رمز القفل");
    fireEvent.change(pinInput, { target: { value: "4179" } });
    await act(async () => {
      fireEvent.submit(pinInput.closest("form")!);
      await new Promise(resolve => setTimeout(resolve, 400));
    });
    expect(lockOverlayPresent()).toBe(false);
    expect((screen.getByLabelText("حقل مسودة") as HTMLInputElement).value).toBe("قيمة غير محفوظة");
  });

  it("UNREADABLE RETRY: إعادة المحاولة بعد شفاء القراءة تفتح بلا غطاء وبلا أي كتابة بيانات", async () => {
    const saveSpy = vi.fn(async () => ({ ok: true as const, value: null as never }));
    let failReads = true;
    const flaky = new LocalLockService(
      {
        getLocalSecurity: async () =>
          failReads ? { ok: false, message: "boom" } : { ok: true as const, value: null },
        saveLocalSecurity: saveSpy as never,
        deleteLocalSecurity: async () => ({ ok: true as const, value: null as never }),
      } as never,
      () => new Date().toISOString(),
    );
    mockedUsePrototypeServices.mockReturnValue({ localLock: flaky } as never);
    render(
      <AppLockGate>
        <button type="button">زر محمي</button>
      </AppLockGate>,
    );
    await act(async () => {});
    expect(unreadableOverlayPresent()).toBe(true);
    expect(screen.getByText("زر محمي").parentElement?.hasAttribute("inert")).toBe(true);
    expect(saveSpy.mock.calls.length).toBe(0);
    failReads = false;
    fireEvent.click(screen.getByRole("button", { name: "أعد المحاولة" }));
    await act(async () => {});
    expect(unreadableOverlayPresent()).toBe(false);
    expect(lockOverlayPresent()).toBe(false);
    expect(screen.getByText("زر محمي").parentElement?.hasAttribute("inert")).toBe(false);
    expect(saveSpy.mock.calls.length).toBe(0);
  });
});
