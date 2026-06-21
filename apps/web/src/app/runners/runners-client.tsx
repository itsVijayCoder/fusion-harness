"use client";

import { RiArrowLeftLine } from "@remixicon/react";
import type { ModelRef, RunnerRef, ToolKind, ToolRef } from "@fusion-harness/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ProviderLogo, providerLabel } from "@/components/provider-logo";
import { apiUrl } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RunnerBootstrap } from "./runner-bootstrap";

type RunnerResponse = { data: RunnerRef[] };
type ModelResponse = {
  aliases: Array<{ id: string; owned_by: string }>;
  data: ModelRef[];
};
type LoadState = {
  runners: RunnerResponse;
  models: ModelResponse;
  source: "api" | "fallback" | "loading";
  error?: string;
};

const emptyRunners: RunnerResponse = { data: [] };
const emptyModels: ModelResponse = { aliases: [], data: [] };

const localAgents: Array<{
  id: string;
  name: string;
  tool?: ToolKind;
  adapter?: ModelRef["adapter"];
  description: string;
}> = [
  {
    id: "fusion-runner",
    name: "Fusion Runner",
    description: "Built-in local execution bridge",
  },
  {
    id: "opencode",
    name: "OpenCode",
    tool: "opencode",
    adapter: "opencode",
    description: "Provider/model IDs from OpenCode",
  },
  {
    id: "claude",
    name: "Claude Code",
    adapter: "claude",
    description: "Claude Code or OpenClaude local CLI",
  },
  {
    id: "codex",
    name: "Codex CLI",
    tool: "codex",
    adapter: "codex",
    description: "Codex model IDs passed to codex exec",
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    adapter: "gemini",
    description: "Google Gemini local coding agent",
  },
  {
    id: "cursor-agent",
    name: "Cursor Agent",
    adapter: "cursor-agent",
    description: "Cursor's terminal coding agent",
  },
  {
    id: "qwen",
    name: "Qwen Code",
    adapter: "qwen",
    description: "Qwen local coding agent",
  },
  {
    id: "qoder",
    name: "Qoder CLI",
    adapter: "qoder",
    description: "Qoder's local CLI agent",
  },
  {
    id: "copilot",
    name: "Copilot CLI",
    adapter: "copilot",
    description: "GitHub Copilot terminal agent",
  },
  {
    id: "deepseek",
    name: "DeepSeek TUI",
    adapter: "deepseek",
    description: "DeepSeek local terminal agent",
  },
  {
    id: "kimi",
    name: "Kimi CLI",
    adapter: "kimi",
    description: "Moonshot Kimi local agent",
  },
  {
    id: "hermes",
    name: "Hermes",
    adapter: "hermes",
    description: "Hermes ACP local agent",
  },
  {
    id: "pi",
    name: "Pi",
    adapter: "pi",
    description: "Pi local agent runtime",
  },
  {
    id: "aider",
    name: "Aider",
    adapter: "aider",
    description: "Aider local coding CLI",
  },
  {
    id: "devin",
    name: "Devin",
    adapter: "devin",
    description: "Devin for Terminal",
  },
  {
    id: "grok-build",
    name: "Grok Build",
    adapter: "grok-build",
    description: "xAI Grok Build CLI",
  },
  {
    id: "amp",
    name: "Amp",
    adapter: "amp",
    description: "Amp local coding agent",
  },
  {
    id: "kiro",
    name: "Kiro",
    adapter: "kiro",
    description: "Kiro local coding agent",
  },
  {
    id: "kilo",
    name: "Kilo",
    adapter: "kilo",
    description: "Kilo local coding agent",
  },
  {
    id: "vibe",
    name: "Mistral Vibe",
    adapter: "vibe",
    description: "Mistral Vibe local agent",
  },
  {
    id: "trae-cli",
    name: "Trae CLI",
    adapter: "trae-cli",
    description: "Trae terminal coding agent",
  },
  {
    id: "codebuddy",
    name: "CodeBuddy",
    adapter: "codebuddy",
    description: "CodeBuddy terminal agent",
  },
  {
    id: "reasonix",
    name: "Reasonix",
    adapter: "reasonix",
    description: "Reasonix local coding agent",
  },
  {
    id: "antigravity",
    name: "Antigravity",
    adapter: "antigravity",
    description: "Google Antigravity local agent",
  },
  {
    id: "git",
    name: "Git",
    tool: "git",
    description: "Repository context and patch workflows",
  },
  {
    id: "docker",
    name: "Docker",
    tool: "docker",
    description: "Container executor capability",
  },
];

export function RunnersClient() {
  const [state, setState] = useState<LoadState>({
    runners: emptyRunners,
    models: emptyModels,
    source: "loading",
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [runners, models] = await Promise.all([
          fetchJson<RunnerResponse>("/api/runners"),
          fetchJson<ModelResponse>("/api/models"),
        ]);
        if (!cancelled) {
          setState({ runners, models, source: "api" });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            runners: emptyRunners,
            models: emptyModels,
            source: "fallback",
            error: error instanceof Error ? error.message : "API unavailable",
          });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const { runners, models } = state;
  const detectedCount = localAgents.filter((agent) => isAgentDetected(runners.data, models.data, agent)).length;
  const onlineRunners = runners.data.filter((runner) => runner.status === "online").length;
  const modelCount = models.data.length;

  return (
    <div className="od-workspace">
      <div className="od-container od-stack">
        <header>
          <div className="od-topline">
            <div className="od-title-tab">Local Agents</div>
            <Link className="od-action" href="/chat">
              <RiArrowLeftLine aria-hidden className="size-4" />
              Back to Chat
            </Link>
          </div>
          <p className="od-page-copy">
            Fusion Runner ships with the app. Local agents are detected when their CLI is installed on the host and the runner registers its discovery report.
          </p>
        </header>

        {state.source === "fallback" ? (
          <div className="od-notice">Showing local fallback data{state.error ? `: ${state.error}` : "."}</div>
        ) : null}
        {state.source === "loading" ? (
          <div className="od-notice">Loading signed-in runner inventory...</div>
        ) : null}

        <section className="od-section">
          <div className="od-metric-grid">
            <MetricCard label="Detected Agents" value={detectedCount} detail={`${localAgents.length} known surfaces`} />
            <MetricCard label="Online Runners" value={onlineRunners} detail={`${runners.data.length} registered runners`} />
            <MetricCard label="Models" value={modelCount} detail="discovered across adapters" />
            <MetricCard label="Aliases" value={models.aliases.length} detail="OpenAI-compatible routes" />
          </div>
        </section>

        <RunnerBootstrap hasRunner={runners.data.length > 0} />

        <section className="od-section">
          <div className="od-section-head">
            <h2 className="od-section-title">Detected</h2>
            <span className="od-section-meta">{detectedCount} available</span>
          </div>
          <div className="od-card-grid">
            {localAgents.map((agent) => {
              const tool = findAgentTool(runners.data, agent);
              const detected = isAgentDetected(runners.data, models.data, agent);
              const modelCount = agent.adapter ? models.data.filter((model) => model.adapter === agent.adapter).length : 0;
              const toolStatus = tool?.status ?? (detected ? "detected" : "not detected");

              return (
                <article key={agent.id} className={cn("od-agent-card", detected && "is-detected")}>
                  <div className="od-agent-main">
                    <ProviderLogo id={agent.id} size="lg" />
                    <div className="od-agent-body">
                      <div className="od-card-title truncate">{agent.name}</div>
                      <div className="od-card-description truncate">{agent.description}</div>
                      <div className="od-card-meta">
                        {providerLabel(agent.adapter ?? agent.id)}
                        {modelCount ? ` · ${modelCount} models` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="od-card-actions">
                    <span className={cn("od-pill", detected ? "is-positive" : "is-negative")}>
                      {formatValue(toolStatus)}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="od-section">
          <div className="od-section-head">
            <h2 className="od-section-title">Runner Diagnostics</h2>
            <span className="od-section-meta">{runners.data.length} registered</span>
          </div>
          {runners.data.length ? (
            <div className="od-table-wrap">
              <div className="od-table-scroll">
              <table className="od-table">
                <thead>
                  <tr>
                    <th>Runner</th>
                    <th>Host</th>
                    <th>Tools</th>
                    <th>Executors</th>
                    <th>Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {runners.data.map((runner) => (
                    <tr key={runner.id}>
                      <td>
                        <div className="od-agent-main">
                          <ProviderLogo id="fusion-runner" size="sm" />
                          <div className="od-agent-body">
                            <div className="od-card-title truncate">{runner.name}</div>
                            <span className={cn("od-pill", runner.status === "online" ? "is-positive" : "is-negative")}>
                              {runner.status}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="od-card-meta">
                        {runner.os} / {runner.arch}
                      </td>
                      <td>
                        <div className="od-capability-list">
                          {runner.tools.map((tool) => (
                            <span
                              key={tool.id ?? `${tool.tool}:${tool.path ?? ""}`}
                              className={cn("od-pill", tool.status === "unavailable" || tool.status === "error" ? "is-negative" : "is-positive")}
                            >
                              {toolName(tool)}: {formatValue(tool.status)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="od-card-meta">{runner.capabilities.executors.join(", ") || "host"}</td>
                      <td className="od-card-meta">{formatDateTime(runner.lastSeenAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          ) : (
            <div className="od-empty">
              <strong>No runners registered</strong>
              Use the one-time installer above, then refresh this page after the service starts.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <article className="od-metric-card">
      <div className="od-metric-label">{label}</div>
      <div className="od-metric-value">{value}</div>
      <div className="od-metric-detail">{detail}</div>
    </article>
  );
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(apiUrl(path), {
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `API returned ${response.status}`);
  }

  return (await response.json()) as T;
}

function findAgentTool(runners: RunnerRef[], agent: { id: string; tool?: ToolKind }): ToolRef | undefined {
  return runners
    .flatMap((runner) => runner.tools)
    .find((tool) => {
      if (agent.tool) return tool.tool === agent.tool && tool.status !== "unavailable";
      return tool.tool === "custom" && tool.metadata?.agentId === agent.id && tool.status !== "unavailable";
    });
}

function isAgentDetected(
  runners: RunnerRef[],
  models: ModelRef[],
  agent: { id: string; tool?: ToolKind; adapter?: ModelRef["adapter"] },
) {
  if (agent.id === "fusion-runner") return runners.length > 0;
  if (agent.adapter && models.some((model) => model.adapter === agent.adapter)) return true;
  const tool = findAgentTool(runners, agent);
  return Boolean(tool && tool.status !== "unavailable");
}

function toolName(tool: ToolRef) {
  if (tool.tool !== "custom") return tool.tool;
  return typeof tool.metadata?.displayName === "string" ? tool.metadata.displayName : "custom";
}

function formatValue(value: string) {
  return value.replace(/_/g, " ");
}
