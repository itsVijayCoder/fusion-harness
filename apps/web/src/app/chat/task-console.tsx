"use client";

import {
  RiAddLine,
  RiArrowRightUpLine,
  RiArrowUpLine,
  RiCheckLine,
  RiCloseLine,
  RiCodeSSlashLine,
  RiComputerLine,
  RiEqualizerLine,
  RiFolder3Line,
  RiGitBranchLine,
  RiLoader4Line,
  RiRobot2Line,
  RiSearchLine,
  RiSettings3Line,
  RiShieldCheckLine,
  RiStackLine,
  RiTerminalBoxLine,
} from "@remixicon/react";
import { sanitizeCustomModelId, type AdapterId, type FusionRunSummary, type ModelRef, type PermissionProfile, type RunnerRef } from "@fusion-harness/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";

const presets = ["mixed-coding", "same-provider-first", "opencode-quality", "codex-quality", "fast", "budget"] as const;
const modes = ["required", "auto", "direct"] as const;
const permissions: PermissionProfile[] = ["readonly", "workspace_write", "trusted_internal"];
const adapters: AdapterId[] = [
  "opencode",
  "claude",
  "codex",
  "cursor-agent",
  "gemini",
  "qwen",
  "qoder",
  "copilot",
  "deepseek",
  "kimi",
  "hermes",
  "pi",
  "aider",
  "devin",
  "grok-build",
  "amp",
  "kiro",
  "kilo",
  "vibe",
  "trae-cli",
  "codebuddy",
  "reasonix",
  "antigravity",
  "openrouter",
  "openrouter-fusion",
  "api-key",
  "cloudflare-ai-gateway",
];

type AdapterIcon = typeof RiStackLine;

const adapterIcons: Partial<Record<AdapterId, AdapterIcon>> = {
  codex: RiCodeSSlashLine,
  opencode: RiRobot2Line,
  copilot: RiComputerLine,
  claude: RiShieldCheckLine,
};

const modelSelectionStorageKey = "fusion-harness:model-selection:v2";

type PickerTarget = "analysis" | "judge";
type OptionSource = "detected" | "custom";
type ModelOption = ModelRef & { optionSource: OptionSource };
type StoredModelSelection = {
  analysisModelIds?: string[];
  judgeModelId?: string;
  preset?: (typeof presets)[number];
  mode?: (typeof modes)[number];
  permissionProfile?: PermissionProfile;
  customModels?: Array<{ adapter: AdapterId; model: string }>;
};

type TaskConsoleProps = {
  models: ModelRef[];
  runners: RunnerRef[];
};

export function TaskConsole({ models, runners }: TaskConsoleProps) {
  const router = useRouter();
  const initialOptions = useMemo(() => buildModelOptions(models, []), [models]);
  const [prompt, setPrompt] = useState("");
  const [preset, setPreset] = useState<(typeof presets)[number]>("mixed-coding");
  const [mode, setMode] = useState<(typeof modes)[number]>("required");
  const [permissionProfile, setPermissionProfile] = useState<PermissionProfile>("readonly");
  const [customOptions, setCustomOptions] = useState<ModelOption[]>([]);
  const allOptions = useMemo(() => buildModelOptions(models, customOptions), [models, customOptions]);
  const optionById = useMemo(() => new Map(allOptions.map((option) => [option.id, option])), [allOptions]);
  const [analysisModelIds, setAnalysisModelIds] = useState(() => defaultAnalysisIds(initialOptions));
  const [judgeModelId, setJudgeModelId] = useState(() => defaultJudgeId(initialOptions));
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>("analysis");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [hasLoadedStoredSelection, setHasLoadedStoredSelection] = useState(false);
  const [isPending, startTransition] = useTransition();

  const selectedAnalysis = analysisModelIds.map((id) => optionById.get(id)).filter(Boolean) as ModelOption[];
  const judgeModel = optionById.get(judgeModelId) ?? selectedAnalysis[0] ?? allOptions[0];
  const pickerSelectedIds = pickerTarget === "analysis" ? analysisModelIds : [judgeModel?.id].filter((id): id is string => Boolean(id));
  const detectedAgentCount = runners.reduce((count, runner) => count + runner.tools.filter((tool) => tool.status !== "unavailable").length, 0);
  const onlineRunnerCount = runners.filter((runner) => runner.status === "online").length;
  const disabled = isPending || !prompt.trim() || selectedAnalysis.length === 0 || !judgeModel;

  useEffect(() => {
    const storedSelection = readStoredModelSelection();
    const timeoutId = window.setTimeout(() => {
      if (storedSelection) {
        const storedCustomOptions = customOptionsFromStored(storedSelection);
        const storedOptions = buildModelOptions(models, storedCustomOptions);
        setCustomOptions(storedCustomOptions);
        setPreset(storedSelection.preset ?? "mixed-coding");
        setMode(storedSelection.mode ?? "required");
        setPermissionProfile(storedSelection.permissionProfile ?? "readonly");
        setAnalysisModelIds(storedModelIds(storedSelection.analysisModelIds, storedOptions, 6) ?? defaultAnalysisIds(storedOptions));
        setJudgeModelId(storedModelId(storedSelection.judgeModelId, storedOptions) ?? defaultJudgeId(storedOptions));
      }
      setHasLoadedStoredSelection(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [models]);

  useEffect(() => {
    if (!hasLoadedStoredSelection) return;
    writeStoredModelSelection({
      analysisModelIds,
      judgeModelId,
      preset,
      mode,
      permissionProfile,
      customModels: customOptions.filter((option) => option.optionSource === "custom").map((option) => ({ adapter: option.adapter, model: option.model })),
    });
  }, [analysisModelIds, customOptions, hasLoadedStoredSelection, judgeModelId, mode, permissionProfile, preset]);

  function openPicker(target: PickerTarget) {
    setPickerTarget(target);
    setIsPickerOpen(true);
  }

  function addCustomOption(adapter: AdapterId, model: string) {
    const sanitizedModel = sanitizeCustomModelId(model);
    if (!sanitizedModel) {
      setError("Model ID can only use letters, numbers, '.', '_', '/', ':', '@', or '-'");
      return false;
    }

    const option = customModel(adapter, sanitizedModel);
    setCustomOptions((current) => (current.some((item) => item.id === option.id) ? current : [...current, option]));
    selectModel(option.id, pickerTarget);
    setError(undefined);
    return true;
  }

  function selectModel(modelId: string, target: PickerTarget) {
    if (target === "analysis") {
      setAnalysisModelIds((current) => {
        if (current.includes(modelId)) {
          return current.length > 1 ? current.filter((id) => id !== modelId) : current;
        }
        return [...current, modelId].slice(0, 6);
      });
      return;
    }

    setJudgeModelId(modelId);
    setIsPickerOpen(false);
  }

  function submit() {
    setError(undefined);
    startTransition(async () => {
      try {
        const run = await apiPost<FusionRunSummary>("/api/fusion/runs", {
          mode,
          preset,
          permissionProfile,
          providerPolicy: selectedAnalysis.length ? "manual" : preset === "mixed-coding" ? "mixed_quality" : "same_provider_first",
          analysisModels: selectedAnalysis.map((model) => model.id),
          judgeModel: judgeModel?.id,
          messages: [{ role: "user", content: prompt }],
          stream: true,
        });
        router.push(`/runs/${run.id}`);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Failed to create run");
      }
    });
  }

  return (
    <div className="min-h-screen bg-[#07080a] pb-20 text-zinc-100 xl:pb-0">
      <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[56px_292px_minmax(0,1fr)_360px]">
        <IconRail />

        <aside className="hidden min-h-0 border-r border-white/10 bg-[#0b0d10] xl:flex xl:flex-col">
          <div className="flex h-14 items-center gap-3 border-b border-white/10 px-4">
            <span className="flex size-8 items-center justify-center rounded-md bg-cyan-300 text-zinc-950">
              <RiRobot2Line aria-hidden className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">Fusion Harness</p>
              <p className="truncate text-xs text-zinc-500">Local agents</p>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
            <SidebarMetric label="Runners" value={`${onlineRunnerCount}/${runners.length}`} detail="online" />
            <SidebarMetric label="Agents" value={detectedAgentCount} detail="detected" />

            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase text-zinc-500">Local agents</p>
              {runners.length ? (
                runners.slice(0, 5).map((runner) => <RunnerRow key={runner.id} runner={runner} />)
              ) : (
                <p className="rounded-md border border-dashed border-white/10 px-3 py-6 text-center text-sm text-zinc-500">No runner connected</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase text-zinc-500">Model inventory</p>
              {allOptions.length ? (
                allOptions.slice(0, 8).map((model) => <CompactModelRow key={model.id} model={model} />)
              ) : (
                <p className="rounded-md border border-dashed border-white/10 px-3 py-6 text-center text-sm text-zinc-500">Add a custom model to start</p>
              )}
            </div>
          </div>
        </aside>

        <main className="min-w-0 border-r border-white/10 bg-[#090b0e]">
          <div className="flex h-14 items-center justify-between gap-4 border-b border-white/10 px-4">
            <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-zinc-200">
              <RiTerminalBoxLine aria-hidden className="size-4 text-cyan-300" />
              <span className="truncate">Prompt workbench</span>
            </div>
            <nav className="flex shrink-0 items-center gap-2 text-xs font-semibold text-zinc-500">
              <Link href="/runs" className="rounded-md px-2 py-1 hover:bg-white/10 hover:text-zinc-100">
                Runs
              </Link>
              <Link href="/models" className="rounded-md px-2 py-1 hover:bg-white/10 hover:text-zinc-100">
                Models
              </Link>
              <Link href="/runners" className="rounded-md px-2 py-1 hover:bg-white/10 hover:text-zinc-100">
                Agents
              </Link>
            </nav>
          </div>

          <section className="grid min-h-[calc(100vh-3.5rem)] grid-rows-[minmax(340px,0.9fr)_minmax(280px,1fr)]">
            <div className="min-h-0 border-b border-white/10">
              <div className="flex h-10 items-center justify-between border-b border-white/10 bg-[#0d0f13] px-4 text-xs font-semibold text-zinc-500">
                <span>Prompt</span>
                <span>{prompt.length.toLocaleString()} chars</span>
              </div>
              <textarea
                suppressHydrationWarning
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="h-[calc(100%-2.5rem)] min-h-[300px] w-full resize-none bg-[#090b0e] px-5 py-5 font-mono text-sm leading-6 text-zinc-100 outline-none placeholder:text-zinc-700"
                placeholder="Describe the task, expected format, constraints, and files to consider..."
              />
            </div>

            <div className="min-h-0 overflow-y-auto p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h1 className="text-base font-semibold text-white">Panel models</h1>
                  <p className="mt-1 text-xs text-zinc-500">{selectedAnalysis.length} selected</p>
                </div>
                <button type="button" onClick={() => openPicker("analysis")} className="inline-flex h-8 items-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-3 text-xs font-semibold text-zinc-300 hover:bg-white/[0.08] hover:text-white">
                  <RiAddLine aria-hidden className="size-4" />
                  Add
                </button>
              </div>

              {selectedAnalysis.length ? (
                <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                  {selectedAnalysis.map((model, index) => (
                    <PanelLane key={model.id} model={model} role={panelRole(index)} onRemove={() => setAnalysisModelIds((current) => current.filter((id) => id !== model.id))} />
                  ))}
                </div>
              ) : (
                <div className="flex min-h-56 items-center justify-center rounded-md border border-dashed border-white/10 bg-white/[0.02] text-sm text-zinc-500">
                  No panel models selected
                </div>
              )}
            </div>
          </section>
        </main>

        <aside className="min-w-0 bg-[#0b0d10]">
          <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
              <RiStackLine aria-hidden className="size-4 text-emerald-300" />
              Judge / synthesis
            </div>
            <StatusDot label={disabled ? "waiting" : "ready"} active={!disabled} />
          </div>

          <div className="flex min-h-[calc(100vh-3.5rem)] flex-col gap-4 p-4">
            <section className="rounded-md border border-white/10 bg-[#101318]">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
                <p className="text-xs font-semibold uppercase text-zinc-500">Synthesis model</p>
                <button type="button" onClick={() => openPicker("judge")} className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-semibold text-cyan-200 hover:bg-white/10">
                  Change
                  <RiArrowRightUpLine aria-hidden className="size-3.5" />
                </button>
              </div>
              {judgeModel ? (
                <div className="p-3">
                  <ModelIdentity model={judgeModel} large />
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <DetailBlock label="Adapter" value={adapterLabel(judgeModel.adapter)} />
                    <DetailBlock label="Auth" value={judgeModel.authMode.replace(/_/g, " ")} />
                    <DetailBlock label="Model" value={shortModelName(judgeModel)} wide />
                  </div>
                </div>
              ) : (
                <p className="p-4 text-sm text-zinc-500">No judge model selected</p>
              )}
            </section>

            <section className="rounded-md border border-white/10 bg-[#101318]">
              <div className="border-b border-white/10 px-3 py-2">
                <p className="text-xs font-semibold uppercase text-zinc-500">Run profile</p>
              </div>
              <div className="flex flex-col gap-3 p-3">
                <SegmentedControl value={mode} values={modes} onChange={setMode} />
                <SelectControl label="Preset" value={preset} onChange={(value) => setPreset(value as (typeof presets)[number])} options={presets} />
                <SelectControl label="Permission" value={permissionProfile} onChange={(value) => setPermissionProfile(value as PermissionProfile)} options={permissions} />
              </div>
            </section>

            <section className="rounded-md border border-white/10 bg-[#101318]">
              <div className="border-b border-white/10 px-3 py-2">
                <p className="text-xs font-semibold uppercase text-zinc-500">Execution plan</p>
              </div>
              <div className="flex flex-col gap-2 p-3">
                <PlanStep index={1} label="Prompt" value={prompt.trim() ? "ready" : "empty"} />
                <PlanStep index={2} label="Panel" value={`${selectedAnalysis.length} native run${selectedAnalysis.length === 1 ? "" : "s"}`} />
                <PlanStep index={3} label="Judge / synthesis" value={judgeModel ? shortModelName(judgeModel) : "not selected"} />
                <PlanStep index={4} label="Final output" value="same model" />
              </div>
            </section>

            <div className="mt-auto flex flex-col gap-3">
              {error ? <p className="break-words rounded-md border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-medium leading-5 text-red-200">{error}</p> : null}
              <Button onClick={submit} disabled={disabled} size="lg" className="h-10 rounded-md bg-cyan-300 font-semibold text-zinc-950 hover:bg-cyan-200">
                {isPending ? <RiLoader4Line aria-hidden data-icon="inline-start" className="animate-spin" /> : <RiArrowUpLine aria-hidden data-icon="inline-start" />}
                Run
              </Button>
            </div>
          </div>
        </aside>
      </div>

      {isPickerOpen ? (
        <ModelPicker
          options={allOptions}
          selectedIds={pickerSelectedIds}
          target={pickerTarget}
          onClose={() => setIsPickerOpen(false)}
          onAddCustom={addCustomOption}
          onSelect={(modelId) => selectModel(modelId, pickerTarget)}
        />
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0b0d10]/95 py-3 pl-16 pr-3 backdrop-blur sm:px-3 xl:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-zinc-300">
              {selectedAnalysis.length} panel / {judgeModel ? shortModelName(judgeModel) : "no judge"}
            </p>
            <p className="truncate text-[11px] text-zinc-600">{prompt.trim() ? `${prompt.length.toLocaleString()} chars` : "empty prompt"}</p>
          </div>
          <Button onClick={submit} disabled={disabled} size="sm" className="h-9 rounded-md bg-cyan-300 font-semibold text-zinc-950 hover:bg-cyan-200">
            {isPending ? <RiLoader4Line aria-hidden data-icon="inline-start" className="animate-spin" /> : <RiArrowUpLine aria-hidden data-icon="inline-start" />}
            Run
          </Button>
        </div>
      </div>
    </div>
  );
}

function IconRail() {
  return (
    <aside className="hidden border-r border-white/10 bg-[#060708] xl:flex xl:flex-col xl:items-center xl:py-3">
      <div className="flex size-9 items-center justify-center rounded-md bg-white text-zinc-950">
        <RiRobot2Line aria-hidden className="size-5" />
      </div>
      <div className="mt-5 flex flex-col gap-2 text-zinc-500">
        <RailButton label="Workbench">
          <RiTerminalBoxLine aria-hidden className="size-4" />
        </RailButton>
        <RailButton label="Runs">
          <RiGitBranchLine aria-hidden className="size-4" />
        </RailButton>
        <RailButton label="Models">
          <RiStackLine aria-hidden className="size-4" />
        </RailButton>
      </div>
      <div className="mt-auto flex flex-col gap-2 text-zinc-500">
        <RailButton label="Workspace">
          <RiFolder3Line aria-hidden className="size-4" />
        </RailButton>
        <RailButton label="Settings">
          <RiSettings3Line aria-hidden className="size-4" />
        </RailButton>
      </div>
    </aside>
  );
}

function RailButton({ label, children }: { label: string; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} className="flex size-9 items-center justify-center rounded-md hover:bg-white/10 hover:text-zinc-100">
      {children}
    </button>
  );
}

function SidebarMetric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs font-semibold uppercase text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{detail}</p>
    </div>
  );
}

function RunnerRow({ runner }: { runner: RunnerRef }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-200">{runner.name}</p>
          <p className="mt-1 truncate text-xs text-zinc-500">
            {runner.os} / {runner.arch}
          </p>
        </div>
        <StatusDot label={runner.status} active={runner.status === "online"} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {runner.tools.slice(0, 4).map((tool) => (
          <span key={tool.id ?? `${runner.id}-${tool.tool}`} className="rounded-md border border-white/10 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500">
            {toolName(tool)}
          </span>
        ))}
      </div>
    </div>
  );
}

function CompactModelRow({ model }: { model: ModelOption }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-2">
      <ModelMark model={model} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-zinc-300">{shortModelName(model)}</p>
        <p className="truncate text-[11px] text-zinc-600">{adapterLabel(model.adapter)}</p>
      </div>
    </div>
  );
}

function PanelLane({ model, role, onRemove }: { model: ModelOption; role: string; onRemove: () => void }) {
  return (
    <article className="min-h-44 rounded-md border border-white/10 bg-[#101318]">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 p-3">
        <ModelIdentity model={model} />
        <button type="button" onClick={onRemove} aria-label={`Remove ${shortModelName(model)}`} className="flex size-7 items-center justify-center rounded-md text-zinc-600 hover:bg-white/10 hover:text-zinc-100">
          <RiCloseLine aria-hidden className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3 text-xs">
        <DetailBlock label="Role" value={role} />
        <DetailBlock label="Source" value={model.optionSource} />
        <DetailBlock label="Adapter" value={adapterLabel(model.adapter)} />
        <DetailBlock label="Status" value={model.availability.replace(/_/g, " ")} />
      </div>
      <div className="border-t border-white/10 px-3 py-2 font-mono text-xs text-zinc-600">native://{model.adapter}/{model.model}</div>
    </article>
  );
}

function ModelIdentity({ model, large = false }: { model: ModelOption; large?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <ModelMark model={model} large={large} />
      <div className="min-w-0">
        <p className={cn("truncate font-semibold text-zinc-100", large ? "text-base" : "text-sm")}>{shortModelName(model)}</p>
        <p className="mt-1 truncate text-xs text-zinc-500">
          {adapterLabel(model.adapter)} / {model.provider ?? "local"}
        </p>
      </div>
    </div>
  );
}

function ModelPicker({
  options,
  selectedIds,
  target,
  onClose,
  onSelect,
  onAddCustom,
}: {
  options: ModelOption[];
  selectedIds: string[];
  target: PickerTarget;
  onClose: () => void;
  onSelect: (modelId: string) => void;
  onAddCustom: (adapter: AdapterId, model: string) => boolean;
}) {
  const [query, setQuery] = useState("");
  const [adapterFilter, setAdapterFilter] = useState<AdapterId | "all">("all");
  const [customAdapter, setCustomAdapter] = useState<AdapterId>("opencode");
  const [customModel, setCustomModel] = useState("");
  const [customError, setCustomError] = useState<string>();
  const filteredOptions = options.filter((option) => {
    const matchesAdapter = adapterFilter === "all" || option.adapter === adapterFilter;
    const haystack = `${option.displayName ?? ""} ${option.model} ${option.provider ?? ""} ${option.adapter}`.toLowerCase();
    return matchesAdapter && haystack.includes(query.toLowerCase());
  });
  const activeOption = filteredOptions.find((option) => selectedIds.includes(option.id)) ?? filteredOptions[0];

  function submitCustom() {
    const sanitizedModel = sanitizeCustomModelId(customModel);
    if (!sanitizedModel) {
      setCustomError("Use letters, numbers, '.', '_', '/', ':', '@', or '-'");
      return;
    }
    if (onAddCustom(customAdapter, sanitizedModel)) {
      setCustomModel("");
      setCustomError(undefined);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="grid h-[min(650px,calc(100vh-40px))] w-[min(980px,calc(100vw-32px))] grid-cols-1 overflow-hidden rounded-md border border-white/15 bg-[#0b0d10] text-zinc-100 shadow-2xl shadow-black/60 md:grid-cols-[1fr_280px]">
        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="flex items-center gap-3 border-b border-white/10 p-3">
            <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border border-white/15 bg-black/20 px-3">
              <RiSearchLine aria-hidden className="size-4 text-zinc-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-600"
                placeholder="Search detected and custom models"
                autoFocus
              />
              <span className="text-xs font-semibold text-zinc-500">{options.length}</span>
            </div>
            <button type="button" onClick={onClose} className="flex size-9 items-center justify-center rounded-md text-zinc-500 hover:bg-white/10 hover:text-zinc-100" aria-label="Close model picker">
              <RiCloseLine aria-hidden className="size-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2">
            <RiEqualizerLine aria-hidden className="size-4 text-zinc-500" />
            {(["all", ...adapters] as const).map((adapter) => (
              <button key={adapter} type="button" onClick={() => setAdapterFilter(adapter)} className={adapterFilter === adapter ? darkPillActive : darkPillInactive}>
                {adapter === "all" ? "All" : adapterLabel(adapter)}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {filteredOptions.length ? (
              filteredOptions.map((option) => {
                const selected = selectedIds.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onSelect(option.id)}
                    className={cn(
                      "flex w-full items-center gap-3 border-b border-white/10 px-4 py-3 text-left hover:bg-white/[0.06]",
                      selected ? "bg-cyan-300/10" : "bg-transparent",
                    )}
                  >
                    <ModelMark model={option} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-zinc-200">{option.displayName ?? option.model}</span>
                      <span className="block truncate text-xs text-zinc-500">
                        {adapterLabel(option.adapter)} / {option.provider ?? "local"} / {option.availability.replace(/_/g, " ")}
                      </span>
                    </span>
                    {selected ? <RiCheckLine aria-hidden className="size-4 text-cyan-200" /> : null}
                  </button>
                );
              })
            ) : (
              <div className="flex min-h-60 items-center justify-center px-6 text-center text-sm text-zinc-500">No matching models</div>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-white/10 p-3 sm:flex-row">
            <select value={customAdapter} onChange={(event) => setCustomAdapter(event.target.value as AdapterId)} className="h-9 rounded-md border border-white/15 bg-[#11141a] px-3 text-xs font-semibold text-zinc-300 outline-none">
              {adapters.map((adapter) => (
                <option key={adapter} value={adapter}>
                  {adapterLabel(adapter)}
                </option>
              ))}
            </select>
            <input
              value={customModel}
              onChange={(event) => {
                setCustomModel(event.target.value);
                setCustomError(undefined);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitCustom();
              }}
              className={cn(
                "h-9 min-w-0 flex-1 rounded-md border bg-[#11141a] px-3 text-sm outline-none placeholder:text-zinc-600",
                customError ? "border-red-400/70" : "border-white/15",
              )}
              placeholder="provider/model or model-id"
              aria-invalid={Boolean(customError)}
            />
            <button type="button" onClick={submitCustom} className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-white/20 px-3 text-xs font-semibold text-zinc-300 hover:bg-white/10">
              <RiAddLine aria-hidden className="size-3.5" />
              Add
            </button>
            {customError ? <span className="basis-full text-xs font-medium text-red-300">{customError}</span> : null}
          </div>
        </div>

        <aside className="hidden min-h-0 border-l border-white/10 bg-[#101318] p-4 md:block">
          {activeOption ? (
            <div className="flex h-full flex-col gap-4">
              <ModelIdentity model={activeOption} large />
              <div className="divide-y divide-white/10 rounded-md border border-white/10 text-xs">
                <DetailRow label="Target" value={target === "analysis" ? "panel model" : "judge / synthesis"} />
                <DetailRow label="Adapter" value={adapterLabel(activeOption.adapter)} />
                <DetailRow label="Auth" value={activeOption.authMode.replace(/_/g, " ")} />
                <DetailRow label="Provider" value={activeOption.provider ?? "local"} />
                <DetailRow label="Status" value={activeOption.availability.replace(/_/g, " ")} />
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function SegmentedControl<T extends string>({ value, values, onChange }: { value: T; values: readonly T[]; onChange: (value: T) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-md border border-white/10 bg-black/20 p-1">
      {values.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          className={cn(
            "h-8 rounded-sm text-xs font-semibold transition",
            value === item ? "bg-zinc-100 text-zinc-950" : "text-zinc-500 hover:bg-white/10 hover:text-zinc-200",
          )}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function SelectControl<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly T[]; onChange: (value: T) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase text-zinc-500">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value as T)} className="h-9 rounded-md border border-white/10 bg-black/20 px-3 text-xs font-semibold text-zinc-300 outline-none">
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function DetailBlock({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn("min-w-0 rounded-md border border-white/10 bg-black/20 p-2", wide && "col-span-2")}>
      <p className="text-[11px] font-semibold uppercase text-zinc-600">{label}</p>
      <p className="mt-1 truncate text-xs font-medium text-zinc-300">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <span className="text-zinc-500">{label}</span>
      <span className="truncate text-zinc-300">{value}</span>
    </div>
  );
}

function PlanStep({ index, label, value }: { index: number; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-white/10 bg-black/20 px-3 py-2">
      <span className="flex size-6 items-center justify-center rounded-sm bg-white/10 text-xs font-semibold text-zinc-400">{index}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-zinc-200">{label}</span>
        <span className="block truncate text-xs text-zinc-500">{value}</span>
      </span>
    </div>
  );
}

function StatusDot({ label, active }: { label: string; active: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] font-semibold text-zinc-500">
      <span className={cn("size-1.5 rounded-full", active ? "bg-emerald-300" : "bg-zinc-600")} />
      {label}
    </span>
  );
}

function ModelMark({ model, large = false }: { model: ModelOption; large?: boolean }) {
  const Icon = adapterIcons[model.adapter] ?? RiStackLine;
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-950", large ? "size-10" : "size-8")}>
      <Icon aria-hidden className={large ? "size-5" : "size-4"} />
    </span>
  );
}

function buildModelOptions(models: ModelRef[], customOptions: ModelOption[]) {
  const options = new Map<string, ModelOption>();
  for (const model of models) {
    if (model.source === "custom" || model.source === "suggested" || (model.source === "fallback" && model.model !== "default")) {
      continue;
    }
    options.set(model.id, { ...model, optionSource: "detected" });
  }
  for (const model of customOptions) {
    if (!resolveCanonicalModelId(model.id, [...options.values()])) {
      options.set(model.id, model);
    }
  }

  return [...options.values()].sort((a, b) => sourceScore(a.optionSource) - sourceScore(b.optionSource) || a.adapter.localeCompare(b.adapter) || a.model.localeCompare(b.model));
}

function defaultAnalysisIds(options: ModelOption[]) {
  const detected = options.filter(isUsableModel).slice(0, 3);
  if (detected.length) return detected.map((option) => option.id);
  return [];
}

function defaultJudgeId(options: ModelOption[]) {
  const detected = options.filter(isUsableModel);
  return detected.find((option) => option.adapter === "codex")?.id ?? detected[0]?.id ?? "";
}

function isUsableModel(option: ModelOption) {
  return option.availability !== "unavailable" && option.authMode !== "unknown";
}

function customModel(adapter: AdapterId, model: string): ModelOption {
  const provider = adapter === "codex" ? "openai" : model.includes("/") ? model.split("/")[0] : adapter;
  return {
    id: `${adapter}/${model}`,
    adapter,
    provider,
    model,
    displayName: model,
    authMode: adapter === "cloudflare-ai-gateway" ? "cloud_gateway" : adapter === "api-key" || adapter === "openrouter" || adapter === "openrouter-fusion" ? "api_key" : "cli_session",
    availability: "configured_unverified",
    source: "custom",
    optionSource: "custom",
    capabilities: {
      streaming: true,
      tools: adapter !== "api-key",
      fileEdits: adapter === "opencode" || adapter === "codex",
      shell: adapter === "opencode" || adapter === "codex",
      jsonOutput: true,
      modelListing: false,
    },
  };
}

function adapterLabel(adapter: AdapterId) {
  const labels: Record<AdapterId, string> = {
    opencode: "OpenCode",
    claude: "Claude Code",
    codex: "Codex",
    "cursor-agent": "Cursor Agent",
    gemini: "Gemini",
    qwen: "Qwen",
    qoder: "Qoder",
    copilot: "Copilot",
    deepseek: "DeepSeek",
    kimi: "Kimi",
    hermes: "Hermes",
    pi: "Pi",
    aider: "Aider",
    devin: "Devin",
    "grok-build": "Grok Build",
    amp: "Amp",
    kiro: "Kiro",
    kilo: "Kilo",
    vibe: "Vibe",
    "trae-cli": "Trae CLI",
    codebuddy: "Codebuddy",
    reasonix: "Reasonix",
    antigravity: "Antigravity",
    openrouter: "OpenRouter",
    "openrouter-fusion": "OpenRouter Fusion",
    "api-key": "API key",
    "cloudflare-ai-gateway": "AI Gateway",
  };
  return labels[adapter];
}

function shortModelName(model: Pick<ModelRef, "displayName" | "model">) {
  return model.displayName ?? model.model.split("/").at(-1) ?? model.model;
}

function panelRole(index: number) {
  return ["architect", "critic", "implementer", "risk", "test", "maintainer"][index] ?? `panel-${index + 1}`;
}

function toolName(tool: RunnerRef["tools"][number]) {
  const agentName = typeof tool.metadata?.displayName === "string" ? tool.metadata.displayName : undefined;
  return agentName ?? tool.tool;
}

function sourceScore(source: OptionSource) {
  return source === "detected" ? 0 : 1;
}

function readStoredModelSelection(): StoredModelSelection | undefined {
  if (typeof window === "undefined") return undefined;

  const rawValue = window.localStorage.getItem(modelSelectionStorageKey);
  if (!rawValue) return undefined;

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    return sanitizeStoredModelSelection(parsed);
  } catch {
    return undefined;
  }
}

function writeStoredModelSelection(selection: StoredModelSelection) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(modelSelectionStorageKey, JSON.stringify(selection));
}

function sanitizeStoredModelSelection(value: Partial<StoredModelSelection>): StoredModelSelection {
  const customModels = Array.isArray(value.customModels)
    ? value.customModels.flatMap((item) => {
        if (!item || typeof item !== "object" || !isOneOf(adapters, item.adapter)) return [];
        const model = sanitizeCustomModelId(item.model);
        return model ? [{ adapter: item.adapter, model }] : [];
      })
    : undefined;

  return {
    analysisModelIds: Array.isArray(value.analysisModelIds)
      ? value.analysisModelIds
          .flatMap((id) => {
            const modelId = sanitizeStoredModelId(id);
            return modelId ? [modelId] : [];
          })
          .slice(0, 6)
      : undefined,
    judgeModelId: sanitizeStoredModelId(value.judgeModelId) ?? undefined,
    preset: isOneOf(presets, value.preset) ? value.preset : undefined,
    mode: isOneOf(modes, value.mode) ? value.mode : undefined,
    permissionProfile: isOneOf(permissions, value.permissionProfile) ? value.permissionProfile : undefined,
    customModels,
  };
}

function customOptionsFromStored(selection?: StoredModelSelection) {
  return (selection?.customModels ?? []).map((item) => customModel(item.adapter, item.model));
}

function storedModelIds(ids: string[] | undefined, options: ModelOption[], limit: number) {
  const validIds = (ids ?? [])
    .flatMap((id) => {
      const resolved = resolveCanonicalModelId(id, options);
      return resolved ? [resolved] : [];
    })
    .slice(0, limit);
  return validIds.length ? validIds : undefined;
}

function storedModelId(id: string | undefined, options: ModelOption[]) {
  if (!id) return undefined;
  return resolveCanonicalModelId(id, options);
}

function resolveCanonicalModelId(id: string, options: ModelOption[]) {
  if (options.some((option) => option.id === id)) return id;

  const [adapter, ...modelParts] = id.split("/");
  if (!isOneOf(adapters, adapter) || modelParts.length < 2) return undefined;
  const modelSuffix = modelParts.join("/");
  const suffixMatches = options.filter(
    (option) =>
      option.adapter === adapter &&
      (option.model.endsWith(`/${modelSuffix}`) || option.id.endsWith(`/${modelSuffix}`)) &&
      option.optionSource !== "custom",
  );
  return suffixMatches.sort((a, b) => sourceScore(a.optionSource) - sourceScore(b.optionSource))[0]?.id;
}

function sanitizeStoredModelId(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 200 || /[\x00-\x1F\x7F]/.test(trimmed)) return null;
  return trimmed;
}

function isOneOf<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

const darkPillActive = "h-8 rounded-md bg-zinc-100 px-3 text-xs font-semibold text-zinc-950";
const darkPillInactive = "h-8 rounded-md bg-white/[0.04] px-3 text-xs font-semibold text-zinc-500 hover:bg-white/[0.08] hover:text-zinc-200";
