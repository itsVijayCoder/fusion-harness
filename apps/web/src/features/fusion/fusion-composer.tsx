import { ChevronDown, Plus, X } from "lucide-react";
import type { FusionMode, ModelOption } from "./types";
import { cn } from "@/lib/utils";

type FusionComposerProps = {
  prompt: string;
  mode: FusionMode;
  selectedModels: ModelOption[];
  fuseModel: ModelOption | null;
  onPromptChange: (value: string) => void;
  onModeChange: (mode: FusionMode) => void;
  onRemoveModel: (modelId: string) => void;
  onAddModel: () => void;
  onPickFuseModel: () => void;
  onSend: () => void;
  sending: boolean;
  error: string | null;
};

const modes: Array<{ id: FusionMode; label: string }> = [
  { id: "quality", label: "Quality" },
  { id: "budget", label: "Budget" },
  { id: "custom", label: "Custom" },
];

export function FusionComposer({
  prompt,
  mode,
  selectedModels,
  fuseModel,
  onPromptChange,
  onModeChange,
  onRemoveModel,
  onAddModel,
  onPickFuseModel,
  onSend,
  sending,
  error,
}: FusionComposerProps) {
  const canSend = prompt.trim().length > 0 && selectedModels.length > 0 && !sending;

  return (
    <div className="flex flex-col items-center pt-16">
      <div className="flex items-center gap-2.5">
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground">Model Fusion</h1>
        <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          beta
        </span>
      </div>
      <p className="mt-2 text-center text-[14px] text-muted-foreground">
        Run multiple models side-by-side, run an analysis, and fuse into the best result.
      </p>

      {error ? (
        <div className="mt-4 w-full rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-[13px] text-destructive">
          {error}
        </div>
      ) : null}

      <div className="mt-8 w-full rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="flex items-center gap-0.5">
            {modes.map((m) => (
              <button
                key={m.id}
                onClick={() => onModeChange(m.id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors duration-150",
                  mode === m.id
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <button className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground">
            Save Group
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5">
          {selectedModels.map((model) => (
            <span
              key={model.id}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-muted py-1 pl-2.5 pr-1.5 text-[12px] font-medium text-foreground"
            >
              {model.name}
              <button
                onClick={() => onRemoveModel(model.id)}
                className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X aria-hidden className="size-3" />
              </button>
            </span>
          ))}
          <button
            onClick={onAddModel}
            className="flex items-center gap-1 rounded-lg border border-dashed border-border px-2.5 py-1 text-[12px] font-medium text-muted-foreground transition-colors duration-150 hover:border-foreground/20 hover:text-foreground"
          >
            <Plus aria-hidden className="size-3" />
            Add Model
          </button>
        </div>

        <div className="flex items-center gap-2 border-t border-border px-3 py-2.5">
          <span className="text-[12px] font-medium text-muted-foreground">Fuse with</span>
          {fuseModel ? (
            <button
              onClick={onPickFuseModel}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-muted py-1 pl-2.5 pr-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-muted/70"
            >
              {fuseModel.name}
              <ChevronDown aria-hidden className="size-3 text-muted-foreground" />
            </button>
          ) : (
            <button
              onClick={onPickFuseModel}
              className="flex items-center gap-1 rounded-lg border border-dashed border-border px-2.5 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Plus aria-hidden className="size-3" />
              Select model
            </button>
          )}
        </div>

        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
          placeholder="Ask anything..."
          rows={4}
          className="w-full resize-none bg-transparent px-4 py-3 text-[14px] leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none"
        />

        <div className="flex items-center justify-between border-t border-border px-3 py-2">
          <div className="flex items-center gap-0.5">
            <ComposerIconButton label="Web search" />
            <ComposerIconButton label="Attach" />
            <ComposerIconButton label="Enhance" />
            <ComposerIconButton label="More" />
          </div>
          <button
            onClick={onSend}
            disabled={!canSend}
            className={cn(
              "flex size-8 items-center justify-center rounded-lg transition-colors duration-150",
              canSend
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground",
            )}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="rotate-45">
              <path d="M12 4v12m0-12l-4 4m4-4l4 4M5 20h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function ComposerIconButton({ label }: { label: string }) {
  return (
    <button
      aria-label={label}
      className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
    >
      <span className="size-4 rounded-sm bg-current opacity-70" />
    </button>
  );
}