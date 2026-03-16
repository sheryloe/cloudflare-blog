import type { LoginInput } from "@donggeuri/shared";
import { LayoutDashboard, Library, LogOut, PanelsTopLeft, Tags, Upload } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Link, Navigate, Outlet, useNavigate } from "react-router-dom";

import { Input } from "./components/ui/input";
import { useAuth } from "./auth";
import { Button, ErrorMessage, ShellCard } from "./ui";

const PUBLIC_APP_URL = import.meta.env.VITE_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:5173";

export function AdminLayout() {
  const auth = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="app-shell">
      <header className="mb-6 rounded-[36px] border border-black/5 bg-[linear-gradient(135deg,#142033_0%,#223654_65%,#2e486f_100%)] px-6 py-6 text-[var(--color-paper)] shadow-[0_24px_90px_rgba(20,32,51,0.25)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <p className="section-kicker !text-[rgba(255,240,220,0.75)]">Authenticated admin</p>
            <div className="space-y-2">
              <h1 className="text-4xl font-semibold tracking-tight">Content Operations</h1>
              <p className="max-w-2xl text-sm leading-7 text-[rgba(255,240,220,0.78)]">
                Manage articles, media, and taxonomy from the same editorial workspace.
              </p>
            </div>
            <p className="text-sm font-medium text-[rgba(255,240,220,0.92)]">
              {auth.session.user?.email ?? "Signed in"}
            </p>
          </div>
          <div className="flex flex-col gap-4 xl:items-end">
            <nav className="flex flex-wrap gap-2">
              <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/15">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
              <Link to="/posts" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/15">
                <PanelsTopLeft className="h-4 w-4" />
                Posts
              </Link>
              <Link to="/media" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/15">
                <Upload className="h-4 w-4" />
                Media
              </Link>
              <Link to="/categories" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/15">
                <Library className="h-4 w-4" />
                Categories
              </Link>
              <Link to="/tags" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/15">
                <Tags className="h-4 w-4" />
                Tags
              </Link>
              <a href={PUBLIC_APP_URL} className="inline-flex items-center gap-2 rounded-full bg-[rgba(247,241,231,0.16)] px-4 py-2 text-sm font-medium hover:bg-[rgba(247,241,231,0.22)]">
                Public site
              </a>
            </nav>
            <Button variant="soft" onClick={() => void handleLogout()} className="bg-white/15 text-white hover:bg-white/22">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="grid gap-6">
        <Outlet />
      </main>
    </div>
  );
}

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<LoginInput>({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!auth.loading && auth.session.authenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await auth.signIn(form);
      navigate("/dashboard", { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Login failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-shell flex min-h-screen items-center justify-center">
      <div className="w-full max-w-xl">
        <ShellCard
          title="Admin login"
          description="Sign in to access the protected editorial workspace built on Pages and Workers."
        >
          <form className="grid gap-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="field-label">Email</span>
              <Input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                required
              />
            </label>
            <label className="block">
              <span className="field-label">Password</span>
              <Input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                required
              />
            </label>
            <ErrorMessage message={error} />
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={submitting} className="min-w-32">
                {submitting ? "Signing in..." : "Login"}
              </Button>
              <a className="text-sm font-medium text-[var(--color-accent)] hover:text-[var(--color-ink)]" href={PUBLIC_APP_URL}>
                Back to public site
              </a>
            </div>
          </form>
        </ShellCard>
      </div>
    </div>
  );
}
