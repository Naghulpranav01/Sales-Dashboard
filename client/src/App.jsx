import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { api, setToken } from "./lib/api";
import LandingPage from "./pages/LandingPage.jsx";

const DashboardPage = lazy(() => import("./pages/DashboardPage.jsx"));

export default function App() {
  const [session, setSession] = useState({ user: null, loading: true });
  const [mode, setMode] = useState("landing");

  useEffect(() => {
    api("/auth/me")
      .then(({ user }) => {
        setSession({ user, loading: false });
        setMode("app");
      })
      .catch(() => setSession({ user: null, loading: false }));
  }, []);

  const actions = useMemo(
    () => ({
      onAuthenticated(payload) {
        setToken(payload.token);
        setSession({ user: payload.user, loading: false });
        setMode("app");
      },
      logout() {
        setToken(null);
        setSession({ user: null, loading: false });
        setMode("landing");
      }
    }),
    []
  );

  if (session.loading) {
    return <div className="boot-screen">Loading tapv.dashboards...</div>;
  }

  return mode === "app" && session.user ? (
    <Suspense fallback={<div className="boot-screen">Opening dashboard...</div>}>
      <DashboardPage user={session.user} onLogout={actions.logout} />
    </Suspense>
  ) : (
    <LandingPage onAuthenticated={actions.onAuthenticated} />
  );
}
