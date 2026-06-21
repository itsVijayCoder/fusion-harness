import type {
  AutoReviewTrigger,
  GitHubAccountType,
  GitHubInstallationRef,
  GitHubPrReviewDetail,
  GitHubPrReviewQueueItem,
  GitHubPrReviewSubjectRef,
  GitHubPrStatus,
  GitHubPullRequestRef,
  GitHubRepositoryRef,
  GitHubReviewSubjectState,
  GitHubReviewSubjectType,
  GitHubRepositorySelection,
  GitHubUserLinkRef,
  GitHubWebhookEventRef,
  PermissionProfile,
  PrReviewCommentRef,
  PrReviewCommentStatus,
  PrReviewDecision,
  PrReviewMode,
  PrReviewRiskLevel,
  PrReviewRunRef,
  PrReviewRunStatus,
} from "@fusion-harness/shared";
import type { D1DatabaseLike } from "./client";

type Nullable<T> = T | null | undefined;

type GitHubInstallationRow = {
  id: string;
  org_id: string;
  installation_id: number;
  account_login: string;
  account_type: string;
  target_type: string | null;
  permissions_json: string;
  repository_selection: string | null;
  suspended_at: string | null;
  created_at: string;
  updated_at: string;
};

type GitHubRepositoryRow = {
  id: string;
  org_id: string;
  installation_id: number;
  github_repo_id: number;
  owner: string;
  name: string;
  full_name: string;
  private: number;
  default_branch: string | null;
  html_url: string | null;
  workspace_id: string | null;
  default_runner_id: string | null;
  auto_review_enabled: number;
  auto_review_trigger: string;
  auto_publish_enabled: number;
  permission_profile: string;
  run_tests: number;
  max_comments: number;
  ignored_paths_json: string;
  created_at: string;
  updated_at: string;
};

type GitHubUserLinkRow = {
  id: string;
  org_id: string;
  user_id: string;
  github_login: string;
  github_user_id: number | null;
  created_at: string;
  updated_at: string;
};

type GitHubPullRequestRow = {
  id: string;
  org_id: string;
  repo_id: string;
  github_pr_id: number;
  number: number;
  title: string;
  author_login: string | null;
  state: string;
  draft: number;
  is_fork: number;
  base_ref: string;
  base_sha: string;
  head_ref: string;
  head_sha: string;
  head_repo_full_name: string | null;
  html_url: string | null;
  status: string;
  additions: number | null;
  deletions: number | null;
  changed_files: number | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};

type GitHubPrReviewSubjectRow = {
  id: string;
  org_id: string;
  pr_id: string;
  github_login: string;
  user_id: string | null;
  subject_type: string;
  state: string;
  created_at: string;
  updated_at: string;
};

type PrReviewRunRow = {
  id: string;
  org_id: string;
  pr_id: string;
  fusion_run_id: string | null;
  runner_id: string | null;
  requested_by_user_id: string | null;
  head_sha: string;
  base_sha: string;
  status: string;
  review_mode: string;
  risk_level: string | null;
  decision: string | null;
  summary: string | null;
  diff_object_key: string | null;
  findings_object_key: string | null;
  transcript_object_key: string | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

type PrReviewCommentRow = {
  id: string;
  org_id: string;
  review_run_id: string;
  pr_id: string;
  file_path: string;
  side: string;
  start_line: number | null;
  line: number | null;
  severity: string;
  category: string;
  body: string;
  suggested_change: string | null;
  confidence: number | null;
  evidence: string | null;
  status: string;
  github_comment_id: number | null;
  edited_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

type GitHubWebhookEventRow = {
  id: string;
  org_id: string | null;
  delivery_id: string;
  event_name: string;
  action: string | null;
  installation_id: number | null;
  repo_id: string | null;
  pr_id: string | null;
  payload_object_key: string | null;
  processed_at: string | null;
  error: string | null;
  created_at: string;
};

export type UpsertGitHubInstallationInput = {
  id: string;
  orgId: string;
  installationId: number;
  accountLogin: string;
  accountType: GitHubAccountType;
  targetType?: string;
  permissions: Record<string, string>;
  repositorySelection?: GitHubRepositorySelection;
  suspendedAt?: string;
  now: string;
};

export type UpsertGitHubRepositoryInput = {
  id: string;
  orgId: string;
  installationId: number;
  githubRepoId: number;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch?: string;
  htmlUrl?: string;
  now: string;
};

export type UpdateGitHubRepositorySettingsInput = {
  orgId: string;
  repoId: string;
  workspaceId?: string;
  defaultRunnerId?: string;
  autoReviewEnabled?: boolean;
  autoReviewTrigger?: AutoReviewTrigger;
  autoPublishEnabled?: boolean;
  permissionProfile?: PermissionProfile;
  runTests?: boolean;
  maxComments?: number;
  ignoredPaths?: string[];
  now: string;
};

export type CreateGitHubUserLinkInput = {
  id: string;
  orgId: string;
  userId: string;
  githubLogin: string;
  githubUserId?: number;
  now: string;
};

export type UpsertGitHubPullRequestInput = {
  id: string;
  orgId: string;
  repoId: string;
  githubPrId: number;
  number: number;
  title: string;
  authorLogin?: string;
  state: string;
  draft: boolean;
  isFork: boolean;
  baseRef: string;
  baseSha: string;
  headRef: string;
  headSha: string;
  headRepoFullName?: string;
  htmlUrl?: string;
  additions?: number;
  deletions?: number;
  changedFiles?: number;
  now: string;
};

export type UpsertGitHubReviewSubjectInput = {
  id: string;
  orgId: string;
  prId: string;
  githubLogin: string;
  userId?: string;
  subjectType: GitHubReviewSubjectType;
  state: GitHubReviewSubjectState;
  now: string;
};

export type CreatePrReviewRunInput = {
  id: string;
  orgId: string;
  prId: string;
  runnerId?: string;
  requestedByUserId?: string;
  headSha: string;
  baseSha: string;
  reviewMode: PrReviewMode;
  diffObjectKey?: string;
  now: string;
};

export type UpdatePrReviewRunInput = {
  orgId: string;
  runId: string;
  status?: PrReviewRunStatus;
  fusionRunId?: string;
  riskLevel?: PrReviewRiskLevel;
  decision?: PrReviewDecision;
  summary?: string;
  findingsObjectKey?: string;
  transcriptObjectKey?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
};

export type CreatePrReviewCommentInput = {
  id: string;
  orgId: string;
  reviewRunId: string;
  prId: string;
  filePath: string;
  side: PrReviewCommentRef["side"];
  startLine?: number;
  line?: number;
  severity: PrReviewCommentRef["severity"];
  category: PrReviewCommentRef["category"];
  body: string;
  suggestedChange?: string;
  confidence?: number;
  evidence?: string;
  now: string;
};

export type UpdatePrReviewCommentInput = {
  orgId: string;
  commentId: string;
  body?: string;
  suggestedChange?: string | null;
  severity?: PrReviewCommentRef["severity"];
  category?: PrReviewCommentRef["category"];
  startLine?: number | null;
  line?: number | null;
  side?: PrReviewCommentRef["side"];
  status?: PrReviewCommentStatus;
  editedByUserId?: string;
  githubCommentId?: number;
  now: string;
};

export type CreateGitHubWebhookEventInput = {
  id: string;
  orgId?: string;
  deliveryId: string;
  eventName: string;
  action?: string;
  installationId?: number;
  repoId?: string;
  prId?: string;
  payloadObjectKey?: string;
  now: string;
};

export type CompleteGitHubWebhookEventInput = {
  id: string;
  orgId?: string;
  repoId?: string;
  prId?: string;
  processedAt: string;
  error?: string;
};

export async function upsertGitHubInstallation(db: D1DatabaseLike, input: UpsertGitHubInstallationInput) {
  await db
    .prepare(
      `INSERT INTO github_installations (
         id, org_id, installation_id, account_login, account_type, target_type,
         permissions_json, repository_selection, suspended_at, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         org_id = excluded.org_id,
         installation_id = excluded.installation_id,
         account_login = excluded.account_login,
         account_type = excluded.account_type,
         target_type = COALESCE(excluded.target_type, github_installations.target_type),
         permissions_json = excluded.permissions_json,
         repository_selection = excluded.repository_selection,
         suspended_at = excluded.suspended_at,
         updated_at = excluded.updated_at`,
    )
    .bind(
      input.id,
      input.orgId,
      input.installationId,
      input.accountLogin,
      input.accountType,
      input.targetType ?? null,
      JSON.stringify(input.permissions),
      input.repositorySelection ?? null,
      input.suspendedAt ?? null,
      input.now,
      input.now,
    )
    .run();
  return getGitHubInstallation(db, input.orgId, input.installationId);
}

export async function getGitHubInstallation(db: D1DatabaseLike, orgId: string, installationId: number) {
  const row = await db
    .prepare("SELECT * FROM github_installations WHERE org_id = ? AND installation_id = ?")
    .bind(orgId, installationId)
    .first<GitHubInstallationRow>();
  return row ? mapGitHubInstallation(row) : null;
}

export async function listGitHubInstallations(db: D1DatabaseLike, orgId: string): Promise<GitHubInstallationRef[]> {
  const { results } = await db
    .prepare("SELECT * FROM github_installations WHERE org_id = ? ORDER BY updated_at DESC")
    .bind(orgId)
    .all<GitHubInstallationRow>();
  return results.map(mapGitHubInstallation);
}

export async function deleteGitHubInstallation(db: D1DatabaseLike, orgId: string, installationId: number) {
  await db
    .prepare("DELETE FROM github_installations WHERE org_id = ? AND installation_id = ?")
    .bind(orgId, installationId)
    .run();
}

export async function upsertGitHubRepository(db: D1DatabaseLike, input: UpsertGitHubRepositoryInput) {
  await db
    .prepare(
      `INSERT INTO github_repositories (
         id, org_id, installation_id, github_repo_id, owner, name, full_name,
         private, default_branch, html_url, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         installation_id = excluded.installation_id,
         owner = excluded.owner,
         name = excluded.name,
         full_name = excluded.full_name,
         private = excluded.private,
         default_branch = COALESCE(excluded.default_branch, github_repositories.default_branch),
         html_url = COALESCE(excluded.html_url, github_repositories.html_url),
         updated_at = excluded.updated_at`,
    )
    .bind(
      input.id,
      input.orgId,
      input.installationId,
      input.githubRepoId,
      input.owner,
      input.name,
      input.fullName,
      input.private ? 1 : 0,
      input.defaultBranch ?? null,
      input.htmlUrl ?? null,
      input.now,
      input.now,
    )
    .run();
  return getGitHubRepositoryByGithubId(db, input.orgId, input.githubRepoId);
}

export async function getGitHubRepository(db: D1DatabaseLike, orgId: string, repoId: string) {
  const row = await db
    .prepare("SELECT * FROM github_repositories WHERE org_id = ? AND id = ?")
    .bind(orgId, repoId)
    .first<GitHubRepositoryRow>();
  return row ? mapGitHubRepository(row) : null;
}

export async function getGitHubRepositoryByGithubId(db: D1DatabaseLike, orgId: string, githubRepoId: number) {
  const row = await db
    .prepare("SELECT * FROM github_repositories WHERE org_id = ? AND github_repo_id = ?")
    .bind(orgId, githubRepoId)
    .first<GitHubRepositoryRow>();
  return row ? mapGitHubRepository(row) : null;
}

export async function getGitHubRepositoryByFullName(db: D1DatabaseLike, orgId: string, fullName: string) {
  const row = await db
    .prepare("SELECT * FROM github_repositories WHERE org_id = ? AND full_name = ?")
    .bind(orgId, fullName)
    .first<GitHubRepositoryRow>();
  return row ? mapGitHubRepository(row) : null;
}

export async function listGitHubRepositories(db: D1DatabaseLike, orgId: string): Promise<GitHubRepositoryRef[]> {
  const { results } = await db
    .prepare("SELECT * FROM github_repositories WHERE org_id = ? ORDER BY updated_at DESC")
    .bind(orgId)
    .all<GitHubRepositoryRow>();
  return results.map(mapGitHubRepository);
}

export async function listGitHubRepositoriesByInstallation(
  db: D1DatabaseLike,
  orgId: string,
  installationId: number,
): Promise<GitHubRepositoryRef[]> {
  const { results } = await db
    .prepare("SELECT * FROM github_repositories WHERE org_id = ? AND installation_id = ? ORDER BY full_name ASC")
    .bind(orgId, installationId)
    .all<GitHubRepositoryRow>();
  return results.map(mapGitHubRepository);
}

export async function updateGitHubRepositorySettings(db: D1DatabaseLike, input: UpdateGitHubRepositorySettingsInput) {
  const sets: string[] = ["updated_at = ?"];
  const binds: unknown[] = [input.now];

  if (input.workspaceId !== undefined) {
    sets.push("workspace_id = ?");
    binds.push(input.workspaceId);
  }
  if (input.defaultRunnerId !== undefined) {
    sets.push("default_runner_id = ?");
    binds.push(input.defaultRunnerId);
  }
  if (input.autoReviewEnabled !== undefined) {
    sets.push("auto_review_enabled = ?");
    binds.push(input.autoReviewEnabled ? 1 : 0);
  }
  if (input.autoReviewTrigger !== undefined) {
    sets.push("auto_review_trigger = ?");
    binds.push(input.autoReviewTrigger);
  }
  if (input.autoPublishEnabled !== undefined) {
    sets.push("auto_publish_enabled = ?");
    binds.push(input.autoPublishEnabled ? 1 : 0);
  }
  if (input.permissionProfile !== undefined) {
    sets.push("permission_profile = ?");
    binds.push(input.permissionProfile);
  }
  if (input.runTests !== undefined) {
    sets.push("run_tests = ?");
    binds.push(input.runTests ? 1 : 0);
  }
  if (input.maxComments !== undefined) {
    sets.push("max_comments = ?");
    binds.push(input.maxComments);
  }
  if (input.ignoredPaths !== undefined) {
    sets.push("ignored_paths_json = ?");
    binds.push(JSON.stringify(input.ignoredPaths));
  }

  binds.push(input.orgId, input.repoId);
  await db
    .prepare(`UPDATE github_repositories SET ${sets.join(", ")} WHERE org_id = ? AND id = ?`)
    .bind(...binds)
    .run();

  return getGitHubRepository(db, input.orgId, input.repoId);
}

export async function createGitHubUserLink(db: D1DatabaseLike, input: CreateGitHubUserLinkInput) {
  await db
    .prepare(
      `INSERT INTO github_user_links (id, org_id, user_id, github_login, github_user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(org_id, user_id) DO UPDATE SET
         github_login = excluded.github_login,
         github_user_id = COALESCE(excluded.github_user_id, github_user_links.github_user_id),
         updated_at = excluded.updated_at`,
    )
    .bind(
      input.id,
      input.orgId,
      input.userId,
      input.githubLogin,
      input.githubUserId ?? null,
      input.now,
      input.now,
    )
    .run();

  return getGitHubUserLinkByUserId(db, input.orgId, input.userId);
}

export async function getGitHubUserLinkByUserId(db: D1DatabaseLike, orgId: string, userId: string) {
  const row = await db
    .prepare("SELECT * FROM github_user_links WHERE org_id = ? AND user_id = ?")
    .bind(orgId, userId)
    .first<GitHubUserLinkRow>();
  return row ? mapGitHubUserLink(row) : null;
}

export async function getGitHubUserLinkByLogin(db: D1DatabaseLike, orgId: string, githubLogin: string) {
  const row = await db
    .prepare("SELECT * FROM github_user_links WHERE org_id = ? AND github_login = ?")
    .bind(orgId, githubLogin)
    .first<GitHubUserLinkRow>();
  return row ? mapGitHubUserLink(row) : null;
}

export async function listGitHubUserLinks(db: D1DatabaseLike, orgId: string): Promise<GitHubUserLinkRef[]> {
  const { results } = await db
    .prepare("SELECT * FROM github_user_links WHERE org_id = ? ORDER BY github_login ASC")
    .bind(orgId)
    .all<GitHubUserLinkRow>();
  return results.map(mapGitHubUserLink);
}

export async function deleteGitHubUserLink(db: D1DatabaseLike, orgId: string, userId: string) {
  await db
    .prepare("DELETE FROM github_user_links WHERE org_id = ? AND user_id = ?")
    .bind(orgId, userId)
    .run();
}

export async function upsertGitHubPullRequest(db: D1DatabaseLike, input: UpsertGitHubPullRequestInput) {
  await db
    .prepare(
      `INSERT INTO github_pull_requests (
         id, org_id, repo_id, github_pr_id, number, title, author_login, state,
         draft, is_fork, base_ref, base_sha, head_ref, head_sha, head_repo_full_name,
         html_url, additions, deletions, changed_files, last_synced_at, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         repo_id = excluded.repo_id,
         github_pr_id = excluded.github_pr_id,
         title = excluded.title,
         author_login = COALESCE(excluded.author_login, github_pull_requests.author_login),
         state = excluded.state,
         draft = excluded.draft,
         is_fork = excluded.is_fork,
         base_ref = excluded.base_ref,
         base_sha = excluded.base_sha,
         head_ref = excluded.head_ref,
         head_sha = excluded.head_sha,
         head_repo_full_name = COALESCE(excluded.head_repo_full_name, github_pull_requests.head_repo_full_name),
         html_url = COALESCE(excluded.html_url, github_pull_requests.html_url),
         additions = COALESCE(excluded.additions, github_pull_requests.additions),
         deletions = COALESCE(excluded.deletions, github_pull_requests.deletions),
         changed_files = COALESCE(excluded.changed_files, github_pull_requests.changed_files),
         last_synced_at = excluded.last_synced_at,
         updated_at = excluded.updated_at`,
    )
    .bind(
      input.id,
      input.orgId,
      input.repoId,
      input.githubPrId,
      input.number,
      input.title,
      input.authorLogin ?? null,
      input.state,
      input.draft ? 1 : 0,
      input.isFork ? 1 : 0,
      input.baseRef,
      input.baseSha,
      input.headRef,
      input.headSha,
      input.headRepoFullName ?? null,
      input.htmlUrl ?? null,
      input.additions ?? null,
      input.deletions ?? null,
      input.changedFiles ?? null,
      input.now,
      input.now,
      input.now,
    )
    .run();

  return getGitHubPullRequestByNumber(db, input.orgId, input.repoId, input.number);
}

export async function getGitHubPullRequest(db: D1DatabaseLike, orgId: string, prId: string) {
  const row = await db
    .prepare("SELECT * FROM github_pull_requests WHERE org_id = ? AND id = ?")
    .bind(orgId, prId)
    .first<GitHubPullRequestRow>();
  return row ? mapGitHubPullRequest(row) : null;
}

export async function getGitHubPullRequestByNumber(
  db: D1DatabaseLike,
  orgId: string,
  repoId: string,
  number: number,
) {
  const row = await db
    .prepare("SELECT * FROM github_pull_requests WHERE org_id = ? AND repo_id = ? AND number = ?")
    .bind(orgId, repoId, number)
    .first<GitHubPullRequestRow>();
  return row ? mapGitHubPullRequest(row) : null;
}

export async function updateGitHubPullRequestStatus(
  db: D1DatabaseLike,
  orgId: string,
  prId: string,
  status: GitHubPrStatus,
  now: string,
) {
  await db
    .prepare("UPDATE github_pull_requests SET status = ?, updated_at = ? WHERE org_id = ? AND id = ?")
    .bind(status, now, orgId, prId)
    .run();
  return getGitHubPullRequest(db, orgId, prId);
}

export async function updateGitHubPullRequestHeadSha(
  db: D1DatabaseLike,
  orgId: string,
  prId: string,
  headSha: string,
  now: string,
) {
  await db
    .prepare(
      `UPDATE github_pull_requests
       SET head_sha = ?, last_synced_at = ?, updated_at = ?
       WHERE org_id = ? AND id = ?`,
    )
    .bind(headSha, now, now, orgId, prId)
    .run();
  return getGitHubPullRequest(db, orgId, prId);
}

export async function listGitHubPullRequests(
  db: D1DatabaseLike,
  orgId: string,
  options: { status?: GitHubPrStatus; repoId?: string; limit?: number } = {},
): Promise<GitHubPullRequestRef[]> {
  const where: string[] = ["org_id = ?"];
  const binds: unknown[] = [orgId];

  if (options.status) {
    where.push("status = ?");
    binds.push(options.status);
  }
  if (options.repoId) {
    where.push("repo_id = ?");
    binds.push(options.repoId);
  }

  const limit = options.limit ?? 50;
  binds.push(limit);

  const { results } = await db
    .prepare(
      `SELECT * FROM github_pull_requests WHERE ${where.join(" AND ")} ORDER BY updated_at DESC LIMIT ?`,
    )
    .bind(...binds)
    .all<GitHubPullRequestRow>();

  return results.map(mapGitHubPullRequest);
}

export async function upsertGitHubReviewSubject(db: D1DatabaseLike, input: UpsertGitHubReviewSubjectInput) {
  await db
    .prepare(
      `INSERT INTO github_pr_review_subjects (
         id, org_id, pr_id, github_login, user_id, subject_type, state, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(org_id, pr_id, github_login, subject_type) DO UPDATE SET
         user_id = COALESCE(excluded.user_id, github_pr_review_subjects.user_id),
         state = excluded.state,
         updated_at = excluded.updated_at`,
    )
    .bind(
      input.id,
      input.orgId,
      input.prId,
      input.githubLogin,
      input.userId ?? null,
      input.subjectType,
      input.state,
      input.now,
      input.now,
    )
    .run();
}

export async function markGitHubReviewSubjectsRemoved(
  db: D1DatabaseLike,
  orgId: string,
  prId: string,
  subjectType: GitHubReviewSubjectType,
  keepLogins: string[],
  now: string,
) {
  if (keepLogins.length > 0) {
    const placeholders = keepLogins.map(() => "?").join(", ");
    await db
      .prepare(
        `UPDATE github_pr_review_subjects
         SET state = 'removed', updated_at = ?
         WHERE org_id = ? AND pr_id = ? AND subject_type = ?
           AND state = 'active'
           AND github_login NOT IN (${placeholders})`,
      )
      .bind(now, orgId, prId, subjectType, ...keepLogins)
      .run();
    return;
  }

  await db
    .prepare(
      `UPDATE github_pr_review_subjects
       SET state = 'removed', updated_at = ?
       WHERE org_id = ? AND pr_id = ? AND subject_type = ? AND state = 'active'`,
    )
    .bind(now, orgId, prId, subjectType)
    .run();
}

export async function listGitHubReviewSubjects(
  db: D1DatabaseLike,
  orgId: string,
  prId: string,
): Promise<GitHubPrReviewSubjectRef[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM github_pr_review_subjects
       WHERE org_id = ? AND pr_id = ?
       ORDER BY subject_type ASC, github_login ASC`,
    )
    .bind(orgId, prId)
    .all<GitHubPrReviewSubjectRow>();
  return results.map(mapGitHubReviewSubject);
}

export async function listActiveRequestedReviewers(
  db: D1DatabaseLike,
  orgId: string,
  prId: string,
): Promise<GitHubPrReviewSubjectRef[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM github_pr_review_subjects
       WHERE org_id = ? AND pr_id = ? AND subject_type = 'requested_reviewer' AND state = 'active'`,
    )
    .bind(orgId, prId)
    .all<GitHubPrReviewSubjectRow>();
  return results.map(mapGitHubReviewSubject);
}

export async function createPrReviewRun(db: D1DatabaseLike, input: CreatePrReviewRunInput) {
  await db
    .prepare(
      `INSERT INTO pr_review_runs (
         id, org_id, pr_id, runner_id, requested_by_user_id, head_sha, base_sha,
         status, review_mode, diff_object_key, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?)`,
    )
    .bind(
      input.id,
      input.orgId,
      input.prId,
      input.runnerId ?? null,
      input.requestedByUserId ?? null,
      input.headSha,
      input.baseSha,
      input.reviewMode,
      input.diffObjectKey ?? null,
      input.now,
    )
    .run();

  return getPrReviewRun(db, input.orgId, input.id);
}

export async function getPrReviewRun(db: D1DatabaseLike, orgId: string, runId: string) {
  const row = await db
    .prepare("SELECT * FROM pr_review_runs WHERE org_id = ? AND id = ?")
    .bind(orgId, runId)
    .first<PrReviewRunRow>();
  return row ? mapPrReviewRun(row) : null;
}

export async function listPrReviewRuns(db: D1DatabaseLike, orgId: string, prId: string): Promise<PrReviewRunRef[]> {
  const { results } = await db
    .prepare("SELECT * FROM pr_review_runs WHERE org_id = ? AND pr_id = ? ORDER BY created_at DESC")
    .bind(orgId, prId)
    .all<PrReviewRunRow>();
  return results.map(mapPrReviewRun);
}

export async function getLatestPrReviewRun(db: D1DatabaseLike, orgId: string, prId: string): Promise<PrReviewRunRef | undefined> {
  const row = await db
    .prepare(
      `SELECT * FROM pr_review_runs
       WHERE org_id = ? AND pr_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .bind(orgId, prId)
    .first<PrReviewRunRow>();
  return row ? mapPrReviewRun(row) : undefined;
}

export async function updatePrReviewRun(db: D1DatabaseLike, input: UpdatePrReviewRunInput) {
  const sets: string[] = [];
  const binds: unknown[] = [];

  if (input.status !== undefined) {
    sets.push("status = ?");
    binds.push(input.status);
    if (input.status === "running" && input.startedAt) {
      sets.push("started_at = COALESCE(started_at, ?)");
      binds.push(input.startedAt);
    }
    if (input.status === "completed" || input.status === "failed" || input.status === "cancelled") {
      sets.push("completed_at = COALESCE(completed_at, ?)");
      binds.push(input.completedAt ?? new Date().toISOString());
    }
  }
  if (input.fusionRunId !== undefined) {
    sets.push("fusion_run_id = ?");
    binds.push(input.fusionRunId);
  }
  if (input.riskLevel !== undefined) {
    sets.push("risk_level = ?");
    binds.push(input.riskLevel);
  }
  if (input.decision !== undefined) {
    sets.push("decision = ?");
    binds.push(input.decision);
  }
  if (input.summary !== undefined) {
    sets.push("summary = ?");
    binds.push(input.summary);
  }
  if (input.findingsObjectKey !== undefined) {
    sets.push("findings_object_key = ?");
    binds.push(input.findingsObjectKey);
  }
  if (input.transcriptObjectKey !== undefined) {
    sets.push("transcript_object_key = ?");
    binds.push(input.transcriptObjectKey);
  }
  if (input.error !== undefined) {
    sets.push("error = COALESCE(?, error)");
    binds.push(input.error);
  }

  if (sets.length === 0) {
    return getPrReviewRun(db, input.orgId, input.runId);
  }

  binds.push(input.orgId, input.runId);
  await db
    .prepare(`UPDATE pr_review_runs SET ${sets.join(", ")} WHERE org_id = ? AND id = ?`)
    .bind(...binds)
    .run();

  return getPrReviewRun(db, input.orgId, input.runId);
}

export async function createPrReviewComment(db: D1DatabaseLike, input: CreatePrReviewCommentInput) {
  await db
    .prepare(
      `INSERT INTO pr_review_comments (
         id, org_id, review_run_id, pr_id, file_path, side, start_line, line,
         severity, category, body, suggested_change, confidence, evidence, status,
         created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
    )
    .bind(
      input.id,
      input.orgId,
      input.reviewRunId,
      input.prId,
      input.filePath,
      input.side,
      input.startLine ?? null,
      input.line ?? null,
      input.severity,
      input.category,
      input.body,
      input.suggestedChange ?? null,
      input.confidence ?? null,
      input.evidence ?? null,
      input.now,
      input.now,
    )
    .run();

  return getPrReviewComment(db, input.orgId, input.id);
}

export async function getPrReviewComment(db: D1DatabaseLike, orgId: string, commentId: string) {
  const row = await db
    .prepare("SELECT * FROM pr_review_comments WHERE org_id = ? AND id = ?")
    .bind(orgId, commentId)
    .first<PrReviewCommentRow>();
  return row ? mapPrReviewComment(row) : null;
}

export async function listPrReviewComments(db: D1DatabaseLike, orgId: string, prId: string): Promise<PrReviewCommentRef[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM pr_review_comments
       WHERE org_id = ? AND pr_id = ?
       ORDER BY file_path ASC, line ASC NULLS LAST, created_at ASC`,
    )
    .bind(orgId, prId)
    .all<PrReviewCommentRow>();
  return results.map(mapPrReviewComment);
}

export async function listPrReviewCommentsByRun(
  db: D1DatabaseLike,
  orgId: string,
  runId: string,
): Promise<PrReviewCommentRef[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM pr_review_comments
       WHERE org_id = ? AND review_run_id = ?
       ORDER BY file_path ASC, line ASC NULLS LAST, created_at ASC`,
    )
    .bind(orgId, runId)
    .all<PrReviewCommentRow>();
  return results.map(mapPrReviewComment);
}

export async function updatePrReviewComment(db: D1DatabaseLike, input: UpdatePrReviewCommentInput) {
  const sets: string[] = ["updated_at = ?"];
  const binds: unknown[] = [input.now];

  if (input.body !== undefined) {
    sets.push("body = ?");
    binds.push(input.body);
  }
  if (input.suggestedChange !== undefined) {
    sets.push("suggested_change = ?");
    binds.push(input.suggestedChange);
  }
  if (input.severity !== undefined) {
    sets.push("severity = ?");
    binds.push(input.severity);
  }
  if (input.category !== undefined) {
    sets.push("category = ?");
    binds.push(input.category);
  }
  if (input.startLine !== undefined) {
    sets.push("start_line = ?");
    binds.push(input.startLine);
  }
  if (input.line !== undefined) {
    sets.push("line = ?");
    binds.push(input.line);
  }
  if (input.side !== undefined) {
    sets.push("side = ?");
    binds.push(input.side);
  }
  if (input.status !== undefined) {
    sets.push("status = ?");
    binds.push(input.status);
    if (input.status === "published") {
      sets.push("published_at = COALESCE(published_at, ?)");
      binds.push(input.now);
    }
  }
  if (input.editedByUserId !== undefined) {
    sets.push("edited_by_user_id = ?");
    binds.push(input.editedByUserId);
  }
  if (input.githubCommentId !== undefined) {
    sets.push("github_comment_id = ?");
    binds.push(input.githubCommentId);
  }

  binds.push(input.orgId, input.commentId);
  await db
    .prepare(`UPDATE pr_review_comments SET ${sets.join(", ")} WHERE org_id = ? AND id = ?`)
    .bind(...binds)
    .run();

  return getPrReviewComment(db, input.orgId, input.commentId);
}

export async function markPrReviewCommentsOutdatedForRun(
  db: D1DatabaseLike,
  orgId: string,
  runId: string,
  now: string,
) {
  await db
    .prepare(
      `UPDATE pr_review_comments
       SET status = 'outdated', updated_at = ?
       WHERE org_id = ? AND review_run_id = ? AND status IN ('draft', 'edited', 'approved')`,
    )
    .bind(now, orgId, runId)
    .run();
}

export async function createGitHubWebhookEvent(db: D1DatabaseLike, input: CreateGitHubWebhookEventInput) {
  await db
    .prepare(
      `INSERT OR IGNORE INTO github_webhook_events (
         id, org_id, delivery_id, event_name, action, installation_id, repo_id, pr_id,
         payload_object_key, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.id,
      input.orgId ?? null,
      input.deliveryId,
      input.eventName,
      input.action ?? null,
      input.installationId ?? null,
      input.repoId ?? null,
      input.prId ?? null,
      input.payloadObjectKey ?? null,
      input.now,
    )
    .run();

  const row = await db
    .prepare("SELECT * FROM github_webhook_events WHERE delivery_id = ?")
    .bind(input.deliveryId)
    .first<GitHubWebhookEventRow>();

  return row ? mapGitHubWebhookEvent(row) : null;
}

export async function getGitHubWebhookEventByDelivery(db: D1DatabaseLike, deliveryId: string) {
  const row = await db
    .prepare("SELECT * FROM github_webhook_events WHERE delivery_id = ?")
    .bind(deliveryId)
    .first<GitHubWebhookEventRow>();
  return row ? mapGitHubWebhookEvent(row) : null;
}

export async function completeGitHubWebhookEvent(db: D1DatabaseLike, input: CompleteGitHubWebhookEventInput) {
  await db
    .prepare(
      `UPDATE github_webhook_events
       SET processed_at = ?, error = COALESCE(?, error), repo_id = COALESCE(?, repo_id), pr_id = COALESCE(?, pr_id)
       WHERE id = ?`,
    )
    .bind(input.processedAt, input.error ?? null, input.repoId ?? null, input.prId ?? null, input.id)
    .run();
}

export async function getPrReviewDetail(
  db: D1DatabaseLike,
  orgId: string,
  prId: string,
): Promise<GitHubPrReviewDetail | null> {
  const pr = await getGitHubPullRequest(db, orgId, prId);
  if (!pr) return null;

  const [repo, subjects, reviewRuns, comments] = await Promise.all([
    getGitHubRepository(db, orgId, pr.repoId),
    listGitHubReviewSubjects(db, orgId, prId),
    listPrReviewRuns(db, orgId, prId),
    listPrReviewComments(db, orgId, prId),
  ]);

  if (!repo) return null;

  return {
    ...pr,
    repo,
    subjects,
    reviewRuns,
    comments,
  };
}

export async function getPrReviewQueue(
  db: D1DatabaseLike,
  orgId: string,
  options: { status?: GitHubPrStatus; repoId?: string; limit?: number } = {},
): Promise<GitHubPrReviewQueueItem[]> {
  const prs = await listGitHubPullRequests(db, orgId, options);
  if (prs.length === 0) return [];

  const repoIds = [...new Set(prs.map((pr) => pr.repoId))];
  const repos = await Promise.all(repoIds.map((repoId) => getGitHubRepository(db, orgId, repoId)));
  const repoById = new Map(repos.filter(Boolean).map((repo) => [repo!.id, repo!]));

  const items = await Promise.all(
    prs.map(async (pr) => {
      const repo = repoById.get(pr.repoId);
      const subjects = await listActiveRequestedReviewers(db, orgId, pr.id);
      const lastReviewRun = await getLatestPrReviewRun(db, orgId, pr.id);
      const reviewSubject = subjects[0]?.githubLogin;

      return {
        ...pr,
        repoFullName: repo?.fullName ?? "unknown",
        repoOwner: repo?.owner ?? "unknown",
        reviewSubject,
        lastReviewRun,
      } satisfies GitHubPrReviewQueueItem;
    }),
  );

  return items;
}

function mapGitHubInstallation(row: GitHubInstallationRow): GitHubInstallationRef {
  return {
    id: row.id,
    orgId: row.org_id,
    installationId: row.installation_id,
    accountLogin: row.account_login,
    accountType: row.account_type as GitHubAccountType,
    targetType: optional(row.target_type),
    permissions: parseJson<Record<string, string>>(row.permissions_json, {}),
    repositorySelection: optional(row.repository_selection as GitHubRepositorySelection | undefined),
    suspendedAt: optional(row.suspended_at),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapGitHubRepository(row: GitHubRepositoryRow): GitHubRepositoryRef {
  return {
    id: row.id,
    orgId: row.org_id,
    installationId: row.installation_id,
    githubRepoId: row.github_repo_id,
    owner: row.owner,
    name: row.name,
    fullName: row.full_name,
    private: row.private === 1,
    defaultBranch: optional(row.default_branch),
    htmlUrl: optional(row.html_url),
    workspaceId: optional(row.workspace_id),
    defaultRunnerId: optional(row.default_runner_id),
    autoReviewEnabled: row.auto_review_enabled === 1,
    autoReviewTrigger: row.auto_review_trigger as AutoReviewTrigger,
    autoPublishEnabled: row.auto_publish_enabled === 1,
    permissionProfile: row.permission_profile as PermissionProfile,
    runTests: row.run_tests === 1,
    maxComments: row.max_comments,
    ignoredPaths: parseJson<string[]>(row.ignored_paths_json, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapGitHubUserLink(row: GitHubUserLinkRow): GitHubUserLinkRef {
  return {
    id: row.id,
    orgId: row.org_id,
    userId: row.user_id,
    githubLogin: row.github_login,
    githubUserId: row.github_user_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapGitHubPullRequest(row: GitHubPullRequestRow): GitHubPullRequestRef {
  return {
    id: row.id,
    orgId: row.org_id,
    repoId: row.repo_id,
    githubPrId: row.github_pr_id,
    number: row.number,
    title: row.title,
    authorLogin: optional(row.author_login),
    state: row.state,
    draft: row.draft === 1,
    isFork: row.is_fork === 1,
    baseRef: row.base_ref,
    baseSha: row.base_sha,
    headRef: row.head_ref,
    headSha: row.head_sha,
    headRepoFullName: optional(row.head_repo_full_name),
    htmlUrl: optional(row.html_url),
    status: row.status as GitHubPrStatus,
    additions: row.additions ?? undefined,
    deletions: row.deletions ?? undefined,
    changedFiles: row.changed_files ?? undefined,
    lastSyncedAt: optional(row.last_synced_at),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: optional(row.closed_at),
  };
}

function mapGitHubReviewSubject(row: GitHubPrReviewSubjectRow): GitHubPrReviewSubjectRef {
  return {
    id: row.id,
    orgId: row.org_id,
    prId: row.pr_id,
    githubLogin: row.github_login,
    userId: optional(row.user_id),
    subjectType: row.subject_type as GitHubReviewSubjectType,
    state: row.state as GitHubReviewSubjectState,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPrReviewRun(row: PrReviewRunRow): PrReviewRunRef {
  return {
    id: row.id,
    orgId: row.org_id,
    prId: row.pr_id,
    fusionRunId: optional(row.fusion_run_id),
    runnerId: optional(row.runner_id),
    requestedByUserId: optional(row.requested_by_user_id),
    headSha: row.head_sha,
    baseSha: row.base_sha,
    status: row.status as PrReviewRunStatus,
    reviewMode: row.review_mode as PrReviewMode,
    riskLevel: optional(row.risk_level as PrReviewRiskLevel | undefined),
    decision: optional(row.decision as PrReviewDecision | undefined),
    summary: optional(row.summary),
    diffObjectKey: optional(row.diff_object_key),
    findingsObjectKey: optional(row.findings_object_key),
    transcriptObjectKey: optional(row.transcript_object_key),
    error: optional(row.error),
    createdAt: row.created_at,
    startedAt: optional(row.started_at),
    completedAt: optional(row.completed_at),
  };
}

function mapPrReviewComment(row: PrReviewCommentRow): PrReviewCommentRef {
  return {
    id: row.id,
    orgId: row.org_id,
    reviewRunId: row.review_run_id,
    prId: row.pr_id,
    filePath: row.file_path,
    side: row.side as PrReviewCommentRef["side"],
    startLine: row.start_line ?? undefined,
    line: row.line ?? undefined,
    severity: row.severity as PrReviewCommentRef["severity"],
    category: row.category as PrReviewCommentRef["category"],
    body: row.body,
    suggestedChange: optional(row.suggested_change),
    confidence: row.confidence ?? undefined,
    evidence: optional(row.evidence),
    status: row.status as PrReviewCommentStatus,
    githubCommentId: row.github_comment_id ?? undefined,
    editedByUserId: optional(row.edited_by_user_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: optional(row.published_at),
  };
}

function mapGitHubWebhookEvent(row: GitHubWebhookEventRow): GitHubWebhookEventRef {
  return {
    id: row.id,
    orgId: optional(row.org_id),
    deliveryId: row.delivery_id,
    eventName: row.event_name,
    action: optional(row.action),
    installationId: row.installation_id ?? undefined,
    repoId: optional(row.repo_id),
    prId: optional(row.pr_id),
    payloadObjectKey: optional(row.payload_object_key),
    processedAt: optional(row.processed_at),
    error: optional(row.error),
    createdAt: row.created_at,
  };
}

function parseJson<T>(value: Nullable<string>, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function optional<T extends string>(value: Nullable<T>) {
  return value ?? undefined;
}