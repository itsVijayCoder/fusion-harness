CREATE TABLE github_installations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  installation_id INTEGER NOT NULL,
  account_login TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('User', 'Organization', 'Bot')),
  target_type TEXT,
  permissions_json TEXT NOT NULL,
  repository_selection TEXT CHECK (repository_selection IN ('selected', 'all')),
  suspended_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (org_id, installation_id),
  FOREIGN KEY (org_id) REFERENCES orgs(id)
);

CREATE TABLE github_repositories (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  installation_id INTEGER NOT NULL,
  github_repo_id INTEGER NOT NULL,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  private INTEGER NOT NULL DEFAULT 0,
  default_branch TEXT,
  html_url TEXT,
  workspace_id TEXT,
  default_runner_id TEXT,
  auto_review_enabled INTEGER NOT NULL DEFAULT 0,
  auto_review_trigger TEXT NOT NULL DEFAULT 'review_requested' CHECK (auto_review_trigger IN ('review_requested', 'assigned', 'both', 'manual')),
  auto_publish_enabled INTEGER NOT NULL DEFAULT 0,
  permission_profile TEXT NOT NULL DEFAULT 'readonly' CHECK (permission_profile IN ('readonly', 'workspace_write', 'trusted_internal')),
  run_tests INTEGER NOT NULL DEFAULT 0,
  max_comments INTEGER NOT NULL DEFAULT 20,
  ignored_paths_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (org_id, github_repo_id),
  FOREIGN KEY (org_id) REFERENCES orgs(id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE github_user_links (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  github_login TEXT NOT NULL,
  github_user_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (org_id, user_id),
  UNIQUE (org_id, github_login),
  FOREIGN KEY (org_id) REFERENCES orgs(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE github_pull_requests (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  repo_id TEXT NOT NULL,
  github_pr_id INTEGER NOT NULL,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  author_login TEXT,
  state TEXT NOT NULL,
  draft INTEGER NOT NULL DEFAULT 0,
  is_fork INTEGER NOT NULL DEFAULT 0,
  base_ref TEXT NOT NULL,
  base_sha TEXT NOT NULL,
  head_ref TEXT NOT NULL,
  head_sha TEXT NOT NULL,
  head_repo_full_name TEXT,
  html_url TEXT,
  status TEXT NOT NULL DEFAULT 'not_assigned' CHECK (status IN ('not_assigned', 'assigned', 'pending', 'reviewed', 'stale', 'failed', 'ignored')),
  additions INTEGER,
  deletions INTEGER,
  changed_files INTEGER,
  last_synced_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  closed_at TEXT,
  UNIQUE (org_id, repo_id, number),
  FOREIGN KEY (org_id) REFERENCES orgs(id),
  FOREIGN KEY (repo_id) REFERENCES github_repositories(id)
);

CREATE TABLE github_pr_review_subjects (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  pr_id TEXT NOT NULL,
  github_login TEXT NOT NULL,
  user_id TEXT,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('assignee', 'requested_reviewer')),
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'removed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (org_id, pr_id, github_login, subject_type),
  FOREIGN KEY (org_id) REFERENCES orgs(id),
  FOREIGN KEY (pr_id) REFERENCES github_pull_requests(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE pr_review_runs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  pr_id TEXT NOT NULL,
  fusion_run_id TEXT,
  runner_id TEXT,
  requested_by_user_id TEXT,
  head_sha TEXT NOT NULL,
  base_sha TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  review_mode TEXT NOT NULL DEFAULT 'standard' CHECK (review_mode IN ('quick', 'standard', 'deep', 'security')),
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')),
  decision TEXT CHECK (decision IN ('comment', 'request_changes', 'approve')),
  summary TEXT,
  diff_object_key TEXT,
  findings_object_key TEXT,
  transcript_object_key TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (org_id) REFERENCES orgs(id),
  FOREIGN KEY (pr_id) REFERENCES github_pull_requests(id),
  FOREIGN KEY (runner_id) REFERENCES runners(id),
  FOREIGN KEY (requested_by_user_id) REFERENCES users(id)
);

CREATE TABLE pr_review_comments (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  review_run_id TEXT NOT NULL,
  pr_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('LEFT', 'RIGHT')),
  start_line INTEGER,
  line INTEGER,
  severity TEXT NOT NULL CHECK (severity IN ('blocker', 'major', 'minor', 'nit')),
  category TEXT NOT NULL CHECK (category IN ('bug', 'security', 'performance', 'maintainability', 'test', 'ux', 'accessibility', 'docs')),
  body TEXT NOT NULL,
  suggested_change TEXT,
  confidence REAL,
  evidence TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'edited', 'approved', 'rejected', 'published', 'outdated', 'failed')),
  github_comment_id INTEGER,
  edited_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  FOREIGN KEY (org_id) REFERENCES orgs(id),
  FOREIGN KEY (review_run_id) REFERENCES pr_review_runs(id),
  FOREIGN KEY (pr_id) REFERENCES github_pull_requests(id),
  FOREIGN KEY (edited_by_user_id) REFERENCES users(id)
);

CREATE TABLE github_webhook_events (
  id TEXT PRIMARY KEY,
  org_id TEXT,
  delivery_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  action TEXT,
  installation_id INTEGER,
  repo_id TEXT,
  pr_id TEXT,
  payload_object_key TEXT,
  processed_at TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (delivery_id)
);

CREATE INDEX idx_github_repositories_org ON github_repositories(org_id, updated_at DESC);
CREATE INDEX idx_github_repositories_installation ON github_repositories(installation_id);
CREATE INDEX idx_github_prs_repo_status ON github_pull_requests(repo_id, status, updated_at DESC);
CREATE INDEX idx_github_prs_org_status ON github_pull_requests(org_id, status, updated_at DESC);
CREATE INDEX idx_github_pr_review_subjects_pr ON github_pr_review_subjects(pr_id, state);
CREATE INDEX idx_pr_review_runs_pr_head ON pr_review_runs(pr_id, head_sha, created_at DESC);
CREATE INDEX idx_pr_review_runs_org_status ON pr_review_runs(org_id, status, created_at DESC);
CREATE INDEX idx_pr_review_comments_run_status ON pr_review_comments(review_run_id, status);
CREATE INDEX idx_pr_review_comments_pr ON pr_review_comments(pr_id, status);
CREATE INDEX idx_github_webhook_events_delivery ON github_webhook_events(delivery_id);
CREATE INDEX idx_github_webhook_events_org ON github_webhook_events(org_id, created_at DESC);