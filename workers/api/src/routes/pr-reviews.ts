import {
  createAuditEvent,
  getGitHubPullRequest,
  getGitHubRepository,
  getPrReviewDetail,
  getPrReviewQueue,
  listGitHubPullRequests,
  updateGitHubPullRequestStatus,
} from "@fusion-harness/db";
import {
  formatEntityId,
  gitHubPrStatusSchema,
  prReviewQueueQuerySchema,
} from "@fusion-harness/shared";
import { Hono } from "hono";
import type { AppBindings } from "../env";
import { requireAccessIdentity } from "../services/auth";
import { syncPullRequestsForRepository } from "../services/github-sync";

export const prReviewRoutes = new Hono<AppBindings>()
  .get("/", async (c) => {
    const principal = requireAccessIdentity(c.req.raw.headers);
    const query = prReviewQueueQuerySchema.parse({
      ...c.req.query(),
      limit: c.req.query("limit") ?? 50,
    });

    const items = await getPrReviewQueue(c.env.DB, principal.orgId, {
      status: query.status,
      repoId: query.repoId,
      limit: query.limit,
    });

    return c.json({ data: items });
  })
  .get("/:prId", async (c) => {
    const principal = requireAccessIdentity(c.req.raw.headers);
    const detail = await getPrReviewDetail(c.env.DB, principal.orgId, c.req.param("prId"));

    if (!detail) {
      return c.json({ error: "Pull request not found" }, 404);
    }

    return c.json(detail);
  })
  .post("/:prId/sync", async (c) => {
    const principal = requireAccessIdentity(c.req.raw.headers);
    const prId = c.req.param("prId");

    const pr = await getGitHubPullRequest(c.env.DB, principal.orgId, prId);
    if (!pr) {
      return c.json({ error: "Pull request not found" }, 404);
    }

    const repo = await getGitHubRepository(c.env.DB, principal.orgId, pr.repoId);
    if (!repo) {
      return c.json({ error: "Repository not found" }, 404);
    }

    const count = await syncPullRequestsForRepository(c.env, principal.orgId, repo);

    await createAuditEvent(c.env.DB, {
      id: formatEntityId("audit", crypto.randomUUID()),
      orgId: principal.orgId,
      userId: principal.userId,
      eventType: "github.pr_synced",
      metadata: { prId, repoFullName: repo.fullName, prNumber: pr.number, syncedCount: count },
      createdAt: new Date().toISOString(),
    });

    return c.json({ status: "synced", pullRequests: count }, 202);
  })
  .post("/:prId/mark-reviewed", async (c) => {
    const principal = requireAccessIdentity(c.req.raw.headers);
    const prId = c.req.param("prId");
    const now = new Date().toISOString();

    const pr = await getGitHubPullRequest(c.env.DB, principal.orgId, prId);
    if (!pr) {
      return c.json({ error: "Pull request not found" }, 404);
    }

    const updated = await updateGitHubPullRequestStatus(c.env.DB, principal.orgId, prId, "reviewed", now);

    await createAuditEvent(c.env.DB, {
      id: formatEntityId("audit", crypto.randomUUID()),
      orgId: principal.orgId,
      userId: principal.userId,
      eventType: "github.pr_marked_reviewed",
      metadata: { prId, prNumber: pr.number, headSha: pr.headSha },
      createdAt: now,
    });

    return c.json(updated);
  })
  .post("/:prId/ignore", async (c) => {
    const principal = requireAccessIdentity(c.req.raw.headers);
    const prId = c.req.param("prId");
    const now = new Date().toISOString();

    const pr = await getGitHubPullRequest(c.env.DB, principal.orgId, prId);
    if (!pr) {
      return c.json({ error: "Pull request not found" }, 404);
    }

    const updated = await updateGitHubPullRequestStatus(c.env.DB, principal.orgId, prId, "ignored", now);

    await createAuditEvent(c.env.DB, {
      id: formatEntityId("audit", crypto.randomUUID()),
      orgId: principal.orgId,
      userId: principal.userId,
      eventType: "github.pr_ignored",
      metadata: { prId, prNumber: pr.number },
      createdAt: now,
    });

    return c.json(updated);
  })
  .post("/:prId/start", async (c) => {
    return c.json({ error: "PR review execution is not available in this phase" }, 501);
  })
  .get("/:prId/comments", async (c) => {
    return c.json({ error: "Comment management is not available in this phase" }, 501);
  })
  .patch("/:prId/comments/:commentId", async (c) => {
    return c.json({ error: "Comment editing is not available in this phase" }, 501);
  })
  .post("/:prId/publish", async (c) => {
    return c.json({ error: "Publishing is not available in this phase" }, 501);
  })
  .get("/statuses/values", async (c) => {
    return c.json({
      data: gitHubPrStatusSchema.options,
    });
  });