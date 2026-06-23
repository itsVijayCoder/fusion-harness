import type { WorkspaceRef } from "@openfusion/shared";
import { DataNotice, EmptyState, PageHeader, Section, StatusPill } from "@/components/product-ui";
import { apiGet } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type WorkspaceResponse = { data: WorkspaceRef[] };

const permissionProfiles = [
  ["readonly", "Read allowed. File writes, shell, and network denied."],
  ["workspace_write", "Writes inside approved workspaces. Shell and network require approval."],
  ["trusted_internal", "Workspace writes plus allowlisted commands for trusted automation."],
] as const;

export default async function WorkspacesPage() {
  const workspaces = await apiGet<WorkspaceResponse>("/api/workspaces", { data: [] });

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="Workspaces" description="Approved repositories, default runners, and permission profiles for local execution." />
      <DataNotice source={workspaces.source} error={workspaces.error} />
      <Section title="Workspace Inventory">
        {workspaces.data.data.length ? (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Repository</th>
                  <th className="px-4 py-3 font-medium">Permission</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {workspaces.data.data.map((workspace) => (
                  <tr key={workspace.id}>
                    <td className="px-4 py-3 font-medium">{workspace.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{workspace.repoUrl ?? "Local only"}</td>
                    <td className="px-4 py-3">
                      <StatusPill value={workspace.permissionProfile} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDateTime(workspace.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No workspaces configured" description="Approved workspace roots are enforced by the runner until team workspaces are added." />
        )}
      </Section>
      <Section title="Permission Profiles">
        <div className="grid gap-4 md:grid-cols-3">
          {permissionProfiles.map(([profile, description]) => (
            <article key={profile} className="rounded-lg border border-border bg-card p-4">
              <StatusPill value={profile} />
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
            </article>
          ))}
        </div>
      </Section>
    </div>
  );
}
