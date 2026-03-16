import type { AdminSession, LoginInput } from "@donggeuri/shared";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";

import { getSession, login, logout } from "./lib/api";
import { LoadingPanel } from "./ui";

type AuthContextValue = {
  loading: boolean;
  session: AdminSession;
  refreshSession: () => Promise<void>;
  signIn: (credentials: LoginInput) => Promise<void>;
  signOut: () => Promise<void>;
};

const EMPTY_SESSION: AdminSession = {
  authenticated: false,
  user: null,
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider(props: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession>(EMPTY_SESSION);
  const [loading, setLoading] = useState(true);

  const refreshSession = async () => {
    setLoading(true);

    try {
      setSession(await getSession());
    } catch {
      setSession(EMPTY_SESSION);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshSession();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      session,
      refreshSession,
      signIn: async (credentials) => {
        setSession(await login(credentials));
      },
      signOut: async () => {
        await logout();
        setSession(EMPTY_SESSION);
      },
    }),
    [loading, session],
  );

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("Auth context is not available.");
  }

  return value;
}

export function RequireAdmin(props: { children: ReactNode }) {
  const auth = useAuth();

  if (auth.loading) {
    return <LoadingPanel message="Checking admin session." />;
  }

  if (!auth.session.authenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{props.children}</>;
}
