import type { Env } from "../env";
import type { ClaimedRunnerJob } from "@openfusion/shared";

type ClaimRequest = {
  leaseOwner?: string;
  leaseSeconds?: number;
};

export class RunnerSessionDO {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.endsWith("/heartbeat")) {
      const body = await request.json().catch(() => ({}));
      const now = new Date().toISOString();
      await this.state.storage.put("last_seen_at", now);
      await this.state.storage.put("last_heartbeat", body);
      return Response.json({ status: "online", lastSeenAt: now, environment: this.env.ENVIRONMENT });
    }

    if (url.pathname.endsWith("/dispatch")) {
      const job = (await request.json().catch(() => null)) as ClaimedRunnerJob | null;
      if (!job?.id || !job.runId || !job.runnerId || !job.payload) {
        return Response.json({ error: "Invalid runner job" }, { status: 400 });
      }

      await this.enqueue(job);
      return Response.json({ status: "queued", jobId: job.id }, { status: 202 });
    }

    if (url.pathname.endsWith("/jobs/claim")) {
      const body = (await request.json().catch(() => ({}))) as ClaimRequest;
      const job = await this.claim(body);
      return Response.json({ job });
    }

    const completionMatch = url.pathname.match(/\/jobs\/([^/]+)\/(complete|fail)$/);
    if (completionMatch) {
      const [, jobId, action] = completionMatch;
      const job = await this.finish(jobId, action === "complete" ? "completed" : "failed");
      return Response.json({ status: job ? "accepted" : "missing", jobId }, { status: job ? 202 : 404 });
    }

    const lifecycleMatch = url.pathname.match(/\/jobs\/([^/]+)\/(pause|resume|cancel)$/);
    if (lifecycleMatch) {
      const [, jobId, action] = lifecycleMatch;
      const job = await this.updateJobLifecycle(jobId, action as "pause" | "resume" | "cancel");
      return Response.json({ status: job ? "accepted" : "missing", jobId }, { status: job ? 202 : 404 });
    }

    if (url.pathname.endsWith("/state")) {
      const [lastSeenAt, queueDepth] = await Promise.all([this.state.storage.get<string>("last_seen_at"), this.queueDepth()]);
      return Response.json({
        status: lastSeenAt ? "online" : "offline",
        lastSeenAt,
        queueDepth,
      });
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  }

  private async enqueue(job: ClaimedRunnerJob) {
    const nextIndex = ((await this.state.storage.get<number>("queue_count")) ?? 0) + 1;
    const key = `job:${String(nextIndex).padStart(8, "0")}`;
    await this.state.storage.put(key, {
      ...job,
      status: "queued",
      attempt: job.attempt ?? 0,
      createdAt: job.createdAt || new Date().toISOString(),
    });
    await this.state.storage.put(jobIndexKey(job.id), key);
    await this.state.storage.put("queue_count", nextIndex);
  }

  private async claim(request: ClaimRequest) {
    const now = new Date();
    const leaseSeconds = clampLeaseSeconds(request.leaseSeconds);
    const leaseExpiresAt = new Date(now.getTime() + leaseSeconds * 1000).toISOString();
    const leaseOwner = request.leaseOwner || `lease_${crypto.randomUUID()}`;
    const jobs = await this.state.storage.list<ClaimedRunnerJob>({ prefix: "job:" });

    for (const [key, job] of jobs) {
      if (!isClaimable(job, now)) {
        continue;
      }

      const claimed: ClaimedRunnerJob = {
        ...job,
        status: "leased",
        attempt: (job.attempt ?? 0) + 1,
        leaseOwner,
        leaseExpiresAt,
        payload: {
          ...job.payload,
          attempt: (job.attempt ?? 0) + 1,
        },
      };
      await this.state.storage.put(key, claimed);
      return claimed;
    }

    return null;
  }

  private async finish(jobId: string, status: "completed" | "failed") {
    const key = await this.state.storage.get<string>(jobIndexKey(jobId));
    if (!key) return null;

    const job = await this.state.storage.get<ClaimedRunnerJob>(key);
    if (!job) return null;

    await this.state.storage.put(key, {
      ...job,
      status,
      completedAt: new Date().toISOString(),
    });
    await this.state.storage.delete(jobIndexKey(jobId));
    await this.state.storage.delete(key);
    return job;
  }

  private async updateJobLifecycle(jobId: string, action: "pause" | "resume" | "cancel") {
    const key = await this.state.storage.get<string>(jobIndexKey(jobId));
    if (!key) return null;

    const job = await this.state.storage.get<ClaimedRunnerJob>(key);
    if (!job) return null;

    if (action === "cancel") {
      await this.state.storage.delete(jobIndexKey(jobId));
      await this.state.storage.delete(key);
      return job;
    }

    const status = action === "pause" ? "paused" : "queued";
    await this.state.storage.put(key, {
      ...job,
      status,
    });
    return job;
  }

  private async queueDepth() {
    const jobs = await this.state.storage.list<ClaimedRunnerJob>({ prefix: "job:" });
    return jobs.size;
  }
}

function jobIndexKey(jobId: string) {
  return `job_index:${jobId}`;
}

function clampLeaseSeconds(value: number | undefined) {
  if (!value || Number.isNaN(value)) return 120;
  return Math.min(Math.max(Math.trunc(value), 30), 900);
}

function isClaimable(job: ClaimedRunnerJob, now: Date) {
  if (job.status === "queued") return true;
  if (job.status !== "leased" || !job.leaseExpiresAt) return false;
  return new Date(job.leaseExpiresAt).getTime() <= now.getTime();
}
