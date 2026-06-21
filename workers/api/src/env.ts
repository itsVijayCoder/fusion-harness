export type Env = {
  DB: D1Database;
  CONFIG_KV: KVNamespace;
  ARTIFACTS: R2Bucket;
  AI: Ai;
  FUSION_RUN: DurableObjectNamespace;
  RUNNER_SESSION: DurableObjectNamespace;
  FUSION_WORKFLOW: unknown;
  ENVIRONMENT: string;
  PUBLIC_APP_URL: string;
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_WEBHOOK_SECRET: string;
  GITHUB_APP_SLUG?: string;
};

export type AppBindings = {
  Bindings: Env;
};
