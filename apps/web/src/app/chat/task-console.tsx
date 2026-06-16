"use client";

import { RiArrowRightLine, RiLoader4Line } from "@remixicon/react";
import type { FusionRunSummary, PermissionProfile } from "@fusion-harness/shared";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api";

const presets = ["same-provider-first", "mixed-coding", "opencode-quality", "codex-quality", "fast", "budget"] as const;
const modes = ["auto", "required", "direct"] as const;
const permissions: PermissionProfile[] = ["readonly", "workspace_write", "trusted_internal"];

export function TaskConsole() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [preset, setPreset] = useState<(typeof presets)[number]>("same-provider-first");
  const [mode, setMode] = useState<(typeof modes)[number]>("auto");
  const [permissionProfile, setPermissionProfile] = useState<PermissionProfile>("readonly");
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(undefined);
    startTransition(async () => {
      try {
        const run = await apiPost<FusionRunSummary>("/api/fusion/runs", {
          mode,
          preset,
          permissionProfile,
          providerPolicy: preset === "mixed-coding" ? "mixed_quality" : "same_provider_first",
          messages: [{ role: "user", content: prompt }],
          stream: true,
        });
        router.push(`/runs/${run.id}`);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Failed to create run");
      }
    });
  }

  const disabled = isPending || !prompt.trim();

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="rounded-lg border border-border bg-card">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          className="min-h-[360px] w-full resize-y bg-transparent p-5 text-sm leading-6 outline-none placeholder:text-muted-foreground"
          placeholder="Implement a feature, review a design, compare approaches, or generate a patch plan."
        />
        <div className="flex items-center justify-between gap-3 border-t border-border p-4">
          <p className="text-xs text-muted-foreground">{prompt.length} characters</p>
          <Button onClick={submit} disabled={disabled}>
            {isPending ? <RiLoader4Line aria-hidden data-icon="inline-start" className="animate-spin" /> : <RiArrowRightLine aria-hidden data-icon="inline-start" />}
            Create run
          </Button>
        </div>
      </div>
      <aside className="flex flex-col gap-4">
        <ControlGroup label="Mode">
          {modes.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={item === mode ? activeControlClass : inactiveControlClass}
            >
              {item}
            </button>
          ))}
        </ControlGroup>
        <ControlGroup label="Preset">
          <select value={preset} onChange={(event) => setPreset(event.target.value as (typeof presets)[number])} className={selectClass}>
            {presets.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </ControlGroup>
        <ControlGroup label="Permission">
          <select value={permissionProfile} onChange={(event) => setPermissionProfile(event.target.value as PermissionProfile)} className={selectClass}>
            {permissions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </ControlGroup>
        {error ? <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
      </aside>
    </div>
  );
}

function ControlGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <span className="text-xs font-medium uppercase text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

const activeControlClass = "h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground";
const inactiveControlClass = "h-8 rounded-md border border-border bg-background px-3 text-sm font-medium text-muted-foreground hover:bg-muted";
const selectClass = "h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-ring";
