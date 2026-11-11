/**
 * EX-D18 — خطاف جلسة الشبكة للصفحات: يقرأ حالة الدخول والقدرات من الخادم
 * (كلها محسوبة خادميًا) ويوفر الدخول/الخروج. لا يخزن أي شيء محليًا.
 */
import { useCallback, useEffect, useState } from "react";
import { fetchSession, signOut, startGoogleSignIn, type NetworkSession } from "@/application/network";

export interface NetworkSessionState {
  loading: boolean;
  session: NetworkSession;
  refresh: () => Promise<void>;
  signIn: (returnTo: string) => void;
  signOutAndRefresh: () => Promise<void>;
}

export function useNetworkSession(): NetworkSessionState {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<NetworkSession>({ authenticated: false });

  const refresh = useCallback(async () => {
    try {
      setSession(await fetchSession());
    } catch {
      setSession({ authenticated: false });
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

  return { loading, session, refresh, signIn, signOutAndRefresh };
}
