import { Hono } from "hono";
import { cors } from "hono/cors";

import { fail, ok } from "./lib/http";
import publicRoutes from "./routes/public";
import adminRoutes from "./routes/admin";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>();

app.use(
  "/api/*",
  cors({
    origin: (origin) => origin || "http://localhost:5173",
    credentials: true,
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  }),
);

app.get("/health", (c) => ok(c, { status: "ok" }));
app.route("/api/public", publicRoutes);
app.route("/api/admin", adminRoutes);

app.notFound((c) => fail(c, 404, "NOT_FOUND", "The requested route does not exist."));

app.onError((error, c) => {
  console.error(error);
  return fail(c, 500, "INTERNAL_ERROR", "An unexpected server error occurred.");
});

export default app;
