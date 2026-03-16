import Lenis from "lenis";
import { useEffect } from "react";
import { RouterProvider, createBrowserRouter, Navigate } from "react-router-dom";
import {
  CategoryArchivePage,
  HomePage,
  PostPage,
  PublicLayout,
  StaticInfoPage,
  TagArchivePage,
} from "./public-pages";

const router = createBrowserRouter([
  {
    path: "/",
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "post/:slug", element: <PostPage /> },
      { path: "category/:slug", element: <CategoryArchivePage /> },
      { path: "tag/:slug", element: <TagArchivePage /> },
      {
        path: "about",
        element: <StaticInfoPage title="소개" description="브랜드 소개와 프로필 내용을 정리할 예정입니다." />,
      },
      {
        path: "search",
        element: (
          <StaticInfoPage
            title="검색"
            description="검색 기능은 다음 단계에서 추가할 예정입니다."
          />
        ),
      },
      {
        path: "rss.xml",
        element: (
          <StaticInfoPage
            title="RSS"
            description="피드 생성은 기본 작성 흐름이 안정된 뒤에 추가할 예정입니다."
          />
        ),
      },
      {
        path: "sitemap.xml",
        element: (
          <StaticInfoPage
            title="사이트맵"
            description="사이트맵 생성은 기본 작성 흐름이 안정된 뒤에 추가할 예정입니다."
          />
        ),
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
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
