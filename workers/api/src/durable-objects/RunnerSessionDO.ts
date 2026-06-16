import type { Env } from "../env";

type RunnerJob = {
  id: string;
  runId: string;
  kind: "panel" | "judge" | "final" | "command";
  payload: Record<string, unknown>;
  createdAt: string;
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
      const job = (await request.json().catch(() => null)) as RunnerJob | null;
      if (!job?.id || !job.runId) {
        return Response.json({ error: "Invalid runner job" }, { status: 400 });
      }

      await this.enqueue(job);
      return Response.json({ status: "queued", jobId: job.id }, { status: 202 });
    }

    if (url.pathname.endsWith("/jobs/next")) {
      const job = await this.dequeue();
      return Response.json({ job });
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

  private async enqueue(job: RunnerJob) {
    const nextIndex = ((await this.state.storage.get<number>("queue_count")) ?? 0) + 1;
    await this.state.storage.put(`job:${String(nextIndex).padStart(8, "0")}`, job);
    await this.state.storage.put("queue_count", nextIndex);
  }

  private async dequeue() {
    const jobs = await this.state.storage.list<RunnerJob>({ prefix: "job:", limit: 1 });
    const first = jobs.entries().next();
    if (first.done) return null;

    const [key, job] = first.value;
    await this.state.storage.delete(key);
    return job;
  }

  private async queueDepth() {
    const jobs = await this.state.storage.list<RunnerJob>({ prefix: "job:" });
    return jobs.size;
  }
}
