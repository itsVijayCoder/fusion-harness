"use client";

import {
  RiCodeSSlashLine,
  RiGitBranchLine,
  RiRobot2Line,
  RiStackLine,
  RiTerminalBoxLine,
} from "@remixicon/react";
import type { ModelRef, RunnerRef, ToolKind, ToolRef } from "@fusion-harness/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DataNotice, EmptyState, Section, StatusPill } from "@/components/product-ui";
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
  icon: typeof RiRobot2Line;
}> = [
  {
    id: "fusion-runner",
    name: "Fusion Runner",
    description: "Built-in local execution bridge",
    icon: RiRobot2Line,
  },
  {
    id: "opencode",
    name: "OpenCode",
    tool: "opencode",
    adapter: "opencode",
    description: "Provider/model IDs from OpenCode",
    icon: RiTerminalBoxLine,
  },
  {
    id: "claude",
    name: "Claude Code",
    adapter: "claude",
    description: "Claude Code or OpenClaude local CLI",
    icon: RiTerminalBoxLine,
  },
  {
    id: "codex",
    name: "Codex CLI",
    tool: "codex",
    adapter: "codex",
    description: "Codex model IDs passed to codex exec",
    icon: RiCodeSSlashLine,
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    adapter: "gemini",
    description: "Google Gemini local coding agent",
    icon: RiTerminalBoxLine,
  },
  {
    id: "cursor-agent",
    name: "Cursor Agent",
    adapter: "cursor-agent",
    description: "Cursor's terminal coding agent",
    icon: RiTerminalBoxLine,
  },
  {
    id: "qwen",
    name: "Qwen Code",
    adapter: "qwen",
    description: "Qwen local coding agent",
    icon: RiTerminalBoxLine,
  },
  {
    id: "qoder",
    name: "Qoder CLI",
    adapter: "qoder",
    description: "Qoder's local CLI agent",
    icon: RiTerminalBoxLine,
  },
  {
    id: "copilot",
    name: "Copilot CLI",
    adapter: "copilot",
    description: "GitHub Copilot terminal agent",
    icon: RiTerminalBoxLine,
  },
  {
    id: "deepseek",
    name: "DeepSeek TUI",
    adapter: "deepseek",
    description: "DeepSeek local terminal agent",
    icon: RiTerminalBoxLine,
  },
  {
    id: "kimi",
    name: "Kimi CLI",
    adapter: "kimi",
    description: "Moonshot Kimi local agent",
    icon: RiTerminalBoxLine,
  },
  {
    id: "hermes",
    name: "Hermes",
    adapter: "hermes",
    description: "Hermes ACP local agent",
    icon: RiTerminalBoxLine,
  },
  {
    id: "pi",
    name: "Pi",
    adapter: "pi",
    description: "Pi local agent runtime",
    icon: RiTerminalBoxLine,
  },
  {
    id: "aider",
    name: "Aider",
    adapter: "aider",
    description: "Aider local coding CLI",
    icon: RiTerminalBoxLine,
  },
  {
    id: "devin",
    name: "Devin",
    adapter: "devin",
    description: "Devin for Terminal",
    icon: RiTerminalBoxLine,
  },
  {
    id: "grok-build",
    name: "Grok Build",
    adapter: "grok-build",
    description: "xAI Grok Build CLI",
    icon: RiTerminalBoxLine,
  },
  {
    id: "git",
    name: "Git",
    tool: "git",
    description: "Repository context and patch workflows",
    icon: RiGitBranchLine,
  },
  {
    id: "docker",
    name: "Docker",
    tool: "docker",
    description: "Container executor capability",
    icon: RiStackLine,
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

  return (
    <div className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-7">
        <header className="max-w-5xl">
          <div className="flex items-end justify-between gap-4 border-b border-border">
            <div className="flex h-10 items-center border-b-2 border-primary pr-16 text-sm font-semibold text-foreground">Local Agents</div>
            <Button asChild variant="ghost" size="sm" className="mb-1 text-muted-foreground">
              <Link href="/chat">Back to Chat</Link>
            </Button>
          </div>
          <p className="mt-5 text-sm leading-6 text-muted-foreground">
            Fusion Runner ships with the app. Local agents are detected when their CLI is installed on the host and the runner registers its discovery report.
          </p>
        </header>

        <DataNotice source={state.source === "fallback" ? "fallback" : "api"} error={state.error} />
        {state.source === "loading" ? (
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Loading signed-in runner inventory...
          </div>
        ) : null}

        <RunnerBootstrap hasRunner={runners.data.length > 0} />

        <Section title="Detected">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {localAgents.map((agent) => {
              const tool = findAgentTool(runners.data, agent);
              const detected = agent.id === "fusion-runner" ? runners.data.length > 0 : Boolean(tool && tool.status !== "unavailable");
              const modelCount = agent.adapter ? models.data.filter((model) => model.adapter === agent.adapter).length : 0;
              const Icon = agent.icon;

              return (
                <article key={agent.id} className="flex min-h-[168px] flex-col items-center justify-between rounded-lg border border-border bg-card p-4 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <span className={cn("flex size-12 items-center justify-center rounded-full", detected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                      <Icon aria-hidden className="size-6" />
                    </span>
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">{agent.name}</h2>
                      <p className={cn("mt-1 text-xs font-medium", detected ? "text-muted-foreground" : "text-muted-foreground")}>
                        {detected ? "Detected" : "Not detected"}
                        {modelCount ? ` · ${modelCount} models` : ""}
                      </p>
                    </div>
                  </div>
                  <Button asChild={detected} disabled={!detected} variant="secondary" size="sm" className="w-full rounded-md">
                    {detected ? <Link href="/chat">Start Chat</Link> : <span>Start Chat</span>}
                  </Button>
                </article>
              );
            })}
          </div>
        </Section>

        <Section title="Runner Diagnostics">
          {runners.data.length ? (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Runner</th>
                    <th className="px-4 py-3 font-medium">Host</th>
                    <th className="px-4 py-3 font-medium">Tools</th>
                    <th className="px-4 py-3 font-medium">Executors</th>
                    <th className="px-4 py-3 font-medium">Last Seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {runners.data.map((runner) => (
                    <tr key={runner.id}>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-foreground">{runner.name}</span>
                          <StatusPill value={runner.status} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {runner.os} / {runner.arch}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {runner.tools.map((tool) => (
                            <StatusPill key={tool.id ?? `${tool.tool}:${tool.path ?? ""}`} value={`${toolName(tool)}:${tool.status}`} />
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
            <EmptyState title="No runners registered" description="Use the one-time macOS installer above, then refresh this page after the service starts." />
          )}
        </Section>
      </div>
    </div>
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

function toolName(tool: ToolRef) {
  if (tool.tool !== "custom") return tool.tool;
  return typeof tool.metadata?.displayName === "string" ? tool.metadata.displayName : "custom";
}
