import type { Context } from "hono";

import type { AppEnv } from "../types";

type EndpointDoc = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  auth: "public" | "admin";
  description: string;
};

const PUBLIC_ENDPOINTS: EndpointDoc[] = [
  { method: "GET", path: "/health", auth: "public", description: "Worker 상태를 확인합니다." },
  { method: "GET", path: "/rss.xml", auth: "public", description: "공개 글 RSS 피드를 반환합니다." },
  { method: "GET", path: "/feed.xml", auth: "public", description: "RSS 2.0 feed.xml endpoint를 반환합니다." },
  { method: "GET", path: "/sitemap.xml", auth: "public", description: "공개 글과 카테고리 sitemap을 반환합니다." },
  { method: "GET", path: "/assets/:path", auth: "public", description: "R2에 저장된 공개 자산을 프록시합니다." },
  { method: "GET", path: "/api/public/posts", auth: "public", description: "발행된 글 목록을 조회합니다." },
  { method: "GET", path: "/api/public/posts/top?limit=3", auth: "public", description: "조회수 기준 인기 글을 조회합니다." },
  { method: "GET", path: "/api/public/posts/:slug", auth: "public", description: "slug 기준 공개 글 상세를 조회합니다." },
  { method: "POST", path: "/api/public/posts/:slug/view", auth: "public", description: "게시글 조회수를 1 증가시킵니다." },
  { method: "GET", path: "/api/public/categories", auth: "public", description: "카테고리 트리를 조회합니다." },
  { method: "GET", path: "/api/public/site-settings", auth: "public", description: "공개 블로그 제목/소개 등 사이트 설정을 조회합니다." },
  { method: "GET", path: "/api/public/categories/:slug/posts", auth: "public", description: "카테고리별 글 목록을 조회합니다." },
  { method: "GET", path: "/api/public/tags/:slug/posts", auth: "public", description: "태그별 글 목록을 조회합니다." },
  { method: "GET", path: "/api/public/search?q=키워드", auth: "public", description: "제목, 요약, 본문, 태그 기준으로 검색합니다." },
];

const ADMIN_ENDPOINTS: EndpointDoc[] = [
  { method: "POST", path: "/api/admin/login", auth: "public", description: "관리자 로그인 후 세션과 토큰을 발급합니다." },
  { method: "POST", path: "/api/admin/logout", auth: "admin", description: "관리자 세션을 종료합니다." },
  { method: "GET", path: "/api/admin/session", auth: "public", description: "현재 로그인 세션 상태를 조회합니다." },
  { method: "GET", path: "/api/admin/site-settings", auth: "admin", description: "공개 블로그 설정을 조회합니다." },
  { method: "PUT", path: "/api/admin/site-settings", auth: "admin", description: "공개 블로그 설정을 저장합니다." },
  { method: "GET", path: "/api/admin/posts", auth: "admin", description: "관리자 글 목록을 조회합니다." },
  { method: "GET", path: "/api/admin/posts/:id", auth: "admin", description: "관리자 글 상세를 조회합니다." },
  {
    method: "POST",
    path: "/api/admin/posts/upsert-by-slug",
    auth: "public",
    description: "자동화 키(x-automation-key) 기반으로 slug 기준 생성/수정 upsert를 수행합니다.",
  },
  {
    method: "POST",
    path: "/api/admin/posts/upsert-by-slug/manual",
    auth: "admin",
    description: "관리자 세션 인증으로 slug 기준 생성/수정 upsert를 수행합니다.",
  },
  { method: "POST", path: "/api/admin/posts", auth: "admin", description: "새 글을 생성합니다." },
  { method: "PUT", path: "/api/admin/posts/:id", auth: "admin", description: "글을 수정합니다." },
  { method: "DELETE", path: "/api/admin/posts/:id", auth: "admin", description: "글을 삭제합니다." },
  { method: "GET", path: "/api/admin/categories", auth: "admin", description: "카테고리 목록을 조회합니다." },
  { method: "POST", path: "/api/admin/categories", auth: "admin", description: "카테고리를 생성합니다." },
  { method: "PUT", path: "/api/admin/categories/:id", auth: "admin", description: "카테고리를 수정합니다." },
  { method: "DELETE", path: "/api/admin/categories/:id", auth: "admin", description: "카테고리를 삭제합니다." },
  { method: "GET", path: "/api/admin/tags", auth: "admin", description: "태그 목록을 조회합니다." },
  { method: "POST", path: "/api/admin/tags", auth: "admin", description: "태그를 생성합니다." },
  { method: "PUT", path: "/api/admin/tags/:id", auth: "admin", description: "태그를 수정합니다." },
  { method: "DELETE", path: "/api/admin/tags/:id", auth: "admin", description: "태그를 삭제합니다." },
  { method: "GET", path: "/api/admin/media", auth: "admin", description: "업로드된 미디어 자산을 조회합니다." },
  { method: "POST", path: "/api/admin/media", auth: "admin", description: "이미지 파일을 업로드합니다." },
  { method: "PUT", path: "/api/admin/media/:id", auth: "admin", description: "미디어 alt 텍스트를 수정합니다." },
];

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderRows(items: EndpointDoc[]) {
  return items
    .map(
      (item) => `
        <tr>
          <td><span class="method method--${item.method.toLowerCase()}">${item.method}</span></td>
          <td><code>${escapeHtml(item.path)}</code></td>
          <td>${item.auth === "admin" ? "관리자" : "공개"}</td>
          <td>${escapeHtml(item.description)}</td>
        </tr>`,
    )
    .join("");
}

export function renderLocalApiDocs(c: Context<AppEnv>) {
  const origin = new URL(c.req.url).origin;
  const loginBody = JSON.stringify(
    {
      email: "admin@example.com",
      password: "admin123!",
    },
    null,
    2,
  );

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Local API Docs</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4f1ea;
        --panel: rgba(255, 255, 255, 0.88);
        --ink: #172232;
        --soft: #5f6d80;
        --line: rgba(23, 34, 50, 0.12);
        --accent: #b94f24;
        --accent-soft: rgba(185, 79, 36, 0.12);
        --get: #1d6f42;
        --post: #935f00;
        --put: #0d5e9f;
        --delete: #9d2f3f;
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Pretendard Variable", "Pretendard", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, rgba(255, 207, 164, 0.35), transparent 32rem),
          linear-gradient(180deg, #f8f5ef 0%, var(--bg) 100%);
      }
      .wrap {
        width: min(1120px, calc(100% - 32px));
        margin: 0 auto;
        padding: 32px 0 56px;
      }
      .hero, .panel {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 28px;
        box-shadow: 0 18px 48px rgba(23, 34, 50, 0.08);
        backdrop-filter: blur(14px);
      }
      .hero {
        padding: 28px;
        margin-bottom: 20px;
      }
      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 8px 12px;
        font-size: 12px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--soft);
        background: rgba(255,255,255,0.7);
      }
      h1 {
        margin: 18px 0 10px;
        font-size: clamp(2rem, 5vw, 3.5rem);
        line-height: 1.05;
      }
      p {
        margin: 0;
        color: var(--soft);
        line-height: 1.7;
      }
      .meta {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 14px;
        margin-top: 22px;
      }
      .meta-card {
        padding: 16px 18px;
        background: rgba(255,255,255,0.72);
        border: 1px solid var(--line);
        border-radius: 20px;
      }
      .meta-card strong {
        display: block;
        margin-bottom: 8px;
        font-size: 0.95rem;
      }
      .grid {
        display: grid;
        gap: 20px;
      }
      .panel {
        padding: 24px;
      }
      .panel h2 {
        margin: 0 0 10px;
        font-size: 1.4rem;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 14px;
      }
      th, td {
        text-align: left;
        padding: 12px 10px;
        border-top: 1px solid var(--line);
        vertical-align: top;
        font-size: 0.96rem;
      }
      th {
        color: var(--soft);
        font-weight: 600;
      }
      code, pre {
        font-family: "IBM Plex Mono", monospace;
      }
      code {
        padding: 3px 7px;
        border-radius: 10px;
        background: rgba(23, 34, 50, 0.06);
      }
      pre {
        margin: 14px 0 0;
        padding: 16px;
        overflow: auto;
        border-radius: 18px;
        background: #18222f;
        color: #eef3f8;
        font-size: 0.92rem;
        line-height: 1.6;
      }
      .method {
        display: inline-flex;
        min-width: 68px;
        justify-content: center;
        border-radius: 999px;
        padding: 6px 10px;
        color: white;
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.08em;
      }
      .method--get { background: var(--get); }
      .method--post { background: var(--post); }
      .method--put { background: var(--put); }
      .method--delete { background: var(--delete); }
      .note {
        margin-top: 12px;
        padding: 14px 16px;
        border-radius: 18px;
        background: var(--accent-soft);
        color: #6f3218;
      }
      a { color: var(--accent); text-decoration: none; }
      a:hover { text-decoration: underline; }
      .links {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 16px;
      }
      .link-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 9px 13px;
        background: rgba(255,255,255,0.72);
      }
    </style>
  </head>
  <body>
    <main class="wrap">
      <section class="hero">
        <div class="eyebrow">Local API Docs</div>
        <h1>로컬에서 바로 보는 API 안내 페이지</h1>
        <p>이 페이지는 로컬 개발 환경에서만 열리도록 만든 API 문서입니다. 관리자 로그인, public 조회, 미디어 업로드 흐름을 실제 엔드포인트 기준으로 빠르게 확인할 수 있습니다.</p>
        <div class="meta">
          <div class="meta-card">
            <strong>Base URL</strong>
            <code>${escapeHtml(origin)}</code>
          </div>
          <div class="meta-card">
            <strong>로컬 관리자 계정</strong>
            <code>admin@example.com / admin123!</code>
          </div>
          <div class="meta-card">
            <strong>문서 경로</strong>
            <code>/__api</code>
          </div>
        </div>
        <div class="links">
          <a class="link-chip" href="${escapeHtml(origin)}/health">/health</a>
          <a class="link-chip" href="${escapeHtml(origin)}/rss.xml">/rss.xml</a>
          <a class="link-chip" href="${escapeHtml(origin)}/feed.xml">/feed.xml</a>
          <a class="link-chip" href="${escapeHtml(origin)}/sitemap.xml">/sitemap.xml</a>
          <a class="link-chip" href="http://127.0.0.1:5174/login">관리자 앱</a>
          <a class="link-chip" href="http://127.0.0.1:5173/">공개 블로그</a>
        </div>
      </section>

      <section class="grid">
        <section class="panel">
          <h2>로그인 예시</h2>
          <p>로컬 개발에서는 아래 계정으로 로그인한 뒤 쿠키 또는 Bearer 토큰 기반으로 관리자 API를 사용할 수 있습니다.</p>
          <pre><code>POST ${escapeHtml(origin)}/api/admin/login
Content-Type: application/json

${escapeHtml(loginBody)}</code></pre>
          <div class="note">배포 환경에서는 이 로컬 기본 계정이 아니라 Worker secret에 설정한 <code>ADMIN_EMAIL</code>, <code>ADMIN_PASSWORD_HASH</code>, <code>JWT_SECRET</code>이 사용됩니다.</div>
        </section>

        <section class="panel">
          <h2>Public Endpoints</h2>
          <p>공개 블로그와 관리자 프런트에서 함께 참조하는 읽기 전용/공개용 API입니다.</p>
          <table>
            <thead>
              <tr>
                <th>Method</th>
                <th>Path</th>
                <th>권한</th>
                <th>설명</th>
              </tr>
            </thead>
            <tbody>${renderRows(PUBLIC_ENDPOINTS)}</tbody>
          </table>
        </section>

        <section class="panel">
          <h2>Admin Endpoints</h2>
          <p>로그인 후 사용하는 관리자 전용 API입니다. 로그인, 글 작성/수정, 카테고리/태그 관리, 미디어 업로드까지 포함합니다.</p>
          <table>
            <thead>
              <tr>
                <th>Method</th>
                <th>Path</th>
                <th>권한</th>
                <th>설명</th>
              </tr>
            </thead>
            <tbody>${renderRows(ADMIN_ENDPOINTS)}</tbody>
          </table>
        </section>

        <section class="panel">
          <h2>빠른 사용 메모</h2>
          <p>관리자 앱은 기본적으로 <code>VITE_API_BASE_URL</code> 이 없으면 개발 모드에서 <code>http://127.0.0.1:8787</code> 를 API로 사용합니다. 그래서 로컬 개발 순서는 보통 아래처럼 맞춰두면 됩니다.</p>
          <pre><code>1. pnpm dev:api
2. pnpm dev:web
3. pnpm dev:admin
4. 브라우저에서 http://127.0.0.1:5174/login 접속</code></pre>
        </section>
      </section>
    </main>
  </body>
</html>`;
}
