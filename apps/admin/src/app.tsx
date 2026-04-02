import { RouterProvider, createBrowserRouter, Navigate } from "react-router-dom";

import { AdminLayout, LoginPage } from "./admin-layout";
import { AuthProvider, RequireAdmin } from "./auth";
import { CategoriesPage, DashboardPage, MediaPage, PostsPage, TagsPage } from "./admin-overview-pages";
import { AutomationPage } from "./automation-page";
import { PostEditorPage } from "./post-editor-page";
import { SiteSettingsPage } from "./site-settings-page";

const router = createBrowserRouter([
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
      { path: "/", element: <Navigate to="/dashboard" replace /> },
      { path: "/dashboard", element: <DashboardPage /> },
      { path: "/posts", element: <PostsPage /> },
      { path: "/posts/new", element: <PostEditorPage /> },
      { path: "/posts/:id/edit", element: <PostEditorPage /> },
      { path: "/media", element: <MediaPage /> },
      { path: "/settings", element: <SiteSettingsPage /> },
      { path: "/categories", element: <CategoriesPage /> },
      { path: "/tags", element: <TagsPage /> },
      { path: "/automation", element: <AutomationPage /> }
    ]
  },
  {
    path: "*",
    element: <Navigate to="/dashboard" replace />
  }
]);

export function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
