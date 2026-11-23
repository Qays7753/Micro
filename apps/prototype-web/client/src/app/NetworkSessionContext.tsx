/**
 * EX-D19 (Phase B — 2026-11-14): مزوّد جلسة على مستوى القشرة. جلب واحد
 * لحساب Micro المشترك تستهلكه القشرة (تسميات السياق/مدخل بوابة السائق/
 * Ask Micro) بدل جلب مستقل في كل صفحة؛ الخطاف القائم useNetworkSession
 * يستهلك هذا المزوّد عند توفره ويحتفظ بسلوكه المستقل بدونه (الاختبارات).
 *
 * فشل الجلب يُميَّز صادقًا (failed=true) عن «غير مسجل» — انقطاع الشبكة لا
 * يتحول إلى «تحتاج تسجيل الدخول» (S12/F-15). لا يُخزن أي شيء محليًا.
 */
import { createContext, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { fetchSession, signOut, startGoogleSignIn, type NetworkSession } from "@/application/network";

export interface ShellNetworkSessionState {
  loading: boolean;
  /** true فقط عند تعذر التحقق من الجلسة (انقطاع/خادم معطل) — ليس «غير مسجل». */
  failed: boolean;
  session: NetworkSession;
  refresh: () => Promise<void>;
  signIn: (returnTo: string) => void;
  signOutAndRefresh: () => Promise<void>;
}

const NetworkSessionContext = createContext<ShellNetworkSessionState | null>(null);

export const NetworkSessionProviderContext = NetworkSessionContext;

export function NetworkSessionProvider({ children }: { children: ReactNode }) {
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
    void refresh();
  }, [refresh]);

  const signIn = useCallback((returnTo: string) => startGoogleSignIn(returnTo), []);

  const signOutAndRefresh = useCallback(async () => {
    try {
      await signOut();
    } finally {
      await refresh();
    }
  }, [refresh]);

  const value = useMemo<ShellNetworkSessionState>(
    () => ({ loading, failed, session, refresh, signIn, signOutAndRefresh }),
    [loading, failed, session, refresh, signIn, signOutAndRefresh],
  );

  return <NetworkSessionContext.Provider value={value}>{children}</NetworkSessionContext.Provider>;
}
