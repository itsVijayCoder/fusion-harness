import { PageHeader, Section } from "@/components/product-ui";

const tools = ["fusion.run", "fusion.get_run", "fusion.list_models", "fusion.list_runners", "fusion.get_artifacts", "fusion.apply_patch", "fusion.cancel_run"];

export default function McpSettingsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="MCP Settings" description="Remote Streamable HTTP endpoint and exposed Fusion Harness tools." />
      <Section title="Endpoint">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="font-mono text-sm">/mcp</p>
        </div>
      </Section>
      <Section title="Tools">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {tools.map((tool) => (
            <div key={tool} className="rounded-lg border border-border bg-card p-4 font-mono text-sm">
              {tool}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
