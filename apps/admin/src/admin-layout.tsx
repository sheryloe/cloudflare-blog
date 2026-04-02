import type { LoginInput } from "@cloudflare-blog/shared";
import { LayoutDashboard, Library, LogOut, PanelsTopLeft, Settings2, Sparkles, Tags, Upload } from "lucide-react";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { Input } from "./components/ui/input";
import { useAuth } from "./auth";
import { cn } from "./lib/utils";
import { Button, ErrorMessage, ShellCard } from "./ui";

const PUBLIC_APP_URL = import.meta.env.VITE_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:5173";

const adminLinks = [
  { to: "/dashboard", label: "대시보드", icon: LayoutDashboard, description: "요약 지표와 현황" },
  { to: "/posts", label: "글", icon: PanelsTopLeft, description: "작성, 수정, 발행" },
  { to: "/media", label: "미디어", icon: Upload, description: "R2에 업로드된 자산" },
  { to: "/settings", label: "설정", icon: Settings2, description: "블로그 제목과 소개 문구" },
  { to: "/categories", label: "카테고리", icon: Library, description: "아카이브/주제 구조" },
  { to: "/tags", label: "태그", icon: Tags, description: "검색용 키워드" },
  { to: "/automation", label: "자동화", icon: Sparkles, description: "수동 upsert 실행" },
];

function useWorkspaceHeading() {
  const location = useLocation();

  return useMemo(() => {
    const current = adminLinks.find((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));

    if (!current) {
      return {
        title: "에디터 작업공간",
        description: "작성, 분류, 미디어, 발행을 한 곳에서 관리합니다.",
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
                <p className="section-kicker !tracking-[0.28em]">블로그 어드민</p>
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-ink)]">에디터 관리</h1>
                <p className="text-sm leading-7 text-[var(--color-soft-ink)]">
                  초안 작성, 카테고리 정리, 이미지 업로드, 발행까지 한 화면에서 처리합니다.
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
              <p className="section-kicker">세션</p>
              <div>
                <p className="text-sm text-[var(--color-soft-ink)]">로그인 계정</p>
                <p className="mt-1 text-base font-semibold text-[var(--color-ink)]">{auth.session.user?.email ?? "미로그인"}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="soft" className="rounded-full">
                  <a href={PUBLIC_APP_URL}>퍼블릭 블로그 열기</a>
                </Button>
                <Button variant="outline" onClick={() => void handleLogout()} className="rounded-full">
                  <LogOut className="h-4 w-4" />
                  로그아웃
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
                  <p className="section-kicker !tracking-[0.28em]">로그인된 작업공간</p>
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
                  <p className="section-kicker !text-[rgba(255,234,214,0.82)]">접근</p>
                  <p className="mt-2 text-lg font-semibold tracking-tight">관리자 전용</p>
                </div>
                <div className="rounded-[24px] border border-black/6 bg-white/72 p-4 shadow-sm">
                  <p className="section-kicker">스토리지</p>
                  <p className="mt-2 text-lg font-semibold tracking-tight">D1 + R2</p>
                </div>
                <div className="rounded-[24px] border border-black/6 bg-white/72 p-4 shadow-sm">
                  <p className="section-kicker">세션</p>
                  <p className="mt-2 text-lg font-semibold tracking-tight">쿠키 우선 인증</p>
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
      setError(reason instanceof Error ? reason.message : "로그인에 실패했습니다.");
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
              <p className="section-kicker !tracking-[0.28em]">블로그 어드민</p>
            </div>
            <div className="space-y-3">
              <h1 className="text-5xl font-semibold tracking-tight text-[var(--color-ink)]">집중형 콘텐츠 운영</h1>
              <p className="max-w-xl text-base leading-8 text-[var(--color-soft-ink)]">
                초안, 분류, 이미지, 발행을 한 화면에서 처리할 수 있는 관리자 화면입니다.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-[24px] border border-black/6 bg-white/72 p-4 shadow-sm">
              <p className="section-kicker">구조</p>
              <p className="mt-2 text-lg font-semibold tracking-tight">분리된 어드민 화면</p>
            </div>
            <div className="rounded-[24px] border border-black/6 bg-white/72 p-4 shadow-sm">
              <p className="section-kicker">인증</p>
              <p className="mt-2 text-lg font-semibold tracking-tight">쿠키 세션</p>
            </div>
            <div className="rounded-[24px] border border-black/6 bg-white/72 p-4 shadow-sm">
              <p className="section-kicker">API</p>
              <p className="mt-2 text-lg font-semibold tracking-tight">Worker 기반</p>
            </div>
          </div>
        </section>

        <div className="w-full">
          <ShellCard
            title="관리자 로그인"
            description="글 작성과 수정, 분류 관리, 미디어 업로드를 위해 로그인하세요."
            className="min-h-full"
          >
            <form className="grid gap-5" onSubmit={handleSubmit}>
              <label className="block">
                <span className="field-label">이메일</span>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  required
                />
              </label>
              <label className="block">
                <span className="field-label">비밀번호</span>
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
                  {submitting ? "로그인 중..." : "로그인"}
                </Button>
                <Button asChild variant="soft" className="rounded-full">
                  <a href={PUBLIC_APP_URL}>퍼블릭 블로그로</a>
                </Button>
              </div>
            </form>
          </ShellCard>
        </div>
      </div>
    </div>
  );
}
