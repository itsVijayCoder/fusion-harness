import type { RunnerRef } from "@fusion-harness/shared";
import { DataNotice, EmptyState, PageHeader, Section, StatusPill } from "@/components/product-ui";
import { apiGet } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type RunnerResponse = { data: RunnerRef[] };

export default async function RunnersPage() {
  const runners = await apiGet<RunnerResponse>("/api/runners", { data: [] });

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="Runners" description="Registered execution planes, installed tools, executor capability, and heartbeat state." />
      <DataNotice source={runners.source} error={runners.error} />
      <Section title="Runner Inventory">
        {runners.data.data.length ? (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Runner</th>
                  <th className="px-4 py-3 font-medium">Host</th>
                  <th className="px-4 py-3 font-medium">Tools</th>
                  <th className="px-4 py-3 font-medium">Executors</th>
                  <th className="px-4 py-3 font-medium">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {runners.data.data.map((runner) => (
                  <tr key={runner.id}>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{runner.name}</span>
                        <StatusPill value={runner.status} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {runner.os} / {runner.arch}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {runner.tools.map((tool) => (
                          <StatusPill key={tool.id ?? tool.tool} value={`${tool.tool}:${tool.status}`} />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{runner.capabilities.executors.join(", ") || "host"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDateTime(runner.lastSeenAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No runners registered" description="Run `fusion-runner serve --once` from a trusted workspace host to register local capabilities." />
        )}
      </Section>
    </div>
  );
}
