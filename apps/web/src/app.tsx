import { RouterProvider, createBrowserRouter, Navigate } from "react-router-dom";

import { AdminLayout, LoginPage } from "./admin-layout";
import { CategoriesPage, DashboardPage, MediaPage, PostEditorPage, PostsPage, TagsPage } from "./admin-pages";
import { AuthProvider, RequireAdmin } from "./auth";
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
        element: <StaticInfoPage title="About" description="Reserved for brand and profile content." />,
      },
      {
        path: "search",
        element: (
          <StaticInfoPage
            title="Search"
            description="Search is intentionally deferred to the next milestone."
          />
        ),
      },
      {
        path: "rss.xml",
        element: (
          <StaticInfoPage
            title="RSS"
            description="Feed generation will be added after the MVP authoring flow is stable."
          />
        ),
      },
      {
        path: "sitemap.xml",
        element: (
          <StaticInfoPage
            title="Sitemap"
            description="Sitemap generation will be added after the MVP authoring flow is stable."
          />
        ),
      },
    ],
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    element: (
      <RequireAdmin>
        <AdminLayout />
      </RequireAdmin>
    ),
    children: [
      { path: "/dashboard", element: <DashboardPage /> },
      { path: "/posts", element: <PostsPage /> },
      { path: "/posts/new", element: <PostEditorPage /> },
      { path: "/posts/:id/edit", element: <PostEditorPage /> },
      { path: "/media", element: <MediaPage /> },
      { path: "/categories", element: <CategoriesPage /> },
      { path: "/tags", element: <TagsPage /> },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);

export function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
