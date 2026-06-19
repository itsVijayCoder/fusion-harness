import { ChevronRight, Plus } from "lucide-react";
import type { ModelOption } from "./types";
import { cn } from "@/lib/utils";

type ModelSourceRowProps = {
  model: ModelOption;
  isExpanded: boolean;
  onToggle: () => void;
}

export function ModelSourceRow({ model, isExpanded, onToggle }: ModelSourceRowProps) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-colors duration-150",
        isExpanded ? "border-foreground/10" : "hover:border-foreground/10 hover:bg-muted/30",
      )}
    >
      <span className="flex size-5 items-center justify-center rounded-md border border-border text-muted-foreground">
        <Plus aria-hidden className="size-3" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-foreground">{model.name}</p>
        <p className="truncate text-[11px] text-muted-foreground">{model.provider}</p>
      </div>
      <ChevronRight
        aria-hidden
        className={cn(
          "size-4 text-muted-foreground transition-transform duration-150",
          isExpanded && "rotate-90",
        )}
      />
    </button>
  );
}