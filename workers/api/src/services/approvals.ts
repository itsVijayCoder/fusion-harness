import { createAuditEvent, updateFusionRunStatus } from "@openfusion/db";
import { formatEntityId, type ApprovalRequest } from "@openfusion/shared";
import type { Env } from "../env";
import type { AccessIdentity } from "./auth";
import { notifyFusionRunObject } from "./runs";

export async function recordApproval(env: Env, principal: AccessIdentity, runId: string, approval: ApprovalRequest) {
  const now = new Date().toISOString();
  const status = approval.action === "grant" ? "running" : "failed";
  const eventType = approval.action === "grant" ? "approval.granted" : "approval.denied";

  await updateFusionRunStatus(
    env.DB,
    principal.orgId,
    runId,
    status,
    now,
    approval.action === "deny" ? approval.reason ?? "Approval denied" : undefined,
  );
  await createAuditEvent(env.DB, {
    id: formatEntityId("audit", crypto.randomUUID()),
    orgId: principal.orgId,
    userId: principal.userId,
    runId,
    eventType,
    severity: approval.action === "grant" ? "info" : "warning",
    metadata: { reason: approval.reason },
    createdAt: now,
  });
  await notifyFusionRunObject(env, runId, "/runner-event", {
    type: eventType,
    runId,
    timestamp: now,
    data: { reason: approval.reason },
  });

  return { runId, status, recordedAt: now };
}
