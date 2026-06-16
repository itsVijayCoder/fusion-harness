import { createAuditEvent, ensurePrincipal, heartbeatRunner, listRunners, registerRunner } from "@fusion-harness/db";
import { formatEntityId, runnerRegistrationRequestSchema } from "@fusion-harness/shared";
import { Hono } from "hono";
import type { AppBindings } from "../env";
import { requireAccessIdentity } from "../services/auth";

export const runnerRoutes = new Hono<AppBindings>()
  .get("/", async (c) => {
    const principal = requireAccessIdentity(c.req.raw.headers);
    return c.json({ data: await listRunners(c.env.DB, principal.orgId) });
  })
  .post("/register", async (c) => {
    const principal = requireAccessIdentity(c.req.raw.headers);
    const payload = runnerRegistrationRequestSchema.parse(await c.req.json());
    const now = new Date().toISOString();
    const runnerId = payload.runnerId ?? formatEntityId("runner", crypto.randomUUID());

    await ensurePrincipal(c.env.DB, {
      orgId: principal.orgId,
      orgName: principal.orgName,
      userId: principal.userId,
      email: principal.email,
      name: principal.name,
      now,
    });

    const runner = await registerRunner(c.env.DB, {
      ...payload,
      runnerId,
      orgId: principal.orgId,
      userId: principal.userId,
      now,
    });

    await createAuditEvent(c.env.DB, {
      id: formatEntityId("audit", crypto.randomUUID()),
      orgId: principal.orgId,
      userId: principal.userId,
      runnerId: runner.id,
      eventType: "runner.registered",
      metadata: {
        toolCount: runner.tools.length,
        modelCount: payload.models?.length ?? 0,
        os: runner.os,
        arch: runner.arch,
      },
      createdAt: now,
    });

    return c.json(runner, 202);
  })
  .post("/:id/heartbeat", async (c) => {
    const principal = requireAccessIdentity(c.req.raw.headers);
    const runner = await heartbeatRunner(c.env.DB, principal.orgId, c.req.param("id"), new Date().toISOString());

    if (!runner) {
      return c.json({ error: "Runner not found" }, 404);
    }

    return c.json(runner);
  });
