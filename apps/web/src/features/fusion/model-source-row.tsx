import { RiArrowRightSLine } from "@remixicon/react";
import { ProviderLogo } from "@/components/provider-logo";
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
        "flex w-full items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors duration-150",
        isExpanded ? "border-primary/30 bg-primary/10" : "hover:border-input hover:bg-muted/60",
      )}
    >
      <ProviderLogo id={model.provider || model.adapter} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{model.name}</p>
        <p className="truncate text-xs text-muted-foreground">{model.provider}</p>
      </div>
      <RiArrowRightSLine
        aria-hidden
        className={cn(
          "size-4 text-muted-foreground transition-transform duration-150",
          isExpanded && "rotate-90",
        )}
      />
    </button>
  );
}
