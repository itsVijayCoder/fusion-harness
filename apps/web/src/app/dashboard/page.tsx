import type { DashboardSnapshot } from "@openfusion/shared";
import Link from "next/link";
import { DataNotice, EmptyState, Metric, PageHeader, Section, StatusPill } from "@/components/product-ui";
import { apiGet } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const fallbackDashboard: DashboardSnapshot = {
  runs: { total: 0, queued: 0, running: 0, paused: 0, waitingApproval: 0, completed: 0, failed: 0, cancelled: 0 },
  runners: { total: 0, online: 0, offline: 0, disabled: 0 },
  models: { total: 0, verified: 0, cliSession: 0, cloudGateway: 0 },
  artifacts: { total: 0, totalBytes: 0 },
  recentRuns: [],
  recentAuditEvents: [],
};

export default async function DashboardPage() {
  const snapshot = await apiGet<DashboardSnapshot>("/api/dashboard", fallbackDashboard);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="Dashboard" description="Run health, active runners, model availability, and recent audit activity." />
      <DataNotice source={snapshot.source} error={snapshot.error} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Runs" value={snapshot.data.runs.total} detail={`${snapshot.data.runs.running} running, ${snapshot.data.runs.queued} queued, ${snapshot.data.runs.paused} paused`} />
        <Metric label="Runners" value={snapshot.data.runners.total} detail={`${snapshot.data.runners.online} online`} />
        <Metric label="Models" value={snapshot.data.models.total} detail={`${snapshot.data.models.verified} verified`} />
        <Metric label="Artifacts" value={snapshot.data.artifacts.total} detail="Stored in R2 with D1 metadata" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Section title="Recent Runs">
          {snapshot.data.recentRuns.length ? (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Run</th>
                    <th className="px-4 py-3 font-medium">Mode</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {snapshot.data.recentRuns.map((run) => (
                    <tr key={run.id}>
                      <td className="px-4 py-3 font-medium">
                        <Link className="text-primary hover:underline" href={`/runs/${run.id}`}>
                          {run.id}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{run.mode}</td>
                      <td className="px-4 py-3">
                        <StatusPill value={run.status} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDateTime(run.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No runs yet" description="Create a task from the console to start building trace history." />
          )}
        </Section>
        <Section title="Audit Events">
          {snapshot.data.recentAuditEvents.length ? (
            <div className="divide-y divide-border rounded-lg border border-border">
              {snapshot.data.recentAuditEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between gap-4 p-4 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{event.eventType}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(event.createdAt)}</p>
                  </div>
                  <StatusPill value={event.severity} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No audit events" description="Runner registration, approvals, commands, and run state changes will appear here." />
          )}
        </Section>
      </div>
    </div>
  );
}
