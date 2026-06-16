import type { PresetConfig } from "@fusion-harness/shared";
import { PageHeader, Section, StatusPill } from "@/components/product-ui";

const presets: PresetConfig[] = [
  {
    id: "same-provider-first",
    name: "Same Provider First",
    description: "Prefer models from the same authenticated provider or subscription.",
    mode: "required",
    providerPolicy: "same_provider_first",
    maxPanelModels: 5,
    timeoutMs: 120000,
    permissionProfile: "readonly",
  },
  {
    id: "opencode-quality",
    name: "OpenCode Quality",
    description: "Use OpenCode as the main harness.",
    mode: "required",
    providerPolicy: "same_provider_first",
    maxPanelModels: 4,
    timeoutMs: 120000,
    adapters: ["opencode"],
    permissionProfile: "workspace_write",
  },
  {
    id: "codex-quality",
    name: "Codex Quality",
    description: "Use Codex models first.",
    mode: "required",
    providerPolicy: "same_provider_first",
    maxPanelModels: 4,
    timeoutMs: 120000,
    adapters: ["codex"],
    permissionProfile: "workspace_write",
  },
  {
    id: "mixed-coding",
    name: "Mixed Coding",
    description: "Use both OpenCode and Codex.",
    mode: "required",
    providerPolicy: "mixed_quality",
    maxPanelModels: 6,
    timeoutMs: 180000,
    adapters: ["opencode", "codex"],
    permissionProfile: "workspace_write",
  },
  {
    id: "fast",
    name: "Fast",
    description: "Faster, lower-latency response.",
    mode: "auto",
    providerPolicy: "mixed_quality",
    maxPanelModels: 2,
    timeoutMs: 45000,
    permissionProfile: "readonly",
  },
  {
    id: "budget",
    name: "Budget",
    description: "Prefer fewer calls and cheaper API-key models.",
    mode: "auto",
    providerPolicy: "mixed_quality",
    maxPanelModels: 2,
    timeoutMs: 120000,
    permissionProfile: "readonly",
  },
];

export default function PresetsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="Presets" description="Team routing defaults for model selection, panel size, timeout, and permission profile." />
      <Section title="Preset Catalog">
        <div className="grid gap-4 lg:grid-cols-2">
          {presets.map((preset) => (
            <article key={preset.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{preset.name}</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{preset.description}</p>
                </div>
                <StatusPill value={preset.mode} />
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Provider Policy</dt>
                  <dd className="font-medium">{preset.providerPolicy}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Max Panel</dt>
                  <dd className="font-medium">{preset.maxPanelModels}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Timeout</dt>
                  <dd className="font-medium">{Math.round(preset.timeoutMs / 1000)}s</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Permission</dt>
                  <dd className="font-medium">{preset.permissionProfile}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </Section>
    </div>
  );
}
