import type { LoginInput } from "@donggeuri/shared";
import type { FormEvent } from "react";
import { useState } from "react";
import { Link, Navigate, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "./auth";
import { Button, ErrorMessage, ShellCard } from "./ui";

export function AdminLayout() {
  const auth = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="page-shell page-shell--admin">
      <header className="masthead masthead--admin">
        <div>
          <p className="eyebrow">Authenticated admin</p>
          <h1>Content Operations</h1>
          <p className="shell-copy shell-copy--inverse">
            {auth.session.user?.email ?? "Signed in"}
          </p>
        </div>
        <div className="nav-block">
          <nav className="nav-row">
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/posts">Posts</Link>
            <Link to="/media">Media</Link>
            <Link to="/categories">Categories</Link>
            <Link to="/tags">Tags</Link>
            <Link to="/">Public site</Link>
          </nav>
          <Button tone="ghost" onClick={() => void handleLogout()}>
            Logout
          </Button>
        </div>
      </header>

      <main className="admin-grid">
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
    <div className="page-shell page-shell--auth">
      <div className="auth-panel">
        <ShellCard title="Admin login" description="Sign in to access the protected content workspace.">
          <form className="form-grid" onSubmit={handleSubmit}>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                required
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                required
              />
            </label>
            <ErrorMessage message={error} />
            <div className="actions-row">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Signing in..." : "Login"}
              </Button>
              <Link className="text-link" to="/">
                Back to public site
              </Link>
            </div>
          </form>
        </ShellCard>
      </div>
    </div>
  );
}
