import { RouterProvider, createBrowserRouter, Navigate } from "react-router-dom";

import { AdminLayout, LoginPage } from "./admin-layout";
import { CategoriesPage, DashboardPage, MediaPage, PostEditorPage, PostsPage, TagsPage } from "./admin-pages";
import { AuthProvider, RequireAdmin } from "./auth";

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
      { path: "/categories", element: <CategoriesPage /> },
      { path: "/tags", element: <TagsPage /> }
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
