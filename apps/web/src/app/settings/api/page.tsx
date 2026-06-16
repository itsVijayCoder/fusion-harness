import { PageHeader, Section, StatusPill } from "@/components/product-ui";
import { apiUrl } from "@/lib/api";

const endpoints = [
  ["GET", "/api/health"],
  ["POST", "/api/fusion/runs"],
  ["GET", "/api/fusion/runs/:id"],
  ["GET", "/api/fusion/runs/:id/events"],
  ["GET", "/v1/models"],
  ["POST", "/v1/chat/completions"],
] as const;

export default function ApiSettingsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="API Settings" description="Native and OpenAI-compatible endpoints for internal clients." />
      <Section title="Base URL">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="break-all font-mono text-sm">{apiUrl("")}</p>
        </div>
      </Section>
      <Section title="Endpoints">
        <div className="divide-y divide-border rounded-lg border border-border">
          {endpoints.map(([method, path]) => (
            <div key={path} className="flex items-center gap-4 p-4 text-sm">
              <StatusPill value={method} />
              <code className="break-all text-muted-foreground">{path}</code>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
