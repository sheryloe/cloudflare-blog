export interface WorkerBindings {
  DB: D1Database;
  ASSETS: R2Bucket;
  PUBLIC_APP_ORIGIN: string;
  ADMIN_APP_ORIGIN: string;
  R2_PUBLIC_BASE_URL: string;
  AUTOMATION_API_KEY?: string;
  AUTOMATION_ALLOWED_IPS?: string;
  BLOGGERGENT_M2M_TOKEN?: string;
  BLOGGERGENT_ALLOWED_ORIGIN?: string;
  ADMIN_EMAIL: string;
  ADMIN_PASSWORD_HASH: string;
  JWT_SECRET: string;
}

export type AppEnv = {
  Bindings: WorkerBindings;
};
