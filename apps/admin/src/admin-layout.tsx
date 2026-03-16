import type { LoginInput } from "@donggeuri/shared";
import { LayoutDashboard, Library, LogOut, PanelsTopLeft, Tags, Upload } from "lucide-react";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";

import { Input } from "./components/ui/input";
import { useAuth } from "./auth";
import { cn } from "./lib/utils";
import { Button, ErrorMessage, ShellCard } from "./ui";

const PUBLIC_APP_URL = import.meta.env.VITE_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:5173";

const adminLinks = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, description: "Workspace overview" },
  { to: "/posts", label: "Posts", icon: PanelsTopLeft, description: "Write and publish" },
  { to: "/media", label: "Media", icon: Upload, description: "R2 upload library" },
  { to: "/categories", label: "Categories", icon: Library, description: "Archive structure" },
  { to: "/tags", label: "Tags", icon: Tags, description: "Discovery labels" },
];

function useWorkspaceHeading() {
  const location = useLocation();

  return useMemo(() => {
    const current = adminLinks.find((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));

    if (!current) {
      return {
        title: "Content Operations",
        description: "A publishing workspace tuned for editing, review, and media management.",
      };
    }

    return {
      title: current.label,
      description: current.description,
    };
  }, [location.pathname]);
}

export function AdminLayout() {
  const auth = useAuth();
  const navigate = useNavigate();
  const heading = useWorkspaceHeading();

  const handleLogout = async () => {
    await auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="app-shell">
      <div className="grid gap-6 xl:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <div className="admin-panel overflow-hidden p-5">
            <div className="space-y-4">
              <div className="inline-flex w-fit items-center rounded-full border border-black/8 bg-white/70 px-3 py-1.5 shadow-sm">
                <p className="section-kicker !tracking-[0.28em]">Donggeuri Admin</p>
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-ink)]">Publishing ops</h1>
                <p className="text-sm leading-7 text-[var(--color-soft-ink)]">
                  Separate Pages workspace for editing, taxonomy, and media handling.
                </p>
              </div>
            </div>
          </div>

          <div className="admin-panel overflow-hidden p-3">
            <div className="space-y-2">
              {adminLinks.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        "admin-rail-link",
                        isActive &&
                          "border-black/8 bg-[linear-gradient(135deg,rgba(22,35,56,0.96),rgba(41,67,104,0.92))] text-white shadow-[0_16px_48px_rgba(22,35,56,0.28)]",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon className="h-4 w-4" />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span>{item.label}</span>
                          <span className={isActive ? "text-white/70" : "text-xs text-[var(--color-soft-ink)]"}>
                            {item.description}
                          </span>
                        </span>
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>

          <div className="admin-panel overflow-hidden p-5">
            <div className="space-y-4">
              <p className="section-kicker">Session</p>
              <div>
                <p className="text-sm text-[var(--color-soft-ink)]">Signed in as</p>
                <p className="mt-1 text-base font-semibold text-[var(--color-ink)]">{auth.session.user?.email ?? "Signed in"}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="soft" className="rounded-full">
                  <a href={PUBLIC_APP_URL}>Public site</a>
                </Button>
                <Button variant="outline" onClick={() => void handleLogout()} className="rounded-full">
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </aside>

        <div className="space-y-6">
          <header className="admin-panel overflow-hidden px-5 py-6 sm:px-7 sm:py-7">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
              <div className="space-y-4">
                <div className="inline-flex w-fit items-center rounded-full border border-black/8 bg-white/70 px-3 py-1.5 shadow-sm">
                  <p className="section-kicker !tracking-[0.28em]">Authenticated workspace</p>
                </div>
                <div className="space-y-2">
                  <h2 className="text-4xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-5xl">
                    {heading.title}
                  </h2>
                  <p className="max-w-3xl text-sm leading-7 text-[var(--color-soft-ink)] sm:text-base">
                    {heading.description}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                <div className="rounded-[24px] border border-black/6 bg-[linear-gradient(135deg,rgba(22,35,56,0.96),rgba(41,67,104,0.92))] p-4 text-white shadow-[0_20px_70px_rgba(22,35,56,0.24)]">
                  <p className="section-kicker !text-[rgba(255,234,214,0.82)]">Routing</p>
                  <p className="mt-2 text-lg font-semibold tracking-tight">Admin-only</p>
                </div>
                <div className="rounded-[24px] border border-black/6 bg-white/72 p-4 shadow-sm">
                  <p className="section-kicker">Storage</p>
                  <p className="mt-2 text-lg font-semibold tracking-tight">D1 + R2</p>
                </div>
                <div className="rounded-[24px] border border-black/6 bg-white/72 p-4 shadow-sm">
                  <p className="section-kicker">Session</p>
                  <p className="mt-2 text-lg font-semibold tracking-tight">Cookie-based</p>
                </div>
              </div>
            </div>
          </header>

          <main className="grid gap-6">
            <Outlet />
          </main>
        </div>
      </div>
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
    <div className="app-shell flex min-h-screen items-center">
      <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <section className="admin-panel hidden overflow-hidden p-8 lg:flex lg:flex-col lg:justify-between">
          <div className="space-y-5">
            <div className="inline-flex w-fit items-center rounded-full border border-black/8 bg-white/70 px-3 py-1.5 shadow-sm">
              <p className="section-kicker !tracking-[0.28em]">Donggeuri Admin</p>
            </div>
            <div className="space-y-3">
              <h1 className="text-5xl font-semibold tracking-tight text-[var(--color-ink)]">A focused publishing cockpit.</h1>
              <p className="max-w-xl text-base leading-8 text-[var(--color-soft-ink)]">
                Review drafts, push media to R2, and shape the archive from a separate admin surface built for operational clarity.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-[24px] border border-black/6 bg-white/72 p-4 shadow-sm">
              <p className="section-kicker">Split</p>
              <p className="mt-2 text-lg font-semibold tracking-tight">Separate Pages app</p>
            </div>
            <div className="rounded-[24px] border border-black/6 bg-white/72 p-4 shadow-sm">
              <p className="section-kicker">Auth</p>
              <p className="mt-2 text-lg font-semibold tracking-tight">Cookie session</p>
            </div>
            <div className="rounded-[24px] border border-black/6 bg-white/72 p-4 shadow-sm">
              <p className="section-kicker">API</p>
              <p className="mt-2 text-lg font-semibold tracking-tight">Worker-backed</p>
            </div>
          </div>
        </section>

        <div className="w-full">
          <ShellCard
            title="Admin login"
            description="Sign in to access the editorial workspace and its protected content operations."
            className="min-h-full"
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
                <Button type="submit" disabled={submitting} className="min-w-36 rounded-full">
                  {submitting ? "Signing in..." : "Login"}
                </Button>
                <Button asChild variant="soft" className="rounded-full">
                  <a href={PUBLIC_APP_URL}>Back to public site</a>
                </Button>
              </div>
            </form>
          </ShellCard>
        </div>
      </div>
    </div>
  );
}
