import { PageHeader, Section, StatusPill } from "@/components/product-ui";

const roles = [
  ["owner", "Full policy and runner administration"],
  ["admin", "Team settings, model policy, runner management"],
  ["developer", "Create runs and approve own workspace tasks"],
  ["viewer", "Read traces, artifacts, and audit history"],
] as const;

const retention = [
  ["Prompt artifacts", "R2 object with D1 index"],
  ["Panel outputs", "R2 object with panel metadata"],
  ["Audit events", "D1 index for queryable history"],
  ["Raw secrets", "Never synced by default"],
] as const;

export default function TeamSettingsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="Team Settings" description="Roles, access boundaries, retention policy, and runner administration defaults." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Roles">
          <div className="divide-y divide-border rounded-lg border border-border">
            {roles.map(([role, description]) => (
              <div key={role} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <StatusPill value={role} />
                  <p className="mt-2 text-sm text-muted-foreground">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Retention">
          <div className="divide-y divide-border rounded-lg border border-border">
            {retention.map(([item, description]) => (
              <div key={item} className="p-4">
                <p className="font-medium">{item}</p>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
