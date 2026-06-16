import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const orgs = sqliteTable("orgs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  email: text("email").notNull(),
  name: text("name"),
  role: text("role").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  name: text("name").notNull(),
  repoUrl: text("repo_url"),
  defaultBranch: text("default_branch"),
  defaultRunnerPool: text("default_runner_pool"),
  permissionProfile: text("permission_profile").notNull().default("readonly"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const runners = sqliteTable(
  "runners",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    userId: text("user_id"),
    name: text("name").notNull(),
    os: text("os").notNull(),
    arch: text("arch").notNull(),
    version: text("version").notNull(),
    status: text("status").notNull(),
    capabilitiesJson: text("capabilities_json").notNull(),
    lastSeenAt: text("last_seen_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("idx_runners_org_status").on(table.orgId, table.status)],
);

export const installedTools = sqliteTable("installed_tools", {
  id: text("id").primaryKey(),
  runnerId: text("runner_id").notNull(),
  tool: text("tool").notNull(),
  version: text("version"),
  path: text("path"),
  status: text("status").notNull(),
  metadataJson: text("metadata_json"),
  detectedAt: text("detected_at").notNull(),
});

export const models = sqliteTable(
  "models",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    runnerId: text("runner_id"),
    adapter: text("adapter").notNull(),
    provider: text("provider"),
    model: text("model").notNull(),
    displayName: text("display_name"),
    authMode: text("auth_mode").notNull(),
    availability: text("availability").notNull(),
    source: text("source"),
    capabilitiesJson: text("capabilities_json").notNull(),
    verifiedAt: text("verified_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("idx_models_org_adapter").on(table.orgId, table.adapter)],
);

export const fusionRuns = sqliteTable(
  "fusion_runs",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    workspaceId: text("workspace_id"),
    userId: text("user_id").notNull(),
    runnerId: text("runner_id"),
    status: text("status").notNull(),
    mode: text("mode").notNull(),
    preset: text("preset"),
    permissionProfile: text("permission_profile").notNull(),
    promptObjectKey: text("prompt_object_key"),
    judgeObjectKey: text("judge_object_key"),
    finalObjectKey: text("final_object_key"),
    error: text("error"),
    createdAt: text("created_at").notNull(),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
  },
  (table) => [index("idx_fusion_runs_org_created").on(table.orgId, table.createdAt)],
);

export const panelOutputs = sqliteTable(
  "panel_outputs",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    modelId: text("model_id").notNull(),
    adapter: text("adapter").notNull(),
    status: text("status").notNull(),
    outputObjectKey: text("output_object_key"),
    error: text("error"),
    latencyMs: integer("latency_ms"),
    usageJson: text("usage_json"),
    createdAt: text("created_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => [index("idx_panel_outputs_run").on(table.runId)],
);

export const artifacts = sqliteTable("artifacts", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  runId: text("run_id").notNull(),
  kind: text("kind").notNull(),
  objectKey: text("object_key").notNull(),
  contentType: text("content_type"),
  sizeBytes: integer("size_bytes"),
  sha256: text("sha256"),
  createdAt: text("created_at").notNull(),
});

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    userId: text("user_id"),
    runnerId: text("runner_id"),
    runId: text("run_id"),
    eventType: text("event_type").notNull(),
    severity: text("severity").notNull().default("info"),
    metadataJson: text("metadata_json"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_audit_org_created").on(table.orgId, table.createdAt)],
);
