import { Hono } from "hono";
import type { AppBindings } from "../env";
import { verifyGitHubWebhookSignature } from "../services/github-webhook";
import { processGitHubWebhook } from "../services/github-webhook-processor";

export const githubWebhookRoutes = new Hono<AppBindings>().post("/webhook", async (c) => {
  const signature = c.req.header("x-hub-signature-256");
  const eventName = c.req.header("x-github-event") ?? "";
  const deliveryId = c.req.header("x-github-delivery") ?? "";

  if (!eventName || !deliveryId) {
    return c.json({ error: "Missing required GitHub webhook headers" }, 400);
  }

  const rawBody = await c.req.text();

  const valid = await verifyGitHubWebhookSignature(
    c.env,
    new TextEncoder().encode(rawBody).buffer,
    signature ?? null,
  );

  if (!valid) {
    return c.json({ error: "Invalid webhook signature" }, 401);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return c.json({ error: "Invalid JSON payload" }, 400);
  }

  const result = await processGitHubWebhook(c.env, deliveryId, eventName, payload as never, rawBody);

  if (result.error) {
    return c.json({ status: "error", ...result }, 202);
  }

  return c.json({ status: "ok", ...result }, 202);
});