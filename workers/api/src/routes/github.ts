import {
  createAuditEvent,
  createGitHubUserLink,
  deleteGitHubUserLink,
  getGitHubRepository,
  listGitHubInstallations,
  listGitHubRepositories,
  listGitHubUserLinks,
  updateGitHubRepositorySettings,
} from "@fusion-harness/db";
import {
  formatEntityId,
  githubRepoLinkWorkspaceSchema,
  githubRepoSettingsUpdateSchema,
  githubUserLinkCreateSchema,
} from "@fusion-harness/shared";
import { Hono } from "hono";
import type { AppBindings } from "../env";
import { GitHubAppAuth, GitHubAppConfigError } from "../services/github-app";
import { requireAccessIdentity } from "../services/auth";
import { syncAll } from "../services/github-sync";

export const githubRoutes = new Hono<AppBindings>()
  .get("/status", async (c) => {
    const configured = Boolean(c.env.GITHUB_APP_ID && c.env.GITHUB_APP_PRIVATE_KEY);
    if (!configured) {
      return c.json({
        configured: false,
        appId: "",
        appSlug: "",
        appName: "",
        htmlUrl: "",
        remediation:
          "Set GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, and GITHUB_WEBHOOK_SECRET as Worker secrets. See Docs/GITHUB_APP_SETUP.md",
      });
    }

    try {
      const auth = new GitHubAppAuth(c.env);
      const details = await auth.getAppDetails();
      return c.json({
        configured: true,
        appId: c.env.GITHUB_APP_ID,
        appSlug: details.slug,
        appName: details.name,
        htmlUrl: details.htmlUrl,
      });
    } catch (error) {
      const isConfigError = error instanceof GitHubAppConfigError;
      return c.json({
        configured: true,
        appId: c.env.GITHUB_APP_ID,
        appSlug: c.env.GITHUB_APP_SLUG ?? "",
        appName: "",
        htmlUrl: c.env.GITHUB_APP_SLUG ? `https://github.com/apps/${c.env.GITHUB_APP_SLUG}` : "",
        error: error instanceof Error ? error.message : "GitHub App lookup failed",
        remediation: isConfigError ? error.remediation : undefined,
      });
    }
  })
  .get("/health", async (c) => {
    const report: GitHubHealthReport = {
      appIdConfigured: Boolean(c.env.GITHUB_APP_ID),
      privateKeyConfigured: Boolean(c.env.GITHUB_APP_PRIVATE_KEY),
      webhookSecretConfigured: Boolean(c.env.GITHUB_WEBHOOK_SECRET),
      appSlugEnv: c.env.GITHUB_APP_SLUG ?? "",
      keyParseable: false,
      jwtGeneratable: false,
      appReachable: false,
      appSlug: "",
      appName: "",
      installationsReachable: false,
      installationsCount: 0,
      error: null,
      remediation: null,
    };

    try {
      const auth = new GitHubAppAuth(c.env);
      report.keyParseable = true;
      report.jwtGeneratable = true;

      const details = await auth.getAppDetails();
      report.appReachable = true;
      report.appSlug = details.slug;
      report.appName = details.name;

      const installationsResponse = await auth.fetchAsApp("/app/installations?per_page=100");
      if (installationsResponse.ok) {
        report.installationsReachable = true;
        const installations = (await installationsResponse.json()) as unknown[];
        report.installationsCount = installations.length;
      }
    } catch (error) {
      report.error = error instanceof Error ? error.message : String(error);
      if (error instanceof GitHubAppConfigError) {
        report.remediation = error.remediation;
      }
    }

    return c.json(report);
  })
  .get("/installations", async (c) => {
    const principal = await requireAccessIdentity(c.env.DB, c.env, c.req.raw.headers);
    return c.json({ data: await listGitHubInstallations(c.env.DB, principal.orgId) });
  })
  .get("/repositories", async (c) => {
    const principal = await requireAccessIdentity(c.env.DB, c.env, c.req.raw.headers);
    return c.json({ data: await listGitHubRepositories(c.env.DB, principal.orgId) });
  })
  .post("/repositories/:repoId/link-workspace", async (c) => {
    const principal = await requireAccessIdentity(c.env.DB, c.env, c.req.raw.headers);
    const repoId = c.req.param("repoId");
    const body = githubRepoLinkWorkspaceSchema.parse(await c.req.json());
    const now = new Date().toISOString();

    const repo = await updateGitHubRepositorySettings(c.env.DB, {
      orgId: principal.orgId,
      repoId,
      workspaceId: body.workspaceId,
      now,
    });

    if (!repo) {
      return c.json({ error: "Repository not found" }, 404);
    }

    await createAuditEvent(c.env.DB, {
      id: formatEntityId("audit", crypto.randomUUID()),
      orgId: principal.orgId,
      userId: principal.userId,
      eventType: "github.repo_linked",
      metadata: { repoId, repoFullName: repo.fullName, workspaceId: body.workspaceId },
      createdAt: now,
    });

    return c.json(repo);
  })
  .patch("/repositories/:repoId/settings", async (c) => {
    const principal = await requireAccessIdentity(c.env.DB, c.env, c.req.raw.headers);
    const repoId = c.req.param("repoId");
    const body = githubRepoSettingsUpdateSchema.parse(await c.req.json());
    const now = new Date().toISOString();

    const repo = await updateGitHubRepositorySettings(c.env.DB, {
      orgId: principal.orgId,
      repoId,
      ...body,
      now,
    });

    if (!repo) {
      return c.json({ error: "Repository not found" }, 404);
    }

    await createAuditEvent(c.env.DB, {
      id: formatEntityId("audit", crypto.randomUUID()),
      orgId: principal.orgId,
      userId: principal.userId,
      eventType: "github.repo_settings_updated",
      metadata: { repoId, repoFullName: repo.fullName, changes: body },
      createdAt: now,
    });

    return c.json(repo);
  })
  .post("/sync", async (c) => {
    const principal = await requireAccessIdentity(c.env.DB, c.env, c.req.raw.headers);
    try {
      const result = await syncAll(c.env, principal.orgId);
      return c.json(result, 202);
    } catch (error) {
      console.error("GitHub sync failed:", error instanceof Error ? error.stack : String(error));
      return c.json({ error: error instanceof Error ? error.message : "Sync failed" }, 500);
    }
  })
  .get("/user-links", async (c) => {
    const principal = await requireAccessIdentity(c.env.DB, c.env, c.req.raw.headers);
    return c.json({ data: await listGitHubUserLinks(c.env.DB, principal.orgId) });
  })
  .post("/user-links", async (c) => {
    const principal = await requireAccessIdentity(c.env.DB, c.env, c.req.raw.headers);
    const body = githubUserLinkCreateSchema.parse(await c.req.json());
    const now = new Date().toISOString();

    const link = await createGitHubUserLink(c.env.DB, {
      id: formatEntityId("gh_link", crypto.randomUUID()),
      orgId: principal.orgId,
      userId: body.userId,
      githubLogin: body.githubLogin,
      githubUserId: body.githubUserId,
      now,
    });

    if (!link) {
      return c.json({ error: "Failed to create user link" }, 500);
    }

    await createAuditEvent(c.env.DB, {
      id: formatEntityId("audit", crypto.randomUUID()),
      orgId: principal.orgId,
      userId: principal.userId,
      eventType: "github.user_link_created",
      metadata: { linkedUserId: body.userId, githubLogin: body.githubLogin },
      createdAt: now,
    });

    return c.json(link, 201);
  })
  .delete("/user-links/:userId", async (c) => {
    const principal = await requireAccessIdentity(c.env.DB, c.env, c.req.raw.headers);
    const userId = c.req.param("userId");
    const now = new Date().toISOString();

    await deleteGitHubUserLink(c.env.DB, principal.orgId, userId);

    await createAuditEvent(c.env.DB, {
      id: formatEntityId("audit", crypto.randomUUID()),
      orgId: principal.orgId,
      userId: principal.userId,
      eventType: "github.user_link_deleted",
      metadata: { linkedUserId: userId },
      createdAt: now,
    });

    return c.json({ status: "deleted" });
  })
  .get("/repositories/:repoId", async (c) => {
    const principal = await requireAccessIdentity(c.env.DB, c.env, c.req.raw.headers);
    const repo = await getGitHubRepository(c.env.DB, principal.orgId, c.req.param("repoId"));
    if (!repo) {
      return c.json({ error: "Repository not found" }, 404);
    }
    return c.json(repo);
  });

type GitHubHealthReport = {
  appIdConfigured: boolean;
  privateKeyConfigured: boolean;
  webhookSecretConfigured: boolean;
  appSlugEnv: string;
  keyParseable: boolean;
  jwtGeneratable: boolean;
  appReachable: boolean;
  appSlug: string;
  appName: string;
  installationsReachable: boolean;
  installationsCount: number;
  error: string | null;
  remediation: string | null;
};
