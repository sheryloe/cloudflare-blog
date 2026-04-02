import Lenis from "lenis";
import { useEffect } from "react";
import { Navigate, RouterProvider, createBrowserRouter, useParams } from "react-router-dom";

import {
  AboutPage,
  CategoryArchivePage,
  ContactPage,
  DisclaimerPage,
  EditorialPolicyPage,
  HomePage,
  NotFoundPage,
  PostPage,
  PreDeployTestPage,
  PrivacyPage,
  PublicLayout,
  SearchPage,
  TagArchivePage,
  TermsPage,
  WorkerResourceRedirectPage,
} from "./editorial-pages";

const KO_BASE_PATH = "/ko";

function toKoPath(path: string) {
  if (path === "/") {
    return `${KO_BASE_PATH}/`;
  }

  return `${KO_BASE_PATH}${path}`;
}

function LegacySlugRedirect(props: { prefix: string }) {
  const { slug = "" } = useParams();
  return <Navigate to={`${props.prefix}/${slug}`} replace />;
}

const router = createBrowserRouter([
  {
    path: KO_BASE_PATH,
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "post/:slug", element: <PostPage /> },
      { path: "category/:slug", element: <CategoryArchivePage /> },
      { path: "tag/:slug", element: <TagArchivePage /> },
      { path: "about", element: <AboutPage /> },
      { path: "search", element: <SearchPage /> },
      { path: "privacy", element: <PrivacyPage /> },
      { path: "contact", element: <ContactPage /> },
      { path: "terms", element: <TermsPage /> },
      { path: "disclaimer", element: <DisclaimerPage /> },
      { path: "editorial-policy", element: <EditorialPolicyPage /> },
      { path: "test-preview", element: <PreDeployTestPage /> },
      {
        path: "rss.xml",
        element: <WorkerResourceRedirectPage title="RSS" resourcePath="/rss.xml" />,
      },
      {
        path: "feed.xml",
        element: <WorkerResourceRedirectPage title="Feed" resourcePath="/rss.xml" />,
      },
      {
        path: "sitemap.xml",
        element: <WorkerResourceRedirectPage title="사이트맵" resourcePath="/sitemap.xml" />,
      },
      { path: "404", element: <NotFoundPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
  {
    path: "/",
    element: <Navigate to={toKoPath("/")} replace />,
  },
  {
    path: "/post/:slug",
    element: <LegacySlugRedirect prefix={toKoPath("/post")} />,
  },
  {
    path: "/category/:slug",
    element: <LegacySlugRedirect prefix={toKoPath("/category")} />,
  },
  {
    path: "/tag/:slug",
    element: <LegacySlugRedirect prefix={toKoPath("/tag")} />,
  },
  {
    path: "/about",
    element: <Navigate to={toKoPath("/about")} replace />,
  },
  {
    path: "/search",
    element: <Navigate to={toKoPath("/search")} replace />,
  },
  {
    path: "/test-preview",
    element: <Navigate to={toKoPath("/test-preview")} replace />,
  },
  {
    path: "/privacy",
    element: <Navigate to={toKoPath("/privacy")} replace />,
  },
  {
    path: "/contact",
    element: <Navigate to={toKoPath("/contact")} replace />,
  },
  {
    path: "/terms",
    element: <Navigate to={toKoPath("/terms")} replace />,
  },
  {
    path: "/disclaimer",
    element: <Navigate to={toKoPath("/disclaimer")} replace />,
  },
  {
    path: "/editorial-policy",
    element: <Navigate to={toKoPath("/editorial-policy")} replace />,
  },
  {
    path: "/rss.xml",
    element: <Navigate to={toKoPath("/rss.xml")} replace />,
  },
  {
    path: "/feed.xml",
    element: <Navigate to={toKoPath("/feed.xml")} replace />,
  },
  {
    path: "/sitemap.xml",
    element: <Navigate to={toKoPath("/sitemap.xml")} replace />,
  },
  {
    path: "*",
    element: <Navigate to={toKoPath("/404")} replace />,
  },
]);

export function App() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.12,
      smoothWheel: true,
      touchMultiplier: 1.1,
    });

    let frameId = 0;

    const frame = (time: number) => {
      lenis.raf(time);
      frameId = window.requestAnimationFrame(frame);
    };

    frameId = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(frameId);
      lenis.destroy();
    };
  }, []);

  return <RouterProvider router={router} />;
}
