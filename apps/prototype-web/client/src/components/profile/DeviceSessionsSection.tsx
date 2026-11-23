/**
 * Post-Group 6 W1 (قرار المالك النهائي أ-7 2026-11-21 / EX-D24 — G06):
 * قسم «جلسات الأجهزة» داخل ملف الحساب — الدخول من أكثر من جهاز مسموح،
 * والصفحة تعرض كل جلسة نشطة (تاريخها وعلامة «هذا الجهاز») مع زر
 * «تسجيل الخروج من كل الأجهزة» الذي يبطل الجلسات كلها على الخادم.
 * بيانات وصفية فقط من الخادم — لا رمز ولا تفاصيل جهاز حساسة.
 */
import { MonitorSmartphone } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ApiError, fetchDeviceSessions, signOutAllDevices, type DeviceSession } from "@/application/network";
import { Button } from "@/components/primitives";
import { formatLocalDate, localDateInAmman } from "@/presentation/formatters";

type SessionsState =
  | { phase: "loading" }
  | { phase: "failed" }
  | { phase: "ready"; sessions: DeviceSession[] }
  | { phase: "signed-out" };

function sessionDate(timestamp: number): string {
  const display = formatLocalDate(localDateInAmman(new Date(timestamp).toISOString()));
  return display ?? "—";
}

export function DeviceSessionsSection({ onSignedOut }: { onSignedOut: () => void }) {
  const [state, setState] = useState<SessionsState>({ phase: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ phase: "loading" });
    setError(null);
    try {
      setState({ phase: "ready", sessions: await fetchDeviceSessions() });
    } catch {
      setState({ phase: "failed" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function revokeAll(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await signOutAllDevices();
      setBusy(false);
      setState({ phase: "signed-out" });
      onSignedOut();
    } catch (cause) {
      setBusy(false);
      setError(
        cause instanceof ApiError ? cause.message : "تعذر تسجيل الخروج من الأجهزة الآن — أعد المحاولة.",
      );
    }
  }

  return (
    <section
      className="micro-device-sessions"
      aria-labelledby="device-sessions-title"
      data-testid="device-sessions"
    >
      <div className="micro-section-title">
        <MonitorSmartphone aria-hidden="true" />
        <div>
          <h2 id="device-sessions-title">جلسات الأجهزة</h2>
        </div>
      </div>
      {state.phase === "loading" ? (
        <p role="status">جارٍ قراءة جلساتك…</p>
      ) : state.phase === "failed" ? (
        <>
          <p role="alert">تعذر قراءة جلساتك الآن.</p>
          <Button action="quiet" onClick={() => void load()}>
            إعادة المحاولة
          </Button>
        </>
      ) : state.phase === "signed-out" ? (
        <p role="status">تم تسجيل الخروج من كل الأجهزة — هذه الصفحة لم تعد ضمن جلسة نشطة.</p>
      ) : (
        <>
          <ul className="micro-session-list">
            {state.sessions.map(session => (
              <li key={session.id} className={session.current ? "micro-session-current" : undefined}>
                <bdi dir="ltr">{sessionDate(session.createdAt)}</bdi>
                {session.current ? <span> — هذا الجهاز</span> : null}
              </li>
            ))}
          </ul>
          {state.sessions.length > 0 ? (
            <div className="micro-form-actions">
              <Button action="secondary" disabled={busy} onClick={() => void revokeAll()}>
                {busy ? "جارٍ تسجيل الخروج…" : "تسجيل الخروج من كل الأجهزة"}
              </Button>
            </div>
          ) : null}
          {error ? (
            <p className="micro-field-error" role="alert">
              {error}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
