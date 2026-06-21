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
        "od-chrome flex w-full items-center gap-2.5 rounded-[var(--od-radius)] border border-[var(--od-border)] bg-[var(--od-panel)] px-3 py-2.5 text-left transition-colors duration-150",
        isExpanded ? "border-[var(--od-border-strong)] bg-[var(--od-accent-tint)]" : "hover:border-[var(--od-border-strong)] hover:bg-[var(--od-subtle)]",
      )}
    >
      <ProviderLogo id={model.provider || model.adapter} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-semibold text-[var(--od-text)]">{model.name}</p>
        <p className="truncate text-[11px] text-[var(--od-muted)]">{model.provider}</p>
      </div>
      <RiArrowRightSLine
        aria-hidden
        className={cn(
          "size-4 text-[var(--od-muted)] transition-transform duration-150",
          isExpanded && "rotate-90",
        )}
      />
    </button>
  );
}
