PRAGMA foreign_keys = OFF;

DROP INDEX IF EXISTS idx_fusion_runs_org_created;
DROP INDEX IF EXISTS idx_fusion_runs_conversation;
DROP INDEX IF EXISTS idx_runner_jobs_runner_status;
DROP INDEX IF EXISTS idx_runner_jobs_run;

ALTER TABLE fusion_runs RENAME TO fusion_runs_old;

CREATE TABLE fusion_runs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  workspace_id TEXT,
  user_id TEXT NOT NULL,
  runner_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'paused', 'waiting_approval', 'completed', 'failed', 'cancelled')),
  mode TEXT NOT NULL CHECK (mode IN ('direct', 'auto', 'required')),
  preset TEXT,
  permission_profile TEXT NOT NULL,
  prompt_object_key TEXT,
  judge_object_key TEXT,
  final_object_key TEXT,
  execution_plan_json TEXT,
  parent_run_id TEXT,
  conversation_id TEXT,
  title TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (org_id) REFERENCES orgs(id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (runner_id) REFERENCES runners(id)
);

INSERT INTO fusion_runs (
  id, org_id, workspace_id, user_id, runner_id, status, mode, preset,
  permission_profile, prompt_object_key, judge_object_key, final_object_key,
  execution_plan_json, parent_run_id, conversation_id, title, error,
  created_at, started_at, completed_at
)
SELECT
  id, org_id, workspace_id, user_id, runner_id, status, mode, preset,
  permission_profile, prompt_object_key, judge_object_key, final_object_key,
  execution_plan_json, parent_run_id, conversation_id, title, error,
  created_at, started_at, completed_at
FROM fusion_runs_old;

DROP TABLE fusion_runs_old;

CREATE INDEX idx_fusion_runs_org_created ON fusion_runs(org_id, created_at DESC);
CREATE INDEX idx_fusion_runs_conversation ON fusion_runs(conversation_id, created_at);

ALTER TABLE runner_jobs RENAME TO runner_jobs_old;

CREATE TABLE runner_jobs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  runner_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('direct', 'panel', 'judge', 'final', 'command', 'patch')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'paused', 'leased', 'running', 'completed', 'failed', 'timeout', 'cancelled')),
  attempt INTEGER NOT NULL DEFAULT 0,
  lease_owner TEXT,
  lease_expires_at TEXT,
  input_object_key TEXT,
  output_object_key TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (org_id) REFERENCES orgs(id),
  FOREIGN KEY (run_id) REFERENCES fusion_runs(id),
  FOREIGN KEY (runner_id) REFERENCES runners(id)
);

INSERT INTO runner_jobs (
  id, org_id, run_id, runner_id, kind, status, attempt, lease_owner,
  lease_expires_at, input_object_key, output_object_key, error,
  created_at, started_at, completed_at
)
SELECT
  id, org_id, run_id, runner_id, kind, status, attempt, lease_owner,
  lease_expires_at, input_object_key, output_object_key, error,
  created_at, started_at, completed_at
FROM runner_jobs_old;

DROP TABLE runner_jobs_old;

CREATE INDEX idx_runner_jobs_runner_status ON runner_jobs(runner_id, status, created_at);
CREATE INDEX idx_runner_jobs_run ON runner_jobs(run_id, created_at);

PRAGMA foreign_keys = ON;
