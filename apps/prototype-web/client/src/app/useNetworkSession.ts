/**
 * EX-D18 — خطاف جلسة الشبكة للصفحات: يقرأ حالة الدخول والقدرات من الخادم
 * (كلها محسوبة خادميًا) ويوفر الدخول/الخروج. لا يخزن أي شيء محليًا.
 *
 * EX-D19 (Phase B — 2026-11-14): داخل القشرة يستهلك الخطاف مزوّد الجلسة
 * القشري (جلب واحد مشترك)؛ بلا مزوّد (الاختبارات المباشرة) يحتفظ بجلب
 * المستقل كما كان. فشل التحقق يُميَّز صادقًا عن «غير مسجل» (S12/F-15).
 */
import { useCallback, useContext, useEffect, useState } from "react";
import { fetchSession, signOut, startGoogleSignIn, type NetworkSession } from "@/application/network";
import { NetworkSessionProviderContext, type ShellNetworkSessionState } from "@/app/NetworkSessionContext";

export interface NetworkSessionState extends ShellNetworkSessionState {}

export function useNetworkSession(): NetworkSessionState {
  const shell = useContext(NetworkSessionProviderContext);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [session, setSession] = useState<NetworkSession>({ authenticated: false });

  const refresh = useCallback(async () => {
    try {
      setSession(await fetchSession());
      setFailed(false);
    } catch {
      setSession({ authenticated: false });
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (shell !== null) return; // the shell provider owns the fetch
    void refresh();
  }, [shell, refresh]);

  const signIn = useCallback((returnTo: string) => startGoogleSignIn(returnTo), []);
  const signOutAndRefresh = useCallback(async () => {
    try {
      await signOut();
    } finally {
      if (shell !== null) await shell.refresh();
      else await refresh();
    }
  }, [shell, refresh]);

  if (shell !== null) return shell;
  return { loading, failed, session, refresh, signIn, signOutAndRefresh };
}
